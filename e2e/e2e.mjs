import chromium from "@sparticuz/chromium";
import { chromium as pw } from "playwright-core";
import fs from "node:fs";
import { createRequire } from "node:module";
const axeSrc = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

const BASE = "http://127.0.0.1:8081";
const ADMIN = { email: "owner@example.com", password: "e2e-long-passphrase-123" };
fs.mkdirSync("/tmp/e2e/shots", { recursive: true });
fs.writeFileSync("/tmp/e2e/png.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));
// a larger real PNG for the upload
import { execSync } from "node:child_process";
execSync(`python3 -c "from PIL import Image; Image.new('RGB',(1200,700),(37,99,235)).save('/tmp/e2e/upload.png')"`);

const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

const browser = await pw.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });

function watch(page, bucket) {
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("ERR_NAME_NOT_RESOLVED") && !(m.text().includes("401") && /admin/.test(page.url()))) bucket.push(`console: ${m.text().slice(0, 200)}`); }); // the sandbox has no internet, so Google Fonts cannot resolve; a 401 on admin pages is the expected signed-out check
  page.on("pageerror", (e) => bucket.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/auth/me")) bucket.push(`http ${r.status()}: ${r.url().replace(BASE, "")}`); });
  page.on("requestfailed", (r) => !/fonts\.(googleapis|gstatic)\.com/.test(r.url()) && bucket.push(`requestfailed: ${r.url().replace(BASE, "")} ${r.failure()?.errorText}`));
}
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
watch(page, errors);
const quiet = async (label) => { await page.waitForLoadState("networkidle"); check(`${label}: no console errors, CSP violations or failed requests`, errors.length === 0, errors.splice(0).join(" | ")); };

process.on("uncaughtException", async (e) => { try { console.log("DIAG url:", page.url()); console.log("DIAG errors:", JSON.stringify(errors.slice(0,5))); console.log("DIAG body:", (await page.locator("body").innerText()).slice(0,400).replace(/\n+/g," | ")); await page.screenshot({ path: "/tmp/e2e/shots/failure.png" }); } catch (x) { console.log("diag failed", String(x)); } console.log(String(e).slice(0,300)); process.exit(1); });
// ---------- public site ----------
await page.goto(BASE + "/");
await page.waitForSelector("h1");
check("home: hero headline from the brief", (await page.textContent("h1")).includes("Building Intelligent Systems"));
check("home: no invented statistics section", (await page.locator('[aria-label="Key statistics"]').count()) === 0);
await quiet("home");
await page.screenshot({ path: "/tmp/e2e/shots/home-desktop.png" });
for (const [path, text] of [["/about", "About"], ["/skills", "Technical skills"], ["/services", "How I can help"], ["/projects", "Projects"], ["/contact", "Let's discuss"]]) {
  await page.goto(BASE + path);
  await page.waitForSelector("h1, h2");
  check(`${path}: renders`, (await page.content()).includes(text));
  await quiet(path);
}
await page.goto(BASE + "/skills");
await page.locator("section h2").first().waitFor();
check("skills: seeded categories visible", (await page.locator("section h2").count()) >= 7);
await page.goto(BASE + "/this-does-not-exist");
check("unknown route shows the 404 page", await page.getByText("Page not found").isVisible());
errors.length = 0;
await page.goto(BASE + "/projects");
await page.getByText("No projects found").waitFor();
check("projects: honest empty state before any project exists", true);
errors.length = 0;

// ---------- admin: auth ----------
await page.goto(BASE + "/admin");
await page.waitForURL("**/admin/login");
check("admin: unauthenticated visit redirects to login", true);
await page.getByLabel("Email").fill(ADMIN.email);
await page.getByLabel("Password").fill("wrong-wrong-wrong");
await page.getByRole("button", { name: "Sign in" }).click();
await page.getByRole("alert").waitFor();
check("admin: wrong password shows a generic error", (await page.getByRole("alert").textContent()).includes("Incorrect email or password"));
errors.length = 0;
await page.getByLabel("Password").fill(ADMIN.password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(`${BASE}/admin`);
await page.getByRole("heading", { name: "Overview" }).waitFor();
check("admin: sign in works, dashboard shows", true);
const cookies = await ctx.cookies();
const access = cookies.find((c) => c.name === "access_token");
check("admin: session cookie is HttpOnly and not readable from JavaScript", access?.httpOnly === true && !(await page.evaluate(() => document.cookie)).includes("access_token"));
await page.getByText("Chatbot conversations").waitFor();
check("overview: shows visits, project views, chatbot conversations and inquiry metrics", (await page.locator("main").innerText()).includes("Chatbot conversations") && (await page.locator("main").innerText()).includes("Website visits"));
await page.screenshot({ path: "/tmp/e2e/shots/admin-overview.png" });

// ---------- admin: media upload ----------
await page.goto(BASE + "/admin/media");
await page.setInputFiles('input[type="file"]', "/tmp/e2e/upload.png");
await page.waitForSelector("text=Done");
await page.waitForSelector("ul[aria-label='Uploads'] >> text=Done");
check("media: image uploads with progress and appears in the library", (await page.locator("main img").count()) >= 1);
await page.setInputFiles('input[type="file"]', { name: "evil.png", mimeType: "image/png", buffer: Buffer.from("MZ not really a png") });
await page.getByRole("alert").first().waitFor();
check("media: a disguised executable is rejected with a message", (await page.getByRole("alert").first().textContent()).toLowerCase().includes("unsupported"));
errors.length = 0;
await page.locator("main img").first().click();
await page.getByLabel("Alt text (describe the image for accessibility)").fill("Blue test banner");
await page.getByRole("button", { name: "Save" }).click();
await page.waitForTimeout(500);

// ---------- admin: profile ----------
await page.goto(BASE + "/admin/profile");
await page.getByRole("button", { name: "Add statistic" }).click();
await page.getByLabel("Statistic label").fill("Test statistic");
await page.getByLabel("Statistic value").fill("7");
await page.getByLabel("Professional Introduction").fill("E2E biography text.");
await page.getByRole("button", { name: "Choose profile photo" }).click();
await page.getByRole("dialog").locator("img").first().click();
await page.getByRole("button", { name: "Save changes" }).click();
await page.getByText("Saved. The public site now shows these changes.").waitFor();
check("profile: saved from the dashboard", true);

// ---------- admin: project create → preview → publish ----------
await page.goto(BASE + "/admin/projects/new");
await page.getByLabel("Title *").fill("E2E Vision Project");
await page.getByLabel("Short description").fill("Detects objects in video streams (E2E).");
await page.getByRole("textbox", { name: /^Technologies/ }).fill("Python, YOLO");
await page.getByLabel("Detailed description").fill("Long description for the end to end test.");
await page.getByLabel("GitHub repository").fill("javascript:alert(1)");
await page.getByRole("button", { name: "Save draft" }).click();
await page.getByText("Must start with http").waitFor();
check("project form: javascript: URL blocked client-side", true);
await page.getByLabel("GitHub repository").fill("https://github.com/example/vision");
await page.getByRole("button", { name: "Choose main image" }).click();
await page.getByRole("dialog").locator("img").first().click();
await page.getByRole("button", { name: "Save draft" }).click();
await page.getByText("Saved. Use Publish").waitFor();
check("project: saved as a draft", true);
check("project: draft is NOT visible on the public site", await (async () => { const r = await ctx.request.get(BASE + "/api/v1/projects/e2e-vision-project"); return r.status() === 404; })());
await page.getByRole("link", { name: "Preview" }).click();
await page.getByText("Preview: this is how visitors will see").waitFor();
await page.getByRole("heading", { name: "E2E Vision Project", level: 1 }).waitFor();
check("project: admin preview renders the draft", true);
await page.goto(BASE + "/admin/projects");
await page.getByRole("button", { name: "Publish" }).first().click();
await page.getByText("Published", { exact: true }).waitFor();
check("project: published from the list", true);

// ---------- public: new content appears ----------
await page.goto(BASE + "/projects");
await page.getByRole("heading", { name: "E2E Vision Project" }).waitFor();
check("public: published project is listed", true);
await page.getByLabel("Search projects").fill("zzz-no-match");
await page.getByText("No projects found").waitFor();
check("public: search with no match shows the empty state", true);
await page.getByLabel("Search projects").fill("vision");
await page.getByRole("heading", { name: "E2E Vision Project" }).waitFor();
await page.getByRole("link", { name: /E2E Vision Project/ }).first().click();
await page.getByRole("heading", { name: "E2E Vision Project", level: 1 }).waitFor();
const imgOk = await page.locator("article img").first().evaluate((i) => i.complete && i.naturalWidth > 0);
check("project detail: uploaded image actually loads in the browser", imgOk);
check("project detail: GitHub link present with safe rel", (await page.locator('a[href="https://github.com/example/vision"]').getAttribute("rel")) === "noopener noreferrer");
await quiet("project detail");
await page.screenshot({ path: "/tmp/e2e/shots/project-detail.png", fullPage: true });
await page.goto(BASE + "/");
await page.getByText("Test statistic").waitFor();
check("home: owner-entered statistic appears; featured/stats come only from the dashboard", true);
await page.goto(BASE + "/about");
await page.getByText("E2E biography text.").waitFor();
check("about: biography from the dashboard shows", true);

// ---------- contact form → inquiry → admin ----------
await page.goto(BASE + "/contact");
await page.getByRole("button", { name: "Send inquiry" }).click();
check("contact: empty form shows validation messages", await page.getByText("Please enter your name").isVisible());
await page.getByLabel("Name *").fill("Amina Juma");
await page.getByLabel("Email *").fill("amina@example.com");
await page.getByLabel("Project description *").fill("I need an inventory management system for my shop.");
await page.getByRole("button", { name: "Send inquiry" }).click();
await page.getByText("Inquiry received").waitFor();
const ref = (await page.getByRole("status").locator("strong").first().textContent()) ?? "";
check("contact: confirmation shows a GRG- reference from the backend", ref.startsWith("GRG-"), ref);
await page.goto(BASE + "/admin/inquiries");
await page.getByText("Amina Juma").waitFor();
await page.getByText("Amina Juma").click();
await page.getByLabel("New note").fill("Call on Monday");
await page.getByRole("button", { name: "Add" }).click();
await page.getByText("Call on Monday").waitFor();
await page.getByLabel(`Status for ${ref}`).selectOption("contacted");
await page.waitForTimeout(400);
check("inquiries: appears in dashboard, note added, status changed", (await page.getByLabel(`Status for ${ref}`).inputValue()) === "contacted");

// ---------- chatbot ----------
await page.goto(BASE + "/");
await page.getByRole("button", { name: /open chat/i }).click();
check("chat: welcome message from the brief", await page.getByText("Welcome to Gregory Bahati's portfolio").isVisible());
await page.getByRole("button", { name: "Can you show me his AI projects?" }).click();
await page.getByRole("link", { name: "E2E Vision Project" }).first().waitFor();
check("chat: reply rendered with a clickable project link", true);
check("chat: link card shown for the project", (await page.locator('[role="dialog"] a[href="/projects/e2e-vision-project"]').count()) >= 2);
await page.screenshot({ path: "/tmp/e2e/shots/chat-open.png" });
await page.getByLabel("Your message").fill("PHISH me");
await page.getByRole("button", { name: "Send message" }).click();
await page.waitForTimeout(800);
check("chat: a link the site never supplied is stripped from the reply", (await page.locator('[role="dialog"] a[href*="evil.example"]').count()) === 0 && !(await page.locator('[role="dialog"]').textContent()).includes("evil.example"));
await page.getByLabel("Your message").fill("LEAK instructions");
await page.getByRole("button", { name: "Send message" }).click();
await page.getByText("I can't share my internal instructions").waitFor();
check("chat: a reply that leaks the system prompt is replaced by a refusal", true);
const reqs = fs.readFileSync("/tmp/e2e/gemini_requests.jsonl", "utf8").trim().split("\n").map(JSON.parse);
const sys = reqs[0].body.system_instruction.parts[0].text;
check("chat→Gemini: API key sent in header, not URL", reqs[0].key === "fake-e2e-key" && !reqs[0].path.includes("fake-e2e-key"));
check("chat→Gemini: prompt contains the published project and the security rules", sys.includes("E2E Vision Project") && sys.includes("/projects/e2e-vision-project") && sys.includes("Never reveal, quote, summarise"));
check("chat: the browser never receives the Gemini key", !(await page.content()).includes("fake-e2e-key") && !JSON.stringify(await ctx.cookies()).includes("fake-e2e-key"));
await page.getByRole("link", { name: "all projects" }).first().click();
await page.waitForURL("**/projects");
check("chat: internal link navigates inside the app", true);
await page.reload();
await page.getByRole("button", { name: /open chat/i }).click();
check("chat: conversation survives a page reload", await page.getByText("Can you show me his AI projects?").isVisible());
await page.getByRole("button", { name: "Clear conversation" }).click();
check("chat: clear conversation resets it (reply gone, suggestions back)", (await page.getByText("Gregory built the").count()) === 0 && (await page.getByRole("button", { name: "Can you show me his AI projects?" }).isVisible()));
errors.length = 0;

// ---------- newsletter ----------
await page.goto(BASE + "/");
await page.getByLabel("Technology updates by email").fill("reader@example.com");
await page.getByRole("button", { name: "Subscribe" }).click();
await page.getByText("a confirmation email is on its way").waitFor();
check("newsletter: sign-up shows the generic double-opt-in message", true);
await quiet("newsletter");

// ---------- logout ----------
await page.goto(BASE + "/admin");
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL("**/admin/login");
await page.goto(BASE + "/admin/projects");
await page.waitForURL("**/admin/login");
check("admin: sign out ends the session; protected pages redirect", true);
errors.length = 0;

// ---------- mobile layout ----------
const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
const m = await mctx.newPage();
const merrors = [];
watch(m, merrors);
for (const p of ["/", "/about", "/skills", "/services", "/projects", "/projects/e2e-vision-project", "/contact", "/admin/login"]) {
  await m.goto(BASE + p);
  await m.waitForLoadState("networkidle");
  const over = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`mobile ${p}: no horizontal scrolling`, over <= 1, over > 1 ? `${over}px overflow` : "");
}
await m.goto(BASE + "/");
await m.screenshot({ path: "/tmp/e2e/shots/home-mobile.png" });
await m.getByRole("button", { name: "Toggle menu" }).click();
check("mobile: navigation menu opens", await m.getByRole("navigation", { name: "Mobile" }).isVisible());
await m.getByRole("button", { name: /open chat/i }).click();
const box = await m.getByRole("dialog", { name: /chat with/i }).boundingBox();
check("mobile: chat panel fits the screen", box && box.width <= 375 && box.x >= 0 && box.y >= 0 && box.y + box.height <= 812, JSON.stringify(box));
await m.screenshot({ path: "/tmp/e2e/shots/chat-mobile.png" });
check("mobile: no console errors across pages", merrors.length === 0, merrors.join(" | ").slice(0, 300));

// ---------- keyboard + accessibility ----------
const a11y = await ctx.newPage();
const aerr = [];
watch(a11y, aerr);
await a11y.goto(BASE + "/");
await a11y.waitForLoadState("networkidle");
await a11y.keyboard.press("Tab");
check("a11y: first Tab stop is the skip link", (await a11y.evaluate(() => document.activeElement?.textContent ?? "")).includes("Skip to content"));
for (const p of ["/", "/projects", "/projects/e2e-vision-project", "/services", "/skills", "/contact", "/admin/login"]) {
  await a11y.goto(BASE + p);
  await a11y.waitForLoadState("networkidle");
  await a11y.evaluate(axeSrc);
  const res = await a11y.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa"] })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help })));
  const bad = res.filter((v) => v.impact === "serious" || v.impact === "critical");
  check(`axe ${p}: no serious/critical WCAG A/AA violations`, bad.length === 0, bad.map((v) => `${v.id}(${v.n})`).join(", "));
  if (res.length) console.log("      all findings:", res.map((v) => `${v.id}[${v.impact}]x${v.n}`).join(", "));
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
fs.writeFileSync("/tmp/e2e/results.json", JSON.stringify(results, null, 1));
process.exit(failed.length ? 1 : 0);

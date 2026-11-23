import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { Markdown } from "./markdown";

const r = (t: string) => render(<MemoryRouter><Markdown text={t} /></MemoryRouter>).container;

it("renders headings, lists, code and quotes", () => {
  const c = r("# Title\n\nPara with **bold** and `code`.\n\n- a\n- b\n\n1. x\n2. y\n\n> quote\n\n```\nlet a = 1;\n```");
  expect(c.querySelector("h2")?.textContent).toBe("Title");
  expect(c.querySelectorAll("ul li")).toHaveLength(2);
  expect(c.querySelectorAll("ol li")).toHaveLength(2);
  expect(c.querySelector("blockquote")?.textContent).toBe("quote");
  expect(c.querySelector("pre code")?.textContent).toBe("let a = 1;");
  expect(c.querySelector("p code")?.textContent).toBe("code");
});

it("blocks raw HTML, unsafe links and unsafe images", () => {
  const c = r('<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![a](javascript:alert(1))\n\n![b](http://insecure.example/x.png)\n\n![ok](/media/images/a.webp)\n\n<img src=x onerror=alert(1)>');
  expect(c.querySelector("script")).toBeNull();
  expect(c.querySelector("a")).toBeNull();
  expect(c.querySelectorAll("img")).toHaveLength(1);
  expect(c.querySelector("img")?.getAttribute("src")).toBe("/media/images/a.webp");
  expect(c.textContent).toContain("<script>alert(1)</script>");
});

it("always terminates on malformed or hostile input", () => {
  const nasty = ["![", "![a](", "![a](javascript:alert(1))", "```", "> ", "- ", "1. ", "#", "# ", "![a](/media/x.webp) trailing", "\n\n\n", "![x](http://a)\n![y](http://b)\n![z]"].join("\n");
  const c = r(nasty);
  expect(c).toBeTruthy();
  expect(r("![a](javascript:alert(1))").querySelector("img")).toBeNull();
});

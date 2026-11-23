import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { parseInline, RichText, safeHref } from "./richtext";

it("only allows safe link targets", () => {
  expect(safeHref("/projects/x")).toBe("internal");
  expect(safeHref("https://github.com/a/b")).toBe("external");
  expect(safeHref("mailto:a@b.com")).toBe("mail");
  for (const bad of ["javascript:alert(1)", "//evil.com", "http://insecure.com", "data:text/html,x", "JaVaScRiPt:alert(1)"]) expect(safeHref(bad)).toBeNull();
});

it("parses bold and links", () => {
  expect(parseInline("a **b** [c](/d)")).toEqual([{ t: "text", v: "a " }, { t: "bold", v: "b" }, { t: "text", v: " " }, { t: "link", label: "c", url: "/d" }]);
});

it("renders unsafe links as plain text and never injects HTML", () => {
  const { container } = render(<MemoryRouter><RichText text={'[click](javascript:alert(1)) <img src=x onerror=alert(1)> [ok](/projects/a)'} /></MemoryRouter>);
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelectorAll("a")).toHaveLength(1);
  expect(screen.getByText("ok").getAttribute("href")).toBe("/projects/a");
  expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
});

it("renders lists", () => {
  const { container } = render(<MemoryRouter><RichText text={"- one\n- two"} /></MemoryRouter>);
  expect(container.querySelectorAll("li")).toHaveLength(2);
});

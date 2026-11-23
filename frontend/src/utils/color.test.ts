import { hexToRgbTriplet } from "./color";

it("converts valid hex", () => expect(hexToRgbTriplet("#2563EB")).toBe("37 99 235"));
it("rejects invalid hex", () => {
  expect(hexToRgbTriplet("blue")).toBeNull();
  expect(hexToRgbTriplet("#fff")).toBeNull();
});

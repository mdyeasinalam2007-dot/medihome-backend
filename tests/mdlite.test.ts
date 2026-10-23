import { describe, it, expect } from "vitest";
import { mdSegments, plainText } from "../lib/mdlite";

describe("AI answer formatting (text only)", () => {
  it("shows **bold** as bold and removes the asterisks", () => {
    expect(mdSegments("A normal rate is **60 to 100 bpm** at rest.")).toEqual([{ s: "A normal rate is ", b: false }, { s: "60 to 100 bpm", b: true }, { s: " at rest.", b: false }]);
  });
  it("turns list markers into bullets and headings into bold lines", () => {
    expect(plainText(mdSegments("### What to do\n* Rest\n- Drink water"))).toBe("What to do\n• Rest\n• Drink water");
    expect(mdSegments("## Tips")[0]).toEqual({ s: "Tips", b: true });
  });
  it("keeps Bangla text intact", () => {
    expect(plainText(mdSegments("**জ্বর** হলে বিশ্রাম নিন।"))).toBe("জ্বর হলে বিশ্রাম নিন।");
  });
  it("never produces HTML: tags stay as visible text", () => {
    const segs = mdSegments("<img src=x onerror=alert(1)> **hi**");
    expect(plainText(segs)).toContain("<img src=x onerror=alert(1)>");
    segs.forEach((x) => expect(typeof x.s).toBe("string"));
  });
  it("leaves stray asterisks harmless", () => {
    expect(plainText(mdSegments("5 * 3 = 15 and ** alone"))).toBe("5 * 3 = 15 and  alone");
  });
});

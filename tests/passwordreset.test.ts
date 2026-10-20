import { describe, it, expect } from "vitest";
import { newToken, hashToken } from "../lib/resetToken";
describe("password reset tokens", () => {
  it("stores only a hash, and tokens are unique", () => {
    const a = newToken(), b = newToken();
    expect(a === b).toBe(false); expect(a.length > 40).toBe(true);
    expect(hashToken(a)).toBe(hashToken(a)); expect(hashToken(a) === hashToken(b)).toBe(false);
    expect(hashToken(a).length).toBe(64); expect(hashToken(a).includes(a)).toBe(false);
  });
});

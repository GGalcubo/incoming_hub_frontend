import { describe, expect, it } from "vitest";
import { decodeJwt, isExpired, mockJwt } from "./jwt";

describe("jwt", () => {
  it("decodes the payload of a mock token", () => {
    const token = mockJwt("ana@agencia.com");
    const payload = decodeJwt(token);
    expect(payload?.sub).toBe("ana@agencia.com");
    expect(typeof payload?.exp).toBe("number");
    expect(typeof payload?.iat).toBe("number");
  });

  it("round-trips UTF-8 subjects", () => {
    const token = mockJwt("José Álvarez");
    expect(decodeJwt(token)?.sub).toBe("José Álvarez");
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwt("not-a-jwt")).toBeNull();
    expect(decodeJwt("")).toBeNull();
  });

  it("treats a fresh token as not expired", () => {
    expect(isExpired(mockJwt("a", 3600))).toBe(false);
  });

  it("treats an already-elapsed ttl as expired", () => {
    expect(isExpired(mockJwt("a", -10))).toBe(true);
  });

  it("respects the skew window", () => {
    const token = mockJwt("a", 30);
    expect(isExpired(token)).toBe(false);
    expect(isExpired(token, 60)).toBe(true);
  });
});

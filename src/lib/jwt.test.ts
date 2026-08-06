import { describe, expect, it } from "vitest";
import { decodeJwt, isExpired } from "./jwt";

// Arma un JWT de prueba (header.payload.firma). La firma no importa: el front
// solo LEE el payload, nunca lo valida (eso es del backend). Vive acá y no en
// src/lib porque es andamiaje de test, no algo que la app use.
function token(sub: string, ttlSeconds = 8 * 3600): string {
  const enc = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  };
  const now = Math.floor(Date.now() / 1000);
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub, iat: now, exp: now + ttlSeconds })}.firma`;
}

describe("jwt", () => {
  it("decodes the payload of a token", () => {
    const payload = decodeJwt(token("ana@agencia.com"));
    expect(payload?.sub).toBe("ana@agencia.com");
    expect(typeof payload?.exp).toBe("number");
    expect(typeof payload?.iat).toBe("number");
  });

  it("round-trips UTF-8 subjects", () => {
    expect(decodeJwt(token("José Álvarez"))?.sub).toBe("José Álvarez");
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwt("not-a-jwt")).toBeNull();
    expect(decodeJwt("")).toBeNull();
  });

  it("treats a fresh token as not expired", () => {
    expect(isExpired(token("a", 3600))).toBe(false);
  });

  it("treats an already-elapsed ttl as expired", () => {
    expect(isExpired(token("a", -10))).toBe(true);
  });

  it("respects the skew window", () => {
    const t = token("a", 30);
    expect(isExpired(t)).toBe(false);
    expect(isExpired(t, 60)).toBe(true);
  });
});

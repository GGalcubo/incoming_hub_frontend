import { describe, expect, it } from "vitest";
import { normalizePhone, PHONE_RE } from "./phone";

describe("normalizePhone", () => {
  it("quita espacios, guiones y paréntesis conservando el prefijo +", () => {
    expect(normalizePhone("+54 11 5555-1234")).toBe("+541155551234");
    expect(normalizePhone("(011) 4490 7781")).toBe("01144907781");
    expect(normalizePhone(" 11-6033.2210 ")).toBe("1160332210");
  });

  it("devuelve vacío si no hay dígitos", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("+")).toBe("");
    expect(normalizePhone("sin dato")).toBe("");
  });

  it("el resultado normalizado pasa la validación de formato", () => {
    expect(PHONE_RE.test(normalizePhone("+54 11 5555-1234"))).toBe(true);
    expect(PHONE_RE.test("+54 11 5555-1234")).toBe(false); // ya no se acepta con espacios
    expect(PHONE_RE.test("123")).toBe(false);
  });
});

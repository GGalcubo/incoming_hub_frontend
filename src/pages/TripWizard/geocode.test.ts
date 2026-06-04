import { describe, expect, it } from "vitest";
import { shortenAddress } from "./geocode";

describe("shortenAddress", () => {
  it("abrevia CABA y quita el código postal", () => {
    expect(shortenAddress("Nahuel Huapi 4148, C1430BCR Cdad. Autónoma de Buenos Aires")).toBe(
      "Nahuel Huapi 4148, CABA",
    );
    expect(
      shortenAddress("Estomba 2124, C1430EGN Ciudad Autónoma de Buenos Aires, Argentina"),
    ).toBe("Estomba 2124, CABA");
  });

  it("abrevia PBA y quita país", () => {
    expect(
      shortenAddress("Av. Maipú 2502, B1636DOR Olivos, Provincia de Buenos Aires, Argentina"),
    ).toBe("Av. Maipú 2502, Olivos, PBA");
  });

  it("no toca los números de calle de 4 dígitos", () => {
    expect(shortenAddress("Estomba 2124, CABA")).toBe("Estomba 2124, CABA");
  });

  it("es seguro con cadenas vacías", () => {
    expect(shortenAddress("")).toBe("");
  });
});

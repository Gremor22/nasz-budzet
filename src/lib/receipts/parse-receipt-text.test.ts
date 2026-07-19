import { describe, expect, it } from "vitest";
import { parseReceiptText } from "@/lib/receipts/parse-receipt-text";

describe("parseReceiptText", () => {
  it("wyciąga Biedronkę, datę i sumę", () => {
    const text = `
Jeronimo Martins
BIEDRONKA
ul. Przykładowa 1
2026-07-19 14:22
Chleb 4,99
Mleko 3,20
SUMA PLN 27,45
VAT ...
`;
    const r = parseReceiptText(text);
    expect(r.merchantName).toBe("Biedronka");
    expect(r.receiptDate).toBe("2026-07-19");
    expect(r.totalGrosze).toBe(2745);
  });

  it("obsługuje datę DD.MM.YYYY i Do zapłaty", () => {
    const text = `
Lidl sp. z o.o.
19.07.2026
Mleko
Do zapłaty: 15,90
`;
    const r = parseReceiptText(text);
    expect(r.merchantName).toBe("Lidl");
    expect(r.receiptDate).toBe("2026-07-19");
    expect(r.totalGrosze).toBe(1590);
  });
});

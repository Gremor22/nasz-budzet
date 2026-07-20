import { describe, expect, it } from "vitest";
import { createDemoState } from "@/lib/data/demo-data";
import { serializeTransactionsCsv } from "@/lib/data/export";

describe("serializeTransactionsCsv", () => {
  it("includes header and transaction rows", () => {
    const state = createDemoState();
    const csv = serializeTransactionsCsv(state);
    const lines = csv.split("\n");

    expect(lines[0]).toBe(
      "\uFEFFdata;typ;opis;kategoria;kwota_zl;konto;osoba;zaplacil;wspolny;status;notatka",
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[1]).toContain("Wydatek");
  });

  it("escapes semicolons in description", () => {
    const state = createDemoState();
    state.transactions[0] = {
      ...state.transactions[0],
      description: 'Sklep; test "cudzysłów"',
    };

    const csv = serializeTransactionsCsv(state);
    expect(csv).toContain('"Sklep; test ""cudzysłów"""');
  });
});

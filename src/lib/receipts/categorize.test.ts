import { describe, expect, it } from "vitest";
import {
  ruleFromMerchantCorrection,
  suggestCategory,
} from "@/lib/receipts/categorize";
import type { ClassificationRule } from "@/lib/receipts/types";

describe("suggestCategory", () => {
  it("rozpoznaje znane sklepy z reguł domyślnych", () => {
    expect(suggestCategory("Biedronka Centrum")).toBe("Jedzenie");
    expect(suggestCategory("ORLEN stacja")).toBe("Transport");
    expect(suggestCategory("Rossmann")).toBe("Zdrowie");
  });

  it("zwraca Inne gdy brak dopasowania", () => {
    expect(suggestCategory("NieznanySklep XYZ")).toBe("Inne");
  });

  it("preferuje reguły gospodarstwa o niższym priority", () => {
    const rules: ClassificationRule[] = [
      {
        matchType: "contains",
        pattern: "biedronka",
        categoryName: "Dom",
        priority: 1,
        active: true,
      },
    ];
    expect(suggestCategory("Biedronka", rules)).toBe("Dom");
  });
});

describe("ruleFromMerchantCorrection", () => {
  it("buduje regułę z pierwszego słowa nazwy", () => {
    const rule = ruleFromMerchantCorrection("Lidl Express", "Jedzenie");
    expect(rule).toEqual({
      matchType: "contains",
      pattern: "lidl",
      categoryName: "Jedzenie",
      priority: 5,
      active: true,
    });
  });

  it("odrzuca zbyt krótką nazwę", () => {
    expect(ruleFromMerchantCorrection("A", "Inne")).toBeNull();
  });
});

import type { ClassificationRule } from "@/lib/receipts/types";
import { DEFAULT_CATEGORY_RULES } from "@/lib/receipts/types";

/**
 * Propozycja kategorii na podstawie tekstu (sklep / opis) i reguł.
 * Reguły gospodarstwa mają pierwszeństwo przed domyślnymi przy tym samym priorytecie
 * (najpierw sortujemy po priority rosnąco, potem household przed default).
 */
export function suggestCategory(
  text: string,
  householdRules: ClassificationRule[] = [],
): string {
  const haystack = text.trim().toLowerCase();
  if (!haystack) return "Inne";

  const rules = [
    ...householdRules.filter((r) => r.active),
    ...DEFAULT_CATEGORY_RULES.filter((r) => r.active),
  ].sort((a, b) => a.priority - b.priority);

  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase();
    if (rule.matchType === "contains" && haystack.includes(pattern)) {
      return rule.categoryName;
    }
    if (rule.matchType === "equals" && haystack === pattern) {
      return rule.categoryName;
    }
    if (rule.matchType === "regex") {
      try {
        if (new RegExp(rule.pattern, "i").test(haystack)) {
          return rule.categoryName;
        }
      } catch {
        // niepoprawny regex — pomiń
      }
    }
  }

  return "Inne";
}

/** Po poprawce użytkownika — buduje regułę contains z nazwy sklepu. */
export function ruleFromMerchantCorrection(
  merchantName: string,
  categoryName: string,
): ClassificationRule | null {
  const cleaned = merchantName.trim().toLowerCase();
  if (cleaned.length < 2) return null;
  const token = cleaned.split(/\s+/)[0] ?? cleaned;
  if (token.length < 2) return null;
  return {
    matchType: "contains",
    pattern: token,
    categoryName: categoryName.trim() || "Inne",
    priority: 5,
    active: true,
  };
}

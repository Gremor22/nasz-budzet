/**
 * Porównanie dostawców OCR — decyzja Etapu 5.
 * Klucze API wyłącznie po stronie serwera (nigdy NEXT_PUBLIC_*).
 *
 * | Dostawca | Koszt (orient.) | PL / paragony | Uwagi |
 * |----------|-----------------|---------------|--------|
 * | Manual + reguły (domyślne) | 0 zł | — | Zawsze weryfikacja; zdjęcie w Storage |
 * | OpenAI Vision (gpt-4o-mini) | ~0,01–0,03 zł / zdjęcie | Bardzo dobra struktura JSON | Wymaga OPENAI_API_KEY |
 * | Google Cloud Vision | ~1,50 USD / 1000 | Dobra | Konto GCP, billing |
 * | Azure Document Intelligence | ~1,50 USD / 1000 stron | Dobra na dokumenty | Konto Azure |
 * | Tesseract (lokalnie) | 0 zł | Słabe na termiczne PL | Ciężkie na Vercel |
 *
 * Wybór MVP: `manual` (zawsze) + opcjonalnie `openai` gdy jest klucz.
 * Zamiana: OCR_PROVIDER=manual|openai
 */

export type OcrProviderId = "manual" | "openai" | "tesseract";

export interface OcrLineItem {
  name: string;
  totalGrosze: number;
  categoryName?: string;
}

export interface OcrSuggestion {
  provider: OcrProviderId;
  merchantName: string | null;
  receiptDate: string | null; // YYYY-MM-DD
  totalGrosze: number | null;
  suggestedCategory: string | null;
  items: OcrLineItem[];
  rawText?: string;
  note?: string;
}

export interface ClassificationRule {
  matchType: "contains" | "equals" | "regex";
  pattern: string;
  categoryName: string;
  priority: number;
  active: boolean;
}

export const DEFAULT_CATEGORY_RULES: ClassificationRule[] = [
  { matchType: "contains", pattern: "biedronka", categoryName: "Jedzenie", priority: 10, active: true },
  { matchType: "contains", pattern: "lidl", categoryName: "Jedzenie", priority: 10, active: true },
  { matchType: "contains", pattern: "żabka", categoryName: "Jedzenie", priority: 10, active: true },
  { matchType: "contains", pattern: "zabka", categoryName: "Jedzenie", priority: 10, active: true },
  { matchType: "contains", pattern: "auchan", categoryName: "Jedzenie", priority: 10, active: true },
  { matchType: "contains", pattern: "carrefour", categoryName: "Jedzenie", priority: 10, active: true },
  { matchType: "contains", pattern: "rossmann", categoryName: "Zdrowie", priority: 20, active: true },
  { matchType: "contains", pattern: "apteka", categoryName: "Zdrowie", priority: 20, active: true },
  { matchType: "contains", pattern: "orlen", categoryName: "Transport", priority: 20, active: true },
  { matchType: "contains", pattern: "bp ", categoryName: "Transport", priority: 20, active: true },
  { matchType: "contains", pattern: "shell", categoryName: "Transport", priority: 20, active: true },
  { matchType: "contains", pattern: "mcdonald", categoryName: "Jedzenie", priority: 30, active: true },
  { matchType: "contains", pattern: "kfc", categoryName: "Jedzenie", priority: 30, active: true },
];

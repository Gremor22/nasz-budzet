/**
 * OCR V1: Gemini 2.5 Flash + weryfikacja.
 * Klucze API wyłącznie po stronie serwera.
 */

import type { GeminiErrorCode } from "@/lib/receipts/gemini-errors";

export type OcrProviderId = "manual" | "openai" | "gemini";

export type { GeminiErrorCode };

export type OcrFailureKind = "quota" | "config" | "api" | null;

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
  /** Dlaczego padło na ręczny formularz — do komunikatu UI */
  failureKind?: OcrFailureKind;
  /** Kod przyczyny z Gemini (diagnostyka 429 itd.) */
  errorCode?: GeminiErrorCode;
  geminiModel?: string;
  geminiAttempt?: number;
  geminiErrorDetails?: unknown;
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

import {
  buildLocalSpendingInsight,
  type SpendingInsightInput,
} from "@/lib/analytics/insight";
import { formatPlnShort } from "@/lib/money/format";

export type InsightSource = "gemini" | "local";

export interface SpendingInsightResult {
  insight: string;
  source: InsightSource;
}

function getInsightModel(): string {
  return process.env.GEMINI_INSIGHT_MODEL ?? "gemini-2.0-flash";
}

function buildPrompt(input: SpendingInsightInput): string {
  const categories = input.byCategory
    .slice(0, 8)
    .map(
      (c) =>
        `- ${c.category}: ${formatPlnShort(c.amountGrosze)} (${c.percent}%)`,
    )
    .join("\n");

  const topTx = input.topExpenses
    .slice(0, 5)
    .map(
      (t) =>
        `- ${t.description} (${t.category}): ${formatPlnShort(t.amountGrosze)}`,
    )
    .join("\n");

  return [
    "Jesteś asystentem budżetu domowego. Napisz krótkie podsumowanie po polsku (2–3 zdania, max 320 znaków).",
    "Ton: przyjazny, konkretny, bez oceniania. Wskaż na co idzie najwięcej i jedną praktyczną wskazówkę.",
    "Nie wymyślaj kwot — używaj tylko danych poniżej.",
    "",
    `Miesiąc: ${input.monthLabel}`,
    `Wpływy: ${formatPlnShort(input.incomeTotalGrosze)}`,
    `Wydatki: ${formatPlnShort(input.expenseTotalGrosze)}`,
    "",
    "Kategorie wydatków:",
    categories || "(brak)",
    "",
    "Największe transakcje:",
    topTx || "(brak)",
  ].join("\n");
}

export async function generateSpendingInsight(
  input: SpendingInsightInput,
): Promise<SpendingInsightResult> {
  const fallback = buildLocalSpendingInsight(input);

  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || input.expenseTotalGrosze <= 0) {
    return { insight: fallback, source: "local" };
  }

  const model = getInsightModel();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 220,
          },
        }),
      },
    );

    if (!response.ok) {
      return { insight: fallback, source: "local" };
    }

    const json = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text || text.length < 20) {
      return { insight: fallback, source: "local" };
    }

    return { insight: text.slice(0, 400), source: "gemini" };
  } catch {
    return { insight: fallback, source: "local" };
  }
}

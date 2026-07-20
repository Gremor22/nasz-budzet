import type { OcrProviderId, OcrSuggestion, OcrFailureKind } from "@/lib/receipts/types";
import { suggestCategory } from "@/lib/receipts/categorize";
import {
  GeminiOcrError,
  classifyGeminiErrorCode,
  getGeminiOcrModel,
  logGeminiOcrFailure,
  parseGeminiErrorBody,
} from "@/lib/receipts/gemini-errors";

export type { GeminiErrorCode } from "@/lib/receipts/gemini-errors";
export { GeminiOcrError, getGeminiOcrModel } from "@/lib/receipts/gemini-errors";

/**
 * V1 OCR: Gemini 2.5 Flash → API Route → JSON Schema → weryfikacja → zapis.
 */
export function resolveOcrProvider(): OcrProviderId {
  const raw = (process.env.OCR_PROVIDER ?? "gemini").toLowerCase();
  const geminiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (raw === "openai" && openaiKey) return "openai";
  if (raw === "manual") return "manual";
  if (geminiKey) return "gemini";
  if (openaiKey) return "openai";
  return "manual";
}

/**
 * Schema bez `nullable` — część modeli Gemini odrzuca nullable w REST.
 * Puste wartości: "" / 0 / [].
 */
export const RECEIPT_OCR_SCHEMA = {
  type: "OBJECT",
  properties: {
    merchantName: {
      type: "STRING",
      description: "Nazwa sklepu, np. Biedronka. Pusty string jeśli niepewne.",
    },
    receiptDate: {
      type: "STRING",
      description: "Data YYYY-MM-DD. Pusty string jeśli niepewne.",
    },
    totalGrosze: {
      type: "INTEGER",
      description:
        "Suma do zapłaty w groszach (63,04 zł = 6304). 0 jeśli niepewne. NIE kod Glovo.",
    },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          totalGrosze: { type: "INTEGER" },
        },
        required: ["name", "totalGrosze"],
      },
    },
  },
  required: ["merchantName", "receiptDate", "totalGrosze", "items"],
} as const;

export async function runOcr(input: {
  imageBytes: ArrayBuffer;
  mimeType: string;
  provider?: OcrProviderId;
  focusTotalBase64?: string;
  focusMimeType?: string;
}): Promise<OcrSuggestion> {
  const provider = input.provider ?? resolveOcrProvider();

  if (provider === "gemini") {
    return runGeminiVision(
      input.imageBytes,
      input.mimeType,
      input.focusTotalBase64,
      input.focusMimeType,
    );
  }
  if (provider === "openai") {
    return runOpenAiVision(input.imageBytes, input.mimeType);
  }

  return emptyManual(
    "Brak klucza GEMINI_API_KEY na Vercel. Dodaj klucz i zrób Redeploy.",
    "config",
  );
}

function emptyManual(
  note: string,
  failureKind: OcrFailureKind = "config",
): OcrSuggestion {
  return {
    provider: "manual",
    merchantName: null,
    receiptDate: null,
    totalGrosze: null,
    suggestedCategory: null,
    items: [],
    note,
    failureKind,
  };
}

async function runGeminiVision(
  imageBytes: ArrayBuffer,
  mimeType: string,
  focusTotalBase64?: string,
  focusMimeType?: string,
): Promise<OcrSuggestion> {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return emptyManual(
      "Brak klucza GEMINI_API_KEY na Vercel. Dodaj klucz i zrób Redeploy.",
      "config",
    );
  }

  const model = getGeminiOcrModel();
  const prompt =
    "Jesteś OCR polskich paragonów fiskalnych. " +
    "Wypełnij pola: merchantName, receiptDate (YYYY-MM-DD), totalGrosze (grosze!), items. " +
    "Priorytet: sklep, data, SUMA PLN. Ignoruj kody odbioru (Glovo 727), NIP, kasę. " +
    "63,04 zł = 6304. Jeśli SUMA zasłonięta — zsumuj pozycje. " +
    "Gdy niepewne: merchantName=\"\", receiptDate=\"\", totalGrosze=0. " +
    (focusTotalBase64
      ? "Drugie zdjęcie = dolny fragment (suma) — totalGrosze bierz stamtąd. "
      : "");

  const parts: Record<string, unknown>[] = [
    { text: prompt },
    {
      inline_data: {
        mime_type: mimeType || "image/jpeg",
        data: Buffer.from(imageBytes).toString("base64"),
      },
    },
  ];

  if (focusTotalBase64) {
    parts.push({
      inline_data: {
        mime_type: focusMimeType || "image/jpeg",
        data: focusTotalBase64,
      },
    });
  }

  // Próba 1: ze schema. Próba 2: tylko przy HTTP 400 (bez opóźnienia).
  // Przy 429 NIE ma drugiej próby — jedno wywołanie Gemini na błąd limitu.
  let lastGeminiError: GeminiOcrError | null = null;
  let attempt = 0;

  for (const withSchema of [true, false]) {
    attempt += 1;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            ...(withSchema ? { responseSchema: RECEIPT_OCR_SCHEMA } : {}),
          },
        }),
      },
    );

    if (response.ok) {
      const json = (await response.json()) as {
        candidates?: {
          content?: { parts?: { text?: string }[] };
          finishReason?: string;
        }[];
        promptFeedback?: { blockReason?: string };
      };

      if (json.promptFeedback?.blockReason) {
        throw new Error(
          `Gemini OCR: zablokowane (${json.promptFeedback.blockReason})`,
        );
      }

      const content =
        json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const result = parseModelJson(content, "gemini");
      return {
        ...result,
        note: focusTotalBase64
          ? "Gemini (fokus na sumę). Sprawdź i potwierdź przed zapisem."
          : "Gemini 2.5 Flash. Sprawdź sklep, datę i sumę — zapis dopiero po potwierdzeniu.",
        failureKind: null,
      };
    }

    const errText = await response.text();
    const parsed = parseGeminiErrorBody(response.status, errText);
    const errorCode = classifyGeminiErrorCode(response.status, parsed);
    const geminiErr = new GeminiOcrError({
      errorCode,
      httpStatus: response.status,
      gemini: parsed,
      model,
      attempt,
      withSchema,
    });
    lastGeminiError = geminiErr;
    logGeminiOcrFailure({
      errorCode,
      gemini: parsed,
      model,
      attempt,
      withSchema,
    });

    // Limit / quota — nie retry (bez opóźnienia i bez drugiego calla)
    if (response.status === 429) {
      throw geminiErr;
    }

    // Błąd schema (400) — jedna natychmiastowa próba bez schema
    if (withSchema && response.status === 400) {
      continue;
    }

    throw geminiErr;
  }

  throw lastGeminiError ?? new Error("Gemini OCR: nieznany błąd");
}

async function runOpenAiVision(
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<OcrSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return emptyManual("Brak OPENAI_API_KEY.", "config");
  }

  const b64 = Buffer.from(imageBytes).toString("base64");
  const dataUrl = `data:${mimeType};base64,${b64}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Odczytujesz polskie paragony. JSON: " +
            '{"merchantName":string,"receiptDate":"YYYY-MM-DD"|string,' +
            '"totalGrosze":number,"items":[{"name":string,"totalGrosze":number}]}. ' +
            "Kwoty w groszach. Ignoruj kody odbioru. Puste = \"\" / 0.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Odczytaj ten paragon." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI OCR: ${response.status} ${errText.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return parseModelJson(
    json.choices?.[0]?.message?.content ?? "{}",
    "openai",
  );
}

function parseModelJson(
  content: string,
  provider: "gemini" | "openai",
): OcrSuggestion {
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  }

  let parsed: {
    merchantName?: string | null;
    receiptDate?: string | null;
    totalGrosze?: number | null;
    items?: { name?: string; totalGrosze?: number }[];
  };
  try {
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    return emptyManual(
      "AI zwróciło nieczytelny wynik. Uzupełnij pola ręcznie.",
      "api",
    );
  }

  const merchantName = parsed.merchantName?.trim() || null;
  const receiptDate =
    parsed.receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.receiptDate)
      ? parsed.receiptDate
      : null;

  const items = (parsed.items ?? [])
    .filter((i) => i.name && typeof i.totalGrosze === "number")
    .map((i) => ({
      name: String(i.name),
      totalGrosze: Math.round(Number(i.totalGrosze)),
    }));

  let totalGrosze =
    typeof parsed.totalGrosze === "number" && parsed.totalGrosze > 0
      ? Math.round(parsed.totalGrosze)
      : null;

  if (items.length >= 2) {
    const itemsSum = items.reduce((s, i) => s + i.totalGrosze, 0);
    if (totalGrosze == null) {
      totalGrosze = itemsSum;
    } else if (
      itemsSum > 2000 &&
      totalGrosze < 1000 &&
      Math.abs(itemsSum - totalGrosze) > 500
    ) {
      totalGrosze = itemsSum;
    }
  }

  return {
    provider,
    merchantName,
    receiptDate,
    totalGrosze,
    suggestedCategory: merchantName ? suggestCategory(merchantName) : null,
    items,
    rawText: content,
    note: "Sprawdź pola przed zapisem — wydatek powstanie dopiero po potwierdzeniu.",
    failureKind: null,
  };
}

export function classifyGeminiError(message: string): OcrFailureKind {
  if (/\b429\b|quota|rate.?limit|resource.?exhausted/i.test(message)) {
    return "quota";
  }
  if (/API_KEY|api key|Brak klucza|403/i.test(message)) {
    return "config";
  }
  return "api";
}

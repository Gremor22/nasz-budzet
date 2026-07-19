import type { OcrProviderId, OcrSuggestion } from "@/lib/receipts/types";
import { suggestCategory } from "@/lib/receipts/categorize";

/**
 * V1 OCR (rekomendacja produktu):
 * Gemini 2.5 Flash → Vercel API Route → JSON Schema → ekran zatwierdzenia → zapis.
 * Bez Tesseract / Cloud Vision na start. Klucz tylko po stronie serwera.
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

/** JSON Schema dla structured output Gemini (REST). */
export const RECEIPT_OCR_SCHEMA = {
  type: "OBJECT",
  properties: {
    merchantName: {
      type: "STRING",
      nullable: true,
      description: "Nazwa sklepu / sprzedawcy, np. Biedronka, Lidl",
    },
    receiptDate: {
      type: "STRING",
      nullable: true,
      description: "Data paragonu YYYY-MM-DD",
    },
    totalGrosze: {
      type: "INTEGER",
      nullable: true,
      description:
        "Suma do zapłaty w groszach (63,04 zł = 6304). NIE kod odbioru Glovo.",
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
    "Brak klucza GEMINI_API_KEY. Uzupełnij pola ręcznie na podstawie zdjęcia.",
  );
}

function emptyManual(note: string): OcrSuggestion {
  return {
    provider: "manual",
    merchantName: null,
    receiptDate: null,
    totalGrosze: null,
    suggestedCategory: null,
    items: [],
    note,
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
      "Brak klucza GEMINI_API_KEY na serwerze. Uzupełnij pola ręcznie.",
    );
  }

  const model = process.env.GEMINI_OCR_MODEL ?? "gemini-2.5-flash";
  const b64 = Buffer.from(imageBytes).toString("base64");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts: Record<string, unknown>[] = [
    {
      text:
        "Jesteś OCR polskich paragonów fiskalnych dla aplikacji budżetowej. " +
        "Priorytet: poprawny sklep, data, SUMA PLN (totalGrosze). " +
        "Ignoruj kody odbioru (np. Glovo 727), numery NIP, numery kasy. " +
        "Kwoty w groszach: 63,04 zł = 6304. " +
        "Jeśli SUMA jest zasłonięta — policz z pozycji. " +
        "Pozycje: nazwa + kwota; drobne błędy nazw są OK. " +
        (focusTotalBase64
          ? "Drugie zdjęcie to DOLNY fragment (strefa sumy) — totalGrosze bierz stamtąd. "
          : ""),
    },
    {
      inline_data: {
        mime_type: mimeType || "image/jpeg",
        data: b64,
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: RECEIPT_OCR_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini OCR: ${response.status} ${errText.slice(0, 240)}`);
  }

  const json = (await response.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
    }[];
  };
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const result = parseModelJson(content, "gemini");
  return {
    ...result,
    note: focusTotalBase64
      ? "Gemini 2.5 Flash (fokus na sumę). Sprawdź i potwierdź przed zapisem."
      : "Gemini 2.5 Flash. Sprawdź sklep, datę i sumę — zapis dopiero po Twoim potwierdzeniu.",
  };
}

async function runOpenAiVision(
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<OcrSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return emptyManual("Brak OPENAI_API_KEY. Uzupełnij pola ręcznie.");
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
            '{"merchantName":string|null,"receiptDate":"YYYY-MM-DD"|null,' +
            '"totalGrosze":number|null,"items":[{"name":string,"totalGrosze":number}]}. ' +
            "Kwoty w groszach. Ignoruj kody odbioru.",
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
      "AI zwróciło nieczytelny wynik. Uzupełnij pola ręcznie na podstawie zdjęcia.",
    );
  }

  const merchantName = parsed.merchantName?.trim() || null;
  const items = (parsed.items ?? [])
    .filter((i) => i.name && typeof i.totalGrosze === "number")
    .map((i) => ({
      name: String(i.name),
      totalGrosze: Math.round(Number(i.totalGrosze)),
    }));

  let totalGrosze =
    typeof parsed.totalGrosze === "number"
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
      // Podejrzenie: model wziął kod (727) zamiast sumy
      totalGrosze = itemsSum;
    }
  }

  return {
    provider,
    merchantName,
    receiptDate: parsed.receiptDate ?? null,
    totalGrosze,
    suggestedCategory: merchantName ? suggestCategory(merchantName) : null,
    items,
    rawText: content,
    note: "Sprawdź pola przed zapisem — wydatek powstanie dopiero po potwierdzeniu.",
  };
}

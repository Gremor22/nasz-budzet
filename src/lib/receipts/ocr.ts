import type { OcrProviderId, OcrSuggestion } from "@/lib/receipts/types";
import { suggestCategory } from "@/lib/receipts/categorize";
import { parseReceiptText } from "@/lib/receipts/parse-receipt-text";

/**
 * Kolejność: Gemini (darmowy limit Google) → OpenAI (płatne) → sygnał „użyj klienta”.
 * Klucze TYLKO po stronie serwera.
 */
export function resolveOcrProvider(): OcrProviderId {
  const raw = (process.env.OCR_PROVIDER ?? "auto").toLowerCase();
  const geminiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (raw === "openai" && openaiKey) return "openai";
  if (raw === "gemini" && geminiKey) return "gemini";
  if (raw === "manual" || raw === "tesseract") return "tesseract";

  // auto
  if (geminiKey) return "gemini";
  if (openaiKey) return "openai";
  return "tesseract";
}

export async function runOcr(input: {
  imageBytes: ArrayBuffer;
  mimeType: string;
  provider?: OcrProviderId;
}): Promise<OcrSuggestion> {
  const provider = input.provider ?? resolveOcrProvider();

  if (provider === "gemini") {
    return runGeminiVision(input.imageBytes, input.mimeType);
  }
  if (provider === "openai") {
    return runOpenAiVision(input.imageBytes, input.mimeType);
  }

  return {
    provider: "tesseract",
    merchantName: null,
    receiptDate: null,
    totalGrosze: null,
    suggestedCategory: null,
    items: [],
    note: "use_client_tesseract",
  };
}

async function runGeminiVision(
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<OcrSuggestion> {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return {
      provider: "tesseract",
      merchantName: null,
      receiptDate: null,
      totalGrosze: null,
      suggestedCategory: null,
      items: [],
      note: "use_client_tesseract",
    };
  }

  const model =
    process.env.GEMINI_OCR_MODEL ?? "gemini-2.0-flash";
  const b64 = Buffer.from(imageBytes).toString("base64");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                "To polski paragon fiskalny. Odczytaj dane mimo zagnieceń i ręczne napisy. " +
                "Zwróć TYLKO JSON (bez markdown): " +
                '{"merchantName":string|null,"receiptDate":"YYYY-MM-DD"|null,' +
                '"totalGrosze":number|null,"items":[{"name":string,"totalGrosze":number}]}. ' +
                "Kwoty w groszach (63,04 zł = 6304). Suma = SUMA PLN / Do zapłaty, " +
                "NIE kod odbioru Glovo ani inne 3-cyfrowe kody. Jeśli suma zasłonięta, " +
                "zsumuj pozycje.",
            },
            {
              inline_data: {
                mime_type: mimeType || "image/jpeg",
                data: b64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
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
  return parseModelJson(content, "gemini");
}

async function runOpenAiVision(
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<OcrSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      provider: "tesseract",
      merchantName: null,
      receiptDate: null,
      totalGrosze: null,
      suggestedCategory: null,
      items: [],
      note: "use_client_tesseract",
    };
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
            "Odczytujesz polskie paragony fiskalne. Zwróć wyłącznie JSON: " +
            '{"merchantName":string|null,"receiptDate":"YYYY-MM-DD"|null,' +
            '"totalGrosze":number|null,"items":[{"name":string,"totalGrosze":number}]}. ' +
            "Kwoty w groszach (12,34 zł = 1234). Ignoruj kody odbioru. Jeśli niepewne — null.",
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
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return parseModelJson(content, "openai");
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
    // Model czasem zwraca śmieci — spróbuj heurystyk na surowym tekście
    const fallback = parseReceiptText(content);
    return {
      provider,
      ...fallback,
      suggestedCategory: fallback.merchantName
        ? suggestCategory(fallback.merchantName)
        : null,
      items: [],
      rawText: content,
      note: "Odczyt AI — sprawdź pola przed zapisem.",
    };
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

  // Jeśli model podał pozycje, a suma wygląda na kod (np. 727) — zsumuj pozycje
  if (items.length >= 2) {
    const itemsSum = items.reduce((s, i) => s + i.totalGrosze, 0);
    if (
      totalGrosze == null ||
      totalGrosze < 100 ||
      (totalGrosze % 100 === 0 && totalGrosze < 1000 && itemsSum > totalGrosze)
    ) {
      // 727 groszy = 7,27 zł też możliwe; raczej 727 bez groszy = kod
      if (totalGrosze != null && totalGrosze < 1000 && !String(totalGrosze).includes(".")) {
        // total już w groszach: 727 = 7,27 zł — podejrzane vs suma pozycji ~6304
        if (itemsSum > 2000 && Math.abs(itemsSum - totalGrosze) > 500) {
          totalGrosze = itemsSum;
        }
      }
    }
    if (totalGrosze == null) totalGrosze = itemsSum;
  }

  return {
    provider,
    merchantName,
    receiptDate: parsed.receiptDate ?? null,
    totalGrosze,
    suggestedCategory: merchantName ? suggestCategory(merchantName) : null,
    items,
    rawText: content,
    note: "Darmowy odczyt AI (Google Gemini). Sprawdź pola przed zapisem.",
  };
}

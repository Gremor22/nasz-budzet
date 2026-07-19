import type { OcrProviderId, OcrSuggestion } from "@/lib/receipts/types";
import { suggestCategory } from "@/lib/receipts/categorize";

export function resolveOcrProvider(): OcrProviderId {
  const raw = (process.env.OCR_PROVIDER ?? "tesseract").toLowerCase();
  if (raw === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (raw === "manual") return "manual";
  return "tesseract";
}

export async function runOcr(input: {
  imageBytes: ArrayBuffer;
  mimeType: string;
  provider?: OcrProviderId;
}): Promise<OcrSuggestion> {
  const provider = input.provider ?? resolveOcrProvider();

  if (provider === "openai") {
    return runOpenAiVision(input.imageBytes, input.mimeType);
  }

  // Serwerowy fallback: pełny Tesseract jest w przeglądarce (lekki Vercel).
  return {
    provider: "manual",
    merchantName: null,
    receiptDate: null,
    totalGrosze: null,
    suggestedCategory: null,
    items: [],
    note:
      "Odczyt darmowy działa w aplikacji na telefonie. Uzupełnij pola, jeśli nie wypełniły się same.",
  };
}

async function runOpenAiVision(
  imageBytes: ArrayBuffer,
  mimeType: string,
): Promise<OcrSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      provider: "manual",
      merchantName: null,
      receiptDate: null,
      totalGrosze: null,
      suggestedCategory: null,
      items: [],
      note: "Brak OPENAI_API_KEY — użyto trybu ręcznego.",
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
            "Kwoty w groszach (12,34 zł = 1234). Jeśli niepewne — null.",
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
  let parsed: {
    merchantName?: string | null;
    receiptDate?: string | null;
    totalGrosze?: number | null;
    items?: { name?: string; totalGrosze?: number }[];
  };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch {
    throw new Error("OpenAI OCR: niepoprawny JSON w odpowiedzi");
  }

  const merchantName = parsed.merchantName?.trim() || null;
  const items = (parsed.items ?? [])
    .filter((i) => i.name && typeof i.totalGrosze === "number")
    .map((i) => ({
      name: String(i.name),
      totalGrosze: Math.round(Number(i.totalGrosze)),
    }));

  const suggestedCategory = merchantName
    ? suggestCategory(merchantName)
    : null;

  return {
    provider: "openai",
    merchantName,
    receiptDate: parsed.receiptDate ?? null,
    totalGrosze:
      typeof parsed.totalGrosze === "number"
        ? Math.round(parsed.totalGrosze)
        : null,
    suggestedCategory,
    items,
    rawText: content,
  };
}

import { createWorker } from "tesseract.js";
import type { OcrSuggestion } from "@/lib/receipts/types";
import { parseReceiptText } from "@/lib/receipts/parse-receipt-text";
import { suggestCategory } from "@/lib/receipts/categorize";
import { CROP_TOTAL_ZONE, cropImageToBlob } from "@/lib/receipts/crop-image";

function loggerToProgress(onProgress?: (percent: number) => void) {
  return (m: {
    status: string;
    progress: number;
  }) => {
    if (m.status === "recognizing text" && typeof m.progress === "number") {
      onProgress?.(Math.round(m.progress * 100));
    }
  };
}

/**
 * Darmowy OCR w przeglądarce (Tesseract) — daje „pierwsze wypełnienie”.
 * Gemini może nadpisać pola, ale tesseract zapewnia działanie nawet przy 429.
 */
export async function recognizeReceiptFree(
  image: File | Blob,
  onProgress?: (percent: number) => void,
): Promise<OcrSuggestion> {
  const worker = await createWorker("pol+eng", 1, {
    logger: loggerToProgress(onProgress),
  });

  try {
    const { data } = await worker.recognize(image);
    const parsed = parseReceiptText(data.text);
    const suggestedCategory = parsed.merchantName
      ? suggestCategory(parsed.merchantName)
      : null;

    return {
      provider: "manual",
      merchantName: parsed.merchantName,
      receiptDate: parsed.receiptDate,
      totalGrosze: parsed.totalGrosze,
      suggestedCategory,
      items: [],
      rawText: data.text,
      note: "Odczyt darmowy (Tesseract) — sprawdź pola i potwierdź. Spróbuję potem Gemini.",
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Ponowny odczyt TYLKO sumy (dolny fragment paragonu).
 * Zwraca sumę w groszach lub null.
 */
export async function recognizeTotalZone(
  image: File | Blob,
  onProgress?: (percent: number) => void,
): Promise<number | null> {
  const crop = await cropImageToBlob(image, CROP_TOTAL_ZONE);
  const worker = await createWorker("pol+eng", 1, {
    logger: loggerToProgress(onProgress),
  });

  try {
    const { data } = await worker.recognize(crop);
    return parseReceiptText(data.text).totalGrosze;
  } finally {
    await worker.terminate();
  }
}


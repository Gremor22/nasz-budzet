import { createWorker } from "tesseract.js";
import { parseReceiptText } from "@/lib/receipts/parse-receipt-text";
import { suggestCategory } from "@/lib/receipts/categorize";
import type { OcrSuggestion } from "@/lib/receipts/types";
import {
  CROP_TOTAL_ZONE,
  cropImageToBlob,
} from "@/lib/receipts/crop-image";

/**
 * Darmowy OCR w przeglądarce (Tesseract) — bez klucza API.
 * Dwa przebiegi: całe zdjęcie + dół (strefa sumy), żeby nie brać kodu Glovo zamiast SUMA.
 */
export async function recognizeReceiptFree(
  image: File | Blob,
  onProgress?: (percent: number) => void,
): Promise<OcrSuggestion> {
  const worker = await createWorker("pol+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 50));
      }
    },
  });

  try {
    const full = await worker.recognize(image);
    const fullParsed = parseReceiptText(full.data.text);

    onProgress?.(55);
    let totalFromFocus: number | null = null;
    let focusText = "";
    try {
      const totalCrop = await cropImageToBlob(image, CROP_TOTAL_ZONE);
      const focus = await worker.recognize(totalCrop);
      focusText = focus.data.text;
      totalFromFocus = parseReceiptText(focusText).totalGrosze;
      onProgress?.(100);
    } catch {
      // przycięcie niekrytyczne
    }

    const totalGrosze = pickBetterTotal(
      fullParsed.totalGrosze,
      totalFromFocus,
    );

    const merchantName = fullParsed.merchantName;
    const suggestedCategory = merchantName
      ? suggestCategory(merchantName)
      : null;

    const hasAny =
      merchantName || fullParsed.receiptDate || totalGrosze != null;

    return {
      provider: "tesseract",
      merchantName,
      receiptDate: fullParsed.receiptDate,
      totalGrosze,
      suggestedCategory,
      items: [],
      rawText: `${full.data.text}\n---FOCUS---\n${focusText}`,
      note: hasAny
        ? "Darmowy odczyt (całość + dół paragonu pod sumę). Sprawdź pola przed zapisem."
        : "Nie udało się odczytać pól automatycznie. Uzupełnij je na podstawie zdjęcia.",
    };
  } finally {
    await worker.terminate();
  }
}

/** Tylko strefa sumy — przycisk „Popraw odczyt sumy”. */
export async function recognizeTotalZone(
  image: File | Blob,
  onProgress?: (percent: number) => void,
): Promise<number | null> {
  const crop = await cropImageToBlob(image, CROP_TOTAL_ZONE);
  const worker = await createWorker("pol+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });
  try {
    const { data } = await worker.recognize(crop);
    return parseReceiptText(data.text).totalGrosze;
  } finally {
    await worker.terminate();
  }
}

function pickBetterTotal(
  full: number | null,
  focus: number | null,
): number | null {
  if (full == null) return focus;
  if (focus == null) return full;
  // Kod Glovo / śmieci często < 10 zł przy prawdziwej sumie zakupów spożywczych
  if (full < 1000 && focus >= 1000) return focus;
  if (focus < 1000 && full >= 1000) return full;
  // Preferuj większą sensowną kwotę z focusu, gdy różnica duża
  if (Math.abs(focus - full) > 500 && focus > full) return focus;
  return focus ?? full;
}

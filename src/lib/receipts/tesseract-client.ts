import { createWorker } from "tesseract.js";
import { parseReceiptText } from "@/lib/receipts/parse-receipt-text";
import { suggestCategory } from "@/lib/receipts/categorize";
import type { OcrSuggestion } from "@/lib/receipts/types";

/**
 * Darmowy OCR w przeglądarce (Tesseract) — bez klucza API i bez opłat.
 * Jakość na zmiętych / niewyraźnych paragonach bywa słaba — zawsze weryfikacja.
 */
export async function recognizeReceiptFree(
  image: File | Blob,
  onProgress?: (percent: number) => void,
): Promise<OcrSuggestion> {
  const worker = await createWorker("pol+eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });

  try {
    const {
      data: { text },
    } = await worker.recognize(image);
    const parsed = parseReceiptText(text);
    const suggestedCategory = parsed.merchantName
      ? suggestCategory(parsed.merchantName)
      : null;

    const hasAny =
      parsed.merchantName || parsed.receiptDate || parsed.totalGrosze != null;

    return {
      provider: "tesseract",
      merchantName: parsed.merchantName,
      receiptDate: parsed.receiptDate,
      totalGrosze: parsed.totalGrosze,
      suggestedCategory,
      items: [],
      rawText: text,
      note: hasAny
        ? "Darmowy odczyt. Sprawdź pola przed zapisem — przy niewyraźnym zdjęciu litery mogą się mylić."
        : "Nie udało się odczytać pól automatycznie. Uzupełnij je na podstawie zdjęcia (nadal za darmo).",
    };
  } finally {
    await worker.terminate();
  }
}

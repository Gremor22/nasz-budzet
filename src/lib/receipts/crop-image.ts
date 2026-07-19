/**
 * Przycinanie fragmentu zdjęcia w przeglądarce (0–1 = ułamek szerokości/wysokości).
 * Używane do „skupienia” OCR na sumie / nagłówku paragonu.
 */

export type CropFraction = {
  /** Od góry (0 = sam szczyt) */
  top: number;
  left: number;
  width: number;
  height: number;
};

/** Dolna część paragonu — zwykle SUMA PLN / do zapłaty */
export const CROP_TOTAL_ZONE: CropFraction = {
  top: 0.42,
  left: 0.05,
  width: 0.9,
  height: 0.5,
};

/** Góra — sklep / logo */
export const CROP_HEADER_ZONE: CropFraction = {
  top: 0,
  left: 0.05,
  width: 0.9,
  height: 0.28,
};

export async function cropImageToBlob(
  source: Blob,
  crop: CropFraction,
  mimeType = "image/jpeg",
): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    const sx = Math.floor(bitmap.width * crop.left);
    const sy = Math.floor(bitmap.height * crop.top);
    const sw = Math.max(1, Math.floor(bitmap.width * crop.width));
    const sh = Math.max(1, Math.floor(bitmap.height * crop.height));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Brak canvas 2D");

    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Nie udało się przyciąć zdjęcia"));
        },
        mimeType,
        0.92,
      );
    });
  } finally {
    bitmap.close();
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

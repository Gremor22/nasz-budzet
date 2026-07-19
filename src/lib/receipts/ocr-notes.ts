/** Bezpieczne do importu w kliencie — bez Buffer / fetch serwerowego. */

export function isTechnicalOcrNote(note: string | null | undefined): boolean {
  if (!note) return false;
  return (
    note === "use_client_tesseract" ||
    note === "manual_after_quota" ||
    note === "manual_after_error" ||
    /\b429\b/.test(note) ||
    /quota|rate.?limit|Gemini OCR|OpenAI OCR/i.test(note)
  );
}

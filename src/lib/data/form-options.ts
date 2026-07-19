/** Wspólne etykiety formularzy Etapu 3 */

export const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "once", label: "Jednorazowo" },
  { value: "weekly", label: "Co tydzień" },
  { value: "biweekly", label: "Co dwa tygodnie" },
  { value: "monthly", label: "Co miesiąc" },
  { value: "monthly_on_day", label: "W wybrany dzień miesiąca" },
  { value: "last_business_day", label: "Ostatni dzień roboczy miesiąca" },
  { value: "irregular", label: "Nieregularnie" },
];

export const CONFIDENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "confirmed", label: "Potwierdzony" },
  { value: "expected", label: "Oczekiwany" },
  { value: "forecast", label: "Prognozowany" },
];

export const BILL_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "planned", label: "Planowany" },
  { value: "reserved", label: "Zarezerwowany" },
  { value: "paid", label: "Opłacony" },
  { value: "cancelled", label: "Anulowany" },
  { value: "uncertain", label: "Niepewny" },
];

export function parseZlToGrosze(raw: string): number | null {
  const zl = Number(raw.replace(",", "."));
  if (!Number.isFinite(zl) || zl < 0) return null;
  return Math.round(zl * 100);
}

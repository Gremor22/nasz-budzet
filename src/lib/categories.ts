/** Wspólna lista kategorii wydatków w aplikacji. */
export const EXPENSE_CATEGORIES = [
  "Jedzenie",
  "Restauracje",
  "Dom",
  "Media i internet",
  "Transport",
  "Zdrowie",
  "Rozrywka",
  "Subskrypcje",
  "Ubrania",
  "Dzieci",
  "Zwierzęta",
  "Prezenty",
  "Zakupy",
  "Usługi",
  "Podatki",
  "Oszczędności",
  "Inne",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Kolory wykresu — wyraźnie różne odcienie. */
export const CATEGORY_CHART_COLORS = [
  "#2d6a4f",
  "#9a5b14",
  "#1d4e89",
  "#7b2cbf",
  "#bc4749",
  "#40916c",
  "#e76f51",
  "#52796f",
  "#6a994e",
  "#bc6c25",
  "#3a86ff",
  "#8338ec",
  "#ff006e",
  "#fb5607",
  "#06d6a0",
  "#118ab2",
  "#073b4c",
];

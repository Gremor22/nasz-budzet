/** Dzisiejsza data w Europe/Warsaw jako YYYY-MM-DD */
export function todayIsoWarsaw(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

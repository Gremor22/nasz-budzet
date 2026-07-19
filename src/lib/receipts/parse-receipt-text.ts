/**
 * Heurystyki odczytu polskiego paragonu z surowego tekstu OCR.
 * Nie są idealne — zawsze weryfikacja użytkownika.
 */

const KNOWN_MERCHANTS = [
  "biedronka",
  "lidl",
  "żabka",
  "zabka",
  "auchan",
  "carrefour",
  "rossmann",
  "orlen",
  "shell",
  "bp",
  "netto",
  "dino",
  "kaufland",
  "stokrotka",
  "lewiatan",
  "aldi",
  "media expert",
  "rtv euro",
  "hebe",
];

const TOTAL_LABEL =
  /(?:suma|sum\.?\s*pln|razem|do\s*zapłaty|do\s*zaplaty|total|kwota|płatność|platnosc)\s*[:\.]?\s*/i;

export function parseReceiptText(raw: string): {
  merchantName: string | null;
  receiptDate: string | null;
  totalGrosze: number | null;
} {
  const text = raw.replace(/\r/g, "\n");
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    merchantName: findMerchant(lines, text),
    receiptDate: findDate(text),
    totalGrosze: findTotal(text, lines),
  };
}

function findMerchant(lines: string[], full: string): string | null {
  const lowerFull = full.toLowerCase();
  for (const name of KNOWN_MERCHANTS) {
    if (lowerFull.includes(name)) {
      // Canonical polish-ish label
      if (name === "zabka") return "Żabka";
      if (name === "bp") return "BP";
      return name
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  // Pierwsza sensowna linia (bez samych cyfr)
  for (const line of lines.slice(0, 8)) {
    if (line.length < 3 || line.length > 40) continue;
    if (/^\d+([.,]\d+)?$/.test(line)) continue;
    if (/^(paragon|faktura|nip|www\.|http)/i.test(line)) continue;
    if (/^\d{2}[-./]\d{2}/.test(line)) continue;
    return line;
  }
  return null;
}

function findDate(text: string): string | null {
  const patterns = [
    /(\d{4})[-./](\d{2})[-./](\d{2})/,
    /(\d{2})[-./](\d{2})[-./](\d{4})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    if (m[0].includes(m[1]!) && m[1]!.length === 4) {
      return `${m[1]}-${m[2]}-${m[3]}`;
    }
    const dd = m[1]!;
    const mm = m[2]!;
    const yyyy = m[3]!;
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  return null;
}

function parseAmountToGrosze(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0 || n > 100_000) return null;
  return Math.round(n * 100);
}

function findTotal(text: string, lines: string[]): number | null {
  // 1) Linia z etykietą sumy
  for (const line of lines) {
    if (!TOTAL_LABEL.test(line) && !/suma/i.test(line)) continue;
    const amounts = [...line.matchAll(/(\d{1,5}[.,]\d{2})/g)];
    if (amounts.length > 0) {
      const last = amounts[amounts.length - 1]![1]!;
      const g = parseAmountToGrosze(last);
      if (g != null) return g;
    }
  }

  // 2) Etykieta w jednej linii, kwota w następnej
  for (let i = 0; i < lines.length - 1; i++) {
    if (!TOTAL_LABEL.test(lines[i]!)) continue;
    const m = lines[i + 1]!.match(/(\d{1,5}[.,]\d{2})/);
    if (m) {
      const g = parseAmountToGrosze(m[1]!);
      if (g != null) return g;
    }
  }

  // 3) Fallback: największa kwota w dolnej połowie tekstu (często suma)
  const half = lines.slice(Math.floor(lines.length / 2));
  let best: number | null = null;
  for (const line of half) {
    if (/nip|regon|kasa|bon|rabat|gotówka|gotowka|karta/i.test(line)) continue;
    for (const m of line.matchAll(/(\d{1,5}[.,]\d{2})/g)) {
      const g = parseAmountToGrosze(m[1]!);
      if (g != null && (best === null || g > best)) best = g;
    }
  }
  return best;
}

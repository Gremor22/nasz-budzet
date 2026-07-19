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
  "glovo",
];

const TOTAL_LABEL =
  /(?:suma\s*pln|suma|sum\.?\s*pln|razem|do\s*zapłaty|do\s*zaplaty|total|sprzedaż\s*opłacona|sprzedaz\s*oplacona)\s*[:\.]?\s*/i;

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
    if (name === "glovo") continue; // to nie sklep źródłowy
    if (lowerFull.includes(name)) {
      if (name === "zabka") return "Żabka";
      if (name === "bp") return "BP";
      return name
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

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
    if (m[1]!.length === 4) {
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

/** Tylko kwoty z groszami (12,34) — odrzuca kody typu 727. */
function findDecimalAmounts(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(/(\d{1,5}[.,]\d{2})/g)) {
    const g = parseAmountToGrosze(m[1]!);
    if (g != null) out.push(g);
  }
  return out;
}

function findTotal(text: string, lines: string[]): number | null {
  // 1) Linia z etykietą sumy + kwota z groszami w TEJ samej linii
  for (const line of lines) {
    if (!TOTAL_LABEL.test(line) && !/suma/i.test(line)) continue;
    const amounts = findDecimalAmounts(line);
    if (amounts.length > 0) return amounts[amounts.length - 1]!;
  }

  // 2) Etykieta bez kwoty → tylko NASTĘPNE linie (nie poprzednie = nie ostatni produkt)
  for (let i = 0; i < lines.length; i++) {
    if (!TOTAL_LABEL.test(lines[i]!) && !/^suma\b/i.test(lines[i]!)) continue;
    for (const j of [i + 1, i + 2]) {
      if (j >= lines.length) continue;
      const next = lines[j]!;
      // sama kwota albo krótka linia z kwotą — nie „Czekolada 7,99”
      if (/[a-ząćęłńóśźż]{3,}/i.test(next.replace(/\d+[.,]\d{2}/g, ""))) {
        continue;
      }
      const amounts = findDecimalAmounts(next);
      if (amounts.length > 0) return amounts[amounts.length - 1]!;
    }
  }

  // 3) Suma pozycji (gdy SUMA zasłonięta ręcznym kodem, np. Glovo 727)
  const itemsSum = sumLikelyLineItems(lines);
  if (itemsSum != null && itemsSum >= 100) return itemsSum;

  // 4) Największa kwota z groszami w dolnej połowie
  const half = lines.slice(Math.floor(lines.length / 2));
  let best: number | null = null;
  for (const line of half) {
    if (/nip|regon|kasa|bon|rabat|kod\s*odbioru|terminal/i.test(line)) continue;
    for (const g of findDecimalAmounts(line)) {
      if (best === null || g > best) best = g;
    }
  }
  return best;
}

/**
 * Sumuje typowe ceny pozycji (małe kwoty z groszami na liniach produktów).
 */
function sumLikelyLineItems(lines: string[]): number | null {
  let sum = 0;
  let count = 0;
  for (const line of lines) {
    if (TOTAL_LABEL.test(line)) continue;
    if (/nip|ptu|sprzedaż|sprzedaz|gotówka|gotowka|karta|glovo|rozliczenie|paragon|fiskal/i.test(line)) {
      continue;
    }
    const amounts = findDecimalAmounts(line);
    if (amounts.length === 0) continue;
    // Ostatnia kwota w linii zwykle = wartość pozycji
    const price = amounts[amounts.length - 1]!;
    if (price < 5 || price > 50_000) continue; // 0,05–500 zł
    sum += price;
    count += 1;
  }
  if (count < 2) return null;
  return sum;
}

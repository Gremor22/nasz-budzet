import type { TourStep } from "@/lib/tour/types";

const ALL_STEPS: TourStep[] = [
  {
    id: "welcome",
    path: "/",
    title: "Witaj w Naszym Budżecie",
    body: "Pulpit pokazuje miesiąc jak prosty arkusz: wpływy, wydatki i wykres. Ten przewodnik zajmie około minuty.",
    example: "Możesz go pominąć — wrócisz do niego w Więcej → Pokaż przewodnik.",
    placement: "center",
  },
  {
    id: "month-summary",
    path: "/",
    target: "month-summary",
    title: "Podsumowanie miesiąca",
    body: "Wpływy, wydatki i ile zostało w wybranym miesiącu — strzałkami u góry zmieniasz miesiąc.",
    example: "Oszczędności (jeśli dodasz je jako kategorię) też się tu pokażą.",
    placement: "bottom",
  },
  {
    id: "month-chart",
    path: "/",
    target: "month-chart",
    title: "Na co poszło",
    body: "Wykres kołowy pokazuje wydatki wg kategorii — jak w arkuszu z podsumowaniem.",
    placement: "bottom",
  },
  {
    id: "quick-add",
    path: "/",
    target: "quick-add",
    title: "Szybkie dodawanie",
    body: "Wydatek, wpływ lub skan paragonu — zdjęcie uzupełni sklep i sumę, Ty sprawdzasz przed zapisem.",
    example: "Zielony przycisk „+” na dole też prowadzi do formularza.",
    placement: "top",
  },
  {
    id: "nav-add",
    path: "/",
    target: "nav-add",
    title: "Dodawanie wydatków",
    body: "Zielony przycisk „+” na dole — stąd dodajesz wydatek lub wpływ ręcznie.",
    example: "Naciśnij „Dalej” — pokażemy formularz dodawania.",
    placement: "top",
  },
  {
    id: "scan-receipt",
    path: "/dodaj",
    target: "scan-receipt",
    title: "Skan paragonu",
    body: "Zrób zdjęcie paragonu lub wybierz z galerii. Aplikacja podpowie sklep i sumę — Ty zawsze sprawdzasz przed zapisem.",
    example: "Przy limicie AI wpisz sumę ręcznie ze zdjęcia.",
    placement: "bottom",
  },
  {
    id: "add-form",
    path: "/dodaj",
    target: "add-form",
    title: "Formularz ręczny",
    body: "Opis, kwota, kategoria, konto — zapisz, a transakcja pojawi się na liście i w prognozie.",
    example: "Np. „Zakupy” · 49,99 zł · Jedzenie · Konto wspólne.",
    placement: "bottom",
  },
  {
    id: "nav-prognoza",
    path: "/",
    target: "nav-prognoza",
    title: "Zakładka Prognoza",
    body: "Tu zobaczysz saldo dzień po dniu: wpływy, rachunki i najniższy punkt w horyzoncie.",
    placement: "top",
  },
  {
    id: "prognoza-timeline",
    path: "/prognoza",
    target: "prognoza-timeline",
    title: "Oś czasu",
    body: "Lista zdarzeń pokazuje, co się dzieje z saldem. Zmień horyzont (7–90 dni) przyciskami u góry.",
    example: "Szukaj daty, kiedy saldo spada najniżej.",
    placement: "bottom",
  },
  {
    id: "nav-wiecej",
    path: "/",
    target: "nav-wiecej",
    title: "Ustawienia i konfiguracja",
    body: "Zakładka „Więcej” — konta, dochody, rachunki cykliczne, cele i zaproszenie drugiej osoby.",
    placement: "top",
  },
  {
    id: "wiecej-budget",
    path: "/wiecej",
    target: "wiecej-budget",
    title: "Uzupełnij budżet na start",
    body: "Wejdź w Konta, Źródła dochodu i Rachunki — bez tego prognoza będzie pusta lub niedokładna.",
    example: "Najpierw konta, potem pensje i stałe opłaty (czynsz, Netflix…).",
    placement: "bottom",
  },
  {
    id: "wiecej-export",
    path: "/wiecej",
    target: "wiecej-export",
    title: "Backup danych",
    body: "Raz w miesiącu pobierz Backup JSON — to Twoja kopia budżetu na dysku.",
    example: "CSV przydaje się do Excela (same transakcje).",
    placement: "top",
  },
  {
    id: "done",
    path: "/",
    title: "Gotowe!",
    body: "Możesz zaczynać. Pełną instrukcję znajdziesz w Więcej → Instrukcja. Powodzenia!",
    placement: "center",
  },
];

export function getTourSteps(includeReceipt: boolean): TourStep[] {
  if (includeReceipt) return ALL_STEPS;
  return ALL_STEPS.filter((s) => s.id !== "scan-receipt");
}

export function tourStepCount(includeReceipt: boolean): number {
  return getTourSteps(includeReceipt).length;
}

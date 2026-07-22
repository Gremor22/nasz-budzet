"use client";

import Link from "next/link";
import { Card, Label } from "@/components/ui";

const SECTIONS = [
  {
    title: "Pierwsze kroki",
    items: [
      "Po pierwszym logowaniu uruchomi się przewodnik ze strzałkami — możesz go pominąć lub włączyć ponownie w Więcej.",
      "Utwórz gospodarstwo albo dołącz kodem (Więcej → Gospodarstwo).",
      "Uzupełnij konta, źródła dochodu i rachunki cykliczne — wtedy prognoza ma sens.",
      "Dodawaj wydatki i przychody z zakładki „+” lub skanuj paragon.",
    ],
  },
  {
    title: "Pulpit i prognoza",
    items: [
      "Pulpit pokazuje saldo i „bezpiecznie do wydania” na wybrany horyzont (7 / 14 / 30 dni w Więcej).",
      "Tryb ostrożny — tylko potwierdzone wpływy.",
      "Tryb realistyczny (domyślny) — wpływy oczekiwane w kwocie bezpiecznej, nie pełnej typowej.",
      "Tryb pełnej prognozy — uwzględnia też prognozowane wpływy i pełne kwoty.",
      "Bufor bezpieczeństwa (Więcej) odejmuje stałą kwotę od „bezpiecznie do wydania”.",
    ],
  },
  {
    title: "Paragony",
    items: [
      "Dodaj → Zeskanuj paragon → zdjęcie z aparatu lub galerii.",
      "Aplikacja najpierw odczytuje dane lokalnie (Tesseract), potem próbuje AI (Gemini) — jeśli limit Gemini jest wyczerpany, zostają pola z lokalnego odczytu.",
      "Zawsze sprawdź sklep, datę i sumę przed zatwierdzeniem — wydatek zapisuje się dopiero po Twoim „Potwierdź”.",
      "Przycisk „Popraw odczyt sumy” skupia się na dolnej części paragonu.",
      "Możesz zapamiętać kategorię dla sklepu — przy kolejnych paragonach zostanie zaproponowana automatycznie.",
    ],
  },
  {
    title: "Cele oszczędnościowe",
    items: [
      "Więcej → Cele oszczędnościowe — dodawanie, edycja, usuwanie.",
      "Zaznaczenie „Zarezerwowane” zmniejsza kwotę „bezpiecznie do wydania” o zebrane środki na cel.",
    ],
  },
  {
    title: "Aplikacja na iPhone (PWA)",
    items: [
      "Otwórz adres aplikacji w Safari (nie Chrome).",
      "Stuknij Udostępnij → Dodaj do ekranu początkowego.",
      "Uruchamiaj z ikony „Nasz Budżet” — bez paska adresu Safari.",
      "Bez internetu zobaczysz komunikat; edycja wymaga połączenia z Supabase.",
    ],
  },
  {
    title: "Eksport i backup",
    items: [
      "Więcej → Eksport danych — pobierz pełny JSON (backup) lub CSV transakcji (Excel).",
      "Rób eksport regularnie, np. raz w miesiącu.",
      "Zdjęcia paragonów są w Supabase Storage — nie wchodzą do pliku JSON.",
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link
          href="/wiecej"
          className="text-sm text-[var(--accent)]"
        >
          ← Więcej
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Instrukcja</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Krótki przewodnik po Naszym Budżecie dla Pawła i Mileny.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <Label>{section.title}</Label>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--ink-muted)]">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      ))}

      <Card>
        <Label>Problemy?</Label>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--ink-muted)]">
          <li>
            Limit Gemini przy paragonach — odczekaj kilka minut lub wpisz sumę
            ręcznie; lokalny odczyt i tak wypełnia podstawowe pola.
          </li>
          <li>
            Brak danych drugiej osoby — sprawdź, czy oboje jesteście w tym samym
            gospodarstwie (kod zaproszenia).
          </li>
          <li>
            Aplikacja nie instaluje się na iPhone — użyj Safari, nie innej
            przeglądarki.
          </li>
        </ul>
      </Card>

      <p className="text-center text-xs text-[var(--ink-muted)]">
        Nasz Budżet · Etap 7
      </p>
    </div>
  );
}

# Mini-PWA — dodawanie do ekranu początkowego iPhone’a

## Co działa

- Manifest: nazwa **Nasz Budżet**, krótka **Budżet**, tryb **standalone**, język **pl-PL**
- Ikony 192 / 512 oraz Apple Touch Icon
- Metadane iOS (web app capable, tytuł, status bar)
- Kolory motywu: `#2d6a4f` / tło `#f3f0eb`
- Safe-area dla dolnej nawigacji
- Podpowiedź instalacji w Safari na iPhonie (gdy nie zainstalowano)
- Komunikat przy braku internetu

## Czego nie ma

- Powiadomień push
- Pełnego działania offline (dane nadal wymagają Supabase)
- Cache całej aplikacji

## Jak dodać na iPhonie (Safari)

1. Otwórz https://nasz-budzet.vercel.app w **Safari** (nie Chrome).
2. Stuknij **Udostępnij** (kwadrat ze strzałką w górę).
3. Wybierz **Dodaj do ekranu początkowego**.
4. Potwierdź nazwę **Nasz Budżet** / **Budżet**.
5. Otwórz ikonę z ekranu początkowego — powinna działać bez paska adresu Safari.

## Pliki

- `public/manifest.webmanifest`
- `public/icons/*`, `public/apple-touch-icon.png`
- `src/components/InstallHint.tsx`, `OfflineBanner.tsx`, `PwaChrome.tsx`

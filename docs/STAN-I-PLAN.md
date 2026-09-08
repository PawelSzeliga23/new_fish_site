# Stan projektu i dalsze kroki

Plik do przeczytania na starcie sesji. Szczegółowy przebieg prac jest
w `docs/2026-09-08-sesja.md`.

---

## Co działa

### Dane o wodach

W bazie leży **103 336 obiektów** zaimportowanych ze zrzutów OpenStreetMap
(Geofabrik) dla całej Polski:

- 76 tys. obrysów powierzchniowych — jeziora, stawy, zalewy, szerokie rzeki,
- 27 150 cieków liniowych — rzeki i kanały, które w OSM nie mają obrysu,
- 45 554 z nazwą (w tym 12 241 wywnioskowanych z sąsiedztwa).

Odsiew: obiekty poniżej 0,5 ha są pomijane, **chyba że mają nazwę**. Powód
w sekcji „Świadome kompromisy".

### Reguła 50 m

Miejscówkę można postawić tylko w promieniu 50 m od wody. Pilnuje tego
`add_location` w bazie, więc nie da się tego obejść z pominięciem interfejsu.
Mapa ostrzega przed wysłaniem formularza i blokuje zapis.

### Prognoza brań

`src/lib/bite-score.ts` — ocena 0–100 z siedmiu czynników, z rozbiciem
pokazywanym użytkownikowi. Do tego prognoza godzinowa na 48 h z wykryciem
najlepszego okna.

### Hydrologia

`src/lib/hydro.ts` — najbliższy posterunek IMGW (913 stacji, dobór po odległości)
plus modelowany przepływ z Open-Meteo Flood API.

### Strony

| ścieżka | zawartość |
|---|---|
| `/map` | mapa z pinezkami, obrysami wód doczytywanymi po kadrze, dodawaniem miejscówek |
| `/locations/[id]` | mapa jako okładka, prognoza brań, warunki, hydrologia, ranking połowów |
| `/locations/[id]/catches` | pełna historia z wyszukiwarką, filtrami dat i paginacją |
| `/locations/[id]/edit` | edycja nazwy, widoczności, dojazdu i zdjęcia (tylko właściciel) |

---

## Pułapki, o których trzeba pamiętać

Każda z nich kosztowała podczas tej sesji sporo czasu.

### RLS blokuje indeksy przestrzenne

Postgres przepuszcza przed barierę RLS wyłącznie operatory **leakproof**.
`ST_DWithin` taki nie jest, więc pod rolą `authenticated` planer **nie użyje**
indeksu i zrobi pełny skan. Objaw: funkcja szybka jako właściciel bazy i
kilkanaście sekund dla zwykłego użytkownika.

**Zawsze mierz wydajność pod rolą `authenticated`**, nie jako właściciel:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
set local statement_timeout = '8s';
-- zapytanie
rollback;
```

Funkcje robiące wyszukiwanie przestrzenne po `water_bodies` muszą być
`security definer` (tabela i tak jest czytelna dla każdego zalogowanego).

### Limit czasu instrukcji to 8 s

Rola `authenticated` ma `statement_timeout=8s`, `anon` 3 s. **Dotyczy to też
`service_role`**, bo PostgREST łączy się przez rolę `authenticator`. Każda
operacja masowa musi iść partiami — stąd skrypty w `scripts/` wołające funkcje
`*_batch` w pętli.

### PostgREST cache'uje schemat

Po zmianie sygnatury funkcji klient dostaje `Could not find the function ...`.
Migracja musi kończyć się `notify pgrst, 'reload schema';`.

### Po masowych zmianach trzeba posprzątać

31 tys. UPDATE-ów zostawiło tabelę spuchniętą martwymi krotkami i spowolniło
mapę. Po każdym imporcie lub przebiegu masowym:

```sql
vacuum full analyze water_bodies;
vacuum full analyze water_bodies_map;
```

### Indeks potrafi zaszkodzić

Indeks po `area_ha` na warstwie mapowej sprawiał, że planer skanował wszystkie
27 tys. cieków dla gałęzi `area_ha IS NULL`. Usunięcie go: 654 ms → 13 ms.
Nie dodawaj go z powrotem bez pomiaru.

### CSS wygrywa z atrybutem prezentacyjnym SVG

Leaflet ustawia kolory jako atrybuty (`fill="none"` na liniach). Reguła CSS je
nadpisuje — stąd rzeki wypełnione jak wielokąty. Klasa `.water-body-area`
(wypełnienie) trafia wyłącznie na `Polygon`/`MultiPolygon`.

### `.next` w OneDrive

Katalog jest synchronizowany i dehydratowany do postaci „tylko w chmurze", przez
co workery Turbopacka padają z generycznym `Jest worker encountered N child
process exceptions`. Docelowo warto przenieść projekt poza OneDrive albo
podstawić junction pod `.next`.

---

## Świadome kompromisy

- **Próg 0,5 ha.** Przy 0,1 ha w bazie było 204 tys. obiektów i mapa przestawała
  wyrabiać się w limicie czasu. Kompromis: bezimienny staw poniżej 0,5 ha
  (mniej niż ~70×70 m) nie jest w bazie, więc reguła 50 m nie pozwoli tam
  postawić miejscówki. Nazwane wody są zachowane niezależnie od wielkości.
- **Heurystyka brań nie jest skalibrowana na danych.** Wagi pochodzą z wiedzy
  wędkarskiej. `catch_reports.conditions_snapshot` to zalążek pętli
  kalibracyjnej, ale potrzeba setek rekordów.
- **Relacje w OSM** — brane są tylko te człony „outer", które same są zamknięte.
  Bardzo duże jeziora mapowane fragmentami mogą mieć niepełny obrys.
- **Filtrowanie historii połowów po stronie klienta.** RPC zwraca komplet
  połowów jednej miejscówki — to rzędy dziesiątek. Gdyby któraś urosła do
  tysięcy wpisów, trzeba przenieść filtry do SQL.

---

## Do zrobienia

### Bliskie i konkretne

- [ ] **Trzy błędy ESLint w plikach nietkniętych tej sesji**: `src/app/page.tsx`
      i `src/components/Sidebar.tsx` używają `<a>` zamiast `<Link>`,
      `src/components/ThemeToggle.tsx` woła `setState` synchronicznie w efekcie.
- [ ] **Typ `lake` dla kanałów.** Kanał Żerański ma w OSM powierzchnię bez tagu
      `water=river`, więc mapper klasyfikuje go po wielkości. Można dodać regułę
      po nazwie („Kanał …" → `river`).
- [ ] **Kolumna `note` znaczy „nazwa".** Nazwa została z pierwszej wersji
      schematu; dziś jest tytułem miejscówki wszędzie w interfejsie.
      Przemianowanie dotknie `get_location`, `add_location`, `update_location`
      i cztery widoki.
- [ ] **Przycisk „Wykryj zbiorniki tutaj" na mapie** jest po imporcie w dużej
      mierze zbędny (i zależy od kapryśnego Overpassa). Do rozważenia usunięcie
      albo przeniesienie do trybu serwisowego.
- [ ] **57 782 obrysy nadal bez nazwy.** Można spróbować trzeciej reguły:
      nazwa najbliższej miejscowości albo tag `alt_name` z OSM.

### Większe tematy

- [ ] **Reguła 50 m tylko przy dodawaniu.** Istniejące miejscówki nie są
      sprawdzane wstecz ani przy edycji współrzędnych.
- [ ] **Zdjęcia połowów są w publicznym buckecie** mimo że sam połów bez
      `location_id` jest prywatny. Rozjazd między modelem uprawnień a storage.
- [ ] **Temperatura wody z IMGW jest zwykle pusta**, a to najmocniejszy czynnik
      po trendzie ciśnienia. Do rozważenia model temperatury wody z pogody.
- [ ] **Aktualizacja danych OSM.** Zrzuty Geofabrika są dobowe; nie ma
      mechanizmu odświeżania poza ponownym uruchomieniem importu.
- [ ] **Ustawienia Auth**: włączyć ochronę przed wyciekłymi hasłami
      (panel → Auth → Passwords).

---

## Skrypty

Wszystkie czytają `.env.local` i wymagają `SUPABASE_SERVICE_ROLE_KEY`.

| skrypt | do czego |
|---|---|
| `scripts/import-water-bodies.mjs` | import wód ze zrzutów Geofabrika (`--dry-run`, `--region`, `--min-area-ha`) |
| `scripts/name-water-bodies.mjs` | nazywanie bezimiennych obrysów z sąsiedztwa |
| `scripts/zip-remote.mjs` | czytanie pojedynczych plików ze zdalnego ZIP-a przez zakresy bajtów |
| `scripts/shapefile.mjs` | parser `.shp`/`.dbf` bez zależności |

---

## Migracje

Tej sesji dotyczą `019`–`038`:

| numery | temat |
|---|---|
| 019–020 | widoczność komentarzy i lajków, indeksy, limity Storage |
| 021–024 | zbiorniki z OSM, wiązanie z miejscówką, autor miejscówki |
| 025–026 | wsad masowy z deduplikacją |
| 027 | reguła 50 m od wody |
| 028 | indeks funkcyjny na `geom::geography` |
| 029 | upraszczanie geometrii w locie — **zastąpione przez 035–036** |
| 030 | uprawnienia funkcji (`REVOKE … FROM PUBLIC`) |
| 031 | czyszczenie małych zbiorników, indeks po powierzchni |
| 032–034 | nazywanie obrysów z sąsiedztwa |
| 035–036 | warstwa mapowa `water_bodies_map` |
| 037 | `security definer` dla reguły 50 m |
| 038 | lista miejscówek z akwenem i liczbą połowów |

Wszystkie są **już zaaplikowane** na zdalnym projekcie przez MCP. Migracja 029
została w repozytorium dla historii, ale jej efekt nadpisuje 036 — świeża baza
przejdzie przez oba kroki bez szkody.

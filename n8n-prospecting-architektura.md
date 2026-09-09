# System prospectingu B2B w n8n + AI — architektura wdrożenia

*Dokument pod zlecenie Useme 143543 (wdrożenie „pod klucz" systemu prospectingu B2B,
self-hosted n8n + AI, branża dealerów maszyn rolniczych).*

## Zasada konstrukcji

System prospectingu, który ma działać codziennie bez nadzoru, to nie jeden wielki
workflow, tylko **kilka małych, które się podają danymi** — każdy testowalny osobno,
każdy z własną kolejką błędów. Wdrożenie „pod klucz" znaczy: panel do zatwierdzania
wiadomości + automatyzacja zbierania danych + personalizacja + wysyłka + pętla
odpowiedzi. Poniżej rozbicie na etapy, tak jak je buduję.

## Etap 1 — Zbieranie i higiena danych (n8n: schedule trigger + HTTP + code)

- Źródła kandydatów: rejestry branżowe, katalogi dealerów, strony producentów
  (cron w n8n: harmonogram dzienny, każdy przebieg zapisuje surowe rekordy do bazy).
- Higiena: deduplikacja po NIP/domenie, weryfikacjaMX domeny (odbicie na martwą
  domenę psuje reputację skrzynki), tagowanie branży/regionu.
- Wyjście: czysta tabela kandydatów (Postgres/Sheets) ze statusem `nowy`.

Dowód kompetencji z automatyzacji dokumentów w n8n (workflow do zaimportowania,
z walidacją i kolejką błędów): https://uuhyy666.github.io/naprawa-stron/ocr-llm-pipeline.json

## Etap 2 — Personalizacja AI (n8n: OpenAI/Claude node + prompt z kontekstem)

- Dla każdego kandydata: wejście = strona firmowa (scraped) + wpis rejestru;
  wyjście = 2–3 zdania konkretu o tej firmie (nie „szanowni państwo, jesteśmy
  liderem").
- Ochrona przed halucynacjami: prompt z twardym ograniczeniem „pisz wyłącznie
  o faktach z wejścia", fallback do szablonu, gdy model nie znajdzie konkretu.
- Kontrola kosztów: cache odpowiedzi po domenach, limit tokenów per przebieg.

## Etap 3 — Panel zatwierdzania (to, o co prosi zleceniodawca)

- Widok: kolejka wiadomości `do zatwierdzenia` → przyciski **wyślij / edytuj /
  odrzuć**. Realizacja: n8n z prostym frontem (formularz + webhook) albo gotowy
  widok w Sheetcie/Airtable, zależnie od preferencji.
- Nic nie wychodzi bez kliknięcia człowieka — do momentu, gdy zleceniodawca
  zadecyduje o pełnej automatyzacji wybranych segmentów.

## Etap 4 — Infrastruktura wysyłki (bezpieczna, rozłożona)

- Skrzynki: 2–3 domeny wysyłkowe (nie główna domena firmy), rozgrzewane
  stopniowo; limity dzienne rosnące (20 → 50 → 100/skrzynka).
- Pętla odpowiedzi: webhook na skrzynkę → kategoryzacja AI (zainteresowany /
  rezygnacja / OOO) → automatyczna odpowiedź lub wpis do kolejki człowieka.
- Analityka: open/reply rate per segment, automatyczne wyłączanie wariantów
  poniżej progu.

## Etap 5 — Serwer i utrzymanie

- Self-hosted n8n (Docker) na serwerze zleceniodawcy — dane nie opuszczają
  jego infrastruktury poza wywołaniami API modelu.
- Monitoring: workflow „strażnik" — alert, gdy któryś etap nie przebiegł
  w harmonogramie (e-mail/Telegram).
- Dokumentacja operacyjna: jak dodać źródło, jak zmienić limity, jak
  zatrzymać wszystko jednym przełącznikiem.

## Czas i cena

- Etap 1–3 (działający system z panelem zatwierdzania): ~10–14 dni.
- Etap 4–5 (infrastruktura wysyłki + rozgrzewka + monitoring): równolegle,
  pełna stabilność po ~3 tygodniach rozgrzewki skrzynek.
- Rozliczenie etapowe: płatność po każdym etapie, po demonstracji na żywo.

## Co mogę pokazać od razu

- Workflow n8n (plik do importu) z walidacją danych i kolejką błędów:
  https://uuhyy666.github.io/naprawa-stron/ocr-llm-pipeline.json
- Działający skeleton integracji webhook → API zewnętrzne (Node, testowalny):
  https://uuhyy666.github.io/naprawa-stron/webhook2notion.js
- Scrapery i skanery stron zbudowane na własne potrzeby (źródła danych
  dla etapu 1 to ta sama technologia).

# „Brak statusu śledzenia paczki" na Allegro — diagnoza i kierunek naprawy

*Dokument pod zlecenie Useme 143454 (Allegro – Amazon – InPost, śledzenie przesyłek).*

## Obserwacja zleceniodawcy

1. Zamówienie z Allegro realizowane przez zakup na Amazonie (wysyłka do klienta).
2. Numer przesyłki InPost trafia do zamówienia na Allegro.
3. Allegro **rozpoznaje numer**, ale pokazuje „Brak statusu śledzenia paczki" i nie pobiera kolejnych statusów.
4. Hipoteza zleceniodawcy: brak powiązania przesyłki z transakcją przez maskowany adres `@allegromail.pl`.

## Najbardziej prawdopodobna przyczyna (na podstawie dokumentacji Allegro REST API)

Numer przesyłki sam w sobie nie wystarcza. Allegro pobiera statusy śledzenia tylko wtedy, gdy przy dodawaniu numeru przesyłki do zamówienia (endpoint `PUT /order/checkout-forms/{checkoutFormId}` — pole `delivery`) podany zostanie też **poprawny identyfikator przewoźnika** (`carrierId`), a nie tylko sam numer (`waybill.line1`).

Typowe scenariusze awarii przy tym objawie:

1. **Brak `carrierId` lub wartość `OTHER`** — Allegro wie, że jest pacza, ale nie wie, u kogo pytać o status. Numer „rozpoznany", statusów brak. To dokładnie opisany objaw.
2. **Niezgodny `carrierId`** — np. wpisany `INPOST` zamiast identyfikatora metody dostawy, którą faktycznie kupujący wybrał w zamówieniu. Allegro wiąże śledzenie z metodą dostawy zamówienia; niezgodność = cisza w statusach.
3. **Maska numeru** — InPOS/InPost ma kilka formatów (np. cyfrowy vs alfanumeryczny); błędny format jest akceptowany przy zapisie, ale nie parsuje się przy odpytywaniu o status.

Hipoteza z `@allegromail.pl` jest natomiast **ślepą uliczką**: maskowany e-mail służy do dopasowania zamówienia Amazona do zamówienia Allegro **po stronie własnego systemu pośredniczącego** (żeby wiedzieć, które zamówienie opłacić). Nie ma wpływu na pobieranie statusów przez Allegro — to dwie osobne warstwy.

## Jak to naprawić — plan weryfikacji (bez zgadywania)

1. Wyeksportować z systemu jedno konkretne zamówienie z objawem: `checkoutFormId`, numer przesyłki, aktualne `delivery` z API (`GET /order/checkout-forms/{id}`) — i porównać `carrierId` z faktyczną metodą dostawy.
2. Jeśli `carrierId` jest pusty/`OTHER`/niezgodny: ponowne PUT z poprawnym identyfikatorem (mapowanie InPost → carrier w Allegro) — statusy zaczną się pobierać dla nowych zamówień; dla starych Allegro zwykle podciąga dane po aktualizacji pola.
3. Zautomatyzować: skrypt, który przy dodawaniu numeru przesyłki **zawsze** ustawia `carrierId` zgodny z metodą dostawy zamówienia + waliduje format numeru przed wysłaniem — wtedy problem nie wraca przy skali.
4. Test zamknięcia: jedno zamówienie end-to-end (zakup → numer → statusy widoczne dla kupującego).

## Dlaczego ta diagnoza, a nie inna

Objaw „numer rozpoznany, statusów brak" jest charakterystyczny dla braku/niezgodności identyfikacji przewoźnika — Allegro nie odpytuje InPostu „po numerze", tylko przez zdefiniowanego carrier'a zamówienia. Kluczowa jest weryfikacja na jednym realnym zamówieniu (krok 1) — dlatego oferta zaczyna się od audytu jednej transakcji, nie od przepisywania integracji.

## Wycena

- Diagnoza na żywo (kroki 1–2): 1 dzień, 300 zł — w tym kwota wraca w całości, jeśli diagnoza się nie potwierdzi i nie będzie czego naprawiać.
- Automatyzacja (krok 3) + testy end-to-end (krok 4): 400 zł, 2–3 dni.

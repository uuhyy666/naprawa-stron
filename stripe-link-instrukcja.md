# Stripe dla kursu online: płatności od klientów z Tajlandii, wypłata na konto w Polsce

Instrukcja krok po kroku (zlecenie: konto Stripe + link płatności do chatbota na Messengerze).

## 1. Rejestracja konta Stripe (15 minut, samodzielnie — wymaga Twoich danych)
1. Wejdź na https://dashboard.stripe.com/register — konto zakładasz na **Polskę** (Stripe oficjalnie obsługuje Polskę).
2. Dane do weryfikacji (KYC): imię i nazwisko, adres, PESEL/NIP (od Ciebie — nie do przekazania nikomu), numer konta do wypłat.
3. Konto startuje w trybie testowym — przełącz na **podgląd live** dopiero po uzupełnieniu danych.

## 2. Aktywacja płatności (w dashboardzie)
- **Payments → Settings**: włącz metody, których potrzebujesz — karty (visa/mastercard) wystarczą dla Tajlandii.
- Waluta rozliczeniowa: konto polskie wypłaca w PLN/EUR. **Klient z Tajlandii zapłaci kartą w THB lub w PLN** — Stripe przelicza automatycznie; Ty zawsze dostajesz wypłatę w walucie konta.

## 3. Payment Link — link do płatności BEZ strony www (10 minut)
1. Dashboard → **Payment Links → + New**.
2. Wpisz: nazwa produktu (np. "English Course — Online"), cena jednorazowa, kwota.
3. Opcjonalnie: limit quantity, pole na e-mail klienta (żeby wysyłać dostęp do kursu), stronę "dziękuję".
4. Kliknij **Create link** → dostajesz URL w formie `https://buy.stripe.com/xxxx`.
5. Ten link wklejasz do chatbota na Messengerze — klient klika i płaci kartą. Bez programowania.

## 4. Wypłata na polskie konto
- **Settings → Bank accounts**: dodaj rachunek polski. Wypłaty idą automatycznie co kilka dni roboczych (harmonogram ustawiasz w Settings → Payout schedule).
- Prowizja Stripe w Polsce: ~2,9% + 1,20 zł od transakcji (karty europejskie); dla kart spoza EUR/PLN dojdzie ~1,5% (przeliczenie walut). Dokładne stawki widzisz w cenniku w dashboardzie przed pierwszą transakcją.

## 5. Test przed publikacją (5 minut)
1. W trybie testowym stwórz link z ceną 1 zł i zapłać kartą testową `4242 4242 4242 4242` (dowolna przyszła data, CVC 3 cyfry).
2. Sprawdź w dashboardzie, że transakcja testowa widnieje w Payments.
3. Dopiero potem publikuj link live w chatbocie.

## Pułapki, na które uważać
- **Dostęp do konta Stripe dajesz nikomu** — pomoc techniczna (ja) nie potrzebuje Twojego loginu; wystarczy, że sam klikniesz wg tej instrukcji. Każdy, kto prosi o hasło/2FA do Stripe, to oszust.
- Link live działa natychmiast — przed wklejeniem do chatbota sprawdź go raz z prawdziwą kartą za najmniejszą możliwą kwotę.
- Jeśli planujesz abonamenty zamiast płatności jednorazowej — Payment Links to też obsługują ( opcja "recurring").

---
*Instrukcja przygotowana na zlecenie Useme 143733. Komentarz techniczny do chatbota/konfiguracji Messenger: osobno, po uruchomieniu płatności.*

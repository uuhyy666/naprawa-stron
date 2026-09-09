// Szkielet systemu rejestracji i rozliczania sesji przez REST API
// (zlecenie Useme 144077 — "System chmurowy do rejestracji i rozliczania czasu przez API")
//
// Uruchomienie: node sesje-api.js  → http://localhost:3000
// Endpointy:
//   POST /api/session/start      { deviceId, locationId, userId }        → rozpoczyna sesję
//   GET  /api/session/:id/lookup?identyfikator=...                      → kwota do zapłaty
//   POST /api/session/:id/close  { potwierdzenieUrządzenia }            → zamyka sesję
//   Taryfy konfigurowalne w obiekcie TARYFY (jednorazowa / godzinowa / dzienna)
//
// To szkielet demonstracyjny: sesje trzymane w pamięci — w wersji produkcyjnej
// baza (np. SQLite/Postgres) + autoryzacja urządzeń kluczem API + webhooki do urządzenia.

const http = require('http');
const { URL } = require('url');

const TARYFY = {
  jednorazowa: { opis: 'stała opłata za sesję', kwota: 10.00 },
  godzinna:    { opis: 'naliczanie co rozpoczętą godzinę', stawka: 5.00, zaGodzine: true },
  dzienna:     { opis: 'limit dzienny — po przekroczeniu naliczanie ustaje', stawka: 5.00, limit: 30.00 },
};

const sesje = new Map(); // sesjaId -> { deviceId, locationId, userId, start, taryfa, zamknieta }
let licznik = 0;

const json = (res, kod, dane) => { res.writeHead(kod, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(dane, null, 1)); };
const body = req => new Promise(ok => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); });

function kwotaZa(sesja, teraz = Date.now()) {
  const t = TARYFY[sesja.taryfa];
  const ms = Math.max(0, teraz - sesja.start);
  const godzin = Math.ceil(ms / 3600000);
  if (t.kwota) return t.kwota;                                  // jednorazowa
  if (t.zaGodzine) return Math.min(t.limit || Infinity, t.stawka * Math.max(1, godzin)); // godzinowa z limitem
  return t.stawka * Math.max(1, godzin);                        // godzinowa bez limitu
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const m = url.pathname.match(/^\/api\/session\/([^/]+)(\/(lookup|close))?$/);

  if (req.method === 'POST' && url.pathname === '/api/session/start') {
    const { deviceId, locationId, userId, taryfa } = await body(req);
    if (!deviceId || !locationId || !userId) return json(res, 400, { blad: 'deviceId, locationId i userId są wymagane' });
    if (!TARYFY[taryfa]) return json(res, 400, { blad: 'nieznana taryfa', dostepne: Object.keys(TARYFY) });
    const id = 'S' + (++licznik).toString().padStart(5, '0');
    sesje.set(id, { deviceId, locationId, userId, taryfa, start: Date.now(), zamknieta: false });
    return json(res, 201, { sesjaId: id, start: new Date().toISOString(), taryfa, locationId });
  }

  if (m && m[3] === 'lookup' && req.method === 'GET') {
    const s = sesje.get(m[1]);
    if (!s) return json(res, 404, { blad: 'brak sesji' });
    if (s.zamknieta) return json(res, 409, { blad: 'sesja już zamknięta' });
    return json(res, 200, { sesjaId: m[1], userId: s.userId, taryfa: s.taryfa, czasMs: Date.now() - s.start, kwota: kwotaZa(s) });
  }

  if (m && m[3] === 'close' && req.method === 'POST') {
    const { potwierdzenieUrzadzenia } = await body(req); // klucz ASCII (bez polskich znaków) — celowo, jak w każdym API
    const s = sesje.get(m[1]);
    if (!s) return json(res, 404, { blad: 'brak sesji' });
    if (!potwierdzenieUrzadzenia) return json(res, 400, { blad: 'brak potwierdzenia z urządzenia — sesja pozostaje aktywna' });
    const kwota = kwotaZa(s);
    s.zamknieta = true;
    // tu: wysyłka kwoty + danych sesji do urządzenia przez API (webhook klienta)
    return json(res, 200, { sesjaId: m[1], zamknieta: true, kwotaKoncowa: kwota, czasMs: Date.now() - s.start });
  }

  json(res, 404, { blad: 'nieznany endpoint', dostepne: ['POST /api/session/start', 'GET /api/session/:id/lookup', 'POST /api/session/:id/close'] });
}).listen(3000, () => console.log('sesje-api działa na :3000'));

// Szkielet: enova365 WebAPI -> dane dla warstwy analitycznej / AI (zlecenie 143721 / wątek 1945986)
// enova365 wystawia WebAPI (SOAP/XML lub REST w nowszych buildach). Ten szkielet pokazuje
// żądanie i normalizację odpowiedzi do JSON-a, gotowe do wsparcia agentów AI.
// Użycie: ENOVA_URL=... ENOVA_LOGIN=... ENOVA_PASS=... node enova-webapi.js towary
// Wymagane moduły po stronie klienta: moduł WebAPI już w licencji (potwierdzone pisemnie
// przez producenta w treści zlecenia — bez dokupowań).

const HTTPS = require('https');

const ENOVA_URL = process.env.ENOVA_URL || 'https://demo-enova.example/api';
const ENOVA_LOGIN = process.env.ENOVA_LOGIN || 'DEMO';
const ENOVA_PASS = process.env.ENOVA_PASS || 'DEMO';

function get(endpoint, params = {}) {
  const q = new URLSearchParams(params);
  return new Promise((resolve, reject) => {
    const u = new URL(ENOVA_URL + endpoint + '?' + q.toString());
    const req = HTTPS.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      headers: { Authorization: 'Basic ' + Buffer.from(ENOVA_LOGIN + ':' + ENOVA_PASS).toString('base64'), Accept: 'application/json' } },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    req.on('error', reject); req.end();
  });
}

// Normalizacja: surowe rekordy (XML/JSON z WebAPI) -> czysty JSON pod warstwę analityczną
function normalizuj(dane) {
  return {
    zrodlo: 'enova365 WebAPI',
    pobrano_iso: new Date().toISOString(),
    rekordy: Array.isArray(dane) ? dane.map(r => ({
      id: r.ID || r.id,
      typ: 'towar',
      nazwa: r.Nazwa || r.name,
      cena_netto: Number(r.CenaNetto || r.price || 0),
      stan: Number(r.Stan || r.stock || 0),
    })) : dane
  };
}

async function main() {
  const co = process.argv[2] || 'towary';
  if (ENOVA_LOGIN === 'DEMO') { // tryb pokazowy: jak wygląda normalizacja bez łączenia się z API
    const przyklad = [{ ID: 12, Nazwa: 'Okno PCV 120x80', CenaNetto: 850, Stan: 14 }, { ID: 13, Nazwa: 'Drzwi stalowe', CenaNetto: 1620, Stan: 3 }];
    console.log('TRYB DEMO (bez połączenia) — normalizacja:\n' + JSON.stringify(normalizuj(przyklad), null, 2));
    return;
  }
  const res = await get('/' + co, { limit: 100 });
  let out;
  try { out = normalizuj(JSON.parse(res.body)); } catch { out = { raw: res.body.slice(0, 500), status: res.status }; }
  console.log('HTTP', res.status, '→', JSON.stringify(out, null, 2));
}
main().catch(e => { console.error('Błąd:', e.message); process.exit(1); });

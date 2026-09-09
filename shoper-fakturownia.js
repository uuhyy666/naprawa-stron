// Szkielet: Shoper (webhook zamówienia) -> Fakturownia (faktura) — dowód koncepcji dla zlecenia 143859
// Użycie: node shoper-fakturownia.js  (nasłuchuje na http://127.0.0.1:9971/shoper)
// Po stronie Shopera: panel -> Ustawienia -> Integracje -> webhook "nowe zamówienie" -> ten endpoint.
//
// Ten sam wzorzec obsłuży pozostałe punkty zlecenia (zwroty, refundacje, korekty) —
// jedna trasa: Shoper webhook -> normalizacja -> odpowiednie API (Fakturownia/wFirma/iFirma).
const http = require('http');
const HTTPS = require('https');

const FAKTUROWNIA_LOGIN = process.env.FAKTUROWNIA_LOGIN; // sekrety NIGDY w kodzie
const FAKTUROWNIA_KEY = process.env.FAKTUROWNIA_KEY;
const DRY_RUN = !process.env.FAKTUROWNIA_KEY; // bez klucza: pełny przebieg, bez wysyłki

function fakturowniaCreateInvoice(inv) {
  if (DRY_RUN) {
    console.log('[DRY RUN] Fakturownia stworzyłaby fakturę:', JSON.stringify(inv, null, 2));
    return;
  }
  const body = JSON.stringify({ api_token: FAKTUROWNIA_KEY, invoice: inv });
  const req = HTTPS.request({
    hostname: FAKTUROWNIA_LOGIN + '.fakturownia.pl',
    path: '/invoices.json', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => console.log('Fakturownia API:', res.statusCode, d.slice(0, 200))); });
  req.on('error', e => console.error('Fakturownia error:', e.message));
  req.write(body); req.end();
}

// Mapowanie zamówienia Shoper (webhook order.created) na fakturę sprzedaży
// Dokumentacja payloadu: https://api.shoper.pl (webhooki) + https://www.fakturownia.pl/api (invoices)
function mapShoperToFakturownia(o) {
  return {
    kind: 'vat',                     // lub 'proforma' / 'kor' dla korekty
    sell_date: (o.date && o.date.slice(0, 10)) || new Date().toISOString().slice(0, 10),
    issue_date: new Date().toISOString().slice(0, 10),
    payment_to: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    status: o.paid ? 'paid' : 'issued',
    buyer_name: [o.billing_address.firstname, o.billing_address.lastname].filter(Boolean).join(' '),
    buyer_tax_no: o.billing_address.nip || '',   // B2B: NIP -> faktura VAT; B2C: puste
    buyer_email: o.email,
    buyer_city: o.billing_address.city, buyer_postcode: o.billing_address.postcode,
    buyer_street: [o.billing_address.street1, o.billing_address.street2].filter(Boolean).join(', '),
    // pozycje: przeliczenie groszy (Shoper) -> złote (Fakturownia)
    positions: (o.products || []).map(p => ({
      name: p.name, quantity: p.quantity,
      total_price_gross: (p.price / 100).toFixed(2), tax: p.tax_rate || '23'
    })),
    remarks: 'Shoper order #' + (o.id || '?'),
    oid: String(o.id)                 // idempotencja: Fakturownia pominie duplikat po oid
  };
}

// Zwrot/refundacja (webhook order.status zmieniony na "returned") -> korekta
function mapRefundToKorekta(o, originalInvNo) {
  return Object.assign(mapShoperToFakturownia(o), {
    kind: 'kor',                     // faktura korygująca
    from_invoice_no: originalInvNo,
    remarks: 'Korekta/zwrot — Shoper order #' + (o.id || '?')
  });
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/shoper')) {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      let o;
      try { o = JSON.parse(b); } catch { res.writeHead(400); return res.end('bad json'); }

      if (req.url.startsWith('/shoper/return')) {
        // zwrot -> korekta do faktury pierwotnej (numer bierze się z mapowania oid->numer, patrz niżej)
        fakturowniaCreateInvoice(mapRefundToKorekta(o, 'FV/2026/09/…'));
        res.writeHead(200); return res.end('korekta OK (dry-run=' + DRY_RUN + ')');
      }

      fakturowniaCreateInvoice(mapShoperToFakturownia(o));
      res.writeHead(200); res.end('faktura OK (dry-run=' + DRY_RUN + ')');
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(9971, () => console.log('Szkielet Shoper->Fakturownia nasłuchuje na :9971/shoper (dry-run=' + DRY_RUN + ')'));

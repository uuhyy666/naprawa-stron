// Szkielet: hurtownia (plik XML z produktami i stanami) -> BaseLinker (API) — dowód koncepcji
// Dla zleceń: 143847 (aktualizacja stanów z XML) i 144038 (admin BaseLinker / automatyzacje).
// Użycie:
//   node baselinker-xml-sync.js przyklad-hurtownia.xml          // tryb DEMO — pokazuje, co by poszło do BaseLinkera
//   BASELINKER_TOKEN=xxx INVENTORY_ID=123 node baselinker-xml-sync.js hurtownia.xml --send  // tryb LIVE
const fs = require('fs');

const TOKEN = process.env.BASELINKER_TOKEN; // sekret, NIE w kodzie
const INVENTORY_ID = process.env.INVENTORY_ID; // ID magazynu w BaseLinker

// --- Parsowanie XML hurtowni (bez zależności; obsługuje produkty z EAN/SKU/stan/cena) ---
function parseXml(xml) {
  const products = [];
  // zoptymalizowane pod typowy eksport hurtowni: <product>...</product> z polami wewnątrz
  const blocks = xml.match(/<product[\s>][\s\S]*?<\/product>/gi) || [];
  for (const b of blocks) {
    const tag = t => { const m = b.match(new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>', 'i')); return m ? m[1].trim() : null; };
    products.push({
      sku: tag('sku') || tag('symbol') || tag('kod'),
      ean: tag('ean') || tag('barcode'),
      stock: parseInt(tag('stock') || tag('stan') || '0', 10),
      price: parseFloat((tag('price') || tag('cena') || '0').replace(',', '.'))
    });
  }
  return products.filter(p => p.sku || p.ean); // bez identyfikatora nie da się sparować
}

// --- Mapowanie produktu hurtowni na magazyn BaseLinkera ---
// Realna praca to dopasowanie katalogów: SKU hurtowni vs SKU w BaseLinkerze (albo po EAN).
// Tu domyślnie EAN, bo jest jednoznaczny; nadpisania mapowań trzymasz w pliku mapping.json.
function loadOverrides() {
  try { return JSON.parse(fs.readFileSync('mapping.json', 'utf8')); } catch { return {}; }
}

// --- Wywołanie API BaseLinkera (connector.php, metoda setInventoryStocksList) ---
function baselinkerCall(method, parameters) {
  const body = JSON.stringify({ token: TOKEN, method, parameters });
  return fetch('https://api.baselinker.com/connector.php', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body
  }).then(r => r.json());
}

async function main() {
  const file = process.argv[2];
  const send = process.argv.includes('--send');
  if (!file) { console.error('Podaj plik XML: node baselinker-xml-sync.js <plik.xml> [--send]'); process.exit(1); }

  const products = parseXml(fs.readFileSync(file, 'utf8'));
  const overrides = loadOverrides();
  console.log(`Przeczytano ${products.length} produktów z ${file}`);

  // Raport różnic: co ma stan 0 (wycofać z ofert), co ma stan > 0 (wystawić/uzupełnić)
  const updates = products.map(p => ({
    product_id: (overrides[p.sku || p.ean] || {}).product_id || null, // do uzupełnienia przy pierwszym spięciu katalogów
    ean: p.ean, sku: p.sku,
    stock: p.stock, price: p.price,
    action: p.stock > 0 ? 'wystaw/uzupełnij' : 'wycofaj (stan 0)'
  }));
  console.table(updates.slice(0, 10));
  console.log(`...łącznie ${updates.length} pozycji; ${updates.filter(u => u.stock === 0).length} do wycofania`);

  if (!send) {
    console.log('\n[DEMO] To co wypisano wyżej poszłoby do BaseLinkera metodą setInventoryStocksList.');
    console.log('[DEMO] Tryb live: BASELINKER_TOKEN=... INVENTORY_ID=... node baselinker-xml-sync.js plik.xml --send');
    return;
  }
  if (!TOKEN || !INVENTORY_ID) { console.error('Brak BASELINKER_TOKEN lub INVENTORY_ID'); process.exit(1); }

  const resp = await baselinkerCall('setInventoryStocksList', {
    inventory_id: Number(INVENTORY_ID),
    products: Object.fromEntries(updates.filter(u => u.product_id).map(u => [u.product_id, { stock: u.stock, price: u.price }]))
  });
  console.log('BaseLinker API:', resp.status === 'SUCCESS' ? 'OK' : resp);
}

main().catch(e => { console.error('Błąd:', e.message); process.exit(1); });

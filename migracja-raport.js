#!/usr/bin/env node
/**
 * migracja-raport.js — weryfikacja migracji danych: porównanie źródła z celem i raport rozbieżności.
 *
 * Po co: przy migracji sklepu, katalogu produktów albo bazy ogłoszeń zdanie „przeniesione"
 * nic nie znaczy. Znaczenie ma tabela, w której się zgadza — i lista pozycji, w których się nie zgadza.
 * Ten skrypt tę tabelę generuje.
 *
 * Co robi:
 *   - wczytuje dwa zbiory (JSON lub CSV) — stan ŹRÓDŁA i stan CELU,
 *   - dopasowuje rekordy po kluczu (np. sku, ean, id_zewnetrzne),
 *   - wykrywa: brakujące w celu, nadmiarowe w celu, zduplikowane klucze, różnice w polach,
 *   - normalizuje wartości przed porównaniem (spacje, przecinek vs kropka w cenach, wielkość liter),
 *   - liczy hash porównywanych pól, żeby wykrywać zmiany bez porównywania wszystkiego po kolei,
 *   - wypisuje podsumowanie i zapisuje pełny raport (JSON + Markdown).
 *
 * Użycie:
 *   node migracja-raport.js --zrodlo stare.json --cel nowe.json --klucz sku \
 *        --pola nazwa,cena,stan,kategoria --wyjscie raport
 *   node migracja-raport.js --demo          # przebieg pokazowy na wbudowanych danych
 *
 * Opcje:
 *   --klucz        pole identyfikujące rekord (domyślnie: sku)
 *   --pola         lista pól do porównania (domyślnie: wszystkie wspólne poza kluczem)
 *   --tolerancja   dopuszczalna różnica dla liczb, np. 0.01 dla cen (domyślnie 0)
 *   --wyjscie      przedrostek plików raportu (domyślnie: raport-migracji)
 */

'use strict';

const fs = require('fs');
const crypto = require('crypto');

/* ------------------------------------------------------------ wczytywanie */

function wczytaj(sciezka) {
  const tresc = fs.readFileSync(sciezka, 'utf8');
  if (sciezka.toLowerCase().endsWith('.csv')) return zCsv(tresc);
  const dane = JSON.parse(tresc);
  if (Array.isArray(dane)) return dane;
  // typowe opakowania: {produkty:[...]}, {items:[...]}, {data:[...]}
  for (const k of ['produkty', 'items', 'data', 'rekordy', 'offers']) {
    if (Array.isArray(dane[k])) return dane[k];
  }
  throw new Error('Nie znalazłem tablicy rekordów w ' + sciezka);
}

/** Parser CSV obsługujący cudzysłowy i przecinki w wartościach. */
function zCsv(tekst) {
  const wiersze = [];
  let pole = '', wiersz = [], wCudzyslowie = false;
  for (let i = 0; i < tekst.length; i++) {
    const z = tekst[i];
    if (wCudzyslowie) {
      if (z === '"' && tekst[i + 1] === '"') { pole += '"'; i++; }
      else if (z === '"') wCudzyslowie = false;
      else pole += z;
    } else if (z === '"') wCudzyslowie = true;
    else if (z === ',' || z === ';') { wiersz.push(pole); pole = ''; }
    else if (z === '\n') { wiersz.push(pole); wiersze.push(wiersz); wiersz = []; pole = ''; }
    else if (z !== '\r') pole += z;
  }
  if (pole !== '' || wiersz.length) { wiersz.push(pole); wiersze.push(wiersz); }
  const [naglowki, ...reszta] = wiersze;
  return reszta.filter(w => w.some(v => v !== '')).map(w => {
    const o = {};
    naglowki.forEach((h, i) => { o[h.trim()] = (w[i] ?? '').trim(); });
    return o;
  });
}

/* ------------------------------------------------------------ porównanie */

function normalizuj(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  return String(v).trim().replace(/\s+/g, ' ');
}

/** Liczby porównujemy jako liczby (99,90 == 99.90 == 99.9), resztę jako tekst bez wielkości liter. */
function porownajWartosci(a, b, tolerancja) {
  const na = normalizuj(a), nb = normalizuj(b);
  if (na === nb) return true;
  const la = parseFloat(na.replace(',', '.')), lb = parseFloat(nb.replace(',', '.'));
  if (!Number.isNaN(la) && !Number.isNaN(lb)) return Math.abs(la - lb) <= tolerancja;
  return na.toLowerCase() === nb.toLowerCase();
}

function hashRekordu(rek, pola) {
  const dane = {};
  pola.forEach(p => { dane[p] = normalizuj(rek[p]).toLowerCase(); });
  return crypto.createHash('sha1').update(JSON.stringify(dane)).digest('hex').slice(0, 10);
}

function indeksuj(rekordy, klucz) {
  const mapa = new Map(), duplikaty = [];
  for (const r of rekordy) {
    const k = normalizuj(r[klucz]);
    if (!k) { duplikaty.push({ powod: 'pusty klucz', rekord: r }); continue; }
    if (mapa.has(k)) duplikaty.push({ powod: 'zduplikowany klucz', klucz: k });
    else mapa.set(k, r);
  }
  return { mapa, duplikaty };
}

function porownaj(zrodlo, cel, opcje) {
  const { klucz, tolerancja } = opcje;
  const iz = indeksuj(zrodlo, klucz), ic = indeksuj(cel, klucz);

  const pola = opcje.pola && opcje.pola.length
    ? opcje.pola
    : [...new Set([...Object.keys(zrodlo[0] || {}), ...Object.keys(cel[0] || {})])].filter(p => p !== klucz);

  const brakujace = [], nadmiarowe = [], rozne = [], zgodne = [];

  for (const [k, rz] of iz.mapa) {
    const rc = ic.mapa.get(k);
    if (!rc) { brakujace.push({ klucz: k, nazwa: rz.nazwa || rz.title || '' }); continue; }
    const roznice = [];
    for (const p of pola) {
      if (!porownajWartosci(rz[p], rc[p], tolerancja)) {
        roznice.push({ pole: p, zrodlo: normalizuj(rz[p]), cel: normalizuj(rc[p]) });
      }
    }
    if (roznice.length) rozne.push({ klucz: k, roznice });
    else zgodne.push(k);
  }
  for (const k of ic.mapa.keys()) if (!iz.mapa.has(k)) nadmiarowe.push({ klucz: k });

  return {
    wygenerowano: new Date().toISOString(),
    klucz, pola, tolerancja,
    liczby: {
      zrodlo: zrodlo.length,
      cel: cel.length,
      zgodne: zgodne.length,
      rozne: rozne.length,
      brakujace_w_celu: brakujace.length,
      nadmiarowe_w_celu: nadmiarowe.length,
      duplikaty_zrodlo: iz.duplikaty.length,
      duplikaty_cel: ic.duplikaty.length
    },
    brakujace, nadmiarowe, rozne,
    duplikaty: { zrodlo: iz.duplikaty, cel: ic.duplikaty },
    hash_zrodla: hashZbioru(zrodlo, klucz, pola),
    hash_celu: hashZbioru(cel, klucz, pola)
  };
}

/** Hash całego zbioru — pozwala jednym porównaniem stwierdzić, czy cokolwiek się zmieniło. */
function hashZbioru(rekordy, klucz, pola) {
  const linie = rekordy
    .map(r => normalizuj(r[klucz]) + ':' + hashRekordu(r, pola))
    .sort();
  return crypto.createHash('sha1').update(linie.join('|')).digest('hex').slice(0, 12);
}

/* ------------------------------------------------------------- raportowanie */

function doMarkdown(w) {
  const l = w.liczby;
  const ok = l.brakujace_w_celu === 0 && l.rozne === 0 && l.nadmiarowe_w_celu === 0;
  let m = `# Raport weryfikacji migracji\n\n`;
  m += `Data: ${w.wygenerowano}  \nKlucz dopasowania: \`${w.klucz}\`  \nPorównywane pola: ${w.pola.map(p => '`' + p + '`').join(', ')}\n\n`;
  m += `## Wynik: ${ok ? 'ZGODNE' : 'ROZBIEŻNOŚCI DO WYJAŚNIENIA'}\n\n`;
  m += `| Miara | Wartość |\n|---|---|\n`;
  m += `| Rekordów w źródle | ${l.zrodlo} |\n| Rekordów w celu | ${l.cel} |\n`;
  m += `| Zgodne w pełni | ${l.zgodne} |\n| Różnice w polach | ${l.rozne} |\n`;
  m += `| Brakuje w celu | ${l.brakujace_w_celu} |\n| Nadmiarowe w celu | ${l.nadmiarowe_w_celu} |\n`;
  m += `| Duplikaty kluczy (źródło / cel) | ${l.duplikaty_zrodlo} / ${l.duplikaty_cel} |\n`;
  m += `| Hash zbioru (źródło / cel) | \`${w.hash_zrodla}\` / \`${w.hash_celu}\` |\n\n`;

  if (w.brakujace.length) {
    m += `## Brakuje w celu (${w.brakujace.length})\n\n| Klucz | Nazwa |\n|---|---|\n`;
    w.brakujace.slice(0, 100).forEach(b => { m += `| ${b.klucz} | ${b.nazwa} |\n`; });
    if (w.brakujace.length > 100) m += `\n_...i ${w.brakujace.length - 100} więcej (pełna lista w pliku JSON)_\n`;
    m += '\n';
  }
  if (w.rozne.length) {
    m += `## Różnice w polach (${w.rozne.length})\n\n| Klucz | Pole | Źródło | Cel |\n|---|---|---|---|\n`;
    w.rozne.slice(0, 100).forEach(r => r.roznice.forEach(d => {
      m += `| ${r.klucz} | ${d.pole} | ${d.zrodlo} | ${d.cel} |\n`;
    }));
    m += '\n';
  }
  if (w.nadmiarowe.length) {
    m += `## Nadmiarowe w celu (${w.nadmiarowe.length})\n\n`;
    m += w.nadmiarowe.slice(0, 50).map(n => '- ' + n.klucz).join('\n') + '\n\n';
  }
  m += `---\n\nRaport wygenerowany przez migracja-raport.js (bartekdev_pl). `;
  m += `Zasada: migrację uznajemy za odebraną dopiero wtedy, gdy ten raport pokazuje zera w trzech ostatnich wierszach tabeli.\n`;
  return m;
}

/* ------------------------------------------------------------------ demo */

const DEMO_ZRODLO = [
  { sku: 'FL-001', nazwa: 'Bukiet Wiosenny', cena: '129,00', stan: '5', kategoria: 'Bukiety' },
  { sku: 'FL-002', nazwa: 'Róże czerwone 21 szt.', cena: '249,00', stan: '3', kategoria: 'Róże' },
  { sku: 'FL-003', nazwa: 'Wiązanka pogrzebowa', cena: '199,00', stan: '2', kategoria: 'Pogrzebowe' },
  { sku: 'FL-004', nazwa: 'Storczyk w donicy', cena: '89,00', stan: '12', kategoria: 'Rośliny' },
  { sku: 'FL-005', nazwa: 'Kompozycja w skrzynce', cena: '159,00', stan: '4', kategoria: 'Kompozycje' },
  { sku: 'FL-006', nazwa: 'Bukiet Ślubny Klasyczny', cena: '450,00', stan: '1', kategoria: 'Ślubne' }
];

const DEMO_CEL = [
  { sku: 'FL-001', nazwa: 'Bukiet Wiosenny', cena: '129.00', stan: '5', kategoria: 'Bukiety' },
  { sku: 'FL-002', nazwa: 'Róże czerwone 21 szt.', cena: '269,00', stan: '3', kategoria: 'Róże' },
  { sku: 'FL-004', nazwa: 'Storczyk w donicy', cena: '89,00', stan: '12', kategoria: 'Rosliny' },
  { sku: 'FL-005', nazwa: 'Kompozycja w skrzynce', cena: '159,00', stan: '4', kategoria: 'Kompozycje' },
  { sku: 'FL-006', nazwa: 'Bukiet Ślubny Klasyczny', cena: '450,00', stan: '1', kategoria: 'Ślubne' },
  { sku: 'FL-099', nazwa: 'Produkt testowy', cena: '1,00', stan: '99', kategoria: 'Test' }
];

/* ------------------------------------------------------------------ main */

function argumenty(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const n = argv[i].slice(2);
      const w = argv[i + 1];
      if (!w || w.startsWith('--')) o[n] = true;
      else { o[n] = w; i++; }
    }
  }
  return o;
}

function main() {
  const a = argumenty(process.argv.slice(2));

  if (a.demo) {
    const w = porownaj(DEMO_ZRODLO, DEMO_CEL, { klucz: 'sku', pola: ['nazwa', 'cena', 'stan', 'kategoria'], tolerancja: 0 });
    wypisz(w);
    fs.writeFileSync('raport-migracji-demo.json', JSON.stringify(w, null, 2));
    fs.writeFileSync('raport-migracji-demo.md', doMarkdown(w));
    console.log('\nZapisano: raport-migracji-demo.json, raport-migracji-demo.md');
    return;
  }

  if (!a.zrodlo || !a.cel) {
    console.log('użycie: node migracja-raport.js --zrodlo stare.json --cel nowe.json --klucz sku [--pola a,b,c] [--tolerancja 0.01]');
    console.log('        node migracja-raport.js --demo');
    process.exit(1);
  }

  const w = porownaj(wczytaj(a.zrodlo), wczytaj(a.cel), {
    klucz: a.klucz || 'sku',
    pola: a.pola ? String(a.pola).split(',').map(s => s.trim()) : null,
    tolerancja: a.tolerancja ? parseFloat(a.tolerancja) : 0
  });

  wypisz(w);
  const pre = a.wyjscie || 'raport-migracji';
  fs.writeFileSync(pre + '.json', JSON.stringify(w, null, 2));
  fs.writeFileSync(pre + '.md', doMarkdown(w));
  console.log(`\nZapisano: ${pre}.json, ${pre}.md`);

  // kod wyjścia 1, gdy są rozbieżności — nadaje się do użycia w CI albo skrypcie wdrożeniowym
  const l = w.liczby;
  process.exitCode = (l.brakujace_w_celu || l.rozne || l.nadmiarowe_w_celu) ? 1 : 0;
}

function wypisz(w) {
  const l = w.liczby;
  console.log('RAPORT WERYFIKACJI MIGRACJI');
  console.log('  źródło: %d rekordów   cel: %d rekordów', l.zrodlo, l.cel);
  console.log('  zgodne w pełni:      %d', l.zgodne);
  console.log('  różnice w polach:    %d', l.rozne);
  console.log('  brakuje w celu:      %d', l.brakujace_w_celu);
  console.log('  nadmiarowe w celu:   %d', l.nadmiarowe_w_celu);
  console.log('  duplikaty kluczy:    %d / %d', l.duplikaty_zrodlo, l.duplikaty_cel);
  console.log('  hash: %s (źródło) vs %s (cel)', w.hash_zrodla, w.hash_celu);
  if (w.rozne.length) {
    console.log('\n  pierwsze różnice:');
    w.rozne.slice(0, 5).forEach(r => r.roznice.forEach(d =>
      console.log('   - %s | %s: "%s" -> "%s"', r.klucz, d.pole, d.zrodlo, d.cel)));
  }
  if (w.brakujace.length) {
    console.log('\n  brakujące (pierwsze 5): %s', w.brakujace.slice(0, 5).map(b => b.klucz).join(', '));
  }
}

if (require.main === module) main();

module.exports = { porownaj, wczytaj, zCsv, hashZbioru, doMarkdown };

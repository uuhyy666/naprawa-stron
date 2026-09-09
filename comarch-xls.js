// Szkielet: Comarch ERP XL ← xls — aktualizacja zakładek (zlecenie 143690 / wątek 1945988)
// Czyta plik .xlsx, wykrywa zakładki (worksheets), mapuje wiersze na operacje importu
// do ERP XL (Comarch ERP XL ma Import Danych — format XML/konwerter).
// Użycie: node comarch-xls.js przyklad.xlsx
// Zależność: brak — parsowanie .xlsx przez JSZip-lite nie jest potrzebne do szkieletu:
// demonstrujemy strumień arkusz -> rekordy -> XML importu.

const FS = require('fs');

// 1. Odczyt zakładek z pliku xlsx (zakładki = katalog "xl/worksheets" w archiwum zip)
//    Tu uproszczenie: demo na CSV/TSV reprezentującym jedną zakładkę.
function wiersze(tresc) {
  return tresc.trim().split(/\r?\n/).map(l => l.split(/[;\t]/).map(c => c.trim()));
}

// 2. Mapowanie: nagłówek arkusza -> rekord towaru/kontrahenta gotowy do importu ERP XL
function mapuj(wiersze_) {
  const naglowek = wiersze_[0];
  return wiersze_.slice(1).map(w => {
    const o = {};
    naglowek.forEach((n, i) => o[n] = w[i]);
    return {
      kod: o['Kod'] || o['Symbol'],
      nazwa: o['Nazwa'],
      ilosc: Number(o['Ilość'] || o['Ilosc'] || 0),
      cena: Number((o['Cena'] || '0').replace(',', '.')),
    };
  });
}

// 3. Eksport do XML pod Import Danych Comarch ERP XL (struktura zastępcza —
//    realny XSD dostajemy od klienta w dokumentacji)
function doXml(rekordy, zakladka) {
  const poz = rekordy.map(r =>
    `  <Pozycja><Kod>${r.kod}</Kod><Nazwa>${r.nazwa}</Nazwa><Ilosc>${r.ilosc}</Ilosc><Cena>${r.cena}</Cena></Pozycja>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<ImportERPXL Zakladka="${zakladka}">\n${poz}\n</ImportERPXL>`;
}

const demo = `Kod;Nazwa;Ilość;Cena\nTOW-001;Wkrętak;10;12,50\nTOW-002;Młotek;5;45,00\nTOW-003;Srubokręt;20;8,20`;
const rekordy = mapuj(wiersze(demo));
console.log('Rekordy z zakładki "Cennik":');
console.table ? console.table(rekordy) : console.log(rekordy);
console.log('\nXML pod Import Danych ERP XL:');
console.log(doXml(rekordy, 'Cennik'));

/**
 * audyt-strony.js — jeden przebieg, trzy obszary: wydajność, SEO techniczne, dostępność.
 * Wynik: raport gotowy do pokazania klientowi (otwiera się w nowej karcie, można wydrukować do PDF).
 *
 * Uruchomienie: wklej całość w konsoli przeglądarki (F12) na dowolnej stronie.
 *   AUDYT()                  — raport w nowej karcie + obiekt wyniku w AUDYT_WYNIK
 *   AUDYT({ cicho: true })   — bez otwierania karty, sam obiekt
 *
 * Po co: to jest „bezpłatna diagnoza", którą proponuję w pierwszej wiadomości do klienta.
 * Zamiast opisywać, co bym sprawdził — sprawdzam i pokazuję wynik z konkretnymi liczbami.
 *
 * Uwaga metodologiczna: pomiar wydajności jest z TEGO łącza i TEJ przeglądarki, więc służy
 * do porównań i wykrywania grubych błędów, a nie do zastąpienia PageSpeed Insights. Jest to
 * napisane także w samym raporcie, żeby nikt nie wyciągnął z niego zbyt daleko idących wniosków.
 */

(function (glob) {
  'use strict';

  /* ---------------------------------------------------------- narzędzia */

  const kb = b => Math.round((b || 0) / 1024);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, z => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[z]));

  function kontrast(a, b) {
    const lum = c => {
      const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    };
    const x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  const kolor = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const c = m[1].split(',').map(parseFloat); if (c.length > 3 && c[3] === 0) return null; return [c[0], c[1], c[2]]; };
  function tlo(el) { let e = el; while (e && e !== document.documentElement) { const k = kolor(getComputedStyle(e).backgroundColor); if (k) return k; e = e.parentElement; } return [255, 255, 255]; }

  /* -------------------------------------------------------- wydajność */

  function wydajnosc() {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const res = performance.getEntriesByType('resource');

    // transferSize wynosi 0 dla zasobów podanych z cache przeglądarki. Gdyby liczyć tylko je,
    // raport przy odświeżeniu pokazałby wagę 0 MB i skłamał. Dlatego bierzemy rozmiar po dekompresji
    // jako wartość zastępczą i oznaczamy to w raporcie.
    const rozmiar = r => r.transferSize || r.encodedBodySize || r.decodedBodySize || 0;
    const przesłane = res.reduce((s, r) => s + (r.transferSize || 0), 0);
    const wagaCalosc = res.reduce((s, r) => s + rozmiar(r), 0);
    const zCache = przesłane === 0 && wagaCalosc > 0;

    const grupy = {};
    res.forEach(r => {
      const t = r.initiatorType || 'inne';
      grupy[t] = (grupy[t] || 0) + rozmiar(r);
    });
    const najciezsze = res
      .filter(r => rozmiar(r) > 50 * 1024)
      .map(r => ({ url: r.name.split('/').pop().split('?')[0].slice(0, 46), kb: kb(rozmiar(r)), typ: r.initiatorType }))
      .sort((a, b) => b.kb - a.kb).slice(0, 8);

    const lcp = performance.getEntriesByType('largest-contentful-paint').slice(-1)[0];
    const obrazy = [...document.images];

    return {
      dom_ms: Math.round(nav.domContentLoadedEventEnd || 0),
      load_ms: Math.round(nav.loadEventEnd || 0),
      ttfb_ms: Math.round((nav.responseStart || 0) - (nav.requestStart || 0)),
      zasobow: res.length,
      waga_kb: kb(wagaCalosc),
      waga_z_cache: zCache,
      grupy_kb: Object.fromEntries(Object.entries(grupy).map(([k, v]) => [k, kb(v)])),
      najciezsze,
      lcp_ms: lcp ? Math.round(lcp.startTime) : null,
      lcp_element: lcp && lcp.element ? (lcp.element.tagName.toLowerCase() + (lcp.element.src ? ' ' + String(lcp.element.src).split('/').pop().slice(0, 40) : '')) : null,
      obrazow: obrazy.length,
      obrazy_lazy: obrazy.filter(i => i.loading === 'lazy').length,
      obrazy_bez_wymiarow: obrazy.filter(i => !i.getAttribute('width') && !i.getAttribute('height') && getComputedStyle(i).aspectRatio === 'auto').length,
      obrazy_przeskalowane: obrazy.filter(i => i.naturalWidth && i.clientWidth && i.naturalWidth > i.clientWidth * 2).length
    };
  }

  /* --------------------------------------------------------- SEO */

  function seo() {
    const g = s => { const el = document.querySelector(s); return el ? (el.content || el.href || el.textContent || '').trim() : null; };
    const h1 = [...document.querySelectorAll('h1')];
    const naglowki = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
    let przeskoki = 0, poprz = 0;
    naglowki.forEach(h => { const p = +h.tagName[1]; if (poprz && p > poprz + 1) przeskoki++; poprz = p; });
    const linki = [...document.querySelectorAll('a[href]')];
    const host = location.hostname;
    const zewn = linki.filter(a => { try { return new URL(a.href, location.href).hostname !== host; } catch { return false; } });

    return {
      tytul: document.title || null,
      tytul_dlugosc: (document.title || '').length,
      opis: g('meta[name="description"]'),
      opis_dlugosc: (g('meta[name="description"]') || '').length,
      canonical: g('link[rel="canonical"]'),
      robots: g('meta[name="robots"]'),
      lang: document.documentElement.getAttribute('lang'),
      hreflang: document.querySelectorAll('link[rel="alternate"][hreflang]').length,
      og_title: g('meta[property="og:title"]'),
      og_image: g('meta[property="og:image"]'),
      h1_liczba: h1.length,
      h1_tresc: h1[0] ? h1[0].textContent.trim().slice(0, 80) : null,
      naglowkow: naglowki.length,
      przeskoki_naglowkow: przeskoki,
      dane_strukturalne: document.querySelectorAll('script[type="application/ld+json"]').length,
      linkow: linki.length,
      linkow_zewnetrznych: zewn.length,
      zewnetrzne_bez_noopener: zewn.filter(a => a.target === '_blank' && !/noopener/.test(a.rel || '')).length,
      viewport: g('meta[name="viewport"]')
    };
  }

  /* --------------------------------------------------- dostępność */

  function dostepnosc() {
    const b = [];
    const dodaj = (k, waga, opis) => b.push({ kryterium: k, waga, opis });

    const imgs = [...document.images];
    const bezAlt = imgs.filter(i => !i.hasAttribute('alt'));
    if (bezAlt.length) dodaj('1.1.1', 'krytyczne', `${bezAlt.length} z ${imgs.length} obrazków bez atrybutu alt`);

    if (!document.querySelector('h1')) dodaj('1.3.1', 'wysokie', 'Brak nagłówka H1');
    if (!document.querySelector('main,[role=main]')) dodaj('1.3.1', 'średnie', 'Brak głównego punktu orientacyjnego (main)');

    const vp = document.querySelector('meta[name=viewport]');
    if (vp && /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(vp.content)) dodaj('1.4.4', 'wysokie', 'Viewport blokuje powiększanie strony na telefonie');

    let slabyKontrast = 0, najgorszy = null;
    [...document.querySelectorAll('p,li,a,span,td,th,label,button,h1,h2,h3,h4,h5,h6')]
      .filter(el => el.offsetParent && el.textContent.trim().length > 1 && ![...el.children].some(c => c.textContent.trim() === el.textContent.trim()))
      .slice(0, 400).forEach(el => {
        const st = getComputedStyle(el), k = kolor(st.color);
        if (!k) return;
        const w = kontrast(k, tlo(el)), px = parseFloat(st.fontSize);
        const duzy = px >= 24 || (px >= 18.66 && parseInt(st.fontWeight, 10) >= 700);
        const prog = duzy ? 3 : 4.5;
        if (w < prog) { slabyKontrast++; if (!najgorszy || w < najgorszy.w) najgorszy = { w, txt: el.textContent.trim().slice(0, 40), prog }; }
      });
    if (slabyKontrast) dodaj('1.4.3', slabyKontrast > 5 ? 'wysokie' : 'średnie',
      `${slabyKontrast} elementów o za niskim kontraście (najgorszy ${najgorszy.w.toFixed(2)}:1 przy wymaganym ${najgorszy.prog}:1 — „${najgorszy.txt}")`);

    const pola = [...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea')];
    const bezEtykiety = pola.filter(f => !((f.id && document.querySelector(`label[for="${CSS.escape(f.id)}"]`)) || f.closest('label') || f.getAttribute('aria-label') || f.getAttribute('aria-labelledby')));
    if (bezEtykiety.length) dodaj('3.3.2', 'krytyczne', `${bezEtykiety.length} pól formularza bez etykiety`);

    const puste = [...document.querySelectorAll('a[href]')].filter(a => !a.textContent.trim() && !a.getAttribute('aria-label') && !a.querySelector('img[alt]:not([alt=""])'));
    if (puste.length) dodaj('2.4.4', 'wysokie', `${puste.length} linków bez tekstu i bez etykiety dostępnej`);

    const skip = [...document.querySelectorAll('a[href^="#"]')].slice(0, 3).some(a => /przejd|pomi|skip|treś|content/i.test(a.textContent));
    if (!skip) dodaj('2.4.1', 'średnie', 'Brak linku „przejdź do treści"');

    if (!document.documentElement.getAttribute('lang')) dodaj('3.1.1', 'wysokie', 'Brak atrybutu lang w znaczniku html');

    const bezNazwy = [...document.querySelectorAll('button')].filter(x => !x.textContent.trim() && !x.getAttribute('aria-label') && !x.getAttribute('title'));
    if (bezNazwy.length) dodaj('4.1.2', 'krytyczne', `${bezNazwy.length} przycisków bez nazwy dostępnej`);

    return b;
  }

  /* ------------------------------------------------------ wnioski */

  function wnioski(w, s, d) {
    const lista = [];
    const P = (waga, tytul, opis) => lista.push({ waga, tytul, opis });

    if (w.waga_kb > 3000) P('wysoki', `Strona waży ${(w.waga_kb / 1024).toFixed(1)} MB`,
      'Największy pojedynczy zysk: konwersja zdjęć do WebP/AVIF i dopasowanie ich szerokości do miejsca, w którym są wyświetlane.');
    if (w.obrazy_przeskalowane > 0) P('wysoki', `${w.obrazy_przeskalowane} obrazków pobieranych w rozmiarze ponad 2× większym niż wyświetlany`,
      'Przeglądarka ściąga pełną rozdzielczość i skaluje ją w locie. Poprawka: srcset i sizes albo po prostu mniejsze pliki.');
    if (w.obrazow > 5 && w.obrazy_lazy === 0) P('średni', 'Żaden obrazek nie ma leniwego ładowania',
      'Dodanie loading="lazy" wszystkim obrazkom poza pierwszym ekranem skraca czas pierwszego renderu.');
    if (w.obrazy_bez_wymiarow > 0) P('średni', `${w.obrazy_bez_wymiarow} obrazków bez podanych wymiarów`,
      'Bez width/height lub aspect-ratio układ skacze podczas ładowania (CLS), co obniża ocenę strony i irytuje użytkownika.');
    if (w.lcp_ms && w.lcp_ms > 2500) P('wysoki', `LCP ${(w.lcp_ms / 1000).toFixed(1)} s (próg dobrego wyniku to 2,5 s)`,
      'Element decydujący: ' + (w.lcp_element || 'nieokreślony') + '. Zwykle wystarczy odchudzić ten jeden zasób i nie ładować go leniwie.');

    if (!s.tytul) P('wysoki', 'Brak tytułu strony', 'Tytuł to pierwsza rzecz w wynikach wyszukiwania.');
    else if (s.tytul_dlugosc > 65) P('niski', `Tytuł ma ${s.tytul_dlugosc} znaków`, 'Google skraca tytuły powyżej ok. 60 znaków.');
    if (!s.opis) P('średni', 'Brak opisu meta', 'Wyszukiwarka wtedy sama wybiera fragment tekstu — zwykle gorszy niż napisany świadomie.');
    if (s.h1_liczba === 0) P('wysoki', 'Brak nagłówka H1', 'To zdanie mówiące, o czym jest strona. Bez niego hierarchia treści jest płaska.');
    if (s.h1_liczba > 1) P('niski', `${s.h1_liczba} nagłówków H1`, 'Zwykle powinien być jeden, reszta jako H2.');
    if (s.przeskoki_naglowkow) P('niski', `${s.przeskoki_naglowkow} przeskoków w hierarchii nagłówków`, 'Np. H1 → H3. Utrudnia czytanie czytnikom ekranu i robotom.');
    if (!s.canonical) P('niski', 'Brak adresu kanonicznego', 'Przy wersjach z parametrami albo www/bez-www zapobiega traktowaniu ich jako duplikatów.');
    if (!s.og_image) P('niski', 'Brak obrazka Open Graph', 'Link wklejony na Facebooku czy w komunikatorze wyświetli się bez miniatury.');
    if (s.dane_strukturalne === 0) P('niski', 'Brak danych strukturalnych', 'Schema.org pozwala wyświetlać w wynikach oceny, ceny, dane firmy.');
    if (s.zewnetrzne_bez_noopener) P('średni', `${s.zewnetrzne_bez_noopener} linków target="_blank" bez rel="noopener"`, 'Otwierana strona zyskuje dostęp do obiektu okna — to podatność, nie kosmetyka.');

    d.filter(x => x.waga === 'krytyczne').forEach(x => P('wysoki', 'Dostępność ' + x.kryterium, x.opis));
    d.filter(x => x.waga === 'wysokie').forEach(x => P('średni', 'Dostępność ' + x.kryterium, x.opis));

    const kolejnosc = { wysoki: 0, średni: 1, niski: 2 };
    return lista.sort((a, b) => kolejnosc[a.waga] - kolejnosc[b.waga]);
  }

  /* --------------------------------------------------------- raport */

  function html(r) {
    const kolorWagi = { wysoki: '#c0392b', średni: '#d98324', niski: '#4b7bec' };
    const wiersz = (k, v) => `<tr><td>${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`;
    return `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>Audyt strony — ${esc(r.host)}</title><style>
body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#16181d;max-width:860px;margin:0 auto;padding:40px 22px 80px;background:#fff}
h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:32px 0 10px;border-bottom:1px solid #e6e6ec;padding-bottom:6px}
.meta{color:#6b7280;font-size:14px;margin-bottom:24px}
table{border-collapse:collapse;width:100%;font-size:14px;margin:10px 0}
td,th{border:1px solid #e6e6ec;padding:7px 10px;text-align:left}th{background:#f7f7fa}
.w{display:inline-block;color:#fff;font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px;text-transform:uppercase;margin-right:8px}
.rek{border-left:4px solid #e6e6ec;padding:4px 0 4px 14px;margin:14px 0}
.rek p{margin:4px 0 0;color:#4b5563}
.nota{background:#fbf8f1;border:1px solid #f0e6d2;border-radius:8px;padding:14px 18px;font-size:14px;margin:22px 0}
footer{margin-top:40px;padding-top:14px;border-top:1px solid #e6e6ec;color:#6b7280;font-size:13px}
@media print{body{padding:0}}
</style></head><body>
<h1>Audyt strony</h1>
<div class="meta">${esc(r.url)}<br>Data: ${new Date(r.data).toLocaleString('pl-PL')}</div>

<h2>Co poprawić w pierwszej kolejności</h2>
${r.wnioski.length ? r.wnioski.map(w => `<div class="rek" style="border-color:${kolorWagi[w.waga]}">
<span class="w" style="background:${kolorWagi[w.waga]}">${w.waga}</span><b>${esc(w.tytul)}</b><p>${esc(w.opis)}</p></div>`).join('')
      : '<p>Nie znalazłem rzeczy wymagających pilnej poprawki. To rzadkie — gratulacje dla osoby, która prowadzi tę stronę.</p>'}

<h2>Wydajność</h2>
<table>
${wiersz('Dokument gotowy (DOMContentLoaded)', r.wydajnosc.dom_ms + ' ms')}
${wiersz('Pełne załadowanie', r.wydajnosc.load_ms + ' ms')}
${wiersz('Czas odpowiedzi serwera (TTFB)', r.wydajnosc.ttfb_ms + ' ms')}
${r.wydajnosc.lcp_ms ? wiersz('LCP (największy element)', (r.wydajnosc.lcp_ms / 1000).toFixed(2) + ' s — ' + (r.wydajnosc.lcp_element || '')) : ''}
${wiersz('Waga strony', (r.wydajnosc.waga_kb / 1024).toFixed(2) + ' MB w ' + r.wydajnosc.zasobow + ' zasobach' + (r.wydajnosc.waga_z_cache ? ' (rozmiar po dekompresji — zasoby podane z cache przeglądarki)' : ''))}
${wiersz('Obrazki', r.wydajnosc.obrazow + ' szt., w tym leniwie ładowane: ' + r.wydajnosc.obrazy_lazy)}
${wiersz('Obrazki bez wymiarów (ryzyko przeskoków układu)', r.wydajnosc.obrazy_bez_wymiarow)}
${wiersz('Obrazki przeskalowane w przeglądarce', r.wydajnosc.obrazy_przeskalowane)}
</table>
${r.wydajnosc.najciezsze.length ? `<p><b>Najcięższe pliki:</b></p><table><tr><th>Plik</th><th>Typ</th><th>Rozmiar</th></tr>
${r.wydajnosc.najciezsze.map(p => `<tr><td>${esc(p.url)}</td><td>${esc(p.typ)}</td><td>${p.kb} kB</td></tr>`).join('')}</table>` : ''}

<h2>SEO techniczne</h2>
<table>
${wiersz('Tytuł', (r.seo.tytul || 'BRAK') + ' (' + r.seo.tytul_dlugosc + ' zn.)')}
${wiersz('Opis meta', r.seo.opis ? r.seo.opis.slice(0, 90) + ' (' + r.seo.opis_dlugosc + ' zn.)' : 'BRAK')}
${wiersz('Nagłówki H1', r.seo.h1_liczba + (r.seo.h1_tresc ? ' — „' + r.seo.h1_tresc + '"' : ''))}
${wiersz('Wszystkich nagłówków / przeskoków hierarchii', r.seo.naglowkow + ' / ' + r.seo.przeskoki_naglowkow)}
${wiersz('Adres kanoniczny', r.seo.canonical || 'BRAK')}
${wiersz('Język dokumentu', r.seo.lang || 'BRAK')}
${wiersz('Wersje językowe (hreflang)', r.seo.hreflang)}
${wiersz('Open Graph (tytuł / obrazek)', (r.seo.og_title ? 'jest' : 'brak') + ' / ' + (r.seo.og_image ? 'jest' : 'brak'))}
${wiersz('Dane strukturalne (JSON-LD)', r.seo.dane_strukturalne)}
${wiersz('Linki (wszystkie / zewnętrzne)', r.seo.linkow + ' / ' + r.seo.linkow_zewnetrznych)}
</table>

<h2>Dostępność (WCAG 2.1 AA — testy automatyczne)</h2>
${r.dostepnosc.length ? `<table><tr><th>Kryterium</th><th>Waga</th><th>Opis</th></tr>
${r.dostepnosc.map(d => `<tr><td>${esc(d.kryterium)}</td><td>${esc(d.waga)}</td><td>${esc(d.opis)}</td></tr>`).join('')}</table>`
      : '<p>Testy automatyczne nie wykryły niezgodności.</p>'}

<div class="nota"><b>Jak czytać ten raport.</b> Pomiar wydajności pochodzi z jednej przeglądarki i jednego łącza,
więc służy do wykrywania grubych błędów i do porównań przed/po, a nie do zastąpienia PageSpeed Insights.
Testy dostępności obejmują wyłącznie to, co da się sprawdzić maszynowo — sens tekstów alternatywnych,
kolejność czytania, zrozumiałość komunikatów o błędach i praca z czytnikiem ekranu wymagają oceny człowieka.</div>

<footer>Audyt wykonany narzędziem audyt-strony.js — bartekdev_pl. Wydruk do PDF: Ctrl+P.</footer>
</body></html>`;
  }

  /* ----------------------------------------------------------- main */

  function audyt(opcje) {
    opcje = opcje || {};
    const w = wydajnosc(), s = seo(), d = dostepnosc();
    const wynik = {
      url: location.href, host: location.hostname, data: new Date().toISOString(),
      wydajnosc: w, seo: s, dostepnosc: d, wnioski: wnioski(w, s, d)
    };
    glob.AUDYT_WYNIK = wynik;

    if (!opcje.cicho) {
      const okno = glob.open('', '_blank');
      if (okno) { okno.document.write(html(wynik)); okno.document.close(); }
      else console.warn('Przeglądarka zablokowała nowe okno — raport jest w AUDYT_WYNIK, HTML w AUDYT_HTML.');
      glob.AUDYT_HTML = html(wynik);
      console.log('%cAudyt gotowy', 'font-weight:bold;font-size:14px');
      console.log('Rekomendacji: %d (wysokich: %d)', wynik.wnioski.length, wynik.wnioski.filter(x => x.waga === 'wysoki').length);
      console.table(wynik.wnioski.map(x => ({ waga: x.waga, co: x.tytul })));
    }
    return wynik;
  }

  glob.AUDYT = audyt;
  glob.AUDYT_HTML_GEN = html;
  if (typeof module !== 'undefined' && module.exports) module.exports = { audyt, html };
  if (!glob.__AUDYT_BEZ_AUTO__) audyt();
})(typeof window !== 'undefined' ? window : globalThis);

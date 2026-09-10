/**
 * wcag-audyt.js — automatyczny audyt wstępny dostępności (WCAG 2.1 AA).
 * Próbka pod zlecenie Useme 140833.
 *
 * Uruchomienie: wklej całość w konsoli przeglądarki (F12) na dowolnej stronie.
 *   Wynik: tabela w konsoli + obiekt `WCAG_WYNIK` z pełną listą niezgodności.
 *   Tryb cichy (bez logów):  WCAG_AUDYT({ cicho: true })
 *
 * Zakres: 14 automatycznych testów pokrywających te kryteria WCAG 2.1 AA, które
 * da się sprawdzić maszynowo. Reszta (sens tekstu alternatywnego, kolejność czytania,
 * zrozumiałość komunikatów błędów) wymaga człowieka — skrypt to wypisuje wprost
 * w sekcji „wymaga oceny ręcznej”, zamiast udawać pełną zgodność.
 */

(function (global) {
  'use strict';

  function kontrast(rgb1, rgb2) {
    const lum = c => {
      const s = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    };
    const a = lum(rgb1), b = lum(rgb2);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function parsujKolor(str) {
    const m = String(str).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const cz = m[1].split(',').map(s => parseFloat(s.trim()));
    if (cz.length > 3 && cz[3] === 0) return null;      // przezroczyste — nie oceniamy
    return [cz[0], cz[1], cz[2]];
  }

  function tloEfektywne(el) {
    let e = el;
    while (e && e !== document.documentElement) {
      const kol = parsujKolor(getComputedStyle(e).backgroundColor);
      if (kol) return kol;
      e = e.parentElement;
    }
    return [255, 255, 255];
  }

  function sciezka(el) {
    if (!el) return '';
    if (el.id) return '#' + el.id;
    const cz = [];
    let e = el;
    for (let i = 0; e && e.nodeType === 1 && i < 4; i++, e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.className && typeof e.className === 'string') s += '.' + e.className.trim().split(/\s+/)[0];
      cz.unshift(s);
    }
    return cz.join(' > ');
  }

  const widoczny = el => {
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
  };

  function audyt(opcje) {
    opcje = opcje || {};
    const bledy = [];
    const dodaj = (kryt, nazwa, waga, el, opis) =>
      bledy.push({ kryterium: kryt, nazwa, waga, element: sciezka(el), opis });

    /* 1.1.1 Treść nietekstowa */
    [...document.images].forEach(img => {
      if (!img.hasAttribute('alt')) dodaj('1.1.1', 'Treść nietekstowa', 'krytyczne', img,
        'Obrazek bez atrybutu alt: ' + (img.currentSrc || img.src || '').split('/').pop().slice(0, 40));
    });
    document.querySelectorAll('svg[role="img"]:not([aria-label]):not([aria-labelledby])').forEach(s =>
      dodaj('1.1.1', 'Treść nietekstowa', 'wysokie', s, 'SVG jako obrazek bez etykiety dostępnej'));

    /* 1.3.1 Informacje i relacje — nagłówki, listy, tabele */
    const nagl = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(widoczny);
    if (!document.querySelector('h1')) dodaj('1.3.1', 'Informacje i relacje', 'wysokie', document.body,
      'Brak nagłówka H1 na stronie');
    let poprz = 0;
    nagl.forEach(h => {
      const p = +h.tagName[1];
      if (poprz && p > poprz + 1) dodaj('1.3.1', 'Informacje i relacje', 'średnie', h,
        `Przeskok poziomu nagłówka: H${poprz} → H${p}`);
      poprz = p;
    });
    document.querySelectorAll('table').forEach(t => {
      if (!t.querySelector('th')) dodaj('1.3.1', 'Informacje i relacje', 'średnie', t,
        'Tabela bez komórek nagłówkowych (th)');
    });

    /* 1.3.5 Określenie pożądanej wartości */
    document.querySelectorAll('input[type=email],input[type=tel],input[name*=mail],input[name*=phone]').forEach(i => {
      if (!i.getAttribute('autocomplete')) dodaj('1.3.5', 'Określenie pożądanej wartości', 'niskie', i,
        'Pole danych osobowych bez atrybutu autocomplete');
    });

    /* 1.4.3 Kontrast minimalny */
    const tekstowe = [...document.querySelectorAll('p,li,a,span,td,th,label,button,h1,h2,h3,h4,h5,h6')]
      .filter(el => widoczny(el) && el.textContent.trim().length > 1 &&
                    ![...el.children].some(c => c.textContent.trim() === el.textContent.trim()));
    tekstowe.slice(0, 400).forEach(el => {
      const st = getComputedStyle(el);
      const kol = parsujKolor(st.color);
      if (!kol) return;
      const k = kontrast(kol, tloEfektywne(el));
      const px = parseFloat(st.fontSize);
      const duzy = px >= 24 || (px >= 18.66 && parseInt(st.fontWeight, 10) >= 700);
      const prog = duzy ? 3 : 4.5;
      if (k < prog) dodaj('1.4.3', 'Kontrast minimalny', k < prog - 1.5 ? 'wysokie' : 'średnie', el,
        `Kontrast ${k.toFixed(2)}:1 przy wymaganym ${prog}:1 (tekst ${px.toFixed(0)}px) — „${el.textContent.trim().slice(0, 30)}”`);
    });

    /* 1.4.4 Zmiana rozmiaru tekstu */
    const vp = document.querySelector('meta[name=viewport]');
    if (vp && /user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(vp.content))
      dodaj('1.4.4', 'Zmiana rozmiaru tekstu', 'wysokie', vp, 'Viewport blokuje powiększanie strony');

    /* 2.1.1 Klawiatura */
    document.querySelectorAll('[onclick]').forEach(el => {
      const t = el.tagName.toLowerCase();
      if (!['a', 'button', 'input', 'select', 'textarea'].includes(t) && !el.hasAttribute('tabindex'))
        dodaj('2.1.1', 'Klawiatura', 'krytyczne', el, 'Element klikalny niedostępny z klawiatury (brak tabindex i roli)');
    });
    document.querySelectorAll('[tabindex]').forEach(el => {
      if (parseInt(el.getAttribute('tabindex'), 10) > 0)
        dodaj('2.4.3', 'Kolejność fokusu', 'średnie', el, 'Dodatni tabindex zaburza naturalną kolejność fokusu');
    });

    /* 2.4.1 Możliwość pominięcia bloków */
    const skip = [...document.querySelectorAll('a[href^="#"]')].slice(0, 3)
      .some(a => /przejd|pomi|skip|treś|content/i.test(a.textContent));
    if (!skip) dodaj('2.4.1', 'Możliwość pominięcia bloków', 'średnie', document.body,
      'Brak linku „przejdź do treści” na początku strony');

    /* 2.4.2 Tytuł strony */
    if (!document.title || document.title.trim().length < 5)
      dodaj('2.4.2', 'Tytuł strony', 'wysokie', document.head, 'Brak lub zbyt krótki tytuł strony');

    /* 2.4.4 Cel linku */
    document.querySelectorAll('a[href]').forEach(a => {
      const txt = (a.textContent || '').trim();
      const etyk = a.getAttribute('aria-label') || a.getAttribute('title') || '';
      if (!txt && !etyk && !a.querySelector('img[alt]:not([alt=""])'))
        dodaj('2.4.4', 'Cel linku', 'wysokie', a, 'Link bez tekstu i bez etykiety dostępnej');
      else if (/^(tutaj|kliknij|więcej|czytaj więcej|zobacz|link)$/i.test(txt))
        dodaj('2.4.4', 'Cel linku', 'niskie', a, `Nieinformacyjny tekst linku: „${txt}”`);
    });

    /* 2.4.7 Widoczny fokus */
    document.querySelectorAll('a,button,input,select,textarea').forEach(el => {
      const s = getComputedStyle(el, ':focus');
      if (s.outlineStyle === 'none' && s.boxShadow === 'none')
        dodaj('2.4.7', 'Widoczny fokus', 'wysokie', el, 'Usunięty wskaźnik fokusu bez zamiennika');
    });

    /* 3.1.1 Język strony */
    const lang = document.documentElement.getAttribute('lang');
    if (!lang) dodaj('3.1.1', 'Język strony', 'wysokie', document.documentElement, 'Brak atrybutu lang w znaczniku html');
    else if (!/^[a-z]{2}(-[A-Za-z]{2,})?$/.test(lang))
      dodaj('3.1.1', 'Język strony', 'średnie', document.documentElement, `Nieprawidłowy kod języka: „${lang}”`);

    /* 3.3.2 Etykiety lub instrukcje */
    document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea').forEach(f => {
      const maEtyk = (f.id && document.querySelector(`label[for="${CSS.escape(f.id)}"]`)) ||
                     f.closest('label') || f.getAttribute('aria-label') || f.getAttribute('aria-labelledby');
      if (!maEtyk) dodaj('3.3.2', 'Etykiety lub instrukcje', 'krytyczne', f,
        'Pole formularza bez etykiety (label / aria-label)');
    });

    /* 4.1.2 Nazwa, rola, wartość */
    document.querySelectorAll('button').forEach(b => {
      if (!b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title'))
        dodaj('4.1.2', 'Nazwa, rola, wartość', 'krytyczne', b, 'Przycisk bez nazwy dostępnej');
    });
    const idy = {};
    document.querySelectorAll('[id]').forEach(el => {
      idy[el.id] = (idy[el.id] || 0) + 1;
      if (idy[el.id] === 2) dodaj('4.1.1', 'Poprawność kodu', 'niskie', el, `Zduplikowany identyfikator: ${el.id}`);
    });

    /* 1.3.1 — punkty orientacyjne */
    if (!document.querySelector('main,[role=main]'))
      dodaj('1.3.1', 'Informacje i relacje', 'średnie', document.body, 'Brak głównego punktu orientacyjnego (main)');

    const wagi = { krytyczne: 0, wysokie: 0, średnie: 0, niskie: 0 };
    bledy.forEach(b => wagi[b.waga]++);

    const wynik = {
      url: location.href,
      data: new Date().toISOString(),
      podsumowanie: wagi,
      razem: bledy.length,
      niezgodnosci: bledy,
      wymagaOcenyRecznej: [
        '1.1.1 — czy treść atrybutów alt faktycznie opisuje obrazek (maszyna sprawdzi obecność, nie sens)',
        '1.3.2 — czy kolejność czytania odpowiada kolejności wizualnej',
        '1.4.5 — czy tekst nie jest osadzony w grafice',
        '2.4.6 — czy nagłówki i etykiety są opisowe',
        '3.3.3 — czy komunikaty błędów podpowiadają poprawkę',
        'całość — test z czytnikiem ekranu (NVDA/VoiceOver) i przejście strony wyłącznie klawiaturą'
      ]
    };

    if (!opcje.cicho) {
      console.log('%cAudyt WCAG 2.1 AA — ' + location.href, 'font-weight:bold;font-size:14px');
      console.log(`Niezgodności: ${bledy.length} (krytyczne ${wagi.krytyczne}, wysokie ${wagi.wysokie}, średnie ${wagi.średnie}, niskie ${wagi.niskie})`);
      if (bledy.length) console.table(bledy.map(b => ({ kryterium: b.kryterium, waga: b.waga, element: b.element, opis: b.opis })));
      console.log('%cWymaga oceny ręcznej:', 'font-weight:bold');
      wynik.wymagaOcenyRecznej.forEach(t => console.log(' • ' + t));
    }

    global.WCAG_WYNIK = wynik;
    return wynik;
  }

  global.WCAG_AUDYT = audyt;
  if (typeof module !== 'undefined' && module.exports) module.exports = { audyt, kontrast };
  if (!global.__WCAG_BEZ_AUTO__) audyt();
})(typeof window !== 'undefined' ? window : globalThis);

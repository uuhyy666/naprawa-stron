// ChatBot PRO — 1-line embed, z panelem edycji FAQ.
// Osadzenie: <script src="chatbot.js" data-faq="faq.json"></script>
// Panel: chatbot-panel.html (ten sam folder, hasło w panel-pass.txt — zmień po instalacji).
(function () {
  var cfg = window.ChatBotConfig || {};
  var script = document.currentScript;
  var faqUrl = (script && script.getAttribute('data-faq')) || cfg.faq || 'faq.json';
  var color = cfg.color || '#2b6cb0';
  var title = cfg.title || 'Czat — odpowiadamy 24/7';
  var hello = cfg.hello || 'Dzień dobry! Jestem botem. Zapytaj mnie o cokolwiek — jeśli nie będę znać odpowiedzi, napiszę to szczerze.';

  var FAQ = []; // [{q: "pytanie/kwestie", a: "odpowiedź"}]
  var unknownAnswer = cfg.unknown || 'Nie znam odpowiedzi na to pytanie — zostaw e-mail lub numer, a człowiek odpowie najszybciej jak może.';

  // --- 1. Baza FAQ wpisana na stałe (plik dedykowany dla klienta Irys — bez zewnętrznego JSON) ---
  var FAQ = [
    {
      "q": "godziny, otwarte, otwarcia, otwarci, kiedy otwarte, w jakich godzinach, godzinach, do której, sobota, sobotę, niedziela, niedzielę, poniedziałek, piątek, pracujecie, działacie",
      "a": "Godziny otwarcia: poniedziałek–piątek 8:00–19:00, sobota 8:00–16:00, niedziela 10:00–14:00."
    },
    {
      "q": "gdzie jesteście, lokalizacja, dojazd, gdzie, ostrow, kościuszki, siedziba, sklep fizyczny, punkt stacjonarny",
      "a": "Znajdujemy się w Ostrowie Wielkopolskim, ul. Tadeusza Kościuszki 23b, 63-400. Zapraszamy!"
    },
    {
      "q": "telefon, zadzwonić, numer, kontakt, zadzwonię, telefonu, obdzwoń",
      "a": "Zadzwoń: 62 736 57 07. Możesz też napisać na czacie — odpowiemy najszybciej jak możemy."
    },
    {
      "q": "mail, e-mail, email, poczta, mailowy, napisać mailem",
      "a": "Nasz adres e-mail: kwiaciarnia.irys@op.pl."
    },
    {
      "q": "bukiet, bukiety, kwiaty, kompozycja, kompozycje, wiązanka, wiązanki, świeże, kwiatowe",
      "a": "Tworzymy wyjątkowe bukiety i kompozycje kwiatowe z pasją i dbałością o każdy detal — na każdą okazję. Podeślij swój pomysł w czacie lub zadzwoń: 62 736 57 07."
    },
    {
      "q": "okazja, okazji, urodziny, imieniny, rocznica, ślub, wesele, wesele, pogrzeb, wiązanka pogrzebowa, stypa, chrzest, dziękuję, podziękowanie",
      "a": "Komponujemy kwiaty na każdą okazję — urodziny, imieniny, rocznice, śluby, chrzciny, a także wiązanki okolicznościowe. Zadzwoń: 62 736 57 07, doradzimy dobór kwiatów."
    },
    {
      "q": "dostawa, dostawe, dostawę, dowozicie, dowozić, dostarczacie, dostarczycie, dowóz, dowoziecie, dowozić, dostarczenie, przesyłka, pocztą, kwiaty na adres, dowieźć, dostarczyć, na adres, przynieść, pod dom, kurier",
      "a": "Prowadzimy pocztę kwiatową — kwiaty dowozimy pod wskazany adres. Zadzwoń: 62 736 57 07, ustalimy termin i szczegóły dostawy."
    },
    {
      "q": "cena, koszt, ile kosztuje, wycena, cenę, zapłacić, drogo, tanio, cenach, kosztować",
      "a": "Ceny bukietów zależą od dobranych kwiatów i wielkości — jak nasi klienci piszą: „piękne bukiety warte swojej ceny”. Zadzwoń: 62 736 57 07, wycenimy bukiet pod Twój budżet."
    },
    {
      "q": "opinia, opinie, polecam, polecacie, recenzje, się sprawdza, zaufali",
      "a": "Nasi klienci oceniają nas na 5 gwiazdek — „Zawsze pięknie, zawsze profesjonalnie, zawsze z miłością do kwiatów”, „Najlepsza kwiaciarnia w Ostrowie”. Dziękujemy za zaufanie!"
    },
    {
      "q": "na zamówienie, indywidualnie, spersonalizowany, własny pomysł, własny bukiet, konkretny bukiet",
      "a": "Bukiet komponujemy indywidualnie — powiedz nam okazję i preferencje, a resztę zrobimy za Ciebie. Zadzwoń: 62 736 57 07."
    },
    {
      "q": "zamówić, zamówienie, jak zamówić, złożyć zamówienie, kupić",
      "a": "Najprościej: zadzwoń 62 736 57 07 albo napisz tutaj w czacie — ustalimy bukiet, cenę i termin (w razie potrzeby z dostawą)."
    },
    {
      "q": "świeżość, świeże kwiaty, jak długo, w Wieniu, zwiędnięcia, zwiędną",
      "a": "Dbamy o świeżość kwiatów — bukiety wykonujemy z sezonowych, świeżych kwiatów. Porady, jak przedłużyć trwałość, chętnie udzielimy przy odbiorze."
    },
    {
      "q": "kondolencje, pogrzeb, stypy, żałoba, wiązanki, na pożegnanie",
      "a": "Przygotowujemy wiązanki i kompozycje na pożegnanie. Zadzwoń: 62 736 57 07 — doradzimy i przygotujemy dyskretnie i na czas."
    },
    {
      "q": "ślub, wesele, dekoracje ślubne, bukiet ślubny, wiązanka ślubna, florystyka ślubna",
      "a": "Wykonujemy bukiety ślubne i dekoracje na wesele. Zadzwoń: 62 736 57 07 — umówimy się na rozmowę i prezentację pomysłów."
    },
    {
      "q": "płatność, zapłata, zapłacić, kartą, gotówka, blik",
      "a": "Płatność przy odbiorze — gotówka i karta. Szczegóły ustalisz przy zamówieniu: 62 736 57 07."
    }
  ];
  var unknownAnswer = "Nie znam odpowiedzi na to pytanie — zadzwoń: 62 736 57 07 albo zostaw tu pytanie, a człowiek odpowie najszybciej jak może.";

  var defaultFaq = [
    { q: 'cena, koszt, ile kosztuje, wycena, zł', a: 'Ceny ustalane są indywidualnie — napisz, czego potrzebujesz, a dostaniesz wycenę.' },
    { q: 'godziny, otwarte, kiedy pracujecie', a: 'Odpowiadamy codziennie 8–22.' },
    { q: 'kontakt, mail, telefon', a: 'Napisz tutaj w czacie — wiadomość trafia do nas, odpowiadamy szybko.' },
    { q: 'gdzie jesteście, adres, lokalizacja', a: 'Pracujemy zdalnie — obsługa w całej Polsce.' }
  ];

  // --- 2. Dopasowanie pytania ---
  function norm(s) { return ' ' + s.toLowerCase()
      .replace(/[ąàá]/g,'a').replace(/[ęèé]/g,'e').replace(/[ś]/g,'s').replace(/[óòöô]/g,'o')
      .replace(/[żźź]/g,'z').replace(/[ćç]/g,'c').replace(/[ńñ]/g,'n')
      .replace(/[^a-z0-9 ]/g,' ') + ' '; }
  function answer(msg) {
    var m = norm(msg);
    // Powitania i formy grzecznościowe — bot odpowiada kulturalnie, zanim poleci do FAQ
    var greetings = [['witam,witam,czesc,cześć,hej,siema,dzien dobry,dobry,hello,hi,hejka', 'Dzień dobry! 👋 W czym mogę pomóc? Zapytaj o godziny otwarcia, dostawę, bukiety lub kontakt — a jeśli nie będę znać odpowiedzi, napiszę to szczerze.']];
    var g = greetings[0][0].split(',');
    var gHits = 0;
    for (var gi = 0; gi < g.length; gi++) if (m.indexOf(g[gi]) >= 0) gHits++;
    // Czyste powitanie (1–2 słowa) — nie traktuj "witam ile kosztuje" jako samego powitania
    var wordCount = m.trim().split(/\s+/).length;
    if (gHits > 0 && wordCount <= 2) return { text: greetings[0][1], known: true };
    var best = null, bestHits = 0;
    for (var i = 0; i < FAQ.length; i++) {
      // normalizacja haseł: bez ogonków, bez interpunkcji — tak jak treść pytania
      var words = FAQ[i].q.split(',').map(function(w){ return norm(w).trim(); }).filter(Boolean);
      var hits = 0;
      for (var j = 0; j < words.length; j++) if (m.indexOf(' ' + words[j]) >= 0 || m.indexOf(words[j]) >= 0) hits++;
      if (hits > bestHits) { best = FAQ[i].a; bestHits = hits; }
    }
    if (best && bestHits >= 1) return { text: best, known: true };
    return { text: unknownAnswer, known: false };
  }

  // --- 3. Zapis nieznanych pytań (skrzynka w panelu) ---
  function logUnknown(q) {
    try {
      var key = 'cb_unknown';
      var arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push({ q: q, t: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
    // JSON do panelu: wyklikane przez panel/export (patrz panel)
  }

  // --- UI ---
  var open = false;
  var css = document.createElement('style');
  css.textContent = [
    '.cb-btn{position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;background:' + color + ';color:#fff;border:none;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.25);z-index:99999}',
    '.cb-panel{position:fixed;bottom:90px;right:20px;width:330px;max-height:420px;background:#fff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.2);display:none;flex-direction:column;z-index:99999;font-family:system-ui,sans-serif;overflow:hidden}',
    '.cb-panel.open{display:flex}',
    '.cb-head{background:' + color + ';color:#fff;padding:12px 16px;font-weight:600;font-size:14px}',
    '.cb-msgs{flex:1;overflow-y:auto;padding:12px;background:#f7f9fc}',
    '.cb-m{max-width:80%;padding:8px 12px;border-radius:12px;margin-bottom:8px;font-size:14px;line-height:1.45;white-space:pre-wrap}',
    '.cb-m.bot{background:#fff;border:1px solid #e2e8f0}',
    '.cb-m.user{background:' + color + ';color:#fff;margin-left:auto}',
    '.cb-form{display:flex;padding:10px;border-top:1px solid #e2e8f0;background:#fff}',
    '.cb-form input{flex:1;border:1px solid #cbd5e0;border-radius:8px;padding:8px 10px;font-size:14px;outline:none}',
    '.cb-form button{background:' + color + ';color:#fff;border:none;border-radius:8px;margin-left:8px;padding:8px 14px;cursor:pointer;font-size:14px}'
  ].join('');
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.className = 'cb-btn'; btn.textContent = '💬'; btn.setAttribute('aria-label', 'Otwórz czat');
  var panel = document.createElement('div');
  panel.className = 'cb-panel';
  panel.innerHTML = '<div class="cb-head">' + title + '</div><div class="cb-msgs"></div>' +
    '<div class="cb-form"><input placeholder="Napisz wiadomość…" aria-label="Wiadomość"><button>➤</button></div>';
  document.body.appendChild(btn); document.body.appendChild(panel);

  var msgs = panel.querySelector('.cb-msgs');
  function add(who, text) {
    var d = document.createElement('div');
    d.className = 'cb-m ' + who; d.textContent = text;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  }
  btn.onclick = function () {
    open = !open;
    panel.classList.toggle('open', open);
    if (open && !msgs.children.length) { add('bot', hello); }
  };
  var inp = panel.querySelector('input');
  function send() {
    var v = inp.value.trim(); if (!v) return;
    add('user', v); inp.value = '';
    setTimeout(function () {
      var r = answer(v);
      add('bot', r.text);
      if (!r.known) logUnknown(v);
    }, 450);
  }
  panel.querySelector('button').onclick = send;
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
})();

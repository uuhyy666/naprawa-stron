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

  // --- 1. Ładowanie FAQ ---
  var xhr = new XMLHttpRequest();
  xhr.open('GET', faqUrl + '?t=' + Date.now());
  xhr.onload = function () {
    if (xhr.status === 200) {
      try { FAQ = JSON.parse(xhr.responseText); } catch (e) { /* fallback poniżej */ }
    }
    if (!FAQ.length) FAQ = defaultFaq;
  };
  xhr.send();

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
      var words = FAQ[i].q.split(',').map(function(w){return w.trim().toLowerCase();}).filter(Boolean);
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

// ChatBot widget — 1-line embed. Config via window.ChatBotConfig (optional).
// This file IS the deliverable demo for the Useme job "widget chatbota 24/7 w 1 linijce kodu JS".
(function () {
  var cfg = window.ChatBotConfig || {};
  var color = cfg.color || '#2b6cb0';
  var title = cfg.title || 'Czat — odpowiadamy 24/7';
  var hello = cfg.hello || 'Dzień dobry! Jestem botem. Spytaj mnie o: ceny, termin, kontakt, portfolio.';

  // FAQ baza — w pełnej wersji edytowalna z panelu
  var FAQ = [
    { k: [/cen|koszt|ile koszt|zł|wycen/i], a: 'Prosta naprawa/strona: od 150 zł. Widget jak ten (bot + panel rozmów): od 300 zł. Płatność po wykonaniu i akceptacji.' },
    { k: [/termin|kiedy|jak (szybko|długo)|dni/i], a: 'Małe zlecenia: 1 dzień roboczy. Strony/automatyzacje: 2–5 dni. Termin ustalam przed startem.' },
    { k: [/kontakt|mail|e-mail|napisac|telefon/i], a: 'Najszybciej przez czat na stronie głównej: https://uuhyy666.github.io/naprawa-stron/ — odpowiadam zwykle w kilka minut (8–22).' },
    { k: [/portfolio|projekt|praca|przykład/i], a: 'Portfolio: github.com/uuhyy666. Demo tego widgetu: https://uuhyy666.github.io/naprawa-stron/demo-chatbot.html' },
    { k: [/bot|jak dzia|technolog|jak to/i], a: 'Widget to jeden plik JS (~4 KB, zero zależności). Odpowiedzi ustawia się w prostej liście pytań-odpowiedzi. W pełnej wersji: panel rozmów i powiadomienia.' },
    { k: [/host|serwer|gdzie/i], a: 'Widget działa na dowolnej stronie (WordPress, Shopify, HTML). Hosting pliku — dowolny CDN lub Twój serwer.' }
  ];

  function answer(msg) {
    for (var i = 0; i < FAQ.length; i++) {
      for (var j = 0; j < FAQ[i].k.length; j++) if (FAQ[i].k[j].test(msg)) return FAQ[i].a;
    }
    return 'Nie mam jeszcze odpowiedzi na to pytanie — zostaw e-mail w wiadomości, a człowiek odpowie (zwykle w kilka minut, 8–22).';
  }

  // UI
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
    setTimeout(function () { add('bot', answer(v)); }, 450);
  }
  panel.querySelector('button').onclick = send;
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
})();

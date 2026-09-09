// Szkielet: Moodle — automatyczne przydzielanie ankiet według klucza (zlecenie 143924 / wątek 1945984)
// Działa przez Moodle Web Services (REST) — zero wtyczek do instalacji na serwerze.
// Użycie:
//   MOODLE_URL=https://twojmoodle.pl MOODLE_TOKEN=xxx node moodle-ankiety.js lista 8
//   MOODLE_URL=... MOODLE_TOKEN=xxx node moodle-ankiety.js przypisz 8 klucz.csv
// Wymagane usługi w Moodle (Site administration > Plugins > Web Services):
//   core_enrol_get_enrolled_users, mod_feedback_get_feedbacks, groups_groupid ...
// Klucz CSV: login,runda1,runda2,runda3  (1 = ta ankieta, 0 = pomijamy)

const HTTPS = require('https');

const MOODLE_URL = process.env.MOODLE_URL || 'https://demo.moodle.example';
const MOODLE_TOKEN = process.env.MOODLE_TOKEN || 'DEMO';
const parsed = new URL(MOODLE_URL);

// Wywołanie Moodle WS — wsfunction + params jako query
function ws(wsfunction, params = {}) {
  const q = new URLSearchParams({ wstoken: MOODLE_TOKEN, wsfunction, moodlewsrestformat: 'json' });
  for (const [k, v] of Object.entries(params)) q.append(`params[${k}]`, String(v));
  return new Promise((resolve, reject) => {
    const req = HTTPS.request({ hostname: parsed.hostname, path: parsed.pathname.replace(/\/$/, '') + '/webservice/rest/server.php?' + q.toString(), method: 'GET' },
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject); req.end();
  });
}

// 1. Lista uczestników kursu (courseid) — core_enrol_get_enrolled_users
function uczestnicy(courseid) { return ws('core_enrol_get_enrolled_users', { courseid }); }

// 2. Przydział ankiet wg klucza: każda runda to grupa użytkowników -> aktywna ankieta (feedback)
// Klucz w CSV: login;rundy rozdzielone przecinkiem. Zwrot: plan rund do zatwierdzenia.
function planRund(users, kluczCsv) {
  const linie = kluczCsv.trim().split(/\r?\n/);
  const plan = {};
  linie.forEach(line => {
    const [login, rundy] = line.split(';'); // login;rundy rozdzielone przecinkami
    (rundy || '').split(',').forEach((v, i) => {
      if (v.trim() === '1') (plan['runda' + (i + 1)] = plan['runda' + (i + 1)] || []).push(login.trim());
    });
  });
  return plan;
}

// 3. Otwarcie/zamknięcie rundy = widoczność feedbacku (mod_feedback / core_course_update_module)
// W wersji docelowej: jedno kliknięcie = update available_from/available_to + powiadomienie push (modularny)
async function main() {
  const [cmd, arg, arg2] = process.argv.slice(2);
  if (cmd === 'lista') {
    const u = await uczestnicy(Number(arg));
    console.log('Uczestnicy kursu', arg + ':', u.map(x => x.username + ' (' + x.fullname + ')').join(', '));
  } else if (cmd === 'plan') {
    const klucz = arg2 || 'jan;1,0,1\nanna;0,1,0\npawel;1,1,0';
    console.log(JSON.stringify(planRund([], klucz), null, 2));
  } else {
    console.log('KOMENDY: lista <courseid> | plan [csv]');
  }
}
main().catch(e => { console.error('Błąd:', e.message); process.exit(1); });

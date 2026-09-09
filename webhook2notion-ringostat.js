// Szkielet: Ringostat (webhook) -> Notion (API) — dowód koncepcji dla zlecenia 143678
// Użycie: node webhook2notion.js  (nasłuchuje na http://127.0.0.1:9970/ringostat)
// Po stronie Cloudtalk ustawiasz webhook na rozmowę zakończoną (call finished) -> ten endpoint.
const http = require('http');
const HTTPS = require('https');

const NOTION_TOKEN = process.env.NOTION_TOKEN; // sekret, NIE w kodzie
const NOTION_DB = process.env.NOTION_DATABASE_ID;

function notionCreate(page) {
  const body = JSON.stringify(page);
  const req = HTTPS.request({
    hostname: 'api.notion.com', path: '/v1/pages', method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + NOTION_TOKEN,
      'Notion-Version': '2022-06-28', 'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => console.log('Notion API:', res.statusCode, d.slice(0, 200))); });
  req.on('error', e => console.error('Notion error:', e.message));
  req.write(body); req.end();
}

// Mapowanie payloadu Cloudtalk (call:finished) na wiersz bazy Notion
function mapRingostatToNotion(c) {
  return {
    parent: { database_id: NOTION_DB },
    properties: {
      'Klient': { title: [{ text: { content: (c.contact && (c.contact.name || c.contact.phoneNumber)) || 'nieznany' } }] },
      'Agent': { rich_text: [{ text: { content: c.agent || '-' } }] },
      'Czas rozmowy': { rich_text: [{ text: { content: c.duration ? c.duration + ' s' : '-' } }] },
      'Data': { date: { start: new Date((c.timestamp || Date.now()) * 1000).toISOString() } }
    }
  };
}

http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/ringostat')) {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      try {
        const c = JSON.parse(b);
        console.log('Webhook Ringostat:', c.event || '(brak pola event)');
        notionCreate(mapRingostatToNotion(c));
        res.writeHead(200); res.end('OK');
      } catch (e) { res.writeHead(400); res.end('bad json'); }
    });
  } else { res.writeHead(404); res.end(); }
}).listen(9970, () => console.log('Nasłuch webhooka Ringostat na :9970/ringostat — test: curl -X POST localhost:9970/ringostat -d \'{"contact":{"name":"Jan Kowalski"},"agent":"Adam","duration":120}\''));

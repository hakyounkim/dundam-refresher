// End-to-end test using the actual API handlers (no HTTP server needed).
// Loads .env.local, instantiates a fake req/res, and runs through:
//   adventure-register → character-sync → events
import fs from 'node:fs';
import path from 'node:path';

for (const f of ['.env.local', '.env']) {
  try {
    const txt = fs.readFileSync(path.resolve(f), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        let v = m[2];
        const dq = v.startsWith('"') && v.endsWith('"');
        const sq = v.startsWith("'") && v.endsWith("'");
        if (dq || sq) v = v.slice(1, -1);
        if (dq) v = v.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"');
        process.env[m[1]] = v.trim();
      }
    }
  } catch {}
}

function mockRes() {
  const r = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(obj) { this.body = obj; return this; },
    end() { return this; },
  };
  return r;
}

async function call(handlerPath, req) {
  const { default: handler } = await import(handlerPath);
  const res = mockRes();
  await handler(req, res);
  return res;
}

const SERVER = 'casillas';
const CHAR_ID = '56a81575c814e829392349dfa43e80e6';

// 1) Get the character's adventureName from Neople
const { searchAdventureCharacters } = await import('../api/_neople.js');

// We don't know the adventureName yet; use /characters/{id} endpoint instead
async function getAdventureName() {
  const url = `https://api.neople.co.kr/df/servers/${SERVER}/characters/${CHAR_ID}?apikey=${process.env.NEOPLE_API_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return j.adventureName;
}
const adventureName = await getAdventureName();
console.log(`[info] adventureName = ${adventureName}`);

// 2) Register
console.log('\n— POST /api/adventure-register —');
let res = await call('../api/adventure-register.js', {
  method: 'POST', body: { adventureName, serverId: SERVER }, query: {}, headers: {},
});
console.log('status', res.statusCode);
console.log('characters:', res.body.characterCount, '명');
const target = (res.body.characters || []).find(c => c.characterId === CHAR_ID);
if (!target) { console.error('target char not found in adventure enumeration'); process.exit(1); }
console.log('target:', target.characterName, target.jobGrowName);

// 3) Sync target character
console.log('\n— POST /api/character-sync —');
res = await call('../api/character-sync.js', {
  method: 'POST', body: { characterId: CHAR_ID }, query: {}, headers: {},
});
console.log('status', res.statusCode);
console.log(res.body);

// 4) List events
console.log('\n— GET /api/events (character only) —');
res = await call('../api/events.js', {
  method: 'GET', body: null, query: { characterId: CHAR_ID, rarity: '태초,에픽', category: 'pact,soul' }, headers: {},
});
console.log('status', res.statusCode);
console.log('count:', res.body.count);
console.log('stats:', res.body.stats);
console.log('\nfirst 5 rows:');
for (const r of (res.body.rows || []).slice(0, 5)) {
  console.log(`  ${r.occurred_at} ${r.character_name} | ${r.item_rarity} ${r.item_name} | code ${r.event_code} | ${r.channel_name ?? '-'}${r.channel_no ? '-' + r.channel_no : ''} | ${r.dungeon_name ?? '-'}`);
}

// Probe Neople /df/setitems/:setItemId, /equip/oath, /equip/mist-assimilation, /equip/avatar shapes.
// Goal:
//   1) Find where set-point activation thresholds (2100/2550 etc.) live.
//   2) See what /equip/oath returns per character (oath name, grade, options).
//   3) Spot any OTHER threshold-style data (avatar / mist / creature).
// Usage:  node scripts/probe-setitems-oath.mjs
import fs from 'node:fs';
import path from 'node:path';

for (const f of ['.env.local', '.env']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}

const API_KEY = process.env.NEOPLE_API_KEY;
if (!API_KEY) { console.error('NEOPLE_API_KEY missing'); process.exit(1); }

const SERVER  = process.env.PROBE_SERVER ?? 'casillas';
const CHAR_ID = process.env.PROBE_CHAR   ?? '56a81575c814e829392349dfa43e80e6';
const BASE = 'https://api.neople.co.kr/df';

async function get(p) {
  const sep = p.includes('?') ? '&' : '?';
  const url = `${BASE}${p}${sep}apikey=${API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) {
    const txt = await r.text().catch(()=> '');
    return { __error: `HTTP ${r.status} ${p}`, __body: txt.slice(0,400) };
  }
  return r.json();
}

// "outline" — print structure (keys + types) instead of giant dump, to keep stdout digestible.
function outline(v, depth = 0, maxDepth = 4) {
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    return `[${v.length}× ${depth < maxDepth ? outline(v[0], depth+1, maxDepth) : '…'}]`;
  }
  if (typeof v === 'object') {
    if (depth >= maxDepth) return '{…}';
    const entries = Object.entries(v).map(([k, x]) => `${k}: ${outline(x, depth+1, maxDepth)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return typeof v;
}

function head(label) { console.log(`\n=========== ${label} ===========`); }

const equipResp = await get(`/servers/${SERVER}/characters/${CHAR_ID}/equip/equipment`);
const equipment = equipResp?.equipment ?? [];
console.log(`character has ${equipment.length} equipped slots`);

const setIds = [...new Set(equipment.map(e => e.setItemId).filter(Boolean))];
console.log('unique setItemIds on this character:', setIds);

// 1) /df/setitems/:setItemId  — does it have thresholds?
head('SINGLE setitem detail — sample (full JSON)');
if (setIds.length) {
  const sample = await get(`/setitems/${setIds[0]}`);
  console.log(JSON.stringify(sample, null, 2));
} else {
  console.log('no setItemId on equipment — skipping');
}

// 2) /df/multi/setitems for all distinct sets — outline shape, then dump one fully
head('MULTI setitems — outline');
if (setIds.length) {
  const multi = await get(`/multi/setitems?setItemIds=${setIds.slice(0, 15).join(',')}`);
  console.log('outline:', outline(multi, 0, 6));
  const rows = multi?.rows ?? multi?.setItems ?? multi;
  if (Array.isArray(rows) && rows.length) {
    console.log('\nfirst row (full):');
    console.log(JSON.stringify(rows[0], null, 2));
  }
}

// 3) /equip/setitem-info — character-specific set status (active points per set)
head('CHAR /equip/setitem-info — full');
const setInfo = await get(`/servers/${SERVER}/characters/${CHAR_ID}/equip/setitem-info`);
console.log(JSON.stringify(setInfo, null, 2));

// 4) /equip/oath
head('CHAR /equip/oath — full');
const oath = await get(`/servers/${SERVER}/characters/${CHAR_ID}/equip/oath`);
console.log(JSON.stringify(oath, null, 2));

// 5) /equip/mist-assimilation — thresholds for mist?
head('CHAR /equip/mist-assimilation — full');
const mist = await get(`/servers/${SERVER}/characters/${CHAR_ID}/equip/mist-assimilation`);
console.log(JSON.stringify(mist, null, 2));

// 6) /equip/avatar — bonuses
head('CHAR /equip/avatar — outline');
const avatar = await get(`/servers/${SERVER}/characters/${CHAR_ID}/equip/avatar`);
console.log('outline:', outline(avatar, 0, 5));
console.log('sample slot[0]:', JSON.stringify(avatar?.avatar?.[0] ?? null, null, 2));

// 7) /equip/creature
head('CHAR /equip/creature — full');
const creature = await get(`/servers/${SERVER}/characters/${CHAR_ID}/equip/creature`);
console.log(JSON.stringify(creature, null, 2));

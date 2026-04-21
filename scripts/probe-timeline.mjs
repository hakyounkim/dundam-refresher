// One-off probe to inspect Neople timeline events for a character.
// Usage: node scripts/probe-timeline.mjs
import fs from 'node:fs';
import path from 'node:path';

// Load .env manually (avoid adding dotenv dep)
for (const f of ['.env.local', '.env']) {
  try {
    const txt = fs.readFileSync(path.resolve(f), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
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

const SERVER  = 'casillas';
const CHAR_ID = '56a81575c814e829392349dfa43e80e6';

// Fetch up to last 90 days (API max). Paginate via `next`.
function fmt(d) { return d.toISOString().slice(0, 19).replace('T', ' ').replace(/-/g, '').replace(/:/g, '').replace(' ', 'T'); }
// Neople expects YYYYMMDDTHHMM format (KST implicit) — let's use YYYY-MM-DD HH:mm form which API also accepts.
function fmtKST(d) {
  const kst = new Date(d.getTime() + 9 * 3600_000);
  const p = n => String(n).padStart(2, '0');
  return `${kst.getUTCFullYear()}${p(kst.getUTCMonth()+1)}${p(kst.getUTCDate())}T${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}`;
}

async function fetchAll({ code } = {}) {
  const now = new Date();
  const from = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const all = [];
  let next = null;
  let pages = 0;
  do {
    const qs = new URLSearchParams({
      startDate: fmtKST(from),
      endDate:   fmtKST(now),
      limit: '100',
      apikey: API_KEY,
    });
    if (code) qs.set('code', code);
    if (next) qs.set('next', next);
    const url = `https://api.neople.co.kr/df/servers/${SERVER}/characters/${CHAR_ID}/timeline?${qs}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('HTTP', res.status, await res.text());
      break;
    }
    const json = await res.json();
    const rows = json?.timeline?.rows ?? [];
    all.push(...rows);
    next = json?.timeline?.next ?? null;
    pages++;
    if (pages > 30) break;
  } while (next);
  return all;
}

const rows = await fetchAll();
console.log(`[total events pulled last 90d]: ${rows.length}`);

// Code histogram
const byCode = {};
for (const r of rows) byCode[r.code] = (byCode[r.code] ?? 0) + 1;
console.log('\n[events per code]');
console.log(Object.entries(byCode).sort((a,b)=>a[0]-b[0]).map(([c,n])=>`  code ${c} : ${n}  (${rows.find(r=>r.code==c)?.name ?? ''})`).join('\n'));

// Pick pact/soul related
const KEYWORDS = ['서약', '광휘 결정'];
const hits = rows.filter(r => {
  const s = JSON.stringify(r);
  return KEYWORDS.some(k => s.includes(k));
});

console.log(`\n[pact / soul related events]: ${hits.length}`);
console.log('\n[unique rarities seen]:',
  [...new Set(hits.map(r => r?.data?.itemRarity).filter(Boolean))]);
console.log('\n[sample event keys union]:',
  [...new Set(hits.flatMap(r => Object.keys(r?.data ?? {})))]);

// Dump 5 samples, grouped by code
const samplesByCode = {};
for (const r of hits) {
  samplesByCode[r.code] ??= [];
  if (samplesByCode[r.code].length < 3) samplesByCode[r.code].push(r);
}
console.log('\n[up to 3 samples per code with 서약/결정 hits]');
for (const [code, arr] of Object.entries(samplesByCode)) {
  console.log(`\n--- code ${code} (${arr[0].name}) ---`);
  for (const r of arr) console.log(JSON.stringify(r, null, 2));
}

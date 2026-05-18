// Find where gear-set activation thresholds live in Neople API.
// Strategy:
//  1) Hit /df/setitems list — see what summary fields exist.
//  2) For a handful of distinct setItemIds, fetch /setitems/:id and inspect:
//     - is setItemOption[] multi-entry? (= tiered)
//     - is there a per-tier setPoint / activeCount / threshold field?
//     - does the explain text mention numeric thresholds outside 강화 합?
import fs from 'node:fs';
import path from 'node:path';
for (const f of ['.env.local']) {
  for (const line of fs.readFileSync(path.resolve(f),'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"'))) v = v.slice(1,-1);
      process.env[m[1]] = v;
    }
  }
}
const KEY = process.env.NEOPLE_API_KEY;
const BASE = 'https://api.neople.co.kr/df';
async function get(p) {
  const r = await fetch(`${BASE}${p}${p.includes('?')?'&':'?'}apikey=${KEY}`);
  return { status: r.status, json: r.ok ? await r.json() : null, body: r.ok ? null : await r.text() };
}

// 1) /setitems list — paginated. Just see fields on first page.
console.log('=== /setitems (list) — first 3 rows ===');
const list = await get('/setitems?limit=10');
if (list.json) {
  console.log('top keys:', Object.keys(list.json));
  const rows = list.json?.rows ?? [];
  console.log('row sample fields:', rows.length ? Object.keys(rows[0]) : '(none)');
  for (const r of rows.slice(0,3)) console.log(' -', r.setItemId, '|', r.setItemName);
}

// 2) probe a handful of distinct setItemIds — including the test char's + some other top-of-list
const targetIds = [
  '7f788a703a87d783079b41d0fe6448c9',  // 영원히 이어지는 황금향 (test char)
];
for (const r of (list.json?.rows ?? []).slice(0, 6)) {
  if (r.setItemId && !targetIds.includes(r.setItemId)) targetIds.push(r.setItemId);
}

for (const id of targetIds) {
  console.log(`\n\n=== /setitems/${id} ===`);
  const { json, body } = await get(`/setitems/${id}`);
  if (!json) { console.log('ERROR:', body); continue; }
  console.log('name:', json.setItemName);
  console.log('top keys:', Object.keys(json));
  console.log('setItems count:', json.setItems?.length);
  console.log('setItemOption is array? len=', Array.isArray(json.setItemOption) ? json.setItemOption.length : 'no');
  if (Array.isArray(json.setItemOption)) {
    json.setItemOption.forEach((opt, i) => {
      console.log(`\n  -- option[${i}] keys:`, Object.keys(opt));
      // Print every field except long explain text (just length)
      for (const [k, v] of Object.entries(opt)) {
        if (typeof v === 'string' && v.length > 80) console.log(`     ${k}: <string ${v.length}ch>  startsWith: ${JSON.stringify(v.slice(0,60))}`);
        else console.log(`     ${k}:`, typeof v === 'object' ? JSON.stringify(v) : v);
      }
    });
  }
}

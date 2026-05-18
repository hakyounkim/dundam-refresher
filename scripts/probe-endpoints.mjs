// Diagnostic: confirm character existence + try every plausible equip endpoint path.
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
const SERVER  = 'casillas';
const CHAR_ID = '56a81575c814e829392349dfa43e80e6';
const BASE = 'https://api.neople.co.kr/df';

async function probe(p) {
  const url = `${BASE}${p}${p.includes('?') ? '&' : '?'}apikey=${API_KEY}`;
  const r = await fetch(url);
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch {}
  return { status: r.status, body: json ?? txt.slice(0, 200) };
}

const paths = [
  `/servers/${SERVER}/characters/${CHAR_ID}`,
  `/servers/${SERVER}/characters/${CHAR_ID}/status`,
  `/servers/${SERVER}/characters/${CHAR_ID}/equip/equipment`,
  `/servers/${SERVER}/characters/${CHAR_ID}/equip/avatar`,
  `/servers/${SERVER}/characters/${CHAR_ID}/equip/creature`,
  `/servers/${SERVER}/characters/${CHAR_ID}/equip/oath`,
  `/servers/${SERVER}/characters/${CHAR_ID}/equip/mist-assimilation`,
  `/servers/${SERVER}/characters/${CHAR_ID}/equip/setitem-info`,
  `/servers/${SERVER}/characters/${CHAR_ID}/equip/title`,
  `/servers/${SERVER}/characters/${CHAR_ID}/equip/talisman`,
  `/servers/${SERVER}/characters/${CHAR_ID}/skill/style`,
  `/servers/${SERVER}/characters/${CHAR_ID}/skill/buff/equip/equipment`,
  `/servers/${SERVER}/characters/${CHAR_ID}/skill/buff/equip/avatar`,
  `/servers/${SERVER}/characters/${CHAR_ID}/skill/buff/equip/creature`,
];

for (const p of paths) {
  const { status, body } = await probe(p);
  console.log(`\n[${status}] ${p}`);
  if (status === 200) {
    // print top-level shape
    if (body && typeof body === 'object') {
      const keys = Object.keys(body);
      console.log('  keys:', keys);
      for (const k of keys) {
        const v = body[k];
        if (Array.isArray(v)) console.log(`    ${k}: array(${v.length})`);
        else if (v && typeof v === 'object') console.log(`    ${k}: object{${Object.keys(v).join(',')}}`);
        else console.log(`    ${k}: ${v}`);
      }
    } else {
      console.log('  body:', body);
    }
  } else {
    console.log('  body:', body);
  }
}

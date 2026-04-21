import { requireDb } from './_db.js';

// 갱신기와 동일하게 server=adven 로 모든 서버의 같은 모험단을 한 번에 가져온다.
async function dundamSearch(adventureName) {
  const url = `https://dundam.xyz/dat/searchData.jsp?name=${encodeURIComponent(adventureName)}&server=adven`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/plain, */*' },
    body: '{}',
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`dundam ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text.trim());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { adventureName } = req.body ?? {};
  if (!adventureName) return res.status(400).json({ error: 'adventureName required' });

  try {
    const sql = requireDb();
    const data = await dundamSearch(adventureName);
    const rows = (data.characters ?? []).filter(c => c.server && c.key);

    if (!rows.length) {
      return res.status(404).json({
        error: '모험단을 찾지 못했습니다',
        adventureName,
      });
    }

    // 같은 모험단명이 여러 서버에 존재할 수 있으므로 서버별로 adventures 행을 upsert.
    const servers = [...new Set(rows.map(c => c.server))];
    for (const serverId of servers) {
      await sql`
        INSERT INTO adventures (adventure_name, server_id)
        VALUES (${adventureName}, ${serverId})
        ON CONFLICT (adventure_name, server_id) DO NOTHING
      `;
    }

    for (const c of rows) {
      await sql`
        INSERT INTO characters (character_id, adventure_name, server_id, character_name, job_grow_name, fame)
        VALUES (${c.key}, ${adventureName}, ${c.server}, ${c.name}, ${c.job ?? null}, ${c.fame ?? null})
        ON CONFLICT (character_id) DO UPDATE SET
          character_name = EXCLUDED.character_name,
          job_grow_name  = EXCLUDED.job_grow_name,
          fame           = EXCLUDED.fame,
          server_id      = EXCLUDED.server_id,
          adventure_name = EXCLUDED.adventure_name
      `;
    }

    return res.status(200).json({
      adventureName,
      servers,
      characterCount: rows.length,
      characters: rows.map(c => ({
        characterId: c.key,
        serverId: c.server,
        characterName: c.name,
        jobGrowName: c.job,
        fame: c.fame,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

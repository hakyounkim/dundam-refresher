import { requireDb } from './_db.js';
import { fetchTimelinePages, parseKSTDate } from './_neople.js';
import { classify } from './_classify.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const API_KEY = process.env.NEOPLE_API_KEY?.trim();
  if (!API_KEY) return res.status(500).json({ error: 'NEOPLE_API_KEY not configured' });

  const { characterId } = req.body ?? {};
  if (!characterId) return res.status(400).json({ error: 'characterId required' });

  const sql = requireDb();
  const startedAt = new Date();

  try {
    const [char] = await sql`
      SELECT character_id, adventure_name, server_id, character_name, last_timeline_at
      FROM characters WHERE character_id = ${characterId}
    `;
    if (!char) return res.status(404).json({ error: '등록되지 않은 캐릭터' });

    const now = new Date();
    const MAX_LOOKBACK_MS = 90 * 24 * 3600 * 1000;
    const fromWall = char.last_timeline_at ? new Date(char.last_timeline_at) : new Date(now.getTime() - MAX_LOOKBACK_MS);
    // Neople은 최대 90일까지만 조회 가능
    const floor = new Date(now.getTime() - MAX_LOOKBACK_MS);
    const startDate = fromWall < floor ? floor : fromWall;

    const rows = await fetchTimelinePages({
      apiKey: API_KEY, serverId: char.server_id, characterId,
      startDate, endDate: now,
    });

    let inserted = 0;
    let skipped = 0;
    for (const r of rows) {
      const cls = classify(r);
      if (!cls) { skipped++; continue; }
      const d = r.data ?? {};
      const occurredAt = parseKSTDate(r.date);
      if (!occurredAt) { skipped++; continue; }

      const result = await sql`
        INSERT INTO timeline_events
          (character_id, occurred_at, event_code, event_name,
           item_id, item_name, item_rarity, item_category,
           channel_no, channel_name, dungeon_name, mist_gear, raw)
        VALUES
          (${characterId}, ${occurredAt.toISOString()}, ${r.code}, ${r.name},
           ${d.itemId}, ${d.itemName}, ${d.itemRarity}, ${cls.item_category},
           ${d.channelNo ?? null}, ${d.channelName ?? null}, ${d.dungeonName ?? null},
           ${Boolean(d.mistGear)}, ${JSON.stringify(r)}::jsonb)
        ON CONFLICT (character_id, occurred_at, event_code, item_id) DO NOTHING
        RETURNING id
      `;
      if (result.length) inserted++;
    }

    await sql`
      UPDATE characters SET last_timeline_at = ${now.toISOString()}
      WHERE character_id = ${characterId}
    `;
    await sql`
      UPDATE adventures SET last_sync_at = ${now.toISOString()}
      WHERE adventure_name = ${char.adventure_name} AND server_id = ${char.server_id}
    `;

    await sql`
      INSERT INTO sync_logs
        (adventure_name, server_id, character_id, started_at, ended_at, from_date, to_date, event_count, status)
      VALUES
        (${char.adventure_name}, ${char.server_id}, ${characterId},
         ${startedAt.toISOString()}, ${new Date().toISOString()},
         ${startDate.toISOString()}, ${now.toISOString()}, ${inserted}, 'ok')
    `;

    return res.status(200).json({
      characterId,
      characterName: char.character_name,
      fetchedEventCount: rows.length,
      insertedCount: inserted,
      skippedCount: skipped,
      from: startDate.toISOString(),
      to: now.toISOString(),
    });
  } catch (e) {
    console.error(e);
    try {
      await sql`
        INSERT INTO sync_logs (character_id, started_at, ended_at, status, error_message)
        VALUES (${characterId}, ${startedAt.toISOString()}, ${new Date().toISOString()}, 'error', ${e.message})
      `;
    } catch {}
    return res.status(500).json({ error: e.message });
  }
}

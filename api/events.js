import { requireDb } from './_db.js';

// GET /api/events?adventureName=&serverId=&rarity=태초,에픽&category=pact,soul
//                &from=ISO&to=ISO&characterId=&limit=500
// serverId 는 옵션. 생략하면 모든 서버의 동일 모험단 캐릭을 함께 조회.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const sql = requireDb();
    const {
      adventureName, serverId, characterId,
      rarity = '태초,에픽',
      category = 'pact,soul',
      from, to,
      limit = '500',
    } = req.query ?? {};

    const rarities   = rarity.split(',').map(s => s.trim()).filter(Boolean);
    const categories = category.split(',').map(s => s.trim()).filter(Boolean);
    const lim = Math.min(parseInt(limit, 10) || 500, 2000);

    if (!adventureName && !characterId) {
      return res.status(400).json({ error: 'adventureName 또는 characterId 중 하나 필요' });
    }

    let rows;
    if (characterId) {
      rows = await sql`
        SELECT e.*, c.character_name, c.job_grow_name, c.adventure_name, c.server_id
        FROM timeline_events e
        JOIN characters c ON c.character_id = e.character_id
        WHERE e.character_id = ${characterId}
          AND e.item_rarity   = ANY(${rarities})
          AND e.item_category = ANY(${categories})
          AND (${from ?? null}::timestamptz IS NULL OR e.occurred_at >= ${from ?? null}::timestamptz)
          AND (${to   ?? null}::timestamptz IS NULL OR e.occurred_at <= ${to   ?? null}::timestamptz)
        ORDER BY e.occurred_at DESC
        LIMIT ${lim}
      `;
    } else if (serverId) {
      rows = await sql`
        SELECT e.*, c.character_name, c.job_grow_name, c.adventure_name, c.server_id
        FROM timeline_events e
        JOIN characters c ON c.character_id = e.character_id
        WHERE c.adventure_name = ${adventureName}
          AND c.server_id      = ${serverId}
          AND e.item_rarity    = ANY(${rarities})
          AND e.item_category  = ANY(${categories})
          AND (${from ?? null}::timestamptz IS NULL OR e.occurred_at >= ${from ?? null}::timestamptz)
          AND (${to   ?? null}::timestamptz IS NULL OR e.occurred_at <= ${to   ?? null}::timestamptz)
        ORDER BY e.occurred_at DESC
        LIMIT ${lim}
      `;
    } else {
      rows = await sql`
        SELECT e.*, c.character_name, c.job_grow_name, c.adventure_name, c.server_id
        FROM timeline_events e
        JOIN characters c ON c.character_id = e.character_id
        WHERE c.adventure_name = ${adventureName}
          AND e.item_rarity    = ANY(${rarities})
          AND e.item_category  = ANY(${categories})
          AND (${from ?? null}::timestamptz IS NULL OR e.occurred_at >= ${from ?? null}::timestamptz)
          AND (${to   ?? null}::timestamptz IS NULL OR e.occurred_at <= ${to   ?? null}::timestamptz)
        ORDER BY e.occurred_at DESC
        LIMIT ${lim}
      `;
    }

    // 집계: 채널별, 획득경로(code)별
    const byChannel = {};
    const byCode = {};
    for (const r of rows) {
      if (r.channel_name) byChannel[r.channel_name] = (byChannel[r.channel_name] ?? 0) + 1;
      const label = pathLabel(r.event_code);
      byCode[label] = (byCode[label] ?? 0) + 1;
    }

    return res.status(200).json({
      count: rows.length,
      rows,
      stats: { byChannel, byCode },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

function pathLabel(code) {
  switch (Number(code)) {
    case 550: return '드랍';
    case 551: return '레이드 카드';
    case 552: return '항아리/상자';
    case 554: return '제작서';
    case 557: return '상급던전 카드';
    default:  return `code ${code}`;
  }
}

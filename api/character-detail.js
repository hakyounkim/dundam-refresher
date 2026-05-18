import './_env.js';
import { evaluateSetPoint, inferEquippedSet } from './_set-thresholds.js';

const BASE = 'https://api.neople.co.kr/df';

async function fetchNeople(apiKey, path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}apikey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Neople ${res.status} ${path.split('?')[0]}: ${text.slice(0, 180)}`);
  }
  return res.json();
}

// GET /api/character-detail?serverId=&characterId=&extras=oath,mist,avatar,creature,buff,setitems
//   기본:    basic / status / equipment  (가벼움)
//   extras:  콤마-구분으로 선택 로드. setitems는 equipment의 setItemId를 한번에 multi 호출.
//   응답에 항상: equippedSet (착용 세트 요약), setEval (세트포인트 활성 단계 평가)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=30');

  const API_KEY = process.env.NEOPLE_API_KEY?.trim();
  if (!API_KEY) return res.status(500).json({ error: 'NEOPLE_API_KEY not configured' });

  const { serverId, characterId, extras = '' } = req.query ?? {};
  if (!serverId || !characterId) {
    return res.status(400).json({ error: 'serverId and characterId required' });
  }
  const want = new Set(String(extras).split(',').map(s => s.trim()).filter(Boolean));

  try {
    const basePath = `/servers/${serverId}/characters/${characterId}`;

    const tasks = {
      basic:     fetchNeople(API_KEY, basePath),
      status:    fetchNeople(API_KEY, `${basePath}/status`),
      equipment: fetchNeople(API_KEY, `${basePath}/equip/equipment`),
    };
    if (want.has('avatar'))   tasks.avatar   = fetchNeople(API_KEY, `${basePath}/equip/avatar`);
    if (want.has('creature')) tasks.creature = fetchNeople(API_KEY, `${basePath}/equip/creature`);
    if (want.has('oath'))     tasks.oath     = fetchNeople(API_KEY, `${basePath}/equip/oath`);
    if (want.has('mist'))     tasks.mist     = fetchNeople(API_KEY, `${basePath}/equip/mist-assimilation`);
    if (want.has('buff'))     tasks.buff     = fetchNeople(API_KEY, `${basePath}/skill/buff/equip/equipment`);

    const keys = Object.keys(tasks);
    const settled = await Promise.allSettled(Object.values(tasks));
    const out = {}, errors = {};
    keys.forEach((k, i) => {
      const r = settled[i];
      if (r.status === 'fulfilled') out[k] = r.value;
      else errors[k] = r.reason?.message ?? String(r.reason);
    });

    const equipment = out.equipment?.equipment ?? [];

    // 2차: equipment의 setItemId들을 한 번에
    let setitems = null;
    if (want.has('setitems') && equipment.length) {
      const setIds = [...new Set(equipment.map(e => e.setItemId).filter(Boolean))];
      if (setIds.length) {
        try {
          const ids = setIds.slice(0, 15).join(',');
          const r = await fetchNeople(API_KEY, `/multi/setitems?setItemIds=${ids}`);
          setitems = r?.rows ?? r?.setItems ?? r;
        } catch (e) { errors.setitems = e.message; }
      }
    }

    return res.status(200).json({
      serverId,
      characterId,
      basic:        out.basic    ?? null,
      status:       out.status   ?? null,
      equipment,
      equippedSet:  inferEquippedSet(equipment),
      setEval:      evaluateSetPoint(equipment),
      avatar:       out.avatar?.avatar             ?? null,
      creature:     out.creature?.creature         ?? null,
      oath:         out.oath?.oath                 ?? null,
      mist:         out.mist?.mistAssimilation     ?? null,
      buff:         out.buff?.skill?.buff          ?? null,
      setitems,
      errors,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

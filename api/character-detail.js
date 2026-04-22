import './_env.js';

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

// GET /api/character-detail?serverId=cain&characterId=...
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=30');

  const API_KEY = process.env.NEOPLE_API_KEY?.trim();
  if (!API_KEY) return res.status(500).json({ error: 'NEOPLE_API_KEY not configured' });

  const { serverId, characterId } = req.query ?? {};
  if (!serverId || !characterId) {
    return res.status(400).json({ error: 'serverId and characterId required' });
  }

  try {
    const basePath = `/servers/${serverId}/characters/${characterId}`;
    const [basic, status, equipment] = await Promise.allSettled([
      fetchNeople(API_KEY, basePath),
      fetchNeople(API_KEY, `${basePath}/status`),
      fetchNeople(API_KEY, `${basePath}/equip/equipment`),
    ]);

    const unwrap = r => r.status === 'fulfilled' ? r.value : null;
    const errOf  = r => r.status === 'rejected' ? r.reason?.message : null;

    return res.status(200).json({
      serverId,
      characterId,
      basic:     unwrap(basic),
      status:    unwrap(status),
      equipment: unwrap(equipment)?.equipment ?? [],
      errors: {
        basic:     errOf(basic),
        status:    errOf(status),
        equipment: errOf(equipment),
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

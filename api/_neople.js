const BASE = 'https://api.neople.co.kr/df';

export const PACT_EVENT_CODES = [550, 551, 552, 554, 557];

// 'YYYYMMDDTHHMM' (KST)
export function fmtKST(d) {
  const kst = new Date(d.getTime() + 9 * 3600_000);
  const p = n => String(n).padStart(2, '0');
  return `${kst.getUTCFullYear()}${p(kst.getUTCMonth() + 1)}${p(kst.getUTCDate())}T${p(kst.getUTCHours())}${p(kst.getUTCMinutes())}`;
}

// 'YYYY-MM-DD HH:mm' (KST, as Neople returns) → ISO UTC Date
export function parseKSTDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) return new Date(s);
  const [, y, mo, d, h, mi] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h - 9, +mi));
}

export async function searchAdventureCharacters({ apiKey, serverId, adventureName }) {
  const qs = new URLSearchParams({
    characterName: adventureName,   // Neople requires characterName; wordType + adventureName filters the list
    adventureName,
    wordType: 'match',
    limit: '200',
    apikey: apiKey,
  });
  const url = `${BASE}/servers/${serverId}/characters?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Neople characters ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json?.rows ?? [];
}

// Fallback: try with only adventureName (no characterName) if the above returns empty
export async function searchAdventureCharactersAlt({ apiKey, serverId, adventureName }) {
  const qs = new URLSearchParams({
    adventureName,
    wordType: 'match',
    limit: '200',
    apikey: apiKey,
  });
  const url = `${BASE}/servers/${serverId}/characters?${qs}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Neople characters(alt) ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json?.rows ?? [];
}

export async function fetchTimelinePages({ apiKey, serverId, characterId, startDate, endDate, codes = PACT_EVENT_CODES, maxPages = 20 }) {
  const all = [];
  let next = null;
  let pages = 0;
  do {
    const qs = new URLSearchParams({
      startDate: fmtKST(startDate),
      endDate:   fmtKST(endDate),
      limit: '100',
      code: codes.join(','),
      apikey: apiKey,
    });
    if (next) qs.set('next', next);
    const url = `${BASE}/servers/${serverId}/characters/${characterId}/timeline?${qs}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Neople timeline ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const rows = json?.timeline?.rows ?? [];
    all.push(...rows);
    next = json?.timeline?.next ?? null;
    pages++;
  } while (next && pages < maxPages);
  return all;
}

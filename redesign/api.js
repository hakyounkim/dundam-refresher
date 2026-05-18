// ════════════════════════════════════════════════════════════
//  DF Console — Live API wrapper
//  실서비스 백엔드(/api/*)를 호출. CORS는 백엔드에 이미 열려있음.
// ════════════════════════════════════════════════════════════

window.API = (function(){

// 같은 도메인 배포면 상대경로 / 외부에서 띄우면 절대 URL
const API_BASE = (location.hostname === 'dundam-refresher.vercel.app' || location.hostname === 'localhost')
  ? ''
  : 'https://dundam-refresher.vercel.app';

async function fetchJson(path, opts = {}) {
  const res = await fetch(API_BASE + path, opts);
  let json;
  try { json = await res.json(); } catch { json = {}; }
  if (!res.ok) throw new Error(json.error || `${res.status} ${res.statusText}`);
  return json;
}

const SERVER_KR = {
  cain:'카인', diregie:'디레지에', siroco:'시로코', prey:'프레이',
  casillas:'카시야스', hilder:'힐더', anton:'안톤', bakal:'바칼',
};

// ── 모험단 검색·등록 ──
// POST /api/adventure-register {adventureName}
// → {adventureName, servers, characterCount, characters:[{characterId,serverId,characterName,jobGrowName,fame}]}
async function registerAdventure(adventureName) {
  return fetchJson('/api/adventure-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adventureName }),
  });
}

// ── 개별 캐릭 상세 ──
// GET /api/character-detail?serverId=&characterId=
// → {basic, status, equipment, errors}
async function characterDetail(serverId, characterId) {
  return fetchJson(`/api/character-detail?serverId=${encodeURIComponent(serverId)}&characterId=${encodeURIComponent(characterId)}`);
}

// ── 드랍 이벤트 ──
async function events({ adventureName, characterId, rarity = '태초,에픽', category = 'pact,soul', limit = 200 }) {
  const qs = new URLSearchParams({ rarity, category, limit: String(limit) });
  if (adventureName) qs.set('adventureName', adventureName);
  if (characterId)   qs.set('characterId', characterId);
  return fetchJson(`/api/events?${qs}`);
}

// ── 캐릭 동기화 (드랍 timeline DB 적재) ──
async function characterSync(characterId) {
  return fetchJson('/api/character-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId }),
  });
}

// ── 던담 갱신 트리거 ── (refresh.js uses query params, not body)
async function refresh(server, key) {
  const qs = new URLSearchParams({ server, key });
  return fetchJson(`/api/refresh?${qs}`, { method: 'POST' });
}

// ── 계시 환산 ──
async function soul() {
  return fetchJson('/api/soul');
}

// ════════════════════════════════════════════════════════════
//  Derived helpers — equipment에서 세트/버퍼 여부 등 파생
// ════════════════════════════════════════════════════════════

// 방어구 5부위에서 가장 많이 겹치는 set name (착용 세트)
const ARMOR_SLOTS = new Set(['SHOULDER','JACKET','PANTS','WAIST','SHOES']);
function inferSet(equipment) {
  if (!Array.isArray(equipment) || !equipment.length) return null;
  const counts = {};
  equipment.forEach(e => {
    if (ARMOR_SLOTS.has(e.slotId) && e.setItemName) {
      counts[e.setItemName] = (counts[e.setItemName] || 0) + 1;
    }
  });
  const entries = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  if (!entries.length) return { name: '세트 없음', count: 0, total: 5 };
  return { name: entries[0][0], count: entries[0][1], total: 5 };
}

// 버퍼 캐릭터 여부 — status.status[].name === '버프력' 존재 여부
function isBuffChar(detail) {
  const stats = detail?.status?.status ?? [];
  const buffPower = stats.find(s => s.name === '버프력');
  return !!buffPower && Number(buffPower.value) > 0;
}

// 명성/주요 스탯 추출
function pickStat(detail, name) {
  return detail?.status?.status?.find(s => s.name === name)?.value;
}

// 서약 데이터 (현재 백엔드에 없음 → 일단 null 반환, 추후 API 연결)
// TODO: /api/character-pact?serverId=&characterId= 추가되면 여기서 조회
function getPact(detail) {
  return null;
}

return {
  API_BASE,
  SERVER_KR,
  registerAdventure,
  characterDetail,
  events,
  characterSync,
  refresh,
  soul,
  inferSet,
  isBuffChar,
  pickStat,
  getPact,
};

})();

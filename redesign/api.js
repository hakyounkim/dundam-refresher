// ════════════════════════════════════════════════════════════
//  DF Console — Live API wrapper
//  실서비스 백엔드(/api/*)를 호출. CORS는 백엔드에서 열려있음.
// ════════════════════════════════════════════════════════════

window.API = (function(){

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
async function registerAdventure(adventureName) {
  return fetchJson('/api/adventure-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adventureName }),
  });
}

// ── 개별 캐릭 상세 ──
// extras 예: ['oath','setitems','mist','avatar','creature','buff']
// 응답: { basic, status, equipment, equippedSet, setEval, [extras...], errors }
async function characterDetail(serverId, characterId, extras = []) {
  const qs = new URLSearchParams({ serverId, characterId });
  const arr = Array.isArray(extras) ? extras : String(extras).split(',').filter(Boolean);
  if (arr.length) qs.set('extras', arr.join(','));
  return fetchJson(`/api/character-detail?${qs}`);
}

// ── 드랍 이벤트 ──
async function events({ adventureName, characterId, rarity = '태초,에픽', category = 'pact,soul', limit = 200 }) {
  const qs = new URLSearchParams({ rarity, category, limit: String(limit) });
  if (adventureName) qs.set('adventureName', adventureName);
  if (characterId)   qs.set('characterId', characterId);
  return fetchJson(`/api/events?${qs}`);
}

async function characterSync(characterId) {
  return fetchJson('/api/character-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId }),
  });
}

async function refresh(server, key) {
  const qs = new URLSearchParams({ server, key });
  return fetchJson(`/api/refresh?${qs}`, { method: 'POST' });
}

async function soul() {
  return fetchJson('/api/soul');
}

// ════════════════════════════════════════════════════════════
//  Derived helpers — detail 응답에서 필요한 조각만 뽑아 쓰는 셋
// ════════════════════════════════════════════════════════════

// 버퍼 캐릭 여부 — status.status[]에 '버프력' > 0
function isBuffChar(detail) {
  const stats = detail?.status?.status ?? [];
  const bp = stats.find(s => s.name === '버프력');
  return !!bp && Number(bp.value) > 0;
}

// 임의 status 한 줄 값
function pickStat(detail, name) {
  return detail?.status?.status?.find(s => s.name === name)?.value;
}

// 장착 세트 요약 (백엔드가 detail.equippedSet 으로 내려줌)
//   { name, setItemId, pieceCount, rarityBreakdown:{'에픽':N, ...} }
function getEquippedSet(detail) {
  return detail?.equippedSet ?? null;
}

// 세트포인트 활성 단계 평가
//   { current, activeTier:{tier,label,min}|null, nextTier|null, pointsToNext, taechoBonus|null }
function getSetEval(detail) {
  return detail?.setEval ?? null;
}

// 서약 정보 (extras=oath 요청 시에만 들어옴)
//   info:    서약 본체 (itemName, itemRarity, setPoint, oathUpgrade)
//   crystal: 광휘결정 슬롯 배열 (최대 11)
//   setInfo: 서약 세트 (setName, setOptionName, setRarityName, active{setPoint:{current,min,max}, status})
//   blessing: 축복 status
function getOath(detail) {
  const o = detail?.oath;
  if (!o) return null;
  return {
    info:     o.info     ?? null,
    crystal:  o.crystal  ?? [],
    setInfo:  o.setInfo  ?? null,
    blessing: o.blessing ?? null,
  };
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
  isBuffChar,
  pickStat,
  getEquippedSet,
  getSetEval,
  getOath,
};

})();

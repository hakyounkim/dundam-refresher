// ════════════════════════════════════════════════════════════
//  DF Console — Live API wrapper
//  실서비스 백엔드(/api/*)를 호출. CORS는 백엔드에 이미 열려있음.
//  스펙: docs/character-detail-api.md
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
async function registerAdventure(adventureName) {
  return fetchJson('/api/adventure-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adventureName }),
  });
}

// ── 개별 캐릭 상세 ──
// extras 기본값: oath (서약 카드 그리기 위해)
// 풀세트 텍스트가 필요한 화면(상세 모달 등)에서는 setitems 추가
async function characterDetail(serverId, characterId, extras = ['oath']) {
  const ext = Array.isArray(extras) ? extras.join(',') : (extras || '');
  const qs = new URLSearchParams({ serverId, characterId });
  if (ext) qs.set('extras', ext);
  return fetchJson(`/api/character-detail?${qs}`);
}

// ── 드랍 이벤트 ──
async function events({ adventureName, characterId, rarity = '태초,에픽', category = 'pact,soul,gear', limit = 200 }) {
  const qs = new URLSearchParams({ rarity, category, limit: String(limit) });
  if (adventureName) qs.set('adventureName', adventureName);
  if (characterId)   qs.set('characterId', characterId);
  return fetchJson(`/api/events?${qs}`);
}

// ── 캐릭 동기화 (드랍 timeline DB 적재) ──
async function characterSync(characterId, { force = false } = {}) {
  return fetchJson('/api/character-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, force }),
  });
}

// ── 던담 갱신 트리거 ──
async function refresh(server, key) {
  const qs = new URLSearchParams({ server, key });
  return fetchJson(`/api/refresh?${qs}`, { method: 'POST' });
}

// ── 계시 환산 ──
async function soul() {
  return fetchJson('/api/soul');
}

// ════════════════════════════════════════════════════════════
//  Derived helpers — 백엔드가 내려주는 값을 그대로 꺼내쓰기
// ════════════════════════════════════════════════════════════

// 착용 세트 요약 (백엔드 신규 필드)
// → { name, setItemId, pieceCount, rarityBreakdown:{등급:N} } | null
function getEquippedSet(detail) {
  return detail?.equippedSet ?? null;
}

// 세트포인트 활성 단계 (백엔드 신규 필드, 핵심)
// → { current, activeTier:{tier,label,min}|null, nextTier|null, pointsToNext, taechoBonus|null } | null
function getSetEval(detail) {
  return detail?.setEval ?? null;
}

// 서약 데이터 (extras=oath 필요)
// → { info, crystal[], setInfo, blessing } | null
function getOath(detail) {
  return detail?.oath ?? null;
}

// 안개 융화
function getMist(detail) {
  return detail?.mist ?? null;
}

// 버퍼 캐릭터 여부 — '버프력' > 0
function isBuffChar(detail) {
  const buffPower = pickStat(detail, '버프력');
  return Number(buffPower) > 0;
}

// 명성/주요 스탯 추출
function pickStat(detail, name) {
  return detail?.status?.status?.find(s => s.name === name)?.value;
}

// 자주 쓰는 핵심 스탯 한 묶음
function coreStats(detail) {
  return {
    fame:        pickStat(detail, '모험가 명성'),
    finalDmgInc: pickStat(detail, '최종 데미지 증가'),
    atkInc:      pickStat(detail, '공격력 증가'),
    atkAmp:      pickStat(detail, '공격력 증폭'),
    critPhys:    pickStat(detail, '물리 크리티컬'),
    critMag:     pickStat(detail, '마법 크리티컬'),
    buffPower:   pickStat(detail, '버프력'),
    cooldown:    pickStat(detail, '최종 쿨타임 감소율') ?? pickStat(detail, '쿨타임 감소'),
    fireEl:      pickStat(detail, '화속성 강화'),
    iceEl:       pickStat(detail, '수속성 강화'),
    lightEl:     pickStat(detail, '명속성 강화'),
    darkEl:      pickStat(detail, '암속성 강화'),
  };
}

// 단계(tier) → 색상 키 매핑 ('rare' / 'unique' / 'legendary' / 'epic' / 'taecho')
// activeTier.tier가 'unique-3' 같은 식이라 prefix만 사용
function tierColorKey(tier) {
  if (!tier) return null;
  return String(tier).split('-')[0];
}

// 12개 세트군 아이콘 매핑 (로컬 호스팅: /img/set/{N}.png)
// 원본은 던담(dundam.xyz/img/lv115/set/{N}.png)에서 받아 프로젝트 루트에 보관 — 핫링크 피하려고 자체 서빙.
// 세트 이름 + 서약 옵션 이름까지 같이 매칭 (서약 3개 = 세트 1개와 같은 아이콘)
const DUNDAM_SET_ICONS = [
  { n: 1,  keys: ['황금향', '끝나지 않은 꿈', '황금의 세계', '숭배하라'] },
  { n: 2,  keys: ['칠흑의 정화', '칠흑', '심연의 타락', '찬란한 정화', '혼돈의 운명', '혼돈'] },
  { n: 3,  keys: ['세렌디피티', '찬란한 운명', '일궈낸 운명'] },
  { n: 4,  keys: ['한계를 넘어선 에너지', '한계를 넘어선', '압도적인 힘', '무한동력', '오버로드'] },
  { n: 5,  keys: ['소울 페어리', '소울페어리', '노블 엠프레스', '로열가드', '페어리 랜드', '페어리'] },
  { n: 6,  keys: ['압도적인 자연', '자연의 벗', '기상 이변', '아마겟돈'] },
  { n: 7,  keys: ['고대 전장의 발키리', '발키리', '종말의 날', '천벌의 날개', '심판의 창'] },
  { n: 8,  keys: ['에텔리어 오브 아츠', '에텔리어', '환상', '초월', '집중'] },
  { n: 9,  keys: ['그림자에 숨은 죽음', '그림자', '배후 습격', '죽음의 형상', '그림자 동화'] },
  { n: 10, keys: ['무리 사냥의 길잡이', '무리 사냥', '고독한 사냥꾼', '길잡이'] },
  { n: 11, keys: ['마력의 영역', '매지컬 프리즘', '미스틱 웨폰', '매직 컨트롤'] },
  { n: 12, keys: ['용투장의 난', '용투장', '용제 강림', '세계를 태우는 불꽃', '싸워야만 하는 운명'] },
];

// 입력 문자열에서 매칭되는 아이콘 번호 찾기
// 우선순위: 더 긴 키워드부터 매칭 (혼돈의 운명 > 혼돈, 찬란한 정화 > 찬란한 운명)
function getDundamSetIconUrl(name) {
  if (!name) return null;
  // 가장 긴 키워드부터 매칭 (구체적 옵션이 먼저)
  const allMatches = [];
  for (const { n, keys } of DUNDAM_SET_ICONS) {
    for (const k of keys) {
      if (name.includes(k)) allMatches.push({ n, k, len: k.length });
    }
  }
  if (!allMatches.length) return null;
  allMatches.sort((a, b) => b.len - a.len);
  return `/img/set/${allMatches[0].n}.png`;
}

// 등급명(한국어) → rarity css class
// "에픽 Ⅲ", "레전더리 Ⅰ", "유니크 Ⅴ" 같은 단계 표기 포함 처리
function rarityClass(rarityKr) {
  if (!rarityKr) return '';
  const base = String(rarityKr).split(/\s+/)[0]; // "에픽 Ⅲ" → "에픽"
  switch (base) {
    case '태초':     return 'r-taecho';
    case '에픽':     return 'r-epic';
    case '레전더리': return 'r-legendary';
    case '유니크':   return 'r-unique';
    case '레어':     return 'r-rare';
    default: return '';
  }
}

// 착용 세트의 대표 아이콘 = equippedSet.setItemId와 매칭되는 첫 방어구 itemId
// (방어구가 없으면 다른 슬롯이라도 매칭되는 첫 item)
const SET_ICON_PRIORITY = ['JACKET', 'PANTS', 'SHOULDER', 'WAIST', 'SHOES', 'AMULET', 'WRIST', 'RING'];
function getSetIconItemId(detail) {
  const set = detail?.equippedSet;
  if (!set?.setItemId) return null;
  const eq = detail?.equipment || [];
  // 1) priority slot 순으로 매칭
  for (const slotId of SET_ICON_PRIORITY) {
    const item = eq.find(e => e.slotId === slotId && e.setItemId === set.setItemId);
    if (item) return item.itemId;
  }
  // 2) fallback: 그냥 매칭되는 첫 아이템
  const any = eq.find(e => e.setItemId === set.setItemId);
  return any?.itemId ?? null;
}

return {
  API_BASE,
  SERVER_KR,
  // endpoints
  registerAdventure,
  characterDetail,
  events,
  characterSync,
  refresh,
  soul,
  // derived
  getEquippedSet,
  getSetEval,
  getOath,
  getMist,
  getSetIconItemId,
  getDundamSetIconUrl,
  isBuffChar,
  pickStat,
  coreStats,
  tierColorKey,
  rarityClass,
};

})();

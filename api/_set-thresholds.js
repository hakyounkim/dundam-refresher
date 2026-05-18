// 던파 장비 세트포인트 단계 + 평가 함수.
//
// 규칙 출처: 넥슨 던파 공식 커뮤니티
//   https://df.nexon.com/community/dnfboard/article/2934739
//   https://df.nexon.com/community/dnfboard/article/2908976
//   - 같은 등급 내 단계 ↑: setPoint +85
//   - 등급 승급:           setPoint +110
//   - 태초(2550) 이후:     +70마다 최종뎀 +1%, 버프력 +100
//   - 1부위당 setPoint:   레어 65 / 유니크 115 / 레전더리 165 / 에픽 215 / 태초 265
//   - 조율 1회 = +10pt (부위당 최대 3회)

export const SET_TIER_THRESHOLDS = [
  { tier: 'rare',        label: '레어',        min: 750  },
  { tier: 'unique-1',    label: '유니크 I',    min: 1200 },
  { tier: 'unique-2',    label: '유니크 II',   min: 1285 },
  { tier: 'unique-3',    label: '유니크 III',  min: 1370 },
  { tier: 'unique-4',    label: '유니크 IV',   min: 1455 },
  { tier: 'unique-5',    label: '유니크 V',    min: 1540 },
  { tier: 'legendary-1', label: '레전더리 I',  min: 1650 },
  { tier: 'legendary-2', label: '레전더리 II', min: 1735 },
  { tier: 'legendary-3', label: '레전더리 III',min: 1820 },
  { tier: 'legendary-4', label: '레전더리 IV', min: 1905 },
  { tier: 'legendary-5', label: '레전더리 V',  min: 1990 },
  { tier: 'epic-1',      label: '에픽 I',      min: 2100 },
  { tier: 'epic-2',      label: '에픽 II',     min: 2185 },
  { tier: 'epic-3',      label: '에픽 III',    min: 2270 },
  { tier: 'epic-4',      label: '에픽 IV',     min: 2355 },
  { tier: 'epic-5',      label: '에픽 V',      min: 2440 },
  { tier: 'taecho',      label: '태초',        min: 2550 },
];

const TAECHO_MIN  = 2550;
const TAECHO_STEP = 70;

export const PER_PIECE_SET_POINT = Object.freeze({
  '레어': 65, '유니크': 115, '레전더리': 165, '에픽': 215, '태초': 265,
});

// equipment 응답 → 현재 setPoint 및 활성/다음 단계
export function evaluateSetPoint(equipment) {
  const list = Array.isArray(equipment) ? equipment : [];
  const current = list.reduce((s, e) => s + (e?.tune?.[0]?.setPoint ?? 0), 0);

  let activeTier = null;
  let nextTier   = null;
  for (const t of SET_TIER_THRESHOLDS) {
    if (current >= t.min) activeTier = t;
    else { nextTier = t; break; }
  }

  const bonusSteps = current >= TAECHO_MIN ? Math.floor((current - TAECHO_MIN) / TAECHO_STEP) : 0;
  return {
    current,
    activeTier,
    nextTier,
    pointsToNext: nextTier ? nextTier.min - current : 0,
    taechoBonus: bonusSteps > 0
      ? { steps: bonusSteps, finalDamageBonusPct: bonusSteps, buffPowerBonus: bonusSteps * 100 }
      : null,
  };
}

// 장착한 세트 추론 — 가장 많은 부위 차지하는 setItemId 기준
export function inferEquippedSet(equipment) {
  if (!Array.isArray(equipment) || !equipment.length) return null;
  const buckets = new Map();
  for (const e of equipment) {
    if (!e?.setItemId || !e?.setItemName) continue;
    if (!buckets.has(e.setItemId)) {
      buckets.set(e.setItemId, { setItemId: e.setItemId, name: e.setItemName, pieces: [] });
    }
    buckets.get(e.setItemId).pieces.push(e);
  }
  if (!buckets.size) return null;

  const [top] = [...buckets.values()].sort((a, b) => b.pieces.length - a.pieces.length);
  const rarityBreakdown = top.pieces.reduce((acc, e) => {
    if (e.itemRarity) acc[e.itemRarity] = (acc[e.itemRarity] || 0) + 1;
    return acc;
  }, {});
  return {
    name: top.name,
    setItemId: top.setItemId,
    pieceCount: top.pieces.length,
    rarityBreakdown,
  };
}

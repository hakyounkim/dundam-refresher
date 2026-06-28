// 수집 대상 아이템 분류. 확장 시 여기에 규칙만 추가.
// 반환 null 이면 "수집 제외".
//
// 현재 규칙:
//   서약·결정 코드(550~557): 태초/에픽 + (이름 ~서약 → 'pact' | ~광휘 결정 → 'soul')
//   장비 드랍 코드(504/505/507/513): 태초만 → 'gear'  (에픽은 스팸성이라 제외)
//   그 외 코드/등급/아이템은 제외.

import { PACT_EVENT_CODES, GEAR_EVENT_CODES } from './_neople.js';

const PACT_CODES = new Set(PACT_EVENT_CODES);
const GEAR_CODES = new Set(GEAR_EVENT_CODES);

export function classify(evt) {
  const code = Number(evt?.code);
  const d = evt?.data ?? {};
  const rarity = d.itemRarity;
  const name = d.itemName ?? '';

  // 서약·결정: 전용 코드 + 태초/에픽 + 이름 규칙
  if (PACT_CODES.has(code)) {
    if (rarity !== '태초' && rarity !== '에픽') return null;
    if (/광휘 결정$/.test(name)) return { item_category: 'soul' };
    if (/서약$/.test(name)) return { item_category: 'pact' };
    return null;
  }

  // 장비 드랍: 항아리·던전드랍·카드보상 코드 + 태초만
  if (GEAR_CODES.has(code)) {
    if (rarity !== '태초') return null;
    // 서약/결정 이름이 장비 코드로 새어 들어오면 제외(중복 방지)
    if (/광휘 결정$/.test(name) || /서약$/.test(name)) return null;
    return { item_category: 'gear' };
  }

  return null;
}

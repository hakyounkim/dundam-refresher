// 수집 대상 아이템 분류. 확장 시 여기에 규칙만 추가.
// 반환 null 이면 "수집 제외".
//
// 현재 규칙:
//   태초/에픽 등급 + (서약 장비 | 서약 결정) → 'pact' | 'soul'
//   그 외 등급/아이템은 제외.
// 향후 115제 장비 추가 예: event_code=505 + 특정 itemType 등.

export function classify(evt) {
  const d = evt?.data ?? {};
  const rarity = d.itemRarity;
  const name = d.itemName ?? '';

  if (rarity !== '태초' && rarity !== '에픽') return null;

  // 서약 결정: '~의 광휘 결정' 포함
  if (/광휘 결정$/.test(name)) return { item_category: 'soul' };

  // 서약 장비: 이름이 '서약'으로 끝남
  if (/서약$/.test(name)) return { item_category: 'pact' };

  return null;
}

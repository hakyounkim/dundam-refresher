# `/api/character-detail` 사용 가이드 (design용)

dundam-refresher 백엔드의 캐릭터 상세 endpoint 명세. 화면 디자인 시 이 문서를 기준으로 데이터 모양을 가정하면 됩니다.

---

## 1. 호출 방법

```
GET /api/character-detail?serverId={server}&characterId={charId}&extras={list}
```

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `serverId` | ✅ | `cain` / `diregie` / `siroco` / `prey` / `casillas` / `hilder` / `anton` / `bakal` |
| `characterId` | ✅ | 32자 hex |
| `extras` | 선택 | 콤마-구분. `oath`, `mist`, `avatar`, `creature`, `buff`, `setitems` |

기본(extras 없음)으로는 **basic / status / equipment + equippedSet + setEval**만 옵니다.
서약 카드 그리려면 `extras=oath`, 풀세트 효과 텍스트 보여주려면 `extras=setitems` 등 필요한 만큼만 켜기.

`Cache-Control: public, max-age=30` 응답이라 30초 정도 동일 캐릭은 캐싱돼서 옴.

---

## 2. 응답 최상위 키

```ts
{
  serverId: string,
  characterId: string,
  basic:       Basic | null,
  status:      Status | null,
  equipment:   Equipment[],     // 항상 배열 (0개 가능)
  equippedSet: EquippedSet | null,   // 항상 들어옴 (장비 분석 결과)
  setEval:     SetEval | null,        // 항상 들어옴 (세트포인트 활성 단계)
  avatar:      Avatar[]    | null,    // extras=avatar 일 때만
  creature:    Creature    | null,    // extras=creature
  oath:        Oath        | null,    // extras=oath
  mist:        Mist        | null,    // extras=mist
  buff:        Buff        | null,    // extras=buff (버퍼 캐릭에서만 의미)
  setitems:    SetItem[]   | null,    // extras=setitems
  errors:      { [endpoint: string]: string }   // 부분 실패 메시지
}
```

`extras`에 포함 안 한 필드는 `null`. 부분적으로 한 endpoint만 실패하면 `errors[키]`에 메시지 들어가고 나머지는 정상 반환.

---

## 3. `basic` — 캐릭터 기본정보

```json
{
  "serverId": "casillas",
  "characterId": "56a81575c814e829392349dfa43e80e6",
  "characterName": "꿀권춤",
  "level": 115,
  "jobId": "944b9aab492c15a8474f96947ceeb9e4",
  "jobGrowId": "37495b941da3b1661bc900e68ef3b2c6",
  "jobName": "거너(여)",
  "jobGrowName": "眞 레인저",
  "fame": 126684,
  "adventureName": "꿀앤똥",
  "guildId": "67cbdd60febf73f1fe0c76e7095cf492",
  "guildName": "설무야월"
}
```

캐릭터 아바타 이미지: `https://img-api.neople.co.kr/df/servers/{serverId}/characters/{characterId}?zoom=1`

---

## 4. `status` — 능력치

```ts
{
  ...basic,
  buff: [
    { name: "모험단 버프", level: 41, status: [{name,value}, ...] },
    { name: "무제한 길드능력치",   status: [...] },
    { name: "기간제 길드능력치",   status: [...] }
  ],
  status: [   // ★ 화면에 쓰는 주요 능력치는 거의 이 배열에서
    { name: "HP", value: 154208 },
    { name: "MP", value: 142293 },
    { name: "물리 방어율", value: 40.3 },
    { name: "힘", value: 7354 },
    { name: "물리 크리티컬", value: 114.5 },
    { name: "독립 공격", value: 3632 },
    { name: "모험가 명성", value: 126684 },
    { name: "화속성 강화", value: 319 },
    { name: "물리 방어", value: 50862 },
    { name: "공격력 증가", value: 71644.5 },
    { name: "버프력", value: 0 },         // 0이면 딜러 / >0이면 버퍼
    { name: "공격력 증폭", value: 70 },
    { name: "최종 데미지 증가", value: 180775280 },
    { name: "쿨타임 감소", value: 30.7 },
    { name: "쿨타임 회복속도", value: 0 },
    { name: "최종 쿨타임 감소율", value: 30.7 },
    ...
  ]
}
```

자주 쓰는 핵심값 추출 — frontend helper로 한 줄:
```js
const v = (name) => detail.status?.status?.find(s => s.name === name)?.value;
v('버프력');  v('명성');  v('최종 데미지 증가');
```

---

## 5. `equipment[]` — 슬롯별 장비

길이 0~13. 슬롯 종류:

| slotId | slotName |
|---|---|
| WEAPON | 무기 |
| TITLE | 칭호 |
| JACKET / PANTS / SHOULDER / WAIST / SHOES | 상의/하의/머리어깨/벨트/신발 |
| AMULET / WRIST / RING | 목걸이/팔찌/반지 |
| SUPPORT / MAGIC_STON / EARRING | 보조장비/마법석/귀걸이 |

각 슬롯 객체:

```json
{
  "slotId": "JACKET",
  "slotName": "상의",
  "itemId": "447e2906aee1c31574dea25387c876b0",
  "itemName": "잠식 : 찬란한 황금향의 플레이트 아머",
  "itemTypeId": "...",
  "itemType": "방어구",
  "itemTypeDetailId": "...",
  "itemTypeDetail": "상의",
  "itemAvailableLevel": 115,
  "itemRarity": "에픽",                      // 레어/유니크/레전더리/에픽/태초
  "setItemId": "7f788a703a87d783079b41d0fe6448c9",   // 없을 수도
  "setItemName": "영원히 이어지는 황금향 세트",        // 없을 수도
  "reinforce": 12,                            // 강화 수치
  "itemGradeName": "최상급",
  "enchant": { "status": [{name,value}, ...] },
  "amplificationName": "차원의 힘",            // 증폭 종류 (없으면 없음)
  "refine": 0,
  "tune": [{ "level": 3, "setPoint": 265 }]   // ★ setPoint 합산 source
}
```

아이템 아이콘 이미지: `https://img-api.neople.co.kr/df/items/{itemId}`

---

## 6. **`equippedSet`** — 착용 세트 요약 (신규)

```json
{
  "name": "영원히 이어지는 황금향 세트",
  "setItemId": "7f788a703a87d783079b41d0fe6448c9",
  "pieceCount": 10,
  "rarityBreakdown": { "에픽": 7, "태초": 3 }
}
```

장착 장비 중 같은 `setItemId`를 가장 많이 차지하는 1개의 세트만 골라 반환. 부위 수 + 등급별 분포 제공.

**디자인 활용 예:**
- 카드 제목: `name` ("영원히 이어지는 황금향 세트")
- 부제: `pieceCount` ("10/11부위") — 11은 세트의 최대 부위 수, `extras=setitems`로 받은 `setitems[i].setItems.length`로 확인
- 등급 칩: `rarityBreakdown` → 에픽 ⓻ 태초 ⓷ 같은 작은 뱃지

`null`이면 세트 아이템 0개 (드물지만 가능).

---

## 7. **`setEval`** — 세트포인트 활성 단계 (신규, 핵심)

```json
{
  "current": 2695,
  "activeTier": { "tier": "taecho", "label": "태초", "min": 2550 },
  "nextTier": null,
  "pointsToNext": 0,
  "taechoBonus": { "steps": 2, "finalDamageBonusPct": 2, "buffPowerBonus": 200 }
}
```

- `current` — 장비 11부위의 `tune[0].setPoint` 합산
- `activeTier` — 현재 통과한 가장 높은 단계 (`null` 가능 = 750 미만)
- `nextTier` — 다음 단계 정의. 태초(2550)에 도달했으면 `null`
- `pointsToNext` — 다음 단계까지 필요한 setPoint (없으면 0)
- `taechoBonus` — 태초 도달 후 70포인트마다 +1% 최종뎀/+100 버프력. `null` 가능

### 단계 카탈로그 (17단계)

| tier | label | min setPoint |
|---|---|---|
| `rare` | 레어 | 750 |
| `unique-1` | 유니크 I | 1,200 |
| `unique-2` | 유니크 II | 1,285 |
| `unique-3` | 유니크 III | 1,370 |
| `unique-4` | 유니크 IV | 1,455 |
| `unique-5` | 유니크 V | 1,540 |
| `legendary-1` | 레전더리 I | 1,650 |
| `legendary-2` | 레전더리 II | 1,735 |
| `legendary-3` | 레전더리 III | 1,820 |
| `legendary-4` | 레전더리 IV | 1,905 |
| `legendary-5` | 레전더리 V | 1,990 |
| `epic-1` | 에픽 I | 2,100 |
| `epic-2` | 에픽 II | 2,185 |
| `epic-3` | 에픽 III | 2,270 |
| `epic-4` | 에픽 IV | 2,355 |
| `epic-5` | 에픽 V | 2,440 |
| `taecho` | 태초 | 2,550 |

규칙: 같은 등급 내 단계 ↑ = +85, 등급 승급 = +110. 태초 후 +70당 점증.

**디자인 활용 예:**
- 색상: 등급별 컬러 매핑 (레어 회색 / 유니크 파랑 / 레전더리 주황 / 에픽 노랑 / 태초 초록)
  - tier prefix만 보고 색 결정: `activeTier.tier.split('-')[0]` → `epic`/`taecho` 등
- 진행 바: `current` 표시 + `nextTier.min`까지의 비율
- "+X% 최종뎀, +Y 버프력" 보너스: `taechoBonus`가 있을 때만 표시

---

## 8. `oath` — 서약 (extras=oath 필요)

```json
{
  "info": {
    "itemId": "...",
    "itemName": "영원불변의 행운 서약",
    "itemRarity": "태초",
    "setPoint": 655,                  // 서약 본체 setPoint 기여
    "oathUpgrade": {
      "status": [                      // 4진의 모두 활성 시 누적 효과
        { "key": "최종 데미지 증가", "value": "17%" },
        { "key": "버프력", "value": 3200 },
        { "key": "모험가 명성", "value": 1600 }
      ],
      "options": [                     // 진의 4단계
        {
          "stepName": "<묵언의 진의> - 첫 번째 진의",
          "optionName": "강인한 통찰",
          "explain": "묵언을 두려워하지 말라. 불안은 찰나이니.",
          "explainDetail": "...",
          "status": [
            { "key": "최종 데미지 증가", "value": "4%" },
            { "key": "버프력", "value": 800 },
            { "key": "모험가 명성", "value": 400 }
          ]
        },
        // ... 4개
      ]
    }
  },
  "crystal": [                         // 광휘결정 슬롯 (최대 11)
    {
      "slotNo": 0,
      "itemId": "...",
      "itemName": "행운 : 완전한 광휘 결정",
      "itemRarity": "에픽",
      "tune": { "level": 3, "setPoint": 195 }
    },
    // ... 슬롯별
  ],
  "setInfo": {                          // 서약+결정 묶음 세트
    "setId": 16206,
    "setName": "운명의 행운 서약",
    "setOptionName": "행운 : 일궈낸 운명",
    "setRarityName": "태초",
    "active": {
      "explain": "[두 번째 행운] ...",
      "explainDetail": "...",
      "status": [
        { "key": "최종 데미지 증가", "value": "448.4%" },
        { "key": "버프력", "value": 35500 },
        { "key": "모험가 명성", "value": 18000 }
      ],
      "setPoint": { "current": 2800, "min": 2550, "max": 2550 }   // ★ 활성 임계
    }
  },
  "blessing": {                         // 별도 축복 누적 효과
    "status": [
      { "key": "최종 데미지 증가", "value": "72%" },
      { "key": "스킬 쿨타임 감소", "value": "18.5%" },
      { "key": "버프력", "value": 10900 },
      { "key": "스킬 범위", "value": "15%" },
      { "key": "모험가 명성", "value": 5450 }
    ]
  }
}
```

### 서약 페이퍼돌 레이아웃

게임 내 배치는 5×4 그리드 (`index.html` 참조):
- 양쪽 4열씩 = **에픽 광휘 결정 8칸** (slotNo 0~7)
- 하단 중앙 3칸 = **태초 광휘 결정 3칸** (slotNo 8~10)
- 정중앙 1칸 = **서약 본체** (`info`)

활성 여부 표시:
- `setInfo.active.setPoint.current >= setInfo.active.setPoint.min` → 활성
- 활성이면 `setInfo.active.status` + `info.oathUpgrade.status` + `blessing.status` 모두 합산이 적용 중

### 4진의 활성 표시

진의 각 단계가 활성화됐는지는 응답 모양만으로는 명확하지 않지만, `oathUpgrade.options[].status`가 채워져 있고 `oathUpgrade.status` 누계도 채워져 있으면 활성 (테스트 캐릭은 모두 활성).

---

## 9. `mist` — 안개 융화

```json
{
  "level": 77,
  "expRate": "37.77%",
  "status": [
    { "name": "최종 데미지 증가", "value": "43.6%" },
    { "name": "버프력", "value": 8243 },
    { "name": "힘", "value": 350 },
    { "name": "지능", "value": 350 },
    { "name": "체력", "value": 350 },
    { "name": "정신력", "value": 350 },
    { "name": "모험가 명성", "value": 5425 }
  ]
}
```

레벨 + 게이지(`expRate`) + 누적 status. 임계값 시스템 없음 (선형 게이지).

---

## 10. `avatar[]` — 아바타 (extras=avatar)

12 슬롯 배열. 각 슬롯:

```json
{
  "slotId": "HEADGEAR",
  "slotName": "모자 아바타",
  "itemId": "...",
  "itemName": "레어 모자 클론 아바타",
  "itemRarity": "레어",
  "clone": {
    "itemId": "...",
    "itemName": "벼리의 리본장식[D타입]"
  },
  "optionAbility": "캐스팅 속도 14.0% 증가",
  "emblems": [
    { "slotNo": 1, "slotColor": "붉은빛", "itemId": "...", "itemName": "찬란한 붉은빛 엠블렘[힘]", "itemRarity": "유니크" },
    { "slotNo": 2, "slotColor": "붉은빛", "itemId": "...", "itemName": "찬란한 붉은빛 엠블렘[힘]", "itemRarity": "유니크" }
  ]
}
```

`clone`이 있으면 다른 아바타로 외형 복제한 상태. `optionAbility`가 그 아바타 슬롯의 추가옵션.

---

## 11. `creature` — 크리쳐 (extras=creature)

```json
{
  "itemId": "...",
  "itemName": "운명을 담는 재단사 플래티넘[70Lv]",
  "itemRarity": "레어",
  "clone": { "itemId": "...", "itemName": "지에엥" },
  "artifact": [
    { "slotColor": "RED",   "itemId": "...", "itemName": "눈부신 황혼의 공명", "itemRarity": "유니크" },
    { "slotColor": "BLUE",  "itemId": "...", "itemName": "눈부신 영원의 달빛", "itemRarity": "유니크" },
    { "slotColor": "GREEN", "itemId": "...", "itemName": "빛을 머금은 이슬",   "itemRarity": "유니크" }
  ]
}
```

크리쳐 본체 + 아티팩트 3색.

---

## 12. `buff` — 버프 강화 장비 (extras=buff)

버퍼 캐릭터(`status.status['버프력'] > 0`)에서만 의미 있음. 딜러는 빈 객체 또는 null.

---

## 13. `setitems[]` — 풀세트 효과 텍스트 (extras=setitems)

equipment의 setItemId들을 한 번에 lookup. 풀세트 효과를 길게 노출하고 싶을 때 사용.

```json
[
  {
    "setItemId": "7f788a703a87d783079b41d0fe6448c9",
    "setItemName": "영원히 이어지는 황금향 세트",
    "setItems": [
      { "slotId": "JACKET",     "slotName": "상의",    "itemId": "...", "itemName": "찬란한 황금향의 플레이트 아머", "itemRarity": "에픽" },
      // ... 11부위
    ],
    "setItemOption": [
      {
        "explain": "장비에 적용된 강화/증폭 수치에 따라 추가적인 능력을 발휘합니다.\n\n[황금향]\n방어구/악세서리/특수장비의 강화/증폭 수치 합에 따라 ...",
        "detailExplain": "...",
        "buffExplain": "...",
        "buffExplainDetail": "...",
        "status": [
          { "name": "모험가 명성", "value": 23000 },
          { "name": "버프력", "value": 50400 },
          { "name": "최종 데미지 증가", "value": "532.7%" }
        ]
      }
    ]
  }
]
```

⚠️ `setItemOption`은 항상 길이 1 (단일 통합 효과). 단계별로 나뉘어 있지 않음.

---

## 14. 실전 디자인 예시 (테스트 캐릭 실데이터)

캐릭 = 꿀권춤 / 카시야스 / 眞 레인저 / 명성 126,684

**기본 카드**
- 명성 126,684 · 길드 설무야월 · 모험단 꿀앤똥

**장비 세트 카드 (equippedSet + setEval)**
```
영원히 이어지는 황금향 세트
10부위 (에픽 7, 태초 3)

[━━━━━━━━━━━━━━] 2,695pt
✦ 태초 활성 (2,550 통과)
   + 태초 보너스 2단계 → 최종뎀 +2% / 버프력 +200
```

**서약 카드 (oath)**
```
영원불변의 행운 서약 · 태초
세트: 운명의 행운 서약 (행운 : 일궈낸 운명) · 태초

[━━━━━━━━━━━━━━] 2,800 / 2,550
✦ 활성

진의 4/4
ⓘ 강인한 통찰 · ⓘ 포용의 권능 · ⓘ 심연의 고동 · ⓘ 신념의 대가

광휘결정 11개
  · 행운 : 완전한 광휘 결정 × 8 (에픽, 조율 III×7 / I×1)
  · 행운 : 태초의 광휘 결정 × 2 (태초, 조율 0)
  · 행운 : 완전한 광휘 결정 × 1 (에픽, 조율 I)
```

**색상 매핑 제안**
| 등급 | 색 권장 |
|---|---|
| 레어 | gray-500 |
| 유니크 | sky-400 |
| 레전더리 | amber-500 |
| 에픽 | yellow-300 |
| 태초 | emerald-400 |

---

## 15. 빠른 호출 예 (frontend)

```js
// redesign/api.js 기준
const detail = await API.characterDetail(serverId, characterId, ['oath']);

const set  = API.getEquippedSet(detail);  // {name, pieceCount, rarityBreakdown}
const eval_= API.getSetEval(detail);      // {current, activeTier, taechoBonus, ...}
const oath = API.getOath(detail);         // {info, crystal, setInfo, blessing}

// helper 안 쓰고 직접
const buffPower = detail.status?.status?.find(s => s.name === '버프력')?.value;
```

직접 fetch:
```js
const r = await fetch(`/api/character-detail?serverId=${sv}&characterId=${id}&extras=oath`);
const detail = await r.json();
```

# 백엔드 작업 요청 모음

프론트엔드(`redesign/`)에서 필요한 백엔드 변경 사항입니다.

---

## 1. 서약 본체 아이콘 endpoint

[oath-icon-spec.md](./oath-icon-spec.md) 참고.

`/df/items/{itemId}`가 서약 본체만 404. `/api/oath-icon?itemId=...` 프록시 endpoint 필요.

---

## 2. 인챈트리스 — 파티원 수별 버프점수 3개

### 배경

인챈트리스(`眞 인챈트리스`) 직업은 파티원 인원(2인/3인/4인)에 따라 버프점수가 다르게 표시됨. 던담은 캐릭터 페이지에서 3개를 다 보여주는데, 우리 백엔드(`/api/adventure-register`)는 1개만 통과시키고 있음.

### 던담 응답 예시 (인챈트리스 외 = 1개, 인챈트리스 = 3개)

```
일반 버퍼 (크루세이더, 뮤즈, 패러메딕 등):
  buffScore: "130,125"

인챈트리스:
  2인 점수: 121,828
  3인 점수: 111,880
  4인 점수: 108,564
```

### 변경 요청 — `/api/adventure-register` 응답

각 character 객체에 다음 필드 추가:

```ts
{
  characterId, serverId, characterName, jobGrowName, fame,
  ozma: string | null,         // (기존)
  buffScore: string | null,    // (기존) — 인챈트리스는 가장 흔히 보는 값(2인) 으로 통일
  buffScores: [string, string, string] | null,  // (신규) — [2인, 3인, 4인]; 인챈트리스만 채움, 다른 버퍼는 null
  cri, setPoint, refreshTime,
}
```

### 백엔드 구현

dundam `searchData.jsp` raw 응답을 확인:
- 인챈트리스의 경우 응답 JSON에 `buffScore2P` / `buffScore3P` / `buffScore4P` 같은 별도 필드가 있는지
- 또는 `buffScore: "121,828 / 111,880 / 108,564"` 같은 단일 문자열로 오는지

raw 그대로 보내주시면 좋고, 아니면 위 명세대로 가공해서 통과:

```js
characters: rows.map(c => ({
  // ... 기존
  buffScore: c.buffScore ?? null,
  buffScores: c.jobGrowName?.includes('인챈트리스')
    ? [c.buffScore, c.buffScore3P, c.buffScore4P]  // 또는 raw 필드명
    : null,
}))
```

### 프론트 사용 예시

```js
// 카드 — 인챈트리스는 작은 2/3/4인 값 같이 표시
if (c.buffScores) {
  // 메인 = 4인(가장 보수적)? 또는 2인(가장 흔함)?
  // 사용자에 따라 다르므로 우선 4인 기준 표시 + 호버 시 모두 표시
  showPartySplit(c.buffScores);
}
```

### 검증

```bash
curl -X POST https://dundam-refresher.vercel.app/api/adventure-register \
  -H 'Content-Type: application/json' \
  -d '{"adventureName":"꿀앤똥"}' | jq '.characters[] | select(.jobGrowName == "眞 인챈트리스")'
```

결과에 `buffScores: ["121,828", "111,880", "108,564"]` 가 보여야 통과.

# DF Hobby (dundam-refresher) — 프로젝트 지침

## 디자인 시스템 (필수)

**모든 화면 생성/수정 전에 `docs/dundam-refresher-design-system.md`(시각 디자인)와 `docs/ux-flow-guide.md`(상태 의존성·빈 상태·사용자 여정)를 먼저 읽고 그 규칙을 우선 적용한다.**

핵심 요약 (전문은 위 파일 참고):
- **듀얼 테마** · 기본은 시스템 설정 따라가고 헤더 토글로 수동 전환(localStorage 저장) · 토스/당근 계열 절제된 미감
- accent는 화면당 하나(파랑: 라이트 #2D6FF2 / 다크 #4A85F6), 등급 색은 던파 원작 색 그대로
- 폰트 Pretendard Variable, `word-break: keep-all`, 숫자는 tabular-nums + 콤마
- 모바일 우선(2열) → 768px+ 데스크톱(4열, 4인 파티 기준)
- 시스템 상태는 스크롤 없이 항상 보이게: 갱신 진행바는 헤더 아래 sticky
- 금지: 그라데이션, 이모지 아이콘(→ 인라인 SVG), 글래스모피즘·네온 글로우, 게이밍풍 다크(순검정+형광), 카드 box-shadow, hover 전용 인터랙션, 과장 카피

## 구현 메모

- 듀얼 테마: `data-theme` 속성으로 light/dark 전환. 최초 진입은 `prefers-color-scheme` 따라가고, 사용자가 헤더 토글을 누르면 localStorage에 저장 후 그 값 우선
- accent는 파랑 단일 고정 (색 스위처 없음)
- 레거시(`legacy.html` + 사이드바 "이전 버전")는 제거됨

## 파일 구조

- `index.html` `app.js` `styles.css` `api.js` — 메인 (DF Console)
- `api/` — 백엔드(Vercel serverless). `/api/adventure-register`, `/api/character-detail` 등
- `docs/` — 명세 문서
  - `character-detail-api.md` — character-detail 응답 스펙
  - `backend-todo.md` — 백엔드 할 일 (서약 아이콘, 인챈트리스 3점수)
  - `oath-icon-spec.md` — 서약 본체 아이콘 endpoint 요청
  - `dundam-refresher-design-system.md` — 디자인 시스템 (위 참조)
  - `ux-flow-guide.md` — UX 플로 가이드 (상태 의존성·빈 상태·사용자 여정). 미구현 처방: 드랍기록·토벌권 빈 상태 인라인 검색, 모험단 URL/localStorage 지속, 헤더 모험단 배지

## 데이터 관련 메모

- 딜/버프점수/크리/세트포인트는 던담(`/api/adventure-register`)이 계산해 보내는 라이브 문자열("2 조 7132 억", "121,828")
- 서약 표시 이름 = `oath.setInfo.setOptionName`에서 "OO : " prefix 제거한 값
- 세트/서약 아이콘 = 던담 `/img/lv115/set/{1-12}.png` (키워드 매핑, api.js의 `getDundamSetIconUrl`)
- 인챈트리스는 파티원 수별 버프점수 3개(`buffScores: [2인,3인,4인]`) — 백엔드 지원 전까지 `applyEnchantressDemo`로 데모값. 백엔드 완료 후 그 함수 및 호출 3곳 제거
- 데모 갱신 버튼은 `?demo` URL 파라미터일 때만 노출 (라이브 숨김)

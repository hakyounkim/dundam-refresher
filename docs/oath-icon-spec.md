# 서약 본체 아이콘 endpoint 추가 요청

## 배경

네오플 공식 API의 `https://img-api.neople.co.kr/df/items/{itemId}`는 **서약 본체 itemId 이미지가 404** 입니다.

테스트 결과 (꿀권춤 / 카시야스):
| itemId | endpoint | 결과 |
|---|---|---|
| 광휘결정 `1bf8c2d6...` | `/df/items/{id}` | ✅ 28×28 png |
| 일반 장비 `447e2906...` (상의) | `/df/items/{id}` | ✅ 28×28 png |
| **서약 본체** `f6e3fa49...` | `/df/items/{id}` | ❌ 404 |
| 서약 본체 | `?zoom=1/2/3` | ❌ 모두 404 |
| 서약 본체 | `/df/setitems/{id}`, `/df/setItems/{id}` | ❌ 404 |

프론트 화면 영향:
- 카드/행 뷰의 "서약" 셀 아이콘 → 던담 세트 아이콘(`https://dundam.xyz/img/lv115/set/{1-12}.png`)으로 우회
- 모달 서약 페이퍼돌 중앙(서약 본체) 슬롯 → 빈칸으로 보임

## 요청

백엔드(`dundam-refresher.vercel.app`)에 서약 아이콘을 프록시/리다이렉트하는 endpoint를 추가해 주세요.

### Endpoint 명세

```
GET /api/oath-icon?itemId={32자 hex}
```

응답:
- 200: `image/png` (또는 `image/jpeg`) — 서약 본체 아이콘 이미지 바이너리
- 404: 아이콘을 찾지 못한 경우
- `Cache-Control: public, max-age=86400` 권장 (서약 본체 이미지는 변경 안 됨)
- `Access-Control-Allow-Origin: *` (CORS)

### 데이터 소스 옵션

다음 중 가능한 방법을 사용:

1. **던담 또는 외부 사이트에서 직접 가져옴** (스크래핑)
   - 서약 itemId → 던담 내부 URL 매핑 알면 그대로 프록시
2. **공식 API의 다른 endpoint** (네오플이 비공식으로 노출한 게 있을 수 있음 — 던파 인벤이나 dfo-api 커뮤니티 참고)
3. **정적 매핑 테이블 + S3/CDN 업로드**
   - 서약은 종류가 제한적이므로 (현재 시즌 ~12개 시리즈 × 3진의 = 36개 본체 정도)
   - itemId → 미리 다운받은 이미지 매핑 + 백엔드에 정적 저장
4. **메타 정보를 같이 내림 (대안)**
   - 위가 모두 어려우면 `/api/character-detail` 응답의 `oath.info`에 `iconUrl: "..."` 필드를 추가하는 식으로 백엔드가 어디서든 이미지 URL을 결정해 같이 내려주기

### 프론트 적용 예시

```js
// redesign/app.js — 모달 페이퍼돌 중앙 서약 슬롯
const iconUrl = `${API_BASE}/api/oath-icon?itemId=${info.itemId}`;
// 카드/행에서도 동일하게 사용
```

또는 옵션 4의 경우:
```js
const iconUrl = oath.info.iconUrl; // 백엔드가 결정해서 내려줌
```

### 검증

배포 후 다음으로 확인:
```bash
curl -I "https://dundam-refresher.vercel.app/api/oath-icon?itemId=f6e3fa493b3253d99541f3cc290fbb85"
# HTTP/2 200
# content-type: image/png
```

또는 브라우저에서 직접 그 URL 열기.

## 광휘결정은?

광휘결정은 `/df/items/{id}`로 잘 작동해서 별도 처리 불필요. 본 작업은 **서약 본체** 36개 정도만 대상입니다.

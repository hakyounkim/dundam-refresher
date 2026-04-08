# ⚡ 던담 일괄 갱신기

던전앤파이터 [던담(dundam.xyz)](https://dundam.xyz) 캐릭터 데이터를 한번에 갱신하는 유틸리티입니다.

## 기능
- 모험단/캐릭터 검색
- 선택적 캐릭터 갱신 (체크박스)
- 5개씩 동시 갱신 (API 직접 호출)
- 진행률 표시 및 로그

## 배포 방법

1. 이 레포를 GitHub에 push
2. [vercel.com](https://vercel.com)에서 Import Project → GitHub 레포 선택
3. 기본 설정 그대로 Deploy
4. 끝!

## 구조

```
api/
  search.js    # 던담 검색 프록시 (서버 → dundam.xyz)
  refresh.js   # 캐릭터 갱신 프록시 (서버 → viewData.jsp)
public/
  index.html   # 프론트엔드
vercel.json    # Vercel 라우팅 설정
```

## 비고

- 던담(dundam.xyz) 비공식 유틸리티입니다
- 네오플 공식 API가 아닌 던담 자체 API를 이용합니다

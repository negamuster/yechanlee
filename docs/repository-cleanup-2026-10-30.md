# 파일·GitHub 정리 — 2026-10-30

기준 main: `1c9c04a064d8f11d13d77a317a727867142c7c08` (PR #47 운영 배포).

## 목표와 완료 조건

사용하지 않는 소스·빈 파일·오래된 UI 설명을 정리하고, 실제 홈·검색·전체 브리핑·투자 노트의 동작과 원본 자료를 보존한다. 모든 앱 소스가 실제 진입점에서 연결되는지 검사하며, lint·전체 Node·빌드·PC/모바일 Chromium을 검증한다. 병합·운영 배포는 별도 요청으로 진행한다.

## 파일 정리 범위

- 앱에서 참조하지 않는 구형 `DailyBriefing`, `MobileDailyBriefing`, 전용 `BriefingMotion`과 모바일 CSS, `MarketOverview`, `StockSearch`를 제거한다. 빈 `App.css`, `Link.tsx`, `List.tsx`, `Detail.tsx`도 제거한다.
- 전체 브리핑에서 쓰는 기존 스타일은 `BriefingArticle.css`로 이름을 바꾸고 유지하며, 구형 홈 패널·탭 전용 규칙만 정리한다. `BriefingDetails`와 원문·시각·수치·출처·정정은 변경하지 않는다.
- 구형 모바일 펼침 UI만 검사하던 테스트는 현재 전체 브리핑 데이터 표시 검사로 대체한다. 현재 홈 세 문단·빈 상태·전체 보기·출처·브라우저 검사는 그대로 유지한다. 저장/실행 취소와 활성 Maps/Movers의 Motion 검사도 유지한다.
- 추적되던 `.env`는 주석만 있는 것을 확인하고 제거하며 `.env.example` 템플릿으로 바꾼다. 다른 작업 트리나 사용자 기기의 실제 `.env.local`은 작업 대상이 아니다. 비밀값·개인 노트·브리핑 원고·데이터 저장본·라이선스는 삭제 대상이 아니다.
- 작성 원칙의 홈 요약 수를 최대 세 문단으로 고치고, 두 공개용 JSON 생성물·현재 선택/북마크 피드백에 맞게 문서를 정리한다. 과거 운영 기록은 역사적 기록으로 유지한다.

## 미사용 소스 검사

`npm run check:source`는 `src/main.tsx`에서 TypeScript AST의 정적 import·re-export·문자열 동적 import·import type과 CSS의 로컬 `@import`를 따라간다. 상대 경로 누락과 연결되지 않은 TS/TSX/CSS/JSON 파일을 거부한다. 테스트만 참조하는 파일을 실제 앱 사용으로 세지 않는다. 타입 의존성은 포함하며 실제 전송 번들 여부는 별도 초기 JS 예산 검사가 담당한다. 생성물을 만든 뒤 빌드에서 항상 실행한다. 새로운 앱 진입점이나 glob/비문자열 모듈 로딩을 도입할 때는 검사기도 그 구조에 맞춰 수정해야 한다.

## GitHub 브랜치 확인

열린 PR은 0개였고 main 외 기존 브랜치는 47개였다. 얕은 로컬 이력을 전체 main 이력으로 확장한 뒤, 각 브랜치의 현재 SHA가 병합 PR의 head와 일치하는지, 보호 여부와 main 조상 여부를 대조했다. **39개는 main에 완전히 포함**되어 삭제 가능한 대상으로 확인했다. **8개는 PR 병합 기록이 있어도 현재 커밋이 main 조상으로 확인되지 않아 보존**한다. 이를 미병합 PR로 표현하거나 변경이 유실됐다고 단정하지 않는다.

아래 SHA는 복원·대조용 기록이다. 브랜치를 삭제하더라도 main에 포함된 커밋과 PR 기록은 남는다. 필요하면 기록된 SHA에서 브랜치를 다시 만들 수 있다.

**실행 상태:** 브랜치 삭제 도구가 연결에 없으며 GitHub 웹 관리 화면은 로그인이 필요하다. 현재 원격 브랜치는 삭제하지 않았고, 파일 정리 PR·검증을 먼저 완료한 뒤 로그인 가능 여부에 따라 후속 처리한다.

| 브랜치 | 병합 PR | 확인한 head SHA | 처리 기준 |
| --- | --- | --- | --- |
| `codex/curated-news-feeds` | [#1](https://github.com/negamuster/yechanlee/pull/1) | `fa44a055ac033fd6d932263ebc221144f2a6695e` | main 포함 · 삭제 가능 |
| `codex/market-movers` | [#2](https://github.com/negamuster/yechanlee/pull/2) | `4bd6aa9a81211cec19435f6d2934b2544248229b` | main 포함 · 삭제 가능 |
| `codex/uniform-news-cards` | [#3](https://github.com/negamuster/yechanlee/pull/3) | `d1165191f17d634c1bb617b8d4d8aea764d5f28a` | main 포함 · 삭제 가능 |
| `codex/news-topics-and-list` | [#4](https://github.com/negamuster/yechanlee/pull/4) | `5b054249fb64437f0c7a5125aa83cf52d02383a3` | main 포함 · 삭제 가능 |
| `codex/market-ticker-and-news-refinements` | [#5](https://github.com/negamuster/yechanlee/pull/5) | `eb7276277926e896fdb749dc681756b60bdcf72f` | main 포함 · 삭제 가능 |
| `codex/navigation-and-market-guides` | [#6](https://github.com/negamuster/yechanlee/pull/6) | `631c2d14e580c228bdbea4e3b5b717a4840d62a7` | main 포함 · 삭제 가능 |
| `codex/server-api-security` | [#7](https://github.com/negamuster/yechanlee/pull/7) | `ca151db1dd20736a8ef869c0eb23f0336bf235bd` | main 포함 · 삭제 가능 |
| `codex/verified-13f-and-asset-projection` | [#8](https://github.com/negamuster/yechanlee/pull/8) | `77a3c2d13d861d282f3566968c868aed9699c795` | main 포함 · 삭제 가능 |
| `codex/search-news-and-institutions` | [#9](https://github.com/negamuster/yechanlee/pull/9) | `86173f521ed85912c9f88604fa5b3c4c6a3669c7` | main 포함 · 삭제 가능 |
| `codex/saved-stocks-and-articles` | [#10](https://github.com/negamuster/yechanlee/pull/10) | `da6fa4835c7ac10311226f11256512c71178adc9` | main 포함 · 삭제 가능 |
| `codex/us-sector-performance` | [#11](https://github.com/negamuster/yechanlee/pull/11) | `e766e47d4d5d5e5a4372ee7e61928032e291f973` | main 포함 · 삭제 가능 |
| `codex/detail-pages-20261021` | [#12](https://github.com/negamuster/yechanlee/pull/12) | `79942fc4414b01cbfbb45fe9444baf4d9e608457` | 보존 · 커밋 조상 관계 추가 확인 필요 |
| `codex/news-reading-20261021` | [#13](https://github.com/negamuster/yechanlee/pull/13) | `e68c1ee9e2834fa25287470aefb779eeeb17f477` | 보존 · 커밋 조상 관계 추가 확인 필요 |
| `codex/refresh-search-20261021` | [#14](https://github.com/negamuster/yechanlee/pull/14) | `26d009c5afbe134ece73d40aca9e86a5ef4d93d0` | 보존 · 커밋 조상 관계 추가 확인 필요 |
| `codex/search-verified-tickers-20261021` | [#15](https://github.com/negamuster/yechanlee/pull/15) | `0f8f62ee06a1036ae93e1ad2a5f3ff32885155ff` | 보존 · 커밋 조상 관계 추가 확인 필요 |
| `codex/stock-financials-chart-20261021` | [#16](https://github.com/negamuster/yechanlee/pull/16) | `55efff4b153dba828683a5580a3f02b808e97ddc` | 보존 · 커밋 조상 관계 추가 확인 필요 |
| `codex/stock-load-reliability-20261021` | [#17](https://github.com/negamuster/yechanlee/pull/17) | `b59ec556a989ebbe5c93bfb1814095bfcb0b7625` | 보존 · 커밋 조상 관계 추가 확인 필요 |
| `codex/stock-partial-data-20261021` | [#18](https://github.com/negamuster/yechanlee/pull/18) | `53723757ed584e3c338457d8becd8ba02f314d55` | 보존 · 커밋 조상 관계 추가 확인 필요 |
| `codex/chart-date-format-20261021` | [#19](https://github.com/negamuster/yechanlee/pull/19) | `df165485ab8362fd2ed363827f7310e102c85f40` | 보존 · 커밋 조상 관계 추가 확인 필요 |
| `codex/stock-verification-20261021` | [#20](https://github.com/negamuster/yechanlee/pull/20) | `71ede167c9a0878afdd220128e5b7d41494c12fe` | main 포함 · 삭제 가능 |
| `codex/financial-history-20261021` | [#21](https://github.com/negamuster/yechanlee/pull/21) | `36d36ce9c5e6330fac56221d96052f093c2056f1` | main 포함 · 삭제 가능 |
| `codex/financial-revenue-scope-20261021` | [#22](https://github.com/negamuster/yechanlee/pull/22) | `3af9e769792c9716bd2b265eff5e7e608c7bc561` | main 포함 · 삭제 가능 |
| `codex/economic-dashboard-20261021` | [#23](https://github.com/negamuster/yechanlee/pull/23) | `bbc62d7dc1d59de6f76fb50d98274576f20d9aba` | main 포함 · 삭제 가능 |
| `codex/stock-chart-controls-20261021` | [#24](https://github.com/negamuster/yechanlee/pull/24) | `898de3333527a057df6a21f3cbfbab5d2de6c9fd` | main 포함 · 삭제 가능 |
| `codex/related-empty-response-20261022` | [#25](https://github.com/negamuster/yechanlee/pull/25) | `79069554c7db4bcac7fb8cf0715aadcb3a89977d` | main 포함 · 삭제 가능 |
| `codex/13f-full-comparison-20261022` | [#26](https://github.com/negamuster/yechanlee/pull/26) | `d39bb0f8a5556a4557ccf14ddc5e8f3cc5376a7d` | main 포함 · 삭제 가능 |
| `codex/investment-evidence-20261022` | [#27](https://github.com/negamuster/yechanlee/pull/27) | `1b179a68b5a5a08f1f5c06ac9103763ffbd0a57b` | main 포함 · 삭제 가능 |
| `codex/development-workflow-20261023` | [#28](https://github.com/negamuster/yechanlee/pull/28) | `ef4a909202141bbd77994e9550dbe67fdda3b5c6` | main 포함 · 삭제 가능 |
| `codex/news-calendar-reliability-20261023` | [#29](https://github.com/negamuster/yechanlee/pull/29) | `349e5ee0d4aaf3e321639167edc9df991c42aa8a` | main 포함 · 삭제 가능 |
| `codex/notes-discovery-backup-20261024` | [#30](https://github.com/negamuster/yechanlee/pull/30) | `845342172db8141862e12b2571413a2ce904fb95` | main 포함 · 삭제 가능 |
| `codex/development-entrypoints-20261024` | [#31](https://github.com/negamuster/yechanlee/pull/31) | `fdb7d30b235ea378f0511ded191b890509720df2` | main 포함 · 삭제 가능 |
| `codex/site-reliability-20261025` | [#32](https://github.com/negamuster/yechanlee/pull/32) | `a8c5a35513e8a6801fbc51cf1a295e44fdac4374` | main 포함 · 삭제 가능 |
| `codex/economic-fred-fallback-20261025` | [#33](https://github.com/negamuster/yechanlee/pull/33) | `c6574476ea75a0f58234e9692577059e2bc6136f` | main 포함 · 삭제 가능 |
| `codex/13f-tanstack-table-20261027` | [#34](https://github.com/negamuster/yechanlee/pull/34) | `66485f3ea04845798822f01c6f804e1053d8808f` | main 포함 · 삭제 가능 |
| `codex/stock-chart-enhancements-20261028` | [#35](https://github.com/negamuster/yechanlee/pull/35) | `90fdcf5ddca7a186ddfe19cee264f2a0be3ecf48` | main 포함 · 삭제 가능 |
| `codex/sec-filing-monitor-20261028` | [#36](https://github.com/negamuster/yechanlee/pull/36) | `a4799655acdaab92006e1cb803e63e33671c7c58` | main 포함 · 삭제 가능 |
| `codex/sec-index-universe-20261028` | [#37](https://github.com/negamuster/yechanlee/pull/37) | `ee8817ed67ba670f4b8ded424a0a193bcf8b85a4` | main 포함 · 삭제 가능 |
| `codex/fuse-site-search-20261028` | [#38](https://github.com/negamuster/yechanlee/pull/38) | `ace33960a1beb047cc61ff89ec712758a91c7c88` | main 포함 · 삭제 가능 |
| `codex/exchange-calendar-20261028` | [#39](https://github.com/negamuster/yechanlee/pull/39) | `7cf65bff177b17e3cf9cc109f425a3ed69b281e4` | main 포함 · 삭제 가능 |
| `codex/home-ui-refresh-20261028` | [#40](https://github.com/negamuster/yechanlee/pull/40) | `ed2d6a6bd44e61f0df0e03dbea049650d290f34a` | main 포함 · 삭제 가능 |
| `codex/home-density-20261029` | [#41](https://github.com/negamuster/yechanlee/pull/41) | `95e36b624057371a0b9167452c89c37afbfefa5e` | main 포함 · 삭제 가능 |
| `codex/maps-width-20261029` | [#42](https://github.com/negamuster/yechanlee/pull/42) | `4d41185e39241a97538eb2dd825aac5696ab22c2` | main 포함 · 삭제 가능 |
| `codex/home-maps-briefing-balance-20261029` | [#43](https://github.com/negamuster/yechanlee/pull/43) | `f435d7de0846ed348ac7956dab4e2934820698ef` | main 포함 · 삭제 가능 |
| `codex/dependency-security-20261029` | [#44](https://github.com/negamuster/yechanlee/pull/44) | `17b295964f3ac1a342081ac31d2f92101099fc08` | main 포함 · 삭제 가능 |
| `codex/company-market-map-20261029` | [#45](https://github.com/negamuster/yechanlee/pull/45) | `15c6477fb4b8e3f824f4e4b34509dc976b301041` | main 포함 · 삭제 가능 |
| `codex/maps-static-logos-20261030` | [#46](https://github.com/negamuster/yechanlee/pull/46) | `fbaf1f6f7ff479ad89ef52c82fbb49ec11d230ed` | main 포함 · 삭제 가능 |
| `codex/initial-loading-20261030` | [#47](https://github.com/negamuster/yechanlee/pull/47) | `53da5e9188e019ea8a6144dfb3fa036c58069ec5` | main 포함 · 삭제 가능 |

삭제를 실행할 때는 열린 PR과 현재 head SHA를 다시 확인하고, 진행 중인 새 정리 브랜치·main·보호 브랜치는 대상에서 제외한다. 로컬 사용자 브랜치와 작업 트리는 이번 원격 정리와 별개로 유지한다.

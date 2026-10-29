# Anthracite

뉴스·시장 지표·경제 일정·종목 자료·13F·Daily Briefing을 모아 보고, 투자 노트와 근거 자료를 브라우저에 저장하는 개인 금융 웹사이트입니다.

- 운영: https://yechanlee.vercel.app
- 저장소: https://github.com/negamuster/yechanlee
- 구성: React·TypeScript·Vite, Vercel Node.js API

## 개발 시작

CI와 동일한 **Node.js 24.x**와 npm을 사용합니다. 테스트가 TypeScript 파일을 직접 불러오므로 이전 Node 버전으로 실행하지 않습니다.

```sh
node --version
npm ci
npm run dev
```

터미널에 표시된 개발 주소를 엽니다. `predev`가 저장된 브리핑에서 공개용 데이터를 생성하고, Vite 개발 서버가 `api/`·`lib/`의 서버 핸들러를 연결합니다. 브리핑을 새로 작성하거나 운영 사이트에 게시하지는 않습니다.

실제 종목 시세·Market Movers 조회에는 공급업체 키가 필요합니다. 새 개발 환경에서는 `.env.example`을 `.env.local`로 복사해 설정합니다. 기존 `.env.local`이 있다면 보존합니다. 로컬에서 사용할 때만 저장소 루트의 `.env.local`에 다음 값을 넣고 개발 서버를 다시 시작합니다.

```dotenv
POLYGON_KEY=your_provider_key
```

`.env.local`은 Git에서 제외됩니다. 키나 인증된 피드 URL을 커밋하거나 `VITE_` 접두사로 브라우저 코드에 노출하지 않습니다. 운영 설정은 Vercel 환경변수에서 별도로 관리합니다. 키가 없거나 출처 접근이 제한되면 일부 실시간 자료를 조회하지 못할 수 있습니다. 자동 검증에는 실제 키가 필요하지 않습니다.

`npm run preview`는 먼저 생성한 `dist/`를 정적으로 확인하는 명령입니다. Vercel Functions나 개발 서버의 API 미들웨어를 실행하지 않으므로, 실제 API 연동 개발에는 `npm run dev`를 사용합니다.

## 로컬 검증

일반적인 변경은 다음 명령으로 Node 회귀 검사와 운영용 빌드를 순서대로 실행합니다. 앞 단계가 실패하면 다음 단계는 실행하지 않습니다.

```sh
npm run verify
```

PC·모바일 사용 흐름을 포함한 전체 검증은 아래와 같습니다. 브라우저 설치는 최초 실행 시 또는 Playwright 버전 변경 후에 별도로 실행합니다.

```sh
npm run setup:browsers
npm run verify:all
```

브라우저 다운로드가 실패하면 화면 검증은 미완료입니다. 네트워크가 가능한 환경에서 설치를 다시 시도하거나 PR의 GitHub CI 결과를 확인합니다. 단위 검사나 빌드 통과를 브라우저 검사 통과로 대신 기록하지 않습니다.

| 명령 | 실행 범위 |
| --- | --- |
| `npm test` | `tests/*.test.mjs`의 전체 Node 회귀 검사 |
| `npm run build` | NYSE 시간표 검증 → 공개용 브리핑 생성 → 미사용 소스 검사 → TypeScript 검사 → Vite 빌드·초기 JS 예산 검사 → 커밋 표식 생성 |
| `npm run check:source` | 실제 앱 진입점에서 정적·동적 import를 따라 TS/TSX/CSS/JSON의 사용 여부 검사 · 테스트에서만 쓰는 파일도 미사용으로 처리 |
| `npm run verify` | lint + Node 회귀 검사 + 빌드 |
| `npm run setup:browsers` | Playwright Chromium과 필요한 시스템 의존성 설치 |
| `npm run test:e2e` | 이미 빌드한 결과로 PC·모바일 Chromium 검사 |
| `npm run verify:all` | lint + Node 회귀 검사 + 빌드 + PC·모바일 Chromium 검사 |
| `npm run lint` | ESLint 검사 · 경고도 실패 처리 · verify 및 CI에 포함 |
| `npm run calendar:check` | Python 가상환경에 `requirements-calendar.txt` 설치 후 NYSE 시간표를 고정 버전 라이브러리·공식 검토 목록과 대조 · 외부 API 호출 없음 |
| `npm run calendar:generate` | 공식 일정 검토 후 NYSE 시간표 재생성 · 공식 확인 시각을 자동 갱신하지 않음 |

브라우저 검사는 고정된 시각과 합성 API 응답을 사용하며 외부 요청을 차단합니다. 실제 API 키나 운영 API 할당량을 쓰지 않습니다. `test:e2e`가 `127.0.0.1:4173`에 preview 서버를 직접 실행하므로 해당 포트를 비워 둡니다. 모바일 검사는 Pixel 7 크기의 Chromium 에뮬레이션이며 실제 기기·Safari 검사는 아닙니다.

## GitHub CI와 운영 점검

초기 로딩은 [번들 분리·성능 기준](docs/initial-loading.md)을 따릅니다. `scripts/build-briefings.mjs`가 같은 검토된 원본에서 전체 `published-briefings.json`과 홈용 `latest-briefing.json`을 함께 생성합니다. 브리핑 원본을 수정했다면 두 생성물을 함께 갱신합니다. 빌드는 정적 의존성 전체의 JavaScript 크기와 지연 로딩 경계를 검사하고 `dist/.vite/initial-loading.json`에 결과를 남깁니다.

[Verify site changes](.github/workflows/verify.yml)는 PR의 통합 커밋에서 의존성 설치, `npm test`, lint, 빌드, 브라우저 설치, PC·모바일 검사를 실행합니다. 결과를 구분해 볼 수 있도록 단계별로 실행하며 실제 검사 SHA와 성공·실패·건너뜀을 요약합니다. 실패 시 화면·trace·HTML 보고서를 7일간 보관합니다.

로컬 검증, GitHub CI, Vercel 미리보기, 운영 배포는 별도 결과입니다. 작업 범위·리뷰·검증한 SHA·남은 제한은 [PR 양식](.github/pull_request_template.md)에 기록합니다. 병합·운영 배포는 요청받은 범위에서 진행하며, 배포 후 `/build-info.json`의 커밋과 화면 동작을 확인합니다. 자세한 작업 원칙은 [AGENTS.md](AGENTS.md)를 따릅니다.

다음 명령은 **현재 운영 사이트**의 API를 호출합니다. 로컬 서버나 미리보기를 점검하는 명령이 아니며 공급업체 할당량을 사용할 수 있어 `verify`·`verify:all`에 포함하지 않습니다.

```sh
npm run check:data
# 종목 자료만 확인하거나 검사 종목을 지정할 때
npm run check:stocks
npm run check:stocks -- --symbol AAPL
```

기존 [Check production data health](.github/workflows/check-data-health.yml)가 예약·수동 실행·main 검증 후 운영 점검을 담당합니다. 결과는 `reports/data-health.json`에 기록되고, GitHub 실행에서는 요약과 7일 보관 아티팩트로도 남습니다. `OK`·`WARN`·`FAIL`·`SKIP`을 구분하며, 작업 성공이 모든 출처의 정상 수집을 뜻하지는 않습니다. 배포 커밋 대조와 출처 제한의 해석은 [운영 검증 문서](docs/stock-verification.md)를 참고합니다.

## 코드와 관련 문서

| 위치 | 역할 |
| --- | --- |
| `src/` | 화면·상태 관리·브라우저 저장 |
| `api/`, `lib/` | 서버 진입점·수집·캐시·응답 검증 |
| `tests/`, `tests/e2e/` | Node 회귀 검사·브라우저 시나리오 |
| `content/briefings/`, `scripts/` | 브리핑 원본·생성·운영 점검 도구 |
| `data/` | 검증한 공공 데이터 저장본 |

- [금융 데이터·운영 검증](docs/stock-verification.md), [재무 이력과 기간·단위](docs/financial-history.md)
- [뉴스 수집과 출처 상태](docs/news-feeds.md), [경제 일정](docs/calendar.md), [거래소 일정 생성·검증](docs/exchange-calendar.md), [브리핑 자동화](docs/briefing-automation.md)
- [13F 검증](docs/13f-and-simulator-validation.md), [노트·근거·백업](docs/investment-evidence.md), [검색·백업 상태 안내](docs/note-discovery-and-backup-status.md)
- [API와 비밀값 관리](docs/api-security.md)
- [파일·GitHub 정리 기록과 브랜치 대조](docs/repository-cleanup-2026-10-30.md)

관심 종목·기사·노트는 브라우저별로 저장되며 기기 간 자동 동기화되지 않습니다. 작성 중인 초안은 저장 전까지 백업에 포함되지 않습니다. 개발·검증 중 실제 개인 기록을 테스트 데이터로 덮어쓰지 않습니다.

### SEC 공시 모니터

`/filings`에서 S&P 500·Nasdaq 100 구성 목록과 추가 기업(SATL)의 최근 180일 정기·수시 보고서를 확인합니다. EdgarTools Python 배치가 매시간 수집하고, 웹사이트는 검증된 메타데이터만 읽습니다. 수집 대상·설치·실패 처리·검증은 [SEC 모니터 문서](docs/sec-filing-monitor.md)를 참고하세요. 로컬 UI 개발과 빌드에는 Python이 필요하지 않습니다.

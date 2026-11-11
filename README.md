# Pitches

발표하는 동안 말 속도·감정·음량을 분석해 색으로 바로 알려 주고, 발표가 끝나면 AI 코칭 보고서를 만들어 주는 모바일 서비스입니다. 2024년 10월 캡스톤 해커톤 팀 프로젝트로 시작해(팀장 · 백엔드·AI) 2025년 국제학술대회 논문으로 이어졌고, 이 저장소는 2026년에 혼자 다시 설계해 구현한 리뉴얼 코드입니다.

| 홈 | 실시간 분석 | 분석 결과 | 코칭 보고서 |
|:-:|:-:|:-:|:-:|
| ![홈](docs/demo/screenshots/03-home.png) | ![실시간 분석](docs/demo/screenshots/05-recording-02.png) | ![분석 결과](docs/demo/screenshots/12-result.png) | ![코칭 보고서](docs/demo/screenshots/14-report-top.png) |

iOS 시뮬레이터 화면입니다.

## 무엇을 하나요

- **5초마다 색 피드백** — 말하기 속도·음량·간투사·감정을 5초 단위로 판정해 초록·노랑·빨강 원과 한 줄 팁으로 보여 줍니다.
- **실시간 자막** — 지금 말한 문장을 한 문장씩 보여 주고 "음·어" 같은 간투사를 강조합니다.
- **음성 감정 분석** — SenseVoice-Small과 emotion2vec+를 로컬 CPU에서 돌려 긴장·슬픔 같은 감정과 웃음·박수 같은 소리를 인식합니다.
- **AI 코칭 보고서** — 발표가 끝나면 전체 전사 → 지표 집계 → GPT 구조화 보고서 → 한글 PDF를 만들어 공유 시트로 저장·전송합니다.
- **기록** — 발표마다 결과를 남기고 추이를 그래프로 보여 줍니다.

## 구조

앱 → Fastify · Socket.IO API 서버 → 감정 분석 서비스(Python) · OpenAI · PostgreSQL. 발표가 끝나면 BullMQ 워커가 보고서를 만듭니다. 로컬과 Docker에서 실행했습니다.

1. 앱이 마이크 음성(16kHz PCM)을 250ms 단위로 Socket.IO로 보냅니다.
2. 서버가 5초씩 모아 음량을 재고, Whisper 부분 전사(속도·간투사·자막)와 감정 분석 서비스를 동시에 호출합니다.
3. 걸린 항목 수에 따라 초록(0) · 노랑(1) · 빨강(2 이상)으로 판정해 앱에 돌려줍니다.
4. 발표가 끝나면 BullMQ 워커가 전체 전사 · GPT 보고서 · PDF를 비동기로 만듭니다.

구성 요소와 설계 판단은 [`docs/architecture`](docs/architecture/README.md)에 있습니다.

| 경로 | 내용 |
|---|---|
| `apps/mobile/` | Expo 앱 — 녹음 · 실시간 피드백 · 결과 · 기록 (`e2e/` XCUITest) |
| `apps/api/` | Fastify + Socket.IO 서버, BullMQ 보고서 워커, Prisma. `src/realtime/` 5초 판정, `src/workers/` 보고서 |
| `apps/emotion/` | FastAPI 감정 분석 서비스 (SenseVoice-Small + emotion2vec+) |
| `packages/shared/` | 앱과 서버가 함께 쓰는 zod 스키마 · 판정 임계값 · 자막 처리 |
| `docs/` | 아키텍처 다이어그램과 설계 판단, 시뮬레이터 화면 캡처와 데모 영상 |

## 실행

준비물: Node.js 22+ · Yarn 4(`corepack enable`) · Docker Desktop · uv(감정 분석 서비스) · Xcode 또는 Android Studio · OpenAI API 키.

```bash
yarn install
cp .env.example apps/api/.env      # OPENAI_API_KEY 입력
yarn db:up                         # PostgreSQL + Redis
yarn prisma:migrate
yarn emotion:download              # 최초 1회, 감정 모델 약 1.3GB

yarn api:dev          # API 서버          http://localhost:3000
yarn api:worker       # 보고서 워커
yarn emotion:dev      # 감정 분석 서비스  http://127.0.0.1:8001 (선택)
yarn mobile:ios       # 첫 실행은 네이티브 빌드 후 시뮬레이터 실행
yarn mobile:start     # 이후에는 Metro만
```

실기기에서는 `EXPO_PUBLIC_API_URL=http://<Mac의 LAN IP>:3000 yarn mobile:start`로 실행합니다. 커스텀 네이티브 모듈을 쓰므로 Expo Go로는 실행되지 않고 개발 빌드가 필요합니다.

폰 없이 전체 흐름을 확인하려면 WAV 파일을 앱과 똑같이 스트리밍합니다.

```bash
say -v Yuna -o sample.aiff "음, 안녕하세요. 오늘 발표할 내용은 어, 피치스입니다."
afconvert -f WAVE -d LEI16@16000 -c 1 sample.aiff sample.wav
yarn workspace @pitches/api simulate ./sample.wav
```

| 변수 | 기본값 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` | — | Whisper · GPT 호출 (유일한 유료 항목) |
| `REALTIME_STT` | `on` | 5초 부분 전사. `off`면 음량·감정만으로 판정 |
| `EMOTION_URL` | `http://127.0.0.1:8001` | 감정 분석 서비스 주소. 비우면 감정 분석 생략 |
| `OPENAI_STT_MODEL` | `whisper-1` | 전사 모델 |
| `OPENAI_REPORT_MODEL` | `gpt-5-nano` | 보고서 모델 |

테스트:

```bash
yarn typecheck                              # 전체 워크스페이스 타입 검사
yarn workspace @pitches/api test            # 단위 테스트 (외부 호출 없음)
yarn workspace @pitches/api test:int        # 통합 테스트 (Docker 필요, OpenAI 호출 없음)
yarn workspace @pitches/emotion test        # 감정 서비스 테스트 (모델 로딩 없음)
```

## 기술

Expo SDK 55 · React Native · TypeScript · Fastify 5 · Socket.IO 4 · BullMQ · Prisma · PostgreSQL 16 · Redis 7 · OpenAI(Whisper · gpt-5-nano) · Python 3.12 · FastAPI · FunASR · SenseVoice-Small · emotion2vec+ · pdfkit · Yarn workspaces · Docker Compose

## 문제 해결

- **실시간 피드백이 멈추지 않는 구조** — 5초마다 부분 전사와 감정 분석 응답이 모두 필요한데, 모든 결과를 기다리면 피드백이 늦고 한 분석이 실패하면 전체가 멈췄습니다. 음량은 받은 음성에서 바로 계산하고, 전사와 감정 분석은 동시에 요청하되 다음 5초 구간이 쌓이기 전에 끝나도록 제한 시간을 두었습니다. 시간이 넘거나 실패하면 확보한 지표만으로 피드백을 이어 가고, 분석 오류는 피드백과 자막에 표시합니다.
- **무음·잡음 구간 처리** — Whisper가 무음 구간에서 문장을 지어내는 문제가 있었습니다. 음량이 기준보다 낮은 구간은 아예 호출하지 않고, 호출 뒤에는 알려진 환각 문구 목록으로 지어낸 문장을 걸러 냅니다.

## 결과

- 캡스톤 디자인 및 AI 해커톤 대상(1등, 2024.10), SW중심대학 AI 창업 아이디어 경진대회 특별상(2025.05)
- APIC-IST 2025 국제학술대회 논문 발표. 논문의 음성→지표 지연(평균 125ms, 동시 20세션 최악 170ms)은 2024–25 팀 버전 구조를 측정한 값이며, 2026 리뉴얼은 아직 다시 재지 않았습니다.
- 사용자 조사 5명 모두 실시간 표시가 말 속도 교정에 도움이 된다고 답했습니다.
- 2026 리뉴얼: Socket.IO 스트리밍, 5초 단위 판정, 분석별 대기 시간 제한, BullMQ 보고서 워커, API 단위·통합 테스트. iOS 시뮬레이터에서 로그인부터 보고서 PDF 저장까지 확인했습니다.

## 한계

- 세션 상태(5초 버퍼 · 녹음 스트림)가 API 프로세스 메모리에 있어 서버를 여러 대로 늘리려면 sticky session이 필요합니다.
- 연결이 끊긴 뒤 재접속해도 녹음을 이어 붙이지 않습니다.
- OpenAI를 쓸 수 없으면 속도·간투사 판정과 보고서가 멈춥니다. 음량·감정 판정과 자막은 로컬로 계속 동작합니다.
- Apple 로그인은 구현하지 않았습니다.

## 기록

- 포트폴리오: https://junyoung-portfolio.vercel.app/projects/pitches
- 한글 폰트 [Pretendard](https://github.com/orioncactus/pretendard) — SIL Open Font License 1.1 (`apps/api/assets/fonts/OFL.txt`)
- 감정 분석 모델 [SenseVoiceSmall](https://github.com/FunAudioLLM/SenseVoice) · [emotion2vec+](https://github.com/ddlBoJack/emotion2vec) — 모델 파일은 저장소에 없고 최초 실행 시 내려받습니다.

# Pitches.ai 구현 계획서

> **문서 버전**: v2 (2026-04-24)
> **원본 기획**: 2025 SW중심대학 AI 창업 아이디어 경진대회 제출작

---

## 1. 서비스 개요

**Pitches.ai** — 멀티모달 AI 기반 실시간 스피치 코칭 모바일 서비스.
발표 중 5초 단위로 음성을 분석해 **Pitches Circle**(초록/노랑/빨강)로 즉각적인 시각 피드백을 제공하고, 발표 종료 후 AI 기반 개인화 코칭 보고서(PDF)를 생성한다.

### 차별점
- 5초 단위 실시간 색상 피드백 + 짧은 코칭 팁
- 한국어 네이티브 분석 (경쟁 서비스 Orai·Speeko는 영어 중심)
- AI 기반 개인화 보고서 (강점/약점/개선 로드맵)
- 데이터 기반 학습 관리 (정확도 추이 그래프)

---

## 2. MVP 범위 (P0만 구현)

| # | 기능 | 비고 |
|---|---|---|
| 1 | 이메일/비밀번호 회원가입·로그인 + Apple 로그인 | JWT + bcrypt |
| 2 | 발표 세션 시작/종료, 오디오 캡처 | 5초 PCM 청크 WebSocket 전송 |
| 3 | 실시간 Pitches Circle UI | 말하기 속도 · 음량 · 간투사 기반 |
| 4 | Whisper 풀 스크립트 + GPT-4o-mini 보고서 | JSON → PDF 렌더 |
| 5 | 발표 히스토리 + 정확도 추이 그래프 | victory-native |
| 6 | PDF 보고서 저장 · 공유 | iOS/Android 공유 시트 |
| 7 | 음성 감정 분석 (2026-10-29 추가) | SenseVoiceSmall + emotion2vec+ 로컬, 5초 tick·보고서·PDF 반영 |

### 제외 (MVP 이후)
- 웨어러블(Apple Watch) 연동
- 카메라 기반 비언어 분석 (자세·표정·제스처)
- 다국어 (영어·일본어)
- B2B 대시보드 · 외부 LMS/Zoom API 통합

---

## 3. 기술 스택 (무료 중심, OpenAI API만 유료)

### Frontend — Expo (iOS + Android)
| 영역 | 선택 |
|---|---|
| 기반 | Expo SDK 52 + `expo-dev-client` |
| 언어 | TypeScript |
| 라우팅 | Expo Router (파일 기반) |
| 상태관리 | Zustand |
| 서버통신 | TanStack Query + axios |
| 실시간 | socket.io-client |
| 오디오 스트림 | `@siteed/audio-studio` (Expo Modules, 16kHz PCM 250ms 스트리밍) — `react-native-live-audio-stream`은 New Architecture 미지원으로 교체 (2026-10-29) |
| 인증 | `expo-apple-authentication` + 자체 JWT |
| 보안 저장소 | `expo-secure-store` |
| 차트 | `react-native-svg` 직접 그리기 (`victory-native` v41은 Skia 필요해서 제외) |
| PDF 저장·공유 | `expo-file-system` + `expo-sharing` (공유 시트에서 파일 저장) |
| 폰트 | Pretendard (한글, 무료) |

### Backend — Node.js (로컬 개발)
| 영역 | 선택 |
|---|---|
| 프레임워크 | Fastify 5 |
| 실시간 | Socket.IO 4 |
| ORM | Prisma 5 |
| DB | PostgreSQL 16 (Docker 로컬) |
| Redis | Redis 7 (Docker 로컬) |
| 큐 | BullMQ (Redis 기반) |
| 오디오 DSP | 순수 JS RMS 계산 + 추후 `meyda` |
| STT | OpenAI Whisper API *(유일한 유료)* — 실시간 5초 부분 전사(`REALTIME_STT`) + 종료 후 전체 전사 |
| 감정 분석 | `apps/emotion` (Python FastAPI) — SenseVoiceSmall(감정 태그·오디오 이벤트) + emotion2vec+ base(감정 확신도), 로컬 CPU, 5초 구간당 약 0.6초 |
| LLM | OpenAI `gpt-5-nano` 기본 (`OPENAI_REPORT_MODEL`로 변경) *(유일한 유료)* — gpt-5 계열은 temperature 미지원 |
| PDF | pdfkit |
| 인증 | `@fastify/jwt` + bcryptjs |
| 스토리지 | 로컬 filesystem (`Storage` 인터페이스로 추상화) |
| 로깅 | pino |

### 모노레포 / 빌드
- **Yarn Berry v4** (`nodeLinker: node-modules`)
- 워크스페이스: `apps/api`, `apps/mobile`, `packages/shared`
- TypeScript 5.6, tsx (dev 핫리로드)

---

## 4. 시스템 아키텍처

```
┌─────────────────────────────┐          ┌──────────────────────────────────┐
│  Mobile App (Expo)          │          │  Node.js Backend                 │
│  iOS + Android              │  REST    │  ┌────────────────────────────┐  │
│                             │◄────────►│  │ Fastify REST               │  │
│  • 오디오 캡처 (5s PCM)     │          │  │ /auth /sessions /reports   │  │
│  • Pitches Circle UI        │          │  └────────────────────────────┘  │
│  • 히스토리 / 보고서 뷰     │ Socket   │                                  │
│                             │◄────────►│  ┌────────────────────────────┐  │
└─────────────────────────────┘          │  │ Socket.IO /live            │  │
                                         │  │  ├─ RMS/WPM/filler 계산    │  │
                                         │  │  ├─ Whisper (부분 STT)     │  │
                                         │  │  └─ 색상 판정 → emit       │  │
                                         │  └────────────────────────────┘  │
                                         │                                  │
                                         │  ┌────────────────────────────┐  │
                                         │  │ BullMQ Worker              │  │
                                         │  │  Whisper(풀) → GPT → PDF   │  │
                                         │  └────────────────────────────┘  │
                                         └──┬──────────┬──────────┬────────┘
                                            │          │          │
                                      ┌─────▼───┐ ┌────▼────┐ ┌───▼────────┐
                                      │Postgres │ │  Redis  │ │ uploads/   │
                                      │(Docker) │ │ (Docker)│ │(local FS)  │
                                      └─────────┘ └─────────┘ └────────────┘
                                                                    │
                                                              ┌─────▼──────┐
                                                              │ OpenAI API │
                                                              └────────────┘
```

---

## 5. 데이터 모델 (Prisma)

```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String?
  appleSub     String?   @unique
  name         String
  locale       String    @default("ko")
  sessions     Session[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Session {
  id          String         @id @default(cuid())
  userId      String
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  startedAt   DateTime       @default(now())
  endedAt     DateTime?
  audioPath   String?
  durationSec Int?
  status      SessionStatus  @default(IN_PROGRESS)
  ticks       FeedbackTick[]
  report      Report?
  @@index([userId, createdAt])
}

model FeedbackTick {
  id        String   @id @default(cuid())
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  offsetMs  Int
  color     String   // green | yellow | red
  speedWpm  Float
  volumeDb  Float
  fillerCnt Int
  tip       String?
  createdAt DateTime @default(now())
  @@index([sessionId, offsetMs])
}

model Report {
  id            String   @id @default(cuid())
  sessionId     String   @unique
  session       Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  transcript    String
  overallScore  Int
  summary       Json
  speechMetrics Json
  pdfPath       String?
  generatedAt   DateTime @default(now())
}

enum SessionStatus { IN_PROGRESS ANALYZING COMPLETED FAILED }
```

---

## 6. API 명세

### REST
```
POST /auth/signup          이메일 가입
POST /auth/login           이메일 로그인
POST /auth/apple           Apple identity token 검증 → JWT
GET  /me

POST /sessions                     세션 생성 → { sessionId, wsToken }
GET  /sessions                     내 세션 목록
GET  /sessions/:id                 세션 상세
POST /sessions/:id/finalize        발표 종료 → BullMQ 잡 큐잉

GET  /reports/:id                  보고서 JSON
GET  /reports/:id/pdf              PDF 파일

GET  /stats/progress               정확도 추이 데이터
```

### Socket.IO `/live` 네임스페이스
| 방향 | 이벤트 | 페이로드 |
|---|---|---|
| C→S | `session:join` | `{ sessionId, token }` |
| C→S | `audio:chunk` | `{ seq, timestampMs, pcmBase64 }` |
| C→S | `session:end` | — |
| S→C | `session:joined` | `{ sessionId }` |
| S→C | `feedback:tick` | `{ seq, color, speedWpm, fillerCnt, volumeDb, tip }` |
| S→C | `session:ended` | `{ sessionId, reportJobId }` |
| S→C | `error` | `{ code, message }` |

---

## 7. 실시간 파이프라인

```
[앱] 5초 PCM 청크 (16kHz, mono, int16)
  │ Socket.IO emit "audio:chunk"
  ▼
[서버] 병렬 처리
  ├─ RMS → 평균 음량(dB)
  ├─ Whisper API 부분 호출 → 텍스트 토큰
  │   ├─ 글자 수 / 시간 → WPM
  │   └─ 정규식 → 간투사 카운트 (음/어/그/저기/뭐)
  └─ 규칙 기반 판정
  │
  ▼ { color, speedWpm, fillerCnt, volumeDb, tip }
[서버] emit "feedback:tick" → 앱 UI 업데이트
```

### 실시간 판정 규칙 (한국어 초기값)
```ts
const SPEED_OK   = [220, 340]; // 자/분 (한국어 기준)
const VOLUME_MIN = -35;        // dB
const FILLER_MAX = 1;          // 5초 이내 허용 개수

function classify(f): "green" | "yellow" | "red" {
  const issues = [];
  if (f.speedWpm < SPEED_OK[0] || f.speedWpm > SPEED_OK[1]) issues.push("speed");
  if (f.volumeDb < VOLUME_MIN) issues.push("volume");
  if (f.fillerCnt > FILLER_MAX) issues.push("fillers");
  if (issues.length === 0) return "green";
  if (issues.length === 1) return "yellow";
  return "red";
}
```
> 임계값은 베타 실측으로 조정.

---

## 8. 최종 보고서 파이프라인

```
발표 종료 → POST /sessions/:id/finalize
  │
  ▼ BullMQ 잡 큐잉
[Worker]
  ├─ Whisper API (verbose_json) → 세그먼트·타임스탬프 스크립트
  ├─ 세션의 모든 FeedbackTick 집계 → speechMetrics
  │   { avgWpm, fillerCount, avgVolumeDb, ... }
  ├─ GPT-4o-mini → JSON 보고서
  │   { overallScore, summary, voiceAnalysis, contentAnalysis,
  │     strengths, weaknesses, roadmap }
  ├─ pdfkit 렌더 → uploads/reports/<id>.pdf
  └─ Report 레코드 생성
  │
  ▼ (향후) FCM 푸시 알림
[앱] 보고서 탭에서 확인
```

---

## 9. 프로젝트 구조

```
pitches/
├── .yarn/
├── .yarnrc.yml
├── package.json                    # workspaces 루트
├── tsconfig.base.json
├── docker-compose.yml              # postgres + redis
├── .env.example
├── PLAN.md                         # ← 이 문서
├── README.md
│
├── apps/
│   ├── api/                        # Node.js 백엔드
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── config.ts
│   │   │   ├── plugins/            # prisma 등 Fastify 플러그인
│   │   │   ├── routes/             # REST 엔드포인트
│   │   │   ├── realtime/           # Socket.IO + 실시간 파이프라인
│   │   │   │   ├── gateway.ts
│   │   │   │   ├── pipeline.ts
│   │   │   │   └── features/       # RMS, WPM, fillers
│   │   │   ├── workers/            # BullMQ 컨슈머
│   │   │   ├── services/           # stt, llm, storage, pdf
│   │   │   └── lib/                # logger 등
│   │   ├── prisma/schema.prisma
│   │   └── uploads/                # .gitignore
│   │
│   └── mobile/                     # Expo RN
│       ├── app/                    # Expo Router
│       │   ├── _layout.tsx
│       │   ├── index.tsx
│       │   ├── (auth)/login.tsx
│       │   ├── (tabs)/
│       │   │   ├── _layout.tsx
│       │   │   ├── index.tsx       # 홈
│       │   │   └── history.tsx
│       │   └── session/record.tsx  # 녹음 + Pitches Circle
│       ├── src/
│       │   ├── api/client.ts
│       │   ├── socket/client.ts
│       │   ├── store/auth.ts
│       │   └── components/PitchesCircle.tsx
│       └── app.config.ts
│
└── packages/
    └── shared/                     # 공통 타입/스키마
        └── src/schemas.ts          # zod (Socket 이벤트·DTO)
```

---

## 10. 12주 개발 로드맵

| 주차 | 목표 | 산출물 |
|---|---|---|
| **W1** | Yarn Berry 모노레포 + docker-compose + Prisma 스키마 + `/health` | 서버 부팅 + DB 연결 |
| **W2** | 이메일 회원가입/로그인, Apple 로그인, User CRUD | 인증 플로우 동작 |
| **W3** | 세션 생성·종료, RN 오디오 캡처, Socket.IO 연결 | 5s 청크 서버 수신 |
| **W4** | RMS/WPM/filler 계산, 판정 규칙, feedback:tick emit | Pitches Circle 색 변화 |
| **W5** | 실시간 UI 완성 + 팁 메시지 + 세션 종료 UX | 실시간 데모 가능 |
| **W6** | Whisper 풀 STT + BullMQ 워커 | 발표→스크립트 |
| **W7** | GPT-4o-mini 프롬프트 + zod 검증 + Report 저장 | 구조화 보고서 JSON |
| **W8** | pdfkit 한글 폰트 + 보고서 뷰어 + 공유 | PDF 저장 동작 |
| **W9** | 히스토리 목록 + 정확도 추이 차트 | 홈/히스토리 완성 |
| **W10** | 에러 처리, 재연결, 오프라인 녹음 백업 (Sentry는 유료라 제외) | 안정성 확보 |
| **W11** | 내부 베타 (팀 + 지인 20명) | 피드백 수집 |
| **W12** | 버그 수정 + 폴리싱 | v1.0 내부 배포본 |

---

## 11. 리스크 & 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 실시간 지연 (Whisper 왕복 1~2s) | UX 저하 | RMS는 서버 로컬로 즉시, Whisper는 비동기 보정 |
| OpenAI 비용 폭증 | 무료 티어 한계 | 무료 플랜 월 사용 시간 캡 + 사용량 테이블 |
| Expo에서 PCM 스트리밍 | 네이티브 모듈 필요 | `expo-dev-client` + `react-native-live-audio-stream` |
| iOS 마이크 백그라운드 | 녹음 중단 | `UIBackgroundModes: audio` 설정 |
| Prisma + Yarn Berry | 제너레이터 이슈 | `nodeLinker: node-modules` 고정, 제너레이트 후 `yarn install` |
| 개인정보(녹음본) | 법적 이슈 | 30일 자동 삭제 정책, 추후 동의서 설계 |
| pdfkit 한글 미지원 | PDF 깨짐 | Pretendard TTF 임베드 필요 |

---

## 12. 시작 체크리스트

**필수 사전 설치**
- [ ] Node.js 22+ (Node 24 OK)
- [ ] corepack enable → yarn 4.x 활성화
- [ ] Docker Desktop (Postgres/Redis용)
- [ ] Xcode (iOS 시뮬레이터)
- [ ] Android Studio (Android 에뮬레이터)
- [ ] OpenAI API 키

**첫날 할 일**
```bash
# 1. 의존성 설치
corepack enable
cd pitches
yarn install

# 2. 환경 변수
cp .env.example .env
# OPENAI_API_KEY 입력

# 3. 데이터베이스 기동
yarn db:up
yarn prisma:migrate

# 4. 서버 / 앱 기동 (각각 다른 터미널)
yarn api:dev
yarn mobile:start
```

---

## 13. 진행 현황

현재 구조와 설계 판단: [`docs/architecture/README.md`](./architecture/README.md)

## 14. 참고 원자료

- 2025 SW중심대학 AI 창업 아이디어 경진대회 제출 자료 (발표자료 · 기술 보고서 · 발표 요약본) — 저장소에는 포함하지 않음

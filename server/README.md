# NAS 학습 서버 설치 안내

이 작은 서버(`server.js`)는 **집 NAS**에서 돌아가며 두 가지 일을 합니다.

1. **동기화 저장소** — 모든 기기(아빠폰·엄마폰·태블릿)의 진도·프로필·학습로그를 한곳에 저장 → 어디서 접속해도 같은 데이터
2. **AI 분석 리포트** — 모아진 학습 데이터를 Claude로 분석해 학부모용 리포트 생성

> 의존성이 전혀 없어요. **Node.js 18 이상**만 있으면 됩니다. (`npm install` 불필요)

---

## 1) 준비물
- 집 NAS (시놀로지/QNAP 등) 또는 항상 켜져 있는 PC
- **Anthropic API 키** (https://console.anthropic.com → API Keys) — AI 리포트용
- 직접 정할 **APP_TOKEN**(공유 비밀번호, 아무 문자열) — 외부인이 못 쓰게 막는 용도

---

## 2) 실행 방법

### 방법 A — Node로 직접 실행
```bash
ANTHROPIC_API_KEY=sk-ant-... \
APP_TOKEN=우리집비밀123 \
PORT=8787 \
node server.js
```

### 방법 B — Docker (시놀로지 Container Manager 등)
`docker-compose.yml`:
```yaml
services:
  study:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./server:/app          # 이 폴더(server.js 포함)를 마운트
      - ./study-data:/app/data # 데이터 영구 저장
    environment:
      ANTHROPIC_API_KEY: "sk-ant-..."
      APP_TOKEN: "우리집비밀123"
      MODEL: "claude-opus-4-8"   # 저렴하게: claude-haiku-4-5
      # (선택) 자연스러운 읽어주기 음성 — ElevenLabs
      ELEVENLABS_API_KEY: "여기에_ElevenLabs_키"
      ELEVENLABS_VOICE_ID: "21m00Tcm4TlvDq8ikWAM"  # 원하는 한국어 음성 ID로 교체 권장
    command: node server.js
    ports:
      - "8787:8787"
    restart: unless-stopped
```
```bash
docker compose up -d
```

정상이면 로그에 `[학습서버] 포트 8787 ...` 이 떠요.
브라우저에서 `http://NAS주소:8787/api/health` → `{"ok":true}` 보이면 성공.

---

## 3) ⚠️ 중요 — HTTPS 필요 (앱이 https라서)
게임 사이트는 `https://`(GitHub Pages)예요. 보안상 **https 사이트는 http 주소로 연결할 수 없어요(혼합 콘텐츠 차단).**
따라서 NAS 서버도 **https 주소**로 노출해야 합니다. 가장 쉬운 무료 방법:

### Cloudflare Tunnel (추천, 무료·공유기 설정 불필요)
```bash
# NAS에서
cloudflared tunnel --url http://localhost:8787
```
실행하면 `https://xxxx-xxxx.trycloudflare.com` 같은 **https 주소**를 줍니다. 그 주소를 앱에 넣으면 끝.
(고정 주소가 필요하면 Cloudflare 계정으로 named tunnel을 만들면 됩니다.)

### 대안
- 시놀로지/QNAP **리버스 프록시 + Let's Encrypt 인증서**로 `https://study.내도메인` 만들기
- 또는 게임을 집에서 http로 따로 호스팅(권장 안 함)

---

## 4) 앱에 연결
게임에서 **시작 화면 → ☁️ 동기화 설정**(또는 부모 보기 화면)을 열고:
- **서버 주소**: 위에서 받은 `https://...` 주소 (끝에 `/api`는 빼고 도메인까지만)
- **앱 토큰**: 위에서 정한 `APP_TOKEN`

저장하면 그 기기가 NAS와 동기화됩니다. 다른 기기에서도 같은 주소·토큰을 입력하면 같은 데이터를 봅니다.

---

## 5) 보안 메모
- `APP_TOKEN`을 꼭 설정하세요(빈 값이면 누구나 접근 가능).
- **API 키는 NAS 안에만** 두세요. 게임(공개 사이트)에는 절대 넣지 않습니다 — 그래서 이 중계 서버가 필요한 거예요.
- 외부 노출이 부담되면 집 와이파이에서만 쓰고, 외출 시엔 동기화를 꺼도 됩니다(앱은 오프라인으로도 동작).
- 데이터는 `data/` 폴더에 평문 JSON으로 저장됩니다(민감정보 없음: 이름·진도·문제기록).

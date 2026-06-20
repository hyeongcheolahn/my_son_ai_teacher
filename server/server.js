// 수학 포켓 배틀 — NAS용 데이터/분석 서버 (의존성 0, Node 18+ 내장 기능만 사용)
// 역할: (1) 기기 간 진도·프로필·로그 동기화 저장소  (2) Claude로 학습 분석 리포트 생성
//
// 실행:  ANTHROPIC_API_KEY=... APP_TOKEN=비밀번호 node server.js
// 환경변수:
//   ANTHROPIC_API_KEY  (필수, 분석 리포트용 Claude API 키)
//   APP_TOKEN          (필수 권장, 앱이 보낼 공유 비밀번호 — 아무나 못 쓰게)
//   PORT               (기본 8787)
//   DATA_DIR           (기본 ./data, 저장 파일 위치)
//   MODEL              (기본 claude-opus-4-8; 저렴하게 하려면 claude-haiku-4-5)
//   ALLOW_ORIGIN       (기본 *  — 특정 사이트만 허용하려면 https://...github.io)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8787;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const APP_TOKEN = process.env.APP_TOKEN || '';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.MODEL || 'claude-opus-4-8';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
// ElevenLabs 음성(자연스러운 읽어주기) — 키가 있을 때만 작동
const TTS_KEY = process.env.ELEVENLABS_API_KEY || '';
const TTS_VOICE = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // 기본 Rachel(원하는 한국어 음성 ID로 바꾸세요)
const TTS_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

fs.mkdirSync(DATA_DIR, { recursive: true });
const TTS_DIR = path.join(DATA_DIR, 'tts');
try { fs.mkdirSync(TTS_DIR, { recursive: true }); } catch {}

const safeId = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
const fileFor = (name) => path.join(DATA_DIR, name);
function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJson(file, obj) { fs.writeFileSync(file, JSON.stringify(obj)); }

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-app-token');
  res.setHeader('Access-Control-Max-Age', '86400');
}
function send(res, code, obj) { cors(res); res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function body(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', (c) => { d += c; if (d.length > 5e6) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
}
const authed = (req) => !APP_TOKEN || req.headers['x-app-token'] === APP_TOKEN;

// ---- Claude 호출 공통 -------------------------------------------------------
async function callClaude(sys, user, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens || 1024, system: sys, messages: [{ role: 'user', content: user }] }),
  });
  const j = await r.json();
  if (!r.ok) return { error: `Claude 오류: ${j.error ? j.error.message : r.status}` };
  const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return { text: text || '(빈 응답)' };
}

// ---- 학부모용 분석 리포트 ---------------------------------------------------
async function makeReport(name, analysis) {
  if (!API_KEY) return { error: 'NAS 서버에 ANTHROPIC_API_KEY가 설정되지 않았어요.' };
  const sys = `당신은 다정하고 통찰력 있는 초등 저학년 담임 선생님입니다. 학부모에게 아이의 학습 데이터를 바탕으로 짧고 따뜻한 한국어 리포트를 씁니다.
규칙: 칭찬과 강점 먼저, 그다음 취약점 2~3가지를 구체적으로(어떤 단원/유형), 마지막에 집에서 해볼 실천 팁 2~3가지. 과장·전문용어 금지, 부드러운 존댓말, 이모지 약간. 6~10문장.`;
  const user = `아이 이름: ${name || '아이'}\n학습 데이터(JSON):\n${JSON.stringify(analysis)}\n\n이 데이터를 분석해 학부모용 리포트를 작성해줘.`;
  try {
    const out = await callClaude(sys, user, 2000);
    return out.error ? out : { report: out.text };
  } catch (e) { return { error: '리포트 생성 실패: ' + e.message }; }
}

// ---- AI 선생님: 아이에게 문제를 눈높이로 설명 -------------------------------
async function makeExplain(b) {
  if (!API_KEY) return { error: 'NAS 서버에 ANTHROPIC_API_KEY가 설정되지 않았어요.' };
  const sys = `너는 아주 다정하고 친근한 초등학교 저학년 선생님이야. 아이가 방금 풀고 있는(또는 틀린) 문제를 쉽고 재미있게 설명해 줘.
규칙:
- 따뜻한 반말로, 아이에게 직접 말하듯이.
- 정답이 왜 그렇게 되는지 '과정'을 아주 작은 단계로 차근차근. (예: 손가락/구슬로 세기, 같은 수 여러 번 더하기 등 구체적 비유)
- 전문용어 금지, 짧고 쉬운 문장. 3~5문장.
- 마지막에 한 문장으로 응원. 이모지 1~2개.`;
  const parts = [];
  if (b.name) parts.push(`아이 이름: ${b.name}`);
  if (b.subject) parts.push(`과목: ${b.subject}`);
  parts.push(`문제: ${b.question}`);
  if (Array.isArray(b.choices) && b.choices.length) parts.push(`보기: ${b.choices.join(', ')}`);
  parts.push(`정답: ${b.correctAnswer}`);
  if (b.studentAnswer != null && String(b.studentAnswer) !== String(b.correctAnswer)) parts.push(`아이가 고른 답(틀림): ${b.studentAnswer}`);
  parts.push('\n이 문제를 아이가 이해할 수 있게 설명해 줘.');
  try {
    const out = await callClaude(sys, parts.join('\n'), 700);
    return out.error ? out : { explain: out.text };
  } catch (e) { return { error: '설명 생성 실패: ' + e.message }; }
}

// ---- ElevenLabs 음성(읽어주기) — 같은 문장은 파일 캐시로 재사용 -------------
async function makeTts(text, voice) {
  if (!TTS_KEY) return { status: 501, error: 'NAS 서버에 ELEVENLABS_API_KEY가 설정되지 않았어요.' };
  const vid = (voice && /^[A-Za-z0-9]+$/.test(voice)) ? voice : TTS_VOICE;
  const hash = crypto.createHash('sha1').update(vid + '|' + TTS_MODEL + '|' + text).digest('hex');
  const cacheFile = path.join(TTS_DIR, hash + '.mp3');
  try { const buf = fs.readFileSync(cacheFile); if (buf && buf.length) return { status: 200, audio: buf }; } catch {}
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': TTS_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: TTS_MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } }),
    });
    if (!r.ok) { const t = await r.text().catch(() => ''); return { status: 502, error: `TTS 오류 ${r.status}: ${t.slice(0, 200)}` }; }
    const buf = Buffer.from(await r.arrayBuffer());
    try { fs.writeFileSync(cacheFile, buf); } catch {}
    return { status: 200, audio: buf };
  } catch (e) { return { status: 502, error: '음성 생성 실패: ' + e.message }; }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/api/health') return send(res, 200, { ok: true, explain: !!API_KEY, tts: !!TTS_KEY });

  if (!authed(req)) return send(res, 401, { error: '인증 실패(앱 토큰 불일치)' });

  // 프로필 목록
  if (p === '/api/profiles' && req.method === 'GET') {
    return send(res, 200, readJson(fileFor('profiles.json'), { profiles: [], activeId: null, updatedAt: 0 }));
  }
  if (p === '/api/profiles' && req.method === 'PUT') {
    const b = await body(req); b.updatedAt = b.updatedAt || Date.now();
    writeJson(fileFor('profiles.json'), b); return send(res, 200, { ok: true });
  }

  // 개별 세이브
  if (p === '/api/save' && req.method === 'GET') {
    const id = safeId(url.searchParams.get('id'));
    return send(res, 200, readJson(fileFor(`save-${id}.json`), null) || { data: null, updatedAt: 0 });
  }
  if (p === '/api/save' && req.method === 'PUT') {
    const id = safeId(url.searchParams.get('id'));
    const b = await body(req); b.updatedAt = b.updatedAt || Date.now();
    writeJson(fileFor(`save-${id}.json`), b); return send(res, 200, { ok: true });
  }

  // 분석 리포트
  if (p === '/api/report' && req.method === 'POST') {
    const b = await body(req);
    const out = await makeReport(b.name, b.analysis || {});
    return send(res, out.error ? 502 : 200, out);
  }

  // AI 선생님: 문제 설명
  if (p === '/api/explain' && req.method === 'POST') {
    const b = await body(req);
    if (!b || !b.question) return send(res, 400, { error: '문제 정보가 없어요.' });
    const out = await makeExplain(b);
    return send(res, out.error ? 502 : 200, out);
  }

  // 읽어주기(자연스러운 음성) — mp3 반환
  if (p === '/api/tts' && req.method === 'POST') {
    const b = await body(req);
    if (!b || !b.text) return send(res, 400, { error: 'text 없음' });
    const out = await makeTts(String(b.text).slice(0, 800), b.voice);
    if (out.status === 200) {
      cors(res);
      res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=86400' });
      return res.end(out.audio);
    }
    return send(res, out.status, { error: out.error || 'TTS 실패' });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`[학습서버] 포트 ${PORT}, 데이터 ${DATA_DIR}, 모델 ${MODEL}`);
  if (!API_KEY) console.log('  ⚠️ ANTHROPIC_API_KEY 미설정 → 동기화는 되지만 AI 리포트는 비활성');
  if (!APP_TOKEN) console.log('  ⚠️ APP_TOKEN 미설정 → 누구나 접근 가능(집 안 전용이 아니면 꼭 설정하세요)');
});

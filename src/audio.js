// WebAudio 기반 초경량 효과음. 외부 파일 없이 합성한다.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('sfx_muted') === '1'; } catch {}
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// iOS 우회: 아이폰/아이패드는 옆면 '무음 스위치(벨소리 OFF)'가 켜져 있으면
// WebAudio 효과음이 통째로 막힌다. 무음 오디오 태그를 루프로 재생해 두면
// WebView 가 '미디어 재생' 모드로 바뀌어, 무음 스위치와 상관없이(볼륨 버튼만 따름)
// 효과음이 나오게 된다. (첫 사용자 터치 때 한 번 켜 둔다.)
const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
let silentEl = null;
let unlocked = false;

// 읽어주기(mp3) 재생용 엘리먼트 — 첫 제스처에 미리 깨워 두면 iOS에서도 이후 자동재생 가능
let ttsEl = null;
function ensureTtsEl() {
  if (!ttsEl) { ttsEl = new Audio(); ttsEl.setAttribute('playsinline', ''); }
  return ttsEl;
}
export function playUrl(url) {
  const el = ensureTtsEl();
  try { el.pause(); el.src = url; el.currentTime = 0; const p = el.play(); if (p && p.catch) p.catch(() => {}); } catch {}
}
export function stopUrl() { try { if (ttsEl) ttsEl.pause(); } catch {} }

function unlockAudio() {
  const a = ac();
  if (a && a.state === 'suspended') a.resume();
  if (!silentEl) {
    silentEl = new Audio(SILENT_WAV);
    silentEl.loop = true;
    silentEl.volume = 0.02;
    silentEl.setAttribute('playsinline', '');
  }
  silentEl.play().catch(() => {});
  // mp3 재생 엘리먼트도 한 번 깨워 둔다(iOS 자동재생 제한 우회)
  try { const t = ensureTtsEl(); const pr = t.play(); if (pr && pr.then) pr.then(() => t.pause()).catch(() => {}); } catch {}
  unlocked = true;
}

// 첫 사용자 제스처(터치/클릭/키)에 자동으로 오디오 잠금을 푼다.
if (typeof window !== 'undefined') {
  const onFirst = () => { unlockAudio(); };
  ['touchend', 'pointerdown', 'mousedown', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, onFirst, { capture: true, passive: true }));
}

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
  if (muted) return;
  const a = ac(); if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
  gain.gain.setValueAtTime(vol, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(); osc.stop(a.currentTime + dur);
}

export const sfx = {
  unlock() { unlockAudio(); },
  isMuted() { return muted; },
  setMuted(b) { muted = !!b; try { localStorage.setItem('sfx_muted', b ? '1' : '0'); } catch {} },
  tap() { tone(440, 0.06, 'square', 0.12); },
  correct() { tone(660, 0.1, 'triangle', 0.2); setTimeout(() => tone(880, 0.14, 'triangle', 0.2), 90); },
  wrong() { tone(200, 0.25, 'sawtooth', 0.15, 110); },
  attack() { tone(520, 0.18, 'square', 0.18, 180); },
  impact() { tone(120, 0.22, 'sawtooth', 0.22, 60); },
  throw() { tone(380, 0.2, 'sine', 0.15, 700); },
  catch() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.2), i * 110)); },
  escape() { tone(300, 0.3, 'sawtooth', 0.18, 120); },
  levelup() { [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.2, 'triangle', 0.22), i * 90)); },
};

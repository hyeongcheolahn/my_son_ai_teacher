// WebAudio 기반 초경량 효과음. 외부 파일 없이 합성한다.
let ctx = null;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null) {
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
  unlock() { ac(); },
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

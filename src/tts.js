// 읽어주기(음성 합성). 브라우저 Web Speech API 사용 — 외부 파일/네트워크 불필요.
// 영어 단어는 영어 발음으로, 한국어 문장은 한국어로 읽어 준다.

export function speakSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// 사용할 음성 고르기 (한국어면 친근한 한국어 음성 우선)
function pickVoice(lang) {
  try {
    const vs = window.speechSynthesis.getVoices() || [];
    if (!vs.length) return null;
    const code = (lang || 'ko-KR').slice(0, 2).toLowerCase();
    const same = vs.filter((v) => (v.lang || '').toLowerCase().startsWith(code));
    if (code === 'ko') {
      return same.find((v) => /yuna|sora|female|여|아이|kid/i.test(v.name)) || same[0] || null;
    }
    return same.find((v) => /female|samantha|kid/i.test(v.name)) || same[0] || null;
  } catch { return null; }
}

// 일부 브라우저는 첫 호출 때 음성 목록이 비어 있어 비동기로 로드된다 — 미리 깨워 둔다.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try { window.speechSynthesis.getVoices(); window.speechSynthesis.onvoiceschanged = () => {}; } catch {}
}

export function speak(text, lang, opts = {}) {
  if (!speakSupported() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang || (/[가-힣]/.test(text) ? 'ko-KR' : (/[A-Za-z]/.test(text) ? 'en-US' : 'ko-KR'));
    u.rate = opts.rate != null ? opts.rate : (u.lang === 'en-US' ? 0.85 : 0.95);
    u.pitch = opts.pitch != null ? opts.pitch : 1.05;
    const v = pickVoice(u.lang);
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch {}
}

// 배움 설명용: 자연스럽고 친근한 톤으로 약간 천천히 읽어 준다.
export function speakFriendly(text) {
  speak(text, 'ko-KR', { pitch: 1.1, rate: 0.9 });
}

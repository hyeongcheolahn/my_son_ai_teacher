// 읽어주기(음성 합성). 브라우저 Web Speech API 사용 — 외부 파일/네트워크 불필요.
// 영어 단어는 영어 발음으로, 한국어 문장은 한국어로 읽어 준다.

export function speakSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text, lang) {
  if (!speakSupported() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang || (/[가-힣]/.test(text) ? 'ko-KR' : (/[A-Za-z]/.test(text) ? 'en-US' : 'ko-KR'));
    u.rate = lang === 'en-US' ? 0.85 : 0.95; // 아이가 듣기 좋게 약간 천천히
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  } catch {}
}

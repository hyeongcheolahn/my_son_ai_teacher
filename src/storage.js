// localStorage 진행도 저장 (오프라인, 가족 사적 이용)
const KEY = 'pocket-math-save-v2';

const DEFAULT = () => ({
  currentSubject: null,        // 'math' | 'english' | 'hanja' | 'science'
  subjects: {},                // { subject: { current, skills } } — 과목별 적응형 진도
  owned: [],                   // [{ uid, subject, speciesId }] — 보유 개체
  activeUid: null,             // 출전 중인 개체 uid
  uidSeq: 1,
  dexSeen: {},                 // { speciesId: true }
  dexCaught: {},               // { speciesId: count }
  graduated: {},               // { subject: true } — 졸업(전설 격파) 여부
  trainerLevel: 1,
  totalCorrect: 0,
  totalWrong: 0,
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT();
    return { ...DEFAULT(), ...JSON.parse(raw) };
  } catch {
    return DEFAULT();
  }
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch {}
  return DEFAULT();
}

// localStorage 진행도 저장 (오프라인, 가족 사적 이용)
// 프로필(다수 사용자) 지원: 사람마다 별도 세이브를 둔다.
const PROFILES_KEY = 'pocket-math-profiles-v1';
const SAVE_PREFIX = 'pocket-math-save-v2::'; // + profileId
const LEGACY_SAVE = 'pocket-math-save-v2';   // 프로필 도입 전 단일 세이브

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
  review: [],                  // [{ key, text, answer, choices, skillId, subject }] — 오답 복습 목록
});

// ---- 프로필 관리 ----------------------------------------------------------
function readProfiles() {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { profiles: [], activeId: null };
}
function writeProfiles(p) {
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(p)); } catch {}
}

export function listProfiles() { return readProfiles().profiles; }
export function activeProfileId() { return readProfiles().activeId; }
export function getActiveProfile() {
  const p = readProfiles();
  return p.profiles.find((x) => x.id === p.activeId) || null;
}

export function createProfile(name, avatar) {
  const p = readProfiles();
  const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const profile = { id, name: (name || '친구').slice(0, 12), avatar: avatar || '🦊' };
  p.profiles.push(profile);
  p.activeId = id;
  writeProfiles(p);
  return profile;
}

export function updateProfile(id, patch) {
  const p = readProfiles();
  const prof = p.profiles.find((x) => x.id === id);
  if (prof) { Object.assign(prof, patch); writeProfiles(p); }
}

export function setActiveProfile(id) {
  const p = readProfiles();
  if (p.profiles.some((x) => x.id === id)) { p.activeId = id; writeProfiles(p); }
}

export function deleteProfile(id) {
  const p = readProfiles();
  p.profiles = p.profiles.filter((x) => x.id !== id);
  try { localStorage.removeItem(SAVE_PREFIX + id); } catch {}
  if (p.activeId === id) p.activeId = p.profiles[0] ? p.profiles[0].id : null;
  writeProfiles(p);
}

// 프로필 도입 전 단일 세이브가 있으면 기본 프로필로 옮긴다(최초 1회).
export function migrateLegacy() {
  const p = readProfiles();
  if (p.profiles.length > 0) return;
  let legacy = null;
  try { legacy = localStorage.getItem(LEGACY_SAVE); } catch {}
  if (legacy) {
    const profile = createProfile('친구', '🦊');
    try { localStorage.setItem(SAVE_PREFIX + profile.id, legacy); localStorage.removeItem(LEGACY_SAVE); } catch {}
  }
}

// ---- 세이브(활성 프로필 기준) --------------------------------------------
function saveKey() {
  const id = activeProfileId();
  return id ? SAVE_PREFIX + id : LEGACY_SAVE;
}

export function load() {
  try {
    const raw = localStorage.getItem(saveKey());
    if (!raw) return DEFAULT();
    return { ...DEFAULT(), ...JSON.parse(raw) };
  } catch {
    return DEFAULT();
  }
}

export function save(state) {
  try { localStorage.setItem(saveKey(), JSON.stringify(state)); } catch {}
}

// 활성 프로필의 진행도만 초기화(프로필 자체는 유지)
export function reset() {
  try { localStorage.removeItem(saveKey()); } catch {}
  return DEFAULT();
}

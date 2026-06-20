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
  log: [],                     // [{ t, subject, skillId, correct, ms, kind }] — 문제별 기록(분석용)
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
  try { localStorage.setItem(PROFILES_KEY, JSON.stringify(p)); setLocalU(PROFILES_KEY, Date.now()); } catch {}
  pushProfiles();
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

let _pushT = null;
export function save(state) {
  try { localStorage.setItem(saveKey(), JSON.stringify(state)); setLocalU(saveKey(), Date.now()); } catch {}
  if (syncOn()) { clearTimeout(_pushT); const id = activeProfileId(); _pushT = setTimeout(() => pushSaveId(id, state, localU(SAVE_PREFIX + id)), 1200); }
}

// 학습 진도만 초기화. 보유 포켓몬·레벨·도감은 그대로 유지한다.
export function reset() {
  const cur = load();
  const fresh = DEFAULT();
  fresh.owned = cur.owned || [];          // 잡은 포켓몬 + 레벨/경험치 유지
  fresh.activeUid = cur.activeUid || null;
  fresh.uidSeq = cur.uidSeq || 1;
  fresh.dexSeen = cur.dexSeen || {};       // 도감 기록 유지
  fresh.dexCaught = cur.dexCaught || {};
  try { localStorage.setItem(saveKey(), JSON.stringify(fresh)); setLocalU(saveKey(), Date.now()); } catch {}
  const id = activeProfileId();
  if (syncOn() && id) pushSaveId(id, fresh, Date.now());
  return fresh;
}

// ---- NAS 동기화 (선택) ----------------------------------------------------
const URL_KEY = 'sync_url', TOK_KEY = 'sync_token';
export function syncUrl() { try { return localStorage.getItem(URL_KEY) || ''; } catch { return ''; } }
export function syncToken() { try { return localStorage.getItem(TOK_KEY) || ''; } catch { return ''; } }
export function syncOn() { return !!syncUrl(); }
export function setSync(url, token) {
  try {
    if (url) localStorage.setItem(URL_KEY, String(url).trim().replace(/\/+$/, ''));
    else localStorage.removeItem(URL_KEY);
    localStorage.setItem(TOK_KEY, token || '');
  } catch {}
}
function localU(key) { try { return +localStorage.getItem(key + '::u') || 0; } catch { return 0; } }
function setLocalU(key, v) { try { localStorage.setItem(key + '::u', String(v || Date.now())); } catch {} }

function api(method, pathname, bodyObj) {
  const base = syncUrl(); if (!base) return Promise.reject('no-url');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  return fetch(base + pathname, {
    method, signal: ctrl.signal,
    headers: { 'content-type': 'application/json', 'x-app-token': syncToken() },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  }).then((r) => { clearTimeout(timer); return r.ok ? r.json() : Promise.reject(r.status); });
}

export function pushProfiles() {
  if (!syncOn()) return Promise.resolve();
  const p = readProfiles();
  return api('PUT', '/api/profiles', { profiles: p.profiles, activeId: p.activeId, updatedAt: localU(PROFILES_KEY) }).catch(() => {});
}
function pushSaveId(id, data, u) {
  if (!syncOn() || !id) return Promise.resolve();
  return api('PUT', '/api/save?id=' + encodeURIComponent(id), { data, updatedAt: u || Date.now() }).catch(() => {});
}

// 시작 시 1회: 서버가 더 최신이면 받아오고, 서버가 비어 있으면 올린다.
export async function pullAll() {
  if (!syncOn()) return;
  try {
    const sp = await api('GET', '/api/profiles');
    if (sp && sp.profiles && sp.profiles.length && (sp.updatedAt || 0) > localU(PROFILES_KEY)) {
      localStorage.setItem(PROFILES_KEY, JSON.stringify({ profiles: sp.profiles, activeId: sp.activeId }));
      setLocalU(PROFILES_KEY, sp.updatedAt);
    } else if (sp && (!sp.profiles || !sp.profiles.length) && readProfiles().profiles.length) {
      await pushProfiles();
    }
  } catch {}
  const ids = readProfiles().profiles.map((p) => p.id);
  for (const id of ids) {
    const key = SAVE_PREFIX + id;
    try {
      const ss = await api('GET', '/api/save?id=' + encodeURIComponent(id));
      if (ss && ss.data && (ss.updatedAt || 0) > localU(key)) {
        localStorage.setItem(key, JSON.stringify(ss.data));
        setLocalU(key, ss.updatedAt);
      } else if (ss && !ss.data) {
        const local = localStorage.getItem(key);
        if (local) await pushSaveId(id, JSON.parse(local), localU(key));
      }
    } catch {}
  }
}

export function testSync() { return api('GET', '/api/health'); }
export function aiReport(name, analysis) { return api('POST', '/api/report', { name, analysis }); }
export function aiExplain(payload) { return api('POST', '/api/explain', payload); }

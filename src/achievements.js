// 업적(배지) 시스템. 게임 상태 + 그 순간의 이벤트(ctx)를 보고 달성 여부를 판정한다.
// 달성하면 state.achievements[id] = 달성시각(ms) 으로 기록한다.
const REAL = ['math', 'english', 'hanja', 'science'];

export function caughtTotal(s) { return Object.values(s.dexCaught || {}).reduce((a, c) => a + c, 0); }
export function dexSeenCount(s) { return Object.keys(s.dexSeen || {}).length; }
export function stickerTotal(s) { return Object.values(s.stickers || {}).reduce((a, c) => a + c, 0); }

// check(state, ctx) — ctx는 그 순간의 이벤트 플래그. 누적형은 state만 보면 된다.
export const ACHIEVEMENTS = [
  { id: 'first_correct', icon: '⭐', title: '첫 정답!', desc: '문제를 처음 맞혔어요', check: (s) => (s.totalCorrect || 0) >= 1 },
  { id: 'correct_50', icon: '📚', title: '문제 박사', desc: '정답 50개 달성', check: (s) => (s.totalCorrect || 0) >= 50 },
  { id: 'correct_200', icon: '🎓', title: '공부 마스터', desc: '정답 200개 달성', check: (s) => (s.totalCorrect || 0) >= 200 },
  { id: 'correct_500', icon: '👑', title: '천재 등장', desc: '정답 500개 달성', check: (s) => (s.totalCorrect || 0) >= 500 },
  { id: 'first_catch', icon: '🎯', title: '첫 포획!', desc: '포켓몬을 처음 잡았어요', check: (s) => caughtTotal(s) >= 1 },
  { id: 'catch_10', icon: '🎒', title: '친구 10마리', desc: '10마리 잡기', check: (s) => caughtTotal(s) >= 10 },
  { id: 'catch_30', icon: '🏕️', title: '친구 30마리', desc: '30마리 잡기', check: (s) => caughtTotal(s) >= 30 },
  { id: 'dex_15', icon: '📕', title: '도감 15종', desc: '15종 발견', check: (s) => dexSeenCount(s) >= 15 },
  { id: 'dex_40', icon: '📗', title: '도감 40종', desc: '40종 발견', check: (s) => dexSeenCount(s) >= 40 },
  { id: 'first_evolve', icon: '✨', title: '첫 진화!', desc: '포켓몬을 진화시켰어요', check: (s, c) => !!c.evolved },
  { id: 'mega_first', icon: '🔥', title: '메가진화!', desc: '메가진화에 성공했어요', check: (s, c) => !!c.mega },
  { id: 'tera_first', icon: '💎', title: '테라스탈!', desc: '테라스탈에 성공했어요', check: (s, c) => !!c.tera },
  { id: 'exam_pass', icon: '📝', title: '시험 합격!', desc: '종합 시험을 통과했어요', check: (s, c) => !!c.examPassed },
  { id: 'perfect_exam', icon: '💯', title: '만점왕!', desc: '시험에서 모두 맞혔어요', check: (s, c) => !!c.perfectExam },
  { id: 'first_graduate', icon: '🏆', title: '첫 졸업!', desc: '전설을 잡고 졸업했어요', check: (s) => Object.keys(s.graduated || {}).length >= 1 },
  { id: 'all_graduate', icon: '🌈', title: '올 졸업!', desc: '모든 지방을 졸업했어요', check: (s) => REAL.every((k) => s.graduated && s.graduated[k]) },
  { id: 'streak_3', icon: '🔥', title: '3일 연속!', desc: '3일 연속으로 공부했어요', check: (s) => (s.streak || 0) >= 3 },
  { id: 'streak_7', icon: '🗓️', title: '일주일 개근!', desc: '7일 연속으로 공부했어요', check: (s) => (s.streak || 0) >= 7 },
  { id: 'minigame_win', icon: '🕹️', title: '미니게임 승리!', desc: '미니게임에서 이겼어요', check: (s, c) => !!c.minigameWin },
  { id: 'sticker_10', icon: '🎉', title: '스티커 수집가', desc: '스티커 10장 모으기', check: (s) => stickerTotal(s) >= 10 },
];

// 아직 못 받은 업적 중 지금 조건을 만족하는 것을 모두 해금하고, 새로 해금된 목록을 돌려준다.
export function checkAchievements(state, ctx = {}) {
  if (!state.achievements) state.achievements = {};
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    let ok = false;
    try { ok = !!a.check(state, ctx); } catch { ok = false; }
    if (ok) { state.achievements[a.id] = Date.now(); newly.push(a); }
  }
  return newly;
}

export function achievementProgress(state) {
  const done = ACHIEVEMENTS.filter((a) => state.achievements && state.achievements[a.id]).length;
  return { done, total: ACHIEVEMENTS.length };
}

// 적응형 난이도 엔진.
// 미취학(한 자리 덧셈)부터 시작해, 한 단계에서 정답을 충분히 많이 맞히면 다음 단계로 진급한다.
// (예전: 정답률 기반으로 너무 빨리 진급 → 지금: 정답 개수 기반으로 천천히, 틀리면 진도 정지)

export const SKILLS = [
  { id: 'add1', label: '한 자리 덧셈', op: '+', gen: (r) => pair(r, 1, 5, 1, 5) },
  { id: 'add2', label: '덧셈 (합 10까지)', op: '+', gen: (r) => sumCap(r, 1, 9, 10) },
  { id: 'add3', label: '덧셈 (합 20까지)', op: '+', gen: (r) => sumCap(r, 1, 9, 18) },
  { id: 'sub1', label: '한 자리 뺄셈', op: '-', gen: (r) => sub(r, 2, 9) },
  { id: 'sub2', label: '뺄셈 (20까지)', op: '-', gen: (r) => sub(r, 5, 20) },
  { id: 'addc', label: '두 자리 덧셈', op: '+', gen: (r) => pair(r, 10, 40, 5, 40) },
  { id: 'subb', label: '두 자리 뺄셈', op: '-', gen: (r) => sub(r, 20, 60) },
  { id: 'mul1', label: '곱셈 (2~5단)', op: '×', gen: (r) => mul(r, 2, 5, 1, 9) },
  { id: 'mul2', label: '곱셈 (구구단)', op: '×', gen: (r) => mul(r, 2, 9, 1, 9) },
  { id: 'div1', label: '나눗셈', op: '÷', gen: (r) => div(r, 2, 9, 1, 9) },
];

export const MATH_LEVELS = SKILLS.length;

// 한 단계를 통과(진급)하는 데 필요한 "정답" 개수. (예전보다 약 3배 — 천천히 충분히 연습)
export const NEED_PER_LEVEL = 18;

const WINDOW = 12; // 최근 결과 추적(부모 보기용 정답률)

export class MathEngine {
  constructor(state, rng = Math.random) {
    this.rng = rng;
    // state: { current: idx, skills: { id: {attempts, correct, recent:[], totalTime, levelCorrect, mastered} } }
    this.state = state || { current: 0, skills: {} };
    for (const s of SKILLS) {
      if (!this.state.skills[s.id]) this.state.skills[s.id] = { attempts: 0, correct: 0, recent: [], totalTime: 0, levelCorrect: 0, mastered: false };
      if (this.state.skills[s.id].levelCorrect == null) this.state.skills[s.id].levelCorrect = 0;
    }
    if (this.state.current == null) this.state.current = 0;
    this._repeat = null; // 직전에 틀린 문제(다시 출제용)
  }

  currentSkill() { return SKILLS[this.state.current]; }
  skillsCount() { return SKILLS.length; }

  // 다음 문제: 직전에 틀렸으면 같은 문제 재출제(진도 정지), 아니면 80% 현재 / 20% 복습
  nextQuestion() {
    if (this._repeat) {
      const q = this._repeat; this._repeat = null;
      return { ...q, choices: shuffle([...q.choices], this.rng) };
    }
    let idx = this.state.current;
    if (this.state.current > 0 && this.rng() < 0.2) idx = Math.floor(this.rng() * this.state.current); // 복습
    return mathQuestion(idx, this.rng);
  }

  // 틀린 문제를 기억 → 다음에 같은 문제를 다시 낸다.
  markWrong(q) { if (q) this._repeat = q; }

  _choices(answer) { return buildChoices(answer, this.rng); }

  // 결과 기록 + 진급 판정. 반환: { promoted, fromLabel, toLabel }
  record(skillId, correct, timeMs) {
    const st = this.state.skills[skillId];
    st.attempts++;
    if (correct) st.correct++;
    st.totalTime += timeMs;
    st.recent.push(correct ? 1 : 0);
    if (st.recent.length > WINDOW) st.recent.shift();

    let promoted = null;
    const curId = this.currentSkill().id;
    // 현재 단계에서 "정답"일 때만 진도가 오른다. 틀리면 그대로(진도 정지).
    if (skillId === curId && correct && !st.mastered) {
      st.levelCorrect = (st.levelCorrect || 0) + 1;
      if (st.levelCorrect >= NEED_PER_LEVEL) {
        st.mastered = true;
        if (this.state.current < SKILLS.length - 1) {
          const from = this.currentSkill().label;
          this.state.current++;
          promoted = { fromLabel: from, toLabel: this.currentSkill().label };
        }
      }
    }
    return promoted;
  }

  graduationReady() {
    const last = SKILLS[SKILLS.length - 1];
    return this.state.current >= SKILLS.length - 1 && this.state.skills[last.id].mastered;
  }

  // 현재 단계 진행도 0~1 (정답 개수 기반)
  progress() {
    const st = this.state.skills[this.currentSkill().id];
    if (this.state.current >= SKILLS.length - 1 && st.mastered) return 1;
    return Math.min((st.levelCorrect || 0) / NEED_PER_LEVEL, 1);
  }

  report() {
    return SKILLS.map((s, i) => {
      const st = this.state.skills[s.id];
      const acc = st.attempts ? st.correct / st.attempts : 0;
      const avg = st.attempts ? st.totalTime / st.attempts / 1000 : 0;
      return {
        label: s.label,
        attempts: st.attempts,
        accuracy: acc,
        avgTime: avg,
        mastered: st.mastered || i < this.state.current,
        current: i === this.state.current,
        locked: i > this.state.current,
        levelCorrect: i === this.state.current ? (st.levelCorrect || 0) : (i < this.state.current ? NEED_PER_LEVEL : 0),
        need: NEED_PER_LEVEL,
      };
    });
  }
}

// ---- 문제 생성기 (랜덤 모드에서도 재사용) ---------------------------------
export function mathQuestion(idx, rng = Math.random) {
  const skill = SKILLS[Math.min(idx, SKILLS.length - 1)];
  const { a, b } = skill.gen(rng);
  const answer = compute(a, b, skill.op);
  return { skillId: skill.id, skillIdx: idx, text: `${a} ${skill.op} ${b} = ?`, answer, choices: buildChoices(answer, rng) };
}

function buildChoices(answer, rng) {
  const set = new Set([answer]);
  const offsets = [1, -1, 2, -2, 3, 10, -10, 4];
  let i = 0;
  while (set.size < 4 && i < 40) {
    const o = offsets[i % offsets.length] + (i >= offsets.length ? Math.floor(rng() * 5) - 2 : 0);
    const v = answer + o;
    if (v >= 0 && v !== answer) set.add(v);
    i++;
  }
  while (set.size < 4) set.add(answer + set.size);
  return shuffle([...set], rng);
}

function ri(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
function pair(r, alo, ahi, blo, bhi) { return { a: ri(r, alo, ahi), b: ri(r, blo, bhi) }; }
function sumCap(r, lo, hi, cap) {
  let a = ri(r, lo, hi), b = ri(r, lo, hi);
  if (a + b > cap) { a = ri(r, lo, Math.max(lo, cap - lo)); b = ri(r, lo, Math.max(lo, cap - a)); }
  return { a, b };
}
function sub(r, lo, hi) { const a = ri(r, lo, hi); const b = ri(r, 1, a); return { a, b }; }
function mul(r, alo, ahi, blo, bhi) { return { a: ri(r, alo, ahi), b: ri(r, blo, bhi) }; }
function div(r, alo, ahi, blo, bhi) { const b = ri(r, alo, ahi); const q = ri(r, blo, bhi); return { a: b * q, b }; }

function compute(a, b, op) {
  switch (op) { case '+': return a + b; case '-': return a - b; case '×': return a * b; case '÷': return a / b; }
}
function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

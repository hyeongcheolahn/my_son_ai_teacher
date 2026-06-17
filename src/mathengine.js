// 적응형 난이도 엔진.
// 미취학(한 자리 덧셈)부터 시작해 정답률이 충분히 높아지면 다음 단계로 자동 진급한다.

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

const WINDOW = 12;       // 최근 결과 추적 개수
const MIN_ATTEMPTS = 8;  // 진급 판정 최소 시도
const PROMOTE_ACC = 0.85;

export class MathEngine {
  constructor(state, rng = Math.random) {
    this.rng = rng;
    // state: { current: idx, skills: { id: {attempts, correct, recent:[], avgTime, mastered} } }
    this.state = state || { current: 0, skills: {} };
    for (const s of SKILLS) {
      if (!this.state.skills[s.id]) this.state.skills[s.id] = { attempts: 0, correct: 0, recent: [], totalTime: 0, mastered: false };
    }
    if (this.state.current == null) this.state.current = 0;
  }

  currentSkill() { return SKILLS[this.state.current]; }

  // 다음 문제: 80% 현재 스킬, 20% 이전 마스터한 스킬 복습
  nextQuestion() {
    let idx = this.state.current;
    if (this.state.current > 0 && this.rng() < 0.2) {
      idx = Math.floor(this.rng() * this.state.current); // 복습
    }
    const skill = SKILLS[idx];
    const { a, b } = skill.gen(this.rng);
    const answer = compute(a, b, skill.op);
    const choices = this._choices(answer);
    return { skillId: skill.id, skillIdx: idx, text: `${a} ${skill.op} ${b} = ?`, answer, choices };
  }

  _choices(answer) {
    const set = new Set([answer]);
    const offsets = [1, -1, 2, -2, 3, 10, -10, 4];
    let i = 0;
    while (set.size < 4 && i < 40) {
      const o = offsets[i % offsets.length] + (i >= offsets.length ? Math.floor(this.rng() * 5) - 2 : 0);
      const v = answer + o;
      if (v >= 0 && v !== answer) set.add(v);
      i++;
    }
    while (set.size < 4) set.add(answer + set.size); // 안전장치
    return shuffle([...set], this.rng);
  }

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
    if (skillId === curId) {
      const recent = st.recent;
      const acc = recent.reduce((a, c) => a + c, 0) / recent.length;
      if (recent.length >= MIN_ATTEMPTS && acc >= PROMOTE_ACC && !st.mastered) {
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

  skillsCount() { return SKILLS.length; }

  // 모든 스킬 마스터 → 졸업 시험(전설 보스) 준비 완료
  graduationReady() {
    const last = SKILLS[SKILLS.length - 1];
    return this.state.current >= SKILLS.length - 1 && this.state.skills[last.id].mastered;
  }

  // 현재 스킬 진급 진행도 0~1 (스테이지 바)
  progress() {
    const st = this.state.skills[this.currentSkill().id];
    if (this.state.current >= SKILLS.length - 1 && st.mastered) return 1;
    const acc = st.recent.length ? st.recent.reduce((a, c) => a + c, 0) / st.recent.length : 0;
    const countP = Math.min(st.recent.length / MIN_ATTEMPTS, 1);
    const accP = Math.min(acc / PROMOTE_ACC, 1);
    return Math.min(countP, accP);
  }

  // 부모 보기용 요약
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
      };
    });
  }
}

// ---- 문제 생성기 ----------------------------------------------------------
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

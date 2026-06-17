// 문제은행 기반 적응형 엔진(영어/한자/과학). MathEngine과 동일한 인터페이스.
const WINDOW = 12;
const MIN_ATTEMPTS = 8;
const PROMOTE_ACC = 0.85;

export class BankEngine {
  constructor(bank, state, rng = Math.random) {
    this.rng = rng;
    this.levels = (bank && bank.levels) || [];
    this.state = state || { current: 0, skills: {} };
    for (const l of this.levels) {
      if (!this.state.skills[l.id]) this.state.skills[l.id] = { attempts: 0, correct: 0, recent: [], totalTime: 0, mastered: false };
    }
    if (this.state.current == null) this.state.current = 0;
  }

  currentSkill() {
    const l = this.levels[Math.min(this.state.current, this.levels.length - 1)];
    return { id: l.id, label: l.label };
  }

  skillsCount() { return this.levels.length; }

  nextQuestion() {
    let idx = this.state.current;
    if (this.state.current > 0 && this.rng() < 0.2) idx = Math.floor(this.rng() * this.state.current); // 복습
    const lvl = this.levels[idx];
    const item = lvl.items[Math.floor(this.rng() * lvl.items.length)];
    const choices = shuffle([...item.choices], this.rng);
    return { skillId: lvl.id, skillIdx: idx, text: item.prompt, answer: item.answer, choices };
  }

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
      const acc = st.recent.reduce((a, c) => a + c, 0) / st.recent.length;
      if (st.recent.length >= MIN_ATTEMPTS && acc >= PROMOTE_ACC && !st.mastered) {
        st.mastered = true;
        if (this.state.current < this.levels.length - 1) {
          const from = this.currentSkill().label;
          this.state.current++;
          promoted = { fromLabel: from, toLabel: this.currentSkill().label };
        }
      }
    }
    return promoted;
  }

  progress() {
    const st = this.state.skills[this.currentSkill().id];
    if (this.state.current >= this.levels.length - 1 && st.mastered) return 1;
    const acc = st.recent.length ? st.recent.reduce((a, c) => a + c, 0) / st.recent.length : 0;
    return Math.min(Math.min(st.recent.length / MIN_ATTEMPTS, 1), Math.min(acc / PROMOTE_ACC, 1));
  }

  graduationReady() {
    const last = this.levels[this.levels.length - 1];
    return this.state.current >= this.levels.length - 1 && this.state.skills[last.id].mastered;
  }

  report() {
    return this.levels.map((l, i) => {
      const st = this.state.skills[l.id];
      const acc = st.attempts ? st.correct / st.attempts : 0;
      return {
        label: l.label,
        attempts: st.attempts,
        accuracy: acc,
        avgTime: st.attempts ? st.totalTime / st.attempts / 1000 : 0,
        mastered: st.mastered || i < this.state.current,
        current: i === this.state.current,
        locked: i > this.state.current,
      };
    });
  }
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// 문제은행 기반 적응형 엔진(영어/한자/과학). MathEngine과 동일한 인터페이스.
// 진급: 한 단계에서 "정답"을 NEED_PER_LEVEL 개 모으면 다음 단계. 틀리면 진도 정지 + 같은 문제 재출제.
import { NEED_PER_LEVEL } from './mathengine.js';

const WINDOW = 12;

export class BankEngine {
  constructor(bank, state, rng = Math.random) {
    this.rng = rng;
    this.levels = (bank && bank.levels) || [];
    this.state = state || { current: 0, skills: {} };
    for (const l of this.levels) {
      if (!this.state.skills[l.id]) this.state.skills[l.id] = { attempts: 0, correct: 0, recent: [], totalTime: 0, levelCorrect: 0, mastered: false };
      if (this.state.skills[l.id].levelCorrect == null) this.state.skills[l.id].levelCorrect = 0;
    }
    if (this.state.current == null) this.state.current = 0;
    this._repeat = null;
  }

  currentSkill() {
    const l = this.levels[Math.min(this.state.current, this.levels.length - 1)];
    return { id: l.id, label: l.label };
  }

  skillsCount() { return this.levels.length; }

  nextQuestion() {
    if (this._repeat) {
      const q = this._repeat; this._repeat = null;
      return { ...q, choices: q.choices ? shuffle([...q.choices], this.rng) : undefined };
    }
    let idx = this.state.current;
    if (this.state.current > 0 && this.rng() < 0.2) idx = Math.floor(this.rng() * this.state.current); // 복습
    const lvl = this.levels[idx];
    const item = lvl.items[Math.floor(this.rng() * lvl.items.length)];
    return {
      skillId: lvl.id, skillIdx: idx, text: item.prompt, answer: item.answer,
      choices: item.choices ? shuffle([...item.choices], this.rng) : undefined,
      kind: item.kind || null, glyph: item.glyph || null,
    };
  }

  markWrong(q) { if (q) this._repeat = q; }

  record(skillId, correct, timeMs) {
    const st = this.state.skills[skillId];
    st.attempts++;
    if (correct) st.correct++;
    st.totalTime += timeMs;
    st.recent.push(correct ? 1 : 0);
    if (st.recent.length > WINDOW) st.recent.shift();

    const curId = this.currentSkill().id;
    if (skillId === curId && correct && !st.mastered && !st.examPending) {
      st.levelCorrect = (st.levelCorrect || 0) + 1;
      if (st.levelCorrect >= NEED_PER_LEVEL) { st.examPending = true; return { exam: true }; }
    }
    return null;
  }

  // 종합 시험(따라쓰기 제외, 보기 있는 문제만)
  examWaiting() { const st = this.state.skills[this.currentSkill().id]; return !!st.examPending; }
  examPool(n = 5) {
    const out = []; const top = this.state.current; let guard = 0;
    while (out.length < n && guard++ < n * 12) {
      const idx = top > 0 && this.rng() < 0.35 ? Math.floor(this.rng() * (top + 1)) : top;
      const lvl = this.levels[idx];
      const item = lvl.items[Math.floor(this.rng() * lvl.items.length)];
      if (!item.choices || item.kind === 'trace') continue;
      out.push({ skillId: lvl.id, text: item.prompt, answer: item.answer, choices: shuffle([...item.choices], this.rng) });
    }
    return out;
  }
  passExam() {
    const st = this.state.skills[this.currentSkill().id];
    st.examPending = false; st.mastered = true;
    let promoted = null;
    if (this.state.current < this.levels.length - 1) {
      const from = this.currentSkill().label;
      this.state.current++;
      promoted = { fromLabel: from, toLabel: this.currentSkill().label };
    }
    return promoted;
  }
  failExam() {
    const st = this.state.skills[this.currentSkill().id];
    st.examPending = false; st.levelCorrect = Math.floor(NEED_PER_LEVEL * 0.6);
  }

  progress() {
    const st = this.state.skills[this.currentSkill().id];
    if (this.state.current >= this.levels.length - 1 && st.mastered) return 1;
    return Math.min((st.levelCorrect || 0) / NEED_PER_LEVEL, 1);
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
        levelCorrect: i === this.state.current ? (st.levelCorrect || 0) : (i < this.state.current ? NEED_PER_LEVEL : 0),
        need: NEED_PER_LEVEL,
      };
    });
  }
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

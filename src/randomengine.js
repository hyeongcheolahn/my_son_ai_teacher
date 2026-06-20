// 랜덤 모드 엔진: 수학·영어·한자·과학을 섞어서 낸다.
// 정답을 NEED_PER_LEVEL 개 모으면 전체 난이도(Lv)가 한 칸 오른다. 틀리면 같은 문제 재출제(진도 정지).
import { mathQuestion, MATH_LEVELS, NEED_PER_LEVEL } from './mathengine.js';
import { buildBank } from './creatures.js';

const BANK_SUBJECTS = ['english', 'hanja', 'science'];
const ALL_SUBJECTS = ['math', ...BANK_SUBJECTS];

export class RandomEngine {
  constructor(state, rng = Math.random) {
    this.rng = rng;
    this.state = state || { current: 0, levelCorrect: 0, attempts: 0, correct: 0 };
    if (this.state.current == null) this.state.current = 0;
    if (this.state.levelCorrect == null) this.state.levelCorrect = 0;
    if (this.state.attempts == null) this.state.attempts = 0;
    if (this.state.correct == null) this.state.correct = 0;
    this.banks = {};
    let maxLevels = MATH_LEVELS;
    for (const s of BANK_SUBJECTS) {
      const b = buildBank(s);
      this.banks[s] = b;
      if (b) maxLevels = Math.max(maxLevels, b.levels.length);
    }
    this.maxLevel = maxLevels - 1;
    this._repeat = null;
  }

  currentSkill() { return { id: 'rnd', label: `랜덤 Lv.${this.state.current + 1}` }; }
  skillsCount() { return this.maxLevel + 1; }

  nextQuestion() {
    if (this._repeat) {
      const q = this._repeat; this._repeat = null;
      return { ...q, choices: q.choices ? shuffle([...q.choices], this.rng) : undefined };
    }
    const sub = ALL_SUBJECTS[Math.floor(this.rng() * ALL_SUBJECTS.length)];
    if (sub === 'math') {
      const idx = Math.min(this.state.current, MATH_LEVELS - 1);
      const q = mathQuestion(idx, this.rng);
      q.skillId = 'rnd'; q.subjectTag = 'math';
      return q;
    }
    const bank = this.banks[sub];
    if (!bank || !bank.levels.length) return this._mathFallback();
    const idx = Math.min(this.state.current, bank.levels.length - 1);
    const lvl = bank.levels[idx];
    const item = lvl.items[Math.floor(this.rng() * lvl.items.length)];
    return {
      skillId: 'rnd', subjectTag: sub, text: item.prompt, answer: item.answer,
      choices: item.choices ? shuffle([...item.choices], this.rng) : undefined,
      kind: item.kind || null, glyph: item.glyph || null,
    };
  }

  _mathFallback() {
    const q = mathQuestion(Math.min(this.state.current, MATH_LEVELS - 1), this.rng);
    q.skillId = 'rnd'; q.subjectTag = 'math';
    return q;
  }

  markWrong(q) { if (q) this._repeat = q; }

  record(skillId, correct) {
    this.state.attempts++;
    if (correct) this.state.correct++;
    let promoted = null;
    if (correct) {
      this.state.levelCorrect++;
      if (this.state.levelCorrect >= NEED_PER_LEVEL) {
        if (this.state.current < this.maxLevel) {
          const from = this.currentSkill().label;
          this.state.current++;
          this.state.levelCorrect = 0;
          promoted = { fromLabel: from, toLabel: this.currentSkill().label };
        } else {
          this.state.levelCorrect = NEED_PER_LEVEL; // 최고 난이도에서 멈춤
        }
      }
    }
    return promoted;
  }

  progress() { return Math.min(this.state.levelCorrect / NEED_PER_LEVEL, 1); }
  graduationReady() { return false; } // 랜덤 모드는 끝없이 연습

  report() {
    const acc = this.state.attempts ? this.state.correct / this.state.attempts : 0;
    return [{
      label: `랜덤 모드 · Lv.${this.state.current + 1}`,
      attempts: this.state.attempts, accuracy: acc, avgTime: 0,
      mastered: false, current: true, locked: false,
      levelCorrect: this.state.levelCorrect, need: NEED_PER_LEVEL,
    }];
  }
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

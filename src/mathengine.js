// 적응형 난이도 엔진.
// 미취학(한 자리 덧셈)부터 시작해, 한 단계에서 정답을 충분히 많이 맞히면 다음 단계로 진급한다.
// (예전: 정답률 기반으로 너무 빨리 진급 → 지금: 정답 개수 기반으로 천천히, 틀리면 진도 정지)
import { SHAPES_STAGES } from './data/extra4.js';

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
  constructor(state, rng = Math.random, name = '친구') {
    this.rng = rng;
    this.name = name || '친구';
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

  // 다음 문제: 직전에 틀렸으면 같은 문제 재출제(진도 정지), 아니면 계산/응용/도형·시계 섞어서
  nextQuestion() {
    if (this._repeat) {
      const q = this._repeat; this._repeat = null;
      return { ...q, choices: shuffle([...q.choices], this.rng) };
    }
    let idx = this.state.current;
    if (this.state.current > 0 && this.rng() < 0.2) idx = Math.floor(this.rng() * this.state.current); // 복습
    const r = this.rng();
    if (r < 0.22) return this.shapesQuestion();              // 도형·시계
    if (r < 0.55) return storyQuestion(idx, this.rng, this.name); // 응용(이야기)
    return mathQuestion(idx, this.rng);                       // 계산
  }

  // 도형·시계 문제(현재 진도에 맞춰 난이도 선택). 진도는 현재 수학 단계로 기록된다.
  shapesQuestion() {
    const stage = Math.min(SHAPES_STAGES.length - 1, Math.floor(this.state.current / 2));
    const pool = SHAPES_STAGES[stage];
    const item = pool[Math.floor(this.rng() * pool.length)];
    return {
      skillId: this.currentSkill().id, skillIdx: this.state.current,
      text: item.prompt, answer: item.answer,
      choices: shuffle([...item.choices], this.rng),
      kind: item.kind || null, clock: item.clock || null,
    };
  }

  // 틀린 문제를 기억 → 다음에 같은 문제를 다시 낸다.
  markWrong(q) { if (q) this._repeat = q; }

  _choices(answer) { return buildChoices(answer, this.rng); }

  // 결과 기록. 한 단계 정답을 NEED_PER_LEVEL 개 모으면 종합 시험을 알린다({exam:true}).
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

  // 종합 시험: 현재 단계 + 이전 단계를 섞어 n문제
  examWaiting() { const st = this.state.skills[this.currentSkill().id]; return !!st.examPending; }
  examPool(n = 5) {
    const out = []; const top = this.state.current;
    for (let i = 0; i < n; i++) {
      const idx = top > 0 && this.rng() < 0.35 ? Math.floor(this.rng() * (top + 1)) : top;
      out.push(this.rng() < 0.4 ? storyQuestion(idx, this.rng, this.name) : mathQuestion(idx, this.rng));
    }
    return out;
  }
  passExam() {
    const st = this.state.skills[this.currentSkill().id];
    st.examPending = false; st.mastered = true;
    let promoted = null;
    if (this.state.current < SKILLS.length - 1) {
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

// ---- 응용(이야기) 문제 ----------------------------------------------------
// 아이 이름을 넣어 실생활 상황으로 만든다. 예) "도겸이가 사탕 3개를 가지고 있는데 4개를 더 받고 1개를 먹으면?"
const STORY_ITEMS = ['사탕', '사과', '딸기', '구슬', '쿠키', '스티커', '젤리', '초콜릿', '풍선', '블록', '곰젤리', '포켓몬 카드'];
const GET_VERBS = ['더 받았어요', '더 샀어요', '더 주웠어요', '선물로 더 받았어요'];
const LOSE_VERBS = ['먹었어요', '친구에게 줬어요', '동생에게 줬어요', '잃어버렸어요'];
const CONTAINERS = ['봉지', '접시', '상자', '바구니', '주머니'];

function hasJong(s) {
  if (!s) return false;
  const c = s.charCodeAt(s.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return false;
  return (c - 0xac00) % 28 !== 0;
}
// 이름 + 주격(친근형): 도겸이가 / 지호가
function nameSubject(name) { return name + (hasJong(name) ? '이가' : '가'); }
function pickOf(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

export function storyQuestion(idx, rng = Math.random, name = '친구') {
  const skill = SKILLS[Math.min(idx, SKILLS.length - 1)];
  const nm = nameSubject(name);
  const item = pickOf(rng, STORY_ITEMS);
  let text, answer;

  if (skill.op === '+') {
    const { a, b } = skill.gen(rng);
    if (idx >= 1 && rng() < 0.5) {
      const sum = a + b;
      const c = 1 + Math.floor(rng() * Math.max(1, Math.floor(sum / 2)));
      answer = Math.max(0, sum - c);
      text = `${nm} ${item} ${a}개를 가지고 있는데, ${b}개를 ${pickOf(rng, GET_VERBS)}. 그리고 ${c}개를 ${pickOf(rng, LOSE_VERBS)}. 모두 몇 개일까요?`;
    } else {
      answer = a + b;
      text = `${nm} ${item} ${a}개를 가지고 있어요. ${b}개를 ${pickOf(rng, GET_VERBS)}. 모두 몇 개일까요?`;
    }
  } else if (skill.op === '-') {
    const { a, b } = skill.gen(rng);
    if (idx >= 4 && rng() < 0.4 && a - b >= 2) {
      const c = 1 + Math.floor(rng() * Math.max(1, a - b));
      answer = Math.max(0, a - b - c);
      text = `${nm} ${item} ${a}개가 있어요. ${b}개를 ${pickOf(rng, LOSE_VERBS)}. 또 ${c}개를 ${pickOf(rng, LOSE_VERBS)}. 몇 개 남았을까요?`;
    } else {
      answer = a - b;
      text = `${nm} ${item} ${a}개가 있어요. ${b}개를 ${pickOf(rng, LOSE_VERBS)}. 몇 개 남았을까요?`;
    }
  } else if (skill.op === '×') {
    const { a, b } = skill.gen(rng);
    const cont = pickOf(rng, CONTAINERS);
    answer = a * b;
    text = `한 ${cont}에 ${item} ${a}개씩 들어 있어요. ${b}${cont}에는 모두 몇 개일까요?`;
  } else { // ÷
    const { a, b } = skill.gen(rng); // a = b * q
    answer = a / b;
    text = `${nm} ${item} ${a}개를 친구 ${b}명과 똑같이 나누면, 한 명이 몇 개씩 가질까요?`;
  }
  return { skillId: skill.id, skillIdx: idx, text, answer, choices: buildChoices(answer, rng) };
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

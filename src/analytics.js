// 학습 분석(오프라인). 세이브 상태에서 취약점·강점·속도·추세를 계산한다.
// NAS(LLM) 리포트에도 이 결과를 그대로 보낸다.
import { MathEngine } from './mathengine.js';
import { BankEngine } from './bankengine.js';
import { RandomEngine } from './randomengine.js';
import * as C from './creatures.js';

const SUBJECT_LABEL = { math: '수학', korean: '한글', english: '영어', hanja: '한자', science: '과학', random: '랜덤' };

function engineFor(subject, st) {
  try {
    if (subject === 'math') return new MathEngine(st);
    if (subject === 'random') return new RandomEngine(st);
    const bank = C.buildBank(subject);
    return bank ? new BankEngine(bank, st) : null;
  } catch { return null; }
}

export function buildAnalysis(state) {
  const subjects = state.subjects || {};
  const perSubject = [], weak = [], strong = [];
  for (const sub of Object.keys(subjects)) {
    const eng = engineFor(sub, subjects[sub]);
    if (!eng || !eng.report) continue;
    let att = 0, cor = 0;
    for (const r of eng.report()) {
      att += r.attempts; cor += Math.round(r.accuracy * r.attempts);
      if (r.attempts >= 5) {
        const item = { 과목: SUBJECT_LABEL[sub] || sub, 단원: r.label, 정답률: Math.round(r.accuracy * 100), 시도: r.attempts, 평균초: r.avgTime ? +r.avgTime.toFixed(1) : 0 };
        if (r.accuracy < 0.7) weak.push(item);
        else if (r.accuracy >= 0.9) strong.push(item);
      }
    }
    perSubject.push({ 과목: SUBJECT_LABEL[sub] || sub, 시도: att, 정답률: att ? Math.round((cor / att) * 100) : 0, 현재단원: eng.currentSkill ? eng.currentSkill().label : '' });
  }
  weak.sort((a, b) => a.정답률 - b.정답률);
  strong.sort((a, b) => b.정답률 - a.정답률);

  const log = state.log || [];
  const cl = log.filter((e) => e.correct), wl = log.filter((e) => !e.correct);
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, e) => a + (e.ms || 0), 0) / arr.length / 100) / 10 : 0);
  const acc = (arr) => (arr.length ? Math.round((arr.filter((e) => e.correct).length / arr.length) * 100) : 0);
  const recent = log.slice(-30), prev = log.slice(-60, -30);
  const days = new Set(log.map((e) => new Date(e.t).toISOString().slice(0, 10)));
  const tc = state.totalCorrect || 0, tw = state.totalWrong || 0;

  return {
    전체: { 정답: tc, 오답: tw, 정답률: tc + tw ? Math.round((tc / (tc + tw)) * 100) : 0, 총문제수: log.length || tc + tw },
    과목별: perSubject,
    취약단원: weak.slice(0, 5),
    잘하는단원: strong.slice(0, 5),
    속도: { 정답평균초: avg(cl), 오답평균초: avg(wl) },
    추세: { 최근30정답률: acc(recent), 직전30정답률: acc(prev) },
    학습한날수: days.size,
  };
}

// 오프라인용 사람이 읽는 리포트
export function buildReportText(a, name) {
  const nm = name || '아이';
  const L = [];
  L.push(`📊 ${nm} 학습 리포트`);
  L.push(`• 전체 정답률 ${a.전체.정답률}% (정답 ${a.전체.정답}/오답 ${a.전체.오답}) · 총 ${a.전체.총문제수}문제 · ${a.학습한날수}일 학습`);
  if (a.추세.직전30정답률) {
    const d = a.추세.최근30정답률 - a.추세.직전30정답률;
    L.push(`• 추세: 최근 ${a.추세.최근30정답률}% ${d >= 0 ? '▲' + d : '▼' + (-d)} (직전 ${a.추세.직전30정답률}%)`);
  }
  if (a.속도.정답평균초) L.push(`• 푸는 속도: 정답 평균 ${a.속도.정답평균초}초${a.속도.오답평균초 ? `, 오답 평균 ${a.속도.오답평균초}초` : ''}`);
  if (a.과목별.length) L.push('\n📚 과목별: ' + a.과목별.map((s) => `${s.과목} ${s.정답률}%`).join(' · '));
  if (a.잘하는단원.length) { L.push('\n💪 잘하는 것:'); a.잘하는단원.forEach((w) => L.push(`  ✓ ${w.과목} · ${w.단원} (${w.정답률}%)`)); }
  if (a.취약단원.length) { L.push('\n📌 더 연습하면 좋은 것:'); a.취약단원.forEach((w) => L.push(`  • ${w.과목} · ${w.단원} (${w.정답률}%)`)); }
  else L.push('\n📌 아직 취약한 단원이 뚜렷이 없어요. 잘하고 있어요!');
  if (a.전체.총문제수 < 20) L.push('\n(아직 데이터가 적어요. 조금 더 풀면 분석이 정확해져요.)');
  return L.join('\n');
}

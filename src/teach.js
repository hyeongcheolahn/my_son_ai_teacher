// 배움(설명) 엔진 — 문제 하나를 초등 저학년 눈높이로 "왜 그런지" 설명한다.
// 두 곳에서 함께 사용:
//   (1) 개념 미니레슨: 새 단계 첫 문제 전, 예시 문제를 풀이와 함께 보여줌
//   (2) 틀렸을 때 가르치기: 방금 틀린 문제를 그림+말로 설명한 뒤 다시 풀게 함
//
// 출력: { title, html, speak } 또는 null(설명 생략 — 예: 따라쓰기)
//   - html : 화면에 보일 그림/설명
//   - speak: 친숙한 목소리로 읽어 줄 깔끔한 문장

const COLORS = ['#3b9eff', '#ff6b35'];

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function dots(n, color) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<span class="td-dot" style="background:${color}"></span>`;
  return s;
}
function group(n, color) {
  return `<span class="td-group">${dots(n, color)}</span>`;
}
function takeAway(a, b) {
  let s = '<span class="td-group">';
  for (let i = 0; i < a; i++) {
    const gone = i >= a - b;
    s += `<span class="td-dot${gone ? ' td-gone' : ''}" style="background:${gone ? '#9aa6c4' : COLORS[0]}"></span>`;
  }
  return s + '</span>';
}

// 도형 이름 → 이모지 + 아이 눈높이 설명
const SHAPE_INFO = {
  '원': { emoji: '⭕', desc: '동그란 모양이에요. 동전이나 시계처럼 생겼죠!' },
  '삼각형': { emoji: '🔺', desc: '뾰족한 꼭짓점 3개, 곧은 변 3개로 이루어져요.' },
  '사각형': { emoji: '⬜', desc: '변 4개, 꼭짓점 4개인 모양이에요.' },
  '정사각형': { emoji: '⬜', desc: '네 변의 길이가 모두 똑같은 사각형이에요.' },
  '직사각형': { emoji: '▭', desc: '마주 보는 변끼리 길이가 같은 사각형이에요. 문이나 책처럼요!' },
  '오각형': { emoji: '⬠', desc: '변이 5개인 모양이에요.' },
  '육각형': { emoji: '⬡', desc: '변이 6개예요. 벌집이 이 모양이에요! 🐝' },
  '별': { emoji: '⭐', desc: '반짝반짝 별 모양이에요.' },
  '마름모': { emoji: '🔷', desc: '네 변이 모두 같고 비스듬히 기울어진 사각형이에요.' },
  '원기둥': { emoji: '🥫', desc: '위아래는 동그란 면, 옆은 둥글게 말린 기둥이에요. 음료수 캔처럼 생겼어요!' },
  '구': { emoji: '⚽', desc: '공처럼 어느 쪽에서 봐도 완전히 동그란 입체예요.' },
  '정육면체': { emoji: '🎲', desc: '주사위처럼 똑같은 정사각형 면 6개로 된 상자예요.' },
  '직육면체': { emoji: '📦', desc: '택배 상자처럼 직사각형 면으로 된 상자 모양이에요.' },
  '원뿔': { emoji: '🍦', desc: '아이스크림 콘이나 고깔모자처럼 끝이 뾰족한 모양이에요.' },
  '삼각뿔': { emoji: '🔺', desc: '바닥은 삼각형이고 위로 갈수록 한 점으로 뾰족해지는 모양이에요.' },
  '사각뿔': { emoji: '⛰️', desc: '바닥은 사각형이고 위로 뾰족해지는 모양이에요. 피라미드처럼요!' },
};

export function explainQuestion(q) {
  if (!q) return null;
  if (q.kind === 'trace') return null;          // 따라쓰기는 설명 생략
  if (q.meta && q.meta.kind === 'arith') return explainArith(q.meta);
  if (q.clock) return explainClock(q);
  const shape = SHAPE_INFO[String(q.answer).trim()];
  if (shape) return explainShape(q.answer, shape);
  // 어휘/상식 등: 정답을 또렷이 보여주고 기억하게 한다
  return {
    title: '💡 정답을 같이 봐요',
    html: `<div class="td-text">정답은 <b class="td-ans">${esc(q.answer)}</b> 예요!<br>한 번 더 소리 내어 읽고 기억해 볼까요? 😊</div>`,
    speak: `정답은 ${q.answer}예요. 한 번 더 따라 읽어 볼까요?`,
  };
}

function explainArith({ op, a, b, answer, item, unit }) {
  const u = unit || '개';
  const who = item ? esc(item) + ' ' : '';
  if (op === '+') {
    const visual = (a + b <= 24)
      ? `<div class="td-visual">${group(a, COLORS[0])}<span class="td-op">＋</span>${group(b, COLORS[1])}<span class="td-op">＝</span><b class="td-ans">${answer}</b></div>` : '';
    return {
      title: '💡 더하기는 "모으기"',
      html: `${visual}<div class="td-text">${who}<b>${a}</b>${u}에 <b>${b}</b>${u}를 더 모으면 <b class="td-ans">${answer}</b>${u}! 🎉<br>${a} ＋ ${b} ＝ ${answer}</div>`,
      speak: `${who}${a} 더하기 ${b}는 ${answer}예요. ${a}${u}에 ${b}${u}를 더 모으면 ${answer}${u}가 돼요!`,
    };
  }
  if (op === '-') {
    const visual = (a <= 24)
      ? `<div class="td-visual">${takeAway(a, b)}<span class="td-op">＝</span><b class="td-ans">${answer}</b></div>` : '';
    return {
      title: '💡 빼기는 "덜어내기"',
      html: `${visual}<div class="td-text">${who}<b>${a}</b>${u}에서 <b>${b}</b>${u}를 빼면(없애면) <b class="td-ans">${answer}</b>${u} 남아요.<br>${a} － ${b} ＝ ${answer}</div>`,
      speak: `${who}${a}${u}에서 ${b}${u}를 빼면 ${answer}${u}가 남아요!`,
    };
  }
  if (op === '×') {
    const repeat = Array(b).fill(a).join(' ＋ ');
    const visual = (a * b <= 36)
      ? `<div class="td-visual">${Array(b).fill(0).map(() => group(a, COLORS[0])).join('')}</div>` : '';
    return {
      title: '💡 곱하기는 "같은 수 여러 번 더하기"',
      html: `${visual}<div class="td-text"><b>${a} × ${b}</b>는 <b>${a}</b>을(를) <b>${b}</b>번 더하는 거예요:<br>${repeat} ＝ <b class="td-ans">${answer}</b></div>`,
      speak: `${a} 곱하기 ${b}는 ${answer}예요. ${a}을 ${b}번 더한 것과 같아요.`,
    };
  }
  if (op === '÷') {
    const visual = (a <= 36)
      ? `<div class="td-visual">${Array(b).fill(0).map(() => group(answer, COLORS[0])).join('')}</div>` : '';
    return {
      title: '💡 나누기는 "똑같이 나눠 담기"',
      html: `${visual}<div class="td-text"><b>${a}</b>개를 <b>${b}</b>묶음으로 똑같이 나누면,<br>한 묶음에 <b class="td-ans">${answer}</b>개씩! ${a} ÷ ${b} ＝ ${answer}</div>`,
      speak: `${a} 나누기 ${b}는 ${answer}예요. ${a}개를 ${b}묶음으로 똑같이 나누면 한 묶음에 ${answer}개씩이에요.`,
    };
  }
  return null;
}

function explainClock(q) {
  const { h, m } = q.clock;
  return {
    title: '💡 시계 읽는 법',
    html: `<div class="td-text">짧은 바늘은 <b>'시'</b>, 긴 바늘은 <b>'분'</b>이에요.<br>짧은 바늘이 <b>${h}</b> 가까이, 긴 바늘이 <b>${m}분</b>을 가리켜요.<br>그래서 정답은 <b class="td-ans">${esc(q.answer)}</b>! 🕐</div>`,
    speak: `짧은 바늘은 시, 긴 바늘은 분이에요. 그래서 정답은 ${q.answer}예요.`,
  };
}

function explainShape(answer, shape) {
  return {
    title: '💡 어떤 모양일까?',
    html: `<div class="td-shape">${shape.emoji}</div>
      <div class="td-text"><b class="td-ans">${esc(answer)}</b><br>${esc(shape.desc)}</div>`,
    speak: `정답은 ${answer}이에요. ${shape.desc}`,
  };
}

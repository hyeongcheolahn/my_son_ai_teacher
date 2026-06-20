// 배움(설명) 엔진 — 문제 하나를 초등 저학년 눈높이로 "왜 그런지" 설명한다.
// 두 곳에서 함께 사용:
//   (1) 개념 미니레슨: 새 단계 첫 문제 전, 예시 문제를 풀이와 함께 보여줌
//   (2) 틀렸을 때 가르치기: 방금 틀린 문제를 그림+말로 설명한 뒤 다시 풀게 함
//
// 입력: 문제 객체 q. (수학 문제는 q.meta={kind:'arith',op,a,b,answer}, 시계는 q.clock)
// 출력: { title, html } 또는 null(설명 생략 — 예: 따라쓰기)

const COLORS = ['#3b9eff', '#ff6b35'];

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function dots(n, color) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<span class="td-dot" style="background:${color}"></span>`;
  return s;
}
// 한 묶음(점들을 모아 테두리로 감싼다 → "묶음" 개념)
function group(n, color) {
  return `<span class="td-group">${dots(n, color)}</span>`;
}
// a개 중 뒤쪽 b개를 "덜어낸(회색 X)" 모습
function takeAway(a, b) {
  let s = '<span class="td-group">';
  for (let i = 0; i < a; i++) {
    const gone = i >= a - b;
    s += `<span class="td-dot${gone ? ' td-gone' : ''}" style="background:${gone ? '#9aa6c4' : COLORS[0]}"></span>`;
  }
  return s + '</span>';
}

export function explainQuestion(q) {
  if (!q) return null;
  if (q.kind === 'trace') return null;          // 따라쓰기는 설명 생략
  if (q.meta && q.meta.kind === 'arith') return explainArith(q.meta);
  if (q.clock) return explainClock(q);
  // 어휘/상식 등: 정답을 다시 또렷이 보여주고 기억하게 한다
  return {
    title: '💡 정답을 같이 봐요',
    html: `<div class="td-text">정답은 <b class="td-ans">${esc(q.answer)}</b> 예요!<br>한 번 더 소리 내어 읽고 기억해 볼까요? 😊</div>`,
  };
}

function explainArith({ op, a, b, answer }) {
  if (op === '+') {
    const visual = (a + b <= 24)
      ? `<div class="td-visual">${group(a, COLORS[0])}<span class="td-op">＋</span>${group(b, COLORS[1])}<span class="td-op">＝</span><b class="td-ans">${answer}</b></div>` : '';
    return {
      title: '💡 더하기는 "모으기"',
      html: `${visual}<div class="td-text"><b>${a}</b>개에 <b>${b}</b>개를 더 모으면 <b class="td-ans">${answer}</b>개! 🎉<br>${a} ＋ ${b} ＝ ${answer}</div>`,
    };
  }
  if (op === '-') {
    const visual = (a <= 24)
      ? `<div class="td-visual">${takeAway(a, b)}<span class="td-op">＝</span><b class="td-ans">${answer}</b></div>` : '';
    return {
      title: '💡 빼기는 "덜어내기"',
      html: `${visual}<div class="td-text"><b>${a}</b>개에서 <b>${b}</b>개를 빼면(없애면) <b class="td-ans">${answer}</b>개 남아요.<br>${a} － ${b} ＝ ${answer}</div>`,
    };
  }
  if (op === '×') {
    const repeat = Array(b).fill(a).join(' ＋ ');
    const visual = (a * b <= 36)
      ? `<div class="td-visual">${Array(b).fill(0).map(() => group(a, COLORS[0])).join('')}</div>` : '';
    return {
      title: '💡 곱하기는 "같은 수 여러 번 더하기"',
      html: `${visual}<div class="td-text"><b>${a} × ${b}</b>는 <b>${a}</b>을(를) <b>${b}</b>번 더하는 거예요:<br>${repeat} ＝ <b class="td-ans">${answer}</b></div>`,
    };
  }
  if (op === '÷') {
    const visual = (a <= 36)
      ? `<div class="td-visual">${Array(b).fill(0).map(() => group(answer, COLORS[0])).join('')}</div>` : '';
    return {
      title: '💡 나누기는 "똑같이 나눠 담기"',
      html: `${visual}<div class="td-text"><b>${a}</b>개를 <b>${b}</b>묶음으로 똑같이 나누면,<br>한 묶음에 <b class="td-ans">${answer}</b>개씩! ${a} ÷ ${b} ＝ ${answer}</div>`,
    };
  }
  return null;
}

function explainClock(q) {
  const { h, m } = q.clock;
  return {
    title: '💡 시계 읽는 법',
    html: `<div class="td-text">짧은 바늘은 <b>'시'</b>, 긴 바늘은 <b>'분'</b>이에요.<br>짧은 바늘이 <b>${h}</b> 가까이, 긴 바늘이 <b>${m}분</b>을 가리켜요.<br>그래서 정답은 <b class="td-ans">${esc(q.answer)}</b>! 🕐</div>`,
  };
}

// 배틀 사이사이에 나오는 짧은 미니게임 모음. 보상으로 경험치(+가끔 스티커)를 준다.
// playRandomMiniGame(host, opts) → Promise<{ win, score, xp, title }>
//   host: 게임을 그릴 컨테이너 element
//   opts: { sfx, rng }
const GAMES = ['numorder', 'memory', 'quickmath'];

export function playRandomMiniGame(host, opts = {}) {
  const sfx = opts.sfx || {};
  const rng = opts.rng || Math.random;
  const which = GAMES[Math.floor(rng() * GAMES.length)];
  return new Promise((resolve) => {
    const finish = (res) => showResult(host, sfx, res, () => resolve(res));
    if (which === 'numorder') numOrder(host, sfx, rng, finish);
    else if (which === 'memory') memory(host, sfx, rng, finish);
    else quickMath(host, sfx, rng, finish);
  });
}

function tap(sfx) { try { sfx.tap && sfx.tap(); } catch {} }
function good(sfx) { try { sfx.correct && sfx.correct(); } catch {} }
function bad(sfx) { try { sfx.wrong && sfx.wrong(); } catch {} }
function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// 결과 화면(이긴/진 것 + 보상) → '계속하기'로 닫는다.
function showResult(host, sfx, res, done) {
  try { (res.win ? sfx.levelup : sfx.tap) && (res.win ? sfx.levelup() : sfx.tap()); } catch {}
  host.innerHTML = `
    <div class="mg-result ${res.win ? 'win' : 'lose'}">
      <div class="mg-big">${res.win ? '🎉 성공!' : '🙂 좋은 도전!'}</div>
      <div class="mg-reward">⭐ 경험치 +${res.xp}</div>
      <button class="big-action mg-continue">계속하기 ▶</button>
    </div>`;
  host.querySelector('.mg-continue').onclick = () => { tap(sfx); done(); };
}

// ── 1) 숫자 순서대로 터치 ──────────────────────────────────────────────
function numOrder(host, sfx, rng, finish) {
  const N = 6;
  const nums = shuffle(Array.from({ length: N }, (_, i) => i + 1), rng);
  let expected = 1, mistakes = 0;
  host.innerHTML = `
    <div class="mg-title">🔢 숫자 순서대로 콕콕!</div>
    <div class="mg-sub">1부터 ${N}까지 작은 수부터 차례로 눌러요</div>
    <div class="mg-grid num">${nums.map((n) => `<button class="mg-cell" data-n="${n}">${n}</button>`).join('')}</div>`;
  host.querySelectorAll('.mg-cell').forEach((btn) => {
    btn.onclick = () => {
      if (btn.disabled) return;
      const n = +btn.dataset.n;
      if (n === expected) {
        good(sfx); btn.classList.add('done'); btn.disabled = true; expected++;
        if (expected > N) setTimeout(() => finish({ win: mistakes === 0, score: N - mistakes, xp: mistakes === 0 ? 6 : 3, title: '숫자 순서' }), 350);
      } else {
        bad(sfx); mistakes++; btn.classList.add('miss');
        setTimeout(() => btn.classList.remove('miss'), 300);
      }
    };
  });
}

// ── 2) 같은 그림 찾기(메모리 카드) ─────────────────────────────────────
function memory(host, sfx, rng, finish) {
  const faces = ['🍎', '⚡', '🌈', '🐢'];
  const deck = shuffle([...faces, ...faces], rng);
  let open = [], matched = 0, tries = 0, busy = false;
  host.innerHTML = `
    <div class="mg-title">🃏 같은 그림 찾기</div>
    <div class="mg-sub">카드를 뒤집어 같은 그림 둘을 맞춰요</div>
    <div class="mg-grid mem">${deck.map((f, i) => `<button class="mg-card" data-i="${i}" data-f="${f}"><span class="mg-front">?</span></button>`).join('')}</div>`;
  const cards = [...host.querySelectorAll('.mg-card')];
  cards.forEach((card) => {
    card.onclick = () => {
      if (busy || card.classList.contains('flip') || card.classList.contains('got')) return;
      tap(sfx);
      card.querySelector('.mg-front').textContent = card.dataset.f;
      card.classList.add('flip');
      open.push(card);
      if (open.length === 2) {
        tries++; busy = true;
        const [a, b] = open;
        if (a.dataset.f === b.dataset.f) {
          good(sfx);
          setTimeout(() => { a.classList.add('got'); b.classList.add('got'); open = []; busy = false; matched++; if (matched === faces.length) finish({ win: true, score: faces.length, xp: tries <= faces.length + 1 ? 6 : 4, title: '같은 그림 찾기' }); }, 350);
        } else {
          setTimeout(() => { a.classList.remove('flip'); b.classList.remove('flip'); a.querySelector('.mg-front').textContent = '?'; b.querySelector('.mg-front').textContent = '?'; open = []; busy = false; }, 750);
        }
      }
    };
  });
}

// ── 3) 빠른 계산 ───────────────────────────────────────────────────────
function quickMath(host, sfx, rng, finish) {
  const TOTAL = 5;
  let pos = 0, score = 0;
  const ri = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const makeQ = () => {
    const plus = rng() < 0.6;
    let a = ri(2, 9), b = ri(1, 9);
    if (!plus && b > a) [a, b] = [b, a];
    const ans = plus ? a + b : a - b;
    const set = new Set([ans]);
    while (set.size < 4) { const v = ans + ri(-3, 3); if (v >= 0) set.add(v); }
    return { text: `${a} ${plus ? '+' : '-'} ${b} = ?`, ans, choices: shuffle([...set], rng) };
  };
  const render = () => {
    if (pos >= TOTAL) { finish({ win: score >= 3, score, xp: Math.max(2, score), title: '빠른 계산' }); return; }
    const q = makeQ();
    host.innerHTML = `
      <div class="mg-title">⚡ 빠른 계산 ${pos + 1}/${TOTAL}</div>
      <div class="mg-sub">맞은 개수 ${score}</div>
      <div class="mg-q">${q.text}</div>
      <div class="mg-grid quick">${q.choices.map((c) => `<button class="mg-cell" data-c="${c}">${c}</button>`).join('')}</div>`;
    host.querySelectorAll('.mg-cell').forEach((btn) => {
      btn.onclick = () => {
        const cells = [...host.querySelectorAll('.mg-cell')];
        cells.forEach((c) => (c.disabled = true));
        const correct = +btn.dataset.c === q.ans;
        if (correct) { good(sfx); btn.classList.add('done'); score++; }
        else { bad(sfx); btn.classList.add('miss'); cells.find((c) => +c.dataset.c === q.ans)?.classList.add('done'); }
        setTimeout(() => { pos++; render(); }, correct ? 450 : 800);
      };
    });
  };
  render();
}

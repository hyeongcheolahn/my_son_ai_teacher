import { BattleScene } from './scene.js';
import { MathEngine } from './mathengine.js';
import { BankEngine } from './bankengine.js';
import * as C from './creatures.js';
import * as storage from './storage.js';
import { pickBall } from './data/balls.js';
import { pickMove } from './data/moves.js';
import { artUrl } from './data/dex.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

export class Game {
  constructor() {
    this.state = storage.load();
    this._ensureLevels();       // 기존 세이브 보유 포켓몬에 lv/xp 기본값 부여
    this.scene = new BattleScene($('scene'));
    this.locked = true;
    this.q = null;
    this.qStart = 0;
    this.allyHP = 100;
    this.enemy = null;          // { def, energy, maxEnergy, isLegendary, lv }
    this.engine = null;
    this.pendingEvolutions = 0;
    this.bindUI();
  }

  _ensureLevels() {
    for (const o of this.state.owned) {
      if (o.lv == null) o.lv = 1;
      if (o.xp == null) o.xp = 0;
    }
  }

  bindUI() {
    $('start-btn').onclick = () => { sfx.unlock(); this.openSubjectSelect(); };
    $('catch-btn').onclick = () => this.throwBall();
    $('transform-btn').onclick = () => this.doTransform();
    $('dex-btn').onclick = () => this.openDex();
    $('parent-btn').onclick = () => this.openParent();
    $('party-btn').onclick = () => this.openParty();
    $('region-btn').onclick = () => this.openSubjectSelect();
    $('reset-btn').onclick = () => {
      if (confirm('정말 진행도를 모두 초기화할까요?')) { storage.reset(); location.reload(); }
    };
    document.querySelectorAll('[data-close]').forEach((b) => {
      b.onclick = () => $(b.dataset.close).classList.add('hidden');
    });
    // 모달 바깥(어두운 영역) 탭으로 닫기 — 닫기 버튼이 있는 모달만
    document.querySelectorAll('.modal').forEach((m) => {
      m.addEventListener('click', (e) => {
        if (e.target === m && m.querySelector('[data-close]')) m.classList.add('hidden');
      });
    });
  }

  // ---- 과목/지방 선택 ----------------------------------------------------
  openSubjectSelect() {
    $('start-screen').classList.add('hidden');
    const grid = $('subject-grid');
    grid.innerHTML = '';
    for (const s of C.SUBJECTS) {
      const grad = this.state.graduated[s.key];
      const cell = document.createElement('button');
      cell.className = 'subject-cell';
      cell.innerHTML = `<div class="s-emoji">${s.emoji}</div>
        <div class="s-label">${s.label}</div>
        <div class="s-region">${s.region}지방${grad ? ' 👑' : ''}</div>`;
      cell.onclick = () => { sfx.tap(); this.enterSubject(s.key); };
      grid.appendChild(cell);
    }
    $('subject-modal').classList.remove('hidden');
  }

  enterSubject(subject) {
    this.state.currentSubject = subject;
    if (!this.state.subjects[subject]) this.state.subjects[subject] = { current: 0, skills: {} };
    this.engine = subject === 'math'
      ? new MathEngine(this.state.subjects[subject])
      : new BankEngine(C.getRegion(subject).questionBank, this.state.subjects[subject]);

    this.ensureStarter(subject);
    // 이 지방 출전 포켓몬 지정
    const mine = this.state.owned.filter((o) => o.subject === subject);
    if (mine.length && !mine.some((o) => o.uid === this.state.activeUid)) this.state.activeUid = mine[0].uid;

    this.hideAllModals();
    this.setActiveAlly();
    this.refreshTop();
    storage.save(this.state);
    this.spawnWild();
  }

  ensureStarter(subject) {
    if (!this.state.owned.some((o) => o.subject === subject)) {
      const st = C.starterDef(subject);
      this.addOwned(subject, st.id, true);
    }
  }

  // ---- 보유/파티 ---------------------------------------------------------
  addOwned(subject, speciesId, makeActive) {
    const uid = this.state.uidSeq++;
    this.state.owned.push({ uid, subject, speciesId, lv: 1, xp: 0 });
    this.state.dexSeen[speciesId] = true;
    this.state.dexCaught[speciesId] = (this.state.dexCaught[speciesId] || 0) + 1;
    if (makeActive || !this.state.activeUid) this.state.activeUid = uid;
    return uid;
  }

  activeOwned() { return this.state.owned.find((o) => o.uid === this.state.activeUid); }

  activeDef() {
    const o = this.activeOwned();
    if (!o) return null;
    return this.displayDef(o);
  }

  // 화면에 보일 def: 기본형 또는 초진화 폼(메가/거다이맥스)의 아트·이름·크기 반영(타입·id는 유지)
  displayDef(o) {
    const base = C.getCreatureDef(o.subject, o.speciesId) || C.findDefAnywhere(o.speciesId);
    if (!base) return base;
    let d = base;
    if (o.form) {
      const f = C.superForm(o.speciesId, o.form);
      if (f) d = { ...base, name: f.name, formArt: f.art, scale: (base.scale || 1) * (o.form === 'gmax' ? 1.3 : 1.12) }; // 화면 밖 방지로 축소(높이 상한과 함께)
    }
    if (o.tera) d = { ...d, tera: true, teraType: base.type, name: `${d.name} 💎` }; // 테라스탈: 아트 유지 + 결정 효과
    return d;
  }

  // ---- 변신(진화 권한) ---------------------------------------------------
  // 자동 진화 대신, 레벨 도달 시 변신 가능 → 버튼으로 플레이어가 결정.
  transformFor(o) {
    if (!o) return null;
    const base = C.getCreatureDef(o.subject, o.speciesId);
    if (!base) return null;
    if (base.evolvesToId) {                                  // 단계 진화
      const need = base.stage === 1 ? 5 : 12;
      if (o.lv >= need) { const n = C.evolveDef(o.subject, o.speciesId); return n ? { kind: 'evolve', label: `${n.name} 진화`, icon: '✨' } : null; }
      return null;
    }
    // 최종진화: 메가 → 거다이맥스 → 테라스탈 (종 경로에 맞게, 테라는 누구나 도달)
    const hasMega = !!C.superForm(o.speciesId, 'mega');
    const hasGmax = !!C.superForm(o.speciesId, 'gmax');
    if (!o.form) {
      if (hasMega && o.lv >= 18) return { kind: 'mega', label: '메가진화', icon: '🔥' };
      if (!hasMega && !o.tera && o.lv >= 20) return { kind: 'tera', label: '테라스탈', icon: '💎' };
    } else if (o.form === 'mega') {
      if (hasGmax && o.lv >= 30) return { kind: 'gmax', label: '거다이맥스', icon: '🌋' };
      if (!hasGmax && !o.tera && o.lv >= 30) return { kind: 'tera', label: '테라스탈', icon: '💎' };
    } else if (o.form === 'gmax') {
      if (!o.tera && o.lv >= 40) return { kind: 'tera', label: '테라스탈', icon: '💎' };
    }
    return null;
  }

  refreshTransformBtn() {
    const btn = $('transform-btn');
    if (!btn) return;
    const t = this.transformFor(this.activeOwned());
    if (t && !this.locked) { btn.textContent = `${t.icon} ${t.label}!`; btn.classList.remove('hidden'); }
    else btn.classList.add('hidden');
  }

  doTransform() {
    const o = this.activeOwned();
    const t = this.transformFor(o);
    if (!o || !t) return;
    $('transform-btn').classList.add('hidden');
    sfx.levelup();
    if (t.kind === 'evolve') {
      const next = C.evolveDef(o.subject, o.speciesId);
      o.speciesId = next.id; this.state.dexSeen[next.id] = true;
      this.showMessage(`✨ ${next.name}(으)로 진화!`, '#ffd23f', 1900);
    } else if (t.kind === 'tera') {
      o.tera = true;
      this.showMessage(`💎 테라스탈! ${C.getCreatureDef(o.subject, o.speciesId).name}`, '#7fe3ff', 2100);
      this.scene.screenShake(0.5, 0.55);
    } else {
      o.form = t.kind;
      this.showMessage(`${t.icon} ${C.superForm(o.speciesId, t.kind).name}!`, '#ffd23f', 2100);
      this.scene.screenShake(0.4, 0.5);
    }
    const disp = this.displayDef(o);
    this.scene.evolveAlly(disp);
    $('ally-name').textContent = `${disp.name} Lv.${o.lv}`;
    storage.save(this.state);
    setTimeout(() => this.refreshTransformBtn(), 1700);
  }

  setActiveAlly() {
    const def = this.activeDef();
    const o = this.activeOwned();
    if (def) { this.scene.spawnAlly(def); $('ally-name').textContent = `${def.name} Lv.${o ? o.lv : 1}`; }
    this.allyHP = 100;
    this.setAllyHP();
    this.setAllyXp();
    this.refreshTransformBtn();
  }

  allyLv() { const o = this.activeOwned(); return o ? o.lv : 1; }

  // ---- 레벨 / 경험치 -----------------------------------------------------
  xpNeeded(lv) { return 3 + lv; } // lv1→2: 4문제, lv2→3: 5문제 …

  gainXp(amount) {
    const o = this.activeOwned();
    if (!o) return;
    o.xp = (o.xp || 0) + amount;
    let leveled = false;
    while (o.xp >= this.xpNeeded(o.lv)) { o.xp -= this.xpNeeded(o.lv); o.lv++; leveled = true; }
    if (leveled) this.onLevelUp(o);
    else if (o.uid === this.state.activeUid) this.refreshAllyName(o);
    if (o.uid === this.state.activeUid) this.setAllyXp();
    storage.save(this.state);
  }

  refreshAllyName(o) {
    const def = this.displayDef(o);
    if (def) $('ally-name').textContent = `${def.name} Lv.${o.lv}`;
  }

  onLevelUp(o) {
    sfx.levelup();
    const def = this.displayDef(o);
    this.showMessage(`⬆️ ${def.name} Lv.${o.lv}!`, '#ffd23f', 1300);
    if (o.uid === this.state.activeUid) {
      this.refreshAllyName(o);
      this.scene.screenShake(0.15, 0.25);
      const t = this.transformFor(o);
      if (t) this.showMessage(`${t.icon} ${t.label} 가능! 버튼을 눌러요`, '#ffd23f', 2200);
      this.refreshTransformBtn();
    }
  }

  // ---- 포획 확률 ---------------------------------------------------------
  // 약할수록(에너지↓) 잘 잡히고, 레벨 높거나 전설이면 확 떨어진다.
  catchChance(enemy) {
    const weak = 1 - enemy.energy / enemy.maxEnergy;        // 0(만땅)~1(기절)
    let chance = 0.35 + weak * 0.55;                         // 기절 시 0.9
    chance *= Math.max(0.4, 1 - (enemy.lv || 1) * 0.02);     // 고레벨 페널티
    if (enemy.isLegendary) chance *= 0.4;                    // 전설은 매우 낮음
    return Math.max(0.08, Math.min(0.95, chance));
  }

  evolvableOwned() {
    return this.state.owned.filter((o) => C.evolveDef(o.subject, o.speciesId));
  }

  // ---- 야생/보스 등장 ----------------------------------------------------
  spawnWild() {
    const subject = this.state.currentSubject;
    const graduation = this.engine.graduationReady && this.engine.graduationReady() && !this.state.graduated[subject];

    let def, isLegendary = false;
    if (graduation) {
      def = C.legendaryDef(subject);
      isLegendary = true;
    } else {
      def = C.pickWildDef(subject);
    }
    // 야생 레벨 = 현재 문제 난이도 단계에 비례 (전설은 훨씬 높음)
    const stage = this.engine.state.current || 0;
    const maxStage = Math.max(1, this.engine.skillsCount() - 1);
    const lv = isLegendary ? Math.round(maxStage * 1.5) + 8 : 3 + stage * 2 + Math.floor(Math.random() * 3);
    const maxEnergy = Math.round(def.catchEnergy * (1 + lv * 0.04)); // 고레벨일수록 튼튼
    this.enemy = { def, energy: maxEnergy, maxEnergy, isLegendary, lv };
    this.scene.spawnEnemy(def);
    $('enemy-name').textContent = `${def.name} Lv.${lv}`;
    const badge = $('enemy-type');
    badge.textContent = C.typeLabel(def.type);
    badge.style.background = C.typeColor(def.type);
    this.setEnemyEnergy();
    $('catch-btn').classList.add('hidden');
    this.state.dexSeen[def.id] = true;

    if (isLegendary) this.showMessage(`👑 졸업 시험! 전설의 ${def.name}!`, '#ffd23f', 1800);
    else this.showMessage(`앗! 야생 ${def.name} 등장!`, '#ffd23f', 1100);

    storage.save(this.state);
    setTimeout(() => this.nextQuestion(), isLegendary ? 1700 : 1000);
  }

  nextQuestion() {
    this.q = this.engine.nextQuestion();
    const isText = typeof this.q.answer !== 'number';
    const qEl = $('question');
    qEl.textContent = this.q.text;
    qEl.classList.toggle('small', String(this.q.text).length > 12);
    const box = $('choices');
    box.innerHTML = '';
    for (const c of this.q.choices) {
      const btn = document.createElement('button');
      btn.className = 'choice' + (isText ? ' text' : '');
      btn.textContent = c;
      btn.onclick = () => this.answer(c, btn);
      box.appendChild(btn);
    }
    this.qStart = performance.now();
    this.locked = false;
    this.refreshTransformBtn(); // 변신 가능하면 버튼 표시
  }

  answer(value, btn) {
    if (this.locked) return;
    this.locked = true;
    sfx.tap();
    const correct = String(value) === String(this.q.answer);
    const time = performance.now() - this.qStart;
    const buttons = [...document.querySelectorAll('.choice')];
    buttons.forEach((b) => (b.disabled = true));

    const promoted = this.engine.record(this.q.skillId, correct, time);

    if (correct) {
      btn.classList.add('correct');
      this.state.totalCorrect++;
      sfx.correct();
      this.doAttack(() => this.afterAnswer(promoted, true));
    } else {
      btn.classList.add('wrong');
      buttons.find((b) => String(b.textContent) === String(this.q.answer))?.classList.add('correct');
      this.state.totalWrong++;
      sfx.wrong();
      this.showMessage('아쉬워! 다시 도전!', '#ff7a9c', 900);
      this.enemyCounter(() => this.afterAnswer(promoted, false));
    }
    this.refreshTop();
    storage.save(this.state);
  }

  doAttack(done) {
    sfx.attack();
    const allyDef = this.activeDef();
    const allyType = (allyDef && allyDef.type) || 'normal'; // 공격은 공격자(내 포켓몬) 특성으로
    const eff = C.effectiveness(allyType, this.enemy.def.type);            // 타입 상성
    const lvFactor = Math.max(0.6, Math.min(1.7, 1 + (this.allyLv() - (this.enemy.lv || 1)) * 0.05)); // 레벨차
    const o = this.activeOwned();
    const formMult = (o && o.form ? (o.form === 'gmax' ? 1.7 : 1.4) : 1) * (o && o.tera ? 1.4 : 1); // 메가/거다이맥스/테라
    const dmg = (20 + Math.random() * 8) * eff * lvFactor * formMult;
    const willFaint = this.enemy.energy - dmg <= 0;
    const power = (eff >= 2 ? 1.5 : eff <= 0.5 ? 0.7 : 1) * (o && (o.form || o.tera) ? 1.3 : 1); // 상성·폼 → 연출 크기
    const move = pickMove(allyType); // 타입별 2~3 기술 중 랜덤
    this.showMessage(`${(allyDef && allyDef.name) || '내 포켓몬'}의 ${move.name}!`, '#fff', 1100);
    this.scene.attack('ally', allyType, () => {
      sfx.impact();
      this.enemy.energy = Math.max(0, this.enemy.energy - dmg);
      this.setEnemyEnergy();
      const lab = C.effectivenessLabel(eff);
      if (lab && this.enemy.energy > 0) this.showMessage(lab.text, lab.color, 1000);
      if (this.enemy.energy <= 0) {
        this.showMessage(this.enemy.isLegendary ? '지금이야! 포켓볼을 던져!' : '기절 직전! 포켓볼을 던져!', '#36d36e', 1200);
        setTimeout(() => $('catch-btn').classList.remove('hidden'), 500);
      }
    }, { finisher: willFaint, power, move });
    setTimeout(done, willFaint ? 1150 : 900);
  }

  enemyCounter(done) {
    setTimeout(() => {
      sfx.attack();
      const allyDef = this.activeDef();
      const eff = allyDef ? C.effectiveness(this.enemy.def.type, allyDef.type) : 1;
      const lvFactor = Math.max(0.6, Math.min(1.7, 1 + ((this.enemy.lv || 1) - this.allyLv()) * 0.05));
      const dmg = 15 * eff * lvFactor;
      const willFaint = this.allyHP - dmg <= 0;
      const power = eff >= 2 ? 1.5 : eff <= 0.5 ? 0.7 : 1;
      const move = pickMove(this.enemy.def.type);
      this.showMessage(`${this.enemy.def.name}의 ${move.name}!`, '#ff9a8a', 1000);
      this.scene.attack('enemy', this.enemy.def.type, () => {
        sfx.impact();
        this.allyHP = Math.max(0, this.allyHP - dmg);
        this.setAllyHP();
        if (this.allyHP <= 0) {
          this.scene.faint(this.scene.ally, () => {
            this.showMessage('힘내자! 다시 일어났어!', '#7fe3e0', 1200);
            this.setActiveAlly();
          });
        }
      }, { finisher: willFaint, power, move });
      setTimeout(done, willFaint ? 1150 : 900);
    }, 400);
  }

  afterAnswer(promoted, correct) {
    if (correct) this.gainXp(2); // 정답 → 출전 포켓몬 경험치 (레벨업·진화는 여기서)
    this.refreshTop();
    if (promoted) {
      setTimeout(() => {
        sfx.levelup();
        this.showMessage(`🎉 진급! ${promoted.toLabel}`, '#ffd23f', 1800);
        this.scene.screenShake(0.2, 0.3);
      }, 600);
    }
    // 포획 대기 중이면 멈춤(포획 처리 → betweenBattle에서 진화)
    if (this.enemy && this.enemy.energy <= 0) { this.locked = true; return; }
    // 진급했으면 진화 기회 먼저, 아니면 다음 문제
    const delay = promoted ? 2200 : 700;
    setTimeout(() => {
      this.maybeEvolveThen(() => this.nextQuestion());
    }, delay);
  }

  // ---- 포획 -------------------------------------------------------------
  throwBall() {
    $('catch-btn').classList.add('hidden');
    this.locked = true;
    sfx.throw();
    const ball = pickBall(); // 몬스터/슈퍼/하이퍼/마스터볼 랜덤
    const base = this.catchChance(this.enemy);
    const chance = ball.id === 'master' ? 1 : Math.min(0.98, base * ball.rate);
    const success = Math.random() < chance;
    this.showMessage(`${ball.name} 던지기! (포획률 ${Math.round(chance * 100)}%)`, '#fff', 1100);
    this.scene.throwPokeball(
      () => sfx.tap(),
      (caught) => {
        if (caught) {
          this.onCaught();
        } else {
          sfx.escape();
          this.showMessage('아쉽! 튀어나왔다! 다시 던져보자!', '#ff7a9c', 1400);
          setTimeout(() => $('catch-btn').classList.remove('hidden'), 1300); // 재도전 허용
        }
      },
      success,
      ball,
    );
  }

  // 포획 성공 → 데려갈지 경험치로 바꿀지 선택(전설은 항상 데려감=졸업)
  onCaught() {
    sfx.catch();
    const enemy = this.enemy;
    if (enemy.isLegendary) { this._keepCaught(enemy); return; }
    $('catch-choice-title').textContent = `${enemy.def.name} Lv.${enemy.lv} 잡았다!`;
    $('choice-keep').onclick = () => { $('catch-choice-modal').classList.add('hidden'); this._keepCaught(enemy); };
    $('choice-xp').onclick = () => { $('catch-choice-modal').classList.add('hidden'); this._convertToXp(enemy); };
    $('catch-choice-modal').classList.remove('hidden');
  }

  _keepCaught(enemy) {
    const subject = this.state.currentSubject;
    this.addOwned(subject, enemy.def.id);
    this.gainXp(3); // 배틀 승리 보너스(출전 포켓몬)
    if (enemy.isLegendary) {
      this.state.graduated[subject] = true;
      this.showMessage(`👑 전설의 ${enemy.def.name} 포획! ${C.SUBJECTS.find((s) => s.key === subject).region}지방 졸업!`, '#ffd23f', 2400);
    } else {
      this.showMessage(`🎒 ${enemy.def.name}을(를) 데려왔다!`, '#36d36e', 1800);
    }
    this.refreshTop();
    storage.save(this.state);
    this.scene.removeEnemy();
    setTimeout(() => this.betweenBattle(), enemy.isLegendary ? 2500 : 1900);
  }

  // 잡은 포켓몬을 경험치로 변환(출전 포켓몬에게). 레벨이 높을수록 경험치↑
  _convertToXp(enemy) {
    const amount = 6 + (enemy.lv || 1);
    this.state.dexSeen[enemy.def.id] = true;
    this.showMessage(`⭐ ${enemy.def.name} → 경험치 +${amount}!`, '#ffd23f', 1800);
    this.gainXp(amount);
    this.refreshTop();
    storage.save(this.state);
    this.scene.removeEnemy();
    setTimeout(() => this.betweenBattle(), 1900);
  }

  betweenBattle() {
    this.maybeEvolveThen(() => this.spawnWild());
  }

  // ---- 진화 -------------------------------------------------------------
  maybeEvolveThen(cb) {
    if (this.pendingEvolutions > 0 && this.evolvableOwned().length) {
      this.showEvolveModal(cb);
    } else {
      this.pendingEvolutions = 0;
      cb();
    }
  }

  showEvolveModal(cb) {
    const list = $('evolve-list');
    list.innerHTML = '';
    const evolvable = this.evolvableOwned();
    for (const o of evolvable) {
      const from = C.getCreatureDef(o.subject, o.speciesId);
      const to = C.evolveDef(o.subject, o.speciesId);
      const row = document.createElement('button');
      row.className = 'evolve-row';
      row.innerHTML = `<span class="mini-mon" style="background:${from.colors.body}"></span>
        <b>${from.name}</b> <span class="arrow">→</span> <b>${to.name}</b>
        <span class="mini-mon" style="background:${to.colors.body}"></span>`;
      row.onclick = () => { sfx.tap(); this.evolveOwned(o.uid); $('evolve-modal').classList.add('hidden'); this.pendingEvolutions = Math.max(0, this.pendingEvolutions - 1); setTimeout(() => this.maybeEvolveThen(cb), 1400); };
      list.appendChild(row);
    }
    $('evolve-skip').onclick = () => { this.pendingEvolutions = 0; $('evolve-modal').classList.add('hidden'); cb(); };
    $('evolve-modal').classList.remove('hidden');
  }

  evolveOwned(uid) {
    const o = this.state.owned.find((x) => x.uid === uid);
    if (!o) return;
    const next = C.evolveDef(o.subject, o.speciesId);
    if (!next) return;
    o.speciesId = next.id;
    this.state.dexSeen[next.id] = true;
    sfx.levelup();
    this.showMessage(`✨ ${next.name}(으)로 진화!`, '#ffd23f', 1800);
    if (uid === this.state.activeUid) {
      this.scene.evolveAlly(next);
      $('ally-name').textContent = next.name;
    }
    storage.save(this.state);
  }

  // ---- 파티 교체 ---------------------------------------------------------
  openParty() {
    const grid = $('party-grid');
    grid.innerHTML = '';
    if (!this.state.owned.length) { grid.innerHTML = '<p style="opacity:.7">아직 포켓몬이 없어요.</p>'; }
    for (const o of this.state.owned) {
      const def = this.displayDef(o);
      if (!def) continue;
      const active = o.uid === this.state.activeUid;
      const artId = def.formArt != null ? def.formArt : def.id;
      const cell = document.createElement('button');
      cell.className = 'party-cell' + (active ? ' active' : '');
      cell.innerHTML = `<img class="party-img" src="${artUrl(artId)}" alt="${def.name}" />
        <div class="pname">${def.name} Lv.${o.lv}${active ? ' ⭐' : ''}</div>
        <div class="ptype" style="color:${C.typeColor(def.type)}">${C.typeLabel(def.type)}</div>`;
      cell.onclick = () => { sfx.tap(); this.switchTo(o.uid); };
      grid.appendChild(cell);
    }
    $('party-modal').classList.remove('hidden');
  }

  switchTo(uid) {
    if (uid === this.state.activeUid) { $('party-modal').classList.add('hidden'); return; }
    this.state.activeUid = uid;
    this.setActiveAlly();
    storage.save(this.state);
    $('party-modal').classList.add('hidden');
    const def = this.activeDef();
    if (def) this.showMessage(`${def.name}, 가자!`, '#7fe3e0', 1000);
  }

  // ---- 도감 / 부모 보기 --------------------------------------------------
  openDex() {
    const subject = this.state.currentSubject || 'math';
    const grid = $('dex-grid');
    grid.innerHTML = '';
    for (const def of C.allDexDefs(subject)) {
      const seen = this.state.dexSeen[def.id];
      const count = this.state.dexCaught[def.id] || 0;
      const cell = document.createElement('div');
      cell.className = 'dex-cell' + (seen ? '' : ' locked') + (def.isLegendary ? ' legend' : '');
      const face = seen
        ? `<img class="dex-img" src="${artUrl(def.id)}" alt="${def.name}" />`
        : '<div class="disc" style="background:#444"><span class="qm">?</span></div>';
      cell.innerHTML = `
        <div class="dex-face">${face}</div>
        <div class="dname">${seen ? def.name : '???'}${def.isLegendary ? ' 👑' : ''}</div>
        <div class="dcount">${seen ? C.typeLabel(def.type) + ' · ' + (count ? '×' + count : '미포획') : ''}</div>`;
      grid.appendChild(cell);
    }
    $('dex-modal').classList.remove('hidden');
  }

  openParent() {
    const subject = this.state.currentSubject || 'math';
    const sMeta = C.SUBJECTS.find((s) => s.key === subject);
    const wrap = $('parent-stats');
    const rep = this.engine.report();
    const tc = this.state.totalCorrect, tw = this.state.totalWrong;
    const overall = tc + tw ? Math.round((tc / (tc + tw)) * 100) : 0;
    let html = `<div class="parent-summary">
      과목: <b>${sMeta.label}</b> (${sMeta.region}지방)${this.state.graduated[subject] ? ' · 👑졸업' : ''}<br>
      현재 단계: <b>${this.engine.currentSkill().label}</b><br>
      총 정답 ${tc} · 오답 ${tw} · 전체 정답률 <b>${overall}%</b><br>
      보유 포켓몬 ${this.state.owned.length}마리
    </div>`;
    for (const r of rep) {
      const status = r.locked ? '🔒 잠김' : r.mastered ? '✅ 완료' : r.current ? '▶ 학습 중' : '';
      html += `<div class="skill-row">
        <div class="skill-head"><span>${r.label} ${status}</span><span>${Math.round(r.accuracy * 100)}%</span></div>
        <div class="mbar"><div class="mfill" style="width:${r.attempts ? Math.round(r.accuracy * 100) : 0}%"></div></div>
        <div class="meta">시도 ${r.attempts}회 · 평균 ${r.avgTime ? r.avgTime.toFixed(1) + '초' : '-'}</div>
      </div>`;
    }
    wrap.innerHTML = html;
    $('parent-modal').classList.remove('hidden');
  }

  // ---- UI 갱신 -----------------------------------------------------------
  setEnemyEnergy() {
    const pct = this.enemy ? (this.enemy.energy / this.enemy.maxEnergy) * 100 : 0;
    $('enemy-energy').style.width = pct + '%';
  }
  setAllyHP() { $('ally-hp').style.width = this.allyHP + '%'; }

  setAllyXp() {
    const o = this.activeOwned();
    const el = $('ally-xp'), lab = $('ally-xp-label');
    if (!o) { if (el) el.style.width = '0%'; if (lab) lab.textContent = 'EXP'; return; }
    const need = this.xpNeeded(o.lv);
    if (el) el.style.width = Math.min(100, (o.xp / need) * 100) + '%';
    if (lab) lab.textContent = `EXP ${o.xp}/${need}`;
  }

  refreshTop() {
    this.state.trainerLevel = 1 + Math.floor(this.state.totalCorrect / 15);
    $('trainer-level').textContent = 'Lv.' + this.state.trainerLevel;
    $('caught-count').textContent = Object.values(this.state.dexCaught).reduce((a, c) => a + c, 0);
    if (this.engine) {
      $('stage-name').textContent = this.engine.currentSkill().label;
      $('stage-fill').style.width = this.engine.progress() * 100 + '%';
    }
    const sub = this.state.currentSubject;
    if (sub) $('region-btn').textContent = '🗺️ ' + C.SUBJECTS.find((s) => s.key === sub).region;
  }

  showMessage(text, color, dur = 1000) {
    const el = $('message-banner');
    el.textContent = text;
    el.style.color = color || '#fff';
    el.classList.add('show');
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => el.classList.remove('show'), dur);
  }

  hideAllModals() {
    document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
  }
}

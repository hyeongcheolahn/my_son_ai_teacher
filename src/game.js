import { BattleScene } from './scene.js';
import { MathEngine, mathQuestion } from './mathengine.js';
import { BankEngine } from './bankengine.js';
import { RandomEngine } from './randomengine.js';
import * as C from './creatures.js';
import * as storage from './storage.js';
import { pickBall } from './data/balls.js';
import { pickMove } from './data/moves.js';
import { artUrl } from './data/dex.js';
import { sfx, playUrl, stopUrl } from './audio.js';
import { requestMotionPermission, hasMotion, armThrow, disarmThrow } from './motion.js';
import { getStrokes } from './data/strokes.js';
import { speak, speakSupported, speakFriendly } from './tts.js';
import { buildAnalysis, buildReportText } from './analytics.js';
import { explainQuestion, hintQuestion } from './teach.js';

const $ = (id) => document.getElementById(id);

const EXAM_N = 5;     // 종합 시험 문항 수
const EXAM_PASS = 4;  // 합격 기준(정답 개수)

function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const escapeText = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const escapeAttr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
    if (!this.state.review) this.state.review = [];
    this.bindUI();
    this.applyProfile();
    this.updateReviewBadge();
  }

  applyProfile() {
    const p = storage.getActiveProfile();
    if (p) {
      const av = $('trainer-avatar'); if (av) av.textContent = p.avatar;
      const nm = $('trainer-name'); if (nm) nm.textContent = p.name;
    }
  }

  _ensureLevels() {
    for (const o of this.state.owned) {
      if (o.lv == null) o.lv = 1;
      if (o.xp == null) o.xp = 0;
    }
  }

  bindUI() {
    // 안전 바인딩: 요소가 없어도(구버전 캐시 등) 에러로 전체 바인딩이 중단되지 않게 한다.
    const on = (id, handler) => { const el = $(id); if (el) el.onclick = handler; };
    on('start-btn', () => {
      sfx.unlock(); requestMotionPermission();
      try { if (speakSupported()) window.speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch {} // iOS 음성 잠금 해제
      this.openSubjectSelect();
    });
    on('catch-btn', () => this.throwBall());
    on('transform-btn', () => this.doTransform());
    on('dex-btn', () => this.openDex());
    on('parent-btn', () => this.openParent());
    on('party-btn', () => this.openParty());
    on('region-btn', () => this.openSubjectSelect());
    on('go-subject', () => { sfx.tap(); $('parent-modal').classList.add('hidden'); this.openSubjectSelect(); });
    on('go-home', () => { sfx.tap(); location.reload(); });
    const soundBtn = $('sound-toggle');
    if (soundBtn) {
      const renderSound = () => { soundBtn.textContent = sfx.isMuted() ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'; };
      renderSound();
      soundBtn.onclick = () => { const next = !sfx.isMuted(); sfx.setMuted(next); renderSound(); if (!next) sfx.tap(); };
    }
    on('review-btn', () => this.openReview());
    on('profile-chip', () => { sfx.tap(); location.reload(); }); // 친구 바꾸기(프로필 선택 화면으로)
    on('reset-btn', () => {
      const p = storage.getActiveProfile();
      const who = p ? `'${p.name}'의 ` : '';
      if (confirm(`정말 ${who}학습 진도를 초기화할까요?\n(잡은 포켓몬과 레벨, 도감은 그대로 유지돼요)`)) { storage.reset(); location.reload(); }
    });
    on('report-offline-btn', () => this.showOfflineReport());
    on('report-ai-btn', () => this.showAiReport());
    on('sync-save', () => this.saveSyncSettings());
    on('subject-x', () => { sfx.tap(); $('subject-modal').classList.add('hidden'); });
    // 닫기(✕/닫기) 버튼 — 대상이 없어도 안전하게
    document.querySelectorAll('[data-close]').forEach((b) => {
      b.onclick = () => { const t = $(b.dataset.close); if (t) t.classList.add('hidden'); };
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
    // 닫기 ✕는 이미 게임이 진행 중일 때만(=엔진 있음) 보여준다. 첫 실행 땐 반드시 과목을 골라야 함.
    const x = $('subject-x'); if (x) x.classList.toggle('hidden', !this.engine);
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
    const kidName = (storage.getActiveProfile() && storage.getActiveProfile().name) || '친구';
    if (subject === 'math') this.engine = new MathEngine(this.state.subjects[subject], Math.random, kidName);
    else if (subject === 'random') this.engine = new RandomEngine(this.state.subjects[subject], Math.random, kidName);
    else this.engine = new BankEngine(C.buildBank(subject), this.state.subjects[subject]);

    this.ensureStarter(subject);
    // 출전 포켓몬 지정 (랜덤/도형 모드는 다른 지방 포켓몬을 빌려 씀)
    const cs = C.creatureSubject(subject);
    const mine = subject === 'random' ? this.state.owned : this.state.owned.filter((o) => o.subject === cs);
    if (mine.length && !mine.some((o) => o.uid === this.state.activeUid)) this.state.activeUid = mine[0].uid;

    this.hideAllModals();
    this.setActiveAlly();
    this.refreshTop();
    storage.save(this.state);
    this.spawnWild();
  }

  ensureStarter(subject) {
    if (subject === 'random') {
      // 랜덤 모드: 가진 포켓몬이 하나도 없을 때만 수학 지방 스타터를 준다.
      if (!this.state.owned.length) { const st = C.starterDef('math'); this.addOwned('math', st.id, true); }
      return;
    }
    const cs = C.creatureSubject(subject);
    if (!this.state.owned.some((o) => o.subject === cs)) {
      const st = C.starterDef(cs);
      this.addOwned(cs, st.id, true);
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

    const cs = C.creatureSubject(subject);
    let def, isLegendary = false;
    if (graduation) {
      def = C.legendaryDef(cs);
      isLegendary = true;
    } else if (subject === 'random') {
      def = C.pickAnyWildDef();
    } else {
      def = C.pickWildDef(cs);
    }
    // 야생으로 전설이 뽑히면 전설 대우(레벨↑·잡기 어려움·특별 메시지)
    if (def && def.isLegendary) isLegendary = true;
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

    if (graduation) this.showMessage(`👑 졸업 시험! 전설의 ${def.name}!`, '#ffd23f', 1800);
    else if (isLegendary) this.showMessage(`✨ 전설의 ${def.name} 출현!! 잡아보자!`, '#ffd23f', 1800);
    else this.showMessage(`앗! 야생 ${def.name} 등장!`, '#ffd23f', 1100);

    storage.save(this.state);
    setTimeout(() => this.nextQuestion(), isLegendary ? 1700 : 1000);
  }

  // 문제 글 + 읽어주기(🔊) 버튼 표시. 영어 단어/따라쓰기는 자동으로 읽어 준다.
  applyQuestionText(q) {
    const qEl = $('question');
    const len = String(q.text).length;
    qEl.classList.toggle('small', len > 12 && len <= 34);
    qEl.classList.toggle('tiny', len > 34);
    const sp = this.questionSpeak(q);
    qEl.innerHTML = escapeText(q.text) + (sp ? ' <button class="speak-btn" title="읽어주기">🔊</button>' : '');
    if (sp) {
      qEl.querySelector('.speak-btn').onclick = (e) => { e.stopPropagation(); speak(sp.text, sp.lang); };
      if (sp.auto) setTimeout(() => speak(sp.text, sp.lang), 280);
    }
  }

  // 무엇을 읽어줄지 결정: 영어 단어가 있으면 그 단어(영어 발음), 따라쓰기는 글자, 그 외엔 문제 전체
  questionSpeak(q) {
    if (!speakSupported()) return null;
    if (q.kind === 'trace') return { text: q.glyph, lang: /[A-Za-z]/.test(q.glyph) ? 'en-US' : 'ko-KR', auto: true };
    const m = String(q.text).match(/'([A-Za-z][A-Za-z .'-]*)'/);
    if (m) return { text: m[1], lang: 'en-US', auto: true };
    return { text: q.text, lang: 'ko-KR', auto: false };
  }

  nextQuestion() {
    // 단계 정답을 다 모았으면 → 다음 일반 문제 대신 "종합 시험" 시작
    if (this.pendingExam && !this.inExam) { this.pendingExam = false; this.startExam(); return; }
    this.q = this.engine.nextQuestion();
    this.applyQuestionText(this.q);
    this.qStart = performance.now();
    this.locked = false;
    if (this.q.kind === 'trace') { this.renderTrace(this.q); this.refreshTransformBtn(); this._maybeLesson(); return; }
    if (this.q.kind === 'clock') { this.renderClock(this.q); this.refreshTransformBtn(); this._maybeLesson(); return; }
    const isText = typeof this.q.answer !== 'number';
    const box = $('choices');
    box.className = 'choices';
    box.innerHTML = '';
    for (const c of (this.q.choices || [])) {
      const btn = document.createElement('button');
      btn.className = 'choice' + (isText ? ' text' : '');
      btn.textContent = c;
      btn.onclick = () => this.answer(c, btn);
      box.appendChild(btn);
    }
    this.refreshTransformBtn(); // 변신 가능하면 버튼 표시
    // 문제·선택지를 먼저 그린 뒤, 새 단계면 개념 미니레슨을 그 위에 띄운다(렌더를 막지 않음).
    this._maybeLesson();
  }

  _maybeLesson() { try { this.maybeMiniLesson(); } catch (e) { console.error('mini-lesson 오류(무시):', e); } }

  answer(value, btn) {
    if (this.locked) return;
    this.locked = true;
    sfx.tap();
    const correct = String(value) === String(this.q.answer);
    this.lastWrong = correct ? null : value; // AI 선생님 설명에 쓸 '아이가 고른 답'
    // 같은 문제를 몇 번 틀렸는지 추적 → 3번 이상이면 그제서야 정답 공개
    const key = String(this.q.text);
    if (correct) { this._wrongCount = 0; }
    else { this._wrongCount = (this._wrongKey === key ? (this._wrongCount || 0) : 0) + 1; this._wrongKey = key; }
    const reveal = !correct && this._wrongCount >= 3;
    const buttons = [...document.querySelectorAll('#choices .choice')];
    buttons.forEach((b) => (b.disabled = true));
    if (correct) {
      btn.classList.add('correct');
    } else {
      btn.classList.add('wrong');
      // 힌트 단계에선 정답을 표시하지 않음(3번 이상 틀렸을 때만 공개)
      if (reveal) buttons.find((b) => String(b.textContent) === String(this.q.answer))?.classList.add('correct');
    }
    this.resolveAnswer(correct, reveal);
  }

  // 정답/오답 공통 처리. 오답이면 진도가 오르지 않고 같은 문제를 다시 낸다.
  resolveAnswer(correct, reveal) {
    const time = performance.now() - this.qStart;
    // 분석용 로그 기록(최근 1000개 유지)
    if (!this.state.log) this.state.log = [];
    this.state.log.push({ t: Date.now(), subject: this.q.subjectTag || this.state.currentSubject, skillId: this.q.skillId, correct, ms: Math.round(time), kind: this.q.kind || null });
    if (this.state.log.length > 1000) this.state.log.shift();
    const res = this.engine.record(this.q.skillId, correct, time);
    const promoted = null;
    if (res && res.exam) { this.pendingExam = true; this.showMessage('이번 단계 끝! 종합 시험 도전! 📝', '#ffd23f', 1500); }
    if (correct) {
      this.state.totalCorrect++;
      sfx.correct();
      this.doAttack(() => this.afterAnswer(promoted, true));
    } else {
      this.state.totalWrong++;
      this.addReview(this.q);
      this.engine.markWrong(this.q); // 같은 문제 재출제 → 맞힐 때까지 진도 정지
      sfx.wrong();
      // 틀리면 "왜 그런지" 먼저 가르쳐 준 뒤, 같은 문제를 다시 풀게 한다.
      // (설명 단계에서 무슨 일이 생겨도 전투는 반드시 이어지도록 안전장치)
      const cont = () => {
        this.showMessage('이제 같은 문제 다시 도전! 💪', '#ff7a9c', 1100);
        this.enemyCounter(() => this.afterAnswer(promoted, false));
      };
      try { this.showTeach(this.q, cont, reveal); } catch (e) { console.error('teach 오류(무시):', e); cont(); }
    }
    this.refreshTop();
    storage.save(this.state);
  }

  // ---- 배움(개념 미니레슨 / 틀렸을 때 가르치기) --------------------------
  // 새 단계면 미니레슨을 단계별 1회 보여준다(문제는 이미 그려진 상태 — 닫으면 바로 풀 수 있음).
  maybeMiniLesson() {
    if (this.inExam) return false;
    const skill = this.engine.currentSkill && this.engine.currentSkill();
    if (!skill) return false;
    const key = (this.state.currentSubject || '') + ':' + skill.id;
    if (!this.state.lessonsSeen) this.state.lessonsSeen = {};
    if (this.state.lessonsSeen[key]) return false;
    this.state.lessonsSeen[key] = true;
    storage.save(this.state);
    this.showMiniLesson(skill);
    return true;
  }

  showMiniLesson(skill) {
    // 설명 가능한 예시 문제 하나 고르기 (수학은 깔끔한 계산식으로)
    let sample = null;
    try { if (skill && skill.op != null) sample = mathQuestion((this.engine.state && this.engine.state.current) || 0); } catch {}
    if (!explainQuestion(sample)) {
      for (let i = 0; i < 8; i++) {
        const s = this.engine.nextQuestion();
        if (!sample) sample = s;
        if (explainQuestion(s)) { sample = s; break; }
      }
    }
    const ex = explainQuestion(sample);
    const title = '🎓 새로운 걸 배워요: ' + (skill && skill.label ? skill.label : '');
    let body = '';
    if (sample && sample.text) body += `<div class="teach-example">📖 이런 문제예요<br><b>${escapeText(sample.text)}</b></div>`;
    if (ex) body += `<div class="teach-explain"><div class="teach-explain-title">${ex.title}</div>${ex.html}</div>`;
    else body += '<div class="teach-explain td-text">차근차근 하나씩 풀어보면 돼요. 화이팅! 💪</div>';
    this._openTeach(title, body, '좋아, 풀어볼게! ▶', null, sample, null, ex && ex.speak);
  }

  showTeach(q, onDone, reveal) {
    // 기본은 '힌트'만(정답 비공개). 3번 이상 틀리면(reveal) 정답+설명 공개.
    const ex = reveal ? explainQuestion(q) : hintQuestion(q);
    if (!ex) { if (onDone) onDone(); return; } // 설명 없는 유형(따라쓰기 등)은 그냥 진행
    const body = `<div class="teach-explain"><div class="teach-explain-title">${ex.title}</div>${ex.html}</div>`;
    const title = reveal ? '정답을 같이 볼까? 💡' : '앗! 힌트를 줄게 🤔';
    const btn = reveal ? '알겠어! 다시 풀기 ▶' : '힌트 보고 다시! ▶';
    this._openTeach(title, body, btn, onDone, q, this.lastWrong, ex.speak, !reveal);
  }

  // 읽어주기: NAS에 자연스러운 음성(ElevenLabs)이 있으면 그걸로, 없으면 브라우저 음성으로.
  speakTeach(text) {
    if (!text) return;
    try { window.speechSynthesis.cancel(); } catch {}
    stopUrl();
    if (storage.syncOn() && storage.caps().tts !== false) {
      storage.ttsAudioUrl(text)
        .then((url) => { if (url) playUrl(url); else speakFriendly(text); })
        .catch(() => speakFriendly(text));
    } else {
      speakFriendly(text);
    }
  }

  // 🤖 AI 선생님: NAS의 Claude가 이 문제를 아이 눈높이로 더 자세히 설명
  askAiTutor(q, studentAnswer, hint) {
    const out = $('teach-ai');
    $('teach-ai-btn').classList.add('hidden');
    out.classList.remove('hidden');
    out.textContent = hint ? '🤖 AI 선생님이 힌트를 생각하고 있어요… 잠깐만!' : '🤖 AI 선생님이 설명을 준비하고 있어요… 잠깐만!';
    storage.aiExplain({
      name: this._profileName(),
      subject: q.subjectTag || this.state.currentSubject,
      question: q.text,
      choices: q.choices,
      correctAnswer: q.answer,
      studentAnswer: studentAnswer != null ? studentAnswer : undefined,
      hint: !!hint,
    })
      .then((r) => {
        const msg = (r && r.explain) ? r.explain : (r && r.error) ? '오류: ' + r.error : '응답을 받지 못했어요.';
        out.textContent = msg;
        if (r && r.explain) { this._teachSpeak = r.explain; if (!sfx.isMuted()) this.speakTeach(r.explain); } // AI 답도 목소리로
      })
      .catch((code) => {
        out.textContent = (code === 404 || code === 400)
          ? '🤖 AI 선생님을 쓰려면 NAS 서버를 최신으로 업데이트해 주세요.\n(server.js 교체 후 컨테이너 재시작)'
          : 'AI 선생님과 연결하지 못했어요. NAS 서버가 켜져 있는지 확인해 주세요.';
      });
  }

  _openTeach(title, bodyHtml, btnLabel, onDone, q, studentAnswer, speakText, hint) {
    // 안전장치: 핵심 요소가 없으면(구버전 캐시 등) 모달을 띄우지 않고 그냥 진행 → 게임이 멈추지 않음
    const modal = $('teach-modal'), btn = $('teach-go'), bodyEl = $('teach-body');
    if (!modal || !btn || !bodyEl) { if (onDone) onDone(); return; }
    const t = $('teach-title'); if (t) t.innerHTML = title;
    bodyEl.innerHTML = bodyHtml;
    const ai = $('teach-ai'); if (ai) { ai.classList.add('hidden'); ai.textContent = ''; }
    // 🔊 다시 듣기 버튼 + 자동 읽어주기(친숙한 목소리)
    this._teachSpeak = speakText || '';
    const spk = $('teach-speak');
    if (spk) {
      spk.classList.toggle('hidden', !this._teachSpeak);
      spk.onclick = () => { sfx.tap(); if (this._teachSpeak) this.speakTeach(this._teachSpeak); };
    }
    const aiBtn = $('teach-ai-btn');
    if (aiBtn) {
      if (q && storage.syncOn()) {
        aiBtn.classList.remove('hidden');
        aiBtn.textContent = hint ? '🤖 AI 선생님께 힌트 더 받기' : '🤖 AI 선생님께 더 물어보기';
        aiBtn.onclick = () => { sfx.tap(); this.askAiTutor(q, studentAnswer, hint); };
      } else {
        aiBtn.classList.add('hidden');
      }
    }
    btn.textContent = btnLabel;
    btn.onclick = () => { sfx.tap(); try { window.speechSynthesis.cancel(); } catch {} stopUrl(); modal.classList.add('hidden'); if (onDone) onDone(); };
    modal.classList.remove('hidden');
    if (this._teachSpeak && !sfx.isMuted()) setTimeout(() => this.speakTeach(this._teachSpeak), 240);
  }

  // ---- 따라쓰기 문제 -----------------------------------------------------
  renderTrace(q) {
    const box = $('choices');
    box.className = 'choices trace';
    const strokes = getStrokes(q.glyph);
    box.innerHTML = `
      <div class="trace-wrap">
        <div class="trace-pad">
          <canvas class="trace-guide"></canvas>
          <canvas class="trace-demo"></canvas>
          <canvas class="trace-ink"></canvas>
        </div>
        <div class="trace-btns">
          ${strokes ? '<button class="trace-demo-btn">👀 순서 보기</button>' : ''}
          <button class="trace-clear">↺ 지우기</button>
          <button class="trace-done">✏️ 다 썼어요!</button>
        </div>
        <div class="trace-hint">${strokes ? '먼저 쓰는 순서를 보고, 손가락으로 따라 써 보자' : '글자를 손가락으로 따라 써 보자'}</div>
      </div>`;
    const guide = box.querySelector('.trace-guide');
    const demo = box.querySelector('.trace-demo');
    const ink = box.querySelector('.trace-ink');
    const hint = box.querySelector('.trace-hint');
    const SIZE = Math.min(260, Math.max(180, Math.floor((box.clientWidth || 300) * 0.7)));
    for (const cv of [guide, demo, ink]) { cv.width = SIZE; cv.height = SIZE; }

    // 가이드(연한 글자) 그리기 — 동시에 마스크로도 쓴다.
    const gctx = guide.getContext('2d');
    gctx.clearRect(0, 0, SIZE, SIZE);
    gctx.fillStyle = 'rgba(120,124,150,0.40)';
    gctx.textAlign = 'center';
    gctx.textBaseline = 'middle';
    gctx.font = `bold ${Math.floor(SIZE * 0.72)}px "Apple SD Gothic Neo", system-ui, sans-serif`;
    gctx.fillText(q.glyph, SIZE / 2, SIZE / 2 + SIZE * 0.02);

    // 획순 시범(펜 애니메이션)
    const dctx = demo.getContext('2d');
    if (strokes) {
      this.playStrokeDemo(demo, dctx, strokes, SIZE);
      box.querySelector('.trace-demo-btn').onclick = () => { sfx.tap(); this.playStrokeDemo(demo, dctx, strokes, SIZE); };
    }

    // 잉크(사용자가 따라 쓰는 층)
    const ictx = ink.getContext('2d');
    ictx.lineCap = 'round';
    ictx.lineJoin = 'round';
    ictx.lineWidth = Math.max(14, SIZE * 0.07);
    ictx.strokeStyle = '#ff5a5f';

    let drawing = false, last = null, drewSomething = false;
    const pos = (e) => {
      const r = ink.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: (t.clientX - r.left) * (SIZE / r.width), y: (t.clientY - r.top) * (SIZE / r.height) };
    };
    const down = (e) => { e.preventDefault(); drawing = true; last = pos(e); };
    const move = (e) => {
      if (!drawing) return; e.preventDefault();
      const p = pos(e);
      ictx.beginPath(); ictx.moveTo(last.x, last.y); ictx.lineTo(p.x, p.y); ictx.stroke();
      last = p; drewSomething = true;
    };
    const up = () => { drawing = false; };
    ink.addEventListener('touchstart', down, { passive: false });
    ink.addEventListener('touchmove', move, { passive: false });
    ink.addEventListener('touchend', up);
    ink.addEventListener('mousedown', down);
    ink.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    this._traceCleanup = () => { window.removeEventListener('mouseup', up); };

    box.querySelector('.trace-clear').onclick = () => { sfx.tap(); ictx.clearRect(0, 0, SIZE, SIZE); drewSomething = false; hint.textContent = '글자를 손가락으로 따라 써 보자'; };
    box.querySelector('.trace-done').onclick = () => {
      if (this.locked) return;
      if (!drewSomething) { hint.textContent = '글자 위를 손가락으로 따라 써 보자!'; return; }
      const cov = this._traceCoverage(gctx, ictx, SIZE);
      if (cov >= 0.4) {
        this.locked = true;
        if (this._traceCleanup) this._traceCleanup();
        box.querySelector('.trace-done').disabled = true;
        this.resolveAnswer(true);
      } else {
        hint.textContent = '조금만 더 진하게 따라 써 볼까? ✏️';
      }
    };
  }

  // 가이드 글자 위에 잉크가 얼마나 겹쳤는지 비율(0~1)
  _traceCoverage(gctx, ictx, SIZE) {
    const g = gctx.getImageData(0, 0, SIZE, SIZE).data;
    const k = ictx.getImageData(0, 0, SIZE, SIZE).data;
    let need = 0, hit = 0;
    for (let i = 3; i < g.length; i += 4) {
      if (g[i] > 20) { need++; if (k[i] > 20) hit++; }
    }
    return need ? hit / need : 0;
  }

  // 획순 시범: 펜이 획을 순서대로 그리며 번호를 보여준다.
  playStrokeDemo(canvas, ctx, strokes, SIZE) {
    if (this._demoRAF) cancelAnimationFrame(this._demoRAF);
    const pad = SIZE * 0.12, span = SIZE - pad * 2;
    const map = (pt) => [pad + (pt[0] / 100) * span, pad + (pt[1] / 100) * span];
    const segInfo = strokes.map((s) => {
      const pts = s.map(map); const segs = []; let total = 0;
      for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
      return { pts, segs, total: total || 1 };
    });
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(8, SIZE * 0.05);
    const STROKE_T = 0.55, PAUSE = 0.22;
    let si = 0, phase = 'draw', t0 = performance.now();

    const drawUpTo = (cur, frac) => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      for (let k = 0; k <= cur && k < segInfo.length; k++) {
        const info = segInfo[k];
        const f = k < cur ? 1 : frac;
        ctx.strokeStyle = k === cur ? '#ffd23f' : 'rgba(255,210,63,.8)';
        ctx.beginPath(); ctx.moveTo(info.pts[0][0], info.pts[0][1]);
        const target = info.total * f; let acc = 0, px = info.pts[0][0], py = info.pts[0][1];
        for (let i = 1; i < info.pts.length; i++) {
          const l = info.segs[i - 1];
          if (acc + l <= target) { ctx.lineTo(info.pts[i][0], info.pts[i][1]); acc += l; px = info.pts[i][0]; py = info.pts[i][1]; }
          else { const r = (target - acc) / l; px = info.pts[i - 1][0] + (info.pts[i][0] - info.pts[i - 1][0]) * r; py = info.pts[i - 1][1] + (info.pts[i][1] - info.pts[i - 1][1]) * r; ctx.lineTo(px, py); break; }
        }
        ctx.stroke();
        this._drawStrokeNum(ctx, info.pts[0][0], info.pts[0][1], k + 1, SIZE);
        if (k === cur) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, SIZE * 0.032, 0, 7); ctx.fill(); }
      }
    };

    const step = () => {
      if (!canvas.isConnected) { this._demoRAF = null; return; }
      const now = performance.now(), dt = (now - t0) / 1000;
      if (phase === 'draw') {
        const frac = Math.min(dt / STROKE_T, 1);
        drawUpTo(si, frac);
        if (frac >= 1) { phase = 'pause'; t0 = now; }
      } else {
        drawUpTo(si, 1);
        if (dt >= PAUSE) {
          si++;
          if (si >= segInfo.length) { this._demoRAF = null; setTimeout(() => { if (canvas.isConnected) ctx.clearRect(0, 0, SIZE, SIZE); }, 1000); return; }
          phase = 'draw'; t0 = now;
        }
      }
      this._demoRAF = requestAnimationFrame(step);
    };
    this._demoRAF = requestAnimationFrame(step);
  }

  _drawStrokeNum(ctx, x, y, n, SIZE) {
    const r = SIZE * 0.052;
    ctx.save();
    ctx.fillStyle = '#ff5a5f'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.floor(r * 1.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), x, y + r * 0.06);
    ctx.restore();
  }

  // ---- 시계 문제 -------------------------------------------------------
  renderClock(q) {
    const box = $('choices');
    box.className = 'choices clock';
    box.innerHTML = '<canvas class="clock-canvas" width="220" height="220"></canvas><div class="clock-opts"></div>';
    this.drawClock(box.querySelector('.clock-canvas'), q.clock);
    const opts = box.querySelector('.clock-opts');
    for (const c of q.choices) {
      const btn = document.createElement('button');
      btn.className = 'choice text';
      btn.textContent = c;
      btn.onclick = () => this.answer(c, btn);
      opts.appendChild(btn);
    }
  }

  drawClock(canvas, clock) {
    if (!canvas || !clock) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, R = W / 2, cx = R, cy = R;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1b2a4a'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, R - 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 분 눈금
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const big = i % 5 === 0;
      ctx.lineWidth = big ? 2.5 : 1; ctx.strokeStyle = '#9aa6c4';
      const r1 = R - 12, r2 = big ? R - 22 : R - 16;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke();
    }
    // 숫자
    ctx.fillStyle = '#1b2a4a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(W * 0.1)}px system-ui, sans-serif`;
    for (let n = 1; n <= 12; n++) {
      const a = (n / 12) * Math.PI * 2 - Math.PI / 2;
      ctx.fillText(String(n), cx + Math.cos(a) * (R - 34), cy + Math.sin(a) * (R - 34));
    }
    const { h, m, s, hand } = clock;
    const hand2 = (a, len, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke(); };
    const hourA = (((h % 12) + (m || 0) / 60) / 12) * Math.PI * 2 - Math.PI / 2;
    const minA = ((m || 0) / 60) * Math.PI * 2 - Math.PI / 2;
    hand2(hourA, R * 0.48, 7, '#1b2a4a');   // 짧은바늘(시)
    hand2(minA, R * 0.72, 5, '#2e6bff');     // 긴바늘(분)
    if (hand === 'hms' && s != null) hand2((s / 60) * Math.PI * 2 - Math.PI / 2, R * 0.8, 2, '#e53935'); // 초바늘
    ctx.fillStyle = '#1b2a4a'; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.fill();
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
        setTimeout(() => this.showCatch(), 500);
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

  // 포획 기회 등장: 버튼 표시 + (가능하면) 자이로 던지기 모션 대기
  showCatch() {
    const btn = $('catch-btn');
    btn.classList.remove('hidden');
    const motion = hasMotion();
    btn.textContent = motion ? '📱 폰을 휙 던져! (또는 누르기)' : '⚪ 포켓볼 던지기!';
    if (motion) armThrow(() => { this.showMessage('📱 휙! 던졌다!', '#ffd23f', 800); this.throwBall(); });
  }

  // ---- 포획 -------------------------------------------------------------
  throwBall() {
    disarmThrow();
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
          setTimeout(() => this.showCatch(), 1300); // 재도전 허용
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
    // 잡은 포켓몬은 원래 지방 소속으로 저장(랜덤 모드에서도 도감/진화가 올바르게 동작)
    const subject = enemy.def.subject || this.state.currentSubject;
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
    this.maybeEvolveThen(() => this.maybePokemonQuiz(() => this.spawnWild()));
  }

  // ---- 포켓몬 상식 퀴즈(중간중간 등장) -----------------------------------
  maybePokemonQuiz(cb) {
    if (Math.random() < 0.5) this.startPokemonQuiz(cb);
    else cb();
  }

  startPokemonQuiz(cb) {
    const quiz = C.makePokemonQuiz();
    this._pquizCb = cb;
    sfx.tap();
    const body = $('pquiz-body');
    body.innerHTML = `
      <img class="pquiz-img" src="${artUrl(quiz.image)}" alt="포켓몬" />
      <div class="pquiz-q">${escapeText(quiz.q)}</div>
      <div class="review-choices">
        ${quiz.choices.map((c) => `<button class="choice text" data-c="${escapeAttr(c)}">${escapeText(c)}</button>`).join('')}
      </div>`;
    body.querySelectorAll('.choice').forEach((btn) => {
      btn.onclick = () => this.answerPokemonQuiz(quiz, btn.dataset.c, btn, body);
    });
    $('pquiz-modal').classList.remove('hidden');
  }

  answerPokemonQuiz(quiz, value, btn, body) {
    const buttons = [...body.querySelectorAll('.choice')];
    buttons.forEach((b) => (b.disabled = true));
    const correct = String(value) === String(quiz.answer);
    if (correct) { btn.classList.add('correct'); sfx.correct(); }
    else { btn.classList.add('wrong'); buttons.find((b) => String(b.dataset.c) === String(quiz.answer))?.classList.add('correct'); sfx.wrong(); }
    setTimeout(() => {
      $('pquiz-modal').classList.add('hidden');
      if (correct) { this.showMessage('🎓 포켓몬 박사: 정답! 경험치 보너스 +3', '#ffd23f', 1600); this.gainXp(3); }
      const cb = this._pquizCb; this._pquizCb = null;
      if (cb) cb();
    }, correct ? 950 : 1500);
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

  // ---- 학습 리포트 / 동기화 설정 -----------------------------------------
  _profileName() { const p = storage.getActiveProfile(); return p ? p.name : '아이'; }

  showOfflineReport() {
    sfx.tap();
    const out = $('report-out');
    const a = buildAnalysis(this.state);
    out.textContent = buildReportText(a, this._profileName());
    out.classList.remove('hidden');
  }

  showAiReport() {
    sfx.tap();
    const out = $('report-out');
    out.classList.remove('hidden');
    if (!storage.syncOn()) { out.textContent = '먼저 아래 ☁️ NAS 동기화 설정에서 서버 주소를 연결해 주세요.\n(AI 리포트는 NAS 서버가 Claude로 분석해 줍니다.)'; return; }
    out.textContent = '🤖 AI 선생님이 분석 중이에요… 잠시만요.';
    const a = buildAnalysis(this.state);
    storage.aiReport(this._profileName(), a)
      .then((r) => { out.textContent = (r && r.report) ? r.report : (r && r.error) ? '오류: ' + r.error : '응답을 받지 못했어요.'; })
      .catch(() => { out.textContent = 'NAS 서버에 연결하지 못했어요. 주소/토큰과 서버 실행 상태를 확인해 주세요.'; });
  }

  saveSyncSettings() {
    const url = $('sync-url').value.trim();
    const token = $('sync-token').value.trim();
    const status = $('sync-status');
    storage.setSync(url, token);
    if (!url) { status.textContent = '동기화 꺼짐(이 기기에만 저장)'; return; }
    status.textContent = '연결 확인 중…';
    storage.testSync()
      .then(() => { status.textContent = '✅ 연결 성공! 다른 기기에서도 같은 주소·토큰을 넣으면 동기화돼요.'; storage.pullAll().then(() => storage.pushProfiles()); })
      .catch(() => { status.textContent = '❌ 연결 실패. 주소(https)와 토큰, 서버 실행을 확인해 주세요.'; });
  }

  openParent() {
    // 동기화 설정 입력칸 채우기 + 리포트 출력 영역 초기화
    const su = $('sync-url'); if (su) su.value = storage.syncUrl();
    const st = $('sync-token'); if (st) st.value = storage.syncToken();
    const ro = $('report-out'); if (ro) { ro.textContent = ''; ro.classList.add('hidden'); }
    const ss = $('sync-status'); if (ss) ss.textContent = storage.syncOn() ? '연결됨: ' + storage.syncUrl() : '동기화 꺼짐(이 기기에만 저장)';
    const subject = this.state.currentSubject || 'math';
    const sMeta = C.SUBJECTS.find((s) => s.key === subject);
    const wrap = $('parent-stats');
    const rep = this.engine.report();
    const tc = this.state.totalCorrect, tw = this.state.totalWrong;
    const overall = tc + tw ? Math.round((tc / (tc + tw)) * 100) : 0;
    const place = subject === 'random' ? '여러 과목 섞기' : `${sMeta.region}지방`;
    let html = `<div class="parent-summary">
      과목: <b>${sMeta.label}</b> (${place})${this.state.graduated[subject] ? ' · 👑졸업' : ''}<br>
      현재 단계: <b>${this.engine.currentSkill().label}</b><br>
      총 정답 ${tc} · 오답 ${tw} · 전체 정답률 <b>${overall}%</b><br>
      보유 포켓몬 ${this.state.owned.length}마리
    </div>`;
    for (const r of rep) {
      const status = r.locked ? '🔒 잠김' : r.mastered ? '✅ 완료' : r.current ? '▶ 학습 중' : '';
      const prog = r.current && r.need ? ` · 진도 ${r.levelCorrect}/${r.need} 정답` : '';
      html += `<div class="skill-row">
        <div class="skill-head"><span>${r.label} ${status}</span><span>${Math.round(r.accuracy * 100)}%</span></div>
        <div class="mbar"><div class="mfill" style="width:${r.attempts ? Math.round(r.accuracy * 100) : 0}%"></div></div>
        <div class="meta">시도 ${r.attempts}회 · 평균 ${r.avgTime ? r.avgTime.toFixed(1) + '초' : '-'}${prog}</div>
      </div>`;
    }
    wrap.innerHTML = html;
    $('parent-modal').classList.remove('hidden');
  }

  // ---- 오답 복습 ---------------------------------------------------------
  addReview(q) {
    if (!q || !q.choices) return; // 따라쓰기 등 보기 없는 문제는 복습에 안 넣음
    if (!this.state.review) this.state.review = [];
    const key = String(q.text);
    if (this.state.review.some((r) => r.key === key)) return; // 중복 방지
    this.state.review.push({
      key, text: q.text, answer: q.answer,
      choices: [...q.choices], skillId: q.skillId, subject: q.subjectTag || this.state.currentSubject,
    });
    if (this.state.review.length > 40) this.state.review.shift(); // 너무 쌓이지 않게
    this.updateReviewBadge();
  }

  updateReviewBadge() {
    const n = (this.state.review || []).length;
    const b = $('review-badge');
    if (!b) return;
    if (n > 0) { b.textContent = n; b.classList.remove('hidden'); }
    else b.classList.add('hidden');
  }

  openReview() {
    sfx.tap();
    this.reviewSession = [...(this.state.review || [])];
    this.reviewPos = 0;
    this.reviewRight = 0;
    $('review-modal').classList.remove('hidden');
    this.renderReviewCard();
  }

  renderReviewCard() {
    const body = $('review-body');
    const session = this.reviewSession || [];
    if (!session.length) {
      body.innerHTML = '<p class="review-empty">아직 틀린 문제가 없어요!<br>잘하고 있어요 🎉</p>';
      return;
    }
    if (this.reviewPos >= session.length) {
      body.innerHTML = `<p class="review-empty">복습 끝! 🎉<br>맞춘 문제 <b>${this.reviewRight} / ${session.length}</b><br><small style="opacity:.7">맞춘 문제는 목록에서 빠졌어요</small></p>`;
      this.updateReviewBadge();
      return;
    }
    const item = session[this.reviewPos];
    const choices = shuffleArr([...item.choices]);
    const isText = typeof item.answer !== 'number';
    body.innerHTML = `
      <div class="review-progress">${this.reviewPos + 1} / ${session.length}</div>
      <div class="review-q${String(item.text).length > 12 ? ' small' : ''}">${escapeText(item.text)}</div>
      <div class="review-choices">
        ${choices.map((c) => `<button class="choice${isText ? ' text' : ''}" data-c="${escapeAttr(c)}">${escapeText(c)}</button>`).join('')}
      </div>`;
    body.querySelectorAll('.choice').forEach((btn) => {
      btn.onclick = () => this.answerReview(item, btn.dataset.c, btn, body);
    });
  }

  answerReview(item, value, btn, body) {
    const buttons = [...body.querySelectorAll('.choice')];
    buttons.forEach((b) => (b.disabled = true));
    const correct = String(value) === String(item.answer);
    if (correct) {
      btn.classList.add('correct');
      sfx.correct();
      this.reviewRight++;
      // 맞히면 복습 목록에서 제거
      this.state.review = (this.state.review || []).filter((r) => r.key !== item.key);
      storage.save(this.state);
    } else {
      btn.classList.add('wrong');
      buttons.find((b) => String(b.dataset.c) === String(item.answer))?.classList.add('correct');
      sfx.wrong();
    }
    setTimeout(() => { this.reviewPos++; this.renderReviewCard(); }, correct ? 700 : 1300);
  }

  // ---- 단계 종합 시험 ----------------------------------------------------
  startExam() {
    this.inExam = true;
    this.examQs = this.engine.examPool(EXAM_N);
    this.examPos = 0; this.examScore = 0;
    $('catch-btn').classList.add('hidden');
    $('transform-btn').classList.add('hidden');
    $('exam-modal').classList.remove('hidden');
    sfx.levelup();
    this.renderExamCard();
  }

  renderExamCard() {
    const body = $('exam-body');
    if (this.examPos >= this.examQs.length) {
      const passed = this.examScore >= EXAM_PASS;
      body.innerHTML = `<div class="exam-result ${passed ? 'pass' : 'fail'}">
        <div class="exam-big">${passed ? '🎉 합격! 🎉' : '💪 다시 도전!'}</div>
        <div>맞은 개수 <b>${this.examScore} / ${this.examQs.length}</b></div>
        <p>${passed ? '다음 단계로 올라가요!' : `조금 더 연습한 뒤 다시 시험 볼 수 있어요. (${EXAM_PASS}개 이상 맞히면 합격)`}</p>
        <button class="close-btn exam-ok">${passed ? '좋아!' : '연습하러 가기'}</button>
      </div>`;
      body.querySelector('.exam-ok').onclick = () => this.finishExam(passed);
      return;
    }
    const item = this.examQs[this.examPos];
    const choices = shuffleArr([...item.choices]);
    const isText = typeof item.answer !== 'number';
    const qlen = String(item.text).length;
    const isClock = item.kind === 'clock';
    body.innerHTML = `
      <div class="exam-progress">시험 ${this.examPos + 1} / ${this.examQs.length} · 맞은 개수 ${this.examScore}</div>
      <div class="review-q${qlen > 34 ? ' tiny' : qlen > 12 ? ' small' : ''}">${escapeText(item.text)}</div>
      ${isClock ? '<canvas class="clock-canvas" width="200" height="200"></canvas>' : ''}
      <div class="review-choices">
        ${choices.map((c) => `<button class="choice${isText ? ' text' : ''}" data-c="${escapeAttr(c)}">${escapeText(c)}</button>`).join('')}
      </div>`;
    if (isClock) this.drawClock(body.querySelector('.clock-canvas'), item.clock);
    body.querySelectorAll('.choice').forEach((btn) => {
      btn.onclick = () => this.answerExam(item, btn.dataset.c, btn, body);
    });
  }

  answerExam(item, value, btn, body) {
    const buttons = [...body.querySelectorAll('.choice')];
    buttons.forEach((b) => (b.disabled = true));
    const correct = String(value) === String(item.answer);
    if (correct) { btn.classList.add('correct'); sfx.correct(); this.examScore++; }
    else { btn.classList.add('wrong'); buttons.find((b) => String(b.dataset.c) === String(item.answer))?.classList.add('correct'); sfx.wrong(); }
    setTimeout(() => { this.examPos++; this.renderExamCard(); }, correct ? 650 : 1100);
  }

  finishExam(passed) {
    this.inExam = false;
    $('exam-modal').classList.add('hidden');
    if (passed) {
      const promoted = this.engine.passExam();
      sfx.levelup();
      this.showMessage(promoted ? `🎉 ${promoted.toLabel} 단계로!` : '🎉 마지막 단계 통과! 졸업 시험 준비!', '#ffd23f', 2400);
      this.scene.screenShake(0.3, 0.45);
    } else {
      this.engine.failExam();
      this.showMessage('조금 더 연습하고 다시 도전하자! 💪', '#ff9a8a', 2200);
    }
    this.refreshTop();
    storage.save(this.state);
    setTimeout(() => this.nextQuestion(), 1700);
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
      const exam = this.engine.examWaiting && this.engine.examWaiting();
      $('stage-name').textContent = exam ? '📝 종합 시험!' : this.engine.currentSkill().label;
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

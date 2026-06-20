import { Game } from './game.js';
import { requireUnlock } from './gate.js';
import { chooseProfile } from './profile.js';
import * as storage from './storage.js';

window.addEventListener('DOMContentLoaded', () => {
  requireUnlock().then(async () => {
    storage.migrateLegacy();      // 예전 단일 세이브 → 기본 프로필로 이전(최초 1회)
    try { await storage.pullAll(); } catch {} // NAS 동기화(설정돼 있으면) — 실패해도 오프라인 진행
    chooseProfile().then(() => {  // 이름 + 캐릭터 선택/생성
      window.__game = new Game();
    });
  });
});

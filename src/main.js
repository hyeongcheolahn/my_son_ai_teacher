import { Game } from './game.js';
import { requireUnlock } from './gate.js';
import { chooseProfile } from './profile.js';
import * as storage from './storage.js';

// 항상 최신 버전을 받도록 서비스워커 등록(캐시로 옛 버전이 남는 문제 방지)
if ('serviceWorker' in navigator) {
  try { navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {}); } catch {}
}

// 브라우저에 "이 사이트 데이터는 지우지 말아 달라"고 요청(지원하는 브라우저에서만 효과, 실패해도 무해).
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch {}

// 아이폰/아이패드에서 '홈 화면 앱'이 아니라 사파리 탭으로 쓰는 중인지.
// 이 경우 한동안 안 쓰면 사파리가 저장 데이터를 지울 수 있어 설치 안내를 띄운다.
function isIOSBrowserTab() {
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  return ios && !standalone;
}

window.addEventListener('DOMContentLoaded', () => {
  try { if (isIOSBrowserTab()) document.getElementById('ios-tip')?.classList.remove('hidden'); } catch {}
  requireUnlock().then(async () => {
    storage.migrateLegacy();      // 예전 단일 세이브 → 기본 프로필로 이전(최초 1회)
    try { await storage.pullAll(); } catch {} // NAS 동기화(설정돼 있으면) — 실패해도 오프라인 진행
    storage.testSync().catch(() => {}); // 서버 기능(AI·음성) 사용 가능 여부 확인(캐시)
    chooseProfile().then(() => {  // 이름 + 캐릭터 선택/생성
      window.__game = new Game();
    });
  });
});

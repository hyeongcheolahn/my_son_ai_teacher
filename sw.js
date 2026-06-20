// 아주 단순한 "네트워크 우선" 서비스워커.
// 목적: 휴대폰 브라우저가 옛 버전을 캐시해 새 기능이 안 보이는 문제를 막는다.
// 같은 출처(우리 앱)의 파일은 브라우저 캐시를 건너뛰고 항상 새로 받는다.
// (앱은 어차피 온라인이 필요하므로 오프라인 캐시는 두지 않는다.)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return; // CDN(three.js 등)은 그대로 둔다
  // 브라우저 HTTP 캐시를 무시하고 새로 받는다(cache:'reload'). 실패 시에만 캐시 시도.
  e.respondWith(fetch(req, { cache: 'reload' }).catch(() => caches.match(req)));
});

// 간단한 비밀번호 잠금 화면.
// 가족만 들어오게 하기 위한 "가벼운" 보호 장치입니다.
// (소스를 분석하면 뚫을 수 있으므로 강력한 보안은 아니지만, 아이 학습 게임에는 충분합니다.)
//
// ▶ 비밀번호 바꾸는 법:
//   1) 브라우저에서 set-password.html 을 엽니다.
//   2) 원하는 비밀번호를 입력하면 해시값(긴 글자) 한 줄이 나옵니다.
//   3) 아래 PASSWORD_HASH 의 따옴표 안 값을 그 해시값으로 교체합니다.
//   4) 저장 후 커밋/푸시하면 끝.
const PASSWORD_HASH = '3bd58b042ebdb4bd806aeb3647cd0641a45ad34f8a022c373d958d23d787c5a2';

const STORAGE_KEY = 'mpb_unlocked';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 잠금 해제될 때까지 기다리는 Promise 를 돌려준다.
export function requireUnlock() {
  // 이미 이 기기에서 올바른 비밀번호로 해제한 적이 있으면 통과.
  if (localStorage.getItem(STORAGE_KEY) === PASSWORD_HASH) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'gate-overlay';
    overlay.innerHTML = `
      <div class="gate-box">
        <div class="gate-emoji">🔒</div>
        <h1>수학 포켓 배틀</h1>
        <p>비밀번호를 입력해 주세요</p>
        <input id="gate-input" type="password" inputmode="numeric"
               autocomplete="off" placeholder="비밀번호" />
        <button id="gate-btn">들어가기</button>
        <div id="gate-error"></div>
        <button id="gate-sync" type="button">☁️ 동기화 설정</button>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #gate-overlay{position:fixed;inset:0;z-index:99999;display:flex;
        align-items:center;justify-content:center;
        background:linear-gradient(160deg,#1b2a4a,#0d1530);
        font-family:system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;}
      #gate-overlay .gate-box{background:#fff;border-radius:20px;padding:32px 28px;
        width:min(86vw,340px);text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4);}
      #gate-overlay .gate-emoji{font-size:48px;margin-bottom:8px;}
      #gate-overlay h1{font-size:20px;margin:0 0 6px;color:#1b2a4a;}
      #gate-overlay p{font-size:14px;color:#667;margin:0 0 18px;}
      #gate-overlay input{width:100%;box-sizing:border-box;padding:14px;font-size:18px;
        text-align:center;border:2px solid #cdd6e6;border-radius:12px;outline:none;
        letter-spacing:2px;margin-bottom:12px;}
      #gate-overlay input:focus{border-color:#3b6cff;}
      #gate-overlay button{width:100%;padding:14px;font-size:17px;font-weight:700;
        color:#fff;background:#3b6cff;border:none;border-radius:12px;cursor:pointer;}
      #gate-overlay button:active{transform:scale(.98);}
      #gate-overlay #gate-error{min-height:20px;margin-top:10px;color:#e34;font-size:13px;}
      #gate-overlay #gate-sync{margin-top:12px;background:none;border:none;color:#9fb3e0;
        font-size:13px;text-decoration:underline;cursor:pointer;padding:4px;width:auto;}
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#gate-input');
    const btn = overlay.querySelector('#gate-btn');
    const errorEl = overlay.querySelector('#gate-error');
    input.focus();

    async function tryUnlock() {
      const hash = await sha256(input.value);
      if (hash === PASSWORD_HASH) {
        localStorage.setItem(STORAGE_KEY, PASSWORD_HASH);
        overlay.remove();
        style.remove();
        resolve();
      } else {
        errorEl.textContent = '비밀번호가 달라요. 다시 시도해 주세요.';
        input.value = '';
        input.focus();
      }
    }

    btn.addEventListener('click', tryUnlock);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') tryUnlock();
    });

    // 새 기기에서 NAS 동기화를 미리 설정(프로필을 받아오려면 들어가기 전에 필요)
    overlay.querySelector('#gate-sync').addEventListener('click', () => {
      const cur = localStorage.getItem('sync_url') || '';
      const url = prompt('NAS 서버 주소 (https://...)\n비우면 동기화 끄기', cur);
      if (url === null) return;
      const token = prompt('앱 토큰(APP_TOKEN)', localStorage.getItem('sync_token') || '') || '';
      if (url.trim()) localStorage.setItem('sync_url', url.trim().replace(/\/+$/, ''));
      else localStorage.removeItem('sync_url');
      localStorage.setItem('sync_token', token.trim());
      errorEl.textContent = url.trim() ? '동기화 설정 저장됨. 들어가기를 누르면 동기화돼요.' : '동기화를 껐어요.';
    });
  });
}

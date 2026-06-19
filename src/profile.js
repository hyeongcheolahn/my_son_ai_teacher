// 프로필 선택/생성 화면.
// 여러 사용자(가족)가 각자 이름 + 이모지 아바타로 진행도를 따로 저장한다.
import * as storage from './storage.js';
import { sfx } from './audio.js';

export const AVATARS = ['🦊', '🐱', '🐶', '🐰', '🐻', '🐼', '🐯', '🦁', '🐸', '🐵', '🦄', '🐲', '🐧', '🐢', '🦖', '🐙'];

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    #profile-overlay{position:fixed;inset:0;z-index:9000;display:flex;
      align-items:center;justify-content:center;padding:20px;box-sizing:border-box;
      background:linear-gradient(160deg,#1b2a4a,#0d1530);
      font-family:system-ui,-apple-system,"Apple SD Gothic Neo",sans-serif;color:#fff;}
    #profile-overlay .pf-box{background:#fff;color:#1b2a4a;border-radius:22px;
      padding:26px 22px;width:min(92vw,420px);max-height:88vh;overflow-y:auto;
      text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.45);}
    #profile-overlay h1{font-size:21px;margin:0 0 4px;}
    #profile-overlay p.sub{font-size:14px;color:#667;margin:0 0 18px;}
    #profile-overlay .pf-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:14px;}
    #profile-overlay .pf-card{position:relative;background:#f1f5fc;border:2px solid #e2e9f5;
      border-radius:16px;padding:16px 8px;cursor:pointer;transition:.12s;}
    #profile-overlay .pf-card:active{transform:scale(.97);}
    #profile-overlay .pf-card .av{font-size:42px;line-height:1;}
    #profile-overlay .pf-card .nm{margin-top:8px;font-size:15px;font-weight:700;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    #profile-overlay .pf-del{position:absolute;top:4px;right:6px;width:24px;height:24px;
      border:none;border-radius:50%;background:#ffd6dd;color:#c0263e;font-size:14px;
      line-height:24px;cursor:pointer;padding:0;}
    #profile-overlay .pf-add{background:#eaf7ee;border:2px dashed #9ad6ad;color:#2a8a52;}
    #profile-overlay .pf-add .av{font-size:34px;}
    #profile-overlay .big-btn{width:100%;padding:15px;font-size:17px;font-weight:800;
      color:#fff;background:#3b6cff;border:none;border-radius:14px;cursor:pointer;margin-top:6px;}
    #profile-overlay .big-btn:disabled{background:#b9c6e3;}
    #profile-overlay .big-btn:active{transform:scale(.99);}
    #profile-overlay .name-input{width:100%;box-sizing:border-box;padding:14px;font-size:18px;
      text-align:center;border:2px solid #cdd6e6;border-radius:12px;outline:none;margin-bottom:16px;}
    #profile-overlay .name-input:focus{border-color:#3b6cff;}
    #profile-overlay .av-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;}
    #profile-overlay .av-cell{font-size:30px;padding:10px 0;border:2px solid #e2e9f5;
      background:#f7f9fd;border-radius:14px;cursor:pointer;}
    #profile-overlay .av-cell.sel{border-color:#3b6cff;background:#e7eeff;transform:scale(1.05);}
    #profile-overlay .link{background:none;border:none;color:#3b6cff;font-size:14px;
      cursor:pointer;margin-top:12px;text-decoration:underline;}
  `;
  document.head.appendChild(style);
}

// 활성 프로필이 정해질 때까지 화면을 띄우고, 정해지면 resolve.
export function chooseProfile() {
  injectStyles();
  const overlay = document.createElement('div');
  overlay.id = 'profile-overlay';
  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    const finish = (id) => {
      storage.setActiveProfile(id);
      overlay.remove();
      resolve();
    };

    function renderSelect() {
      const profiles = storage.listProfiles();
      if (profiles.length === 0) { renderCreate(true); return; }
      const cards = profiles.map((p) => `
        <div class="pf-card" data-id="${p.id}">
          <button class="pf-del" data-del="${p.id}" title="삭제">✕</button>
          <div class="av">${p.avatar}</div>
          <div class="nm">${escapeHtml(p.name)}</div>
        </div>`).join('');
      overlay.innerHTML = `
        <div class="pf-box">
          <h1>누구야? 👋</h1>
          <p class="sub">친구를 골라줘</p>
          <div class="pf-grid">
            ${cards}
            <div class="pf-card pf-add" data-add="1">
              <div class="av">➕</div>
              <div class="nm">새 친구</div>
            </div>
          </div>
        </div>`;
      overlay.querySelectorAll('.pf-card[data-id]').forEach((el) => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.pf-del')) return;
          sfx.tap();
          finish(el.dataset.id);
        });
      });
      overlay.querySelector('[data-add]').addEventListener('click', () => { sfx.tap(); renderCreate(false); });
      overlay.querySelectorAll('[data-del]').forEach((b) => {
        b.addEventListener('click', () => {
          const p = storage.listProfiles().find((x) => x.id === b.dataset.del);
          if (p && confirm(`'${p.name}' 친구를 삭제할까요?\n진행도가 모두 사라져요.`)) {
            storage.deleteProfile(b.dataset.del);
            renderSelect();
          }
        });
      });
    }

    function renderCreate(first) {
      let sel = AVATARS[0];
      const avCells = AVATARS.map((a) => `<button class="av-cell${a === sel ? ' sel' : ''}" data-av="${a}">${a}</button>`).join('');
      overlay.innerHTML = `
        <div class="pf-box">
          <h1>${first ? '환영해! 🎉' : '새 친구 만들기'}</h1>
          <p class="sub">이름을 알려줘</p>
          <input class="name-input" id="pf-name" type="text" maxlength="12" placeholder="이름 (예: 지호)" autocomplete="off" />
          <p class="sub" style="margin-bottom:8px">캐릭터를 골라줘</p>
          <div class="av-grid">${avCells}</div>
          <button class="big-btn" id="pf-start" disabled>시작! 🚀</button>
          ${first ? '' : '<button class="link" id="pf-back">← 뒤로</button>'}
        </div>`;
      const nameEl = overlay.querySelector('#pf-name');
      const startBtn = overlay.querySelector('#pf-start');
      const updateBtn = () => { startBtn.disabled = nameEl.value.trim().length === 0; };
      nameEl.addEventListener('input', updateBtn);
      overlay.querySelectorAll('[data-av]').forEach((b) => {
        b.addEventListener('click', () => {
          sel = b.dataset.av;
          overlay.querySelectorAll('.av-cell').forEach((c) => c.classList.toggle('sel', c === b));
        });
      });
      startBtn.addEventListener('click', () => {
        const name = nameEl.value.trim();
        if (!name) return;
        sfx.tap();
        const profile = storage.createProfile(name, sel);
        finish(profile.id);
      });
      const back = overlay.querySelector('#pf-back');
      if (back) back.addEventListener('click', () => { sfx.tap(); renderSelect(); });
      nameEl.focus();
    }

    renderSelect();
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

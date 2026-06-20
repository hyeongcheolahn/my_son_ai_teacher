// 자이로/가속도 센서로 "던지는 모션" 감지.
// iOS 13+ 는 사용자 제스처 안에서 DeviceMotionEvent.requestPermission() 으로 허락을 받아야 한다.
// 센서가 없거나 거부되면 버튼(폴백)으로 던질 수 있다.

let listening = false;
let cb = null;
let lastTrigger = 0;
let granted = false;

const THRESHOLD = 18; // 던지기로 판정할 순간 가속도(m/s²) — 휙 휘두르면 넘는다
const COOLDOWN = 1200; // 한 번 던진 뒤 재인식 방지(ms)

export function hasMotion() {
  return typeof window !== 'undefined' && typeof window.DeviceMotionEvent !== 'undefined';
}

// 사용자 제스처(예: 시작 버튼) 안에서 호출해야 iOS에서 허락 창이 뜬다.
export async function requestMotionPermission() {
  if (!hasMotion()) return false;
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const res = await DeviceMotionEvent.requestPermission();
      granted = res === 'granted';
      return granted;
    }
  } catch { return false; }
  granted = true; // 안드로이드/데스크톱: 권한 절차 없음
  return true;
}

export function motionGranted() { return granted; }

function onMotion(e) {
  let mag;
  const a = e.acceleration;
  if (a && (a.x != null || a.y != null || a.z != null)) {
    mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0); // 중력 제외 순수 가속도
  } else {
    const g = e.accelerationIncludingGravity;
    if (!g) return;
    mag = Math.abs(Math.hypot(g.x || 0, g.y || 0, g.z || 0) - 9.81);
  }
  const now = Date.now();
  if (mag > THRESHOLD && now - lastTrigger > COOLDOWN) {
    lastTrigger = now;
    const f = cb;
    if (f) f();
  }
}

// 던지기 모션 대기 시작. 모션 감지 시 callback 실행.
export function armThrow(callback) {
  cb = callback;
  if (!listening && hasMotion()) {
    window.addEventListener('devicemotion', onMotion);
    listening = true;
  }
}

export function disarmThrow() {
  cb = null;
}

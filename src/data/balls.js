// 포켓볼 종류. 던질 때마다 weight에 따라 랜덤 선택되고, rate가 포획률 배율.
// top/accent = 3D 볼 색(윗부분/버튼).
export const BALL_TYPES = [
  { id: 'poke',   name: '몬스터볼', top: 0xee3b3b, accent: 0x888888, rate: 1.0, weight: 50 },
  { id: 'great',  name: '슈퍼볼',   top: 0x2f6bd6, accent: 0xe03b3b, rate: 1.5, weight: 28 },
  { id: 'ultra',  name: '하이퍼볼', top: 0xf2b01e, accent: 0x222222, rate: 2.2, weight: 16 },
  { id: 'master', name: '마스터볼', top: 0x7b3fd6, accent: 0xe85aa0, rate: 99,  weight: 6  },
];

export function pickBall(rng = Math.random) {
  const total = BALL_TYPES.reduce((a, b) => a + b.weight, 0);
  let r = rng() * total;
  for (const b of BALL_TYPES) { if ((r -= b.weight) < 0) return b; }
  return BALL_TYPES[0];
}

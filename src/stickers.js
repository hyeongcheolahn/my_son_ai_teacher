// 스티커 앨범: 활동 보상으로 이모지 스티커를 모은다. 순수 수집(꾸미기) 요소.
// state.stickers = { stickerId: 개수 }
export const STICKERS = [
  // 흔함(자주 나옴)
  { id: 'star', emoji: '⭐', name: '반짝별', rarity: 'common' },
  { id: 'apple', emoji: '🍎', name: '사과', rarity: 'common' },
  { id: 'strawberry', emoji: '🍓', name: '딸기', rarity: 'common' },
  { id: 'cookie', emoji: '🍪', name: '쿠키', rarity: 'common' },
  { id: 'balloon', emoji: '🎈', name: '풍선', rarity: 'common' },
  { id: 'leaf', emoji: '🍀', name: '네잎클로버', rarity: 'common' },
  { id: 'sun', emoji: '☀️', name: '햇님', rarity: 'common' },
  { id: 'flower', emoji: '🌼', name: '들꽃', rarity: 'common' },
  // 조금 귀함
  { id: 'rainbow', emoji: '🌈', name: '무지개', rarity: 'rare' },
  { id: 'gift', emoji: '🎁', name: '선물', rarity: 'rare' },
  { id: 'fox', emoji: '🦊', name: '여우', rarity: 'rare' },
  { id: 'turtle', emoji: '🐢', name: '거북이', rarity: 'rare' },
  { id: 'rocket', emoji: '🚀', name: '로켓', rarity: 'rare' },
  { id: 'medal', emoji: '🏅', name: '메달', rarity: 'rare' },
  { id: 'moon', emoji: '🌙', name: '초승달', rarity: 'rare' },
  // 매우 귀함
  { id: 'unicorn', emoji: '🦄', name: '유니콘', rarity: 'epic' },
  { id: 'dragon', emoji: '🐉', name: '드래곤', rarity: 'epic' },
  { id: 'crown', emoji: '👑', name: '왕관', rarity: 'epic' },
  { id: 'wand', emoji: '🪄', name: '요술봉', rarity: 'epic' },
  // 전설(아주 드뭄)
  { id: 'trophy', emoji: '🏆', name: '황금트로피', rarity: 'legend' },
  { id: 'gem', emoji: '💎', name: '보석', rarity: 'legend' },
];

const RARITY = {
  common: { weight: 60, color: '#9fb3e0', label: '흔함' },
  rare: { weight: 28, color: '#5fc44a', label: '귀함' },
  epic: { weight: 10, color: '#b15ab1', label: '매우 귀함' },
  legend: { weight: 2, color: '#ffd23f', label: '전설' },
};
export const rarityColor = (r) => (RARITY[r] || RARITY.common).color;
export const rarityLabel = (r) => (RARITY[r] || RARITY.common).label;
export const stickerById = (id) => STICKERS.find((s) => s.id === id) || null;

// 희귀도 가중치로 스티커 한 장 뽑기. luck>1 이면 귀한 게 더 잘 나옴.
export function drawSticker(rng = Math.random, luck = 1) {
  const pool = STICKERS.map((s) => ({ s, w: (RARITY[s.rarity] || RARITY.common).weight * (s.rarity === 'common' ? 1 : luck) }));
  const total = pool.reduce((a, p) => a + p.w, 0);
  let r = rng() * total;
  for (const p of pool) { r -= p.w; if (r <= 0) return p.s; }
  return pool[0].s;
}

export function addSticker(state, id) {
  if (!state.stickers) state.stickers = {};
  state.stickers[id] = (state.stickers[id] || 0) + 1;
}

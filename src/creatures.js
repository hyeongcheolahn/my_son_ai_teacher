// 실제 포켓몬 지방 데이터 위의 API 레이어.
// 외형은 절차적 스타일라이즈드 3D로 근사(공식 모델 미포함).
import { REGIONS } from './data/regions.js';

export const SUBJECTS = [
  { key: 'math', label: '수학', region: '관동', emoji: '➕' },
  { key: 'english', label: '영어', region: '칼로스', emoji: '🔤' },
  { key: 'hanja', label: '한자', region: '성도', emoji: '㐀' },
  { key: 'science', label: '과학', region: '호연', emoji: '🔬' },
];

// 18타입 색상(파티클·뱃지) + 한국어 라벨
export const TYPE_META = {
  normal: { color: '#c7b8a1', label: '노말' },
  fire: { color: '#ff6b35', label: '불꽃' },
  water: { color: '#3b9eff', label: '물' },
  grass: { color: '#5fc44a', label: '풀' },
  electric: { color: '#ffd23f', label: '전기' },
  ice: { color: '#7fe3e0', label: '얼음' },
  rock: { color: '#b9956a', label: '바위' },
  ground: { color: '#e0c068', label: '땅' },
  flying: { color: '#a890f0', label: '비행' },
  bug: { color: '#9fb820', label: '벌레' },
  poison: { color: '#b15ab1', label: '독' },
  fighting: { color: '#d04a3c', label: '격투' },
  psychic: { color: '#f85888', label: '에스퍼' },
  ghost: { color: '#8a78c0', label: '고스트' },
  dragon: { color: '#8a5cf8', label: '드래곤' },
  dark: { color: '#7d6b9e', label: '악' },
  steel: { color: '#b8b8d0', label: '강철' },
  fairy: { color: '#ee99ac', label: '페어리' },
};

export const TYPE_COLORS = Object.fromEntries(Object.entries(TYPE_META).map(([k, v]) => [k, v.color]));
export const typeLabel = (t) => (TYPE_META[t] || TYPE_META.normal).label;
export const typeColor = (t) => (TYPE_META[t] || TYPE_META.normal).color;

// 타입 상성표(공격 타입 → 효과가 강한/약한 방어 타입). 표준 포켓몬 상성 기반.
const SUPER = {
  fire: ['grass', 'ice', 'bug', 'steel'],
  water: ['fire', 'ground', 'rock'],
  grass: ['water', 'ground', 'rock'],
  electric: ['water', 'flying'],
  ice: ['grass', 'ground', 'flying', 'dragon'],
  fighting: ['normal', 'ice', 'rock', 'dark', 'steel'],
  poison: ['grass', 'fairy'],
  ground: ['fire', 'electric', 'poison', 'rock', 'steel'],
  flying: ['grass', 'fighting', 'bug'],
  psychic: ['fighting', 'poison'],
  bug: ['grass', 'psychic', 'dark'],
  rock: ['fire', 'ice', 'flying', 'bug'],
  ghost: ['psychic', 'ghost'],
  dragon: ['dragon'],
  dark: ['psychic', 'ghost'],
  steel: ['ice', 'rock', 'fairy'],
  fairy: ['fighting', 'dragon', 'dark'],
};
const NOT_VERY = {
  normal: ['rock', 'steel', 'ghost'],
  fire: ['fire', 'water', 'rock', 'dragon'],
  water: ['water', 'grass', 'dragon'],
  grass: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'],
  electric: ['electric', 'grass', 'dragon', 'ground'],
  ice: ['fire', 'water', 'ice', 'steel'],
  fighting: ['poison', 'flying', 'psychic', 'bug', 'fairy', 'ghost'],
  poison: ['poison', 'ground', 'rock', 'ghost', 'steel'],
  ground: ['grass', 'bug', 'flying'],
  flying: ['electric', 'rock', 'steel'],
  psychic: ['psychic', 'steel', 'dark'],
  bug: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'],
  rock: ['fighting', 'ground', 'steel'],
  ghost: ['dark', 'normal'],
  dragon: ['steel', 'fairy'],
  dark: ['fighting', 'dark', 'fairy'],
  steel: ['fire', 'water', 'electric', 'steel'],
  fairy: ['fire', 'poison', 'steel'],
};

// 공격 효과 배율: 강함 2 / 보통 1 / 약함 0.5. (면역은 아이가 막히지 않도록 0.5로 완화)
export function effectiveness(atk, def) {
  if ((SUPER[atk] || []).includes(def)) return 2;
  if ((NOT_VERY[atk] || []).includes(def)) return 0.5;
  return 1;
}
export function effectivenessLabel(mult) {
  if (mult >= 2) return { text: '효과가 굉장했다! 💥', color: '#ffd23f' };
  if (mult <= 0.5) return { text: '효과가 별로인 것 같다…', color: '#9fb3e0' };
  return null;
}

// 최종진화 이후 초진화 폼(메가/거다이맥스). art = PokéAPI 폼 아트워크 번호(검증됨).
export const SUPERFORMS = {
  venusaur:  { mega: { art: 10033, name: '메가 이상해꽃' }, gmax: { art: 10195, name: '거다이맥스 이상해꽃' } },
  charizard: { mega: { art: 10034, name: '메가 리자몽' },   gmax: { art: 10196, name: '거다이맥스 리자몽' } },
  blastoise: { mega: { art: 10036, name: '메가 거북왕' },   gmax: { art: 10197, name: '거다이맥스 거북왕' } },
  ampharos:  { mega: { art: 10045, name: '메가 전룡' } },
  blaziken:  { mega: { art: 10050, name: '메가 번치코' } },
  gardevoir: { mega: { art: 10051, name: '메가 가디안' } },
  swampert:  { mega: { art: 10064, name: '메가 대짱이' } },
  sceptile:  { mega: { art: 10065, name: '메가 나무킹' } },
};
export function superForm(speciesId, kind) {
  const s = SUPERFORMS[speciesId];
  return s ? s[kind] || null : null;
}

const STAGE_SCALE = { 1: 0.95, 2: 1.12, 3: 1.3 };
const STAGE_ENERGY = { 1: 90, 2: 120, 3: 160 };

// 데이터 항목 → 게임/씬이 쓰는 def 형태로 정규화
function toDef(item, subject, opts = {}) {
  const stage = item.stage || 1;
  return {
    id: item.id,
    name: item.ko,
    en: item.en,
    type: item.type,
    colors: { body: item.colors.body, belly: item.colors.belly, accent: item.colors.accent },
    features: item.features || [],
    stage,
    evolvesToId: item.evolvesToId || null,
    subject,
    isLegendary: !!opts.legendary,
    scale: opts.legendary ? 1.5 : (STAGE_SCALE[stage] || 1),
    catchEnergy: opts.legendary ? 280 : (STAGE_ENERGY[stage] || 100),
  };
}

export function getRegion(subject) { return REGIONS[subject]; }

export function getCreatureDef(subject, id) {
  const r = REGIONS[subject];
  if (!r) return null;
  if (r.legendary.id === id) return toDef(r.legendary, subject, { legendary: true });
  const w = r.wild.find((x) => x.id === id);
  return w ? toDef(w, subject) : null;
}

export function findDefAnywhere(id) {
  for (const sub of Object.keys(REGIONS)) {
    const d = getCreatureDef(sub, id);
    if (d) return d;
  }
  return null;
}

export function starterDef(subject) {
  return getCreatureDef(subject, REGIONS[subject].starterId);
}

export function legendaryDef(subject) {
  return toDef(REGIONS[subject].legendary, subject, { legendary: true });
}

// 야생 등장: 기본형(1단계) 위주로(잡아서 진화시키는 재미)
export function pickWildDef(subject, rng = Math.random) {
  const wild = REGIONS[subject].wild;
  const base = wild.filter((w) => (w.stage || 1) === 1);
  const pool = rng() < 0.75 && base.length ? base : wild;
  return toDef(pool[Math.floor(rng() * pool.length)], subject);
}

// 진화형 def (없으면 null)
export function evolveDef(subject, id) {
  const d = getCreatureDef(subject, id);
  if (!d || !d.evolvesToId) return null;
  return getCreatureDef(subject, d.evolvesToId);
}

// 도감용: 그 지방 전체(야생 + 전설)
export function allDexDefs(subject) {
  const r = REGIONS[subject];
  return [...r.wild.map((w) => toDef(w, subject)), legendaryDef(subject)];
}

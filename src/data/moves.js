// 타입별 기술 풀(각 2~3개). 공격마다 랜덤으로 하나 골라 이름 표시 + 연출.
// style: stream(투사체)/burst(작렬)/beam(빔)/lightning(번개)/orbs(에스퍼)/tackle(돌진)
// geo: 색·파티클 모양에 쓰는 타입 키.
export const MOVES = {
  fire: [
    { name: '불꽃세례', style: 'stream', geo: 'fire', count: 22, arc: 0.5, spin: 3, scale: 1.1 },
    { name: '화염방사', style: 'stream', geo: 'fire', count: 34, arc: 0.22, spin: 2, scale: 1.3, straight: true },
    { name: '불대문자', fx: 'kanji', glyph: '大', geo: 'fire' },
  ],
  water: [
    { name: '물대포', style: 'stream', geo: 'water', count: 24, scale: 1.1, straight: true },
    { name: '거품광선', style: 'stream', geo: 'water', count: 22, arc: 0.4, spin: 4 },
    { name: '하이드로펌프', fx: 'twin', geo: 'water' },
  ],
  grass: [
    { name: '잎날가르기', style: 'stream', geo: 'grass', count: 24, arc: 0.8, spin: 14, swirl: true },
    { name: '씨앗폭탄', style: 'burst', geo: 'grass', count: 22 },
    { name: '솔라빔', style: 'beam', geo: 'grass' },
  ],
  electric: [
    { name: '전기쇼크', style: 'stream', geo: 'electric', count: 16, arc: 0.5 },
    { name: '10만볼트', style: 'lightning', geo: 'electric' },
    { name: '번개', fx: 'kanji', glyph: '雷', geo: 'electric' },
  ],
  ice: [
    { name: '얼음뭉치', style: 'stream', geo: 'ice', count: 18, arc: 0.5 },
    { name: '냉동빔', style: 'beam', geo: 'ice' },
  ],
  psychic: [
    { name: '염동력', style: 'stream', geo: 'psychic', count: 16, arc: 0.6 },
    { name: '사이코키네시스', style: 'orbs', geo: 'psychic' },
    { name: '사이코쇼크', style: 'beam', geo: 'psychic' },
  ],
  dragon: [
    { name: '용의숨결', style: 'stream', geo: 'dragon', count: 22, arc: 0.3, straight: true },
    { name: '드래곤클로', style: 'burst', geo: 'dragon', count: 24 },
    { name: '역린', style: 'beam', geo: 'dragon' },
  ],
  normal: [
    { name: '몸통박치기', style: 'tackle', geo: 'normal' },
    { name: '할퀴기', style: 'stream', geo: 'normal', count: 8, arc: 0.25, straight: true, scale: 0.9 },
    { name: '덤벼들기', style: 'tackle', geo: 'normal' },
  ],
  bug: [
    { name: '벌레의저항', style: 'stream', geo: 'bug', count: 18, arc: 0.6, spin: 8 },
    { name: '시저크로스', style: 'burst', geo: 'bug', count: 20 },
  ],
  rock: [
    { name: '스톤샤워', style: 'stream', geo: 'rock', count: 18, arc: 0.7, spin: 7 },
    { name: '락블레스트', style: 'burst', geo: 'rock', count: 22 },
  ],
  ground: [
    { name: '진흙뿌리기', style: 'stream', geo: 'ground', count: 18, arc: 0.6 },
    { name: '땅고르기', style: 'burst', geo: 'ground', count: 22 },
  ],
  flying: [
    { name: '에어슬래시', style: 'stream', geo: 'flying', count: 16, arc: 0.3, straight: true },
    { name: '브레이브버드', style: 'tackle', geo: 'flying' },
  ],
  poison: [
    { name: '독찌르기', style: 'stream', geo: 'poison', count: 16, arc: 0.4 },
    { name: '오물폭탄', style: 'burst', geo: 'poison', count: 22 },
  ],
  fighting: [
    { name: '안다리걸기', style: 'tackle', geo: 'fighting' },
    { name: '인파이트', style: 'burst', geo: 'fighting', count: 22 },
  ],
  ghost: [
    { name: '섀도볼', style: 'stream', geo: 'ghost', count: 16, arc: 0.5, spin: 5 },
    { name: '그림자펀치', style: 'tackle', geo: 'ghost' },
  ],
  dark: [
    { name: '깨물어부수기', style: 'tackle', geo: 'dark' },
    { name: '악의파동', style: 'stream', geo: 'dark', count: 18, arc: 0.5 },
  ],
  steel: [
    { name: '메탈클로', style: 'tackle', geo: 'steel' },
    { name: '러스터캐넌', style: 'beam', geo: 'steel' },
  ],
  fairy: [
    { name: '페어리윈드', style: 'stream', geo: 'fairy', count: 18, arc: 0.7, spin: 6, swirl: true },
    { name: '문포스', style: 'burst', geo: 'fairy', count: 22 },
  ],
};

export function pickMove(type, rng = Math.random) {
  const pool = MOVES[type] || MOVES.normal;
  return pool[Math.floor(rng() * pool.length)];
}

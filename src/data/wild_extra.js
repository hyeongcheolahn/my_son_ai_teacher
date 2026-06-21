// 추가 출현(야생) 포켓몬 — 지방별로 더 다양하게.
// 그림은 dex.js의 DEX 번호로 PokeAPI에서 자동 로드. 3D 모델은 colors로 근사.
// 모두 단독(진화 안 함, evolvesToId:null, stage:1)으로 추가해 안전하게.
const w = (id, ko, en, type, body, belly, accent, features = []) =>
  ({ id, ko, en, type, stage: 1, evolvesToId: null, colors: { body, belly, accent }, features });

export const EXTRA_WILD = {
  math: [ // 관동
    w('rattata', '꼬렛', 'Rattata', 'normal', '#9b7cb0', '#e6d8ee', '#c0392b'),
    w('pidgey', '구구', 'Pidgey', 'normal', '#c0a060', '#f0e0b0', '#a06030', ['wings']),
    w('meowth', '나옹', 'Meowth', 'normal', '#e8d8a0', '#f5ecc8', '#d4a017'),
    w('machop', '알통몬', 'Machop', 'fighting', '#9fb0c0', '#cdd6df', '#6a7a8a'),
    w('geodude', '꼬마돌', 'Geodude', 'rock', '#8a8a7a', '#a3a392', '#6a6a5a'),
    w('gastly', '고오스', 'Gastly', 'ghost', '#5a4a7a', '#6f5d92', '#241636', ['ghost']),
    w('magikarp', '잉어킹', 'Magikarp', 'water', '#e8503c', '#f0c040', '#c0392b'),
    w('snorlax', '잠만보', 'Snorlax', 'normal', '#3a5a6a', '#e8e0c0', '#27384a'),
  ],
  english: [ // 칼로스
    w('litleo', '레오꼬', 'Litleo', 'fire', '#d4a017', '#f0d878', '#c0392b'),
    w('pancham', '판짱', 'Pancham', 'fighting', '#3a3a4a', '#f0f0f0', '#5a8a3a'),
    w('espurr', '냐스퍼', 'Espurr', 'psychic', '#c0c0c8', '#e2e2ea', '#8a4a8a'),
    w('sylveon', '님피아', 'Sylveon', 'fairy', '#f0c0d0', '#f8e8f0', '#6ab0c0'),
    w('noibat', '음뱃', 'Noibat', 'flying', '#5a3a6a', '#d4b04a', '#332444', ['wings']),
    w('skiddo', '고고트', 'Skiddo', 'grass', '#b0a070', '#d8c890', '#5a8a3a', ['hornSmall']),
    w('furfrou', '트리미앙', 'Furfrou', 'normal', '#e8e0d0', '#f5f0e8', '#b0a090'),
    w('flabebe', '플라베베', 'Flabébé', 'fairy', '#f0d020', '#f8e870', '#e07090'),
  ],
  hanja: [ // 성도
    w('wooper', '우파', 'Wooper', 'water', '#4a90c0', '#bcd4e6', '#2a6a9a'),
    w('sentret', '꼬리선', 'Sentret', 'normal', '#c0a060', '#f0e0b0', '#a04030'),
    w('sneasel', '포푸니', 'Sneasel', 'dark', '#4a5a7a', '#c04050', '#2a3a5a'),
    w('teddiursa', '깜지곰', 'Teddiursa', 'normal', '#d4a040', '#f0d890', '#8a5a2a'),
    w('houndour', '델빌', 'Houndour', 'dark', '#2a2a3a', '#c04030', '#d4a040'),
    w('phanpy', '코코리', 'Phanpy', 'ground', '#5aa0d0', '#c0d6e6', '#e07090'),
    w('togepi', '토게피', 'Togepi', 'fairy', '#f5f0e0', '#f8f4ea', '#e07060'),
    w('slugma', '마그마그', 'Slugma', 'fire', '#d4502a', '#f0a040', '#a02a1a'),
  ],
  science: [ // 호연
    w('poochyena', '포챠나', 'Poochyena', 'dark', '#6a6a7a', '#8c8c9c', '#c04030'),
    w('wingull', '갈모매', 'Wingull', 'water', '#f0f0f5', '#f8f8fc', '#3a7ac0', ['wings']),
    w('aron', '가보리', 'Aron', 'steel', '#8a8a9a', '#a0a0b0', '#c0c0d0'),
    w('electrike', '썬더라이', 'Electrike', 'electric', '#5a8a3a', '#d4d040', '#e0c030'),
    w('numel', '둔타', 'Numel', 'fire', '#d4a040', '#e8c870', '#c0502a'),
    w('spheal', '대굴레오', 'Spheal', 'ice', '#4a90c0', '#c8e0f0', '#2a6a9a'),
    w('bagon', '아공이', 'Bagon', 'dragon', '#4a6a9a', '#c0c0d0', '#c04030', ['hornSmall']),
    w('shroomish', '버섯꼬', 'Shroomish', 'grass', '#d8c890', '#f0e8c0', '#5a8a3a'),
  ],
};

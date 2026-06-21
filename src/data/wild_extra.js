// 추가 출현(야생) 포켓몬 — 지방별로 대폭 다양화.
// 형식: [전국도감번호, 한국이름, 영문, 타입].  색은 타입에서 자동 생성, 그림은 PokeAPI 자동 로드.
// 모두 단독(진화 안 함)으로 추가 → 안전. 기존 야생과 같은 종은 자동 중복 제거됨.
import { DEX } from './dex.js';

const TYPE_COLOR = {
  normal: '#c7b8a1', fire: '#ff6b35', water: '#3b9eff', grass: '#5fc44a', electric: '#ffd23f',
  ice: '#7fe3e0', rock: '#b9956a', ground: '#e0c068', flying: '#a890f0', bug: '#9fb820',
  poison: '#b15ab1', fighting: '#d04a3c', psychic: '#f85888', ghost: '#8a78c0', dragon: '#8a5cf8',
  dark: '#7d6b9e', steel: '#b8b8d0', fairy: '#ee99ac',
};
function adjust(hex, f) { // f>0 밝게, f<0 어둡게
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const ch = (c) => Math.max(0, Math.min(255, Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f))));
  return '#' + [ch(r), ch(g), ch(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function build(list) {
  return list.map(([dex, ko, en, type]) => {
    const id = en.toLowerCase().replace(/[^a-z0-9]/g, '');
    DEX[id] = dex; // 그림(PokeAPI) 번호 등록
    const body = TYPE_COLOR[type] || '#c7b8a1';
    return { id, ko, en, type, stage: 1, evolvesToId: null, colors: { body, belly: adjust(body, 0.5), accent: adjust(body, -0.35) }, features: [] };
  });
}

// 관동(math) — 1세대
const KANTO = [
  [10, '캐터피', 'Caterpie', 'bug'], [13, '뿔충이', 'Weedle', 'bug'], [16, '구구', 'Pidgey', 'normal'],
  [19, '꼬렛', 'Rattata', 'normal'], [21, '깨비참', 'Spearow', 'flying'], [23, '아보', 'Ekans', 'poison'],
  [27, '모래두지', 'Sandshrew', 'ground'], [37, '식스테일', 'Vulpix', 'fire'], [41, '주뱃', 'Zubat', 'poison'],
  [43, '뚜벅쵸', 'Oddish', 'grass'], [46, '파라스', 'Paras', 'bug'], [48, '콘팡', 'Venonat', 'bug'],
  [50, '디그다', 'Diglett', 'ground'], [52, '나옹', 'Meowth', 'normal'], [56, '망키', 'Mankey', 'fighting'],
  [58, '가디', 'Growlithe', 'fire'], [60, '발챙이', 'Poliwag', 'water'], [63, '캐이시', 'Abra', 'psychic'],
  [66, '알통몬', 'Machop', 'fighting'], [69, '모다피', 'Bellsprout', 'grass'], [72, '왕눈해', 'Tentacool', 'water'],
  [74, '꼬마돌', 'Geodude', 'rock'], [77, '포니타', 'Ponyta', 'fire'], [81, '코일', 'Magnemite', 'electric'],
  [84, '두두', 'Doduo', 'normal'], [86, '쥬쥬', 'Seel', 'water'], [88, '질퍽이', 'Grimer', 'poison'],
  [90, '셀러', 'Shellder', 'water'], [92, '고오스', 'Gastly', 'ghost'], [95, '롱스톤', 'Onix', 'rock'],
  [96, '슬리프', 'Drowzee', 'psychic'], [98, '크랩', 'Krabby', 'water'], [100, '찌리리공', 'Voltorb', 'electric'],
  [102, '아라리', 'Exeggcute', 'grass'], [104, '탕구리', 'Cubone', 'ground'], [108, '내루미', 'Lickitung', 'normal'],
  [109, '또가스', 'Koffing', 'poison'], [111, '뿔카노', 'Rhyhorn', 'ground'], [113, '럭키', 'Chansey', 'normal'],
  [114, '덩쿠리', 'Tangela', 'grass'], [116, '쏘드라', 'Horsea', 'water'], [118, '콘치', 'Goldeen', 'water'],
  [120, '별가사리', 'Staryu', 'water'], [129, '잉어킹', 'Magikarp', 'water'], [143, '잠만보', 'Snorlax', 'normal'],
  [147, '미뇽', 'Dratini', 'dragon'],
  // 추가 확대 (1세대 진화형 등)
  [2, '이상해풀', 'Ivysaur', 'grass'], [24, '아보크', 'Arbok', 'poison'], [28, '고지', 'Sandslash', 'ground'],
  [40, '푸크린', 'Wigglytuff', 'fairy'], [47, '파라섹트', 'Parasect', 'bug'], [55, '골덕', 'Golduck', 'water'],
  [59, '윈디', 'Arcanine', 'fire'], [62, '강챙이', 'Poliwrath', 'water'], [65, '후딘', 'Alakazam', 'psychic'],
  [68, '괴력몬', 'Machamp', 'fighting'], [71, '우츠보트', 'Victreebel', 'grass'], [76, '딱구리', 'Golem', 'rock'],
  [82, '레어코일', 'Magneton', 'electric'], [85, '두트리오', 'Dodrio', 'normal'], [87, '쥬레곤', 'Dewgong', 'water'],
  [91, '파르셀', 'Cloyster', 'water'], [94, '팬텀', 'Gengar', 'ghost'], [97, '슬리퍼', 'Hypno', 'psychic'],
  [112, '코뿌리', 'Rhydon', 'ground'], [121, '아쿠스타', 'Starmie', 'water'], [122, '마임맨', 'MrMime', 'psychic'],
  [123, '스라크', 'Scyther', 'bug'], [125, '에레브', 'Electabuzz', 'electric'], [126, '마그마', 'Magmar', 'fire'],
  [127, '쁘사이저', 'Pinsir', 'bug'], [128, '켄타로스', 'Tauros', 'normal'], [131, '라프라스', 'Lapras', 'water'],
  [137, '폴리곤', 'Porygon', 'normal'], [142, '프테라', 'Aerodactyl', 'rock'],
];

// 칼로스(english) — 6세대 (확실한 이름만)
const KALOS = [
  [650, '도치마론', 'Chespin', 'grass'], [653, '푸호꼬', 'Fennekin', 'fire'], [656, '개구마르', 'Froakie', 'water'],
  [659, '파르빗', 'Bunnelby', 'normal'], [661, '화살꼬빈', 'Fletchling', 'flying'], [667, '레오꼬', 'Litleo', 'fire'],
  [669, '플라베베', 'Flabebe', 'fairy'], [673, '고고트', 'Gogoat', 'grass'], [674, '판짱', 'Pancham', 'fighting'],
  [676, '트리미앙', 'Furfrou', 'normal'], [677, '냐스퍼', 'Espurr', 'psychic'], [682, '슈쁘', 'Spritzee', 'fairy'],
  [684, '나룸퍼프', 'Swirlix', 'fairy'], [686, '오케이징', 'Inkay', 'dark'], [688, '거북손손', 'Binacle', 'rock'],
  [690, '수레기', 'Skrelp', 'poison'], [692, '완철포', 'Clauncher', 'water'], [694, '목도리키텔', 'Helioptile', 'electric'],
  [696, '티고라스', 'Tyrunt', 'rock'], [698, '아마루스', 'Amaura', 'rock'], [700, '님피아', 'Sylveon', 'fairy'],
  [702, '데덴네', 'Dedenne', 'electric'], [703, '멜리시', 'Carbink', 'rock'], [707, '클레피', 'Klefki', 'steel'],
  [708, '나목령', 'Phantump', 'ghost'], [710, '호바귀', 'Pumpkaboo', 'ghost'], [712, '빙벌래', 'Bergmite', 'ice'],
  [714, '음뱃', 'Noibat', 'flying'],
  // 추가 확대 (6세대)
  [651, '도치보구', 'Quilladin', 'grass'], [654, '테르나', 'Braixen', 'fire'], [657, '개굴반장', 'Frogadier', 'water'],
  [662, '불화르', 'Fletchinder', 'fire'], [671, '플라제스', 'Florges', 'fairy'], [675, '부란다', 'Pangoro', 'fighting'],
  [695, '일레도리자드', 'Heliolisk', 'electric'], [697, '견고라스', 'Tyrantrum', 'rock'], [699, '아마루르가', 'Aurorus', 'rock'],
  [701, '루차불', 'Hawlucha', 'fighting'], [711, '펌킨인', 'Gourgeist', 'ghost'], [715, '음번', 'Noivern', 'flying'],
];

// 성도(hanja) — 2세대
const JOHTO = [
  [161, '꼬리선', 'Sentret', 'normal'], [163, '부우부', 'Hoothoot', 'flying'], [165, '레디바', 'Ledyba', 'bug'],
  [167, '페이검', 'Spinarak', 'bug'], [170, '초라기', 'Chinchou', 'water'], [175, '토게피', 'Togepi', 'fairy'],
  [177, '네이티', 'Natu', 'psychic'], [187, '통통코', 'Hoppip', 'grass'], [190, '에이팜', 'Aipom', 'normal'],
  [191, '해너츠', 'Sunkern', 'grass'], [193, '왕자리', 'Yanma', 'bug'], [194, '우파', 'Wooper', 'water'],
  [198, '니로우', 'Murkrow', 'dark'], [200, '무우마', 'Misdreavus', 'ghost'], [202, '마자용', 'Wobbuffet', 'psychic'],
  [204, '피콘', 'Pineco', 'bug'], [206, '노고치', 'Dunsparce', 'normal'], [207, '글라이거', 'Gligar', 'ground'],
  [209, '블루', 'Snubbull', 'fairy'], [211, '침바루', 'Qwilfish', 'water'], [213, '단단지', 'Shuckle', 'bug'],
  [215, '포푸니', 'Sneasel', 'dark'], [216, '깜지곰', 'Teddiursa', 'normal'], [218, '마그마그', 'Slugma', 'fire'],
  [220, '꾸꾸리', 'Swinub', 'ice'], [222, '코산호', 'Corsola', 'water'], [223, '총어', 'Remoraid', 'water'],
  [225, '딜리버드', 'Delibird', 'ice'], [227, '무장조', 'Skarmory', 'steel'], [228, '델빌', 'Houndour', 'dark'],
  [231, '코코리', 'Phanpy', 'ground'], [234, '노라키', 'Stantler', 'normal'], [238, '뽀뽀라', 'Smoochum', 'ice'],
  [239, '에레키드', 'Elekid', 'electric'], [240, '마그비', 'Magby', 'fire'], [241, '밀탱크', 'Miltank', 'normal'],
  // 추가 확대 (2세대)
  [153, '베이리프', 'Bayleef', 'grass'], [156, '마그케인', 'Quilava', 'fire'], [159, '엘리게이', 'Croconaw', 'water'],
  [164, '야부엉', 'Noctowl', 'flying'], [180, '보송송', 'Flaaffy', 'electric'], [185, '꼬지모', 'Sudowoodo', 'rock'],
  [195, '늪지밸', 'Quagsire', 'water'], [205, '쏘콘', 'Forretress', 'steel'], [210, '그랑블루', 'Granbull', 'fairy'],
  [212, '핫삼', 'Scizor', 'bug'], [214, '헤라크로스', 'Heracross', 'bug'], [219, '마그카르고', 'Magcargo', 'fire'],
  [221, '메꾸리', 'Piloswine', 'ice'], [224, '대포무노', 'Octillery', 'water'], [229, '헬가', 'Houndoom', 'dark'],
  [232, '코리갑', 'Donphan', 'ground'], [233, '폴리곤2', 'Porygon2', 'normal'], [237, '카포에라', 'Hitmontop', 'fighting'],
];

// 호연(science) — 3세대
const HOENN = [
  [261, '포챠나', 'Poochyena', 'dark'], [263, '지그제구리', 'Zigzagoon', 'normal'], [265, '개무소', 'Wurmple', 'bug'],
  [270, '연꽃몬', 'Lotad', 'water'], [273, '도토링', 'Seedot', 'grass'], [276, '테일로', 'Taillow', 'flying'],
  [278, '갈모매', 'Wingull', 'water'], [283, '비구술', 'Surskit', 'bug'], [285, '버섯꼬', 'Shroomish', 'grass'],
  [287, '게을로', 'Slakoth', 'normal'], [290, '토중몬', 'Nincada', 'bug'], [293, '소곤룡', 'Whismur', 'normal'],
  [296, '마크탕', 'Makuhita', 'fighting'], [300, '살짝눈', 'Skitty', 'normal'], [302, '깜까미', 'Sableye', 'dark'],
  [304, '가보리', 'Aron', 'steel'], [307, '요가랑', 'Meditite', 'fighting'], [309, '썬더라이', 'Electrike', 'electric'],
  [311, '플러시', 'Plusle', 'electric'], [312, '마이농', 'Minun', 'electric'], [313, '볼비트', 'Volbeat', 'bug'],
  [316, '꿀꺽몬', 'Gulpin', 'poison'], [318, '샤프니아', 'Carvanha', 'water'], [320, '고래왕자', 'Wailmer', 'water'],
  [322, '둔타', 'Numel', 'fire'], [328, '톱치', 'Trapinch', 'ground'], [331, '선인왕', 'Cacnea', 'grass'],
  [333, '파비코', 'Swablu', 'flying'], [339, '미꾸리', 'Barboach', 'water'], [341, '가재군', 'Corphish', 'water'],
  [345, '릴링', 'Lileep', 'rock'], [347, '아노딕스', 'Anorith', 'rock'], [349, '빈티나', 'Feebas', 'water'],
  [353, '어둠대신', 'Shuppet', 'ghost'], [359, '앱솔', 'Absol', 'dark'], [361, '눈꼬마', 'Snorunt', 'ice'],
  [363, '대굴레오', 'Spheal', 'ice'], [366, '진주몽', 'Clamperl', 'water'], [370, '사랑동이', 'Luvdisc', 'water'],
  [371, '아공이', 'Bagon', 'dragon'], [374, '메탕', 'Beldum', 'steel'],
  // 추가 확대 (3세대)
  [264, '직구리', 'Linoone', 'normal'], [267, '뷰티플라이', 'Beautifly', 'bug'], [269, '독케일', 'Dustox', 'poison'],
  [272, '로파파', 'Ludicolo', 'water'], [275, '다탱구', 'Shiftry', 'grass'], [279, '패리퍼', 'Pelipper', 'water'],
  [282, '가디안', 'Gardevoir', 'psychic'], [286, '버섯모', 'Breloom', 'grass'], [310, '썬더볼트', 'Manectric', 'electric'],
  [324, '코터스', 'Torkoal', 'fire'], [330, '플라이곤', 'Flygon', 'dragon'], [332, '밤선인', 'Cacturne', 'grass'],
  [334, '파비코리', 'Altaria', 'dragon'], [357, '트로피우스', 'Tropius', 'grass'], [376, '메타그로스', 'Metagross', 'steel'],
];

// 특별 전설/환상 — 모든 지방에 등장(크고 강하게)
const SPECIAL = [
  [718, '지가르데', 'Zygarde', 'dragon'], [493, '아르세우스', 'Arceus', 'normal'],
  [888, '자시안', 'Zacian', 'fairy'], [889, '자마젠타', 'Zamazenta', 'fighting'],
  [384, '레쿠쟈', 'Rayquaza', 'dragon'],
];
const SP = build(SPECIAL).map((e) => ({ ...e, legendary: true }));
const SP_NO_RAY = SP.filter((e) => e.id !== 'rayquaza'); // 호연은 레쿠쟈가 이미 보스라 중복 제외

export const EXTRA_WILD = {
  math: [...build(KANTO), ...SP],
  english: [...build(KALOS), ...SP],
  hanja: [...build(JOHTO), ...SP],
  science: [...build(HOENN), ...SP_NO_RAY],
};

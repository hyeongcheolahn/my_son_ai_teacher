// 추가 출현(야생) 포켓몬 — 진화 가족으로 연결 + 지방별 대폭 다양화.
// 형식: 가족 = [[도감번호,한국이름,영문,타입], ...] (여러 마리면 순서대로 진화 연결)
// 색은 타입에서 자동 생성, 그림은 dex번호로 PokeAPI 자동 로드.
import { DEX } from './dex.js';

const TYPE_COLOR = {
  normal: '#c7b8a1', fire: '#ff6b35', water: '#3b9eff', grass: '#5fc44a', electric: '#ffd23f',
  ice: '#7fe3e0', rock: '#b9956a', ground: '#e0c068', flying: '#a890f0', bug: '#9fb820',
  poison: '#b15ab1', fighting: '#d04a3c', psychic: '#f85888', ghost: '#8a78c0', dragon: '#8a5cf8',
  dark: '#7d6b9e', steel: '#b8b8d0', fairy: '#ee99ac',
};
function adjust(hex, f) {
  const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const ch = (c) => Math.max(0, Math.min(255, Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f))));
  return '#' + [ch(r), ch(g), ch(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function entry(dex, ko, en, type) {
  const id = en.toLowerCase().replace(/[^a-z0-9]/g, '');
  DEX[id] = dex;
  const body = TYPE_COLOR[type] || '#c7b8a1';
  return { id, ko, en, type, colors: { body, belly: adjust(body, 0.5), accent: adjust(body, -0.35) }, features: [] };
}
// 가족 묶음 → 진화 연결(stage/evolvesToId). 1마리면 단독.
function fams(...families) {
  return families.flatMap((f) => {
    const b = f.map((m) => entry(...m));
    b.forEach((e, i) => { e.stage = i + 1; e.evolvesToId = b[i + 1] ? b[i + 1].id : null; });
    return b;
  });
}

// 관동(math) — 1세대
const KANTO = fams(
  [[19, '꼬렛', 'Rattata', 'normal'], [20, '레트라', 'Raticate', 'normal']],
  [[16, '구구', 'Pidgey', 'normal'], [17, '피죤', 'Pidgeotto', 'normal'], [18, '피죤투', 'Pidgeot', 'normal']],
  [[21, '깨비참', 'Spearow', 'flying'], [22, '깨비드릴조', 'Fearow', 'flying']],
  [[23, '아보', 'Ekans', 'poison'], [24, '아보크', 'Arbok', 'poison']],
  [[27, '모래두지', 'Sandshrew', 'ground'], [28, '고지', 'Sandslash', 'ground']],
  [[37, '식스테일', 'Vulpix', 'fire'], [38, '나인테일', 'Ninetales', 'fire']],
  [[41, '주뱃', 'Zubat', 'poison'], [42, '골뱃', 'Golbat', 'poison']],
  [[43, '뚜벅쵸', 'Oddish', 'grass'], [44, '냄새꼬', 'Gloom', 'grass'], [45, '라플레시아', 'Vileplume', 'grass']],
  [[46, '파라스', 'Paras', 'bug'], [47, '파라섹트', 'Parasect', 'bug']],
  [[48, '콘팡', 'Venonat', 'bug'], [49, '도나리', 'Venomoth', 'bug']],
  [[50, '디그다', 'Diglett', 'ground'], [51, '닥트리오', 'Dugtrio', 'ground']],
  [[52, '나옹', 'Meowth', 'normal'], [53, '페르시온', 'Persian', 'normal']],
  [[56, '망키', 'Mankey', 'fighting'], [57, '성원숭', 'Primeape', 'fighting']],
  [[58, '가디', 'Growlithe', 'fire'], [59, '윈디', 'Arcanine', 'fire']],
  [[60, '발챙이', 'Poliwag', 'water'], [61, '슈륙챙이', 'Poliwhirl', 'water'], [62, '강챙이', 'Poliwrath', 'water']],
  [[63, '캐이시', 'Abra', 'psychic'], [64, '윤겔라', 'Kadabra', 'psychic'], [65, '후딘', 'Alakazam', 'psychic']],
  [[66, '알통몬', 'Machop', 'fighting'], [67, '근육몬', 'Machoke', 'fighting'], [68, '괴력몬', 'Machamp', 'fighting']],
  [[69, '모다피', 'Bellsprout', 'grass'], [70, '우츠동', 'Weepinbell', 'grass'], [71, '우츠보트', 'Victreebel', 'grass']],
  [[72, '왕눈해', 'Tentacool', 'water'], [73, '독파리', 'Tentacruel', 'water']],
  [[74, '꼬마돌', 'Geodude', 'rock'], [75, '데구리', 'Graveler', 'rock'], [76, '딱구리', 'Golem', 'rock']],
  [[77, '포니타', 'Ponyta', 'fire'], [78, '날쌩마', 'Rapidash', 'fire']],
  [[79, '야돈', 'Slowpoke', 'water'], [80, '야도란', 'Slowbro', 'water']],
  [[81, '코일', 'Magnemite', 'electric'], [82, '레어코일', 'Magneton', 'electric']],
  [[84, '두두', 'Doduo', 'normal'], [85, '두트리오', 'Dodrio', 'normal']],
  [[86, '쥬쥬', 'Seel', 'water'], [87, '쥬레곤', 'Dewgong', 'water']],
  [[88, '질퍽이', 'Grimer', 'poison'], [89, '질뻐기', 'Muk', 'poison']],
  [[90, '셀러', 'Shellder', 'water'], [91, '파르셀', 'Cloyster', 'water']],
  [[92, '고오스', 'Gastly', 'ghost'], [93, '고우스트', 'Haunter', 'ghost'], [94, '팬텀', 'Gengar', 'ghost']],
  [[96, '슬리프', 'Drowzee', 'psychic'], [97, '슬리퍼', 'Hypno', 'psychic']],
  [[98, '크랩', 'Krabby', 'water'], [99, '킹크랩', 'Kingler', 'water']],
  [[100, '찌리리공', 'Voltorb', 'electric'], [101, '붐볼', 'Electrode', 'electric']],
  [[102, '아라리', 'Exeggcute', 'grass'], [103, '나시', 'Exeggutor', 'grass']],
  [[104, '탕구리', 'Cubone', 'ground'], [105, '텅구리', 'Marowak', 'ground']],
  [[109, '또가스', 'Koffing', 'poison'], [110, '또도가스', 'Weezing', 'poison']],
  [[111, '뿔카노', 'Rhyhorn', 'ground'], [112, '코뿌리', 'Rhydon', 'ground']],
  [[116, '쏘드라', 'Horsea', 'water'], [117, '시드라', 'Seadra', 'water']],
  [[118, '콘치', 'Goldeen', 'water'], [119, '왕콘치', 'Seaking', 'water']],
  [[120, '별가사리', 'Staryu', 'water'], [121, '아쿠스타', 'Starmie', 'water']],
  [[129, '잉어킹', 'Magikarp', 'water'], [130, '갸라도스', 'Gyarados', 'water']],
  [[147, '미뇽', 'Dratini', 'dragon'], [148, '신뇽', 'Dragonair', 'dragon'], [149, '망나뇽', 'Dragonite', 'dragon']],
  // 단독
  [[95, '롱스톤', 'Onix', 'rock']], [[108, '내루미', 'Lickitung', 'normal']], [[113, '럭키', 'Chansey', 'normal']],
  [[114, '덩쿠리', 'Tangela', 'grass']], [[122, '마임맨', 'MrMime', 'psychic']], [[123, '스라크', 'Scyther', 'bug']],
  [[125, '에레브', 'Electabuzz', 'electric']], [[126, '마그마', 'Magmar', 'fire']], [[127, '쁘사이저', 'Pinsir', 'bug']],
  [[128, '켄타로스', 'Tauros', 'normal']], [[131, '라프라스', 'Lapras', 'water']], [[137, '폴리곤', 'Porygon', 'normal']],
  [[142, '프테라', 'Aerodactyl', 'rock']], [[143, '잠만보', 'Snorlax', 'normal']],
);

// 칼로스(english) — 6세대
const KALOS = fams(
  [[667, '레오꼬', 'Litleo', 'fire'], [668, '화염레오', 'Pyroar', 'fire']],
  [[669, '플라베베', 'Flabebe', 'fairy'], [670, '플라엣테', 'Floette', 'fairy'], [671, '플라제스', 'Florges', 'fairy']],
  [[674, '판짱', 'Pancham', 'fighting'], [675, '부란다', 'Pangoro', 'fighting']],
  [[677, '냐스퍼', 'Espurr', 'psychic'], [678, '냐오닉스', 'Meowstic', 'psychic']],
  [[679, '단칼빙', 'Honedge', 'steel'], [680, '양도가위', 'Doublade', 'steel'], [681, '킬가르도', 'Aegislash', 'steel']],
  [[682, '슈쁘', 'Spritzee', 'fairy'], [683, '프레프티르', 'Aromatisse', 'fairy']],
  [[684, '나룸퍼프', 'Swirlix', 'fairy'], [685, '나루림', 'Slurpuff', 'fairy']],
  [[686, '오케이징', 'Inkay', 'dark'], [687, '칼라마네로', 'Malamar', 'dark']],
  [[688, '거북손손', 'Binacle', 'rock'], [689, '거북손데스', 'Barbaracle', 'rock']],
  [[690, '수레기', 'Skrelp', 'poison'], [691, '드래캄', 'Dragalge', 'dragon']],
  [[692, '완철포', 'Clauncher', 'water'], [693, '블로스터', 'Clawitzer', 'water']],
  [[694, '목도리키텔', 'Helioptile', 'electric'], [695, '일레도리자드', 'Heliolisk', 'electric']],
  [[696, '티고라스', 'Tyrunt', 'rock'], [697, '견고라스', 'Tyrantrum', 'dragon']],
  [[698, '아마루스', 'Amaura', 'rock'], [699, '아마루르가', 'Aurorus', 'ice']],
  [[704, '미끄메라', 'Goomy', 'dragon'], [705, '미끈둥', 'Sliggoo', 'dragon'], [706, '미끄래곤', 'Goodra', 'dragon']],
  [[708, '나목령', 'Phantump', 'ghost'], [709, '대로트', 'Trevenant', 'ghost']],
  [[710, '호바귀', 'Pumpkaboo', 'ghost'], [711, '펌킨인', 'Gourgeist', 'ghost']],
  [[712, '빙벌래', 'Bergmite', 'ice'], [713, '크레베이스', 'Avalugg', 'ice']],
  [[714, '음뱃', 'Noibat', 'flying'], [715, '음번', 'Noivern', 'dragon']],
  // 단독
  [[673, '고고트', 'Gogoat', 'grass']], [[676, '트리미앙', 'Furfrou', 'normal']], [[700, '님피아', 'Sylveon', 'fairy']],
  [[701, '루차불', 'Hawlucha', 'fighting']], [[703, '멜리시', 'Carbink', 'rock']], [[707, '클레피', 'Klefki', 'steel']],
);

// 성도(hanja) — 2세대
const JOHTO = fams(
  [[161, '꼬리선', 'Sentret', 'normal'], [162, '다꼬리', 'Furret', 'normal']],
  [[165, '레디바', 'Ledyba', 'bug'], [166, '레디안', 'Ledian', 'bug']],
  [[167, '페이검', 'Spinarak', 'bug'], [168, '아리아도스', 'Ariados', 'bug']],
  [[170, '초라기', 'Chinchou', 'water'], [171, '랜턴', 'Lanturn', 'water']],
  [[175, '토게피', 'Togepi', 'fairy'], [176, '토게틱', 'Togetic', 'fairy']],
  [[177, '네이티', 'Natu', 'psychic'], [178, '네이티오', 'Xatu', 'psychic']],
  [[187, '통통코', 'Hoppip', 'grass'], [188, '두코', 'Skiploom', 'grass'], [189, '솜솜코', 'Jumpluff', 'grass']],
  [[191, '해너츠', 'Sunkern', 'grass'], [192, '해루미', 'Sunflora', 'grass']],
  [[194, '우파', 'Wooper', 'water'], [195, '늪지밸', 'Quagsire', 'water']],
  [[204, '피콘', 'Pineco', 'bug'], [205, '쏘콘', 'Forretress', 'steel']],
  [[209, '블루', 'Snubbull', 'fairy'], [210, '그랑블루', 'Granbull', 'fairy']],
  [[216, '깜지곰', 'Teddiursa', 'normal'], [217, '링곰', 'Ursaring', 'normal']],
  [[218, '마그마그', 'Slugma', 'fire'], [219, '마그카르고', 'Magcargo', 'fire']],
  [[220, '꾸꾸리', 'Swinub', 'ice'], [221, '메꾸리', 'Piloswine', 'ice']],
  [[223, '총어', 'Remoraid', 'water'], [224, '대포무노', 'Octillery', 'water']],
  [[228, '델빌', 'Houndour', 'dark'], [229, '헬가', 'Houndoom', 'dark']],
  [[231, '코코리', 'Phanpy', 'ground'], [232, '코리갑', 'Donphan', 'ground']],
  // 단독
  [[190, '에이팜', 'Aipom', 'normal']], [[193, '왕자리', 'Yanma', 'bug']], [[198, '니로우', 'Murkrow', 'dark']],
  [[200, '무우마', 'Misdreavus', 'ghost']], [[202, '마자용', 'Wobbuffet', 'psychic']], [[206, '노고치', 'Dunsparce', 'normal']],
  [[207, '글라이거', 'Gligar', 'ground']], [[211, '침바루', 'Qwilfish', 'water']], [[213, '단단지', 'Shuckle', 'bug']],
  [[214, '헤라크로스', 'Heracross', 'bug']], [[215, '포푸니', 'Sneasel', 'dark']], [[222, '코산호', 'Corsola', 'water']],
  [[225, '딜리버드', 'Delibird', 'ice']], [[227, '무장조', 'Skarmory', 'steel']], [[234, '노라키', 'Stantler', 'normal']],
  [[237, '카포에라', 'Hitmontop', 'fighting']], [[238, '뽀뽀라', 'Smoochum', 'ice']], [[239, '에레키드', 'Elekid', 'electric']],
  [[240, '마그비', 'Magby', 'fire']], [[241, '밀탱크', 'Miltank', 'normal']], [[185, '꼬지모', 'Sudowoodo', 'rock']],
);

// 호연(science) — 3세대
const HOENN = fams(
  [[261, '포챠나', 'Poochyena', 'dark'], [262, '그라에나', 'Mightyena', 'dark']],
  [[265, '개무소', 'Wurmple', 'bug'], [266, '실쿤', 'Silcoon', 'bug'], [267, '뷰티플라이', 'Beautifly', 'bug']],
  [[268, '카스쿤', 'Cascoon', 'bug'], [269, '독케일', 'Dustox', 'bug']],
  [[270, '연꽃몬', 'Lotad', 'water'], [271, '로토스', 'Lombre', 'water'], [272, '로파파', 'Ludicolo', 'water']],
  [[273, '도토링', 'Seedot', 'grass'], [274, '잎새코', 'Nuzleaf', 'grass'], [275, '다탱구', 'Shiftry', 'grass']],
  [[276, '테일로', 'Taillow', 'flying'], [277, '스왈로', 'Swellow', 'flying']],
  [[278, '갈모매', 'Wingull', 'water'], [279, '패리퍼', 'Pelipper', 'water']],
  [[283, '비구술', 'Surskit', 'bug'], [284, '비나방', 'Masquerain', 'bug']],
  [[285, '버섯꼬', 'Shroomish', 'grass'], [286, '버섯모', 'Breloom', 'grass']],
  [[287, '게을로', 'Slakoth', 'normal'], [288, '발바로', 'Vigoroth', 'normal'], [289, '게을킹', 'Slaking', 'normal']],
  [[293, '소곤룡', 'Whismur', 'normal'], [294, '노공룡', 'Loudred', 'normal'], [295, '폭음룡', 'Exploud', 'normal']],
  [[296, '마크탕', 'Makuhita', 'fighting'], [297, '하리뭉', 'Hariyama', 'fighting']],
  [[300, '살짝눈', 'Skitty', 'normal'], [301, '델케티', 'Delcatty', 'normal']],
  [[304, '가보리', 'Aron', 'steel'], [305, '갱도라', 'Lairon', 'steel'], [306, '보스로라', 'Aggron', 'steel']],
  [[307, '요가랑', 'Meditite', 'fighting'], [308, '요가램', 'Medicham', 'fighting']],
  [[309, '썬더라이', 'Electrike', 'electric'], [310, '썬더볼트', 'Manectric', 'electric']],
  [[316, '꿀꺽몬', 'Gulpin', 'poison'], [317, '꿀꺽몰', 'Swalot', 'poison']],
  [[318, '샤프니아', 'Carvanha', 'water'], [319, '샤크니아', 'Sharpedo', 'water']],
  [[320, '고래왕자', 'Wailmer', 'water'], [321, '고래왕', 'Wailord', 'water']],
  [[322, '둔타', 'Numel', 'fire'], [323, '폭타', 'Camerupt', 'fire']],
  [[328, '톱치', 'Trapinch', 'ground'], [329, '비브라바', 'Vibrava', 'dragon'], [330, '플라이곤', 'Flygon', 'dragon']],
  [[331, '선인왕', 'Cacnea', 'grass'], [332, '밤선인', 'Cacturne', 'grass']],
  [[333, '파비코', 'Swablu', 'flying'], [334, '파비코리', 'Altaria', 'dragon']],
  [[339, '미꾸리', 'Barboach', 'water'], [340, '메깅', 'Whiscash', 'water']],
  [[341, '가재군', 'Corphish', 'water'], [342, '가재장군', 'Crawdaunt', 'water']],
  [[345, '릴링', 'Lileep', 'rock'], [346, '릴리요', 'Cradily', 'rock']],
  [[347, '아노딕스', 'Anorith', 'rock'], [348, '아말도', 'Armaldo', 'rock']],
  [[349, '빈티나', 'Feebas', 'water'], [350, '밀로틱', 'Milotic', 'water']],
  [[353, '어둠대신', 'Shuppet', 'ghost'], [354, '다크펫', 'Banette', 'ghost']],
  [[361, '눈꼬마', 'Snorunt', 'ice'], [362, '얼음귀신', 'Glalie', 'ice']],
  [[363, '대굴레오', 'Spheal', 'ice'], [364, '씨레오', 'Sealeo', 'ice'], [365, '씰벼슬', 'Walrein', 'ice']],
  [[366, '진주몽', 'Clamperl', 'water'], [367, '헌테일', 'Huntail', 'water']],
  [[371, '아공이', 'Bagon', 'dragon'], [372, '쉘곤', 'Shelgon', 'dragon'], [373, '보만다', 'Salamence', 'dragon']],
  [[374, '메탕', 'Beldum', 'steel'], [375, '메탕구', 'Metang', 'steel'], [376, '메타그로스', 'Metagross', 'steel']],
  // 단독
  [[302, '깜까미', 'Sableye', 'dark']], [[311, '플러시', 'Plusle', 'electric']], [[312, '마이농', 'Minun', 'electric']],
  [[313, '볼비트', 'Volbeat', 'bug']], [[324, '코터스', 'Torkoal', 'fire']], [[357, '트로피우스', 'Tropius', 'grass']],
  [[359, '앱솔', 'Absol', 'dark']], [[370, '사랑동이', 'Luvdisc', 'water']],
);

// 특별 전설/환상 — 모든 지방에 등장(크고 강하게)
const SP = fams(
  [[718, '지가르데', 'Zygarde', 'dragon']], [[493, '아르세우스', 'Arceus', 'normal']],
  [[888, '자시안', 'Zacian', 'fairy']], [[889, '자마젠타', 'Zamazenta', 'fighting']],
  [[384, '레쿠쟈', 'Rayquaza', 'dragon']],
).map((e) => ({ ...e, legendary: true }));
const SP_NO_RAY = SP.filter((e) => e.id !== 'rayquaza'); // 호연은 레쿠쟈가 이미 보스라 중복 제외

export const EXTRA_WILD = {
  math: [...KANTO, ...SP],
  english: [...KALOS, ...SP],
  hanja: [...JOHTO, ...SP],
  science: [...HOENN, ...SP_NO_RAY],
};

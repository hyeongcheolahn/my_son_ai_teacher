// 4차 추가: 도형·시계 새 과목 + 영어 단어 보강(첨부 단어장 기반)
// 시계는 게임에서 실제 아날로그 시계 그림으로 보여 준다(kind:'clock').

// ---- 영어 단어(첨부 단어장에서 정리) ------------------------------------
const WORDS = [
  ['lion', '사자'], ['map', '지도'], ['milk', '우유'], ['orange', '오렌지'], ['run', '달리다'],
  ['pig', '돼지'], ['sun', '태양'], ['toy', '장난감'], ['rain', '비'], ['star', '별'],
  ['water', '물'], ['violin', '바이올린'], ['ball', '공'], ['ant', '개미'], ['king', '왕'],
  ['voice', '목소리'], ['bread', '빵'], ['lamp', '램프'], ['watch', '손목시계'], ['cloud', '구름'],
  ['moon', '달'], ['desk', '책상'], ['night', '밤'], ['ear', '귀'], ['pen', '펜'],
  ['frog', '개구리'], ['gift', '선물'], ['baby', '아기'], ['home', '집'], ['ship', '배'],
  ['cook', '요리하다'], ['tiger', '호랑이'], ['drum', '드럼'], ['jelly', '젤리'], ['elbow', '팔꿈치'],
  ['key', '열쇠'], ['face', '얼굴'], ['garden', '정원'], ['island', '섬'], ['jacket', '재킷'],
  ['kangaroo', '캥거루'], ['leaf', '나뭇잎'], ['mouse', '쥐'], ['nest', '둥지'], ['octopus', '문어'],
  ['piano', '피아노'], ['rainbow', '무지개'], ['snow', '눈'], ['train', '기차'], ['umbrella', '우산'],
  ['vegetable', '야채'], ['zebra', '얼룩말'], ['banana', '바나나'], ['chair', '의자'], ['dance', '춤추다'],
  ['family', '가족'], ['green', '초록색'], ['hat', '모자'], ['juice', '주스'], ['kite', '연'],
  ['monkey', '원숭이'], ['car', '자동차'], ['goat', '염소'], ['nose', '코'], ['queen', '여왕'],
  ['tree', '나무'], ['bag', '가방'], ['cake', '케이크'], ['duck', '오리'], ['angry', '화난'],
];

function rint(n) { return Math.floor(Math.random() * n); }
function vocabItem(i) {
  const [en, ko] = WORDS[i];
  const set = new Set([ko]);
  let guard = 0;
  while (set.size < 4 && guard++ < 50) { const o = WORDS[rint(WORDS.length)][1]; set.add(o); }
  return { prompt: `'${en}' 의 뜻은 무엇일까요?`, answer: ko, choices: [...set] };
}
const VOCAB = WORDS.map((_, i) => vocabItem(i));

// ---- 시계 문제 생성(아날로그 시계 그림) ---------------------------------
const hm = (h, m) => (m === 0 ? `${h}시` : `${h}시 ${m}분`);
function clockHM(h, m) {
  const ans = hm(h, m);
  const set = new Set([ans]);
  const alts = [hm(h, (m + 30) % 60), hm((h % 12) + 1, m), hm(h === 1 ? 12 : h - 1, m), hm(h, (m + 15) % 60), hm((h % 12) + 1, (m + 30) % 60)];
  for (const a of alts) { if (set.size >= 4) break; if (a !== ans) set.add(a); }
  let k = 5; while (set.size < 4 && k < 60) { const a = hm(h, (m + k) % 60); if (a !== ans) set.add(a); k += 5; }
  return { kind: 'clock', clock: { h, m, s: null, hand: 'hm' }, text: '시계는 지금 몇 시 몇 분일까요?', answer: ans, choices: [...set].slice(0, 4) };
}
function clockHour(h) {
  const ans = `${h}시`;
  const set = new Set([ans]);
  for (const d of [1, 2, 11, 3, 5]) { if (set.size >= 4) break; set.add(`${((h - 1 + d) % 12) + 1}시`); }
  return { kind: 'clock', clock: { h, m: 0, s: null, hand: 'hm' }, text: '시계는 지금 몇 시일까요?', answer: ans, choices: [...set].slice(0, 4) };
}
function clockSec(h, m, s) {
  const ans = `${s}초`;
  const set = new Set([ans]);
  for (const d of [5, 10, 15, 30, 45, 20]) { if (set.size >= 4) break; set.add(`${(s + d) % 60}초`); }
  return { kind: 'clock', clock: { h, m, s, hand: 'hms' }, text: '빨간 초바늘은 몇 초를 가리킬까요?', answer: ans, choices: [...set].slice(0, 4) };
}

const CLOCK_HOUR = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(clockHour);
const CLOCK_HM = [[3, 30], [6, 15], [9, 45], [1, 20], [4, 10], [7, 50], [10, 5], [2, 40], [5, 25], [8, 35], [11, 15], [2, 55], [6, 30], [9, 10], [4, 45], [12, 20]].map(([h, m]) => clockHM(h, m));
const CLOCK_SEC = [[3, 0, 15], [7, 30, 45], [10, 15, 30], [2, 45, 20], [5, 0, 50]].map(([h, m, s]) => clockSec(h, m, s));

const TIME_CONCEPT = [
  { prompt: '1분은 몇 초일까요?', answer: '60초', choices: ['60초', '30초', '100초', '12초'] },
  { prompt: '1시간은 몇 분일까요?', answer: '60분', choices: ['60분', '30분', '24분', '100분'] },
  { prompt: '하루는 몇 시간일까요?', answer: '24시간', choices: ['24시간', '12시간', '60시간', '10시간'] },
  { prompt: '시계에서 짧은바늘은 무엇을 가리킬까요?', answer: '시(시간)', choices: ['시(시간)', '분', '초', '날짜'] },
  { prompt: '시계에서 긴바늘은 무엇을 가리킬까요?', answer: '분', choices: ['분', '시', '초', '요일'] },
  { prompt: '시계에서 가장 빨리 도는 바늘은?', answer: '초바늘', choices: ['초바늘', '시바늘(짧은바늘)', '분바늘(긴바늘)', '모두 같다'] },
  { prompt: '초바늘이 한 바퀴 돌면 몇 초가 지날까요?', answer: '60초', choices: ['60초', '30초', '12초', '100초'] },
  { prompt: '긴바늘이 12에서 6까지 가면 몇 분이 지날까요?', answer: '30분', choices: ['30분', '15분', '60분', '6분'] },
  { prompt: '긴바늘이 숫자 3을 가리키면 몇 분일까요?', answer: '15분', choices: ['15분', '3분', '30분', '20분'] },
  { prompt: '아침에 학교에 가는 시간으로 알맞은 것은?', answer: '오전 8시', choices: ['오전 8시', '밤 12시', '새벽 3시', '오후 11시'] },
];

// ---- 도형 문제(평면/입체) ----------------------------------------------
const SHAPES_FLAT = [
  { prompt: '뾰족한 꼭짓점이 3개인 도형은?', answer: '삼각형(세모)', choices: ['삼각형(세모)', '사각형(네모)', '원(동그라미)', '오각형'] },
  { prompt: '변이 4개인 도형은?', answer: '사각형(네모)', choices: ['사각형(네모)', '삼각형(세모)', '원(동그라미)', '삼각형'] },
  { prompt: '모서리가 없이 동그란 도형은?', answer: '원(동그라미)', choices: ['원(동그라미)', '삼각형', '사각형', '오각형'] },
  { prompt: '삼각형의 변은 모두 몇 개일까요?', answer: '3개', choices: ['3개', '4개', '2개', '5개'] },
  { prompt: '사각형의 꼭짓점은 모두 몇 개일까요?', answer: '4개', choices: ['4개', '3개', '5개', '0개'] },
  { prompt: '원(동그라미)의 꼭짓점은 몇 개일까요?', answer: '0개(없어요)', choices: ['0개(없어요)', '1개', '3개', '4개'] },
  { prompt: '잘 굴러가는 도형은 무엇일까요?', answer: '원(동그라미)', choices: ['원(동그라미)', '사각형', '삼각형', '오각형'] },
  { prompt: '텔레비전 화면은 보통 어떤 모양일까요?', answer: '사각형(네모)', choices: ['사각형(네모)', '삼각형', '원', '별모양'] },
  { prompt: '피자 한 판은 보통 어떤 모양일까요?', answer: '원(동그라미)', choices: ['원(동그라미)', '사각형', '삼각형', '오각형'] },
  { prompt: '삼각김밥은 어떤 모양일까요?', answer: '삼각형(세모)', choices: ['삼각형(세모)', '원', '사각형', '별모양'] },
  { prompt: '도형의 곧은 선을 무엇이라고 부를까요?', answer: '변', choices: ['변', '꼭짓점', '면', '점'] },
  { prompt: '도형에서 변과 변이 만나는 뾰족한 곳을?', answer: '꼭짓점', choices: ['꼭짓점', '변', '면', '둘레'] },
  { prompt: '세모와 네모 중 꼭짓점이 더 많은 것은?', answer: '네모(사각형)', choices: ['네모(사각형)', '세모(삼각형)', '같다', '둘 다 없다'] },
  { prompt: '창문이나 칠판은 보통 어떤 모양일까요?', answer: '사각형(네모)', choices: ['사각형(네모)', '원', '삼각형', '오각형'] },
  { prompt: '꼭짓점이 5개인 도형은 무엇일까요?', answer: '오각형', choices: ['오각형', '삼각형', '사각형', '원'] },
  { prompt: '바퀴는 잘 굴러가야 해요. 어떤 모양일까요?', answer: '원(동그라미)', choices: ['원(동그라미)', '사각형', '삼각형', '오각형'] },
];
const SHAPES_SOLID = [
  { prompt: '공처럼 생긴 입체도형은 무엇일까요?', answer: '구(공모양)', choices: ['구(공모양)', '직육면체', '원기둥', '원뿔'] },
  { prompt: '상자(벽돌)처럼 생긴 입체도형은?', answer: '직육면체(상자모양)', choices: ['직육면체(상자모양)', '구', '원뿔', '원기둥'] },
  { prompt: '음료수 캔처럼 생긴 입체도형은?', answer: '원기둥', choices: ['원기둥', '구', '직육면체', '원뿔'] },
  { prompt: '고깔모자처럼 뾰족한 입체도형은?', answer: '원뿔', choices: ['원뿔', '구', '원기둥', '직육면체'] },
  { prompt: '잘 굴러가는 입체도형은 무엇일까요?', answer: '구(공)', choices: ['구(공)', '직육면체(상자)', '주사위', '벽돌'] },
  { prompt: '쌓기 좋고 잘 안 굴러가는 입체도형은?', answer: '직육면체(상자)', choices: ['직육면체(상자)', '구(공)', '원기둥', '원뿔'] },
  { prompt: '삼각형 2개를 붙이면 만들 수 있는 도형은?', answer: '사각형', choices: ['사각형', '원', '오각형', '삼각형'] },
  { prompt: '축구공은 어떤 입체도형일까요?', answer: '구', choices: ['구', '원기둥', '직육면체', '원뿔'] },
  { prompt: '통조림 캔은 어떤 입체도형일까요?', answer: '원기둥', choices: ['원기둥', '구', '원뿔', '직육면체'] },
  { prompt: '아이스크림 콘은 어떤 모양일까요?', answer: '원뿔', choices: ['원뿔', '원기둥', '구', '직육면체'] },
  { prompt: '주사위는 어떤 입체도형일까요?', answer: '정육면체(상자모양)', choices: ['정육면체(상자모양)', '구', '원기둥', '원뿔'] },
  { prompt: '벽돌은 어떤 입체도형일까요?', answer: '직육면체', choices: ['직육면체', '구', '원뿔', '원기둥'] },
  { prompt: '원기둥을 위에서 똑바로 내려다보면 무슨 모양?', answer: '원(동그라미)', choices: ['원(동그라미)', '사각형', '삼각형', '별모양'] },
  { prompt: '네모난 종이를 반으로 접으면 생기는 모양은?', answer: '더 작은 사각형', choices: ['더 작은 사각형', '원', '삼각형뿐', '오각형'] },
];

export const EXTRA4 = {
  english: {
    level3: VOCAB.slice(0, 24),
    level4: VOCAB.slice(24, 44),
  },
};

// 도형·시계 문제 풀(수학에 섞어서 출제). 난이도 순: 평면→입체→시계(시)→시계(시·분)→시·분·초
export const SHAPES_STAGES = [
  SHAPES_FLAT,
  SHAPES_SOLID,
  CLOCK_HOUR,
  CLOCK_HM,
  [...TIME_CONCEPT, ...CLOCK_SEC],
];

// 종 id → 전국도감 번호. 진짜 포켓몬 공식 일러스트(PokéAPI)를 불러올 때 사용.
// 이미지는 jsDelivr가 미러링하는 PokeAPI/sprites 저장소에서 로드(앞면 official-artwork).
export const DEX = {
  // 관동(math)
  bulbasaur: 1, ivysaur: 2, venusaur: 3,
  charmander: 4, charmeleon: 5, charizard: 6,
  squirtle: 7, wartortle: 8, blastoise: 9,
  caterpie: 10, metapod: 11, butterfree: 12,
  pikachu: 25, raichu: 26,
  jigglypuff: 39, psyduck: 54, eevee: 133, mewtwo: 150,
  // 칼로스(english)
  chespin: 650, quilladin: 651, chesnaught: 652,
  fennekin: 653, braixen: 654, delphox: 655,
  froakie: 656, frogadier: 657, greninja: 658,
  bunnelby: 659, diggersby: 660,
  fletchling: 661, fletchinder: 662,
  dedenne: 702, xerneas: 716,
  // 성도(hanja)
  chikorita: 152, bayleef: 153, meganium: 154,
  cyndaquil: 155, quilava: 156, typhlosion: 157,
  totodile: 158, croconaw: 159, feraligatr: 160,
  hoothoot: 163, pichu: 172,
  mareep: 179, flaaffy: 180, ampharos: 181,
  marill: 183, lugia: 249,
  // 호연(science)
  treecko: 252, grovyle: 253, sceptile: 254,
  torchic: 255, combusken: 256, blaziken: 257,
  mudkip: 258, marshtomp: 259, swampert: 260,
  zigzagoon: 263, linoone: 264,
  ralts: 280, kirlia: 281, gardevoir: 282,
  rayquaza: 384,
  // 추가 출현(다양화) — 관동
  rattata: 19, pidgey: 16, meowth: 52, machop: 66, geodude: 74, gastly: 92, magikarp: 129, snorlax: 143,
  // 칼로스
  litleo: 667, pancham: 674, espurr: 677, sylveon: 700, noibat: 714, skiddo: 672, furfrou: 676, flabebe: 669,
  // 성도
  wooper: 194, sentret: 161, sneasel: 215, teddiursa: 216, houndour: 228, phanpy: 231, togepi: 175, slugma: 218,
  // 호연
  poochyena: 261, wingull: 278, aron: 304, electrike: 309, numel: 322, spheal: 363, bagon: 371, shroomish: 285,
};

// id(종 이름) 또는 폼 아트 번호(예: 10034 = 메가 리자몽 X) 둘 다 허용
export function artUrl(idOrNum) {
  const n = typeof idOrNum === 'number' ? idOrNum : DEX[idOrNum];
  if (!n) return null;
  return `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/${n}.png`;
}

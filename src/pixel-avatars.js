/** Original 64 × 64 anime pixel portraits. No network, photographs or image models. */
const VERSION = 1;
const cache = new Map();
const hash = value => { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
const hairColors = [
  ['#262637','#45445b','#6d6a83'], ['#332e31','#66504b','#987266'],
  ['#543f3b','#926751','#c49370'], ['#674d49','#b48466','#e2b78d'],
  ['#393452','#665479','#9783aa'], ['#293d46','#416674','#72949d'],
  ['#522f42','#8b4b60','#b87d88'], ['#343b31','#59644c','#899174'],
  ['#6d5940','#b69b68','#e3cf9c'], ['#4a4d58','#8b919c','#c7cbd4']
];
const skinColors = [
  ['#f8d9bc','#e4b292','#c88f78'], ['#f1c7aa','#d69e84','#b47765'],
  ['#d6aa83','#b78063','#955e4f'], ['#b78160','#935e48','#754332'],
  ['#895b48','#714633','#58362d'], ['#f3cfbe','#dca99b','#be837c']
];
const clothesColors = [
  ['#354856','#55798a','#91b0b8'], ['#4f475d','#82728e','#b9a9c2'],
  ['#4b5a42','#7e9164','#b0bf8b'], ['#70474b','#ae6e71','#d6a19a'],
  ['#4b4d57','#858997','#bdc2cc'], ['#6f5843','#aa8964','#d6bc8d'],
  ['#345951','#5d9382','#a4c3a4'], ['#59465f','#936b91','#caa1b6']
];
const backgrounds = [['#e9d9c4','#d6bfa7'],['#d8e4d8','#b6cdbb'],['#dce2ef','#b7c5df'],['#e8d9e6','#cfb8d0'],['#ede5c9','#d8cc9f'],['#d1e3e5','#a9c7cb']];
const eyeColors = ['#446377','#765a3f','#625181','#406c5f','#87565d','#6c7050'];

export function createPixelAvatar({seed = '', identity = '', presentation = 'neutral', ageVariant = 'adult'} = {}) {
  const key = JSON.stringify([VERSION, String(seed), String(identity), presentation, ageVariant]);
  if (cache.has(key)) return cache.get(key);
  // Keep identity traits independent of age/presentation so growing older does not become a different person.
  let randomState = hash(`${VERSION}|${seed}|${identity}`) || 1;
  const random = max => { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return (randomState >>> 0) % max; };
  const traits = {hair:random(hairColors.length),skin:random(skinColors.length),clothes:random(clothesColors.length),background:random(backgrounds.length),eyes:random(eyeColors.length),haircut:random(8),bangs:random(5),outfit:random(4),accessory:random(8),expression:random(3)};
  const [hairDark,hair,hairLight] = ageVariant === 'older' ? ['#53565d','#929599','#c9c9c5'] : hairColors[traits.hair];
  const [skin,skinShadow,skinDeep] = skinColors[traits.skin], [clothDark,cloth,clothLight] = clothesColors[traits.clothes], [bg,bgShadow] = backgrounds[traits.background];
  const line = '#30333f', eye = eyeColors[traits.eyes], child = ageVariant === 'child';
  const haircut = presentation === 'female' ? [1,2,3,4,5,6,7,1][traits.haircut] : presentation === 'male' ? [0,0,2,3,4,5,0,7][traits.haircut] : traits.haircut;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64" shape-rendering="crispEdges">`];
  const rect = (x,y,w,h,color) => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`);
  const poly = (points,color) => parts.push(`<polygon points="${points}" fill="${color}"/>`);
  rect(0,0,64,64,bg);rect(0,51,64,13,bgShadow);rect(4,7,2,2,bgShadow);rect(7,4,2,2,bgShadow);rect(56,13,3,3,bgShadow);rect(53,10,2,2,bgShadow);
  // The rear silhouette varies between short hair, bob, long hair, ties and curls.
  poly('22,8 41,8 41,10 46,10 46,15 49,15 49,25 47,25 47,43 43,43 43,48 21,48 21,44 17,44 17,19 19,19 19,12 22,12',hairDark);
  if ([1,2,4,6].includes(haircut)) {
    poly('18,22 46,22 46,39 49,39 49,48 51,48 51,54 41,54 41,48 21,48 21,54 13,54 13,48 15,48 15,36 18,36',hairDark);
    rect(17,31,3,19,hair);rect(44,30,3,19,hair);
  }
  if (haircut===3||haircut===6) {
    poly('10,17 17,17 17,20 20,20 20,35 17,35 17,43 12,43 12,39 9,39 9,25 10,25',hairDark);
    rect(12,23,4,14,hair);rect(13,20,3,2,clothLight);
  }
  if (haircut===6) {rect(47,18,6,22,hairDark);rect(49,23,3,14,hair);rect(48,20,3,2,clothLight);}
  // Shoulders, neck and clothing are visible in both the full portrait and circular crop.
  poly('24,45 40,45 40,48 47,48 47,51 52,51 52,55 55,55 55,64 9,64 9,55 12,55 12,51 17,51 17,48 24,48',clothDark);
  poly('22,49 42,49 42,52 48,52 48,56 51,56 51,64 13,64 13,56 16,56 16,52 22,52',cloth);
  rect(27,41,10,9,skinShadow);rect(29,44,6,6,skin);
  if (traits.outfit===0) {poly('22,48 27,46 32,51 28,56 24,53', '#f4eee0');poly('37,46 42,48 40,53 36,56 32,51','#dedbd2');rect(31,51,2,13,clothDark);}
  else if(traits.outfit===1) {poly('22,48 26,47 29,51 35,51 38,47 42,49 37,56 27,56',clothLight);rect(24,56,1,5,clothLight);rect(39,56,1,5,clothLight);}
  else if(traits.outfit===2) {rect(23,49,18,3,clothDark);rect(27,51,10,2,clothLight);rect(19,59,26,2,clothLight);}
  else {poly('24,47 28,49 32,53 28,58 21,50',clothLight);poly('40,47 36,49 32,53 36,58 43,50',clothDark);rect(31,55,2,9,clothDark);}
  rect(16,56,2,8,clothLight);rect(47,56,2,8,clothDark);
  // Face is stepped pixel geometry, with large anime eyes and asymmetric hair highlights.
  rect(17,28,4,9,skinShadow);rect(43,28,4,9,skinShadow);rect(18,30,2,4,skinDeep);rect(44,30,2,4,skinDeep);
  poly(child?'23,17 41,17 41,20 44,20 44,38 41,38 41,42 37,42 37,45 27,45 27,42 23,42 23,38 20,38 20,21 23,21':'24,16 40,16 40,19 44,19 44,35 42,35 42,40 39,40 39,43 35,43 35,45 29,45 29,43 25,43 25,40 22,40 22,35 20,35 20,21 24,21',skinShadow);
  poly('25,18 39,18 39,21 42,21 42,35 40,35 40,39 37,39 37,42 28,42 28,39 24,39 24,35 22,35 22,22 25,22',skin);
  const eyeY = child ? 29 : 28;
  for(const x of [23,35]) {
    rect(x-1,eyeY,8,2,line);rect(x,eyeY+2,6,6,'#fff9ef');rect(x+2,eyeY+2,4,6,eye);rect(x+3,eyeY+2,2,4,line);rect(x+2,eyeY+2,2,2,'#fffdf1');rect(x+4,eyeY+6,2,1,'#c2d5d5');rect(x,eyeY+8,6,1,skinShadow);
    rect(x,eyeY-3,6,1,hairDark);
  }
  rect(31,35,1,2,skinShadow);rect(30,40,4,1,traits.expression===1?skinDeep:'#a46f6c');
  if(traits.expression===2)rect(31,41,2,1,skinShadow);
  rect(22,37,3,1,skinShadow);rect(40,37,3,1,skinShadow);
  if(ageVariant==='older'){rect(23,38,3,1,skinDeep);rect(39,38,3,1,skinDeep);rect(28,24,8,1,skinShadow);}
  // Crown and fringe preserve a recognisable silhouette instead of recolouring one shared face.
  poly('23,9 40,9 40,11 45,11 45,16 47,16 47,26 43,26 43,20 39,20 39,18 24,18 24,22 20,22 20,29 17,29 17,19 19,19 19,13 23,13',hair);
  rect(24,11,14,2,hairLight);rect(21,14,5,2,hairLight);rect(40,14,3,4,hairLight);
  const fringes = [
    '21,17 42,17 42,23 38,23 38,21 35,21 35,27 32,27 32,23 29,23 29,25 25,25 25,22 21,22',
    '20,17 42,17 42,21 38,21 38,24 34,24 34,27 30,27 30,24 26,24 26,22 20,22',
    '21,17 42,17 42,25 39,25 39,21 35,21 35,19 30,19 30,23 26,23 26,27 22,27',
    '20,17 42,17 42,22 39,22 39,26 36,26 36,22 33,22 33,25 30,25 30,22 27,22 27,26 23,26 23,23 20,23',
    '21,17 42,17 42,27 39,27 39,23 36,23 36,21 32,21 32,23 28,23 28,25 24,25 24,22 21,22'
  ];
  poly(fringes[traits.bangs],hair);rect(26,17,3,2,hairLight);rect(35,16,3,2,hairLight);
  if(haircut===0){rect(17,26,4,7,hairDark);rect(43,26,4,6,hairDark);rect(28,6,7,4,hair);rect(35,7,5,3,hairDark);}
  if(haircut===2||haircut===7){rect(18,22,3,18,hair);rect(43,21,3,haircut===7?13:20,hair);rect(18,39,5,3,hairDark);}
  if(haircut===4){rect(18,23,4,23,hair);rect(43,22,3,24,hair);rect(19,27,1,13,hairLight);}
  if(haircut===5){rect(18,23,3,10,hairDark);rect(43,22,4,17,hair);rect(46,35,2,6,hairDark);rect(23,7,7,3,hair);}
  if(traits.accessory===0){rect(21,eyeY+1,10,1,line);rect(21,eyeY+7,10,1,line);rect(21,eyeY+2,1,5,line);rect(30,eyeY+2,1,5,line);rect(34,eyeY+1,10,1,line);rect(34,eyeY+7,10,1,line);rect(34,eyeY+2,1,5,line);rect(43,eyeY+2,1,5,line);rect(31,eyeY+3,3,1,line);}
  else if(traits.accessory===1){rect(40,21,5,2,clothLight);rect(41,24,4,1,'#f1e9c9');}
  else if(traits.accessory===2){rect(19,37,2,3,'#e9ca72');rect(44,37,2,3,'#e9ca72');}
  else if(traits.accessory===3){rect(17,25,3,13,clothDark);rect(45,25,3,13,clothDark);rect(16,28,3,7,clothLight);rect(46,28,3,7,clothLight);}
  // Small cloth texture avoids gradients and keeps the same pixel scale everywhere.
  rect(20,60,2,1,clothLight);rect(43,57,2,1,clothLight);parts.push('</svg>');
  const svg=parts.join(''), result=Object.freeze({src:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,variant:hash(key).toString(36),style:'image-rendering:pixelated;',artworkStyle:'anime-pixel',traits:Object.freeze(traits)});
  if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}

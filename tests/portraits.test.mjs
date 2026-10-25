import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {getPortrait, portraitIdentity, isSafePortraitDataUrl, loadPortraitOverrides, setCustomPortrait} from '../src/portraits.js';
import manifest from '../src/data/portrait-manifest.json' with {type:'json'};

test('known character portraits use separately generated, existing local image assets', () => {
  const sources = Object.values(manifest.people).map(p => p.src);
  assert.equal(new Set(sources).size, sources.length);
  for (const entry of Object.values(manifest.people)) {
    assert.ok(entry.reference);
    assert.ok(fs.existsSync(path.resolve('public', entry.src)));
    assert.match(entry.src, /^\.\/portraits\/[a-z-]+\.webp$/);
    assert.equal(entry.artworkStyle, 'anime-pixel');
    assert.ok(fs.existsSync(path.resolve('public', entry.originalSrc)));
  }
});

test('missing real-person references remain empty for both player and public NPC', () => {
  for (const person of [{name:'未收集照片人物',lockedPersonaId:'wikidata-Q100000'}, {name:'胡春华',id:'hu_chunhua'}, {name:'某人',persona:{id:'some_person'}}]) {
    const result = getPortrait(person);
    assert.equal(result.src, null);
    assert.equal(result.kind, 'missing');
    assert.equal(result.sourceStatus, 'pending-reference');
  }
});

test('alias matches same established portrait', () => {
  assert.equal(getPortrait({name:'毛澤東'}).src, getPortrait({name:'毛泽东'}).src);
  assert.equal(getPortrait({name:'羽澤鶇'}).src, getPortrait({name:'羽泽鸫'}).src);
});

test('body form takes precedence over historic human portrait', () => {
  const game = {profile:{name:'邓小平',lockedPersonaId:'deng_xiaoping'},specialLife:{kind:'deng_ocean',body:'small_fish'}};
  assert.equal(getPortrait(game).src, './characters/deng-blobfish-pixel.webp');
  assert.ok(fs.existsSync(path.resolve('public', getPortrait(game).src)));
  game.specialLife.body='human';
  assert.equal(getPortrait(game).src, './portraits/pixel-deng-xiaoping.webp');
});

test('portrait identity remains stable across time travel, ageing and relocation', () => {
  const profile={name:'原创甲',age:20,place:'河南'};
  const old={profile,month:24,turn:24,location:'河南'};
  const jumped={...old,month:-528,turn:25,location:'日本',person:{ageOverride:{months:216,turn:25}}};
  assert.equal(portraitIdentity(old), portraitIdentity(jumped));
  assert.equal(getPortrait(jumped).age, 18);
  assert.equal(getPortrait({...jumped,turn:37}).age, 19);
});

test('ordinary age follows monthly progression and public birthday has correct completed years', () => {
  assert.equal(getPortrait({profile:{name:'原创乙',age:15,startAgeMonths:180},month:24}).age,17);
  assert.equal(getPortrait({profile:{name:'毛泽东',birthDate:'1893-12-26'},month:0}).age,126);
  assert.equal(getPortrait({profile:{name:'甲',birthDate:'2000-12-26'},month:11}).age,19);
});

test('original portrait follows physical age rather than assigning adults to children or older people', () => {
  const state={profile:{name:'原创丙',age:15,portraitPresentation:'female'},month:0};
  const child=getPortrait(state);assert.equal(child.ageVariant,'child');assert.match(child.src,/^data:image\/svg\+xml/);
  state.month=24;
  const adult=getPortrait(state);assert.equal(adult.ageVariant,'adult');assert.notEqual(adult.src,child.src);
  state.person={ageOverride:{months:840,turn:24}};state.turn=24;
  const older=getPortrait(state);assert.equal(older.ageVariant,'older');assert.notEqual(older.src,adult.src);
  state.month=-528;
  assert.equal(getPortrait(state).src,older.src);
});

test('different original identities have stable personal styling and never reuse a known-person portrait', () => {
  const a=getPortrait({name:'原创甲',age:25}), b=getPortrait({name:'原创乙',age:25});
  assert.notEqual(a.identityKey,b.identityKey);
  assert.notEqual(a.variant,b.variant);
  assert.equal(a.kind,'original');
  assert.ok(!Object.values(manifest.people).some(p=>p.src===a.src));
  assert.deepEqual(getPortrait({name:'原创甲',age:25}),a);
});

test('raw SVG, remote URL and oversized payload are not portrait upload records', () => {
  assert.equal(isSafePortraitDataUrl('data:image/svg+xml;base64,PHN2Zz4='),false);
  assert.equal(isSafePortraitDataUrl('https://example.com/face.png'),false);
  assert.equal(isSafePortraitDataUrl('data:image/webp;base64,'+'A'.repeat(1_500_000)),false);
  assert.equal(isSafePortraitDataUrl('data:image/webp;base64,UklGRg=='),true);
});

test('upload rejects unsupported files before opening storage or decoding', async () => {
  await assert.rejects(setCustomPortrait({}, {type:'image/svg+xml',size:100}),/PNG/);
  await assert.rejects(setCustomPortrait({}, {type:'image/png',size:13_000_000}),/12 MB/);
  assert.equal(await loadPortraitOverrides(),0);
});

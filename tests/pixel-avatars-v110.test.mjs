import test from 'node:test';
import assert from 'node:assert/strict';
import {createPixelAvatar} from '../src/pixel-avatars.js';
import {getPortrait,getContactPortrait,contactPortraitValue} from '../src/portraits.js';

test('each life and contact receives a distinct deterministic pixel portrait without changing saved state',()=>{
  const state={seed:'life-one',month:0,profile:{name:'周宁',age:24,place:'河南'},relationshipGraph:{nodes:[{id:'player',name:'周宁'},{id:'contact:lin',name:'林可'},{id:'contact:zhou',name:'周然'}]}},before=structuredClone(state);
  const player=getPortrait(state),lin=getContactPortrait(state,state.relationshipGraph.nodes[1]),zhou=getContactPortrait(state,state.relationshipGraph.nodes[2]);
  assert.equal(player.artworkStyle,'anime-pixel');assert.equal(lin.kind,'original');assert.equal(lin.sourceStatus,'generated-pixel');
  assert.equal(new Set([player.src,lin.src,zhou.src]).size,3);
  assert.deepEqual(getPortrait(JSON.parse(JSON.stringify(state))),player);
  assert.equal(getContactPortrait(JSON.parse(JSON.stringify(state)),{id:'contact:lin',name:'林可'}).src,lin.src);
  assert.notEqual(getPortrait({...state,seed:'life-two'}).src,player.src);
  assert.equal(getPortrait({...state,month:72,turn:72,location:'日本'}).src,player.src);
  assert.deepEqual(state,before);
});

test('fixed portraits remain fixed, and missing historical references never receive random faces',()=>{
  const a={seed:'one'},b={seed:'two'},known={id:'persona:mitake_ran',name:'美竹兰',personaId:'mitake_ran'},missing={id:'persona:hu_chunhua',name:'胡春华',personaId:'hu_chunhua'};
  assert.equal(getContactPortrait(a,known).src,getPortrait({name:'美竹兰'}).src);
  assert.equal(getContactPortrait(a,known).src,getContactPortrait(b,known).src);
  assert.equal(getContactPortrait(a,missing).src,null);
  assert.equal(getContactPortrait(a,missing).kind,'missing');
  assert.equal(getContactPortrait(a,{id:'relative:real-mother',name:'母亲',referenceRequired:true}).kind,'missing');
  assert.equal(getContactPortrait(a,{id:'relative:real-mother',name:'母亲',referenceRequired:true}).src,null);
  assert.equal(contactPortraitValue(a,{id:'player'}),a);
});

test('one thousand unrelated people have different artwork, not just different metadata',()=>{
  const urls=new Set();for(let i=0;i<1000;i++)urls.add(createPixelAvatar({seed:'sample-life',identity:`contact:${i}`}).src);
  assert.equal(urls.size,1000);
  // Eviction cannot affect a person's appearance.
  const first=createPixelAvatar({seed:'sample-life',identity:'contact:0'}).src;
  for(let i=1000;i<1700;i++)createPixelAvatar({seed:'sample-life',identity:`contact:${i}`});
  assert.equal(createPixelAvatar({seed:'sample-life',identity:'contact:0'}).src,first);
});

test('avatar output is inert self-contained pixel geometry and never embeds names or seed text',()=>{
  const marker='<script>alert("external")</script><image href="https://bad.example/a"/>',result=createPixelAvatar({seed:marker,identity:marker});
  const svg=decodeURIComponent(result.src.split(',')[1]);
  assert.match(svg,/viewBox="0 0 64 64"/);assert.match(svg,/shape-rendering="crispEdges"/);
  assert.doesNotMatch(svg,/<(?:script|image|foreignObject|animate)|(?:href|onload)=/);assert.equal(svg.includes(marker),false);
  assert.equal(result.style,'image-rendering:pixelated;');
});

test('age changes preserve face traits and appearance preference is independent of ethnicity',()=>{
  const state={seed:'familiar',profile:{name:'原创',age:25,identity:{sex:'female',ethnicity:'自定义族裔'}}},portrait=getPortrait(state);
  assert.equal(portrait.presentation,'female');
  assert.equal(getPortrait({...state,profile:{...state.profile,identity:{sex:'female',ethnicity:'另一个族裔'}}}).src,portrait.src);
  const older=getPortrait({...state,person:{ageOverride:{months:840,turn:0}},turn:0});assert.deepEqual(older.traits,portrait.traits);assert.notEqual(older.src,portrait.src);
  assert.equal(getPortrait({...state,profile:{...state.profile,portraitPresentation:'neutral'}}).presentation,'neutral');
});

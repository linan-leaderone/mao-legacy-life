import test from 'node:test';
import assert from 'node:assert/strict';
import {createFishGame,stepFishGame,fishGameResult,wantsFishGame,isOceanFish,openFishGame,FISH_DURATION_MS} from '../src/fish-game.js';
import {getPortrait} from '../src/portraits.js';

const ocean={specialLife:{kind:'deng_ocean',body:'small_fish'}};
test('catching smaller fish grows the body and produces a bounded action payload',()=>{
  const m=createFishGame(()=>.5);m.fish=[{x:m.player.x,y:m.player.y,r:8,direction:1,speed:0,color:0}];
  const radius=m.player.r;
  stepFishGame(m,16,{},()=>.5);
  assert.equal(m.eaten,1);assert.ok(m.player.r>radius);
  assert.deepEqual(fishGameResult(m),{eaten:1,growth:1,elapsedMs:16});
  assert.equal(m.fish.length,1);assert.notEqual(m.fish[0].x,m.player.x);
});
test('the initial frame cannot consume overlapping fish without any elapsed time',()=>{
  const m=createFishGame(()=>.5);m.fish=[{x:m.player.x,y:m.player.y,r:8,direction:1,speed:0,color:0}];
  stepFishGame(m,0);assert.deepEqual(fishGameResult(m),{eaten:0,growth:0,elapsedMs:0});
});
test('larger fish are not consumed and movement stays inside the sea',()=>{
  const m=createFishGame(()=>.5);m.fish=[{x:m.player.x,y:m.player.y,r:90,direction:1,speed:0}];
  stepFishGame(m,16);assert.equal(m.eaten,0);
  for(let i=0;i<400;i++)stepFishGame(m,50,{x:10000,y:-10000});
  assert.ok(m.player.x<=m.width-m.player.r);assert.ok(m.player.y>=m.player.r);
});
test('pause, hidden-time clamp, and completion cannot accumulate extra rewards',()=>{
  const m=createFishGame(()=>.5);m.paused=true;
  const before=structuredClone(m);stepFishGame(m,100000,{dx:1000});assert.deepEqual(m,before);
  m.paused=false;m.fish=[];stepFishGame(m,100000);assert.equal(m.elapsedMs,80);
  m.elapsedMs=FISH_DURATION_MS-10;stepFishGame(m,40);assert.equal(m.done,true);
  const complete=structuredClone(m);stepFishGame(m,1000,{dx:1000});assert.deepEqual(m,complete);
  assert.equal(fishGameResult(m).elapsedMs,FISH_DURATION_MS);
});
test('only an ocean fish accepting a hunt opens the minigame; retries preserve its result',()=>{
  assert.equal(isOceanFish(ocean),true);assert.equal(wantsFishGame(ocean,{label:'寻找合适的猎物，吞噬后继续进化'}),true);
  assert.equal(wantsFishGame(ocean,{label:'继续捕食小鱼',custom:true}),true);
  assert.equal(wantsFishGame(ocean,{label:'不要吃小鱼，我休息'}),false);
  assert.equal(wantsFishGame(ocean,{label:'照常生活',passive:true}),false);
  assert.equal(wantsFishGame(ocean,{label:'继续捕食',meta:{fishGame:{eaten:12,growth:6,elapsedMs:45000}}}),false);
  assert.equal(wantsFishGame({specialLife:{kind:'deng_ocean',body:'human'}},{label:'吃小鱼'}),false);
  assert.equal(wantsFishGame({specialLife:{kind:'mao_resurrection',body:'preserved'}},{label:'吃小鱼'}),false);
});
test('keyboard movement can override a pointer destination and reward output is capped',()=>{
  const m=createFishGame(()=>.5);m.fish=[];const start=m.player.x;
  stepFishGame(m,50,{dx:-1000,x:900,y:270});assert.ok(m.player.x<start);
  m.mass=1000000;m.eaten=600;m.elapsedMs=90000;
  assert.deepEqual(fishGameResult(m),{eaten:500,growth:20,elapsedMs:45000});
});

function browserHarness(){
  class Element extends EventTarget{
    constructor(){super();this.removed=false;this.focused=false;this.textContent='';this.disabled=false;}
    remove(){this.removed=true;}
    focus(){this.focused=true;}
    setAttribute(){}
    showModal(){this.open=true;}
    close(){this.open=false;this.dispatchEvent(new Event('close'));}
  }
  const window=new Element(),document=new Element(),dialog=new Element(),canvas=new Element();
  const drawnImages=[],loadedImages=[],noop=()=>{};const context=new Proxy({createLinearGradient:()=>({addColorStop:noop}),drawImage:(image,...args)=>drawnImages.push({image,args})},{get:(target,key)=>target[key]||noop});
  canvas.getContext=()=>context;canvas.getBoundingClientRect=()=>({left:0,top:0,width:960,height:540});
  const controls=Object.fromEntries(['[data-fish-pause]','[data-fish-finish]','.fish-status','[data-fish-eaten]','[data-fish-growth]','[data-fish-time]'].map(key=>[key,new Element()]));
  const exits=[new Element(),new Element()];
  dialog.querySelector=key=>key==='canvas'?canvas:controls[key];dialog.querySelectorAll=()=>exits;
  document.body={append:noop};document.createElement=()=>dialog;
  let scheduled,frameId=0,cancelled=0;
  window.requestAnimationFrame=fn=>{scheduled=fn;return ++frameId;};window.cancelAnimationFrame=()=>{cancelled++;scheduled=null;};
  window.Image=class{constructor(){this.complete=true;this.naturalWidth=64;this.naturalHeight=64;loadedImages.push(this);}};
  return {document,window,dialog,canvas,controls,exits,drawnImages,loadedImages,tick:now=>{const fn=scheduled;scheduled=null;fn?.(now);},cancelled:()=>cancelled};
}
test('exiting or dismissing the overlay resolves cancellation without a harvest',async()=>{
  for(const closeBy of ['button','escape','close']){
    const env=browserHarness(),result=openFishGame(env);
    if(closeBy==='button')env.exits[0].dispatchEvent(new Event('click'));
    else if(closeBy==='escape')env.dialog.dispatchEvent(new Event('cancel',{cancelable:true}));
    else env.dialog.close();
    assert.equal(await result,null);assert.equal(env.dialog.removed,true);assert.equal(env.cancelled(),1);
  }
});
test('finishing resolves one payload and tears down the frame even when close fires again',async()=>{
  const env=browserHarness(),result=openFishGame(env);
  env.controls['[data-fish-finish]'].dispatchEvent(new Event('click'));
  env.dialog.dispatchEvent(new Event('close'));env.controls['[data-fish-finish]'].dispatchEvent(new Event('click'));
  assert.deepEqual(await result,{eaten:0,growth:0,elapsedMs:0});assert.equal(env.cancelled(),1);assert.equal(env.dialog.removed,true);
});
test('hiding the app pauses the live overlay and returning never awards hidden time',async()=>{
  const env=browserHarness(),result=openFishGame(env);
  env.tick(100);env.document.hidden=true;env.document.dispatchEvent(new Event('visibilitychange'));env.tick(100000);
  assert.equal(env.controls['[data-fish-pause]'].textContent,'继续游动');
  env.controls['[data-fish-finish]'].dispatchEvent(new Event('click'));
  assert.equal((await result).elapsedMs,0);
});

test('ocean play keeps the blobfish body and marks it with the current personal portrait',async()=>{
  const playerState={profile:{name:'邓小平'},specialLife:{kind:'deng_ocean',body:'predator'}},before=structuredClone(playerState),env=browserHarness();
  const promise=openFishGame({...env,playerState});env.tick(100);
  const src=getPortrait(playerState).src;
  assert.ok(env.drawnImages.some(item=>item.image.src===src&&item.args.length===8));
  assert.ok(env.drawnImages.some(item=>item.image.src.includes('deng-blobfish')&&item.args.length===4));
  env.controls['[data-fish-finish]'].dispatchEvent(new Event('click'));
  assert.deepEqual(await promise,{eaten:0,growth:0,elapsedMs:0});assert.deepEqual(playerState,before);
});

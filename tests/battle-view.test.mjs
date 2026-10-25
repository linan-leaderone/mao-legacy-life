import test from 'node:test';
import assert from 'node:assert/strict';
import {openBattleGame} from '../src/battle-view.js';
import {getPortrait} from '../src/portraits.js';

function offer(enemyCount=3){
  return {id:`ui-battle-${enemyCount}`,version:2,kind:'combat',combatMode:enemyCount<=9?'turn-based':'realtime',participantCount:enemyCount+1,enemyCount,allyCount:0,seed:17,terrain:'street',player:{health:100,ammo:0,bait:0,armor:100,skill:20,speed:170,meleeDamage:25,rangedDamage:0,immune:false}};
}
function event(type,properties={}){const value=new Event(type,{cancelable:true});Object.assign(value,properties);return value;}

// The harness dispatches real DOM EventTarget events and records every registered
// listener, animation frame, pointer capture and observer; no battle internals are exposed.
function browserHarness(){
  const elements=[],frames=new Map(),observers=[],drawnImages=[],loadedImages=[];let nextFrame=0,cancelled=0,animationRequests=0;
  class Element extends EventTarget{
    constructor(tag='div'){
      super();this.tagName=tag.toUpperCase();this.removed=false;this.isConnected=true;this.textContent='';this.disabled=false;this.hidden=false;this.children=[];this.style={};this.attributes=new Map();this.handlers=new Map();this.captures=new Set();this.classes=new Set();
      this.classList={toggle:(name,force)=>force?this.classes.add(name):this.classes.delete(name)};elements.push(this);
    }
    addEventListener(type,handler,options){super.addEventListener(type,handler,options);if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(handler);}
    removeEventListener(type,handler,options){super.removeEventListener(type,handler,options);this.handlers.get(type)?.delete(handler);}
    append(...children){this.children.push(...children);children.forEach(child=>child.parent=this);}
    replaceChildren(...children){this.children=[];this.append(...children);}
    remove(){this.removed=true;this.isConnected=false;}
    focus(){document.activeElement=this;this.focused=(this.focused||0)+1;}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    getAttribute(name){return this.attributes.get(name);}
    contains(element){return element===this||this.children.some(child=>child.contains(element));}
    showModal(){this.open=true;}
    close(){this.open=false;this.dispatchEvent(event('close'));}
    setPointerCapture(id){this.captures.add(id);}
    hasPointerCapture(id){return this.captures.has(id);}
    releasePointerCapture(id){this.captures.delete(id);this.dispatchEvent(event('lostpointercapture',{pointerId:id}));}
  }
  const window=new Element('window'),document=new Element('document'),dialog=new Element('dialog'),canvas=new Element('canvas'),mini=new Element('canvas'),previousFocus=new Element('button'),noop=()=>{};
  for(const item of [canvas,mini]){const context=new Proxy({drawImage:(image,...args)=>drawnImages.push({image,args,canvas:item})},{get:(target,key)=>target[key]||noop});item.getContext=()=>context;item.getBoundingClientRect=()=>({left:0,top:0,width:item===mini?240:960,height:item===mini?135:540});}
  const selectors=['#battle-title','.battle-eyebrow','#battle-help','.battle-status','.battle-pause','.battle-confirm','.battle-overlay','.battle-log ol','.battle-target','.battle-roster','.battle-map-panel','.battle-roster-list','[data-health]','[data-supplies]','[data-clock-label]','[data-clock]','[data-force]','[data-casualties]','.battle-actions'];
  const controls=Object.fromEntries(selectors.map(key=>[key,new Element()]));controls['.battle-confirm'].disabled=true;
  const overlayText={strong:new Element('strong'),span:new Element('span')};controls['.battle-overlay'].querySelector=selector=>overlayText[selector];
  dialog.querySelector=key=>key==='.battle-canvas'?canvas:key==='.battle-minimap'?mini:controls[key];
  const exits=[new Element('button'),new Element('button')];dialog.querySelectorAll=()=>exits;dialog.append(canvas,mini,...Object.values(controls),...exits);
  document.body=new Element('body');document.activeElement=previousFocus;document.hidden=false;document.createElement=tag=>tag==='dialog'?dialog:new Element(tag);
  window.devicePixelRatio=2;window.requestAnimationFrame=callback=>{animationRequests++;frames.set(++nextFrame,callback);return nextFrame;};window.cancelAnimationFrame=id=>{frames.delete(id);cancelled++;};
  window.Image=class{constructor(){this.complete=true;this.naturalWidth=64;this.naturalHeight=64;loadedImages.push(this);}};
  window.ResizeObserver=class{constructor(callback){this.callback=callback;this.targets=[];this.disconnected=false;observers.push(this);}observe(target){this.targets.push(target);}disconnect(){this.disconnected=true;}};
  const action=type=>controls['.battle-actions'].children.find(button=>button.className.includes(`battle-action-${type}`));
  return {window,document,dialog,canvas,mini,controls,exits,previousFocus,action,drawnImages,loadedImages,
    tick:now=>{const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback(now));},
    frameCount:()=>frames.size,animationRequests:()=>animationRequests,cancelled:()=>cancelled,
    listenerCount:()=>elements.reduce((total,element)=>total+[...element.handlers.values()].reduce((n,set)=>n+set.size,0),0),
    captures:()=>elements.reduce((n,element)=>n+element.captures.size,0),observers};
}

test('battle cancellation paths resolve null and remove frames, listeners, captures and observers',async()=>{
  for(const enemyCount of [3,10])for(const path of ['button','cancel','escape','close']){
    const env=browserHarness(),source=offer(enemyCount),before=structuredClone(source),promise=openBattleGame(source,env);
    if(enemyCount===10){env.canvas.dispatchEvent(event('pointerdown',{button:0,pointerId:19,clientX:440,clientY:270}));env.tick(100);env.tick(200);assert.equal(env.captures(),1);}
    if(path==='button')env.exits[0].dispatchEvent(event('click'));
    else if(path==='cancel')env.dialog.dispatchEvent(event('cancel'));
    else if(path==='escape')env.dialog.dispatchEvent(event('keydown',{key:'Escape',code:'Escape',repeat:false}));
    else env.dialog.close();
    assert.equal(await promise,null);assert.deepEqual(source,before);assert.equal(env.dialog.removed,true);assert.equal(env.frameCount(),0);assert.equal(env.listenerCount(),0);assert.equal(env.captures(),0);assert.equal(env.cancelled(),1);assert.ok(env.observers.every(observer=>observer.disconnected));assert.equal(env.document.activeElement,env.previousFocus);
  }
});

test('an unfinished encounter cannot be confirmed, and completed retreat waits for explicit confirmation',async()=>{
  for(const enemyCount of [3,10]){
    const env=browserHarness(),promise=openBattleGame(offer(enemyCount),env),confirm=env.controls['.battle-confirm'];
    assert.equal(confirm.disabled,true);confirm.dispatchEvent(event('click'));assert.equal(env.dialog.removed,false);assert.equal(env.cancelled(),0);
    for(let count=0;count<5&&confirm.disabled;count++)env.action('escape').dispatchEvent(event('click'));
    assert.equal(confirm.disabled,false);assert.equal(env.dialog.removed,false);assert.equal(env.action('attack').disabled,true);
    confirm.dispatchEvent(event('click'));env.dialog.dispatchEvent(event('close'));const result=await promise;
    assert.equal(result.completed,true);assert.equal(result.outcome,'escaped');assert.equal(result.escaped,true);assert.equal(env.cancelled(),1);assert.equal(env.listenerCount(),0);
  }
});

test('hidden-page duration does not consume the one-minute battle and pause blocks actions',async()=>{
  const env=browserHarness(),promise=openBattleGame(offer(10),env);
  env.tick(100);env.tick(1100);assert.equal(env.controls['[data-clock]'].textContent,'59秒');
  env.document.hidden=true;env.document.dispatchEvent(event('visibilitychange'));env.tick(101100);
  assert.equal(env.controls['.battle-pause'].textContent,'继续');assert.equal(env.controls['[data-clock]'].textContent,'59秒');assert.equal(env.action('attack').disabled,true);
  env.action('escape').dispatchEvent(event('click'));assert.equal(env.controls['.battle-confirm'].disabled,true);
  env.document.hidden=false;env.controls['.battle-pause'].dispatchEvent(event('click'));env.tick(101200);env.tick(160200);
  assert.equal(env.controls['[data-clock]'].textContent,'0秒');assert.equal(env.controls['.battle-confirm'].disabled,false);
  env.controls['.battle-confirm'].dispatchEvent(event('click'));const result=await promise;
  assert.equal(result.elapsedMs,60000);assert.equal(result.outcome,'timeout');assert.equal(result.completed,true);assert.equal(env.frameCount(),0);
});

test('turn-based waiting schedules no timer and only deliberate actions advance rounds',async()=>{
  const env=browserHarness(),promise=openBattleGame(offer(3),env),source=offer(3);
  assert.equal(env.controls['[data-clock]'].textContent,'1');assert.equal(env.animationRequests(),0);env.tick(100);env.tick(1000000);assert.equal(env.controls['[data-clock]'].textContent,'1');
  assert.equal(env.controls['.battle-roster-list'].children.length,source.participantCount);assert.equal(env.controls['.battle-map-panel'].hidden,true);
  env.action('defend').dispatchEvent(event('click'));assert.equal(env.controls['[data-clock]'].textContent,'2');
  env.dialog.dispatchEvent(event('keydown',{key:'ArrowRight',code:'ArrowRight',repeat:true}));assert.equal(env.controls['[data-clock]'].textContent,'2');
  env.controls['.battle-pause'].dispatchEvent(event('click'));env.action('defend').dispatchEvent(event('click'));env.tick(2000000);assert.equal(env.controls['[data-clock]'].textContent,'2');
  env.exits[1].dispatchEvent(event('click'));assert.equal(await promise,null);
});

test('target selection remains separate from an attack and pointer release/blur clears movement',async()=>{
  const env=browserHarness(),promise=openBattleGame(offer(3),env),targets=env.controls['.battle-roster-list'].children;
  targets[2].dispatchEvent(event('click'));assert.match(env.controls['.battle-target'].textContent,/对方 2/);assert.equal(env.controls['[data-clock]'].textContent,'1');
  env.exits[0].dispatchEvent(event('click'));assert.equal(await promise,null);
  const realtime=browserHarness(),other=openBattleGame(offer(10),realtime);
  realtime.canvas.dispatchEvent(event('pointerdown',{button:0,pointerId:5,clientX:480,clientY:270}));assert.equal(realtime.captures(),1);
  realtime.canvas.dispatchEvent(event('pointerup',{pointerId:5}));assert.equal(realtime.captures(),0);
  realtime.canvas.dispatchEvent(event('pointerdown',{button:0,pointerId:6,clientX:480,clientY:270}));realtime.window.dispatchEvent(event('blur'));assert.equal(realtime.captures(),0);assert.equal(realtime.controls['.battle-pause'].textContent,'继续');
  assert.equal(realtime.controls['.battle-map-panel'].hidden,false);assert.equal(realtime.canvas.width,1920);assert.equal(realtime.mini.width,480);
  realtime.exits[0].dispatchEvent(event('click'));assert.equal(await other,null);
});

test('unavailable browser surfaces resolve without creating a battle',async()=>{
  assert.equal(await openBattleGame(offer(),{document:null,window:null}),null);
});

test('the same personal portrait marks the battle field, roster and realtime minimap without entering results',async()=>{
  for(const enemyCount of [3,10]){
    const playerState={profile:{name:'林海',place:'上海',seed:'avatar-battle',age:24}},before=structuredClone(playerState);
    const env=browserHarness(),promise=openBattleGame(offer(enemyCount),{...env,playerState}),src=getPortrait(playerState).src;
    assert.ok(env.drawnImages.some(item=>item.canvas===env.canvas&&item.image.src===src));
    if(enemyCount>9)assert.ok(env.drawnImages.some(item=>item.canvas===env.mini&&item.image.src===src));
    else{const identity=env.controls['.battle-roster-list'].children[0].children[0];assert.equal(identity.children[0].src,src);assert.equal(identity.children[1].textContent,'林海');}
    env.exits[0].dispatchEvent(event('click'));assert.equal(await promise,null);
    assert.deepEqual(playerState,before);assert.ok(env.loadedImages.every(image=>image.onload===null&&image.onerror===null));
  }
});

import {createMinigameAvatar,mountMinigameIdentity,drawMinigameAvatar} from './minigame-avatar.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const FISH_DURATION_MS=45000;
const WIDTH=960,HEIGHT=540;
export const BLOBFISH_SPRITE='./characters/deng-blobfish-pixel.webp';

export function isOceanFish(state){
  return state?.specialLife?.kind==='deng_ocean'&&['small_fish','predator','giant_fish','sea_creature'].includes(state.specialLife.body);
}

export function wantsFishGame(state,action){
  if(!isOceanFish(state)||action?.meta?.fishGame||action?.passive)return false;
  const clauses=String(action?.label||'').split(/[，。；,;\n]/).filter(text=>!/(?:不要|不再|不想|没有|停止|放弃|拒绝|不去|不吃|不捕食|不吞噬)/.test(text));
  return clauses.some(text=>/捕食|吞噬|吃(?:掉|些|点|小鱼|鱼|猎物)|觅食/.test(text));
}

function spawnFish(model,random,initial=false){
  const r=6+random()*Math.min(21,9+model.eaten*.5),direction=random()<.5?-1:1;
  return {x:initial?random()*WIDTH:(direction>0?-r:WIDTH+r),y:25+random()*(HEIGHT-50),r,direction,speed:24+random()*48,color:Math.floor(random()*3)};
}

export function createFishGame(random=Math.random){
  const model={width:WIDTH,height:HEIGHT,elapsedMs:0,eaten:0,mass:0,paused:false,done:false,player:{x:WIDTH/2,y:HEIGHT/2,r:23,direction:1},fish:[]};
  model.fish=Array.from({length:30},()=>spawnFish(model,random,true));
  return model;
}

export function fishGameResult(model){
  return {eaten:clamp(Math.floor(model.eaten),0,500),growth:clamp(Math.round(Math.sqrt(model.mass)*1.8),0,20),elapsedMs:clamp(Math.round(model.elapsedMs),0,FISH_DURATION_MS)};
}

export function stepFishGame(model,deltaMs,input={},random=Math.random){
  if(model.paused||model.done)return model;
  const ms=Math.min(clamp(Number(deltaMs)||0,0,80),FISH_DURATION_MS-model.elapsedMs),dt=ms/1000;
  if(ms<=0)return model;
  model.elapsedMs=Math.min(FISH_DURATION_MS,model.elapsedMs+ms);
  const p=model.player;
  let dx=Number(input.dx)||0,dy=Number(input.dy)||0;
  if(!dx&&!dy&&Number.isFinite(input.x)&&Number.isFinite(input.y)){dx=input.x-p.x;dy=input.y-p.y;}
  const length=Math.hypot(dx,dy),step=Math.min(length,235*dt);
  if(length){p.x+=dx/length*step;p.y+=dy/length*step;if(dx)p.direction=dx>0?1:-1;}
  p.x=clamp(p.x,p.r,WIDTH-p.r);p.y=clamp(p.y,p.r,HEIGHT-p.r);
  model.fish=model.fish.map(f=>{
    f.x+=f.direction*f.speed*dt;
    if(f.r<p.r*.83&&Math.hypot(f.x-p.x,f.y-p.y)<p.r+f.r*.35){
      model.eaten++;model.mass+=(f.r/10)**2;p.r=clamp(23+Math.sqrt(model.mass)*3,23,66);
      return spawnFish(model,random);
    }
    return f.x<-80||f.x>WIDTH+80?spawnFish(model,random):f;
  });
  model.done=model.elapsedMs>=FISH_DURATION_MS;
  return model;
}

function drawFish(ctx,f,player=false,sprite=null){
  ctx.save();ctx.translate(f.x,f.y);ctx.scale(f.direction,1);
  if(player&&sprite?.complete&&sprite.naturalWidth){
    // The reference-derived front-quarter sprite has no fish scales or human features.
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(sprite,-f.r*1.65,-f.r*1.2,f.r*3.3,f.r*2.2);ctx.restore();return;
  }
  ctx.fillStyle=player?'#ddaaa2':['#e2b779','#a1cec6','#a5b9dc'][f.color];
  ctx.beginPath();ctx.moveTo(-f.r*.75,0);ctx.lineTo(-f.r*1.5,-f.r*.65);ctx.lineTo(-f.r*1.5,f.r*.65);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.ellipse(0,0,f.r*1.18,f.r*(player?0.9:0.58),0,0,Math.PI*2);ctx.fill();
  if(player){
    ctx.fillStyle='#eac0b8';ctx.beginPath();ctx.ellipse(f.r*.53,f.r*.16,f.r*.4,f.r*.28,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#805e64';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(f.r*.25,f.r*.55);ctx.quadraticCurveTo(f.r*.68,f.r*.38,f.r*.95,f.r*.49);ctx.stroke();
  }
  ctx.fillStyle=player?'#403e49':'#263b47';ctx.beginPath();ctx.arc(f.r*.55,-f.r*(player?0.2:0.15),Math.max(2,f.r*.09),0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawScene(ctx,model,sprite,avatar){
  const gradient=ctx.createLinearGradient(0,0,0,HEIGHT);gradient.addColorStop(0,'#174b61');gradient.addColorStop(1,'#091d32');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,WIDTH,HEIGHT);
  ctx.strokeStyle='#c9e4df15';ctx.lineWidth=1;
  for(let i=0;i<22;i++){const y=(HEIGHT-i*47+model.elapsedMs/-55)%HEIGHT;ctx.beginPath();ctx.arc((i*137)%WIDTH,(y+HEIGHT)%HEIGHT,2+i%4,0,Math.PI*2);ctx.stroke();}
  for(const f of model.fish)drawFish(ctx,f);
  drawFish(ctx,model.player,true,sprite);
  const markerY=Math.max(23,model.player.y-model.player.r*1.2-29);
  drawMinigameAvatar(ctx,avatar,model.player.x,markerY,16);
  ctx.fillStyle='#edf1df';ctx.textAlign='center';ctx.font='15px sans-serif';ctx.fillText(avatar?.name||'邓小平',model.player.x,Math.min(HEIGHT-12,model.player.y+model.player.r*1.2+19));
  if(model.paused||model.done){
    ctx.fillStyle='#071722b8';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.fillStyle='#f2ecdd';ctx.font='28px sans-serif';ctx.fillText(model.done?'这次觅食结束了':'停在这片海水里',WIDTH/2,HEIGHT/2-8);
    ctx.font='16px sans-serif';ctx.fillText(model.done?'点击「带着收获继续」记录这个月。':'点击「继续游动」返回。',WIDTH/2,HEIGHT/2+30);
  }
}

export function openFishGame({document:doc=globalThis.document,window:win=globalThis.window,playerState=null}={}){
  return new Promise(resolve=>{
    const dialog=doc.createElement('dialog');dialog.className='fish-dialog';dialog.setAttribute('aria-labelledby','fish-title');
    dialog.innerHTML='<div class="modal-header"><div><span class="eyebrow">太平洋 · 觅食</span><h2 id="fish-title">顺着鱼群游过去</h2><div data-minigame-identity></div></div><button type="button" data-fish-exit aria-label="退出觅食，不记录本次收获">×</button></div><p class="fish-instructions" id="fish-help">移动鼠标、按住屏幕拖动，或用方向键 / WASD 游动，靠近比自己小的鱼。随时可以带着收获继续，也可以退出这次觅食。</p><div class="fish-hud" aria-live="off"><span>已吃下 <strong data-fish-eaten>0</strong> 条</span><span>成长 <strong data-fish-growth>0</strong></span><span>剩余 <strong data-fish-time>45</strong> 秒</span></div><canvas class="fish-canvas" width="960" height="540" tabindex="0" aria-label="水滴鱼在太平洋觅食" aria-describedby="fish-help"></canvas><p class="fish-status" role="status">鱼群就在附近。开始游动吧。</p><div class="fish-buttons"><button type="button" class="quiet" data-fish-exit>退出，不记录</button><button type="button" class="secondary" data-fish-pause>暂停</button><button type="button" class="primary" data-fish-finish>带着收获继续 →</button></div>';
    doc.body.append(dialog);
    const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d');
    if(!ctx){dialog.remove();resolve(null);return;}
    const sprite=typeof win.Image==='function'?new win.Image():doc.createElement('img');sprite.src=BLOBFISH_SPRITE;
    const avatar=createMinigameAvatar(playerState||{profile:{name:'邓小平'},specialLife:{kind:'deng_ocean',body:'small_fish'}},{window:win});
    mountMinigameIdentity(dialog.querySelector('[data-minigame-identity]'),avatar,doc);
    const model=createFishGame(),keys=new Set(),input={};let frame=0,last=0,settled=false,displayedEaten=-1;
    const pause=dialog.querySelector('[data-fish-pause]'),status=dialog.querySelector('.fish-status');
    const listeners=[];
    const listen=(target,event,fn,opts)=>{target.addEventListener(event,fn,opts);listeners.push(()=>target.removeEventListener(event,fn,opts));};
    const finish=result=>{
      if(settled)return;settled=true;avatar.dispose();win.cancelAnimationFrame(frame);listeners.forEach(remove=>remove());
      if(dialog.open)dialog.close();dialog.remove();resolve(result);
    };
    const setPaused=value=>{if(model.done)return;model.paused=value;keys.clear();delete input.x;delete input.y;pause.textContent=value?'继续游动':'暂停';status.textContent=value?'已暂停，计时和收获都已停下。':'继续向鱼群游过去。';};
    listen(dialog,'cancel',event=>{event.preventDefault();finish(null);});
    listen(dialog,'close',()=>finish(null));
    dialog.querySelectorAll('[data-fish-exit]').forEach(button=>listen(button,'click',()=>finish(null)));
    listen(pause,'click',()=>{setPaused(!model.paused);canvas.focus({preventScroll:true});});
    listen(dialog.querySelector('[data-fish-finish]'),'click',()=>finish(fishGameResult(model)));
    const point=event=>{const r=canvas.getBoundingClientRect();if(r.width&&r.height){input.x=(event.clientX-r.left)/r.width*WIDTH;input.y=(event.clientY-r.top)/r.height*HEIGHT;}};
    listen(canvas,'pointerdown',event=>{event.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture?.(event.pointerId);point(event);});
    listen(canvas,'pointermove',event=>{if(event.pointerType==='mouse'||event.buttons)point(event);});
    listen(canvas,'keydown',event=>{
      const key=event.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)){event.preventDefault();keys.add(key);}
      if(event.code==='Space'){event.preventDefault();if(!event.repeat)setPaused(!model.paused);}
    });
    listen(win,'keyup',event=>keys.delete(event.key.toLowerCase()));
    listen(win,'blur',()=>setPaused(true));
    listen(doc,'visibilitychange',()=>{if(doc.hidden)setPaused(true);});
    const tick=now=>{
      if(settled)return;
      input.dx=((keys.has('arrowright')||keys.has('d'))?1000:0)-((keys.has('arrowleft')||keys.has('a'))?1000:0);
      input.dy=((keys.has('arrowdown')||keys.has('s'))?1000:0)-((keys.has('arrowup')||keys.has('w'))?1000:0);
      stepFishGame(model,last?now-last:0,input);last=now;
      drawScene(ctx,model,sprite,avatar);
      const result=fishGameResult(model);
      dialog.querySelector('[data-fish-eaten]').textContent=result.eaten;
      dialog.querySelector('[data-fish-growth]').textContent=result.growth;
      dialog.querySelector('[data-fish-time]').textContent=Math.ceil((FISH_DURATION_MS-model.elapsedMs)/1000);
      if(model.eaten!==displayedEaten){displayedEaten=model.eaten;status.textContent=model.eaten?`已经吃下 ${model.eaten} 条鱼，身体还在长大。`:'鱼群就在附近。开始游动吧。';}
      if(model.done){pause.disabled=true;status.textContent=`觅食结束，共吃下 ${result.eaten} 条鱼。收获尚未记入人生档案。`;return;}
      frame=win.requestAnimationFrame(tick);
    };
    dialog.showModal();canvas.focus({preventScroll:true});frame=win.requestAnimationFrame(tick);
  });
}

import {createBattleModel,performBattleAction,stepBattleGame,battleGameResult} from './battle-game.js';
import {createMinigameAvatar,mountMinigameIdentity,drawMinigameAvatar} from './minigame-avatar.js';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const living=unit=>unit.health>0;
const people=units=>units.filter(living).reduce((sum,unit)=>sum+(unit.count??1),0);
const round=value=>Math.max(0,Math.ceil(Number(value)||0));
const COLORS={player:'#f8e4a5',ally:'#91caba',enemy:'#e6a093',wall:'#718078',exit:'#9acfa9'};
const ACTIONS=[['进攻','attack','1'],['射击','ranged','2'],['防御','defend','3'],['包扎','heal','4'],['撤离','escape','5']];

function enemyName(unit,index,zombie){
  const name=unit.name||(zombie?({runner:'快步感染者',brute:'强壮感染者'}[unit.type]||'感染者'):'对方');
  return `${name} ${index+1}${unit.count>1?` · ${unit.count}人`:''}`;
}
function cameraFor(model){
  if(model.combatMode==='turn-based'||model.mode==='turn-based')return {x:0,y:0,w:model.width,h:model.height};
  const w=model.width*.62,h=model.height*.62;
  return {x:clamp(model.player.x-w/2,0,model.width-w),y:clamp(model.player.y-h/2,0,model.height-h),w,h};
}
function drawLabel(ctx,label,x,y,size=15,color='#e9e9dd',align='center'){
  ctx.font=`${size}px system-ui,sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(label,x,y);
}
function drawWorld(ctx,model,selected,mini=false,avatar=null){
  const terrain=model.offer.terrain,palette=terrain==='park'?['#344c3e','#718568','#20382a']:terrain==='industrial'?['#354047','#747b80','#202c32']:['#3b4848','#768078','#263232'];
  ctx.fillStyle=palette[0];ctx.fillRect(0,0,model.width,model.height);
  if(!mini){
    ctx.strokeStyle='#e6e8d00b';ctx.lineWidth=1;
    for(let x=0;x<model.width;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,model.height);ctx.stroke();}
    for(let y=0;y<model.height;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(model.width,y);ctx.stroke();}
  }
  for(const zone of model.slowZones||[]){ctx.fillStyle=zone.color||'#887952';ctx.globalAlpha=.7;ctx.fillRect(zone.x,zone.y,zone.w,zone.h);ctx.globalAlpha=1;if(!mini)drawLabel(ctx,zone.label||'碎石',zone.x+zone.w/2,zone.y+zone.h/2,15,'#ece1c7');}
  for(const obstacle of model.obstacles||[]){
    ctx.fillStyle=palette[2];ctx.fillRect(obstacle.x+5,obstacle.y+6,obstacle.w,obstacle.h);
    ctx.fillStyle=palette[1];ctx.fillRect(obstacle.x,obstacle.y,obstacle.w,obstacle.h);
    if(!mini){ctx.strokeStyle='#d8dfc538';ctx.lineWidth=2;ctx.strokeRect(obstacle.x+7,obstacle.y+7,obstacle.w-14,obstacle.h-14);
      if(terrain==='park'){ctx.fillStyle='#547b50';ctx.beginPath();ctx.arc(obstacle.x+obstacle.w/2,obstacle.y+obstacle.h/2,Math.min(obstacle.w,obstacle.h)*.3,0,Math.PI*2);ctx.fill();}
      else if(terrain==='industrial'){ctx.strokeStyle='#c4c8b338';for(let x=obstacle.x+14;x<obstacle.x+obstacle.w-10;x+=18){ctx.beginPath();ctx.moveTo(x,obstacle.y+12);ctx.lineTo(x,obstacle.y+obstacle.h-12);ctx.stroke();}}
      else{ctx.fillStyle='#b0bdb16e';for(let i=0;i<4;i++)ctx.fillRect(obstacle.x+13+(i%2)*obstacle.w*.46,obstacle.y+16+Math.floor(i/2)*obstacle.h*.45,obstacle.w*.2,obstacle.h*.18);}
    }
  }
  const exit=model.exit||{x:5,y:model.height/2-95,w:90,h:190};
  ctx.fillStyle='#92cfa34d';ctx.fillRect(exit.x,exit.y,exit.w,exit.h);ctx.strokeStyle=COLORS.exit;ctx.lineWidth=2;ctx.strokeRect(exit.x,exit.y,exit.w,exit.h);
  if(!mini){drawLabel(ctx,'出口',exit.x+exit.w/2,exit.y+exit.h/2,16,'#d7f4d2');drawLabel(ctx,'←',exit.x+exit.w/2,exit.y+exit.h/2+27,25,'#d7f4d2');}
  for(const bait of model.baits||[]){ctx.fillStyle='#e7c988';ctx.beginPath();ctx.arc(bait.x,bait.y,mini?8:6,0,Math.PI*2);ctx.fill();}
  const drawUnit=(unit,color,label,player=false)=>{
    if(!living(unit))return;
    const radius=mini?(player?36:9):(player?Math.max(20,unit.r||13):(unit.r||13));
    ctx.fillStyle='#15272070';ctx.beginPath();ctx.ellipse(unit.x+2,unit.y+radius*.8,radius*1.1,radius*.45,0,0,Math.PI*2);ctx.fill();
    if(!mini&&unit.id===selected&&!player){ctx.strokeStyle='#ffedd0';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(unit.x,unit.y,radius+7,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    if(player)drawMinigameAvatar(ctx,avatar,unit.x,unit.y,radius,{ring:color,ringWidth:mini?6:3});
    else{ctx.fillStyle=color;ctx.strokeStyle='#20362f';ctx.lineWidth=mini?3:2;ctx.beginPath();ctx.arc(unit.x,unit.y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();}
    if(!mini){
      const max=unit.maxHealth||100;
      ctx.fillStyle='#14271f';ctx.fillRect(unit.x-19,unit.y-radius-16,38,4);ctx.fillStyle=color;ctx.fillRect(unit.x-19,unit.y-radius-16,38*clamp(unit.health/max,0,1),4);
      if(player||model.combatMode==='turn-based'||model.mode==='turn-based'||unit.count>1)drawLabel(ctx,unit.count>1?`${unit.count}人`:label,unit.x,unit.y+radius+18,13);
      if(player&&unit.defending){ctx.strokeStyle='#d5e7e6';ctx.lineWidth=3;ctx.beginPath();ctx.arc(unit.x,unit.y,radius+6,-Math.PI*.8,Math.PI*.2);ctx.stroke();}
    }
  };
  (model.allies||[]).forEach((unit,index)=>drawUnit(unit,COLORS.ally,`同伴${index+1}`));
  (model.enemies||[]).forEach((unit,index)=>drawUnit(unit,COLORS.enemy,`对方${index+1}`));
  for(const flash of (model.flashes||[]).slice(-12)){if(mini)continue;ctx.strokeStyle=flash.ranged?'#fbe3a1':'#f1d4bd';ctx.lineWidth=flash.ranged?2:6;ctx.beginPath();ctx.moveTo(flash.x,flash.y);ctx.lineTo(flash.toX,flash.toY);ctx.stroke();}
  drawUnit(model.player,COLORS.player,'你',true);
}

/** Battle results remain private to this dialog until the completed encounter is confirmed. */
export function openBattleGame(offer,{document:doc=globalThis.document,window:win=globalThis.window,playerState=null}={}){
  return new Promise(resolve=>{
    if(!doc?.createElement||!win?.requestAnimationFrame){resolve(null);return;}
    const model=createBattleModel(offer),turnBased=(model.combatMode||model.mode||offer.combatMode)==='turn-based';
    const previousFocus=doc.activeElement,dialog=doc.createElement('dialog');
    dialog.className=`battle-dialog ${turnBased?'battle-turn-based':'battle-realtime'}`;
    dialog.setAttribute('aria-labelledby','battle-title');
    dialog.innerHTML=`<header class="battle-header"><div><span class="battle-eyebrow"></span><h2 id="battle-title"></h2><div data-minigame-identity></div></div><button type="button" class="battle-close" aria-label="离开，不记录" data-battle-exit>×</button></header>
      <p class="battle-help" id="battle-help"></p><div class="battle-hud"><div><span>生命</span><strong data-health></strong></div><div><span>弹药 / 包扎</span><strong data-supplies></strong></div><div class="battle-clock"><span data-clock-label></span><strong data-clock></strong></div></div>
      <div class="battle-field-layout"><div class="battle-stage"><canvas class="battle-canvas" tabindex="0" aria-label="眼前的战场" aria-describedby="battle-help"></canvas><div class="battle-overlay" hidden><strong></strong><span></span></div></div>
      <aside class="battle-map-panel"><div class="battle-map-heading"><h3>周围地形</h3><span>全景</span></div><canvas class="battle-minimap" aria-label="小地图：本人头像、同伴、对方、出口、障碍和当前视野"></canvas><p class="battle-map-legend"><span class="battle-legend-you">◎ 你</span><span class="battle-legend-ally">● 同伴</span><span class="battle-legend-enemy">● 对方</span><span>□ 视野</span><span>▧ 障碍</span><span class="battle-legend-exit">▯ 出口</span></p><div class="battle-situation" aria-live="off"><strong data-force></strong><span data-casualties></span></div></aside></div>
      <section class="battle-roster" aria-label="在场的人"><div class="battle-roster-heading"><h3>在场的人</h3><span>点击对方，选择目标</span></div><div class="battle-roster-list"></div></section>
      <div class="battle-target" aria-live="polite"></div><div class="battle-actions" aria-label="行动"></div><p class="battle-status" role="status"></p><details class="battle-log"><summary>现场记录</summary><ol aria-live="polite" aria-relevant="additions text"></ol></details>
      <footer class="battle-footer"><button type="button" class="battle-exit" data-battle-exit>离开，不记录</button><button type="button" class="battle-pause">暂停</button><button type="button" class="battle-confirm" disabled>继续这段经历 →</button></footer>`;
    dialog.querySelector('#battle-title').textContent=offer.title||(offer.kind==='zombie'?'眼前的感染者':'交锋');
    dialog.querySelector('.battle-eyebrow').textContent=`${model.participantCount}人在场 · ${turnBased?'轮流行动':'交战中'}`;
    dialog.querySelector('#battle-help').textContent=turnBased?'选择目标后采取行动。点击空地可走近，行进也算一次行动；你停下来考虑时，其他人会等待。':'按住战场移动，松手停下；也可以用方向键或 WASD。寻找掩护，留意右侧小地图，需撤离时走到绿色出口。';
    const canvas=dialog.querySelector('.battle-canvas'),mini=dialog.querySelector('.battle-minimap'),ctx=canvas.getContext('2d'),miniCtx=mini.getContext('2d');
    if(!ctx||!miniCtx){resolve(null);return;}
    const status=dialog.querySelector('.battle-status'),pauseButton=dialog.querySelector('.battle-pause'),confirmButton=dialog.querySelector('.battle-confirm'),overlay=dialog.querySelector('.battle-overlay'),logList=dialog.querySelector('.battle-log ol'),targetLabel=dialog.querySelector('.battle-target');
    dialog.querySelector('.battle-roster').hidden=!turnBased;dialog.querySelector('.battle-map-panel').hidden=turnBased;targetLabel.hidden=!turnBased;
    const listeners=[],keys=new Set(),input={},actionButtons=new Map(),rosterRows=new Map();
    let settled=false,frame=0,last=0,pointerId=null,selected=model.enemies.find(living)?.id??null,previousLog='',resizeObserver=null;
    const avatar=createMinigameAvatar(playerState,{window:win,onReady:()=>{if(!settled)draw();}});
    mountMinigameIdentity(dialog.querySelector('[data-minigame-identity]'),avatar,doc);
    const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
    const releaseControls=()=>{
      keys.clear();for(const key of Object.keys(input))delete input[key];
      if(pointerId!==null){const released=pointerId;pointerId=null;try{if(canvas.hasPointerCapture?.(released))canvas.releasePointerCapture(released);}catch{}}
    };
    const finish=result=>{
      if(settled)return;settled=true;releaseControls();avatar.dispose();win.cancelAnimationFrame(frame);listeners.forEach(remove=>remove());resizeObserver?.disconnect();
      if(dialog.open)dialog.close();dialog.remove();if(previousFocus?.isConnected)previousFocus.focus?.({preventScroll:true});resolve(result);
    };
    const fitCanvas=(element,context)=>{
      const bounds=element.getBoundingClientRect(),width=Math.max(1,bounds.width),height=Math.max(1,bounds.height),dpr=clamp(win.devicePixelRatio||1,1,3);
      const pixelWidth=Math.round(width*dpr),pixelHeight=Math.round(height*dpr);
      if(element.width!==pixelWidth||element.height!==pixelHeight){element.width=pixelWidth;element.height=pixelHeight;}
      context.setTransform(pixelWidth/width,0,0,pixelHeight/height,0,0);return {width,height};
    };
    const draw=()=>{
      if(settled)return;
      const size=fitCanvas(canvas,ctx),camera=cameraFor(model);
      ctx.clearRect(0,0,size.width,size.height);ctx.save();ctx.scale(size.width/camera.w,size.height/camera.h);ctx.translate(-camera.x,-camera.y);drawWorld(ctx,model,selected,false,avatar);ctx.restore();
      if(!turnBased){
        const size=fitCanvas(mini,miniCtx);miniCtx.clearRect(0,0,size.width,size.height);miniCtx.save();miniCtx.scale(size.width/model.width,size.height/model.height);drawWorld(miniCtx,model,null,true,avatar);
        miniCtx.fillStyle='#ffffff0c';miniCtx.fillRect(camera.x,camera.y,camera.w,camera.h);miniCtx.strokeStyle='#f5edc7';miniCtx.lineWidth=5;miniCtx.strokeRect(camera.x+2,camera.y+2,camera.w-4,camera.h-4);miniCtx.restore();
      }
    };
    const addRoster=(unit,name,side)=>{
      const element=doc.createElement(side==='enemy'?'button':'div');element.className=`battle-person battle-person-${side}`;
      if(side==='enemy'){element.type='button';listen(element,'click',()=>{if(!model.done&&!model.paused){selected=unit.id;update();draw();}});}
      const heading=doc.createElement('strong'),health=doc.createElement('span'),meter=doc.createElement('span'),fill=doc.createElement('i');
      heading.textContent=name;meter.className='battle-person-meter';meter.append(fill);
      if(side==='you'){const identity=doc.createElement('div');mountMinigameIdentity(identity,avatar,doc);element.append(identity);}
      element.append(heading,health,meter);dialog.querySelector('.battle-roster-list').append(element);
      rosterRows.set(unit,{element,health,fill,side,maxHealth:side==='you'?100:unit.maxHealth||unit.health});
    };
    if(turnBased){addRoster(model.player,'你','you');model.allies.forEach((unit,index)=>addRoster(unit,unit.name||`同伴 ${index+1}`,'ally'));model.enemies.forEach((unit,index)=>addRoster(unit,enemyName(unit,index,offer.kind==='zombie'),'enemy'));}
    const update=()=>{
      const target=model.enemies.find(unit=>unit.id===selected&&living(unit));
      if(!target)selected=model.enemies.find(living)?.id??null;
      const current=model.enemies.find(unit=>unit.id===selected&&living(unit));
      dialog.querySelector('[data-health]').textContent=String(round(model.player.health));
      dialog.querySelector('[data-supplies]').textContent=`${round(model.player.ammo)} / ${round(model.player.medkits)}`;
      dialog.querySelector('[data-clock-label]').textContent=turnBased?'当前回合':'剩余时间';
      dialog.querySelector('[data-clock]').textContent=turnBased?String((model.turn||0)+1):`${Math.ceil(Math.max(0,(model.durationMs||60000)-model.elapsedMs)/1000)}秒`;
      dialog.querySelector('[data-force]').textContent=`同伴 ${people(model.allies)} · 对方 ${people(model.enemies)}`;
      dialog.querySelector('[data-casualties]').textContent=`已制服 ${round(model.kills)}人${model.allyLosses?` · 同伴倒下 ${round(model.allyLosses)}人`:''}`;
      if(turnBased){
        targetLabel.textContent=current?`当前目标：${enemyName(current,model.enemies.indexOf(current),offer.kind==='zombie')}`:'身边已经没有继续进攻的对方。';
        for(const [unit,row] of rosterRows){
          row.health.textContent=living(unit)?`生命 ${round(unit.health)} / ${round(row.maxHealth)}`:'已倒下';row.fill.style.width=`${clamp(unit.health/row.maxHealth,0,1)*100}%`;
          row.element.classList.toggle('battle-person-down',!living(unit));row.element.classList.toggle('battle-person-selected',row.side==='enemy'&&unit.id===selected&&living(unit));
          if(row.side==='enemy'){row.element.disabled=!living(unit)||model.done||model.paused;row.element.setAttribute('aria-pressed',String(unit.id===selected&&living(unit)));}
        }
      }
      for(const [type,button] of actionButtons){button.disabled=model.done||model.paused||(type==='ranged'&&!model.player.ammo)||(type==='heal'&&!model.player.medkits)||(type==='bait'&&!model.player.bait);}
      pauseButton.disabled=model.done;pauseButton.textContent=model.paused?'继续':'暂停';confirmButton.disabled=!model.done;
      overlay.hidden=!(model.done||model.paused);
      overlay.querySelector('strong').textContent=model.done?(model.player.health<=0?'你已经无法继续交锋':model.escaped||model.outcome==='escaped'?'你已离开交锋地点':people(model.enemies)===0?'对方已停止进攻':'这次交锋结束了'):'暂时停下';
      overlay.querySelector('span').textContent=model.done?'确认后，接着记录这次经历的后果。':'动作与计时都已暂停。';
      const lines=(model.log||[]).slice(-5),logText=lines.join('\n');
      if(logText!==previousLog){previousLog=logText;logList.replaceChildren(...lines.map(line=>{const li=doc.createElement('li');li.textContent=typeof line==='string'?line:String(line.text||'');return li;}));}
      if(model.done){releaseControls();status.textContent=model.player.health<=0?'伤势和现场情况将随这次经历记下。':'交锋已结束，确认后继续。';}
    };
    const setPaused=value=>{if(model.done||settled)return;model.paused=value;last=0;releaseControls();status.textContent=value?'你暂时停下来。':'留意眼前的动静。';update();draw();};
    const useAction=type=>{
      if(model.done||model.paused||settled)return;
      const before=(model.log||[]).length,used=performBattleAction(model,{type,...(['attack','melee','ranged'].includes(type)&&selected!==null&&turnBased?{targetId:selected}:{})});
      status.textContent=(model.log||[]).at(-1)||(!used?'现在还无法这样做。':'');
      if(!used&&(model.log||[]).length===before&&type==='escape')status.textContent=turnBased?'继续向绿色出口靠近。':'先走到绿色出口，再撤离。';
      update();draw();
    };
    const controls=[...ACTIONS,...(offer.kind==='zombie'&&model.player.bait?[['诱饵','bait','6']]:[])];
    controls.forEach(([label,type,key])=>{
      const button=doc.createElement('button');button.type='button';button.className=`battle-action battle-action-${type}`;button.setAttribute('aria-label',`${label}，快捷键 ${key}`);
      const name=doc.createElement('strong'),shortcut=doc.createElement('kbd');name.textContent=label;shortcut.textContent=key;button.append(name,shortcut);dialog.querySelector('.battle-actions').append(button);actionButtons.set(type,button);listen(button,'click',()=>useAction(type));
    });
    const point=event=>{
      const bounds=canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return null;const camera=cameraFor(model);
      return {x:clamp(camera.x+(event.clientX-bounds.left)/bounds.width*camera.w,0,model.width),y:clamp(camera.y+(event.clientY-bounds.top)/bounds.height*camera.h,0,model.height)};
    };
    listen(canvas,'pointerdown',event=>{
      if(model.paused||model.done||event.button>0)return;event.preventDefault();canvas.focus({preventScroll:true});const position=point(event);if(!position)return;
      if(turnBased){
        const target=model.enemies.filter(living).find(unit=>Math.hypot(unit.x-position.x,unit.y-position.y)<Math.max(30,unit.r+10));
        if(target){selected=target.id;status.textContent='已选定目标，可以采取行动。';}
        else{performBattleAction(model,{type:'move',...position});status.textContent=(model.log||[]).at(-1)||'你换了一个位置。';}
        update();draw();return;
      }
      if(pointerId!==null)return;pointerId=event.pointerId;Object.assign(input,position);canvas.setPointerCapture?.(pointerId);
    });
    listen(canvas,'pointermove',event=>{if(event.pointerId===pointerId&&!model.paused&&!model.done){const position=point(event);if(position)Object.assign(input,position);}});
    const endPointer=event=>{if(event.pointerId===pointerId)releaseControls();};
    listen(canvas,'pointerup',endPointer);listen(canvas,'pointercancel',endPointer);listen(canvas,'lostpointercapture',endPointer);listen(canvas,'blur',releaseControls);
    listen(dialog,'keydown',event=>{
      const key=event.key.toLowerCase(),arrows={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]};
      if(key==='escape'){event.preventDefault();finish(null);return;}
      if(arrows[key]){event.preventDefault();if(turnBased){if(!event.repeat&&!model.paused&&!model.done){const [dx,dy]=arrows[key];performBattleAction(model,{type:'move',dx:dx*110,dy:dy*110});status.textContent=(model.log||[]).at(-1)||'';update();draw();}}else keys.add(key);return;}
      if(event.code==='Space'&&event.target===canvas){event.preventDefault();if(!event.repeat)setPaused(!model.paused);return;}
      if(/^[1-6]$/.test(key)&&!event.repeat){event.preventDefault();const action=controls.find(item=>item[2]===key);if(action)useAction(action[1]);}
    });
    listen(win,'keyup',event=>keys.delete(event.key.toLowerCase()));listen(win,'blur',()=>setPaused(true));listen(doc,'visibilitychange',()=>{if(doc.hidden)setPaused(true);});
    listen(dialog,'focusout',event=>{if(event.relatedTarget&&!dialog.contains(event.relatedTarget))setPaused(true);});
    listen(dialog,'cancel',event=>{event.preventDefault();finish(null);});listen(dialog,'close',()=>finish(null));
    dialog.querySelectorAll('[data-battle-exit]').forEach(button=>listen(button,'click',()=>finish(null)));
    listen(pauseButton,'click',()=>setPaused(!model.paused));
    listen(confirmButton,'click',()=>{if(!model.done||settled)return;try{finish(battleGameResult(model));}catch(error){status.textContent=error.message||'这次交锋还没有结束。';}});
    const tick=now=>{
      if(settled)return;
      input.dx=((keys.has('arrowright')||keys.has('d'))?1000:0)-((keys.has('arrowleft')||keys.has('a'))?1000:0);
      input.dy=((keys.has('arrowdown')||keys.has('s'))?1000:0)-((keys.has('arrowup')||keys.has('w'))?1000:0);
      stepBattleGame(model,last?Math.max(0,now-last):0,input);last=now;update();draw();if(!model.done)frame=win.requestAnimationFrame(tick);
    };
    doc.body.append(dialog);dialog.showModal();
    if(win.ResizeObserver){resizeObserver=new win.ResizeObserver(draw);resizeObserver.observe(canvas);if(!turnBased)resizeObserver.observe(mini);}else listen(win,'resize',draw);
    status.textContent=turnBased?'先观察距离和伤势，再决定行动。':'交锋最多持续一分钟；离开页面时会暂停。';
    update();draw();canvas.focus({preventScroll:true});if(doc.hidden)setPaused(true);if(!turnBased)frame=win.requestAnimationFrame(tick);
  });
}

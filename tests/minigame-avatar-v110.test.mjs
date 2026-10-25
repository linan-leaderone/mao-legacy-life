import test from 'node:test';
import assert from 'node:assert/strict';
import {createMinigameAvatar,drawMinigameAvatar} from '../src/minigame-avatar.js';
import {getPortrait} from '../src/portraits.js';

test('avatar loading stays local to the view and a late load cannot redraw a closed minigame',()=>{
  const state={profile:{name:'陈夏',place:'福建',age:25}},before=structuredClone(state),images=[];
  const window={Image:class{constructor(){images.push(this);}}};let redraws=0;
  const avatar=createMinigameAvatar(state,{window,onReady:()=>redraws++});
  assert.equal(images.length,1);assert.equal(images[0].src,getPortrait(state).src);
  const late=images[0].onload;late();assert.equal(redraws,1);
  avatar.dispose();late();assert.equal(redraws,1);assert.equal(images[0].onload,null);assert.equal(images[0].onerror,null);
  assert.deepEqual(state,before);
});

test('portrait loading failure leaves a visible initial and portrait-format crops stay inside the image',()=>{
  const calls=[],ctx=new Proxy({drawImage:(...args)=>calls.push(['image',...args]),fillText:(...args)=>calls.push(['text',...args])},{get:(target,key)=>target[key]??(()=>{})});
  const avatar={name:'陈夏',image:{complete:true,naturalWidth:0,naturalHeight:0}};
  drawMinigameAvatar(ctx,avatar,60,70,20);
  assert.deepEqual(calls.find(call=>call[0]==='text'),['text','陈',60,70]);assert.equal(calls.filter(call=>call[0]==='image').length,0);
  avatar.image={complete:true,naturalWidth:100,naturalHeight:240};drawMinigameAvatar(ctx,avatar,60,70,20);
  const [,image,sx,sy,sw,sh,dx,dy,dw,dh]=calls.find(call=>call[0]==='image');
  assert.equal(image,avatar.image);assert.ok(sx>=0&&sy>=0&&sx+sw<=100&&sy+sh<=240);
  assert.deepEqual([dx,dy,dw,dh],[40,50,40,40]);assert.equal(ctx.imageSmoothingEnabled,false);
});

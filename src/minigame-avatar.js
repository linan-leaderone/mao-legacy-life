import {getPortrait} from './portraits.js';

/** A view-only portrait: never copied into an encounter offer, result or save. */
export function createMinigameAvatar(playerState,{window:win=globalThis.window,onReady=()=>{}}={}){
  const portrait=getPortrait(playerState||{profile:{name:'你'}});
  const avatar={portrait,name:playerState?.profile?.name||portrait.name||'你',image:null,disposed:false};
  if(portrait.src&&typeof win?.Image==='function'){
    const image=new win.Image();avatar.image=image;image.decoding='async';
    image.onload=()=>{if(!avatar.disposed)onReady();};
    image.onerror=()=>{if(!avatar.disposed)onReady();};
    image.src=portrait.src;
  }
  avatar.dispose=()=>{avatar.disposed=true;if(avatar.image){avatar.image.onload=null;avatar.image.onerror=null;}};
  return avatar;
}

export function mountMinigameIdentity(container,avatar,doc=globalThis.document){
  if(!container||!doc?.createElement)return;
  container.className=`${container.className||''} minigame-identity`.trim();
  container.setAttribute('data-no-translate','');
  const face=doc.createElement(avatar.portrait.src?'img':'span');face.className='minigame-avatar';
  if(avatar.portrait.src){face.src=avatar.portrait.src;face.alt='';face.draggable=false;}
  else{face.textContent=Array.from(avatar.name)[0]||'你';face.setAttribute('aria-hidden','true');}
  const name=doc.createElement('strong');name.textContent=avatar.name;
  container.append(face,name);
}

/** Crop portrait-format artwork toward the face; pixel art keeps its exact pixels. */
export function drawMinigameAvatar(ctx,avatar,x,y,radius,{ring='#f7dfa0',ringWidth=3}={}){
  ctx.save();ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle='#23342f';ctx.fill();
  ctx.save();ctx.clip();
  const image=avatar?.image;
  if(image?.complete&&image.naturalWidth>0&&image.naturalHeight>0){
    const size=Math.min(image.naturalWidth,image.naturalHeight);
    const cropX=(image.naturalWidth-size)/2,cropY=image.naturalHeight>image.naturalWidth?(image.naturalHeight-size)*.12:0;
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,cropX,cropY,size,size,x-radius,y-radius,radius*2,radius*2);
  }else{
    ctx.fillStyle='#f7edd2';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.max(10,Math.round(radius))}px system-ui,sans-serif`;
    ctx.fillText(Array.from(avatar?.name||'你')[0],x,y);
  }
  ctx.restore();ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.lineWidth=ringWidth;ctx.strokeStyle=ring;ctx.stroke();ctx.restore();
}

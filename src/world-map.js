import './world-map.css';
import {geographyUnits,createTerritoryContext,deriveTerritorySituation,controllerColor,resolveTerritoryTargets,searchGeographyUnits,fragmentedCountryIds} from './world-territories.js';
import {getPlayerPosition} from './player-position.js';
import {getCountryContext,countryByTag} from './countries.js';
import {factionFlagMarkup} from './faction-display.js';
import {countryOpeningMarkup} from './country-opening-view.js';
import {getPortrait} from './portraits.js';
import {ATLAS_SCOPES,createAtlasNavigation,selectAtlasLayers,atlasAncestors,atlasLongitudeNear} from './atlas-navigation.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mercator=lat=>180/Math.PI*Math.log(Math.tan(Math.PI/4+clamp(lat,-80,80)*Math.PI/360));
const inverseMercator=y=>360/Math.PI*Math.atan(Math.exp(y*Math.PI/180))-90;
const GEO_CACHE=new Map();
const byId=new Map(geographyUnits.map(unit=>[unit.id,unit]));
const ROLE_RANK={country:0,province:1,city:2,county:3};
const PRECISION_LABEL={country:'国家或地区范围',province:'省份范围',city:'市级范围',county:'县区范围',ocean:'海域',unknown:'未明确'};

function decodeGeometry(encoded,scale=10000){
  return encoded.map(poly=>poly.map(ring=>{let x=0,y=0;const points=[];for(let i=0;i<ring.length;i+=2){x+=ring[i];y+=ring[i+1];points.push([x/scale,-mercator(y/scale)]);}return points;}));
}
function pathFor(polygons){const path=new Path2D();for(const polygon of polygons)for(const ring of polygon){ring.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath();}return path;}
function cacheLayer(name,rows){
  GEO_CACHE.delete(name);GEO_CACHE.set(name,rows);
  while(GEO_CACHE.size>9){const key=[...GEO_CACHE.keys()].find(id=>id!=='world');GEO_CACHE.delete(key);}
}
async function loadLayer(layer,signal){
  if(GEO_CACHE.has(layer.id)){const rows=GEO_CACHE.get(layer.id);cacheLayer(layer.id,rows);return rows;}
  const response=await fetch(new URL(`./maps/${layer.file||`${layer.id}-boundaries.json`}`,document.baseURI),{signal});
  if(!response.ok)throw new Error('地图边界暂时未能读入。');
  const data=await response.json(),rows=[];
  let sinceYield=0;
  for(const [id,encoded] of Object.entries(data.features||{})){
    if(signal.aborted)throw new DOMException('Aborted','AbortError');
    const unit=byId.get(id);if(unit){const polygons=decodeGeometry(encoded,data.scale),parts=polygons.map(poly=>{const bounds=[Infinity,Infinity,-Infinity,-Infinity];for(const ring of poly)for(const [x,y] of ring){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}return bounds;});rows.push({unit,path:pathFor(polygons),parts,projected:[unit.bounds[0],-mercator(unit.bounds[3]),unit.bounds[2],-mercator(unit.bounds[1])]});}
    if(++sinceYield>=240){sinceYield=0;await new Promise(resolve=>setTimeout(resolve,0));}
  }
  cacheLayer(layer.id,rows);return rows;
}

/** Viewing, dragging and changing scale never mutate the save. Fine polygons are
 * fetched by country/layer and decoded only when the viewport needs them. */
export function mountWorldMap(host,initialState,lore){
  if(!host)return {destroy(){},update(){}};
  host.classList.add('world-atlas');
  host.innerHTML=`<div class="atlas-heading"><div><span class="tiny-label">世界地图</span><h3>此刻，各地</h3></div><button type="button" data-atlas-here>回到本人</button></div><div class="atlas-position" aria-live="polite"></div><nav class="atlas-scopes" aria-label="按本人所在地查看地图">${ATLAS_SCOPES.map(scope=>`<button type="button" data-atlas-scope="${scope.id}">${scope.label}</button>`).join('')}</nav><p class="atlas-scope-note" aria-live="polite"></p><details class="atlas-missing"><summary>没有亮起的层级</summary><ul></ul></details><form class="atlas-search" role="search"><label class="sr-only" for="atlas-search-input">查找地区</label><input id="atlas-search-input" placeholder="查找全球县市、地区或国家" autocomplete="off"><button type="submit">查找</button></form><div class="atlas-search-results" aria-live="polite"></div><div class="atlas-frame"><canvas tabindex="0" aria-label="世界局势地图，可拖动与双指缩放，也可使用地图层级和地区查找"></canvas><div class="atlas-player-marker" hidden><div class="atlas-player-face"></div><span></span></div><div class="atlas-status" role="status">正在展开地图…</div><div class="atlas-scale"></div></div><div class="atlas-controls"><div><button type="button" data-atlas-zoom="out" aria-label="缩小地图">−</button><button type="button" data-atlas-zoom="in" aria-label="放大地图">＋</button></div><span>拖动或双指缩放 · 点选地区</span></div><div class="atlas-legend" aria-label="势力颜色"></div><section class="atlas-detail" aria-live="polite"><p>选择一个地区，查看目前的管治与战事。</p></section>`;
  const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),status=host.querySelector('.atlas-status'),detail=host.querySelector('.atlas-detail'),results=host.querySelector('.atlas-search-results'),scaleLabel=host.querySelector('.atlas-scale'),marker=host.querySelector('.atlas-player-marker'),abort=new AbortController();
  let state=initialState,prepared=createTerritoryContext(state,lore),position=getPlayerPosition(state),manifest={layers:[{id:'world',file:'world-boundaries.json',role:'country'}]},navigation=[],activeScope='world',scopeBounds=null,focusedUnit=null;
  let width=600,height=410,dpr=1,camera={x:0,y:0,scale:1},selection=null,disposed=false,frame=0,layerTimer=0,drag=null,pinch=null,autoFit=true,loaded=new Map(),wanted=new Set(['world']),factionDestination=null,portraitSource='',legendKey='';
  const pointers=new Map(),listeners=[],situations=new Map(),pending=new Map(),failedLayers=new Set();
  let controlCountries=fragmentedCountryIds(state,prepared);
  const listen=(element,type,callback,options)=>{element.addEventListener(type,callback,options);listeners.push(()=>element.removeEventListener(type,callback,options));};
  const situation=unit=>{if(!situations.has(unit.id))situations.set(unit.id,deriveTerritorySituation(state,unit,lore,prepared));return situations.get(unit.id);};
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});};
  function viewport(){const center=atlasLongitudeNear(camera.x,0),west=center-width/camera.scale/2,east=center+width/camera.scale/2,top=camera.y-height/camera.scale/2,bottom=camera.y+height/camera.scale/2;return [west,inverseMercator(-bottom),east,inverseMercator(-top)];}
  function scheduleLayers(){clearTimeout(layerTimer);if(!disposed)layerTimer=setTimeout(refreshLayers,100);}
  function fit(bounds){
    if(!bounds)return;
    const [west,south,east,north]=bounds,top=-mercator(north),bottom=-mercator(south);
    camera={x:(west+east)/2,y:(top+bottom)/2,scale:clamp(Math.min(width/Math.max(east-west,.015),height/Math.max(bottom-top,.015))*.84,.5,40000)};schedule();scheduleLayers();
  }
  function refreshNavigation(){
    navigation=createAtlasNavigation({position,units:byId,manifest,situation});
    for(const row of navigation){const button=host.querySelector(`[data-atlas-scope="${row.id}"]`);button.disabled=!row.available;button.title=row.available?(row.title||row.label):row.reason;button.setAttribute('aria-pressed',String(activeScope===row.id));}
    const unit=byId.get(position?.unitId),precision=PRECISION_LABEL[position?.precision]||'未明确';
    host.querySelector('.atlas-position').innerHTML=`<strong>当前位置</strong><span>${escape(position?.label||state.location||'尚未明确')} · ${escape(precision)}</span><small>${unit?'头像位于所在地区的示意中心。':'尚无明确的陆地位置，不放置推测标记。'}</small>`;
    host.querySelector('[data-atlas-here]').disabled=!unit;
    const unavailable=navigation.filter(row=>!row.available),missing=host.querySelector('.atlas-missing');missing.hidden=!unavailable.length;
    missing.querySelector('ul').innerHTML=unavailable.map(row=>`<li><b>${escape(row.label)}</b>：${escape(row.reason)}</li>`).join('');
    updateScopeNote();updatePortrait();
  }
  function updateScopeNote(){
    const row=navigation.find(item=>item.id===activeScope);
    host.querySelector('.atlas-scope-note').textContent=row?`${row.label} · ${row.title||'所在地'}${row.id==='faction'?' · 按目前已知管治范围':''}`:'自由查看 · 地图层级始终以本人所在地为准';
    for(const button of host.querySelectorAll('[data-atlas-scope]'))button.setAttribute('aria-pressed',String(button.dataset.atlasScope===activeScope));
  }
  function updatePortrait(){
    const portrait=getPortrait(state),src=portrait.src||'';
    if(src!==portraitSource||!marker.querySelector('.atlas-player-face').childNodes.length){
      portraitSource=src;marker.querySelector('.atlas-player-face').innerHTML=src?`<img src="${escape(src)}" alt="本人头像">`:`<b>${escape((state.profile?.name||'我').slice(0,1))}</b>`;
    }
    marker.querySelector('span').textContent=`${state.profile?.name||'本人'} · 所在地区`;
    marker.title=`${position?.label||state.location||''}（${PRECISION_LABEL[position?.precision]||'未明确'}，示意中心）`;
  }
  function view(id){
    let row=navigation.find(item=>item.id===id);if(!row?.available)return;
    if(id==='faction'){
      factionDestination??=createAtlasNavigation({position,units:byId,manifest,situation,includeFaction:true}).find(item=>item.id==='faction');
      row=factionDestination;
    }
    activeScope=id;autoFit=true;scopeBounds=row.bounds;focusedUnit=row.unitId?byId.get(row.unitId):null;
    if(focusedUnit){selection=focusedUnit.id;renderDetail(focusedUnit);}
    else{selection=null;detail.innerHTML=`<p>当前显示${escape(row.title||row.label)}。选择一个地区，查看目前的管治与战事。</p>`;}
    updateScopeNote();fit(row.bounds);
  }
  function here(){const unit=byId.get(position?.unitId);if(!unit)return;const role=navigation.find(row=>row.id===unit.role&&row.available);if(role)view(role.id);else{activeScope=null;autoFit=true;scopeBounds=unit.bounds;select(unit,true);}}
  function resize(){const box=canvas.getBoundingClientRect();width=Math.max(240,box.width);height=Math.max(260,box.height);dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);if(autoFit&&scopeBounds)fit(scopeBounds);else schedule();}
  function visible(row){const halfW=width/camera.scale/2,halfH=height/camera.scale/2,intersects=(b,offset=0)=>b[2]+offset>=camera.x-halfW&&b[0]+offset<=camera.x+halfW&&b[3]>=camera.y-halfH&&b[1]<=camera.y+halfH;return intersects(row.projected)&&(!row.parts||row.parts.some(part=>intersects(part,row.offset||0)));}
  function rowsToDraw(){
    const rows=[];for(const id of wanted)for(const row of loaded.get(id)||[]){
      const center=(row.projected[0]+row.projected[2])/2,base=atlasLongitudeNear(center,camera.x)-center;
      for(const offset of [base-360,base,base+360]){const projected=[row.projected[0]+offset,row.projected[1],row.projected[2]+offset,row.projected[3]];if(visible({projected,parts:row.parts,offset}))rows.push({...row,projected,offset});}
    }
    return rows.sort((a,b)=>(ROLE_RANK[a.unit.role]??0)-(ROLE_RANK[b.unit.role]??0));
  }
  async function refreshLayers(){
    if(disposed)return;
    const previous=wanted;
    wanted=new Set(selectAtlasLayers({manifest,viewport:viewport(),scale:camera.scale,focusedUnit,controlCountries}));wanted.add('world');
    for(const id of previous)if(!wanted.has(id))loaded.delete(id);
    const needed=[...wanted].filter(id=>!loaded.has(id));
    status.hidden=!needed.length;if(needed.length)status.textContent='正在展开这一带的地方边界…';
    schedule();
    await Promise.all(needed.map(async id=>{
      const layer=manifest.layers.find(row=>row.id===id);if(!layer)return;
      try{
        if(!pending.has(id))pending.set(id,loadLayer(layer,abort.signal));
        const rows=await pending.get(id);if(disposed)return;
        if(wanted.has(id))loaded.set(id,rows);failedLayers.delete(id);
      }catch(error){if(!disposed&&error.name!=='AbortError')failedLayers.add(id);}
      finally{pending.delete(id);}
    }));
    if(disposed)return;
    const stillPending=[...wanted].some(id=>pending.has(id)),failed=[...wanted].some(id=>failedLayers.has(id));
    status.hidden=!stillPending&&!failed;status.textContent=failed?'部分地方边界未能载入，缩放或重新打开可再试。':'正在展开这一带的地方边界…';schedule();
  }
  function markerBox(){
    const coordinates=position?.coordinates,unit=byId.get(position?.unitId);
    if(!unit||!Array.isArray(coordinates)||coordinates.length!==2||!coordinates.every(Number.isFinite)){marker.hidden=true;return null;}
    const x=(atlasLongitudeNear(coordinates[0],camera.x)-camera.x)*camera.scale+width/2,y=(-mercator(coordinates[1])-camera.y)*camera.scale+height/2;
    if(x<15||x>width-15||y<25||y>height-20){marker.hidden=true;return null;}
    marker.hidden=false;marker.style.left=`${x}px`;marker.style.top=`${y}px`;
    return [x-80,y-38,160,70];
  }
  function drawFrontline(row,s){
    // Clip to both the county polygon and viewport. Spacing stays constant on screen.
    const offset=row.offset||0,halfW=width/camera.scale/2,halfH=height/camera.scale/2;
    const left=Math.max(row.projected[0],camera.x-halfW)-offset,right=Math.min(row.projected[2],camera.x+halfW)-offset;
    const top=Math.max(row.projected[1],camera.y-halfH),bottom=Math.min(row.projected[3],camera.y+halfH);
    if(right<=left||bottom<=top)return;
    ctx.save();ctx.clip(row.path,'evenodd');ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
    const gap=10/camera.scale,rise=bottom-top;
    ctx.strokeStyle=controllerColor(s.attackerId);ctx.lineWidth=3/camera.scale;ctx.beginPath();
    for(let x=Math.floor((left-rise)/gap)*gap;x<right+gap;x+=gap){ctx.moveTo(x,bottom);ctx.lineTo(x+rise,top);}
    ctx.stroke();ctx.restore();
  }
  function renderLegend(rows){
    const finest=new Map();for(const row of rows)finest.set(row.unit.country,Math.max(finest.get(row.unit.country)||0,ROLE_RANK[row.unit.role]||0));
    const factions=new Map();let fighting=false;
    for(const row of rows){
      if((ROLE_RANK[row.unit.role]||0)<finest.get(row.unit.country))continue;
      const s=situation(row.unit),id=s.ownerId||s.controllerId;
      if(id)factions.set(id,s.ownerName||s.controller);
      if(s.frontline&&s.attackerId){factions.set(s.attackerId,s.attackerName||s.attackerId);fighting=true;}
    }
    const entries=[...factions].sort((a,b)=>a[0].localeCompare(b[0])),key=JSON.stringify([entries,fighting]);if(key===legendKey)return;legendKey=key;
    host.querySelector('.atlas-legend').innerHTML=entries.map(([id,name])=>`<span><i style="background:${escape(controllerColor(id))}"></i>${escape(name)}</span>`).join('')+(fighting?'<span class="atlas-battle-key"><i></i>交战：守方底色 · 攻方斜纹</span>':'');
  }
  function draw(){
    if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#dfe9e4';ctx.fillRect(0,0,width,height);
    ctx.save();ctx.translate(width/2,height/2);ctx.scale(camera.scale,camera.scale);ctx.translate(-camera.x,-camera.y);
    ctx.strokeStyle='#c7d7d0';ctx.lineWidth=.6/camera.scale;
    for(let lon=-540;lon<=540;lon+=30){ctx.beginPath();ctx.moveTo(lon,-mercator(80));ctx.lineTo(lon,-mercator(-80));ctx.stroke();}
    for(let lat=-75;lat<=75;lat+=15){ctx.beginPath();ctx.moveTo(-540,-mercator(lat));ctx.lineTo(540,-mercator(lat));ctx.stroke();}
    const rows=rowsToDraw();
    for(const row of rows){
      ctx.save();ctx.translate(row.offset||0,0);
      const s=situation(row.unit);ctx.fillStyle=controllerColor(s.ownerId||s.controllerId);ctx.fill(row.path,'evenodd');
      if(s.frontline&&s.attackerId)drawFrontline(row,s);
      ctx.lineWidth=(row.unit.role==='country'?1:.55)/camera.scale;ctx.strokeStyle=row.unit.role==='country'?'#faf8ecbb':'#f4f3e4aa';ctx.stroke(row.path);
      if(s.frontline&&s.attackerId){ctx.strokeStyle=controllerColor(s.attackerId);ctx.lineWidth=1.5/camera.scale;ctx.stroke(row.path);}
      if(row.unit.id===selection){ctx.strokeStyle='#203d34';ctx.lineWidth=3/camera.scale;ctx.stroke(row.path);}
      ctx.restore();
    }
    ctx.restore();
    renderLegend(rows);
    const playerBox=markerBox(),occupied=playerBox?[playerBox]:[],detailRanks=new Map();for(const row of rows)detailRanks.set(row.unit.country,Math.max(detailRanks.get(row.unit.country)||0,ROLE_RANK[row.unit.role]||0));ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='12px system-ui, sans-serif';
    const labelRows=[...rows].sort((a,b)=>(b.unit.id===selection)-(a.unit.id===selection));
    for(const row of labelRows){
      const u=row.unit,b=row.projected,bw=(b[2]-b[0])*camera.scale,bh=(b[3]-b[1])*camera.scale;
      if(u.id!==selection&&(bw<56||bh<24))continue;
      if(u.id!==selection&&(ROLE_RANK[u.role]||0)<detailRanks.get(u.country))continue;
      const x=(u.center[0]+(row.offset||0)-camera.x)*camera.scale+width/2,y=(-mercator(u.center[1])-camera.y)*camera.scale+height/2;
      if(x<25||x>width-25||y<12||y>height-12)continue;
      const text=u.name.length>14?u.name.slice(0,13)+'…':u.name,w=ctx.measureText(text).width+10,box=[x-w/2,y-9,w,18];
      if(occupied.some(([a,c,d,e])=>x+w/2>a&&x-w/2<a+d&&y+9>c&&y-9<c+e))continue;
      occupied.push(box);ctx.fillStyle='#fffdf0dd';ctx.fillRect(...box);ctx.fillStyle='#263d35';ctx.fillText(text,x,y);
    }
    const metersPerPx=111320*Math.cos(inverseMercator(-camera.y)*Math.PI/180)/camera.scale,km=Math.max(.01,metersPerPx*80/1000);scaleLabel.textContent=`约 ${km>=1?Math.round(km):Math.round(km*1000)+' 米'}${km>=1?' 公里':''}`;
  }
  function renderDetail(unit){
    if(!unit)return;
    const s=situation(unit),source=unit.source||{},country=getCountryContext(state,unit.country),badge=s.frontline?'交战地区':s.war?'战时影响区':'暂无当地战事';
    const chain=atlasAncestors(unit,byId).reverse().filter(row=>row.id!==unit.id),parent=chain.map(row=>row.name).join(' › ')||unit.parent||unit.country;
    const controlledBaseline=s.controllerTag?countryByTag(s.controllerTag):null;
    const baseline=controlledBaseline||country?.baseline||country;
    const opening=countryOpeningMarkup(baseline);
    detail.innerHTML=`<div class="atlas-detail-title"><div><span class="tiny-label">${escape(parent)} · ${escape(source.level||unit.level)}</span><h4>${factionFlagMarkup(s)}${escape(unit.name)}</h4></div><span class="atlas-badge ${s.war?'is-war':''}">${badge}</span></div>${position?.unitId===unit.id?`<p class="atlas-here-note">你目前在这里，已知位置为${escape(PRECISION_LABEL[position.precision]||'所在地区')}。</p>`:''}<dl><div><dt>目前管治</dt><dd>${escape(s.ownerName||s.controller)}</dd></div>${s.frontline&&s.attackerId?`<div><dt>进攻方</dt><dd>${escape(s.attackerName||s.attackerId)}</dd></div>`:''}${s.government?`<div><dt>当前制度</dt><dd>${escape(s.government)}</dd></div>`:''}${s.ideology?`<div><dt>政治取向</dt><dd>${escape(s.ideology)}</dd></div>`:''}${s.conflict?`<div><dt>当前战事</dt><dd>${escape(s.conflict)}</dd></div>`:''}</dl><p>${escape(s.description)}</p>${s.mixedControllers?.length?`<div class="atlas-mixed-controls">${s.mixedControllers.map(row=>`<span>${factionFlagMarkup({controllerTag:row.tag})}${escape(row.name)}</span>`).join('')}</div>`:''}${opening}`;
  }
  function select(unit,zoom=false){if(!unit)return;selection=unit.id;renderDetail(unit);if(zoom){activeScope=null;autoFit=true;scopeBounds=unit.bounds;focusedUnit=unit;updateScopeNote();fit(unit.bounds);}else schedule();}
  function leavePreset(){autoFit=false;activeScope=null;focusedUnit=null;updateScopeNote();}
  function zoomAt(multiplier,x=width/2,y=height/2){leavePreset();const previous=camera.scale;camera.scale=clamp(previous*multiplier,.5,40000);camera.x+=(x-width/2)*(1/previous-1/camera.scale);camera.y+=(y-height/2)*(1/previous-1/camera.scale);schedule();scheduleLayers();}
  function local(event){const box=canvas.getBoundingClientRect();return {x:event.clientX-box.left,y:event.clientY-box.top};}
  function hit(x,y){
    const gx=(x-width/2)/camera.scale+camera.x,gy=(y-height/2)/camera.scale+camera.y;
    const rows=rowsToDraw().filter(row=>gx>=row.projected[0]&&gx<=row.projected[2]&&gy>=row.projected[1]&&gy<=row.projected[3]);
    rows.sort((a,b)=>(a.projected[2]-a.projected[0])*(a.projected[3]-a.projected[1])-(b.projected[2]-b.projected[0])*(b.projected[3]-b.projected[1]));
    ctx.save();ctx.setTransform(1,0,0,1,0,0);const found=rows.find(row=>ctx.isPointInPath(row.path,gx-(row.offset||0),gy,'evenodd'));ctx.restore();if(found)select(found.unit);
  }
  listen(canvas,'pointerdown',event=>{if(event.button&&event.button!==0)return;event.preventDefault();canvas.setPointerCapture(event.pointerId);const p=local(event);pointers.set(event.pointerId,p);drag={...p,moved:false};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(b.x-a.x,b.y-a.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}});
  listen(canvas,'pointermove',event=>{if(!pointers.has(event.pointerId))return;const p=local(event),previous=pointers.get(event.pointerId);pointers.set(event.pointerId,p);if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(b.x-a.x,b.y-a.y),x=(a.x+b.x)/2,y=(a.y+b.y)/2;if(pinch){zoomAt(distance/Math.max(pinch.distance,1),x,y);camera.x-=(x-pinch.x)/camera.scale;camera.y-=(y-pinch.y)/camera.scale;}pinch={distance,x,y};if(drag)drag.moved=true;}else{camera.x-=(p.x-previous.x)/camera.scale;camera.y-=(p.y-previous.y)/camera.scale;if(drag&&Math.hypot(p.x-drag.x,p.y-drag.y)>5){drag.moved=true;leavePreset();}}schedule();scheduleLayers();});
  listen(canvas,'pointerup',event=>{const p=local(event);if(pointers.size===1&&drag&&!drag.moved)hit(p.x,p.y);pointers.delete(event.pointerId);pinch=null;if(!pointers.size)drag=null;});
  listen(canvas,'pointercancel',event=>{pointers.delete(event.pointerId);pinch=null;drag=null;});
  listen(canvas,'wheel',event=>{event.preventDefault();const p=local(event);zoomAt(Math.exp(-event.deltaY*.002),p.x,p.y);},{passive:false});
  listen(canvas,'keydown',event=>{if(['+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();leavePreset();if(event.key==='+'||event.key==='=')zoomAt(1.5);else if(event.key==='-')zoomAt(1/1.5);else{camera.x+=event.key==='ArrowLeft'?-60/camera.scale:event.key==='ArrowRight'?60/camera.scale:0;camera.y+=event.key==='ArrowUp'?-60/camera.scale:event.key==='ArrowDown'?60/camera.scale:0;schedule();scheduleLayers();}}});
  for(const button of host.querySelectorAll('[data-atlas-scope]'))listen(button,'click',()=>view(button.dataset.atlasScope));
  for(const button of host.querySelectorAll('[data-atlas-zoom]'))listen(button,'click',()=>zoomAt(button.dataset.atlasZoom==='in'?1.65:1/1.65));
  listen(host.querySelector('[data-atlas-here]'),'click',here);
  listen(host.querySelector('form'),'submit',event=>{
    event.preventDefault();const text=host.querySelector('input').value.trim();if(!text){results.replaceChildren();return;}
    let found=resolveTerritoryTargets(text);if(!found.length)found=searchGeographyUnits(text);
    results.innerHTML=found.length?found.map(u=>`<button type="button" data-unit="${escape(u.id)}">${escape(u.parent?u.parent+' · ':'')}${escape(u.name)}<small>${escape(byId.get('country:'+u.country)?.name||u.country)} · ${escape(u.source?.level||u.level)}</small></button>`).join(''):'<p>未找到明确的地区。可以填写完整县市名，或加上上一级地区。</p>';
    for(const button of results.querySelectorAll('button'))button.onclick=()=>select(byId.get(button.dataset.unit),true);
    if(found.length===1)select(found[0],true);
  });
  const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;resizeObserver?.observe(canvas);
  refreshNavigation();scopeBounds=navigation[0].bounds;resize();
  (async()=>{
    try{
      const response=await fetch(new URL('./maps/manifest.json',document.baseURI),{signal:abort.signal});
      if(response.ok){manifest=await response.json();if(disposed)return;refreshNavigation();}
      if(disposed)return;const unit=byId.get(position?.unitId);if(unit)here();else view('world');
      await refreshLayers();
    }catch(error){if(!disposed&&error.name!=='AbortError'){status.textContent='地图目录暂时未能读入，重新打开可再试。';await refreshLayers();}}
  })();
  return {
    update(next){
      const previousPosition=position;state=next;prepared=createTerritoryContext(state,lore);controlCountries=fragmentedCountryIds(state,prepared);position=getPlayerPosition(state);situations.clear();factionDestination=null;
      const previousScope=activeScope;refreshNavigation();
      if(previousScope&&navigation.some(row=>row.id===previousScope&&row.available))view(previousScope);
      else if(previousPosition?.unitId!==position?.unitId){if(position?.unitId)here();else view('world');}
      else if(previousScope){activeScope=null;focusedUnit=null;updateScopeNote();}
      if(selection)renderDetail(byId.get(selection));schedule();scheduleLayers();
    },
    destroy(){disposed=true;abort.abort();clearTimeout(layerTimer);if(frame)cancelAnimationFrame(frame);resizeObserver?.disconnect();for(const remove of listeners)remove();pointers.clear();loaded.clear();pending.clear();situations.clear();},
  };
}



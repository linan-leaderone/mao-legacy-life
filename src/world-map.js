import './world-map.css';
import {geographyUnits,createTerritoryContext,deriveTerritorySituation,controllerColor,resolveTerritoryTargets,searchGeographyUnits} from './world-territories.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mercator=lat=>180/Math.PI*Math.log(Math.tan(Math.PI/4+clamp(lat,-80,80)*Math.PI/360));
const inverseMercator=y=>360/Math.PI*Math.atan(Math.exp(y*Math.PI/180))-90;
const GEO_CACHE=new Map();
const byId=new Map(geographyUnits.map(unit=>[unit.id,unit]));

function decodeGeometry(encoded,scale=10000){
  return encoded.map(poly=>poly.map(ring=>{let x=0,y=0;const points=[];for(let i=0;i<ring.length;i+=2){x+=ring[i];y+=ring[i+1];points.push([x/scale,-mercator(y/scale)]);}return points;}));
}
function pathFor(polygons){const path=new Path2D();for(const polygon of polygons)for(const ring of polygon){ring.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath();}return path;}
async function loadLayer(name,signal){
  if(GEO_CACHE.has(name))return GEO_CACHE.get(name);
  const response=await fetch(new URL(`./maps/${name}-boundaries.json`,document.baseURI),{signal});
  if(!response.ok)throw new Error('地图边界暂时未能读入。');
  const data=await response.json(),rows=[];
  for(const [id,encoded] of Object.entries(data.features||{})){const unit=byId.get(id);if(unit){const polygons=decodeGeometry(encoded,data.scale);rows.push({unit,polygons,path:pathFor(polygons),projected:[unit.bounds[0],-mercator(unit.bounds[3]),unit.bounds[2],-mercator(unit.bounds[1])]});}}
  GEO_CACHE.set(name,rows);return rows;
}

/** Mount inside the world dialog. Its lifetime is independent of saved state.
 * Return value is immediately available so closing an awaiting dialog aborts
 * its requests and disconnects input/resize listeners. */
export function mountWorldMap(host,initialState,lore){
  if(!host)return {destroy(){},update(){}};
  host.classList.add('world-atlas');
  host.innerHTML=`<div class="atlas-heading"><div><span class="tiny-label">世界地图</span><h3>此刻，各地</h3></div><div class="atlas-presets"><button type="button" data-atlas-view="asia">亚洲</button><button type="button" data-atlas-view="world">世界</button><button type="button" data-atlas-view="here">所在地</button></div></div><form class="atlas-search" role="search"><label class="sr-only" for="atlas-search-input">查找地区</label><input id="atlas-search-input" placeholder="查找县市、地区或国家" autocomplete="off"><button type="submit">查找</button></form><div class="atlas-search-results" aria-live="polite"></div><div class="atlas-frame"><canvas tabindex="0" aria-label="世界局势地图，可拖动与双指缩放，也可使用下方按钮和地区查找"></canvas><div class="atlas-status" role="status">正在展开地图…</div><div class="atlas-scale"></div></div><div class="atlas-controls"><div><button type="button" data-atlas-zoom="out" aria-label="缩小地图">−</button><button type="button" data-atlas-zoom="in" aria-label="放大地图">＋</button></div><span>拖动或双指缩放 · 点选地区</span></div><div class="atlas-legend"><span><i class="atlas-normal"></i>管治范围</span><span><i class="atlas-war"></i>参战势力控制区</span><span><i class="atlas-front"></i>确认交战地区</span></div><section class="atlas-detail" aria-live="polite"><p>选择一个地区，查看目前的管治与战事。</p></section><details class="atlas-sources"><summary>地图范围与资料</summary><p>亚洲可逐步放大至县、市区等行政单位。没有更细资料的地方保留其已知层级。边界采用资料所标年份，颜色表示目前已知的实际管治。</p><p>未确认的内战分区会保留“各方争夺”；红色标记仅用于已经确认的当地交战。</p><p>边界：<a href="https://www.geoboundaries.org/" target="_blank" rel="noopener">geoBoundaries</a>、<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>；本地名称：<a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>。</p><a href="./maps/sources.json" target="_blank" rel="noopener">数据年份、层级与许可</a></details>`;
  const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),status=host.querySelector('.atlas-status'),detail=host.querySelector('.atlas-detail'),results=host.querySelector('.atlas-search-results'),scaleLabel=host.querySelector('.atlas-scale'),abort=new AbortController();
  let state=initialState,prepared=createTerritoryContext(state,lore),world=[],asia=[],width=600,height=410,dpr=1,camera={x:112,y:-mercator(29),scale:7},selection=null,disposed=false,frame=0,drag=null,pinch=null,defaultView=true;
  const pointers=new Map(),listeners=[],situations=new Map();
  const listen=(element,type,callback,options)=>{element.addEventListener(type,callback,options);listeners.push(()=>element.removeEventListener(type,callback,options));};
  const situation=unit=>{if(!situations.has(unit.id))situations.set(unit.id,deriveTerritorySituation(state,unit,lore,prepared));return situations.get(unit.id);};
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});};
  function fit(bounds){
    const [west,south,east,north]=bounds,top=-mercator(north),bottom=-mercator(south);
    camera={x:(west+east)/2,y:(top+bottom)/2,scale:clamp(Math.min(width/Math.max(east-west,.03),height/Math.max(bottom-top,.03))*.84,.5,24000)};schedule();
  }
  function view(name){defaultView=name==='asia';if(name==='world')fit([-180,-58,180,82]);else if(name==='here'){
    const found=resolveTerritoryTargets(state.location||'');const unit=found.length===1?found[0]:geographyUnits.find(row=>row.id==='country:'+({中国大陆:'CHN',日本:'JPN',中国台湾:'TWN',台湾:'TWN',香港:'HKG',澳门:'MAC',韩国:'KOR'}[state.location]||''));
    if(unit)select(unit,true);else fit([75,0,150,55]);
  }else fit([75,0,150,55]);}
  function resize(){const box=canvas.getBoundingClientRect();width=Math.max(280,box.width);height=Math.max(260,box.height);dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);if(defaultView)view('asia');else schedule();}
  function visible(row){const b=row.projected,halfW=width/camera.scale/2,halfH=height/camera.scale/2;return b[2]>=camera.x-halfW&&b[0]<=camera.x+halfW&&b[3]>=camera.y-halfH&&b[1]<=camera.y+halfH;}
  function rowsToDraw(){
    const rows=world.filter(visible);
    for(const row of asia){
      if(!visible(row))continue;
      const u=row.unit,b=row.projected,size=Math.max(b[2]-b[0],b[3]-b[1])*camera.scale;
      if(u.level==='CHN-ADM1'||camera.scale>=14&&size>=3||selection===u.id)rows.push(row);
    }
    return rows.sort((a,b)=>(a.unit.level==='world'?0:a.unit.level==='CHN-ADM1'?1:2)-(b.unit.level==='world'?0:b.unit.level==='CHN-ADM1'?1:2));
  }
  function draw(){
    if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#dfe9e4';ctx.fillRect(0,0,width,height);
    ctx.save();ctx.translate(width/2,height/2);ctx.scale(camera.scale,camera.scale);ctx.translate(-camera.x,-camera.y);
    ctx.strokeStyle='#c7d7d0';ctx.lineWidth=.6/camera.scale;
    for(let lon=-180;lon<=180;lon+=30){ctx.beginPath();ctx.moveTo(lon,-mercator(80));ctx.lineTo(lon,-mercator(-70));ctx.stroke();}
    for(let lat=-60;lat<=75;lat+=15){ctx.beginPath();ctx.moveTo(-180,-mercator(lat));ctx.lineTo(180,-mercator(lat));ctx.stroke();}
    const rows=rowsToDraw();
    for(const row of rows){
      const s=situation(row.unit);ctx.fillStyle=controllerColor(s.uncertain?s.controllerId:s.controllerId+':'+s.controller);ctx.fill(row.path,'evenodd');
      if(s.war){ctx.fillStyle=s.frontline?'#a62f3280':'#db9d3f55';ctx.fill(row.path,'evenodd');}
      ctx.lineWidth=(row.unit.level==='world'?1:.55)/camera.scale;ctx.strokeStyle=row.unit.level==='world'?'#faf8ecbb':'#f4f3e4aa';ctx.stroke(row.path);
      if(s.frontline){ctx.strokeStyle='#9b3533';ctx.lineWidth=2/camera.scale;ctx.stroke(row.path);}
    }
    const selected=rows.find(row=>row.unit.id===selection);if(selected){ctx.strokeStyle='#203d34';ctx.lineWidth=3/camera.scale;ctx.stroke(selected.path);}
    ctx.restore();
    // Labels remain in screen pixels. Draw only labels with room to breathe.
    const occupied=[];ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='12px system-ui, sans-serif';
    const labelRows=[...rows].sort((a,b)=>(b.unit.id===selection)-(a.unit.id===selection));
    for(const row of labelRows){
      const u=row.unit,b=row.projected,bw=(b[2]-b[0])*camera.scale,bh=(b[3]-b[1])*camera.scale;
      if(u.id!==selection&&(bw<56||bh<24))continue;
      if(u.level==='world'&&camera.scale>=14&&asia.some(a=>a.unit.country===u.country))continue;
      if(u.level==='CHN-ADM1'&&camera.scale>=35)continue;
      const x=(u.center[0]-camera.x)*camera.scale+width/2,y=(-mercator(u.center[1])-camera.y)*camera.scale+height/2;
      if(x<25||x>width-25||y<12||y>height-12)continue;
      const text=u.name.length>14?u.name.slice(0,13)+'…':u.name,w=ctx.measureText(text).width+10,box=[x-w/2,y-9,w,18];
      if(occupied.some(([a,c,d,e])=>x+w/2>a&&x-w/2<a+d&&y+9>c&&y-9<c+e))continue;
      occupied.push(box);ctx.fillStyle='#fffdf0dd';ctx.fillRect(...box);ctx.fillStyle='#263d35';ctx.fillText(text,x,y);
    }
    const metersPerPx=111320*Math.cos(inverseMercator(-camera.y)*Math.PI/180)/camera.scale;
    const km=Math.max(.01,metersPerPx*80/1000);scaleLabel.textContent=`约 ${km>=1?Math.round(km):Math.round(km*1000)+' 米'}${km>=1?' 公里':''}`;
  }
  function renderDetail(unit){
    const s=situation(unit),source=unit.source||{},badge=s.frontline?'交战地区':s.war?'战时影响区':'暂无当地战事';
    detail.innerHTML=`<div class="atlas-detail-title"><div><span class="tiny-label">${escape(unit.parent||byId.get('country:'+unit.country)?.name||unit.country)} · ${escape(source.level||unit.level)}</span><h4>${escape(unit.name)}</h4></div><span class="atlas-badge ${s.war?'is-war':''}">${badge}</span></div><dl><div><dt>目前管治</dt><dd>${escape(s.controller)}</dd></div>${s.ideology?`<div><dt>政治取向</dt><dd>${escape(s.ideology)}</dd></div>`:''}${s.conflict?`<div><dt>当前战事</dt><dd>${escape(s.conflict)}</dd></div>`:''}</dl><p>${escape(s.description)}</p><small>边界资料：${escape(source.provider||'geoBoundaries')} · ${escape(source.year||'来源年份未标明')}。${unit.aliases[0]?`资料名称：${escape(unit.aliases[0])}。`:''}</small>`;
  }
  function select(unit,zoom=false){selection=unit.id;renderDetail(unit);if(zoom){defaultView=false;fit(unit.bounds);}else schedule();}
  function zoomAt(multiplier,x=width/2,y=height/2){defaultView=false;const previous=camera.scale;camera.scale=clamp(previous*multiplier,.5,24000);camera.x+=(x-width/2)*(1/previous-1/camera.scale);camera.y+=(y-height/2)*(1/previous-1/camera.scale);schedule();}
  function local(event){const box=canvas.getBoundingClientRect();return {x:event.clientX-box.left,y:event.clientY-box.top};}
  function hit(x,y){
    const gx=(x-width/2)/camera.scale+camera.x,gy=(y-height/2)/camera.scale+camera.y;
    const rows=[...world,...asia].filter(row=>gx>=row.projected[0]&&gx<=row.projected[2]&&gy>=row.projected[1]&&gy<=row.projected[3]);
    rows.sort((a,b)=>(a.projected[2]-a.projected[0])*(a.projected[3]-a.projected[1])-(b.projected[2]-b.projected[0])*(b.projected[3]-b.projected[1]));
    ctx.save();ctx.setTransform(1,0,0,1,0,0);const found=rows.find(row=>ctx.isPointInPath(row.path,gx,gy,'evenodd'));ctx.restore();if(found)select(found.unit);
  }
  listen(canvas,'pointerdown',event=>{if(event.button&&event.button!==0)return;event.preventDefault();canvas.setPointerCapture(event.pointerId);const p=local(event);pointers.set(event.pointerId,p);defaultView=false;drag={...p,moved:false};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(b.x-a.x,b.y-a.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}});
  listen(canvas,'pointermove',event=>{if(!pointers.has(event.pointerId))return;const p=local(event),previous=pointers.get(event.pointerId);pointers.set(event.pointerId,p);if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(b.x-a.x,b.y-a.y),x=(a.x+b.x)/2,y=(a.y+b.y)/2;if(pinch){zoomAt(distance/Math.max(pinch.distance,1),x,y);camera.x-=(x-pinch.x)/camera.scale;camera.y-=(y-pinch.y)/camera.scale;}pinch={distance,x,y};if(drag)drag.moved=true;}else{camera.x-=(p.x-previous.x)/camera.scale;camera.y-=(p.y-previous.y)/camera.scale;if(drag&&Math.hypot(p.x-drag.x,p.y-drag.y)>5)drag.moved=true;}schedule();});
  listen(canvas,'pointerup',event=>{const p=local(event);if(pointers.size===1&&drag&&!drag.moved)hit(p.x,p.y);pointers.delete(event.pointerId);pinch=null;if(!pointers.size)drag=null;});
  listen(canvas,'pointercancel',event=>{pointers.delete(event.pointerId);pinch=null;drag=null;});
  listen(canvas,'wheel',event=>{event.preventDefault();const p=local(event);zoomAt(Math.exp(-event.deltaY*.002),p.x,p.y);},{passive:false});
  listen(canvas,'keydown',event=>{if(['+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();defaultView=false;if(event.key==='+'||event.key==='=')zoomAt(1.5);else if(event.key==='-')zoomAt(1/1.5);else{camera.x+=event.key==='ArrowLeft'?-60/camera.scale:event.key==='ArrowRight'?60/camera.scale:0;camera.y+=event.key==='ArrowUp'?-60/camera.scale:event.key==='ArrowDown'?60/camera.scale:0;schedule();}}});
  for(const button of host.querySelectorAll('[data-atlas-view]'))listen(button,'click',()=>view(button.dataset.atlasView));
  for(const button of host.querySelectorAll('[data-atlas-zoom]'))listen(button,'click',()=>zoomAt(button.dataset.atlasZoom==='in'?1.65:1/1.65));
  listen(host.querySelector('form'),'submit',event=>{
    event.preventDefault();const text=host.querySelector('input').value.trim();if(!text){results.replaceChildren();return;}
    let found=resolveTerritoryTargets(text);if(!found.length)found=searchGeographyUnits(text);
    results.innerHTML=found.length?found.map(u=>`<button type="button" data-unit="${escape(u.id)}">${escape(u.parent?u.parent+' · ':'')}${escape(u.name)}<small>${escape(u.source?.level||u.country)}</small></button>`).join(''):'<p>未找到明确的地区。可以填写完整县市名，或加上上一级地区。</p>';
    for(const button of results.querySelectorAll('button'))button.onclick=()=>select(byId.get(button.dataset.unit),true);
    if(found.length===1)select(found[0],true);
  });
  const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;resizeObserver?.observe(canvas);resize();
  (async()=>{
    try{world=await loadLayer('world',abort.signal);if(disposed)return;status.textContent='正在展开亚洲地方边界…';schedule();asia=await loadLayer('asia',abort.signal);if(disposed)return;status.hidden=true;schedule();}
    catch(error){if(!disposed&&error.name!=='AbortError'){status.textContent='地图暂未完整载入，重新打开可再试。';schedule();}}
  })();
  return {update(next){state=next;prepared=createTerritoryContext(state,lore);situations.clear();if(selection)renderDetail(byId.get(selection));schedule();},destroy(){disposed=true;abort.abort();if(frame)cancelAnimationFrame(frame);resizeObserver?.disconnect();for(const remove of listeners)remove();pointers.clear();}};
}

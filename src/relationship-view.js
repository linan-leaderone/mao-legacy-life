import {getRelationshipGraph} from './relationships.js';
import {getPortrait,contactPortraitValue} from './portraits.js';

const SVG_NS='http://www.w3.org/2000/svg';
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const intersects=(a,b,gap=0)=>a.x-a.w/2<b.x+b.w/2+gap&&a.x+a.w/2>b.x-b.w/2-gap&&a.y-a.h/2<b.y+b.h/2+gap&&a.y+a.h/2>b.y-b.h/2-gap;
const short=(text,max=15)=>{const characters=Array.from(String(text||''));return characters.length>max?characters.slice(0,max-1).join('')+'…':characters.join('');};
const point=(x,y)=>({x,y});
const length=p=>Math.hypot(p.x,p.y)||1;
const titleOf=node=>node?.name||'姓名未详';
const edgeLabel=edge=>edge.status||'保持联系';
const STANDARD_STATUSES=new Set(['保持联系','家人','亲人','朋友','伴侣','盟友','敌对','对手','师友','伙伴','相识','疏远','关系紧张','乐队伙伴','党内同事','联盟伙伴','有分歧的盟友','保持政治联系']);
const attached=(edge,id)=>edge.source===id||edge.target===id;
const otherEnd=(edge,id)=>edge.source===id?edge.target:edge.source;
const strong=edge=>Number(edge.strength)>=60||['family','partner','ally','rival','hostile','mentor'].includes(edge.kind);
const hostile=edge=>/rival|hostile|estranged/.test(edge.kind||'')||/敌|对立|疏远|竞争|冲突/.test(edge.status||'');

/** Compatibility name: every person remains in the one canvas; search only locates. */
export function relationshipPage(graph,{query=''}={}){
  const text=String(query).normalize('NFKC').trim().toLocaleLowerCase(),edges=graph.edges||[],player=graph.nodes.find(node=>node.id==='player');
  const people=graph.nodes.filter(node=>node.id!=='player'),matches=people.filter(node=>{
    const relations=edges.filter(edge=>attached(edge,node.id));
    if(text&&!`${node.name} ${node.detail||''} ${relations.map(edge=>`${edge.status} ${edge.detail||''}`).join(' ')}`.normalize('NFKC').toLocaleLowerCase().includes(text))return false;
    return true;
  });
  return {nodes:[...(player?[player]:[]),...people],people,matches,total:people.length,page:0,pages:1,pageSize:people.length};
}

function nodeRect(node){
  if(!node.textScale)return {x:node.x,y:node.y+20,w:148,h:150};
  const scale=node.textScale,r=node.id==='player'?46:37,top=-r-10,bottom=r+7*scale+(Array.from(titleOf(node)).length>11?41:25)*scale;
  return {x:node.x,y:node.y+(top+bottom)/2,w:Math.max((r+10)*2,node.captionWidth),h:bottom-top};
}
function labelWidth(text){return clamp(Array.from(text).reduce((width,char)=>width+(/[\u2e80-\uffff]/.test(char)?12:7),20),48,150);}
function curvePoint(curve,t){const s=1-t;return {x:s*s*s*curve.a.x+3*s*s*t*curve.b.x+3*s*t*t*curve.c.x+t*t*t*curve.d.x,y:s*s*s*curve.a.y+3*s*s*t*curve.b.y+3*s*t*t*curve.c.y+t*t*t*curve.d.y};}
function makeCurve(a,b,bend){
  const d=point(b.x-a.x,b.y-a.y),dist=length(d),u=point(d.x/dist,d.y/dist),n=point(-u.y,u.x),ar=a.id==='player'?47:38,br=b.id==='player'?47:38;
  const start=point(a.x+u.x*ar,a.y+u.y*ar),end=point(b.x-u.x*br,b.y-u.y*br);
  return {a:start,b:point(start.x+d.x*.27+n.x*bend,start.y+d.y*.27+n.y*bend),c:point(end.x-d.x*.27+n.x*bend*.82,end.y-d.y*.27+n.y*bend*.82),d:end};
}
function blocked(curve,nodes,a,b){
  for(let t=.06;t<.95;t+=.025){const p=curvePoint(curve,t);if(nodes.some(node=>node.id!==a&&node.id!==b&&intersects({x:p.x,y:p.y,w:5,h:5},nodeRect(node),6)))return true;}
  return false;
}
function boundsOf(nodes,edges){
  const points=nodes.flatMap(node=>{const box=nodeRect(node);return [{x:box.x-box.w/2-14,y:box.y-box.h/2-8},{x:box.x+box.w/2+14,y:box.y+box.h/2+8}];});
  for(const edge of edges){for(let t=0;t<=1;t+=.05)points.push(curvePoint(edge.curve,t));if(edge.label)points.push({x:edge.label.x-edge.label.w/2-8,y:edge.label.y-edge.label.h/2-8},{x:edge.label.x+edge.label.w/2+8,y:edge.label.y+edge.label.h/2+8});}
  const minX=Math.min(-130,...points.map(p=>p.x)),maxX=Math.max(130,...points.map(p=>p.x)),minY=Math.min(-130,...points.map(p=>p.y)),maxY=Math.max(130,...points.map(p=>p.y));
  return {x:(minX+maxX)/2,y:(minY+maxY)/2,w:maxX-minX+60,h:maxY-minY+60};
}

/** Local drag positions are separate from saved relationships. The player stays at the origin. */
export function avoidRelationshipOverlap(desired,nodes,id){
  const target={x:clamp(Number(desired.x)||0,-10000,10000),y:clamp(Number(desired.y)||0,-10000,10000)};
  const previous=nodes.find(node=>node.id===id),valid=p=>!nodes.some(node=>node.id!==id&&intersects(nodeRect({...previous,...desired,...p,id}),nodeRect(node),18));
  if(valid(target))return target;
  for(let ring=1;ring<=24;ring++)for(let step=0;step<32;step++){
    const angle=step*Math.PI/16,radius=ring*24,p={x:target.x+Math.cos(angle)*radius,y:target.y+Math.sin(angle)*radius};
    if(valid(p))return p;
  }
  return {x:target.x+760,y:target.y+760};
}

/** Stable concentric placement, with the player fixed at the origin and no hidden pages. */
export function buildRelationshipLayout(graph,{positions={},textScale=0,selectedId='player'}={}){
  const source=graph.nodes,people=source.filter(node=>node.id!=='player');
  const fontGeometry=node=>textScale?{textScale,captionWidth:Math.max(52,Array.from(short(titleOf(node),11)).reduce((w,char)=>w+(/[\u2e80-\uffff]/.test(char)?13:8),20))*textScale}:{};
  const center=source.find(node=>node.id==='player')||{id:'player',name:'你'},nodes=[{...center,...fontGeometry(center),x:0,y:0}];
  people.forEach((node,index)=>{
    let ring=1,offset=index;while(offset>=ring*6){offset-=ring*6;ring++;}
    const count=Math.min(ring*6,people.length-(ring-1)*ring*3),angle=-Math.PI/2+offset*Math.PI*2/Math.max(count,1)+(ring%2?0:.17),radius=180+(ring-1)*240;
    const wanted=positions instanceof Map?positions.get(node.id):positions[node.id],geometry=fontGeometry(node),position=avoidRelationshipOverlap({...geometry,...(wanted||point(Math.cos(angle)*radius,Math.sin(angle)*radius))},nodes,node.id);
    nodes.push({...node,...geometry,...position});
  });
  const byId=new Map(nodes.map(node=>[node.id,node])),occupied=nodes.map(nodeRect),edges=[];
  const visible=(graph.edges||[]).filter(edge=>byId.has(edge.source)&&byId.has(edge.target)&&(attached(edge,'player')||strong(edge))).sort((a,b)=>Number(attached(b,'player'))-Number(attached(a,'player'))||Number(b.strength||0)-Number(a.strength||0)||String(a.id).localeCompare(String(b.id)));
  visible.forEach((edge,index)=>{
    const a=byId.get(edge.source),b=byId.get(edge.target),text=short(edgeLabel(edge),textScale?8:17),w=(textScale?Math.max(labelWidth(text),Array.from(text).reduce((n,char)=>n+(/[\u2e80-\uffff]/.test(char)?12:7),20)):labelWidth(text))*(textScale||1),h=27*(textScale||1),sign=(hash(edge.id)%2?1:-1),direct=attached(edge,'player');
    const needsLabel=attached(edge,selectedId),fast=textScale>1||nodes.length>32||visible.length>140;
    if(!needsLabel){const curve=makeCurve(a,b,(direct?24:55)*sign);edges.push({...edge,text,curve,label:null,path:`M ${curve.a.x} ${curve.a.y} C ${curve.b.x} ${curve.b.y}, ${curve.c.x} ${curve.c.y}, ${curve.d.x} ${curve.d.y}`});return;}
    let picked=null;
    for(let attempt=0;attempt<(fast?12:90)&&!picked;attempt++){
      const magnitude=attempt===0?(direct?24:100):50+Math.floor((attempt+1)/2)*44,bend=magnitude*sign*(attempt%2?-1:1),curve=makeCurve(a,b,bend);
      if(!fast&&blocked(curve,nodes,a.id,b.id))continue;
      for(const t of [.5,.4,.6,.3,.7,.22,.78]){const p=curvePoint(curve,t),label={...p,w,h};if(!occupied.some(box=>intersects(label,box,9))){picked={...edge,text,curve,label,path:`M ${curve.a.x} ${curve.a.y} C ${curve.b.x} ${curve.b.y}, ${curve.c.x} ${curve.c.y}, ${curve.d.x} ${curve.d.y}`};break;}}
    }
    if(!picked){
      // Dense or freely dragged networks can need a wide outer lane. It remains reachable via zoom/full view.
      for(let lane=1;lane<=60&&!picked;lane++){
        const curve=makeCurve(a,b,(2300+lane*180+index*35)*sign),p=curvePoint(curve,.5),label={...p,w,h};
        if((fast||!blocked(curve,nodes,a.id,b.id))&&!occupied.some(box=>intersects(label,box,9)))picked={...edge,text,curve,label,path:`M ${curve.a.x} ${curve.a.y} C ${curve.b.x} ${curve.b.y}, ${curve.c.x} ${curve.c.y}, ${curve.d.x} ${curve.d.y}`};
      }
    }
    if(picked){occupied.push(picked.label);edges.push(picked);}
    else{const curve=makeCurve(a,b,24*sign);edges.push({...edge,text,curve,label:null,path:`M ${curve.a.x} ${curve.a.y} C ${curve.b.x} ${curve.b.y}, ${curve.c.x} ${curve.c.y}, ${curve.d.x} ${curve.d.y}`});}
  });
  return {nodes,edges,bounds:boundsOf(nodes,edges),relationshipCount:visible.length};
}

let nextMapId=0;

/** A read-only map: pan, zoom, filter and freely arrange this view without advancing or changing a life. */
export function openRelationshipMap(state,{document:doc=globalThis.document,window:win=globalThis.window,portraitFor=getPortrait,translate=value=>value}={}){
  return new Promise(resolve=>{
    if(!doc?.createElementNS||!doc?.body){resolve();return;}
    const t=value=>String(translate(value)||value),statusOf=edge=>STANDARD_STATUSES.has(edgeLabel(edge))?t(edgeLabel(edge)):edgeLabel(edge),graph=getRelationshipGraph(state),byId=new Map(graph.nodes.map(node=>[node.id,node])),previousFocus=doc.activeElement,uid=`relationship-${++nextMapId}`;
    const dialog=doc.createElement('dialog');dialog.className='relationship-dialog';dialog.setAttribute('aria-labelledby',`${uid}-title`);
    const make=(tag,className,text)=>{const element=doc.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;};
    const svgElement=(tag,attrs={})=>{const element=doc.createElementNS(SVG_NS,tag);for(const [name,value]of Object.entries(attrs))element.setAttribute(name,String(value));return element;};
    const listeners=[];const listen=(element,type,handler,options)=>{if(!element?.addEventListener)return;element.addEventListener(type,handler,options);listeners.push(()=>element.removeEventListener(type,handler,options));};
    const button=(text,className,handler)=>{const element=make('button',className,t(text));element.type='button';if(handler)listen(element,'click',handler);return element;};
    const header=make('header','relationship-header'),heading=make('div'),eyebrow=make('span','relationship-eyebrow',t('与你同行的人')),title=make('h2','',t('人物关系'));title.id=`${uid}-title`;heading.append(eyebrow,title);
    const close=button('关闭','relationship-close',()=>finish());close.setAttribute('aria-label',t('关闭人物关系'));header.append(heading,close);
    const tools=make('div','relationship-tools'),searchLabel=make('label','relationship-search'),searchCaption=make('span','relationship-sr-only',t('搜索人物与关系')),search=make('input');search.type='search';search.placeholder=t('搜索姓名、关系或经历');search.setAttribute('aria-label',t('搜索人物与关系'));search.autocomplete='off';searchLabel.append(searchCaption,search);
    const focusOnly=button('定位所选','relationship-focus',()=>choose(selected,{jump:true}));tools.append(searchLabel,focusOnly);
    const searchResults=make('div','relationship-search-results');searchResults.setAttribute('aria-label',t('搜索结果'));searchResults.setAttribute('aria-live','polite');searchResults.hidden=true;tools.append(searchResults);
    const body=make('div','relationship-body'),mapSection=make('section','relationship-map-section'),stage=make('div','relationship-stage'),svg=svgElement('svg',{class:'relationship-canvas',tabindex:'0',role:'group','aria-label':t('人物关系图。可拖动人物或空白处，也可使用缩放按钮。'),'aria-describedby':`${uid}-help`,preserveAspectRatio:'xMidYMid meet'});
    const backdrop=svgElement('rect',{x:-100000,y:-100000,width:200000,height:200000,fill:'transparent'}),drawing=svgElement('g');svg.append(backdrop,drawing);stage.append(svg);
    const mapTools=make('div','relationship-map-tools'),zoomOut=button('−','',()=>zoomAt(.8)),zoomLabel=make('output','relationship-zoom','100%'),zoomIn=button('＋','',()=>zoomAt(1.25)),home=button('回到本人','',()=>{autoFit=false;camera={x:0,y:0,scale:1};applyCamera();}),fit=button('全览','',()=>fitView()),reset=button('自动排列','',()=>{positions.clear();render(true);});zoomOut.setAttribute('aria-label',t('缩小'));zoomIn.setAttribute('aria-label',t('放大'));zoomLabel.setAttribute('aria-label',t('缩放比例'));mapTools.append(zoomOut,zoomLabel,zoomIn,home,fit,reset);
    const empty=make('p','relationship-empty');stage.append(empty);
    const help=make('p','relationship-help',t('所有人都在同一张图中。拖动空白处查看远处，搜索可定位人物；点击头像查看联系，双指或滚轮缩放。'));help.id=`${uid}-help`;mapSection.append(stage,mapTools,help);
    const detail=make('aside','relationship-detail');detail.setAttribute('aria-label',t('人物与联系详情'));body.append(mapSection,detail);
    const footer=make('div','relationship-footer'),counts=make('span'),legend=make('span','relationship-legend',t('实线：你的联系　曲线：人物间的紧密联系'));footer.append(counts,legend);dialog.append(header,tools,body,footer);
    let selected='player',pageState,layout,camera={x:0,y:0,scale:1},autoFit=false,textZoom=1.25,closed=false,observer=null,frame=0,drag=null,pinch=null,suppressClick=false;const positions=new Map(),pointers=new Map();
    const size=()=>{const box=svg.getBoundingClientRect();return {w:Math.max(1,box.width||780),h:Math.max(1,box.height||520),left:box.left||0,top:box.top||0};};
    const applyCamera=()=>{const box=size();svg.setAttribute('viewBox',`${camera.x-box.w/camera.scale/2} ${camera.y-box.h/camera.scale/2} ${box.w/camera.scale} ${box.h/camera.scale}`);svg.setAttribute('data-overview',String(camera.scale<.8));zoomLabel.textContent=`${Math.round(camera.scale*100)}%`;};
    const screenPoint=(x,y)=>{const box=size();return {x:camera.x+(x-box.left-box.w/2)/camera.scale,y:camera.y+(y-box.top-box.h/2)/camera.scale};};
    function zoomAt(factor,client){autoFit=false;const before=client?screenPoint(client.x,client.y):null;camera.scale=clamp(camera.scale*factor,.02,2.4);if(client){const after=screenPoint(client.x,client.y);camera.x+=before.x-after.x;camera.y+=before.y-after.y;}applyCamera();}
    function fitCamera(bounds,centerOnPlayer){
      const box=size(),padding=20,x=centerOnPlayer?0:bounds.x,y=centerOnPlayer?0:bounds.y;
      // Fit complete circles, name plates and curved labels. When the player is
      // centred, the asymmetric name space below each face also needs to fit.
      const width=bounds.w+2*Math.abs(bounds.x-x),height=bounds.h+2*Math.abs(bounds.y-y);
      return {x,y,scale:clamp(Math.min(Math.max(1,box.w-padding*2)/width,Math.max(1,box.h-padding*2)/height),.001,1.2)};
    }
    function fitView(){if(!layout)return;autoFit=true;camera=fitCamera(layout.bounds,true);applyCamera();}
    const directFor=id=>graph.edges.find(edge=>attached(edge,'player')&&attached(edge,id));
    function choose(id,{jump=false}={}){
      if(!byId.has(id))return;selected=id;
      render(false);const node=layout.nodes.find(node=>node.id===id);if(jump&&node){autoFit=false;const box=size(),showPlayer=Math.abs(node.x)+180<box.w&&Math.abs(node.y)+180<box.h;camera.x=showPlayer?node.x/2:node.x;camera.y=showPlayer?node.y/2:node.y;camera.scale=Math.max(1,camera.scale);applyCamera();}
      const target=[...svg.querySelectorAll('[data-person-id]')].find(element=>element.getAttribute('data-person-id')===id);target?.focus?.({preventScroll:true});
    }
    function renderDetails(){
      detail.replaceChildren();const node=byId.get(selected)||byId.get('player'),related=graph.edges.filter(edge=>attached(edge,node.id)),top=make('div','relationship-detail-heading'),name=make('h3','',titleOf(node)),badge=make('span','relationship-detail-badge',node.id==='player'?t('你'):statusOf(directFor(node.id)||{}));name.setAttribute('data-no-translate','');badge.setAttribute('data-no-translate','');top.append(name,badge);detail.append(top);
      if(node.detail){const prose=make('p','relationship-description',node.detail);prose.setAttribute('data-no-translate','');detail.append(prose);}
      if(node.id==='player')detail.append(make('p','relationship-description',t('一路上认识的人都留在这里。选择一个名字，查看你们的联系。')));
      const list=make('ul','relationship-list');
      for(const edge of related){const other=byId.get(otherEnd(edge,node.id));if(!other)continue;const row=make('li'),link=make('button','relationship-person-link');row.setAttribute('data-no-translate','');link.type='button';link.setAttribute('data-jump-id',other.id);const personName=make('strong','',titleOf(other)),stateText=make('span','',statusOf(edge));link.append(personName,stateText);row.append(link);if(edge.detail)row.append(make('p','',edge.detail));list.append(row);}
      if(!related.length)detail.append(make('p','relationship-description',t('还没有留下明确的来往记录。')));detail.append(list);
      focusOnly.disabled=false;
    }
    function render(fitAfter=false){
      const translatedGraph={...graph,edges:graph.edges.map(edge=>({...edge,status:statusOf(edge)}))};
      pageState=relationshipPage(graph,{query:search.value});
      layout=buildRelationshipLayout(translatedGraph,{positions,textScale:textZoom,selectedId:selected});
      const matches=new Set(search.value.trim()?pageState.matches.map(n=>n.id):[]);
      searchResults.replaceChildren();searchResults.hidden=!search.value.trim();
      if(search.value.trim()){
        if(!pageState.matches.length)searchResults.append(make('p','',t('没有找到符合条件的人物。')));
        for(const node of pageState.matches){const item=make('button','relationship-search-result',titleOf(node));item.type='button';item.setAttribute('data-jump-id',node.id);item.setAttribute('data-no-translate','');searchResults.append(item);}
      }
      drawing.replaceChildren();
      const definitions=svgElement('defs'),edgeGroup=svgElement('g',{class:'relationship-edges'}),labelGroup=svgElement('g',{class:'relationship-edge-labels'}),nodeGroup=svgElement('g',{class:'relationship-nodes'});drawing.append(definitions,edgeGroup,labelGroup,nodeGroup);
      for(const edge of layout.edges){const active=selected==='player'?attached(edge,'player'):attached(edge,selected),cross=!attached(edge,'player'),classes=`relationship-edge${cross?' relationship-peer-edge':''}${active?' is-active':''}${hostile(edge)?' is-opposed':''}`;
        const path=svgElement('path',{d:edge.path,class:classes,fill:'none','vector-effect':'non-scaling-stroke'});edgeGroup.append(path);
        if(edge.label){const group=svgElement('g',{class:`relationship-edge-label${active?' is-active':''}${hostile(edge)?' is-opposed':''}`,transform:`translate(${edge.label.x} ${edge.label.y})`,'data-no-translate':''}),bg=svgElement('rect',{x:-edge.label.w/2,y:-edge.label.h/2,width:edge.label.w,height:edge.label.h,rx:12*textZoom}),text=svgElement('text',{'text-anchor':'middle','dominant-baseline':'central',style:`font-size:${12*textZoom}px`}),full=svgElement('title');text.textContent=edge.text;full.textContent=`${titleOf(byId.get(edge.source))} · ${titleOf(byId.get(edge.target))}：${edgeLabel(edge)}`;group.append(full,bg,text);labelGroup.append(group);}
      }
      for(const node of layout.nodes){const isPlayer=node.id==='player',r=isPlayer?46:37,active=node.id===selected,nodeElement=svgElement('g',{class:`relationship-node${isPlayer?' relationship-player':''}${active?' is-selected':''}${matches.has(node.id)?' is-search-match':''}`,transform:`translate(${node.x} ${node.y})`,tabindex:'0',role:'button','aria-label':`${titleOf(node)}${isPlayer?' · '+t('你'):' · '+statusOf(directFor(node.id)||{})}`,'aria-pressed':String(active),'data-person-id':node.id,'data-no-translate':''}),title=svgElement('title');title.textContent=titleOf(node);nodeElement.append(title);
        const halo=svgElement('circle',{r:r+7,class:'relationship-node-halo'}),circle=svgElement('circle',{r,class:'relationship-node-circle'});nodeElement.append(halo,circle);
        let portrait;try{portrait=portraitFor(contactPortraitValue(state,node));}catch{portrait=null;}
        if(portrait?.src){const clipId=`${uid}-portrait-${hash(node.id).toString(36)}`,clip=svgElement('clipPath',{id:clipId});clip.append(svgElement('circle',{r:r-3}));definitions.append(clip);const image=svgElement('image',{href:portrait.src,x:-r+3,y:-r+3,width:(r-3)*2,height:(r-3)*2,preserveAspectRatio:'xMidYMin slice','clip-path':`url(#${clipId})`,'aria-hidden':'true',style:portrait.style||''});nodeElement.append(image);}
        else{const initial=svgElement('text',{class:'relationship-initial','text-anchor':'middle','dominant-baseline':'central','aria-hidden':'true'});initial.textContent=Array.from(titleOf(node))[0];nodeElement.append(initial);}
        const lines=Array.from(titleOf(node)),caption=short(node.name,20),label=svgElement('text',{class:'relationship-node-name','text-anchor':'middle',y:r+22*textZoom,style:`font-size:${13*textZoom}px`}),labelBg=svgElement('rect',{class:'relationship-name-backdrop',x:-node.captionWidth/2,y:r+7*textZoom,width:node.captionWidth,height:(lines.length>11?41:25)*textZoom,rx:7*textZoom});
        if(lines.length>11){for(const[index,line]of[short(lines.slice(0,10).join(''),11),short(lines.slice(10).join(''),11)].entries()){const span=svgElement('tspan',{x:0,dy:index?16*textZoom:0});span.textContent=line;label.append(span);}}
        else label.textContent=caption;nodeElement.append(labelBg,label);nodeGroup.append(nodeElement);
      }
      empty.hidden=pageState.total>0;empty.textContent=t('相识的人会陆续出现在这里。');
      counts.textContent=`${t('相识')} ${Math.max(0,graph.nodes.length-1)} ${t('人')} · ${t('联系')} ${graph.edges.length} · ${t('同一张图')}`;
      renderDetails();if(fitAfter){autoFit=false;camera={x:0,y:0,scale:size().w<540?.85:1};applyCamera();}else if(autoFit)fitView();else applyCamera();
    }
    function release(){for(const id of pointers.keys())try{if(svg.hasPointerCapture?.(id))svg.releasePointerCapture(id);}catch{}pointers.clear();drag=null;pinch=null;}
    function finish(){if(closed)return;closed=true;release();listeners.forEach(remove=>remove());observer?.disconnect();if(frame)win?.cancelAnimationFrame?.(frame);if(dialog.open)dialog.close();dialog.remove();if(previousFocus?.isConnected)previousFocus.focus?.({preventScroll:true});resolve();}
    const personFrom=target=>{let element=target;while(element&&element!==svg){const id=element.getAttribute?.('data-person-id');if(id)return id;element=element.parentNode;}return null;};
    listen(search,'input',()=>render(false));
    listen(searchResults,'click',event=>{const link=event.target.closest?.('[data-jump-id]');if(link&&searchResults.contains(link))choose(link.getAttribute('data-jump-id'),{jump:true});});
    listen(search,'keydown',event=>{if(event.key==='Enter'&&pageState.matches.length){event.preventDefault();choose(pageState.matches[0].id,{jump:true});}});
    listen(detail,'click',event=>{const link=event.target.closest?.('[data-jump-id]');if(link&&detail.contains(link))choose(link.getAttribute('data-jump-id'),{jump:true});});
    listen(svg,'click',event=>{if(suppressClick){suppressClick=false;return;}const id=personFrom(event.target);if(id)choose(id,{jump:camera.scale<.8});});
    listen(svg,'wheel',event=>{event.preventDefault();zoomAt(Math.exp(-clamp(event.deltaY,-150,150)*.0025),{x:event.clientX,y:event.clientY});},{passive:false});
    listen(svg,'pointerdown',event=>{
      if(event.button!==undefined&&event.button!==0)return;event.preventDefault();if(!pointers.size)suppressClick=false;svg.focus({preventScroll:true});const id=personFrom(event.target),p={x:event.clientX,y:event.clientY};pointers.set(event.pointerId,p);try{svg.setPointerCapture?.(event.pointerId);}catch{}
      if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};drag=null;return;}
      const node=layout.nodes.find(node=>node.id===id);drag={pointerId:event.pointerId,personId:id==='player'?null:id,origin:p,world:screenPoint(p.x,p.y),node:node?{x:node.x,y:node.y}:null,camera:{...camera},moved:false};
    });
    listen(svg,'pointermove',event=>{
      if(!pointers.has(event.pointerId))return;const p={x:event.clientX,y:event.clientY};pointers.set(event.pointerId,p);
      if(pointers.size>=2){const[a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(pinch?.distance){zoomAt(distance/pinch.distance,center);camera.x-=(center.x-pinch.center.x)/camera.scale;camera.y-=(center.y-pinch.center.y)/camera.scale;applyCamera();}pinch={distance,center};suppressClick=true;return;}
      if(!drag||drag.pointerId!==event.pointerId)return;const dx=p.x-drag.origin.x,dy=p.y-drag.origin.y;if(Math.hypot(dx,dy)<5&&!drag.moved)return;drag.moved=true;suppressClick=true;autoFit=false;
      if(drag.personId&&drag.node){const current=screenPoint(p.x,p.y),position=avoidRelationshipOverlap({x:drag.node.x+current.x-drag.world.x,y:drag.node.y+current.y-drag.world.y},layout.nodes,drag.personId);positions.set(drag.personId,position);selected=drag.personId;render(false);}
      else{camera.x=drag.camera.x-dx/camera.scale;camera.y=drag.camera.y-dy/camera.scale;applyCamera();}
    });
    const pointerEnd=event=>{const previous=drag;pointers.delete(event.pointerId);try{if(svg.hasPointerCapture?.(event.pointerId))svg.releasePointerCapture(event.pointerId);}catch{}if(pointers.size<2)pinch=null;if(previous?.pointerId===event.pointerId){drag=null;if(!previous.moved){const id=personFrom(event.target);if(id)choose(id,{jump:camera.scale<.8});}}};
    listen(svg,'pointerup',pointerEnd);listen(svg,'pointercancel',event=>{pointerEnd(event);suppressClick=true;});listen(win,'blur',release);
    listen(svg,'keydown',event=>{
      const id=personFrom(event.target);if((event.key==='Enter'||event.key===' ')&&id){event.preventDefault();choose(id);return;}
      if(event.key==='+'||event.key==='='){event.preventDefault();zoomAt(1.25);}else if(event.key==='-'){event.preventDefault();zoomAt(.8);}else if(event.key==='Home'){event.preventDefault();autoFit=false;camera={x:0,y:0,scale:1};applyCamera();}
      else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();autoFit=false;const dx=event.key==='ArrowLeft'?-35:event.key==='ArrowRight'?35:0,dy=event.key==='ArrowUp'?-35:event.key==='ArrowDown'?35:0;if(id&&id!=='player'&&event.shiftKey){const node=layout.nodes.find(node=>node.id===id);positions.set(id,avoidRelationshipOverlap({x:node.x+dx,y:node.y+dy},layout.nodes,id));render(false);const target=[...svg.querySelectorAll('[data-person-id]')].find(element=>element.getAttribute('data-person-id')===id);target?.focus();}else{camera.x+=dx/camera.scale;camera.y+=dy/camera.scale;applyCamera();}}
    });
    listen(dialog,'cancel',event=>{event.preventDefault();finish();});listen(dialog,'close',finish);listen(dialog,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish();}});
    doc.body.append(dialog);try{dialog.showModal();}catch{dialog.setAttribute('open','');}
    render(true);search.focus({preventScroll:true});
    // Detail height changes also resize the map on phones. Preserve the selected
    // person's camera instead of jumping back to the player after each click.
    if(win?.ResizeObserver){observer=new win.ResizeObserver(()=>{if(closed)return;if(frame)win.cancelAnimationFrame?.(frame);frame=win.requestAnimationFrame?.(()=>{frame=0;render(false);})||0;});observer.observe(stage);}
  });
}

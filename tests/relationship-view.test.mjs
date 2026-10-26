import test from 'node:test';
import assert from 'node:assert/strict';
import {relationshipPage,buildRelationshipLayout,avoidRelationshipOverlap,openRelationshipMap} from '../src/relationship-view.js';

function graphOf(count=8,dense=false){
  const nodes=[{id:'player',name:'周星河'},...Array.from({length:count},(_,i)=>({id:`person-${i}`,name:`相识人物${String(i).padStart(3,'0')}`,detail:`第${i}位认识的人`}))],edges=nodes.slice(1).map((node,i)=>({id:`player-${i}`,source:'player',target:node.id,status:i===0?'家人':i===1?'敌对':'朋友',kind:i===0?'family':i===1?'hostile':'friend',strength:75,detail:'彼此相识的经历'}));
  if(dense)for(let a=1;a<nodes.length;a++)for(let b=a+1;b<nodes.length;b++)edges.push({id:`peer-${a}-${b}`,source:nodes[a].id,target:nodes[b].id,status:'长年保持合作的伙伴',kind:'ally',strength:80});
  return {version:1,nodes,edges};
}
const overlap=(a,b)=>a.x-a.w/2<b.x+b.w/2&&a.x+a.w/2>b.x-b.w/2&&a.y-a.h/2<b.y+b.h/2&&a.y+a.h/2>b.y-b.h/2;

test('all contacts share one canvas; search and old paging arguments never hide nodes',()=>{
  const graph=graphOf(137,true),before=structuredClone(graph),result=relationshipPage(graph,{page:9,pageSize:1,group:'family',focusId:'person-136',query:'136'});
  assert.equal(result.nodes.length,138);assert.equal(result.nodes[0].id,'player');assert.equal(result.pages,1);assert.equal(result.matches.length,1);assert.equal(result.matches[0].id,'person-136');
  assert.equal(relationshipPage(graph,{query:'没有这样的人'}).nodes.length,138);assert.deepEqual(graph,before);
});

test('small and densely connected maps keep circles, captions and curve labels separate',()=>{
  for(const count of [0,1,2,6,8,12]){
    const graph=graphOf(count,true),before=structuredClone(graph),layout=buildRelationshipLayout(graph);
    assert.equal(layout.edges.length,graph.edges.length);assert.equal(layout.nodes[0].x,0);assert.equal(layout.nodes[0].y,0);
    const boxes=layout.nodes.map(node=>({id:node.id,x:node.x,y:node.y+20,w:148,h:150}));
    for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)assert.equal(overlap(boxes[a],boxes[b]),false,`${count} nodes ${boxes[a].id}/${boxes[b].id}`);
    for(const edge of layout.edges.filter(e=>e.label))for(const box of boxes)assert.equal(overlap(edge.label,box),false,`node/label ${edge.id}/${box.id}`);
    const labels=layout.edges.filter(e=>e.label);for(let a=0;a<labels.length;a++)for(let b=a+1;b<labels.length;b++)assert.equal(overlap(labels[a].label,labels[b].label),false,`labels ${labels[a].id}/${labels[b].id}`);
    assert.deepEqual(graph,before);assert.ok(layout.bounds.w>0&&layout.bounds.h>0);
  }
});

test('dragging a person onto another person resolves collision and never moves the player',()=>{
  const graph=graphOf(8,true),layout=buildRelationshipLayout(graph),placed=avoidRelationshipOverlap({x:0,y:0},layout.nodes,'person-0'),custom=new Map([['person-0',placed],['person-1',placed],['player',{x:800,y:800}]]),result=buildRelationshipLayout(graph,{positions:custom});
  assert.equal(result.nodes[0].x,0);assert.equal(result.nodes[0].y,0);assert.notEqual(Math.hypot(placed.x,placed.y),0);
  for(let a=0;a<result.nodes.length;a++)for(let b=a+1;b<result.nodes.length;b++)assert.equal(overlap({x:result.nodes[a].x,y:result.nodes[a].y+20,w:148,h:150},{x:result.nodes[b].x,y:result.nodes[b].y+20,w:148,h:150}),false);
  assert.equal(result.edges.length,graph.edges.length);
});

test('known weak links stay in data and detail while maps emphasize strong peer relations',()=>{
  const graph=graphOf(3);graph.edges.push({id:'weak',source:'person-0',target:'person-1',status:'见过一次',kind:'acquaintance',strength:20},{id:'strong',source:'person-1',target:'person-2',status:'对手',kind:'rival',strength:80});
  const before=structuredClone(graph),layout=buildRelationshipLayout(graph);assert.equal(layout.edges.length,4);assert.equal(graph.edges.length,5);assert.deepEqual(graph,before);
});

function browserHarness(width=800){
  const elements=[],frames=new Map(),observers=[];let sequence=0;
  class Element extends EventTarget{
    constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.attributes=new Map();this.handlers=new Map();this.captures=new Set();this.value='';this.className='';this.textContent='';this.isConnected=true;this.disabled=false;elements.push(this);}
    addEventListener(type,handler,options){super.addEventListener(type,handler,options);if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(handler);}
    removeEventListener(type,handler,options){super.removeEventListener(type,handler,options);this.handlers.get(type)?.delete(handler);}
    append(...children){this.children.push(...children);children.forEach(child=>child.parentNode=this);}
    replaceChildren(...children){this.children.forEach(child=>child.parentNode=null);this.children=[];this.append(...children);}
    setAttribute(key,value){this.attributes.set(key,String(value));if(key==='class')this.className=String(value);}
    getAttribute(key){return this.attributes.get(key);}
    focus(){document.activeElement=this;}
    remove(){this.removed=true;this.isConnected=false;}
    contains(node){return this===node||this.children.some(child=>child.contains(node));}
    matches(selector){if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1));if(selector.startsWith('[')){const [key,value]=selector.slice(1,-1).split('=');return this.attributes.has(key)&&(!value||this.getAttribute(key)===value.replace(/^"|"$/g,''));}return this.tagName.toLowerCase()===selector;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0];}
    closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector);}
    showModal(){this.open=true;}
    close(){this.open=false;this.dispatchEvent(new Event('close'));}
    getBoundingClientRect(){return {width,height:500,left:0,top:0};}
    setPointerCapture(id){this.captures.add(id);}
    hasPointerCapture(id){return this.captures.has(id);}
    releasePointerCapture(id){this.captures.delete(id);}
  }
  const document=new Element('document'),window=new Element('window'),previous=new Element('button');document.body=new Element('body');document.activeElement=previous;document.createElement=tag=>new Element(tag);document.createElementNS=(ns,tag)=>new Element(tag);
  window.requestAnimationFrame=callback=>{frames.set(++sequence,callback);return sequence;};window.cancelAnimationFrame=id=>frames.delete(id);window.ResizeObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}};
  return {document,window,previous,elements,observers,dialog:()=>document.body.children[0],listenerCount:()=>elements.reduce((total,element)=>total+[...element.handlers.values()].reduce((n,set)=>n+set.size,0),0),captures:()=>elements.reduce((n,element)=>n+element.captures.size,0),frames};
}
function fire(element,type,values={},target){const event=new Event(type,{cancelable:true});Object.assign(event,values);if(target)Object.defineProperty(event,'target',{value:target});element.dispatchEvent(event);return event;}
const stateOf=count=>({profile:{name:'周星河'},person:{occupation:'记者'},month:14,turn:14,history:[{month:13}],relationshipGraph:graphOf(count)});

test('opening, locating, zooming, dragging and closing never change the saved life',async()=>{
  const env=browserHarness(),state=stateOf(20),before=structuredClone(state),promise=openRelationshipMap(state,{...env,portraitFor:()=>({src:null})}),dialog=env.dialog(),svg=dialog.querySelector('svg');
  assert.ok(dialog.open);assert.equal(svg.querySelectorAll('[data-person-id]').length,21);assert.equal(dialog.querySelectorAll('.relationship-person-link').length,20);assert.equal(dialog.querySelector('select'),undefined);assert.equal(dialog.querySelector('.relationship-pagination'),undefined);
  const search=dialog.querySelector('input');search.value='019';fire(search,'input');assert.equal(svg.querySelectorAll('[data-person-id]').length,21);assert.equal(dialog.querySelector('.relationship-search-results').children.length,1);fire(search,'keydown',{key:'Enter'});assert.equal(dialog.querySelector('.relationship-detail').querySelector('h3').textContent,'相识人物019');search.value='';fire(search,'input');
  const beforeZoom=svg.getAttribute('viewBox');fire(svg,'wheel',{deltaY:-100,clientX:400,clientY:250});assert.notEqual(svg.getAttribute('viewBox'),beforeZoom);
  const node=svg.querySelectorAll('[data-person-id]')[1],beforePosition=node.getAttribute('transform');fire(svg,'pointerdown',{button:0,pointerId:3,clientX:400,clientY:150},node);fire(svg,'pointermove',{pointerId:3,clientX:520,clientY:230},node);fire(svg,'pointerup',{pointerId:3,clientX:520,clientY:230},node);
  assert.equal(env.captures(),0);const moved=svg.querySelectorAll('[data-person-id]').find(element=>element.getAttribute('data-person-id')===node.getAttribute('data-person-id'));assert.notEqual(moved.getAttribute('transform'),beforePosition);
  fire(dialog.querySelector('.relationship-close'),'click');await promise;assert.deepEqual(state,before);assert.equal(env.listenerCount(),0);assert.ok(env.observers.every(observer=>observer.disconnected));assert.equal(env.document.activeElement,env.previous);assert.equal(dialog.removed,true);
});

test('mobile continuous canvas and keyboard/escape work without portraits or external requests',async()=>{
  const env=browserHarness(370),promise=openRelationshipMap(stateOf(10),{...env,portraitFor:()=>({src:null})}),dialog=env.dialog(),svg=dialog.querySelector('svg');assert.equal(svg.querySelectorAll('[data-person-id]').length,11);assert.equal(svg.querySelectorAll('image').length,0);
  const node=svg.querySelectorAll('[data-person-id]')[1];fire(svg,'keydown',{key:'Enter'},node);assert.equal(dialog.querySelector('.relationship-focus').disabled,false);
  fire(dialog.querySelector('.relationship-focus'),'click');assert.equal(svg.querySelectorAll('[data-person-id]').length,11);assert.equal(dialog.querySelector('.relationship-zoom').textContent,'100%');
  fire(svg,'pointerdown',{button:0,pointerId:2,clientX:100,clientY:100});fire(svg,'pointerdown',{button:0,pointerId:4,clientX:250,clientY:100});fire(svg,'pointermove',{pointerId:4,clientX:300,clientY:140});assert.equal(env.captures(),2);
  fire(dialog,'keydown',{key:'Escape'});await promise;assert.equal(env.captures(),0);assert.equal(env.listenerCount(),0);
});

test('empty maps show only the player and unavailable surfaces resolve safely',async()=>{
  const env=browserHarness(),state=stateOf(0),promise=openRelationshipMap(state,{...env,portraitFor:()=>({src:null})});assert.equal(env.dialog().querySelectorAll('[data-person-id]').length,1);assert.equal(env.dialog().querySelector('.relationship-empty').hidden,false);fire(env.dialog(),'cancel');await promise;assert.equal(env.listenerCount(),0);await openRelationshipMap(state,{document:null,window:null});
});

test('ordinary contacts use different stable pixel portraits alongside the player',async()=>{
  const env=browserHarness(),promise=openRelationshipMap(stateOf(3),env),dialog=env.dialog(),svg=dialog.querySelector('svg'),nodes=svg.querySelectorAll('[data-person-id]');
  assert.equal(nodes[0].getAttribute('data-person-id'),'player');assert.equal(nodes[0].querySelectorAll('image').length,1);
  const sources=nodes.map(node=>{assert.equal(node.querySelectorAll('image').length,1);assert.equal(node.querySelectorAll('.relationship-initial').length,0);const image=node.querySelector('image');assert.match(image.getAttribute('href'),/^data:image\/svg\+xml/);assert.equal(image.getAttribute('style'),'image-rendering:pixelated;');return image.getAttribute('href');});assert.equal(new Set(sources).size,nodes.length);
  fire(dialog,'cancel');await promise;assert.equal(env.listenerCount(),0);
});

test('mobile detail resizing preserves the camera after jumping to a person',async()=>{
  const env=browserHarness(370),promise=openRelationshipMap(stateOf(10),{...env,portraitFor:()=>({src:null})}),dialog=env.dialog(),svg=dialog.querySelector('svg');
  const detail=dialog.querySelector('.relationship-detail'),target=detail.querySelectorAll('[data-jump-id]')[8];
  fire(detail,'click',{},target);const camera=svg.getAttribute('viewBox');
  env.observers[0].callback();for(const callback of env.frames.values())callback();env.frames.clear();
  assert.equal(svg.getAttribute('viewBox'),camera);assert.equal(svg.querySelectorAll('[data-person-id]').length,11);
  fire(dialog,'cancel');await promise;
});

test('overview fits every person and selecting one restores readable text without hiding other contacts',async()=>{
  for(const width of [320,370,780,1100]){
    const env=browserHarness(width),state=stateOf(20);
    const promise=openRelationshipMap(state,{...env,portraitFor:()=>({src:null})}),dialog=env.dialog(),svg=dialog.querySelector('svg');
    assert.equal(svg.querySelectorAll('[data-person-id]').length,21);
    fire(dialog.querySelector('.relationship-map-tools').children[4],'click');
    const [vx,vy,vw,vh]=svg.getAttribute('viewBox').split(' ').map(Number);
    for(const node of svg.querySelectorAll('.relationship-node')){
      const [x,y]=node.getAttribute('transform').match(/-?[\d.]+/g).map(Number);
      assert.ok(x-47>=vx&&x+47<=vx+vw&&y-47>=vy&&y+80<=vy+vh,`${width}: overview contains each full portrait`);
    }
    const search=dialog.querySelector('input');search.value='019';fire(search,'input');fire(search,'keydown',{key:'Enter'});
    const scale=width/Number(svg.getAttribute('viewBox').split(' ')[2]);assert.ok(scale>=1);assert.equal(svg.getAttribute('data-overview'),'false');assert.equal(svg.querySelectorAll('[data-person-id]').length,21);
    for(const label of svg.querySelectorAll('text').filter(e=>(e.getAttribute('style')||'').includes('font-size:'))){const font=Number(label.getAttribute('style').match(/font-size:([\d.]+)/)[1]);assert.ok(font*scale>=12);}
    fire(dialog,'cancel');await promise;
  }
});

test('large saved networks remain complete with bounded routing and no overlapping person plates',()=>{
  const graph=graphOf(511);for(let i=1;i<graph.nodes.length-1;i++)graph.edges.push({id:`peer-${i}`,source:graph.nodes[i].id,target:graph.nodes[i+1].id,status:'伙伴',kind:'ally',strength:70});
  const layout=buildRelationshipLayout(graph,{textScale:1});assert.equal(layout.nodes.length,512);assert.equal(layout.edges.length,1021);assert.equal(layout.nodes[0].x,0);assert.equal(layout.nodes[0].y,0);
  const boxes=layout.nodes.map(n=>({x:n.x,y:n.y+11,w:Math.max(n.id==='player'?112:94,n.captionWidth),h:n.id==='player'?134:116}));
  for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)assert.equal(overlap(boxes[a],boxes[b]),false,`${a}/${b}`);
});

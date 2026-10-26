/** Read-only atlas navigation. Exploration never changes a person's location. */
export const ATLAS_SCOPES = Object.freeze([
  {id:'world',label:'世界图'}, {id:'continent',label:'所处大洲'},
  {id:'subregion',label:'所处大区'}, {id:'faction',label:'所处势力'},
  {id:'province',label:'所处省份'}, {id:'city',label:'所处市'}, {id:'county',label:'所处县'},
]);

const WORLD_BOUNDS = [-180,-80,180,82];
const ROLE_ORDER = {country:0,province:1,city:2,county:3};
// Navigation frames are geographic views, not a sovereign country's overseas extent.
const CONTINENT_VIEWS={Asia:[25,-12,200,80],Europe:[-26,33,65,74],Africa:[-20,-36,55,38],'North America':[-170,5,-45,84],'South America':[-83,-57,-32,14],Oceania:[110,-55,240,28],Antarctica:[-180,-80,180,-55]};
const SUBREGION_VIEWS={'Northern Asia':[45,40,200,80],'Eastern Asia':[70,15,152,57],'Eastern Europe':[12,40,65,74],'Western Europe':[-10,41,17,57],'Northern Europe':[-26,50,33,75],'Southern Europe':[-12,33,38,49],'Northern America':[-170,5,-45,84],Polynesia:[170,-55,260,32],Micronesia:[130,-8,185,30],Melanesia:[130,-30,185,3]};
export const validAtlasBounds = value => Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) && value[0] <= value[2] && value[1] <= value[3];
export const atlasBoundsIntersect = (a,b) => validAtlasBounds(a) && validAtlasBounds(b) && a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
export const atlasLongitudeNear = (longitude,reference) => longitude+360*Math.round((reference-longitude)/360);
const wrappedIntersects=(bounds,viewport)=>[-360,0,360].some(shift=>atlasBoundsIntersect(bounds,[viewport[0]+shift,viewport[1],viewport[2]+shift,viewport[3]]));
export function unionAtlasBounds(rows) {
  let result=null;
  for(const row of rows){
    const b=row?.bounds||row;if(!validAtlasBounds(b))continue;
    result=result?[Math.min(result[0],b[0]),Math.min(result[1],b[1]),Math.max(result[2],b[2]),Math.max(result[3],b[3])]:[...b];
  }
  return result;
}
export function atlasAncestors(unit, units) {
  const index = units instanceof Map ? units : new Map(units.map(row=>[row.id,row]));
  const ancestors=[],seen=new Set();
  for(let current=typeof unit==='string'?index.get(unit):unit;current&&!seen.has(current.id);current=index.get(current.parentId)){
    seen.add(current.id);ancestors.push(current);
  }
  return ancestors;
}

/** The seven destinations always use position; a selected search result is not an input. */
export function createAtlasNavigation({position,units,manifest={},situation,includeFaction=false}={}) {
  const list=units instanceof Map?[...units.values()]:units||[],index=units instanceof Map?units:new Map(list.map(row=>[row.id,row]));
  const located=position?.unitId&&index.get(position.unitId),chain=located?atlasAncestors(located,index):[];
  const country=chain.find(row=>row.role==='country')||index.get(`country:${located?.country}`);
  const metadata=key=>manifest[key==='continent'?'continents':'subregions']?.[located?.[key]||country?.[key]];
  const descriptors=ATLAS_SCOPES.map(scope=>({ ...scope, available:false, bounds:null, unitId:null, reason:'目前没有明确的陆地所在地。' }));
  const assign=(id,value)=>Object.assign(descriptors.find(row=>row.id===id),value);
  assign('world',{available:true,bounds:WORLD_BOUNDS,title:'世界',reason:''});
  if(!located)return descriptors;
  for(const key of ['continent','subregion']){
    const value=metadata(key),stableKey=located[key]||country?.[key];
    const bounds=(key==='continent'?CONTINENT_VIEWS:SUBREGION_VIEWS)[stableKey]||value?.bounds||unionAtlasBounds(list.filter(row=>row.role==='country'&&row[key]===stableKey));
    if(stableKey&&validAtlasBounds(bounds))assign(key,{available:true,bounds,title:value?.name||stableKey,reason:'',countries:value?.countries});
    else assign(key,{reason:'这处所在地尚无对应的大洲或大区资料。'});
  }
  for(const role of ['province','city','county']){
    const unit=chain.find(row=>row.role===role);
    if(unit)assign(role,{available:true,bounds:unit.bounds,unitId:unit.id,title:unit.name,reason:''});
    else{
      const coverage=manifest.coverage?.find(row=>row.country===located.country);
      const hasRole=list.some(row=>row.country===located.country&&row.role===role);
      const moreSpecific=(ROLE_ORDER[position?.precision]??0)<ROLE_ORDER[role];
      const reason=hasRole&&moreSpecific?'所在地只确定到较宽范围，尚不能确定这一层。':hasRole?'当前地区没有相应的行政上级记录。':'当地行政体系或现有边界资料没有对应层级。';
      assign(role,{reason:reason+(coverage?.missingLevels?.length&&coverage.note?' '+coverage.note:'')});
    }
  }
  const current=situation?.(located);
  if(current?.controllerId&&!current.uncertain){
    assign('faction',{available:true,title:current.controller,controllerId:current.controllerId,unitId:located.id,reason:''});
    if(includeFaction){
      // Parents may retain their country baseline while individual districts change sides.
      // Use the finest represented units so a captured district does not claim its whole country.
      const parentIds=new Set(list.map(row=>row.parentId).filter(Boolean));
      const controlled=list.filter(row=>!parentIds.has(row.id)).filter(row=>{const value=situation(row);return value&&!value.uncertain&&value.controllerId===current.controllerId;});
      assign('faction',{bounds:unionAtlasBounds(controlled)||located.bounds,count:controlled.length});
    }
  }else assign('faction',{reason:'当地归属仍在争夺，暂时不能确定完整管治范围。'});
  return descriptors;
}

/** At most six visible countries are decoded per overview. An explicit destination
 * may request one additional layer; zooming back out does not retain fine layers. */
export function selectAtlasLayers({manifest={},viewport,scale=1,focusedUnit=null,maxCountries=6,controlCountries=new Set()}={}) {
  const layers=manifest.layers||[],out=new Set(layers.some(row=>row.id==='world')?['world']:[]);
  const candidates=new Map();
  for(const layer of layers){
    if(layer.id==='world'||!layer.country||!wrappedIntersects(layer.bounds,viewport))continue;
    const rows=candidates.get(layer.country)||[];rows.push(layer);candidates.set(layer.country,rows);
  }
  const cx=(viewport[0]+viewport[2])/2,cy=(viewport[1]+viewport[3])/2;
  const sorted=[...candidates.entries()].sort((a,b)=>{
    const distance=rows=>{const bound=rows[0].bounds;return Math.hypot(atlasLongitudeNear((bound[0]+bound[2])/2,cx)-cx,(bound[1]+bound[3])/2-cy);};
    return distance(a[1])-distance(b[1]);
  });
  for(const [country,rows] of sorted.slice(0,maxCountries)){
    const sortedRows=rows.sort((a,b)=>(ROLE_ORDER[a.role]??0)-(ROLE_ORDER[b.role]??0)||Number(a.level?.match(/\d+/)?.[0]||0)-Number(b.level?.match(/\d+/)?.[0]||0));
    let chosen=null;
    for(const layer of sortedRows){
      const rank=ROLE_ORDER[layer.role]??1,minimumScale=rank<=1?8:rank===2?24:42;
      if(scale<minimumScale)continue;
      const b=layer.bounds,area=Math.max(0,b[2]-b[0])*Math.max(0,b[3]-b[1])*scale*scale;
      if(area/Math.max(1,layer.count)>=18)chosen=layer;
    }
    // A provincial overview must still reveal the county control mosaic. Keep
    // worldwide views bounded and skip countries occupying only a few pixels.
    if(controlCountries.has(country)&&scale>=4){
      const finest=sortedRows.at(-1),b=finest.bounds;
      const width=(b[2]-b[0])*scale,height=(b[3]-b[1])*scale;
      if(width>=70&&height>=55)chosen=finest;
    }
    if(chosen)out.add(chosen.id);
  }
  if(focusedUnit?.layer&&layers.some(row=>row.id===focusedUnit.layer))out.add(focusedUnit.layer);
  return [...out];
}

import {birthplaceAuthorities,birthplaceOptions,birthplaceSelectionForUnit,birthplaceUnitForPlace,macroPlaceForUnit,defaultNationality,LOCATION_LEVELS} from './birthplace.js';
import {getCountryContext,countryByTag} from './countries.js';
import {factionFlagMarkup} from './faction-display.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function birthplaceFields(){return `<fieldset class="birthplace-fields"><legend>开局所在地</legend><div class="birthplace-grid"><label>国家 / 实际管治势力<select name="authorityId" required></select></label>${LOCATION_LEVELS.map(level=>`<label>${level.label}<select name="${level.key}"></select></label>`).join('')}</div><input type="hidden" name="place"/><input type="hidden" name="birthplaceId"/><p class="birthplace-caption" role="status"></p><p class="birthplace-control"></p></fieldset>`;}
export function bindBirthplaceFields(form,{onChange=()=>{},initialPlace='上海'}={}){
  const root=form.querySelector('.birthplace-fields'),field=name=>form.elements.namedItem(name);
  let selection=birthplaceSelectionForUnit(birthplaceUnitForPlace(initialPlace)),locked=false;
  field('authorityId').innerHTML='<option value="">请选择国家或势力</option>'+birthplaceAuthorities().map(row=>`<option value="${esc(row.id)}">${esc(row.name)}${row.id.startsWith('faction:')?' · 控制区':''}</option>`).join('');
  function render(){
    const view=birthplaceOptions(selection);field('authorityId').value=selection.authorityId||'';field('authorityId').disabled=locked;
    for(const level of view.levels){const select=field(level.key);select.innerHTML=level.options.length?`<option value="">请选择${esc(level.label.split(' / ')[0])}</option>`+level.options.map(row=>`<option value="${esc(row.id)}">${esc(row.name)}</option>`).join(''):'<option value="">无对应层级</option>';select.value=level.disabled?'':level.selected;select.disabled=locked||level.disabled;select.required=!locked&&!level.disabled;}
    const selected=[selection.countyId,selection.cityId,selection.provinceId,view.authority?.unitId].map(birthplaceUnitForPlace).find(Boolean);
    field('place').value=selected?macroPlaceForUnit(selected):view.authority?.name||'';
    field('birthplaceId').value=view.complete?view.unit.id:'';
    root.querySelector('.birthplace-caption').textContent=view.complete?`所在地：${view.unit.name}${view.partial?' · 该区划内有多方控制，选择的是这一势力的控制部分':''}`:'依次选择当地已有的行政层级；没有对应层级时会直接跳过。';
    const context=view.authority?.tag?countryByTag(view.authority.tag):getCountryContext({},view.authority?.country);
    root.querySelector('.birthplace-control').innerHTML=factionFlagMarkup(context)+esc(view.authority?.conflict?`${view.authority.name}控制区 · ${view.authority.conflict}`:view.authority?'按照开局已知的实际管治范围选择。':'');
    const nationality=field('nationality');if(nationality)nationality.placeholder=`留空默认：${defaultNationality(view.unit||selected,field('place').value,selection.authorityId)||view.authority?.name||'所在地国家'}`;
    onChange(field('place').value,view);return view;
  }
  for(const [index,key]of ['authorityId',...LOCATION_LEVELS.map(row=>row.key)].entries())field(key).addEventListener('change',()=>{selection[key]=field(key).value;for(const later of ['authorityId',...LOCATION_LEVELS.map(row=>row.key)].slice(index+1))delete selection[later];render();});
  render();
  return {read(){const view=birthplaceOptions(selection);if(!view.complete&&!locked)throw new Error('请完成开局所在地的区划选择。');return {birthplaceId:view.unit?.id||'',place:field('place').value,openingAuthorityId:selection.authorityId};},snapshot:()=>({...selection}),restore(value){locked=false;selection={...value};render();},lock(place){locked=true;selection=birthplaceSelectionForUnit(birthplaceUnitForPlace(place));render();root.querySelector('.birthplace-caption').textContent=`已载入既有档案所在地：${place}`;},refresh:render};
}

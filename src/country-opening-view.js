const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MINISTRY={head_minister:'政府首脑',foreign_minister:'外交',economic_minister:'经济',interior_minister:'内政',intelligence_minister:'情报',defense_minister:'国防'};
export function countryOpeningMarkup(country){
  if(!country?.tag)return '<p class="atlas-country-unknown">这一地区暂无对应的模组开局国家档案。</p>';
  const rows=[['开局领导',country.leader],['国家元首',country.headOfState],['政府首脑',country.headOfGovernment],['开局制度',country.government],['政治取向',country.ideology],['执政力量',country.rulingParty],['经济制度',country.economy],['首都所在地区',country.capital?.name],['所属联盟',typeof country.alliance==='string'?country.alliance:country.alliance?.name],['宗主方',typeof country.subjectOf==='string'?country.subjectOf:country.subjectOf?.name]];
  const list=(title,items)=>items.length?`<details><summary>${esc(title)} · ${items.length}</summary><ul>${items.map(row=>`<li><b>${esc(row.name)}</b>${row.description?`：${esc(row.description)}`:''}</li>`).join('')}</ul></details>`:'';
  const laws=(country.laws||[]).filter(row=>row.name&&!['hidden_ideas','unknown'].includes(row.group));
  const ministers=(country.ministers||[]).filter(row=>row.name).map(row=>({...row,name:(MINISTRY[row.group]?MINISTRY[row.group]+'：':'')+row.name}));
  const spirits=(country.nationalSpirits||[]).filter(row=>row.name);
  const modifiers=(country.dynamicModifiers||[]).filter(row=>row.name);
  return `<details class="atlas-country-opening"><summary>${esc(country.name)} · 2020年开局资料</summary><dl>${rows.filter(([,value])=>typeof value==='string'&&value).map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${country.summary?`<p>${esc(country.summary)}</p>`:''}${list('政党',(country.parties||[]).filter(row=>row.name).map(row=>({...row,name:row.name+(Number.isFinite(row.popularity)?` ${row.popularity}%`:''),description:null})))}${list('内阁成员',ministers)}${list('社会与经济政策',laws)}${list('国家状况',spirits)}${list('长期影响',modifiers)}</details>`;
}

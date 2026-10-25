export const SEX_OPTIONS=Object.freeze([
  {id:'unspecified',label:'暂不填写'},
  {id:'male',label:'生理男性'},
  {id:'female',label:'生理女性'},
  {id:'intersex',label:'双性人'},
  {id:'custom',label:'自行填写'}
]);
export const NATIONALITY_OPTIONS=Object.freeze(['中国（中华人民共和国）','中国台湾（中华民国籍）','日本','韩国','朝鲜','美国','俄罗斯','英国','法国','德国','新加坡','无国籍','多重国籍']);
const limits={sexLabel:80,sexDescription:1000,ethnicity:100,ethnicityDescription:1000,nationality:100,nationalityDescription:1000};
const clean=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,max):'';

/** Self-described identity is independent of birthplace, citizenship rules and appearance. */
export function normalizeCharacterIdentity(raw={},{strict=false}={}){
  if(raw===null||typeof raw!=='object'||Array.isArray(raw)){if(strict)throw new Error('身份资料格式不完整。');raw={};}
  if(strict){
    for(const [key,max] of Object.entries(limits))if(raw[key]!==undefined&&(typeof raw[key]!=='string'||raw[key].length>max))throw new Error('身份资料的文字过长或格式不完整。');
    if(raw.sex!==undefined&&!SEX_OPTIONS.some(option=>option.id===raw.sex))throw new Error('性别资料格式不完整。');
  }
  const sex=SEX_OPTIONS.some(option=>option.id===raw.sex)?raw.sex:'unspecified';
  return {sex,sexLabel:sex==='custom'?clean(raw.sexLabel,80):sex==='unspecified'?'':SEX_OPTIONS.find(option=>option.id===sex).label,
    ...Object.fromEntries(Object.entries(limits).filter(([key])=>key!=='sexLabel').map(([key,max])=>[key,clean(raw[key],max)]))};
}
export function characterIdentityFromForm(fields){
  const identity=normalizeCharacterIdentity(Object.fromEntries(['sex',...Object.keys(limits)].map(key=>[key,fields[key]??''])));
  if(identity.sex==='custom'&&!identity.sexLabel)throw new Error('请填写自己的性别，或选择暂不填写。');
  return identity;
}
export function identityRows(identity){
  const value=normalizeCharacterIdentity(identity);
  return [
    {label:'性别',value:value.sexLabel,description:value.sexDescription},
    {label:'族裔',value:value.ethnicity,description:value.ethnicityDescription},
    {label:'国籍 / 所属势力',value:value.nationality,description:value.nationalityDescription}
  ].filter(row=>row.value||row.description);
}

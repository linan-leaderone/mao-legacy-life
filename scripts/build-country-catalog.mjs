// Authoring-only, read-only MOD ingestion. This is a bounded opening-state extractor,
// not a HOI4 interpreter: unknown conditions and scheduled events are never executed.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(process.argv.find(a=>a.startsWith('--mod='))?.slice(6)||path.join(project,'../TFR-xinzuo-rebuild'));
const fileOrder=(a,b)=>a.name.toLowerCase()<b.name.toLowerCase()?-1:a.name.toLowerCase()>b.name.toLowerCase()?1:0;
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).sort(fileOrder).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]):[];
const rel=p=>path.relative(root,p).split(path.sep).join('/');
const sourceFiles=new Map(),warnings=[],audit={unresolvedConditions:new Map(),unhandledEffects:new Map(),nonPoliticalEffects:{},scriptCalls:0,immediateEvents:0,loadOrder:[]};
const outputPath=path.resolve(process.argv.find(a=>a.startsWith('--output='))?.slice(9)||path.join(project,'src/data/countries.json'));
const note=(bucket,n,reason)=>{const key=`${n.file}:${n.line}:${n.key}:${reason}`,old=bucket.get(key);if(old)old.occurrences++;else bucket.set(key,{...reference(n),reason,occurrences:1});};
function read(p){const text=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'');sourceFiles.set(rel(p),{path:rel(p),sha256:createHash('sha256').update(text).digest('hex')});return text;}
function parse(text,file){
  const re=/\s+|#[^\n]*|"(?:\\.|[^"\\])*"|>=|<=|!=|[{}=<>]|[^\s{}=<>!#]+/gy,tokens=[];let m,line=1;
  while((m=re.exec(text))){const t=m[0],start=line;line+=(t.match(/\n/g)||[]).length;if(/^\s|^#/.test(t))continue;tokens.push({t:t[0]==='"'?t.slice(1,-1).replace(/\\"/g,'"'):t,line:start});}
  let i=0;function body(nested=false){const out=[];while(i<tokens.length){const a=tokens[i++];if(a.t==='}')return out;if(a.t==='{'){out.push({key:null,value:body(true),line:a.line,file});continue;}if(['=','>','<','>=','<=','!='].includes(tokens[i]?.t)){const op=tokens[i++].t;const v=tokens[i++];if(!v)break;out.push({key:a.t,op,value:v.t==='{'?body(true):v.t,line:a.line,file});}else out.push({key:null,value:a.t,line:a.line,file});}if(nested)warnings.push({file,line,kind:'unclosed-block'});return out;}return body();
}
const parsed=p=>parse(read(p),rel(p));
const scalar=(nodes,key)=>nodes?.find(n=>n.key===key&&!Array.isArray(n.value))?.value;
const block=(nodes,key)=>nodes?.find(n=>n.key===key&&Array.isArray(n.value))?.value||[];
const blocks=(nodes,key)=>nodes?.filter(n=>n.key===key&&Array.isArray(n.value))||[];
const reference=(n,key=n?.key)=>n?{file:n.file,line:n.line,key}:null;
const unique=xs=>[...new Set(xs.filter(Boolean))];
const clean=value=>String(value||'').replace(/\\n/g,'\n').replace(/§./g,'').replace(/£[\w.]+(?:\|\d+)?/g,'').replace(/\[!?[^\]]+\]/g,'').replace(/\$[^$]+\$/g,'').replace(/[ \t]+/g,' ').trim();

const loc=new Map();
for(const p of walk(path.join(root,'localisation')).filter(p=>p.endsWith('.yml'))){const file=rel(p),text=read(p);let language='';for(const [i,line]of text.split('\n').entries()){const lang=line.match(/^\s*l_([\w]+)\s*:/);if(lang){language=lang[1];continue;}if(language!=='simp_chinese'&&language!=='english')continue;const m=line.match(/^\s*([^#\s:]+):\s*(?:\d+\s*)?"(.*)"\s*(?:#.*)?$/);if(!m)continue;const score=(language==='simp_chinese'?10:0)+(file.includes('/replace/')?2:0);if(!loc.has(m[1])||loc.get(m[1]).score<=score)loc.set(m[1],{text:m[2],file,line:i+1,score});}}
function label(key,fallback=null,depth=0){if(!key)return fallback;const l=loc.get(key);if(!l)return fallback;let text=l.text;if(depth<5)text=text.replace(/\$([\w.]+)\$/g,(_,k)=>label(k,'',depth+1));return clean(text)||fallback;}
const locRef=key=>loc.has(key)?{file:loc.get(key).file,line:loc.get(key).line,key}:null;

// ISO 3166 identity is deliberately separate from HOI4 TAG identity (AST != AUS).
const isoPairs=`AD:AND AE:ARE AF:AFG AG:ATG AI:AIA AL:ALB AM:ARM AO:AGO AQ:ATA AR:ARG AS:ASM AT:AUT AU:AUS AW:ABW AX:ALA AZ:AZE BA:BIH BB:BRB BD:BGD BE:BEL BF:BFA BG:BGR BH:BHR BI:BDI BJ:BEN BL:BLM BM:BMU BN:BRN BO:BOL BQ:BES BR:BRA BS:BHS BT:BTN BV:BVT BW:BWA BY:BLR BZ:BLZ CA:CAN CC:CCK CD:COD CF:CAF CG:COG CH:CHE CI:CIV CK:COK CL:CHL CM:CMR CN:CHN CO:COL CR:CRI CU:CUB CV:CPV CW:CUW CX:CXR CY:CYP CZ:CZE DE:DEU DJ:DJI DK:DNK DM:DMA DO:DOM DZ:DZA EC:ECU EE:EST EG:EGY EH:ESH ER:ERI ES:ESP ET:ETH FI:FIN FJ:FJI FK:FLK FM:FSM FO:FRO FR:FRA GA:GAB GB:GBR GD:GRD GE:GEO GF:GUF GG:GGY GH:GHA GI:GIB GL:GRL GM:GMB GN:GIN GP:GLP GQ:GNQ GR:GRC GS:SGS GT:GTM GU:GUM GW:GNB GY:GUY HK:HKG HM:HMD HN:HND HR:HRV HT:HTI HU:HUN ID:IDN IE:IRL IL:ISR IM:IMN IN:IND IO:IOT IQ:IRQ IR:IRN IS:ISL IT:ITA JE:JEY JM:JAM JO:JOR JP:JPN KE:KEN KG:KGZ KH:KHM KI:KIR KM:COM KN:KNA KP:PRK KR:KOR KW:KWT KY:CYM KZ:KAZ LA:LAO LB:LBN LC:LCA LI:LIE LK:LKA LR:LBR LS:LSO LT:LTU LU:LUX LV:LVA LY:LBY MA:MAR MC:MCO MD:MDA ME:MNE MF:MAF MG:MDG MH:MHL MK:MKD ML:MLI MM:MMR MN:MNG MO:MAC MP:MNP MQ:MTQ MR:MRT MS:MSR MT:MLT MU:MUS MV:MDV MW:MWI MX:MEX MY:MYS MZ:MOZ NA:NAM NC:NCL NE:NER NF:NFK NG:NGA NI:NIC NL:NLD NO:NOR NP:NPL NR:NRU NU:NIU NZ:NZL OM:OMN PA:PAN PE:PER PF:PYF PG:PNG PH:PHL PK:PAK PL:POL PM:SPM PN:PCN PR:PRI PS:PSE PT:PRT PW:PLW PY:PRY QA:QAT RE:REU RO:ROU RS:SRB RU:RUS RW:RWA SA:SAU SB:SLB SC:SYC SD:SDN SE:SWE SG:SGP SH:SHN SI:SVN SJ:SJM SK:SVK SL:SLE SM:SMR SN:SEN SO:SOM SR:SUR SS:SSD ST:STP SV:SLV SX:SXM SY:SYR SZ:SWZ TC:TCA TD:TCD TF:ATF TG:TGO TH:THA TJ:TJK TK:TKL TL:TLS TM:TKM TN:TUN TO:TON TR:TUR TT:TTO TV:TUV TW:TWN TZ:TZA UA:UKR UG:UGA UM:UMI US:USA UY:URY UZ:UZB VA:VAT VC:VCT VE:VEN VG:VGB VI:VIR VN:VNM VU:VUT WF:WLF WS:WSM YE:YEM YT:MYT ZA:ZAF ZM:ZMB ZW:ZWE`.split(' ').map(x=>x.split(':'));
const namesZh=new Intl.DisplayNames(['zh-Hans'],{type:'region'}),namesEn=new Intl.DisplayNames(['en'],{type:'region'});
const isoMeta=new Map(isoPairs.map(([code,iso])=>[iso,{iso,code,name:namesZh.of(code),englishName:namesEn.of(code),aliases:[namesZh.of(code),namesEn.of(code),code,iso]}]));
for(const [iso,name,en]of [['XKX','科索沃','Kosovo'],['CYN','北塞浦路斯','Northern Cyprus'],['SOL','索马里兰','Somaliland']])isoMeta.set(iso,{iso,code:null,name,englishName:en,aliases:[name,en,iso]});
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s.,'’()\-]/g,'');
const isoNames=new Map([...isoMeta.values()].flatMap(c=>c.aliases.map(a=>[norm(a),c.iso])));
const exceptions={ALG:'DZA',ANG:'AGO',AST:'AUS',AUS:'AUT',AZR:'AZE',DAH:'BEN',BHU:'BTN',VOL:'BFA',BAN:'BGD',BRU:'BRN',BOS:'BIH',BOT:'BWA',BRD:'BDI',BUL:'BGR',CAB:'CPV',CAR:'CAF',CAY:'GUF',RCG:'COG',CRC:'CUW',CRO:'HRV',CHA:'TCD',CHI:'TWN',CAM:'KHM',DEN:'DNK',COG:'COD',ENG:'GBR',ETI:'TLS',EQG:'GNQ',ELS:'SLV',FIJ:'FJI',GER:'DEU',GUA:'GTM',GAM:'GMB',GDL:'GLP',GNA:'GIN',GYA:'GUY',GND:'GRD',GRE:'GRC',HON:'HND',HAI:'HTI',HOL:'NLD',IRE:'IRL',IVO:'CIV',ICE:'ISL',INS:'IDN',JAP:'JPN',KUW:'KWT',KYR:'KGZ',KOS:'XKX',LAT:'LVA',LIB:'LBR',LIT:'LTU',LES:'LSO',LEB:'LBN',LBA:'LBY',MAC:'MKD',MAD:'MDG',MAU:'MUS',MOL:'MDA',MLW:'MWI',MAL:'MYS',BRM:'MMR',MOR:'MAR',MLD:'MDV',MNT:'MNE',MON:'MNG',MZB:'MOZ',NEP:'NPL',NAU:'NRU',NCY:'CYN',NMB:'NAM',NGR:'NER',OMA:'OMN',PER:'IRN',POR:'PRT',PLU:'PLW',PAL:'PSE',PHI:'PHL',PRC:'CHN',PRU:'PER',PAR:'PRY',PUE:'PRI',RAJ:'IND',ROM:'ROU',SER:'SRB',SWI:'CHE',SAF:'ZAF',SLV:'SVN',SML:'SOL',STL:'LCA',STV:'VCT',SUD:'SDN',SLO:'SVK',SIG:'SGP',SOL:'SLB',SIA:'THA',SAO:'STP',SEY:'SYC',SRL:'LKA',SIE:'SLE',SPR:'ESP',SOV:'RUS',SAM:'WSM',TAJ:'TJK',TZN:'TZA',TOG:'TGO',TMS:'TKM',URG:'URY',UAE:'ARE',VAN:'VUT',VIN:'VNM',WES:'ESH',ZAM:'ZMB',ZIM:'ZWE',PLD:'POL',TRI:'TTO',TAH:'PYF'};
Object.assign(exceptions,{CZE:'CZE',KOR:'KOR',PRK:'PRK',LUX:'LUX',PNG:'PNG',TUR:'TUR',VEN:'VEN',YEM:'YEM'});
// These authorities are catalogued as participants in their geographical country,
// never chosen automatically as the sovereign opening government.
const secondaryIso={KUR:'IRQ',NGK:'AZE',NOV:'UKR',TRA:'MDA',KKP:'GEO',YAM:'GEO',KLA:'MMR',CNF:'MMR',SSA:'MMR',MND:'MMR',MOA:'MMR',KNU:'MMR',WAT:'MMR',HRL:'LBY',SHB:'SOM',TAL:'AFG',AAS:'YEM',HEZ:'LBN',HOU:'YEM',HTS:'SYR',ROJ:'SYR',CPC:'CAF',BRS:'BEL',DPR:'UKR',USB:'USA',TSU:'JPN',TZL:'TWN',KMT:'TWN',TJJ:'TWN',JPR:'JPN'};
const tagDefs=new Map();
for(const p of walk(path.join(root,'common/country_tags')).filter(p=>p.endsWith('.txt')))for(const n of parsed(p))if(/^[A-Z0-9]{3}$/.test(n.key||'')&&typeof n.value==='string')tagDefs.set(n.key,{path:n.value,source:reference(n)});
const history=new Map(),historyEntries=[];for(const p of walk(path.join(root,'history/countries')).filter(p=>p.endsWith('.txt'))){const tag=path.basename(p).slice(0,3);if(tagDefs.has(tag)){const entry={tag,ast:parsed(p),file:rel(p)};historyEntries.push(entry);history.set(tag,entry);}}
const subIdeologies=new Map();for(const p of walk(path.join(root,'common/ideologies')).filter(p=>p.endsWith('.txt')))for(const n of block(parsed(p),'ideologies'))for(const t of block(n.value,'types'))subIdeologies.set(t.key,n.key);
const characters=new Map();for(const p of walk(path.join(root,'common/characters')).filter(p=>p.endsWith('.txt')))for(const n of block(parsed(p),'characters'))characters.set(n.key,{...n,name:label(scalar(n.value,'name')||n.key),roles:blocks(n.value,'country_leader').map(r=>({ideology:scalar(r.value,'ideology'),group:subIdeologies.get(scalar(r.value,'ideology')),source:reference(r)}))});
const ideas=new Map();for(const p of walk(path.join(root,'common/ideas')).filter(p=>p.endsWith('.txt')))for(const group of block(parsed(p),'ideas'))if(Array.isArray(group.value))for(const n of group.value)if(n.key&&Array.isArray(n.value))ideas.set(n.key,{group:group.key,...n});
const states=new Map(),owned=new Map(),provinceStates=new Map();
for(const p of walk(path.join(root,'history/states')).filter(p=>p.endsWith('.txt'))){const s=block(parsed(p),'state'),id=Number(scalar(s,'id'));if(!id)continue;const h=block(s,'history'),owner=scalar(h,'owner'),nameKey=scalar(s,'name'),provinceIds=block(s,'provinces').map(x=>Number(x.value)).filter(Number.isFinite);const row={id,owner,controller:scalar(h,'controller')||owner,name:label(nameKey,nameKey||String(id)),nameEnglish:path.basename(p,'.txt').replace(/^\d+[\s_-]*/,''),provinceIds,provinceControllers:{},source:reference(s.find(n=>n.key==='id')),sourceRefs:[reference(s.find(n=>n.key==='id'))],_history:h};states.set(id,row);for(const province of provinceIds)provinceStates.set(province,row);if(owner)owned.set(owner,[...(owned.get(owner)||[]),id]);}
const scriptedEffects=new Map(),scriptedTriggers=new Map(),gameRules=new Map(),eventDefinitions=new Map();
for(const [folder,target]of [['common/scripted_effects',scriptedEffects],['common/scripted_triggers',scriptedTriggers]])for(const p of walk(path.join(root,folder)).filter(p=>p.endsWith('.txt')))for(const n of parsed(p))if(n.key&&Array.isArray(n.value))target.set(n.key,n);
for(const p of walk(path.join(root,'common/game_rules')).filter(p=>p.endsWith('.txt')))for(const n of parsed(p)){const option=blocks(n.value,'default')[0]||blocks(n.value,'option').find(x=>scalar(x.value,'default')==='yes');if(option)gameRules.set(n.key,scalar(option.value,'name'));}
for(const p of walk(path.join(root,'events')).filter(p=>p.endsWith('.txt')))for(const n of parsed(p))if(['country_event','news_event','state_event'].includes(n.key)&&Array.isArray(n.value)){const id=scalar(n.value,'id');if(id)eventDefinitions.set(id,n);}
const governmentIds=new Set((block(scriptedEffects.get('remove_gov_types')?.value,'remove_ideas')||[]).map(x=>x.value));
const economyIds=new Set((block(scriptedEffects.get('remove_economy_types')?.value,'remove_ideas')||[]).map(x=>x.value));

const records=new Map();
for(const [tag,d]of tagDefs){const h=history.get(tag),fileName=path.basename(d.path,'.txt'),iso=secondaryIso[tag]||exceptions[tag]||isoNames.get(norm(fileName))||null;records.set(tag,{tag,iso,primaryGeographicRecord:!secondaryIso[tag],definitionName:fileName,sourceRefs:[d.source,...(h?[{file:h.file,line:1,key:tag}]:[])],_flags:new Set(),_ideas:new Set(),_ideaSources:new Map(),_recruited:[],_roles:[],_parties:{},_politics:{},_popularities:{},_startupRefs:[],_focus:[],_events:[],_variables:{},_changes:[],_active:(owned.get(tag)?.length||0)>0,ownedStateIds:owned.get(tag)||[],controlledStateIds:[]});}
const globalFlags=new Set(),openingWars=[],eventQueue=[],seenEvents=new Set();let sequence=0;
const emptyScope={tag:'__global',_flags:new Set(),_ideas:new Set(),_politics:{},_variables:{}};
const dateNumber=value=>{const [y,m=1,d=1]=String(value).split('.').map(Number);return y*10000+m*100+d;};
const openingDateNumber=20200101;
const compare=(a,op,b)=>op==='>'?a>b:op==='<'?a<b:op==='>='?a>=b:op==='<='?a<=b:op==='!='?a!==b:a===b;
function condition(nodes,rec=emptyScope,depth=0){
 if(depth>20)return null;
 const checks=[];for(const n of nodes||[]){let v=null;const k=String(n.key||'').toLowerCase();
  if(k==='not'){const vals=n.value.map(x=>condition([x],rec,depth+1));v=vals.every(x=>x===false)?true:vals.includes(true)?false:null;}
  else if(k==='or'){const vals=n.value.map(x=>condition([x],rec,depth+1));v=vals.includes(true)?true:vals.every(x=>x===false)?false:null;}
  else if(k==='and')v=condition(n.value,rec,depth+1);
  else if(k==='tag'||k==='original_tag')v=rec.tag===n.value;
  else if(k==='always')v=n.value==='yes';
  else if(k==='has_country_flag')v=rec._flags.has(n.value);
  else if(k==='has_global_flag')v=globalFlags.has(n.value);
  else if(k==='has_idea')v=rec._ideas.has(n.value);
  else if(k==='has_government')v=rec._politics.ruling_party===n.value;
  else if(k==='exists')v=records.has(n.value)?records.get(n.value)._active:false;
  else if(k==='has_dlc')v=true;
  else if(k==='has_game_rule'){const rule=scalar(n.value,'rule'),option=scalar(n.value,'option');v=gameRules.has(rule)?gameRules.get(rule)===option:null;}
  else if(k==='has_completed_focus'||k==='has_capitulated')v=false;
  else if(k==='has_variable')v=Object.hasOwn(rec._variables,n.value);
  else if(k==='has_war')v=openingWars.some(w=>w.attackerTag===rec.tag||w.defenderTag===rec.tag)===(n.value==='yes');
  else if(k==='has_war_with')v=openingWars.some(w=>(w.attackerTag===rec.tag&&w.defenderTag===n.value)||(w.defenderTag===rec.tag&&w.attackerTag===n.value));
  else if(k==='owns_state'||k==='controls_state')v=states.get(Number(n.value))?.[k==='owns_state'?'owner':'controller']===rec.tag;
  else if(k==='date')v=compare(openingDateNumber,n.op,dateNumber(n.value));
  else if(k==='check_variable'&&Array.isArray(n.value)){const item=n.value.find(x=>x.key!=='value'&&x.key!=='var');const name=scalar(n.value,'var')||item?.key,expected=Number(scalar(n.value,'value')??item?.value);v=Object.hasOwn(rec._variables,name)&&Number.isFinite(expected)?compare(Number(rec._variables[name]),item?.op||'=',expected):null;}
  else if(k==='is_subject')v=!!rec.subjectOf===(n.value==='yes');
  else if(records.has(n.key)&&Array.isArray(n.value))v=condition(n.value,records.get(n.key),depth+1);
  else if(scriptedTriggers.has(n.key)&&n.value==='yes')v=condition(scriptedTriggers.get(n.key).value,rec,depth+1);
  else if(scriptedTriggers.has(n.key)&&n.value==='no'){const result=condition(scriptedTriggers.get(n.key).value,rec,depth+1);v=result===null?null:!result;}
  if(v===null)note(audit.unresolvedConditions,n,'unknown-opening-condition');checks.push(v);
 }return checks.includes(false)?false:checks.includes(null)?null:true;
}
function change(rec,field,value,node,phase,via=[]){if(!rec?._changes)return;rec._changes.push({order:++sequence,field,value,phase,...reference(node),...(via.length?{via}: {})});}
function setOwner(state,tag,node,controllerOnly=false){if(!state||!records.has(tag))return;if(!controllerOnly)state.owner=tag;state.controller=tag;state.provinceControllers={};state.sourceRefs.push(reference(node));records.get(tag)._active=true;}
function setProvince(provinceId,tag,node){const state=provinceStates.get(Number(provinceId));if(state&&records.has(tag)){state.provinceControllers[Number(provinceId)]=tag;state.sourceRefs.push(reference(node));records.get(tag)._active=true;}}
function resolveTarget(value,scope,ctx){return value==='ROOT'?ctx.root?.tag:value==='PREV'?ctx.previous?.tag:value==='THIS'?scope?.tag:value;}
// Expand only called deterministic effects. Definitions alone, focus rewards,
// dated future history and scheduled/random events are never opening facts.
function apply(nodes,rec=null,ctx={}){
 const {phase='country-history',depth=0,via=[]}=ctx;if(depth>30){warnings.push({kind:'effect-depth-limit',tag:rec?.tag});return;}
 let prior=null;for(const n of nodes||[]){const k=n.key,v=n.value;if(k==='limit'||k==='name'||k==='ai_chance')continue;const next={...ctx,phase,depth:depth+1};
  if(k==='if'||k==='else_if'||k==='else'){const yes=k==='else'?prior===false:k==='else_if'?(prior===false?condition(block(v,'limit'),rec||emptyScope):false):condition(block(v,'limit'),rec||emptyScope);if(yes===true)apply(v.filter(x=>!['limit','else','else_if'].includes(x.key)),rec,next);if(k==='if')for(const child of v.filter(x=>x.key==='else'||x.key==='else_if'))if(yes===false&&condition(block(child.value,'limit'),rec||emptyScope)===true)apply(child.value,rec,next);prior=prior===true&&k!=='if'?true:yes;continue;}
  prior=null;
  if(/^\d{4}\.\d+\.\d+(?:\.\d+)?$/.test(k||'')){if(dateNumber(k)<=openingDateNumber)apply(v,rec,next);continue;}
  if(['effect','hidden_effect'].includes(k)){apply(v,rec,next);continue;}
  if(records.has(k)&&Array.isArray(v)){apply(v,records.get(k),{...next,previous:rec,root:ctx.root||rec||records.get(k),state:null});continue;}
  if(['ROOT','PREV','THIS'].includes(k)&&Array.isArray(v)){const target=k==='ROOT'?ctx.root:k==='PREV'?ctx.previous:rec;if(target)apply(v,target,{...next,previous:rec});continue;}
  if(/^\d+$/.test(k||'')&&states.has(Number(k))&&Array.isArray(v)){apply(v,rec,{...next,state:states.get(Number(k))});continue;}
  if(['every_country','every_possible_country'].includes(k)){for(const row of records.values())if((k==='every_possible_country'||row._active)&&condition(block(v,'limit'),row)===true)apply(v.filter(x=>x.key!=='limit'),row,{...next,previous:rec,root:ctx.root||rec||row,state:null});continue;}
  if(['every_state','every_owned_state','every_controlled_state'].includes(k)){for(const state of states.values())if(k==='every_state'||state[k==='every_owned_state'?'owner':'controller']===rec?.tag){if(!block(v,'limit').length)apply(v,rec,{...next,state});else note(audit.unhandledEffects,n,'state-limit-not-evaluated');}continue;}
  if(k==='set_global_flag'){globalFlags.add(v);continue;}
  if(k==='clr_global_flag'){globalFlags.delete(v);continue;}
  if(k==='set_province_controller'){const tag=Array.isArray(v)?resolveTarget(scalar(v,'controller')||scalar(v,'tag'),rec,ctx):rec?.tag;setProvince(Array.isArray(v)?scalar(v,'province'):v,tag,n);continue;}
  if(ctx.state&&['owner','controller','set_state_owner','set_state_controller'].includes(k)){setOwner(ctx.state,resolveTarget(v,rec,ctx),n,k==='controller'||k==='set_state_controller');continue;}
  if(scriptedEffects.has(k)){
   const definition=scriptedEffects.get(k);if(v!=='yes'&&!Array.isArray(v)){note(audit.unhandledEffects,n,'unsupported-script-arguments');continue;}
   audit.scriptCalls++;let body=definition.value;
   if(Array.isArray(v)){const args=Object.fromEntries(v.filter(x=>!Array.isArray(x.value)).map(x=>[x.key,x.value]));body=JSON.parse(JSON.stringify(body).replace(/\$([\w]+)\$/g,(match,key)=>args[key]??match));}
   if(rec&&k.startsWith('change_government_type_')){rec._explicitGovernment={id:'ZZZ_'+k.slice(23),source:reference(n)};change(rec,'governmentTypeId',rec._explicitGovernment.id,n,phase,via);}
   if(rec&&k.startsWith('change_economy_type_')){rec.economyId=k.slice(20);change(rec,'economyId',rec.economyId,n,phase,via);}
   apply(body,rec,{...next,via:[...via,reference(n)],root:ctx.root||rec});continue;
  }
  if(!rec){if(Array.isArray(v)&&!['log','custom_effect_tooltip','set_variable','set_temp_variable'].includes(k))note(audit.unhandledEffects,n,'no-country-scope');continue;}
  if(k==='set_country_flag')rec._flags.add(Array.isArray(v)?scalar(v,'flag'):v);
  else if(k==='clr_country_flag')rec._flags.delete(v);
  else if(k==='capital'){const id=Number(Array.isArray(v)?scalar(v,'state'):v);rec.capital=states.get(id)||{id,name:null};}
  else if(k==='set_politics'){for(const x of v)if(!Array.isArray(x.value)){rec._politics[x.key]=x.value;change(rec,x.key,x.value,n,phase,via);}}
  else if(k==='set_popularities'){rec._popularities={};for(const x of v)if(Number.isFinite(Number(x.value)))rec._popularities[x.key]=Number(x.value);change(rec,'popularities',{...rec._popularities},n,phase,via);}
  else if(k==='set_party_name'){const id=scalar(v,'ideology');if(id){rec._parties[id]={id,name:label(scalar(v,'long_name'))||label(scalar(v,'name')),source:reference(n)};change(rec,'party:'+id,rec._parties[id].name,n,phase,via);}}
  else if(['add_ideas','remove_ideas','swap_ideas'].includes(k)){
   const ids=Array.isArray(v)?v.filter(x=>x.key===null).map(x=>x.value):[v];if(k==='swap_ideas'){const remove=scalar(v,'remove_idea'),add=scalar(v,'add_idea');if(remove)rec._ideas.delete(remove);if(add){rec._ideas.delete(add);rec._ideas.add(add);rec._ideaSources.set(add,reference(n));}}else for(const id of ids){if(k==='add_ideas'){rec._ideas.delete(id);rec._ideas.add(id);rec._ideaSources.set(id,reference(n));}else rec._ideas.delete(id);}
  }
  else if(k==='add_timed_idea'){const id=scalar(v,'idea');if(id){rec._ideas.add(id);rec._ideaSources.set(id,reference(n));(rec._timedIdeas??={})[id]=Number(scalar(v,'days')||0);}}
  else if(k==='add_dynamic_modifier'){const id=scalar(v,'modifier');if(id)(rec._dynamicModifiers??=[]).push({id,name:label(id,id),stateId:ctx.state?.id||null,source:reference(n)});}
  else if(k==='recruit_character'){if(!rec._recruited.includes(v))rec._recruited.push(v);}
  else if(k==='retire_character'){rec._recruited=rec._recruited.filter(id=>id!==v);rec._roles=rec._roles.filter(r=>r.id!==v);}
  else if(k==='create_country_leader'){rec._roles.push({name:label(scalar(v,'name'),scalar(v,'name')),ideology:scalar(v,'ideology'),group:subIdeologies.get(scalar(v,'ideology')),source:reference(n),promoted:true,order:++sequence});}
  else if(k==='add_country_leader_role'){const c=scalar(v,'character'),role=block(v,'country_leader');rec._roles.push({id:c,name:characters.get(c)?.name||label(c),ideology:scalar(role,'ideology'),group:subIdeologies.get(scalar(role,'ideology')),source:reference(n),promoted:scalar(v,'promote_leader')==='yes',order:++sequence});}
  else if(k==='promote_character'){rec._promote=typeof v==='string'?v:scalar(v,'character');rec._promoteIdeology=Array.isArray(v)?scalar(v,'ideology'):null;change(rec,'promotedCharacter',rec._promote,n,phase,via);}
  else if(k==='set_country_leader_ideology'){rec._leaderIdeology=typeof v==='string'?v:scalar(v,'ideology');change(rec,'leaderIdeology',rec._leaderIdeology,n,phase,via);}
  else if(k==='set_cosmetic_tag'){rec.cosmeticTag=v;change(rec,'cosmeticTag',v,n,phase,via);}
  else if(k==='load_focus_tree')rec._focus.push({id:typeof v==='string'?v:scalar(v,'tree'),score:100000});
  else if(k==='country_event'||k==='news_event'){
   const event={id:typeof v==='string'?v:scalar(v,'id'),days:Array.isArray(v)?Number(scalar(v,'days')||0):0,hours:Array.isArray(v)?Number(scalar(v,'hours')||0):0,randomDays:Array.isArray(v)?Number(scalar(v,'random_days')||0):0,source:reference(n)};rec._events.push(event);if(event.id&&!event.days&&!event.hours&&!event.randomDays)eventQueue.push({event,tag:rec.tag,root:ctx.root||rec});
  }
  else if(k==='add_popularity'){const id=scalar(v,'ideology'),amount=Number(scalar(v,'popularity'));if(id&&Number.isFinite(amount))rec._popularities[id]=(rec._popularities[id]||0)+amount*100;}
  else if(k==='set_stability'||k==='set_war_support')rec[k==='set_stability'?'stability':'warSupport']=Number(v);
  else if(k==='create_faction')rec.alliance=label(v,v);
  else if(k==='add_to_faction'&&records.has(v))records.get(v)._allianceLeader=rec.tag;
  else if(k==='set_autonomy'&&Array.isArray(v)){const target=records.get(scalar(v,'target'));if(target){target.subjectOf=rec.tag;target.autonomy=scalar(v,'autonomy_state');}}
  else if(k==='transfer_state'){setOwner(states.get(Number(v)),rec.tag,n);change(rec,'transferState',Number(v),n,phase,via);}
  else if(k==='declare_war_on'){const target=resolveTarget(scalar(v,'target'),rec,ctx);if(records.has(target)&&!openingWars.some(w=>w.attackerTag===rec.tag&&w.defenderTag===target))openingWars.push({attackerTag:rec.tag,defenderTag:target,sourceRefs:[reference(n),...via]});}
  else if(['set_variable','set_temp_variable','add_to_variable','subtract_from_variable'].includes(k)&&Array.isArray(v)){for(const item of v)if(item.key&&Number.isFinite(Number(item.value))){const old=Number(rec._variables[item.key]||0);rec._variables[item.key]=k==='add_to_variable'?old+Number(item.value):k==='subtract_from_variable'?old-Number(item.value):Number(item.value);}}
  else if(k==='clear_variable')delete rec._variables[v];
  else if(['multiply_variable','divide_variable','clamp_variable','add_to_temp_variable'].includes(k)&&Array.isArray(v)){const item=v.find(x=>x.key&&!['min','max'].includes(x.key));if(item&&Number.isFinite(Number(item.value))){const old=Number(rec._variables[item.key]||0),value=Number(item.value);rec._variables[item.key]=k==='multiply_variable'?old*value:k==='divide_variable'?(value?old/value:old):k==='add_to_temp_variable'?old+value:Math.max(Number(scalar(v,'min')??-Infinity),Math.min(Number(scalar(v,'max')??Infinity),old));}}
  else if(['victory_points','add_core_of','remove_core_of','add_claim_by','buildings','add_resource','set_demilitarized_zone','set_compliance','set_resistance','set_garrison_strength','start_resistance','add_equipment_to_stockpile','add_to_tech_sharing_group','give_military_access','create_intelligence_agency','add_faction_goal','remove_faction_goal','diplomatic_relation','set_major','give_market_access','starting_train_buffer','activate_mission','country_lock_all_division_template','create_import','force_update_dynamic_modifier','create_entity'].includes(k))audit.nonPoliticalEffects[k]=(audit.nonPoliticalEffects[k]||0)+1;
  else if(k&&!['log','custom_effect_tooltip','custom_trigger_tooltip','effect_tooltip','set_technology','oob','set_oob','load_oob','set_air_oob','set_naval_oob','set_research_slots','add_research_slot','set_convoys','set_manpower','add_manpower','add_state_core','add_state_claim','remove_state_core','remove_state_claim','set_nationality','create_equipment_variant','activate_advisor','add_opinion_modifier','add_dynamic_modifier','remove_dynamic_modifier','add_hidden_idea','set_relation','add_ai_strategy','set_rule','set_faction_name','set_faction_spymaster','set_country_flag','set_country_flag','set_country_name','set_truce','send_embargo','send_volunteers','give_guarantee','set_power_balance','set_building_level','set_state_flag','add_to_array','clear_array','set_temp_array','add_to_temp_array'].includes(k))note(audit.unhandledEffects,n,'effect-not-simulated');
  if(phase!=='country-history'&&['add_ideas','set_politics','set_party_name','recruit_character','promote_character','set_country_leader_ideology','add_country_leader_role','set_cosmetic_tag'].includes(k))rec._startupRefs.push(reference(n));
 }
}
for(const state of states.values())apply(state._history,records.get(state.owner),{phase:'state-history',state});
for(const entry of historyEntries){audit.loadOrder.push({phase:'country-history',file:entry.file,tag:entry.tag});apply(entry.ast,records.get(entry.tag),{root:records.get(entry.tag)});}
for(const p of walk(path.join(root,'common/on_actions')).filter(p=>p.endsWith('.txt'))){const ast=parsed(p);for(const group of ast){const actions=group.key==='on_actions'?group.value:[group];for(const a of actions)if(a.key==='on_startup'){audit.loadOrder.push({phase:'on-startup',file:rel(p),line:a.line});for(const e of blocks(a.value,'effect'))apply(e.value,null,{phase:'on-startup'});}}}
for(let i=0;i<eventQueue.length&&i<2000;i++){const {event,tag,root:eventRoot}=eventQueue[i],key=tag+':'+event.id;if(seenEvents.has(key))continue;seenEvents.add(key);const definition=eventDefinitions.get(event.id);if(!definition)continue;const rec=records.get(tag),trigger=condition(block(definition.value,'trigger'),rec);if(trigger!==true)continue;const immediate=block(definition.value,'immediate');if(immediate.length){audit.immediateEvents++;apply(immediate,rec,{phase:'immediate-opening-event',root:eventRoot,via:[event.source]});}}
for(const rec of records.values()){
 rec.ownedStateIds=[...states.values()].filter(s=>s.owner===rec.tag).map(s=>s.id);
 rec.controlledStateIds=[...states.values()].filter(s=>s.controller===rec.tag||Object.values(s.provinceControllers).includes(rec.tag)).map(s=>s.id);
 rec._active=rec.ownedStateIds.length>0||rec.controlledStateIds.length>0;
}

const focusTrees=[];for(const p of walk(path.join(root,'common/national_focus')).filter(p=>p.endsWith('.txt')))for(const n of parsed(p))if(n.key==='focus_tree'){const id=scalar(n.value,'id'),scope=block(n.value,'country');if(!id||!scope.length)continue;for(const r of records.values()){let score=Number(scalar(scope,'factor')||scalar(scope,'base')||0);for(const mod of blocks(scope,'modifier')){const cond=mod.value.filter(x=>x.key!=='add'&&x.key!=='factor');if(condition(cond,r)===true){if(scalar(mod.value,'factor')!==undefined)score*=Number(scalar(mod.value,'factor'));score+=Number(scalar(mod.value,'add')||0);}}if(score>0)r._focus.push({id,score});}focusTrees.push({id,source:reference(n,id)});}
const bookmarks=[];for(const p of walk(path.join(root,'common/bookmarks')).filter(p=>p.endsWith('.txt'))){const ast=parsed(p);for(const n of blocks(block(ast,'bookmarks'),'bookmark'))bookmarks.push({date:scalar(n.value,'date'),source:reference(n)});}

const regionOf=iso=>({CHN:'china',TWN:'taiwan',JPN:'japan',KOR:'korea',HKG:'hongkong',MAC:'macau'})[iso]||iso?.toLowerCase()||null;
const allTags={};
for(const r of records.values()){
 const group=r._politics.ruling_party,explicit=r._roles.filter(x=>x.group===group),allCandidates=r._recruited.flatMap(id=>(characters.get(id)?.roles||[]).map(x=>({...x,id,name:characters.get(id).name}))),candidates=allCandidates.filter(x=>x.group===group),leaderRole=[...explicit,...allCandidates].find(x=>x.id===r._promote)||explicit.filter(x=>x.promoted).at(-1)||explicit.at(-1)||candidates[0]||allCandidates[0];
 const allIdeas=[...r._ideas].map(id=>({id,name:label(id),description:label(id+'_desc'),group:ideas.get(id)?.group||'unknown',...(r._timedIdeas?.[id]?{initialDurationDays:r._timedIdeas[id]}:{}),sourceRefs:[r._ideaSources.get(id),ideas.has(id)?reference(ideas.get(id)):null,locRef(id)].filter(Boolean)}));
 const govIdeas=allIdeas.filter(x=>governmentIds.has(x.id)||x.id.startsWith('ZZZ_')&&/system|republic|dictatorship|monarchy|party_state|theocracy|government/.test(x.id));
 const selectedGovernment=govIdeas.find(x=>x.id===r._explicitGovernment?.id)||govIdeas.at(-1);
 const headMinister=allIdeas.find(x=>x.group==='head_minister'),government=selectedGovernment?.name||null;
 const partIds=unique([...Object.keys(r._popularities),group]);const parties=partIds.map(id=>({id,name:r._parties[id]?.name||label(`${r.tag}_${id}_party_long`)||label(`${r.tag}_${id}_party`)||label(id,id),popularity:r._popularities[id]??null}));
 const cosmetic=r.cosmeticTag||r.tag,name=label(`${cosmetic}_${group}`)||label(cosmetic)||r.definitionName;
 const spirits=allIdeas.filter(x=>x.name&&x.group==='country'&&!/^ZZZ_/.test(x.id));
 const economyId=allIdeas.filter(x=>economyIds.has(x.id)).at(-1)?.id.replace(/^ZZZ_/,'')||r.economyId||null;
 const rec={tag:r.tag,iso:r.iso,region:regionOf(r.iso),name,englishName:r.definitionName,aliases:unique([name,r.definitionName,r.tag]),startingStatus:r._active?'active':'not-present',primaryGeographicRecord:r.primaryGeographicRecord,leaderResolution:candidates.length||explicit.length?'matching-ideology':'first-recruited-role',ownedStateCount:r.ownedStateIds.length,ownedStateIds:r.ownedStateIds,controlledStateIds:r.controlledStateIds,cosmeticTag:r.cosmeticTag||null,leader:leaderRole?.name||null,headOfState:leaderRole?.name||null,headOfGovernment:headMinister?.name||null,leaderCharacterId:leaderRole?.id||null,government,governmentTypeId:selectedGovernment?.id||null,ideologyId:r._leaderIdeology||leaderRole?.ideology||group||null,ideology:label(r._leaderIdeology||leaderRole?.ideology)||label(group)||null,ideologyGroup:group||null,rulingParty:parties.find(p=>p.id===group)?.name||null,parties,electionsAllowed:r._politics.elections_allowed===undefined?null:r._politics.elections_allowed==='yes',lastElection:r._politics.last_election||null,capital:r.capital?{stateId:r.capital.id,name:r.capital.name,kind:'mod-state',countryName:isoMeta.get(r.iso)?.name||null}:null,stability:r.stability??null,warSupport:r.warSupport??null,economyId,economy:label('ZZZ_'+economyId)||label(economyId)||null,alliance:r.alliance||records.get(r._allianceLeader)?.alliance||null,subjectOf:r.subjectOf||null,nationalSpirits:spirits,focusTreeIds:unique(r._focus.filter(x=>x.score===Math.max(...r._focus.map(f=>f.score))).map(x=>x.id)),initialEventRefs:r._events.filter(e=>e.id),sourceRefs:[...r.sourceRefs,leaderRole?.source,selectedGovernment?.sourceRefs?.[0],r.capital?.source,...r._startupRefs].filter(Boolean),conflict:openingWars.some(w=>w.attackerTag===r.tag||w.defenderTag===r.tag)?'开局武装冲突':null,factionId:({PRC:'china_initial',CHI:'taiwan_dpp',JAP:'japan_ldp'})[r.tag]||(r.primaryGeographicRecord?(regionOf(r.iso)||r.tag.toLowerCase()):r.tag.toLowerCase())};
 // The requested Palestinian opening uses social democracy. Keep the exact MOD
 // subtype alongside this explicit adaptation, after all startup overrides.
 if(r.tag==='PAL'&&group==='social_democrat'){
   rec.modIdeologyId=rec.ideologyId;rec.modIdeology=rec.ideology;
   rec.ideologyId='social_democracy';rec.ideology=label('social_democracy','社会民主主义');
   rec.ideologyAdaptation={id:'palestine-social-democracy',basis:'user-requested-opening',sourceGroup:group,sourceGroupLabel:label(group),sourceSubtype:rec.modIdeologyId,sourceSubtypeLabel:rec.modIdeology,description:'本作开局按用户指定采用社会民主主义；MOD执政组为social_democrat，阿巴斯角色子类型progressivism保留作来源。'};
   const adaptationRef=locRef('social_democracy');if(adaptationRef)rec.sourceRefs.push(adaptationRef);
 }
 if(r.tag==='USA')rec.headOfGovernment=rec.leader;
 rec.openingChanges=r._changes;
 rec.laws=allIdeas.filter(x=>x.group!=='country'&&!/minister/.test(x.group));
 rec.ministers=allIdeas.filter(x=>/minister/.test(x.group));
 rec.dynamicModifiers=r._dynamicModifiers||[];
 rec.governmentResolution={method:r._explicitGovernment&&selectedGovernment?.id===r._explicitGovernment.id?'explicit-transition':'last-added-government-idea',source:r._explicitGovernment?.source||r._ideaSources.get(selectedGovernment?.id)||null,activeGovernmentIdeaIds:govIdeas.map(x=>x.id),conflictingIdeas:govIdeas.length>1};
 rec.sourceRefs=[...new Map([...rec.sourceRefs,...r._changes.map(x=>({file:x.file,line:x.line,key:x.key}))].map(x=>[`${x.file}:${x.line}:${x.key}`,x])).values()];
 rec.summary=[rec.government,rec.headOfState&&`国家元首：${rec.headOfState}`,rec.headOfGovernment&&`政府首脑：${rec.headOfGovernment}`,rec.rulingParty&&`执政党：${rec.rulingParty}`].filter(Boolean).join('。')+(rec.government||rec.leader||rec.rulingParty?'。':'');
 allTags[r.tag]=rec;
}
const countries={};
for(const [iso,meta]of isoMeta){const candidates=Object.values(allTags).filter(r=>r.iso===iso&&r.startingStatus==='active').sort((a,b)=>b.ownedStateCount-a.ownedStateCount);const selected=candidates.find(r=>r.tag==='PLD')||candidates.find(r=>r.primaryGeographicRecord);countries[iso]={...meta,region:regionOf(iso),tag:selected?.tag||null,openingTags:candidates.map(r=>r.tag),aliases:unique([...meta.aliases,...(selected?.aliases||[])])};}
// Hong Kong and Macau have no independent opening TAG in this MOD; keep their
// established local institutions instead of inheriting China's national office.
for(const [iso,name,leader,government]of [['HKG','香港','林郑月娥','香港特别行政区行政长官与特区政府体系'],['MAC','澳门','贺一诚','澳门特别行政区行政长官与特区政府体系']])countries[iso].localBaseline={name,leader,headOfState:null,headOfGovernment:leader,government,ideology:'特别行政区行政体系',rulingParty:null,capital:null,nationalSpirits:[],focusTreeIds:[],sourceRefs:[{file:'src/data/regions.json',line:1,key:regionOf(iso),projectSource:true}],adaptation:'模组无独立开局TAG，沿用本作2020年地区背景。',startingStatus:'regional',conflict:null,factionId:regionOf(iso)};
const totalActive=Object.values(allTags).filter(x=>x.startingStatus==='active');
const counts={tags:Object.keys(allTags).length,countryHistoryFiles:historyEntries.length,startingTags:totalActive.length,geographicIdentities:isoMeta.size,mappedOpeningCountries:Object.values(countries).filter(x=>x.tag||x.localBaseline).length,startingLeaders:totalActive.filter(x=>x.leader).length,startingGovernmentSystems:totalActive.filter(x=>x.government).length,startingFocusTrees:totalActive.filter(x=>x.focusTreeIds.length).length,sourceFiles:sourceFiles.size,parserWarnings:warnings.length,scriptedEffectDefinitions:scriptedEffects.size,scriptedTriggerDefinitions:scriptedTriggers.size,calledScriptedEffects:audit.scriptCalls,immediateOpeningEvents:audit.immediateEvents,openingWars:openingWars.length,openingStates:states.size,statesWithProvinceControllers:[...states.values()].filter(s=>Object.keys(s.provinceControllers).length).length,unresolvedConditions:audit.unresolvedConditions.size,unhandledEffects:audit.unhandledEffects.size};
const openingStates=[...states.values()].map(s=>({id:s.id,name:s.name,nameEnglish:s.nameEnglish,ownerTag:s.owner||null,controllerTag:s.controller||s.owner||null,provinceIds:s.provinceIds,provinceControllers:s.provinceControllers,sourceRefs:[...new Map(s.sourceRefs.filter(Boolean).map(x=>[`${x.file}:${x.line}:${x.key}`,x])).values()]}));
const output={version:2,openingDate:'2020-01-01',sourceName:path.basename(root),counts,countries,tags:allTags,openingStates,openingWars,focusTrees,bookmarks,sourceFiles:[...sourceFiles.values()],warnings,openingAudit:{loadOrder:audit.loadOrder,defaultGameRules:Object.fromEntries(gameRules),unresolvedConditions:[...audit.unresolvedConditions.values()],unhandledEffects:[...audit.unhandledEffects.values()],nonPoliticalEffects:audit.nonPoliticalEffects,governmentResolution:'明确 change_government_type 调用优先于开局通用 add_ideas；冲突原始 idea 全部保留供审计。'},limitations:['顺序读取全部国家/州历史，展开已调用的确定性脚本与开局 on_actions；未知条件保留审计，不执行随机、延迟事件或后续国策。','所有 DLC 条件采用可用；is_ai、玩家视角和未实现条件不猜测；游戏规则采用定义中的默认项。','即时开局事件只执行通过触发条件的 immediate，不替玩家选择 option。','MOD 州与省地块只供实际控制投影，不冒充现实县界。','明确制度切换与通用开局附加制度冲突时，以明确切换为展示口径，保留全部冲突和来源。']};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(output)+'\n');
console.log(JSON.stringify(counts));

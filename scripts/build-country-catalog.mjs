// Authoring-only, read-only MOD ingestion. This is a bounded opening-state extractor,
// not a HOI4 interpreter: unknown conditions and scheduled events are never executed.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(process.argv.find(a=>a.startsWith('--mod='))?.slice(6)||path.join(project,'../TFR-xinzuo-rebuild'));
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]):[];
const rel=p=>path.relative(root,p).split(path.sep).join('/');
const sourceFiles=new Map(),warnings=[];
function read(p){const text=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'');sourceFiles.set(rel(p),{path:rel(p),sha256:createHash('sha256').update(text).digest('hex')});return text;}
function parse(text,file){
  const re=/\s+|#[^\n]*|"(?:\\.|[^"\\])*"|[{}=]|[^\s{}=#]+/gy,tokens=[];let m,line=1;
  while((m=re.exec(text))){const t=m[0],start=line;line+=(t.match(/\n/g)||[]).length;if(/^\s|^#/.test(t))continue;tokens.push({t:t[0]==='"'?t.slice(1,-1).replace(/\\"/g,'"'):t,line:start});}
  let i=0;function body(nested=false){const out=[];while(i<tokens.length){const a=tokens[i++];if(a.t==='}')return out;if(a.t==='{'){out.push({key:null,value:body(true),line:a.line,file});continue;}if(tokens[i]?.t==='='){i++;const v=tokens[i++];if(!v)break;out.push({key:a.t,value:v.t==='{'?body(true):v.t,line:a.line,file});}else out.push({key:null,value:a.t,line:a.line,file});}if(nested)warnings.push({file,line,kind:'unclosed-block'});return out;}return body();
}
const parsed=p=>parse(read(p),rel(p));
const scalar=(nodes,key)=>nodes?.find(n=>n.key===key&&!Array.isArray(n.value))?.value;
const block=(nodes,key)=>nodes?.find(n=>n.key===key&&Array.isArray(n.value))?.value||[];
const blocks=(nodes,key)=>nodes?.filter(n=>n.key===key&&Array.isArray(n.value))||[];
const reference=(n,key=n?.key)=>n?{file:n.file,line:n.line,key}:null;
const unique=xs=>[...new Set(xs.filter(Boolean))];
const clean=value=>String(value||'').replace(/\\n/g,'\n').replace(/§./g,'').replace(/£[\w.]+(?:\|\d+)?/g,'').replace(/\[!?[^\]]+\]/g,'').replace(/\$[^$]+\$/g,'').replace(/[ \t]+/g,' ').trim();

const loc=new Map();
for(const p of walk(path.join(root,'localisation')).filter(p=>p.endsWith('.yml'))){const file=rel(p),text=read(p);let language='';for(const [i,line]of text.split('\n').entries()){const lang=line.match(/^\s*l_([\w]+)\s*:/);if(lang){language=lang[1];continue;}if(language!=='simp_chinese'&&language!=='english')continue;const m=line.match(/^\s*([^#\s:]+):\s*(?:\d+\s*)?"(.*)"\s*(?:#.*)?$/);if(!m)continue;const score=(language==='simp_chinese'?10:0)+(file.includes('/replace/')?2:0);if(!loc.has(m[1])||loc.get(m[1]).score<score)loc.set(m[1],{text:m[2],file,line:i+1,score});}}
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
const history=new Map();for(const p of walk(path.join(root,'history/countries')).filter(p=>p.endsWith('.txt'))){const tag=path.basename(p).slice(0,3);if(tagDefs.has(tag))history.set(tag,{ast:parsed(p),file:rel(p)});}
const subIdeologies=new Map();for(const p of walk(path.join(root,'common/ideologies')).filter(p=>p.endsWith('.txt')))for(const n of block(parsed(p),'ideologies'))for(const t of block(n.value,'types'))subIdeologies.set(t.key,n.key);
const characters=new Map();for(const p of walk(path.join(root,'common/characters')).filter(p=>p.endsWith('.txt')))for(const n of block(parsed(p),'characters'))characters.set(n.key,{...n,name:label(scalar(n.value,'name')||n.key),roles:blocks(n.value,'country_leader').map(r=>({ideology:scalar(r.value,'ideology'),group:subIdeologies.get(scalar(r.value,'ideology')),source:reference(r)}))});
const ideas=new Map();for(const p of walk(path.join(root,'common/ideas')).filter(p=>p.endsWith('.txt')))for(const group of block(parsed(p),'ideas'))if(Array.isArray(group.value))for(const n of group.value)if(n.key&&Array.isArray(n.value))ideas.set(n.key,{group:group.key,...n});
const states=new Map(),owned=new Map();
for(const p of walk(path.join(root,'history/states')).filter(p=>p.endsWith('.txt'))){const s=block(parsed(p),'state'),id=Number(scalar(s,'id'));if(!id)continue;const h=block(s,'history'),owner=scalar(h,'owner'),nameKey=scalar(s,'name');states.set(id,{id,owner,name:label(nameKey,nameKey||String(id)),source:reference(s.find(n=>n.key==='id'))});if(owner)owned.set(owner,[...(owned.get(owner)||[]),id]);}

const records=new Map();
for(const [tag,d]of tagDefs){const h=history.get(tag),fileName=path.basename(d.path,'.txt'),iso=secondaryIso[tag]||exceptions[tag]||isoNames.get(norm(fileName))||null;records.set(tag,{tag,iso,primaryGeographicRecord:!secondaryIso[tag],definitionName:fileName,sourceRefs:[d.source,...(h?[{file:h.file,line:1,key:tag}]:[])],_flags:new Set(),_ideas:new Set(),_recruited:[],_roles:[],_parties:{},_politics:{},_popularities:{},_startupRefs:[],_focus:[],_events:[],_active:(owned.get(tag)?.length||0)>0,ownedStateIds:owned.get(tag)||[]});}
const globalFlags=new Set();
function condition(nodes,rec){
  const checks=[];for(const n of nodes||[]){let v=null;
    if(n.key==='NOT'){const vals=n.value.map(x=>condition([x],rec));v=vals.every(x=>x===false)?true:vals.includes(true)?false:null;}
    else if(n.key==='OR'){const vals=n.value.map(x=>condition([x],rec));v=vals.includes(true)?true:vals.every(x=>x===false)?false:null;}
    else if(n.key==='AND')v=condition(n.value,rec);
    else if(n.key==='tag'||n.key==='original_tag')v=rec.tag===n.value;
    else if(n.key==='always')v=n.value==='yes';
    else if(n.key==='has_country_flag')v=rec._flags.has(n.value);
    else if(n.key==='has_global_flag')v=globalFlags.has(n.value);
    else if(n.key==='has_idea')v=rec._ideas.has(n.value);
    else if(n.key==='has_government')v=rec._politics.ruling_party===n.value;
    else if(n.key==='exists')v=records.get(n.value)?records.get(n.value)._active:null;
    else if(n.key==='has_dlc')v=true;
    else if(n.key==='has_game_rule'){const option=scalar(n.value,'option');v=/DISABLED|HISTORICAL|DEFAULT/i.test(option||'')?true:false;}
    else if(n.key==='has_completed_focus'||n.key==='has_war'||n.key==='has_capitulated')v=false;
    checks.push(v);
  }return checks.includes(false)?false:checks.includes(null)?null:true;
}
function apply(nodes,rec,{startup=false,depth=0}={}){
  if(depth>10)return;let priorBranch=null;
  for(const n of nodes){const k=n.key,v=n.value;if(k==='limit')continue;
    if(k==='if'||k==='else_if'||k==='else'){const eligible=k==='else'?priorBranch===false:k==='else_if'?(priorBranch===false?condition(block(v,'limit'),rec):false):condition(block(v,'limit'),rec);if(eligible===true)apply(v.filter(x=>x.key!=='limit'),rec,{startup,depth:depth+1});priorBranch=priorBranch===true&&k!=='if'?true:eligible;continue;}
    priorBranch=null;
    if(k==='hidden_effect'||k==='effect'){apply(v,rec,{startup,depth:depth+1});continue;}
    if(/^\d{4}\.\d+\.\d+/.test(k||'')){if(Number(k.split('.')[0])<=2020&&k<='2020.1.1')apply(v,rec,{startup,depth:depth+1});continue;}
    if(k==='set_country_flag')rec._flags.add(v);
    if(k==='clr_country_flag')rec._flags.delete(v);
    if(k==='capital')rec.capital=states.get(Number(v))||{id:Number(v),name:null};
    if(k==='set_politics')for(const x of v)if(!Array.isArray(x.value))rec._politics[x.key]=x.value;
    if(k==='set_popularities')for(const x of v)if(Number.isFinite(Number(x.value)))rec._popularities[x.key]=Number(x.value);
    if(k==='set_party_name'){const id=scalar(v,'ideology');if(id)rec._parties[id]={id,name:label(scalar(v,'long_name'))||label(scalar(v,'name')),source:reference(n)};}
    if(k==='add_ideas'||k==='remove_ideas')for(const id of Array.isArray(v)?v.filter(x=>x.key===null).map(x=>x.value):[v]){if(k==='add_ideas')rec._ideas.add(id);else rec._ideas.delete(id);}
    if(k==='recruit_character'&&!rec._recruited.includes(v))rec._recruited.push(v);
    if(k==='create_country_leader')rec._roles.push({name:label(scalar(v,'name'),scalar(v,'name')),ideology:scalar(v,'ideology'),group:subIdeologies.get(scalar(v,'ideology')),source:reference(n),promoted:rec._roles.length===0});
    if(k==='add_country_leader_role'){const c=scalar(v,'character'),role=block(v,'country_leader');rec._roles.push({id:c,name:characters.get(c)?.name||label(c),ideology:scalar(role,'ideology'),group:subIdeologies.get(scalar(role,'ideology')),source:reference(n),promoted:scalar(v,'promote_leader')==='yes'});}
    if(k==='promote_character')rec._promote=typeof v==='string'?v:scalar(v,'character');
    if(k==='set_country_leader_ideology')rec._leaderIdeology=v;
    if(k==='set_cosmetic_tag')rec.cosmeticTag=v;
    if(k==='load_focus_tree')rec._focus.push({id:typeof v==='string'?v:scalar(v,'tree'),score:100000});
    if(k==='country_event')rec._events.push({id:typeof v==='string'?v:scalar(v,'id'),days:Array.isArray(v)?Number(scalar(v,'days')||0):0,source:reference(n)});
    if(k==='set_stability'||k==='set_war_support')rec[k==='set_stability'?'stability':'warSupport']=Number(v);
    if(k==='create_faction')rec.alliance=label(v,v);
    if(k==='add_to_faction'&&records.has(v))records.get(v)._allianceLeader=rec.tag;
    if(k==='set_autonomy'&&Array.isArray(v)){const target=records.get(scalar(v,'target'));if(target){target.subjectOf=rec.tag;target.autonomy=scalar(v,'autonomy_state');}}
    if(k?.startsWith('change_government_type_'))rec._ideas.add('ZZZ_'+k.slice('change_government_type_'.length));
    if(k?.startsWith('change_economy_type_'))rec.economyId=k.slice('change_economy_type_'.length);
    if(startup&&['add_ideas','set_politics','set_party_name','recruit_character','promote_character','set_country_leader_ideology','add_country_leader_role','set_cosmetic_tag'].includes(k))rec._startupRefs.push(reference(n));
  }
}
for(const [tag,h]of history)apply(h.ast,records.get(tag));
// Only explicit country scopes and known tag/government selectors at on_startup.
// Event scheduling, chance, UI ROOT and arbitrary scripted effects stay metadata.
function startup(nodes,scope=null,depth=0){if(depth>12)return;let prior=null;for(const n of nodes){const k=n.key,v=n.value;
  if(records.has(k)){startup(v,records.get(k),depth+1);prior=null;continue;}
  if(k==='every_country'||k==='every_possible_country'){for(const r of records.values())if((k==='every_possible_country'||r._active)&&condition(block(v,'limit'),r)===true)startup(v.filter(x=>x.key!=='limit'),r,depth+1);continue;}
  if(k==='if'||k==='else_if'||k==='else'){const r=scope||{tag:'__global',_flags:new Set(),_ideas:new Set(),_politics:{}},yes=k==='else'?prior===false:k==='else_if'?(prior===false?condition(block(v,'limit'),r):false):condition(block(v,'limit'),r);if(yes===true)startup(v.filter(x=>x.key!=='limit'),scope,depth+1);prior=prior===true&&k!=='if'?true:yes;continue;}
  prior=null;if(k==='effect'||k==='hidden_effect'){startup(v,scope,depth+1);continue;}
  if(k==='set_global_flag'){globalFlags.add(v);continue;}
  if(scope)apply([n],scope,{startup:true});
}}
for(const p of walk(path.join(root,'common/on_actions')).filter(p=>p.endsWith('.txt'))){const ast=parsed(p);for(const group of ast){const actions=group.key==='on_actions'?group.value:[group];for(const a of actions)if(a.key==='on_startup')for(const e of blocks(a.value,'effect'))startup(e.value);}}
const focusTrees=[];for(const p of walk(path.join(root,'common/national_focus')).filter(p=>p.endsWith('.txt')))for(const n of parsed(p))if(n.key==='focus_tree'){const id=scalar(n.value,'id'),scope=block(n.value,'country');if(!id||!scope.length)continue;for(const r of records.values()){let score=Number(scalar(scope,'factor')||scalar(scope,'base')||0);for(const mod of blocks(scope,'modifier')){const cond=mod.value.filter(x=>x.key!=='add'&&x.key!=='factor');if(condition(cond,r)===true){if(scalar(mod.value,'factor')!==undefined)score*=Number(scalar(mod.value,'factor'));score+=Number(scalar(mod.value,'add')||0);}}if(score>0)r._focus.push({id,score});}focusTrees.push({id,source:reference(n,id)});}
const bookmarks=[];for(const p of walk(path.join(root,'common/bookmarks')).filter(p=>p.endsWith('.txt'))){const ast=parsed(p);for(const n of blocks(block(ast,'bookmarks'),'bookmark'))bookmarks.push({date:scalar(n.value,'date'),source:reference(n)});}

const regionOf=iso=>({CHN:'china',TWN:'taiwan',JPN:'japan',KOR:'korea',HKG:'hongkong',MAC:'macau'})[iso]||iso?.toLowerCase()||null;
const eastBaseline={
 PRC:{name:'中华人民共和国',leader:'习近平',government:'中国共产党领导的主席独裁制',ideology:'市场毛主义、修正主义与主席独裁制',rulingParty:'中国共产党',factionId:'china_initial'},
 CHI:{name:'台湾',leader:'蔡英文',government:'民进党执政的总统与行政体系',ideology:'社会自由主义与民进党台湾进步主义',rulingParty:'民主进步党',factionId:'taiwan_dpp'},
 JAP:{name:'日本',leader:'安倍晋三内阁',government:'自民党一党独大下的保守主义议会民主与君主立宪制',ideology:'自民党保守主义与议会民主',rulingParty:'自由民主党',factionId:'japan_ldp'}
};
const allTags={};
for(const r of records.values()){
 const group=r._politics.ruling_party,explicit=r._roles.filter(x=>x.group===group),allCandidates=r._recruited.flatMap(id=>(characters.get(id)?.roles||[]).map(x=>({...x,id,name:characters.get(id).name}))),candidates=allCandidates.filter(x=>x.group===group),leaderRole=[...explicit,...allCandidates].find(x=>x.id===r._promote)||explicit.find(x=>x.promoted)||explicit[0]||candidates[0]||allCandidates[0];
 const allIdeas=[...r._ideas].map(id=>({id,name:label(id),description:label(id+'_desc'),group:ideas.get(id)?.group||'unknown',sourceRefs:[ideas.has(id)?reference(ideas.get(id)):null,locRef(id)].filter(Boolean)}));
 const govIdeas=allIdeas.filter(x=>x.id.startsWith('ZZZ_')&&/system|republic|dictatorship|monarchy|party_state|theocracy|government/.test(x.id));
 const headMinister=allIdeas.find(x=>x.group==='head_minister'),government=govIdeas.at(-1)?.name||null;
 const partIds=unique([...Object.keys(r._popularities),group]);const parties=partIds.map(id=>({id,name:r._parties[id]?.name||label(`${r.tag}_${id}_party_long`)||label(`${r.tag}_${id}_party`)||label(id,id),popularity:r._popularities[id]??null}));
 const cosmetic=r.cosmeticTag||r.tag,name=label(`${cosmetic}_${group}`)||label(cosmetic)||r.definitionName;
 const spirits=allIdeas.filter(x=>x.name&&x.group==='country'&&!/^ZZZ_/.test(x.id));
 const economyId=r.economyId||null;
 const rec={tag:r.tag,iso:r.iso,region:regionOf(r.iso),name,englishName:r.definitionName,aliases:unique([name,r.definitionName,r.tag]),startingStatus:r._active?'active':'not-present',primaryGeographicRecord:r.primaryGeographicRecord,leaderResolution:candidates.length||explicit.length?'matching-ideology':'first-recruited-role',ownedStateCount:r.ownedStateIds.length,ownedStateIds:r.ownedStateIds,leader:leaderRole?.name||null,headOfState:leaderRole?.name||null,headOfGovernment:headMinister?.name||null,leaderCharacterId:leaderRole?.id||null,government,governmentTypeId:govIdeas.at(-1)?.id||null,ideologyId:r._leaderIdeology||leaderRole?.ideology||group||null,ideology:label(r._leaderIdeology||leaderRole?.ideology)||label(group)||null,ideologyGroup:group||null,rulingParty:parties.find(p=>p.id===group)?.name||null,parties,electionsAllowed:r._politics.elections_allowed===undefined?null:r._politics.elections_allowed==='yes',lastElection:r._politics.last_election||null,capital:r.capital?{stateId:r.capital.id,name:r.capital.name,kind:'mod-state',countryName:isoMeta.get(r.iso)?.name||null}:null,stability:r.stability??null,warSupport:r.warSupport??null,economyId,economy:label('ZZZ_'+economyId)||label(economyId)||null,alliance:r.alliance||records.get(r._allianceLeader)?.alliance||null,subjectOf:r.subjectOf||null,nationalSpirits:spirits,focusTreeIds:unique(r._focus.filter(x=>x.score===Math.max(...r._focus.map(f=>f.score))).map(x=>x.id)),initialEventRefs:r._events.filter(e=>e.id),sourceRefs:[...r.sourceRefs,leaderRole?.source,govIdeas.at(-1)?.sourceRefs?.[0],r.capital?.source,...r._startupRefs].filter(Boolean),conflict:null,factionId:regionOf(r.iso)||r.tag.toLowerCase()};
 if(r.tag==='USA')rec.headOfGovernment=rec.leader;
 if(eastBaseline[r.tag]){Object.assign(rec,eastBaseline[r.tag]);rec.adaptation='中国大陆、台湾、日本的呈现口径沿用既有用户设定；原MOD国家元首与政府首脑另列，未把后续路线当成开局。';}
 rec.summary=[rec.government,rec.headOfState&&`国家元首：${rec.headOfState}`,rec.headOfGovernment&&`政府首脑：${rec.headOfGovernment}`,rec.rulingParty&&`执政党：${rec.rulingParty}`].filter(Boolean).join('。')+(rec.government||rec.leader||rec.rulingParty?'。':'');
 allTags[r.tag]=rec;
}
const countries={};
for(const [iso,meta]of isoMeta){const candidates=Object.values(allTags).filter(r=>r.iso===iso&&r.startingStatus==='active').sort((a,b)=>b.ownedStateCount-a.ownedStateCount);const selected=candidates.find(r=>r.tag==='PLD')||candidates.find(r=>r.primaryGeographicRecord);countries[iso]={...meta,region:regionOf(iso),tag:selected?.tag||null,openingTags:candidates.map(r=>r.tag),aliases:unique([...meta.aliases,...(selected?.aliases||[])])};}
// Hong Kong and Macau have no independent opening TAG in this MOD; keep their
// established local institutions instead of inheriting China's national office.
for(const [iso,name,leader,government]of [['HKG','香港','林郑月娥','香港特别行政区行政长官与特区政府体系'],['MAC','澳门','贺一诚','澳门特别行政区行政长官与特区政府体系']])countries[iso].localBaseline={name,leader,headOfState:null,headOfGovernment:leader,government,ideology:'特别行政区行政体系',rulingParty:null,capital:null,nationalSpirits:[],focusTreeIds:[],sourceRefs:[{file:'src/data/regions.json',line:1,key:regionOf(iso),projectSource:true}],adaptation:'模组无独立开局TAG，沿用本作2020年地区背景。',startingStatus:'regional',conflict:null,factionId:regionOf(iso)};
const totalActive=Object.values(allTags).filter(x=>x.startingStatus==='active');
const counts={tags:Object.keys(allTags).length,countryHistoryFiles:history.size,startingTags:totalActive.length,geographicIdentities:isoMeta.size,mappedOpeningCountries:Object.values(countries).filter(x=>x.tag||x.localBaseline).length,startingLeaders:totalActive.filter(x=>x.leader).length,startingGovernmentSystems:totalActive.filter(x=>x.government).length,startingFocusTrees:totalActive.filter(x=>x.focusTreeIds.length).length,sourceFiles:sourceFiles.size,parserWarnings:warnings.length};
const output={version:1,openingDate:'2020-01-01',sourceName:path.basename(root),counts,countries,tags:allTags,focusTrees,bookmarks,sourceFiles:[...sourceFiles.values()],warnings,limitations:['只执行明确国家作用域、可判定开局条件及有限直接效果；不执行定时事件、随机效果、动态脚本和后续路线。','MOD州是资料定位与开局存在性证据，不是现实行政区边界。','没有开局领土或无法映射的TAG不自动成为现实国家的执政势力。']};
fs.writeFileSync(path.join(project,'src/data/countries.json'),JSON.stringify(output)+'\n');
console.log(JSON.stringify(counts));

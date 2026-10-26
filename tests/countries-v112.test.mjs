import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {countryCatalogCounts,countryByTag,countryByIso,resolveCountry,getCountryContext} from '../src/countries.js';
import catalog from '../src/data/countries.json' with {type:'json'};

test('all registered MOD TAGs have evidence and present/releasable status',()=>{
 assert.equal(countryCatalogCounts.tags,692);
 assert.equal(Object.keys(catalog.tags).length,countryCatalogCounts.tags);
 assert.equal(countryCatalogCounts.startingTags,187);
 for(const record of Object.values(catalog.tags)){
  assert.ok(record.sourceRefs.length>=2,record.tag);
  assert.ok(['active','not-present'].includes(record.startingStatus));
  assert.equal(record.startingStatus==='active',record.ownedStateCount>0||record.controlledStateIds.length>0);
  assert.ok(record.sourceRefs.every(s=>s.file&&Number.isInteger(s.line)&&s.line>0));
 }
});

test('ISO identities and HOI4 TAGs cannot be conflated',()=>{
 assert.equal(countryByIso('AUS').tag,'AST');
 assert.equal(countryByTag('AUS').iso,'AUT');
 assert.equal(countryByIso('AUT').tag,'AUS');
 assert.equal(countryByIso('MAC').region,'macau');
 assert.equal(countryByTag('MAC').iso,'MKD');
 assert.equal(countryByIso('PRK').tag,'PRK');
 assert.equal(countryByIso('KOR').region,'korea');
 assert.equal(countryByIso('POL').tag,'PLD');
 assert.equal(countryByIso('SDS').iso,'SSD');
 assert.equal(countryByIso('KOS').iso,'XKX');
});

test('later civil-war TAGs never become the opening governments',()=>{
 assert.equal(countryByTag('USB').startingStatus,'not-present');
 assert.equal(countryByTag('TSU').startingStatus,'not-present');
 assert.equal(countryByTag('TZL').startingStatus,'not-present');
 assert.equal(countryByIso('USA').tag,'USA');
 assert.equal(countryByIso('JPN').tag,'JAP');
 assert.equal(countryByIso('TWN').tag,'CHI');
 assert.equal(countryByIso('AFG').tag,'AFG');
 assert.equal(countryByIso('LBY').tag,'LBA');
 assert.equal(countryByIso('MDV').startingStatus,'unknown');
 assert.equal(countryByIso('MDV').leader,null);
});

test('opening country offices, government systems, politics and capitals come from MOD evidence',()=>{
 const us=countryByIso('USA'),fr=countryByIso('FRA'),gb=countryByIso('GBR'),de=countryByIso('DEU');
 assert.match(us.leader,/特朗普/);assert.match(us.government,/联邦共和/);
 assert.match(us.rulingParty,/共和党/);assert.ok(us.capital.stateId);
 assert.match(fr.leader,/马克龙/);assert.match(fr.government,/半总统/);
 assert.match(gb.headOfState,/伊丽莎白/);assert.match(gb.headOfGovernment,/约翰逊/);
 assert.match(de.headOfGovernment,/默克尔/);assert.match(de.headOfState,/施泰因迈尔/);
 assert.match(countryByIso('PRK').leader,/金正恩/);
 assert.equal(us.focusTreeIds.includes('generic_focus'),false);
 assert.ok(us.focusTreeIds.includes('USA_focus'));
 assert.ok(us.nationalSpirits.length>=4);
 assert.ok(us.parties.some(x=>x.name.includes('共和党')&&x.popularity>0));
});

test('East Asian final MOD opening systems and special administrative regions stay coherent',()=>{
 assert.match(countryByIso('CHN').ideology,/习大林/);
 assert.match(countryByIso('TWN').ideology,/台湾进步/);
 assert.match(countryByIso('JPN').ideology,/右翼民粹/);
 assert.match(countryByIso('JPN').headOfState,/德仁/);
 assert.match(countryByIso('JPN').headOfGovernment,/安倍/);
 assert.match(countryByIso('HKG').leader,/林郑月娥/);
 assert.match(countryByIso('MAC').leader,/贺一诚/);
 assert.equal(countryByIso('MAC').tag,null);
});

test('dynamic government overrides replace current facts while baseline remains auditable',()=>{
 const state={month:64,worldState:{taiwan:{leader:'旧领导',ideology:'旧思想',government:'旧政府'}},worldOverrides:{taiwan:{leader:'左翼联盟',government:'台湾社会主义共和国临时政府',ideology:'社会自由主义与民进党台湾进步主义',conflict:null}}};
 const original=structuredClone(state),tw=getCountryContext(state,'TWN');
 assert.match(tw.ideology,/社会主义与劳工民主/);
 assert.equal(tw.leader,'左翼联盟');assert.equal(tw.rulingParty,null);
 assert.equal(tw.conflict,null);assert.equal(tw.factionId,'taiwan_left');
 assert.match(tw.baseline.leader,/蔡英文/);assert.match(tw.baseline.ideology,/台湾进步/);
 assert.equal(tw.currentSource,'dynamic');assert.deepEqual(state,original);
});

test('current world state outranks opening metadata and explicit player changes outrank it',()=>{
 const s={month:40,worldState:{fra:{leader:'临时议会',government:'议会过渡机构',ideology:'公共协商',month:39}},worldOverrides:{fra:{leader:'自定义领导',ideology:'自定义主义',conflict:null}}};
 const fr=getCountryContext(s,'FRA');assert.equal(fr.leader,'自定义领导');assert.equal(fr.ideology,'自定义主义');assert.equal(fr.government,'议会过渡机构');
 assert.match(fr.baseline.leader,/马克龙/);assert.equal(fr.headOfState,null);assert.equal(fr.headOfGovernment,null);
});

test('future entries are not current facts and time travel cannot resurrect 2020 leaders',()=>{
 const fr=getCountryContext({month:0,worldState:{fra:{leader:'尚未上台者',month:30}}},'FRA');assert.match(fr.leader,/马克龙/);
 const historical=getCountryContext({month:-528},'USA');assert.equal(historical.leader,null);assert.equal(historical.ideology,null);assert.equal(historical.nationalSpirits.length,0);assert.match(historical.government,/1976/);
 assert.equal(getCountryContext({month:-528,worldOverrides:{usa:{leader:'穿越后领导',government:'新政府'}}},'USA').leader,'穿越后领导');
});

test('wartime status and explicit peace are preserved without applying a faraway war',()=>{
 assert.equal(getCountryContext({factionConflicts:{fra:'本地战争'}},'FRA').conflict,'本地战争');
 assert.equal(getCountryContext({factionConflicts:{fra:'本地战争'}},'BRA').conflict,null);
 assert.equal(getCountryContext({worldOverrides:{fra:{conflict:'本地战争'}},factionConflicts:{fra:null}},'FRA').conflict,null);
 assert.equal(getCountryContext({factionConflicts:{fra:'本地战争'},worldDynamics:{lastingPeace:true}},'FRA').conflict,null);
});

test('country names/aliases resolve stably; unknown countries are explicit and caller mutations cannot persist',()=>{
 assert.equal(resolveCountry('法国').iso,'FRA');assert.equal(resolveCountry('France').iso,'FRA');assert.equal(resolveCountry('中国台湾').iso,'TWN');assert.equal(resolveCountry('中国大陆').iso,'CHN');
 assert.equal(resolveCountry('太空自定义阵线'),null);
 const unknown=countryByIso('AND');assert.equal(unknown.name,'安道尔');assert.equal(unknown.currentSource,'unknown');assert.equal(unknown.leader,null);
 const before=countryByIso('FRA');before.nationalSpirits.length=0;before.baseline.leader='修改';assert.ok(countryByIso('FRA').nationalSpirits.length);assert.notEqual(countryByIso('FRA').baseline.leader,'修改');
});

test('source metadata is relative, public and all known inputs have hashes',()=>{
 assert.equal(catalog.openingDate,'2020-01-01');assert.equal(catalog.warnings.length,0);
 for(const source of catalog.sourceFiles){assert.ok(!/^[A-Z]:|\.private|api.key|settings\.json/i.test(source.path));assert.match(source.sha256,/^[a-f0-9]{64}$/);}
 const source=fs.readFileSync(new URL('../src/countries.js',import.meta.url),'utf8');assert.doesNotMatch(source,/from ['"].*(?:engine|regions|world-territories)\.js/);
});

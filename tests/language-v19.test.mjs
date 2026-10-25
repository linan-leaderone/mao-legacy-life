import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {LANGUAGE_OPTIONS,normalizeLanguage,translateUI,applyInterfaceLanguage,convertChinese,localizeEvent,localizeNews,languageInstruction,translateLocalOption} from '../src/language.js';
import lifeEvents from '../src/data/life-events.json' with {type:'json'};
import optionTranslations from '../src/data/option-translations.json' with {type:'json'};
import {proseIssues} from '../src/narrative.js';
import {buildPrompt,responseSchema} from '../src/deepseek.js';
import {createGame,nextContext,localEvent,advance,exportSave,importSave,validateResponse} from '../src/engine.js';

const game=(language='zh-CN',extra={})=>createGame({name:'林远',place:'上海',age:24,background:'ordinary',seed:'languages-v19',freedom:'unlimited',language,...extra},lore);
const response=(narrative,extra={})=>({title:'A continuing life',narrative,consequence:'',memory:'',location:'上海',options:[],...extra});

test('seven explicit language and style choices use safe defaults and preserve technical tokens',()=>{
  assert.deepEqual(LANGUAGE_OPTIONS.map(option=>option.id),['zh-CN','zh-TW','en','ja','ko','martian','shuihu']);
  assert.equal(normalizeLanguage('not-a-language'),'zh-CN');
  assert.equal(translateUI('人物关系','en'),'Relationships');
  assert.equal(translateUI('性别','ja'),'性別');
  assert.equal(translateUI('保留联系方式，先照顾自己的生活','en'),'保留联系方式，先照顾自己的生活');
  assert.equal(translateUI('添加族裔描述','ko'),'민족 / 종족 설명 추가');
  assert.equal(convertChinese('https://example.com/后台 sk-private-token gemini-4-argon','martian'),'https://example.com/后台 sk-private-token gemini-4-argon');
});

test('all 355 fixed local actions have meaningful English, Japanese and Korean labels and descriptions',()=>{
  assert.equal(Object.keys(optionTranslations.options).length,355);
  const options=[...lifeEvents.events.flatMap(event=>event.options),...Object.values(lifeEvents.majorOptions).flat()];
  assert.equal(options.length,317);
  for(const [label,entry]of Object.entries(optionTranslations.options))for(const language of ['en','ja','ko']){
    const translated=translateLocalOption({label,description:entry.sourceDescription,delta:{stress:-2},check:{stat:'intelligence',difficulty:25}},language,{profile:{goal:'Alpha goal'}});
    assert.ok(translated.label.trim(),label);assert.ok(translated.description.trim(),label);
    assert.equal(translated.originalLabel,label);assert.notEqual(translated.label,label);
    assert.doesNotMatch(translated.label,/^(?:Arrangement|行動案|행동안) \d+$/);assert.doesNotMatch(translated.description,/Original wording|原文の内容|원문의 내용/);
    assert.deepEqual(translated.delta,{stress:-2});assert.equal(translated.check.difficulty,25);
    if(language==='en')assert.doesNotMatch(translated.label+translated.description,/[\u3400-\u9fff]/);
    if(language==='ja')assert.match(translated.description,/[ぁ-ゖァ-ヺ]/);
    if(language==='ko')assert.match(translated.description,/[가-힣]/);
    assert.deepEqual([...entry.sourceDescription.matchAll(/\{\w+\}/g)].map(match=>match[0]),[...entry[language].description.matchAll(/\{\w+\}/g)].map(match=>match[0]));
  }
  for(const option of options)assert.ok(optionTranslations.options[option.label],option.label);
  for(const language of ['en','ja','ko']){
    const actual=translateLocalOption({label:'写下迁移前必须满足的条件',description:''},language,{profile:{goal:'我自己的银河计划'}});
    assert.match(actual.description,/我自己的银河计划/);
  }
});

test('traditional conversion handles phrases while protecting names, custom identity and original actions',()=>{
  const state={profile:{name:'林远',language:'zh-TW',identity:{ethnicity:'银河龙族',nationality:'后土联邦'}},location:'上海',relationshipGraph:{nodes:[{name:'张宏良'}]}};
  const event={title:'接下来的联系',narrative:'林远与张宏良在后台讨论计划，银河龙族的生活继续。后土联邦的人已经回复。',consequence:'你完成了“我已经写好申请”的安排。',options:[{label:'联系张宏良',description:'根据已经收到的回复继续安排。',delta:{}}],news:[]};
  const copy=structuredClone({state,event}),result=localizeEvent(event,state,{label:'我已经写好申请'});
  assert.match(result.narrative,/林远與张宏良在後臺討論計劃/);
  assert.match(result.narrative,/银河龙族/);assert.match(result.narrative,/后土联邦/);
  assert.match(result.consequence,/我已经写好申请/);assert.equal(result.options[0].originalLabel,'联系张宏良');
  assert.deepEqual({state,event},copy);assert.equal(localizeEvent(result,state),result);
});

test('offline foreign news exposes a clearly marked source without changing impact or event identity',()=>{
  const original={id:'henan-flood',title:'郑州洪灾',description:'河南发生洪灾。',impact:{funds:-20},region:'china',month:18};
  const [translated]=localizeNews([original],'en');
  assert.equal(translated.id,original.id);assert.deepEqual(translated.impact,original.impact);
  assert.equal(translated.originalTitle,'郑州洪灾');assert.equal(translated.originalDescription,'河南发生洪灾。');
  assert.equal(translated.translationStatus,'original');assert.match(translated.description,/original language/);
  assert.equal(localizeNews(translated,'en'),translated);assert.equal(original.description,'河南发生洪灾。');
});

test('foreign offline continuation follows actual employment, accounts and saved action semantics',()=>{
  for(const language of ['en','ja','ko']){
    const state=game(language),action={label:'我已经在工厂打工，月薪6000',custom:true},prepared=nextContext(state,lore,action).state,event=localEvent(prepared,lore,action);
    assert.equal(event.language,language);assert.equal(event.translationStatus,'local-template');
    assert.match(event.consequence,/6000/);assert.ok(event.localOriginal.narrative);
    assert.equal(proseIssues(event,{language,location:prepared.location}).length,0);
    for(const option of event.options)assert.equal(option.originalLabel,option.localOriginal.label);
    const advanced=advance(state,action,event,null,lore),restored=importSave(exportSave(advanced),lore);
    assert.equal(restored.profile.language,language);assert.equal(restored.month,1);
    assert.equal(restored.stats.funds,prepared.stats.funds);assert.equal(restored.current.narrative,event.narrative);
  }
});

test('foreign local fish and battle accounts retain failure, wounds and infection rather than inventing growth or recovery',()=>{
  const state={profile:{language:'en',name:'邓小平'},specialLife:{kind:'deng_ocean',stage:0},location:'太平洋',stats:{funds:0,health:62},actionResult:{fishGame:{eaten:0,growth:0},success:true},encounterState:{infected:true},history:[]};
  const base={title:'觅食',narrative:'你没有捕到小鱼。',options:[],news:[]};
  const event=localizeEvent(base,state,{label:'继续捕食小鱼',custom:true});
  assert.match(event.narrative,/without having caught any/);assert.match(event.consequence,/caught 0/);assert.match(event.narrative,/infection still needs attention/);
  state.specialLife=null;state.actionResult={success:true,encounterGame:{kind:'combat',escaped:true,kills:1,damageTaken:8,ammoUsed:2}};
  const battle=localizeEvent(base,state,{label:'我已经离开交战地点',custom:true});
  assert.match(battle.narrative,/leave the place of the fighting/);assert.match(battle.consequence,/wounds still need care/);assert.doesNotMatch(battle.narrative,/war is won/i);
});

test('Water Margin mode intentionally permits classical diction without weakening current age validation',()=>{
  const prose=response('话说你如今24岁，当下安排手中的事情，并且召集相识之人商量后续。');
  assert.ok(proseIssues(prose,{language:'zh-CN',ageYears:24}).some(issue=>/并且/.test(issue)));
  assert.equal(proseIssues(prose,{language:'shuihu',ageYears:24}).length,0);
  assert.ok(proseIssues({...prose,narrative:prose.narrative.replace('24岁','15岁')},{language:'shuihu',ageYears:24}).some(issue=>/年龄/.test(issue)));
  assert.match(languageInstruction('shuihu'),/覆盖默认现代书面语与禁古文要求/);
});

test('foreign-language age checks catch stale ages without rejecting valid native prose or old action age',()=>{
  for(const [language,correct,incorrect,oldAction]of [
    ['en','You are now 24 years old. You continue the work left by the previous conversation and arrange a follow-up meeting.','You are now 15 years old. You return to the same workshop and keep working on the unfinished task.','You were working on the project. You are 23 years old.'],
    ['ja','あなたは今24歳で、前回の相談から残った仕事を進めています。相手に確認した内容を記録し、次の打ち合わせを整えます。','あなたは今15歳で、前回から続く仕事を進めています。相手との相談を続けるために記録をまとめます。','あなたは23歳で、その月の仕事を終えて次の約束を確認しました。'],
    ['ko','당신은 현재 24세이며 지난 대화에서 남긴 일을 이어갑니다. 받은 답변을 확인하고 다음에 만날 시간을 정리합니다.','당신은 현재 15세이며 지난 작업에서 남은 일을 살핍니다. 연락할 사람들을 확인하고 다음 일정을 정합니다.','당신은 23세이며 그달에 시작한 일을 마치고 다음 약속을 확인했습니다.']
  ]){
    assert.equal(proseIssues(response(correct),{language,ageYears:24,priorAgeYears:23}).length,0,language);
    assert.ok(proseIssues(response(incorrect),{language,ageYears:24,priorAgeYears:23}).some(issue=>/年龄/.test(issue)),language);
    assert.equal(proseIssues(response(correct,{consequence:oldAction}),{language,ageYears:24,priorAgeYears:23}).length,0,language);
  }
});

test('language validation rejects Chinese-only foreign output and keeps calendar, income and injury facts',()=>{
  for(const language of ['en','ja','ko'])assert.ok(proseIssues(response('你继续整理上次留下的工作，向已经联系过的人确认下一步安排。'),{language}).length);
  assert.ok(proseIssues(response('In January 2021, you continue the work at your desk and organize the unfinished papers.'),{language:'en',month:1}).some(issue=>/年月/.test(issue)));
  assert.ok(proseIssues(response('2021년 1월, 당신은 앞서 맡은 일을 이어가며 남은 자료를 정리하고 다음 일정을 확인합니다.'),{language:'ko',month:1}).some(issue=>/年月/.test(issue)));
  assert.ok(proseIssues(response('You are still unemployed. You spend the day reviewing the old documents and contacting people you know.'),{language:'en',continuation:{income:6000}}).some(issue=>/工资/.test(issue)));
  assert.ok(proseIssues(response('You remain uninjured. You collect your equipment from the encounter and walk toward the nearby shelter.'),{language:'en',continuation:{encounter:{damageTaken:8}}}).some(issue=>/伤势/.test(issue)));
});

test('untranslated Chinese news cannot be marked as a foreign translation; empty translations remain allowed',()=>{
  const english=response('You return to the work already arranged, check the materials at hand and confirm the next meeting with your colleagues.');
  assert.equal(proseIssues({...english,newsTranslations:[]},{language:'en'}).length,0);
  assert.ok(proseIssues({...english,newsTranslations:[{id:'test',title:'公布新规定',description:'当地已经公布新的规定，居民正在了解办事安排。'}]},{language:'en'}).some(issue=>/newsTranslations/.test(issue)));
  assert.ok(proseIssues({...english,newsTranslations:[{id:'test',title:'公布新规定',description:'The local authority published new rules, and residents are checking the arrangements.'}]},{language:'en'}).some(issue=>/newsTranslations/.test(issue)));
  assert.equal(proseIssues({...english,newsTranslations:[{id:'test',title:'New local rules published',description:'The local authority published new rules, and residents are checking the arrangements.'}]},{language:'en'}).length,0);
});

test('all providers share language, explicit identity, relationship evidence and news translation contracts',()=>{
  for(const language of LANGUAGE_OPTIONS.map(option=>option.id)){
    const state=game(language,{identity:{sex:'custom',sexLabel:'自定身体',ethnicity:'银河龙族',nationality:'后土联邦'}}),prompt=buildPrompt(state,{passive:true,label:'照常生活'},lore),payload=JSON.parse(prompt.user);
    assert.equal(payload.language,language);assert.equal(payload.profile.language,language);assert.equal(prompt.validationContext.language,language);
    assert.equal(payload.identity.ethnicity,'银河龙族');assert.equal(payload.identity.nationality,'后土联邦');
    assert.ok(payload.relationshipGraph);assert.ok(payload.news.every(news=>typeof news.id==='string'));
    assert.match(prompt.system,/出生地、现居地和国籍是独立概念/);assert.match(prompt.system,/relationshipUpdates/);assert.match(prompt.system,/newsTranslations/);
    if(language==='en')assert.doesNotMatch(prompt.system,/使用现代汉语日常书面语/);
  }
  assert.ok(responseSchema.properties.relationshipUpdates);assert.ok(responseSchema.properties.newsTranslations);assert.ok(responseSchema.properties.options.items.properties.originalLabel);
});

class Element{
  constructor(tag,text,attributes={}){this.tagName=tag;this.nodeType=1;this.attributes={...attributes};this.childNodes=[];if(text!==undefined)this.appendText(text);}
  appendText(text){const node={nodeType:3,nodeValue:text,parentElement:this};this.childNodes.push(node);return node;}
  append(child){child.parentElement=this;this.childNodes.push(child);return child;}
  hasAttribute(key){return Object.hasOwn(this.attributes,key);}
  getAttribute(key){return this.attributes[key];}
  setAttribute(key,value){this.attributes[key]=value;}
  closest(){return this.hasAttribute('data-no-translate')?this:this.parentElement?.closest()||null;}
  get textContent(){return this.childNodes.map(node=>node.nodeValue??node.textContent).join('');}
  get value(){return this.attributes.value??this.textContent;}
}
test('live interface switching is reversible and does not translate names, text entry or option values',()=>{
  const root=new Element('DIV'),button=root.append(new Element('BUTTON','人物关系')),person=root.append(new Element('SPAN','日本',{'data-no-translate':''})),option=root.append(new Element('OPTION','日本')),input=root.append(new Element('INPUT',undefined,{value:'林远',placeholder:'写下自己的性别'})),textarea=root.append(new Element('TEXTAREA','我的名字是林远',{placeholder:'例如：我打算去上海寻找工程师的工作，晚上继续自学，周末给家里写信……','aria-label':'族裔描述'}));
  applyInterfaceLanguage(root,'en');assert.equal(button.textContent,'Relationships');assert.equal(option.textContent,'Japan');assert.equal(option.value,'日本');assert.equal(person.textContent,'日本');assert.equal(input.value,'林远');assert.equal(input.getAttribute('placeholder'),'Write your gender');assert.equal(textarea.textContent,'我的名字是林远');
  applyInterfaceLanguage(root,'ja');assert.equal(button.textContent,'人間関係');assert.equal(input.value,'林远');assert.equal(option.value,'日本');
  assert.equal(textarea.getAttribute('aria-label'),'民族・種族の説明');assert.match(textarea.getAttribute('placeholder'),/^例：上海/);assert.equal(textarea.textContent,'我的名字是林远');
  applyInterfaceLanguage(root,'zh-CN');assert.equal(button.textContent,'人物关系');assert.equal(input.getAttribute('placeholder'),'写下自己的性别');
});

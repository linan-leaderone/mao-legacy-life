import {mountWorldMap} from './world-map.js';
import {storyParagraphs} from './story-flow.js';
import './style.css';
import './encounter-games.css';
import './battle-view.css';
import './relationship-view.css';
import './identity-form.css';
import lore from './data/lore.json';
import {PLACES,STAT_NAMES,dateLabel,ageLabel,currentAge,createGame,nextContext,localEvent,advance,exportSave,importSave,worldHistory,actionEncounter} from './engine.js';
import {generateMonth,listModels} from './api.js';
import {normalizeSettings,activeConnection,PROVIDERS,PROTOCOLS,DEFAULT_MODELS,normalizeBaseUrl,resetProviderConnection,GEMINI_RELAY_URL} from './api-settings.js';
import {findPersona,lockPersonaProfile,personaAge,getPoliticalActors} from './personas.js';
import {backgroundsFor,regionContext} from './regions.js';
import {initializeIOSInstall,renderInstallCard,bindInstallCard} from './ios-install.js';
import {exportJSONFile} from './file-export.js';
import {isOceanFish,wantsFishGame,openFishGame} from './fish-game.js';
import {openEncounterGame} from './encounter-games.js';
import {getPortrait,loadPortraitOverrides,setCustomPortrait,clearCustomPortrait} from './portraits.js';
import './minigame-avatar.css';
import {openRelationshipMap} from './relationship-view.js';
import {SEX_OPTIONS,NATIONALITY_OPTIONS,characterIdentityFromForm,identityRows} from './character-identity.js';
import {LANGUAGE_OPTIONS,normalizeLanguage,translateUI,applyInterfaceLanguage,convertChinese,protectedIdentityValues} from './language.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='mao-life-save-v1',SETTINGS='mao-life-settings-v1',SLOTS='mao-life-slots-v1';
const LANGUAGE_KEY='mao-life-language-v1';
const apiDefaults=typeof __DEFAULT_API_PROVIDERS__==='object'?__DEFAULT_API_PROVIDERS__:{};
const pointNames={intelligence:'智力',family:'家境',fitness:'体力',appearance:'颜值'};
let game=null,view='home',savedSettings={};
let busy=false,error='',pending=null,controller=null,toastTimer,draftAction='';
try{savedSettings=JSON.parse(localStorage.getItem(SETTINGS)||'{}');}catch{}
let settings=normalizeSettings(savedSettings,apiDefaults);
try{localStorage.setItem(SETTINGS,JSON.stringify(settings));}catch{}
try{const raw=localStorage.getItem(KEY);if(raw)game=importSave(raw,lore);}catch{error='本地档案暂时无法读取，请从保存的文件或备份恢复。';}
let language=normalizeLanguage(game?.profile?.language);
try{language=normalizeLanguage(localStorage.getItem(LANGUAGE_KEY)||language);}catch{}
let startupLanguage=language;
const tr=text=>translateUI(text,language);
function languagePanel(){return `<section class="language-setting"><div><label for="life-language">语言与文风</label><p>仅用于新的人生。开始后保持所选语言与文风，读取档案沿用其中的记录。</p></div><select id="life-language" data-no-translate>${LANGUAGE_OPTIONS.map(option=>`<option value="${esc(option.id)}" ${startupLanguage===option.id?'selected':''}>${esc(option.label)}</option>`).join('')}</select></section>`;}
function bindLanguagePanel(root=document){const select=root.querySelector('#life-language');if(!select)return;select.onchange=()=>{if(busy)return;const api=root.querySelector('.api-panel');if(api?.commitApi&&!api.commitApi()){select.value=startupLanguage;return;}startupLanguage=normalizeLanguage(select.value);language=startupLanguage;try{localStorage.setItem(LANGUAGE_KEY,startupLanguage);}catch{}render();};}
function identityFields(){return `<fieldset class="identity-fields"><legend>身份与归属</legend><div class="form-grid"><div><label class="field">性别<select name="sex">${SEX_OPTIONS.map(option=>`<option value="${option.id}">${option.label}</option>`).join('')}</select></label><label class="field identity-custom-label" data-sex-custom hidden>自行填写性别<input name="sexLabel" maxlength="80" placeholder="写下自己的性别"/></label><label class="identity-description-toggle"><input type="checkbox" data-identity-description="sexDescription"/>添加性别描述</label><textarea name="sexDescription" aria-label="性别描述" maxlength="1000" hidden placeholder="补充身体特征或你希望采用的设定"></textarea></div><div><label class="field">族裔<input name="ethnicity" maxlength="100" placeholder="自由填写，也可以是非人类族裔"/></label><label class="identity-description-toggle"><input type="checkbox" data-identity-description="ethnicityDescription"/>添加族裔描述</label><textarea name="ethnicityDescription" aria-label="族裔描述" maxlength="1000" hidden placeholder="文化、来历、身体特点与生活习惯"></textarea></div><div><label class="field">国籍 / 所属势力<input name="nationality" list="nationality-list" maxlength="100" placeholder="选择或填写国家、组织及其他势力"/><datalist id="nationality-list">${NATIONALITY_OPTIONS.map(name=>`<option value="${esc(name)}"></option>`).join('')}</datalist></label><label class="identity-description-toggle"><input type="checkbox" data-identity-description="nationalityDescription"/>添加势力描述</label><textarea name="nationalityDescription" aria-label="势力描述" maxlength="1000" hidden placeholder="制度、所在地、公民身份和你与它的关系"></textarea></div></div><p class="identity-caption">这些身份由你填写。出生地与国籍分别记录，描述可以留空。</p></fieldset>`;}
function bindIdentityFields(form){const field=name=>form.elements.namedItem(name);field('sex').onchange=()=>{form.querySelector('[data-sex-custom]').hidden=field('sex').value!=='custom';field('sexLabel').required=field('sex').value==='custom';};form.querySelectorAll('[data-identity-description]').forEach(toggle=>{toggle.onchange=()=>{field(toggle.dataset.identityDescription).hidden=!toggle.checked;};});}
function identityBlock(){return `<dl class="identity-details" data-no-translate>${identityRows(game.profile.identity).map(row=>`<div><dt>${esc(tr(row.label))}</dt><dd>${esc(row.value||tr('暂不填写'))}${row.description?`<p>${esc(row.description)}</p>`:''}</dd></div>`).join('')}</dl>`;}

function notify(message){
  let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.append(t);}
  t.textContent=tr(message);clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.remove(),4200);
}
function persist(){try{localStorage.setItem(KEY,exportSave(game));}catch{notify('自动保存失败，请导出档案以保留这一段经历。');}}
function paragraphs(text){return String(text||'').split(/\n+/).filter(Boolean).map(p=>`<p>${esc(p)}</p>`).join('');}
function continuousStory(event){return paragraphs(storyParagraphs(event,{opening:!game.history.length}));}
function physicalStatus(){
  const body=game.encounterState;if(!body)return '';
  const gear=body.equipment||[];
  return `<section class="physical-status ${body.infected?'is-infected':''}"><h3>身体与随身物品</h3><div><span>${body.infected?'感染尚未消退':body.immune?'具备丧尸病毒免疫能力':'近期没有需要持续处理的感染'}</span>${gear.some(x=>/枪/.test(x))?`<span>剩余弹药 ${body.ammo} 发</span>`:''}</div>${gear.length?`<p>${gear.map(esc).join(' · ')}</p>`:'<p>暂未携带专门的防护或战斗装备。</p>'}</section>`;
}
function portraitAvatar(value=game){
  const p=getPortrait(value);
  return `<div class="avatar ${p.src?'has-portrait':'portrait-blank'}">${p.src?`<img src="${esc(p.src)}" alt="${esc(p.name)}的肖像" style="${esc(p.style)}"/>`:'<span aria-label="肖像空缺">—</span>'}</div>`;
}
function portraitCard(value=game,{manage=true}={}){
  const p=getPortrait(value);
  return `<section class="portrait-card ${p.kind==='special'?'portrait-ocean':p.kind==='missing'?'portrait-missing':''}"><div class="portrait-frame">${p.src?`<img src="${esc(p.src)}" alt="${esc(p.name)}的立绘" style="${esc(p.style)}"/>`:'<div class="portrait-empty"><span>暂无肖像</span><small>这页留待日后补上</small></div>'}</div><div class="portrait-caption"><span>${esc(p.name)}</span>${manage?`<button class="quiet" data-portrait-manage ${busy?'disabled':''}>整理肖像</button>`:''}</div></section>`;
}
function openPortrait(){
  if(!game||busy)return;
  const p=getPortrait(game),sources={'photo-reference':'根据本人照片改绘','mod-reference':'根据模组人物素材改绘','user-reference':'根据提供的水滴鱼照片改绘','user-upload':'本机保存的图片','original-illustration':'原创人物插画','generated-pixel':'由这段人生保留的二次元像素肖像','pending-reference':'尚未找到可核实的本人照片，保留空缺'};
  const m=modal('人物肖像',`${portraitCard(game,{manage:false})}<p class="small-copy muted">${esc(sources[p.sourceStatus]||'暂无肖像')}。本机导入的图片仅存于此设备，不包含在人生档案导出文件中。</p>${p.kind==='original'?`<label class="field">形象风格<select id="portrait-presentation"><option value="neutral">中性</option><option value="male">男性</option><option value="female">女性</option></select></label>`:''}<label class="field">导入已经准备好的立绘<input id="portrait-file" type="file" accept="image/png,image/jpeg,image/webp"/></label><p class="small-copy muted">PNG、JPG 或 WebP，12 MB 以内。</p>${p.kind==='custom'?'<button id="portrait-reset" class="secondary">恢复原有肖像</button>':''}`);
  const select=$('#portrait-presentation');if(select){select.value=game.profile.portraitPresentation||'neutral';select.onchange=()=>{game.profile.portraitPresentation=select.value;persist();m.close();render();openPortrait();};}
  $('#portrait-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;e.target.disabled=true;try{await setCustomPortrait(game,file);m.close();render();notify('肖像已保存在本机。');}catch(err){notify(err.message);e.target.disabled=false;}};
  $('#portrait-reset')?.addEventListener('click',async()=>{try{await clearCustomPortrait(game);m.close();render();openPortrait();}catch(err){notify(err.message);}});
}
function backgroundName(state=game){return state?.profile.persona?.backgroundLabel||backgroundsFor(state?.profile.place).find(b=>b.id===state?.profile.background)?.name||'家庭经历';}
function artPath(art){return `./art/${/^[a-z0-9_-]+$/i.test(art||'')?art:'newsroom'}.webp`;}
function stamp(){return '<span class="stamp">2020<br><small>ARCHIVE</small></span>';}

function render(){
  language=view==='home'?startupLanguage:normalizeLanguage(game?.profile.language||startupLanguage);
  $('#app').innerHTML=`<div class="shell">
    <aside class="sidebar"><a class="brand" href="#" aria-label="人生档案首页"><span class="brand-mark">人</span><span>毛的遗产<small>THE LIFE ARCHIVE</small></span></a>
      <div class="edition">一个人，一段时代 <span>VOL. 2020</span></div>
      <nav aria-label="主导航"><button class="nav-item ${view==='home'?'active':''}" data-view="home"><span>⌂</span>首页</button><button class="nav-item ${view==='play'?'active':''}" data-view="play"><span>▤</span>人生档案</button><button class="nav-item ${view==='history'?'active':''}" data-view="history"><span>◷</span>人生编年史</button></nav>
      <div class="side-note"><span class="eyebrow">一段属于你的人生</span><p>记录每个月的生活，<br>也记住身边的人。</p><div class="side-rule"></div><small>时间按月过去，<br>生活仍在继续。</small></div>
      <div class="sidebar-bottom"><button class="nav-item" id="settings"><span>⚙</span>设置</button></div>
    </aside>
    <div class="main"><header class="topbar"><span class="breadcrumb">毛的遗产 <span>/</span> ${{home:'首页',play:'人生档案',history:'人生编年史'}[view]}</span>
      <div class="top-actions"><button id="save" class="quiet" ${!game||busy?'disabled':''}>保存</button><button id="load" class="quiet" ${busy?'disabled':''}>读取</button><button id="new" class="quiet" ${busy?'disabled':''}>＋ 新人生</button><button id="mobile-settings" class="mobile-only quiet" aria-label="打开设置">⚙</button></div>
    </header><main>${view==='history'?historyScreen():view==='play'&&game?playScreen():welcomeScreen()}</main>
    <footer>这里保存着你经历过的事情。<span>毛的遗产 · 人生档案</span></footer></div>
  </div>`;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(!busy){if(b.dataset.view==='play'){enterLife();return;}view=b.dataset.view;render();}});
  $('.brand').onclick=e=>{e.preventDefault();if(!busy){view='home';render();window.scrollTo(0,0);}};
  $('#settings').onclick=openSettings;$('#mobile-settings').onclick=openSettings;
  $('#new').onclick=()=>!busy&&openNew();$('#save').onclick=()=>openSaves('save');$('#load').onclick=()=>openSaves('load');
  $('#begin')?.addEventListener('click',openNew);$('#welcome-load')?.addEventListener('click',()=>openSaves('load'));
  $('#continue-life')?.addEventListener('click',enterLife);
  $('#self-status')?.addEventListener('click',openStatus);$('#world-status')?.addEventListener('click',openWorld);
  $('#relationship-status')?.addEventListener('click',()=>game&&!busy&&openRelationshipMap(game,{translate:tr}));
  document.querySelectorAll('[data-portrait-manage]').forEach(button=>button.onclick=openPortrait);
  document.querySelectorAll('[data-option]').forEach(b=>b.onclick=()=>takeAction(game.current.options[Number(b.dataset.option)]));
  $('#next-month')?.addEventListener('click',()=>takeAction({label:'照常生活',passive:true}));
  $('#fish-feed')?.addEventListener('click',()=>takeAction({label:'继续捕食小鱼，在太平洋里长大',custom:true}));
  $('#work-shift')?.addEventListener('click',()=>takeAction({label:`继续${game.employment?.kind||game.person?.occupation||'现有'}的工作，完成今天的安排`,custom:true}));
  $('#custom-action')?.addEventListener('input',e=>{draftAction=e.target.value;});
  $('#custom-form')?.addEventListener('submit',e=>{e.preventDefault();const text=$('#custom-action').value.trim();if(text)takeAction({label:text,custom:true});});
  $('#retry')?.addEventListener('click',()=>pending&&takeAction(pending));
  $('#offline-once')?.addEventListener('click',()=>pending&&takeAction(pending,true));
  $('#cancel')?.addEventListener('click',()=>controller?.abort());
  $('#pin-form')?.addEventListener('submit',e=>{e.preventDefault();const text=$('#pin-input').value.trim();if(text&&(game.pins||[]).length<30){game.pins.push(text);persist();render();}});
  document.querySelectorAll('[data-unpin]').forEach(b=>b.onclick=()=>{if(!busy){game.pins.splice(Number(b.dataset.unpin),1);persist();render();}});
  $('#history-search')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.history-entry').forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(q));});
  attachImageFallbacks();
  document.querySelectorAll('.api-panel').forEach(bindApiPanel);
  bindInstallCard();
  bindLanguagePanel();applyInterfaceLanguage($('#app'),language);document.documentElement.lang=LANGUAGE_OPTIONS.find(option=>option.id===language)?.locale||'zh-CN';
}

function welcomeScreen(){return `<section class="home-heading"><div><span class="eyebrow red">THE MAO LEGACY / 2020</span><h1>从 2020 年开始，过自己的人生。</h1><p>先选择连接方式，再开始或继续你的经历。</p></div></section>${renderInstallCard()}${languagePanel()}<div class="home-layout"><div>${apiPanel('home-api')}${error&&!game?`<p class="error">${esc(error)}</p>`:''}</div><aside class="home-start"><div class="home-cover"><img src="./art/cover.webp" alt="人生档案封面"/><div class="home-cover-caption"><span>毛的遗产</span><strong>一个人，一段时代。</strong></div>${stamp()}</div><div class="home-start-body">${game?`<span class="eyebrow">最近的记录</span><h2>${esc(game.profile.name)}</h2><p>${dateLabel(game.month)} · ${esc(game.location)}<br>${esc(ageLabel(game))}</p><button id="continue-life" class="primary large">继续人生 <span>→</span></button>`:'<h2>第一份记录，从一月开始。</h2><p>家庭、成长经历和个人愿望，会影响此后的生活。</p>'}<button class="${game?'secondary':'primary large'}" id="begin">${game?'建立新的人生档案':'开始新人生'} <span>↗</span></button><button id="welcome-load" class="quiet">读取已有档案</button></div></aside></div>`;}

function adultState(state=game){return currentAge(state).years>=18&&(!Number.isFinite(state.specialLife?.bodyAge)||state.specialLife.bodyAge>=18);}
function visibleStat(key,historyEntry=null){
  if(key!=='promiscuity')return true;
  if(!adultState())return false;
  if(!historyEntry)return true;
  const outcome=historyEntry.actionResult||{},changedAge=outcome.declarations?.ageMonths,bodyAge=outcome.specialTransition?.bodyAge;
  if(Number.isFinite(bodyAge)&&bodyAge<18)return false;
  return Number.isFinite(changedAge)?changedAge>=216:(outcome.actionAge?.years??0)>=18;
}
function statBlock(){return `<div class="stats-grid status-stats">${Object.entries(STAT_NAMES).filter(([k])=>visibleStat(k)).map(([k,n])=>{const value=Number(game.stats[k]||0);return `<div class="stat"><span>${esc(n)}</span><strong>${k==='funds'?'¥ '+value.toLocaleString():value}${k!=='funds'?'<small>/100</small>':''}</strong>${k!=='funds'?`<div class="meter"><i class="${k==='stress'?'stress':''}" style="width:${Math.max(0,Math.min(100,value))}%"></i></div>`:'<small class="fund-note">人民币等值</small>'}</div>`;}).join('')}</div><div class="ideology-status"><span>意识形态偏好</span><strong>${esc(game.person?.ideology||game.ideology||'尚未形成明确倾向')}</strong></div>`;}

function statChangesBlock(changes,{archive=false,historyEntry=null}={}){
  if(!Array.isArray(changes))return '';
  const rows=changes.filter(change=>change&&visibleStat(change.key,historyEntry)&&Number.isFinite(change.delta)&&change.delta&&Number.isFinite(change.before)&&Number.isFinite(change.after));
  if(!rows.length)return '';
  const amount=value=>Number(value).toLocaleString(),signed=value=>`${Number(value)>0?'+':''}${amount(value)}`;
  return `<section class="monthly-changes ${archive?'changes-archive':''}" aria-label="本月变化"><div class="section-label"><h3>这段时间的变化</h3></div><div class="change-list">${rows.map(change=>`<div class="change-item ${change.key==='funds'?'change-funds':''}"><div><span>${change.key==='funds'?'资金变化':esc(change.label||STAT_NAMES[change.key]||change.key)}</span><strong>${change.key==='funds'?'¥ ':''}${signed(change.delta)}</strong><small>${amount(change.before)} → ${amount(change.after)}</small></div>${Array.isArray(change.reasons)&&change.reasons.length?`<p>${change.reasons.map(esc).join('；')}</p>`:''}</div>`).join('')}</div></section>`;
}

function monthlyAccounts(entries){
  const rows=Array.isArray(entries)?entries.filter(entry=>entry&&Number.isFinite(entry.amount)):[];
  if(!rows.length)return '';
  const income=rows.reduce((sum,entry)=>sum+Math.max(0,entry.amount),0),expense=-rows.reduce((sum,entry)=>sum+Math.min(0,entry.amount),0),net=income-expense;
  return `<details class="monthly-accounts"><summary><span>本月收支</span><span>收入 <strong>¥ ${income.toLocaleString()}</strong></span><span>支出 <strong>¥ ${expense.toLocaleString()}</strong></span><span>结余 <strong>${net>0?'+':''}${net.toLocaleString()}</strong></span></summary><ul>${rows.map(entry=>`<li><span>${esc(entry.label||'日常收支')}</span><strong>${entry.amount>0?'+':''}${entry.amount.toLocaleString()}</strong></li>`).join('')}</ul><p>金额按人民币等值记账，现有资金同时包含其他事情带来的变化。</p></details>`;
}

function impactText(impact){
  if(typeof impact==='string')return impact;
  if(!impact||typeof impact!=='object')return '';
  if(typeof impact.description==='string')return impact.description;
  if(typeof impact.text==='string')return impact.text;
  const delta=impact.delta||impact;
  const phrases={funds:['生活开支随之增加。','手头渐渐宽裕了一些。'],health:['这些变故也拖累了身体。','健康状况得到了一些改善。'],stress:['心里的压力有所缓解。','你感到生活的压力正在增加。'],connections:['一些熟悉的联系变得疏远。','你与身边的人有了更多联系。'],influence:['你的声音暂时被淹没。','越来越多的人开始留意你的意见。']};
  return Object.entries(phrases).filter(([key])=>Number(delta[key])).slice(0,2).map(([key,pair])=>pair[Number(delta[key])>0?1:0]).join('');
}
function newsEffect(news){
  return impactText(news.impact)||String(news.exposure?.effectText||'')
    .replace('本地并未因此自动进入内战','本地仍按当地公布的安排生活')
    .replace('并不意味着当地执行相同措施','当地措施由本地机构公布');
}
function newsCards(news,{archive=false}={}){
  if(!news?.length)return '';
  return `<div class="news-grid ${archive?'news-archive':''}">${news.map(n=>`<details class="news-card"><summary><div class="news-image"><img loading="lazy" src="${artPath(n.art)}" alt="${esc(n.title)}"/></div><div class="news-summary"><span class="news-date">${dateLabel(n.month??game.month)}</span><h3>${esc(n.title)}</h3><span class="news-read">读报 <span>↗</span></span></div></summary><div class="news-body">${paragraphs(n.description||n.narrative)}${n.originalDescription?`<details class="local-original"><summary>${esc(tr('原文记录'))}</summary><h4>${esc(n.originalTitle||'')}</h4>${paragraphs(n.originalDescription)}</details>`:''}${newsEffect(n)?`<p class="news-impact">${esc(newsEffect(n))}</p>`:''}</div></details>`).join('')}</div>`;
}
function attachImageFallbacks(){document.querySelectorAll('.news-image img').forEach(img=>img.onerror=()=>{img.onerror=null;img.src='./art/newsroom.webp';});}

function playScreen(){
  const c=game.current,options=c.options||[],pins=game.pins||[];
  return `<div class="page-heading"><div><div class="eyebrow">PERSONAL FILE / ${String((game.turn??game.history.length)+1).padStart(4,'0')}</div><h1 data-no-translate>${esc(game.profile.name)}${esc(tr('的生活'))}<span class="heading-period">.</span></h1><p>${esc(game.location)} · ${esc(ageLabel(game))}</p></div><div class="date-badge"><span>${2020+Math.floor(game.month/12)}</span><strong>${String(((game.month%12)+12)%12+1).padStart(2,'0')}<small>月</small></strong></div></div>
    <section class="identity">${portraitAvatar()}<div><h2>${esc(game.profile.name)}</h2><p>${esc(game.person?.occupation||game.profile.persona?.occupation||backgroundName())}</p></div><div class="identity-actions"><button id="self-status" class="secondary">自身状况</button><button id="world-status" class="secondary">世界局势</button><button id="relationship-status" class="secondary">人物关系</button></div></section>
    ${(c.news||[]).length?`<section class="monthly-news" aria-label="本月消息"><div class="section-label"><h3><span class="red-square"></span> 本月消息</h3><span>来自身边与远方</span></div>${newsCards(c.news)}</section>`:''}
    ${monthlyAccounts(game.monthlyLedger)}${statChangesBlock(game.statChanges||c.statChanges)}
    <div class="play-layout"><section class="event-column"><article class="event-card"><div class="event-meta"><span><b class="red-square"></b>本月纪事</span><small>${dateLabel(game.month)}</small></div><div class="event-body" data-no-translate><h2>${esc(c.title)}</h2><div class="story story-continuous">${continuousStory(c)}</div>${c.localOriginal?`<details class="local-original"><summary>${esc(tr('原文记录'))}</summary>${paragraphs(c.localOriginal.consequence)}${paragraphs(c.localOriginal.narrative)}</details>`:''}</div><div class="event-end"><span>—— ${dateLabel(game.month)} · ${esc(game.location)}</span><span>✦</span></div></article>
    ${game.ended?`<div class="ending"><h2>这一生的经历已经保存。</h2><p>你可以查看过去各个月份的记录。</p></div>`:`<section class="choices">${options.length?`<div class="section-label"><h3>眼前的选择</h3></div>${options.map((o,i)=>`<button class="choice" data-no-translate data-option="${i}" ${busy?'disabled':''}><span class="choice-letter">${String.fromCharCode(65+i)}</span><span><strong>${esc(o.label)}</strong><small>${esc(o.description)}</small></span><span class="choice-arrow">↗</span></button>`).join('')}`:''}
      ${isOceanFish(game)?`<button id="fish-feed" class="fish-entry secondary" ${busy?'disabled':''}><span>≈</span><span>继续捕食小鱼<small>游向鱼群，把这次收获带到下个月。</small></span><span>↗</span></button>`:''}
      ${!isOceanFish(game)&&game.employment?.monthlyIncome>0?`<button id="work-shift" class="secondary work-entry" ${busy?'disabled':''}>继续${esc(game.employment.kind)}的工作 <span>→</span></button>`:''}
      <div class="continue-row"><span>${options.length?'也可以照常过日子。':'日子一天天过去，生活继续。'}</span><button id="next-month" class="primary" ${busy?'disabled':''}>下个月 <span>→</span></button></div>
      <form id="custom-form" class="custom-choice"><label for="custom-action"><span>✎</span>写下这个月的安排</label><textarea id="custom-action" maxlength="2000" placeholder="例如：我打算去上海寻找工程师的工作，晚上继续自学，周末给家里写信……" ${busy?'disabled':''}>${esc(draftAction||pending?.custom&&pending.label||'')}</textarea><div><small>要去哪里，要见谁，要做些什么。</small><button class="primary" ${busy?'disabled':''}>就这样安排 <span>→</span></button></div></form>
      ${busy?`<div class="loading" role="status"><span class="spinner"></span> ${settings.mode!=='offline'&&activeConnection(settings).baseUrl===GEMINI_RELAY_URL?'正在写下这段经历。可以随时暂缓。':'请稍候……'} <button class="quiet" id="cancel">暂缓</button></div>`:''}
      ${error?`<div class="error" role="alert"><p>${esc(error)}</p><button id="retry" class="secondary">重试</button> <button id="offline-once" class="quiet">暂不联网，继续</button></div>`:''}
    </section>`}</section><aside class="right-column">${portraitCard()}<section class="notebook"><div class="eyebrow">人生的方向</div><h3>写给未来的自己</h3><p>${esc(game.profile.goal)}</p><div class="notebook-rule"></div><span class="tiny-label">来时的路</span><p class="small-copy">${esc(game.profile.backgroundText)}</p></section><section class="memory-card"><h3>不想被遗忘的事 <small>${pins.length}/30</small></h3><p class="muted small-copy">珍重的人，许下的诺言，心里的牵挂。</p>${pins.map((p,i)=>`<div class="pin"><span>${esc(p)}</span><button data-unpin="${i}" ${busy?'disabled':''} aria-label="移除这条记忆">×</button></div>`).join('')}<form id="pin-form"><textarea id="pin-input" maxlength="800" placeholder="例如：我的妹妹在东京读书。" ${busy?'disabled':''}></textarea><button class="secondary" ${busy||pins.length>=30?'disabled':''}>＋ 记住这件事</button></form></section></aside></div>`;
}

function historyScreen(){return `<div class="page-heading"><div><div class="eyebrow">CHRONICLE / YOUR STORY</div><h1>人生编年史<span class="heading-period">.</span></h1><p>按月份查看过去的经历与安排。</p></div></div>${!game||!game.history.length?'<div class="empty-state"><span>◷</span><h2>故事才刚刚开始</h2><p>进入下个月后，你可以在这里查看已经完成的记录。</p></div>':`<input id="history-search" class="search-input" placeholder="查找人物、往事或曾经作出的选择……" aria-label="搜索人生记录"/><div class="timeline">${[...game.history].reverse().map(h=>`<article class="history-entry"><div class="timeline-date">${dateLabel(h.month)}${Number.isInteger(h.targetMonth)&&h.targetMonth!==h.month+1?`<span class="history-time-jump">→ ${dateLabel(h.targetMonth)}</span>`:''}</div><div class="history-content"><h2>${esc(h.event.title)}</h2><p class="history-action">↗ ${esc(h.action.displayLabel||h.action.label)}</p><details><summary>重读这个月</summary><div class="story">${paragraphs(h.event.narrative)}</div>${h.consequence?`<p class="small-copy">${esc(h.consequence)}</p>`:''}${newsCards(h.event.news,{archive:true})}${statChangesBlock(h.statChanges,{archive:true,historyEntry:h})}<div class="delta-row">${Object.entries(h.delta||{}).filter(([k,v])=>STAT_NAMES[k]&&visibleStat(k,h)&&v&&!h.statChanges?.length).map(([k,v])=>`<span>${STAT_NAMES[k]} ${v>0?'+':''}${v}</span>`).join('')}</div></details></div></article>`).join('')}</div>`}`;}

function modal(title,body,wide=false){
  $('#modal')?.remove();const el=document.createElement('dialog');el.id='modal';el.className=wide?'wide':'';
  el.innerHTML=`<div class="modal-header"><h2>${esc(title)}</h2><button id="close-modal" aria-label="关闭">×</button></div>${body}`;document.body.append(el);
  $('#close-modal').onclick=()=>el.close();el.addEventListener('close',()=>el.remove());el.showModal();attachImageFallbacks();applyInterfaceLanguage(el,language);return el;
}
function openStatus(){
  if(!game)return;
  const person=game.person||{},entryText=value=>typeof value==='string'?value:value?.description||value?.name||value?.title||'';
  const ongoing=[['skills','已经学会的事'],['projects','正在做的事'],['relationships','身边的人'],['facts','留下的经历']].map(([key,label])=>person[key]?.length?`<h3>${label}</h3><ul class="person-records">${person[key].map(value=>`<li>${esc(entryText(value))}</li>`).join('')}</ul>`:'').join('');
  const statusModal=modal('自身状况',`<div class="status-identity">${portraitAvatar()}<div><h3>${esc(game.profile.name)}</h3><p>${esc(game.location)} · ${esc(ageLabel(game))} · ${esc(backgroundName())}</p></div></div><div class="current-identity"><span class="tiny-label">当前身份</span><h3>${esc(person.occupation||game.profile.persona?.occupation||'尚未登记职业')}</h3>${person.status||game.profile.persona?.status?`<p>${esc(person.status||game.profile.persona.status)}</p>`:''}</div>${portraitCard()}${identityBlock()}${statBlock()}${physicalStatus()}<div class="status-background">${ongoing}<h3>身份与经历</h3><p>${esc(game.profile.backgroundText)}</p><h3>心中的愿望</h3><p>${esc(game.profile.goal)}</p></div>`,true);
  statusModal.querySelectorAll('[data-portrait-manage]').forEach(button=>button.onclick=openPortrait);
}
// Region context also carries model-only guidance; display only descriptive clauses.
function regionalProse(value){
  const text=String(value||'').replace(/；/g,'。');
  const clauses=text.split(/。/).map(sentence=>sentence.split(/[，,]/).filter(clause=>!/(?:不可(?:凭空|套用)|不能(?:凭空|直接套用|预写)|不要(?:把|将)|不默认|不预设|不套用|不直接套用|按照已知地方公告|现实后续|具体措施取决于|^不把2020)/.test(clause)).join('，').trim()).filter(Boolean);
  return convertChinese(clauses.length?clauses.join('。')+'。':'',language,protectedIdentityValues(game));
}
function localWorldCard(context){
  const conflicts=[...new Set([context.conflict,context.regionalConflict].filter(Boolean))];
  const rows=[
    ['所在地区',context.province||context.place||game.location],
    ['政府与制度',context.government||'当地政府的具体安排尚未公布。'],
    ['当前领导',context.leader||'尚无统一的领导机构。'],
    ['政治主张',context.ideology||''],
    ['疫情与卫生',regionalProse(context.pandemic)||'近期没有新的本地卫生公告。'],
    ['战争与冲突',conflicts.length?conflicts.join('；'):'近期没有本地战事的报道。'],
    ['日常生活',regionalProse(context.dailyContext)]
  ];
  return `<section class="local-world"><div class="local-world-heading"><div><span class="eyebrow">所在地现状</span><h3>${esc(game.location)}</h3></div><span>${dateLabel(game.month)}</span></div><dl>${rows.filter(([,text])=>text).map(([label,text])=>`<div><dt>${label}</dt><dd>${esc(label==='政府与制度'?regionalProse(text):text)}</dd></div>`).join('')}</dl>${context.institutions?.length?`<div class="local-institutions"><span>当地机构</span>${context.institutions.map(name=>`<span>${esc(name)}</span>`).join('')}</div>`:''}</section>`;
}
function publicWorldActivity(labels,regions){
  if(game.month<0)return '';
  const actors=getPoliticalActors(game).filter(actor=>actor.autonomyEligible!==false),activity=(game.npcActivity||[]).filter(entry=>Number.isInteger(entry.month)&&entry.month<=game.month).slice(-8).reverse();
  const trends=Object.entries(labels).filter(([key])=>Number(game.npcPressure?.[key]));
  const trendText=value=>Math.abs(value)<4?(value>0?'有关主张开始得到回应':'有关主张正受到质疑'):Math.abs(value)<15?(value>0?'支持这些安排的联系逐渐增加':'有关安排遇到更多阻力'):(value>0?'多个团体正在组织人员推动相关安排':'多个团体正在组织人员反对相关安排');
  return `${trends.length||activity.length?`<section class="public-activity"><h3 class="world-history-title">各方正在推动的变化</h3>${trends.length?`<div class="world-trends">${trends.map(([key,label])=>`<div><span>${esc(label)}</span><strong>${trendText(Number(game.npcPressure[key]))}</strong></div>`).join('')}</div>`:''}${activity.length?`<ul class="public-activity-list">${activity.map(entry=>`<li><div><strong>${esc(entry.actor)}</strong><time>${dateLabel(entry.month)}</time></div><p>${esc(entry.ideology||'公开政治活动')} · 围绕${esc(labels[entry.pressure]||'公共事务')}开展联系。</p></li>`).join('')}</ul>`:''}</section>`:''}${actors.length?`<h3 class="world-history-title">公开活动的人物</h3><div class="political-people">${actors.map(actor=>`<details><summary>${portraitAvatar({name:actor.name,lockedPersonaId:actor.id||actor.name})}<span><strong>${esc(actor.name)}</strong><small>${esc(regions[actor.region]||actor.region)} · ${esc(actor.role||'参与公共事务')}</small></span><span>＋</span></summary><div class="political-person-body"><p><span>政治主张</span>${esc(actor.ideology||'尚无明确的公开主张')}</p>${actor.priorities?.length?`<p><span>关注的事情</span>${actor.priorities.map(esc).join('；')}</p>`:''}${actor.relationships?.length?`<ul>${actor.relationships.map(relation=>`<li>${typeof relation==='string'?esc(relation):`${esc(relation.name||'相关人物')}：${esc(relation.detail||relation.type||'保持联系')}`}</li>`).join('')}</ul>`:''}</div></details>`).join('')}</div>`:''}`;
}

function changedWorldArrangements(regions){
  const entries=Object.entries(game.worldOverrides||{}).filter(([,value])=>value&&typeof value==='object'&&(!Number.isInteger(value.month)||value.month<=game.month));
  if(!entries.length)return '';
  return `<h3 class="world-history-title">你参与建立的安排</h3><div class="world-arrangements">${entries.map(([key,value])=>`<article><div><h4>${esc(regions[key]||key)}</h4>${Number.isInteger(value.month)?`<time>${dateLabel(value.month)}</time>`:''}</div>${value.leader?`<p>当前领导：${esc(value.leader)}</p>`:''}${value.government?`<p>${esc(value.government)}</p>`:''}${value.ideology?`<p>政治主张：${esc(value.ideology)}</p>`:''}${Object.hasOwn(value,'conflict')?`<p>${value.conflict?esc(value.conflict):'当地停战与恢复日常生活的安排正在落实。'}</p>`:''}</article>`).join('')}</div>`;
}

function openWorld(){
  if(!game)return;const labels={reform:'社会变革',stability:'秩序与安定',economy:'经济生活',left:'劳动与分配',cooperation:'对外往来',tension:'紧张局势'};
  const description=(key,value)=>{if(Math.abs(value)<8)return '你的声音仍只在身边传开';if(key==='tension')return value>0?'你的主张促成了更强硬的态度':'你的调停正在获得回应';if(key==='economy')return value>0?'你的努力正在带动身边的生计':'你的行动加重了有关方面的经济压力';if(key==='cooperation')return value>0?'你促成的往来正在扩展':'你促成的往来正在收缩';if(key==='stability')return value>0?'你的秩序主张正得到支持':'你的主张正在动摇现有安排';if(key==='left')return value>0?'你推动的劳动与分配诉求受到关注':'你支持的反左翼主张正在传播';return value>0?'你推动的变革获得了更多回应':'你对变革的保留意见正在传播';};
  const events=worldHistory(game,lore);
  const context=regionContext(game,lore);
  const regions={china:'中国大陆',taiwan:'台湾',japan:'日本',hongkong:'香港',macau:'澳门',korea:'韩国',europe:'欧洲',global:'国际局势'};
  const contextPlaces={china:'中国大陆',taiwan:'中国台湾',japan:'日本',hongkong:'香港',macau:'澳门',korea:'韩国'};
  const dialog=modal('世界局势',`<div class="world-heading"><span class="eyebrow">${dateLabel(game.month)}</span><p>查看目前各地已知的消息与生活状况。</p></div><div id="world-map"></div>${localWorldCard(context)}<h3 class="world-history-title">各地近况</h3><div class="world-regions">${Object.entries(regions).map(([key,name])=>{const region=game.worldState?.[key],override=game.worldOverrides?.[key],current=contextPlaces[key]?regionContext({...game,location:contextPlaces[key]},lore):null,conflict=current?.conflict||current?.regionalConflict;return `<article><span class="tiny-label">${name}</span><h3>${esc(current?.leader||override?.leader||region?.title||'近来没有新的消息')}</h3>${current?.government||override?.government?`<p>${esc(regionalProse(current?.government||override.government))}</p>`:''}${current?.ideology||override?.ideology?`<p class="world-ideology">${esc(current?.ideology||override.ideology)}</p>`:''}${conflict?`<p>${esc(conflict)}</p>`:''}${region?.description&&!override?`<p>${esc(regionalProse(region.description))}</p>`:''}${region||override?`<small>${dateLabel(override?.month??region?.month??game.month)}</small>`:''}</article>`;}).join('')}</div>${changedWorldArrangements(regions)}<h3 class="world-history-title">你的行动带来的变化</h3><div class="world-trends">${Object.entries(labels).map(([key,label])=>`<div><span>${label}</span><strong>${description(key,Number(game.worldPressure?.[key]||0))}</strong></div>`).join('')}</div>${publicWorldActivity(labels,regions)}<h3 class="world-history-title">已经发生的事</h3>${events.length?newsCards([...events].reverse(),{archive:true}):'<p class="muted">暂时没有新的消息。</p>'}`,true);
  const host=dialog.querySelector?.('#world-map');if(host){const map=mountWorldMap(host,game,lore);dialog.addEventListener('close',()=>map.destroy(),{once:true});}
}

function openNew(){
  if(busy||!prepareConnection())return;
  const m=modal('建立一份新的人生档案',`<form id="new-form"><div class="form-intro">2020 年 1 月，从你的起点开始。${game?'现有档案会保留为上一份备份。':''}</div>
    <div class="form-grid"><label>姓名<input name="name" id="life-name" value="林远" maxlength="40" required autocomplete="off" spellcheck="false"/></label><label>2020 年的年龄<input name="age" type="number" min="0" max="90" value="18" required/></label><label>出生地<select name="place">${PLACES.map(p=>`<option ${p==='上海'?'selected':''}>${p}</option>`).join('')}</select></label><label>出身背景<select name="background">${backgroundsFor('上海').map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</select></label></div>
    <section id="persona-lock" class="persona-lock" hidden aria-live="polite"></section>${identityFields()}
    <fieldset class="point-allocation"><legend>最初的禀赋</legend><div class="point-heading"><span id="point-rule">共 20 点 · 每项 0 至 10</span><strong id="point-remaining" role="status">剩余 0 点</strong></div><div class="point-grid">${Object.entries(pointNames).map(([key,label])=>`<label class="point-row" for="point-${key}"><span>${label}</span><div class="point-stepper"><button type="button" data-point="${key}" data-step="-1" aria-label="减少${label}">−</button><input id="point-${key}" name="point-${key}" data-point-input="${key}" type="number" min="0" max="10" step="1" value="5" required aria-label="${label}点数"/><button type="button" data-point="${key}" data-step="1" aria-label="增加${label}">＋</button></div></label>`).join('')}</div><p id="point-note">影响力源于你的家庭、身份与日后的经历。</p></fieldset>
    <label class="field">你的经历与身份<textarea name="backgroundText" maxlength="3000" placeholder="家庭、职业、教育经历、性格，还有重要的人……"></textarea></label><label class="field">想过怎样的人生？<textarea name="goal" maxlength="1000" placeholder="例如：成为工程师，照顾家人，也尽力理解这个改变中的世界。"></textarea></label>
    <fieldset class="freedom-choices"><legend>选择你与世界的关系</legend><label><input type="radio" name="freedom" value="unlimited" checked/><span><strong>玩家完全不受限</strong><small>已经做成的事会成为事实，世界跟随你的描述变化。</small></span></label><label><input type="radio" name="freedom" value="influential"/><span><strong>玩家影响力偏大</strong><small>你的行动更容易改变局势，过程会考虑资源与身边的反应。</small></span></label><label><input type="radio" name="freedom" value="grounded"/><span><strong>玩家更受世界规则逻辑限制</strong><small>根据当时的条件与能力判断结果，经历会留下可延续的影响。</small></span></label></fieldset>
    <div class="modal-actions"><span>2020 年 1 月</span><button id="create-life" class="primary large">写下第一页 →</button></div></form>`,true);
  const form=$('#new-form');bindIdentityFields(form);let locked=null,ordinary=null;
  const field=name=>form.elements.namedItem(name);
  const setBackgrounds=(place,selected)=>{const choices=backgroundsFor(place);field('background').innerHTML=choices.map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('');if(choices.some(b=>b.id===selected))field('background').value=selected;applyInterfaceLanguage(form,language);};
  const updatePoints=()=>{
    if(locked){$('#point-remaining').textContent=tr('已固定');$('#point-remaining').classList.remove('over-budget');$('#create-life').disabled=false;return;}
    const fields=[...document.querySelectorAll('[data-point-input]')],total=fields.reduce((n,input)=>n+Number(input.value),0);
    const valid=fields.every(input=>input.value!==''&&Number.isInteger(Number(input.value))&&Number(input.value)>=0&&Number(input.value)<=10);
    $('#point-remaining').textContent=tr(valid?(20-total<0?`超出 ${total-20} 点`:`剩余 ${20-total} 点`):'请填入 0 至 10 的整数');
    $('#point-remaining').classList.toggle('over-budget',!valid||total>20);$('#create-life').disabled=!valid||total!==20;
  };
  document.querySelectorAll('[data-point-input]').forEach(input=>input.addEventListener('input',updatePoints));
  document.querySelectorAll('[data-step]').forEach(button=>button.onclick=()=>{const input=$(`#point-${button.dataset.point}`);input.value=Math.max(0,Math.min(10,Number(input.value||0)+Number(button.dataset.step)));updatePoints();});
  field('place').addEventListener('change',()=>{if(!locked)setBackgrounds(field('place').value,field('background').value);});
  const updatePersona=()=>{
    const persona=findPersona(field('name').value),notice=$('#persona-lock');
    if(persona){
      if(!locked)ordinary={age:field('age').value,place:field('place').value,background:field('background').value,backgroundText:field('backgroundText').value,points:Object.fromEntries(Object.keys(pointNames).map(key=>[key,$(`#point-${key}`).value]))};
      locked=persona;const age=personaAge(persona,0);field('age').value=age.years;
      field('place').innerHTML=`<option value="${esc(persona.place)}">${esc(persona.birthPlace)}</option>`;
      field('background').innerHTML=`<option value="${esc(persona.background)}">${esc(persona.backgroundLabel)}</option>`;
      for(const key of ['age','place','background'])field(key).disabled=true;
      field('backgroundText').value=persona.backgroundText;field('backgroundText').readOnly=true;
      for(const key of Object.keys(pointNames)){$(`#point-${key}`).value=persona.points[key];$(`#point-${key}`).disabled=true;}
      document.querySelectorAll('[data-step]').forEach(button=>button.disabled=true);
      const openingPreview=startupLanguage==='shuihu'&&['毛泽东','赖清德','薄熙来'].includes(persona.name)?createGame({name:persona.name,language:startupLanguage,seed:'opening-preview'},lore):null;
      if(openingPreview){field('age').value=currentAge(openingPreview).years;field('backgroundText').value=openingPreview.profile.backgroundText;}
      const ageText=openingPreview?ageLabel(openingPreview):persona.specialScenario?`距出生 ${age.years} 年`:persona.birthDatePrecision==='day'?`${age.years} 岁 ${age.months} 个月`:`约 ${age.years} 岁`;
      notice.hidden=false;notice.innerHTML=`${portraitCard(openingPreview||{name:persona.name,persona},{manage:false})}<span class="tiny-label">${esc(persona.name)}的旧档案</span><h3>${esc(openingPreview?.person.occupation||persona.occupation)}</h3><p>${esc(openingPreview?.person.status||persona.status)}</p><div class="persona-facts"><span>出生：${esc(persona.birthDate||'日期未核实')}</span><span>2020 年初：${ageText}</span><span>所在地：${esc(openingPreview?.location||persona.startLocation)}</span></div><p class="persona-lock-note">出生与既有经历已经写在这份档案中，往后的愿望由你填写。</p>${persona.notes.length?`<details><summary>资料说明</summary>${persona.notes.map(note=>`<p>${esc(note)}</p>`).join('')}<div class="persona-sources">${persona.sourceUrls.filter(url=>/^https:\/\//.test(url)).map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noreferrer">资料 ${i+1} ↗</a>`).join('')}</div></details>`:''}`;
      $('#point-rule').textContent='人物初始估值';$('#point-note').textContent=persona.statsBasis;
    }else if(locked){
      locked=null;for(const key of ['age','place','background'])field(key).disabled=false;field('backgroundText').readOnly=false;
      field('age').value=ordinary.age;field('place').innerHTML=PLACES.map(place=>`<option>${esc(place)}</option>`).join('');field('place').value=ordinary.place;
      setBackgrounds(ordinary.place,ordinary.background);field('backgroundText').value=ordinary.backgroundText;
      for(const key of Object.keys(pointNames)){$(`#point-${key}`).value=ordinary.points[key];$(`#point-${key}`).disabled=false;}
      document.querySelectorAll('[data-step]').forEach(button=>button.disabled=false);notice.hidden=true;notice.innerHTML='';
      $('#point-rule').textContent='共 20 点 · 每项 0 至 10';$('#point-note').textContent='影响力源于你的家庭、身份与日后的经历。';ordinary=null;
    }
    updatePoints();applyInterfaceLanguage(form,language);
  };
  $('#life-name').addEventListener('input',updatePersona);$('#life-name').addEventListener('change',updatePersona);
  form.onsubmit=e=>{
    e.preventDefault();let fields=Object.fromEntries(new FormData(e.target));fields.points=Object.fromEntries(Object.keys(pointNames).map(key=>[key,Number($(`#point-${key}`).value)]));fields.narrative=fields.freedom==='grounded'?'balanced':'player';fields=lockPersonaProfile(fields);
    try{form.querySelectorAll('[data-identity-description]').forEach(toggle=>{if(!toggle.checked)fields[toggle.dataset.identityDescription]='';});fields.identity=characterIdentityFromForm(fields);fields.language=startupLanguage;const fresh=createGame(fields,lore);const prior=localStorage.getItem(KEY);if(prior)localStorage.setItem(KEY+'-backup',prior);game=fresh;language=normalizeLanguage(game.profile.language);pending=null;draftAction='';error='';view='play';persist();m.close();render();window.scrollTo(0,0);}catch(err){notify(err.message);}
  };
}

function readSlots(){const value=JSON.parse(localStorage.getItem(SLOTS)||'[]');if(!Array.isArray(value))throw new Error('保存位置无法读取，请先导出当前档案。');return value.slice(0,3);}
function restoreGame(raw,dialog){const fresh=importSave(raw,lore);if(game)localStorage.setItem(KEY+'-backup',exportSave(game));game=fresh;language=normalizeLanguage(game.profile.language);try{localStorage.setItem(LANGUAGE_KEY,language);}catch{}persist();pending=null;draftAction='';error='';view='play';dialog?.close();render();window.scrollTo(0,0);notify('档案已读取。');}
function bindImport(dialog){
  $('#import-save').onclick=()=>$('#save-file').click();
  $('#save-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>15000000)throw new Error('档案不能超过 15 MB。');restoreGame(await file.text(),dialog);}catch(err){notify(err.message);}};
}
function openSaves(mode='save'){
  if(busy)return;let slots;
  try{slots=readSlots();}catch(err){notify(err.message);return;}
  const m=modal(mode==='save'?'保存人生档案':'读取人生档案',`<p class="small-copy muted">留住此刻，也可以翻回曾经的那一页。</p><div class="save-slots">${[0,1,2].map(i=>{const slot=slots[i];return `<section class="save-slot"><div class="slot-heading"><span>保存位置 ${i+1}</span><span>${slot?esc(dateLabel(slot.month)):'尚无档案'}</span></div><label class="slot-label"><span class="sr-only">保存位置 ${i+1} 的名称</span><input id="slot-name-${i}" maxlength="40" value="${esc(slot?.name||game&&`${game.profile.name} · ${dateLabel(game.month)}`||'')}" placeholder="为这一页写一个名字" ${!game?'disabled':''}/></label><p>${slot?`${esc(slot.person)} · ${esc(slot.place)}`:'留给值得记住的一天。'}</p><div class="slot-actions"><button class="secondary" data-save-slot="${i}" ${!game?'disabled':''}>${slot?'保存到这里':'保存'}</button><button class="${mode==='load'?'primary':'secondary'}" data-load-slot="${i}" ${!slot?'disabled':''}>读取</button></div></section>`;}).join('')}</div>
    <div class="auto-save"><div><strong>自动保存</strong><p>${game?`${esc(game.profile.name)} · ${dateLabel(game.month)}`:'尚无档案'}</p></div><button id="load-auto" class="secondary" ${!localStorage.getItem(KEY)?'disabled':''}>读取</button></div>
    <div class="settings-files"><button id="export-save" class="secondary" ${!game?'disabled':''}>↓ 导出文件</button> <button id="import-save" class="secondary">↑ 读取文件</button><input hidden type="file" accept=".json,application/json" id="save-file"/><button class="quiet" id="restore-backup">读取上一份备份</button></div>`,true);
  document.querySelectorAll('[data-save-slot]').forEach(button=>button.onclick=()=>{
    try{const index=Number(button.dataset.saveSlot),freshSlots=readSlots();const previous=freshSlots[index];if(previous)localStorage.setItem(SLOTS+'-backup',JSON.stringify(previous));freshSlots[index]={name:$(`#slot-name-${index}`).value.trim()||`${game.profile.name} · ${dateLabel(game.month)}`,person:game.profile.name,place:game.location,month:game.month,savedAt:new Date().toISOString(),save:exportSave(game)};localStorage.setItem(SLOTS,JSON.stringify(freshSlots));m.close();openSaves(mode);notify('已保存。');}catch(err){notify(err.message||'保存失败，请导出文件保留档案。');}
  });
  document.querySelectorAll('[data-load-slot]').forEach(button=>button.onclick=()=>{try{restoreGame(readSlots()[Number(button.dataset.loadSlot)].save,m);}catch(err){notify(err.message);}});
  $('#load-auto').onclick=()=>{try{restoreGame(localStorage.getItem(KEY),m);}catch(err){notify(err.message);}};
  $('#export-save').onclick=()=>saveText(`人生档案-${game.profile.name}-${game.month}.json`,exportSave(game));
  $('#restore-backup').onclick=()=>{try{const raw=localStorage.getItem(KEY+'-backup');if(!raw)throw new Error('还没有上一份备份。');restoreGame(raw,m);}catch(err){notify(err.message);}};
  bindImport(m);
}

function apiPanel(id){return `<section class="api-panel" id="${id}" data-provider="${esc(settings.provider)}">${apiPanelBody(id)}</section>`;}
function apiPanelBody(id){
  const connection=activeConnection(settings),custom=settings.provider==='custom',configurable=custom||settings.provider==='gemini',offline=settings.mode==='offline';
  return `<div class="api-panel-heading"><div><span class="eyebrow">API CONNECTION</span><h2>连接服务</h2></div><label class="offline-switch"><input type="checkbox" data-offline ${offline?'checked':''}/><span>不联网</span></label></div><p class="api-intro">配置会自动保存。每项服务分别保留自己的密钥与模型。</p>
    <fieldset class="provider-choices"><legend class="sr-only">选择 API 服务</legend>${PROVIDERS.map(provider=>`<label class="provider-choice ${settings.provider===provider.id?'selected':''}"><input type="radio" name="${id}-provider" data-provider-choice value="${esc(provider.id)}" ${settings.provider===provider.id?'checked':''}/><span class="provider-mark">${{deepseek:'D',gemini:'G',custom:'↗'}[provider.id]||'A'}</span><strong>${esc(provider.label)}</strong><small>${esc(provider.description)}</small><span class="provider-selected" aria-hidden="true">✓</span></label>`).join('')}</fieldset>
    <div class="api-fields"><label class="field">API Key<input type="password" data-api-key autocomplete="off" spellcheck="false" aria-label="${esc(PROVIDERS.find(p=>p.id===settings.provider)?.label||'API')} 密钥" placeholder="填写此服务的 API Key"/></label>
    ${configurable?`<div class="api-custom-grid"><label class="field">接口地址 Base URL<input data-api-url type="url" autocomplete="off" spellcheck="false" value="${esc(connection.baseUrl||'')}" placeholder="https://api.example.com/v1"/></label><label class="field">接口协议<select data-api-protocol>${PROTOCOLS.filter(protocol=>custom||protocol.id!=='anthropic').map(protocol=>`<option value="${esc(protocol.id)}" ${connection.protocol===protocol.id?'selected':''}>${esc(protocol.label)}</option>`).join('')}</select></label></div>`:''}
    <label class="field">模型<input data-api-model autocomplete="off" spellcheck="false" list="${id}-models" value="${esc(connection.model||'')}" placeholder="${esc(DEFAULT_MODELS[settings.provider]||'填写服务商提供的模型名称')}"/><datalist id="${id}-models" data-api-models>${DEFAULT_MODELS[settings.provider]?`<option value="${esc(DEFAULT_MODELS[settings.provider])}"/>`:''}</datalist></label></div>
    <div class="api-actions"><button type="button" class="secondary" data-test-api>测试连接</button><button type="button" class="quiet" data-clear-api>清除此密钥</button><button type="button" class="quiet" data-reset-api>使用默认连接</button><button type="button" class="quiet" data-import-api>导入配置</button><input type="file" data-api-file accept=".json,application/json" hidden/></div><p data-api-status class="api-status" role="status">${offline?'当前不联网，将使用本地内容。':'开始或继续时会使用上方选中的服务。'}</p><p class="api-key-note">密钥仅保存在本机配置中，人生档案不包含密钥。</p>`;
}
function redactApiError(error){let message=String(error?.message||'连接未能完成，请检查配置后重试。');for(const provider of Object.values(settings.providers||{})){if(provider.apiKey)message=message.split(provider.apiKey).join('[密钥已隐藏]');}return message;}
function writeApiSettings(next){settings=next;try{localStorage.setItem(SETTINGS,JSON.stringify(next));return true;}catch{notify('连接设置暂时无法保存，请检查设备存储空间。');return false;}}
function readApiPanel(panel){
  const provider=panel.dataset.provider,fields=settings.providers[provider];
  const next={...settings,provider,mode:panel.querySelector('[data-offline]').checked?'offline':'online',providers:{...settings.providers}};
  next.providers[provider]={...fields,apiKey:panel.querySelector('[data-api-key]').value.trim(),model:panel.querySelector('[data-api-model]').value.trim()};
  if(provider==='custom'||provider==='gemini'){next.providers[provider].baseUrl=panel.querySelector('[data-api-url]').value.trim();next.providers[provider].protocol=panel.querySelector('[data-api-protocol]').value;}
  return next;
}
function refreshApiPanel(panel){panel.dataset.provider=settings.provider;panel.innerHTML=apiPanelBody(panel.id);bindApiPanel(panel);applyInterfaceLanguage(panel,language);}
function bindApiPanel(panel){
  const query=selector=>panel.querySelector(selector),status=query('[data-api-status]');
  // Passwords are assigned as input properties, never HTML attributes or visible text.
  query('[data-api-key]').value=settings.providers[panel.dataset.provider].apiKey||'';
  let revision=0;
  const commit=(repair=true)=>{
    revision++;const draft=readApiPanel(panel),next=repair?normalizeSettings(draft,apiDefaults):draft,id=panel.dataset.provider;
    const repaired=['baseUrl','protocol','model'].some(key=>draft.providers[id][key]!==next.providers[id][key]);
    const ok=writeApiSettings(next);
    // Keep the form and the request on the same connection after a recognized legacy repair.
    for(const [selector,key] of [['[data-api-key]','apiKey'],['[data-api-url]','baseUrl'],['[data-api-protocol]','protocol'],['[data-api-model]','model']]){
      const input=query(selector);if(input&&input.value!==(next.providers[id][key]||''))input.value=next.providers[id][key]||'';
    }
    status.classList.remove('api-failure');status.textContent=tr(ok?(repaired?'已更新指定服务的地址、协议和模型，并保存。':settings.mode==='offline'?'已自动保存。当前不联网。':'已自动保存。下次请求使用当前配置。'):'设置仍在当前页面，尚未写入设备。');return ok;
  };
  panel.commitApi=commit;
  panel.querySelectorAll('[data-api-key],[data-api-model],[data-api-url]').forEach(input=>{input.oninput=()=>commit(false);input.onchange=()=>commit();});
  query('[data-api-protocol]')?.addEventListener('change',commit);query('[data-offline]').onchange=commit;
  panel.querySelectorAll('[data-provider-choice]').forEach(input=>input.onchange=()=>{if(busy)return;if(!commit())return;writeApiSettings({...settings,provider:input.value});refreshApiPanel(panel);});
  query('[data-clear-api]').onclick=()=>{query('[data-api-key]').value='';commit();};
  query('[data-reset-api]').onclick=()=>{if(busy)return;revision++;if(writeApiSettings(resetProviderConnection(settings,panel.dataset.provider,apiDefaults))){refreshApiPanel(panel);panel.querySelector('[data-api-status]').textContent='已使用默认地址、协议和模型。密钥以当前版本提供的默认值为准。';}};
  query('[data-test-api]').onclick=async()=>{
    if(busy||!commit())return;const snapshot=structuredClone(settings),requestRevision=revision,button=query('[data-test-api]');
    button.disabled=true;status.classList.remove('api-failure');status.textContent='正在测试当前配置……';
    try{
      validateConnection(snapshot,false);const models=await listModels(snapshot);
      if(revision!==requestRevision||!status.isConnected)return;
      query('[data-api-models]').innerHTML=(models||[]).map(model=>`<option value="${esc(typeof model==='string'?model:model.id||model.name)}"/>`).join('');
      status.textContent=models?.length?`连接成功，可选模型 ${models.length} 个，也可以手动填写模型。`:'连接成功，可以使用当前模型。';
    }catch(err){if(revision===requestRevision&&status.isConnected){status.textContent=redactApiError(err);status.classList.add('api-failure');}}
    finally{if(button.isConnected)button.disabled=false;}
  };
  query('[data-import-api]').onclick=()=>query('[data-api-file]').click();
  query('[data-api-file]').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;event.target.value='';
    try{
      if(file.size>20000)throw new Error('配置文件不能超过 20 KB。');let value;
      try{value=JSON.parse(await file.text());}catch{throw new Error('配置文件不是有效的 JSON，请检查文件内容。');}
      if(!value||typeof value!=='object'||(!value.providers&&typeof value.apiKey!=='string'))throw new Error('配置文件需要包含 apiKey 或 providers。');
      const imported=normalizeSettings(value,apiDefaults),providers={...settings.providers};
      for(const id of value.providers?Object.keys(value.providers):[imported.provider])if(imported.providers[id])providers[id]=imported.providers[id];
      if(!writeApiSettings({...settings,provider:imported.provider,mode:value.mode===undefined?settings.mode:imported.mode,providers}))return;
      refreshApiPanel(panel);panel.querySelector('[data-api-status]').textContent='配置已导入并保存。';
    }catch(err){status.textContent=redactApiError(err);status.classList.add('api-failure');}
  };
}
function validateConnection(configuration,requireModel=true){
  const connection=activeConnection(configuration);
  if(requireModel&&!connection.model?.trim())throw new Error('请填写模型名称。');
  if(configuration.provider==='custom'||configuration.provider==='gemini')normalizeBaseUrl(connection.baseUrl,connection.protocol);
  if(configuration.provider!=='custom'&&!connection.apiKey?.trim())throw new Error('请填写此服务的 API Key，或选择不联网。');
}
function prepareConnection(){
  const panel=$('#modal .api-panel')||$('#home-api');
  if(panel&&!panel.commitApi())return false;
  if(settings.mode==='offline')return true;
  try{validateConnection(settings);return true;}catch(err){const status=panel?.querySelector('[data-api-status]');if(status){status.textContent=redactApiError(err);status.classList.add('api-failure');status.scrollIntoView({block:'nearest'});}else notify(redactApiError(err));return false;}
}
function enterLife(){if(busy)return;if(!game){view='home';render();return;}if(!prepareConnection())return;language=normalizeLanguage(game.profile.language);view='play';render();window.scrollTo(0,0);}
function openSettings(){
  if(busy)return;
  const m=modal('连接设置',`${apiPanel('dialog-api')}<div class="api-modal-footer"><span>毛的遗产 · 人生档案 1.11.0</span><button class="primary" id="close-api-settings">完成</button></div>`,true);
  const panel=m.querySelector('.api-panel');bindApiPanel(panel);$('#close-api-settings').onclick=()=>{if(panel.commitApi())m.close();};
  m.addEventListener('close',()=>{panel.commitApi();if(view==='home')render();});
}

async function takeAction(action,offlineOnce=false){
  if(busy||!game||game.ended)return;
  if(!action.custom&&typeof action.originalLabel==='string'&&action.originalLabel.trim())action={...action,displayLabel:action.displayLabel||action.label,label:action.originalLabel};
  if(wantsFishGame(game,action)){
    busy=true;render();let harvest;
    try{harvest=await openFishGame({playerState:game});}catch{notify('这次觅食暂时无法打开，请稍后再试。');}finally{busy=false;}
    if(!harvest){render();return;}
    action={...action,meta:{...action.meta,fishGame:harvest}};
  }
  if(!action.meta?.encounterGame){
    let offer;try{offer=actionEncounter(game,action).offer;}catch(err){notify(err.message||'这份安排暂时无法确认。');return;}
    if(offer){
      busy=true;render();let encounter;
      try{encounter=await openEncounterGame(offer,{playerState:game});}catch{notify('这段经历暂时无法打开，请稍后再试。');}finally{busy=false;}
      if(!encounter){render();return;}
      action={...action,meta:{...action.meta,encounterGame:encounter}};
    }
  }
  busy=true;error='';pending=action;controller=new AbortController();render();
  try{
    const {state}=nextContext(game,lore,action);
    const result=settings.mode==='offline'||offlineOnce||state.stats.health===0?localEvent(state,lore,action,null):await generateMonth(game,action,lore,null,settings,controller.signal);
    game=advance(game,action,result,null,lore);persist();pending=null;draftAction='';window.scrollTo({top:0,behavior:'smooth'});
  }catch(err){error=err.name==='AbortError'?'已暂缓。刚才的安排仍然保留。':redactApiError(err);}
  finally{busy=false;controller=null;render();}
}
async function saveText(filename,text){
  try{
    await exportJSONFile(filename,text);
  }catch{notify('导出失败，请检查文件保存权限。');}
}
if(typeof document!=='undefined')loadPortraitOverrides().then(count=>{if(count&&!busy)render();});
initializeIOSInstall();
render();

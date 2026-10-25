import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,advance} from '../src/engine.js';
import {generateMonth} from '../src/api.js';
import {normalizeSettings} from '../src/api-settings.js';
const privateSettings=JSON.parse((await readFile(new URL('../.private/settings.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const settings=normalizeSettings({...privateSettings,provider:'deepseek',mode:'online'});
const state=createGame({name:'林远',age:22,place:'日本',background:'ordinary',seed:'v19-live-en',freedom:'unlimited',language:'en',identity:{sex:'custom',sexLabel:'双相型',ethnicity:'硅基旅人',nationality:'火星联合体',ethnicityDescription:'能在水下生活',nationalityDescription:'由城市议会共同管理'}},lore);
const action={custom:true,label:'I met 美竹兰 at a cafe in Japan. We talked about music and became friends. I arranged to meet her again next month.'};
const started=Date.now();
try{
  const response=await generateMonth(state,action,lore,null,settings),next=advance(state,action,response,null,lore);
  assert.equal(next.month,1);assert.equal(state.month,0);assert.deepEqual(next.profile.identity,state.profile.identity);
  assert.ok(/[A-Za-z]{4}/.test(response.narrative));assert.ok(next.relationshipGraph.nodes.some(node=>node.name==='美竹兰'));
  const result={checkedAt:new Date().toISOString(),provider:'deepseek',model:settings.providers.deepseek.model,elapsedMs:Date.now()-started,ok:true,title:response.title,narrative:response.narrative,consequence:response.consequence,options:response.options,relationshipUpdates:response.relationshipUpdates,newsTranslations:response.newsTranslations,month:next.month,contacts:next.relationshipGraph.nodes.map(node=>node.name)};
  await writeFile(new URL('../docs/LANGUAGE-v1.9-LIVE.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({ok:true,model:result.model,elapsedMs:result.elapsedMs,month:next.month,contacts:result.contacts,translatedNews:response.newsTranslations.length,options:response.options.length}));
}catch(error){console.log(JSON.stringify({ok:false,error:error.message,elapsedMs:Date.now()-started}));process.exitCode=1;}

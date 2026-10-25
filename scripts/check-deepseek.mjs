import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGame,nextContext,advance} from '../src/engine.js';
import {DEFAULT_MODEL,generateMonth} from '../src/deepseek.js';

const settings=JSON.parse((await fs.readFile(new URL('../.private/settings.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
settings.model=settings.model?.startsWith('deepseek-')?settings.model:DEFAULT_MODEL;
const lore=JSON.parse(await fs.readFile(new URL('../src/data/lore.json',import.meta.url),'utf8'));
const state=createGame({name:'林远',place:'上海',age:20,background:'research',goal:'成为工程师，照顾家人。',seed:'deepseek-live-check',points:{intelligence:6,family:5,fitness:5,appearance:4}},lore);
state.pins=['妹妹林青在东京学习；我每月给她写信。'];
const action={custom:true,label:'我去图书馆自学自动化，并给在东京读书的妹妹林青写信，询问她的生活。'};
const context=nextContext(state,lore,action),start=Date.now();
try{
  const response=await generateMonth(state,action,lore,null,settings);
  const next=advance(state,action,response,null,lore);
  assert.equal(next.month,1);assert.equal(next.current.source,'deepseek');
  if(context.decision)assert.ok(next.current.options.length>=3&&next.current.options.length<=5);else assert.equal(next.current.options.length,0);
  assert.ok(/林青|妹妹|自动化/.test(response.consequence+' '+response.narrative),'具体行动没有被承接');
  assert.ok(!/玩家|本局|游戏|离线模式|系统判定|开发者|属性增|数值变化/.test(response.narrative+' '+response.consequence),'正文含局外语言');
  await fs.writeFile(new URL('../.private/deepseek-live-check.json',import.meta.url),JSON.stringify({elapsedMs:Date.now()-start,title:response.title,consequence:response.consequence,narrative:response.narrative,options:response.options,month:next.month},null,2));
  console.log(JSON.stringify({ok:true,provider:'deepseek',model:settings.model,elapsedMs:Date.now()-start,month:next.month,title:response.title,characters:response.narrative.length,options:response.options.length,actionAcknowledged:true}));
}catch(error){console.error(error.message);process.exitCode=1;}

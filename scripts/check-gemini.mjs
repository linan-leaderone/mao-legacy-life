import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGame,nextContext,advance} from '../src/engine.js';
import {generateMonth} from '../src/gemini.js';
const settings=JSON.parse((await fs.readFile(new URL('../.private/settings.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const lore=JSON.parse(await fs.readFile(new URL('../src/data/lore.json',import.meta.url),'utf8'));
const state=createGame({name:'林远',place:'上海',age:20,background:'research',goal:'成为工程师，照顾家人。',seed:'live-check'},lore);
state.pins=['妹妹林青在东京学习；我每月给她写信。'];
const action={custom:true,label:'我去图书馆自学自动化，并给在东京读书的妹妹林青写信，询问她的生活。'};
const {major}=nextContext(state,lore);
const start=Date.now();
try{
  const response=await generateMonth(state,action,lore,major,settings);
  const next=advance(state,action,response,major);
  assert.equal(next.month,1);assert.equal(next.current.source,'gemini');assert.equal(next.current.options.length,5);
  await fs.writeFile(new URL('../.private/live-check.json',import.meta.url),JSON.stringify({elapsedMs:Date.now()-start,title:response.title,consequence:response.consequence,narrative:response.narrative,options:response.options,month:next.month},null,2));
  console.log(JSON.stringify({ok:true,elapsedMs:Date.now()-start,month:next.month,title:response.title,characters:response.narrative.length,options:response.options.length,actionAcknowledged:/林青|妹妹|自动化/.test(response.consequence+' '+response.narrative)}));
}catch(error){console.error(error.message);process.exitCode=1;}

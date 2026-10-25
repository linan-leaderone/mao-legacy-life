// Explicitly invoked paid smoke comparison; never runs during build or tests.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGame,validateResponse} from '../src/engine.js';
import {buildPrompt} from '../src/deepseek.js';
import {generateMonth} from '../src/gemini.js';
import {normalizeSettings,activeConnection,GEMINI_RELAY_URL} from '../src/api-settings.js';
import {parseNarrative,requestJSON,repairInstruction} from '../src/api-transport.js';
const lore=JSON.parse(await readFile(new URL('../src/data/lore.json',import.meta.url),'utf8'));
const privateSettings=JSON.parse((await readFile(new URL('../.private/settings.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const connection=activeConnection(normalizeSettings({...privateSettings,provider:'gemini',mode:'online'}));
if(connection.baseUrl!==GEMINI_RELAY_URL||connection.model!=='gemini-4-argon')throw new Error('This comparison is restricted to the configured relay/model.');
const state=createGame({name:'林远',age:22,place:'日本',background:'ordinary',backgroundText:'我在当地读书，与朋友约好每周练习音乐。',goal:'完成学业',seed:'gemini-speed-v110',freedom:'influential',language:'zh-CN'},lore);
const action={custom:true,label:'我和美竹兰在咖啡店见面，聊完音乐后约好下个月一起排练。'};
const prompt=buildPrompt(state,action,lore),originalFetch=globalThis.fetch;
const reports=[];
let current;
globalThis.fetch=async(url,init)=>{
  const started=Date.now(),record={requestBytes:Buffer.byteLength(init.body||''),elapsedMs:0};
  current.requests.push(record);
  const response=await originalFetch(url,init);
  record.elapsedMs=Date.now()-started;record.status=response.status;
  // Record aggregate usage only; never log headers, credentials or upstream bodies.
  try{const copy=await response.clone().json();record.elapsedMs=Date.now()-started;record.usage=Object.fromEntries(['promptTokenCount','candidatesTokenCount','totalTokenCount','thoughtsTokenCount','cachedContentTokenCount'].filter(key=>Number.isFinite(copy.usageMetadata?.[key])).map(key=>[key,copy.usageMetadata[key]]));record.finishReason=['STOP','MAX_TOKENS','SAFETY'].includes(copy.candidates?.[0]?.finishReason)?copy.candidates[0].finishReason:'other';}catch{}
  return response;
};
async function legacy(){
  const contents=[{role:'user',parts:[{text:`${prompt.system}\n\n下面是本次生活记录的输入资料：\n${prompt.user}\n\n请按上面的完整规则，只输出一个合法 JSON 对象。必须含 title、narrative、consequence、location、memory、actionDelta、options；actionDelta 为 {}，options 数量按 decision 决定。不要 Markdown、前言、列表或 JSON 之外的文字。`}]}];
  const deadline=Date.now()+180000;
  for(let attempt=0;attempt<2;attempt++){
    const response=await requestJSON(connection.baseUrl+'/models/gemini-4-argon:generateContent',{headers:{'x-goog-api-key':connection.apiKey},body:{systemInstruction:{parts:[{text:prompt.system}]},contents,generationConfig:{maxOutputTokens:6000,responseMimeType:'application/json',thinkingConfig:{thinkingBudget:0}}},timeoutMs:deadline-Date.now()});
    const candidate=response.candidates?.[0];
    if(candidate?.finishReason!=='STOP')throw new Error('Incomplete response');
    const parts=candidate.content?.parts,parsed=parseNarrative(parts?.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join(''));
    try{return validateResponse(parsed,{decision:prompt.decision,context:prompt.validationContext});}
    catch(error){if(error.code!=='PROSE_REPAIR'||attempt===1)throw error;contents.push({role:'model',parts},{role:'user',parts:[{text:repairInstruction(error)}]});}
  }
}
try{
  const modes=process.argv.includes('--optimized-only')?['optimized']:['legacy','optimized'];
  for(const mode of modes){
    current={mode,requests:[],elapsedMs:0};reports.push(current);const started=Date.now();
    try{const result=await (mode==='legacy'?legacy():generateMonth(state,action,lore,null,connection));current.outputCharacters=JSON.stringify(result).length;current.narrative=result.narrative;current.consequence=result.consequence;current.relationshipUpdates=result.relationshipUpdates;assert.match(result.consequence,/咖啡/,'Action-month account must retain the cafe meeting.');assert.match(result.narrative,/排练|音乐|曲|琴|乐谱/,'Following month must continue the same arrangement.');assert.ok(result.relationshipUpdates.some(update=>update.target==='美竹兰'),'Confirmed contact must be retained.');current.ok=true;}
    catch(error){current.ok=false;current.error=error.message;}
    current.elapsedMs=Date.now()-started;
    console.log(JSON.stringify({mode:current.mode,ok:current.ok,elapsedMs:current.elapsedMs,requests:current.requests,error:current.error}));
  }
}finally{globalThis.fetch=originalFetch;}
await writeFile(new URL('../docs/GEMINI-SPEED-v1.10.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),endpoint:GEMINI_RELAY_URL,model:connection.model,scenario:'同一个日本开局角色会见美竹兰，保留年龄、地点、月度延续与关系更新校验。',note:'单组样本；第三方排队及上游路由会波动，不能保证每月相同耗时。不会更换用户选择的服务或模型。',reports},null,2)+'\n');
if(reports.some(r=>!r.ok))process.exitCode=1;

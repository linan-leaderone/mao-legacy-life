import {generateMonth as generateDeepSeek,listModels as listDeepSeek,buildPrompt} from './deepseek.js';
import {generateMonth as generateGemini,listModels as listGemini} from './gemini.js';
import {activeConnection,normalizeBaseUrl} from './api-settings.js';
import {requestJSON,requireModel,requireKey,requireModelList} from './api-transport.js';
import {compactNarrativePrompt} from './prompt-compact.js';
import {narrativeUserMessage,acceptNarrative,incompleteNarrative,narrativeMetadata} from './narrative-recovery.js';

function customConnection(connection){
  const {protocol}=connection;
  if(!['openai','anthropic','gemini'].includes(protocol))throw new Error('请选择支持的 API 协议。');
  return {...connection,baseUrl:normalizeBaseUrl(connection.baseUrl,protocol)};
}
const serviceLabel=connection=>connection.provider==='gemini'?'Gemini 转发服务':connection.provider==='shiwuyan'?'ShiWuYan 转发服务':'自定义服务';
function headersFor(connection){
  const key=connection.apiKey?.trim();
  // The relay only accepts x-api-key for Messages, not Chat Completions.
  // Its /models endpoint accepts both, so a model listing cannot select auth.
  if(connection.provider==='shiwuyan'){
    requireKey(key,'ShiWuYan 转发服务');
    if(connection.protocol!=='anthropic')throw new Error('ShiWuYan 连接需要使用 Messages 兼容接口，请恢复默认连接。');
    return {'x-api-key':key,'anthropic-version':'2023-06-01'};
  }
  if(connection.provider==='gemini')requireKey(key,'Gemini 转发服务');
  // Local services such as Ollama may intentionally have no API key.
  if(connection.protocol==='openai')return key?{Authorization:'Bearer '+key}:{};
  requireKey(key,'自定义服务');
  return {'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};
}
async function listCustom(connection,signal){
  const headers=headersFor(connection),names=[],cursors=new Set();
  const deadline=Date.now()+15000;
  let after='';
  for(let page=0;page<50;page++){
    if(signal?.aborted)throw Object.assign(new Error('请求已取消，可以重新查询模型。'),{code:'API_CANCELLED'});
    const timeoutMs=deadline-Date.now();
    if(timeoutMs<1000)throw Object.assign(new Error('查询模型的等待时间已用完，可直接填写模型名称。'),{code:'API_TIMEOUT'});
    const query=after?'?after_id='+encodeURIComponent(after):'';
    const response=await requestJSON(connection.baseUrl+'/models'+query,{headers,signal,label:serviceLabel(connection),modelQuery:true,timeoutMs,route:connection.route});
    if(!Array.isArray(response.data))throw new Error('该服务未返回有效的模型列表，请直接填写模型名称。');
    names.push(...response.data.map(model=>model?.id));
    if(connection.protocol!=='anthropic'||!response.has_more)break;
    const next=response.last_id;
    if(typeof next!=='string'||!next||cursors.has(next))throw new Error('服务返回的模型分页无效，请直接填写模型名称。');
    cursors.add(next);after=next;
    if(page===49)throw new Error('模型列表过长，请直接填写模型名称。');
  }
  return requireModelList(names);
}

export async function listModels(settings,signal){
  const connection=activeConnection(settings);
  if(signal?.aborted)throw new Error('请求已取消，可以重新查询模型。');
  if(connection.provider==='deepseek')return listDeepSeek(connection,signal);
  if(connection.provider==='gemini'&&connection.protocol==='gemini')return listGemini(connection,signal);
  const custom=customConnection(connection);
  return custom.protocol==='gemini'?listGemini(custom,signal):listCustom(custom,signal);
}

export async function generateMonth(s,action,lore,major,settings,signal,recovery=null){
  const connection=activeConnection(settings);
  if(connection.mode==='offline')throw new Error('当前使用本地叙事，请切换在线服务后再连接模型。');
  if(connection.provider==='deepseek')return generateDeepSeek(s,action,lore,major,connection,signal,recovery);
  if(connection.provider==='gemini'&&connection.protocol==='gemini')return generateGemini(s,action,lore,major,connection,signal,recovery);
  const custom=customConnection(connection);
  if(custom.protocol==='gemini')return generateGemini(s,action,lore,major,custom,signal,recovery);
  if(signal?.aborted)throw Object.assign(new Error('请求已取消。本月未推进。'),{code:'API_CANCELLED'});
  const prompt=recovery?.prompt||compactNarrativePrompt(buildPrompt(s,action,lore,major));
  const model=requireModel(custom.model),headers=headersFor(custom),anthropic=custom.protocol==='anthropic';
  const userText=narrativeUserMessage(prompt,recovery),relay=custom.provider==='shiwuyan';
  // Keep the bundled relay's entire instruction in one user message. Some
  // upstream protocol conversions omit the separate system field.
  const messages=[{role:'user',content:relay?`${prompt.system}\n\n${userText}`:userText}];
  const body=anthropic?{model,...(relay?{}:{system:prompt.system}),messages,max_tokens:6000,stream:false}:{model,messages:[{role:'system',content:prompt.system},...messages],max_tokens:6000,stream:false};
  const response=await requestJSON(custom.baseUrl+'/'+(anthropic?'messages':'chat/completions'),{headers,body,signal,label:serviceLabel(custom),timeoutMs:180000,route:custom.route});
  const choice=response.choices?.[0],finishReason=anthropic?response.stop_reason:choice?.finish_reason;
  const content=anthropic?response.content:choice?.message?.content;
  const text=typeof content==='string'?content:Array.isArray(content)?content.filter(part=>part?.type==='text'&&typeof part.text==='string').map(part=>part.text).join(''):'';
  const metadata=narrativeMetadata(custom,response,finishReason);
  if(['max_tokens','length'].includes(finishReason))throw incompleteNarrative(text,prompt,metadata);
  if(!anthropic&&choice?.message?.refusal||finishReason&&!(anthropic?['end_turn','stop_sequence']:['stop']).includes(finishReason))throw incompleteNarrative(text,prompt,metadata,true);
  return acceptNarrative(text,prompt,['gemini','shiwuyan'].includes(custom.provider)?custom.provider:'custom',metadata,recovery);
}


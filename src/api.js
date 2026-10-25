import {generateMonth as generateDeepSeek,listModels as listDeepSeek,buildPrompt} from './deepseek.js';
import {generateMonth as generateGemini,listModels as listGemini} from './gemini.js';
import {validateResponse} from './engine.js';
import {activeConnection,normalizeBaseUrl} from './api-settings.js';
import {requestJSON,requireModel,requireKey,parseNarrative,repairInstruction,requireModelList} from './api-transport.js';

function customConnection(connection){
  const {protocol}=connection;
  if(!['openai','anthropic','gemini'].includes(protocol))throw new Error('请选择支持的 API 协议。');
  return {...connection,baseUrl:normalizeBaseUrl(connection.baseUrl,protocol)};
}
function headersFor(connection){
  const key=connection.apiKey?.trim();
  if(connection.provider==='gemini')requireKey(key,'Gemini 转发服务');
  // Local services such as Ollama may intentionally have no API key.
  if(connection.protocol==='openai')return key?{Authorization:'Bearer '+key}:{};
  requireKey(key,'自定义服务');
  return {'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};
}
async function listCustom(connection,signal){
  const headers=headersFor(connection),names=[],cursors=new Set();
  let after='';
  for(let page=0;page<50;page++){
    const query=after?'?after_id='+encodeURIComponent(after):'';
    const response=await requestJSON(connection.baseUrl+'/models'+query,{headers,signal,label:connection.provider==='gemini'?'Gemini 转发服务':'自定义服务',modelQuery:true});
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

export async function generateMonth(s,action,lore,major,settings,signal){
  const connection=activeConnection(settings);
  if(connection.mode==='offline')throw new Error('当前使用本地叙事，请切换在线服务后再连接模型。');
  if(connection.provider==='deepseek')return generateDeepSeek(s,action,lore,major,connection,signal);
  if(connection.provider==='gemini'&&connection.protocol==='gemini')return generateGemini(s,action,lore,major,connection,signal);
  const custom=customConnection(connection);
  if(custom.protocol==='gemini')return generateGemini(s,action,lore,major,custom,signal);
  const prompt=buildPrompt(s,action,lore,major),model=requireModel(custom.model),headers=headersFor(custom);
  const messages=[{role:'user',content:prompt.user}];
  for(let attempt=0;attempt<2;attempt++){
    const anthropic=custom.protocol==='anthropic';
    const body=anthropic?{model,system:prompt.system,messages,max_tokens:6000,stream:false}:{model,messages:[{role:'system',content:prompt.system},...messages],max_tokens:6000,stream:false};
    const response=await requestJSON(custom.baseUrl+'/'+(anthropic?'messages':'chat/completions'),{headers,body,signal,label:custom.provider==='gemini'?'Gemini 转发服务':'自定义服务'});
    let text;
    if(anthropic){
      if(response.stop_reason==='max_tokens')throw new Error('这段文字未能写完，本月未推进，请重试或更换模型。');
      if(response.stop_reason&&response.stop_reason!=='end_turn'&&response.stop_reason!=='stop_sequence')throw new Error('服务没有返回完整文字，本月未推进，请重试。');
      text=Array.isArray(response.content)?response.content.filter(part=>part.type==='text').map(part=>part.text||'').join(''):'';
    }else{
      const choice=response.choices?.[0];
      if(choice?.finish_reason==='length')throw new Error('这段文字未能写完，本月未推进，请重试或更换模型。');
      if(choice?.finish_reason&&choice.finish_reason!=='stop')throw new Error('服务没有返回完整文字，本月未推进，请重试。');
      const content=choice?.message?.content;
      text=typeof content==='string'?content:Array.isArray(content)?content.filter(part=>part.type==='text').map(part=>part.text||'').join(''):'';
    }
    const parsed=parseNarrative(text);
    try{
      const valid=validateResponse(parsed,{decision:prompt.decision,context:prompt.validationContext});
      return {...valid,actionDelta:{},source:custom.provider==='gemini'?'gemini':'custom'};
    }catch(error){
      if(error.code!=='PROSE_REPAIR'||attempt===1)throw error;
      messages.push({role:'assistant',content:JSON.stringify(parsed)},{role:'user',content:repairInstruction(error)});
    }
  }
}


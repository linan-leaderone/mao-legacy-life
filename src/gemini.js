import {buildPrompt,responseSchema} from './deepseek.js';
import {normalizeBaseUrl,DEFAULT_MODELS,GEMINI_RELAY_URL,GEMINI_OFFICIAL_URL} from './api-settings.js';
import {requestJSON,requireModel,requireKey,requireModelList} from './api-transport.js';
import {compactNarrativePrompt} from './prompt-compact.js';
import {narrativeUserMessage,acceptNarrative,incompleteNarrative,narrativeMetadata} from './narrative-recovery.js';

export {buildPrompt,responseSchema};
export const DEFAULT_MODEL=DEFAULT_MODELS.gemini;
function connection(settings){
  const custom=settings.provider==='custom';
  const baseUrl=normalizeBaseUrl(settings.baseUrl||(custom?'':GEMINI_OFFICIAL_URL),'gemini');
  return {baseUrl,label:custom?'自定义 Gemini 服务':baseUrl===GEMINI_RELAY_URL?'Gemini 转发服务':'Gemini',key:requireKey(settings.apiKey,custom?'自定义服务':'Gemini'),route:settings.route};
}
function modelPath(name){
  const model=requireModel(name).replace(/^models\//,'');
  if(!model||model.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('请填写有效的 Gemini 模型名称。');
  return model.split('/').map(encodeURIComponent).join('/');
}

export async function listModels(settings,signal){
  const {baseUrl,label,key,route}=connection(settings),names=[],tokens=new Set();
  const deadline=Date.now()+15000;
  let pageToken='';
  for(let page=0;page<50;page++){
    if(signal?.aborted)throw Object.assign(new Error('请求已取消，可以重新查询模型。'),{code:'API_CANCELLED'});
    const timeoutMs=deadline-Date.now();
    if(timeoutMs<1000)throw Object.assign(new Error('查询模型的等待时间已用完，可直接填写模型名称。'),{code:'API_TIMEOUT'});
    const query=pageToken?'?pageToken='+encodeURIComponent(pageToken):'';
    const response=await requestJSON(baseUrl+'/models'+query,{headers:{'x-goog-api-key':key},signal,label,modelQuery:true,timeoutMs,route});
    if(!Array.isArray(response.models))throw new Error('该服务未返回有效的 Gemini 模型列表，请直接填写模型名称。');
    // This relay's native /models omits capability metadata; verified text models remain usable.
    names.push(...response.models.filter(model=>(model?.supportedGenerationMethods?.includes('generateContent')||baseUrl===GEMINI_RELAY_URL&&model?.supportedGenerationMethods==null)&&typeof model?.name==='string').map(model=>model.name.replace(/^models\//,'')));
    const next=response.nextPageToken;
    if(typeof next!=='string'||!next)break;
    if(tokens.has(next))throw new Error('服务返回的模型分页无效，请直接填写模型名称。');
    tokens.add(next);pageToken=next;
    if(page===49)throw new Error('模型列表过长，请直接填写模型名称。');
  }
  return requireModelList(names);
}

export async function generateMonth(s,action,lore,major,settings,signal,recovery=null){
  const {baseUrl,label,key,route}=connection(settings),model=modelPath(settings.model||(settings.provider==='custom'?'':DEFAULT_MODEL));
  const prompt=recovery?.prompt||compactNarrativePrompt(buildPrompt(s,action,lore,major));
  const relay=baseUrl===GEMINI_RELAY_URL&&model==='gemini-4-argon';
  const generationConfig={maxOutputTokens:6000,responseMimeType:'application/json',...(relay?{thinkingConfig:{thinkingLevel:'low'}}:{})};
  // This relay's native conversion can omit systemInstruction and JSON mode.
  // Send the rules once in its user message. Repeating the whole system text
  // wastes input and can make the relay reason over the same constraints twice.
  // Ordinary Gemini endpoints retain their native system/user separation.
  const content=narrativeUserMessage(prompt,recovery);
  const userText=relay?`${prompt.system}\n\n下面是本次生活记录的输入资料：\n${content}`:content;
  const contents=[{role:'user',parts:[{text:userText}]}];
  if(signal?.aborted)throw Object.assign(new Error('请求已取消。本月未推进。'),{code:'API_CANCELLED'});
  const response=await requestJSON(baseUrl+'/models/'+model+':generateContent',{headers:{'x-goog-api-key':key},body:{...(relay?{}:{systemInstruction:{parts:[{text:prompt.system}]}}),contents,generationConfig},signal,label,timeoutMs:180000,route});
  const candidate=response.candidates?.[0],parts=candidate?.content?.parts;
  const text=Array.isArray(parts)?parts.filter(part=>!part.thought&&typeof part.text==='string').map(part=>part.text).join(''):'';
  const metadata=narrativeMetadata({...settings,model},response,candidate?.finishReason);
  if(candidate?.finishReason==='MAX_TOKENS')throw incompleteNarrative(text,prompt,metadata);
  if(response.promptFeedback?.blockReason||candidate?.finishReason&&candidate.finishReason!=='STOP')throw incompleteNarrative(text,prompt,metadata,true);
  return acceptNarrative(text,prompt,settings.provider==='custom'?'custom':'gemini',metadata,recovery);
}

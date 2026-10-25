import {buildPrompt,responseSchema} from './deepseek.js';
import {validateResponse} from './engine.js';
import {normalizeBaseUrl,DEFAULT_MODELS,GEMINI_RELAY_URL,GEMINI_OFFICIAL_URL} from './api-settings.js';
import {requestJSON,requireModel,requireKey,parseNarrative,repairInstruction,requireModelList} from './api-transport.js';
import {compactNarrativePrompt} from './prompt-compact.js';

export {buildPrompt,responseSchema};
export const DEFAULT_MODEL=DEFAULT_MODELS.gemini;
function connection(settings){
  const custom=settings.provider==='custom';
  const baseUrl=normalizeBaseUrl(settings.baseUrl||(custom?'':GEMINI_OFFICIAL_URL),'gemini');
  return {baseUrl,label:custom?'自定义 Gemini 服务':baseUrl===GEMINI_RELAY_URL?'Gemini 转发服务':'Gemini',key:requireKey(settings.apiKey,custom?'自定义服务':'Gemini')};
}
function modelPath(name){
  const model=requireModel(name).replace(/^models\//,'');
  if(!model||model.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('请填写有效的 Gemini 模型名称。');
  return model.split('/').map(encodeURIComponent).join('/');
}

export async function listModels(settings,signal){
  const {baseUrl,label,key}=connection(settings),names=[],tokens=new Set();
  let pageToken='';
  for(let page=0;page<50;page++){
    const query=pageToken?'?pageToken='+encodeURIComponent(pageToken):'';
    const response=await requestJSON(baseUrl+'/models'+query,{headers:{'x-goog-api-key':key},signal,label,modelQuery:true});
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

export async function generateMonth(s,action,lore,major,settings,signal){
  const {baseUrl,label,key}=connection(settings),model=modelPath(settings.model||(settings.provider==='custom'?'':DEFAULT_MODEL));
  const prompt=compactNarrativePrompt(buildPrompt(s,action,lore,major));
  const relay=baseUrl===GEMINI_RELAY_URL&&model==='gemini-4-argon';
  const generationConfig={maxOutputTokens:6000,responseMimeType:'application/json',...(relay?{thinkingConfig:{thinkingLevel:'low'}}:{})};
  // This relay's native conversion can omit systemInstruction and JSON mode.
  // Send the rules once in its user message. Repeating the whole system text
  // wastes input and can make the relay reason over the same constraints twice.
  // Ordinary Gemini endpoints retain their native system/user separation.
  const userText=relay?`${prompt.system}\n\n下面是本次生活记录的输入资料：\n${prompt.user}\n\n请按上面的完整规则，只输出一个合法 JSON 对象。必须含 title、narrative、consequence、location、memory、actionDelta、options；actionDelta 为 {}，options 数量按 decision 决定。不要 Markdown、前言、列表或 JSON 之外的文字。`:prompt.user;
  const contents=[{role:'user',parts:[{text:userText}]}];
  const deadline=relay?Date.now()+180000:null;
  for(let attempt=0;attempt<2;attempt++){
    const timeoutMs=relay?deadline-Date.now():60000;
    if(timeoutMs<1000)throw new Error('服务等待已超过 180 秒。本月未推进，可以重试。');
    const response=await requestJSON(baseUrl+'/models/'+model+':generateContent',{headers:{'x-goog-api-key':key},body:{...(relay?{}:{systemInstruction:{parts:[{text:prompt.system}]}}),contents,generationConfig},signal,label,timeoutMs});
    const candidate=response.candidates?.[0];
    if(candidate?.finishReason==='MAX_TOKENS')throw new Error('这段文字未能写完，本月未推进，请重试或更换模型。');
    if(response.promptFeedback?.blockReason||candidate?.finishReason&&candidate.finishReason!=='STOP')throw new Error('服务没有返回可用文字，本月未推进。可以调整行动后重试。');
    const parts=candidate?.content?.parts;
    const parsed=parseNarrative(Array.isArray(parts)?parts.filter(part=>!part.thought&&typeof part.text==='string').map(part=>part.text).join(''):'');
    try{
      const valid=validateResponse(parsed,{decision:prompt.decision,context:prompt.validationContext});
      return {...valid,actionDelta:{},source:settings.provider==='custom'?'custom':'gemini'};
    }catch(error){
      if(error.code!=='PROSE_REPAIR'||attempt===1)throw error;
      // Preserve thought signatures supplied by Gemini when continuing the conversation.
      contents.push({role:'model',parts},{role:'user',parts:[{text:repairInstruction(error)}]});
    }
  }
}

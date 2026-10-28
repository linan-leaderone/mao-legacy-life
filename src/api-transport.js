const TIMEOUT_MS=180000,MODEL_TIMEOUT_MS=15000;
const MAX_RESPONSE_BYTES=4*1024*1024,MAX_ENVELOPE_BYTES=8*1024*1024;
const androidRequests=new Map();
function stopError(reason,timeoutMs,modelQuery){
  const timeout=reason==='timeout';
  const message=timeout?`等待服务超过 ${Math.round(timeoutMs/1000)} 秒。${modelQuery?'可直接填写模型名称，或重新查询。':'本月未推进，可以重试或切换连接。'}`:`请求已取消。${modelQuery?'可以重新查询模型。':'本月未推进，刚才的安排已保留。'}`;
  return Object.assign(new Error(message),{name:timeout?'TimeoutError':'AbortError',code:timeout?'API_TIMEOUT':'API_CANCELLED'});
}
function responseError(limit=false){
  return Object.assign(new Error(limit?'服务返回的内容过长，本月未推进，可以重试。':'服务返回的格式不完整，本月未推进，可以重试。'),{code:limit?'API_RESPONSE_LIMIT':'API_INVALID_RESPONSE'});
}
function networkError(label,transport,modelQuery){
  const message=transport==='relay'?`网站到 ${label} 的连接未完成。可切换直接连接或 DeepSeek。`:transport==='direct'?`无法连接 ${label}，可能是网络或跨域限制。可切换兼容连接或 DeepSeek。`:`无法连接 ${label}，请检查网络与服务地址。可切换 DeepSeek。`;
  return Object.assign(new Error(message+(modelQuery?'也可直接填写模型名称。':'本月未推进。')),{code:'API_NETWORK'});
}

function installAndroidCallback(host){
  host.__maoApiResponse=(id,result)=>{
    const callback=androidRequests.get(id);
    if(!callback)return;
    androidRequests.delete(id);
    callback(result);
  };
}
function httpError(status,label,modelQuery){
  if(modelQuery&&[400,404,405,501].includes(status))return new Error('该服务未提供可用的模型列表，请直接填写模型名称。');
  const detail=({400:'请求格式或模型参数不被支持，请检查接口协议与模型名称。',401:'身份验证失败，请检查 API Key。',402:'账户余额或额度不足，请检查服务账户。',403:'访问被拒绝，请检查密钥权限和服务可用地区。',404:'找不到接口或模型，请检查服务地址、协议与模型名称。',408:'服务响应超时，请重试。',413:'本次内容超出服务限制，请换用支持更长上下文的模型。',422:'服务无法处理本次内容，请调整行动后重试。',429:'额度或请求频率达到限制，请稍后重试。',500:'服务暂时异常，请重试。',502:'服务暂时异常，请重试。',503:'服务暂时繁忙，请稍后重试。',504:'服务响应超时，请重试。'})[status]||('请求失败（HTTP '+status+'）。');
  return new Error(label+' '+detail+(modelQuery?'':' 本月未推进。'));
}

async function readLimitedBody(response,onChunk){
  const reader=response.body?.getReader();if(!reader)return '';
  const decoder=new TextDecoder();let text='',bytes=0,complete=false;
  try{
    while(true){
      const {done,value}=await reader.read();if(done){complete=true;break;}
      bytes+=value.byteLength;if(bytes>MAX_RESPONSE_BYTES)throw responseError(true);
      onChunk();text+=decoder.decode(value,{stream:true});
    }
    return text+decoder.decode();
  }finally{
    if(!complete)try{await reader.cancel();}catch{}
    reader.releaseLock();
  }
}
async function readRelayBody(response,setPhase){
  if(!/^application\/x-ndjson(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw responseError();
  const reader=response.body?.getReader();if(!reader)throw responseError();
  const decoder=new TextDecoder();let pending='',bytes=0,complete=false;
  const record=line=>{
    if(!line.trim())return null;
    let item;try{item=JSON.parse(line);}catch{throw responseError();}
    if(item?.type==='progress'&&item.phase==='waiting'){setPhase('waiting');return null;}
    if(item?.type==='result'&&item.result&&typeof item.result==='object'&&!Array.isArray(item.result)){setPhase('receiving');return item.result;}
    throw responseError();
  };
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done){complete=true;pending+=decoder.decode();const result=record(pending);if(result)return result;throw responseError();}
      bytes+=value.byteLength;if(bytes>MAX_ENVELOPE_BYTES)throw responseError(true);
      pending+=decoder.decode(value,{stream:true});
      let newline;
      while((newline=pending.indexOf('\n'))!==-1){
        const line=pending.slice(0,newline);pending=pending.slice(newline+1);
        const result=record(line);if(result)return result;
      }
    }
  }finally{
    if(!complete)try{await reader.cancel();}catch{}
    reader.releaseLock();
  }
}

/** One request per call. A relay failure never falls back by resending the prompt. */
export async function requestJSON(url,{headers={},body,signal,label='API',modelQuery=false,timeoutMs,route='direct'}={}){
  const fallbackTimeout=modelQuery?MODEL_TIMEOUT_MS:TIMEOUT_MS;
  const timeout=Number.isFinite(timeoutMs)?Math.max(1000,Math.min(TIMEOUT_MS,Math.round(timeoutMs))):fallbackTimeout;
  const host=typeof window==='object'?window:null,desktop=host?.desktopBridge,android=host?.NativeBridge;
  const native=typeof desktop?.requestApi==='function'?'desktop':typeof android?.requestApi==='function'?'android':null;
  let relay=false;
  if(!native&&route==='auto'&&typeof __IOS_PWA__!=='undefined'&&__IOS_PWA__)try{relay=new URL(url).origin==='https://aiapi.shiwuyan.cn';}catch{}
  const transport=native?'native':relay?'relay':'direct';
  const id=globalThis.crypto?.randomUUID?.()||('api-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  const abort=new AbortController(),startedAt=Date.now();
  let finish,cancelNative,cancelReason,settled=false,phase='connecting',timer;
  const progress=()=>{
    if(typeof host?.dispatchEvent!=='function'||typeof host.CustomEvent!=='function')return;
    host.dispatchEvent(new host.CustomEvent('mao-api-progress',{detail:{id,phase,transport,modelQuery,elapsedMs:Math.max(0,Date.now()-startedAt),timeoutMs:timeout}}));
  };
  const setPhase=value=>{if(phase!=='done'&&phase!==value){phase=value;progress();}};
  const resultPromise=new Promise((resolve,reject)=>{
    finish={resolve:value=>{if(!settled){settled=true;resolve(value);}},reject:error=>{if(!settled){settled=true;reject(error);}}};
  });
  const cancel=reason=>{
    if(settled)return;
    cancelReason=reason;abort.abort(reason);
    try{cancelNative?.();}catch{}
    androidRequests.delete(id);
    finish.reject(stopError(reason,timeout,modelQuery));
  };
  const onCancel=()=>cancel('cancelled');
  const onFailure=error=>{
    if(cancelReason)return finish.reject(stopError(cancelReason,timeout,modelQuery));
    finish.reject(['API_RESPONSE_LIMIT','API_INVALID_RESPONSE'].includes(error?.code)?error:networkError(label,transport,modelQuery));
  };
  progress();const progressTimer=setInterval(progress,1000);
  try{
    if(signal?.aborted)throw stopError('cancelled',timeout,modelQuery);
    const payload={id,url,method:body===undefined?'GET':'POST',headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),timeoutMs:timeout};
    signal?.addEventListener('abort',onCancel,{once:true});
    timer=setTimeout(()=>cancel('timeout'),timeout);
    if(native==='desktop'){
      cancelNative=()=>desktop.cancelApi?.(id);
      Promise.resolve().then(()=>{
        if(abort.signal.aborted)return {error:true,errorCode:cancelReason};
        const request=desktop.requestApi(payload);setPhase('waiting');return request;
      }).then(finish.resolve,onFailure);
    }else if(native==='android'){
      installAndroidCallback(host);
      cancelNative=()=>android.cancelApi?.(id);
      androidRequests.set(id,finish.resolve);
      try{android.requestApi(JSON.stringify(payload));setPhase('waiting');}catch(error){onFailure(error);}
    }else{
      Promise.resolve().then(async()=>{
        if(abort.signal.aborted)return {error:true,errorCode:cancelReason};
        const request=relay?{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/x-ndjson'},body:JSON.stringify(payload)}:{method:payload.method,headers:payload.headers,body:payload.body};
        const response=await fetch(relay?'/api/relay':url,{...request,signal:abort.signal,redirect:'error',credentials:relay?'same-origin':'omit',referrerPolicy:'no-referrer',cache:'no-store'});
        setPhase('waiting');
        // Do not read HTTP error bodies or expose arbitrary server messages.
        if(!response.ok){try{await response.body?.cancel();}catch{}return {status:response.status,body:''};}
        if(relay)return await readRelayBody(response,setPhase);
        return {status:response.status,body:await readLimitedBody(response,()=>setPhase('receiving'))};
      }).then(finish.resolve,onFailure);
    }
    const result=await resultPromise;
    if(signal?.aborted||abort.signal.aborted)throw stopError(cancelReason||'cancelled',timeout,modelQuery);
    if(result?.error){
      if(['timeout','cancelled'].includes(result.errorCode))throw stopError(result.errorCode,timeout,modelQuery);
      throw networkError(label,transport,modelQuery);
    }
    if(!result||!Number.isInteger(result.status))throw networkError(label,transport,modelQuery);
    if(result.status<200||result.status>=300)throw httpError(result.status,label,modelQuery);
    if(typeof result.body!=='string')throw responseError();
    if(result.body.length>MAX_RESPONSE_BYTES||new TextEncoder().encode(result.body).byteLength>MAX_RESPONSE_BYTES)throw responseError(true);
    let parsed;
    try{parsed=JSON.parse(result.body);}catch{throw new Error(modelQuery?'该服务未返回有效的模型列表，请直接填写模型名称。':'服务返回的格式不完整，本月未推进，可以重试。');}
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||parsed.error)throw new Error(modelQuery?'该服务未返回有效的模型列表，请直接填写模型名称。':'服务没有返回可用文字，本月未推进，可以重试。');
    return parsed;
  }finally{
    clearTimeout(timer);
    clearInterval(progressTimer);
    signal?.removeEventListener('abort',onCancel);
    androidRequests.delete(id);
    setPhase('done');
  }
}
export function requireModel(model){
  if(typeof model!=='string'||!model.trim()||model.length>300||/[\u0000-\u001f\u007f]/.test(model))throw new Error('请填写有效的模型名称。');
  return model.trim();
}
export function requireKey(key,label){
  if(typeof key!=='string'||!key.trim())throw new Error('请先填写 '+label+' API Key。');
  return key.trim();
}
export {parseNarrative} from './narrative-response.js';
export function repairInstruction(error){
  return '请只修正下面的问题并重新输出完整JSON。不要推进时间、重算行动或改变已给出的结果：'+error.issues.join(' ')+' 保持原来的选项数量，遵守全部行文要求。';
}
export function modelNames(values){
  return [...new Set(values.filter(value=>typeof value==='string'&&value.trim()&&value.length<=300&&!/[\u0000-\u001f\u007f]/.test(value)).map(value=>value.trim()))];
}
export function requireModelList(values){
  const names=modelNames(values);
  if(!names.length)throw new Error('该服务未返回可用的文字模型，请直接填写模型名称。');
  return names;
}


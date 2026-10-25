const TIMEOUT_MS=60000;
const MAX_RESPONSE_CHARS=4*1024*1024;
const androidRequests=new Map();
const cancelled=(timeoutMs=TIMEOUT_MS)=>new Error(`请求已取消或超过 ${Math.round(timeoutMs/1000)} 秒。本月未推进，可以重试。`);

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

/** One transport for browser and both native shells; never retries a network request. */
export async function requestJSON(url,{headers={},body,signal,label='API',modelQuery=false,timeoutMs=TIMEOUT_MS}={}){
  const timeout=Number.isFinite(timeoutMs)?Math.max(1000,Math.min(180000,Math.round(timeoutMs))):TIMEOUT_MS;
  if(signal?.aborted)throw cancelled(timeout);
  const host=typeof window==='object'?window:null,desktop=host?.desktopBridge,android=host?.NativeBridge;
  const id=globalThis.crypto?.randomUUID?.()||('api-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  const abort=new AbortController();
  const payload={id,url,method:body===undefined?'GET':'POST',headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),timeoutMs:timeout};
  let finish,cancelNative;
  const resultPromise=new Promise((resolve,reject)=>{finish={resolve,reject};});
  const cancel=()=>{
    abort.abort();
    try{cancelNative?.();}catch{}
    androidRequests.delete(id);
    finish.reject(cancelled(timeout));
  };
  signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(cancel,timeout);
  try{
    if(desktop&&typeof desktop.requestApi==='function'){
      cancelNative=()=>desktop.cancelApi?.(id);
      Promise.resolve().then(()=>abort.signal.aborted?{error:true}:desktop.requestApi(payload)).then(finish.resolve,()=>finish.resolve({error:true}));
    }else if(android&&typeof android.requestApi==='function'){
      installAndroidCallback(host);
      cancelNative=()=>android.cancelApi?.(id);
      androidRequests.set(id,finish.resolve);
      try{android.requestApi(JSON.stringify(payload));}catch{finish.resolve({error:true});}
    }else{
      Promise.resolve().then(async()=>{
        if(abort.signal.aborted)return {error:true};
        const response=await fetch(url,{method:payload.method,headers:payload.headers,body:payload.body,signal:abort.signal,redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'});
        // Do not read HTTP error bodies or expose arbitrary server messages.
        if(!response.ok)return {status:response.status,body:''};
        return {status:response.status,body:await response.text()};
      }).then(finish.resolve,()=>finish.resolve({error:true}));
    }
    const result=await resultPromise;
    if(signal?.aborted||abort.signal.aborted)throw cancelled(timeout);
    if(!result||result.error||!Number.isInteger(result.status))throw new Error('无法连接 '+label+'，请检查网络与服务地址。'+(modelQuery?'可直接填写模型名称。':'本月未推进。'));
    if(result.status<200||result.status>=300)throw httpError(result.status,label,modelQuery);
    if(typeof result.body!=='string'||result.body.length>MAX_RESPONSE_CHARS)throw new Error('服务返回的内容过长或格式不完整，请重试。');
    let parsed;
    try{parsed=JSON.parse(result.body);}catch{throw new Error(modelQuery?'该服务未返回有效的模型列表，请直接填写模型名称。':'服务返回的格式不完整，本月未推进，可以重试。');}
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||parsed.error)throw new Error(modelQuery?'该服务未返回有效的模型列表，请直接填写模型名称。':'服务没有返回可用文字，本月未推进，可以重试。');
    return parsed;
  }finally{
    clearTimeout(timer);
    signal?.removeEventListener('abort',cancel);
    androidRequests.delete(id);
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
export function parseNarrative(text){
  if(typeof text!=='string'||!text.trim())throw new Error('暂时没有收到完整文字，本月未推进，请重试。');
  try{return JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g,''));}
  catch{throw new Error('收到的文字格式不完整，本月未推进，可以重试。');}
}
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


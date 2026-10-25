// Native transport for user-selected API services; browser security remains enabled.
const MAX_BODY=524288,MAX_RESPONSE=2097152;
const HEADERS=new Set(['authorization','x-goog-api-key','x-api-key','anthropic-version','anthropic-beta','anthropic-dangerous-direct-browser-access','content-type','accept']);
function validateRequest(input){
  if(!input||typeof input!=='object'||typeof input.id!=='string'||!/^[a-zA-Z0-9._-]{1,100}$/.test(input.id))throw new Error('请求标识无效。');
  let url;try{url=new URL(input.url);}catch{throw new Error('API 服务地址无效。');}
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if((url.protocol!=='https:'&&!(url.protocol==='http:'&&local))||url.username||url.password||url.hash)throw new Error('API 服务地址不受支持。');
  const method=input.method||'GET';if(!['GET','POST'].includes(method))throw new Error('请求方法不受支持。');
  if(input.body!==undefined&&(typeof input.body!=='string'||input.body.length>MAX_BODY))throw new Error('请求内容过长。');
  const headers={};for(const [key,value]of Object.entries(input.headers||{})){
    if(!HEADERS.has(key.toLowerCase())||typeof value!=='string'||value.length>8192||/[\r\n]/.test(value))throw new Error('请求头不受支持。');
    headers[key]=value;
  }
  const timeoutMs=Number.isFinite(input.timeoutMs)?Math.max(1000,Math.min(180000,Math.round(input.timeoutMs))):60000;
  return {id:input.id,url:url.href,method,headers,timeoutMs,...(method==='POST'&&input.body!==undefined?{body:input.body}:{})};
}
async function performRequest(input,signal,fetchImpl=globalThis.fetch){
  const request=validateRequest(input);
  const response=await fetchImpl(request.url,{method:request.method,headers:request.headers,body:request.body,redirect:'error',credentials:'omit',signal});
  if(!response.ok){await response.body?.cancel();return {status:response.status,body:''};}
  const reader=response.body?.getReader(),parts=[];let size=0;
  if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_RESPONSE){await reader.cancel();throw new Error('服务返回的内容过长。');}parts.push(Buffer.from(value));}}finally{reader.releaseLock();}
  return {status:response.status,body:Buffer.concat(parts).toString('utf8')};
}
module.exports={validateRequest,performRequest};

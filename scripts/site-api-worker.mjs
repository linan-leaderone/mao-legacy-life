// Same-origin transport for the two bundled ShiWuYan connections. No stored keys,
// logs, automatic retries, user records, open destinations or response caching.
const UPSTREAM='https://aiapi.shiwuyan.cn';
const MAX_INPUT=1024*1024,MAX_OUTPUT=4*1024*1024;
const COMMON={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...COMMON,'Content-Type':'application/json'}});
async function boundedText(stream,max){
  if(!stream)return '';
  const reader=stream.getReader(),decoder=new TextDecoder();let length=0,text='';
  try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new Error('size');}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}
  finally{reader.releaseLock();}
}
function envelope(input){
  if(!input||typeof input!=='object')throw new Error('format');
  const target=new URL(input.url);
  if(target.origin!==UPSTREAM||target.username||target.password||target.hash)throw new Error('target');
  const method=input.method,path=target.pathname;
  const query=method==='GET'&&(path==='/v1/models'||path==='/v1beta/models');
  const generation=method==='POST'&&(['/v1/messages','/v1/chat/completions'].includes(path)||/^\/v1beta\/models\/[A-Za-z0-9._-]+:generateContent$/.test(path));
  if(!query&&!generation)throw new Error('path');
  for(const key of target.searchParams.keys())if(!query||!['pageToken','after_id'].includes(key))throw new Error('query');
  const headers=new Headers();
  for(const [key,value] of Object.entries(input.headers||{})){
    const name=key.toLowerCase();
    if(!['authorization','x-api-key','x-goog-api-key','anthropic-version','content-type'].includes(name))continue;
    if(typeof value!=='string'||value.length>8192||/[\r\n]/.test(value))throw new Error('header');headers.set(name,value);
  }
  if(!['authorization','x-api-key','x-goog-api-key'].some(key=>headers.get(key)))throw new Error('key');
  let body;
  if(generation){
    if(typeof input.body!=='string'||input.body.length>MAX_INPUT)throw new Error('body');
    const parsed=JSON.parse(input.body);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object'||parsed.stream===true)throw new Error('body');
    body=input.body;headers.set('Content-Type','application/json');
  }
  return {url:target.href,method,headers,body,timeoutMs:Math.min(query?15000:180000,Math.max(1000,Number(input.timeoutMs)||180000))};
}
async function relay(request){
  if(request.method!=='POST')return json({error:'method'},405);
  const origin=request.headers.get('Origin'),ownOrigin=new URL(request.url).origin;
  if(origin&&origin!==ownOrigin)return json({error:'origin'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'format'},415);
  if(Number(request.headers.get('Content-Length'))>MAX_INPUT)return json({error:'size'},413);
  let input;try{input=envelope(JSON.parse(await boundedText(request.body,MAX_INPUT)));}catch{return json({error:'invalid_request'},400);}
  const abort=new AbortController();let closed=false,timer,heartbeat;
  const stop=()=>abort.abort('cancelled');request.signal.addEventListener('abort',stop,{once:true});
  const stream=new ReadableStream({
    start(controller){
      const encoder=new TextEncoder();
      const send=value=>{if(!closed)try{controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));}catch{closed=true;abort.abort('cancelled');}};
      const finish=result=>{send({type:'result',result});if(!closed){closed=true;controller.close();}};
      const clean=()=>{clearTimeout(timer);clearInterval(heartbeat);request.signal.removeEventListener('abort',stop);};
      send({type:'progress',phase:'waiting'});
      heartbeat=setInterval(()=>send({type:'progress',phase:'waiting'}),10000);
      timer=setTimeout(()=>abort.abort('timeout'),input.timeoutMs);
      (async()=>{
        try{
          if(request.signal.aborted)abort.abort('cancelled');
          const response=await fetch(input.url,{method:input.method,headers:input.headers,body:input.body,signal:abort.signal,redirect:'manual',cache:'no-store'});
          if(response.status>=300&&response.status<400){await response.body?.cancel();finish({error:true,errorCode:'redirect'});return;}
          // Never send arbitrary upstream error content or headers to a visitor.
          if(!response.ok){await response.body?.cancel();finish({status:response.status,body:''});return;}
          const body=await boundedText(response.body,MAX_OUTPUT);
          finish({status:response.status,body});
        }catch{finish({error:true,errorCode:abort.signal.aborted?(abort.signal.reason==='timeout'?'timeout':'cancelled'):'network'});}
        finally{clean();}
      })();
    },
    cancel(){closed=true;abort.abort('cancelled');clearTimeout(timer);clearInterval(heartbeat);request.signal.removeEventListener('abort',stop);}
  });
  return new Response(stream,{headers:{...COMMON,'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'}});
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/health')return json({version:'1.17.4',relay:true,assets:!!env.ASSETS});
    if(url.pathname==='/api/relay')return relay(request);
    if(url.pathname.startsWith('/api/'))return json({error:'not_found'},404);
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    if(!env.ASSETS)return new Response('Assets unavailable',{status:503});
    return env.ASSETS.fetch(request);
  }
};

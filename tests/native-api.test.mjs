import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
const {validateRequest,performRequest}=createRequire(import.meta.url)('../desktop/api-request.cjs');
async function server(t,handle){const s=http.createServer(handle);await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));t.after(()=>{s.closeAllConnections();s.close();});return `http://127.0.0.1:${s.address().port}`;}
const input=url=>({id:'transport-test',url,method:'GET',headers:{}});
test('native API transport rejects unrelated schemes, nonlocal cleartext, URL credentials and unsafe headers',()=>{
  for(const url of ['file:///etc/passwd','ftp://api.example.org','http://api.example.org/v1','https://user:secret@example.org/v1','https://example.org/v1#secret'])assert.throws(()=>validateRequest(input(url)));
  assert.throws(()=>validateRequest({...input('https://api.example.org'),method:'DELETE'}));
  assert.throws(()=>validateRequest({...input('https://api.example.org'),headers:{Cookie:'session=value'}}));
  assert.throws(()=>validateRequest({...input('https://api.example.org'),headers:{Authorization:'secret\r\nOther: injected'}}));
  assert.throws(()=>validateRequest({...input('https://api.example.org'),body:'x'.repeat(524289)}));
  assert.equal(validateRequest(input('http://localhost:11434/v1/models')).method,'GET');
});

test('native request timeouts preserve the default and bound explicitly longer generation waits',()=>{
  const sample=input('https://api.example.org/v1');
  assert.equal(validateRequest(sample).timeoutMs,60000);
  assert.equal(validateRequest({...sample,timeoutMs:180000}).timeoutMs,180000);
  assert.equal(validateRequest({...sample,timeoutMs:9999999}).timeoutMs,180000);
  assert.equal(validateRequest({...sample,timeoutMs:Infinity}).timeoutMs,60000);
  assert.equal(validateRequest({...sample,timeoutMs:-1}).timeoutMs,1000);
});
test('native API transport sends only the selected credentials and returns JSON response text',async t=>{
  let observed;
  const base=await server(t,async(req,res)=>{let body='';for await(const part of req)body+=part;observed={headers:req.headers,method:req.method,body};res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:[{id:'local/model-v1'}]}));});
  const result=await performRequest({...input(base+'/v1/chat/completions'),method:'POST',headers:{Authorization:'Bearer test-custom-only','Content-Type':'application/json'},body:JSON.stringify({model:'local/model-v1',messages:[]})});
  assert.equal(result.status,200);assert.equal(JSON.parse(result.body).data[0].id,'local/model-v1');
  assert.equal(observed.headers.authorization,'Bearer test-custom-only');assert.equal(observed.headers['x-goog-api-key'],undefined);assert.equal(JSON.parse(observed.body).model,'local/model-v1');
});
test('native API transport does not follow redirects that could disclose selected credentials',async t=>{
  let redirected=0;const base=await server(t,(req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{Location:'/destination'});res.end();}else{redirected++;res.end('{}');}});
  await assert.rejects(()=>performRequest({...input(base+'/redirect'),headers:{Authorization:'Bearer test-only'}}));assert.equal(redirected,0);
});
test('native API transport cancels an in-flight request and caps oversized replies',async t=>{
  let begun;const ready=new Promise(resolve=>begun=resolve);
  const base=await server(t,(req,res)=>{if(req.url==='/slow'){begun();return;}res.end('x'.repeat(2097153));});
  const controller=new AbortController(),request=performRequest(input(base+'/slow'),controller.signal);await ready;controller.abort();await assert.rejects(()=>request);
  await assert.rejects(()=>performRequest(input(base+'/large')),/过长/);
});

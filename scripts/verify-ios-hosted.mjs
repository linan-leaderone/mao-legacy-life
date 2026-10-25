import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for iOS verification JSON on stdin (input hidden).');
const input=await new Promise((resolve,reject)=>{let value='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{if(chunk.includes('\u0003'))reject(new Error('Cancelled'));value+=chunk;if(/[\r\n]/.test(value)){process.stdin.pause();resolve(JSON.parse(value.trim()));}});});
if(process.platform==='win32'){
  const child=spawn('pwsh',['-NoProfile','-File',resolve(root,'scripts/verify-ios-hosted.ps1')],{stdio:['pipe','inherit','inherit'],windowsHide:true});
  child.stdin.end(JSON.stringify(input));
  child.on('error',()=>{console.error('PowerShell verifier could not start.');process.exit(1);});
  child.on('exit',code=>process.exit(code??1));
  await new Promise(()=>{});
}
let stage='configuration';
try{
  const url=new URL(input.url);if(url.protocol!=='https:'||!url.hostname.endsWith('.chatgpt.site'))throw new Error('Unexpected Site origin');
  const report=JSON.parse(await readFile(resolve(root,'release/ios-web-verification.json'),'utf8'));
  const checks=[];
  const authenticated=typeof input.token==='string'&&input.token.trim().length>0;
  for(const path of ['index.html','sw.js',...report.assets.map(asset=>asset.path).filter(path=>path!=='index.html')]){
    stage='request '+path;
    const response=await fetch(new URL(path==='index.html'?'./':path,url),{headers:authenticated?{'OAI-Sites-Authorization':'Bearer '+input.token}:{},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
    const data=Buffer.from(await response.arrayBuffer()),type=response.headers.get('content-type')||'';
    stage=path+' HTTP '+response.status;
    if(response.status!==200)throw new Error('Site resource did not return HTTP 200');
    if(path==='index.html'){
      if(!data.includes(Buffer.from('name="mao-life-release" content="'+report.version+'"')))throw new Error('Wrong hosted app version');
    }else{
      const local=await readFile(resolve(root,'dist-ios',path));
      if(!data.equals(local))throw new Error('Hosted resource differs from the verified build');
    }
    if(path==='sw.js'&&!/javascript/i.test(type))throw new Error('Service Worker MIME type is not JavaScript');
    checks.push({path,status:response.status,contentType:type,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
  }
  const result={url:url.origin,verifiedAt:new Date().toISOString(),version:report.version,authenticated,cookiesEnabled:false,[authenticated?'authenticatedHTTPChecks':'anonymousHTTPChecks']:checks,physicalIOSDeviceTested:false};
  await writeFile(resolve(root,authenticated?'release/ios-hosted-verification.json':'release/ios-public-verification.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({url:result.url,version:result.version,authenticated,cookiesEnabled:false,verifiedResourceCount:checks.length,allHTTP200:true,nonHTMLBytesMatch:true,physicalIOSDeviceTested:false}));
}catch(error){const code=String(error.cause?.code||error.code||'');console.error(JSON.stringify({failedAt:stage,code:/^[A-Z0-9_]+$/.test(code)?code:null}));process.exitCode=1;}

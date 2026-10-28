import {build} from 'vite';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=resolve(root,'dist-ios');
process.chdir(root);
await build({mode:'ios'});
const manifest={id:'./',name:'毛的遗产 · 人生档案',short_name:'毛的遗产',description:'从2020年开始，记录每个月的生活。',lang:'zh-CN',start_url:'./',scope:'./',display:'standalone',background_color:'#f3f0e8',theme_color:'#202c25',icons:[{src:'./apple-touch-icon.png',sizes:'1254x1254',type:'image/png',purpose:'any'}]};
await writeFile(resolve(output,'manifest.webmanifest'),JSON.stringify(manifest,null,2)+'\n');
async function files(dir){const found=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,e.name);if(e.isDirectory())found.push(...await files(path));else found.push(path);}return found.sort();}
const sources=await files(output),assets=[];
let privateDefaults={};try{privateDefaults=JSON.parse((await readFile(resolve(root,'.private/settings.json'),'utf8')).replace(/^\uFEFF/,''));}catch{}
// Only this provider was authorized as the shared public web default. Do not
// accidentally publish any of the owner's other native-only credentials.
const sharedDefault=privateDefaults.providers?.shiwuyan?.apiKey||'';
const secrets=[privateDefaults.apiKey,...Object.entries(privateDefaults.providers||{}).filter(([id])=>id!=='shiwuyan').map(([,p])=>p.apiKey)].filter(v=>typeof v==='string'&&v.length>8&&v!==sharedDefault);
let sharedDefaultPresent=false;
for(const file of sources){
  const path=relative(output,file).replaceAll('\\','/'),data=await readFile(file);
  if(data.length>25*1024*1024)throw new Error(`Static asset exceeds hosting limit: ${path}`);
  if(/(?:^|\/)(?:\.private|\.cache|node_modules)(?:\/|$)|mod-corpus|\.p12$|settings\.json$/i.test(path))throw new Error('Private or audit-only file in iPhone build');
  if(secrets.some(secret=>data.includes(Buffer.from(secret))))throw new Error('A private default credential entered the iPhone build');
  if(sharedDefault&&data.includes(Buffer.from(sharedDefault)))sharedDefaultPresent=true;
  assets.push({path,sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length,...((/^maps\/.+-boundaries\.json$/.test(path)&&path!=='maps/world-boundaries.json'||/^flags\/.+\.png$/.test(path))?{lazy:true}:{})});
}
const template=await readFile(resolve(root,'scripts/pwa-worker-template.js'),'utf8');
// Include worker behavior so a worker-only update cannot delete the active cache on failure.
const version=createHash('sha256').update(JSON.stringify(assets)).update(template).digest('hex').slice(0,16);
const htmlPath=resolve(output,'index.html');
const html=(await readFile(htmlPath,'utf8')).replace('</head>',`<meta name="mao-life-release" content="${version}"/></head>`);
await writeFile(htmlPath,html);
Object.assign(assets.find(a=>a.path==='index.html'),{sha256:createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html)});
await writeFile(resolve(output,'sw.js'),template.replace('__BUILD_VERSION__',JSON.stringify(version)).replace('__PRECACHE_ASSETS__',JSON.stringify(assets)));
await mkdir(resolve(root,'release'),{recursive:true});
const precacheBytes=assets.filter(a=>!a.lazy).reduce((sum,a)=>sum+a.bytes,0),lazyBytes=assets.filter(a=>a.lazy).reduce((sum,a)=>sum+a.bytes,0);
if(sharedDefault&&!sharedDefaultPresent)throw new Error('The authorized shared web default is missing');
const credentialPolicy={otherPrivateDefaultsExcluded:true,sharedDefaultProvider:sharedDefaultPresent?'shiwuyan':null,sharedDefaultPresent};
await writeFile(resolve(root,'release/ios-web-verification.json'),JSON.stringify({version,appVersion:JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version,assetCount:assets.length,precacheBytes,lazyBytes,...credentialPolicy,assets},null,2)+'\n');
console.log(JSON.stringify({output,version,assetCount:assets.length,precacheBytes,lazyBytes,...credentialPolicy}));

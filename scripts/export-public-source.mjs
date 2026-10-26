import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Explicit source roots: never export a working directory or a native build wholesale.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
const output=path.join(root,'release',`public-source-${version}`);
const roots=['src','public','tests','scripts','docs','android','desktop','.github'];
const files=['.gitignore','AGENTS.md','README.md','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','index.html','vite.config.js'];
const excluded=/(?:^|\/)(?:node_modules|__pycache__|\.git|\.private|\.cache|\.gradle|build|dist|dist-ios|release)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|(?:^|\/)local\.properties$|mod-corpus\.json$|\.(?:p12|pfx|pem|key|keystore|mobileprovision|pyc|log)$/i;
async function walk(dir){for(const e of await fs.readdir(path.join(root,dir),{withFileTypes:true})){const name=`${dir}/${e.name}`;if(excluded.test(name))continue;if(e.isSymbolicLink())throw Error(`Symlink excluded: ${name}`);if(e.isDirectory())await walk(name);else files.push(name);}}
for(const dir of roots)try{await walk(dir);}catch(error){if(error.code!=='ENOENT')throw error;}
let privateConfig={};try{privateConfig=JSON.parse((await fs.readFile(path.join(root,'.private/settings.json'),'utf8')).replace(/^\uFEFF/,''));}catch{}
const secrets=[privateConfig.apiKey,...Object.values(privateConfig.providers||{}).map(p=>p.apiKey)].filter(k=>typeof k==='string'&&k.length>8);
const inspected=[];
for(const name of files.sort()){
  const bytes=await fs.readFile(path.join(root,name));
  // Only report filenames on failure; no credential snippets in errors or logs.
  if(secrets.some(key=>bytes.includes(Buffer.from(key))))throw Error(`Private credential in source: ${name}`);
  if(/\bsk-[A-Za-z0-9_-]{28,}\b|\bAIza[A-Za-z0-9_-]{30,}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(bytes.toString('utf8')))throw Error(`Credential-like literal in source: ${name}`);
  inspected.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
// Validate the entire source set before writing the export.
await fs.mkdir(output,{recursive:true});
for(const entry of inspected){const target=path.join(output,entry.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(root,entry.path),target);}
const report={version,output,files:inspected.length,bytes:inspected.reduce((n,e)=>n+e.bytes,0),privateDefaultsExcluded:true,assets:inspected};
await fs.writeFile(path.join(root,'release',`public-source-${version}-manifest.json`),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({version,output,files:report.files,bytes:report.bytes,privateDefaultsExcluded:true}));

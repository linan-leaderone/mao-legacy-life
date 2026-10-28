// Assemble an existing Sites checkout, preserving all prior hashed assets and
// its project identity. This script does not build, publish, or remove files.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=path.resolve(process.argv[2]||'');
if(!process.argv[2]||site===root)throw new Error('Pass the separate existing Sites checkout');
const manifestPath=path.join(site,'.openai/hosting.json');
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
if(typeof manifest.project_id!=='string'||!manifest.project_id)throw new Error('Existing Site identity required');
const dist=path.join(site,'dist'),client=path.join(dist,'client'),server=path.join(dist,'server');
await fs.mkdir(client,{recursive:true});await fs.mkdir(server,{recursive:true});
// Every resolved old output item and destination stays inside this Site's dist.
for(const entry of await fs.readdir(dist,{withFileTypes:true})){
  if(['client','server','.openai','_appgen_meta'].includes(entry.name))continue;
  const oldPath=path.resolve(dist,entry.name),newPath=path.resolve(client,entry.name);
  if(!oldPath.startsWith(dist+path.sep)||!newPath.startsWith(client+path.sep)||entry.isSymbolicLink())throw new Error('Invalid output path');
  try{await fs.access(newPath);}catch{await fs.rename(oldPath,newPath);continue;}
  // Existing migrations keep their source rather than overwriting unknown data.
  throw new Error('Both old and migrated output exist: '+entry.name);
}
await fs.cp(path.join(root,'dist-ios'),client,{recursive:true,force:true,errorOnExist:false});
await fs.copyFile(path.join(root,'scripts/site-api-worker.mjs'),path.join(server,'index.js'));
await fs.writeFile(path.join(server,'wrangler.json'),JSON.stringify({name:'mao-legacy-life',main:'index.js',compatibility_date:'2026-10-28',compatibility_flags:['enable_request_signal'],assets:{directory:'../client',binding:'ASSETS',run_worker_first:['/api/*']}},null,2)+'\n');
delete manifest.static;
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
await fs.mkdir(path.join(dist,'.openai'),{recursive:true});
await fs.writeFile(path.join(dist,'.openai/hosting.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({projectId:manifest.project_id,site,worker:'dist/server/index.js',assets:'dist/client'}));

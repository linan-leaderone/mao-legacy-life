// Probe the same Windows network stack used by the app; never print credentials.
const {app,net}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {performRequest}=require('../desktop/api-request.cjs');
const root=path.resolve(__dirname,'..');
app.whenReady().then(async()=>{
  const profiles=JSON.parse(fs.readFileSync(path.join(root,'.private/settings.json'),'utf8').replace(/^\uFEFF/,'' )).providers;
  const {normalizeSettings}=await import('../src/api-settings.js');
  const {generateMonth}=await import('../src/api.js');
  const {createGame,advance}=await import('../src/engine.js');
  const lore=JSON.parse(fs.readFileSync(path.join(root,'src/data/lore.json'),'utf8'));
  const pending=new Map();
  global.window={desktopBridge:{
    requestApi:async input=>{const controller=new AbortController();pending.set(input.id,controller);try{return await performRequest(input,controller.signal,(url,options)=>net.fetch(url,options));}catch{return {error:true};}finally{pending.delete(input.id);}},
    cancelApi:id=>pending.get(id)?.abort()
  }};
  const results=[];
  for(const provider of process.argv.includes('--gemini-only')?['gemini']:['deepseek','gemini']){
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),20000),start=Date.now();
    try{
      const response=await performRequest({id:'native-probe-'+provider,url:provider==='deepseek'?'https://api.deepseek.com/models':'https://generativelanguage.googleapis.com/v1beta/models',method:'GET',headers:provider==='deepseek'?{Authorization:'Bearer '+profiles[provider].apiKey}:{'x-goog-api-key':profiles[provider].apiKey}},abort.signal,(url,options)=>net.fetch(url,options));
      results.push({provider,status:response.status,ok:response.status===200,elapsedMs:Date.now()-start});
    }catch{results.push({provider,ok:false,error:abort.signal.aborted?'timeout':'connection_failed',elapsedMs:Date.now()-start});}
    finally{clearTimeout(timer);}
  }
  for(const record of results.filter(item=>item.ok)){
    const settings=normalizeSettings({provider:record.provider},profiles),start=Date.now();
    const state=createGame({name:'林远',place:'中国台湾',age:20,background:'worker',seed:'api-v14-native',goal:'照顾家人。',points:{intelligence:6,family:5,fitness:5,appearance:4}},lore);
    const action={custom:true,label:'我在家学习自动化课程，把笔记整理好，给正在找工作的朋友打电话聊聊近况。'};
    try{
      const response=await generateMonth(state,action,lore,null,settings);
      const next=advance(state,action,response,null,lore);
      Object.assign(record,{generationOk:next.month===1,generationMs:Date.now()-start,model:settings.providers[record.provider].model,title:response.title,consequence:response.consequence,narrative:response.narrative,options:response.options.length});
    }catch(error){let message=String(error.message);for(const profile of Object.values(profiles))if(profile.apiKey)message=message.replaceAll(profile.apiKey,'[redacted]');Object.assign(record,{generationOk:false,generationMs:Date.now()-start,error:message});}
  }
  fs.writeFileSync(path.join(root,process.argv.includes('--gemini-only')?'docs/API-NATIVE-GEMINI-RETRY-v1.4.json':'docs/API-NATIVE-v1.4.json'),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
  console.log(JSON.stringify(results.map(item=>({...item,consequence:undefined,narrative:undefined}))));
  app.quit();
}).catch(()=>{console.error('Native network probe could not start.');app.exit(1);});

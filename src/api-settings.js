export const GEMINI_RELAY_URL='https://aiapi.shiwuyan.cn/v1beta';
export const GEMINI_OFFICIAL_URL='https://generativelanguage.googleapis.com/v1beta';
export const SHIWUYAN_URL='https://aiapi.shiwuyan.cn/v1';
export const DEFAULT_MODELS={deepseek:'deepseek-flash',gemini:'gemini-4-argon',shiwuyan:'grok-4.7',custom:''};
export const PROVIDERS=[
  {id:'deepseek',label:'DeepSeek',description:'使用 DeepSeek 官方服务'},
  {id:'gemini',label:'Gemini',description:'使用 ShiWuYan 转发服务'},
  {id:'shiwuyan',label:'ShiWuYan',description:'使用默认转发服务'},
  {id:'custom',label:'自定义 API',description:'填写其他服务的地址与模型'}
];
export const PROTOCOLS=[
  {id:'openai',label:'OpenAI 兼容'},
  {id:'gemini',label:'Gemini 原生'},
  {id:'anthropic',label:'Anthropic Messages'}
];
const has=(object,key)=>object&&Object.hasOwn(object,key);
const text=value=>typeof value==='string'?value.trim():'';
const isProvider=value=>PROVIDERS.some(p=>p.id===value);
const isProtocol=value=>PROTOCOLS.some(p=>p.id===value);
const selectedProvider=saved=>isProvider(saved.provider)?saved.provider:isProvider(saved.mode)?saved.mode:!saved.providers&&(saved.baseUrl||saved.baseURL)?'custom':/^gemini-/.test(saved.model||'')?'gemini':'deepseek';
// These fingerprints identify credentials explicitly supplied for the bundled defaults.
// Never use a broad key-prefix rule that could forward visitors' arbitrary Google keys.
export function connectionFingerprint(value){let h=2166136261;for(const c of String(value||''))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(16);}
export function migrateBundledGemini(saved,defaults={},legacyFingerprints=['1834628c'],relayFingerprints=['1a3ae594']){
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return saved;
  // Revision 6 was also written when migration did not run; inspect the actual connection.
  const source=saved.providers?saved.providers.gemini:selectedProvider(saved)==='gemini'?saved:null;
  const key=text(source?.apiKey);if(!key)return saved;
  const fingerprint=connectionFingerprint(key),legacy=legacyFingerprints.includes(fingerprint),relay=relayFingerprints.includes(fingerprint);
  if(!legacy&&!relay)return saved;
  const endpoint=text(source.baseUrl??source.baseURL);
  if(endpoint){
    try{const url=new URL(endpoint);if(url.origin!==new URL(GEMINI_OFFICIAL_URL).origin||url.username||url.password)return saved;}
    catch{return saved;}
  }
  // Keep an authorized relay key pasted into the old Google form while replacing its
  // address, protocol and model together. This migration only touches Gemini.
  const replacement=relay?profile('gemini',{apiKey:key,baseUrl:GEMINI_RELAY_URL,protocol:'gemini',model:DEFAULT_MODELS.gemini}):profile('gemini',{},defaults.gemini);
  const upgraded={...saved,providers:{...saved.providers,gemini:replacement}};
  if(!saved.providers){upgraded.provider='gemini';delete upgraded.apiKey;delete upgraded.model;delete upgraded.baseUrl;delete upgraded.baseURL;delete upgraded.protocol;}
  return upgraded;
}
function profile(provider,source={},defaults={}){
  if(!source||typeof source!=='object')source={};
  if(!defaults||typeof defaults!=='object')defaults={};
  const explicitEndpoint=has(source,'baseUrl')||has(source,'baseURL');
  // A stored pre-v5 Gemini key belongs to Google. Never silently forward it to a new host.
  const legacyGoogle=provider==='gemini'&&!explicitEndpoint&&Boolean(text(source.apiKey));
  // A user-entered Gemini host must never receive a bundled relay credential.
  const bundledHost=provider!=='gemini'||!explicitEndpoint||text(source.baseUrl??source.baseURL).replace(/\/+$/,'')===(text(defaults.baseUrl)||GEMINI_RELAY_URL).replace(/\/+$/,'');
  const bundledConnection=!['deepseek','gemini'].includes(provider)||isOldBlankDefault(provider,source,defaults);
  const entry={apiKey:has(source,'apiKey')?text(source.apiKey):bundledHost&&bundledConnection?text(defaults.apiKey):'',model:has(source,'model')?text(source.model):legacyGoogle?'gemini-3.5-flash':text(defaults.model)||DEFAULT_MODELS[provider],route:source.route==='direct'?'direct':['gemini','shiwuyan'].includes(provider)?'auto':'direct'};
  if(provider==='gemini')Object.assign(entry,{baseUrl:legacyGoogle?GEMINI_OFFICIAL_URL:explicitEndpoint?text(source.baseUrl??source.baseURL):text(defaults.baseUrl)||GEMINI_RELAY_URL,protocol:legacyGoogle?'gemini':['gemini','openai'].includes(source.protocol)?source.protocol:['gemini','openai'].includes(defaults.protocol)?defaults.protocol:'gemini'});
  if(provider==='shiwuyan')Object.assign(entry,{baseUrl:SHIWUYAN_URL,protocol:'anthropic'});
  if(provider==='custom')Object.assign(entry,{baseUrl:text(source.baseUrl??source.baseURL??defaults.baseUrl),protocol:isProtocol(source.protocol)?source.protocol:isProtocol(defaults.protocol)?defaults.protocol:'openai'});
  return entry;
}
function isOldBlankDefault(provider,source={},defaults={}){
  if(!source||typeof source!=='object'||text(source.apiKey))return false;
  const model=text(source.model);
  const knownModels=provider==='deepseek'?[DEFAULT_MODELS.deepseek,'deepseek-chat']:[DEFAULT_MODELS.gemini,'gemini-3.5-flash'];
  if(model&&!knownModels.includes(model)&&model!==text(defaults.model))return false;
  const endpoint=text(source.baseUrl??source.baseURL).replace(/\/+$/,'');
  if(provider==='deepseek')return (!endpoint||['https://api.deepseek.com','https://api.deepseek.com/v1'].includes(endpoint))&&(!source.protocol||source.protocol==='openai');
  // Only factory Gemini endpoints may be repaired together with their blank key.
  // A custom host, path, protocol or model remains the user's own connection.
  return (!endpoint||[GEMINI_RELAY_URL,GEMINI_OFFICIAL_URL].includes(endpoint))&&(!source.protocol||source.protocol==='gemini');
}
/** Keep credentials isolated by provider; revision 9 preserves subsequent explicit clears. */
export function normalizeSettings(saved={},defaults={}){
  if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};
  if(!defaults||typeof defaults!=='object')defaults={};
  saved=migrateBundledGemini(saved,defaults);
  let provider=selectedProvider(saved);
  const providers=Object.fromEntries(PROVIDERS.map(({id})=>[id,profile(id,saved.providers?.[id],defaults[id])]));
  if(!saved.providers&&['apiKey','model','baseUrl','baseURL'].some(k=>has(saved,k))){
    providers[provider]=profile(provider,saved,defaults[provider]);
  }
  // Older web releases persisted empty factory profiles. The owner requested all
  // three web defaults; fill those recognized blank connections once, without
  // changing the selected service or touching visitor-supplied credentials.
  if(Number(saved.providerRevision||0)<9){
    for(const id of ['deepseek','gemini']){
      const source=saved.providers?.[id]??(!saved.providers&&provider===id?saved:null);
      if(text(defaults[id]?.apiKey)&&isOldBlankDefault(id,source,defaults[id]))providers[id]=profile(id,{},defaults[id]);
    }
  }
  const fresh=!saved.providers&&!isProvider(saved.provider)&&!isProvider(saved.mode)&&!['apiKey','model','baseUrl','baseURL'].some(k=>has(saved,k));
  if(text(defaults.shiwuyan?.apiKey)&&saved.mode!=='offline'&&fresh)provider='shiwuyan';
  return {provider,mode:saved.mode==='offline'?'offline':'online',providers,providerRevision:9};
}
/** An explicit UI action can replace a preserved legacy connection with today's default. */
export function resetProviderConnection(settings,provider,defaults={}){
  if(!isProvider(provider))throw new Error('请选择有效的 API 服务。');
  const normalized=normalizeSettings(settings,defaults);
  normalized.providers[provider]=profile(provider,{},defaults[provider]);
  return normalized;
}
export function activeConnection(settings={}){
  // Also accept a single connection for scripts and imports.
  const normalized=normalizeSettings(settings),provider=normalized.provider;
  return {provider,mode:normalized.mode,...normalized.providers[provider],...(provider==='deepseek'?{protocol:'openai',baseUrl:'https://api.deepseek.com'}:{})};
}
export function canUseCompatibleRoute(connection={}){
  if(typeof __IOS_PWA__==='undefined'||!__IOS_PWA__||typeof window!=='object'||window.desktopBridge||window.NativeBridge)return false;
  if(!['gemini','shiwuyan'].includes(connection.provider))return false;
  try{const url=new URL(connection.baseUrl||'');return url.origin==='https://aiapi.shiwuyan.cn'&&!url.username&&!url.password&&['/v1','/v1beta'].includes(url.pathname.replace(/\/+$/,''));}catch{return false;}
}
export function normalizeBaseUrl(value,protocol='openai'){
  let raw=text(value);
  if(!raw)throw new Error('请填写自定义 API 的服务地址。');
  let url;try{url=new URL(raw);}catch{throw new Error('服务地址格式无效，请填写完整的 https:// 地址。');}
  const loopback=url.hostname==='localhost'||url.hostname==='127.0.0.1'||url.hostname==='[::1]';
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))throw new Error('服务地址需要 HTTPS；本机服务可使用 localhost 或 127.0.0.1 的 HTTP 地址。');
  if(url.username||url.password||url.search||url.hash)throw new Error('服务地址不能包含账号、密码、查询参数或片段；请把密钥填在 API Key 一栏。');
  if(!isProtocol(protocol))throw new Error('请选择支持的 API 协议。');
  let path=url.pathname.replace(/\/+$/,'');
  if(protocol==='openai')path=path.replace(/\/chat\/completions$/i,'').replace(/\/models$/i,'');
  if(protocol==='anthropic')path=path.replace(/\/(?:messages|models)$/i,'');
  if(protocol==='gemini')path=path.replace(/\/models(?:\/[^/]+(?::generateContent)?)?$/i,'');
  // A bare host conventionally serves OpenAI/Anthropic at /v1 and Gemini at /v1beta.
  if(!path)path=protocol==='gemini'?'/v1beta':'/v1';
  url.pathname=path;
  return url.toString().replace(/\/+$/,'');
}

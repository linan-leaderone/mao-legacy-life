import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import {DEFAULT_MODELS,GEMINI_RELAY_URL} from './src/api-settings.js';
export default defineConfig(({mode})=>{
  const ios=mode==='ios';let defaults={};
  if(!ios)try { defaults=JSON.parse(readFileSync(new URL('./.private/settings.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')); } catch {}
  const providers={deepseek:{apiKey:defaults.providers?.deepseek?.apiKey??defaults.apiKey??'',model:defaults.providers?.deepseek?.model||DEFAULT_MODELS.deepseek},gemini:{apiKey:defaults.providers?.gemini?.apiKey??'',model:defaults.providers?.gemini?.model||DEFAULT_MODELS.gemini,baseUrl:defaults.providers?.gemini?.baseUrl||GEMINI_RELAY_URL,protocol:defaults.providers?.gemini?.protocol||'gemini'}};
  return {base:'./',define:{__IOS_PWA__:JSON.stringify(ios),__DEFAULT_API_KEY__:JSON.stringify(providers.deepseek.apiKey),__DEFAULT_API_PROVIDERS__:JSON.stringify(providers)},
    plugins:ios?[{name:'ios-install-metadata',transformIndexHtml:html=>html.replace('</head>','<link rel="manifest" href="./manifest.webmanifest" crossorigin="use-credentials"/><link rel="apple-touch-icon" href="./apple-touch-icon.png"/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-title" content="毛的遗产"/><meta name="apple-mobile-web-app-status-bar-style" content="default"/><meta name="mao-life-build" content="ios-pwa"/></head>')}]:[],
    server:{port:5173,strictPort:true,watch:{ignored:['**/release/**','**/.cache/**','**/.private/**','**/dist-ios/**','**/desktop/node_modules/**']}},build:{target:ios?'safari15.4':'es2020',outDir:ios?'dist-ios':'dist',rollupOptions:{output:{manualChunks(id){
      if(id.endsWith('/src/data/world-geography-index.json'))return 'geography-data';
      if(id.endsWith('/src/data/countries.json'))return 'country-data';
      if(id.endsWith('/src/data/faction-flags.json'))return 'flag-data';
    }}}}};
});

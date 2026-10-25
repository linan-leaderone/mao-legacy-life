/** iPhone uses the system share sheet when JSON files are supported. */
export async function exportJSONFile(filename,text,{host=globalThis.window,doc=globalThis.document,nav=globalThis.navigator,FileType=globalThis.File,BlobType=globalThis.Blob,urlAPI=globalThis.URL,schedule=setTimeout}={}){
  if(host?.desktopBridge?.saveText)return host.desktopBridge.saveText(filename,text);
  if(host?.NativeBridge?.saveText){host.NativeBridge.saveText(filename,text);return true;}
  const ios=/iPhone|iPad|iPod/.test(nav?.userAgent||'')||(nav?.platform==='MacIntel'&&nav?.maxTouchPoints>1);
  if(ios&&FileType&&typeof nav?.share==='function'&&typeof nav?.canShare==='function'){
    const name=filename.replace(/[\\/:*?"<>|]/g,'_').slice(0,150),file=new FileType([text],name,{type:'application/json'});
    if(nav.canShare({files:[file]})){
      try{await nav.share({files:[file],title:'保存人生档案'});return true;}
      catch(error){if(error?.name==='AbortError')return false;throw error;}
    }
  }
  const url=urlAPI.createObjectURL(new BlobType([text],{type:'application/json'}));
  const a=doc.createElement('a');a.href=url;a.download=filename;doc.body.append(a);
  try{a.click();}finally{a.remove();schedule(()=>urlAPI.revokeObjectURL(url),60000);}
  return true;
}

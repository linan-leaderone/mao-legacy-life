// Parse an already received response locally. This module never calls a model,
// evaluates code, repairs missing story content, or changes game state.
const MAX_RESPONSE_BYTES=256*1024;
const MAX_DEPTH=64;
const FORBIDDEN_KEYS=new Set(['__proto__','prototype','constructor']);
const failedParse=Object.freeze({ok:false});

function formatError(receivedText,message='收到的文字格式不完整，本月未推进。可以查看返回内容或重新整理格式。'){
  const error=Object.assign(new Error(message),{code:'API_NARRATIVE_FORMAT'});
  // Never expose the text through ordinary error JSON/log serialization. An
  // oversized response is deliberately not replaced by a misleading fragment.
  if(typeof receivedText==='string')Object.defineProperty(error,'receivedText',{value:receivedText,enumerable:false});
  return error;
}

function withoutLeadingThoughts(text,fail){
  let remaining=text.trim();
  for(;;){
    const opening=/^<(think|thinking)>/i.exec(remaining);
    if(!opening)return remaining;
    const closing='</'+opening[1].toLowerCase()+'>';
    const end=remaining.toLowerCase().indexOf(closing,opening[0].length);
    if(end<0)throw fail();
    // Nested or mismatched reasoning tags are not a dependable boundary.
    if(/<\/?(?:think|thinking)>/i.test(remaining.slice(opening[0].length,end)))throw fail();
    remaining=remaining.slice(end+closing.length).trim();
  }
}

function normalizeSyntax(text){
  let normalized='',quoted=false,escaped=false,lastSignificant='';
  for(let index=0;index<text.length;index++){
    const character=text[index];
    if(quoted){
      if(escaped){
        // A backslash followed by an actual line break is ambiguous. Do not
        // invent a line-continuation interpretation that JSON does not have.
        if(character==='\n'||character==='\r'||character==='\t')return null;
        normalized+=character;escaped=false;continue;
      }
      if(character==='\\'){normalized+=character;escaped=true;continue;}
      if(character==='"'){quoted=false;lastSignificant='"';normalized+=character;continue;}
      normalized+=character==='\n'?'\\n':character==='\r'?'\\r':character==='\t'?'\\t':character;
      continue;
    }
    if(character==='"'){quoted=true;normalized+=character;continue;}
    if(character===','){
      let next=index+1;
      while(next<text.length&&/\s/.test(text[next]))next++;
      // Only a comma after a complete value may be removed. In particular,
      // {,}, [,], {"x":,}, and doubled commas must remain invalid.
      if((text[next]==='}'||text[next]===']')&&/["\]}0-9el]/.test(lastSignificant))continue;
    }
    normalized+=character;
    if(!/\s/.test(character))lastSignificant=character;
  }
  return quoted||escaped?null:normalized;
}

function parseUniqueJSON(text){
  // First validate JSON syntax, then scan its original tokens before trusting
  // the parsed value: JSON.parse silently discards earlier duplicate keys.
  const value=JSON.parse(text),stack=[];
  for(let index=0;index<text.length;index++){
    const character=text[index];
    if(character==='"'){
      const start=index;
      for(index++;index<text.length;index++){
        if(text[index]==='\\'){index++;continue;}
        if(text[index]==='"')break;
      }
      const parent=stack[stack.length-1];
      if(parent?.keys&&parent.expectKey){
        // Decode escapes so "name" and "\\u006eame" are the same key.
        const key=JSON.parse(text.slice(start,index+1));
        if(parent.keys.has(key))return failedParse;
        parent.keys.add(key);parent.expectKey=false;
      }
    }else if(character==='{')stack.push({keys:new Set(),expectKey:true});
    else if(character==='[')stack.push({keys:null});
    else if(character==='}'||character===']')stack.pop();
    else if(character===','){
      const parent=stack[stack.length-1];if(parent?.keys)parent.expectKey=true;
    }
  }
  return {ok:true,value};
}

function parseJSON(text){
  try{return parseUniqueJSON(text);}catch{}
  const normalized=normalizeSyntax(text);
  if(normalized===null||normalized===text)return failedParse;
  try{return parseUniqueJSON(normalized);}catch{return failedParse;}
}

function decodeObject(text,fail){
  const parsed=parseJSON(text);
  if(!parsed.ok)return failedParse;
  let value=parsed.value;
  if(typeof value==='string'){
    // Standard double encoding is one outer JSON string containing one entire
    // JSON object. Do not recursively reinterpret arbitrary story strings.
    const inner=parseJSON(value.trim());
    if(!inner.ok||typeof inner.value==='string')throw fail();
    value=inner.value;
  }
  if(value===null||typeof value!=='object'||Array.isArray(value))throw fail();
  return {ok:true,value};
}

function topLevelValues(text,fail){
  const spans=[],stack=[];
  let start=-1,quoted=false,escaped=false,stringStart=-1;
  for(let index=0;index<text.length;index++){
    const character=text[index];
    if(quoted){
      if(escaped){escaped=false;continue;}
      if(character==='\\'){escaped=true;continue;}
      if(character==='"'){
        quoted=false;
        if(!stack.length){spans.push({kind:'string',text:text.slice(stringStart,index+1)});stringStart=-1;}
      }
      continue;
    }
    if(character==='"'){quoted=true;stringStart=index;continue;}
    if(character==='{'||character==='['){
      if(!stack.length)start=index;
      stack.push(character);
      if(stack.length>MAX_DEPTH)throw fail();
      continue;
    }
    if(character==='}'||character===']'){
      if(!stack.length||stack.pop()!==(character==='}'?'{':'['))throw fail();
      if(!stack.length){spans.push({kind:'container',text:text.slice(start,index+1)});start=-1;}
    }
  }
  // A complete earlier object must not hide a second truncated object/string.
  if(stack.length||quoted||escaped)throw fail();
  return spans;
}

function canonicalObject(value,fail,depth=0){
  if(depth>MAX_DEPTH)throw fail();
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw fail();
    return JSON.stringify(value);
  }
  if(Array.isArray(value))return '['+value.map(item=>canonicalObject(item,fail,depth+1)).join(',')+']';
  if(typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw fail();
  const keys=Object.keys(value).sort();
  if(keys.some(key=>FORBIDDEN_KEYS.has(key)))throw fail();
  return '{'+keys.map(key=>JSON.stringify(key)+':'+canonicalObject(value[key],fail,depth+1)).join(',')+'}';
}

/** Return one complete, unambiguous plain JSON object without network repair. */
export function parseNarrative(text){
  if(typeof text!=='string')throw formatError();
  if(text.length>MAX_RESPONSE_BYTES||new TextEncoder().encode(text).byteLength>MAX_RESPONSE_BYTES){
    throw formatError(undefined,'返回内容超过格式整理上限，本月未推进。请缩短本次安排后重试。');
  }
  if(!text.trim())throw formatError(text);
  const fail=()=>formatError(text);
  const source=withoutLeadingThoughts(text,fail);
  const complete=decodeObject(source,fail);
  if(complete.ok){canonicalObject(complete.value,fail);return complete.value;}

  let chosen,canonical;
  for(const span of topLevelValues(source,fail)){
    let candidate;
    if(span.kind==='string'){
      // Quotes in surrounding prose are not payloads. An outer JSON string
      // containing an object is, including when wrapped in a Markdown fence.
      const outer=parseJSON(span.text);
      if(!outer.ok||typeof outer.value!=='string')throw fail();
      if(!outer.value.trim().startsWith('{'))continue;
      candidate=decodeObject(span.text,fail);
    }else candidate=decodeObject(span.text,fail);
    if(!candidate.ok)throw fail();
    const fingerprint=canonicalObject(candidate.value,fail);
    if(chosen!==undefined&&fingerprint!==canonical)throw fail();
    chosen=candidate.value;canonical=fingerprint;
  }
  if(chosen===undefined)throw fail();
  return chosen;
}

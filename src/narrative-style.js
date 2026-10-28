// A display-only pass. Ambiguous wording stays unchanged for validateResponse.
const DISPLAY_FIELDS=['title','narrative','consequence','memory'];
const SUPPORTED_LANGUAGES=new Set(['zh-CN','zh-TW','martian']);
const QUOTE_PAIRS=new Map([['“','”'],['‘','’'],['「','」'],['『','』'],['"','"'],["'","'"]]);
const CONNECTORS=/更(?:进一步|進一步)|进一步|進一步|而且|并且|並且|此外|再者/g;
const PREDICATE=/^(?:了解|研究|调查|調查|核实|核實|核对|核對|确认|確認|检查|檢查|讨论|討論|协商|協商|沟通|溝通|交流|联系|聯繫|合作|学习|學習|处理|處理|解决|解決|整理|工作)/;
const INTRODUCTORY_COMMA=/^[ \t]*[，,][ \t]*(?=[\u3400-\u9fffA-Za-z0-9“‘「『"'（(])/;
const SUBJECT=/^(?:你|伱|我|莪|他|她|它|大家|双方|雙方|各方|这|這|那|当地|當地|家人|父亲|父親|母亲|母親|父母|同事|同学|同學|朋友|老师|老師|医生|醫生|护士|護士|工作人员|工作人員|负责人|負責人|公司|学校|學校|医院|醫院|政府|委员会|委員會)/;
const UNSAFE_STRUCTURE=/不[仅僅但]|甚至|不是|卟昰|而是|而昰|并非|並非/;
const CLAUSE_BOUNDARY=/[。！？!?；;\n，,]/;
const SENTENCE_BOUNDARY=/[。！？!?；;\n]/;
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

function protectedNames(context){
  const names=new Set();
  const add=value=>{if(typeof value==='string'&&value.trim())names.add(value.trim());};
  add(context?.name);
  const cast=context?.explicitCast;
  const characters=Array.isArray(cast)?cast:Array.isArray(cast?.characters)?cast.characters:[];
  for(const character of characters){
    if(typeof character==='string'){add(character);continue;}
    if(!isObject(character))continue;
    add(character.name);
    for(const alias of Array.isArray(character.aliases)?character.aliases:[])add(alias);
    for(const relation of Array.isArray(character.relationships)?character.relationships:[])if(isObject(relation))add(relation.name);
  }
  return [...names].sort((a,b)=>b.length-a.length);
}

function protectedRanges(text,names){
  const ranges=[];
  for(const name of names){
    let from=0,index;
    while((index=text.indexOf(name,from))!==-1){ranges.push([index,index+name.length]);from=index+name.length;}
  }
  const stack=[];
  for(let index=0;index<text.length;index++){
    const character=text[index];
    if(character==='\\'){index++;continue;}
    const top=stack.at(-1);
    if(top&&character===top.close){
      stack.pop();
      ranges.push([top.start,index+1]);
    }else if(QUOTE_PAIRS.has(character)){
      // An ASCII apostrophe inside a Latin word is not an opening quotation.
      if(character==="'"&&/[A-Za-z]/.test(text[index-1]||'')&&/[A-Za-z]/.test(text[index+1]||''))continue;
      stack.push({start:index,close:QUOTE_PAIRS.get(character)});
    }
  }
  // An unfinished quotation is also left intact; this pass cannot finish it.
  for(const quote of stack)ranges.push([quote.start,text.length]);
  return ranges;
}

function boundsAround(text,index,pattern){
  let start=index,end=index;
  while(start>0&&!pattern.test(text[start-1]))start--;
  while(end<text.length&&!pattern.test(text[end]))end++;
  return {start,end};
}

function tidyText(text,language,names,appliedRules){
  const ranges=protectedRanges(text,names),edits=[];
  const protectedAt=(start,end)=>ranges.some(([left,right])=>start<right&&end>left);
  for(const match of text.matchAll(CONNECTORS)){
    const token=match[0],start=match.index,end=start+token.length;
    if(protectedAt(start,end))continue;
    const sentence=boundsAround(text,start,SENTENCE_BOUNDARY);
    if(UNSAFE_STRUCTURE.test(text.slice(sentence.start,sentence.end)))continue;
    const clause=boundsAround(text,start,CLAUSE_BOUNDARY);
    const before=text.slice(clause.start,start),after=text.slice(end);
    const atStart=!before.trim();
    const traditional=language==='zh-TW'||language==='martian'||/[進並]/.test(token);
    let replacement=null,replaceEnd=end,rule='';

    if(token==='更进一步'||token==='更進一步'){
      // Only the completed, standalone predicate can safely become "有了进展".
      // "离目标更进一步" and modal phrases need a substantive rewrite.
      const tail=after.match(/^[ \t]*(?:了|ㄋ)?(?=[。！？!?；;，,\n]|$)/);
      const uncertainPrefix=/(?:离|離|距离|距離|向|往|朝|比|要|想|须|須|需|能|得|可以|能够|能夠|必须|必須|需要|希望|争取|爭取|将|將|会|會|愿|願|若|如果)[^，,。！？!?；;\n]*$/.test(before);
      if(tail&&!uncertainPrefix){
        replacement=traditional?'有了進展':'有了进展';
        replaceEnd=end+tail[0].length;
        rule='standalone-progress';
      }
    }else if(token==='进一步'||token==='進一步'){
      const introductory=after.match(INTRODUCTORY_COMMA);
      if(atStart&&introductory){
        replacement='';replaceEnd=end+introductory[0].length;rule='introductory-progress';
      }else if(!/[前后後上下走跨退迈邁]$/.test(before)){
        const modifier=after.match(/^[ \t]*(?:地[ \t]*)?/)[0];
        if(PREDICATE.test(after.slice(modifier.length))){
          replacement=traditional?'繼續':'继续';replaceEnd=end+modifier.length;rule='predicate-progress';
        }
      }
    }else{
      const introductory=after.match(INTRODUCTORY_COMMA);
      if(atStart&&introductory){
        replacement='';replaceEnd=end+introductory[0].length;rule='introductory-connector';
      }else{
        const whitespace=after.match(/^[ \t]*/)[0],rest=after.slice(whitespace.length);
        const startsSubject=SUBJECT.test(rest)||names.some(name=>rest.startsWith(name));
        if(atStart&&startsSubject){
          replacement='';replaceEnd=end+whitespace.length;rule='clause-connector';
        }else if((token==='而且'||token==='并且'||token==='並且')&&PREDICATE.test(rest)){
          replacement=/也[ \t]*$/.test(before)?'':'也';
          replaceEnd=end+whitespace.length;rule='additive-connector';
        }
      }
    }
    if(replacement===null||protectedAt(start,replaceEnd))continue;
    edits.push({start,end:replaceEnd,replacement});
    appliedRules.add(rule);
  }
  let output='',position=0;
  for(const edit of edits){
    if(edit.start<position)continue;
    output+=text.slice(position,edit.start)+edit.replacement;
    position=edit.end;
  }
  return output+text.slice(position);
}

/** Local display wording only; the caller must still run full validation. */
export function minimallyTidyNarrative(response,context={}){
  if(!isObject(response))return {response,changed:false,appliedRules:[]};
  const result={...response},appliedRules=new Set(),language=context?.language||'zh-CN';
  if(!SUPPORTED_LANGUAGES.has(language))return {response:result,changed:false,appliedRules:[]};
  const names=protectedNames(context);
  let changed=false;
  const transform=text=>{
    if(typeof text!=='string')return text;
    const next=tidyText(text,language,names,appliedRules);
    if(next!==text)changed=true;
    return next;
  };
  for(const field of DISPLAY_FIELDS){
    if(field==='consequence'&&Array.isArray(response.economicUpdates)&&response.economicUpdates.length)continue;
    if(Object.hasOwn(response,field))result[field]=transform(response[field]);
  }
  if(Array.isArray(response.options))result.options=response.options.map(option=>{
    if(!isObject(option))return option;
    const copy={...option};
    // Labels can be parsed as an action. Only explanatory option prose is edited.
    if(Object.hasOwn(option,'description'))copy.description=transform(option.description);
    return copy;
  });
  return {response:result,changed,appliedRules:[...appliedRules]};
}

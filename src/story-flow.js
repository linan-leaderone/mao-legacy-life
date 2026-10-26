const sentences=text=>String(text||'').match(/[^。！？.!?\n]+[。！？.!?]?/g)?.map(s=>s.trim()).filter(Boolean)||[];
const canonical=text=>String(text||'').toLowerCase().replace(/额外的?(?:报酬|酬劳)|另外.{0,4}(?:钱|报酬)/g,'奖金').replace(/单据|核对单|账单/g,'单据').replace(/薪水|薪酬/g,'工资').replace(/整理|核查|核对|校对/g,'核对').replace(/每月|按月|每个月/g,'每月').replace(/[\s，。！？、：；,.!?“”「」]/g,'');
function similarity(a,b){
  a=canonical(a);b=canonical(b);if(!a||!b)return 0;if(a===b||a.length>20&&b.includes(a)||b.length>20&&a.includes(b))return 1;
  const grams=s=>new Set(Array.from({length:Math.max(0,s.length-2)},(_,i)=>s.slice(i,i+3))),x=grams(a),y=grams(b);
  return [...x].filter(g=>y.has(g)).length/Math.max(1,Math.min(x.size,y.size));
}
function facts(text){
  const s=canonical(text),out=[];
  if(/核对/.test(s)&&/单据/.test(s))out.push('check-invoices');
  if(/发|给|领|结算|到账|拿到/.test(s)&&/工资/.test(s))out.push('paid-wages');
  if(/给|发|报酬|奖金/.test(s)&&/每月/.test(s))out.push('recurring-extra-pay');
  if(/捕食|吃掉|吞下|吞食|吞噬/.test(s)&&/小鱼|鱼群/.test(s))out.push('eat-fish');
  return out;
}
const clauses=text=>sentences(text).flatMap(s=>s.replace(/[。！？.!?]$/,'').split(/[，,；;]/)).map(s=>s.trim()).filter(Boolean);
function redundantClause(prior,clause){
  const c=canonical(clause),old=canonical(prior);
  // Never delete an amount, changed identity or consequence merely because the
  // surrounding clause mentions the same kind of work. Only completed actions
  // with a tightly bounded vocabulary can count as semantic repeats.
  if(clauses(prior).some(p=>canonical(p)===c))return true;
  const invoice=/^(?:你(?:又|再次|继续|仍然)?(?:把|将)?)?(?:新一批|新|这批|这一批|所有|这些)?单据(?:逐项|逐张|一一|重新|再次)?核对(?:完毕|完成|完|好|了一遍|无误)?$/.test(c);
  const wages=/^(?:老板|主管|经理|女老板|公司)?(?:给你|向你)?(?:发了|发放了|结算了)工资$|^你(?:领到|收到|拿到)了工资$/.test(c);
  return invoice&&facts(prior).includes('check-invoices')||wages&&facts(prior).includes('paid-wages');
}
export function storyOverlap(consequence,narrative){return clauses(narrative).filter(c=>redundantClause(consequence,c));}
export function storyParagraphs(event,{opening=false}={}){
  const outcome=String(event.consequence||'').trim(),body=String(event.narrative||'').trim();
  if(opening||!outcome)return body;
  if(!body)return outcome;
  const continuation=sentences(body).map(sentence=>{
    const ending=sentence.match(/[。！？.!?]$/)?.[0]||'。';
    return sentence.replace(/[。！？.!?]$/,'').split(/[，,；;]/).filter(c=>!redundantClause(outcome,c)).join('，').trim().replace(/^[，,]+/,'')+(clauses(sentence).every(c=>redundantClause(outcome,c))?'':ending);
  }).filter(s=>!/^\s*[。！？.!?]?\s*$/.test(s)).join('');
  return [outcome,continuation].filter(Boolean).join('\n\n');
}

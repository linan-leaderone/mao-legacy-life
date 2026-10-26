import {selectFactionFlag} from './faction-flags.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function factionFlagMarkup(context,{caption=false}={}){
  if(!context||context.uncertain||context.controlUncertain||context.stage==='historical')return '';
  const value=context.flagContext||{...context,createdByPlayer:context.createdByPlayer||String(context.factionId||'').startsWith('player:')};
  const flag=selectFactionFlag(value);if(!flag)return '';
  return `<span class="faction-flag${flag.adapted?' is-adapted':''}" title="${esc(flag.description||flag.alt)}"><img src="./${esc(flag.src)}" alt="${esc(flag.alt)}" loading="lazy" width="${flag.width}" height="${flag.height}"/>${caption?`<span>${esc(flag.label||'旗帜')}${flag.adapted?' · 拟用标识':''}</span>`:''}</span>`;
}

import manifest from './data/portrait-manifest.json' with {type:'json'};
import {createPixelAvatar} from './pixel-avatars.js';

const normalized = value => String(value || '').normalize('NFKC').trim().toLowerCase();
const overrides = new Map();
const aliases = new Map();
for (const [id, entry] of Object.entries(manifest.people)) {
  for (const key of [id, entry.name, ...(entry.aliases || [])]) aliases.set(normalized(key), {id, ...entry});
}
const hash = value => { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
const profileOf = value => value?.profile || value || {};
const knownOf = profile => aliases.get(normalized(profile.lockedPersonaId || profile.persona?.id || profile.id)) || aliases.get(normalized(profile.name));

/** Stable across calendar jumps, ageing, place changes, reloads and existing save migration. */
export function portraitIdentity(value = {}) {
  const p = profileOf(value), known = knownOf(p), id = p.lockedPersonaId || p.persona?.id || known?.id || p.id || (p.qid ? `wikidata-${p.qid}` : null);
  if (id) return `person:${id}`;
  if (p.portraitContactId) return `original:contact:${hash(p.portraitContactId).toString(36)}`;
  return `original:${hash([p.name || '无名者', p.birthDate || '', p.birthPlace || p.place || '', p.startAgeMonths ?? p.age ?? ''].join('|')).toString(36)}`;
}

function bodyAge(value, profile) {
  const override = value?.person?.ageOverride;
  if (override && Number.isFinite(override.months)) return Math.max(0, Math.floor((override.months + (value.turn ?? value.history?.length ?? 0) - override.turn) / 12));
  if (Number.isFinite(value?.specialLife?.bodyAge)) return value.specialLife.bodyAge;
  if (Number.isFinite(value?.currentAge?.years)) return value.currentAge.years;
  if (profile.birthDate && /^\d{4}/.test(profile.birthDate)) {
    const [year, month = 7, day = 15] = profile.birthDate.split('-').map(Number), elapsed = Math.floor(Number(value.month) || 0);
    const nowYear = 2020 + Math.floor(elapsed / 12), nowMonth = ((elapsed % 12) + 12) % 12 + 1;
    return Math.max(0, Math.floor(((nowYear - year) * 12 + nowMonth - month - (day > 1 ? 1 : 0)) / 12));
  }
  const startMonths = Number.isFinite(profile.startAgeMonths) ? profile.startAgeMonths : (Number.isFinite(Number(profile.age)) ? Number(profile.age) : 20) * 12;
  return Math.max(0, Math.floor((startMonths + (Number(value.month) || 0)) / 12));
}

/** Metadata belongs to portrait management, never appended to monthly narration. */
export function getPortrait(value = {}) {
  if(value.person?.bodyPersonaId){const body=value.person.bodyPersonaId;const person={...value.person};delete person.bodyPersonaId;return getPortrait({...value,person,profile:{...value.profile,lockedPersonaId:body,name:value.person.bodyIdentity||value.profile.name,persona:undefined}});}
  const profile = profileOf(value), known = knownOf(profile), identityKey = portraitIdentity(value), custom = overrides.get(identityKey);
  const age = bodyAge(value, profile), ageVariant = age < 16 ? 'child' : age >= 60 ? 'older' : 'adult';
  const base = {id: known?.id || profile.lockedPersonaId || identityKey, identityKey, name: profile.name || known?.name || '无名者', ageVariant, age, canUpload: true, style: '', sourceStatus: ''};
  const life = value.specialLife;
  if (life?.kind === 'deng_ocean' && ['small_fish', 'predator', 'giant_fish', 'sea_creature', 'amphibious'].includes(life.body)) {
    return {...base, src: './characters/deng-blobfish-pixel.webp', kind: 'special', sourceStatus: 'user-reference', body: life.body, artworkStyle:'anime-pixel', style:'image-rendering:pixelated;'};
  }
  if (custom) return {...base, src: custom.src, kind: 'custom', sourceStatus: 'user-upload', updatedAt: custom.updatedAt};
  if (known?.src) return {...base, src: known.src, ...(known.standingSrc ? {standingSrc:known.standingSrc} : {}), kind: 'character', sourceStatus: known.sourceType, reference: known.reference, portraitAge: known.portraitAge ?? null, artworkStyle:known.artworkStyle || '', style:known.artworkStyle === 'anime-pixel' ? 'image-rendering:pixelated;' : ''};
  const hidden = !!(profile.lockedPersonaId || profile.persona?.id || profile.qid || profile.id || known);
  if (hidden) return {...base, src: null, kind: 'missing', sourceStatus: 'pending-reference'};
  const sex = profile.identity?.sex;
  const presentation = ['male', 'female', 'neutral'].includes(profile.portraitPresentation) ? profile.portraitPresentation : ['male','female'].includes(sex) ? sex : 'neutral';
  const generated = createPixelAvatar({seed:value.seed ?? profile.seed ?? '',identity:identityKey,presentation,ageVariant});
  return {...base,...generated,kind:'original',sourceStatus:'generated-pixel',presentation};
}

/** A stable contact id is an ordinary fictional person, not a missing historical-person record. */
export function contactPortraitValue(state = {}, node = {}) {
  if (node.id === 'player') return state;
  return {seed:state.seed,profile:{name:node.name || '无名者',portraitContactId:node.id || node.name, ...(node.personaId ? {lockedPersonaId:node.personaId} : node.referenceRequired ? {id:node.id || node.name} : {})}};
}

export function getContactPortrait(state, node) { return getPortrait(contactPortraitValue(state,node)); }

export const PORTRAIT_COVERAGE = Object.freeze({version: manifest.version, ready: Object.keys(manifest.people).filter(id => manifest.people[id].src).length, originals: manifest.originals.length, generatedStyle:'anime-pixel', missingPolicy: 'leave-empty-until-reference'});

export function isSafePortraitDataUrl(value) {
  return typeof value === 'string' && value.length <= 1_500_000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value);
}

let databasePromise;
function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('此环境无法保存本机立绘，请使用支持本机存储的浏览器。'));
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('mao-legacy-portraits', 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('portraits')) request.result.createObjectStore('portraits', {keyPath:'key'}); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('未能打开立绘存储。'));
  });
  return databasePromise;
}

export async function loadPortraitOverrides() {
  if (!globalThis.indexedDB) return 0;
  try {
    const db = await openDatabase();
    const rows = await new Promise((resolve, reject) => {
      const request = db.transaction('portraits').objectStore('portraits').getAll();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    for (const row of rows) if (typeof row.key === 'string' && /^(person|original):/.test(row.key) && isSafePortraitDataUrl(row.src)) overrides.set(row.key, row);
    return overrides.size;
  } catch { return 0; }
}

async function writeRecord(record, remove = false) {
  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('portraits', 'readwrite'), store = tx.objectStore('portraits');
    if (remove) store.delete(record.key); else store.put(record);
    tx.oncomplete = resolve; tx.onerror = () => reject(new Error('立绘没有保存成功，原有图片仍然保留。'));
    tx.onabort = () => reject(new Error('立绘保存被中断。'));
  });
}

/** Uploads stay on this device. No remote request and no API credentials enter this storage. */
export async function setCustomPortrait(value, file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 12_000_000) throw new Error('请选择 12 MB 以内的 PNG、JPG 或 WebP 图片。');
  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('这张图片无法读取。')); image.src = url; });
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 60_000_000) throw new Error('图片尺寸过大，请换用较小的图片。');
    const scale = Math.min(1, 720 / img.naturalWidth, 1080 / img.naturalHeight), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    let src = canvas.toDataURL('image/webp', .86);
    if (!isSafePortraitDataUrl(src)) src = canvas.toDataURL('image/jpeg', .8);
    if (!isSafePortraitDataUrl(src)) throw new Error('压缩后的图片仍过大，请选择较小的图片。');
    const record = {key: portraitIdentity(value), src, updatedAt: new Date().toISOString()};
    await writeRecord(record); overrides.set(record.key, record);
    return getPortrait(value);
  } finally { URL.revokeObjectURL(url); }
}

export async function clearCustomPortrait(value) {
  const key = portraitIdentity(value); await writeRecord({key}, true); overrides.delete(key); return getPortrait(value);
}

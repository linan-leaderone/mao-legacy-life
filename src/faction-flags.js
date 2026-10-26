import catalog from './data/faction-flags.json' with {type:'json'};

const normalized = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/[\s·・._\-()（）]/g, '');
const entries = Object.values(catalog.flags).filter(entry => entry.visible !== false);
const byId = new Map(entries.map(entry => [normalized(entry.id), entry]));
const byTag = new Map();
const byName = new Map();
const ideologies = new Map();
const countryTags = catalog.countryTags;
for (const entry of entries) {
  if (entry.tag) byTag.set(entry.tag, [...(byTag.get(entry.tag) || []), entry]);
  // Only exact localized names count as identity. A general word such as
  // "socialist" never establishes that a newly named faction already exists.
  if (!entry.ideologyId) for (const name of entry.names) {
    const key = normalized(name);
    if (key.length < 2) continue;
    byName.set(key, [...(byName.get(key) || []), entry]);
  }
}
for (const [group, metadata] of Object.entries(catalog.ideologyGroups)) {
  for (const name of [group, metadata.name, ...metadata.subtypes]) if (name) ideologies.set(normalized(name), group);
}
const regionTags = {
  china:'PRC', 中国:'PRC', 中国大陆:'PRC', 中华人民共和国:'PRC',
  taiwan:'CHI', 台湾:'CHI', 中国台湾:'CHI', japan:'JAP', 日本:'JAP',
  korea:'KOR', 韩国:'KOR', 朝鲜:'PRK', russia:'SOV', 俄罗斯:'SOV',
  hongkong:'PRC', 香港:'PRC', macau:'PRC', 澳门:'PRC',
};
const familyGroups = {
  left: ['totalitarian_socialist', 'communist', 'libertarian_socialist', 'social_democrat'],
  liberal: ['social_liberal', 'market_liberal'],
  right: ['conservative', 'authoritarian_democrat'],
  nationalist: ['nationalist', 'fascist', 'national_socialist'],
  monarchist: ['monarchist'],
};
const familyOf = group => Object.keys(familyGroups).find(family => familyGroups[family].includes(group)) || null;
// These IDs are written only after the corresponding actor has entered the
// current world state. They disambiguate names shared by occupation cosmetics.
const currentFactionFlags = {
  japan_left:{tag:'TSU'}, japan_left_reconstruction:{tag:'TSU'},
  japan_junta:{tag:'JAP', cosmeticTag:'JAP_military_junta'},
  japan_republic:{tag:'JAP', cosmeticTag:'JAP_udf'},
  taiwan_left:{tag:'TZL', cosmeticTag:'TZL_SOC'}, taiwan_kmt:{tag:'KMT'}, taiwan_revanchist:{tag:'TJJ'},
  china_leftfront:{tag:'CHF', cosmeticTag:'PRC_GH'},
  china_republic:{tag:'CHF', cosmeticTag:'PRC_GH'},
  china_digital:{tag:'CHF', cosmeticTag:'PRC_GH'},
  china_qin:{tag:'CHF', cosmeticTag:'PRC_GH'},
  china_commune:{tag:'PRC', cosmeticTag:'PRC_AM'},
  china_han:{tag:'PRC', cosmeticTag:'PRC_HACHIMI_FLAG'},
  // The cyber-Mao script sets PRC_HACHIMI, but the MOD has no image by that
  // name. Preserve the original TAG fallback instead of inventing a cosmetic.
  china_cybermao:{tag:'PRC', cosmeticTag:'PRC_HACHIMI'},
  // These accession events have no flag-changing effect. Unused cosmetic
  // assets with a suggestive name are not evidence of an actual flag change.
  china_bo:{tag:'PRC'}, china_chen:{tag:'PRC'}, china_mao:{tag:'PRC'},
};

export const factionFlagCounts = Object.freeze({...catalog.counts});

function asTag(value) {
  const raw = String(value || '').trim();
  const upper = raw.toUpperCase();
  return countryTags[upper] ? upper : catalog.geographicTags[upper] || regionTags[raw.toLowerCase()] || null;
}

function asGeographicTag(value) {
  const raw = String(value || '').replace(/^country:/i, '').trim();
  const upper = raw.toUpperCase();
  // HOI4 AUS is Austria and MAC is North Macedonia; ISO AUS is Australia and
  // MAC is Macau. Never route an ISO identity through the TAG lookup first.
  return catalog.geographicTags[upper] || ({HKG:'PRC', MAC:'PRC'})[upper] || regionTags[raw.toLowerCase()] || null;
}

function factionNameMatch(value, preferredTag) {
  const candidates = byName.get(normalized(value)) || [];
  if (!candidates.length) return null;
  const preferred = candidates.filter(entry => entry.tag === preferredTag);
  const choices = preferred.length ? preferred : candidates;
  if (choices.length === 1) return choices[0];
  // Repeated localization may attach the same country name to several
  // cosmetics. Use its base flag only if they really share one identity.
  if (choices.every(entry => entry.tag && entry.tag === choices[0].tag)) return byId.get(normalized(choices[0].tag)) || null;
  return null;
}

function groupFromText(value) {
  const direct = ideologies.get(normalized(value));
  if (direct) return direct;
  const text = String(value || '').toLowerCase();
  for (const [pattern, group] of [
    [/民族社会主义|national[ _-]socialis|纳粹/, 'national_socialist'],
    [/法西斯|fascis/, 'fascist'],
    [/君主|王国|帝国|monarch|kingdom|imperial/, 'monarchist'],
    [/社会民主|社民|social[ _-]democra/, 'social_democrat'],
    [/自由社会主义|无政府|公社|libertarian[ _-]social|anarch|commune/, 'libertarian_socialist'],
    [/毛主义|毛泽东思想|极权社会主义|maoism|totalitarian[ _-]social/, 'totalitarian_socialist'],
    [/共产|社会主义|马列|革命左翼|communis|socialist|marxis/, 'communist'],
    [/市场自由|market[ _-]liberal/, 'market_liberal'],
    [/社会自由|自由民主|social[ _-]liberal|liberal[ _-]democra/, 'social_liberal'],
    [/保守|conservativ/, 'conservative'],
    [/民族主义|nationalis/, 'nationalist'],
    [/军政府|军事管制|威权|junta|authoritarian/, 'authoritarian_democrat'],
  ]) if (pattern.test(text)) return group;
  return null;
}

function politicalGroup(input) {
  // A dynamic Chinese ideology describes the present, even if an old save
  // retained the baseline's machine-readable ideology ID and group alongside it.
  const current = groupFromText(input.ideology);
  if (current) return current;
  for (const field of ['ideologyGroup', 'ideologyId']) {
    const direct = ideologies.get(normalized(input[field]));
    if (direct) return direct;
  }
  return groupFromText([input.government, input.name, input.faction].filter(Boolean).join(' '));
}

function variant(base, input, group) {
  const compatibleSubtype = !group || ideologies.get(normalized(input.ideologyId)) === group ? input.ideologyId : null;
  for (const suffix of [compatibleSubtype, group].filter(Boolean)) {
    const found = byId.get(normalized(`${base}_${suffix}`));
    if (found) return found;
  }
  return byId.get(normalized(base)) || null;
}

function describe(entry, match, confidence, adapted) {
  const name = entry.names[0] || countryTags[entry.tag]?.name || entry.id;
  const description = adapted
    ? `依照所在地与政治取向选用的标识，图案取自${name}。`
    : `旗帜取自${name}的现有标识。`;
  return {
    src: entry.src, alt: `${name}旗帜${adapted ? '（拟用）' : ''}`, label: name,
    sourceId: entry.id, sourceTag: entry.tag, match, confidence, adapted,
    description, width: entry.width, height: entry.height, quality: entry.quality,
  };
}

/** Choose from observed/current identity only. The catalog contains future
 * assets but this function never schedules events, enumerates future actors,
 * mutates a save, or sends its unused records to the narrative model.
 *
 * src is relative to the app base, as with other public image assets.
 * adapted=true is a suggested emblem for a newly created faction, not a claim
 * that the faction has an official historical flag. Confidence is a match score.
 */
export function selectFactionFlag(input = {}) {
  const group = politicalGroup(input);
  const regime = currentFactionFlags[input.factionId];
  const regimeTag = regime?.tag;
  const explicitTag = asTag(input.controllerTag || regimeTag || input.tag);
  const geographicTag = asGeographicTag(input.iso) || asGeographicTag(input.region);
  const tag = explicitTag || geographicTag;
  const invented = Boolean(input.createdByPlayer || input.playerCreated);
  const cosmetic = input.cosmeticTag || input.flagId || (!invented && (!input.controllerTag || input.controllerTag === regimeTag) ? regime?.cosmeticTag : null);
  if (cosmetic) {
    const exact = variant(cosmetic, input, group);
    if (exact) return describe(exact, 'cosmetic', 1, invented);
  }
  if (!invented) {
    if ((input.controllerTag || regimeTag) && explicitTag) {
      const controlled = variant(explicitTag, input, group);
      if (controlled) return describe(controlled, controlled.ideologyId ? 'tag-ideology' : 'tag', 1, false);
    }
    const named = factionNameMatch(input.name || input.faction, explicitTag);
    if (named) {
      const exact = variant(named.cosmeticTag || named.id, input, group) || named;
      return describe(exact, 'name', 1, false);
    }
    if (tag) {
      const exact = variant(tag, input, group);
      if (exact) return describe(exact, exact.ideologyId ? 'tag-ideology' : 'tag', explicitTag ? 1 : 0.9, false);
    }
  }
  // New factions borrow the closest available emblem deterministically. Region
  // matters first, then explicit ideology, then its broader political family.
  // Ties use the source ID, never random numbers or the date of rendering.
  const family = familyOf(group);
  const candidates = entries.map(entry => {
    let score = 0;
    if (tag && entry.tag === tag) score += 80;
    else if (input.iso && entry.iso === String(input.iso).toUpperCase()) score += 65;
    if (group && entry.ideologyGroups.includes(group)) score += 35;
    else if (family && entry.ideologyGroups.some(value => familyOf(value) === family)) score += 12;
    if (entry.id === entry.tag) score += 2;
    if (entry.quality === 'standard') score += 2;
    return {entry, score};
  }).filter(candidate => candidate.score >= 12).sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id, 'en'));
  if (!candidates.length) return null;
  const best = candidates[0];
  return describe(best.entry, 'matched-emblem', Math.min(0.85, Math.round(best.score / 120 * 100) / 100), true);
}

export function factionFlagSource(id) {
  const entry = byId.get(normalized(id));
  return entry ? {id: entry.id, ...entry.source, width: entry.width, height: entry.height, quality: entry.quality} : null;
}

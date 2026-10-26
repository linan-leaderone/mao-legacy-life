import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import catalog from '../src/data/faction-flags.json' with {type:'json'};
import {selectFactionFlag, factionFlagSource, factionFlagCounts} from '../src/faction-flags.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('all catalog flags have intact, native-sized PNG assets and a MOD source', () => {
  assert.equal(factionFlagCounts.catalogFlags, 2375);
  assert.equal(factionFlagCounts.failedImages, 0);
  const used = new Set();
  for (const entry of Object.values(catalog.flags)) {
    assert.match(entry.source.path, /^gfx\/flags\/(?:medium\/|small\/)?[^/]+\.(?:tga|png|dds)$/i);
    assert.match(entry.source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(['standard', 'medium', 'small'].includes(entry.quality));
    used.add(entry.src);
    const asset = catalog.assets[path.basename(entry.src)];
    assert.equal(asset.width, entry.width);
    assert.equal(asset.height, entry.height);
  }
  assert.equal(used.size, factionFlagCounts.uniqueImages);
  assert.ok(used.size < factionFlagCounts.catalogFlags, 'duplicate pixels share one asset');
  let bytes = 0;
  for (const [name, asset] of Object.entries(catalog.assets)) {
    const payload = fs.readFileSync(path.join(root, 'public/flags', name));
    assert.deepEqual([...payload.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
    assert.equal(payload.readUInt32BE(16), asset.width);
    assert.equal(payload.readUInt32BE(20), asset.height);
    assert.equal(createHash('sha256').update(payload).digest('hex'), asset.sha256);
    assert.equal(payload.length, asset.bytes);
    bytes += payload.length;
  }
  assert.equal(bytes, factionFlagCounts.imageBytes);
  assert.ok(bytes < 5_000_000);
});

test('full standard flags win over reduced duplicates; unique small flags retain real size', () => {
  assert.equal(factionFlagSource('PRC').quality, 'standard');
  assert.deepEqual([factionFlagSource('PRC').width, factionFlagSource('PRC').height], [82, 52]);
  assert.equal(factionFlagSource('PRK_fascist').quality, 'small');
  assert.ok(factionFlagSource('PRK_fascist').width < 40);
  assert.equal(selectFactionFlag({tag:'PRK', ideologyGroup:'fascist'}).sourceId, 'PRK_fascist');
});

test('opening TAG does not select a future cosmetic; an explicit current cosmetic does', () => {
  assert.equal(selectFactionFlag({tag:'JAP', ideologyGroup:'conservative'}).sourceTag, 'JAP');
  assert.equal(selectFactionFlag({tag:'PRC'}).sourceId, 'PRC');
  const changed = selectFactionFlag({tag:'PRC', cosmeticTag:'PRC_GHGLS', ideologyGroup:'totalitarian_socialist'});
  assert.equal(changed.sourceId, 'PRC_GHGLS_totalitarian_socialist');
  assert.equal(changed.match, 'cosmetic');
  assert.equal(changed.adapted, false);
  assert.equal(selectFactionFlag({name:'台湾左翼联盟', tag:'CHI'}).sourceTag, 'TZL');
  assert.equal(selectFactionFlag({factionId:'japan_left', name:'日本社会主义共和国', tag:'JAP'}).sourceTag, 'TSU');
  assert.equal(selectFactionFlag({factionId:'taiwan_left', tag:'CHI'}).sourceTag, 'TZL');
  assert.equal(catalog.flags.GER_uprising_cosmetic.visible, false, 'transparent source placeholder stays catalogued');
  assert.equal(selectFactionFlag({tag:'GER', cosmeticTag:'GER_uprising_cosmetic'}).sourceId, 'GER', 'invisible source placeholder cannot hide the faction flag');
});

test('controller TAG takes precedence over the geographic country and its display name', () => {
  const flag = selectFactionFlag({iso:'SYR', tag:'SYR', controllerTag:'ROJ', name:'叙利亚'});
  assert.equal(flag.sourceTag, 'ROJ');
  assert.equal(selectFactionFlag({iso:'AFG', controllerTag:'TAL'}).sourceTag, 'TAL');
});

test('public route identities use evidenced MOD cosmetics and do not invent unused ones', () => {
  for (const factionId of ['china_leftfront', 'china_republic', 'china_digital', 'china_qin']) {
    assert.equal(selectFactionFlag({tag:'PRC', factionId}).sourceId, 'PRC_GH');
  }
  assert.equal(selectFactionFlag({tag:'PRC', factionId:'china_commune'}).sourceId, 'PRC_AM');
  assert.equal(selectFactionFlag({tag:'PRC', factionId:'china_han'}).sourceId, 'PRC_HACHIMI_FLAG');
  for (const factionId of ['china_chen', 'china_bo', 'china_mao', 'china_cybermao']) {
    assert.equal(selectFactionFlag({tag:'PRC', factionId}).sourceId, 'PRC');
  }
  assert.equal(selectFactionFlag({tag:'JAP', factionId:'japan_junta'}).sourceId, 'JAP_military_junta');
  assert.equal(selectFactionFlag({tag:'JAP', factionId:'japan_republic'}).sourceId, 'JAP_udf');
  assert.equal(selectFactionFlag({tag:'CHI', factionId:'taiwan_left'}).sourceId, 'TZL_SOC');
});

test('ISO identities never get confused with HOI4 TAGs', () => {
  assert.equal(selectFactionFlag({iso:'AUS'}).sourceTag, 'AST');
  assert.equal(selectFactionFlag({tag:'AUS'}).sourceTag, 'AUS');
  assert.equal(selectFactionFlag({iso:'MAC'}).sourceTag, 'PRC');
  assert.equal(selectFactionFlag({tag:'MAC'}).sourceTag, 'MAC');
  assert.equal(selectFactionFlag({region:'country:AUS'}).sourceTag, 'AST');
});

test('current ideology text supersedes stale ideology ID and group', () => {
  const flag = selectFactionFlag({tag:'JAP', ideologyGroup:'conservative', ideologyId:'right_populism', ideology:'共产主义'});
  assert.equal(flag.sourceId, 'JAP_communist');
  assert.equal(flag.match, 'tag-ideology');
});

test('new factions receive reproducible contextual emblems explicitly marked as adapted', () => {
  const input = {iso:'JPN', region:'japan', tag:'JAP', name:'北方劳动者公社', ideology:'无政府共产主义', createdByPlayer:true};
  const before = structuredClone(input);
  const flag = selectFactionFlag(input);
  for (let i = 0; i < 10; i++) assert.deepEqual(selectFactionFlag(input), flag);
  assert.deepEqual(input, before);
  assert.equal(flag.sourceTag, 'JAP');
  assert.equal(flag.sourceId, 'JAP_libertarian_socialist');
  assert.equal(flag.adapted, true);
  assert.equal(flag.match, 'matched-emblem');
  assert.ok(flag.confidence < 1);
  assert.match(flag.alt, /拟用/);
  assert.equal(selectFactionFlag({name:'完全未知的遥远星系'}), null);
});

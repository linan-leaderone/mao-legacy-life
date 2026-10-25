import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCharacterIdentity,characterIdentityFromForm,identityRows} from '../src/character-identity.js';
test('identity preserves custom biological, nonhuman and extraterrestrial descriptions independently',()=>{
  const raw={sex:'custom',sexLabel:'周期变换型',sexDescription:'随季节改变身体性别',ethnicity:'硅基人',ethnicityDescription:'出生于海底城市',nationality:'火星联合体',nationalityDescription:'公民由居住登记取得'};
  const record=characterIdentityFromForm(raw);assert.deepEqual(record,raw);assert.deepEqual(identityRows(record).map(row=>row.value),['周期变换型','硅基人','火星联合体']);assert.deepEqual(normalizeCharacterIdentity(JSON.parse(JSON.stringify(record)),{strict:true}),raw);
});
test('missing old identities stay unspecified and fixed options cannot be relabeled',()=>{
  assert.deepEqual(identityRows(normalizeCharacterIdentity()),[]);assert.equal(normalizeCharacterIdentity({sex:'intersex',sexLabel:'male'}).sexLabel,'双性人');assert.throws(()=>characterIdentityFromForm({sex:'custom'}),/填写/);
});
test('import rejects malformed identity data while input normalization bounds prose',()=>{
  for(const raw of [[],null,{sex:'invented'},{ethnicity:{}},{nationalityDescription:'x'.repeat(1001)}])assert.throws(()=>normalizeCharacterIdentity(raw,{strict:true}));
  assert.equal(normalizeCharacterIdentity({sex:'custom',sexLabel:'x'.repeat(90)}).sexLabel.length,80);
});

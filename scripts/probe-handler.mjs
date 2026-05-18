// Direct handler invocation (no vercel dev needed).
// Verifies api/character-detail.js returns equippedSet + setEval and oath when extras=oath.
import handler from '../api/character-detail.js';

function mockResStream() {
  const res = { _status: 200, _headers: {}, _body: null };
  res.setHeader = (k, v) => { res._headers[k] = v; };
  res.status = (c) => { res._status = c; return res; };
  res.json = (b) => { res._body = b; return res; };
  return res;
}

async function run(query) {
  const res = mockResStream();
  await handler({ query }, res);
  return res._body;
}

const Q = { serverId: 'casillas', characterId: '56a81575c814e829392349dfa43e80e6' };

console.log('--- without extras ---');
const a = await run(Q);
console.log('keys:', Object.keys(a));
console.log('equippedSet:', a.equippedSet);
console.log('setEval:', a.setEval);
console.log('oath (should be null):', a.oath);

console.log('\n--- with extras=oath ---');
const b = await run({ ...Q, extras: 'oath' });
console.log('oath?.info.itemName:', b.oath?.info?.itemName);
console.log('oath?.setInfo.setName:', b.oath?.setInfo?.setName);
console.log('oath?.setInfo.active.setPoint:', b.oath?.setInfo?.active?.setPoint);
console.log('oath?.crystal length:', b.oath?.crystal?.length);

console.log('\n--- with extras=mist,avatar,creature ---');
const c = await run({ ...Q, extras: 'mist,avatar,creature' });
console.log('mist?.level:', c.mist?.level);
console.log('avatar count:', Array.isArray(c.avatar) ? c.avatar.length : 'n/a');
console.log('creature?.itemName:', c.creature?.itemName);
console.log('creature artifact count:', c.creature?.artifact?.length);

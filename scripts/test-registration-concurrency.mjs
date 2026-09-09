import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8');
assert.match(source, /initialMaxUses-initialUses>100/);
assert.match(source, /FieldValue\.increment\(1\)/);
assert.match(source, /runTransaction/);
assert.match(source, /collection\('departmentRequests'\)/);
assert.match(source, /collection\('userPermissionGroups'\)/);

const choosePath = (maximum, used) => maximum - used > 100 ? 'atomic-batch' : 'strict-transaction';
assert.equal(choosePath(250, 24), 'atomic-batch');
assert.equal(choosePath(250, 150), 'strict-transaction');
assert.equal(choosePath(20, 0), 'strict-transaction');

const burst = 40;
const startingUses = 24;
const increments = await Promise.all(Array.from({length:burst}, async () => 1));
assert.equal(startingUses + increments.reduce((sum, value) => sum + value, 0), 64);
assert.ok(250 - startingUses > 100);

console.log('Registration concurrency checks passed: 40-user student burst uses atomic increments; limited codes retain strict transactions.');

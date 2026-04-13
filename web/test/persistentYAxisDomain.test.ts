import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildWorkspaceYAxisStorageKey,
  domainsEqual,
  loadStoredYAxisDomain,
  mergeRememberedDomain,
  parseStoredDomain,
  persistStoredYAxisDomain,
  resetStoredYAxisDomain,
} from '../src/components/charts/persistentYAxisDomain.ts';

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

test('buildWorkspaceYAxisStorageKey namespaces run-page chart domains', () => {
  assert.equal(
    buildWorkspaceYAxisStorageKey('run:demand-by-sector'),
    'simple-msm.workspace-y-axis.v1.run:demand-by-sector',
  );
});

test('parseStoredDomain accepts valid tuples and rejects invalid payloads', () => {
  assert.deepEqual(parseStoredDomain('[-20, 80]'), [-20, 80]);

  for (const raw of [
    null,
    '',
    'not-json',
    '[]',
    '[0]',
    '[0, 1, 2]',
    '["0", 1]',
    '[0, null]',
    '[0, null]',
    '[Infinity, 1]',
    '[10, 5]',
    '{"min":0,"max":1}',
  ]) {
    assert.equal(parseStoredDomain(raw), null);
  }
});

test('mergeRememberedDomain expands outward and never shrinks the stored range', () => {
  assert.deepEqual(mergeRememberedDomain(null, [10, 40]), [10, 40]);
  assert.deepEqual(mergeRememberedDomain([0, 100], [20, 80]), [0, 100]);
  assert.deepEqual(mergeRememberedDomain([10, 20], [0, 30]), [0, 30]);
  assert.deepEqual(mergeRememberedDomain([-10, 20], [-25, 15]), [-25, 20]);
});

test('domainsEqual only matches identical finite domains', () => {
  assert.equal(domainsEqual([0, 10], [0, 10]), true);
  assert.equal(domainsEqual([0, 10], [0, 11]), false);
  assert.equal(domainsEqual(null, [0, 10]), false);
  assert.equal(domainsEqual([0, Number.POSITIVE_INFINITY], [0, Number.POSITIVE_INFINITY]), false);
});

test('stored domains stay isolated per chart key', () => {
  const storage = createMemoryStorage();

  persistStoredYAxisDomain('run:demand-by-sector', [90, 140], storage);
  persistStoredYAxisDomain('run:cost-by-component', [-50, 200], storage);

  assert.deepEqual(loadStoredYAxisDomain('run:demand-by-sector', storage), [90, 140]);
  assert.deepEqual(loadStoredYAxisDomain('run:cost-by-component', storage), [-50, 200]);
});

test('resetStoredYAxisDomain replaces the remembered range with the current auto-fit range', () => {
  const storage = createMemoryStorage();

  persistStoredYAxisDomain('run:emissions-by-sector', [-100, 400], storage);
  resetStoredYAxisDomain('run:emissions-by-sector', [-20, 150], storage);

  assert.deepEqual(loadStoredYAxisDomain('run:emissions-by-sector', storage), [-20, 150]);
});

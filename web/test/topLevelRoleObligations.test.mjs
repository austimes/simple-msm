import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parseCsv } from '../src/data/parseCsv.ts';

const PACKAGE_ROOT = join(import.meta.dirname, '../../energy_system_representation_library');

// Allowlist for top-level roles whose role_id matches the residual/remaining
// guardrail pattern below. These exist only because the underlying schema
// cannot yet express them as decomposition children of a richer role.
//
// `account_residual_mining_energy` was kept top-level after the
// [top-level-ontology-v1] epic deferred its reallocation into the supply
// roles (the `commodity_supply` host schema currently cannot carry the
// baseline anchor). Tracked as the unblocker bd issue
// `simple-msm-21mk.8`; the deferral itself is bd `simple-msm-21mk.6`.
const RESIDUAL_TOP_LEVEL_ALLOWLIST = new Set([
  'account_residual_mining_energy',
]);

test('no top-level role uses an account_remaining_* or account_residual_* placeholder id', () => {
  const text = readFileSync(join(PACKAGE_ROOT, 'shared/roles.csv'), 'utf8');
  const roles = parseCsv(text);
  const topLevelRoles = roles.filter((role) => role.parent_role_id === '');
  assert.equal(topLevelRoles.length > 0, true, 'expected at least one top-level role');

  const offenders = topLevelRoles.filter((role) => {
    if (RESIDUAL_TOP_LEVEL_ALLOWLIST.has(role.role_id)) return false;
    return /^account_(remaining|residual)_/.test(role.role_id);
  });

  assert.deepEqual(
    offenders.map((role) => role.role_id),
    [],
    'top-level role ids must describe durable coverage obligations, not residual placeholders',
  );
});

test('residual top-level allowlist only contains roles that actually exist top-level', () => {
  const text = readFileSync(join(PACKAGE_ROOT, 'shared/roles.csv'), 'utf8');
  const roles = parseCsv(text);
  const topLevelRoleIds = new Set(
    roles.filter((role) => role.parent_role_id === '').map((role) => role.role_id),
  );

  for (const allowlisted of RESIDUAL_TOP_LEVEL_ALLOWLIST) {
    assert.equal(
      topLevelRoleIds.has(allowlisted),
      true,
      `${allowlisted} is allowlisted as a top-level residual placeholder but is not a top-level role; remove it from the allowlist`,
    );
  }
});

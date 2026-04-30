import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

function webSrcFiles() {
  return execFileSync('rg', ['--files', '--no-ignore', 'src'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .filter((file) => /\.(ts|tsx|mjs|json)$/.test(file));
}

test('web source does not expose retired service/state compatibility terms', () => {
  const retiredTerm = /\b(SectorState|sectorStates|service_controls|active_state_ids|autonomous_modes_by_output|selectedSector|selectedSubsector|selectedTrajectoryId|SectorCatalogEntry|SubsectorCatalogEntry|RightSidebarSectorNode|RightSidebarSubsectorNode|inactive_state|stateShares|stateId|stateLabel|other_state_change)\b/;
  const offenders = webSrcFiles().filter((file) => {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    return retiredTerm.test(text);
  });

  assert.deepEqual(offenders, []);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { buildPackageEnrichment } from '../src/data/packageCompanions.ts';
import { CONFIGURATION_YEARS } from '../src/data/types.ts';
import {
  buildStateSchemaSections,
  buildWorkedExampleStateFamily,
  getStateSchemaMilestoneYears,
  STATE_SCHEMA_PREFERRED_EXAMPLE_STATE_ID,
} from '../src/pages/stateSchemaModel.ts';
import { loadPkg } from './solverTestUtils.mjs';

function readText(relativePath: string): string {
  const url = new URL(relativePath, import.meta.url);
  return readFileSync(url, 'utf8');
}

const schemaInfo = buildPackageEnrichment({
  'data/sector_states_schema.json': readText('../../aus_phase1_sector_state_library/data/sector_states_schema.json'),
}).sectorStatesSchema;

describe('stateSchemaModel', () => {
  test('groups every schema field exactly once and preserves CSV order', () => {
    assert.ok(schemaInfo, 'expected schema info to be available for grouping');
    assert.equal(
      schemaInfo.fields.every((field) => field.description.trim().length > 0),
      true,
      'expected every schema field to carry a description',
    );

    const sections = buildStateSchemaSections(schemaInfo);
    const groupedFieldNames = sections.flatMap((section) =>
      section.fields.map((field) => field.name),
    );

    assert.deepEqual(
      groupedFieldNames,
      schemaInfo.fields.map((field) => field.name),
    );
    assert.equal(new Set(groupedFieldNames).size, groupedFieldNames.length);
  });

  test('derives milestone years from CONFIGURATION_YEARS', () => {
    assert.deepEqual(getStateSchemaMilestoneYears(), [...CONFIGURATION_YEARS]);
  });

  test('prefers the packaged electricity example family when it is present', () => {
    const example = buildWorkedExampleStateFamily(loadPkg().sectorStates);

    assert.ok(example, 'expected an example family');
    assert.equal(example.stateId, STATE_SCHEMA_PREFERRED_EXAMPLE_STATE_ID);
    assert.deepEqual(
      example.rows.map((row) => row.year),
      [...CONFIGURATION_YEARS],
    );
  });

  test('falls back to the first available family when the preferred family is absent', () => {
    const sectorStates = loadPkg().sectorStates.filter(
      (row) => row.state_id !== STATE_SCHEMA_PREFERRED_EXAMPLE_STATE_ID,
    );
    const expectedFallbackId = Array.from(new Set(sectorStates.map((row) => row.state_id))).sort(
      (left, right) => left.localeCompare(right),
    )[0];
    const example = buildWorkedExampleStateFamily(sectorStates);

    assert.ok(example, 'expected a fallback example family');
    assert.equal(example.stateId, expectedFallbackId);
  });

  test('returns an empty section list when schema info is missing', () => {
    assert.deepEqual(buildStateSchemaSections(null), []);
  });
});

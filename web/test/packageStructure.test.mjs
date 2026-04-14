import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parseCsv } from '../src/data/parseCsv.ts';

const PACKAGE_ROOT = join(import.meta.dirname, '../../sector_trajectory_library');
const MILESTONE_YEARS = ['2025', '2030', '2035', '2040', '2045', '2050'];

function readText(relativePath) {
  return readFileSync(join(PACKAGE_ROOT, relativePath), 'utf8');
}

function parseJsonArray(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    assert.fail(`${label} should parse as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

test('sector trajectory library package structure is internally consistent', () => {
  const families = parseCsv(readText('shared/families.csv'));
  const owners = new Set(parseCsv(readText('shared/owners.csv')).map((row) => row.owner_id));
  const sourceIds = new Set(parseCsv(readText('shared/source_ledger.csv')).map((row) => row.source_id));
  const assumptionIds = new Set(parseCsv(readText('shared/assumptions_ledger.csv')).map((row) => row.assumption_id));
  const demandCurveIds = new Set(parseCsv(readText('shared/demand_growth_curves.csv')).map((row) => row.demand_growth_curve_id));

  assert.equal(families.length, 14);

  let totalRows = 0;
  const stateIds = new Set();

  for (const family of families) {
    const familyDir = join(PACKAGE_ROOT, 'families', family.family_id);
    assert.equal(existsSync(join(familyDir, 'family_states.csv')), true, `${family.family_id} missing family_states.csv`);
    assert.equal(existsSync(join(familyDir, 'demand.csv')), true, `${family.family_id} missing demand.csv`);
    assert.equal(existsSync(join(familyDir, 'README.md')), true, `${family.family_id} missing README.md`);
    assert.equal(existsSync(join(familyDir, 'validation.md')), true, `${family.family_id} missing validation.md`);

    assert.equal(owners.has(family.maintainer_owner_id), true, `${family.family_id} maintainer owner must resolve`);
    assert.equal(owners.has(family.review_owner_id), true, `${family.family_id} review owner must resolve`);

    const rows = parseCsv(readText(`families/${family.family_id}/family_states.csv`));
    const demandRows = parseCsv(readText(`families/${family.family_id}/demand.csv`));
    assert.equal(demandRows.length, 1, `${family.family_id} should have exactly one demand row`);
    assert.equal(demandCurveIds.has(demandRows[0].demand_growth_curve_id), true, `${family.family_id} demand curve must resolve`);

    totalRows += rows.length;
    const familyStateIds = new Set(rows.map((row) => row.state_id));
    assert.equal(familyStateIds.has(family.default_incumbent_state_id), true, `${family.family_id} default incumbent state must exist`);

    for (const row of rows) {
      assert.equal(row.family_id, family.family_id, `${family.family_id} rows must keep the correct family_id`);
      stateIds.add(row.state_id);

      const sourceArray = parseJsonArray(row.source_ids, `${family.family_id}.${row.state_id}.source_ids`);
      const assumptionArray = parseJsonArray(row.assumption_ids, `${family.family_id}.${row.state_id}.assumption_ids`);
      const inputCommodities = parseJsonArray(row.input_commodities, `${family.family_id}.${row.state_id}.input_commodities`);
      const inputCoefficients = parseJsonArray(row.input_coefficients, `${family.family_id}.${row.state_id}.input_coefficients`);
      const inputUnits = parseJsonArray(row.input_units, `${family.family_id}.${row.state_id}.input_units`);
      parseJsonArray(row.energy_emissions_by_pollutant, `${family.family_id}.${row.state_id}.energy_emissions_by_pollutant`);
      parseJsonArray(row.process_emissions_by_pollutant, `${family.family_id}.${row.state_id}.process_emissions_by_pollutant`);

      assert.equal(inputCommodities.length, inputCoefficients.length, `${family.family_id}.${row.state_id} input arrays must align`);
      assert.equal(inputCommodities.length, inputUnits.length, `${family.family_id}.${row.state_id} input arrays must align`);

      for (const sourceId of sourceArray) {
        assert.equal(sourceIds.has(sourceId), true, `${family.family_id}.${row.state_id} source ${sourceId} must resolve`);
      }
      for (const assumptionId of assumptionArray) {
        assert.equal(assumptionIds.has(assumptionId), true, `${family.family_id}.${row.state_id} assumption ${assumptionId} must resolve`);
      }
    }

    for (const stateId of familyStateIds) {
      const years = rows
        .filter((row) => row.state_id === stateId)
        .map((row) => row.year)
        .sort((left, right) => Number(left) - Number(right));
      assert.deepEqual(years, MILESTONE_YEARS, `${family.family_id}.${stateId} must cover every milestone year`);
    }
  }

  assert.equal(totalRows, 228);
  assert.equal(stateIds.size, 38);

  const externalCommodityDemands = parseCsv(readText('shared/external_commodity_demands.csv'));
  for (const row of externalCommodityDemands) {
    assert.equal(demandCurveIds.has(row.demand_growth_curve_id), true, `external commodity ${row.commodity_id} demand curve must resolve`);
  }
});

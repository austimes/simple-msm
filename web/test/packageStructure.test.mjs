import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parseCsv } from '../src/data/parseCsv.ts';

const PACKAGE_ROOT = join(import.meta.dirname, '../../sector_trajectory_library');
const MILESTONE_YEARS = ['2025', '2030', '2035', '2040', '2045', '2050'];
const AUTONOMOUS_EFFICIENCY_HEADERS = [
  'family_id',
  'track_id',
  'year',
  'track_label',
  'track_description',
  'applicable_state_ids',
  'affected_input_commodities',
  'input_multipliers',
  'delta_output_cost_per_unit',
  'cost_basis_year',
  'currency',
  'source_ids',
  'assumption_ids',
  'evidence_summary',
  'derivation_method',
  'confidence_rating',
  'double_counting_guardrail',
  'review_notes',
];
const EFFICIENCY_PACKAGE_HEADERS = [
  'family_id',
  'package_id',
  'year',
  'package_label',
  'package_description',
  'classification',
  'applicable_state_ids',
  'affected_input_commodities',
  'input_multipliers',
  'delta_output_cost_per_unit',
  'cost_basis_year',
  'currency',
  'max_share',
  'rollout_limit_notes',
  'source_ids',
  'assumption_ids',
  'evidence_summary',
  'derivation_method',
  'confidence_rating',
  'review_notes',
  'non_stacking_group',
];

function readText(relativePath) {
  return readFileSync(join(PACKAGE_ROOT, relativePath), 'utf8');
}

function parseHeader(relativePath) {
  return readText(relativePath).split(/\r?\n/, 1)[0].split(',');
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
  let autonomousTrackRowCount = 0;
  let efficiencyPackageRowCount = 0;

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

    const autonomousPath = join(familyDir, 'autonomous_efficiency_tracks.csv');
    if (existsSync(autonomousPath)) {
      assert.deepEqual(
        parseHeader(`families/${family.family_id}/autonomous_efficiency_tracks.csv`),
        AUTONOMOUS_EFFICIENCY_HEADERS,
        `${family.family_id} autonomous_efficiency_tracks.csv should use the canonical header order`,
      );

      const trackRows = parseCsv(readText(`families/${family.family_id}/autonomous_efficiency_tracks.csv`));
      autonomousTrackRowCount += trackRows.length;
      const trackIds = new Set(trackRows.map((row) => row.track_id));

      for (const row of trackRows) {
        assert.equal(row.family_id, family.family_id, `${family.family_id} track rows must keep the correct family_id`);

        const applicableStateIds = parseJsonArray(
          row.applicable_state_ids,
          `${family.family_id}.${row.track_id}.applicable_state_ids`,
        );
        const sourceArray = parseJsonArray(row.source_ids, `${family.family_id}.${row.track_id}.source_ids`);
        const assumptionArray = parseJsonArray(row.assumption_ids, `${family.family_id}.${row.track_id}.assumption_ids`);
        const affectedInputCommodities = parseJsonArray(
          row.affected_input_commodities,
          `${family.family_id}.${row.track_id}.affected_input_commodities`,
        );
        const inputMultipliers = parseJsonArray(
          row.input_multipliers,
          `${family.family_id}.${row.track_id}.input_multipliers`,
        );

        assert.equal(
          affectedInputCommodities.length,
          inputMultipliers.length,
          `${family.family_id}.${row.track_id} input arrays must align`,
        );

        for (const stateId of applicableStateIds) {
          assert.equal(familyStateIds.has(stateId), true, `${family.family_id}.${row.track_id} state ${stateId} must resolve`);
        }
        for (const sourceId of sourceArray) {
          assert.equal(sourceIds.has(sourceId), true, `${family.family_id}.${row.track_id} source ${sourceId} must resolve`);
        }
        for (const assumptionId of assumptionArray) {
          assert.equal(assumptionIds.has(assumptionId), true, `${family.family_id}.${row.track_id} assumption ${assumptionId} must resolve`);
        }
      }

      for (const trackId of trackIds) {
        const years = trackRows
          .filter((row) => row.track_id === trackId)
          .map((row) => row.year)
          .sort((left, right) => Number(left) - Number(right));
        assert.deepEqual(years, MILESTONE_YEARS, `${family.family_id}.${trackId} must cover every milestone year`);
      }
    }

    const packagesPath = join(familyDir, 'efficiency_packages.csv');
    if (existsSync(packagesPath)) {
      assert.deepEqual(
        parseHeader(`families/${family.family_id}/efficiency_packages.csv`),
        EFFICIENCY_PACKAGE_HEADERS,
        `${family.family_id} efficiency_packages.csv should use the canonical header order`,
      );

      const packageRows = parseCsv(readText(`families/${family.family_id}/efficiency_packages.csv`));
      efficiencyPackageRowCount += packageRows.length;
      const packageIds = new Set(packageRows.map((row) => row.package_id));

      for (const row of packageRows) {
        assert.equal(row.family_id, family.family_id, `${family.family_id} package rows must keep the correct family_id`);

        const applicableStateIds = parseJsonArray(
          row.applicable_state_ids,
          `${family.family_id}.${row.package_id}.applicable_state_ids`,
        );
        const sourceArray = parseJsonArray(row.source_ids, `${family.family_id}.${row.package_id}.source_ids`);
        const assumptionArray = parseJsonArray(row.assumption_ids, `${family.family_id}.${row.package_id}.assumption_ids`);
        const affectedInputCommodities = parseJsonArray(
          row.affected_input_commodities,
          `${family.family_id}.${row.package_id}.affected_input_commodities`,
        );
        const inputMultipliers = parseJsonArray(
          row.input_multipliers,
          `${family.family_id}.${row.package_id}.input_multipliers`,
        );

        assert.equal(
          affectedInputCommodities.length,
          inputMultipliers.length,
          `${family.family_id}.${row.package_id} input arrays must align`,
        );

        for (const stateId of applicableStateIds) {
          assert.equal(familyStateIds.has(stateId), true, `${family.family_id}.${row.package_id} state ${stateId} must resolve`);
        }
        for (const sourceId of sourceArray) {
          assert.equal(sourceIds.has(sourceId), true, `${family.family_id}.${row.package_id} source ${sourceId} must resolve`);
        }
        for (const assumptionId of assumptionArray) {
          assert.equal(assumptionIds.has(assumptionId), true, `${family.family_id}.${row.package_id} assumption ${assumptionId} must resolve`);
        }
      }

      for (const packageId of packageIds) {
        const years = packageRows
          .filter((row) => row.package_id === packageId)
          .map((row) => row.year)
          .sort((left, right) => Number(left) - Number(right));
        assert.deepEqual(years, MILESTONE_YEARS, `${family.family_id}.${packageId} must cover every milestone year`);
      }
    }
  }

  assert.equal(totalRows, 228);
  assert.equal(stateIds.size, 38);
  assert.ok(autonomousTrackRowCount > 0, 'expected at least one canonical autonomous efficiency track row');
  assert.ok(efficiencyPackageRowCount > 0, 'expected at least one canonical efficiency package row');

  const externalCommodityDemands = parseCsv(readText('shared/external_commodity_demands.csv'));
  for (const row of externalCommodityDemands) {
    assert.equal(demandCurveIds.has(row.demand_growth_curve_id), true, `external commodity ${row.commodity_id} demand curve must resolve`);
  }
});

test('schema companions stay aligned with the authored CSV headers', () => {
  const familiesSchema = JSON.parse(readText('schema/families.schema.json'));
  assert.deepEqual(
    Object.keys(familiesSchema.properties ?? {}),
    parseHeader('shared/families.csv'),
    'families.schema.json should match shared/families.csv header order exactly',
  );

  const familyStatesSchema = JSON.parse(readText('schema/family_states.schema.json'));
  assert.deepEqual(
    Object.keys(familyStatesSchema.properties ?? {}),
    parseHeader('families/electricity/family_states.csv'),
    'family_states.schema.json should match family_states.csv header order exactly',
  );

  const autonomousEfficiencySchema = JSON.parse(readText('schema/autonomous_efficiency_tracks.schema.json'));
  assert.deepEqual(
    Object.keys(autonomousEfficiencySchema.properties ?? {}),
    AUTONOMOUS_EFFICIENCY_HEADERS,
    'autonomous_efficiency_tracks.schema.json should declare the canonical header order exactly',
  );

  const efficiencyPackagesSchema = JSON.parse(readText('schema/efficiency_packages.schema.json'));
  assert.deepEqual(
    Object.keys(efficiencyPackagesSchema.properties ?? {}),
    EFFICIENCY_PACKAGE_HEADERS,
    'efficiency_packages.schema.json should declare the canonical header order exactly',
  );
});

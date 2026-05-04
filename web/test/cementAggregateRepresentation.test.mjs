import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { loadPackage } from '../src/data/packageLoader.ts';
import { parseCsv } from '../src/data/parseCsv.ts';

const PACKAGE_ROOT = join(import.meta.dirname, '../../energy_system_representation_library');
const SUMMARY_PATH = 'validation/cement_aggregate_representation_summary.csv';

function readPackageCsv(relativePath) {
  return parseCsv(readFileSync(join(PACKAGE_ROOT, relativePath), 'utf8'));
}

test('cement aggregate representation summary matches canonical package data', () => {
  const pkg = loadPackage();
  const [summary] = readPackageCsv(SUMMARY_PATH);

  assert.equal(pkg.enrichment.availablePaths.includes(SUMMARY_PATH), true);
  assert.equal(summary.role_id, 'make_cement_equivalent');
  assert.equal(summary.representation_id, 'make_cement_equivalent__pathway_bundle');
  assert.equal(summary.representation_kind, 'pathway_bundle');
  assert.equal(summary.is_default, 'true');

  const representation = pkg.representations.find((row) =>
    row.role_id === summary.role_id
    && row.representation_id === summary.representation_id
  );
  assert.equal(representation?.representation_kind, summary.representation_kind);
  assert.equal(representation?.is_default, true);

  const methods = pkg.methods.filter((row) =>
    row.role_id === summary.role_id
    && row.representation_id === summary.representation_id
  );
  assert.equal(methods.length, Number(summary.direct_method_count));
  assert.ok(methods.every((row) => !('method_kind' in row)));
  assert.equal(methods.some((row) => row.method_id === summary.incumbent_method_id), true);

  const methodYears = pkg.methodYears.filter((row) =>
    row.role_id === summary.role_id
    && row.representation_id === summary.representation_id
  );
  assert.equal(methodYears.length, Number(summary.method_year_row_count));
});

test('cement aggregate representation has incumbent activity and emissions metadata', () => {
  const pkg = loadPackage();
  const [summary] = readPackageCsv(SUMMARY_PATH);

  const incumbent = pkg.representationIncumbents.find((row) =>
    row.role_id === summary.role_id
    && row.representation_id === summary.representation_id
  );
  assert.equal(incumbent?.method_id, summary.incumbent_method_id);
  assert.equal(incumbent?.incumbent_share, 1);

  const driver = pkg.roleActivityDrivers.find((row) => row.driver_id === summary.activity_driver_id);
  assert.equal(driver?.role_id, summary.role_id);
  assert.equal(driver?.driver_kind, 'service_or_product_demand');
  assert.equal(driver?.anchor_year, Number(summary.activity_anchor_year));
  assert.equal(driver?.anchor_value, Number(summary.activity_anchor_value));
  assert.equal(driver?.unit, summary.activity_unit);

  const metric = pkg.roleMetrics.find((row) => row.role_id === summary.role_id);
  assert.equal(metric?.emissions_importance_band, summary.emissions_importance_band);
  assert.equal(metric?.baseline_direct_gross_emissions_mtco2e, Number(summary.baseline_direct_gross_emissions_mtco2e));
});

test('cement aggregate representation keeps integrated heat fuel and process boundaries explicit', () => {
  const [summary] = readPackageCsv(SUMMARY_PATH);
  const methodYears = readPackageCsv('roles/make_cement_equivalent/method_years.csv');
  const readme = readFileSync(join(PACKAGE_ROOT, 'roles/make_cement_equivalent/README.md'), 'utf8');
  const validation = readFileSync(join(PACKAGE_ROOT, 'roles/make_cement_equivalent/validation.md'), 'utf8');

  const incumbent2025 = methodYears.find((row) =>
    row.method_id === summary.incumbent_method_id
    && row.year === '2025'
  );
  assert.match(incumbent2025?.input_commodities ?? '', /coal/);
  assert.match(incumbent2025?.input_commodities ?? '', /natural_gas/);
  assert.match(incumbent2025?.input_commodities ?? '', /electricity/);
  assert.match(incumbent2025?.process_emissions_by_pollutant ?? '', /CO2e/);

  const ccsRows = methodYears.filter((row) => row.method_id === 'cement_clinker__cement_equivalent__ccs_deep');
  assert.ok(ccsRows.every((row) => row.input_commodities.includes('capture_service')));

  assert.match(summary.integrated_heat_fuel_boundary, /kiln heat fuel electricity/);
  assert.match(summary.process_emissions_boundary, /calcination/);
  assert.match(summary.ccs_boundary, /capture_service/);
  assert.match(summary.double_counting_guardrail, /deliver_high_temperature_heat/);
  assert.match(readme, /Aggregate Representation Boundary/);
  assert.match(validation, /direct pathway representation with 3 methods/);
});

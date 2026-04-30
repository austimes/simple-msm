import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import { serializeCsv } from '../src/data/csvWriter.ts';
import {
  buildLibraryExportBundle,
  type LibraryExportBundle,
} from '../src/data/libraryExport.ts';
import { createLibraryExportZip } from '../src/data/libraryExportDownload.ts';
import {
  buildRoleMethodFamilies,
  buildRoleMethodTrajectory,
  type RoleMethodTrajectory,
} from '../src/data/libraryInsights.ts';
import { DEFAULT_APP_UI_STATE } from '../src/data/appUiState.ts';
import { parseCsv } from '../src/data/parseCsv.ts';
import { loadPkg } from './solverTestUtils.mjs';

const EXPECTED_FILES = [
  'manifest.json',
  'README.txt',
  'report.html',
  'data/chart_points.csv',
  'data/method_years.csv',
  'data/input_coefficients.csv',
  'data/emissions_by_pollutant.csv',
  'data/sources.csv',
  'data/assumptions.csv',
];

const pkg = loadPkg();

function buildElectricityTrajectories(): RoleMethodTrajectory[] {
  return buildRoleMethodFamilies(pkg.resolvedMethodYears)
    .filter((family) =>
      family.representative.role_id === 'supply_electricity'
      && family.representative.representation_id === 'supply_electricity__pathway_bundle')
    .map((family) => buildRoleMethodTrajectory(family));
}

function buildElectricityBundle(): {
  bundle: LibraryExportBundle;
  trajectories: RoleMethodTrajectory[];
} {
  const trajectories = buildElectricityTrajectories();

  return {
    trajectories,
    bundle: buildLibraryExportBundle({
      scope: {
        roleId: 'supply_electricity',
        representationId: 'supply_electricity__pathway_bundle',
        methodId: 'electricity__grid_supply__policy_frontier',
        filters: {
          ...DEFAULT_APP_UI_STATE.library.filters,
          search: 'grid',
        },
        generatedAt: '2026-04-29T03:04:05.000Z',
      },
      trajectories,
      sourceLedger: pkg.enrichment.sourceLedger,
      assumptionsLedger: pkg.enrichment.assumptionsLedger,
    }),
  };
}

function parseReportData(report: string): {
  comparisonRows: Array<{
    method_id: string;
    metric_id: string;
    metric_label: string;
    values: Record<string, string>;
  }>;
} {
  const match = report.match(
    /<script type="application\/json" id="library-export-data">([\s\S]*?)<\/script>/,
  );

  assert.ok(match, 'expected embedded report data');
  return JSON.parse(match[1]);
}

describe('library export bundle', () => {
  test('exports the visible electricity supply scope with the expected bundle files and manifest', () => {
    const { bundle, trajectories } = buildElectricityBundle();
    const manifest = JSON.parse(bundle.files['manifest.json']);

    assert.ok(trajectories.length > 0, 'expected electricity supply trajectories');
    assert.equal(
      trajectories.every((trajectory) => trajectory.representative.role_id === 'supply_electricity'),
      true,
    );
    assert.deepEqual(Object.keys(bundle.files), EXPECTED_FILES);
    assert.equal(bundle.filename, 'simple-msm-library-supply-electricity-electricity-grid-supply-policy-frontier-20260429.zip');
    assert.equal(manifest.scope.role_id, 'supply_electricity');
    assert.equal(manifest.scope.representation_id, 'supply_electricity__pathway_bundle');
    assert.equal(manifest.scope.method_id, 'electricity__grid_supply__policy_frontier');
    assert.deepEqual(manifest.scope.active_filters, { search: 'grid' });
    assert.equal(manifest.trajectory_count, trajectories.length);
    assert.deepEqual(manifest.years, [2025, 2030, 2035, 2040, 2045, 2050]);
    assert.deepEqual(manifest.year_range, { min: 2025, max: 2050 });
  });

  test('exports chart points for all five Library panels with raw and display values', () => {
    const { bundle } = buildElectricityBundle();
    const rows = parseCsv(bundle.files['data/chart_points.csv']);
    const panels = Array.from(new Set(rows.map((row) => row.panel_id))).sort();

    assert.deepEqual(panels, [
      'cost',
      'emissions',
      'input_coefficients',
      'max_activity',
      'max_share',
    ]);

    const maxShare = rows.find((row) =>
      row.panel_id === 'max_share'
      && row.method_id === 'electricity__grid_supply__deep_clean_firmed'
      && row.year === '2025'
    );

    assert.ok(maxShare, 'expected a max-share point for deep clean electricity');
    assert.equal(maxShare?.value, '0.2');
    assert.equal(maxShare?.display_value, '20%');
  });

  test('exports input coefficients, emissions by pollutant, and referenced trust ledgers', () => {
    const { bundle, trajectories } = buildElectricityBundle();
    const inputRows = parseCsv(bundle.files['data/input_coefficients.csv']);
    const emissionsRows = parseCsv(bundle.files['data/emissions_by_pollutant.csv']);
    const sourceRows = parseCsv(bundle.files['data/sources.csv']);
    const assumptionRows = parseCsv(bundle.files['data/assumptions.csv']);
    const referencedSourceIds = new Set(
      trajectories.flatMap((trajectory) => trajectory.rows.flatMap((row) => row.source_ids)),
    );
    const referencedAssumptionIds = new Set(
      trajectories.flatMap((trajectory) => trajectory.rows.flatMap((row) => row.assumption_ids)),
    );

    assert.equal(new Set(inputRows.map((row) => row.commodity_id)).has('coal'), true);
    assert.equal(new Set(inputRows.map((row) => row.commodity_id)).has('natural_gas'), true);
    assert.deepEqual(
      Array.from(new Set(emissionsRows.map((row) => row.emissions_category))).sort(),
      ['energy', 'process'],
    );
    assert.equal(sourceRows.length > 0, true);
    assert.equal(sourceRows.length < pkg.enrichment.sourceLedger.length, true);
    assert.equal(sourceRows.every((row) => referencedSourceIds.has(row.source_id)), true);
    assert.equal(assumptionRows.length > 0, true);
    assert.equal(assumptionRows.length < pkg.enrichment.assumptionsLedger.length, true);
    assert.equal(assumptionRows.every((row) => referencedAssumptionIds.has(row.assumption_id)), true);
  });

  test('includes input coefficients in the offline report comparison table data', () => {
    const { bundle } = buildElectricityBundle();
    const reportData = parseReportData(bundle.files['report.html']);
    const inputRows = reportData.comparisonRows.filter((row) => row.metric_id.startsWith('input:'));
    const incumbentCoal = inputRows.find((row) =>
      row.method_id === 'electricity__grid_supply__incumbent_thermal_mix'
      && row.metric_label === 'Input coefficient: Coal'
    );
    const incumbentNaturalGas = inputRows.find((row) =>
      row.method_id === 'electricity__grid_supply__incumbent_thermal_mix'
      && row.metric_label === 'Input coefficient: Natural gas'
    );

    assert.equal(reportData.comparisonRows.some((row) => row.metric_label === 'Cost'), true);
    assert.ok(incumbentCoal, 'expected incumbent coal coefficient row in report table data');
    assert.ok(incumbentNaturalGas, 'expected incumbent natural gas coefficient row in report table data');
    assert.equal(incumbentCoal?.values['2025'], '6.8 GJ/MWh');
    assert.equal(incumbentNaturalGas?.values['2025'], '1.1 GJ/MWh');
  });

  test('builds a self-contained offline report and round-trippable zip archive', () => {
    const { bundle } = buildElectricityBundle();
    const report = bundle.files['report.html'];
    const zip = createLibraryExportZip(bundle);
    const unzipped = unzipSync(zip);

    assert.doesNotMatch(report, /https?:\/\//);
    assert.doesNotMatch(report, /<script\s+src=/i);
    assert.doesNotMatch(report, /<link\b/i);
    assert.match(report, /id="library-export-data"/);
    assert.deepEqual(Object.keys(unzipped).sort(), [...EXPECTED_FILES].sort());
    assert.equal(strFromU8(unzipped['manifest.json']), bundle.files['manifest.json']);
    assert.equal(strFromU8(unzipped['data/chart_points.csv']), bundle.files['data/chart_points.csv']);
  });
});

describe('serializeCsv', () => {
  test('quotes commas, quotes, and newlines while preserving blank null cells', () => {
    assert.equal(
      serializeCsv(
        ['plain', 'comma', 'quote', 'newline'],
        [
          {
            plain: 'alpha',
            comma: 'alpha,beta',
            quote: 'quoted "value"',
            newline: 'line one\nline two',
          },
          {
            plain: null,
            comma: undefined,
            quote: '',
            newline: 'omega',
          },
        ],
      ),
      'plain,comma,quote,newline\nalpha,"alpha,beta","quoted ""value""","line one\nline two"\n,,,omega\n',
    );
  });
});

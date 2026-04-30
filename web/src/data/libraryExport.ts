import type { LibraryFilters } from './appUiState.ts';
import { getCommodityMetadata } from './commodityMetadata.ts';
import { serializeCsv } from './csvWriter.ts';
import type { RoleMethodTrajectory } from './libraryInsights.ts';
import { sumEmissionEntries } from './libraryInsights.ts';
import type { AssumptionLedgerEntry, SourceLedgerEntry } from './types.ts';

export interface LibraryExportScope {
  roleId: string | null;
  representationId: string | null;
  methodId: string | null;
  filters: LibraryFilters;
  generatedAt: string;
}

export interface LibraryExportInput {
  scope: LibraryExportScope;
  trajectories: RoleMethodTrajectory[];
  sourceLedger: SourceLedgerEntry[];
  assumptionsLedger: AssumptionLedgerEntry[];
}

export interface LibraryExportBundle {
  filename: string;
  files: Record<string, string>;
}

type CsvValue = string | number | boolean | null;
type CsvRow = Record<string, CsvValue>;

interface ChartPointRow extends CsvRow {
  panel_id: string;
  panel_label: string;
  metric_id: string;
  metric_label: string;
  series_id: string;
  series_label: string;
  legend_label: string;
  method_id: string;
  method_label: string;
  commodity_id: string;
  commodity_label: string;
  year: number;
  value: number | null;
  display_value: string;
  unit: string;
  line_style: string;
  is_selected: boolean;
}

interface ReportComparisonRow {
  method_id: string;
  method_label: string;
  metric_id: string;
  metric_label: string;
  values: Record<string, string>;
}

const REPORT_BASE_METRICS = [
  { id: 'cost', label: 'Cost' },
  { id: 'energy', label: 'Energy emissions' },
  { id: 'process', label: 'Process emissions' },
  { id: 'max_share', label: 'Max share' },
  { id: 'max_activity', label: 'Max activity' },
] as const;

const FILE_PATHS = [
  'manifest.json',
  'README.txt',
  'report.html',
  'data/chart_points.csv',
  'data/method_years.csv',
  'data/input_coefficients.csv',
  'data/emissions_by_pollutant.csv',
  'data/sources.csv',
  'data/assumptions.csv',
] as const;

const CHART_POINT_HEADERS = [
  'panel_id',
  'panel_label',
  'metric_id',
  'metric_label',
  'series_id',
  'series_label',
  'legend_label',
  'method_id',
  'method_label',
  'commodity_id',
  'commodity_label',
  'year',
  'value',
  'display_value',
  'unit',
  'line_style',
  'is_selected',
];

const METHOD_YEAR_HEADERS = [
  'role_id',
  'representation_id',
  'method_id',
  'method_label',
  'method_kind',
  'year',
  'reporting_sector',
  'reporting_subsector',
  'reporting_bucket',
  'output_id',
  'region',
  'output_unit',
  'output_cost_per_unit',
  'cost_basis_year',
  'currency',
  'cost_components_summary',
  'input_commodities_json',
  'input_coefficients_json',
  'input_units_json',
  'input_basis_notes',
  'energy_emissions_total',
  'process_emissions_total',
  'energy_emissions_by_pollutant_json',
  'process_emissions_by_pollutant_json',
  'emissions_units',
  'emissions_boundary_notes',
  'max_share',
  'max_activity',
  'min_share',
  'rollout_limit_notes',
  'availability_conditions',
  'source_ids_json',
  'assumption_ids_json',
  'evidence_summary',
  'derivation_method',
  'confidence_rating',
  'review_notes',
  'candidate_expansion_pathway',
  'times_or_vedalang_mapping_notes',
  'would_expand_to_explicit_capacity',
  'would_expand_to_process_chain',
];

const INPUT_COEFFICIENT_HEADERS = [
  'role_id',
  'method_id',
  'method_label',
  'year',
  'commodity_id',
  'commodity_label',
  'value',
  'unit',
  'input_basis_notes',
];

const EMISSIONS_BY_POLLUTANT_HEADERS = [
  'role_id',
  'method_id',
  'method_label',
  'year',
  'emissions_category',
  'pollutant',
  'value',
  'unit',
  'emissions_boundary_notes',
];

const SOURCE_HEADERS = [
  'source_id',
  'citation',
  'publication_date',
  'institution',
  'location',
  'parameters_informed',
  'quality_notes',
];

const ASSUMPTION_HEADERS = [
  'assumption_id',
  'statement',
  'rationale',
  'affected_scope',
  'sensitivity_importance',
  'validation_route',
];

const COEFFICIENT_DASH_PATTERNS = ['solid', '7 5', '3 4', '10 4 2 4', '2 3'];

const numberFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('en-AU', {
  style: 'percent',
  maximumFractionDigits: 1,
});

function resolveCommodityLabel(commodityId: string): string {
  try {
    return getCommodityMetadata(commodityId).label;
  } catch {
    return commodityId;
  }
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

  return slug || 'all';
}

function dateToken(generatedAt: string): string {
  const match = generatedAt.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[1]}${match[2]}${match[3]}`;
  }

  const parsed = new Date(generatedAt);
  if (Number.isFinite(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10).replaceAll('-', '');
  }

  return new Date().toISOString().slice(0, 10).replaceAll('-', '');
}

function formatCostUnit(currency: string, outputUnit: string): string {
  return `${currency} per ${outputUnit}`;
}

function formatNullableNumber(value: number | null): string {
  return value == null ? '' : numberFormatter.format(value);
}

function formatNullablePercent(value: number | null): string {
  return value == null ? '' : percentFormatter.format(value);
}

function jsonCell(value: unknown): string {
  return JSON.stringify(value);
}

function collectYears(trajectories: RoleMethodTrajectory[]): number[] {
  return Array.from(
    new Set(trajectories.flatMap((trajectory) => trajectory.points.map((point) => point.year))),
  ).sort((left, right) => left - right);
}

function activeFilters(filters: LibraryFilters): Partial<LibraryFilters> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value.trim().length > 0),
  ) as Partial<LibraryFilters>;
}

function collectReferencedIds(trajectories: RoleMethodTrajectory[], key: 'source_ids' | 'assumption_ids'): Set<string> {
  return new Set(trajectories.flatMap((trajectory) => trajectory.rows.flatMap((row) => row[key])));
}

function reportingAllocationColumns(row: RoleMethodTrajectory['rows'][number]): {
  reporting_sector: string;
  reporting_subsector: string;
  reporting_bucket: string;
} {
  const allocation = row.reporting_allocations[0];

  return {
    reporting_sector: allocation?.sector ?? '',
    reporting_subsector: allocation?.subsector ?? '',
    reporting_bucket: allocation?.reporting_bucket ?? '',
  };
}

function buildChartPointRows(
  trajectories: RoleMethodTrajectory[],
  selectedMethodId: string | null,
): ChartPointRow[] {
  const rows: ChartPointRow[] = [];
  const allCommodities = Array.from(
    new Set(
      trajectories.flatMap((trajectory) =>
        trajectory.rows.flatMap((row) => row.input_commodities),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const lineStyleByCommodity = new Map(
    allCommodities.map((commodity, index) => [
      commodity,
      COEFFICIENT_DASH_PATTERNS[index % COEFFICIENT_DASH_PATTERNS.length],
    ]),
  );

  for (const trajectory of trajectories) {
    const isSelected = trajectory.methodId === selectedMethodId;

    for (const point of trajectory.points) {
      rows.push({
        panel_id: 'cost',
        panel_label: 'Cost trajectory',
        metric_id: 'cost',
        metric_label: 'Cost',
        series_id: `${trajectory.methodId}::cost`,
        series_label: trajectory.label,
        legend_label: trajectory.label,
        method_id: trajectory.methodId,
        method_label: trajectory.label,
        commodity_id: '',
        commodity_label: '',
        year: point.year,
        value: point.cost,
        display_value: point.cost == null ? '' : `${trajectory.currency} ${numberFormatter.format(point.cost)}`,
        unit: formatCostUnit(trajectory.currency, trajectory.outputUnit),
        line_style: 'solid',
        is_selected: isSelected,
      });

      rows.push({
        panel_id: 'emissions',
        panel_label: 'Energy and process emissions',
        metric_id: 'energy',
        metric_label: 'Energy emissions',
        series_id: `${trajectory.methodId}::energy`,
        series_label: `${trajectory.label} · energy`,
        legend_label: `${trajectory.label} · energy`,
        method_id: trajectory.methodId,
        method_label: trajectory.label,
        commodity_id: '',
        commodity_label: '',
        year: point.year,
        value: point.energyTotal,
        display_value: formatNullableNumber(point.energyTotal),
        unit: trajectory.emissionsUnit,
        line_style: 'solid',
        is_selected: isSelected,
      });

      rows.push({
        panel_id: 'emissions',
        panel_label: 'Energy and process emissions',
        metric_id: 'process',
        metric_label: 'Process emissions',
        series_id: `${trajectory.methodId}::process`,
        series_label: `${trajectory.label} · process`,
        legend_label: `${trajectory.label} · process`,
        method_id: trajectory.methodId,
        method_label: trajectory.label,
        commodity_id: '',
        commodity_label: '',
        year: point.year,
        value: point.processTotal,
        display_value: formatNullableNumber(point.processTotal),
        unit: trajectory.emissionsUnit,
        line_style: '7 5',
        is_selected: isSelected,
      });

      rows.push({
        panel_id: 'max_share',
        panel_label: 'Max share',
        metric_id: 'max_share',
        metric_label: 'Max share',
        series_id: `${trajectory.methodId}::max_share`,
        series_label: trajectory.label,
        legend_label: trajectory.label,
        method_id: trajectory.methodId,
        method_label: trajectory.label,
        commodity_id: '',
        commodity_label: '',
        year: point.year,
        value: point.maxShare,
        display_value: formatNullablePercent(point.maxShare),
        unit: 'fraction',
        line_style: 'solid',
        is_selected: isSelected,
      });

      rows.push({
        panel_id: 'max_activity',
        panel_label: 'Max activity',
        metric_id: 'max_activity',
        metric_label: 'Max activity',
        series_id: `${trajectory.methodId}::max_activity`,
        series_label: trajectory.label,
        legend_label: trajectory.label,
        method_id: trajectory.methodId,
        method_label: trajectory.label,
        commodity_id: '',
        commodity_label: '',
        year: point.year,
        value: point.maxActivity,
        display_value: formatNullableNumber(point.maxActivity),
        unit: trajectory.outputUnit,
        line_style: 'solid',
        is_selected: isSelected,
      });
    }

    const commoditiesForTrajectory = Array.from(
      new Set(trajectory.rows.flatMap((row) => row.input_commodities)),
    ).sort((left, right) => left.localeCompare(right));

    for (const commodity of commoditiesForTrajectory) {
      const commodityLabel = resolveCommodityLabel(commodity);

      for (const row of trajectory.rows) {
        const index = row.input_commodities.indexOf(commodity);
        const value = index >= 0 ? row.input_coefficients[index] ?? null : null;
        const unit = index >= 0 ? row.input_units[index] ?? '' : '';

        rows.push({
          panel_id: 'input_coefficients',
          panel_label: 'Input coefficient trajectories',
          metric_id: `input:${commodity}`,
          metric_label: commodityLabel,
          series_id: `${trajectory.methodId}::${commodity}`,
          series_label: `${trajectory.label} · ${commodityLabel}`,
          legend_label: `${trajectory.label} · ${commodityLabel}`,
          method_id: trajectory.methodId,
          method_label: trajectory.label,
          commodity_id: commodity,
          commodity_label: commodityLabel,
          year: row.year,
          value,
          display_value: formatNullableNumber(value),
          unit,
          line_style: lineStyleByCommodity.get(commodity) ?? 'solid',
          is_selected: isSelected,
        });
      }
    }
  }

  return rows;
}

function buildMethodYearRows(trajectories: RoleMethodTrajectory[]): CsvRow[] {
  return trajectories.flatMap((trajectory) =>
    trajectory.rows.map((row) => ({
      role_id: row.role_id,
      representation_id: row.representation_id,
      method_id: row.method_id,
      method_label: row.method_label,
      method_kind: row.method_kind,
      year: row.year,
      ...reportingAllocationColumns(row),
      output_id: row.output_id,
      region: row.region,
      output_unit: row.output_unit,
      output_cost_per_unit: row.output_cost_per_unit,
      cost_basis_year: row.cost_basis_year,
      currency: row.currency,
      cost_components_summary: row.cost_components_summary,
      input_commodities_json: jsonCell(row.input_commodities),
      input_coefficients_json: jsonCell(row.input_coefficients),
      input_units_json: jsonCell(row.input_units),
      input_basis_notes: row.input_basis_notes,
      energy_emissions_total: sumEmissionEntries(row.energy_emissions_by_pollutant),
      process_emissions_total: sumEmissionEntries(row.process_emissions_by_pollutant),
      energy_emissions_by_pollutant_json: jsonCell(row.energy_emissions_by_pollutant),
      process_emissions_by_pollutant_json: jsonCell(row.process_emissions_by_pollutant),
      emissions_units: row.emissions_units,
      emissions_boundary_notes: row.emissions_boundary_notes,
      max_share: row.max_share,
      max_activity: row.max_activity,
      min_share: row.min_share,
      rollout_limit_notes: row.rollout_limit_notes,
      availability_conditions: row.availability_conditions,
      source_ids_json: jsonCell(row.source_ids),
      assumption_ids_json: jsonCell(row.assumption_ids),
      evidence_summary: row.evidence_summary,
      derivation_method: row.derivation_method,
      confidence_rating: row.confidence_rating,
      review_notes: row.review_notes,
      candidate_expansion_pathway: row.candidate_expansion_pathway,
      times_or_vedalang_mapping_notes: row.times_or_vedalang_mapping_notes,
      would_expand_to_explicit_capacity: row.would_expand_to_explicit_capacity,
      would_expand_to_process_chain: row.would_expand_to_process_chain,
    })),
  );
}

function buildInputCoefficientRows(trajectories: RoleMethodTrajectory[]): CsvRow[] {
  return trajectories.flatMap((trajectory) =>
    trajectory.rows.flatMap((row) =>
      row.input_commodities.map((commodity, index) => ({
        role_id: row.role_id,
        method_id: row.method_id,
        method_label: row.method_label,
        year: row.year,
        commodity_id: commodity,
        commodity_label: resolveCommodityLabel(commodity),
        value: row.input_coefficients[index] ?? null,
        unit: row.input_units[index] ?? '',
        input_basis_notes: row.input_basis_notes,
      })),
    ),
  );
}

function buildEmissionsByPollutantRows(trajectories: RoleMethodTrajectory[]): CsvRow[] {
  return trajectories.flatMap((trajectory) =>
    trajectory.rows.flatMap((row) => [
      ...row.energy_emissions_by_pollutant.map((entry) => ({
        role_id: row.role_id,
        method_id: row.method_id,
        method_label: row.method_label,
        year: row.year,
        emissions_category: 'energy',
        pollutant: entry.pollutant,
        value: entry.value,
        unit: row.emissions_units,
        emissions_boundary_notes: row.emissions_boundary_notes,
      })),
      ...row.process_emissions_by_pollutant.map((entry) => ({
        role_id: row.role_id,
        method_id: row.method_id,
        method_label: row.method_label,
        year: row.year,
        emissions_category: 'process',
        pollutant: entry.pollutant,
        value: entry.value,
        unit: row.emissions_units,
        emissions_boundary_notes: row.emissions_boundary_notes,
      })),
    ]),
  );
}

function buildSourceRows(sourceLedger: SourceLedgerEntry[], referencedSourceIds: Set<string>): CsvRow[] {
  return sourceLedger
    .filter((entry) => referencedSourceIds.has(entry.sourceId))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId))
    .map((entry) => ({
      source_id: entry.sourceId,
      citation: entry.citation,
      publication_date: entry.publicationDate,
      institution: entry.institution,
      location: entry.location,
      parameters_informed: entry.parametersInformed,
      quality_notes: entry.qualityNotes,
    }));
}

function buildAssumptionRows(
  assumptionsLedger: AssumptionLedgerEntry[],
  referencedAssumptionIds: Set<string>,
): CsvRow[] {
  return assumptionsLedger
    .filter((entry) => referencedAssumptionIds.has(entry.assumptionId))
    .sort((left, right) => left.assumptionId.localeCompare(right.assumptionId))
    .map((entry) => ({
      assumption_id: entry.assumptionId,
      statement: entry.statement,
      rationale: entry.rationale,
      affected_scope: entry.affectedScope,
      sensitivity_importance: entry.sensitivityImportance,
      validation_route: entry.validationRoute,
    }));
}

function buildReadme(manifest: Record<string, unknown>): string {
  const scope = manifest.scope as {
    role_id: string | null;
    representation_id: string | null;
    method_id: string | null;
  };

  return [
    'Simple MSM Library Chart Data Export',
    '',
    `Generated at: ${manifest.generated_at}`,
    `Role: ${scope.role_id ?? 'All roles'}`,
    `Representation: ${scope.representation_id ?? 'Default representation'}`,
    `Selected method: ${scope.method_id ?? 'None'}`,
    '',
    'This zip contains the data behind the Library page chart panels for the visible scope at export time.',
    'Open report.html in a browser for an offline chart view, or inspect the CSV files in the data/ folder.',
    '',
    'Files:',
    ...FILE_PATHS.map((path) => `- ${path}`),
    '',
  ].join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function chartPointKey(methodId: string, metricId: string, year: number): string {
  return `${methodId}\u0000${metricId}\u0000${year}`;
}

function formatReportPoint(point: ChartPointRow | undefined): string {
  if (!point?.display_value) return '';
  return point.unit ? `${point.display_value} ${point.unit}` : point.display_value;
}

function buildReportComparisonRows(
  trajectories: RoleMethodTrajectory[],
  years: number[],
  chartPoints: ChartPointRow[],
): ReportComparisonRow[] {
  const pointByKey = new Map(
    chartPoints.map((point) => [chartPointKey(point.method_id, point.metric_id, point.year), point]),
  );

  return trajectories.flatMap((trajectory) => {
    const baseRows = REPORT_BASE_METRICS.map((metric) => ({
      method_id: trajectory.methodId,
      method_label: trajectory.label,
      metric_id: metric.id,
      metric_label: metric.label,
      values: Object.fromEntries(
        years.map((year) => [
          String(year),
          pointByKey.get(chartPointKey(trajectory.methodId, metric.id, year))?.display_value ?? '',
        ]),
      ),
    }));

    const inputMetrics = Array.from(
      new Map(
        chartPoints
          .filter((point) => point.panel_id === 'input_coefficients' && point.method_id === trajectory.methodId)
          .map((point) => [point.metric_id, point]),
      ).values(),
    ).sort((left, right) =>
      (left.commodity_label || left.metric_label).localeCompare(right.commodity_label || right.metric_label),
    );

    const inputRows = inputMetrics.map((metric) => ({
      method_id: trajectory.methodId,
      method_label: trajectory.label,
      metric_id: metric.metric_id,
      metric_label: `Input coefficient: ${metric.metric_label}`,
      values: Object.fromEntries(
        years.map((year) => [
          String(year),
          formatReportPoint(pointByKey.get(chartPointKey(trajectory.methodId, metric.metric_id, year))),
        ]),
      ),
    }));

    return [...baseRows, ...inputRows];
  });
}

function buildReportHtml(input: {
  manifest: Record<string, unknown>;
  chartPoints: ChartPointRow[];
  trajectories: RoleMethodTrajectory[];
  years: number[];
}): string {
  const scope = input.manifest.scope as { role_id: string | null; representation_id: string | null };
  const title = `Library export: ${scope.role_id ?? 'all roles'} / ${scope.representation_id ?? 'default representation'}`;
  const reportData = {
    manifest: input.manifest,
    years: input.years,
    trajectories: input.trajectories.map((trajectory) => ({
      method_id: trajectory.methodId,
      method_label: trajectory.label,
      output_id: trajectory.representative.output_id,
      output_unit: trajectory.outputUnit,
      emissions_unit: trajectory.emissionsUnit,
    })),
    chartPoints: input.chartPoints,
    comparisonRows: buildReportComparisonRows(input.trajectories, input.years, input.chartPoints),
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --border: #d9e2ec;
      --muted: #52606d;
      --text: #102a43;
      --surface: #ffffff;
      --panel: #f8fafc;
      --accent: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background: #f5f7fa;
    }
    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 28px;
    }
    header, section, article {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 16px;
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: 26px; margin-bottom: 8px; }
    h2 { font-size: 18px; margin-bottom: 4px; }
    p, dd, td, th, button { font-size: 14px; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    dl { margin: 0; }
    dt {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }
    dd {
      margin: 4px 0 0;
      font-weight: 600;
    }
    .selector {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    button {
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--panel);
      color: var(--text);
      cursor: pointer;
      padding: 8px 12px;
    }
    button[aria-pressed="true"] {
      border-color: rgba(37, 99, 235, 0.35);
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 700;
    }
    .charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
      gap: 16px;
    }
    .chart-card {
      margin: 0;
      min-width: 0;
    }
    svg {
      display: block;
      width: 100%;
      height: 280px;
      overflow: visible;
    }
    .axis-label, .tick-label {
      fill: var(--muted);
      font-size: 11px;
    }
    .grid-line {
      stroke: #e5edf5;
      stroke-width: 1;
    }
    .line-path {
      fill: none;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .line-path.is-selected {
      stroke-width: 4;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border-top: 1px solid var(--border);
      padding: 8px;
      text-align: right;
      vertical-align: top;
    }
    th:first-child, td:first-child,
    th:nth-child(2), td:nth-child(2) {
      text-align: left;
    }
    @media (max-width: 640px) {
      main { padding: 14px; }
      .charts { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p>Offline Library chart export generated from the visible scope in simple-msm.</p>
      <dl class="meta-grid" id="metadata"></dl>
    </header>

    <section>
      <h2>Method selector</h2>
      <p>Select a trajectory to highlight it across the report charts.</p>
      <div class="selector" id="state-selector"></div>
    </section>

    <section>
      <h2>Chart panels</h2>
      <div class="charts" id="charts"></div>
    </section>

    <section>
      <h2>Comparison table</h2>
      <div id="comparison-table"></div>
    </section>
  </main>

  <script type="application/json" id="library-export-data">${escapeJsonForScript(reportData)}</script>
  <script>
    (function () {
      var data = JSON.parse(document.getElementById('library-export-data').textContent || '{}');
      var selectedMethodId = data.manifest.scope.method_id || (data.trajectories[0] && data.trajectories[0].method_id) || null;
      var palette = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#4d7c0f', '#be123c'];
      var panelOrder = [
        ['cost', 'Cost trajectory'],
        ['emissions', 'Energy and process emissions'],
        ['max_share', 'Max share'],
        ['max_activity', 'Max activity'],
        ['input_coefficients', 'Input coefficient trajectories']
      ];
      var colorByMethod = {};
      data.trajectories.forEach(function (trajectory, index) {
        colorByMethod[trajectory.method_id] = palette[index % palette.length];
      });

      function text(value) {
        return value == null || value === '' ? '—' : String(value);
      }

      function escapeText(value) {
        return text(value).replace(/[&<>"']/g, function (character) {
          return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
          }[character];
        });
      }

      function appendText(parent, value, attrs) {
        var node = document.createElementNS('http' + '://www.w3.org/2000/svg', 'text');
        Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
        node.textContent = value;
        parent.appendChild(node);
        return node;
      }

      function renderMetadata() {
        var fields = [
          ['Generated', data.manifest.generated_at],
          ['Role', data.manifest.scope.role_id || 'All roles'],
          ['Representation', data.manifest.scope.representation_id || 'Default representation'],
          ['Filters', JSON.stringify(data.manifest.scope.active_filters || {})],
          ['Visible methods', data.manifest.trajectory_count],
          ['Years', data.years.join(', ')],
          ['Initial highlight', selectedMethodId || 'None']
        ];
        document.getElementById('metadata').innerHTML = fields.map(function (field) {
          return '<div><dt>' + escapeText(field[0]) + '</dt><dd>' + escapeText(field[1]) + '</dd></div>';
        }).join('');
      }

      function renderSelector() {
        var container = document.getElementById('state-selector');
        container.innerHTML = '';
        data.trajectories.forEach(function (trajectory) {
          var button = document.createElement('button');
          button.type = 'button';
          button.textContent = trajectory.method_label;
          button.setAttribute('aria-pressed', trajectory.method_id === selectedMethodId ? 'true' : 'false');
          button.onclick = function () {
            selectedMethodId = trajectory.method_id;
            renderAll();
          };
          container.appendChild(button);
        });
      }

      function groupBySeries(rows) {
        var groups = {};
        rows.forEach(function (row) {
          if (typeof row.value !== 'number' || !isFinite(row.value)) return;
          if (!groups[row.series_id]) groups[row.series_id] = [];
          groups[row.series_id].push(row);
        });
        return Object.keys(groups).map(function (seriesId) {
          groups[seriesId].sort(function (left, right) { return left.year - right.year; });
          return {
            id: seriesId,
            rows: groups[seriesId],
            first: groups[seriesId][0]
          };
        }).sort(function (left, right) {
          return (left.first.method_id === selectedMethodId ? 1 : 0) - (right.first.method_id === selectedMethodId ? 1 : 0);
        });
      }

      function formatTick(panelId, value) {
        if (panelId === 'max_share') return Math.round(value * 100) + '%';
        return new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 }).format(value);
      }

      function renderChart(panelId, panelLabel) {
        var panelRows = data.chartPoints.filter(function (row) { return row.panel_id === panelId; });
        var series = groupBySeries(panelRows);
        var article = document.createElement('article');
        article.className = 'chart-card';
        var title = document.createElement('h3');
        title.textContent = panelLabel;
        article.appendChild(title);
        if (!series.length) {
          var empty = document.createElement('p');
          empty.textContent = 'No values available for this chart.';
          article.appendChild(empty);
          return article;
        }

        var values = panelRows.map(function (row) { return row.value; }).filter(function (value) {
          return typeof value === 'number' && isFinite(value);
        });
        var maxValue = Math.max.apply(null, values);
        var minValue = Math.min.apply(null, values);
        if (minValue > 0) minValue = 0;
        if (maxValue === minValue) maxValue = minValue + 1;
        var width = 760;
        var height = 280;
        var margin = { top: 18, right: 18, bottom: 34, left: 72 };
        var plotWidth = width - margin.left - margin.right;
        var plotHeight = height - margin.top - margin.bottom;
        var years = data.years;
        var x = function (year) {
          var index = years.indexOf(year);
          return margin.left + (years.length <= 1 ? plotWidth / 2 : (index / (years.length - 1)) * plotWidth);
        };
        var y = function (value) {
          return margin.top + plotHeight - ((value - minValue) / (maxValue - minValue)) * plotHeight;
        };
        var svg = document.createElementNS('http' + '://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        [0, 0.5, 1].forEach(function (ratio) {
          var gridY = margin.top + ratio * plotHeight;
          var line = document.createElementNS('http' + '://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', margin.left);
          line.setAttribute('x2', width - margin.right);
          line.setAttribute('y1', gridY);
          line.setAttribute('y2', gridY);
          line.setAttribute('class', 'grid-line');
          svg.appendChild(line);
          appendText(svg, formatTick(panelId, maxValue - ratio * (maxValue - minValue)), {
            x: 8,
            y: String(gridY + 4),
            class: 'tick-label'
          });
        });
        years.forEach(function (year) {
          appendText(svg, String(year), {
            x: String(x(year)),
            y: String(height - 8),
            'text-anchor': 'middle',
            class: 'tick-label'
          });
        });
        series.forEach(function (entry) {
          var path = document.createElementNS('http' + '://www.w3.org/2000/svg', 'path');
          var d = entry.rows.map(function (row, index) {
            return (index === 0 ? 'M' : 'L') + x(row.year) + ' ' + y(row.value);
          }).join(' ');
          var selected = entry.first.method_id === selectedMethodId;
          path.setAttribute('d', d);
          path.setAttribute('class', 'line-path' + (selected ? ' is-selected' : ''));
          path.setAttribute('stroke', colorByMethod[entry.first.method_id] || '#52606d');
          path.setAttribute('opacity', selected ? '1' : '0.32');
          if (entry.first.line_style && entry.first.line_style !== 'solid') {
            path.setAttribute('stroke-dasharray', entry.first.line_style);
          }
          svg.appendChild(path);
        });
        article.appendChild(svg);
        return article;
      }

      function renderCharts() {
        var container = document.getElementById('charts');
        container.innerHTML = '';
        panelOrder.forEach(function (panel) {
          container.appendChild(renderChart(panel[0], panel[1]));
        });
      }

      function buildComparisonTable() {
        var rows = data.comparisonRows || [];
        var html = '<table><thead><tr><th>Method</th><th>Metric</th>' + data.years.map(function (year) {
          return '<th>' + escapeText(year) + '</th>';
        }).join('') + '</tr></thead><tbody>';
        rows.forEach(function (row) {
          html += '<tr><td>' + escapeText(row.method_label) + '</td><td>' + escapeText(row.metric_label) + '</td>' + data.years.map(function (year) {
            return '<td>' + escapeText(row.values[year]) + '</td>';
          }).join('') + '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('comparison-table').innerHTML = html;
      }

      function renderAll() {
        renderMetadata();
        renderSelector();
        renderCharts();
        buildComparisonTable();
      }

      renderAll();
    })();
  </script>
</body>
</html>
`;
}

export function buildLibraryExportBundle(input: LibraryExportInput): LibraryExportBundle {
  const years = collectYears(input.trajectories);
  const selectedTrajectory = input.trajectories.find(
    (trajectory) => trajectory.methodId === input.scope.methodId,
  ) ?? null;
  const referencedSourceIds = collectReferencedIds(input.trajectories, 'source_ids');
  const referencedAssumptionIds = collectReferencedIds(input.trajectories, 'assumption_ids');
  const sourceRows = buildSourceRows(input.sourceLedger, referencedSourceIds);
  const assumptionRows = buildAssumptionRows(input.assumptionsLedger, referencedAssumptionIds);
  const chartPointRows = buildChartPointRows(input.trajectories, input.scope.methodId);
  const methodYearRows = buildMethodYearRows(input.trajectories);
  const inputCoefficientRows = buildInputCoefficientRows(input.trajectories);
  const emissionsByPollutantRows = buildEmissionsByPollutantRows(input.trajectories);
  const missingSourceIds = Array.from(referencedSourceIds)
    .filter((sourceId) => !input.sourceLedger.some((entry) => entry.sourceId === sourceId))
    .sort((left, right) => left.localeCompare(right));
  const missingAssumptionIds = Array.from(referencedAssumptionIds)
    .filter((assumptionId) => !input.assumptionsLedger.some((entry) => entry.assumptionId === assumptionId))
    .sort((left, right) => left.localeCompare(right));
  const manifest = {
    export_type: 'simple-msm-library-chart-data',
    version: 1,
    generated_at: input.scope.generatedAt,
    scope: {
      role_id: input.scope.roleId,
      representation_id: input.scope.representationId,
      method_id: input.scope.methodId,
      filters: input.scope.filters,
      active_filters: activeFilters(input.scope.filters),
      method_label: selectedTrajectory?.label ?? null,
    },
    trajectory_count: input.trajectories.length,
    trajectories: input.trajectories.map((trajectory) => ({
      method_id: trajectory.methodId,
      method_label: trajectory.label,
      role_id: trajectory.representative.role_id,
      representation_id: trajectory.representative.representation_id,
      output_id: trajectory.representative.output_id,
      reporting_allocations: trajectory.representative.reporting_allocations.map((allocation) => ({
        reporting_sector: allocation.sector,
        reporting_subsector: allocation.subsector,
        reporting_bucket: allocation.reporting_bucket,
        allocation_share: allocation.allocation_share,
      })),
      region: trajectory.region,
    })),
    years,
    year_range: {
      min: years[0] ?? null,
      max: years.at(-1) ?? null,
    },
    row_counts: {
      chart_points: chartPointRows.length,
      method_years: methodYearRows.length,
      input_coefficients: inputCoefficientRows.length,
      emissions_by_pollutant: emissionsByPollutantRows.length,
      sources: sourceRows.length,
      assumptions: assumptionRows.length,
    },
    missing_source_ids: missingSourceIds,
    missing_assumption_ids: missingAssumptionIds,
    files: [...FILE_PATHS],
  };
  const reportHtml = buildReportHtml({
    manifest,
    chartPoints: chartPointRows,
    trajectories: input.trajectories,
    years,
  });
  const files = {
    'manifest.json': `${JSON.stringify(manifest, null, 2)}\n`,
    'README.txt': buildReadme(manifest),
    'report.html': reportHtml,
    'data/chart_points.csv': serializeCsv(CHART_POINT_HEADERS, chartPointRows),
    'data/method_years.csv': serializeCsv(METHOD_YEAR_HEADERS, methodYearRows),
    'data/input_coefficients.csv': serializeCsv(INPUT_COEFFICIENT_HEADERS, inputCoefficientRows),
    'data/emissions_by_pollutant.csv': serializeCsv(EMISSIONS_BY_POLLUTANT_HEADERS, emissionsByPollutantRows),
    'data/sources.csv': serializeCsv(SOURCE_HEADERS, sourceRows),
    'data/assumptions.csv': serializeCsv(ASSUMPTION_HEADERS, assumptionRows),
  };

  return {
    filename: `simple-msm-library-${slugify(input.scope.roleId ?? 'all-roles')}-${slugify(input.scope.methodId ?? input.scope.representationId ?? 'methods')}-${dateToken(input.scope.generatedAt)}.zip`,
    files,
  };
}

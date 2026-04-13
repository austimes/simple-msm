import { loadAppConfig } from './appConfigLoader.ts';
import { buildPackageEnrichment, normalizePackageTextFiles } from './packageCompanions.ts';
import { parseCsv } from './parseCsv.ts';
import { loadDefaultConfiguration } from './configurationDocumentLoader.ts';
import type { EmissionEntry, PackageData, SectorState, ServiceDemandAnchorRow, ServiceDemandAnchorType } from './types.ts';

const packageTextFiles = normalizePackageTextFiles(
  import.meta.glob<string>(
    [
      '../../../aus_phase1_sector_state_library/README.md',
      '../../../aus_phase1_sector_state_library/data/*.csv',
      '../../../aus_phase1_sector_state_library/data/*.json',
      '../../../aus_phase1_sector_state_library/docs/**/*.md',
    ],
    {
      eager: true,
      import: 'default',
      query: '?raw',
    },
  ),
);

function requirePackageFile(path: string): string {
  const file = packageTextFiles[path];

  if (file != null) {
    return file;
  }

  throw new Error(`Missing required package file: ${path}`);
}

function parseJsonArray<T>(raw: string): T[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function parseNum(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseBool(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === 'true';
}

function toSectorState(row: Record<string, string>): SectorState {
  return {
    sector: row['sector'],
    subsector: row['subsector'],
    service_or_output_name: row['service_or_output_name'],
    region: row['region'],
    year: Number(row['year']),
    state_id: row['state_id'],
    state_label: row['state_label'],
    state_description: row['state_description'],
    output_unit: row['output_unit'],
    output_quantity_basis: row['output_quantity_basis'],
    output_cost_per_unit: parseNum(row['output_cost_per_unit']),
    cost_basis_year: parseNum(row['cost_basis_year']),
    currency: row['currency'],
    cost_components_summary: row['cost_components_summary'],
    input_commodities: parseJsonArray<string>(row['input_commodities']),
    input_coefficients: parseJsonArray<number>(row['input_coefficients']),
    input_units: parseJsonArray<string>(row['input_units']),
    input_basis_notes: row['input_basis_notes'],
    energy_emissions_by_pollutant: parseJsonArray<EmissionEntry>(row['energy_emissions_by_pollutant']),
    process_emissions_by_pollutant: parseJsonArray<EmissionEntry>(row['process_emissions_by_pollutant']),
    emissions_units: row['emissions_units'],
    emissions_boundary_notes: row['emissions_boundary_notes'],
    max_share: parseNum(row['max_share']),
    max_activity: parseNum(row['max_activity']),
    min_share: parseNum(row['min_share']),
    rollout_limit_notes: row['rollout_limit_notes'],
    availability_conditions: row['availability_conditions'],
    source_ids: parseJsonArray<string>(row['source_ids']),
    evidence_summary: row['evidence_summary'],
    derivation_method: row['derivation_method'],
    assumption_ids: parseJsonArray<string>(row['assumption_ids']),
    confidence_rating: row['confidence_rating'],
    review_notes: row['review_notes'],
    candidate_expansion_pathway: row['candidate_expansion_pathway'],
    times_or_vedalang_mapping_notes: row['times_or_vedalang_mapping_notes'],
    would_expand_to_explicit_capacity: parseBool(row['would_expand_to_explicit_capacity?']),
    would_expand_to_process_chain: parseBool(row['would_expand_to_process_chain?']),
    energy_co2e: parseNum(row['energy_co2e']),
    process_co2e: parseNum(row['process_co2e']),
    state_stage_family: row['state_stage_family'] ?? '',
    state_stage_rank: parseNum(row['state_stage_rank']),
    state_stage_code: row['state_stage_code'] ?? '',
    state_sort_key: row['state_sort_key'] ?? '',
    state_label_standardized: row['state_label_standardized'] ?? '',
    is_default_incumbent_2025: parseBool(row['is_default_incumbent_2025']),
    state_option_rank: parseNum(row['state_option_rank']),
    state_option_code: row['state_option_code'] ?? '',
    state_option_label: row['state_option_label'] ?? '',
    balance_tuning_flag: parseBool(row['balance_tuning_flag']),
    balance_tuning_note: row['balance_tuning_note'] ?? '',
    benchmark_balance_note: row['benchmark_balance_note'] ?? '',
  };
}

function toServiceDemandAnchorRow(row: Record<string, string>): ServiceDemandAnchorRow {
  return {
    anchor_type: row['anchor_type'] as ServiceDemandAnchorType,
    service_or_output_name: row['service_or_output_name'],
    default_2025_state_id: row['default_2025_state_id'],
    default_2025_state_option_code: row['default_2025_state_option_code'],
    default_2025_state_option_label: row['default_2025_state_option_label'],
    quantity_2025: parseNum(row['quantity_2025']),
    unit: row['unit'],
    anchor_status: row['anchor_status'],
    source_family: row['source_family'],
    coverage_note: row['coverage_note'],
    implied_gross_input_energy_pj_if_default: parseNum(row['implied_gross_input_energy_pj_if_default']),
    implied_benchmark_final_energy_pj_if_default: parseNum(row['implied_benchmark_final_energy_pj_if_default']),
    implied_energy_emissions_mtco2e_if_default: parseNum(row['implied_energy_emissions_mtco2e_if_default']),
    implied_process_emissions_mtco2e_if_default: parseNum(row['implied_process_emissions_mtco2e_if_default']),
    implied_total_emissions_mtco2e_if_default: parseNum(row['implied_total_emissions_mtco2e_if_default']),
  };
}

export function loadPackage(): PackageData {
  const rows = parseCsv(requirePackageFile('data/sector_state_curves_balanced.csv'));
  const anchorRows = parseCsv(requirePackageFile('data/service_demand_anchors_2025.csv'));
  const appConfig = loadAppConfig();
  const enrichment = buildPackageEnrichment(packageTextFiles);
  const defaultConfiguration = loadDefaultConfiguration(appConfig);

  return {
    sectorStates: rows.map(toSectorState),
    serviceDemandAnchors2025: anchorRows.map(toServiceDemandAnchorRow),
    readme: enrichment.readme,
    phase2Memo: enrichment.phase2Memo,
    enrichment,
    appConfig,
    defaultConfiguration,
  };
}

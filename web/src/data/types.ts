export interface EmissionEntry {
  pollutant: string;
  value: number;
}

export type OutputRole = 'required_service' | 'endogenous_supply_commodity' | 'optional_activity';

export type ConfigurationControlMode =
  | 'optimize'
  | 'externalized'
  | 'target';

export const CONFIGURATION_YEARS = [2025, 2030, 2035, 2040, 2045, 2050] as const;

export type ConfigurationYear = (typeof CONFIGURATION_YEARS)[number];
export type ConfigurationYearKey = `${ConfigurationYear}`;
export type ConfigurationYearValueTable = Partial<Record<ConfigurationYearKey, number>>;

export const PRICE_LEVELS = ['low', 'medium', 'high'] as const;
export type PriceLevel = (typeof PRICE_LEVELS)[number];

export interface ConfigurationServiceControlYearOverride {
  mode?: ConfigurationControlMode;
  target_value?: number | null;
  active_state_ids?: string[] | null;
}

export interface ConfigurationServiceControl {
  mode: ConfigurationControlMode;
  target_value?: number | null;
  active_state_ids?: string[] | null;
  year_overrides?: Partial<Record<ConfigurationYearKey, ConfigurationServiceControlYearOverride>> | null;
}

export type ConfigurationDemandGenerationMode =
  | 'manual_table'
  | 'anchor_plus_preset'
  | 'anchor_plus_preset_with_overrides';

export interface ConfigurationDemandGeneration {
  mode: ConfigurationDemandGenerationMode;
  anchor_year: 2025;
  preset_id: string | null;
  service_anchors: Record<string, number>;
  service_growth_rates_pct_per_year?: Record<string, number> | null;
  external_commodity_anchors?: Record<string, number> | null;
  external_commodity_growth_rates_pct_per_year?: Record<string, number> | null;
  year_overrides?: Record<string, Record<string, number>> | null;
  notes?: string | null;
}

export interface ConfigurationCommodityPricing {
  selections_by_commodity: Partial<Record<string, PriceLevel>>;
  overrides: Record<string, Record<string, number>>;
}

export interface ConfigurationShareSmoothing {
  enabled?: boolean;
  max_delta_pp?: number;
  notes?: string | null;
}

export interface ConfigurationSolverOptions {
  respect_max_share?: boolean;
  respect_max_activity?: boolean;
  soft_constraints?: boolean;
  share_smoothing?: ConfigurationShareSmoothing;
}

export interface ConfigurationAppMetadata {
  id?: string;
  readonly?: boolean;
}

export type ResidualOverlayDisplayMode = 'aggregated_non_sink' | 'individual';

export interface ConfigurationPresentationOptions {
  residual_overlay_display_mode?: ResidualOverlayDisplayMode;
}

export interface ConfigurationDocument {
  name: string;
  description?: string;
  years: ConfigurationYear[];
  service_controls: Record<string, ConfigurationServiceControl>;
  service_demands: Record<string, ConfigurationYearValueTable>;
  demand_generation: ConfigurationDemandGeneration;
  external_commodity_demands?: Record<string, ConfigurationYearValueTable>;
  commodity_pricing: ConfigurationCommodityPricing;
  carbon_price: ConfigurationYearValueTable;
  residual_overlays?: ConfigurationResidualOverlays;
  presentation_options?: ConfigurationPresentationOptions;
  solver_options?: ConfigurationSolverOptions;
  app_metadata?: ConfigurationAppMetadata;
}

export interface OutputRoleMetadata {
  output_role: OutputRole;
  display_label: string;
  display_group: string;
  display_group_order: number;
  display_order: number;
  participates_in_commodity_balance: boolean;
  demand_required: boolean;
  default_control_mode: ConfigurationControlMode;
  allowed_control_modes: ConfigurationControlMode[];
  explanation_group: string;
}

export interface BaselineActivityAnchor {
  output_role: OutputRole;
  anchor_kind: 'service_demand' | 'external_commodity_demand';
  anchor_year: number;
  value: number;
  unit: string;
  provenance_note: string;
}

export interface DemandGrowthPreset {
  label: string;
  description: string;
  annual_growth_rates_pct_per_year: Record<string, number>;
  external_commodity_growth_rates_pct_per_year: Record<string, number>;
  milestone_multipliers_by_output?: Record<string, Record<string, number>>;
  milestone_multipliers_by_external_commodity?: Record<string, Record<string, number>>;
  provenance_note: string;
}

export interface CommodityPriceSeries {
  unit: string;
  values_by_year: Record<string, number>;
}

export interface CommodityPriceDriver {
  label: string;
  levels: Record<PriceLevel, CommodityPriceSeries>;
  provenance_note: string;
}

export interface CarbonPricePreset {
  label: string;
  description: string;
  unit: string;
  values_by_year: Record<string, number>;
  provenance_note: string;
}

export type ExplanationComparisonBasis = 'coefficient_delta' | 'metadata_signal' | 'mixed';

export interface ExplanationTagRule {
  label: string;
  description: string;
  comparison_basis: ExplanationComparisonBasis;
  positive_input_commodities?: string[];
  negative_input_commodities?: string[];
  derived_signals?: string[];
  metadata_signals?: string[];
  applies_to_outputs?: string[];
  applies_to_output_roles?: OutputRole[];
}

export interface AppConfigRegistry {
  output_roles: Record<string, OutputRoleMetadata>;
  baseline_activity_anchors: Record<string, BaselineActivityAnchor>;
  demand_growth_presets: Record<string, DemandGrowthPreset>;
  commodity_price_presets: Record<string, CommodityPriceDriver>;
  carbon_price_presets: Record<string, CarbonPricePreset>;
  explanation_tag_rules: Record<string, ExplanationTagRule>;
}

export interface SourceLedgerEntry {
  sourceId: string;
  citation: string;
  publicationDate: string;
  institution: string;
  location: string;
  parametersInformed: string;
  qualityNotes: string;
}

export interface AssumptionLedgerEntry {
  assumptionId: string;
  statement: string;
  rationale: string;
  affectedScope: string;
  sensitivityImportance: string;
  validationRoute: string;
}

export interface PackageSchemaField {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface PackageSchemaInfo {
  title: string;
  description: string;
  requiredFields: string[];
  propertyCount: number;
  fields: PackageSchemaField[];
}

export interface PackageCompanionDoc {
  key: string;
  path: string;
  title: string;
  content: string;
}

export interface PackageEnrichment {
  availablePaths: string[];
  warnings: string[];
  readme: string;
  phase2Memo: string;
  methodsOverview: string;
  calibrationValidation: string;
  uncertaintyConfidence: string;
  sourceLedger: SourceLedgerEntry[];
  assumptionsLedger: AssumptionLedgerEntry[];
  sectorStatesSchema: PackageSchemaInfo | null;
  sectorDerivations: Record<string, PackageCompanionDoc>;
}

export interface SectorState {
  family_id: string;
  sector: string;
  subsector: string;
  service_or_output_name: string;
  region: string;
  year: number;
  state_id: string;
  state_label: string;
  state_description: string;
  output_unit: string;
  output_quantity_basis: string;
  output_cost_per_unit: number | null;
  cost_basis_year: number | null;
  currency: string;
  cost_components_summary: string;
  input_commodities: string[];
  input_coefficients: number[];
  input_units: string[];
  input_basis_notes: string;
  energy_emissions_by_pollutant: EmissionEntry[];
  process_emissions_by_pollutant: EmissionEntry[];
  emissions_units: string;
  emissions_boundary_notes: string;
  max_share: number | null;
  max_activity: number | null;
  min_share: number | null;
  rollout_limit_notes: string;
  availability_conditions: string;
  source_ids: string[];
  evidence_summary: string;
  derivation_method: string;
  assumption_ids: string[];
  confidence_rating: string;
  review_notes: string;
  candidate_expansion_pathway: string;
  times_or_vedalang_mapping_notes: string;
  would_expand_to_explicit_capacity: boolean;
  would_expand_to_process_chain: boolean;
  energy_co2e: number | null;
  process_co2e: number | null;
  state_stage_family: string;
  state_stage_rank: number | null;
  state_stage_code: string;
  state_sort_key: string;
  state_label_standardized: string;
  is_default_incumbent_2025: boolean;
  state_option_rank: number | null;
  state_option_code: string;
  state_option_label: string;
  balance_tuning_flag: boolean;
  balance_tuning_note: string;
  benchmark_balance_note: string;
}

export type ServiceDemandAnchorType =
  | 'service_demand_anchor'
  | 'derived_explicit_electricity_load'
  | 'external_electricity_balance_anchor'
  | 'electricity_output_benchmark';

export interface ServiceDemandAnchorRow {
  anchor_type: ServiceDemandAnchorType;
  service_or_output_name: string;
  default_2025_state_id: string;
  default_2025_state_option_code: string;
  default_2025_state_option_label: string;
  quantity_2025: number | null;
  unit: string;
  anchor_status: string;
  source_family: string;
  coverage_note: string;
  implied_gross_input_energy_pj_if_default: number | null;
  implied_benchmark_final_energy_pj_if_default: number | null;
  implied_energy_emissions_mtco2e_if_default: number | null;
  implied_process_emissions_mtco2e_if_default: number | null;
  implied_total_emissions_mtco2e_if_default: number | null;
}

export type ResidualOverlayDomain = 'energy_residual' | 'nonenergy_residual' | 'net_sink';

export interface ResidualOverlayRow {
  overlay_id: string;
  overlay_label: string;
  overlay_domain: ResidualOverlayDomain;
  official_accounting_bucket: string;
  year: number;
  commodity: string | null;
  final_energy_pj_2025: number | null;
  native_unit: string;
  native_quantity_2025: number | null;
  direct_energy_emissions_mtco2e_2025: number | null;
  other_emissions_mtco2e_2025: number | null;
  carbon_billable_emissions_mtco2e_2025: number | null;
  default_price_basis: string;
  default_price_per_native_unit_aud_2024: number | null;
  default_commodity_cost_audm_2024: number | null;
  default_fixed_noncommodity_cost_audm_2024: number | null;
  default_total_cost_ex_carbon_audm_2024: number | null;
  default_include: boolean;
  allocation_method: string;
  cost_basis_note: string;
  notes: string;
}

export interface ConfigurationResidualOverlayControl {
  included?: boolean;
}

export interface ConfigurationResidualOverlays {
  controls_by_overlay_id: Record<string, ConfigurationResidualOverlayControl>;
}

export interface CommodityBalance2025Row {
  commodity: string;
  benchmark_stream: string;
  official_benchmark_pj_2025: number | null;
  explicit_gross_model_inputs_pj_2025: number | null;
  explicit_benchmark_mapped_pj_2025: number | null;
  residual_overlay_pj_2025: number | null;
  balanced_total_pj_2025: number | null;
  difference_to_benchmark_pj_2025: number | null;
  native_unit: string;
  official_benchmark_native_2025: number | null;
  explicit_gross_model_inputs_native_2025: number | null;
  explicit_benchmark_mapped_native_2025: number | null;
  residual_overlay_native_2025: number | null;
  balanced_total_native_2025: number | null;
  notes: string;
}

export interface EmissionsBalance2025Row {
  official_category: string;
  official_mtco2e_2025: number | null;
  explicit_model_mtco2e_2025: number | null;
  residual_energy_overlay_mtco2e_2025: number | null;
  residual_nonenergy_overlay_mtco2e_2025: number | null;
  balanced_total_mtco2e_2025: number | null;
  difference_to_official_mtco2e_2025: number | null;
  note: string;
}

export interface PackageData {
  sectorStates: SectorState[];
  serviceDemandAnchors2025: ServiceDemandAnchorRow[];
  residualOverlays2025: ResidualOverlayRow[];
  commodityBalance2025: CommodityBalance2025Row[];
  emissionsBalance2025: EmissionsBalance2025Row[];
  readme: string;
  phase2Memo: string;
  enrichment: PackageEnrichment;
  appConfig: AppConfigRegistry;
  defaultConfiguration: ConfigurationDocument;
}

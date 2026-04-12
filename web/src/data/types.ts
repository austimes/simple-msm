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
  seed_output_ids?: string[];
  /**
   * Backward-compatible alias for `seed_output_ids`.
   * Older saved configuration documents may still use this field.
   */
  included_output_ids?: string[];
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
}

export interface PackageData {
  sectorStates: SectorState[];
  readme: string;
  phase2Memo: string;
  enrichment: PackageEnrichment;
  appConfig: AppConfigRegistry;
  defaultConfiguration: ConfigurationDocument;
}

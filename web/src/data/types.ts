export interface EmissionEntry {
  pollutant: string;
  value: number;
}

export type OutputRole = 'required_service' | 'endogenous_supply_commodity' | 'optional_removals';

export type ScenarioControlMode =
  | 'pinned_single'
  | 'fixed_shares'
  | 'optimize'
  | 'externalized'
  | 'off'
  | 'target';

export interface OutputRoleMetadata {
  output_role: OutputRole;
  display_label: string;
  display_group: string;
  display_group_order: number;
  display_order: number;
  participates_in_commodity_balance: boolean;
  demand_required: boolean;
  default_control_mode: ScenarioControlMode;
  allowed_control_modes: ScenarioControlMode[];
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

export interface CommodityPricePreset {
  label: string;
  description: string;
  prices_by_commodity: Record<string, CommodityPriceSeries>;
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
  commodity_price_presets: Record<string, CommodityPricePreset>;
  explanation_tag_rules: Record<string, ExplanationTagRule>;
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
  appConfig: AppConfigRegistry;
}

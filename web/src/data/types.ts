export interface EmissionEntry {
  pollutant: string;
  value: number;
}

export type OutputRole = 'required_service' | 'endogenous_supply_commodity' | 'optional_activity';
export type FamilyResolution = 'modeled' | 'residual_stub';
export type RoleKind = 'modeled' | 'removal' | 'residual';
export type BalanceType =
  | 'carbon_removal'
  | 'commodity_supply'
  | 'intermediate_conversion'
  | 'intermediate_material'
  | 'residual_accounting'
  | 'service_demand';
export type CoverageObligation =
  | 'explicit_residual_top_level'
  | 'required_decomposition_child'
  | 'required_top_level';
export type RepresentationKind = 'pathway_bundle' | 'technology_bundle' | 'role_decomposition';
export type MethodKind = 'pathway' | 'technology' | 'residual';

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
export type FuelSwitchBasis = 'to' | 'from';

export interface ConfigurationRoleControlYearOverride {
  mode?: ConfigurationControlMode;
  target_value?: number | null;
  active_method_ids?: string[] | null;
}

export interface ConfigurationRoleControl {
  mode: ConfigurationControlMode;
  target_value?: number | null;
  active_method_ids?: string[] | null;
  year_overrides?: Partial<Record<ConfigurationYearKey, ConfigurationRoleControlYearOverride>> | null;
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

export type ConfigurationAutonomousEfficiencyMode = 'baseline' | 'off';

export type ConfigurationEfficiencyPackageMode =
  | 'off'
  | 'all'
  | 'allow_list'
  | 'deny_list';

export interface ConfigurationEfficiencyControls {
  autonomous_mode?: ConfigurationAutonomousEfficiencyMode;
  autonomous_modes_by_role?: Record<string, ConfigurationAutonomousEfficiencyMode> | null;
  package_mode?: ConfigurationEfficiencyPackageMode;
  package_ids?: string[] | null;
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
  representation_by_role?: Record<string, string>;
  role_controls?: Record<string, ConfigurationRoleControl>;
  service_demands: Record<string, ConfigurationYearValueTable>;
  demand_generation: ConfigurationDemandGeneration;
  external_commodity_demands?: Record<string, ConfigurationYearValueTable>;
  commodity_pricing: ConfigurationCommodityPricing;
  carbon_price: ConfigurationYearValueTable;
  efficiency_controls?: ConfigurationEfficiencyControls;
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

export interface RolePresentationMetadata {
  role_id: string;
  role_label: string;
  topology_area_id: string;
  topology_area_label: string;
  output_id: string;
  region: string;
  output_role: OutputRole;
  output_unit: string;
  output_quantity_basis: string;
  default_method_id: string;
  role_kind: RoleKind;
  balance_type: BalanceType;
  coverage_obligation: CoverageObligation;
  reporting_allocations: ReportingAllocation[];
  notes: string;
}

export interface SystemStructureGroupRow {
  group_id: string;
  group_label: string;
  display_order: number;
  notes: string;
}

export interface SystemStructureMemberRow {
  group_id: string;
  family_id: string;
  display_order: number;
  notes: string;
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
  methodYearsSchema: PackageSchemaInfo | null;
  roleReadmes: Record<string, PackageCompanionDoc>;
  resolvedMethodYearsSchema: PackageSchemaInfo | null;
  sectorDerivations: Record<string, PackageCompanionDoc>;
}

export type EfficiencyPackageClassification =
  | 'pure_efficiency_overlay'
  | 'operational_efficiency_overlay';

export interface AutonomousEfficiencyTrack {
  role_id: string;
  family_id: string;
  track_id: string;
  year: number;
  track_label: string;
  track_description: string;
  applicable_method_ids: string[];
  applicable_state_ids: string[];
  affected_input_commodities: string[];
  input_multipliers: number[];
  delta_output_cost_per_unit: number;
  cost_basis_year: number;
  currency: string;
  source_ids: string[];
  assumption_ids: string[];
  evidence_summary: string;
  derivation_method: string;
  confidence_rating: string;
  double_counting_guardrail: string;
  review_notes: string;
}

export interface EfficiencyPackage {
  role_id: string;
  family_id: string;
  package_id: string;
  year: number;
  package_label: string;
  package_description: string;
  classification: EfficiencyPackageClassification;
  applicable_method_ids: string[];
  applicable_state_ids: string[];
  affected_input_commodities: string[];
  input_multipliers: number[];
  delta_output_cost_per_unit: number;
  cost_basis_year: number;
  currency: string;
  max_share: number | null;
  rollout_limit_notes: string;
  source_ids: string[];
  assumption_ids: string[];
  evidence_summary: string;
  derivation_method: string;
  confidence_rating: string;
  review_notes: string;
  non_stacking_group: string | null;
}

export interface ResolvedMethodYearRow {
  role_id: string;
  representation_id: string;
  method_id: string;
  method_kind: MethodKind;
  method_label: string;
  method_description: string;
  role_kind: RoleKind;
  balance_type: BalanceType;
  output_id: string;
  role_label: string;
  topology_area_id: string;
  topology_area_label: string;
  parent_role_id: string | null;
  coverage_obligation: CoverageObligation;
  default_representation_kind: RepresentationKind;
  reporting_allocations: ReportingAllocation[];
  region: string;
  year: number;
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
  method_stage_family: string;
  method_stage_rank: number | null;
  method_stage_code: string;
  method_sort_key: string;
  method_label_standardized: string;
  is_default_incumbent_2025: boolean;
  method_option_rank: number | null;
  method_option_code: string;
  method_option_label: string;
  family_id: string;
  family_resolution: FamilyResolution;
  coverage_scope_id: string;
  coverage_scope_label: string;
  sector: string;
  subsector: string;
  service_or_output_name: string;
  state_id: string;
  state_label: string;
  state_description: string;
  state_stage_family: string;
  state_stage_rank: number | null;
  state_stage_code: string;
  state_sort_key: string;
  state_label_standardized: string;
  state_option_rank: number | null;
  state_option_code: string;
  state_option_label: string;
  balance_tuning_flag: boolean;
  balance_tuning_note: string;
  benchmark_balance_note: string;
}

export interface RoleMetadata {
  role_id: string;
  role_label: string;
  description: string;
  topology_area_id: string;
  topology_area_label: string;
  parent_role_id: string | null;
  role_kind: RoleKind;
  balance_type: BalanceType;
  output_unit: string;
  coverage_obligation: CoverageObligation;
  default_representation_kind: RepresentationKind;
  notes: string;
}

export interface RoleRepresentation {
  representation_id: string;
  role_id: string;
  representation_kind: RepresentationKind;
  representation_label: string;
  description: string;
  is_default: boolean;
  direct_method_kind: MethodKind | null;
  notes: string;
}

export interface RoleDecompositionEdge {
  parent_representation_id: string;
  parent_role_id: string;
  child_role_id: string;
  edge_kind: 'required_child' | 'optional_child';
  is_required: boolean;
  display_order: number;
  coverage_notes: string;
}

export interface ReportingAllocation {
  reporting_allocation_id: string;
  role_id: string;
  reporting_system: string;
  sector: string;
  subsector: string;
  reporting_bucket: string;
  allocation_basis: string;
  allocation_share: number;
  notes: string;
}

export interface Method {
  role_id: string;
  representation_id: string;
  method_id: string;
  method_kind: MethodKind;
  method_label: string;
  method_description: string;
  is_residual: boolean;
  sort_order: number;
  source_ids: string[];
  assumption_ids: string[];
  evidence_summary: string;
  derivation_method: string;
  confidence_rating: string;
  review_notes: string;
}

export interface MethodYear {
  role_id: string;
  representation_id: string;
  method_id: string;
  year: number;
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
  assumption_ids: string[];
  evidence_summary: string;
  derivation_method: string;
  confidence_rating: string;
  review_notes: string;
  candidate_expansion_pathway: string;
  times_or_vedalang_mapping_notes: string;
  would_expand_to_explicit_capacity: boolean;
  would_expand_to_process_chain: boolean;
}

export interface ResolvedActiveRole {
  roleId: string;
  representationId: string;
  representationKind: RepresentationKind;
  activeMethodIds: string[];
  activeChildRoleIds: string[];
}

export interface ResolvedActiveRoleStructure {
  activeRoleIds: string[];
  inactiveRoleIds: string[];
  activeRepresentationByRole: Record<string, string>;
  activeMethodIdsByRole: Record<string, string[]>;
  activeMethodKeys: Set<string>;
  roles: ResolvedActiveRole[];
}

export interface RoleDemand {
  role_id: string;
  anchor_year: number;
  anchor_value: number;
  unit: string;
  demand_growth_curve_id: string;
  anchor_status: string;
  source_role: string;
  coverage_note: string;
  notes: string;
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
  roleMetadata: RoleMetadata[];
  representations: RoleRepresentation[];
  roleDecompositionEdges: RoleDecompositionEdge[];
  reportingAllocations: ReportingAllocation[];
  methods: Method[];
  methodYears: MethodYear[];
  roleDemands: RoleDemand[];
  rolePresentationMetadata: RolePresentationMetadata[];
  systemStructureGroups: SystemStructureGroupRow[];
  systemStructureMembers: SystemStructureMemberRow[];
  resolvedMethodYears: ResolvedMethodYearRow[];
  autonomousEfficiencyTracks: AutonomousEfficiencyTrack[];
  efficiencyPackages: EfficiencyPackage[];
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

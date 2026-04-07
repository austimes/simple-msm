export interface EmissionEntry {
  pollutant: string;
  value: number;
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
}

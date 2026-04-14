import {
  CONFIGURATION_YEARS,
  type PackageSchemaField,
  type PackageSchemaInfo,
  type SectorState,
} from '../data/types';

type StateSchemaSectionTitle =
  | 'Identity and family context'
  | 'Output and cost basis'
  | 'Inputs and emissions'
  | 'Constraints and availability'
  | 'Evidence and confidence'
  | 'Expansion and future mapping';

type FieldFamilyBehaviour = 'Constant across a state family' | 'Can vary by year';

export interface StateSchemaFieldPresentation extends PackageSchemaField {
  familyBehaviour: FieldFamilyBehaviour;
  csvEncodingNotes: string;
}

export interface StateSchemaSection {
  title: StateSchemaSectionTitle;
  fields: StateSchemaFieldPresentation[];
}

export interface WorkedExampleStateFamily {
  stateId: string;
  sector: string;
  subsector: string;
  serviceOrOutputName: string;
  region: string;
  stateLabel: string;
  stateDescription: string;
  outputUnit: string;
  outputQuantityBasis: string;
  currency: string;
  costBasisYear: number | null;
  rows: SectorState[];
  representativeRow: SectorState;
  representativeRowSnippet: string;
}

export const STATE_SCHEMA_PREFERRED_EXAMPLE_STATE_ID =
  'electricity__grid_supply__incumbent_thermal_mix';

const SECTION_TITLES: StateSchemaSectionTitle[] = [
  'Identity and family context',
  'Output and cost basis',
  'Inputs and emissions',
  'Constraints and availability',
  'Evidence and confidence',
  'Expansion and future mapping',
];

const FIELD_SECTION_BY_NAME: Record<string, StateSchemaSectionTitle> = {
  sector: 'Identity and family context',
  subsector: 'Identity and family context',
  service_or_output_name: 'Identity and family context',
  region: 'Identity and family context',
  year: 'Identity and family context',
  state_id: 'Identity and family context',
  state_label: 'Identity and family context',
  state_description: 'Identity and family context',
  output_unit: 'Output and cost basis',
  output_quantity_basis: 'Output and cost basis',
  output_cost_per_unit: 'Output and cost basis',
  cost_basis_year: 'Output and cost basis',
  currency: 'Output and cost basis',
  cost_components_summary: 'Output and cost basis',
  input_commodities: 'Inputs and emissions',
  input_coefficients: 'Inputs and emissions',
  input_units: 'Inputs and emissions',
  input_basis_notes: 'Inputs and emissions',
  energy_emissions_by_pollutant: 'Inputs and emissions',
  process_emissions_by_pollutant: 'Inputs and emissions',
  emissions_units: 'Inputs and emissions',
  emissions_boundary_notes: 'Inputs and emissions',
  max_share: 'Constraints and availability',
  max_activity: 'Constraints and availability',
  min_share: 'Constraints and availability',
  rollout_limit_notes: 'Constraints and availability',
  availability_conditions: 'Constraints and availability',
  source_ids: 'Evidence and confidence',
  evidence_summary: 'Evidence and confidence',
  derivation_method: 'Evidence and confidence',
  assumption_ids: 'Evidence and confidence',
  confidence_rating: 'Evidence and confidence',
  review_notes: 'Evidence and confidence',
  candidate_expansion_pathway: 'Expansion and future mapping',
  times_or_vedalang_mapping_notes: 'Expansion and future mapping',
  'would_expand_to_explicit_capacity?': 'Expansion and future mapping',
  'would_expand_to_process_chain?': 'Expansion and future mapping',
  family_id: 'Expansion and future mapping',
};

const FAMILY_CONSTANT_FIELDS = new Set([
  'sector',
  'subsector',
  'service_or_output_name',
  'region',
  'state_id',
  'state_label',
  'state_description',
  'output_unit',
  'output_quantity_basis',
  'cost_basis_year',
  'currency',
  'emissions_units',
  'candidate_expansion_pathway',
  'times_or_vedalang_mapping_notes',
  'would_expand_to_explicit_capacity?',
  'would_expand_to_process_chain?',
  'family_id',
]);

const CSV_ARRAY_FIELDS = new Set([
  'input_commodities',
  'input_coefficients',
  'input_units',
  'energy_emissions_by_pollutant',
  'process_emissions_by_pollutant',
  'source_ids',
  'assumption_ids',
]);

const CSV_SNIPPET_FIELDS = [
  'sector',
  'subsector',
  'service_or_output_name',
  'region',
  'year',
  'state_id',
  'state_label',
  'output_cost_per_unit',
  'input_commodities',
  'input_coefficients',
  'input_units',
  'energy_emissions_by_pollutant',
  'process_emissions_by_pollutant',
  'source_ids',
  'assumption_ids',
  'confidence_rating',
] as const;

function getFieldFamilyBehaviour(fieldName: string): FieldFamilyBehaviour {
  return FAMILY_CONSTANT_FIELDS.has(fieldName)
    ? 'Constant across a state family'
    : 'Can vary by year';
}

function getCsvEncodingNotes(field: PackageSchemaField): string {
  if (field.name === 'year') {
    return `Integer milestone year. Phase 1 expects one row for each of ${CONFIGURATION_YEARS.join(', ')}.`;
  }

  if (CSV_ARRAY_FIELDS.has(field.name)) {
    if (field.name === 'input_commodities') {
      return 'JSON-encoded string array in one CSV cell. Keep the item order aligned with input_coefficients and input_units.';
    }

    if (field.name === 'input_coefficients') {
      return 'JSON-encoded numeric array in one CSV cell. Keep the item order aligned with input_commodities and input_units.';
    }

    if (field.name === 'input_units') {
      return 'JSON-encoded string array in one CSV cell. Keep the item order aligned with input_commodities and input_coefficients.';
    }

    if (field.name === 'energy_emissions_by_pollutant' || field.name === 'process_emissions_by_pollutant') {
      return 'JSON-encoded array of {"pollutant","value"} objects in one CSV cell. Negative process values represent removals.';
    }

    if (field.name === 'source_ids' || field.name === 'assumption_ids') {
      return 'JSON-encoded string array in one CSV cell. IDs should resolve in the companion ledger when that ledger is supplied.';
    }
  }

  if (field.type === 'boolean') {
    return 'Boolean CSV cell using the literal values true or false.';
  }

  if (field.type.includes('null')) {
    return field.required
      ? 'Numeric value when known; leave the CSV cell blank only when the schema allows null.'
      : 'Optional numeric cell; leave blank when no value applies.';
  }

  if (field.type === 'integer' || field.type === 'number') {
    return 'Literal numeric CSV cell with no JSON wrapper.';
  }

  return field.required
    ? 'Plain CSV cell using the literal column header shown here.'
    : 'Optional plain-text CSV cell; leave blank when not supplied.';
}

function toCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function encodeCsvValue(row: SectorState, fieldName: (typeof CSV_SNIPPET_FIELDS)[number]): string {
  switch (fieldName) {
    case 'sector':
      return row.sector;
    case 'subsector':
      return row.subsector;
    case 'service_or_output_name':
      return row.service_or_output_name;
    case 'region':
      return row.region;
    case 'year':
      return String(row.year);
    case 'state_id':
      return row.state_id;
    case 'state_label':
      return row.state_label;
    case 'output_cost_per_unit':
      return row.output_cost_per_unit == null ? '' : String(row.output_cost_per_unit);
    case 'input_commodities':
      return JSON.stringify(row.input_commodities);
    case 'input_coefficients':
      return JSON.stringify(row.input_coefficients);
    case 'input_units':
      return JSON.stringify(row.input_units);
    case 'energy_emissions_by_pollutant':
      return JSON.stringify(row.energy_emissions_by_pollutant);
    case 'process_emissions_by_pollutant':
      return JSON.stringify(row.process_emissions_by_pollutant);
    case 'source_ids':
      return JSON.stringify(row.source_ids);
    case 'assumption_ids':
      return JSON.stringify(row.assumption_ids);
    case 'confidence_rating':
      return row.confidence_rating;
  }
}

function buildRepresentativeRowSnippet(row: SectorState): string {
  const header = CSV_SNIPPET_FIELDS.join(',');
  const values = CSV_SNIPPET_FIELDS.map((fieldName) => toCsvCell(encodeCsvValue(row, fieldName)));
  return `${header}\n${values.join(',')}`;
}

export function getStateSchemaMilestoneYears(): number[] {
  return [...CONFIGURATION_YEARS];
}

export function buildStateSchemaSections(schema: PackageSchemaInfo | null): StateSchemaSection[] {
  if (!schema) {
    return [];
  }

  const sectionMap = new Map(
    SECTION_TITLES.map((title) => [title, { title, fields: [] as StateSchemaFieldPresentation[] }]),
  );

  schema.fields.forEach((field) => {
    const sectionTitle = FIELD_SECTION_BY_NAME[field.name] ?? 'Evidence and confidence';
    sectionMap.get(sectionTitle)?.fields.push({
      ...field,
      familyBehaviour: getFieldFamilyBehaviour(field.name),
      csvEncodingNotes: getCsvEncodingNotes(field),
    });
  });

  return SECTION_TITLES.map((title) => sectionMap.get(title)!).filter(
    (section) => section.fields.length > 0,
  );
}

export function buildWorkedExampleStateFamily(
  sectorStates: SectorState[],
): WorkedExampleStateFamily | null {
  if (sectorStates.length === 0) {
    return null;
  }

  const familyRowsById = new Map<string, SectorState[]>();
  sectorStates.forEach((row) => {
    const rows = familyRowsById.get(row.state_id);
    if (rows) {
      rows.push(row);
    } else {
      familyRowsById.set(row.state_id, [row]);
    }
  });

  const preferredRows = familyRowsById.get(STATE_SCHEMA_PREFERRED_EXAMPLE_STATE_ID);
  const rows =
    preferredRows ??
    Array.from(familyRowsById.entries())
      .sort(([left], [right]) => left.localeCompare(right))[0]?.[1] ??
    null;

  if (!rows || rows.length === 0) {
    return null;
  }

  const milestoneYearOrder = new Map(
    getStateSchemaMilestoneYears().map((year, index) => [year, index]),
  );
  const sortedRows = [...rows].sort(
    (left, right) =>
      (milestoneYearOrder.get(left.year) ?? Number.MAX_SAFE_INTEGER) -
        (milestoneYearOrder.get(right.year) ?? Number.MAX_SAFE_INTEGER) ||
      left.year - right.year,
  );
  const representativeRow = sortedRows[0];

  return {
    stateId: representativeRow.state_id,
    sector: representativeRow.sector,
    subsector: representativeRow.subsector,
    serviceOrOutputName: representativeRow.service_or_output_name,
    region: representativeRow.region,
    stateLabel: representativeRow.state_label,
    stateDescription: representativeRow.state_description,
    outputUnit: representativeRow.output_unit,
    outputQuantityBasis: representativeRow.output_quantity_basis,
    currency: representativeRow.currency,
    costBasisYear: representativeRow.cost_basis_year,
    rows: sortedRows,
    representativeRow,
    representativeRowSnippet: buildRepresentativeRowSnippet(representativeRow),
  };
}

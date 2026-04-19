import type { EmissionEntry, SectorState } from './types.ts';

export interface SectorStateFamily {
  stateId: string;
  label: string;
  sector: string;
  subsector: string;
  serviceOrOutputName: string;
  years: number[];
  representative: SectorState;
  rows: SectorState[];
  confidenceRatings: string[];
  sourceIds: string[];
  assumptionIds: string[];
}

export interface SectorSubsectorIndex {
  sectors: string[];
  subsectorsBySector: Record<string, string[]>;
}

export interface TrajectoryPoint {
  year: number;
  rowKey: string;
  cost: number | null;
  energyTotal: number | null;
  processTotal: number | null;
  maxShare: number | null;
  maxActivity: number | null;
  row: SectorState;
}

export interface SectorStateTrajectory {
  stateId: string;
  label: string;
  sector: string;
  subsector: string;
  serviceOrOutputName: string;
  region: string;
  outputUnit: string;
  emissionsUnit: string;
  currency: string;
  representative: SectorState;
  rows: SectorState[];
  points: TrajectoryPoint[];
  confidenceRatings: string[];
  sourceIds: string[];
  assumptionIds: string[];
}

export interface InputCommoditySeries {
  commodity: string;
  unit: string;
  values: Array<{
    year: number;
    value: number | null;
  }>;
}

const referencePatterns = [
  { pattern: /incumbent/i, score: 40 },
  { pattern: /baseline/i, score: 35 },
  { pattern: /current/i, score: 30 },
  { pattern: /conventional/i, score: 25 },
  { pattern: /status quo/i, score: 20 },
  { pattern: /existing/i, score: 15 },
];

function compareStateSortKey(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  return left.localeCompare(right);
}

function compareStateOptionRank(left: number | null, right: number | null): number {
  if (left == null || right == null) {
    return 0;
  }

  return left - right;
}

function compareSectorStateDisplayOrder(left: SectorState, right: SectorState): number {
  return (
    compareStateSortKey(left.state_sort_key, right.state_sort_key) ||
    compareStateOptionRank(left.state_option_rank, right.state_option_rank) ||
    left.state_label.localeCompare(right.state_label) ||
    left.state_id.localeCompare(right.state_id)
  );
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

export function sumEmissionEntries(entries: EmissionEntry[]): number {
  return entries.reduce((total, entry) => total + entry.value, 0);
}

export function buildSectorStateSearchText(row: SectorState): string {
  return [
    row.sector,
    row.subsector,
    row.service_or_output_name,
    row.region,
    row.state_id,
    row.state_label,
    row.state_description,
    row.confidence_rating,
    row.evidence_summary,
    row.derivation_method,
    row.review_notes,
    row.candidate_expansion_pathway,
    row.rollout_limit_notes,
    row.availability_conditions,
    row.source_ids.join(' '),
    row.assumption_ids.join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

export function buildSectorStateFamilySearchText(family: SectorStateFamily): string {
  return family.rows.map((row) => buildSectorStateSearchText(row)).join(' ');
}

export function buildSectorSubsectorIndex(sectorStates: SectorState[]): SectorSubsectorIndex {
  const subsectorsBySector = sectorStates.reduce<Record<string, Set<string>>>((result, row) => {
    if (!result[row.sector]) {
      result[row.sector] = new Set<string>();
    }

    result[row.sector].add(row.subsector);
    return result;
  }, {});

  const sectors = Object.keys(subsectorsBySector).sort((left, right) => left.localeCompare(right));

  return {
    sectors,
    subsectorsBySector: sectors.reduce<Record<string, string[]>>((result, sector) => {
      result[sector] = Array.from(subsectorsBySector[sector]).sort((left, right) => left.localeCompare(right));
      return result;
    }, {}),
  };
}

export function buildSectorStateFamilies(sectorStates: SectorState[]): SectorStateFamily[] {
  const grouped = new Map<string, SectorState[]>();

  sectorStates.forEach((row) => {
    const existing = grouped.get(row.state_id);
    if (existing) {
      existing.push(row);
      return;
    }

    grouped.set(row.state_id, [row]);
  });

  return Array.from(grouped.entries())
    .map(([stateId, rows]) => {
      const sortedRows = [...rows].sort((left, right) => left.year - right.year);
      const representative = sortedRows[0];

      return {
        stateId,
        label: representative.state_label,
        sector: representative.sector,
        subsector: representative.subsector,
        serviceOrOutputName: representative.service_or_output_name,
        years: sortedRows.map((row) => row.year),
        representative,
        rows: sortedRows,
        confidenceRatings: uniqueStrings(sortedRows.map((row) => row.confidence_rating)),
        sourceIds: uniqueStrings(sortedRows.flatMap((row) => row.source_ids)),
        assumptionIds: uniqueStrings(sortedRows.flatMap((row) => row.assumption_ids)),
      };
    })
    .sort((left, right) => {
      return (
        left.sector.localeCompare(right.sector) ||
        left.subsector.localeCompare(right.subsector) ||
        left.serviceOrOutputName.localeCompare(right.serviceOrOutputName) ||
        compareSectorStateDisplayOrder(left.representative, right.representative)
      );
    });
}

export function buildSectorStateTrajectory(family: SectorStateFamily): SectorStateTrajectory {
  const representative = family.representative;

  return {
    stateId: family.stateId,
    label: family.label,
    sector: family.sector,
    subsector: family.subsector,
    serviceOrOutputName: family.serviceOrOutputName,
    region: representative.region,
    outputUnit: representative.output_unit,
    emissionsUnit: representative.emissions_units,
    currency: representative.currency,
    representative,
    rows: family.rows,
    points: family.rows.map((row) => ({
      year: row.year,
      rowKey: `${row.state_id}:${row.year}`,
      cost: row.output_cost_per_unit,
      energyTotal: sumEmissionEntries(row.energy_emissions_by_pollutant),
      processTotal: sumEmissionEntries(row.process_emissions_by_pollutant),
      maxShare: row.max_share,
      maxActivity: row.max_activity,
      row,
    })),
    confidenceRatings: family.confidenceRatings,
    sourceIds: family.sourceIds,
    assumptionIds: family.assumptionIds,
  };
}

export function buildInputCommoditySeries(family: SectorStateFamily): InputCommoditySeries[] {
  const commodityUnits = new Map<string, string>();

  family.rows.forEach((row) => {
    row.input_commodities.forEach((commodity, index) => {
      if (!commodityUnits.has(commodity)) {
        commodityUnits.set(commodity, row.input_units[index] ?? '—');
      }
    });
  });

  return Array.from(commodityUnits.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([commodity, unit]) => ({
      commodity,
      unit,
      values: family.rows.map((row) => {
        const index = row.input_commodities.indexOf(commodity);
        return {
          year: row.year,
          value: index >= 0 ? row.input_coefficients[index] ?? null : null,
        };
      }),
    }));
}

function scoreReferenceCandidate(row: SectorState): number {
  const haystack = `${row.state_id} ${row.state_label}`;

  return referencePatterns.reduce((score, { pattern, score: weight }) => {
    return pattern.test(haystack) ? score + weight : score;
  }, 0);
}

export function findReferenceSectorState(
  selected: SectorState,
  sectorStates: SectorState[],
): SectorState | null {
  const candidates = sectorStates.filter((row) => {
    return (
      row.service_or_output_name === selected.service_or_output_name &&
      row.year === selected.year &&
      row.region === selected.region
    );
  });

  if (candidates.length === 0) {
    return null;
  }

  const explicitIncumbents = candidates.filter((row) => row.is_default_incumbent_2025);

  if (explicitIncumbents.length > 0) {
    return [...explicitIncumbents].sort(compareSectorStateDisplayOrder)[0] ?? null;
  }

  return [...candidates].sort((left, right) => {
    return (
      scoreReferenceCandidate(right) - scoreReferenceCandidate(left) ||
      compareSectorStateDisplayOrder(left, right)
    );
  })[0] ?? null;
}

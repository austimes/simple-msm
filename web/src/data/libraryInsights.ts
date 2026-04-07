import type { EmissionEntry, SectorState } from './types';

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

const referencePatterns = [
  { pattern: /incumbent/i, score: 40 },
  { pattern: /baseline/i, score: 35 },
  { pattern: /current/i, score: 30 },
  { pattern: /conventional/i, score: 25 },
  { pattern: /status quo/i, score: 20 },
  { pattern: /existing/i, score: 15 },
];

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
        left.label.localeCompare(right.label)
      );
    });
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

  return [...candidates].sort((left, right) => {
    return (
      scoreReferenceCandidate(right) - scoreReferenceCandidate(left) ||
      left.state_label.localeCompare(right.state_label)
    );
  })[0] ?? null;
}

import type {
  AutonomousEfficiencyTrack,
  EfficiencyPackage,
  EmissionEntry,
  ResolvedMethodYearRow,
} from './types.ts';

export interface RoleMethodFamily {
  methodId: string;
  label: string;
  sector: string;
  subsector: string;
  serviceOrOutputName: string;
  years: number[];
  representative: ResolvedMethodYearRow;
  rows: ResolvedMethodYearRow[];
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
  row: ResolvedMethodYearRow;
}

export interface RoleMethodTrajectory {
  methodId: string;
  label: string;
  sector: string;
  subsector: string;
  serviceOrOutputName: string;
  region: string;
  outputUnit: string;
  emissionsUnit: string;
  currency: string;
  representative: ResolvedMethodYearRow;
  rows: ResolvedMethodYearRow[];
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

export interface FamilyAutonomousTrackSummary {
  trackId: string;
  label: string;
  description: string;
  years: number[];
  applicableMethodIds: string[];
  affectedInputCommodities: string[];
  confidenceRatings: string[];
  sourceIds: string[];
  assumptionIds: string[];
  rows: AutonomousEfficiencyTrack[];
}

export interface FamilyEfficiencyPackageSummary {
  packageId: string;
  label: string;
  description: string;
  classification: EfficiencyPackage['classification'];
  years: number[];
  applicableMethodIds: string[];
  affectedInputCommodities: string[];
  confidenceRatings: string[];
  sourceIds: string[];
  assumptionIds: string[];
  nonStackingGroup: string | null;
  rows: EfficiencyPackage[];
}

export interface FamilyEfficiencyOverview {
  roleId: string;
  orderedMethodIds: string[];
  methodLabelById: Record<string, string>;
  tracks: FamilyAutonomousTrackSummary[];
  packages: FamilyEfficiencyPackageSummary[];
  applicableTrackIdsByMethodId: Record<string, string[]>;
  applicablePackageIdsByMethodId: Record<string, string[]>;
}

const referencePatterns = [
  { pattern: /incumbent/i, score: 40 },
  { pattern: /baseline/i, score: 35 },
  { pattern: /current/i, score: 30 },
  { pattern: /conventional/i, score: 25 },
  { pattern: /status quo/i, score: 20 },
  { pattern: /existing/i, score: 15 },
];

const efficiencyPackageClassificationRank: Record<EfficiencyPackage['classification'], number> = {
  pure_efficiency_overlay: 0,
  operational_efficiency_overlay: 1,
};

function compareMethodSortKey(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }

  return left.localeCompare(right);
}

function compareMethodOptionRank(left: number | null, right: number | null): number {
  if (left == null || right == null) {
    return 0;
  }

  return left - right;
}

function compareResolvedMethodYearRowDisplayOrder(left: ResolvedMethodYearRow, right: ResolvedMethodYearRow): number {
  return (
    compareMethodSortKey(left.method_sort_key, right.method_sort_key) ||
    compareMethodOptionRank(left.method_option_rank, right.method_option_rank) ||
    left.method_label.localeCompare(right.method_label) ||
    left.method_id.localeCompare(right.method_id)
  );
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function orderedUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function orderMethodIds(methodIds: string[], orderedMethodIds: string[]): string[] {
  const ids = new Set(methodIds);

  return orderedMethodIds.filter((methodId) => ids.has(methodId));
}

function compareEfficiencyPackageSummaries(
  left: Pick<FamilyEfficiencyPackageSummary, 'classification' | 'label' | 'packageId'>,
  right: Pick<FamilyEfficiencyPackageSummary, 'classification' | 'label' | 'packageId'>,
): number {
  return (
    efficiencyPackageClassificationRank[left.classification]
    - efficiencyPackageClassificationRank[right.classification]
    || left.label.localeCompare(right.label)
    || left.packageId.localeCompare(right.packageId)
  );
}

export function sumEmissionEntries(entries: EmissionEntry[]): number {
  return entries.reduce((total, entry) => total + entry.value, 0);
}

export function buildResolvedMethodYearSearchText(row: ResolvedMethodYearRow): string {
  return [
    row.sector,
    row.subsector,
    row.output_id,
    row.region,
    row.method_id,
    row.method_label,
    row.method_description,
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

export function buildRoleMethodFamilySearchText(family: RoleMethodFamily): string {
  return family.rows.map((row) => buildResolvedMethodYearSearchText(row)).join(' ');
}

export function buildSectorSubsectorIndex(resolvedMethodYears: ResolvedMethodYearRow[]): SectorSubsectorIndex {
  const subsectorsBySector = resolvedMethodYears.reduce<Record<string, Set<string>>>((result, row) => {
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

export function buildRoleMethodFamilies(resolvedMethodYears: ResolvedMethodYearRow[]): RoleMethodFamily[] {
  const grouped = new Map<string, ResolvedMethodYearRow[]>();

  resolvedMethodYears.forEach((row) => {
    const existing = grouped.get(row.method_id);
    if (existing) {
      existing.push(row);
      return;
    }

    grouped.set(row.method_id, [row]);
  });

  return Array.from(grouped.entries())
    .map(([methodId, rows]) => {
      const sortedRows = [...rows].sort((left, right) => left.year - right.year);
      const representative = sortedRows[0];

      return {
        methodId,
        label: representative.method_label,
        sector: representative.sector,
        subsector: representative.subsector,
        serviceOrOutputName: representative.output_id,
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
        compareResolvedMethodYearRowDisplayOrder(left.representative, right.representative)
      );
    });
}

export function buildRoleMethodTrajectory(family: RoleMethodFamily): RoleMethodTrajectory {
  const representative = family.representative;

  return {
    methodId: family.methodId,
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
      rowKey: `${row.method_id}:${row.year}`,
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

export function buildInputCommoditySeries(family: RoleMethodFamily): InputCommoditySeries[] {
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

export function buildFamilyEfficiencyOverview(
  roleId: string,
  resolvedMethodYears: ResolvedMethodYearRow[],
  autonomousEfficiencyTracks: AutonomousEfficiencyTrack[],
  efficiencyPackages: EfficiencyPackage[],
): FamilyEfficiencyOverview | null {
  const stateFamilies = buildRoleMethodFamilies(
    resolvedMethodYears.filter((row) => row.role_id === roleId),
  );

  if (stateFamilies.length === 0) {
    return null;
  }

  const orderedMethodIds = stateFamilies.map((family) => family.methodId);
  const methodLabelById = Object.fromEntries(
    stateFamilies.map((family) => [family.methodId, family.label]),
  );
  const applicableTrackIdsByMethodId = Object.fromEntries(
    orderedMethodIds.map((methodId) => [methodId, [] as string[]]),
  );
  const applicablePackageIdsByMethodId = Object.fromEntries(
    orderedMethodIds.map((methodId) => [methodId, [] as string[]]),
  );

  const tracks = Array.from(
    autonomousEfficiencyTracks
      .filter((row) => row.role_id === roleId)
      .reduce<Map<string, AutonomousEfficiencyTrack[]>>((result, row) => {
        const rows = result.get(row.track_id) ?? [];

        rows.push(row);
        result.set(row.track_id, rows);
        return result;
      }, new Map())
      .entries(),
  )
    .map(([trackId, rows]) => {
      const sortedRows = [...rows].sort((left, right) => left.year - right.year);
      const representative = sortedRows[0];
      const applicableMethodIds = orderMethodIds(
        orderedUniqueStrings(sortedRows.flatMap((row) => row.applicable_method_ids)),
        orderedMethodIds,
      );

      applicableMethodIds.forEach((methodId) => {
        applicableTrackIdsByMethodId[methodId]?.push(trackId);
      });

      return {
        trackId,
        label: representative.track_label,
        description: representative.track_description,
        years: sortedRows.map((row) => row.year),
        applicableMethodIds,
        affectedInputCommodities: uniqueStrings(
          sortedRows.flatMap((row) => row.affected_input_commodities),
        ),
        confidenceRatings: uniqueStrings(sortedRows.map((row) => row.confidence_rating)),
        sourceIds: uniqueStrings(sortedRows.flatMap((row) => row.source_ids)),
        assumptionIds: uniqueStrings(sortedRows.flatMap((row) => row.assumption_ids)),
        rows: sortedRows,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label) || left.trackId.localeCompare(right.trackId));

  const packages = Array.from(
    efficiencyPackages
      .filter((row) => row.role_id === roleId)
      .reduce<Map<string, EfficiencyPackage[]>>((result, row) => {
        const rows = result.get(row.package_id) ?? [];

        rows.push(row);
        result.set(row.package_id, rows);
        return result;
      }, new Map())
      .entries(),
  )
    .map(([packageId, rows]) => {
      const sortedRows = [...rows].sort((left, right) => left.year - right.year);
      const representative = sortedRows[0];
      const applicableMethodIds = orderMethodIds(
        orderedUniqueStrings(sortedRows.flatMap((row) => row.applicable_method_ids)),
        orderedMethodIds,
      );

      applicableMethodIds.forEach((methodId) => {
        applicablePackageIdsByMethodId[methodId]?.push(packageId);
      });

      return {
        packageId,
        label: representative.package_label,
        description: representative.package_description,
        classification: representative.classification,
        years: sortedRows.map((row) => row.year),
        applicableMethodIds,
        affectedInputCommodities: uniqueStrings(
          sortedRows.flatMap((row) => row.affected_input_commodities),
        ),
        confidenceRatings: uniqueStrings(sortedRows.map((row) => row.confidence_rating)),
        sourceIds: uniqueStrings(sortedRows.flatMap((row) => row.source_ids)),
        assumptionIds: uniqueStrings(sortedRows.flatMap((row) => row.assumption_ids)),
        nonStackingGroup: representative.non_stacking_group,
        rows: sortedRows,
      };
    })
    .sort(compareEfficiencyPackageSummaries);

  return {
    roleId,
    orderedMethodIds,
    methodLabelById,
    tracks,
    packages,
    applicableTrackIdsByMethodId,
    applicablePackageIdsByMethodId,
  };
}

function scoreReferenceCandidate(row: ResolvedMethodYearRow): number {
  const haystack = `${row.method_id} ${row.method_label}`;

  return referencePatterns.reduce((score, { pattern, score: weight }) => {
    return pattern.test(haystack) ? score + weight : score;
  }, 0);
}

export function findReferenceMethodRow(
  selected: ResolvedMethodYearRow,
  resolvedMethodYears: ResolvedMethodYearRow[],
): ResolvedMethodYearRow | null {
  const candidates = resolvedMethodYears.filter((row) => {
    return (
      row.output_id === selected.output_id &&
      row.year === selected.year &&
      row.region === selected.region
    );
  });

  if (candidates.length === 0) {
    return null;
  }

  const explicitIncumbents = candidates.filter((row) => row.is_default_incumbent_2025);

  if (explicitIncumbents.length > 0) {
    return [...explicitIncumbents].sort(compareResolvedMethodYearRowDisplayOrder)[0] ?? null;
  }

  return [...candidates].sort((left, right) => {
    return (
      scoreReferenceCandidate(right) - scoreReferenceCandidate(left) ||
      compareResolvedMethodYearRowDisplayOrder(left, right)
    );
  })[0] ?? null;
}

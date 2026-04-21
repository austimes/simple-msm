import { embodiedEfficiencyPathwayEntries } from './efficiencyAttributionRegistry.ts';
import type {
  AutonomousEfficiencyTrack,
  ConfigurationAutonomousEfficiencyMode,
  ConfigurationEfficiencyControls,
  EfficiencyPackage,
  EfficiencyPackageClassification,
  SectorState,
} from './types.ts';

export interface OutputEfficiencyControlNode {
  outputId: string;
  hasControls: boolean;
  autonomousTracks: Array<{
    trackId: string;
    label: string;
    enabled: boolean;
    applicableStateIds: string[];
  }>;
  packages: Array<{
    packageId: string;
    label: string;
    classification: EfficiencyPackageClassification;
    enabled: boolean;
    applicableStateIds: string[];
    nonStackingGroup: string | null;
    maxShareByYear: Record<string, number | null>;
  }>;
  embodiedStateIds: string[];
}

type PackageToggleChange =
  | { packageId: string; enabled: boolean }
  | { outputId: string; enabled: boolean };

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function normalizeIds(ids: string[] | null | undefined): string[] {
  return Array.from(
    new Set(
      (ids ?? [])
        .filter((id): id is string => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  ).sort(compareStrings);
}

function collectPackageIds(
  efficiencyPackages: Pick<EfficiencyPackage, 'package_id'>[],
): string[] {
  return Array.from(
    new Set(efficiencyPackages.map((pkg) => pkg.package_id)),
  ).sort(compareStrings);
}

function collectPackageIdsForOutput(
  efficiencyPackages: Pick<EfficiencyPackage, 'family_id' | 'package_id'>[],
  outputId: string,
): string[] {
  return Array.from(
    new Set(
      efficiencyPackages
        .filter((pkg) => pkg.family_id === outputId)
        .map((pkg) => pkg.package_id),
    ),
  ).sort(compareStrings);
}

export function resolveActiveEfficiencyPackageIds(
  controls: ConfigurationEfficiencyControls | null | undefined,
  efficiencyPackages: Pick<EfficiencyPackage, 'package_id'>[],
): string[] {
  const allPackageIds = collectPackageIds(efficiencyPackages);
  const knownPackageIds = new Set(allPackageIds);
  const configuredPackageIds = normalizeIds(controls?.package_ids)
    .filter((packageId) => knownPackageIds.has(packageId));
  const deniedPackageIds = new Set(configuredPackageIds);

  switch (controls?.package_mode ?? 'off') {
    case 'all':
      return allPackageIds;
    case 'allow_list':
      return configuredPackageIds;
    case 'deny_list':
      return allPackageIds.filter((packageId) => !deniedPackageIds.has(packageId));
    case 'off':
    default:
      return [];
  }
}

export function resolveAutonomousModeForOutput(
  controls: ConfigurationEfficiencyControls | null | undefined,
  outputId: string,
): ConfigurationAutonomousEfficiencyMode {
  return controls?.autonomous_modes_by_output?.[outputId]
    ?? controls?.autonomous_mode
    ?? 'baseline';
}

export function buildNextPackageAllowList(
  controls: ConfigurationEfficiencyControls | null | undefined,
  efficiencyPackages: Pick<EfficiencyPackage, 'family_id' | 'package_id'>[],
  change: PackageToggleChange,
): string[] {
  const activePackageIds = new Set(resolveActiveEfficiencyPackageIds(controls, efficiencyPackages));

  if ('packageId' in change) {
    const knownPackageIds = new Set(collectPackageIds(efficiencyPackages));
    if (!knownPackageIds.has(change.packageId)) {
      return Array.from(activePackageIds).sort(compareStrings);
    }

    if (change.enabled) {
      activePackageIds.add(change.packageId);
    } else {
      activePackageIds.delete(change.packageId);
    }
  } else {
    for (const packageId of collectPackageIdsForOutput(efficiencyPackages, change.outputId)) {
      if (change.enabled) {
        activePackageIds.add(packageId);
      } else {
        activePackageIds.delete(packageId);
      }
    }
  }

  return Array.from(activePackageIds).sort(compareStrings);
}

export function buildEfficiencyControlCatalog(
  configuration: { efficiency_controls?: ConfigurationEfficiencyControls },
  sectorStates: Pick<SectorState, 'service_or_output_name' | 'state_id'>[],
  autonomousEfficiencyTracks: Pick<
    AutonomousEfficiencyTrack,
    'family_id' | 'track_id' | 'track_label' | 'applicable_state_ids'
  >[],
  efficiencyPackages: Pick<
    EfficiencyPackage,
    | 'family_id'
    | 'package_id'
    | 'package_label'
    | 'classification'
    | 'applicable_state_ids'
    | 'non_stacking_group'
    | 'max_share'
    | 'year'
  >[],
): OutputEfficiencyControlNode[] {
  const outputIds = Array.from(
    new Set(sectorStates.map((row) => row.service_or_output_name)),
  ).sort(compareStrings);
  const stateIdsByOutput = new Map<string, Set<string>>();

  for (const row of sectorStates) {
    const stateIds = stateIdsByOutput.get(row.service_or_output_name) ?? new Set<string>();
    stateIds.add(row.state_id);
    stateIdsByOutput.set(row.service_or_output_name, stateIds);
  }

  const controls = configuration.efficiency_controls;
  const activePackageIds = new Set(resolveActiveEfficiencyPackageIds(controls, efficiencyPackages));

  return outputIds.map((outputId) => {
    const trackMap = new Map<string, {
      trackId: string;
      label: string;
      enabled: boolean;
      applicableStateIds: Set<string>;
    }>();
    const autonomousMode = resolveAutonomousModeForOutput(controls, outputId);

    for (const track of autonomousEfficiencyTracks) {
      if (track.family_id !== outputId) {
        continue;
      }

      const entry = trackMap.get(track.track_id) ?? {
        trackId: track.track_id,
        label: track.track_label || track.track_id,
        enabled: autonomousMode === 'baseline',
        applicableStateIds: new Set<string>(),
      };
      for (const stateId of track.applicable_state_ids ?? []) {
        entry.applicableStateIds.add(stateId);
      }
      trackMap.set(track.track_id, entry);
    }

    const packageMap = new Map<string, {
      packageId: string;
      label: string;
      classification: EfficiencyPackageClassification;
      enabled: boolean;
      applicableStateIds: Set<string>;
      nonStackingGroup: string | null;
      maxShareByYear: Record<string, number | null>;
    }>();

    for (const pkg of efficiencyPackages) {
      if (pkg.family_id !== outputId) {
        continue;
      }

      const entry = packageMap.get(pkg.package_id) ?? {
        packageId: pkg.package_id,
        label: pkg.package_label || pkg.package_id,
        classification: pkg.classification,
        enabled: activePackageIds.has(pkg.package_id),
        applicableStateIds: new Set<string>(),
        nonStackingGroup: pkg.non_stacking_group ?? null,
        maxShareByYear: {},
      };
      for (const stateId of pkg.applicable_state_ids ?? []) {
        entry.applicableStateIds.add(stateId);
      }
      entry.maxShareByYear[String(pkg.year)] = pkg.max_share ?? null;
      packageMap.set(pkg.package_id, entry);
    }

    const outputStateIds = stateIdsByOutput.get(outputId) ?? new Set<string>();
    const embodiedStateIds = Array.from(
      new Set(
        embodiedEfficiencyPathwayEntries
          .filter((entry) => entry.familyIds.includes(outputId))
          .flatMap((entry) => entry.stateIds)
          .filter((stateId) => outputStateIds.has(stateId)),
      ),
    ).sort(compareStrings);

    const autonomousTracks = Array.from(trackMap.values())
      .sort((left, right) => compareStrings(left.label, right.label) || compareStrings(left.trackId, right.trackId))
      .map((entry) => ({
        trackId: entry.trackId,
        label: entry.label,
        enabled: entry.enabled,
        applicableStateIds: Array.from(entry.applicableStateIds).sort(compareStrings),
      }));
    const packages = Array.from(packageMap.values())
      .sort((left, right) => compareStrings(left.label, right.label) || compareStrings(left.packageId, right.packageId))
      .map((entry) => ({
        packageId: entry.packageId,
        label: entry.label,
        classification: entry.classification,
        enabled: entry.enabled,
        applicableStateIds: Array.from(entry.applicableStateIds).sort(compareStrings),
        nonStackingGroup: entry.nonStackingGroup,
        maxShareByYear: Object.fromEntries(
          Object.entries(entry.maxShareByYear).sort(([left], [right]) => compareStrings(left, right)),
        ),
      }));

    return {
      outputId,
      hasControls: autonomousTracks.length > 0 || packages.length > 0 || embodiedStateIds.length > 0,
      autonomousTracks,
      packages,
      embodiedStateIds,
    };
  });
}

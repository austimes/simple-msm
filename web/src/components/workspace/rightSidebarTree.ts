import type {
  SectorCatalogEntry,
  SubsectorCatalogEntry,
} from '../../data/configurationWorkspaceModel.ts';
import type { DerivedOutputRunStatus } from '../../solver/solveScope.ts';
import {
  getRightSidebarStatusPresentation,
  type RightSidebarBadge,
  type RightSidebarStatusPresentation,
} from './rightSidebarStatus.ts';

export interface RightSidebarSubsectorNode extends SubsectorCatalogEntry {
  status: DerivedOutputRunStatus | undefined;
  presentation: RightSidebarStatusPresentation;
  badges: RightSidebarBadge[];
  enabledStateIds: string[];
  solveActiveStateIds: string[];
  capDenominatorStateIds: string[];
  showsSolveActivitySplit: boolean;
  allDisabled: boolean;
  pathwaysInactive: boolean;
  outOfScope: boolean;
  canCollapse: boolean;
  isCollapsed: boolean;
}

export interface RightSidebarSectorNode extends SectorCatalogEntry {
  subsectors: RightSidebarSubsectorNode[];
  isExcluded: boolean;
  isCollapsed: boolean;
}

export function deriveRightSidebarTree(
  catalog: SectorCatalogEntry[],
  outputStatuses: Record<string, DerivedOutputRunStatus>,
  expandedSubsectors: ReadonlySet<string>,
  expandedSectors: ReadonlySet<string>,
): RightSidebarSectorNode[] {
  return catalog.map((sectorEntry) => {
    const subsectors = sectorEntry.subsectors.map((subsectorEntry) => {
      const status = outputStatuses[subsectorEntry.outputId];
      const presentation = getRightSidebarStatusPresentation(status);
      const allDisabled = status?.isDisabled ?? false;
      const outOfScope = presentation.isDimmed;
      const canCollapse = allDisabled || outOfScope;

      return {
        ...subsectorEntry,
        status,
        presentation,
        badges: presentation.badges,
        enabledStateIds: status?.availableStateIds ?? [],
        solveActiveStateIds: status?.activeStateIds ?? [],
        capDenominatorStateIds: status?.capEligibleStateIds ?? [],
        showsSolveActivitySplit: (status?.availableStateCount ?? 0) !== (status?.activeStateCount ?? 0),
        allDisabled,
        pathwaysInactive: presentation.arePathwaysInactive,
        outOfScope,
        canCollapse,
        isCollapsed: canCollapse && !expandedSubsectors.has(subsectorEntry.outputId),
      };
    });

    const isExcluded = subsectors.length > 0 && subsectors.every((subsector) => subsector.outOfScope);

    return {
      ...sectorEntry,
      subsectors,
      isExcluded,
      isCollapsed: isExcluded && !expandedSectors.has(sectorEntry.sector),
    };
  });
}

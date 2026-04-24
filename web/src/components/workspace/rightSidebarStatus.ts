import type { DerivedOutputRunStatus } from '../../solver/solveScope.ts';

export type RightSidebarBadgeTone =
  | 'active'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted';

export interface RightSidebarBadge {
  key: string;
  label: string;
  tone: RightSidebarBadgeTone;
}

export interface RightSidebarLegendItem {
  key: string;
  label: string;
  tone: RightSidebarBadgeTone;
  description: string;
}

export interface RightSidebarStatusPresentation {
  badges: RightSidebarBadge[];
  detail: string;
  isDimmed: boolean;
  isDisabled: boolean;
  arePathwaysInactive: boolean;
}

export const RIGHT_SIDEBAR_STATUS_LEGEND: RightSidebarLegendItem[] = [
  {
    key: 'demand-active',
    label: 'Demand active in this run',
    tone: 'active',
    description: 'Required-service demand participates in the current solve.',
  },
  {
    key: 'active-output',
    label: 'Active in this run',
    tone: 'success',
    description: 'This output has active routes and participates in the current solve.',
  },
  {
    key: 'auto-dependency',
    label: 'Auto-included dependency',
    tone: 'info',
    description: 'Added to the effective run because an active output depends on it.',
  },
  {
    key: 'excluded',
    label: 'Excluded from this run',
    tone: 'muted',
    description: 'All routes are deactivated, so this output is excluded from the solve.',
  },
  {
    key: 'externalized',
    label: 'Externalized supply in this run',
    tone: 'muted',
    description: 'Commodity demand is met externally rather than by available in-model routes.',
  },
  {
    key: 'active-pathways',
    label: 'Active routes',
    tone: 'info',
    description: 'Number of routes active in the current solve.',
  },
];

function buildPathwayBadge(status: DerivedOutputRunStatus): RightSidebarBadge | null {
  if (status.supplyParticipation === 'externalized_in_run') {
    return null;
  }

  if (status.activeStateCount === 0) {
    return null;
  }

  return {
    key: 'active-pathways',
    label: `${status.activeStateCount} active ${status.activeStateCount === 1 ? 'route' : 'routes'}`,
    tone: 'success',
  };
}

function buildRunParticipationBadge(
  status: DerivedOutputRunStatus,
): RightSidebarBadge | null {
  switch (status.runParticipation) {
    case 'active_pathways':
      return {
        key: 'active-output',
        label: 'Active in this run',
        tone: 'success',
      };
    case 'auto_included_dependency':
      return {
        key: 'auto-dependency',
        label: 'Auto-included dependency',
        tone: 'info',
      };
    default:
      return null;
  }
}

function buildDemandBadge(status: DerivedOutputRunStatus): RightSidebarBadge | null {
  switch (status.demandParticipation) {
    case 'active_in_run':
      return {
        key: 'demand-active',
        label: 'Demand active in this run',
        tone: 'active',
      };
    case 'excluded_from_run':
      return {
        key: 'demand-excluded',
        label: 'Demand excluded from this run',
        tone: 'muted',
      };
    default:
      return null;
  }
}

function buildSupplyBadge(status: DerivedOutputRunStatus): RightSidebarBadge | null {
  switch (status.supplyParticipation) {
    case 'endogenous_in_run':
      return {
        key: 'supply-endogenous',
        label: 'Endogenous supply in this run',
        tone: 'active',
      };
    case 'externalized_in_run':
      return {
        key: 'supply-externalized',
        label: 'Externalized supply in this run',
        tone: 'muted',
      };
    case 'excluded_from_run':
      return {
        key: 'supply-excluded',
        label: 'Supply excluded from this run',
        tone: 'muted',
      };
    default:
      return null;
  }
}

function buildDetail(status: DerivedOutputRunStatus): string {
  let detail = 'Has active routes and participates in this solve.';

  switch (status.runParticipation) {
    case 'active_pathways':
      detail = 'Has active routes and participates in this solve.';
      break;
    case 'auto_included_dependency':
      detail = 'Included in the effective run because an active output depends on it.';
      break;
    case 'excluded_from_run':
      detail = 'All routes are deactivated, so this output is excluded.';
      break;
    default:
      break;
  }

  if (status.supplyParticipation === 'externalized_in_run') {
    return `${detail} Supply is externalized, so the route list is inactive and the commodity price selection is used instead.`;
  }

  if (status.isDisabled) {
    return `${detail} No routes are currently active.`;
  }

  return detail;
}

export function getRightSidebarStatusPresentation(
  status: DerivedOutputRunStatus | undefined,
): RightSidebarStatusPresentation {
  if (!status) {
    return {
      badges: [],
      detail: 'Run status unavailable.',
      isDimmed: false,
      isDisabled: false,
      arePathwaysInactive: false,
    };
  }

  const badges = [
    buildDemandBadge(status),
    buildSupplyBadge(status),
    buildRunParticipationBadge(status),
    buildPathwayBadge(status),
  ].filter((badge): badge is RightSidebarBadge => badge !== null);

  return {
    badges,
    detail: buildDetail(status),
    isDimmed: status.isExcludedFromRun,
    isDisabled: status.isDisabled,
    arePathwaysInactive: status.supplyParticipation === 'externalized_in_run',
  };
}

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
    key: 'seed-scope',
    label: 'Seed scope',
    tone: 'success',
    description: 'Explicitly selected as the scoped-solve seed. The effective run may also include dependencies.',
  },
  {
    key: 'auto-dependency',
    label: 'Auto-included dependency',
    tone: 'info',
    description: 'Added to the effective run because a seed-scoped output depends on it.',
  },
  {
    key: 'excluded',
    label: 'Excluded from this run',
    tone: 'muted',
    description: 'Shown when demand or supply is outside the current effective run.',
  },
  {
    key: 'externalized',
    label: 'Externalized supply in this run',
    tone: 'muted',
    description: 'Commodity demand is met externally rather than by enabled pathways.',
  },
  {
    key: 'no-pathways',
    label: 'No enabled pathways',
    tone: 'warning',
    description: 'State enablement is separate from seed scope or effective run inclusion.',
  },
  {
    key: 'blocked-demand',
    label: 'Demand active but no enabled pathways',
    tone: 'danger',
    description: 'The solve is blocked until at least one pathway is re-enabled.',
  },
];

function buildPathwayBadge(status: DerivedOutputRunStatus): RightSidebarBadge | null {
  if (status.supplyParticipation === 'externalized_in_run') {
    return null;
  }

  if (status.availableStateCount === 0) {
    return {
      key: 'no-pathways',
      label: 'No enabled pathways',
      tone: status.hasDemandValidationError ? 'danger' : 'warning',
    };
  }

  return {
    key: 'enabled-pathways',
    label: `${status.availableStateCount} enabled ${status.availableStateCount === 1 ? 'pathway' : 'pathways'}`,
    tone: 'success',
  };
}

function buildRunParticipationBadge(
  status: DerivedOutputRunStatus,
): RightSidebarBadge | null {
  switch (status.runParticipation) {
    case 'seed_scope':
      return {
        key: 'seed-scope',
        label: 'Seed scope',
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
    case 'no_enabled_pathways':
      return {
        key: 'blocked-demand',
        label: 'Demand active but no enabled pathways',
        tone: 'danger',
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
  let detail = 'Included in the full-model run.';

  switch (status.runParticipation) {
    case 'seed_scope':
      detail = 'Explicitly selected as seed scope for this scoped solve.';
      break;
    case 'auto_included_dependency':
      detail = 'Included in the effective run because a seed-scoped output depends on it.';
      break;
    case 'excluded_from_run':
      detail = 'Outside the effective run for this scoped solve.';
      break;
    default:
      break;
  }

  if (status.hasDemandValidationError) {
    return `${detail} Demand is still active, but no pathways are enabled.`;
  }

  if (status.supplyParticipation === 'externalized_in_run') {
    return `${detail} Supply is externalized, so the pathway list is inactive and the commodity price selection is used instead.`;
  }

  if (status.isDisabled) {
    return `${detail} No pathways are currently enabled.`;
  }

  if (status.controlMode === 'pinned_single') {
    return `${detail} Exact control pins activity to ${status.activeStateCount} active pathway, while ${status.capEligibleStateCount} non-disabled pathways remain available for cap context and future edits.`;
  }

  if (status.controlMode === 'fixed_shares' && status.activeStateCount < status.availableStateCount) {
    return `${detail} Only pathways with positive fixed shares are active in the solve, while ${status.capEligibleStateCount} non-disabled pathways still define cap context in this phase.`;
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

import type {
  DerivedOutputRunStatus,
  OutputRunParticipation,
} from '../../solver/solveScope.ts';

export type RightSidebarBadgeTone =
  | 'active'
  | 'dependency'
  | 'excluded'
  | 'disabled';

export interface RightSidebarBadge {
  key: string;
  label: string;
  tone: RightSidebarBadgeTone;
}

export interface RightSidebarStatusPresentation {
  badges: RightSidebarBadge[];
  detail: string;
  groupClassNames: string[];
  isDisabled: boolean;
}

export interface RightSidebarLegendItem {
  key: string;
  label: string;
  tone: RightSidebarBadgeTone;
  description: string;
}

const PARTICIPATION_DETAILS: Record<
  OutputRunParticipation,
  {
    badge: RightSidebarBadge;
    detail: string;
    groupClassName?: string;
  }
> = {
  full_model: {
    badge: { key: 'full-model', label: 'full model', tone: 'active' },
    detail: 'Included in the full-model run.',
  },
  seed_scope: {
    badge: { key: 'in-scope', label: 'in scope', tone: 'active' },
    detail: 'Explicitly selected for this scoped run.',
  },
  auto_included_dependency: {
    badge: { key: 'dependency', label: 'dependency', tone: 'dependency' },
    detail: 'Included automatically because another in-run output depends on it.',
    groupClassName: 'workspace-subsector-group--dependency',
  },
  excluded_from_run: {
    badge: { key: 'excluded', label: 'excluded', tone: 'excluded' },
    detail: 'Outside the current scoped run.',
    groupClassName: 'workspace-subsector-group--excluded',
  },
};

export const RIGHT_SIDEBAR_STATUS_LEGEND: RightSidebarLegendItem[] = [
  {
    key: 'in-scope',
    label: 'in scope',
    tone: 'active',
    description: 'Explicitly selected for this run.',
  },
  {
    key: 'dependency',
    label: 'dependency',
    tone: 'dependency',
    description: 'Added automatically because an in-run output needs it.',
  },
  {
    key: 'excluded',
    label: 'excluded',
    tone: 'excluded',
    description: 'Outside the current scoped run.',
  },
  {
    key: 'disabled',
    label: 'disabled',
    tone: 'disabled',
    description: 'No states are currently enabled for this output.',
  },
];

export function getRightSidebarStatusPresentation(
  status: DerivedOutputRunStatus | undefined,
): RightSidebarStatusPresentation {
  if (!status) {
    return {
      badges: [],
      detail: 'Run status unavailable.',
      groupClassNames: [],
      isDisabled: false,
    };
  }

  const participation = PARTICIPATION_DETAILS[status.runParticipation];
  const badges = [participation.badge];
  const groupClassNames = participation.groupClassName ? [participation.groupClassName] : [];
  let detail = participation.detail;

  if (status.isDisabled) {
    badges.push({ key: 'disabled', label: 'disabled', tone: 'disabled' });
    groupClassNames.push('workspace-subsector-group--disabled');
    detail = `${detail} No states are enabled, so this output cannot run until a state is re-enabled.`;
  }

  return {
    badges,
    detail,
    groupClassNames,
    isDisabled: status.isDisabled,
  };
}

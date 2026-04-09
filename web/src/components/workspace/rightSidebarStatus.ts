export type RightSidebarBadgeTone =
  | 'active'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted';

export interface RightSidebarLegendItem {
  key: string;
  label: string;
  tone: RightSidebarBadgeTone;
  description: string;
}

export const RIGHT_SIDEBAR_STATUS_LEGEND: RightSidebarLegendItem[] = [
  {
    key: 'demand-active',
    label: 'Demand active in this run',
    tone: 'active',
    description: 'Required-service demand participates in the current solve.',
  },
  {
    key: 'selected-scope',
    label: 'Selected scope',
    tone: 'success',
    description: 'Explicitly selected for the current scoped run.',
  },
  {
    key: 'auto-dependency',
    label: 'Auto-included dependency',
    tone: 'info',
    description: 'Added because another in-run output depends on it.',
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
    description: 'State enablement is separate from demand or supply participation.',
  },
  {
    key: 'blocked-demand',
    label: 'Demand active but no enabled pathways',
    tone: 'danger',
    description: 'The solve is blocked until at least one pathway is re-enabled.',
  },
];

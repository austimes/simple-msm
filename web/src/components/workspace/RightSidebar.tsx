import { useMemo, useState, useCallback } from 'react';
import { usePackageStore } from '../../data/packageStore';
import {
  buildStateCatalog,
} from '../../data/scenarioWorkspaceModel';
import type { DerivedOutputRunStatus } from '../../solver/solveScope.ts';
import { deriveOutputRunStatusesForConfiguration } from '../../solver/solveScope.ts';
import { RIGHT_SIDEBAR_STATUS_LEGEND } from './rightSidebarStatus';

function formatSectorName(sector: string): string {
  return sector.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function describePathwayStatus(status: DerivedOutputRunStatus): string {
  return status.enabledStateCount === 0
    ? 'No enabled pathways'
    : `${status.enabledStateCount} enabled ${status.enabledStateCount === 1 ? 'pathway' : 'pathways'}`;
}

function describeDemandStatus(status: DerivedOutputRunStatus): string | null {
  switch (status.demandParticipation) {
    case 'active_in_run':
      return 'Demand active in this run';
    case 'excluded_from_run':
      return 'Demand excluded from this run';
    case 'no_enabled_pathways':
      return 'Demand active but no enabled pathways';
    default:
      return null;
  }
}

function describeSupplyStatus(status: DerivedOutputRunStatus): string | null {
  switch (status.supplyParticipation) {
    case 'endogenous_in_run':
      return 'Endogenous supply in this run';
    case 'externalized_in_run':
      return 'Externalized supply in this run';
    case 'excluded_from_run':
      return 'Supply excluded from this run';
    default:
      return null;
  }
}

function describeRunParticipation(status: DerivedOutputRunStatus): string | null {
  switch (status.runParticipation) {
    case 'seed_scope':
      return 'Selected scope';
    case 'auto_included_dependency':
      return 'Auto-included dependency';
    default:
      return null;
  }
}

function getBadgeTone(status: DerivedOutputRunStatus, label: string): string {
  if (label === 'Demand active but no enabled pathways') {
    return ' workspace-mode-badge--danger';
  }
  if (label === 'Demand active in this run' || label === 'Endogenous supply in this run') {
    return ' workspace-mode-badge--active';
  }
  if (
    label === 'Demand excluded from this run'
    || label === 'Externalized supply in this run'
    || label === 'Supply excluded from this run'
  ) {
    return ' workspace-mode-badge--muted';
  }
  if (label === 'Auto-included dependency') {
    return ' workspace-mode-badge--info';
  }
  if (label === 'Selected scope') {
    return ' workspace-mode-badge--success';
  }
  if (label === 'No enabled pathways') {
    return status.hasDemandValidationError
      ? ' workspace-mode-badge--danger'
      : ' workspace-mode-badge--warning';
  }
  return status.enabledStateCount > 0
    ? ' workspace-mode-badge--success'
    : ' workspace-mode-badge--warning';
}

export default function RightSidebar() {
  const sectorStates = usePackageStore((s) => s.sectorStates);
  const appConfig = usePackageStore((s) => s.appConfig);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);
  const toggleStateEnabled = usePackageStore((s) => s.toggleStateEnabled);

  const [expandedDisabled, setExpandedDisabled] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((outputId: string) => {
    setExpandedDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(outputId)) {
        next.delete(outputId);
      } else {
        next.add(outputId);
      }
      return next;
    });
  }, []);

  const catalog = useMemo(
    () => buildStateCatalog(sectorStates, appConfig),
    [sectorStates, appConfig],
  );

  const outputStatuses = useMemo(
    () => deriveOutputRunStatusesForConfiguration(
      { sectorStates, appConfig },
      currentConfiguration,
    ),
    [sectorStates, appConfig, currentConfiguration],
  );

  return (
    <>
      <h2>State Selector</h2>
      <div className="workspace-state-legend" role="note" aria-label="State selector status legend">
        <p className="workspace-state-legend-copy">
          Demand or supply participation is shown separately from pathway enablement.
          Outputs are only blocked when no pathways remain enabled.
        </p>
        <div className="workspace-state-legend-items">
          {RIGHT_SIDEBAR_STATUS_LEGEND.map((item) => (
            <div key={item.key} className="workspace-state-legend-item">
              <span className={`workspace-mode-badge workspace-mode-badge--${item.tone}`}>
                {item.label}
              </span>
              <span className="workspace-state-legend-text">{item.description}</span>
            </div>
          ))}
        </div>
      </div>
      {catalog.map((sectorEntry) => (
        <div key={sectorEntry.sector} className="workspace-sector-group">
          <div className="workspace-sector-title">
            {formatSectorName(sectorEntry.sector)}
          </div>
          {sectorEntry.subsectors.map((sub) => {
            const status = outputStatuses[sub.outputId];
            const enabledIds = new Set(status?.enabledStateIds ?? []);
            const allDisabled = status?.isDisabled ?? enabledIds.size === 0;
            const outOfScope = status?.isExcludedFromRun ?? false;
            const isCollapsed = allDisabled && !expandedDisabled.has(sub.outputId);
            const badges = status
              ? [
                  describeDemandStatus(status),
                  describeSupplyStatus(status),
                  describeRunParticipation(status),
                  describePathwayStatus(status),
                ].filter((label): label is string => label !== null)
              : [];

            return (
              <div
                key={sub.outputId}
                className={`workspace-subsector-group${outOfScope ? ' workspace-subsector-group--dimmed' : ''}`}
              >
                <div
                  className={`workspace-subsector-title${allDisabled ? ' workspace-subsector-title--clickable' : ''}`}
                  onClick={allDisabled ? () => toggleExpanded(sub.outputId) : undefined}
                >
                  {sub.outputLabel}
                </div>
                {badges.length > 0 && (
                  <div className="workspace-subsector-meta">
                    {badges.map((label) => (
                      <span
                        key={label}
                        className={`workspace-mode-badge${getBadgeTone(status, label)}`}
                      >
                        {label}
                      </span>
                    ))}
                    {allDisabled && (
                      <button
                        type="button"
                        className="workspace-mode-toggle"
                        onClick={() => toggleExpanded(sub.outputId)}
                      >
                        {isCollapsed ? 'Show states' : 'Hide states'}
                      </button>
                    )}
                  </div>
                )}
                {!isCollapsed && (
                  <div className="workspace-state-chips">
                    {sub.states.map((state) => {
                      const isOn = enabledIds.has(state.stateId);
                      return (
                        <button
                          key={state.stateId}
                          type="button"
                          className={`workspace-state-chip ${isOn ? 'workspace-state-chip--on' : 'workspace-state-chip--off'}${outOfScope ? ' workspace-state-chip--dimmed' : ''}`}
                          onClick={() =>
                            toggleStateEnabled(sub.outputId, state.stateId)
                          }
                        >
                          {state.stateLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

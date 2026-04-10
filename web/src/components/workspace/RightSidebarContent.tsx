import React from 'react';
import {
  RIGHT_SIDEBAR_STATUS_LEGEND,
} from './rightSidebarStatus';
import type { RightSidebarSectorNode } from './rightSidebarTree';

function formatSectorName(sector: string): string {
  return sector.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface RightSidebarContentProps {
  tree: RightSidebarSectorNode[];
  onToggleExpandedSector: (sector: string) => void;
  onToggleExpandedSubsector: (outputId: string) => void;
  onToggleStateEnabled: (outputId: string, stateId: string) => void;
}

export default function RightSidebarContent({
  tree,
  onToggleExpandedSector,
  onToggleExpandedSubsector,
  onToggleStateEnabled,
}: RightSidebarContentProps) {
  return (
    <React.Fragment>
      <h2>State Selector</h2>
      {tree.map((sectorEntry) => (
        <div
          key={sectorEntry.sector}
          className={`workspace-sector-group${sectorEntry.isExcluded ? ' workspace-sector-group--dimmed' : ''}`}
        >
          <div className="workspace-sector-header">
            <div
              className={`workspace-sector-title${sectorEntry.isExcluded ? ' workspace-sector-title--clickable' : ''}`}
              onClick={sectorEntry.isExcluded ? () => onToggleExpandedSector(sectorEntry.sector) : undefined}
            >
              {formatSectorName(sectorEntry.sector)}
            </div>
            {sectorEntry.isExcluded && (
              <div className="workspace-sector-meta">
                <span className="workspace-mode-badge workspace-mode-badge--muted">
                  Excluded from this run
                </span>
                <button
                  type="button"
                  className="workspace-mode-toggle"
                  onClick={() => onToggleExpandedSector(sectorEntry.sector)}
                >
                  {sectorEntry.isCollapsed ? 'Show sub-sectors' : 'Hide sub-sectors'}
                </button>
              </div>
            )}
          </div>
          {!sectorEntry.isCollapsed && sectorEntry.subsectors.map((sub) => {
            const enabledStateIds = new Set(sub.enabledStateIds);
            const solveActiveStateIds = new Set(sub.solveActiveStateIds);
            const pathwaysInactive = sub.pathwaysInactive;
            const outOfScope = sub.outOfScope;
            const isCollapsed = sub.isCollapsed;
            const badges = sub.badges;
            const showsSolveActivitySplit = !pathwaysInactive && sub.showsSolveActivitySplit;

            return (
              <div
                key={sub.outputId}
                className={`workspace-subsector-group${outOfScope ? ' workspace-subsector-group--dimmed' : ''}`}
              >
                <div
                  className={`workspace-subsector-title${sub.canCollapse ? ' workspace-subsector-title--clickable' : ''}`}
                  onClick={sub.canCollapse ? () => onToggleExpandedSubsector(sub.outputId) : undefined}
                >
                  {sub.outputLabel}
                </div>
                {badges.length > 0 && (
                  <div className="workspace-subsector-meta">
                    {badges.map((badge) => (
                      <span
                        key={badge.key}
                        className={`workspace-mode-badge workspace-mode-badge--${badge.tone}`}
                        title={sub.presentation.detail}
                      >
                        {badge.label}
                      </span>
                    ))}
                    {sub.canCollapse && (
                      <button
                        type="button"
                        className="workspace-mode-toggle"
                        onClick={() => onToggleExpandedSubsector(sub.outputId)}
                      >
                        {isCollapsed ? 'Show states' : 'Hide states'}
                      </button>
                    )}
                  </div>
                )}
                {pathwaysInactive && (
                  <div className="workspace-subsector-detail">{sub.presentation.detail}</div>
                )}
                {!isCollapsed && (
                  <div className="workspace-state-chips">
                    {showsSolveActivitySplit && (
                      <div className="workspace-subsector-detail">
                        Enabled pathways stay editable here. Only pathways marked Active are
                        currently carrying activity and defining the cap denominator.
                      </div>
                    )}
                    {sub.states.map((state) => {
                      const isEnabled = !pathwaysInactive && enabledStateIds.has(state.stateId);
                      const isSolveActive = !pathwaysInactive && solveActiveStateIds.has(state.stateId);
                      const chipClass = pathwaysInactive
                        ? 'workspace-state-chip--inactive'
                        : !isEnabled
                          ? 'workspace-state-chip--off'
                          : showsSolveActivitySplit && !isSolveActive
                            ? 'workspace-state-chip--enabled'
                            : 'workspace-state-chip--on';
                      const chipStatusLabel = showsSolveActivitySplit && isEnabled
                        ? (isSolveActive ? 'Active' : 'Enabled')
                        : null;
                      const chipTitle = pathwaysInactive
                        ? sub.presentation.detail
                        : showsSolveActivitySplit && isEnabled
                          ? (isSolveActive
                              ? 'Enabled and solve-active under the current control.'
                              : 'Enabled, but not solve-active under the current control.')
                          : undefined;

                      return (
                        <button
                          key={state.stateId}
                          type="button"
                          className={`workspace-state-chip ${chipClass}${outOfScope ? ' workspace-state-chip--dimmed' : ''}`}
                          onClick={() =>
                            onToggleStateEnabled(sub.outputId, state.stateId)
                          }
                          disabled={pathwaysInactive}
                          title={chipTitle}
                        >
                          <span>{state.stateLabel}</span>
                          {chipStatusLabel && (
                            <span
                              className={`workspace-state-chip__status workspace-state-chip__status--${isSolveActive ? 'active' : 'enabled'}`}
                            >
                              {chipStatusLabel}
                            </span>
                          )}
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
      <div className="workspace-state-legend" role="note" aria-label="State selector status legend">
        <p className="workspace-state-legend-copy">
          Seed scope is shown separately from the effective run, which may auto-include dependencies.
          Demand or supply participation is shown separately from pathway enablement.
          When exact-share controls narrow the current mix, enabled pathways and solve-active
          pathways are called out separately.
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
    </React.Fragment>
  );
}

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
            const availableStateIds = new Set(sub.availableStateIds);
            const pathwaysInactive = sub.pathwaysInactive;
            const outOfScope = sub.outOfScope;
            const isCollapsed = sub.isCollapsed;
            const badges = sub.badges;

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
                    {sub.states.map((state) => {
                      const isOn = !pathwaysInactive && availableStateIds.has(state.stateId);
                      return (
                        <button
                          key={state.stateId}
                          type="button"
                          className={`workspace-state-chip ${isOn ? 'workspace-state-chip--on' : 'workspace-state-chip--off'}${outOfScope ? ' workspace-state-chip--dimmed' : ''}${pathwaysInactive ? ' workspace-state-chip--inactive' : ''}`}
                          onClick={() =>
                            onToggleStateEnabled(sub.outputId, state.stateId)
                          }
                          disabled={pathwaysInactive}
                          title={pathwaysInactive ? sub.presentation.detail : undefined}
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
      <div className="workspace-state-legend" role="note" aria-label="State selector status legend">
        <p className="workspace-state-legend-copy">
          Seed scope is shown separately from the effective run, which may auto-include dependencies.
          Demand or supply participation is shown separately from pathway availability.
          Active pathways in the solve are called out separately when exact-share controls narrow them below the available set.
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

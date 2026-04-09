import React from 'react';
import type { SectorCatalogEntry } from '../../data/configurationWorkspaceModel';
import type { DerivedOutputRunStatus } from '../../solver/solveScope.ts';
import {
  getRightSidebarStatusPresentation,
  RIGHT_SIDEBAR_STATUS_LEGEND,
} from './rightSidebarStatus';

function formatSectorName(sector: string): string {
  return sector.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface RightSidebarContentProps {
  catalog: SectorCatalogEntry[];
  outputStatuses: Record<string, DerivedOutputRunStatus>;
  expandedDisabled: Set<string>;
  onToggleExpanded: (outputId: string) => void;
  onToggleStateEnabled: (outputId: string, stateId: string) => void;
}

export default function RightSidebarContent({
  catalog,
  outputStatuses,
  expandedDisabled,
  onToggleExpanded,
  onToggleStateEnabled,
}: RightSidebarContentProps) {
  return (
    <React.Fragment>
      <h2>State Selector</h2>
      {catalog.map((sectorEntry) => (
        <div key={sectorEntry.sector} className="workspace-sector-group">
          <div className="workspace-sector-title">
            {formatSectorName(sectorEntry.sector)}
          </div>
          {sectorEntry.subsectors.map((sub) => {
            const status = outputStatuses[sub.outputId];
            const presentation = getRightSidebarStatusPresentation(status);
            const enabledIds = new Set(status?.enabledStateIds ?? []);
            const pathwaysInactive = presentation.arePathwaysInactive;
            const allDisabled = status?.isDisabled ?? enabledIds.size === 0;
            const outOfScope = presentation.isDimmed;
            const isCollapsed = allDisabled && !expandedDisabled.has(sub.outputId);
            const badges = presentation.badges;

            return (
              <div
                key={sub.outputId}
                className={`workspace-subsector-group${outOfScope ? ' workspace-subsector-group--dimmed' : ''}`}
              >
                <div
                  className={`workspace-subsector-title${allDisabled ? ' workspace-subsector-title--clickable' : ''}`}
                  onClick={allDisabled ? () => onToggleExpanded(sub.outputId) : undefined}
                >
                  {sub.outputLabel}
                </div>
                {badges.length > 0 && (
                  <div className="workspace-subsector-meta">
                    {badges.map((badge) => (
                      <span
                        key={badge.key}
                        className={`workspace-mode-badge workspace-mode-badge--${badge.tone}`}
                        title={presentation.detail}
                      >
                        {badge.label}
                      </span>
                    ))}
                    {allDisabled && (
                      <button
                        type="button"
                        className="workspace-mode-toggle"
                        onClick={() => onToggleExpanded(sub.outputId)}
                      >
                        {isCollapsed ? 'Show states' : 'Hide states'}
                      </button>
                    )}
                  </div>
                )}
                {pathwaysInactive && (
                  <div className="workspace-subsector-detail">{presentation.detail}</div>
                )}
                {!isCollapsed && (
                  <div className="workspace-state-chips">
                    {sub.states.map((state) => {
                      const isOn = !pathwaysInactive && enabledIds.has(state.stateId);
                      return (
                        <button
                          key={state.stateId}
                          type="button"
                          className={`workspace-state-chip ${isOn ? 'workspace-state-chip--on' : 'workspace-state-chip--off'}${outOfScope ? ' workspace-state-chip--dimmed' : ''}${pathwaysInactive ? ' workspace-state-chip--inactive' : ''}`}
                          onClick={() =>
                            onToggleStateEnabled(sub.outputId, state.stateId)
                          }
                          disabled={pathwaysInactive}
                          title={pathwaysInactive ? presentation.detail : undefined}
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
          Demand or supply participation is shown separately from pathway enablement.
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

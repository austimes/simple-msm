import { useMemo, useState, useCallback } from 'react';
import { usePackageStore } from '../../data/packageStore';
import {
  buildStateCatalog,
} from '../../data/configurationWorkspaceModel';
import { deriveOutputRunStatusesForConfiguration } from '../../solver/solveScope.ts';
import {
  getRightSidebarStatusPresentation,
  RIGHT_SIDEBAR_STATUS_LEGEND,
} from './rightSidebarStatus';

function formatSectorName(sector: string): string {
  return sector.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
                  onClick={allDisabled ? () => toggleExpanded(sub.outputId) : undefined}
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
                        onClick={() => toggleExpanded(sub.outputId)}
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
                            toggleStateEnabled(sub.outputId, state.stateId)
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
    </>
  );
}

import { useMemo, useState, useCallback } from 'react';
import { usePackageStore } from '../../data/packageStore';
import {
  buildStateCatalog,
} from '../../data/scenarioWorkspaceModel';
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

  // Track which disabled subsectors the user has expanded to re-select states
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
          Run scope badges are separate from state enablement. An output is only disabled when
          every state is turned off.
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
            const isCollapsed = presentation.isDisabled && !expandedDisabled.has(sub.outputId);
            const titleClassName = `workspace-subsector-title${presentation.isDisabled ? ' workspace-subsector-title--clickable' : ''}`;
            const groupClassName = [
              'workspace-subsector-group',
              ...presentation.groupClassNames,
            ].join(' ');

            return (
              <div key={sub.outputId} className={groupClassName}>
                <div
                  className={titleClassName}
                  onClick={presentation.isDisabled ? () => toggleExpanded(sub.outputId) : undefined}
                >
                  {sub.outputLabel}
                  {presentation.badges.map((badge) => (
                    <span
                      key={badge.key}
                      className={`workspace-mode-badge workspace-mode-badge--${badge.tone}`}
                    >
                      {badge.label}
                      {badge.key === 'disabled' ? ` ${isCollapsed ? '▸' : '▾'}` : ''}
                    </span>
                  ))}
                </div>
                <div className="workspace-subsector-detail">{presentation.detail}</div>
                {!isCollapsed && (
                  <div className="workspace-state-chips">
                    {sub.states.map((state) => {
                      const isOn = enabledIds.has(state.stateId);
                      return (
                        <button
                          key={state.stateId}
                          type="button"
                          className={`workspace-state-chip ${isOn ? 'workspace-state-chip--on' : 'workspace-state-chip--off'}`}
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

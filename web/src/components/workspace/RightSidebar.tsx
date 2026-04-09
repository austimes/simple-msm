import { useMemo, useState, useCallback } from 'react';
import { usePackageStore } from '../../data/packageStore';
import { getIncludedOutputIds } from '../../data/configurationLoader';
import {
  buildStateCatalog,
  getEnabledStateIds,
} from '../../data/scenarioWorkspaceModel';

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

  const scopeSet = useMemo(
    () => {
      const includedOutputIds = getIncludedOutputIds(currentConfiguration);
      return includedOutputIds ? new Set(includedOutputIds) : null;
    },
    [currentConfiguration],
  );

  return (
    <>
      <h2>State Selector</h2>
      {catalog.map((sectorEntry) => (
        <div key={sectorEntry.sector} className="workspace-sector-group">
          <div className="workspace-sector-title">
            {formatSectorName(sectorEntry.sector)}
          </div>
          {sectorEntry.subsectors.map((sub) => {
            const outOfScope = scopeSet !== null && !scopeSet.has(sub.outputId);
            const allStateIds = sub.states.map((s) => s.stateId);
            const enabledIds = new Set(
              getEnabledStateIds(currentConfiguration, sub.outputId, allStateIds),
            );
            const allDisabled = enabledIds.size === 0;
            const isCollapsed = allDisabled && !expandedDisabled.has(sub.outputId);

            return (
              <div
                key={sub.outputId}
                className={`workspace-subsector-group${outOfScope || allDisabled ? ' workspace-subsector-group--dimmed' : ''}`}
              >
                <div
                  className={`workspace-subsector-title${allDisabled ? ' workspace-subsector-title--clickable' : ''}`}
                  onClick={allDisabled ? () => toggleExpanded(sub.outputId) : undefined}
                >
                  {sub.outputLabel}
                  {allDisabled && (
                    <span className="workspace-mode-badge workspace-mode-badge--disabled">
                      disabled {isCollapsed ? '▸' : '▾'}
                    </span>
                  )}
                </div>
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

import { useMemo, useState, useCallback } from 'react';
import { getIncludedOutputIds } from '../../data/configurationLoader';
import { usePackageStore } from '../../data/packageStore';
import {
  buildStateCatalog,
  getEnabledStateIds,
} from '../../data/configurationWorkspaceModel';

function formatSectorName(sector: string): string {
  return sector.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RightSidebar() {
  const sectorStates = usePackageStore((s) => s.sectorStates);
  const appConfig = usePackageStore((s) => s.appConfig);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);
  const toggleStateEnabled = usePackageStore((s) => s.toggleStateEnabled);
  const includedOutputIds = getIncludedOutputIds(currentConfiguration);

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
    () => (includedOutputIds ? new Set(includedOutputIds) : null),
    [includedOutputIds],
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
            const controlMode = currentConfiguration.service_controls[sub.outputId]?.mode;
            const isOff = controlMode === 'off';
            const allStateIds = sub.states.map((s) => s.stateId);
            const enabledIds = new Set(
              getEnabledStateIds(currentConfiguration, sub.outputId, allStateIds),
            );
            const allDisabled = enabledIds.size === 0;
            const isCollapsed = allDisabled && !expandedDisabled.has(sub.outputId);

            return (
              <div
                key={sub.outputId}
                className={`workspace-subsector-group${outOfScope || isOff || allDisabled ? ' workspace-subsector-group--dimmed' : ''}`}
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
                  {isOff && !allDisabled && <span className="workspace-mode-badge">off</span>}
                </div>
                {!isCollapsed && (
                  <div className="workspace-state-chips">
                    {sub.states.map((state) => {
                      const isOn = !isOff && !outOfScope && enabledIds.has(state.stateId);
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

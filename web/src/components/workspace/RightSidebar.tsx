import { useMemo } from 'react';
import { usePackageStore } from '../../data/packageStore';
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
  const currentScenario = usePackageStore((s) => s.currentScenario);
  const toggleStateEnabled = usePackageStore((s) => s.toggleStateEnabled);
  const includedOutputIds = usePackageStore((s) => s.includedOutputIds);

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
            const controlMode = currentScenario.service_controls[sub.outputId]?.mode;
            const isOff = controlMode === 'off';
            const allStateIds = sub.states.map((s) => s.stateId);
            const enabledIds = new Set(
              getEnabledStateIds(currentScenario, sub.outputId, allStateIds),
            );

            return (
              <div
                key={sub.outputId}
                className={`workspace-subsector-group${outOfScope || isOff ? ' workspace-subsector-group--dimmed' : ''}`}
              >
                <div className="workspace-subsector-title">
                  {sub.outputLabel}
                  {isOff && <span className="workspace-mode-badge">off</span>}
                </div>
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
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

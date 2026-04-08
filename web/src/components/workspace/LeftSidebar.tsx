import { usePackageStore } from '../../data/packageStore';
import { getActiveDemandPreset, getActivePricePreset } from '../../data/scenarioWorkspaceModel';

export default function LeftSidebar() {
  const appConfig = usePackageStore((s) => s.appConfig);
  const currentScenario = usePackageStore((s) => s.currentScenario);
  const setDemandPreset = usePackageStore((s) => s.setDemandPreset);
  const setCommodityPricePreset = usePackageStore((s) => s.setCommodityPricePreset);

  const activeDemandPreset = getActiveDemandPreset(currentScenario, appConfig);
  const activePricePreset = getActivePricePreset(currentScenario);

  return (
    <>
      <div className="workspace-section">
        <span className="workspace-section-title">Demand Growth</span>
        <div className="workspace-chip-group">
          {Object.entries(appConfig.demand_growth_presets).map(([id, preset]) => (
            <button
              key={id}
              className={`workspace-chip${activeDemandPreset === id ? ' workspace-chip--active' : ''}`}
              onClick={() => setDemandPreset(id)}
            >
              {preset.label}
            </button>
          ))}
          {activeDemandPreset === null && (
            <span className="workspace-chip workspace-chip--active">Custom</span>
          )}
        </div>
      </div>

      <div className="workspace-section">
        <span className="workspace-section-title">Commodity Prices</span>
        <div className="workspace-chip-group">
          {Object.entries(appConfig.commodity_price_presets).map(([id, preset]) => (
            <button
              key={id}
              className={`workspace-chip${activePricePreset === id ? ' workspace-chip--active' : ''}`}
              onClick={() => setCommodityPricePreset(id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

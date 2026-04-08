import { useMemo } from 'react';
import { usePackageStore } from '../../data/packageStore';
import { getActiveDemandPreset, getCommodityPriceLevel, getActiveCarbonPricePreset } from '../../data/scenarioWorkspaceModel';
import { loadBuiltinConfigurations, loadUserConfigurations } from '../../data/configurationLoader';
import { PRICE_LEVELS } from '../../data/types';

export default function LeftSidebar() {
  const appConfig = usePackageStore((s) => s.appConfig);
  const currentScenario = usePackageStore((s) => s.currentScenario);
  const setDemandPreset = usePackageStore((s) => s.setDemandPreset);
  const setCommodityPriceLevel = usePackageStore((s) => s.setCommodityPriceLevel);
  const setCarbonPricePreset = usePackageStore((s) => s.setCarbonPricePreset);
  const loadConfiguration = usePackageStore((s) => s.loadConfiguration);
  const activeConfigurationId = usePackageStore((s) => s.activeConfigurationId);

  const activeDemandPreset = getActiveDemandPreset(currentScenario, appConfig);
  const activeCarbonPreset = getActiveCarbonPricePreset(currentScenario, appConfig);

  const configs = useMemo(
    () => [...loadBuiltinConfigurations(), ...loadUserConfigurations()],
    [],
  );

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
        {Object.entries(appConfig.commodity_price_presets).map(([commodityId, driver]) => {
          const activeLevel = getCommodityPriceLevel(currentScenario, commodityId);
          return (
            <div key={commodityId} className="workspace-subsector-group">
              <div className="workspace-subsector-title">{driver.label}</div>
              <div className="workspace-state-chips">
                {PRICE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`workspace-state-chip ${activeLevel === level ? 'workspace-state-chip--on' : 'workspace-state-chip--off'}`}
                    onClick={() => setCommodityPriceLevel(commodityId, level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="workspace-section">
        <span className="workspace-section-title">Emissions Price</span>
        <div className="workspace-chip-group">
          {Object.entries(appConfig.carbon_price_presets).map(([id, preset]) => (
            <button
              key={id}
              className={`workspace-chip${activeCarbonPreset === id ? ' workspace-chip--active' : ''}`}
              onClick={() => setCarbonPricePreset(id)}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
          {activeCarbonPreset === null && (
            <span className="workspace-chip workspace-chip--active">Custom</span>
          )}
        </div>
      </div>

      {configs.length > 0 && (
        <div className="workspace-section">
          <span className="workspace-section-title">Configurations</span>
          <div className="workspace-chip-group">
            {configs.map((config) => (
              <button
                key={config.id}
                className={`workspace-chip${activeConfigurationId === config.id ? ' workspace-chip--active' : ''}`}
                onClick={() => loadConfiguration(config)}
                title={config.description}
              >
                {config.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

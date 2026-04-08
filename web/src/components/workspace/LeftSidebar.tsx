import { useMemo } from 'react';
import { usePackageStore } from '../../data/packageStore';
import { getActiveDemandPreset, getCommodityPriceLevel, getActiveCarbonPricePreset } from '../../data/scenarioWorkspaceModel';
import { loadBuiltinConfigurations, loadUserConfigurations } from '../../data/configurationLoader';
import { PRICE_LEVELS } from '../../data/types';
import type { CommodityPriceSeries, CarbonPricePreset } from '../../data/types';

function formatUnit(raw: string): string {
  return raw
    .replace(/^AUD_2024_per_/, '$/')
    .replace('tCO2_stored', 'tCO₂')
    .replace('tCO2', 'tCO₂');
}

function formatCommodityPrice(series: CommodityPriceSeries): string {
  const unit = formatUnit(series.unit);
  const val = series.values_by_year['2025'];
  return val != null ? `${unit.replace('$/', `$${val}/`)}` : formatUnit(series.unit);
}

function formatCarbonPriceRange(preset: CarbonPricePreset): string {
  const years = Object.keys(preset.values_by_year).sort();
  const first = preset.values_by_year[years[0]];
  const last = preset.values_by_year[years[years.length - 1]];
  const unit = formatUnit(preset.unit);
  return `${unit.replace('$/', `$${first}–${last}/`)}`;
}

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
              <div className="workspace-chip-group workspace-chip-group--inline">
                {PRICE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`workspace-chip${activeLevel === level ? ' workspace-chip--active' : ''}`}
                    onClick={() => setCommodityPriceLevel(commodityId, level)}
                    title={level}
                  >
                    {formatCommodityPrice(driver.levels[level])}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="workspace-section">
        <span className="workspace-section-title">Emissions Price</span>
        <div className="workspace-chip-group workspace-chip-group--inline">
          {Object.entries(appConfig.carbon_price_presets).map(([id, preset]) => (
            <button
              key={id}
              className={`workspace-chip${activeCarbonPreset === id ? ' workspace-chip--active' : ''}`}
              onClick={() => setCarbonPricePreset(id)}
              title={preset.description}
            >
              {formatCarbonPriceRange(preset)}
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

import { useMemo, useState, useCallback } from 'react';
import { usePackageStore } from '../../data/packageStore';
import { getActiveDemandPreset, getCommodityPriceLevel, getActiveCarbonPricePreset } from '../../data/scenarioWorkspaceModel';
import {
  loadBuiltinConfigurations,
  loadUserConfigurations,
  fetchUserConfigurations,
  saveUserConfiguration,
  deleteUserConfiguration,
  createConfigurationFromScenario,
} from '../../data/configurationLoader';
import { PRICE_LEVELS } from '../../data/types';
import type { CommodityPriceSeries, CarbonPricePreset } from '../../data/types';
import type { SolveConfiguration } from '../../data/configurationTypes';

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
  if (first === 0 && last === 0) return preset.label;
  const unit = formatUnit(preset.unit);
  return `${unit.replace('$/', `$${first}–${last}/`)}`;
}

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '') || `config-${Date.now()}`
  );
}

export default function LeftSidebar() {
  const appConfig = usePackageStore((s) => s.appConfig);
  const currentScenario = usePackageStore((s) => s.currentScenario);
  const defaultScenario = usePackageStore((s) => s.defaultScenario);
  const includedOutputIds = usePackageStore((s) => s.includedOutputIds);
  const setDemandPreset = usePackageStore((s) => s.setDemandPreset);
  const setCommodityPriceLevel = usePackageStore((s) => s.setCommodityPriceLevel);
  const setCarbonPricePreset = usePackageStore((s) => s.setCarbonPricePreset);
  const loadConfiguration = usePackageStore((s) => s.loadConfiguration);
  const activeConfigurationId = usePackageStore((s) => s.activeConfigurationId);

  const activeDemandPreset = getActiveDemandPreset(currentScenario, appConfig);
  const activeCarbonPreset = getActiveCarbonPricePreset(currentScenario, appConfig);

  const builtinConfigs = useMemo(() => loadBuiltinConfigurations(), []);
  const [userConfigs, setUserConfigs] = useState(() => loadUserConfigurations());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const configs = useMemo(
    () => [...builtinConfigs, ...userConfigs],
    [builtinConfigs, userConfigs],
  );

  const refreshUserConfigs = useCallback(async () => {
    const configs = await fetchUserConfigurations();
    setUserConfigs(configs);
  }, []);

  const activeUserConfig = activeConfigurationId
    ? userConfigs.find((c) => c.id === activeConfigurationId)
    : null;

  async function handleSaveAs() {
    const name = prompt('Configuration name:');
    if (!name?.trim()) return;

    const config = createConfigurationFromScenario(
      currentScenario,
      defaultScenario,
      includedOutputIds,
      appConfig,
    );
    config.name = name.trim();
    config.id = slugify(name.trim());

    const builtinIds = new Set(builtinConfigs.map((c) => c.id));
    if (builtinIds.has(config.id)) {
      config.id = `${config.id}-custom`;
    }

    const error = await saveUserConfiguration(config);
    if (error) {
      setSaveNotice(`Error: ${error}`);
    } else {
      setSaveNotice(`Saved "${config.name}".`);
      await refreshUserConfigs();
      loadConfiguration(config);
    }
  }

  async function handleOverwrite(existing: SolveConfiguration) {
    const config = createConfigurationFromScenario(
      currentScenario,
      defaultScenario,
      includedOutputIds,
      appConfig,
    );
    config.id = existing.id;
    config.name = existing.name;

    const error = await saveUserConfiguration(config);
    if (error) {
      setSaveNotice(`Error: ${error}`);
    } else {
      setSaveNotice(`Updated "${config.name}".`);
      await refreshUserConfigs();
      loadConfiguration(config);
    }
  }

  async function handleDelete(configId: string) {
    const error = await deleteUserConfiguration(configId);
    if (error) {
      setSaveNotice(`Error: ${error}`);
    } else {
      setSaveNotice('Deleted.');
      await refreshUserConfigs();
    }
  }

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

      <div className="workspace-section">
        <span className="workspace-section-title">Configurations</span>

        {saveNotice && (
          <div
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              marginBottom: 8,
              background: saveNotice.startsWith('Error') ? '#fef2f2' : 'var(--color-primary-bg)',
              color: saveNotice.startsWith('Error') ? '#b91c1c' : 'var(--color-primary)',
            }}
          >
            {saveNotice}
          </div>
        )}

        {configs.length > 0 && (
          <div className="workspace-chip-group">
            {configs.map((config) => (
              <span key={config.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <button
                  className={`workspace-chip${activeConfigurationId === config.id ? ' workspace-chip--active' : ''}`}
                  onClick={() => loadConfiguration(config)}
                  title={config.description}
                >
                  {config.name}
                </button>
                {!config.readonly && (
                  <button
                    className="workspace-chip"
                    style={{ padding: '2px 6px', fontSize: 11, color: '#b91c1c' }}
                    onClick={() => handleDelete(config.id)}
                    title="Delete configuration"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="workspace-chip"
            onClick={handleSaveAs}
          >
            Save as…
          </button>
          {activeUserConfig && (
            <button
              type="button"
              className="workspace-chip"
              onClick={() => handleOverwrite(activeUserConfig)}
            >
              Save "{activeUserConfig.name}"
            </button>
          )}
        </div>
      </div>
    </>
  );
}

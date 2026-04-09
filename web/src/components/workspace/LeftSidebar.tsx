import { useMemo, useState, useCallback } from 'react';
import { usePackageStore } from '../../data/packageStore';
import { getActiveDemandPreset, getCommodityPriceLevel, getActiveCarbonPricePreset } from '../../data/scenarioWorkspaceModel';
import {
  getConfigurationId,
  getSeedOutputIds,
  isReadonlyConfiguration,
  loadBuiltinConfigurations,
  loadUserConfigurations,
  fetchUserConfigurations,
  saveUserConfiguration,
  deleteUserConfiguration,
  createConfigurationFromScenario,
  slugifyConfigurationName,
} from '../../data/configurationLoader';
import { PRICE_LEVELS } from '../../data/types';
import { deriveOutputRunStatusesForConfiguration } from '../../solver/solveScope.ts';
import type { CommodityPriceSeries, CarbonPricePreset, ScenarioDocument } from '../../data/types';
import { getCommodityPriceSelectorPresentation } from './leftSidebarCommodityStatus';

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

export default function LeftSidebar() {
  const appConfig = usePackageStore((s) => s.appConfig);
  const sectorStates = usePackageStore((s) => s.sectorStates);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);
  const setDemandPreset = usePackageStore((s) => s.setDemandPreset);
  const setCommodityPriceLevel = usePackageStore((s) => s.setCommodityPriceLevel);
  const setCarbonPricePreset = usePackageStore((s) => s.setCarbonPricePreset);
  const loadConfiguration = usePackageStore((s) => s.loadConfiguration);
  const activeConfigurationId = usePackageStore((s) => s.activeConfigurationId);
  const activeConfigurationReadonly = usePackageStore((s) => s.activeConfigurationReadonly);
  const isConfigurationDirty = usePackageStore((s) => s.isConfigurationDirty);
  const seedOutputIds = getSeedOutputIds(currentConfiguration);

  const activeDemandPreset = getActiveDemandPreset(currentConfiguration, appConfig);
  const activeCarbonPreset = getActiveCarbonPricePreset(currentConfiguration, appConfig);
  const outputStatuses = useMemo(
    () => deriveOutputRunStatusesForConfiguration(
      { sectorStates, appConfig },
      currentConfiguration,
    ),
    [sectorStates, appConfig, currentConfiguration],
  );

  const builtinConfigs = useMemo(() => loadBuiltinConfigurations(), []);
  const [userConfigs, setUserConfigs] = useState(() => loadUserConfigurations());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const refreshUserConfigs = useCallback(async () => {
    const configs = await fetchUserConfigurations();
    setUserConfigs(configs);
  }, []);

  const activeUserConfig =
    activeConfigurationId && !activeConfigurationReadonly
      ? userConfigs.find((config) => getConfigurationId(config) === activeConfigurationId) ?? null
      : null;

  function buildUserConfiguration(name: string, configurationId: string): ScenarioDocument {
    const configuration = createConfigurationFromScenario(currentConfiguration, seedOutputIds);
    configuration.name = name;
    configuration.app_metadata = {
      ...(configuration.app_metadata ?? {}),
      id: configurationId,
      readonly: false,
      seed_output_ids: seedOutputIds,
    };
    return configuration;
  }

  async function handleSaveAs() {
    const name = prompt('Configuration name:');
    if (!name?.trim()) return;

    const trimmedName = name.trim();
    let configurationId = slugifyConfigurationName(trimmedName);

    const builtinIds = new Set(
      builtinConfigs
        .map((config) => getConfigurationId(config))
        .filter((id): id is string => id !== null),
    );
    if (builtinIds.has(configurationId)) {
      configurationId = `${configurationId}-custom`;
    }

    const config = buildUserConfiguration(trimmedName, configurationId);

    const error = await saveUserConfiguration(config);
    if (error) {
      setSaveNotice(`Error: ${error}`);
    } else {
      setSaveNotice(`Saved "${config.name}".`);
      await refreshUserConfigs();
      loadConfiguration(config);
    }
  }

  async function handleOverwrite(existing: ScenarioDocument) {
    const existingId = getConfigurationId(existing) ?? slugifyConfigurationName(existing.name);
    const config = buildUserConfiguration(existing.name, existingId);

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

  function renderConfigurationGroup(title: string, configs: ScenarioDocument[]) {
    return (
      <div className="workspace-sector-group">
        <div className="workspace-sector-title">{title}</div>
        {configs.length === 0 ? (
          <div className="workspace-empty-state">None yet.</div>
        ) : (
          <div className="workspace-chip-group">
            {configs.map((config) => {
              const configId = getConfigurationId(config) ?? config.name;
              const isActiveBase = activeConfigurationId === configId;
              const isModified = isActiveBase && isConfigurationDirty;
              return (
                <div key={configId} className="workspace-configuration-row">
                  <button
                    className={`workspace-chip${isActiveBase ? ' workspace-chip--active' : ''}${isModified ? ' workspace-chip--modified' : ''}`}
                    onClick={() => loadConfiguration(config)}
                    title={config.description}
                  >
                    {config.name}
                    {isModified ? ' (modified)' : ''}
                  </button>
                  {!isReadonlyConfiguration(config) && (
                    <button
                      className="workspace-chip workspace-chip--danger"
                      onClick={() => handleDelete(configId)}
                      title="Delete configuration"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
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
          const activeLevel = getCommodityPriceLevel(currentConfiguration, commodityId);
          const selectorPresentation = getCommodityPriceSelectorPresentation(
            outputStatuses[commodityId],
            activeLevel,
          );
          return (
            <div key={commodityId} className="workspace-subsector-group">
              <div className="workspace-subsector-title">
                {driver.label}
                {selectorPresentation.badgeLabel && selectorPresentation.badgeTone && (
                  <span className={`workspace-mode-badge workspace-mode-badge--${selectorPresentation.badgeTone}`}>
                    {selectorPresentation.badgeLabel}
                  </span>
                )}
              </div>
              {selectorPresentation.detail && (
                <div className="workspace-subsector-detail">
                  {selectorPresentation.detail}
                </div>
              )}
              <div className="workspace-chip-group workspace-chip-group--inline">
                {PRICE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={`workspace-chip${selectorPresentation.activeLevel === level ? ' workspace-chip--active' : ''}${selectorPresentation.selectorEnabled ? '' : ' workspace-chip--inactive'}`}
                    onClick={() => setCommodityPriceLevel(commodityId, level)}
                    title={
                      selectorPresentation.selectorEnabled
                        ? level
                        : `${driver.label} is ${selectorPresentation.controlModeLabel} in the current solve, so the exogenous price selector is inactive.`
                    }
                    disabled={!selectorPresentation.selectorEnabled}
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

        <div className="workspace-configuration-actions">
          <button
            type="button"
            className="workspace-chip workspace-chip--secondary-action"
            onClick={handleSaveAs}
          >
            Save as…
          </button>
          {activeUserConfig && isConfigurationDirty && (
            <button
              type="button"
              className="workspace-chip"
              onClick={() => handleOverwrite(activeUserConfig)}
            >
              Save "{activeUserConfig.name}"
            </button>
          )}
        </div>

        {saveNotice && (
          <div
            className={`workspace-status-notice${saveNotice.startsWith('Error') ? ' workspace-status-notice--error' : ''}`}
          >
            {saveNotice}
          </div>
        )}

        {renderConfigurationGroup('User configurations', userConfigs)}
        {renderConfigurationGroup('Built-in configurations', builtinConfigs)}
      </div>
    </>
  );
}

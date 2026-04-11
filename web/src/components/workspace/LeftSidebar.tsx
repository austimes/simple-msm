import { useMemo, useState, useCallback } from 'react';
import { usePackageStore } from '../../data/packageStore';
import { getActiveDemandPreset, getCommodityPriceLevel, getActiveCarbonPricePreset } from '../../data/configurationWorkspaceModel';
import {
  getConfigurationId,
  getSeedOutputIds,
  isReadonlyConfiguration,
  loadBuiltinConfigurations,
  loadUserConfigurations,
  fetchUserConfigurations,
  saveUserConfiguration,
  deleteUserConfiguration,
  createConfigurationFromDocument,
  slugifyConfigurationName,
} from '../../data/configurationLoader';
import { PRICE_LEVELS } from '../../data/types';
import { deriveOutputRunStatusesForConfiguration } from '../../solver/solveScope.ts';
import type {
  CarbonPricePreset,
  CommodityPriceSeries,
  ConfigurationControlMode,
  ConfigurationDocument,
} from '../../data/types';
import {
  formatControlModeLabel,
  getCommodityPriceSelectorPresentation,
} from './leftSidebarCommodityStatus';
import { getConfigurationSaveActionState } from './leftSidebarSaveActions';
import { formatWorkspacePillLabel } from './workspacePillLabel';

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

function formatModeChoiceLabel(mode: ConfigurationControlMode): string {
  const label = formatControlModeLabel(mode);
  return label.replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderWorkspaceChipLabel(label: string) {
  return <span className="workspace-pill-label">{formatWorkspacePillLabel(label)}</span>;
}

export default function LeftSidebar() {
  const appConfig = usePackageStore((s) => s.appConfig);
  const sectorStates = usePackageStore((s) => s.sectorStates);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);
  const setDemandPreset = usePackageStore((s) => s.setDemandPreset);
  const setCommodityPriceLevel = usePackageStore((s) => s.setCommodityPriceLevel);
  const setCarbonPricePreset = usePackageStore((s) => s.setCarbonPricePreset);
  const setRespectMaxShare = usePackageStore((s) => s.setRespectMaxShare);
  const setOutputControlMode = usePackageStore((s) => s.setOutputControlMode);
  const loadConfiguration = usePackageStore((s) => s.loadConfiguration);
  const activeConfigurationId = usePackageStore((s) => s.activeConfigurationId);
  const activeConfigurationReadonly = usePackageStore((s) => s.activeConfigurationReadonly);
  const isConfigurationDirty = usePackageStore((s) => s.isConfigurationDirty);
  const seedOutputIds = getSeedOutputIds(currentConfiguration);
  const saveActionState = getConfigurationSaveActionState({
    activeConfigurationId,
    activeConfigurationReadonly,
    isConfigurationDirty,
  });

  const activeDemandPreset = getActiveDemandPreset(currentConfiguration, appConfig);
  const activeCarbonPreset = getActiveCarbonPricePreset(currentConfiguration, appConfig);
  const respectMaxShare = currentConfiguration.solver_options?.respect_max_share ?? true;
  const outputStatuses = useMemo(
    () => deriveOutputRunStatusesForConfiguration(
      { sectorStates, appConfig },
      currentConfiguration,
    ),
    [sectorStates, appConfig, currentConfiguration],
  );
  const commodityControls = useMemo(
    () => Object.entries(appConfig.output_roles)
      .filter(([, metadata]) => (
        metadata.output_role === 'endogenous_supply_commodity'
        && metadata.allowed_control_modes.includes('externalized')
        && metadata.allowed_control_modes.includes('optimize')
      ))
      .sort(([, left], [, right]) => (
        left.display_group_order - right.display_group_order
        || left.display_order - right.display_order
        || left.display_label.localeCompare(right.display_label)
      ))
      .map(([outputId, metadata]) => ({
        outputId,
        label: metadata.display_label,
        allowedModes: metadata.allowed_control_modes,
        priceDriver: appConfig.commodity_price_presets[outputId],
      })),
    [appConfig, sectorStates],
  );

  const builtinConfigs = useMemo(() => loadBuiltinConfigurations(), []);
  const [userConfigs, setUserConfigs] = useState(() => loadUserConfigurations());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const refreshUserConfigs = useCallback(async () => {
    const configs = await fetchUserConfigurations();
    setUserConfigs(configs);
  }, []);

  function buildUserConfiguration(name: string, configurationId: string): ConfigurationDocument {
    const configuration = createConfigurationFromDocument(currentConfiguration, seedOutputIds);
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

  async function handleOverwrite() {
    if (!activeConfigurationId) {
      return;
    }

    const config = buildUserConfiguration(currentConfiguration.name, activeConfigurationId);

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

  function renderConfigurationGroup(title: string, configs: ConfigurationDocument[]) {
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
                    title={config.description ? `${config.name}. ${config.description}` : config.name}
                  >
                    {renderWorkspaceChipLabel(`${config.name}${isModified ? ' (modified)' : ''}`)}
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
        <span className="workspace-section-title">Options</span>
        <div className="workspace-subsector-group">
          <div className="workspace-subsector-title">Respect max-share caps</div>
          <div className="workspace-subsector-detail">
            Keeps pathway max-share limits active in the solve and in the pathway cap view.
            The cap denominator is always the set of active pathways.
          </div>
          <div className="workspace-chip-group workspace-chip-group--inline">
            <button
              type="button"
              className={`workspace-chip${respectMaxShare ? ' workspace-chip--active' : ''}`}
              onClick={() => setRespectMaxShare(true)}
            >
              {renderWorkspaceChipLabel('On')}
            </button>
            <button
              type="button"
              className={`workspace-chip${respectMaxShare ? '' : ' workspace-chip--active'}`}
              onClick={() => setRespectMaxShare(false)}
            >
              {renderWorkspaceChipLabel('Off')}
            </button>
          </div>
          <div className="workspace-subsector-detail">
            {respectMaxShare
              ? 'Max-share caps are enforced in the active solve.'
              : 'Max-share caps are ignored in the active solve.'}
          </div>
        </div>
      </div>

      <div className="workspace-section">
        <span className="workspace-section-title">Demand Growth</span>
        <div className="workspace-chip-group">
          {Object.entries(appConfig.demand_growth_presets).map(([id, preset]) => (
            <button
              key={id}
              className={`workspace-chip${activeDemandPreset === id ? ' workspace-chip--active' : ''}`}
              onClick={() => setDemandPreset(id)}
              title={preset.label}
            >
              {renderWorkspaceChipLabel(preset.label)}
            </button>
          ))}
          {activeDemandPreset === null && (
            <span className="workspace-chip workspace-chip--active" title="Custom">
              {renderWorkspaceChipLabel('Custom')}
            </span>
          )}
        </div>
      </div>

      <div className="workspace-section">
        <span className="workspace-section-title">Commodity Controls</span>
        {commodityControls.map(({ outputId, label, allowedModes, priceDriver }) => {
          const activeLevel = getCommodityPriceLevel(currentConfiguration, outputId);
          const selectorPresentation = getCommodityPriceSelectorPresentation(
            outputStatuses[outputId],
            activeLevel,
          );
          const currentMode = outputStatuses[outputId]?.controlMode ?? allowedModes[0];
          return (
            <div key={outputId} className="workspace-subsector-group">
              <div className="workspace-subsector-title">
                {label}
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
                {allowedModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`workspace-chip${currentMode === mode ? ' workspace-chip--active' : ''}`}
                    onClick={() => setOutputControlMode(outputId, mode)}
                    title={`Set ${label} to ${formatControlModeLabel(mode)}`}
                  >
                    {renderWorkspaceChipLabel(formatModeChoiceLabel(mode))}
                  </button>
                ))}
              </div>
              {priceDriver && (
                <>
                  <div className="workspace-subsector-detail">
                    Exogenous price path. This only affects runs where the commodity is externalized.
                  </div>
                  <div className="workspace-chip-group workspace-chip-group--inline">
                    {PRICE_LEVELS.map((level) => (
                      <button
                        key={level}
                        type="button"
                        className={`workspace-chip${selectorPresentation.activeLevel === level ? ' workspace-chip--active' : ''}${selectorPresentation.selectorEnabled ? '' : ' workspace-chip--inactive'}`}
                        onClick={() => setCommodityPriceLevel(outputId, level)}
                        title={
                          selectorPresentation.selectorEnabled
                            ? formatCommodityPrice(priceDriver.levels[level])
                            : `${label} is ${selectorPresentation.controlModeLabel} in the current solve, so the exogenous price selector is inactive.`
                        }
                        disabled={!selectorPresentation.selectorEnabled}
                      >
                        {renderWorkspaceChipLabel(formatCommodityPrice(priceDriver.levels[level]))}
                      </button>
                    ))}
                  </div>
                </>
              )}
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
              title={preset.description ? `${preset.label}. ${preset.description}` : preset.label}
            >
              {renderWorkspaceChipLabel(formatCarbonPriceRange(preset))}
            </button>
          ))}
          {activeCarbonPreset === null && (
            <span className="workspace-chip workspace-chip--active" title="Custom">
              {renderWorkspaceChipLabel('Custom')}
            </span>
          )}
        </div>
      </div>

      <div className="workspace-section">
        <span className="workspace-section-title">Configurations</span>

        <div className="workspace-configuration-actions">
          <button
            type="button"
            className="workspace-chip"
            onClick={() => void handleOverwrite()}
            disabled={!saveActionState.canSave}
            title={saveActionState.disabledReason ?? 'Save this user configuration.'}
          >
            {renderWorkspaceChipLabel('Save')}
          </button>
          <button
            type="button"
            className="workspace-chip workspace-chip--secondary-action"
            onClick={handleSaveAs}
          >
            {renderWorkspaceChipLabel('Save As…')}
          </button>
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

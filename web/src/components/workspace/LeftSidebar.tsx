import { useMemo, useState, useCallback, type ReactNode } from 'react';
import type {
  LeftSidebarSectionKey,
  LeftSidebarSectionState,
  WorkspaceComparisonBaseSelectionMode,
} from '../../data/appUiState.ts';
import { useAppUiStore } from '../../data/appUiStore.ts';
import { usePackageStore } from '../../data/packageStore';
import { getActiveDemandPreset, getCommodityPriceLevel, getActiveCarbonPricePreset } from '../../data/configurationWorkspaceModel';
import {
  getResidualOverlayDisplayMode,
} from '../../data/residualOverlayPresentation.ts';
import { GENERATED_INCUMBENT_BASE_LABEL } from '../../data/systemStructureModel.ts';
import {
  getConfigurationId,
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
  CommodityPriceDriver,
  CommodityPriceSeries,
  ConfigurationControlMode,
  ConfigurationDocument,
  ResidualOverlayDisplayMode,
} from '../../data/types';
import {
  formatControlModeLabel,
  getCommodityPriceSelectorPresentation,
} from './leftSidebarCommodityStatus';
import { getConfigurationSaveActionState } from './leftSidebarSaveActions';
import { formatWorkspacePillLabel } from './workspacePillLabel';

interface ControlledCommodityEntry {
  kind: 'controlled';
  outputId: string;
  label: string;
  allowedModes: ConfigurationControlMode[];
  priceDriver: CommodityPriceDriver | undefined;
}

interface PriceOnlyCommodityEntry {
  kind: 'price_only';
  commodityId: string;
  label: string;
  priceDriver: CommodityPriceDriver;
}

type CommodityControlEntry = ControlledCommodityEntry | PriceOnlyCommodityEntry;

type LeftSidebarTab = 'levers' | 'configs' | 'settings';

const LEFT_SIDEBAR_TABS: Array<{ key: LeftSidebarTab; label: string }> = [
  { key: 'levers', label: 'Levers' },
  { key: 'configs', label: 'Configs' },
  { key: 'settings', label: 'Settings' },
];

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

function formatComparisonModeLabel(mode: WorkspaceComparisonBaseSelectionMode): string {
  switch (mode) {
    case 'generated':
      return 'Generated incumbent';
    case 'saved':
      return 'Saved base';
    default:
      return 'None';
  }
}

function renderWorkspaceChipLabel(label: string) {
  return <span className="workspace-pill-label">{formatWorkspacePillLabel(label)}</span>;
}

interface LeftSidebarProps {
  initialExpandedSections?: Partial<LeftSidebarSectionState>;
  initialActiveTab?: LeftSidebarTab;
}

export default function LeftSidebar({ initialExpandedSections, initialActiveTab = 'levers' }: LeftSidebarProps = {}) {
  const appConfig = usePackageStore((s) => s.appConfig);
  const sectorStates = usePackageStore((s) => s.sectorStates);
  const roleMetadata = usePackageStore((s) => s.roleMetadata);
  const representations = usePackageStore((s) => s.representations);
  const roleDecompositionEdges = usePackageStore((s) => s.roleDecompositionEdges);
  const methods = usePackageStore((s) => s.methods);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);
  const residualOverlays2025 = usePackageStore((s) => s.residualOverlays2025);
  const setDemandPreset = usePackageStore((s) => s.setDemandPreset);
  const setCommodityPriceLevel = usePackageStore((s) => s.setCommodityPriceLevel);
  const setCarbonPricePreset = usePackageStore((s) => s.setCarbonPricePreset);
  const setRespectMaxShare = usePackageStore((s) => s.setRespectMaxShare);
  const setRespectMaxActivity = usePackageStore((s) => s.setRespectMaxActivity);
  const setOutputControlMode = usePackageStore((s) => s.setOutputControlMode);
  const setResidualOverlayDisplayMode = usePackageStore((s) => s.setResidualOverlayDisplayMode);
  const loadConfiguration = usePackageStore((s) => s.loadConfiguration);
  const activeConfigurationId = usePackageStore((s) => s.activeConfigurationId);
  const activeConfigurationReadonly = usePackageStore((s) => s.activeConfigurationReadonly);
  const isConfigurationDirty = usePackageStore((s) => s.isConfigurationDirty);
  const autonomousEfficiencyTracks = usePackageStore((s) => s.autonomousEfficiencyTracks);
  const efficiencyPackages = usePackageStore((s) => s.efficiencyPackages);
  const persistedExpandedSections = useAppUiStore((s) => s.workspace.expandedSections);
  const comparison = useAppUiStore((s) => s.workspace.comparison);
  const updateWorkspaceUi = useAppUiStore((s) => s.updateWorkspaceUi);
  const setWorkspaceSectionExpanded = useAppUiStore((s) => s.setWorkspaceSectionExpanded);
  const [activeTab, setActiveTab] = useState<LeftSidebarTab>(initialActiveTab);
  const saveActionState = getConfigurationSaveActionState({
    activeConfigurationId,
    activeConfigurationReadonly,
    isConfigurationDirty,
  });
  const expandedSections = useMemo(
    () => ({
      ...persistedExpandedSections,
      ...initialExpandedSections,
    }),
    [initialExpandedSections, persistedExpandedSections],
  );

  const activeDemandPreset = getActiveDemandPreset(currentConfiguration, appConfig);
  const activeCarbonPreset = getActiveCarbonPricePreset(currentConfiguration, appConfig);
  const respectMaxShare = currentConfiguration.solver_options?.respect_max_share ?? true;
  const outputStatuses = useMemo(
    () => deriveOutputRunStatusesForConfiguration(
      {
        sectorStates,
        appConfig,
        autonomousEfficiencyTracks,
        efficiencyPackages,
        roleMetadata,
        representations,
        roleDecompositionEdges,
        methods,
      },
      currentConfiguration,
    ),
    [
      sectorStates,
      appConfig,
      autonomousEfficiencyTracks,
      efficiencyPackages,
      roleMetadata,
      representations,
      roleDecompositionEdges,
      methods,
      currentConfiguration,
    ],
  );
  const commodityControls = useMemo<CommodityControlEntry[]>(
    () => {
      const controlledEntries: ControlledCommodityEntry[] = Object.entries(appConfig.output_roles)
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
          kind: 'controlled',
          outputId,
          label: metadata.display_label,
          allowedModes: metadata.allowed_control_modes,
          priceDriver: appConfig.commodity_price_presets[outputId],
        }));

      const controlledIds = new Set(controlledEntries.map((entry) => entry.outputId));
      const priceOnlyEntries: PriceOnlyCommodityEntry[] = Object.entries(appConfig.commodity_price_presets)
        .filter(([commodityId]) => !controlledIds.has(commodityId))
        .map(([commodityId, priceDriver]) => ({
          kind: 'price_only',
          commodityId,
          label: priceDriver.label,
          priceDriver,
        }));

      return [...controlledEntries, ...priceOnlyEntries];
    },
    [appConfig],
  );

  const residualOverlayDisplayMode = getResidualOverlayDisplayMode(currentConfiguration);
  const respectMaxActivity = currentConfiguration.solver_options?.respect_max_activity ?? true;

  const builtinConfigs = useMemo(() => loadBuiltinConfigurations(), []);
  const [userConfigs, setUserConfigs] = useState(() => loadUserConfigurations());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const refreshUserConfigs = useCallback(async () => {
    const configs = await fetchUserConfigurations();
    setUserConfigs(configs);
  }, []);
  const toggleSection = useCallback((section: LeftSidebarSectionKey) => {
    setWorkspaceSectionExpanded(section, !expandedSections[section]);
  }, [expandedSections, setWorkspaceSectionExpanded]);

  function buildUserConfiguration(name: string, configurationId: string): ConfigurationDocument {
    const configuration = createConfigurationFromDocument(currentConfiguration);
    configuration.name = name;
    configuration.app_metadata = {
      ...(configuration.app_metadata ?? {}),
      id: configurationId,
      readonly: false,
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

  function setBaseSelectionMode(mode: WorkspaceComparisonBaseSelectionMode) {
    updateWorkspaceUi({
      comparison: {
        ...comparison,
        baseSelectionMode: mode,
      },
    });
  }

  function setSelectedBaseConfigId(configId: string) {
    updateWorkspaceUi({
      comparison: {
        ...comparison,
        selectedBaseConfigId: configId || null,
      },
    });
  }

  function renderBaseComparisonControls() {
    const configOptions = [...builtinConfigs, ...userConfigs]
      .map((configuration) => ({
        id: getConfigurationId(configuration) ?? configuration.name,
        label: configuration.name,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

    return (
      <div className="workspace-subsector-group">
        <div className="workspace-subsector-title">Base comparison mode</div>
        <div className="workspace-chip-group workspace-chip-group--inline">
          {(['generated', 'saved', 'none'] as WorkspaceComparisonBaseSelectionMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`workspace-chip${comparison.baseSelectionMode === mode ? ' workspace-chip--active' : ''}`}
              onClick={() => setBaseSelectionMode(mode)}
            >
              {renderWorkspaceChipLabel(formatComparisonModeLabel(mode))}
            </button>
          ))}
        </div>
        {comparison.baseSelectionMode === 'generated' && (
          <div className="workspace-subsector-detail">
            {GENERATED_INCUMBENT_BASE_LABEL} uses the active levers and resets enabled modeled outputs to incumbent routes.
          </div>
        )}
        {comparison.baseSelectionMode === 'saved' && (
          <label className="workspace-field">
            <span>Saved base</span>
            <select
              className="configuration-input"
              value={comparison.selectedBaseConfigId ?? ''}
              onChange={(event) => setSelectedBaseConfigId(event.target.value)}
            >
              <option value="">Select a saved base configuration</option>
              {configOptions.map((configuration) => (
                <option key={configuration.id} value={configuration.id}>
                  {configuration.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    );
  }

  function renderSection(
    section: LeftSidebarSectionKey,
    title: string,
    content: ReactNode,
  ) {
    const expanded = expandedSections[section];
    const contentId = `left-sidebar-section-${section}`;

    return (
      <div className="workspace-section">
        <button
          type="button"
          className="workspace-section-toggle"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => toggleSection(section)}
        >
          <span className="workspace-section-title">{title}</span>
          <span className="workspace-section-toggle-state">{expanded ? 'Hide' : 'Show'}</span>
        </button>
        {expanded && (
          <div id={contentId} className="workspace-section-body">
            {content}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="workspace-left-tabs" role="tablist" aria-label="Workspace controls">
        {LEFT_SIDEBAR_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`workspace-left-tab${activeTab === tab.key ? ' workspace-left-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'levers' && (
        <>
          {renderSection(
            'demandGrowth',
            'Demand growth',
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
            </div>,
          )}

          {renderSection(
            'commodityControls',
            'Commodity price levels',
            <>
              {commodityControls.map((entry) => {
                if (entry.kind === 'controlled') {
                  const activeLevel = getCommodityPriceLevel(currentConfiguration, entry.outputId);
                  const selectorPresentation = getCommodityPriceSelectorPresentation(
                    outputStatuses[entry.outputId],
                    activeLevel,
                  );
                  const currentMode = outputStatuses[entry.outputId]?.controlMode ?? entry.allowedModes[0];
                  const priceDriver = entry.priceDriver;

                  return (
                    <div key={entry.outputId} className="workspace-subsector-group">
                      <div className="workspace-subsector-title">{entry.label}</div>
                      {selectorPresentation.detail && (
                        <div className="workspace-subsector-detail">
                          {selectorPresentation.detail}
                        </div>
                      )}
                      <div className="workspace-chip-group workspace-chip-group--inline">
                        {entry.allowedModes.map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            className={`workspace-chip${currentMode === mode ? ' workspace-chip--active' : ''}`}
                            onClick={() => setOutputControlMode(entry.outputId, mode)}
                            title={`Set ${entry.label} to ${formatControlModeLabel(mode)}`}
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
                                onClick={() => setCommodityPriceLevel(entry.outputId, level)}
                                title={
                                  selectorPresentation.selectorEnabled
                                    ? formatCommodityPrice(priceDriver.levels[level])
                                    : `${entry.label} is ${selectorPresentation.controlModeLabel} in the current solve, so the exogenous price selector is inactive.`
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
                }

                const activeLevel = getCommodityPriceLevel(currentConfiguration, entry.commodityId);

                return (
                  <div key={entry.commodityId} className="workspace-subsector-group">
                    <div className="workspace-subsector-title">{entry.label}</div>
                    <div className="workspace-subsector-detail">
                      Exogenous purchase price path for this commodity.
                    </div>
                    <div className="workspace-chip-group workspace-chip-group--inline">
                      {PRICE_LEVELS.map((level) => (
                        <button
                          key={level}
                          type="button"
                          className={`workspace-chip${activeLevel === level ? ' workspace-chip--active' : ''}`}
                          onClick={() => setCommodityPriceLevel(entry.commodityId, level)}
                          title={formatCommodityPrice(entry.priceDriver.levels[level])}
                        >
                          {renderWorkspaceChipLabel(formatCommodityPrice(entry.priceDriver.levels[level]))}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>,
          )}

          {renderSection(
            'emissionsPrice',
            'Emissions / carbon price',
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
            </div>,
          )}
        </>
      )}

      {activeTab === 'configs' && (
        <>
          {renderBaseComparisonControls()}
          {renderSection(
            'configurations',
            'Save / load configs',
            <>
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

              {renderConfigurationGroup('User configs', userConfigs)}
              {renderConfigurationGroup('Built-in configs', builtinConfigs)}
            </>,
          )}
        </>
      )}

      {activeTab === 'settings' && (
        <>
          {renderSection(
            'options',
            'Solver caps',
            <>
              <div className="workspace-subsector-group">
                <div className="workspace-subsector-title">Respect max-share caps</div>
                <div className="workspace-subsector-detail">
                  Keeps route max-share limits active in the solve and in the route cap view.
                  The cap denominator is always the set of active routes.
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
              <div className="workspace-subsector-group">
                <div className="workspace-subsector-title">Respect max-activity caps</div>
                <div className="workspace-chip-group workspace-chip-group--inline">
                  <button
                    type="button"
                    className={`workspace-chip${respectMaxActivity ? ' workspace-chip--active' : ''}`}
                    onClick={() => setRespectMaxActivity(true)}
                  >
                    {renderWorkspaceChipLabel('On')}
                  </button>
                  <button
                    type="button"
                    className={`workspace-chip${respectMaxActivity ? '' : ' workspace-chip--active'}`}
                    onClick={() => setRespectMaxActivity(false)}
                  >
                    {renderWorkspaceChipLabel('Off')}
                  </button>
                </div>
              </div>
            </>,
          )}

          {residualOverlays2025.length > 0 ? renderSection(
            'overlays',
            'Residual display mode',
            <div className="workspace-chip-group workspace-chip-group--inline workspace-chip-group--mode-toggle">
              {([
                'aggregated_non_sink',
                'individual',
              ] as ResidualOverlayDisplayMode[]).map((mode) => {
                const selected = residualOverlayDisplayMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={selected}
                    className={`workspace-chip${selected ? ' workspace-chip--active' : ' workspace-chip--toggle-off'}`}
                    onClick={() => setResidualOverlayDisplayMode(mode)}
                  >
                    {renderWorkspaceChipLabel(mode === 'aggregated_non_sink' ? 'Aggregated' : 'Individual')}
                  </button>
                );
              })}
            </div>,
          ) : null}
        </>
      )}
    </>
  );
}

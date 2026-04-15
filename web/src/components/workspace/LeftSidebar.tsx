import { useMemo, useState, useCallback, type ReactNode } from 'react';
import { usePackageStore } from '../../data/packageStore';
import { getActiveDemandPreset, getCommodityPriceLevel, getActiveCarbonPricePreset } from '../../data/configurationWorkspaceModel';
import {
  AGGREGATED_RESIDUAL_OVERLAY_LABEL,
  getResidualOverlayDisplayMode,
  isAggregatableResidualOverlay,
} from '../../data/residualOverlayPresentation.ts';
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
  ResidualOverlayDomain,
  ResidualOverlayRow,
} from '../../data/types';
import {
  formatControlModeLabel,
  getCommodityPriceSelectorPresentation,
} from './leftSidebarCommodityStatus';
import { getConfigurationSaveActionState } from './leftSidebarSaveActions';
import { formatWorkspacePillLabel } from './workspacePillLabel';

type LeftSidebarSectionKey =
  | 'options'
  | 'demandGrowth'
  | 'commodityControls'
  | 'emissionsPrice'
  | 'overlays'
  | 'configurations';

type LeftSidebarSectionState = Record<LeftSidebarSectionKey, boolean>;

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

interface OverlayCatalogEntry {
  overlayId: string;
  overlayLabel: string;
  overlayDomain: ResidualOverlayDomain;
  officialAccountingBucket: string;
  commodityCount: number;
  totalEnergyPJ: number;
  totalEmissionsMt: number;
  totalCostM: number;
  defaultInclude: boolean;
}

const DOMAIN_GROUP_ORDER: Record<ResidualOverlayDomain, number> = {
  energy_residual: 0,
  nonenergy_residual: 1,
  net_sink: 2,
};

const DOMAIN_LABELS: Record<ResidualOverlayDomain, string> = {
  energy_residual: 'Energy residuals',
  nonenergy_residual: 'Non-energy residuals',
  net_sink: 'Net sinks',
};

function deriveOverlayCatalog(rows: ResidualOverlayRow[]): OverlayCatalogEntry[] {
  const byId = new Map<string, OverlayCatalogEntry>();
  for (const row of rows) {
    let entry = byId.get(row.overlay_id);
    if (!entry) {
      entry = {
        overlayId: row.overlay_id,
        overlayLabel: row.overlay_label,
        overlayDomain: row.overlay_domain,
        officialAccountingBucket: row.official_accounting_bucket,
        commodityCount: 0,
        totalEnergyPJ: 0,
        totalEmissionsMt: 0,
        totalCostM: 0,
        defaultInclude: row.default_include,
      };
      byId.set(row.overlay_id, entry);
    }
    entry.commodityCount += 1;
    entry.totalEnergyPJ += row.final_energy_pj_2025 ?? 0;
    entry.totalEmissionsMt += (row.direct_energy_emissions_mtco2e_2025 ?? 0) + (row.other_emissions_mtco2e_2025 ?? 0);
    entry.totalCostM += row.default_total_cost_ex_carbon_audm_2024 ?? 0;
    if (!row.default_include) entry.defaultInclude = false;
  }
  return Array.from(byId.values()).sort((a, b) =>
    DOMAIN_GROUP_ORDER[a.overlayDomain] - DOMAIN_GROUP_ORDER[b.overlayDomain]
    || a.overlayLabel.localeCompare(b.overlayLabel),
  );
}

function formatOverlayDetail(entry: OverlayCatalogEntry): string {
  if (entry.overlayDomain === 'energy_residual') {
    return `${entry.commodityCount} commodity rows`;
  }
  return 'Emissions only';
}

function formatOverlayPreviewTotals(totalEnergyPJ: number, totalEmissionsMt: number): string {
  const parts: string[] = [];
  if (totalEnergyPJ !== 0) {
    parts.push(`${Math.abs(totalEnergyPJ).toFixed(1)} PJ`);
  }
  if (totalEmissionsMt !== 0) {
    parts.push(`${totalEmissionsMt.toFixed(1)} MtCO₂e`);
  }
  return parts.length > 0 ? parts.join(', ') : '—';
}

function formatOverlayAnchorPreview(entry: OverlayCatalogEntry): string {
  return formatOverlayPreviewTotals(entry.totalEnergyPJ, entry.totalEmissionsMt);
}

function summarizeOverlayEntries(entries: OverlayCatalogEntry[]): {
  count: number;
  totalEnergyPJ: number;
  totalEmissionsMt: number;
} {
  return entries.reduce(
    (summary, entry) => ({
      count: summary.count + 1,
      totalEnergyPJ: summary.totalEnergyPJ + entry.totalEnergyPJ,
      totalEmissionsMt: summary.totalEmissionsMt + entry.totalEmissionsMt,
    }),
    {
      count: 0,
      totalEnergyPJ: 0,
      totalEmissionsMt: 0,
    },
  );
}

function formatComponentCountLabel(enabledCount: number, totalCount: number): string {
  const noun = enabledCount === 1 ? 'component' : 'components';
  return enabledCount === totalCount
    ? `${enabledCount} ${noun} enabled`
    : `${enabledCount}/${totalCount} ${noun} enabled`;
}

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

interface LeftSidebarProps {
  initialExpandedSections?: Partial<LeftSidebarSectionState>;
}

export default function LeftSidebar({ initialExpandedSections }: LeftSidebarProps = {}) {
  const appConfig = usePackageStore((s) => s.appConfig);
  const sectorStates = usePackageStore((s) => s.sectorStates);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);
  const setDemandPreset = usePackageStore((s) => s.setDemandPreset);
  const setCommodityPriceLevel = usePackageStore((s) => s.setCommodityPriceLevel);
  const setCarbonPricePreset = usePackageStore((s) => s.setCarbonPricePreset);
  const setRespectMaxShare = usePackageStore((s) => s.setRespectMaxShare);
  const setOutputControlMode = usePackageStore((s) => s.setOutputControlMode);
  const residualOverlays2025 = usePackageStore((s) => s.residualOverlays2025);
  const setResidualOverlayIncluded = usePackageStore((s) => s.setResidualOverlayIncluded);
  const setAllResidualOverlaysIncluded = usePackageStore((s) => s.setAllResidualOverlaysIncluded);
  const setResidualOverlayDisplayMode = usePackageStore((s) => s.setResidualOverlayDisplayMode);
  const loadConfiguration = usePackageStore((s) => s.loadConfiguration);
  const activeConfigurationId = usePackageStore((s) => s.activeConfigurationId);
  const activeConfigurationReadonly = usePackageStore((s) => s.activeConfigurationReadonly);
  const isConfigurationDirty = usePackageStore((s) => s.isConfigurationDirty);
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

  const overlayCatalog = useMemo(() => deriveOverlayCatalog(residualOverlays2025), [residualOverlays2025]);
  const overlayControls = currentConfiguration.residual_overlays?.controls_by_overlay_id ?? {};
  const residualOverlayDisplayMode = getResidualOverlayDisplayMode(currentConfiguration);
  const nonSinkOverlayEntries = useMemo(
    () => overlayCatalog.filter((entry) => isAggregatableResidualOverlay(entry.overlayDomain)),
    [overlayCatalog],
  );
  const netSinkOverlayEntries = useMemo(
    () => overlayCatalog.filter((entry) => !isAggregatableResidualOverlay(entry.overlayDomain)),
    [overlayCatalog],
  );
  const enabledNonSinkEntries = useMemo(
    () => nonSinkOverlayEntries.filter((entry) => overlayControls[entry.overlayId]?.included ?? entry.defaultInclude),
    [nonSinkOverlayEntries, overlayControls],
  );
  const enabledNonSinkSummary = useMemo(
    () => summarizeOverlayEntries(enabledNonSinkEntries),
    [enabledNonSinkEntries],
  );

  const builtinConfigs = useMemo(() => loadBuiltinConfigurations(), []);
  const [userConfigs, setUserConfigs] = useState(() => loadUserConfigurations());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<LeftSidebarSectionState>({
    options: false,
    demandGrowth: false,
    commodityControls: false,
    emissionsPrice: true,
    overlays: false,
    configurations: true,
    ...initialExpandedSections,
  });

  const refreshUserConfigs = useCallback(async () => {
    const configs = await fetchUserConfigurations();
    setUserConfigs(configs);
  }, []);
  const toggleSection = useCallback((section: LeftSidebarSectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }, []);

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
      {renderSection(
        'options',
        'Options',
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
        </div>,
      )}

      {renderSection(
        'demandGrowth',
        'Demand Growth',
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
        'Commodity Controls',
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
        'Emissions Price',
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

      {renderSection(
        'overlays',
        'Overlays',
        <>
          <div className="workspace-subsector-detail">
            Overlay trajectories follow the active demand-growth preset. Commodity shares within each overlay remain fixed at 2025 proportions.
          </div>
          {nonSinkOverlayEntries.length > 0 && (
            <div className="workspace-sector-group">
              <div className="workspace-sector-title">{AGGREGATED_RESIDUAL_OVERLAY_LABEL}</div>
              <div className="workspace-subsector-detail">
                {formatComponentCountLabel(enabledNonSinkSummary.count, nonSinkOverlayEntries.length)}
                {' · '}
                {formatOverlayPreviewTotals(
                  enabledNonSinkSummary.totalEnergyPJ,
                  enabledNonSinkSummary.totalEmissionsMt,
                )}
              </div>
              <div className="workspace-chip-group workspace-chip-group--inline">
                {([
                  'aggregated_non_sink',
                  'individual',
                ] as ResidualOverlayDisplayMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`workspace-chip${residualOverlayDisplayMode === mode ? ' workspace-chip--active' : ''}`}
                    onClick={() => setResidualOverlayDisplayMode(mode)}
                  >
                    {renderWorkspaceChipLabel(mode === 'aggregated_non_sink' ? 'Aggregated' : 'Individual')}
                  </button>
                ))}
              </div>
              <div className="workspace-chip-group workspace-chip-group--inline">
                <button
                  type="button"
                  className="workspace-chip"
                  onClick={() => setAllResidualOverlaysIncluded(true)}
                >
                  {renderWorkspaceChipLabel('All on')}
                </button>
                <button
                  type="button"
                  className="workspace-chip"
                  onClick={() => setAllResidualOverlaysIncluded(false)}
                >
                  {renderWorkspaceChipLabel('All off')}
                </button>
              </div>
              {nonSinkOverlayEntries.map((entry) => {
                const included = overlayControls[entry.overlayId]?.included ?? entry.defaultInclude;
                return (
                  <div key={entry.overlayId} className="workspace-subsector-group">
                    <div className="workspace-subsector-title">{entry.overlayLabel}</div>
                    <div className="workspace-subsector-detail">
                      {DOMAIN_LABELS[entry.overlayDomain]} · {formatOverlayDetail(entry)} · {formatOverlayAnchorPreview(entry)}
                    </div>
                    <div className="workspace-chip-group workspace-chip-group--inline">
                      <button
                        type="button"
                        className={`workspace-chip${included ? ' workspace-chip--active' : ''}`}
                        onClick={() => setResidualOverlayIncluded(entry.overlayId, true)}
                      >
                        {renderWorkspaceChipLabel('On')}
                      </button>
                      <button
                        type="button"
                        className={`workspace-chip${included ? '' : ' workspace-chip--active'}`}
                        onClick={() => setResidualOverlayIncluded(entry.overlayId, false)}
                      >
                        {renderWorkspaceChipLabel('Off')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {netSinkOverlayEntries.length > 0 && (
            <div className="workspace-sector-group">
              <div className="workspace-sector-title">{DOMAIN_LABELS.net_sink}</div>
              {netSinkOverlayEntries.map((entry) => {
                const included = overlayControls[entry.overlayId]?.included ?? entry.defaultInclude;
                return (
                  <div key={entry.overlayId} className="workspace-subsector-group">
                    <div className="workspace-subsector-title">{entry.overlayLabel}</div>
                    <div className="workspace-subsector-detail">
                      {formatOverlayDetail(entry)} · {formatOverlayAnchorPreview(entry)}
                    </div>
                    <div className="workspace-chip-group workspace-chip-group--inline">
                      <button
                        type="button"
                        className={`workspace-chip${included ? ' workspace-chip--active' : ''}`}
                        onClick={() => setResidualOverlayIncluded(entry.overlayId, true)}
                      >
                        {renderWorkspaceChipLabel('On')}
                      </button>
                      <button
                        type="button"
                        className={`workspace-chip${included ? '' : ' workspace-chip--active'}`}
                        onClick={() => setResidualOverlayIncluded(entry.overlayId, false)}
                      >
                        {renderWorkspaceChipLabel('Off')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>,
      )}

      {renderSection(
        'configurations',
        'Configurations',
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

          {renderConfigurationGroup('User configurations', userConfigs)}
          {renderConfigurationGroup('Built-in configurations', builtinConfigs)}
        </>,
      )}
    </>
  );
}

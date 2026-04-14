import React, { useEffect, useMemo, useState } from 'react';
import HorizontalDeltaBarChart from '../components/charts/HorizontalDeltaBarChart.tsx';
import { usePackageStore } from '../data/packageStore.ts';
import {
  fetchUserConfigurations,
  getConfigurationId,
  loadBuiltinConfigurations,
  loadUserConfigurations,
} from '../data/configurationLoader.ts';
import { PRICE_LEVELS, type ConfigurationDocument, type PriceLevel } from '../data/types.ts';
import {
  seedAdditionalityCommoditySelections,
  type AdditionalityAnalysisState,
} from '../additionality/additionalityAnalysis.ts';
import { useAdditionalityAnalysis } from '../hooks/useAdditionalityAnalysis.ts';
import { selectInitialAdditionalityPair } from './additionalityPageModel.ts';

void React;

const compactNumberFormatter = new Intl.NumberFormat('en-AU', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
});

interface AdditionalityConfigurationOption {
  description?: string;
  id: string;
  label: string;
}

export interface AdditionalityPageViewProps {
  analysisState: AdditionalityAnalysisState;
  baseConfigId: string | null;
  commodityOptions: Array<{ id: string; label: string }>;
  commoditySelections: Record<string, PriceLevel>;
  configurations: AdditionalityConfigurationOption[];
  onBaseConfigChange: (configId: string) => void;
  onCommoditySelectionChange: (commodityId: string, level: PriceLevel) => void;
  onTargetConfigChange: (configId: string) => void;
  targetConfigId: string | null;
}

function dedupeConfigurations(configurations: ConfigurationDocument[]): ConfigurationDocument[] {
  const deduped = new Map<string, ConfigurationDocument>();

  for (const configuration of configurations) {
    const id = getConfigurationId(configuration) ?? configuration.name;
    deduped.set(id, configuration);
  }

  return Array.from(deduped.values())
    .sort((left, right) => left.name.localeCompare(right.name));
}

function formatObjective(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }

  return compactNumberFormatter.format(value);
}

function formatDetailedObjective(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }

  return numberFormatter.format(value);
}

function formatSignedDelta(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${numberFormatter.format(value)}`;
}

function formatAction(action: 'enable' | 'disable'): string {
  return action === 'enable' ? 'Enable' : 'Disable';
}

function buildOrderedStepLabel(
  atom: {
    outputLabel: string;
    action: 'enable' | 'disable';
    stateLabel: string;
  },
): string {
  return `${atom.outputLabel}: ${formatAction(atom.action)} ${atom.stateLabel}`;
}

function buildStatusLine(analysisState: AdditionalityAnalysisState): string {
  switch (analysisState.phase) {
    case 'idle':
      return 'Choose two saved configurations to run the additionality sequence.';
    case 'loading':
      return `Running additionality analysis: ${analysisState.progress.completed}/${analysisState.progress.totalExpected} evaluations completed.`;
    case 'validation':
      return `${analysisState.validationIssues.length} unsupported differences block this pair.`;
    case 'empty':
      return 'No pathway state toggles differ between the selected configurations.';
    case 'partial':
      return analysisState.error
        ?? 'Analysis stopped early because the remaining candidate solves failed.';
    case 'error':
      return analysisState.error ?? 'Additionality analysis failed.';
    case 'success':
      return analysisState.report
        ? `Analysis complete: ${analysisState.report.solveCount}/${analysisState.progress.totalExpected} evaluations completed.`
        : 'Analysis complete.';
    default:
      return '';
  }
}

function buildPriceSummary(
  commodityOptions: AdditionalityPageViewProps['commodityOptions'],
  commoditySelections: Record<string, PriceLevel>,
): string {
  return commodityOptions
    .map((commodity) => `${commodity.label}: ${commoditySelections[commodity.id] ?? 'medium'}`)
    .join(' | ');
}

export function AdditionalityPageView({
  analysisState,
  baseConfigId,
  commodityOptions,
  commoditySelections,
  configurations,
  onBaseConfigChange,
  onCommoditySelectionChange,
  onTargetConfigChange,
  targetConfigId,
}: AdditionalityPageViewProps) {
  const report = analysisState.report;
  const statusLine = buildStatusLine(analysisState);
  const priceSummary = buildPriceSummary(commodityOptions, commoditySelections);
  const orderedLabels = report?.sequence.map((entry) => buildOrderedStepLabel(entry.atom)) ?? [];
  const orderedStepItems = report?.sequence.map((entry, index) => ({
    key: entry.atom.key,
    label: orderedLabels[index] ?? '',
    step: entry.step,
  })) ?? [];
  const sharedChartHeight = report
    ? Math.max(320, report.sequence.length * 24 + 96)
    : 320;
  const objectiveChartData = report?.sequence.map((entry, index) => ({
    key: `${entry.atom.key}:objective`,
    label: orderedLabels[index] ?? '',
    value: entry.metricsDeltaFromCurrent.objective,
  })) ?? [];
  const emissionsChartData = report?.sequence.map((entry, index) => ({
    key: `${entry.atom.key}:emissions`,
    label: orderedLabels[index] ?? '',
    value: entry.metricsDeltaFromCurrent.cumulativeEmissions,
  })) ?? [];
  const electricityChartData = report?.sequence.map((entry, index) => ({
    key: `${entry.atom.key}:electricity`,
    label: orderedLabels[index] ?? '',
    value: entry.metricsDeltaFromCurrent.electricityDemand2050,
  })) ?? [];

  return (
    <div className="page page--additionality">
      <h1>Additionality</h1>
      <p>
        Compare two saved configurations, hold commodity prices constant as a page-local
        sensitivity, and rank pathway state toggles by their greedy marginal effect on the
        solve objective.
      </p>

      <section className="configuration-panel configuration-panel--hero">
        <span className="configuration-badge">State-toggle tornado</span>
        <div className="configuration-form-grid">
          <label className="configuration-field">
            <span>Base configuration</span>
            <select
              className="configuration-input"
              value={baseConfigId ?? ''}
              onChange={(event) => onBaseConfigChange(event.target.value)}
            >
              {configurations.map((configuration) => (
                <option key={configuration.id} value={configuration.id}>
                  {configuration.label}
                </option>
              ))}
            </select>
          </label>

          <label className="configuration-field">
            <span>Target configuration</span>
            <select
              className="configuration-input"
              value={targetConfigId ?? ''}
              onChange={(event) => onTargetConfigChange(event.target.value)}
            >
              {configurations.map((configuration) => (
                <option key={configuration.id} value={configuration.id}>
                  {configuration.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="additionality-price-grid">
          {commodityOptions.map((commodity) => (
            <div key={commodity.id} className="additionality-price-row">
              <div className="additionality-price-label">{commodity.label}</div>
              <div className="additionality-price-levels" role="group" aria-label={`${commodity.label} price level`}>
                {PRICE_LEVELS.map((level) => {
                  const isActive = (commoditySelections[commodity.id] ?? 'medium') === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      className={`additionality-price-pill${isActive ? ' additionality-price-pill--active' : ''}`}
                      onClick={() => onCommoditySelectionChange(commodity.id, level)}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="additionality-price-summary">Price scenario: {priceSummary}</p>
        <p className="additionality-status-line">{statusLine}</p>
      </section>

      {analysisState.phase === 'validation' ? (
        <section className="configuration-panel">
          <h2>Unsupported pair</h2>
          <ul className="additionality-issue-list">
            {analysisState.validationIssues.map((issue) => (
              <li key={`${issue.code}:${issue.outputId ?? 'global'}`}>{issue.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {analysisState.phase === 'error' ? (
        <section className="configuration-panel">
          <h2>Analysis blocked</h2>
          <p>{analysisState.error}</p>
        </section>
      ) : null}

      {analysisState.phase === 'empty' ? (
        <section className="configuration-panel">
          <h2>No state deltas</h2>
          <p>
            The selected configurations pass validation, but they do not differ on any active
            pathway states under the v1 contract.
          </p>
        </section>
      ) : null}

      {report ? (
        <>
          <section className="additionality-summary-grid">
            <article className="configuration-panel additionality-summary-card">
              <h2>Base objective</h2>
              <strong>{formatObjective(report.baseMetrics.objective)}</strong>
            </article>
            <article className="configuration-panel additionality-summary-card">
              <h2>Target objective</h2>
              <strong>{formatObjective(report.targetMetrics.objective)}</strong>
            </article>
            <article className="configuration-panel additionality-summary-card">
              <h2>Total delta</h2>
              <strong>{formatSignedDelta(report.totalObjectiveDelta)}</strong>
            </article>
            <article className="configuration-panel additionality-summary-card">
              <h2>Atoms</h2>
              <strong>{report.atomCount}</strong>
            </article>
            <article className="configuration-panel additionality-summary-card">
              <h2>Completed solves</h2>
              <strong>{report.solveCount}</strong>
            </article>
          </section>

          {analysisState.phase === 'partial' ? (
            <section className="configuration-panel">
              <h2>Partial analysis</h2>
              <p>{analysisState.error}</p>
            </section>
          ) : null}

          <section>
            <p className="additionality-status-line">
              Steps are ordered by greedy objective delta; the companion charts reuse that order for other metrics.
            </p>
            <div className="additionality-chart-layout">
              <aside className="additionality-step-list-shell" aria-label="Greedy ordered steps">
                <ol
                  className="additionality-step-list"
                  style={{ height: `${sharedChartHeight}px` }}
                >
                  {orderedStepItems.map((item) => (
                    <li
                      key={`${item.key}:step-list`}
                      className="additionality-step-list-item"
                      title={`${item.step}. ${item.label}`}
                    >
                      <span className="additionality-step-list-index">{item.step}.</span>
                      <span className="additionality-step-list-text">{item.label}</span>
                    </li>
                  ))}
                </ol>
              </aside>

              <div className="additionality-chart-grid">
                <article className="configuration-panel">
                  <HorizontalDeltaBarChart
                    title="Objective delta"
                    valueFormatter={(value) => formatSignedDelta(value)}
                    data={objectiveChartData}
                    height={sharedChartHeight}
                    positiveLegendLabel="Increase objective"
                    negativeLegendLabel="Decrease objective"
                    showCategoryAxis={false}
                  />
                </article>
                <article className="configuration-panel">
                  <HorizontalDeltaBarChart
                    title="Cumulative emissions delta"
                    valueFormatter={(value) => formatSignedDelta(value)}
                    data={emissionsChartData}
                    height={sharedChartHeight}
                    positiveLegendLabel="Increase emissions"
                    negativeLegendLabel="Decrease emissions"
                    showCategoryAxis={false}
                  />
                </article>
                <article className="configuration-panel">
                  <HorizontalDeltaBarChart
                    title="2050 electricity demand delta"
                    valueFormatter={(value) => formatSignedDelta(value)}
                    data={electricityChartData}
                    height={sharedChartHeight}
                    positiveLegendLabel="Increase electricity demand"
                    negativeLegendLabel="Decrease electricity demand"
                    showCategoryAxis={false}
                  />
                </article>
              </div>
            </div>
          </section>

          <section className="configuration-panel">
            <h2>Ordered steps</h2>
            <div className="additionality-table-shell">
              <table className="additionality-table">
                <thead>
                  <tr>
                    <th scope="col">Step</th>
                    <th scope="col">Output</th>
                    <th scope="col">State</th>
                    <th scope="col">Action</th>
                    <th scope="col">Signed delta</th>
                    <th scope="col">Objective before</th>
                    <th scope="col">Objective after</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sequence.map((entry) => (
                    <tr key={entry.atom.key}>
                      <td>{entry.step}</td>
                      <td>{entry.atom.outputLabel}</td>
                      <td>{entry.atom.stateLabel}</td>
                      <td>{formatAction(entry.atom.action)}</td>
                      <td>{formatSignedDelta(entry.metricsDeltaFromCurrent.objective)}</td>
                      <td>{formatDetailedObjective(entry.metricsBefore.objective)}</td>
                      <td>{formatDetailedObjective(entry.metricsAfter.objective)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {report.skippedCandidates.length > 0 ? (
              <p className="additionality-skipped-note">
                Skipped candidates: {report.skippedCandidates.length}
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default function AdditionalityPage() {
  const appConfig = usePackageStore((state) => state.appConfig);
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const builtinConfigurations = useMemo(() => loadBuiltinConfigurations(), []);
  const [userConfigurations, setUserConfigurations] = useState(() => loadUserConfigurations());
  const availableConfigurations = useMemo(
    () => dedupeConfigurations([...builtinConfigurations, ...userConfigurations]),
    [builtinConfigurations, userConfigurations],
  );
  const initialPair = useMemo(
    () => selectInitialAdditionalityPair(availableConfigurations),
    [availableConfigurations],
  );
  const availableConfigurationIds = useMemo(
    () => new Set(
      availableConfigurations
        .map((configuration) => getConfigurationId(configuration))
        .filter((id): id is string => id != null),
    ),
    [availableConfigurations],
  );
  const [selectedBaseConfigId, setSelectedBaseConfigId] = useState<string | null>(null);
  const [selectedTargetConfigId, setSelectedTargetConfigId] = useState<string | null>(null);

  useEffect(() => {
    void fetchUserConfigurations().then((configs) => {
      setUserConfigurations(configs);
    });
  }, []);
  const baseConfigId = selectedBaseConfigId && availableConfigurationIds.has(selectedBaseConfigId)
    ? selectedBaseConfigId
    : initialPair.baseConfigId;
  const targetConfigId = selectedTargetConfigId && availableConfigurationIds.has(selectedTargetConfigId)
    ? selectedTargetConfigId
    : initialPair.targetConfigId;

  const configurationsById = useMemo(
    () => Object.fromEntries(
      availableConfigurations.map((configuration) => [
        getConfigurationId(configuration) ?? configuration.name,
        configuration,
      ]),
    ),
    [availableConfigurations],
  );
  const baseConfiguration = baseConfigId ? configurationsById[baseConfigId] ?? null : null;
  const targetConfiguration = targetConfigId ? configurationsById[targetConfigId] ?? null : null;
  const commodityOptions = useMemo(
    () => Object.entries(appConfig.commodity_price_presets)
      .map(([id, driver]) => ({ id, label: driver.label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [appConfig],
  );
  const [commoditySelectionState, setCommoditySelectionState] = useState<{
    seededFromConfigId: string | null;
    selections: Record<string, PriceLevel>;
  }>({
    seededFromConfigId: null,
    selections: {},
  });
  const seededCommoditySelections = useMemo(
    () => baseConfiguration
      ? seedAdditionalityCommoditySelections(
          baseConfiguration,
          commodityOptions.map((commodity) => commodity.id),
        )
      : {},
    [baseConfiguration, commodityOptions],
  );
  const commoditySelections = commoditySelectionState.seededFromConfigId === baseConfigId
    ? commoditySelectionState.selections
    : seededCommoditySelections;

  const pkg = useMemo(
    () => ({ appConfig, sectorStates }),
    [appConfig, sectorStates],
  );
  const analysisState = useAdditionalityAnalysis({
    baseConfiguration,
    baseConfigId,
    commoditySelections,
    pkg,
    targetConfiguration,
    targetConfigId,
  });

  return (
    <AdditionalityPageView
      analysisState={analysisState}
      baseConfigId={baseConfigId}
      commodityOptions={commodityOptions}
      commoditySelections={commoditySelections}
      configurations={availableConfigurations.map((configuration) => ({
        id: getConfigurationId(configuration) ?? configuration.name,
        label: configuration.name,
        description: configuration.description,
      }))}
      onBaseConfigChange={setSelectedBaseConfigId}
      onCommoditySelectionChange={(commodityId, level) => {
        setCommoditySelectionState({
          seededFromConfigId: baseConfigId,
          selections: {
            ...commoditySelections,
            [commodityId]: level,
          },
        });
      }}
      onTargetConfigChange={setSelectedTargetConfigId}
      targetConfigId={targetConfigId}
    />
  );
}

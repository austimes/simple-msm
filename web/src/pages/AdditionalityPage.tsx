import React, { useMemo, useState } from 'react';
import HorizontalWaterfallChart from '../components/charts/HorizontalWaterfallChart.tsx';
import { useAppUiStore } from '../data/appUiStore.ts';
import { usePackageStore } from '../data/packageStore.ts';
import { getConfigurationId } from '../data/configurationLoader.ts';
import { selectInitialSavedPair } from '../data/configurationPairModel.ts';
import { PRICE_LEVELS, type ConfigurationDocument, type PriceLevel } from '../data/types.ts';
import {
  ADDITIONALITY_SHAPLEY_SAMPLE_COUNTS,
  DEFAULT_ADDITIONALITY_METHOD,
  DEFAULT_ADDITIONALITY_SHAPLEY_SAMPLE_COUNT,
  seedAdditionalityCommoditySelections,
  type AdditionalityAnalysisState,
  type AdditionalityAtomAction,
  type AdditionalityAtomCategory,
  type AdditionalityAtomKind,
  type AdditionalityOrderingMethod,
} from '../additionality/additionalityAnalysis.ts';
import { useAdditionalityAnalysis } from '../hooks/useAdditionalityAnalysis.ts';
import { useAvailableConfigurations } from '../hooks/useAvailableConfigurations.ts';
import {
  buildAdditionalityReferenceRows,
  buildAdditionalitySavingsStackRows,
  getAdditionalityMetricPresentation,
} from './additionalityPageModel.ts';

void React;

const costMetricPresentation = getAdditionalityMetricPresentation('cost');
const emissionsMetricPresentation = getAdditionalityMetricPresentation('emissions');
const fuelEnergyMetricPresentation = getAdditionalityMetricPresentation('fuelEnergy');
const MAX_FOCUS_SCENARIOS = 3;

interface AdditionalityConfigurationOption {
  description?: string;
  id: string;
  label: string;
}

export interface AdditionalityScenarioViewState {
  analysisState: AdditionalityAnalysisState;
  focusConfigId: string | null;
  focusLabel: string;
  slotIndex: number;
}

export interface AdditionalityPageViewProps {
  baseConfigId: string | null;
  commodityOptions: Array<{ id: string; label: string }>;
  commoditySelections: Record<string, PriceLevel>;
  configurations: AdditionalityConfigurationOption[];
  method: AdditionalityOrderingMethod;
  onBaseConfigChange: (configId: string) => void;
  onCommoditySelectionChange: (commodityId: string, level: PriceLevel) => void;
  onFocusConfigChange: (slotIndex: number, configId: string | null) => void;
  onMethodChange: (method: AdditionalityOrderingMethod) => void;
  onRecalculate: () => void;
  onShapleySampleCountChange: (sampleCount: number) => void;
  recalculateDisabled: boolean;
  scenarios: AdditionalityScenarioViewState[];
  selectedFocusConfigIds: string[];
  shapleySampleCount: number;
}

function formatAction(action: AdditionalityAtomAction): string {
  return action === 'enable' ? 'Enable' : 'Disable';
}

function formatAtomKind(kind: AdditionalityAtomKind): string {
  switch (kind) {
    case 'state':
      return 'State';
    case 'efficiency_package':
      return 'Efficiency package';
    case 'autonomous_efficiency':
      return 'Autonomous efficiency';
    default:
      return kind;
  }
}

function formatAtomCategory(category: AdditionalityAtomCategory): string {
  switch (category) {
    case 'efficiency':
      return 'Efficiency';
    case 'fuel_switching':
      return 'Fuel switching';
    case 'other_state_change':
      return 'Other state change';
    default:
      return category;
  }
}

function buildOrderedStepLabel(
  atom: {
    outputLabel: string | null;
    label: string;
  },
): string {
  return atom.outputLabel ? `${atom.outputLabel}: ${atom.label}` : atom.label;
}

function buildStatusLine(analysisState: AdditionalityAnalysisState): string {
  switch (analysisState.phase) {
    case 'idle':
      return 'Choose saved configurations to run scenario savings attribution.';
    case 'loading':
      return `Running attribution: ${analysisState.progress.completed}/${analysisState.progress.totalExpected} evaluations completed.`;
    case 'validation':
      return `${analysisState.validationIssues.length} unsupported differences block this pair.`;
    case 'empty':
      return 'No attributable state, efficiency package, or autonomous efficiency differences were found.';
    case 'partial':
      return analysisState.error
        ?? 'Analysis stopped early because the remaining candidate solves failed.';
    case 'error':
      return analysisState.error ?? 'Additionality analysis failed.';
    case 'success':
      return analysisState.report
        ? `Analysis complete: ${analysisState.report.solveCount} solves completed.`
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

function buildMethodSummary(analysisState: AdditionalityAnalysisState): string {
  const metadata = analysisState.report?.methodMetadata;
  if (!metadata) {
    return '';
  }

  if (metadata.method === 'shapley_permutation_sample') {
    return `Shapley permutations: ${metadata.completedPermutations ?? 0}/${metadata.requestedPermutations ?? 0} completed; ${metadata.skippedPermutations ?? 0} skipped; ${metadata.solveCount} solves.`;
  }

  return `Reverse-greedy target-context ordering; ${metadata.solveCount} solves.`;
}

function AdditionalityScenarioPanel({
  scenario,
}: {
  scenario: AdditionalityScenarioViewState;
}) {
  const report = scenario.analysisState.report;
  const statusLine = buildStatusLine(scenario.analysisState);
  const orderedLabels = report?.sequence.map((entry) => buildOrderedStepLabel(entry.atom)) ?? [];
  const referenceWaterfallData = report
    ? buildAdditionalityReferenceRows(report.sequence, orderedLabels)
    : [];
  const costStackData = report
    ? buildAdditionalitySavingsStackRows(report, costMetricPresentation.metric, orderedLabels)
    : [];
  const emissionsStackData = report
    ? buildAdditionalitySavingsStackRows(report, emissionsMetricPresentation.metric, orderedLabels)
    : [];
  const fuelEnergyStackData = report
    ? buildAdditionalitySavingsStackRows(report, fuelEnergyMetricPresentation.metric, orderedLabels)
    : [];
  const reportInteractionScope = report
    ? [
        report.baseConfigId,
        report.targetConfigId,
        report.orderingMethod,
        report.methodMetadata.sampleCount ?? '',
        report.solveCount,
        report.totalDelta.cost,
        report.sequence
          .map((entry) => [
            entry.atom.key,
            entry.metricsDeltaFromCurrent.cost,
            entry.metricsDeltaFromCurrent.emissions,
            entry.metricsDeltaFromCurrent.fuelEnergy,
          ].join(':'))
          .join('|'),
      ].join('::')
    : '';
  const [interactionState, setInteractionState] = useState<{
    interactionKey: string | null;
    scope: string;
  }>({
    interactionKey: null,
    scope: '',
  });
  const activeInteractionKey = interactionState.scope === reportInteractionScope
    ? interactionState.interactionKey
    : null;
  const sharedChartHeight = report
    ? Math.max(180, report.sequence.length * 12 + 48)
    : 180;
  const methodSummary = buildMethodSummary(scenario.analysisState);

  return (
    <section className="additionality-scenario-card configuration-panel">
      <div className="additionality-scenario-heading">
        <div>
          <span className="configuration-badge">Focus {scenario.slotIndex + 1}</span>
          <h2>{scenario.focusLabel}</h2>
        </div>
        <p className="additionality-status-line">{statusLine}</p>
      </div>

      {scenario.analysisState.phase === 'validation' ? (
        <div className="additionality-inline-panel">
          <h3>Unsupported pair</h3>
          <ul className="additionality-issue-list">
            {scenario.analysisState.validationIssues.map((issue) => (
              <li key={`${issue.code}:${issue.outputId ?? 'global'}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {scenario.analysisState.phase === 'error' ? (
        <div className="additionality-inline-panel">
          <h3>Analysis blocked</h3>
          <p>{scenario.analysisState.error}</p>
        </div>
      ) : null}

      {scenario.analysisState.phase === 'empty' ? (
        <div className="additionality-inline-panel">
          <h3>No attributable differences</h3>
          <p>
            The selected pair passes validation, but no supported state,
            efficiency-package, or autonomous-efficiency atoms differ.
          </p>
        </div>
      ) : null}

      {report ? (
        <>
          <div className="additionality-summary-grid additionality-summary-grid--scenario">
            <article className="additionality-summary-card">
              <h3>Base total</h3>
              <strong>{costMetricPresentation.formatAbsoluteValue(report.baseMetrics.cost)}</strong>
            </article>
            <article className="additionality-summary-card">
              <h3>Focus total</h3>
              <strong>{costMetricPresentation.formatAbsoluteValue(report.targetMetrics.cost)}</strong>
            </article>
            <article className="additionality-summary-card">
              <h3>Cost savings</h3>
              <strong>{costMetricPresentation.formatSignedValue(report.baseMetrics.cost - report.targetMetrics.cost)}</strong>
            </article>
            <article className="additionality-summary-card">
              <h3>Atoms</h3>
              <strong>{report.atomCount}</strong>
            </article>
            <article className="additionality-summary-card">
              <h3>Solves</h3>
              <strong>{report.solveCount}</strong>
            </article>
          </div>

          {methodSummary ? (
            <p className="additionality-status-line">{methodSummary}</p>
          ) : null}

          {scenario.analysisState.phase === 'partial' ? (
            <div className="additionality-inline-panel">
              <h3>Partial analysis</h3>
              <p>Analysis could not reconstruct a full base-to-focus ordering because some intermediate solves failed.</p>
            </div>
          ) : null}

          {report.sequenceComplete ? (
            <>
              <p className="additionality-status-line">
                Wedges are shown as Base minus Focus savings from the Focus actual layer back to Base.
                Negative wedges are retained as cost, emissions, or fuel/energy increases.
              </p>
              <div className="additionality-chart-grid">
                <article className="additionality-chart-panel">
                  <HorizontalWaterfallChart
                    title="Attribution atoms reference"
                    data={referenceWaterfallData}
                    height={sharedChartHeight}
                    baseValue={0}
                    targetValue={0}
                    totalDelta={0}
                    activeInteractionKey={activeInteractionKey}
                    onInteractionHover={(interactionKey) => {
                      setInteractionState({
                        interactionKey,
                        scope: reportInteractionScope,
                      });
                    }}
                    pinZeroToLeft={true}
                    showActiveValueLabel={false}
                    showCategoryAxis={true}
                    showHeaderSummary={false}
                    showLegend={false}
                    showXAxisTicks={false}
                  />
                </article>
                <article className="additionality-chart-panel">
                  <HorizontalWaterfallChart
                    title="Cost savings attribution"
                    valueFormatter={costMetricPresentation.formatSignedValue}
                    absoluteValueFormatter={costMetricPresentation.formatAbsoluteValue}
                    data={costStackData}
                    height={sharedChartHeight}
                    baseValue={report.targetMetrics.cost}
                    baseLabel="Focus"
                    targetValue={report.baseMetrics.cost}
                    targetLabel="Base"
                    totalDelta={report.baseMetrics.cost - report.targetMetrics.cost}
                    activeInteractionKey={activeInteractionKey}
                    onInteractionHover={(interactionKey) => {
                      setInteractionState({
                        interactionKey,
                        scope: reportInteractionScope,
                      });
                    }}
                    positiveLegendLabel="Savings"
                    negativeLegendLabel="Increase"
                    showCategoryAxis={false}
                  />
                </article>
                <article className="additionality-chart-panel">
                  <HorizontalWaterfallChart
                    title="Emissions savings attribution"
                    valueFormatter={emissionsMetricPresentation.formatSignedValue}
                    absoluteValueFormatter={emissionsMetricPresentation.formatAbsoluteValue}
                    data={emissionsStackData}
                    height={sharedChartHeight}
                    baseValue={report.targetMetrics.emissions}
                    baseLabel="Focus"
                    targetValue={report.baseMetrics.emissions}
                    targetLabel="Base"
                    totalDelta={report.baseMetrics.emissions - report.targetMetrics.emissions}
                    activeInteractionKey={activeInteractionKey}
                    onInteractionHover={(interactionKey) => {
                      setInteractionState({
                        interactionKey,
                        scope: reportInteractionScope,
                      });
                    }}
                    positiveLegendLabel="Savings"
                    negativeLegendLabel="Increase"
                    showCategoryAxis={false}
                  />
                </article>
                <article className="additionality-chart-panel">
                  <HorizontalWaterfallChart
                    title="Fuel/energy savings attribution"
                    valueFormatter={fuelEnergyMetricPresentation.formatSignedValue}
                    absoluteValueFormatter={fuelEnergyMetricPresentation.formatAbsoluteValue}
                    data={fuelEnergyStackData}
                    height={sharedChartHeight}
                    baseValue={report.targetMetrics.fuelEnergy}
                    baseLabel="Focus"
                    targetValue={report.baseMetrics.fuelEnergy}
                    targetLabel="Base"
                    totalDelta={report.baseMetrics.fuelEnergy - report.targetMetrics.fuelEnergy}
                    activeInteractionKey={activeInteractionKey}
                    onInteractionHover={(interactionKey) => {
                      setInteractionState({
                        interactionKey,
                        scope: reportInteractionScope,
                      });
                    }}
                    positiveLegendLabel="Savings"
                    negativeLegendLabel="Increase"
                    showCategoryAxis={false}
                  />
                </article>
              </div>

              <div className="additionality-table-shell">
                <table className="additionality-table additionality-table--atoms">
                  <thead>
                    <tr>
                      <th scope="col">Atom kind</th>
                      <th scope="col">Category</th>
                      <th scope="col">Action</th>
                      <th scope="col">Output</th>
                      <th scope="col">Label</th>
                      <th scope="col">Cost savings ($B)</th>
                      <th scope="col">Emissions savings (MtCO2e)</th>
                      <th scope="col">Fuel/energy savings (PJ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sequence.map((entry) => (
                      <tr key={entry.atom.key}>
                        <td>{formatAtomKind(entry.atom.kind)}</td>
                        <td>{formatAtomCategory(entry.atom.category)}</td>
                        <td>{formatAction(entry.atom.action)}</td>
                        <td>{entry.atom.outputLabel ?? 'All outputs'}</td>
                        <td>{entry.atom.label}</td>
                        <td>{costMetricPresentation.formatSignedValue(-entry.metricsDeltaFromCurrent.cost)}</td>
                        <td>{emissionsMetricPresentation.formatSignedValue(-entry.metricsDeltaFromCurrent.emissions)}</td>
                        <td>{fuelEnergyMetricPresentation.formatSignedValue(-entry.metricsDeltaFromCurrent.fuelEnergy)}</td>
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
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function AdditionalityPageView({
  baseConfigId,
  commodityOptions,
  commoditySelections,
  configurations,
  method,
  onBaseConfigChange,
  onCommoditySelectionChange,
  onFocusConfigChange,
  onMethodChange,
  onRecalculate,
  onShapleySampleCountChange,
  recalculateDisabled,
  scenarios,
  selectedFocusConfigIds,
  shapleySampleCount,
}: AdditionalityPageViewProps) {
  const priceSummary = buildPriceSummary(commodityOptions, commoditySelections);
  const focusSlotCount = Math.max(1, Math.min(MAX_FOCUS_SCENARIOS, selectedFocusConfigIds.length + 1));
  const focusSlots = Array.from({ length: focusSlotCount }, (_, index) => index);

  return (
    <div className="page page--additionality">
      <h1>Additionality</h1>
      <p>
        Compare a saved Base configuration with up to three saved Focus scenarios, hold
        commodity prices constant as a page-local sensitivity, and attribute cost,
        emissions, and fuel/energy savings to supported UI-level changes.
      </p>

      <section className="configuration-panel configuration-panel--hero">
        <span className="configuration-badge">Scenario savings attribution</span>
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

          {focusSlots.map((slotIndex) => (
            <label key={slotIndex} className="configuration-field">
              <span>Focus scenario {slotIndex + 1}</span>
              <select
                className="configuration-input"
                value={selectedFocusConfigIds[slotIndex] ?? ''}
                onChange={(event) => onFocusConfigChange(slotIndex, event.target.value || null)}
              >
                {slotIndex > 0 ? <option value="">No focus scenario</option> : null}
                {configurations.map((configuration) => (
                  <option key={configuration.id} value={configuration.id}>
                    {configuration.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="additionality-method-row">
          <div className="additionality-method-group" role="group" aria-label="Attribution method">
            <button
              type="button"
              className={`additionality-price-pill${method === 'reverse_greedy_target_context' ? ' additionality-price-pill--active' : ''}`}
              onClick={() => onMethodChange('reverse_greedy_target_context')}
            >
              Reverse greedy
            </button>
            <button
              type="button"
              className={`additionality-price-pill${method === 'shapley_permutation_sample' ? ' additionality-price-pill--active' : ''}`}
              onClick={() => onMethodChange('shapley_permutation_sample')}
            >
              Shapley sample
            </button>
          </div>

          {method === 'shapley_permutation_sample' ? (
            <label className="configuration-field additionality-sample-field">
              <span>Samples</span>
              <select
                className="configuration-input"
                value={shapleySampleCount}
                onChange={(event) => onShapleySampleCountChange(Number(event.target.value))}
              >
                {ADDITIONALITY_SHAPLEY_SAMPLE_COUNTS.map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </label>
          ) : null}
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

        <div className="configuration-action-row">
          <button
            type="button"
            className="configuration-button"
            onClick={onRecalculate}
            disabled={recalculateDisabled}
          >
            {recalculateDisabled ? 'Re-calculating...' : 'Re-calculate'}
          </button>
        </div>

        <p className="additionality-price-summary">Price scenario: {priceSummary}</p>
        <p className="additionality-status-line">
          {method === 'shapley_permutation_sample'
            ? 'Sampled Shapley averages deterministic prefix marginals across seeded permutations.'
            : 'Reverse greedy removes the least-impact remaining atom from Focus, then presents the path Base to Focus.'}
        </p>
      </section>

      <div className="additionality-scenario-grid">
        {scenarios.map((scenario) => (
          <AdditionalityScenarioPanel
            key={`${scenario.slotIndex}:${scenario.focusConfigId ?? 'empty'}`}
            scenario={scenario}
          />
        ))}
      </div>
    </div>
  );
}

function resolveBaseConfigId(
  configurations: ConfigurationDocument[],
  configurationsById: Record<string, ConfigurationDocument>,
  selectedBaseConfigId: string | null,
): string | null {
  const initialPair = selectInitialSavedPair(configurations);
  return selectedBaseConfigId && configurationsById[selectedBaseConfigId]
    ? selectedBaseConfigId
    : initialPair.baseConfigId;
}

function resolveFocusConfigIds(
  configurations: ConfigurationDocument[],
  configurationsById: Record<string, ConfigurationDocument>,
  selectedFocusConfigIds: string[],
  selectedFocusConfigId: string | null,
): string[] {
  const initialPair = selectInitialSavedPair(configurations);
  const selectedIds = selectedFocusConfigIds.length > 0
    ? selectedFocusConfigIds
    : selectedFocusConfigId
      ? [selectedFocusConfigId]
      : [];
  const validIds = selectedIds
    .filter((id) => configurationsById[id])
    .slice(0, MAX_FOCUS_SCENARIOS);

  if (validIds.length > 0) {
    return validIds;
  }

  return initialPair.focusConfigId ? [initialPair.focusConfigId] : [];
}

function updateFocusSelection(
  currentIds: string[],
  slotIndex: number,
  configId: string | null,
): string[] {
  const nextIds = [...currentIds];

  if (configId) {
    nextIds[slotIndex] = configId;
  } else {
    nextIds.splice(slotIndex, 1);
  }

  return nextIds
    .filter((id): id is string => Boolean(id))
    .slice(0, MAX_FOCUS_SCENARIOS);
}

export default function AdditionalityPage() {
  const appConfig = usePackageStore((state) => state.appConfig);
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const autonomousEfficiencyTracks = usePackageStore((state) => state.autonomousEfficiencyTracks);
  const efficiencyPackages = usePackageStore((state) => state.efficiencyPackages);
  const residualOverlays2025 = usePackageStore((state) => state.residualOverlays2025);
  const {
    selectedBaseConfigId,
    selectedFocusConfigId,
    selectedFocusConfigIds,
    commoditySelectionState,
    orderingMethod,
    shapleySampleCount,
  } = useAppUiStore((state) => state.additionality);
  const updateAdditionalityUi = useAppUiStore((state) => state.updateAdditionalityUi);
  const setAdditionalityCommodityLevel = useAppUiStore((state) => state.setAdditionalityCommodityLevel);
  const { configurations: availableConfigurations, configurationsById } = useAvailableConfigurations();
  const baseConfigId = useMemo(
    () => resolveBaseConfigId(availableConfigurations, configurationsById, selectedBaseConfigId),
    [availableConfigurations, configurationsById, selectedBaseConfigId],
  );
  const focusConfigIds = useMemo(
    () => resolveFocusConfigIds(
      availableConfigurations,
      configurationsById,
      selectedFocusConfigIds,
      selectedFocusConfigId,
    ),
    [availableConfigurations, configurationsById, selectedFocusConfigId, selectedFocusConfigIds],
  );
  const baseConfiguration = baseConfigId ? configurationsById[baseConfigId] ?? null : null;
  const focusConfiguration0 = focusConfigIds[0] ? configurationsById[focusConfigIds[0]] ?? null : null;
  const focusConfiguration1 = focusConfigIds[1] ? configurationsById[focusConfigIds[1]] ?? null : null;
  const focusConfiguration2 = focusConfigIds[2] ? configurationsById[focusConfigIds[2]] ?? null : null;
  const commodityOptions = useMemo(
    () => Object.entries(appConfig.commodity_price_presets)
      .map(([id, driver]) => ({ id, label: driver.label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    [appConfig],
  );
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
  const method = orderingMethod ?? DEFAULT_ADDITIONALITY_METHOD;
  const selectedShapleySampleCount = shapleySampleCount ?? DEFAULT_ADDITIONALITY_SHAPLEY_SAMPLE_COUNT;

  const pkg = useMemo(
    () => ({
      appConfig,
      autonomousEfficiencyTracks,
      efficiencyPackages,
      residualOverlays2025,
      sectorStates,
    }),
    [appConfig, autonomousEfficiencyTracks, efficiencyPackages, residualOverlays2025, sectorStates],
  );
  const analysis0 = useAdditionalityAnalysis({
    baseConfiguration,
    baseConfigId,
    commoditySelections,
    method,
    pkg,
    shapleySampleCount: selectedShapleySampleCount,
    targetConfiguration: focusConfiguration0,
    targetConfigId: focusConfigIds[0] ?? null,
  });
  const analysis1 = useAdditionalityAnalysis({
    baseConfiguration,
    baseConfigId,
    commoditySelections,
    method,
    pkg,
    shapleySampleCount: selectedShapleySampleCount,
    targetConfiguration: focusConfiguration1,
    targetConfigId: focusConfigIds[1] ?? null,
  });
  const analysis2 = useAdditionalityAnalysis({
    baseConfiguration,
    baseConfigId,
    commoditySelections,
    method,
    pkg,
    shapleySampleCount: selectedShapleySampleCount,
    targetConfiguration: focusConfiguration2,
    targetConfigId: focusConfigIds[2] ?? null,
  });
  const analysisBySlot = [analysis0, analysis1, analysis2];
  const scenarios = focusConfigIds.map((focusConfigId, slotIndex) => ({
    analysisState: analysisBySlot[slotIndex].analysisState,
    focusConfigId,
    focusLabel: configurationsById[focusConfigId]?.name ?? focusConfigId,
    slotIndex,
  }));

  return (
    <AdditionalityPageView
      baseConfigId={baseConfigId}
      commodityOptions={commodityOptions}
      commoditySelections={commoditySelections}
      configurations={availableConfigurations.map((configuration) => ({
        id: getConfigurationId(configuration) ?? configuration.name,
        label: configuration.name,
        description: configuration.description,
      }))}
      method={method}
      onBaseConfigChange={(configId) => updateAdditionalityUi({ selectedBaseConfigId: configId })}
      onCommoditySelectionChange={(commodityId, level) => {
        setAdditionalityCommodityLevel(commodityId, level, baseConfigId);
      }}
      onFocusConfigChange={(slotIndex, configId) => {
        const nextIds = updateFocusSelection(focusConfigIds, slotIndex, configId);
        updateAdditionalityUi({
          selectedFocusConfigId: nextIds[0] ?? null,
          selectedFocusConfigIds: nextIds,
        });
      }}
      onMethodChange={(nextMethod) => updateAdditionalityUi({ orderingMethod: nextMethod })}
      onRecalculate={() => {
        analysisBySlot.slice(0, focusConfigIds.length).forEach((analysis) => analysis.recalculate());
      }}
      onShapleySampleCountChange={(nextSampleCount) => updateAdditionalityUi({ shapleySampleCount: nextSampleCount })}
      recalculateDisabled={analysisBySlot
        .slice(0, focusConfigIds.length)
        .some((analysis) => analysis.analysisState.phase === 'loading')}
      scenarios={scenarios}
      selectedFocusConfigIds={focusConfigIds}
      shapleySampleCount={selectedShapleySampleCount}
    />
  );
}

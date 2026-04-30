import React, { useMemo, useState } from 'react';
import WorkspaceSolveFailureReport from './WorkspaceSolveFailureReport';
import SystemFlowGraph from './SystemFlowGraph.tsx';
import StackedBarChart from '../charts/StackedBarChart.tsx';
import LineChart from '../charts/LineChart';
import PathwayCapChart from '../charts/PathwayCapChart';
import FuelSwitchingChart from '../charts/FuelSwitchingChart.tsx';
import {
  buildPathwayChartCards,
  buildRemovalsChartCards,
  buildEmissionsBySectorChart,
  buildFuelConsumptionChart,
  buildDemandBySectorChart,
  buildCostByComponentChart,
  type PathwayChartCardData,
  type RemovalsChartCardData,
} from '../../results/chartData';
import {
  buildEfficiencyAttributionChartData,
  buildEfficiencyAttributionRows,
  formatEfficiencyAttributionValue,
} from '../../results/efficiencyAttribution.ts';
import { buildAllContributionRows, buildSolverContributionRows } from '../../results/resultContributions.ts';
import {
  buildFuelSwitchDecomposition,
  buildFuelSwitchRouteBasisRows,
  type FuelSwitchActivityRow,
} from '../../results/fuelSwitching.ts';
import { buildSystemFlowGraphData } from '../../results/systemFlowGraph.ts';
import { usePackageStore } from '../../data/packageStore.ts';
import { getResidualOverlayDisplayMode } from '../../data/residualOverlayPresentation.ts';
import type {
  WorkspaceComparisonBaseSelectionMode,
  WorkspaceSystemFlowUiState,
} from '../../data/appUiState.ts';
import type { FuelSwitchBasis } from '../../data/types.ts';
import type { SolveState } from '../../hooks/useConfigurationSolve.ts';
import type { SolveMethodShareSummary } from '../../solver/contract.ts';

void React;

type PathwayChartMode = 'output' | 'cap';

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}

function buildFuelSwitchActivityRows(
  methodShares: SolveMethodShareSummary[] | undefined,
): FuelSwitchActivityRow[] {
  const rowsByKey = new Map<string, FuelSwitchActivityRow>();

  for (const stateShare of methodShares ?? []) {
    const key = `${stateShare.year}::${stateShare.outputId}`;
    const row = rowsByKey.get(key) ?? {
      outputId: stateShare.outputId,
      outputLabel: stateShare.outputLabel,
      year: stateShare.year,
      activity: 0,
    };

    row.activity += stateShare.activity;
    row.outputLabel = stateShare.outputLabel;
    rowsByKey.set(key, row);
  }

  return Array.from(rowsByKey.values());
}

function PathwayChartCard({ chart }: { chart: PathwayChartCardData }) {
  const [mode, setMode] = useState<PathwayChartMode>('output');
  const showingCap = mode === 'cap';
  const headerAction = (
    <div className="stacked-chart-control-group" role="group" aria-label={`${chart.outputLabel} chart mode`}>
      <button
        type="button"
        className={`stacked-chart-control-pill${mode === 'output' ? ' stacked-chart-control-pill--active' : ''}`}
        onClick={() => setMode('output')}
        aria-pressed={mode === 'output'}
      >
        Output
      </button>
      <button
        type="button"
        className={`stacked-chart-control-pill${mode === 'cap' ? ' stacked-chart-control-pill--active' : ''}`}
        onClick={() => setMode('cap')}
        aria-pressed={mode === 'cap'}
      >
        Cap
      </button>
    </div>
  );

  return (
    <div className="workspace-chart-section workspace-chart-section--pathway">
      {showingCap ? (
        <PathwayCapChart
          data={chart.capChart}
          valueFormatter={formatPercent}
          frameTitle={chart.outputLabel}
          headerAction={headerAction}
          layoutVariant="explorer-uniform"
          yDomainPersistenceKey={`run:pathway-cap:${chart.outputId}`}
        />
      ) : (
        <StackedBarChart
          data={chart.outputChart}
          frameTitle={chart.outputLabel}
          headerAction={headerAction}
          layoutVariant="explorer-uniform"
          yDomainPersistenceKey={`run:pathway-output:${chart.outputId}`}
        />
      )}
    </div>
  );
}

function RemovalsChartCard({ chart }: { chart: RemovalsChartCardData }) {
  return (
    <div className="workspace-chart-section workspace-chart-section--pathway">
      <LineChart
        data={chart.activityChart}
        frameTitle={chart.outputLabel}
        layoutVariant="explorer-uniform"
        valueFormatter={formatNumber}
        yDomainPersistenceKey={`run:removals-activity:${chart.outputId}`}
      />
    </div>
  );
}

export interface ConfigurationWorkspaceCenterProps {
  baseConfigId: string | null;
  baseSelectionMode: WorkspaceComparisonBaseSelectionMode;
  baseSolve: SolveState;
  commonComparisonYears: number[];
  comparisonEnabled: boolean;
  efficiencyAttributionSafe: boolean;
  configurationOptions: Array<{ id: string; label: string }>;
  focusConfigurationLabel: string;
  focusSolve: SolveState;
  fuelSwitchBasis: FuelSwitchBasis;
  onBaseConfigChange: (configId: string) => void;
  onBaseSelectionModeChange: (mode: WorkspaceComparisonBaseSelectionMode) => void;
  onFuelSwitchBasisChange: (basis: FuelSwitchBasis) => void;
  onFuelSwitchYearChange: (year: number) => void;
  onSystemFlowChange: (updates: Partial<WorkspaceSystemFlowUiState>) => void;
  selectedFuelSwitchYear: number | null;
  systemFlow: WorkspaceSystemFlowUiState;
}

function buildComparisonStatus(
  baseSelectionMode: WorkspaceComparisonBaseSelectionMode,
  baseConfigId: string | null,
  comparisonEnabled: boolean,
  baseSolve: SolveState,
): string {
  if (baseSelectionMode === 'none') {
    return 'Base comparison is disabled. Explorer charts show the live focus run only.';
  }

  if (baseSelectionMode === 'generated') {
    if (baseSolve.phase === 'solving') {
      return 'Refreshing the generated incumbent base run for Explorer differencing.';
    }

    if (baseSolve.phase === 'error') {
      return 'The generated incumbent base run failed, so differencing charts are temporarily unavailable while focus charts remain visible.';
    }

    return comparisonEnabled
      ? 'Explorer differencing is active: generated incumbent base versus live focus.'
      : 'Explorer differencing is unavailable for the generated incumbent base.';
  }

  if (!baseConfigId) {
    return 'Choose a saved base configuration to enable differencing charts.';
  }

  if (baseSolve.phase === 'solving') {
    return 'Refreshing the saved base run for Explorer differencing.';
  }

  if (baseSolve.phase === 'error') {
    return 'The saved base run failed, so differencing charts are temporarily unavailable while focus charts remain visible.';
  }

  return comparisonEnabled
    ? 'Explorer differencing is active: saved base versus live focus.'
    : 'Explorer differencing is unavailable for the current pair.';
}

export default function ConfigurationWorkspaceCenter({
  baseConfigId,
  baseSelectionMode,
  baseSolve,
  commonComparisonYears,
  comparisonEnabled,
  efficiencyAttributionSafe,
  configurationOptions,
  focusConfigurationLabel,
  focusSolve,
  fuelSwitchBasis,
  onBaseConfigChange,
  onBaseSelectionModeChange,
  onFuelSwitchBasisChange,
  onFuelSwitchYearChange,
  onSystemFlowChange,
  selectedFuelSwitchYear,
  systemFlow,
}: ConfigurationWorkspaceCenterProps) {
  const residualOverlays2025 = usePackageStore((s) => s.residualOverlays2025);
  const systemStructureGroups = usePackageStore((s) => s.systemStructureGroups);
  const systemStructureMembers = usePackageStore((s) => s.systemStructureMembers);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);

  const focusHasSolvedSnapshot = focusSolve.request != null && focusSolve.result != null;
  const baseHasSolvedSnapshot =
    comparisonEnabled
    && baseSolve.request != null
    && baseSolve.result != null
    && baseSolve.phase !== 'error';
  const showCharts = focusHasSolvedSnapshot && focusSolve.phase !== 'error';
  const residualOverlayDisplayMode = getResidualOverlayDisplayMode(currentConfiguration);

  const focusContributions = useMemo(
    () =>
      focusSolve.request && focusSolve.result
        ? focusSolve.solvedConfiguration
          ? buildAllContributionRows(
            focusSolve.request,
            focusSolve.result,
            residualOverlays2025,
            focusSolve.solvedConfiguration,
          )
          : buildSolverContributionRows(focusSolve.request, focusSolve.result)
        : [],
    [focusSolve.request, focusSolve.result, focusSolve.solvedConfiguration, residualOverlays2025],
  );
  const baseContributions = useMemo(
    () =>
      baseSolve.request && baseSolve.result
        ? baseSolve.solvedConfiguration
          ? buildAllContributionRows(
            baseSolve.request,
            baseSolve.result,
            residualOverlays2025,
            baseSolve.solvedConfiguration,
          )
          : buildSolverContributionRows(baseSolve.request, baseSolve.result)
        : [],
    [baseSolve.request, baseSolve.result, baseSolve.solvedConfiguration, residualOverlays2025],
  );
  const years = useMemo(
    () => focusSolve.request?.configuration.years ?? [],
    [focusSolve.request?.configuration.years],
  );
  const selectedSystemFlowYear = useMemo(() => {
    if (years.length === 0) {
      return null;
    }

    const persistedYear = systemFlow.selectedYear;

    return persistedYear != null && years.includes(persistedYear)
      ? persistedYear
      : years[years.length - 1];
  }, [systemFlow.selectedYear, years]);
  const systemFlowGraph = useMemo(
    () => (
      focusSolve.request && focusSolve.result && selectedSystemFlowYear != null
        ? buildSystemFlowGraphData(focusSolve.request, focusSolve.result, {
          year: selectedSystemFlowYear,
          collapsedSegmentIds: new Set(systemFlow.collapsedSegmentIds),
          systemStructureGroups,
          systemStructureMembers,
        })
        : null
    ),
    [
      focusSolve.request,
      focusSolve.result,
      selectedSystemFlowYear,
      systemFlow.collapsedSegmentIds,
      systemStructureGroups,
      systemStructureMembers,
    ],
  );

  const demandBySectorChart = useMemo(
    () => (focusSolve.request ? buildDemandBySectorChart(focusSolve.request) : null),
    [focusSolve.request],
  );
  const emissionsChart = useMemo(
    () => (
      focusContributions.length > 0
        ? buildEmissionsBySectorChart(focusContributions, years, residualOverlayDisplayMode)
        : null
    ),
    [focusContributions, years, residualOverlayDisplayMode],
  );
  const consumptionChart = useMemo(
    () => (focusContributions.length > 0 ? buildFuelConsumptionChart(focusContributions, years) : null),
    [focusContributions, years],
  );
  const costByComponentChart = useMemo(
    () =>
      focusContributions.length > 0
        ? buildCostByComponentChart(focusContributions, years, focusSolve.request?.objectiveCost)
        : null,
    [focusContributions, years, focusSolve.request?.objectiveCost],
  );
  const pathwayCharts = useMemo(
    () => (focusSolve.request && focusSolve.result ? buildPathwayChartCards(focusSolve.request, focusSolve.result) : []),
    [focusSolve.request, focusSolve.result],
  );
  const removalsCharts = useMemo(
    () => (focusSolve.request && focusSolve.result ? buildRemovalsChartCards(focusSolve.request, focusSolve.result) : []),
    [focusSolve.request, focusSolve.result],
  );
  const baseFuelSwitchActivities = useMemo(
    () => buildFuelSwitchActivityRows(baseSolve.result?.reporting.methodShares),
    [baseSolve.result],
  );
  const focusFuelSwitchActivities = useMemo(
    () => buildFuelSwitchActivityRows(focusSolve.result?.reporting.methodShares),
    [focusSolve.result],
  );
  const fuelSwitchRouteBasis = useMemo(
    () => (
      baseHasSolvedSnapshot
      && baseSolve.request
      && baseSolve.result
      && focusSolve.request
      && focusSolve.result
        ? buildFuelSwitchRouteBasisRows(
          baseSolve.request,
          baseSolve.result,
          focusSolve.request,
          focusSolve.result,
        )
        : null
    ),
    [
      baseHasSolvedSnapshot,
      baseSolve.request,
      baseSolve.result,
      focusSolve.request,
      focusSolve.result,
    ],
  );
  const fuelSwitchDecomposition = useMemo(
    () => (
      baseHasSolvedSnapshot
        ? buildFuelSwitchDecomposition(baseContributions, focusContributions, {
          baseActivities: baseFuelSwitchActivities,
          baseSwitchBasisRows: fuelSwitchRouteBasis?.baseSwitchBasisRows,
          focusActivities: focusFuelSwitchActivities,
          focusSwitchBasisRows: fuelSwitchRouteBasis?.focusSwitchBasisRows,
        })
        : { switchRows: [], residualRows: [], netDeltaRows: [] }
    ),
    [
      baseContributions,
      baseFuelSwitchActivities,
      baseHasSolvedSnapshot,
      focusContributions,
      focusFuelSwitchActivities,
      fuelSwitchRouteBasis,
    ],
  );
  const efficiencyAttributionRows = useMemo(
    () => (
      baseHasSolvedSnapshot && efficiencyAttributionSafe
        ? buildEfficiencyAttributionRows(baseContributions, focusContributions)
        : []
    ),
    [baseContributions, baseHasSolvedSnapshot, efficiencyAttributionSafe, focusContributions],
  );
  const efficiencyFuelChart = useMemo(
    () => buildEfficiencyAttributionChartData(efficiencyAttributionRows, 'fuel', commonComparisonYears),
    [commonComparisonYears, efficiencyAttributionRows],
  );
  const efficiencyEmissionsChart = useMemo(
    () => buildEfficiencyAttributionChartData(efficiencyAttributionRows, 'emissions', commonComparisonYears),
    [commonComparisonYears, efficiencyAttributionRows],
  );
  const efficiencyCostChart = useMemo(
    () => buildEfficiencyAttributionChartData(efficiencyAttributionRows, 'cost', commonComparisonYears),
    [commonComparisonYears, efficiencyAttributionRows],
  );
  const comparisonStatus = buildComparisonStatus(
    baseSelectionMode,
    baseConfigId,
    comparisonEnabled,
    baseSolve,
  );

  return (
    <section className="workspace-center" aria-busy={focusSolve.phase === 'solving' || baseSolve.phase === 'solving'}>
      <section className="configuration-panel configuration-panel--hero workspace-comparison-panel">
        <span className="configuration-badge">Base + Focus</span>
        <div className="workspace-chart-card-header">
          <div>
            <h2>Explorer comparison pair</h2>
            <p className="workspace-comparison-note">
              Explorer always solves the live working configuration as Focus. Base can be
              generated from the focus structure, selected from saved configs, or disabled.
            </p>
          </div>
          <div className="workspace-chart-toggle" role="tablist" aria-label="Base selection mode">
            {(['generated', 'saved', 'none'] as WorkspaceComparisonBaseSelectionMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`workspace-chart-toggle-button${baseSelectionMode === mode ? ' workspace-chart-toggle-button--active' : ''}`}
                onClick={() => onBaseSelectionModeChange(mode)}
                aria-pressed={baseSelectionMode === mode}
              >
                {mode === 'generated' ? 'Generated' : mode === 'saved' ? 'Saved' : 'None'}
              </button>
            ))}
          </div>
        </div>

        <div className="configuration-form-grid">
          <label className="configuration-field">
            <span>Base configuration</span>
            <select
              className="configuration-input"
              value={baseSelectionMode === 'none' ? '' : baseConfigId ?? ''}
              onChange={(event) => onBaseConfigChange(event.target.value)}
              disabled={baseSelectionMode !== 'saved'}
            >
              <option value="">
                {baseSelectionMode === 'generated'
                  ? 'Generated incumbent base'
                  : baseSelectionMode === 'none'
                    ? 'Disabled'
                    : 'Select a saved base configuration'}
              </option>
              {configurationOptions.map((configuration) => (
                <option key={configuration.id} value={configuration.id}>
                  {configuration.label}
                </option>
              ))}
            </select>
          </label>

          <label className="configuration-field">
            <span>Focus configuration</span>
            <input
              className="configuration-input"
              type="text"
              value={focusConfigurationLabel}
              readOnly={true}
            />
          </label>
        </div>

        <p className="configuration-status configuration-status--info">{comparisonStatus}</p>
      </section>

      {focusSolve.phase === 'error' && focusSolve.error && !focusSolve.failure && (
        <p className="configuration-status configuration-status--error">{focusSolve.error}</p>
      )}
      {focusSolve.phase === 'error' && focusSolve.failure && <WorkspaceSolveFailureReport failure={focusSolve.failure} />}
      {comparisonEnabled && baseSolve.phase === 'error' ? (
        <section className="configuration-panel">
          <h2>Base comparison unavailable</h2>
          <p>
            {baseSolve.failure?.headline
              ?? baseSolve.error
              ?? 'The base configuration failed to solve for comparison.'}
          </p>
        </section>
      ) : null}
      {showCharts && systemFlowGraph && selectedSystemFlowYear != null ? (
        <SystemFlowGraph
          availableYears={years}
          data={systemFlowGraph}
          selectedYear={selectedSystemFlowYear}
          viewMode={systemFlow.viewMode}
          onCollapsedSegmentIdsChange={(collapsedSegmentIds) => onSystemFlowChange({ collapsedSegmentIds })}
          onViewModeChange={(viewMode) => onSystemFlowChange({ viewMode })}
          onYearChange={(selectedYear) => onSystemFlowChange({ selectedYear })}
        />
      ) : null}
      {showCharts && (
        <div className="workspace-chart-grid">
          {demandBySectorChart && (
            <div className="workspace-chart-section">
              <LineChart
                data={demandBySectorChart}
                layoutVariant="explorer-uniform"
                yDomainPersistenceKey="run:demand-by-sector"
              />
            </div>
          )}
          {emissionsChart && (
            <div className="workspace-chart-section">
              <StackedBarChart
                data={emissionsChart}
                layoutVariant="explorer-uniform"
                yDomainPersistenceKey="run:emissions-by-sector"
                showNetLine={true}
              />
            </div>
          )}
          {consumptionChart && (
            <div className="workspace-chart-section">
              <StackedBarChart
                data={consumptionChart}
                layoutVariant="explorer-uniform"
                yDomainPersistenceKey="run:fuel-consumption"
              />
            </div>
          )}
          {baseHasSolvedSnapshot && (
            <div className="workspace-chart-section">
              <FuelSwitchingChart
                availableYears={commonComparisonYears}
                basis={fuelSwitchBasis}
                residualRows={fuelSwitchDecomposition.residualRows}
                rows={fuelSwitchDecomposition.switchRows}
                selectedYear={
                  commonComparisonYears.includes(selectedFuelSwitchYear ?? Number.NaN)
                    ? selectedFuelSwitchYear
                    : commonComparisonYears[commonComparisonYears.length - 1] ?? null
                }
                onBasisChange={onFuelSwitchBasisChange}
                onYearChange={onFuelSwitchYearChange}
                yDomainPersistenceKey="run:fuel-switching"
              />
            </div>
          )}
          {costByComponentChart && (
            <div className="workspace-chart-section">
              <StackedBarChart
                data={costByComponentChart}
                layoutVariant="explorer-uniform"
                yDomainPersistenceKey="run:cost-by-component"
                showNetLine={true}
              />
            </div>
          )}
          {pathwayCharts.map((chart) => (
            <PathwayChartCard key={chart.outputId} chart={chart} />
          ))}
          {removalsCharts.map((chart) => (
            <RemovalsChartCard key={chart.outputId} chart={chart} />
          ))}
        </div>
      )}
      {showCharts && baseHasSolvedSnapshot && !efficiencyAttributionSafe ? (
        <section className="configuration-panel">
          <h2>Efficiency attribution unavailable</h2>
          <p>
            This Base/Focus pair supports descriptive differencing only because the
            scenario backbone differs.
          </p>
        </section>
      ) : null}
      {showCharts && baseHasSolvedSnapshot && efficiencyAttributionSafe ? (
        <section className="configuration-panel">
          <div className="workspace-chart-card-header">
            <div>
              <h2>Efficiency attribution</h2>
              <p className="workspace-comparison-note">
                These charts attribute Focus minus Base deltas across the canonical
                efficiency categories while leaving the absolute Explorer charts intact.
              </p>
            </div>
          </div>
          {efficiencyAttributionRows.length === 0 ? (
            <p className="configuration-status configuration-status--info">
              No efficiency-attributed deltas appear in the current Base/Focus pair.
            </p>
          ) : (
            <div className="workspace-chart-grid">
              <div className="workspace-chart-section">
                <StackedBarChart
                  data={efficiencyFuelChart}
                  layoutVariant="explorer-uniform"
                  valueFormatter={(value) => formatEfficiencyAttributionValue('fuel', value)}
                  yDomainPersistenceKey="run:efficiency-attribution:fuel"
                  showNetLine={true}
                />
              </div>
              <div className="workspace-chart-section">
                <StackedBarChart
                  data={efficiencyEmissionsChart}
                  layoutVariant="explorer-uniform"
                  valueFormatter={(value) => formatEfficiencyAttributionValue('emissions', value)}
                  yDomainPersistenceKey="run:efficiency-attribution:emissions"
                  showNetLine={true}
                />
              </div>
              <div className="workspace-chart-section">
                <StackedBarChart
                  data={efficiencyCostChart}
                  layoutVariant="explorer-uniform"
                  valueFormatter={(value) => formatEfficiencyAttributionValue('cost', value)}
                  yDomainPersistenceKey="run:efficiency-attribution:cost"
                  showNetLine={true}
                />
              </div>
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}

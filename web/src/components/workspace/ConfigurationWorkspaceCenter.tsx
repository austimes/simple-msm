import React, { useMemo, useState } from 'react';
import WorkspaceSolveFailureReport from './WorkspaceSolveFailureReport';
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
import { buildAllContributionRows, buildSolverContributionRows } from '../../results/resultContributions.ts';
import { buildFuelSwitchAttributionRows } from '../../results/fuelSwitching.ts';
import { usePackageStore } from '../../data/packageStore.ts';
import { getResidualOverlayDisplayMode } from '../../data/residualOverlayPresentation.ts';
import type { WorkspaceComparisonBaseSelectionMode } from '../../data/appUiState.ts';
import type { FuelSwitchBasis } from '../../data/types.ts';
import type { SolveState } from '../../hooks/useConfigurationSolve.ts';

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
  configurationOptions: Array<{ id: string; label: string }>;
  focusConfigurationLabel: string;
  focusSolve: SolveState;
  fuelSwitchBasis: FuelSwitchBasis;
  onBaseConfigChange: (configId: string) => void;
  onBaseSelectionModeChange: (mode: WorkspaceComparisonBaseSelectionMode) => void;
  onFuelSwitchBasisChange: (basis: FuelSwitchBasis) => void;
  onFuelSwitchYearChange: (year: number) => void;
  selectedFuelSwitchYear: number | null;
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

  if (!baseConfigId) {
    return baseSelectionMode === 'auto'
      ? 'No saved base is associated with the current working configuration, so differencing charts are disabled.'
      : 'Choose a saved base configuration to enable differencing charts.';
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
  configurationOptions,
  focusConfigurationLabel,
  focusSolve,
  fuelSwitchBasis,
  onBaseConfigChange,
  onBaseSelectionModeChange,
  onFuelSwitchBasisChange,
  onFuelSwitchYearChange,
  selectedFuelSwitchYear,
}: ConfigurationWorkspaceCenterProps) {
  const residualOverlays2025 = usePackageStore((s) => s.residualOverlays2025);
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
  const fuelSwitchRows = useMemo(
    () => (baseHasSolvedSnapshot ? buildFuelSwitchAttributionRows(baseContributions, focusContributions) : []),
    [baseContributions, baseHasSolvedSnapshot, focusContributions],
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
              Explorer always solves the live working configuration as Focus. A saved Base
              configuration is optional and only enables differencing charts.
            </p>
          </div>
          <div className="workspace-chart-toggle" role="tablist" aria-label="Base selection mode">
            {(['auto', 'manual', 'none'] as WorkspaceComparisonBaseSelectionMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`workspace-chart-toggle-button${baseSelectionMode === mode ? ' workspace-chart-toggle-button--active' : ''}`}
                onClick={() => onBaseSelectionModeChange(mode)}
                aria-pressed={baseSelectionMode === mode}
              >
                {mode === 'auto' ? 'Auto' : mode === 'manual' ? 'Manual' : 'None'}
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
              disabled={baseSelectionMode !== 'manual'}
            >
              <option value="">
                {baseSelectionMode === 'none' ? 'Disabled' : 'Select a saved base configuration'}
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
              ?? 'The saved base configuration failed to solve for comparison.'}
          </p>
        </section>
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
                rows={fuelSwitchRows}
                selectedYear={
                  commonComparisonYears.includes(selectedFuelSwitchYear ?? Number.NaN)
                    ? selectedFuelSwitchYear
                    : commonComparisonYears[commonComparisonYears.length - 1] ?? null
                }
                onBasisChange={onFuelSwitchBasisChange}
                onYearChange={onFuelSwitchYearChange}
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
    </section>
  );
}

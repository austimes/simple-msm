import React, { useMemo, useState } from 'react';
import WorkspaceSolveFailureReport from './WorkspaceSolveFailureReport';
import StackedAreaChart from '../charts/StackedAreaChart';
import DivergingStackedBarChart from '../charts/DivergingStackedBarChart';
import LineChart from '../charts/LineChart';
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
import { usePackageStore } from '../../data/packageStore.ts';
import { getResidualOverlayDisplayMode } from '../../data/residualOverlayPresentation.ts';
import type { ConfigurationDocument } from '../../data/types.ts';
import type { SolveRequest, SolveResult } from '../../solver/contract.ts';
import type { ConfigurationSolveFailure } from '../../solver/configurationSolveFailure.ts';

void React;

type PathwayChartMode = 'output' | 'cap';
type SolvePhase = 'idle' | 'solving' | 'solved' | 'error';

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

  return (
    <div className="workspace-chart-section workspace-chart-section--pathway">
      <div className="workspace-chart-card-header">
        <div>
          <h2 className="workspace-chart-card-title">{chart.outputLabel}</h2>
        </div>
        <div className="workspace-chart-toggle" role="tablist" aria-label={`${chart.outputLabel} chart mode`}>
          <button
            type="button"
            className={`workspace-chart-toggle-button${mode === 'output' ? ' workspace-chart-toggle-button--active' : ''}`}
            onClick={() => setMode('output')}
            aria-pressed={mode === 'output'}
          >
            Output
          </button>
          <button
            type="button"
            className={`workspace-chart-toggle-button${mode === 'cap' ? ' workspace-chart-toggle-button--active' : ''}`}
            onClick={() => setMode('cap')}
            aria-pressed={mode === 'cap'}
          >
            Cap
          </button>
        </div>
      </div>
      {showingCap ? (
        <LineChart
          data={chart.capChart}
          valueFormatter={formatPercent}
          showTitle={false}
          yDomainPersistenceKey={`run:pathway-cap:${chart.outputId}`}
        />
      ) : (
        <StackedAreaChart
          data={chart.outputChart}
          showTitle={false}
          yDomainPersistenceKey={`run:pathway-output:${chart.outputId}`}
        />
      )}
    </div>
  );
}

function RemovalsChartCard({ chart }: { chart: RemovalsChartCardData }) {
  return (
    <div className="workspace-chart-section workspace-chart-section--pathway">
      <div className="workspace-chart-card-header">
        <div>
          <h2 className="workspace-chart-card-title">{chart.outputLabel}</h2>
        </div>
      </div>
      <LineChart
        data={chart.activityChart}
        valueFormatter={formatNumber}
        showTitle={false}
        yDomainPersistenceKey={`run:removals-activity:${chart.outputId}`}
      />
    </div>
  );
}

export interface ConfigurationWorkspaceCenterProps {
  phase: SolvePhase;
  result: SolveResult | null;
  request: SolveRequest | null;
  solvedConfiguration?: ConfigurationDocument | null;
  error: string | null;
  failure: ConfigurationSolveFailure | null;
}

export default function ConfigurationWorkspaceCenter({
  phase,
  result,
  request,
  solvedConfiguration,
  error,
  failure,
}: ConfigurationWorkspaceCenterProps) {
  const residualOverlays2025 = usePackageStore((s) => s.residualOverlays2025);
  const currentConfiguration = usePackageStore((s) => s.currentConfiguration);

  const hasSolvedSnapshot = request != null && result != null;
  const showCharts = hasSolvedSnapshot && phase !== 'error';
  const residualOverlayDisplayMode = getResidualOverlayDisplayMode(currentConfiguration);

  const contributions = useMemo(
    () =>
      request && result
        ? solvedConfiguration
          ? buildAllContributionRows(request, result, residualOverlays2025, solvedConfiguration)
          : buildSolverContributionRows(request, result)
        : [],
    [request, result, residualOverlays2025, solvedConfiguration],
  );
  const years = useMemo(
    () => request?.configuration.years ?? [],
    [request?.configuration.years],
  );

  const demandBySectorChart = useMemo(
    () => (request ? buildDemandBySectorChart(request) : null),
    [request],
  );
  const emissionsChart = useMemo(
    () => (
      contributions.length > 0
        ? buildEmissionsBySectorChart(contributions, years, residualOverlayDisplayMode)
        : null
    ),
    [contributions, years, residualOverlayDisplayMode],
  );
  const consumptionChart = useMemo(
    () => (contributions.length > 0 ? buildFuelConsumptionChart(contributions, years) : null),
    [contributions, years],
  );
  const costByComponentChart = useMemo(
    () =>
      contributions.length > 0
        ? buildCostByComponentChart(contributions, years, request?.objectiveCost)
        : null,
    [contributions, years, request?.objectiveCost],
  );
  const pathwayCharts = useMemo(
    () => (request && result ? buildPathwayChartCards(request, result) : []),
    [request, result],
  );
  const removalsCharts = useMemo(
    () => (request && result ? buildRemovalsChartCards(request, result) : []),
    [request, result],
  );

  return (
    <section className="workspace-center" aria-busy={phase === 'solving'}>
      {phase === 'error' && error && !failure && (
        <p className="configuration-status configuration-status--error">{error}</p>
      )}
      {phase === 'error' && failure && <WorkspaceSolveFailureReport failure={failure} />}
      {showCharts && (
        <div className="workspace-chart-grid">
          {demandBySectorChart && (
            <div className="workspace-chart-section">
              <LineChart
                data={demandBySectorChart}
                yDomainPersistenceKey="run:demand-by-sector"
              />
            </div>
          )}
          {emissionsChart && (
            <div className="workspace-chart-section">
              <DivergingStackedBarChart
                data={emissionsChart}
                yDomainPersistenceKey="run:emissions-by-sector"
              />
            </div>
          )}
          {consumptionChart && (
            <div className="workspace-chart-section">
              <StackedAreaChart
                data={consumptionChart}
                yDomainPersistenceKey="run:fuel-consumption"
              />
            </div>
          )}
          {costByComponentChart && (
            <div className="workspace-chart-section">
              <DivergingStackedBarChart
                data={costByComponentChart}
                yDomainPersistenceKey="run:cost-by-component"
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

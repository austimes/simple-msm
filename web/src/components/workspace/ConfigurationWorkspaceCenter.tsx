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
        <LineChart data={chart.capChart} valueFormatter={formatPercent} showTitle={false} />
      ) : (
        <StackedAreaChart data={chart.outputChart} showTitle={false} />
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
      <LineChart data={chart.activityChart} valueFormatter={formatNumber} showTitle={false} />
    </div>
  );
}

export interface ConfigurationWorkspaceCenterProps {
  phase: SolvePhase;
  result: SolveResult | null;
  request: SolveRequest | null;
  error: string | null;
  failure: ConfigurationSolveFailure | null;
}

export default function ConfigurationWorkspaceCenter({
  phase,
  result,
  request,
  error,
  failure,
}: ConfigurationWorkspaceCenterProps) {
  const demandBySectorChart = useMemo(
    () => (request ? buildDemandBySectorChart(request) : null),
    [request],
  );
  const emissionsChart = useMemo(
    () => (request && result ? buildEmissionsBySectorChart(request, result) : null),
    [request, result],
  );
  const consumptionChart = useMemo(
    () => (request && result ? buildFuelConsumptionChart(request, result) : null),
    [request, result],
  );
  const costByComponentChart = useMemo(
    () => (request && result ? buildCostByComponentChart(request, result) : null),
    [request, result],
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
    <section className="workspace-center">
      {phase === 'error' && error && !failure && (
        <p className="configuration-status configuration-status--error">{error}</p>
      )}
      {phase === 'error' && failure && <WorkspaceSolveFailureReport failure={failure} />}
      {phase === 'solved' && result && request && (
        <div className="workspace-chart-grid">
          {demandBySectorChart && (
            <div className="workspace-chart-section">
              <LineChart data={demandBySectorChart} />
            </div>
          )}
          {emissionsChart && (
            <div className="workspace-chart-section">
              <DivergingStackedBarChart data={emissionsChart} />
            </div>
          )}
          {consumptionChart && (
            <div className="workspace-chart-section">
              <StackedAreaChart data={consumptionChart} />
            </div>
          )}
          {costByComponentChart && (
            <div className="workspace-chart-section">
              <DivergingStackedBarChart data={costByComponentChart} />
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

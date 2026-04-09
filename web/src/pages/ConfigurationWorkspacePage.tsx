import { useMemo, useState } from 'react';
import { useConfigurationSolve } from '../hooks/useConfigurationSolve';
import LeftSidebar from '../components/workspace/LeftSidebar';
import RightSidebar from '../components/workspace/RightSidebar';
import StackedAreaChart from '../components/charts/StackedAreaChart';
import LineChart from '../components/charts/LineChart';
import {
  buildPathwayChartCards,
  buildEmissionsBySectorChart,
  buildCommodityConsumptionChart,
  buildDemandBySectorChart,
  buildCostByComponentChart,
  type PathwayChartCardData,
} from '../results/chartData';

type PathwayChartMode = 'output' | 'cap';

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function PathwayChartCard({ chart }: { chart: PathwayChartCardData }) {
  const [mode, setMode] = useState<PathwayChartMode>('output');
  const showingCap = mode === 'cap';

  return (
    <div className="workspace-chart-section workspace-chart-section--pathway">
      <div className="workspace-chart-card-header">
        <div>
          <h2 className="workspace-chart-card-title">{chart.outputLabel}</h2>
          <p className="workspace-chart-card-subtitle">
            {showingCap ? 'Effective pathway cap over time' : 'Absolute pathway output over time'}
          </p>
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
        <LineChart data={chart.capChart} valueFormatter={formatPercent} />
      ) : (
        <StackedAreaChart data={chart.outputChart} />
      )}
      <p className={`workspace-chart-note${chart.respectMaxShare ? '' : ' workspace-chart-note--warning'}`}>
        {chart.note}
      </p>
    </div>
  );
}

export default function ConfigurationWorkspacePage() {
  const { phase, result, request, error } = useConfigurationSolve();

  const demandBySectorChart = useMemo(
    () => (request ? buildDemandBySectorChart(request) : null),
    [request],
  );
  const emissionsChart = useMemo(
    () => (request && result ? buildEmissionsBySectorChart(request, result) : null),
    [request, result],
  );
  const consumptionChart = useMemo(
    () => (request && result ? buildCommodityConsumptionChart(request, result) : null),
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

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar workspace-sidebar--left">
        <LeftSidebar />
      </aside>

      <section className="workspace-center">
        {phase === 'error' && error && (
          <p className="configuration-status configuration-status--error">{error}</p>
        )}
        {phase === 'solved' && result && request && (
          <div className="workspace-chart-grid">
            {demandBySectorChart && (
              <div className="workspace-chart-section">
                <LineChart data={demandBySectorChart} />
              </div>
            )}
            {emissionsChart && (
              <div className="workspace-chart-section">
                <StackedAreaChart data={emissionsChart} />
              </div>
            )}
            {consumptionChart && (
              <div className="workspace-chart-section">
                <StackedAreaChart data={consumptionChart} />
              </div>
            )}
            {costByComponentChart && (
              <div className="workspace-chart-section">
                <StackedAreaChart data={costByComponentChart} />
              </div>
            )}
            {pathwayCharts.map((chart) => (
              <PathwayChartCard key={chart.outputId} chart={chart} />
            ))}
          </div>
        )}
      </section>

      <aside className="workspace-sidebar workspace-sidebar--right">
        <RightSidebar />
      </aside>
    </div>
  );
}

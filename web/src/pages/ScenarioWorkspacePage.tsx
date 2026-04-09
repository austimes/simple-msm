import { useMemo } from 'react';
import { useScenarioSolve } from '../hooks/useScenarioSolve';
import LeftSidebar from '../components/workspace/LeftSidebar';
import RightSidebar from '../components/workspace/RightSidebar';
import StackedAreaChart from '../components/charts/StackedAreaChart';
import LineChart from '../components/charts/LineChart';
import {
  buildEmissionsBySectorChart,
  buildCommodityConsumptionChart,
  buildDemandBySectorChart,
  buildCostByComponentChart,
} from '../results/chartData';

export default function ScenarioWorkspacePage() {
  const { phase, result, request, error } = useScenarioSolve();

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

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar workspace-sidebar--left">
        <LeftSidebar />
      </aside>

      <section className="workspace-center">
        {phase === 'error' && error && (
          <p className="scenario-status scenario-status--error">{error}</p>
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
          </div>
        )}
      </section>

      <aside className="workspace-sidebar workspace-sidebar--right">
        <RightSidebar />
      </aside>
    </div>
  );
}

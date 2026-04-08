import { useMemo } from 'react';
import { useScenarioSolve } from '../hooks/useScenarioSolve';
import { usePackageStore } from '../data/packageStore';
import LeftSidebar from '../components/workspace/LeftSidebar';
import RightSidebar from '../components/workspace/RightSidebar';
import StackedAreaChart from '../components/charts/StackedAreaChart';
import {
  buildEmissionsBySectorChart,
  buildCommodityConsumptionChart,
  buildDemandOverTimeChart,
} from '../results/chartData';

export default function ScenarioWorkspacePage() {
  const { phase, result, request, error, solve } = useScenarioSolve();


  const activeConfigurationId = usePackageStore((state) => state.activeConfigurationId);
  const includedOutputIds = usePackageStore((state) => state.includedOutputIds);

  const isSolving = phase === 'solving';

  const emissionsChart = useMemo(
    () => (request && result ? buildEmissionsBySectorChart(request, result) : null),
    [request, result],
  );
  const consumptionChart = useMemo(
    () => (request && result ? buildCommodityConsumptionChart(request, result) : null),
    [request, result],
  );
  const demandChart = useMemo(
    () => (request ? buildDemandOverTimeChart(request) : null),
    [request],
  );

  const warningCount = result?.diagnostics.filter((d) => d.severity === 'warning').length ?? 0;
  const errorCount = result?.diagnostics.filter((d) => d.severity === 'error').length ?? 0;

  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar workspace-sidebar--left">
        <LeftSidebar />
      </aside>

      <section className="workspace-center">
        <h2>Solve &amp; Results</h2>

        <div className="workspace-solve-bar">
          {isSolving && <span className="workspace-solve-status">Solving…</span>}
          {activeConfigurationId && (
            <span className="workspace-solve-status">
              Config: <strong>{activeConfigurationId}</strong>
              {includedOutputIds && ` (${includedOutputIds.length} outputs scoped)`}
            </span>
          )}

        </div>

        {phase === 'error' && error && (
          <p className="workspace-solve-status workspace-solve-error">
            {error}
          </p>
        )}

        {phase === 'solved' && result && (
          <p className="workspace-solve-status">
            Solved in {result.timingsMs.total.toFixed(2)} ms
          </p>
        )}

        {phase === 'solved' && result && request && (
          <>
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
            {demandChart && (
              <div className="workspace-chart-section">
                <StackedAreaChart data={demandChart} />
              </div>
            )}

            {(warningCount > 0 || errorCount > 0) && (
              <details className="workspace-diagnostics">
                <summary>
                  Diagnostics — {warningCount} warning{warningCount !== 1 ? 's' : ''}, {errorCount} error{errorCount !== 1 ? 's' : ''}
                </summary>
                <ul>
                  {result.diagnostics
                    .filter((d) => d.severity === 'warning' || d.severity === 'error')
                    .map((d, i) => (
                      <li key={i}>
                        <strong>[{d.severity}]</strong> {d.message}
                      </li>
                    ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      <aside className="workspace-sidebar workspace-sidebar--right">
        <RightSidebar />
      </aside>
    </div>
  );
}

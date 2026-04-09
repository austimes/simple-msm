import { useMemo } from 'react';
import { useScenarioSolve } from '../hooks/useScenarioSolve';
import { usePackageStore } from '../data/packageStore';
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
import type { SolveRequest, SolveResult } from '../solver/contract';

export default function ScenarioWorkspacePage() {
  const { phase, result, request, error } = useScenarioSolve();


  const activeConfigurationId = usePackageStore((state) => state.activeConfigurationId);
  const includedOutputIds = usePackageStore((state) => state.includedOutputIds);

  const isSolving = phase === 'solving';

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

  const activeStatesSummary = useMemo(
    () => (request && result ? buildActiveStatesSummary(request, result) : null),
    [request, result],
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

            {activeStatesSummary && activeStatesSummary.length > 0 && (
              <details className="workspace-active-states">
                <summary>Active States Summary ({activeStatesSummary.length} entries)</summary>
                <div className="workspace-active-states-list">
                  {activeStatesSummary.map((group) => (
                    <div key={group.outputLabel} className="workspace-active-states-group">
                      <h4>{group.outputLabel}</h4>
                      {group.yearEntries.map((ye) => (
                        <div key={ye.year} className="workspace-active-states-year">
                          <span className="workspace-active-states-year-label">{ye.year}</span>
                          <ul>
                            {ye.states.map((s) => (
                              <li key={s.stateLabel}>
                                {s.stateLabel}
                                {s.share != null && ` — ${(s.share * 100).toFixed(1)}%`}
                                {` (activity: ${s.activity.toPrecision(3)})`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
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

interface ActiveStateEntry {
  stateLabel: string;
  share: number | null;
  activity: number;
}

interface ActiveStatesYearEntry {
  year: number;
  states: ActiveStateEntry[];
}

interface ActiveStatesOutputGroup {
  outputLabel: string;
  yearEntries: ActiveStatesYearEntry[];
}

function buildActiveStatesSummary(
  request: SolveRequest,
  result: SolveResult,
): ActiveStatesOutputGroup[] {
  const outputLabels = new Map<string, string>();
  for (const row of request.rows) {
    if (!outputLabels.has(row.outputId)) {
      outputLabels.set(row.outputId, row.outputLabel);
    }
  }

  // Group stateShares by output → year
  const byOutput = new Map<string, Map<number, ActiveStateEntry[]>>();
  for (const ss of result.reporting.stateShares) {
    if (ss.activity === 0 && (ss.share === null || ss.share === 0)) continue;

    let yearMap = byOutput.get(ss.outputId);
    if (!yearMap) {
      yearMap = new Map();
      byOutput.set(ss.outputId, yearMap);
    }
    let entries = yearMap.get(ss.year);
    if (!entries) {
      entries = [];
      yearMap.set(ss.year, entries);
    }
    entries.push({
      stateLabel: ss.stateLabel,
      share: ss.share,
      activity: ss.activity,
    });
  }

  const groups: ActiveStatesOutputGroup[] = [];
  for (const [outputId, yearMap] of byOutput) {
    const yearEntries: ActiveStatesYearEntry[] = [];
    const sortedYears = [...yearMap.keys()].sort((a, b) => a - b);
    for (const year of sortedYears) {
      const states = yearMap.get(year)!;
      states.sort((a, b) => b.activity - a.activity);
      yearEntries.push({ year, states });
    }
    groups.push({
      outputLabel: outputLabels.get(outputId) ?? outputId,
      yearEntries,
    });
  }

  return groups;
}

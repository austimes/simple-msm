import { useEffect, useMemo, useState } from 'react';
import {
  buildComparisonReport,
  buildComparisonScenarioPlan,
  scenarioRoleSummary,
} from '../compare/compareAnalysis';
import { usePackageStore } from '../data/packageStore';
import { buildSolveRequest } from '../solver/buildSolveRequest';
import type { SolveRequest, SolveResult } from '../solver/contract';
import { runSolveInWorker } from '../solver/solverClient';

const compactNumberFormatter = new Intl.NumberFormat('en-AU', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
});

type PreparedSolve = {
  key: Parameters<typeof buildComparisonReport>[2][number]['key'];
  scenario: Parameters<typeof buildComparisonReport>[2][number]['scenario'];
  request: SolveRequest;
};

type CompletedComparisonState =
  | {
      status: 'success';
      planKey: string;
      solves: Array<PreparedSolve & { result: SolveResult }>;
    }
  | {
      status: 'error';
      planKey: string;
      message: string;
    };

function formatSolveStatus(status: SolveResult['status']): string {
  return status.replaceAll('_', ' ');
}

function formatValue(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }

  return compactNumberFormatter.format(value);
}

function formatDetailValue(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }

  return numberFormatter.format(value);
}

function formatDelta(value: number | null | undefined, fractionDigits = 2): string {
  if (value == null) {
    return '—';
  }

  const formatter = Math.abs(value) >= 1_000
    ? compactNumberFormatter
    : new Intl.NumberFormat('en-AU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
    });
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatter.format(value)}`;
}

function formatShareDelta(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)} pp`;
}

function formatRole(role: string): string {
  return role.replaceAll('_', ' ');
}

function countControlsByMode(scenario: Parameters<typeof buildComparisonScenarioPlan>[0]): Record<string, number> {
  return Object.values(scenario.service_controls).reduce<Record<string, number>>((counts, control) => {
    counts[control.mode] = (counts[control.mode] ?? 0) + 1;
    return counts;
  }, {});
}

function countOptimizedRequiredServices(
  scenario: Parameters<typeof buildComparisonScenarioPlan>[0],
  roleSummary: ReturnType<typeof scenarioRoleSummary>,
): number {
  if (!roleSummary.some((entry) => entry.role === 'required_service')) {
    return 0;
  }

  return Object.entries(scenario.service_controls).reduce((count, [, control]) => {
    return control.mode === 'optimize' ? count + 1 : count;
  }, 0);
}

export default function ComparePage() {
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const appConfig = usePackageStore((state) => state.appConfig);
  const currentConfiguration = usePackageStore((state) => state.currentConfiguration);
  const [completedComparison, setCompletedComparison] = useState<CompletedComparisonState | null>(null);

  const comparisonBuild = useMemo(() => {
    try {
      const plan = buildComparisonScenarioPlan(currentConfiguration, appConfig);
      const solves: PreparedSolve[] = plan.order.map((key) => {
        const scenario = plan.scenarios[key];
        return {
          key,
          scenario,
          request: buildSolveRequest({ sectorStates, appConfig }, scenario),
        };
      });
      const planKey = solves.map((solve) => `${solve.key}:${solve.request.requestId}`).join('|');

      return {
        error: null,
        plan,
        solves,
        planKey,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to prepare compare mode.',
        plan: null,
        solves: null,
        planKey: null,
      };
    }
  }, [appConfig, currentConfiguration, sectorStates]);

  const activeComparison = comparisonBuild.planKey != null
    && completedComparison?.planKey === comparisonBuild.planKey
    ? completedComparison
    : null;
  const isLoading = comparisonBuild.error == null && comparisonBuild.solves != null && activeComparison == null;

  useEffect(() => {
    if (!comparisonBuild.solves || !comparisonBuild.planKey) {
      return;
    }

    let cancelled = false;

    void Promise.all(
      comparisonBuild.solves.map(async (solve) => ({
        ...solve,
        result: await runSolveInWorker(solve.request),
      })),
    )
      .then((solves) => {
        if (cancelled) {
          return;
        }

        setCompletedComparison({
          status: 'success',
          planKey: comparisonBuild.planKey,
          solves,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setCompletedComparison({
          status: 'error',
          planKey: comparisonBuild.planKey,
          message: error instanceof Error ? error.message : 'Unknown compare-mode failure.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [comparisonBuild.planKey, comparisonBuild.solves]);

  const report = useMemo(() => {
    if (comparisonBuild.error || activeComparison?.status !== 'success') {
      return null;
    }

    return buildComparisonReport(appConfig, sectorStates, activeComparison.solves);
  }, [activeComparison, appConfig, comparisonBuild.error, sectorStates]);

  const baseScenario = comparisonBuild.plan?.scenarios.base ?? currentConfiguration;
  const compareScenario = comparisonBuild.plan?.scenarios.compare ?? currentConfiguration;
  const baseRoleSummary = scenarioRoleSummary(baseScenario, appConfig);
  const compareRoleSummary = scenarioRoleSummary(compareScenario, appConfig);
  const baseControlModes = countControlsByMode(baseScenario);
  const compareControlModes = countControlsByMode(compareScenario);

  return (
    <div className="page page--compare">
      <h1>Compare</h1>
      <p>
        Compare mode solves the active configuration alongside targeted transition
        counterfactuals so the app can summarize KPI deltas, state-share shifts, and
        plain-language explanations without pretending the attribution is exact.
      </p>

      <section className="scenario-overview-grid">
        <article className="scenario-panel scenario-panel--hero">
          <span className="scenario-badge">Heuristic compare</span>
          <h2>
            {comparisonBuild.error
              ? 'error'
              : report
                ? `${report.baseScenarioName} vs ${report.compareScenarioName}`
                : isLoading
                  ? 'loading'
                  : 'booting'}
          </h2>
          <p>
            {comparisonBuild.error
              ? comparisonBuild.error
              : report?.heuristicNote
                ?? 'Preparing the reference, transition, and withheld-delta solves for compare mode.'}
          </p>

          <dl className="scenario-key-value-list">
            <div>
              <dt>Configuration solves</dt>
              <dd>{comparisonBuild.solves?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Milestone years</dt>
              <dd>{currentConfiguration.years.join(', ')}</dd>
            </div>
            <div>
              <dt>Reference status</dt>
              <dd>
                {report?.scenarioStatuses.find((entry) => entry.key === 'base')
                  ? formatSolveStatus(report.scenarioStatuses.find((entry) => entry.key === 'base')!.status)
                  : isLoading
                    ? 'loading'
                    : '—'}
              </dd>
            </div>
            <div>
              <dt>Compare status</dt>
              <dd>
                {report?.scenarioStatuses.find((entry) => entry.key === 'compare')
                  ? formatSolveStatus(report.scenarioStatuses.find((entry) => entry.key === 'compare')!.status)
                  : isLoading
                    ? 'loading'
                    : '—'}
              </dd>
            </div>
          </dl>

          {report?.compareScenarioDescription ? (
            <p className="scenario-provenance-note">{report.compareScenarioDescription}</p>
          ) : null}

          {activeComparison?.status === 'error' ? (
            <p className="results-error-text compare-inline-error">{activeComparison.message}</p>
          ) : null}
        </article>

        <article className="scenario-panel">
          <h2>Reference Configuration</h2>
          <dl className="scenario-key-value-list">
            <div>
              <dt>Name</dt>
              <dd>{baseScenario.name}</dd>
            </div>
            <div>
              <dt>Commodity pricing</dt>
              <dd>Per-commodity selections</dd>
            </div>
            <div>
              <dt>2050 carbon price</dt>
              <dd>{formatDetailValue(baseScenario.carbon_price['2050'] ?? 0)}</dd>
            </div>
            <div>
              <dt>Electricity control</dt>
              <dd>{formatRole(baseScenario.service_controls.electricity?.mode ?? 'n/a')}</dd>
            </div>
            <div>
              <dt>Optimize controls</dt>
              <dd>{baseControlModes.optimize ?? 0}</dd>
            </div>
          </dl>
          <div className="compare-chip-row">
            {baseRoleSummary.map((entry) => (
              <span key={entry.role} className="library-tag">
                {formatRole(entry.role)}: {entry.count}
              </span>
            ))}
          </div>
        </article>

        <article className="scenario-panel">
          <h2>Transition Configuration</h2>
          <dl className="scenario-key-value-list">
            <div>
              <dt>Name</dt>
              <dd>{compareScenario.name}</dd>
            </div>
            <div>
              <dt>Commodity pricing</dt>
              <dd>Per-commodity selections</dd>
            </div>
            <div>
              <dt>2050 carbon price</dt>
              <dd>{formatDetailValue(compareScenario.carbon_price['2050'] ?? 0)}</dd>
            </div>
            <div>
              <dt>Electricity control</dt>
              <dd>{formatRole(compareScenario.service_controls.electricity?.mode ?? 'n/a')}</dd>
            </div>
            <div>
              <dt>Optimize controls</dt>
              <dd>{countOptimizedRequiredServices(compareScenario, compareRoleSummary)}</dd>
            </div>
          </dl>
          <div className="compare-chip-row">
            {Object.entries(compareControlModes).map(([mode, count]) => (
              <span key={mode} className="library-tag">
                {formatRole(mode)}: {count}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="scenario-panel">
        <h2>KPI Delta Summary</h2>
        <div className="results-raw-grid">
          {(report?.metrics ?? []).map((metric) => (
            <article key={metric.id} className="results-card compare-metric-card">
              <span className="results-card-label">{metric.unit}</span>
              <strong>{formatValue(metric.compare)}</strong>
              <p>{metric.label}</p>
              <div className="compare-metric-subtext">
                <span>Reference {formatValue(metric.base)}</span>
                <span>{formatDelta(metric.delta)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="scenario-panel">
        <h2>Heuristic Delta Decomposition</h2>
        <p>
          Each card compares the full transition counterfactual against a withheld version of
          that same configuration, so the numbers are intentionally local heuristics rather than a
          perfect additive accounting identity.
        </p>
        <div className="results-raw-grid">
          {(report?.decomposition ?? []).map((effect) => (
            <article key={effect.id} className="results-card compare-effect-card">
              <span className="results-card-label">Heuristic isolate</span>
              <strong>{effect.title}</strong>
              <p>{effect.summary}</p>
              <dl className="scenario-key-value-list compare-tight-list">
                <div>
                  <dt>Cost delta</dt>
                  <dd>{formatDelta(effect.costDelta)}</dd>
                </div>
                <div>
                  <dt>Emissions delta</dt>
                  <dd>{formatDelta(effect.emissionsDelta)}</dd>
                </div>
                <div>
                  <dt>Electricity delta</dt>
                  <dd>{formatDelta(effect.electricityDemandDelta)}</dd>
                </div>
              </dl>
              {effect.note ? <p className="compare-effect-note">{effect.note}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="scenario-panel">
        <h2>Plain-Language Narratives</h2>
        <div className="compare-detail-grid">
          {(report?.narratives ?? []).map((narrative) => (
            <article key={narrative.id} className="results-card compare-narrative-card">
              <span className="results-card-label">Narrative</span>
              <strong>{narrative.title}</strong>
              <p>{narrative.summary}</p>
              {narrative.evidence ? <p className="compare-evidence-text">{narrative.evidence}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="compare-detail-grid compare-detail-grid--panels">
        <article className="scenario-panel compare-detail-panel">
          <h2>Sector Emissions Delta</h2>
          <div className="compare-list">
            {(report?.sectorEmissionDeltas ?? []).slice(0, 8).map((entry) => (
              <article key={entry.sector} className="compare-list-item">
                <div className="compare-list-header">
                  <strong>{entry.sector.replaceAll('_', ' ')}</strong>
                  <span>{formatDelta(entry.totalDelta)}</span>
                </div>
                <div className="compare-year-row">
                  {entry.yearly.map((yearEntry) => (
                    <span key={yearEntry.year} className="compare-year-pill">
                      {yearEntry.year}: {formatDelta(yearEntry.delta)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="scenario-panel compare-detail-panel">
          <h2>Commodity Demand Delta</h2>
          <div className="compare-list">
            {(report?.commodityDemandDeltas ?? []).slice(0, 8).map((entry) => (
              <article key={entry.commodityId} className="compare-list-item">
                <div className="compare-list-header">
                  <strong>{entry.label}</strong>
                  <span>{formatDelta(entry.totalDelta)}</span>
                </div>
                <div className="compare-year-row">
                  {entry.yearly.map((yearEntry) => (
                    <span key={yearEntry.year} className="compare-year-pill">
                      {yearEntry.year}: {formatDelta(yearEntry.delta)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="compare-detail-grid compare-detail-grid--panels">
        <article className="scenario-panel compare-detail-panel">
          <h2>Electricity Delta By Year</h2>
          <div className="compare-list">
            {(report?.electricityDeltas ?? []).map((entry) => (
              <article key={entry.year} className="compare-list-item">
                <div className="compare-list-header">
                  <strong>{entry.year}</strong>
                  <span>{entry.baseMode} → {entry.compareMode}</span>
                </div>
                <dl className="scenario-key-value-list compare-tight-list">
                  <div>
                    <dt>Supply</dt>
                    <dd>{formatDelta(entry.supplyDelta)}</dd>
                  </div>
                  <div>
                    <dt>Modeled demand</dt>
                    <dd>{formatDelta(entry.modeledDemandDelta)}</dd>
                  </div>
                  <div>
                    <dt>Total demand</dt>
                    <dd>{formatDelta(entry.totalDemandDelta)}</dd>
                  </div>
                  <div>
                    <dt>Average cost</dt>
                    <dd>{formatDelta(entry.averageSupplyCostDelta)}</dd>
                  </div>
                  <div>
                    <dt>Emissions intensity</dt>
                    <dd>{formatDelta(entry.averageDirectEmissionsIntensityDelta)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </article>

        <article className="scenario-panel compare-detail-panel">
          <h2>Confidence Exposure Delta</h2>
          <div className="compare-list">
            {(report?.confidenceDeltas ?? []).map((entry) => (
              <article key={entry.rating} className="compare-list-item">
                <div className="compare-list-header">
                  <strong>{entry.rating}</strong>
                  <span>{formatDelta(entry.activityDelta)}</span>
                </div>
                <dl className="scenario-key-value-list compare-tight-list">
                  <div>
                    <dt>Activity</dt>
                    <dd>{formatDelta(entry.activityDelta)}</dd>
                  </div>
                  <div>
                    <dt>Cost</dt>
                    <dd>{formatDelta(entry.costDelta)}</dd>
                  </div>
                  <div>
                    <dt>Emissions</dt>
                    <dd>{formatDelta(entry.emissionsDelta)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="scenario-panel">
        <h2>State-Choice Attribution</h2>
        <p>
          These cards highlight where the dominant state changed or where share movement was
          large enough to matter, then attach a simple technical signal instead of claiming a
          full causal proof.
        </p>
        <div className="compare-detail-grid">
          {(report?.stateShareDeltas ?? []).slice(0, 8).map((entry) => (
            <article key={`${entry.outputId}:${entry.year}`} className="results-card compare-state-card">
              <span className="results-card-label">{entry.year}</span>
              <strong>{entry.outputLabel}</strong>
              <p>{entry.narrative}</p>
              <dl className="scenario-key-value-list compare-tight-list">
                <div>
                  <dt>Reference leader</dt>
                  <dd>{entry.fromStateLabel}</dd>
                </div>
                <div>
                  <dt>Compare leader</dt>
                  <dd>{entry.toStateLabel}</dd>
                </div>
                <div>
                  <dt>Winning share delta</dt>
                  <dd>{entry.winningStateLabel} {formatShareDelta(entry.winningShareDelta)}</dd>
                </div>
                <div>
                  <dt>Losing share delta</dt>
                  <dd>{entry.losingStateLabel} {formatShareDelta(entry.losingShareDelta)}</dd>
                </div>
              </dl>
              {entry.signals.length > 0 ? (
                <div className="compare-chip-row">
                  {entry.signals.map((signal) => (
                    <span key={signal} className="library-tag">
                      {signal}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

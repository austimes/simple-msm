import { useEffect, useMemo, useState } from 'react';
import { usePackageStore } from '../data/packageStore';
import { buildSolveRequest } from '../solver/buildSolveRequest';
import type { SolveRequest, SolveResult } from '../solver/contract';
import { runSolveInWorker } from '../solver/solverClient';

const numberFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
});

type CompletedSolveState =
  | {
      status: 'success';
      request: SolveRequest;
      result: SolveResult;
    }
  | {
      status: 'error';
      request: SolveRequest;
      message: string;
    };

function formatSolveStatus(status: SolveResult['status']): string {
  return status.replaceAll('_', ' ');
}

function formatDiagnosticSeverity(severity: string): string {
  return severity.toUpperCase();
}

function formatReasonLabel(reason: string | undefined): string | null {
  if (!reason) {
    return null;
  }

  return reason.replaceAll('_', ' ');
}

function formatModeLabel(mode: string): string {
  return mode.replaceAll('_', ' ');
}

function formatConstraintKind(kind: string): string {
  return kind.replaceAll('_', ' ');
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) {
    return '—';
  }

  return numberFormatter.format(value);
}

function formatShare(value: number | null): string {
  if (value == null) {
    return '—';
  }

  return `${(value * 100).toFixed(1)}%`;
}

function countDistinctOutputs(request: SolveRequest): number {
  return new Set(request.rows.map((row) => row.outputId)).size;
}

function formatDiagnosticLocation(diagnostic: SolveResult['diagnostics'][number]): string | null {
  const parts = [diagnostic.outputId, diagnostic.year != null ? String(diagnostic.year) : null, diagnostic.stateId]
    .filter(Boolean);

  return parts.length > 0 ? parts.join(' / ') : null;
}

function formatBindingLocation(constraint: SolveResult['reporting']['bindingConstraints'][number]): string {
  const parts = [constraint.outputLabel, String(constraint.year), constraint.stateLabel].filter(Boolean);
  return parts.join(' / ');
}

export default function ResultsPage() {
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const appConfig = usePackageStore((state) => state.appConfig);
  const defaultScenario = usePackageStore((state) => state.defaultScenario);
  const [completedSolve, setCompletedSolve] = useState<CompletedSolveState | null>(null);

  const requestBuild = useMemo(() => {
    try {
      return {
        request: buildSolveRequest({
          sectorStates,
          appConfig,
          defaultScenario,
        }),
        error: null,
      };
    } catch (error) {
      return {
        request: null,
        error: error instanceof Error ? error.message : 'Failed to build solve request.',
      };
    }
  }, [appConfig, defaultScenario, sectorStates]);

  const request = requestBuild.request;
  const activeSolve = request && completedSolve?.request.requestId === request.requestId
    ? completedSolve
    : null;
  const result = activeSolve?.status === 'success' ? activeSolve.result : null;
  const isLoading = requestBuild.error == null && request != null && activeSolve == null;
  const electricityBalances = result?.reporting.commodityBalances.filter(
    (summary) => summary.commodityId === 'electricity',
  ) ?? [];
  const electricityStateShares = result?.reporting.stateShares.filter(
    (summary) => summary.outputId === 'electricity',
  ) ?? [];
  const bindingConstraints = result?.reporting.bindingConstraints ?? [];

  useEffect(() => {
    if (!request) {
      return;
    }

    let cancelled = false;

    void runSolveInWorker(request)
      .then((workerResult) => {
        if (cancelled) {
          return;
        }

        setCompletedSolve({
          status: 'success',
          request,
          result: workerResult,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setCompletedSolve({
          status: 'error',
          request,
          message: error instanceof Error ? error.message : 'Unknown solve failure.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [request]);

  return (
    <div className="page">
      <h1>Results</h1>
      <p>
        The solver now normalizes the library package, resolves the scenario into a stable
        request contract, and runs the service-and-supply LP core in a dedicated worker so
        the main UI thread stays free.
      </p>

      <section className="scenario-overview-grid">
        <article className="scenario-panel scenario-panel--hero">
          <span className="scenario-badge">Scenario LP</span>
          <h2>
            {requestBuild.error
              ? 'error'
              : result
                ? formatSolveStatus(result.status)
                : isLoading
                  ? 'loading'
                  : 'booting'}
          </h2>
          <p>
            {result
              ? 'The request crossed the worker boundary, executed through the generic service-and-supply LP core, and returned structured electricity-balance reporting alongside the raw diagnostics.'
              : requestBuild.error
                ? requestBuild.error
              : 'Preparing the normalized request and dispatching the solve worker.'}
          </p>

          <dl className="scenario-key-value-list">
            <div>
              <dt>Scenario</dt>
              <dd>{request?.scenario.name ?? defaultScenario.name}</dd>
            </div>
            <div>
              <dt>Contract version</dt>
              <dd>{request?.contractVersion ?? '—'}</dd>
            </div>
            <div>
              <dt>Milestone years</dt>
              <dd>{request?.scenario.years.join(', ') ?? defaultScenario.years.join(', ')}</dd>
            </div>
            <div>
              <dt>Request ID</dt>
              <dd>{request?.requestId.slice(0, 8) ?? '—'}</dd>
            </div>
          </dl>
        </article>

        <article className="scenario-panel">
          <h2>Normalized inputs</h2>
          <div className="scenario-stat-grid">
            <div className="scenario-stat-card">
              <span>Library rows</span>
              <strong>{request?.rows.length ?? sectorStates.length}</strong>
            </div>
            <div className="scenario-stat-card">
              <span>Distinct outputs</span>
              <strong>{request ? countDistinctOutputs(request) : Object.keys(appConfig.output_roles).length}</strong>
            </div>
            <div className="scenario-stat-card">
              <span>External commodity tables</span>
              <strong>
                {request
                  ? Object.keys(request.scenario.externalCommodityDemandByCommodity).length
                  : Object.keys(defaultScenario.external_commodity_demands ?? {}).length}
              </strong>
            </div>
          </div>
        </article>

        <article className="scenario-panel">
          <h2>Worker timings</h2>
          <div className="scenario-stat-grid">
            <div className="scenario-stat-card">
              <span>Total time</span>
              <strong>{result ? `${result.timingsMs.total.toFixed(2)} ms` : '…'}</strong>
            </div>
            <div className="scenario-stat-card">
              <span>LP adapter time</span>
              <strong>{result ? `${result.timingsMs.solve.toFixed(2)} ms` : '…'}</strong>
            </div>
            <div className="scenario-stat-card">
              <span>Engine</span>
              <strong>{result?.engine.name ?? 'yalps'}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="scenario-panel">
        <h2>Electricity Mode And Balance</h2>
        {result ? (
          electricityBalances.length > 0 ? (
            <div className="results-raw-grid">
              {electricityBalances.map((summary) => {
                const yearShares = electricityStateShares.filter((share) => share.year === summary.year);

                return (
                  <article key={summary.year} className="results-card">
                    <span className="results-card-label">{summary.year}</span>
                    <strong>{formatModeLabel(summary.mode)}</strong>
                    <p>
                      {summary.mode === 'endogenous'
                        ? 'Electricity stays in-model and the solver enforces annual balance against modeled consumption plus residual external demand.'
                        : 'Electricity supply states are bypassed and all electricity purchases stay on the exogenous price table for this year.'}
                    </p>

                    <dl className="scenario-key-value-list">
                      <div>
                        <dt>Supply</dt>
                        <dd>{formatNumber(summary.supply)}</dd>
                      </div>
                      <div>
                        <dt>Modeled demand</dt>
                        <dd>{formatNumber(summary.modeledDemand)}</dd>
                      </div>
                      <div>
                        <dt>External demand</dt>
                        <dd>{formatNumber(summary.externalDemand)}</dd>
                      </div>
                      <div>
                        <dt>Total demand</dt>
                        <dd>{formatNumber(summary.totalDemand)}</dd>
                      </div>
                      <div>
                        <dt>Balance gap</dt>
                        <dd>{formatNumber(summary.balanceGap)}</dd>
                      </div>
                      <div>
                        <dt>Avg supply cost</dt>
                        <dd>{formatNumber(summary.averageSupplyCost)}</dd>
                      </div>
                      <div>
                        <dt>Avg direct emissions</dt>
                        <dd>{formatNumber(summary.averageDirectEmissionsIntensity)}</dd>
                      </div>
                      <div>
                        <dt>Exogenous purchases</dt>
                        <dd>{formatNumber(summary.pricedExogenousDemand)}</dd>
                      </div>
                    </dl>

                    {yearShares.length > 0 ? (
                      <dl className="scenario-key-value-list">
                        {yearShares.map((share) => (
                          <div key={`${share.year}:${share.stateId}`}>
                            <dt>{share.stateLabel}</dt>
                            <dd>{formatNumber(share.activity)} / {formatShare(share.share)}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p>No electricity supply rows were present in the solved request.</p>
          )
        ) : (
          <p>Waiting for the worker response.</p>
        )}
      </section>

      <section className="scenario-panel">
        <h2>Binding Constraints</h2>
        {result ? (
          bindingConstraints.length > 0 ? (
            <div className="results-raw-grid">
              {bindingConstraints.map((constraint) => (
                <article
                  key={`${constraint.constraintId}:${constraint.outputId}:${constraint.year}:${constraint.stateId ?? 'all'}`}
                  className="results-card"
                >
                  <span className="results-card-label">{constraint.year}</span>
                  <strong>{formatConstraintKind(constraint.kind)}</strong>
                  <p>{constraint.message}</p>
                  <dl className="scenario-key-value-list">
                    <div>
                      <dt>Scope</dt>
                      <dd>{formatBindingLocation(constraint)}</dd>
                    </div>
                    <div>
                      <dt>Bound</dt>
                      <dd>{constraint.boundType} {formatNumber(constraint.boundValue)}</dd>
                    </div>
                    <div>
                      <dt>Actual</dt>
                      <dd>{formatNumber(constraint.actualValue)}</dd>
                    </div>
                    <div>
                      <dt>Slack</dt>
                      <dd>{formatNumber(constraint.slack)}</dd>
                    </div>
                    <div>
                      <dt>Mode</dt>
                      <dd>{constraint.mode ? formatModeLabel(constraint.mode) : '—'}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <p>No modeled caps or control constraints were binding in the solved run.</p>
          )
        ) : (
          <p>Waiting for the worker response.</p>
        )}
      </section>

      <section className="scenario-panel">
        <h2>Raw adapter output</h2>
        {result ? (
          <div className="results-raw-grid">
            <article className="results-card">
              <span className="results-card-label">Artifact kind</span>
              <strong>{result.raw?.kind ?? 'none'}</strong>
              <p>
                {result.raw?.notes[0] ??
                  'The worker will attach raw scenario-LP artifacts here once the adapter returns.'}
              </p>
            </article>
            <article className="results-card">
              <span className="results-card-label">Objective</span>
              <strong>{result.raw?.objectiveKey ?? '—'}</strong>
              <p>
                {result.raw
                  ? `${result.raw.objectiveDirection} with ${result.raw.variableCount} variables and ${result.raw.constraintCount} constraints`
                  : 'No LP artifact was returned.'}
              </p>
            </article>
            <article className="results-card">
              <span className="results-card-label">Solution status</span>
              <strong>{result.raw?.solutionStatus ?? '—'}</strong>
              <p>
                {result.raw?.objectiveValue == null
                  ? 'No objective value returned.'
                  : `Objective value ${result.raw.objectiveValue.toFixed(3)}`}
              </p>
            </article>
          </div>
        ) : (
          <p>Waiting for the worker response.</p>
        )}

        {result?.raw ? (
          <pre className="results-code-block">
            {JSON.stringify(
              {
                variables: result.raw.variables,
                notes: result.raw.notes,
              },
              null,
              2,
            )}
          </pre>
        ) : null}
      </section>

      <section className="scenario-panel">
        <h2>Diagnostics</h2>
        {requestBuild.error ? (
          <p className="results-error-text">{requestBuild.error}</p>
        ) : activeSolve?.status === 'error' ? (
          <p className="results-error-text">{activeSolve.message}</p>
        ) : result ? (
          <ul className="results-diagnostic-list">
            {result.diagnostics.map((diagnostic) => (
              <li
                key={`${diagnostic.code}:${diagnostic.outputId ?? 'global'}:${diagnostic.year ?? 'all'}:${diagnostic.stateId ?? 'all'}:${diagnostic.message}`}
                className="results-diagnostic-item"
              >
                <span className={`results-severity-pill results-severity-pill--${diagnostic.severity}`}>
                  {formatDiagnosticSeverity(diagnostic.severity)}
                </span>
                <div>
                  <strong>{diagnostic.code}</strong>
                  {formatReasonLabel(diagnostic.reason) ? (
                    <p><em>{formatReasonLabel(diagnostic.reason)}</em></p>
                  ) : null}
                  {formatDiagnosticLocation(diagnostic) ? (
                    <p>{formatDiagnosticLocation(diagnostic)}</p>
                  ) : null}
                  <p>{diagnostic.message}</p>
                  {diagnostic.suggestion ? <p>{diagnostic.suggestion}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>Running the worker-backed solver adapter.</p>
        )}
      </section>
    </div>
  );
}

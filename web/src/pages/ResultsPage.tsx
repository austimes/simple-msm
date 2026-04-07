import { useEffect, useMemo, useState } from 'react';
import { usePackageStore } from '../data/packageStore';
import { buildSolveRequest } from '../solver/buildSolveRequest';
import type { SolveRequest, SolveResult } from '../solver/contract';
import { runSolveInWorker } from '../solver/solverClient';

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

function countDistinctOutputs(request: SolveRequest): number {
  return new Set(request.rows.map((row) => row.outputId)).size;
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
        request contract, and runs the required-service LP core in a dedicated worker so
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
              ? 'The request crossed the worker boundary, executed through the generic required-service LP core, and returned raw diagnostics.'
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
              <li key={diagnostic.code} className="results-diagnostic-item">
                <span className={`results-severity-pill results-severity-pill--${diagnostic.severity}`}>
                  {formatDiagnosticSeverity(diagnostic.severity)}
                </span>
                <div>
                  <strong>{diagnostic.code}</strong>
                  <p>{diagnostic.message}</p>
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

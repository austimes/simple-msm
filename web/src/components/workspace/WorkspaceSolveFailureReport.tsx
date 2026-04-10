import type {
  SolveBindingConstraintSummary,
  SolveDiagnostic,
  SolveSoftConstraintViolationSummary,
} from '../../solver/contract.ts';
import type { ConfigurationSolveFailure } from '../../solver/configurationSolveFailure.ts';

function formatCount(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function formatSeverity(severity: SolveDiagnostic['severity']): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function formatSolveStatus(value: string): string {
  return value.replaceAll('_', ' ');
}

function buildConstraintLabel(
  constraint: SolveBindingConstraintSummary | SolveSoftConstraintViolationSummary,
): string {
  const parts = [constraint.outputLabel, String(constraint.year)];

  if (constraint.stateLabel) {
    parts.push(constraint.stateLabel);
  }

  return parts.join(' / ');
}

interface ConstraintListProps {
  title: string;
  items: Array<SolveBindingConstraintSummary | SolveSoftConstraintViolationSummary>;
}

function ConstraintList({ title, items }: ConstraintListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="workspace-failure-section">
      <h3>{title}</h3>
      <ul className="workspace-failure-list">
        {items.map((item) => (
          <li key={item.constraintId} className="workspace-failure-list-item">
            <strong>{buildConstraintLabel(item)}</strong>
            <p>{item.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function WorkspaceSolveFailureReport({ failure }: { failure: ConfigurationSolveFailure }) {
  const diagnosticErrors = failure.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const diagnosticWarnings = failure.diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
  const bindingConstraints = failure.result?.reporting.bindingConstraints ?? [];
  const softConstraintViolations = failure.result?.reporting.softConstraintViolations ?? [];

  return (
    <article className="workspace-failure-report" aria-live="polite">
      <div className="workspace-failure-report__header">
        <span className={`workspace-failure-badge workspace-failure-badge--${failure.stage}`}>
          {failure.stage === 'build' ? 'Build failure' : 'Solve failure'}
        </span>
        <h2>{failure.headline}</h2>
        {failure.result?.raw?.solutionStatus ? (
          <p className="workspace-failure-report__subtitle">
            Solver status: {formatSolveStatus(failure.result.raw.solutionStatus)}
          </p>
        ) : null}
      </div>

      {failure.detailLines.length > 0 ? (
        <section className="workspace-failure-section">
          <h3>Failure detail</h3>
          <ul className="workspace-failure-list">
            {failure.detailLines.map((line) => (
              <li key={line} className="workspace-failure-list-item">
                <p>{line}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {failure.result ? (
        <section className="workspace-failure-section">
          <h3>Context</h3>
          <div className="workspace-failure-metadata">
            <span>{formatCount('error diagnostic', diagnosticErrors.length)}</span>
            <span>{formatCount('warning diagnostic', diagnosticWarnings.length)}</span>
            <span>{formatCount('row', failure.result.summary.rowCount)}</span>
            <span>{formatCount('output', failure.result.summary.outputCount)}</span>
            <span>{formatCount('year', failure.result.summary.yearCount)}</span>
          </div>
        </section>
      ) : null}

      {failure.diagnostics.length > 0 ? (
        <section className="workspace-failure-section">
          <h3>Diagnostics</h3>
          <ul className="workspace-failure-diagnostics">
            {failure.diagnostics.map((diagnostic, index) => (
              <li
                key={`${diagnostic.code}:${diagnostic.outputId ?? ''}:${diagnostic.year ?? ''}:${index}`}
                className="workspace-failure-diagnostic"
              >
                <div className={`results-severity-pill results-severity-pill--${diagnostic.severity}`}>
                  {formatSeverity(diagnostic.severity)}
                </div>
                <div>
                  <strong>{diagnostic.message}</strong>
                  <p>
                    {[
                      diagnostic.outputId ? `output ${diagnostic.outputId}` : null,
                      diagnostic.year != null ? `year ${diagnostic.year}` : null,
                      diagnostic.stateId ? `state ${diagnostic.stateId}` : null,
                      diagnostic.reason ? `reason ${formatSolveStatus(diagnostic.reason)}` : null,
                    ].filter(Boolean).join(' • ')}
                  </p>
                  {diagnostic.relatedConstraintIds && diagnostic.relatedConstraintIds.length > 0 ? (
                    <p>Related constraints: {diagnostic.relatedConstraintIds.join(', ')}</p>
                  ) : null}
                  {diagnostic.suggestion ? <p>Suggestion: {diagnostic.suggestion}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConstraintList title="Binding constraints" items={bindingConstraints} />
      <ConstraintList title="Soft-constraint violations" items={softConstraintViolations} />
    </article>
  );
}

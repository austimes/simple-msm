import React from 'react';
import { Link } from 'react-router-dom';
import type { ModelFormulationViewModel } from './modelFormulationModel.ts';

function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }

  return new Intl.NumberFormat('en-AU', {
    maximumFractionDigits,
  }).format(value);
}

function renderEquationCard(title: string, body: string, note?: string): React.JSX.Element {
  return (
    <article key={title} className="methods-content-card">
      <h3>{title}</h3>
      <pre className="model-formulation-equation">
        <code>{body}</code>
      </pre>
      {note ? <p className="library-inline-note">{note}</p> : null}
    </article>
  );
}

export default function ModelFormulationPageContent({
  model,
}: {
  model: ModelFormulationViewModel;
}): React.JSX.Element {
  return (
    <div className="page page--model-formulation">
      <h1>{model.title}</h1>
      {model.intro.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      <section className="configuration-overview-grid">
        <article className="configuration-panel configuration-panel--hero">
          <span className="configuration-badge">Read-only explainer</span>
          <h2>What this page covers</h2>
          <p>
            It documents the current LP core, the pre-solve configuration resolution path, and the
            post-solve overlay closure path used by the app today.
          </p>
          <p>
            Nothing on this page edits the active document, runs the solver, or changes any
            controls. It is here to make the solve wiring explicit.
          </p>
          {model.liveExamplesWarning ? (
            <div className="configuration-provenance-note">
              <strong>Live example note.</strong>
              <p>{model.liveExamplesWarning}</p>
            </div>
          ) : null}
        </article>

        <article className="configuration-panel">
          <h2>At a glance</h2>
          <div className="configuration-stat-grid">
            {model.stats.map((stat) => (
              <div key={stat.label} className="configuration-stat-card">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="configuration-panel">
        <h2>Solve pipeline</h2>
        <p>
          The app moves from packaged state rows to a normalized request, then solves the LP, then
          layers the 2025 residual accounting closure back on afterward.
        </p>
        <div className="model-formulation-pipeline">
          {model.pipelineSteps.map((step) => (
            <article key={step.title} className="configuration-demand-card">
              <h3>{step.title}</h3>
              <p>{step.summary}</p>
              <div className="library-tag-list">
                {step.artifacts.map((artifact) => (
                  <span key={artifact} className="library-tag">
                    {artifact}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="configuration-panel">
        <h2>Symbols and equations</h2>
        <p>
          The notation below matches the current implementation in `buildSolveRequest.ts`,
          `solveRequestModel.ts`, and `lpAdapter.ts`. The equations are rendered as code-style
          blocks on purpose so the page stays dependency-free.
        </p>

        <div className="library-mini-table model-formulation-symbol-table">
          <div className="library-mini-table-row library-mini-table-row--header">
            <span>Symbol</span>
            <span>Meaning</span>
          </div>
          {model.symbols.map((symbol) => (
            <div key={symbol.symbol} className="library-mini-table-row">
              <span>
                <code>{symbol.symbol}</code>
              </span>
              <span>{symbol.meaning}</span>
            </div>
          ))}
        </div>

        <div className="model-formulation-equation-grid">
          {model.equations.map((equation) =>
            renderEquationCard(equation.title, equation.body, equation.note),
          )}
        </div>

        <h3>Service demand resolution</h3>
        <div className="model-formulation-equation-grid">
          {model.serviceDemandEquations.map((equation) =>
            renderEquationCard(equation.title, equation.body, equation.note),
          )}
        </div>

        <h3>Commodity balance logic</h3>
        <div className="model-formulation-equation-grid">
          {model.commodityBalanceEquations.map((equation) =>
            renderEquationCard(equation.title, equation.body, equation.note),
          )}
        </div>

        <div className="configuration-provenance-note">
          <strong>Optional activities stay separate.</strong>
          <p>
            Optional-activity rows like removals have no demand-equality constraint; they only
            appear if cost, carbon price, and caps make them attractive.
          </p>
        </div>
      </section>

      <section className="configuration-panel">
        <h2>Demand growth before solve</h2>
        <p>
          The active document resolves service demand and external commodity demand before the LP is
          assembled. In the anchor-based modes, the page is documenting the same pre-solve logic
          that `demandResolution.ts` applies.
        </p>
        <pre className="model-formulation-equation">
          <code>
            {'resolved_value_y = anchor * (1 + growth_rate_pct_per_year / 100)^(y - anchor_year)'}
          </code>
        </pre>
        <p>
          If `year_overrides` contains a value for the output and year, that direct number replaces
          the formula result in the resolved table.
        </p>

        {model.demandExample ? (
          <>
            <div className="configuration-stat-grid">
              <div className="configuration-stat-card">
                <span>Worked output</span>
                <strong>{model.demandExample.outputLabel}</strong>
              </div>
              <div className="configuration-stat-card">
                <span>Anchor year</span>
                <strong>{model.demandExample.anchorYear}</strong>
              </div>
              <div className="configuration-stat-card">
                <span>Anchor value</span>
                <strong>{formatNumber(model.demandExample.anchorValue)}</strong>
              </div>
              <div className="configuration-stat-card">
                <span>Growth rate</span>
                <strong>
                  {model.demandExample.growthRatePctPerYear == null
                    ? 'Manual'
                    : `${formatNumber(model.demandExample.growthRatePctPerYear)}%`}
                </strong>
              </div>
              <div className="configuration-stat-card">
                <span>Target year</span>
                <strong>{model.demandExample.targetYear}</strong>
              </div>
              <div className="configuration-stat-card">
                <span>Resolved value</span>
                <strong>{formatNumber(model.demandExample.resolvedValue)}</strong>
              </div>
            </div>

            <div className="configuration-provenance-note">
              <strong>Worked example details.</strong>
              <p>{model.demandExample.note}</p>
              <p>
                Formula result for {model.demandExample.targetYear}:{' '}
                <strong>
                  {model.demandExample.formulaValue == null
                    ? 'Not applicable in manual_table mode'
                    : formatNumber(model.demandExample.formulaValue)}
                </strong>
                . Resolved table value:{' '}
                <strong>{formatNumber(model.demandExample.resolvedValue)}</strong>.
              </p>
            </div>

            <div className="library-mini-table model-formulation-source-table">
              <div className="library-mini-table-row library-mini-table-row--header">
                <span>Year</span>
                <span>Resolved demand</span>
                <span>Override applied</span>
              </div>
              {model.demandExample.yearValues.map((entry) => (
                <div key={entry.year} className="library-mini-table-row">
                  <span>{entry.year}</span>
                  <span>{formatNumber(entry.value)}</span>
                  <span>{entry.overridden ? 'Yes' : 'No'}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="library-empty-state">
            Live service-demand examples are unavailable for the active configuration.
          </div>
        )}
      </section>

      <section className="configuration-panel">
        <h2>Worked objective example</h2>
        <p>
          The row objective is the current LP coefficient used in `lpAdapter.ts`: row conversion
          cost plus exogenous commodity-input cost plus direct-emissions carbon cost.
        </p>

        {model.objectiveExample ? (
          <>
            <div className="configuration-stat-grid">
              <div className="configuration-stat-card">
                <span>Example row</span>
                <strong>{model.objectiveExample.stateLabel}</strong>
              </div>
              <div className="configuration-stat-card">
                <span>Output / year</span>
                <strong>
                  {model.objectiveExample.outputLabel} {model.objectiveExample.year}
                </strong>
              </div>
              <div className="configuration-stat-card">
                <span>Conversion cost</span>
                <strong>{formatNumber(model.objectiveExample.conversionCost)}</strong>
              </div>
              <div className="configuration-stat-card">
                <span>Exogenous commodity cost</span>
                <strong>{formatNumber(model.objectiveExample.exogenousCommodityCost)}</strong>
              </div>
              <div className="configuration-stat-card">
                <span>Carbon cost</span>
                <strong>{formatNumber(model.objectiveExample.carbonCost)}</strong>
              </div>
              <div className="configuration-stat-card">
                <span>Total objective coefficient</span>
                <strong>{formatNumber(model.objectiveExample.totalObjectiveCoefficient)}</strong>
              </div>
            </div>

            <div className="library-mini-table model-formulation-objective-table">
              <div className="library-mini-table-row library-mini-table-row--header">
                <span>Commodity</span>
                <span>Coefficient</span>
                <span>Resolved price</span>
                <span>Included in objective</span>
                <span>Contribution</span>
              </div>
              {model.objectiveExample.commodityContributions.map((entry) => (
                <div
                  key={`${entry.commodityId}:${entry.unit}:${entry.includedInObjective}`}
                  className="library-mini-table-row"
                >
                  <span>{entry.commodityLabel}</span>
                  <span>
                    {formatNumber(entry.coefficient, 4)} {entry.unit}
                  </span>
                  <span>{formatNumber(entry.price, 4)}</span>
                  <span>{entry.includedInObjective ? 'Yes' : 'No'}</span>
                  <span>{formatNumber(entry.contribution, 4)}</span>
                </div>
              ))}
            </div>

            <div className="configuration-provenance-note">
              <strong>Why some inputs can be excluded.</strong>
              <p>{model.objectiveExample.note}</p>
              <p>
                Direct-emissions intensity is {formatNumber(model.objectiveExample.carbonIntensity, 4)} and
                the active `carbon_price` for {model.objectiveExample.year} is{' '}
                {formatNumber(model.objectiveExample.carbonPrice, 4)}.
              </p>
            </div>
          </>
        ) : (
          <div className="library-empty-state">
            Live objective examples are unavailable for the active configuration.
          </div>
        )}
      </section>

      <section className="configuration-panel">
        <h2>Source mapping</h2>
        <p>
          This table ties the page back to the exact package files and app registries that shape the
          LP. It is the shortest route from `shared/families.csv`, `families/*/family_states.csv`,
          and the active JSON configuration to the symbols and equations above.
        </p>

        <div className="library-mini-table model-formulation-source-table">
          <div className="library-mini-table-row library-mini-table-row--header">
            <span>Source</span>
            <span>Maps to</span>
            <span>How it enters the formulation</span>
          </div>
          {model.sourceMapping.map((row) => (
            <div key={row.source} className="library-mini-table-row">
              <span>{row.source}</span>
              <span>{row.mapsTo}</span>
              <span>{row.howItEnters}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="configuration-panel">
        <h2>How overlays are added after the LP</h2>
        <p>
          Residual overlays are loaded from `overlays/residual_overlays.csv` and then used only for
          2025 accounting closure. They are fixed layers for omitted sectors, not a second solve.
        </p>
        <ul className="methods-list">
          <li>They are fixed 2025 accounting layers.</li>
          <li>They are diagnostic and presentation only.</li>
          <li>They are not included in `buildSolveRequest.ts`.</li>
          <li>They are not solved in `lpAdapter.ts`.</li>
        </ul>

        <div className="configuration-provenance-note">
          <strong>Overlays are not part of the LP core.</strong>
          <p>
            The LP solves the explicit state rows only. Residual overlays are added after the LP so
            `validation/baseline_commodity_balance.csv` and
            `validation/baseline_emissions_balance.csv` can show how the packaged 2025 benchmark
            closes once omitted sectors are layered back in.
          </p>
        </div>

        <div className="configuration-stat-grid">
          <div className="configuration-stat-card">
            <span>Residual energy</span>
            <strong>{formatNumber(model.overlaySummary.totalResidualEnergyPj, 1)} PJ</strong>
          </div>
          <div className="configuration-stat-card">
            <span>Residual energy emissions</span>
            <strong>
              {formatNumber(model.overlaySummary.totalResidualEnergyEmissions, 1)} MtCO2e
            </strong>
          </div>
          <div className="configuration-stat-card">
            <span>Residual non-energy emissions</span>
            <strong>
              {formatNumber(model.overlaySummary.totalResidualNonEnergyEmissions, 1)} MtCO2e
            </strong>
          </div>
          <div className="configuration-stat-card">
            <span>Overlay commodity cost</span>
            <strong>
              {formatNumber(model.overlaySummary.totalOverlayCommodityCostAudm2024, 1)} AUD M
            </strong>
          </div>
          <div className="configuration-stat-card">
            <span>Carbon-billable overlay emissions</span>
            <strong>
              {formatNumber(model.overlaySummary.totalCarbonBillableEmissionsMtco2e, 1)} MtCO2e
            </strong>
          </div>
          <div className="configuration-stat-card">
            <span>LULUCF sink</span>
            <strong>
              {model.overlaySummary.lulucfSinkMtco2e == null
                ? 'Optional'
                : `${formatNumber(model.overlaySummary.lulucfSinkMtco2e, 1)} MtCO2e`}
            </strong>
          </div>
        </div>

        <p>
          Default-included overlays are the positive-emitting closure layers. The LULUCF sink stays
          separate and optional by default because its accounting sign and treatment differ from the
          positive-emitting sector rows.
        </p>
      </section>

      <section className="configuration-panel">
        <h2>What the app solves today</h2>
        <ul className="methods-list">
          {model.caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      </section>

      <section className="configuration-panel">
        <h2>Related documentation</h2>
        <p>
          `Methods` covers provenance, calibration, and caveats. `Model Formulation` covers the
          equations and solve wiring. `State Schema` covers the row and field dictionary.
        </p>
        <div className="configuration-action-row">
          <Link className="configuration-button configuration-button--ghost" to="/methods">
            Open Methods
          </Link>
          <Link className="configuration-button configuration-button--ghost" to="/state-schema">
            Open State Schema
          </Link>
        </div>
      </section>
    </div>
  );
}

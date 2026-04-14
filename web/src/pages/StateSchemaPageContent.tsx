import React, { useMemo } from 'react';
import type { PackageSchemaInfo, SectorState } from '../data/types';
import {
  buildStateSchemaSections,
  buildWorkedExampleStateFamily,
  getStateSchemaMilestoneYears,
} from './stateSchemaModel';

interface StateSchemaPageContentProps {
  schema: PackageSchemaInfo | null;
  sectorStates: SectorState[];
}

const numberFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('en-AU', {
  style: 'percent',
  maximumFractionDigits: 1,
});

function formatNullableNumber(value: number | null): string {
  return value == null ? '—' : numberFormatter.format(value);
}

function formatEmissionsSummary(
  rows: { pollutant: string; value: number }[],
  emissionsUnits: string,
): string {
  if (rows.length === 0) {
    return '—';
  }

  return rows
    .map((entry) => `${entry.pollutant} ${formatNullableNumber(entry.value)} ${emissionsUnits}`.trim())
    .join('; ');
}

function formatLimitSummary(row: SectorState): string {
  const limits = [
    row.max_share == null ? null : `max share ${percentFormatter.format(row.max_share)}`,
    row.max_activity == null ? null : `max activity ${formatNullableNumber(row.max_activity)}`,
    row.min_share == null ? null : `min share ${percentFormatter.format(row.min_share)}`,
  ].filter(Boolean);

  return limits.length > 0 ? limits.join(' | ') : '—';
}

export default function StateSchemaPageContent({
  schema,
  sectorStates,
}: StateSchemaPageContentProps): React.JSX.Element {
  const milestoneYears = useMemo(() => getStateSchemaMilestoneYears(), []);
  const schemaSections = useMemo(() => buildStateSchemaSections(schema), [schema]);
  const exampleFamily = useMemo(
    () => buildWorkedExampleStateFamily(sectorStates),
    [sectorStates],
  );
  const packagedRegions = useMemo(
    () => Array.from(new Set(sectorStates.map((row) => row.region))).sort((left, right) => left.localeCompare(right)),
    [sectorStates],
  );
  const stateFamilyCount = useMemo(
    () => new Set(sectorStates.map((row) => row.state_id)).size,
    [sectorStates],
  );

  return (
    <div className="page page--state-schema">
      <h1>State Schema</h1>
      <p>
        This page defines the raw row structure stored in
        {' '}<code>families/&lt;family_id&gt;/family_states.csv</code>, so another modeller can understand what is directly
        appendable to the packaged library.
      </p>
      <p>
        The explorer also joins those raw rows to <code>shared/families.csv</code> for family-level metadata such as
        sector, subsector, region, and output units. Those joined registry fields are useful context, but they are not
        additional columns in <code>family_states.csv</code>.
      </p>

      <section className="configuration-overview-grid">
        <article className="configuration-panel configuration-panel--hero">
          <span className="configuration-badge">Documentation only</span>
          <h2>What this page is for</h2>
          <p>
            This is the structural definition of a state contribution. It explains the fields,
            their meaning, and the CSV encodings expected by the current explorer.
          </p>
          <p>
            It does not provide a submission form, review workflow, or any support commitment for
            external state packages.
          </p>
          <div className="configuration-provenance-note">
            <strong>Read-only reference.</strong>
            <p>
              Use this page to understand the schema. Submission, approval, and integration remain
              separate processes outside the scope of the explorer.
            </p>
          </div>
        </article>

        <article className="configuration-panel">
          <h2>At a glance</h2>
          <div className="configuration-stat-grid">
            <div className="configuration-stat-card">
              <span>Schema fields</span>
              <strong>{schema?.propertyCount ?? 0}</strong>
            </div>
            <div className="configuration-stat-card">
              <span>Required fields</span>
              <strong>{schema?.requiredFields.length ?? 0}</strong>
            </div>
            <div className="configuration-stat-card">
              <span>Expected milestone years</span>
              <strong>{milestoneYears.length}</strong>
            </div>
            <div className="configuration-stat-card">
              <span>Packaged state families</span>
              <strong>{stateFamilyCount}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="configuration-panel">
        <h2>What counts as a state</h2>
        <p>
          A state is defined here as a <strong>state family</strong>, not a single row. The stable
          identifier is `state_id`, and the contribution is the set of state-year rows attached to
          one `family_id` across the required milestone years.
        </p>
        <p>
          Within the raw CSV, `family_id` and `state_id` identify the contribution. Family-level
          metadata such as `sector`, `subsector`, `service_or_output_name`, `region`, `output_unit`,
          and `output_quantity_basis` stay in <code>shared/families.csv</code> and are joined in by
          the app rather than duplicated into every state row.
        </p>
        <div className="library-tag-list">
          <span className="library-tag">family_id</span>
          <span className="library-tag">state_id</span>
          <span className="library-tag">year</span>
        </div>
      </section>

      <section className="configuration-panel">
        <h2>Current package conventions</h2>
        <p>
          The current packaged library uses `region = AUS` only. That region value is held in
          {' '}<code>shared/families.csv</code> and joined onto the raw state rows by the loader.
        </p>
        <dl className="configuration-key-value-list">
          <div>
            <dt>Packaged regions</dt>
            <dd>{packagedRegions.length > 0 ? packagedRegions.join(', ') : '—'}</dd>
          </div>
          <div>
            <dt>Required milestone years</dt>
            <dd>{milestoneYears.join(', ')}</dd>
          </div>
          <div>
            <dt>Contribution unit</dt>
            <dd>One `state_id` across all milestone years within one `family_id`</dd>
          </div>
        </dl>
      </section>

      <section className="configuration-panel">
        <h2>What must be directly appendable to the CSV</h2>
        <ul className="methods-list">
          <li>Use the exact CSV column names shown in the field dictionary below.</li>
          <li>
            Provide one state-year row for each required milestone year:
            {` ${milestoneYears.join(', ')}.`}
          </li>
          <li>
            Store array-like fields as JSON-encoded values inside a single CSV cell, not as
            exploded columns.
          </li>
          <li>
            Keep family registry fields such as sector, region, and output unit in
            {' '}<code>shared/families.csv</code> rather than duplicating them into
            {' '}<code>family_states.csv</code>.
          </li>
          <li>
            Keep `input_commodities`, `input_coefficients`, and `input_units` aligned
            one-for-one in the same item order.
          </li>
          <li>
            Keep `source_ids` and `assumption_ids` as ID arrays that can resolve against
            companion ledgers when those ledgers are supplied.
          </li>
          <li>
            Treat negative values in `process_emissions_by_pollutant` as removals or net negative
            process effects.
          </li>
        </ul>
      </section>

      <section className="configuration-panel">
        <h2>Worked example</h2>
        {exampleFamily ? (
          <>
            <p>
              The example below uses one real packaged state family so the raw row shape is concrete
              rather than inferred from field names alone. The family summary also shows the joined
              registry metadata that the app resolves from <code>shared/families.csv</code>.
            </p>

            <div className="state-schema-summary-grid">
              <article className="configuration-demand-card">
                <h3>Family summary</h3>
                <p className="library-inline-note">
                  Sector, subsector, region, output unit, and output quantity basis are joined from
                  {' '}<code>shared/families.csv</code>; the remaining identity and cost fields below are
                  carried directly in the raw state rows.
                </p>
                <dl className="configuration-key-value-list">
                  <div>
                    <dt>state_id</dt>
                    <dd>{exampleFamily.stateId}</dd>
                  </div>
                  <div>
                    <dt>state_label</dt>
                    <dd>{exampleFamily.stateLabel}</dd>
                  </div>
                  <div>
                    <dt>sector / subsector</dt>
                    <dd>
                      {exampleFamily.sector}
                      {exampleFamily.subsector ? ` / ${exampleFamily.subsector}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>service_or_output_name</dt>
                    <dd>{exampleFamily.serviceOrOutputName}</dd>
                  </div>
                  <div>
                    <dt>region</dt>
                    <dd>{exampleFamily.region}</dd>
                  </div>
                  <div>
                    <dt>output unit</dt>
                    <dd>{exampleFamily.outputUnit}</dd>
                  </div>
                  <div>
                    <dt>output quantity basis</dt>
                    <dd>{exampleFamily.outputQuantityBasis}</dd>
                  </div>
                  <div>
                    <dt>currency / cost basis year</dt>
                    <dd>
                      {exampleFamily.currency}
                      {exampleFamily.costBasisYear == null ? '' : ` / ${exampleFamily.costBasisYear}`}
                    </dd>
                  </div>
                </dl>
                <p className="state-schema-description">{exampleFamily.stateDescription}</p>
              </article>
            </div>

            <div className="library-mini-table state-schema-milestone-table">
              <div className="library-mini-table-row library-mini-table-row--header">
                <span>Year</span>
                <span>Output cost per unit</span>
                <span>Inputs</span>
                <span>Energy emissions</span>
                <span>Process emissions</span>
                <span>Limits</span>
                <span>Confidence</span>
              </div>
              {exampleFamily.rows.map((row) => (
                <div key={`${row.state_id}:${row.year}`} className="library-mini-table-row">
                  <span>{row.year}</span>
                  <span>
                    {row.output_cost_per_unit == null
                      ? '—'
                      : `${formatNullableNumber(row.output_cost_per_unit)} ${row.currency}`}
                  </span>
                  <span>{row.input_commodities.length > 0 ? row.input_commodities.join(', ') : '—'}</span>
                  <span>
                    {formatEmissionsSummary(
                      row.energy_emissions_by_pollutant,
                      row.emissions_units,
                    )}
                  </span>
                  <span>
                    {formatEmissionsSummary(
                      row.process_emissions_by_pollutant,
                      row.emissions_units,
                    )}
                  </span>
                  <span>{formatLimitSummary(row)}</span>
                  <span>{row.confidence_rating}</span>
                </div>
              ))}
            </div>

            <p className="library-inline-note">
              Representative raw CSV row snippet for the {exampleFamily.representativeRow.year}
              {' '}milestone, including literal JSON-encoded array fields:
            </p>
            <pre className="results-code-block state-schema-code-block">
              {exampleFamily.representativeRowSnippet}
            </pre>
          </>
        ) : (
          <p>No packaged state-family rows were available to build an example.</p>
        )}
      </section>

      <section className="configuration-panel">
        <h2>Field dictionary</h2>
        <p>
          Every <code>family_states.csv</code> column is listed below with its requiredness, schema
          type, family behaviour, meaning, and CSV encoding notes. Joined family-registry metadata
          from <code>shared/families.csv</code> sits outside this row-level dictionary.
        </p>
        {schemaSections.length > 0 ? (
          <div className="methods-section-stack">
            {schemaSections.map((section) => (
              <article key={section.title} className="methods-content-card">
                <h3>{section.title}</h3>
                <div className="library-mini-table state-schema-field-table">
                  <div className="library-mini-table-row library-mini-table-row--header">
                    <span>Field</span>
                    <span>Required</span>
                    <span>Type</span>
                    <span>Family behaviour</span>
                    <span>Meaning</span>
                    <span>CSV encoding / notes</span>
                  </div>
                  {section.fields.map((field) => (
                    <div key={field.name} className="library-mini-table-row">
                      <span>{field.name}</span>
                      <span>{field.required ? 'Yes' : 'No'}</span>
                      <span>{field.type}</span>
                      <span>{field.familyBehaviour}</span>
                      <span>{field.description}</span>
                      <span>{field.csvEncodingNotes}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>
            The optional `family_states.schema.json` companion was not packaged, so the explorer
            cannot show the field dictionary for this build.
          </p>
        )}
      </section>

      <section className="configuration-panel">
        <h2>Out of scope</h2>
        <p>
          This page does not define a submission channel, review workflow, data support process, or
          acceptance criteria for external contributions. It only defines the structure that a
          comparable state package would need to follow.
        </p>
      </section>
    </div>
  );
}

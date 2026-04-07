import { useMemo, useState } from 'react';
import {
  buildSectorStateFamilies,
  buildSectorStateSearchText,
  findReferenceSectorState,
  sumEmissionEntries,
} from '../data/libraryInsights';
import { usePackageStore } from '../data/packageStore';
import type { SectorState } from '../data/types';

interface LibraryFilters {
  search: string;
  sector: string;
  subsector: string;
  service: string;
  year: string;
  confidence: string;
  region: string;
  stateLabel: string;
  sourceId: string;
  assumptionId: string;
}

const EMPTY_FILTERS: LibraryFilters = {
  search: '',
  sector: '',
  subsector: '',
  service: '',
  year: '',
  confidence: '',
  region: '',
  stateLabel: '',
  sourceId: '',
  assumptionId: '',
};

const numberFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat('en-AU', {
  style: 'percent',
  maximumFractionDigits: 1,
});

function buildStateRowKey(state: SectorState): string {
  return `${state.state_id}:${state.year}`;
}

function formatNullableNumber(value: number | null, suffix = ''): string {
  if (value == null) {
    return '—';
  }

  return `${numberFormatter.format(value)}${suffix}`;
}

function formatCost(row: SectorState): string {
  if (row.output_cost_per_unit == null) {
    return 'n/a';
  }

  return `${row.currency} ${numberFormatter.format(row.output_cost_per_unit)}`;
}

function formatDelta(value: number | null): string {
  if (value == null) {
    return '—';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${numberFormatter.format(value)}`;
}

function matchesFilters(row: SectorState, filters: LibraryFilters): boolean {
  if (filters.sector && row.sector !== filters.sector) {
    return false;
  }

  if (filters.subsector && row.subsector !== filters.subsector) {
    return false;
  }

  if (filters.service && row.service_or_output_name !== filters.service) {
    return false;
  }

  if (filters.year && String(row.year) !== filters.year) {
    return false;
  }

  if (filters.confidence && row.confidence_rating !== filters.confidence) {
    return false;
  }

  if (filters.region && row.region !== filters.region) {
    return false;
  }

  if (filters.stateLabel && row.state_label !== filters.stateLabel) {
    return false;
  }

  if (filters.sourceId && !row.source_ids.includes(filters.sourceId)) {
    return false;
  }

  if (filters.assumptionId && !row.assumption_ids.includes(filters.assumptionId)) {
    return false;
  }

  if (filters.search) {
    const searchText = buildSectorStateSearchText(row);
    const tokens = filters.search
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (!tokens.every((token) => searchText.includes(token))) {
      return false;
    }
  }

  return true;
}

function buildInputRows(row: SectorState) {
  return row.input_commodities.map((commodity, index) => ({
    commodity,
    coefficient: row.input_coefficients[index] ?? null,
    unit: row.input_units[index] ?? '—',
  }));
}

function buildInputDeltaRows(selected: SectorState, reference: SectorState) {
  const selectedCoefficients = new Map(
    selected.input_commodities.map((commodity, index) => [commodity, selected.input_coefficients[index] ?? 0]),
  );
  const selectedUnits = new Map(
    selected.input_commodities.map((commodity, index) => [commodity, selected.input_units[index] ?? '—']),
  );
  const referenceCoefficients = new Map(
    reference.input_commodities.map((commodity, index) => [commodity, reference.input_coefficients[index] ?? 0]),
  );
  const referenceUnits = new Map(
    reference.input_commodities.map((commodity, index) => [commodity, reference.input_units[index] ?? '—']),
  );

  return Array.from(
    new Set([...selected.input_commodities, ...reference.input_commodities]),
  )
    .sort((left, right) => left.localeCompare(right))
    .map((commodity) => {
      const selectedValue = selectedCoefficients.get(commodity) ?? 0;
      const referenceValue = referenceCoefficients.get(commodity) ?? 0;
      return {
        commodity,
        unit: selectedUnits.get(commodity) ?? referenceUnits.get(commodity) ?? '—',
        selectedValue,
        referenceValue,
        delta: selectedValue - referenceValue,
      };
    });
}

export default function LibraryPage() {
  const enrichment = usePackageStore((state) => state.enrichment);
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

  const families = useMemo(() => buildSectorStateFamilies(sectorStates), [sectorStates]);

  const filterOptions = useMemo(() => {
    return {
      sectors: Array.from(new Set(sectorStates.map((row) => row.sector))).sort((left, right) => left.localeCompare(right)),
      subsectors: Array.from(new Set(sectorStates.map((row) => row.subsector))).sort((left, right) => left.localeCompare(right)),
      services: Array.from(new Set(sectorStates.map((row) => row.service_or_output_name))).sort((left, right) => left.localeCompare(right)),
      years: Array.from(new Set(sectorStates.map((row) => row.year))).sort((left, right) => left - right),
      confidenceRatings: Array.from(new Set(sectorStates.map((row) => row.confidence_rating))).sort((left, right) => left.localeCompare(right)),
      regions: Array.from(new Set(sectorStates.map((row) => row.region))).sort((left, right) => left.localeCompare(right)),
      stateLabels: Array.from(new Set(families.map((family) => family.label))).sort((left, right) => left.localeCompare(right)),
      sourceIds: Array.from(new Set(sectorStates.flatMap((row) => row.source_ids))).sort((left, right) => left.localeCompare(right)),
      assumptionIds: Array.from(new Set(sectorStates.flatMap((row) => row.assumption_ids))).sort((left, right) => left.localeCompare(right)),
    };
  }, [families, sectorStates]);

  const filteredStates = useMemo(() => {
    return sectorStates
      .filter((row) => matchesFilters(row, filters))
      .sort((left, right) => {
        return (
          left.sector.localeCompare(right.sector) ||
          left.subsector.localeCompare(right.subsector) ||
          left.service_or_output_name.localeCompare(right.service_or_output_name) ||
          left.year - right.year ||
          left.state_label.localeCompare(right.state_label)
        );
      });
  }, [filters, sectorStates]);

  const resolvedSelectedRowKey =
    selectedRowKey && filteredStates.some((row) => buildStateRowKey(row) === selectedRowKey)
      ? selectedRowKey
      : filteredStates[0]
        ? buildStateRowKey(filteredStates[0])
        : null;

  const selectedState = filteredStates.find((row) => buildStateRowKey(row) === resolvedSelectedRowKey) ?? null;
  const selectedFamily = families.find((family) => family.stateId === selectedState?.state_id) ?? null;
  const referenceState = selectedState ? findReferenceSectorState(selectedState, sectorStates) : null;

  const filteredConfidenceCounts = useMemo(() => {
    return filteredStates.reduce<Record<string, number>>((counts, row) => {
      counts[row.confidence_rating] = (counts[row.confidence_rating] ?? 0) + 1;
      return counts;
    }, {});
  }, [filteredStates]);

  const filteredFamiliesCount = useMemo(() => {
    return new Set(filteredStates.map((row) => row.state_id)).size;
  }, [filteredStates]);

  const lowConfidenceRows = (filteredConfidenceCounts['Low'] ?? 0) + (filteredConfidenceCounts['Exploratory'] ?? 0);
  const selectedInputRows = selectedState ? buildInputRows(selectedState) : [];
  const referenceInputRows = selectedState && referenceState ? buildInputDeltaRows(selectedState, referenceState) : [];
  const selectedEnergyTotal = selectedState ? sumEmissionEntries(selectedState.energy_emissions_by_pollutant) : null;
  const selectedProcessTotal = selectedState ? sumEmissionEntries(selectedState.process_emissions_by_pollutant) : null;
  const referenceEnergyTotal = referenceState ? sumEmissionEntries(referenceState.energy_emissions_by_pollutant) : null;
  const referenceProcessTotal = referenceState ? sumEmissionEntries(referenceState.process_emissions_by_pollutant) : null;
  const sourceLedgerById = useMemo(() => {
    return new Map(enrichment.sourceLedger.map((entry) => [entry.sourceId, entry]));
  }, [enrichment.sourceLedger]);
  const assumptionsLedgerById = useMemo(() => {
    return new Map(enrichment.assumptionsLedger.map((entry) => [entry.assumptionId, entry]));
  }, [enrichment.assumptionsLedger]);
  const selectedSourceEntries = selectedState
    ? selectedState.source_ids.reduce<NonNullable<ReturnType<typeof sourceLedgerById.get>>[]>(
        (entries, sourceId) => {
          const entry = sourceLedgerById.get(sourceId);

          if (entry) {
            entries.push(entry);
          }

          return entries;
        },
        [],
      )
    : [];
  const selectedAssumptionEntries = selectedState
    ? selectedState.assumption_ids.reduce<NonNullable<ReturnType<typeof assumptionsLedgerById.get>>[]>(
        (entries, assumptionId) => {
          const entry = assumptionsLedgerById.get(assumptionId);

          if (entry) {
            entries.push(entry);
          }

          return entries;
        },
        [],
      )
    : [];

  return (
    <div className="page page--library">
      <h1>Library</h1>
      <p>
        Explore every sector-state row in the package, then inspect the evidence,
        confidence, constraints, and year-specific coefficients that back it.
      </p>

      <section className="scenario-overview-grid">
        <article className="scenario-panel scenario-panel--hero">
          <span className="scenario-badge">Read-only trust</span>
          <h2>Inspectable state library</h2>
          <p>
            The explorer is driven directly from `sector_states.csv`, so the detail panel stays
            aligned with the same state-year rows the solver consumes while still picking up any
            packaged source and assumption ledgers.
          </p>
          <dl className="scenario-key-value-list">
            <div>
              <dt>Visible state-year rows</dt>
              <dd>{filteredStates.length}</dd>
            </div>
            <div>
              <dt>Distinct state families</dt>
              <dd>{filteredFamiliesCount}</dd>
            </div>
            <div>
              <dt>Visible services/outputs</dt>
              <dd>{new Set(filteredStates.map((row) => row.service_or_output_name)).size}</dd>
            </div>
            <div>
              <dt>Low or exploratory rows</dt>
              <dd>{lowConfidenceRows}</dd>
            </div>
          </dl>
        </article>

        <article className="scenario-panel">
          <h2>Confidence mix</h2>
          <div className="scenario-stat-grid">
            {Object.entries(filteredConfidenceCounts).map(([rating, count]) => (
              <div key={rating} className="scenario-stat-card">
                <span>{rating}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="library-layout">
        <aside className="scenario-panel library-filter-panel">
          <div className="library-panel-heading">
            <div>
              <h2>Filters</h2>
              <p>Narrow the explorer by sector, year, confidence, and trust metadata.</p>
            </div>
            <button
              type="button"
              className="library-clear-button"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear all
            </button>
          </div>

          <div className="library-filter-grid">
            <label className="library-field">
              <span>Search</span>
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="State label, evidence, source ID, notes"
              />
            </label>

            <label className="library-field">
              <span>Sector</span>
              <select
                value={filters.sector}
                onChange={(event) => setFilters((current) => ({ ...current, sector: event.target.value }))}
              >
                <option value="">All sectors</option>
                {filterOptions.sectors.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            </label>

            <label className="library-field">
              <span>Subsector</span>
              <select
                value={filters.subsector}
                onChange={(event) => setFilters((current) => ({ ...current, subsector: event.target.value }))}
              >
                <option value="">All subsectors</option>
                {filterOptions.subsectors.map((subsector) => (
                  <option key={subsector} value={subsector}>
                    {subsector}
                  </option>
                ))}
              </select>
            </label>

            <label className="library-field">
              <span>Service/output</span>
              <select
                value={filters.service}
                onChange={(event) => setFilters((current) => ({ ...current, service: event.target.value }))}
              >
                <option value="">All services</option>
                {filterOptions.services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>

            <label className="library-field">
              <span>Year</span>
              <select
                value={filters.year}
                onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))}
              >
                <option value="">All years</option>
                {filterOptions.years.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="library-field">
              <span>Confidence</span>
              <select
                value={filters.confidence}
                onChange={(event) => setFilters((current) => ({ ...current, confidence: event.target.value }))}
              >
                <option value="">All ratings</option>
                {filterOptions.confidenceRatings.map((confidence) => (
                  <option key={confidence} value={confidence}>
                    {confidence}
                  </option>
                ))}
              </select>
            </label>

            <label className="library-field">
              <span>Region</span>
              <select
                value={filters.region}
                onChange={(event) => setFilters((current) => ({ ...current, region: event.target.value }))}
              >
                <option value="">All regions</option>
                {filterOptions.regions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </label>

            <label className="library-field">
              <span>State family</span>
              <select
                value={filters.stateLabel}
                onChange={(event) => setFilters((current) => ({ ...current, stateLabel: event.target.value }))}
              >
                <option value="">All labels</option>
                {filterOptions.stateLabels.map((stateLabel) => (
                  <option key={stateLabel} value={stateLabel}>
                    {stateLabel}
                  </option>
                ))}
              </select>
            </label>

            <label className="library-field">
              <span>Source ID</span>
              <select
                value={filters.sourceId}
                onChange={(event) => setFilters((current) => ({ ...current, sourceId: event.target.value }))}
              >
                <option value="">All sources</option>
                {filterOptions.sourceIds.map((sourceId) => (
                  <option key={sourceId} value={sourceId}>
                    {sourceId}
                  </option>
                ))}
              </select>
            </label>

            <label className="library-field">
              <span>Assumption ID</span>
              <select
                value={filters.assumptionId}
                onChange={(event) => setFilters((current) => ({ ...current, assumptionId: event.target.value }))}
              >
                <option value="">All assumptions</option>
                {filterOptions.assumptionIds.map((assumptionId) => (
                  <option key={assumptionId} value={assumptionId}>
                    {assumptionId}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </aside>

        <section className="library-content">
          <article className="scenario-panel library-list-panel">
            <div className="library-panel-heading">
              <div>
                <h2>Explorer</h2>
                <p>Click any state-year row to open the full trust and constraints detail.</p>
              </div>
              <span className="library-count-pill">{filteredStates.length} rows</span>
            </div>

            {filteredStates.length > 0 ? (
              <div className="library-table-shell">
                <div className="library-table library-table--header" role="row">
                  <span>Year</span>
                  <span>Sector</span>
                  <span>Subsector</span>
                  <span>State label</span>
                  <span>Confidence</span>
                  <span>Unit</span>
                  <span>Cost</span>
                  <span>Energy</span>
                  <span>Process</span>
                  <span>Max share</span>
                  <span>Max activity</span>
                </div>
                <div className="library-table-body">
                  {filteredStates.map((row) => {
                    const rowKey = buildStateRowKey(row);
                    const isSelected = rowKey === resolvedSelectedRowKey;
                    return (
                      <button
                        key={rowKey}
                        type="button"
                        className={`library-table library-table--row${isSelected ? ' library-table--row-selected' : ''}`}
                        onClick={() => setSelectedRowKey(rowKey)}
                      >
                        <span>{row.year}</span>
                        <span>{row.sector}</span>
                        <span>{row.subsector}</span>
                        <span className="library-label-cell">
                          <strong>{row.state_label}</strong>
                          <small>{row.service_or_output_name}</small>
                        </span>
                        <span>
                          <span className={`library-confidence-pill library-confidence-pill--${row.confidence_rating.toLowerCase()}`}>
                            {row.confidence_rating}
                          </span>
                        </span>
                        <span>{row.output_unit}</span>
                        <span>{formatCost(row)}</span>
                        <span>{formatNullableNumber(sumEmissionEntries(row.energy_emissions_by_pollutant))}</span>
                        <span>{formatNullableNumber(sumEmissionEntries(row.process_emissions_by_pollutant))}</span>
                        <span>{row.max_share == null ? '—' : percentFormatter.format(row.max_share)}</span>
                        <span>{formatNullableNumber(row.max_activity)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="library-empty-state">
                <h3>No rows match the current filters.</h3>
                <p>Try clearing one or two trust filters to broaden the explorer.</p>
              </div>
            )}
          </article>

          <article className="scenario-panel library-detail-panel">
            {selectedState ? (
              <>
                <div className="library-detail-hero">
                  <div>
                    <div className="library-badge-row">
                      <span className="scenario-badge">State detail</span>
                      <span className={`library-confidence-pill library-confidence-pill--${selectedState.confidence_rating.toLowerCase()}`}>
                        {selectedState.confidence_rating}
                      </span>
                    </div>
                    <h2>{selectedState.state_label}</h2>
                    <p>{selectedState.state_description}</p>
                  </div>
                  <dl className="library-detail-summary">
                    <div>
                      <dt>Sector</dt>
                      <dd>{selectedState.sector}</dd>
                    </div>
                    <div>
                      <dt>Subsector</dt>
                      <dd>{selectedState.subsector}</dd>
                    </div>
                    <div>
                      <dt>Service/output</dt>
                      <dd>{selectedState.service_or_output_name}</dd>
                    </div>
                    <div>
                      <dt>Year</dt>
                      <dd>{selectedState.year}</dd>
                    </div>
                    <div>
                      <dt>Region</dt>
                      <dd>{selectedState.region}</dd>
                    </div>
                    <div>
                      <dt>Output unit</dt>
                      <dd>{selectedState.output_unit}</dd>
                    </div>
                  </dl>
                </div>

                <div className="library-detail-grid">
                  <section className="library-detail-section">
                    <h3>Cost and bounds</h3>
                    <dl className="library-detail-list">
                      <div>
                        <dt>Output cost per unit</dt>
                        <dd>{formatCost(selectedState)}</dd>
                      </div>
                      <div>
                        <dt>Cost basis year</dt>
                        <dd>{selectedState.cost_basis_year ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>Output quantity basis</dt>
                        <dd>{selectedState.output_quantity_basis}</dd>
                      </div>
                      <div>
                        <dt>Cost components summary</dt>
                        <dd>{selectedState.cost_components_summary}</dd>
                      </div>
                      <div>
                        <dt>Min share</dt>
                        <dd>{selectedState.min_share == null ? '—' : percentFormatter.format(selectedState.min_share)}</dd>
                      </div>
                      <div>
                        <dt>Max share</dt>
                        <dd>{selectedState.max_share == null ? '—' : percentFormatter.format(selectedState.max_share)}</dd>
                      </div>
                      <div>
                        <dt>Max activity</dt>
                        <dd>{formatNullableNumber(selectedState.max_activity)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="library-detail-section">
                    <h3>State family trajectory</h3>
                    {selectedFamily ? (
                      <div className="library-mini-table">
                        <div className="library-mini-table-row library-mini-table-row--header">
                          <span>Year</span>
                          <span>Cost</span>
                          <span>Energy</span>
                          <span>Process</span>
                          <span>Max share</span>
                        </div>
                        {selectedFamily.rows.map((row) => (
                          <div
                            key={buildStateRowKey(row)}
                            className={`library-mini-table-row${row.year === selectedState.year ? ' library-mini-table-row--active' : ''}`}
                          >
                            <span>{row.year}</span>
                            <span>{formatCost(row)}</span>
                            <span>{formatNullableNumber(sumEmissionEntries(row.energy_emissions_by_pollutant))}</span>
                            <span>{formatNullableNumber(sumEmissionEntries(row.process_emissions_by_pollutant))}</span>
                            <span>{row.max_share == null ? '—' : percentFormatter.format(row.max_share)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                </div>

                <section className="library-detail-section">
                  <div className="library-section-header">
                    <div>
                      <h3>Input commodities</h3>
                      <p>{selectedState.input_basis_notes}</p>
                    </div>
                  </div>
                  {selectedInputRows.length > 0 ? (
                    <div className="library-mini-table">
                      <div className="library-mini-table-row library-mini-table-row--header">
                        <span>Commodity</span>
                        <span>Coefficient</span>
                        <span>Unit</span>
                      </div>
                      {selectedInputRows.map((inputRow) => (
                        <div key={inputRow.commodity} className="library-mini-table-row">
                          <span>{inputRow.commodity}</span>
                          <span>{formatNullableNumber(inputRow.coefficient)}</span>
                          <span>{inputRow.unit}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="library-inline-note">No explicit input commodities are embedded for this row.</p>
                  )}
                </section>

                <div className="library-detail-grid">
                  <section className="library-detail-section">
                    <div className="library-section-header">
                      <div>
                        <h3>Energy emissions</h3>
                        <p>{selectedState.emissions_boundary_notes}</p>
                      </div>
                      <strong>{formatNullableNumber(selectedEnergyTotal, ` ${selectedState.emissions_units}`)}</strong>
                    </div>
                    {selectedState.energy_emissions_by_pollutant.length > 0 ? (
                      <div className="library-mini-table">
                        <div className="library-mini-table-row library-mini-table-row--header">
                          <span>Pollutant</span>
                          <span>Value</span>
                        </div>
                        {selectedState.energy_emissions_by_pollutant.map((entry) => (
                          <div key={entry.pollutant} className="library-mini-table-row">
                            <span>{entry.pollutant}</span>
                            <span>{formatNullableNumber(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="library-inline-note">No direct energy emissions are recorded for this row.</p>
                    )}
                  </section>

                  <section className="library-detail-section">
                    <div className="library-section-header">
                      <div>
                        <h3>Process emissions</h3>
                        <p>{selectedState.emissions_boundary_notes}</p>
                      </div>
                      <strong>{formatNullableNumber(selectedProcessTotal, ` ${selectedState.emissions_units}`)}</strong>
                    </div>
                    {selectedState.process_emissions_by_pollutant.length > 0 ? (
                      <div className="library-mini-table">
                        <div className="library-mini-table-row library-mini-table-row--header">
                          <span>Pollutant</span>
                          <span>Value</span>
                        </div>
                        {selectedState.process_emissions_by_pollutant.map((entry) => (
                          <div key={entry.pollutant} className="library-mini-table-row">
                            <span>{entry.pollutant}</span>
                            <span>{formatNullableNumber(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="library-inline-note">No process emissions are recorded for this row.</p>
                    )}
                  </section>
                </div>

                <section className="library-detail-section">
                  <div className="library-section-header">
                    <div>
                      <h3>Reference delta</h3>
                      <p>
                        Compared with the default reference candidate for the same service,
                        year, and region.
                      </p>
                    </div>
                    <strong>{referenceState?.state_label ?? 'No reference found'}</strong>
                  </div>

                  {selectedState && referenceState ? (
                    <>
                      <div className="scenario-stat-grid">
                        <div className="scenario-stat-card">
                          <span>Conversion cost delta</span>
                          <strong>
                            {selectedState.output_cost_per_unit != null && referenceState.output_cost_per_unit != null
                              ? formatDelta(selectedState.output_cost_per_unit - referenceState.output_cost_per_unit)
                              : '—'}
                          </strong>
                        </div>
                        <div className="scenario-stat-card">
                          <span>Direct energy delta</span>
                          <strong>
                            {selectedEnergyTotal != null && referenceEnergyTotal != null
                              ? formatDelta(selectedEnergyTotal - referenceEnergyTotal)
                              : '—'}
                          </strong>
                        </div>
                        <div className="scenario-stat-card">
                          <span>Process emissions delta</span>
                          <strong>
                            {selectedProcessTotal != null && referenceProcessTotal != null
                              ? formatDelta(selectedProcessTotal - referenceProcessTotal)
                              : '—'}
                          </strong>
                        </div>
                        <div className="scenario-stat-card">
                          <span>Max share delta</span>
                          <strong>
                            {selectedState.max_share != null && referenceState.max_share != null
                              ? formatDelta(selectedState.max_share - referenceState.max_share)
                              : '—'}
                          </strong>
                        </div>
                      </div>
                      <p className="library-inline-note">
                        Confidence comparison: {selectedState.confidence_rating} versus {referenceState.confidence_rating}.
                      </p>
                      <div className="library-mini-table">
                        <div className="library-mini-table-row library-mini-table-row--header">
                          <span>Commodity</span>
                          <span>Reference</span>
                          <span>Selected</span>
                          <span>Delta</span>
                        </div>
                        {referenceInputRows.map((inputRow) => (
                          <div key={inputRow.commodity} className="library-mini-table-row">
                            <span>{inputRow.commodity}</span>
                            <span>{formatNullableNumber(inputRow.referenceValue)}</span>
                            <span>{formatNullableNumber(inputRow.selectedValue)}</span>
                            <span>{formatDelta(inputRow.delta)} {inputRow.unit}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="library-inline-note">A same-year reference state is not available for this selection.</p>
                  )}
                </section>

                <div className="library-detail-grid">
                  <section className="library-detail-section">
                    <h3>Evidence and confidence</h3>
                    <dl className="library-detail-list">
                      <div>
                        <dt>Evidence summary</dt>
                        <dd>{selectedState.evidence_summary}</dd>
                      </div>
                      <div>
                        <dt>Derivation method</dt>
                        <dd>{selectedState.derivation_method}</dd>
                      </div>
                      <div>
                        <dt>Confidence rating</dt>
                        <dd>{selectedState.confidence_rating}</dd>
                      </div>
                      <div>
                        <dt>Review notes</dt>
                        <dd>{selectedState.review_notes}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="library-detail-section">
                    <h3>Limits and expansion path</h3>
                    <dl className="library-detail-list">
                      <div>
                        <dt>Rollout limit notes</dt>
                        <dd>{selectedState.rollout_limit_notes}</dd>
                      </div>
                      <div>
                        <dt>Availability conditions</dt>
                        <dd>{selectedState.availability_conditions}</dd>
                      </div>
                      <div>
                        <dt>Candidate expansion pathway</dt>
                        <dd>{selectedState.candidate_expansion_pathway}</dd>
                      </div>
                      <div>
                        <dt>TIMES/VedaLang mapping notes</dt>
                        <dd>{selectedState.times_or_vedalang_mapping_notes}</dd>
                      </div>
                    </dl>
                    <div className="library-boolean-grid">
                      <div className="scenario-stat-card">
                        <span>Expand to explicit capacity</span>
                        <strong>{selectedState.would_expand_to_explicit_capacity ? 'Yes' : 'No'}</strong>
                      </div>
                      <div className="scenario-stat-card">
                        <span>Expand to process chain</span>
                        <strong>{selectedState.would_expand_to_process_chain ? 'Yes' : 'No'}</strong>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="library-detail-section">
                  <h3>Raw trust IDs</h3>
                  <div className="library-tag-groups">
                    <div>
                      <span className="library-tag-group-title">Source IDs</span>
                      <div className="library-tag-list">
                        {selectedState.source_ids.map((sourceId) => (
                          <span key={sourceId} className="library-tag">
                            {sourceId}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="library-tag-group-title">Assumption IDs</span>
                      <div className="library-tag-list">
                        {selectedState.assumption_ids.map((assumptionId) => (
                          <span key={assumptionId} className="library-tag">
                            {assumptionId}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {selectedSourceEntries.length > 0 || selectedAssumptionEntries.length > 0 ? (
                    <div className="library-detail-grid">
                      {selectedSourceEntries.length > 0 ? (
                        <section className="library-detail-section">
                          <h3>Source ledger entries</h3>
                          <div className="library-tag-groups">
                            {selectedSourceEntries.map((entry) => (
                              <div key={entry.sourceId}>
                                <span className="library-tag-group-title">
                                  {entry.sourceId} · {entry.institution}
                                </span>
                                <dl className="library-detail-list">
                                  <div>
                                    <dt>Citation</dt>
                                    <dd>{entry.citation}</dd>
                                  </div>
                                  <div>
                                    <dt>Publication date</dt>
                                    <dd>{entry.publicationDate || '—'}</dd>
                                  </div>
                                  <div>
                                    <dt>Parameters informed</dt>
                                    <dd>{entry.parametersInformed}</dd>
                                  </div>
                                  <div>
                                    <dt>Authority note</dt>
                                    <dd>{entry.qualityNotes}</dd>
                                  </div>
                                  <div>
                                    <dt>Location</dt>
                                    <dd>{entry.location}</dd>
                                  </div>
                                </dl>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {selectedAssumptionEntries.length > 0 ? (
                        <section className="library-detail-section">
                          <h3>Assumption ledger entries</h3>
                          <div className="library-tag-groups">
                            {selectedAssumptionEntries.map((entry) => (
                              <div key={entry.assumptionId}>
                                <span className="library-tag-group-title">{entry.assumptionId}</span>
                                <dl className="library-detail-list">
                                  <div>
                                    <dt>Statement</dt>
                                    <dd>{entry.statement}</dd>
                                  </div>
                                  <div>
                                    <dt>Rationale</dt>
                                    <dd>{entry.rationale}</dd>
                                  </div>
                                  <div>
                                    <dt>Affected scope</dt>
                                    <dd>{entry.affectedScope}</dd>
                                  </div>
                                  <div>
                                    <dt>Sensitivity importance</dt>
                                    <dd>{entry.sensitivityImportance}</dd>
                                  </div>
                                  <div>
                                    <dt>Validation route</dt>
                                    <dd>{entry.validationRoute}</dd>
                                  </div>
                                </dl>
                              </div>
                            ))}
                          </div>
                        </section>
                      ) : null}
                    </div>
                  ) : enrichment.sourceLedger.length === 0 && enrichment.assumptionsLedger.length === 0 ? (
                    <p className="library-inline-note">
                      Optional source and assumption ledgers were not packaged, so this view can
                      only show the raw trust IDs for the selected row.
                    </p>
                  ) : null}
                </section>
              </>
            ) : (
              <div className="library-empty-state">
                <h3>Select a state-year row</h3>
                <p>The detail drawer will populate once the explorer has a visible selection.</p>
              </div>
            )}
          </article>
        </section>
      </section>
    </div>
  );
}

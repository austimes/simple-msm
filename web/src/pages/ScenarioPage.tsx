import { useRef, useState, type ChangeEvent } from 'react';
import { usePackageStore } from '../data/packageStore';
import { parseConfigurationDocument } from '../data/configurationLoader';

const numberFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
});

function formatModeLabel(mode: string): string {
  return mode.replaceAll('_', ' ');
}

function formatScenarioSource(source: string): string {
  switch (source) {
    case 'reference':
      return 'Packaged reference scenario';
    case 'local_draft':
      return 'Restored local draft';
    case 'imported':
      return 'Imported JSON draft';
    case 'draft':
      return 'Edited browser draft';
    default:
      return source.replaceAll('_', ' ');
  }
}

function slugifyScenarioName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

  return slug || 'scenario-draft';
}

export default function ScenarioPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appConfig = usePackageStore((state) => state.appConfig);
  const currentConfiguration = usePackageStore((state) => state.currentConfiguration);
  const currentConfigurationSource = usePackageStore((state) => state.currentConfigurationSource);
  const persistenceNotice = usePackageStore((state) => state.persistenceNotice);
  const persistenceError = usePackageStore((state) => state.persistenceError);
  const replaceCurrentConfiguration = usePackageStore((state) => state.replaceCurrentConfiguration);
  const updateConfigurationMetadata = usePackageStore((state) => state.updateConfigurationMetadata);

  const [importError, setImportError] = useState<string | null>(null);

  const demandPreset = currentConfiguration.demand_generation.preset_id
    ? appConfig.demand_growth_presets[currentConfiguration.demand_generation.preset_id]
    : null;

  const serviceDemandEntries = Object.entries(currentConfiguration.service_demands);
  const externalCommodityEntries = Object.entries(
    currentConfiguration.external_commodity_demands ?? {},
  );
  const controlsByMode = Object.values(currentConfiguration.service_controls).reduce<
    Record<string, number>
  >((counts, control) => {
    counts[control.mode] = (counts[control.mode] ?? 0) + 1;
    return counts;
  }, {});

  function handleExport(): void {
    const blob = new Blob([JSON.stringify(currentConfiguration, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${slugifyScenarioName(currentConfiguration.name)}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    try {
      const importedScenario = parseConfigurationDocument(await file.text(), appConfig, file.name);

      replaceCurrentConfiguration(
        importedScenario,
        'imported',
        `Imported ${file.name} and saved it as the active browser draft.`,
      );
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import the selected scenario file.');
    } finally {
      event.currentTarget.value = '';
    }
  }

  return (
    <div className="page">
      <h1>Scenario</h1>
      <p>
        The current scenario now lives as a browser draft: you can import a validated JSON
        scenario, export the active draft back to disk, and restore the latest local copy
        without changing the solver semantics underneath it.
      </p>

      <section className="scenario-overview-grid">
        <article className="scenario-panel scenario-panel--hero">
          <span className="scenario-badge">Active draft</span>
          <h2>{currentConfiguration.name || 'Untitled scenario'}</h2>
          <p>{currentConfiguration.description ?? 'No description yet. Imported or edited drafts autosave in this browser.'}</p>

          <dl className="scenario-key-value-list">
            <div>
              <dt>Draft source</dt>
              <dd>{formatScenarioSource(currentConfigurationSource)}</dd>
            </div>
            <div>
              <dt>Milestone years</dt>
              <dd>{currentConfiguration.years.join(', ')}</dd>
            </div>
            <div>
              <dt>Demand generation mode</dt>
              <dd>{formatModeLabel(currentConfiguration.demand_generation.mode)}</dd>
            </div>
            <div>
              <dt>Demand preset</dt>
              <dd>{demandPreset?.label ?? currentConfiguration.demand_generation.preset_id ?? 'Manual table'}</dd>
            </div>
            <div>
              <dt>Commodity pricing</dt>
              <dd>Per-commodity selections</dd>
            </div>
          </dl>

          {demandPreset ? (
            <p className="scenario-provenance-note">{demandPreset.provenance_note}</p>
          ) : null}
        </article>

        <article className="scenario-panel">
          <h2>Save, Load, Restore</h2>
          {persistenceNotice ? (
            <p className="scenario-status scenario-status--info">{persistenceNotice}</p>
          ) : null}
          {persistenceError ? (
            <p className="scenario-status scenario-status--error">{persistenceError}</p>
          ) : null}
          {importError ? (
            <p className="scenario-status scenario-status--error">{importError}</p>
          ) : null}

          <div className="scenario-action-row">
            <button type="button" className="scenario-button" onClick={handleExport}>
              Export JSON
            </button>
            <button
              type="button"
              className="scenario-button scenario-button--secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </button>

          </div>

          <input
            ref={fileInputRef}
            className="scenario-file-input"
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
          />
        </article>

        <article className="scenario-panel">
          <h2>Draft metadata</h2>
          <div className="scenario-form-grid">
            <label className="scenario-field">
              <span>Name</span>
              <input
                className="scenario-input"
                type="text"
                value={currentConfiguration.name}
                onChange={(event) => updateConfigurationMetadata({ name: event.target.value })}
              />
            </label>

            <label className="scenario-field scenario-field--full">
              <span>Description</span>
              <textarea
                className="scenario-input scenario-textarea"
                value={currentConfiguration.description ?? ''}
                rows={4}
                onChange={(event) => updateConfigurationMetadata({ description: event.target.value })}
              />
            </label>
          </div>

          <p className="scenario-inline-note">
            Name and description edits autosave immediately, while the resolved demand and control
            tables remain the same unless you import a new scenario document.
          </p>
        </article>

        <article className="scenario-panel">
          <h2>Control modes</h2>
          <div className="scenario-stat-grid">
            {Object.entries(controlsByMode).map(([mode, count]) => (
              <div key={mode} className="scenario-stat-card">
                <span>{formatModeLabel(mode)}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="scenario-panel">
          <h2>Resolved demand inputs</h2>
          <div className="scenario-stat-grid">
            <div className="scenario-stat-card">
              <span>Services with explicit demand</span>
              <strong>{serviceDemandEntries.length}</strong>
            </div>
            <div className="scenario-stat-card">
              <span>External commodity demand tables</span>
              <strong>{externalCommodityEntries.length}</strong>
            </div>
            <div className="scenario-stat-card">
              <span>Carbon price years</span>
              <strong>{Object.keys(currentConfiguration.carbon_price).length}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="scenario-panel">
        <h2>Service demand sample</h2>
        <div className="scenario-demand-grid">
          {serviceDemandEntries.slice(0, 6).map(([service, demandByYear]) => (
            <article key={service} className="scenario-demand-card">
              <h3>{service}</h3>
              <dl>
                {currentConfiguration.years.map((year) => {
                  const value = demandByYear[String(year) as keyof typeof demandByYear];
                  return (
                    <div key={year}>
                      <dt>{year}</dt>
                      <dd>{value == null ? '—' : numberFormatter.format(value)}</dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

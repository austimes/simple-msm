import { useRef, useState, type ChangeEvent } from 'react';
import { usePackageStore } from '../../data/packageStore';
import { parseConfigurationDocument } from '../../data/configurationDocumentLoader';

const numberFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
});

function formatModeLabel(mode: string): string {
  return mode.replaceAll('_', ' ');
}

function formatConfigurationSource(source: string): string {
  switch (source) {
    case 'reference':
      return 'Packaged reference configuration';
    case 'local_draft':
      return 'Restored browser-local document';
    case 'imported':
      return 'Imported JSON document';
    case 'draft':
      return 'Edited browser-local document';
    case 'configuration':
      return 'Loaded saved configuration';
    default:
      return source.replaceAll('_', ' ');
  }
}

function slugifyConfigurationName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');

  return slug || 'configuration-draft';
}

export default function ConfigurationDocumentPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appConfig = usePackageStore((state) => state.appConfig);
  const currentConfiguration = usePackageStore((state) => state.currentConfiguration);
  const currentConfigurationSource = usePackageStore((state) => state.currentConfigurationSource);
  const persistenceNotice = usePackageStore((state) => state.persistenceNotice);
  const persistenceError = usePackageStore((state) => state.persistenceError);
  const replaceCurrentConfiguration = usePackageStore((state) => state.replaceCurrentConfiguration);
  const resetCurrentConfiguration = usePackageStore((state) => state.resetCurrentConfiguration);
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
    link.download = `${slugifyConfigurationName(currentConfiguration.name)}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    try {
      const importedConfiguration = parseConfigurationDocument(await file.text(), appConfig, file.name);

      replaceCurrentConfiguration(
        importedConfiguration,
        'imported',
        `Imported ${file.name} and saved it as the active browser-local configuration.`,
      );
      setImportError(null);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : 'Failed to import the selected configuration file.',
      );
    } finally {
      event.currentTarget.value = '';
    }
  }

  return (
    <>
      <section className="configuration-overview-grid">
        <article className="configuration-panel configuration-panel--hero">
          <span className="configuration-badge">Working document</span>
          <h2>{currentConfiguration.name || 'Untitled configuration'}</h2>
          <p>
            {currentConfiguration.description
              ?? 'No description yet. Imported or edited configurations autosave in this browser.'}
          </p>

          <dl className="configuration-key-value-list">
            <div>
              <dt>Document source</dt>
              <dd>{formatConfigurationSource(currentConfigurationSource)}</dd>
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
            <p className="configuration-provenance-note">{demandPreset.provenance_note}</p>
          ) : null}
        </article>

        <article className="configuration-panel">
          <h2>Import, Export, Restore</h2>
          {persistenceNotice ? (
            <p className="configuration-status configuration-status--info">{persistenceNotice}</p>
          ) : null}
          {persistenceError ? (
            <p className="configuration-status configuration-status--error">{persistenceError}</p>
          ) : null}
          {importError ? (
            <p className="configuration-status configuration-status--error">{importError}</p>
          ) : null}

          <div className="configuration-action-row">
            <button type="button" className="configuration-button" onClick={handleExport}>
              Export JSON
            </button>
            <button
              type="button"
              className="configuration-button configuration-button--secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </button>
            <button
              type="button"
              className="configuration-button configuration-button--ghost"
              onClick={resetCurrentConfiguration}
            >
              Reset to Reference
            </button>
          </div>

          <input
            ref={fileInputRef}
            className="configuration-file-input"
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
          />
        </article>

        <article className="configuration-panel">
          <h2>Document Metadata</h2>
          <div className="configuration-form-grid">
            <label className="configuration-field">
              <span>Name</span>
              <input
                className="configuration-input"
                type="text"
                value={currentConfiguration.name}
                onChange={(event) => updateConfigurationMetadata({ name: event.target.value })}
              />
            </label>

            <label className="configuration-field configuration-field--full">
              <span>Description</span>
              <textarea
                className="configuration-input configuration-textarea"
                value={currentConfiguration.description ?? ''}
                rows={4}
                onChange={(event) => updateConfigurationMetadata({ description: event.target.value })}
              />
            </label>
          </div>

          <p className="configuration-inline-note">
            Name and description edits autosave immediately, while the resolved demand and control
            tables remain the same unless you import a new configuration document.
          </p>
        </article>

        <article className="configuration-panel">
          <h2>Control Modes</h2>
          <div className="configuration-stat-grid">
            {Object.entries(controlsByMode).map(([mode, count]) => (
              <div key={mode} className="configuration-stat-card">
                <span>{formatModeLabel(mode)}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="configuration-panel">
          <h2>Resolved Demand Inputs</h2>
          <div className="configuration-stat-grid">
            <div className="configuration-stat-card">
              <span>Services with explicit demand</span>
              <strong>{serviceDemandEntries.length}</strong>
            </div>
            <div className="configuration-stat-card">
              <span>External commodity demand tables</span>
              <strong>{externalCommodityEntries.length}</strong>
            </div>
            <div className="configuration-stat-card">
              <span>Carbon price years</span>
              <strong>{Object.keys(currentConfiguration.carbon_price).length}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="configuration-panel">
        <h2>Service Demand Sample</h2>
        <div className="configuration-demand-grid">
          {serviceDemandEntries.slice(0, 6).map(([service, demandByYear]) => (
            <article key={service} className="configuration-demand-card">
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
    </>
  );
}

import { useState } from 'react';
import { usePackageStore } from '../data/packageStore';
import type { SolveConfiguration } from '../data/configurationTypes';
import {
  loadBuiltinConfigurations,
  loadUserConfigurations,
  saveUserConfiguration,
  deleteUserConfiguration,
  createConfigurationFromScenario,
} from '../data/configurationLoader';

function formatModeLabel(mode: string): string {
  return mode.replaceAll('_', ' ');
}

export default function ConfigurationsPage() {
  const currentScenario = usePackageStore((s) => s.currentScenario);
  const defaultScenario = usePackageStore((s) => s.defaultScenario);
  const appConfig = usePackageStore((s) => s.appConfig);
  const includedOutputIds = usePackageStore((s) => s.includedOutputIds);
  const activeConfigurationId = usePackageStore((s) => s.activeConfigurationId);
  const loadConfiguration = usePackageStore((s) => s.loadConfiguration);

  const [userConfigs, setUserConfigs] = useState(() => loadUserConfigurations());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const builtinConfigs = loadBuiltinConfigurations();

  function handleLoad(config: SolveConfiguration) {
    loadConfiguration(config);
  }

  function handleSaveCurrent() {
    const config = createConfigurationFromScenario(
      currentScenario,
      defaultScenario,
      includedOutputIds,
      appConfig,
    );

    // Avoid id collision with built-ins
    const builtinIds = new Set(builtinConfigs.map((c) => c.id));
    if (builtinIds.has(config.id)) {
      config.id = `${config.id}-custom`;
    }

    const error = saveUserConfiguration(config);
    if (error) {
      setSaveNotice(`Error: ${error}`);
    } else {
      setSaveNotice(`Saved "${config.name}" as a user configuration.`);
      setUserConfigs(loadUserConfigurations());
    }
  }

  function handleDelete(configId: string) {
    deleteUserConfiguration(configId);
    setUserConfigs(loadUserConfigurations());
    setSaveNotice(`Deleted configuration.`);
  }

  function handleExport(config: SolveConfiguration) {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <h1>Configurations</h1>
      <p>
        Load a built-in or saved configuration to set up the solver scope,
        service controls, and solver options. Configurations can also be run
        from the CLI with <code>npx tsx solve.mjs --config &lt;id&gt;</code>.
      </p>

      {saveNotice && (
        <p className={`scenario-status ${saveNotice.startsWith('Error') ? 'scenario-status--error' : 'scenario-status--info'}`}>
          {saveNotice}
        </p>
      )}

      <div className="scenario-action-row" style={{ marginTop: 16 }}>
        <button type="button" className="scenario-button" onClick={handleSaveCurrent}>
          Save current scenario as configuration
        </button>
      </div>

      <section className="scenario-panel" style={{ marginTop: 24 }}>
        <h2>Built-in configurations</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
          Shipped with the app — read-only. Each corresponds to a test case.
        </p>
        <div className="config-card-grid">
          {builtinConfigs.map((config) => (
            <ConfigCard
              key={config.id}
              config={config}
              isActive={activeConfigurationId === config.id}
              onLoad={handleLoad}
              onExport={handleExport}
            />
          ))}
        </div>
      </section>

      {userConfigs.length > 0 && (
        <section className="scenario-panel" style={{ marginTop: 16 }}>
          <h2>User configurations</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
            Saved in your browser. Export to share or use from the CLI.
          </p>
          <div className="config-card-grid">
            {userConfigs.map((config) => (
              <ConfigCard
                key={config.id}
                config={config}
                isActive={activeConfigurationId === config.id}
                onLoad={handleLoad}
                onExport={handleExport}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ConfigCard({
  config,
  isActive,
  onLoad,
  onExport,
  onDelete,
}: {
  config: SolveConfiguration;
  isActive: boolean;
  onLoad: (c: SolveConfiguration) => void;
  onExport: (c: SolveConfiguration) => void;
  onDelete?: (id: string) => void;
}) {
  const scopeLabel = config.includedOutputIds?.length
    ? `${config.includedOutputIds.length} output${config.includedOutputIds.length > 1 ? 's' : ''}`
    : 'Full model';

  const controlModes = Object.values(config.serviceControls).reduce<Record<string, number>>(
    (counts, control) => {
      counts[control.mode] = (counts[control.mode] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return (
    <article className={`scenario-stat-card config-card${isActive ? ' config-card--active' : ''}`}>
      <div className="config-card-header">
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{config.name}</h3>
        {config.readonly && (
          <span className="config-badge config-badge--readonly">built-in</span>
        )}
        {isActive && (
          <span className="config-badge config-badge--active">active</span>
        )}
      </div>

      {config.description && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '8px 0' }}>
          {config.description}
        </p>
      )}

      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
        <span>Scope: {scopeLabel}</span>
        {Object.entries(controlModes).map(([mode, count]) => (
          <span key={mode} style={{ marginLeft: 8 }}>
            {formatModeLabel(mode)}: {count}
          </span>
        ))}
      </div>

      {config.includedOutputIds && config.includedOutputIds.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
          {config.includedOutputIds.join(', ')}
        </div>
      )}

      <div className="config-card-actions">
        <button
          type="button"
          className="scenario-button"
          style={{ padding: '6px 12px', fontSize: 13 }}
          onClick={() => onLoad(config)}
        >
          Load
        </button>
        <button
          type="button"
          className="scenario-button scenario-button--ghost"
          style={{ padding: '6px 12px', fontSize: 13 }}
          onClick={() => onExport(config)}
        >
          Export
        </button>
        {onDelete && (
          <button
            type="button"
            className="scenario-button scenario-button--ghost"
            style={{ padding: '6px 12px', fontSize: 13, color: '#b91c1c' }}
            onClick={() => onDelete(config.id)}
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

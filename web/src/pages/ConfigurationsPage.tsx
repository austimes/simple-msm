import { useState, useCallback } from 'react';
import { usePackageStore } from '../data/packageStore';
import type { SolveConfiguration } from '../data/configurationTypes';
import {
  loadBuiltinConfigurations,
  loadUserConfigurations,
  fetchUserConfigurations,
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

  const refreshUserConfigs = useCallback(async () => {
    const configs = await fetchUserConfigurations();
    setUserConfigs(configs);
  }, []);

  function handleLoad(config: SolveConfiguration) {
    loadConfiguration(config);
  }

  async function handleSaveAs() {
    const name = prompt('Configuration name:');
    if (!name?.trim()) return;

    const config = createConfigurationFromScenario(
      currentScenario,
      defaultScenario,
      includedOutputIds,
      appConfig,
    );
    config.name = name.trim();
    config.id = slugify(name.trim());

    // Avoid id collision with built-ins
    const builtinIds = new Set(builtinConfigs.map((c) => c.id));
    if (builtinIds.has(config.id)) {
      config.id = `${config.id}-custom`;
    }

    const error = await saveUserConfiguration(config);
    if (error) {
      setSaveNotice(`Error: ${error}`);
    } else {
      setSaveNotice(`Saved "${config.name}" as a new user configuration.`);
      await refreshUserConfigs();
    }
  }

  async function handleOverwrite(existingConfig: SolveConfiguration) {
    const config = createConfigurationFromScenario(
      currentScenario,
      defaultScenario,
      includedOutputIds,
      appConfig,
    );
    config.id = existingConfig.id;
    config.name = existingConfig.name;

    const error = await saveUserConfiguration(config);
    if (error) {
      setSaveNotice(`Error: ${error}`);
    } else {
      setSaveNotice(`Updated "${config.name}".`);
      await refreshUserConfigs();
    }
  }

  async function handleDelete(configId: string) {
    const error = await deleteUserConfiguration(configId);
    if (error) {
      setSaveNotice(`Error: ${error}`);
    } else {
      setSaveNotice('Deleted configuration.');
      await refreshUserConfigs();
    }
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

  // Find the active user config for the "Save" (overwrite) button
  const activeUserConfig = activeConfigurationId
    ? userConfigs.find((c) => c.id === activeConfigurationId)
    : null;

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

      <div className="scenario-action-row" style={{ marginTop: 16, gap: 8 }}>
        <button type="button" className="scenario-button" onClick={handleSaveAs}>
          Save as new configuration…
        </button>
        {activeUserConfig && (
          <button
            type="button"
            className="scenario-button"
            onClick={() => handleOverwrite(activeUserConfig)}
          >
            Save to "{activeUserConfig.name}"
          </button>
        )}
      </div>

      <section className="scenario-panel" style={{ marginTop: 24 }}>
        <h2>Built-in configurations</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
          Shipped with the app — read-only test fixtures.
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

      <section className="scenario-panel" style={{ marginTop: 16 }}>
        <h2>User configurations</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 16 }}>
          Saved in the repository under <code>configurations/user/</code>. You can load, modify, and re-save these.
        </p>
        {userConfigs.length > 0 ? (
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
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            No user configurations yet. Use "Save as new configuration" above to create one.
          </p>
        )}
      </section>
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
        {config.readonly ? (
          <span className="config-badge config-badge--readonly">test</span>
        ) : (
          <span className="config-badge config-badge--user">user</span>
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

function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-+|-+$/g, '') || `config-${Date.now()}`
  );
}

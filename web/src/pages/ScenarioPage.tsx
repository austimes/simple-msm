import { usePackageStore } from '../data/packageStore';

const numberFormatter = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 2,
});

function formatModeLabel(mode: string): string {
  return mode.replaceAll('_', ' ');
}

export default function ScenarioPage() {
  const defaultScenario = usePackageStore((state) => state.defaultScenario);

  const serviceDemandEntries = Object.entries(defaultScenario.service_demands);
  const externalCommodityEntries = Object.entries(
    defaultScenario.external_commodity_demands ?? {},
  );
  const controlsByMode = Object.values(defaultScenario.service_controls).reduce<
    Record<string, number>
  >((counts, control) => {
    counts[control.mode] = (counts[control.mode] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="page">
      <h1>Scenario</h1>
      <p>
        The app now ships with a validated v0.2 reference scenario. Its resolved
        service and external commodity demand tables stay explicit and exogenous,
        while the demand-generation block preserves how those values were derived.
      </p>

      <section className="scenario-overview-grid">
        <article className="scenario-panel scenario-panel--hero">
          <span className="scenario-badge">Default seed</span>
          <h2>{defaultScenario.name}</h2>
          <p>{defaultScenario.description}</p>

          <dl className="scenario-key-value-list">
            <div>
              <dt>Milestone years</dt>
              <dd>{defaultScenario.years.join(', ')}</dd>
            </div>
            <div>
              <dt>Demand generation mode</dt>
              <dd>{formatModeLabel(defaultScenario.demand_generation.mode)}</dd>
            </div>
            <div>
              <dt>Demand preset</dt>
              <dd>{defaultScenario.demand_generation.preset_id ?? 'Manual table'}</dd>
            </div>
            <div>
              <dt>Commodity pricing preset</dt>
              <dd>{defaultScenario.commodity_pricing.preset_id}</dd>
            </div>
          </dl>
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
              <strong>{Object.keys(defaultScenario.carbon_price).length}</strong>
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
                {defaultScenario.years.map((year) => {
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

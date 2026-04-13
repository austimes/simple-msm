import { useMemo } from 'react';
import { usePackageStore } from '../data/packageStore';
import { summarizeOverlayTotals } from '../data/balanceDiagnostics';
import type { ResidualOverlayRow } from '../data/types';

function fmt(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

interface AggregatedEnergyOverlay {
  overlay_id: string;
  overlay_label: string;
  final_energy_pj_2025: number;
  direct_energy_emissions_mtco2e_2025: number;
}

function aggregateEnergyOverlays(rows: ResidualOverlayRow[]): AggregatedEnergyOverlay[] {
  const map = new Map<string, AggregatedEnergyOverlay>();
  for (const row of rows) {
    const existing = map.get(row.overlay_id);
    if (existing) {
      existing.final_energy_pj_2025 += row.final_energy_pj_2025 ?? 0;
      existing.direct_energy_emissions_mtco2e_2025 += row.direct_energy_emissions_mtco2e_2025 ?? 0;
    } else {
      map.set(row.overlay_id, {
        overlay_id: row.overlay_id,
        overlay_label: row.overlay_label,
        final_energy_pj_2025: row.final_energy_pj_2025 ?? 0,
        direct_energy_emissions_mtco2e_2025: row.direct_energy_emissions_mtco2e_2025 ?? 0,
      });
    }
  }
  return Array.from(map.values());
}

export default function BaselineClosureDiagnosticsCard() {
  const residualOverlays2025 = usePackageStore((state) => state.residualOverlays2025);

  const totals = useMemo(
    () => summarizeOverlayTotals(residualOverlays2025),
    [residualOverlays2025],
  );

  const aggregatedEnergy = useMemo(
    () => aggregateEnergyOverlays(
      residualOverlays2025.filter((r) => r.overlay_domain === 'energy_residual' && r.default_include),
    ),
    [residualOverlays2025],
  );

  const includedNonEnergy = useMemo(
    () => residualOverlays2025.filter((r) => r.overlay_domain === 'nonenergy_residual' && r.default_include),
    [residualOverlays2025],
  );

  const excludedNonEnergy = useMemo(
    () => residualOverlays2025.filter((r) => r.overlay_domain !== 'energy_residual' && !r.default_include),
    [residualOverlays2025],
  );

  return (
    <section className="methods-content-card">
      <h2>Baseline closure diagnostics (2025)</h2>
      <p>
        These residual overlay layers account for parts of the economy not explicitly modeled as
        optimizable sector states. They are fixed 2025 accounting entries used for balance-sheet
        closure only.
      </p>

      <h3>Residual energy overlays</h3>
      <div className="library-mini-table">
        <div className="library-mini-table-row library-mini-table-row--header">
          <span>Overlay sector</span>
          <span>Final energy (PJ)</span>
          <span>Emissions (MtCO₂e)</span>
        </div>
        {aggregatedEnergy.map((row) => (
          <div key={row.overlay_id} className="library-mini-table-row">
            <span>{row.overlay_label}</span>
            <span>{fmt(row.final_energy_pj_2025)}</span>
            <span>{fmt(row.direct_energy_emissions_mtco2e_2025)}</span>
          </div>
        ))}
        <div className="library-mini-table-row library-mini-table-row--header">
          <span>Total</span>
          <span>{fmt(totals.totalResidualEnergyPj)}</span>
          <span>{fmt(totals.totalResidualEnergyEmissions)}</span>
        </div>
      </div>

      <h3>Residual non-energy emissions overlays</h3>
      <div className="library-mini-table">
        <div className="library-mini-table-row library-mini-table-row--header">
          <span>Overlay</span>
          <span>Emissions (MtCO₂e)</span>
        </div>
        {includedNonEnergy.map((row) => (
          <div key={row.overlay_id} className="library-mini-table-row">
            <span>{row.overlay_label}</span>
            <span>{fmt(row.other_emissions_mtco2e_2025 ?? 0)}</span>
          </div>
        ))}
        <div className="library-mini-table-row library-mini-table-row--header">
          <span>Total (excl. LULUCF)</span>
          <span>{fmt(totals.totalResidualNonEnergyEmissions)}</span>
        </div>
      </div>

      {excludedNonEnergy.length > 0 ? (
        <div className="configuration-provenance-note">
          <strong>Excluded by default</strong>
          <p>
            {excludedNonEnergy.map((row) => (
              <span key={row.overlay_id}>
                {row.overlay_label}: {fmt(row.other_emissions_mtco2e_2025 ?? row.carbon_billable_emissions_mtco2e_2025 ?? 0)} MtCO₂e.{' '}
              </span>
            ))}
            These overlays (e.g. LULUCF sink) are kept separate because their sign or accounting
            treatment differs from the positive-emitting sectors.
          </p>
        </div>
      ) : null}

      <h3>Summary</h3>
      <div className="configuration-stat-grid">
        <div className="configuration-stat-card">
          <span>Residual energy</span>
          <strong>{fmt(totals.totalResidualEnergyPj, 1)} PJ</strong>
        </div>
        <div className="configuration-stat-card">
          <span>Residual energy emissions</span>
          <strong>{fmt(totals.totalResidualEnergyEmissions, 1)} MtCO₂e</strong>
        </div>
        <div className="configuration-stat-card">
          <span>Non-energy emissions</span>
          <strong>{fmt(totals.totalResidualNonEnergyEmissions, 1)} MtCO₂e</strong>
        </div>
        {totals.lulucfSinkMtco2e != null ? (
          <div className="configuration-stat-card">
            <span>LULUCF sink (optional)</span>
            <strong>{fmt(totals.lulucfSinkMtco2e, 1)} MtCO₂e</strong>
          </div>
        ) : null}
        {totals.totalOverlayCommodityCostAudm2024 > 0 ? (
          <div className="configuration-stat-card">
            <span>Overlay commodity cost</span>
            <strong>{fmt(totals.totalOverlayCommodityCostAudm2024, 1)} AUD M</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

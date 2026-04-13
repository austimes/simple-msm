import { useMemo } from 'react';
import { usePackageStore } from '../data/packageStore';
import { summarizeOverlayTotals } from '../data/balanceDiagnostics';

function fmt(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

export default function BaselineClosureDiagnosticsCard() {
  const residualEnergyOverlays2025 = usePackageStore((state) => state.residualEnergyOverlays2025);
  const residualNonEnergyEmissionsOverlays2025 = usePackageStore(
    (state) => state.residualNonEnergyEmissionsOverlays2025,
  );

  const totals = useMemo(
    () => summarizeOverlayTotals(residualEnergyOverlays2025, residualNonEnergyEmissionsOverlays2025),
    [residualEnergyOverlays2025, residualNonEnergyEmissionsOverlays2025],
  );

  const includedEnergy = useMemo(
    () => residualEnergyOverlays2025.filter((r) => r.default_include),
    [residualEnergyOverlays2025],
  );

  const includedNonEnergy = useMemo(
    () => residualNonEnergyEmissionsOverlays2025.filter((r) => r.default_include),
    [residualNonEnergyEmissionsOverlays2025],
  );

  const excludedNonEnergy = useMemo(
    () => residualNonEnergyEmissionsOverlays2025.filter((r) => !r.default_include),
    [residualNonEnergyEmissionsOverlays2025],
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
        {includedEnergy.map((row) => (
          <div key={row.overlay_sector_id} className="library-mini-table-row">
            <span>{row.overlay_sector_label}</span>
            <span>{fmt(row.total_final_energy_pj_2025)}</span>
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
            <span>{fmt(row.emissions_mtco2e_2025)}</span>
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
                {row.overlay_label}: {fmt(row.emissions_mtco2e_2025)} MtCO₂e.{' '}
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
      </div>
    </section>
  );
}

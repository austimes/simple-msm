import { useMemo } from 'react';
import { usePackageStore } from '../data/packageStore';
import {
  summarizeOverlayTotals,
  summarizeResidualFamilyTotals,
} from '../data/balanceDiagnostics';
import {
  AGGREGATED_RESIDUAL_OVERLAY_LABEL,
  DEFAULT_RESIDUAL_OVERLAY_DISPLAY_MODE,
  getResidualOverlayDisplayBucket,
} from '../data/residualOverlayPresentation.ts';
import type { ResidualOverlayRow } from '../data/types';

function fmt(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

interface AggregatedResidualOverlay {
  overlay_id: string;
  overlay_label: string;
  final_energy_pj_2025: number;
  direct_energy_emissions_mtco2e_2025: number;
  other_emissions_mtco2e_2025: number;
}

function aggregateResidualOverlays(rows: ResidualOverlayRow[]): AggregatedResidualOverlay[] {
  const map = new Map<string, AggregatedResidualOverlay>();
  for (const row of rows) {
    const bucket = getResidualOverlayDisplayBucket(
      {
        overlayId: row.overlay_id,
        overlayDomain: row.overlay_domain,
        overlayLabel: row.overlay_label,
      },
      DEFAULT_RESIDUAL_OVERLAY_DISPLAY_MODE,
    );
    const existing = map.get(bucket.overlayId);
    if (existing) {
      existing.final_energy_pj_2025 += row.final_energy_pj_2025 ?? 0;
      existing.direct_energy_emissions_mtco2e_2025 += row.direct_energy_emissions_mtco2e_2025 ?? 0;
      existing.other_emissions_mtco2e_2025 += row.other_emissions_mtco2e_2025 ?? 0;
    } else {
      map.set(bucket.overlayId, {
        overlay_id: bucket.overlayId,
        overlay_label: bucket.overlayLabel,
        final_energy_pj_2025: row.final_energy_pj_2025 ?? 0,
        direct_energy_emissions_mtco2e_2025: row.direct_energy_emissions_mtco2e_2025 ?? 0,
        other_emissions_mtco2e_2025: row.other_emissions_mtco2e_2025 ?? 0,
      });
    }
  }
  return Array.from(map.values());
}

export default function BaselineClosureDiagnosticsCard() {
  const residualOverlays2025 = usePackageStore((state) => state.residualOverlays2025);
  const sectorStates = usePackageStore((state) => state.sectorStates);
  const hasOverlayRows = residualOverlays2025.length > 0;

  const totals = useMemo(
    () => hasOverlayRows
      ? summarizeOverlayTotals(residualOverlays2025)
      : summarizeResidualFamilyTotals(sectorStates),
    [hasOverlayRows, residualOverlays2025, sectorStates],
  );

  const aggregatedResiduals = useMemo(
    () => aggregateResidualOverlays(
      residualOverlays2025.filter((row) => row.default_include),
    ),
    [residualOverlays2025],
  );

  const netSinkRows = useMemo(
    () => residualOverlays2025.filter((row) => row.overlay_domain === 'net_sink'),
    [residualOverlays2025],
  );

  return (
    <section className="methods-content-card">
      <h2>Baseline closure diagnostics (2025)</h2>
      <p>
        {hasOverlayRows
          ? 'These residual overlay layers account for parts of the economy not explicitly modeled as optimizable sector states. They are fixed 2025 accounting entries used for balance-sheet closure only.'
          : 'Residual closure is represented by first-class residual family rows. Those rows carry demand, commodity inputs, and emissions through the same solve path as modeled segments.'}
      </p>

      <h3>{hasOverlayRows ? AGGREGATED_RESIDUAL_OVERLAY_LABEL : 'Residual family closure'}</h3>
      <div className="library-mini-table">
        <div className="library-mini-table-row library-mini-table-row--header">
          <span>Residual component</span>
          <span>Final energy (PJ)</span>
          <span>Energy emissions (MtCO₂e)</span>
          <span>Non-energy emissions (MtCO₂e)</span>
        </div>
        {hasOverlayRows ? aggregatedResiduals.map((row) => (
          <div key={row.overlay_id} className="library-mini-table-row">
            <span>{row.overlay_label}</span>
            <span>{fmt(row.final_energy_pj_2025)}</span>
            <span>{fmt(row.direct_energy_emissions_mtco2e_2025)}</span>
            <span>{fmt(row.other_emissions_mtco2e_2025)}</span>
          </div>
        )) : null}
        <div className="library-mini-table-row library-mini-table-row--header">
          <span>Total</span>
          <span>{fmt(totals.totalResidualEnergyPj)}</span>
          <span>{fmt(totals.totalResidualEnergyEmissions)}</span>
          <span>{fmt(totals.totalResidualNonEnergyEmissions)}</span>
        </div>
      </div>

      {netSinkRows.length > 0 ? (
        <div className="configuration-provenance-note">
          <strong>Net sinks stay separate</strong>
          <p>
            {netSinkRows.map((row) => (
              <span key={row.overlay_id}>
                {row.overlay_label}: {fmt(row.other_emissions_mtco2e_2025 ?? row.carbon_billable_emissions_mtco2e_2025 ?? 0)} MtCO₂e.{' '}
              </span>
            ))}
            Net sinks are excluded from the default positive-emitting residual aggregate because
            their sign and accounting treatment differ from the closure components above.
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
        {totals.residualFinalElectricityTwh != null ? (
          <div className="configuration-stat-card">
            <span>Residual final electricity</span>
            <strong>{fmt(totals.residualFinalElectricityTwh, 3)} TWh</strong>
          </div>
        ) : null}
        {totals.gridLossesOwnUseElectricityTwh != null ? (
          <div className="configuration-stat-card">
            <span>Grid losses and own-use</span>
            <strong>{fmt(totals.gridLossesOwnUseElectricityTwh, 3)} TWh</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

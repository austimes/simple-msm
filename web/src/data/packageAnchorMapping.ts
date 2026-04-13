import type { BaselineActivityAnchor, OutputRoleMetadata, ServiceDemandAnchorRow } from './types.ts';

export function deriveBaselineAnchorsFromPackage(
  rows: ServiceDemandAnchorRow[],
  outputRoles?: Record<string, OutputRoleMetadata>,
): Record<string, BaselineActivityAnchor> {
  const anchors: Record<string, BaselineActivityAnchor> = {};

  for (const row of rows) {
    if (row.anchor_type === 'service_demand_anchor') {
      const key = row.service_or_output_name;
      const roleMeta = outputRoles?.[key];
      anchors[key] = {
        output_role: roleMeta?.output_role ?? 'required_service',
        anchor_kind: 'service_demand',
        anchor_year: 2025,
        value: row.quantity_2025 ?? 0,
        unit: row.unit,
        provenance_note: `${row.source_family} — ${row.coverage_note}`,
      };
    } else if (row.anchor_type === 'external_electricity_balance_anchor') {
      anchors['electricity'] = {
        output_role: 'endogenous_supply_commodity',
        anchor_kind: 'external_commodity_demand',
        anchor_year: 2025,
        value: row.quantity_2025 ?? 0,
        unit: row.unit,
        provenance_note: `${row.source_family} — ${row.coverage_note}`,
      };
    }
    // Skip 'derived_explicit_electricity_load' and 'electricity_output_benchmark' — informational only
  }

  return anchors;
}

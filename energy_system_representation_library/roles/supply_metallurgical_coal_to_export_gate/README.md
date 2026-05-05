# Supply metallurgical coal to export gate

- Role id: `supply_metallurgical_coal_to_export_gate`
- Default representation: `supply_metallurgical_coal_to_export_gate__pathway_bundle`
- Default method: `export_metallurgical_coal_supply__residual_incumbent`

This role gives Australian export coal supply an explicit export-gate boundary in the role graph. The current implementation is residual coverage only: it carries one placeholder activity unit for extraction, preparation, transport, and port delivery.

Overseas combustion or steelmaking is outside this boundary. Coal mine fugitive methane remains visible through `account_energy_system_fugitive_emissions` until explicit thermal and metallurgical coal supply pathways allocate those releases.

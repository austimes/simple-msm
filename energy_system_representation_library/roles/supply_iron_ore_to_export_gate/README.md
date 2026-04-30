# Supply iron ore to export gate

- Role id: `supply_iron_ore_to_export_gate`
- Default representation: `supply_iron_ore_to_export_gate__pathway_bundle`
- Default method: `export_iron_ore_supply__residual_incumbent`

This role gives Australian export iron ore supply an explicit export-gate boundary in the role graph. The current implementation is residual coverage only: it carries one placeholder activity unit for extraction, processing, transport, and port delivery.

Overseas steelmaking is outside this boundary. Explicit mine, processing, rail, and port pathways can replace this residual placeholder when source data are authored.

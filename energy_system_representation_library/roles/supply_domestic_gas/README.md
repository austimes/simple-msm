# Supply domestic gas

- Role id: `supply_domestic_gas`
- Default representation: `supply_domestic_gas__pathway_bundle`
- Default method: `domestic_gas_supply__residual_incumbent`

This role gives domestic fuel supply an explicit physical boundary in the role graph. The current implementation is residual coverage only: it carries one placeholder activity unit and does not move mining-energy or fugitive-emissions calibration into the carrier role.

Upstream releases remain visible through `account_residual_mining_energy` and `account_energy_system_fugitive_emissions` until carrier-specific extraction, conversion, transport, storage, and delivery pathways are authored.

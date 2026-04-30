# Physical Doing-Word Role Graph

Date: 2026-04-30

Status: proposed design for `simple-msm-physrole-1.1`

Related context:

- [20260428-esrl-ontology-decision.md](./20260428-esrl-ontology-decision.md)
- [20260428-esrl-role-topology-plan.md](./20260428-esrl-role-topology-plan.md)

## Purpose

This note proposes the first physical role graph for the library. It uses the role-topology ontology already accepted for ESRL, but tightens the physical structure:

- every graph node is named as a verb/object phrase,
- reporting sectors are migration context only,
- process heat is modeled inside the host role that needs heat, not as a standalone national heat system,
- export-resource supply is represented at Australia's export boundary, not only as domestic mining residuals.

This is a design artifact for the next schema and migration issues. It is not yet the canonical CSV schema.

## Naming Rules

Role IDs should use imperative verb/object phrases:

| Pattern | Example | Use |
| --- | --- | --- |
| `serve_<object>` | `serve_residential_building_occupants` | Services delivered to people or buildings |
| `move_<object>` | `move_passengers_by_road` | Transport service roles |
| `make_<object>` | `make_crude_steel` | Industrial production roles |
| `provide_<object>_for_<host>` | `provide_high_temperature_heat_for_cement_making` | Host-owned intermediate service roles |
| `supply_<object>` | `supply_grid_electricity` | Domestic energy and material supply roles |
| `supply_<object>_to_export_gate` | `supply_thermal_coal_to_export_gate` | Australian export-boundary roles |
| `manage_<object>` | `manage_municipal_solid_waste` | Waste and water roles |
| `remove_<object>` | `remove_co2_through_land_sequestration` | Removal roles |
| `account_<object>` | `account_remaining_manufacturing_activity` | Explicit residual coverage roles |

Noun-only buckets such as `buildings`, `transport`, `energy_supply`, `industrial_heat`, `mining`, `sector`, and `subsector` should not be physical role nodes. They may remain as reporting allocation labels.

## Proposed Root Graph

The graph starts from one required root role and decomposes into doing-word child roles. Root children are still roles, not display categories.

| Role ID | Parent role | Role label | Boundary |
| --- | --- | --- | --- |
| `operate_australian_energy_and_emissions_system` | | Operate Australian energy and emissions system | Australia domestic activity plus Australian export-gate resource supply |
| `serve_building_occupants` | `operate_australian_energy_and_emissions_system` | Serve building occupants | Residential and commercial building services |
| `move_people_and_freight` | `operate_australian_energy_and_emissions_system` | Move people and freight | Domestic passenger and freight mobility |
| `make_materials_and_products` | `operate_australian_energy_and_emissions_system` | Make materials and products | Domestic industrial production, construction, and manufacturing activity |
| `supply_domestic_energy_carriers` | `operate_australian_energy_and_emissions_system` | Supply domestic energy carriers | Energy carriers delivered to domestic roles |
| `grow_food_and_biomass` | `operate_australian_energy_and_emissions_system` | Grow food and biomass | Agriculture, land production, and biological emissions |
| `manage_water_and_waste` | `operate_australian_energy_and_emissions_system` | Manage water and waste | Water services, wastewater, and waste emissions |
| `remove_and_store_carbon` | `operate_australian_energy_and_emissions_system` | Remove and store carbon | Land and engineered removals or storage services |
| `supply_resources_to_export_gate` | `operate_australian_energy_and_emissions_system` | Supply resources to export gate | Australian extraction, processing, transport, and loading to export boundary |
| `account_remaining_domestic_activity` | `operate_australian_energy_and_emissions_system` | Account remaining domestic activity | Explicit residual coverage until richer roles exist |

## Building Service Roles

| Role ID | Parent role | Role label | Notes |
| --- | --- | --- | --- |
| `serve_residential_building_occupants` | `serve_building_occupants` | Serve residential building occupants | Replaces the current residential building service top-level role. |
| `serve_commercial_building_occupants` | `serve_building_occupants` | Serve commercial building occupants | Replaces the current commercial building service top-level role. |
| `provide_residential_space_conditioning` | `serve_residential_building_occupants` | Provide residential space conditioning | Optional decomposition child when end-use detail is active. |
| `provide_residential_water_heating` | `serve_residential_building_occupants` | Provide residential water heating | Candidate technology-representation pilot. |
| `provide_residential_cooking_services` | `serve_residential_building_occupants` | Provide residential cooking services | Optional decomposition child. |
| `provide_residential_appliance_services` | `serve_residential_building_occupants` | Provide residential appliance services | Optional decomposition child. |
| `account_remaining_residential_building_services` | `serve_residential_building_occupants` | Account remaining residential building services | Explicit residual child. |
| `account_remaining_commercial_building_services` | `serve_commercial_building_occupants` | Account remaining commercial building services | Explicit residual child. |

## Transport Roles

| Role ID | Parent role | Role label | Notes |
| --- | --- | --- | --- |
| `move_passengers_by_road` | `move_people_and_freight` | Move passengers by road | Migrates current passenger road transport coverage. |
| `move_freight_by_road` | `move_people_and_freight` | Move freight by road | Migrates current freight road transport coverage. |
| `move_passengers_by_nonroad_modes` | `move_people_and_freight` | Move passengers by non-road modes | Explicit role or residual for aviation, rail, maritime, and other passenger movement. |
| `move_freight_by_nonroad_modes` | `move_people_and_freight` | Move freight by non-road modes | Explicit role or residual for rail, domestic shipping, aviation, and other freight movement. |
| `account_remaining_transport_activity` | `move_people_and_freight` | Account remaining transport activity | Residual coverage while non-road roles mature. |

## Material And Product Roles

Process heat appears here as host-owned child roles. A heat role should exist only when a specific host production role needs it or when a real shared heat network is modeled.

| Role ID | Parent role | Role label | Notes |
| --- | --- | --- | --- |
| `make_crude_steel` | `make_materials_and_products` | Make crude steel | Can use aggregate pathways or decompose into DRI and finishing roles. |
| `make_non_h2_dri_crude_steel` | `make_crude_steel` | Make non-H2 DRI crude steel | Residual or aggregate child in the DRI decomposition. |
| `make_direct_reduced_iron` | `make_crude_steel` | Make direct reduced iron | Intermediate child for DRI process-chain representations. |
| `melt_and_refine_dri_into_crude_steel` | `make_crude_steel` | Melt and refine DRI into crude steel | Finishing child for DRI process-chain representations. |
| `provide_high_temperature_heat_for_steel_making` | `make_crude_steel` | Provide high temperature heat for steel making | Host-owned heat service if steel decomposition needs explicit heat. |
| `make_cement_equivalent` | `make_materials_and_products` | Make cement equivalent | Can decompose into clinker, grinding, blending, and residual coverage. |
| `make_clinker_for_cement` | `make_cement_equivalent` | Make clinker for cement | Host production child when cement decomposition is active. |
| `provide_high_temperature_heat_for_clinker_making` | `make_clinker_for_cement` | Provide high temperature heat for clinker making | Host-owned heat child, not a national heat role. |
| `grind_and_blend_cement_equivalent` | `make_cement_equivalent` | Grind and blend cement equivalent | Candidate child for electricity and material blend measures. |
| `make_chemicals_and_other_materials` | `make_materials_and_products` | Make chemicals and other materials | Explicit residual or future pathway role. |
| `construct_built_assets` | `make_materials_and_products` | Construct built assets | Construction activity role. |
| `account_remaining_manufacturing_activity` | `make_materials_and_products` | Account remaining manufacturing activity | Residual manufacturing energy and process coverage. |
| `account_remaining_industrial_process_emissions` | `make_materials_and_products` | Account remaining industrial process emissions | Residual IPPU coverage outside explicit production roles. |

## Domestic Energy Supply Roles

Domestic supply roles cover energy carriers consumed by Australian roles. They do not stand in for export-bound resource supply.

| Role ID | Parent role | Role label | Notes |
| --- | --- | --- | --- |
| `supply_grid_electricity` | `supply_domestic_energy_carriers` | Supply grid electricity | Migrates current electricity supply role. |
| `generate_grid_electricity` | `supply_grid_electricity` | Generate grid electricity | Optional decomposition child for generation technology detail. |
| `firm_and_store_grid_electricity` | `supply_grid_electricity` | Firm and store grid electricity | Optional decomposition child for storage and firming. |
| `deliver_grid_electricity` | `supply_grid_electricity` | Deliver grid electricity | Optional grid delivery child. |
| `account_grid_losses_and_own_use` | `supply_grid_electricity` | Account grid losses and own use | Explicit child or residual. |
| `supply_domestic_gas` | `supply_domestic_energy_carriers` | Supply domestic gas | Domestic production, processing, imports, and delivery to Australian users. |
| `supply_domestic_liquid_fuels` | `supply_domestic_energy_carriers` | Supply domestic liquid fuels | Domestic refining, imports, blending, and delivery. |
| `supply_domestic_solid_fuels` | `supply_domestic_energy_carriers` | Supply domestic solid fuels | Coal and other solid fuel delivery to Australian users. |
| `account_remaining_energy_supply_activity` | `supply_domestic_energy_carriers` | Account remaining energy supply activity | Residual domestic energy extraction and supply coverage. |
| `account_remaining_fugitive_emissions` | `supply_domestic_energy_carriers` | Account remaining fugitive emissions | Residual fugitive emissions that cannot yet be assigned to richer supply roles. |

## Agriculture, Water, Waste, And Removals

| Role ID | Parent role | Role label | Notes |
| --- | --- | --- | --- |
| `raise_livestock_output` | `grow_food_and_biomass` | Raise livestock output | Migrates current livestock output coverage. |
| `grow_crops_and_horticulture_output` | `grow_food_and_biomass` | Grow crops and horticulture output | Migrates current crop and horticulture coverage. |
| `manage_agricultural_soils_and_residues` | `grow_food_and_biomass` | Manage agricultural soils and residues | Candidate biological-emissions role. |
| `account_remaining_agricultural_activity` | `grow_food_and_biomass` | Account remaining agricultural activity | Explicit residual coverage. |
| `provide_water_services` | `manage_water_and_waste` | Provide water services | Future water role or residual. |
| `treat_wastewater` | `manage_water_and_waste` | Treat wastewater | Future wastewater role or residual. |
| `manage_municipal_solid_waste` | `manage_water_and_waste` | Manage municipal solid waste | Future waste role or residual. |
| `account_remaining_water_and_waste_activity` | `manage_water_and_waste` | Account remaining water and waste activity | Residual coverage. |
| `remove_co2_through_land_sequestration` | `remove_and_store_carbon` | Remove CO2 through land sequestration | Migrates current land sequestration coverage. |
| `remove_co2_through_engineered_removals` | `remove_and_store_carbon` | Remove CO2 through engineered removals | Migrates current engineered removals coverage. |
| `store_captured_co2` | `remove_and_store_carbon` | Store captured CO2 | Placeholder for carbon transport and storage chains. |
| `account_remaining_land_sink_adjustment` | `remove_and_store_carbon` | Account remaining land sink adjustment | Explicit LULUCF reconciliation role. |

## Export-Gate Resource Roles

These roles cover Australian activity required to place resources at the export boundary. They include domestic extraction, preparation, processing, transport, and loading when those activities occur in Australia. They exclude overseas combustion, processing, or use.

| Role ID | Parent role | Role label | Export boundary |
| --- | --- | --- | --- |
| `supply_thermal_coal_to_export_gate` | `supply_resources_to_export_gate` | Supply thermal coal to export gate | Coal loaded for export from Australia. |
| `supply_metallurgical_coal_to_export_gate` | `supply_resources_to_export_gate` | Supply metallurgical coal to export gate | Coal loaded for export from Australia. |
| `supply_lng_to_export_gate` | `supply_resources_to_export_gate` | Supply LNG to export gate | LNG loaded for export from Australia. |
| `supply_iron_ore_to_export_gate` | `supply_resources_to_export_gate` | Supply iron ore to export gate | Iron ore loaded for export from Australia. |
| `supply_bauxite_and_alumina_to_export_gate` | `supply_resources_to_export_gate` | Supply bauxite and alumina to export gate | Bauxite or alumina loaded for export from Australia. |
| `supply_critical_minerals_to_export_gate` | `supply_resources_to_export_gate` | Supply critical minerals to export gate | Lithium, nickel, copper, rare earths, and other minerals loaded for export from Australia. |
| `account_remaining_export_resource_supply` | `supply_resources_to_export_gate` | Account remaining export resource supply | Residual export-resource activity until explicit roles exist. |

## Candidate Physical Edges

Role hierarchy answers coverage. Physical edges should separately describe flows or dependencies between roles.

| Edge kind | From role | To role | Meaning |
| --- | --- | --- | --- |
| `supplies_energy_carrier_to` | `supply_grid_electricity` | `serve_residential_building_occupants` | Electricity can satisfy building service methods. |
| `supplies_energy_carrier_to` | `supply_domestic_gas` | `make_materials_and_products` | Domestic gas can feed host production methods. |
| `supplies_intermediate_to` | `make_direct_reduced_iron` | `melt_and_refine_dri_into_crude_steel` | DRI output feeds crude-steel finishing. |
| `provides_host_service_to` | `provide_high_temperature_heat_for_clinker_making` | `make_clinker_for_cement` | Heat service is inside the cement host boundary. |
| `sends_captured_co2_to` | `make_cement_equivalent` | `store_captured_co2` | Captured process CO2 can flow to transport/storage roles. |
| `prepares_export_resource_for` | `supply_domestic_energy_carriers` | `supply_resources_to_export_gate` | Shared extraction infrastructure may support export-bound resource supply, but the export role owns export-bound coverage. |

These edge examples are not reporting allocations. They are physical context for navigation, validation, and future balancing.

## Migration Notes

| Current library surface | Proposed treatment |
| --- | --- |
| `deliver_low_temperature_heat`, `deliver_medium_temperature_heat`, `deliver_high_temperature_heat` | Retire as standalone top-level physical roles. Re-author as host-owned heat children only where a production or service role has explicit heat decomposition. |
| `produce_crude_steel` | Rename to `make_crude_steel` when the physical graph lands. Current aggregate methods become one representation of the host role. |
| `produce_cement_equivalent` | Rename to `make_cement_equivalent`. Add host children for clinker, grinding, blending, and explicit process heat when decomposed. |
| `supply_electricity` | Rename to `supply_grid_electricity`. Keep domestic supply boundary separate from export-bound resource roles. |
| `account_residual_mining_energy` | Split into domestic energy supply residuals and explicit export-gate resource roles. |
| `account_residual_fugitives` | Keep as residual only until fugitive emissions can be assigned to domestic and export resource supply roles. |
| `sector`, `subsector`, and topology area labels | Keep only as reporting allocation or UI grouping metadata, not physical role nodes. |

## Acceptance Check

This proposal satisfies the design constraints for `simple-msm-physrole-1.1`:

- every proposed physical graph node uses a verb/object role name,
- process heat is represented as a child of the host production role that needs heat,
- no standalone national low-, medium-, or high-temperature heat system is proposed,
- export-resource supply is represented with explicit Australian export-gate roles,
- current library roles are treated as migration candidates rather than the design skeleton.

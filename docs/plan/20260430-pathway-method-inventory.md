# Pathway Method Migration Inventory

Date: 2026-04-30

Status: historical inventory for `simple-msm-pathways-1.1`

> **Note (2026-05-04):** The `shared/physical_system_nodes.csv` and
> `shared/role_memberships.csv` surfaces this inventory was written
> against were retired by the `esrl-clusters-v1` epic (commit
> `747ff8c`). Roles are now the canonical ontology and browse grouping
> uses `topology_area_id` / `topology_area_label` on `shared/roles.csv`.
> The "Target physical role/node" column below should now be read as a
> reference to the target role.

This inventory classifies every current authored method in
`energy_system_representation_library/roles/*/methods.csv` against the
canonical role graph in `shared/roles.csv`.

The current package contains 60 methods:

- 37 direct pathway or technology methods should move to the matching physical role/node.
- 9 generic process-heat methods should merge into host-owned heat representations.
- 14 residual methods should remain temporary residual coverage until later pathway issues replace or split them.
- 0 methods are retired outright at this step. The standalone generic heat roles are the surface to retire after their method concepts move into host-owned roles.

## Disposition Rules

| Disposition | Meaning |
| --- | --- |
| `move` | Keep the method concept and move it under the target physical role/node and representation. |
| `merge` | Keep the method concept but merge it into a host-owned representation instead of preserving the current standalone role. |
| `temporary_residual` | Keep the residual method only as explicit coverage until a later issue authors pathway or richer residual coverage. |
| `retire` | Drop the method concept. No current method is classified this way. |

## Inventory

| Current role | Method ids | Count | Disposition | Target physical role/node | Target representation | Decision notes |
| --- | --- | ---: | --- | --- | --- | --- |
| `deliver_residential_building_services` | `buildings__residential__incumbent_mixed_fuels`, `buildings__residential__electrified_efficiency`, `buildings__residential__deep_electric` | 3 | `move` | `serve_residential_building_occupants` | `pathway_bundle` | Keep as the aggregate residential service pathway bundle. End-use decomposition is future work. |
| `deliver_commercial_building_services` | `buildings__commercial__incumbent_mixed_fuels`, `buildings__commercial__electrified_efficiency`, `buildings__commercial__deep_electric` | 3 | `move` | `serve_commercial_building_occupants` | `pathway_bundle` | Keep as the aggregate commercial service pathway bundle. |
| `deliver_passenger_road_transport` | `road_transport__passenger_road__ice_fleet`, `road_transport__passenger_road__hybrid_transition`, `road_transport__passenger_road__bev` | 3 | `move` | `move_passengers_by_road` | `pathway_bundle` | Keep road passenger pathways; non-road passenger coverage is a separate gap. |
| `deliver_freight_road_transport` | `road_transport__freight_road__diesel`, `road_transport__freight_road__efficient_diesel`, `road_transport__freight_road__bev`, `road_transport__freight_road__fcev_h2` | 4 | `move` | `move_freight_by_road` | `pathway_bundle` | Keep road freight pathways; rail, shipping, aviation, and other non-road freight are gaps. |
| `deliver_low_temperature_heat` | `generic_industrial_heat__low_temperature_heat__fossil`, `generic_industrial_heat__low_temperature_heat__electrified`, `generic_industrial_heat__low_temperature_heat__low_carbon_fuels` | 3 | `merge` | `provide_low_temperature_process_heat_for_host_roles` | host-owned direct representation | Do not preserve as a standalone national heat role. Reuse only where a host production role activates explicit heat detail. |
| `deliver_medium_temperature_heat` | `generic_industrial_heat__medium_temperature_heat__fossil`, `generic_industrial_heat__medium_temperature_heat__electrified`, `generic_industrial_heat__medium_temperature_heat__low_carbon_fuels` | 3 | `merge` | `provide_medium_temperature_process_heat_for_host_roles` | host-owned direct representation | Same treatment as low-temperature heat; attach to host roles rather than reporting sectors. |
| `deliver_high_temperature_heat` | `generic_industrial_heat__high_temperature_heat__fossil`, `generic_industrial_heat__high_temperature_heat__electrified`, `generic_industrial_heat__high_temperature_heat__low_carbon_fuels` | 3 | `merge` | `provide_high_temperature_process_heat_for_host_roles` | host-owned direct representation | Candidate hosts include steel and cement. The generic role surface should be removed after host-owned coverage exists. |
| `produce_crude_steel` | `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__scrap_eaf`, `steel__crude_steel__bf_bof_ccs_transition`, `steel__crude_steel__h2_dri_electric` | 4 | `move` | `make_crude_steel` | `pathway_bundle` | Keep as the aggregate crude-steel representation alongside the decomposition representation. |
| `produce_crude_steel_non_h2_dri_residual` | `steel__crude_steel_non_h2__bf_bof_conventional`, `steel__crude_steel_non_h2__scrap_eaf`, `steel__crude_steel_non_h2__bf_bof_ccs_transition` | 3 | `move` | `make_non_h2_dri_crude_steel` | `pathway_bundle` | Keep as the non-H2 residual child in the crude-steel decomposition pilot. |
| `produce_direct_reduced_iron` | `steel__dri__h2_shaft_furnace`, `steel__dri__gas_shaft_furnace`, `steel__dri__imported_residual` | 3 | `move` | `make_direct_reduced_iron` | `technology_bundle` | Keep as the DRI intermediate technology bundle. Imported residual remains explicit until supply-chain detail exists. |
| `melt_refine_dri_crude_steel` | `steel__dri_melt_refine__eaf_finishing`, `steel__dri_melt_refine__electric_smelter` | 2 | `move` | `melt_and_refine_dri_into_crude_steel` | `technology_bundle` | Keep as the DRI finishing technology bundle. |
| `produce_cement_equivalent` | `cement_clinker__cement_equivalent__conventional`, `cement_clinker__cement_equivalent__low_clinker_alt_fuels`, `cement_clinker__cement_equivalent__ccs_deep` | 3 | `move` | `make_cement_equivalent` | `pathway_bundle` | Keep aggregate cement pathways. Clinker, grinding, blending, heat, and CO2 storage decomposition remain gaps. |
| `supply_electricity` | `electricity__grid_supply__incumbent_thermal_mix`, `electricity__grid_supply__policy_frontier`, `electricity__grid_supply__deep_clean_firmed` | 3 | `move` | `supply_grid_electricity` | `pathway_bundle` | Keep domestic grid-supply methods. Generation, storage, firming, and delivery can later decompose under this role. |
| `account_electricity_grid_losses_own_use` | `electricity_grid_losses_own_use__residual_incumbent` | 1 | `temporary_residual` | `account_grid_losses_and_own_use` | residual method | Keep as explicit grid-system residual until losses and own-use are authored as richer methods. |
| `produce_livestock_output` | `agriculture__livestock__conventional`, `agriculture__livestock__mitigated` | 2 | `move` | `raise_livestock_output` | `pathway_bundle` | Keep livestock pathways. Biological methane and manure detail can be split later. |
| `produce_cropping_horticulture_output` | `agriculture__cropping_horticulture__conventional`, `agriculture__cropping_horticulture__mitigated` | 2 | `move` | `grow_crops_and_horticulture_output` | `pathway_bundle` | Keep cropping and horticulture pathways. Soils and residue detail remain a gap. |
| `remove_co2_land_sequestration` | `removals_negative_emissions__land_sequestration__biological_sink` | 1 | `move` | `remove_co2_through_land_sequestration` | `pathway_bundle` | Keep as the land-sequestration removal method. |
| `remove_co2_engineered_removals` | `removals_negative_emissions__engineered_removals__daccs` | 1 | `move` | `remove_co2_through_engineered_removals` | `pathway_bundle` | Keep DACCS as engineered-removal coverage. Storage/transport remains a separate role gap. |
| `account_residual_residential_buildings` | `residential_other__residual_incumbent` | 1 | `temporary_residual` | `account_remaining_residential_building_services` | residual method | Keep until residential end uses or remaining building services are decomposed. |
| `account_residual_commercial_buildings` | `commercial_other__residual_incumbent` | 1 | `temporary_residual` | `account_remaining_commercial_building_services` | residual method | Keep until commercial end uses or remaining building services are decomposed. |
| `move_passengers_by_rail` | `transport_rail_passenger__residual_incumbent` | 1 | `temporary_residual` | `move_passengers_by_rail` | residual method | Minimum passenger rail coverage split from the former transport-other bucket. |
| `move_freight_by_rail` | `transport_rail_freight__residual_incumbent` | 1 | `temporary_residual` | `move_freight_by_rail` | residual method | Minimum freight rail coverage split from the former transport-other bucket. |
| `move_passengers_by_air` | `transport_air_passenger__residual_incumbent` | 1 | `temporary_residual` | `move_passengers_by_air` | residual method | Minimum passenger aviation coverage split from the former transport-other bucket. |
| `move_freight_by_marine` | `transport_marine_freight__residual_incumbent` | 1 | `temporary_residual` | `move_freight_by_marine` | residual method | Minimum marine freight coverage split from the former transport-other bucket. |
| `account_other_non_road_transport_activity` | `transport_other_non_road__residual_incumbent` | 1 | `temporary_residual` | `account_other_non_road_transport_activity` | residual method | Remaining non-road transport coverage split from the former transport-other bucket. |
| `account_residual_transport` | `transport_other__residual_incumbent` | 1 | `temporary_residual` | `account_remaining_transport_activity` | residual method | Compatibility residual only; calibrated quantities now live on explicit non-road transport roles. |
| `account_residual_manufacturing` | `manufacturing_other__residual_incumbent` | 1 | `temporary_residual` | `account_remaining_manufacturing_activity` | residual method | Keep until chemicals, other materials, and manufacturing subroles are represented. |
| `account_residual_ippu` | `residual_ippu_other__residual_incumbent` | 1 | `temporary_residual` | `account_remaining_industrial_process_emissions` | residual method | Keep until non-cement/non-steel process emissions are assigned to physical production roles. |
| `account_residual_construction` | `construction_other__residual_incumbent` | 1 | `temporary_residual` | `construct_built_assets` | residual method | Keep as construction coverage until a real construction pathway exists. |
| `account_residual_mining_energy` | `mining_other__residual_incumbent` | 1 | `temporary_residual` | `account_remaining_domestic_energy_supply_activity` | residual method | Split later between domestic fuel supply and export-gate resource roles. |
| `account_residual_fugitives` | `residual_fugitives__residual_incumbent` | 1 | `temporary_residual` | `account_remaining_fugitive_emissions` | residual method | Keep until fugitive emissions can be assigned to domestic and export resource supply chains. |
| `account_residual_agriculture` | `residual_agriculture_other__residual_incumbent` | 1 | `temporary_residual` | `account_remaining_agricultural_activity` | residual method | Keep until biological emissions, soils, residues, and land-stock roles are represented. |
| `account_residual_water_waste` | `water_waste_other__residual_incumbent` | 1 | `temporary_residual` | `provide_water_services` | residual method | Keep as water-services residual until water and wastewater methods are authored. |
| `account_residual_waste_emissions` | `residual_waste__residual_incumbent` | 1 | `temporary_residual` | `manage_waste_emissions` | residual method | Keep until explicit waste-management methods exist. |
| `account_residual_lulucf_sink` | `residual_lulucf_sink__residual_incumbent` | 1 | `temporary_residual` | `account_remaining_land_sink_adjustment` | residual method | Keep as land-sink reconciliation until land-stock accounting is richer. |
| `account_residual_other_sectors` | `other_other__residual_incumbent` | 1 | `temporary_residual` | `account_remaining_other_sectors` | residual method | Keep as final domestic residual coverage while gaps are being eliminated. |

## Coverage Gaps For Follow-Up Issues

The inventory leaves these gaps explicit for the migration sequence:

- `supply_domestic_gas`, `supply_domestic_liquid_fuels`, and `supply_domestic_solid_fuels` have no direct non-residual pathway methods yet.
- Export-gate roles for thermal coal, metallurgical coal, LNG, iron ore, bauxite/alumina, critical minerals, and remaining export resource supply have no methods yet.
- Non-road passenger and freight transport now have explicit residual roles for rail, aviation, marine freight, and other non-road activity; pathway methods remain a later gap.
- Chemicals, other materials, and most manufacturing activity are only covered by residual methods.
- Biological emissions, soils, residues, and land-stock adjustments are only partly covered by agriculture and LULUCF residual methods.
- Water, wastewater, and waste management have residual methods but no explicit pathway alternatives.
- Cement has aggregate methods, but clinker, grinding, blending, host-owned heat, captured-CO2 transport, and storage are not separately represented.
- Generic process-heat methods need host-owned homes before the standalone heat roles can be removed.

## Migration Order

The current ready issue set should be interpreted in this order despite all children being unblocked:

1. Move electricity supply and grid losses first because many roles depend on grid electricity as a physical edge.
2. Move building and road-service pathway bundles next because they are already complete top-level service roles.
3. Move steel and cement production pathways, preserving the crude-steel decomposition pilot.
4. Move agriculture, removals, water, waste, and remaining residual coverage.
5. Add missing domestic fuel-supply, export-gate, non-road transport, chemicals/materials, biological-emissions, and carbon-storage coverage.
6. Validate whole-system coverage and emissions importance bands after the explicit gaps are either filled or intentionally retained as residual methods.

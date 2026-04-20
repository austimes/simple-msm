# Canonical Efficiency Inventory For First-Wave Sectors

This note consolidates the accepted, embodied, and deferred efficiency findings from:

- [20260420-buildings-efficiency-research.md](./20260420-buildings-efficiency-research.md)
- [20260420-road-transport-efficiency-research.md](./20260420-road-transport-efficiency-research.md)
- [20260420-industrial-heat-efficiency-research.md](./20260420-industrial-heat-efficiency-research.md)
- [20260420-steel-cement-efficiency-research.md](./20260420-steel-cement-efficiency-research.md)
- [20260420-agriculture-electricity-efficiency-research.md](./20260420-agriculture-electricity-efficiency-research.md)

Use this document as the canonical accepted inventory for v1 efficiency authoring. If a source research note and this document differ, this document wins.

## 1. Canonical Conventions

### Status Buckets

| status | meaning |
| --- | --- |
| `autonomous_efficiency_track` | Exogenous background improvement. Author only after the same drift is removed from the underlying year-indexed state rows. |
| `pure_efficiency_overlay` | Endogenous carrier-preserving retrofit, upgrade, recovery, or other equipment-side package. |
| `operational_efficiency_overlay` | Endogenous tuning, controls, scheduling, telematics, monitoring, or other management-side package. |
| `embodied_in_pathway_state` | Efficiency effect that stays inside a pathway state because it is inseparable from route, carrier, or process change. |
| `no_material_v1` | Intentional v1 blank. Author no new track or package rows for this family. |
| `deferred_or_not_modeled_v1` | Explicitly out of scope for the prototype because it needs a family split, an interaction engine, or should live in another module. |

### Naming And Applicability Rules

- Keep the researched `track_id` and `package_id` values verbatim where they are already precise and family-local.
- Reserve `background_*_drift` for autonomous tracks only.
- Reserve `*_retrofit`, `*_upgrade`, `*_recovery`, and `*_preheating` for pure efficiency overlays.
- Reserve `*_tuning`, `*_control`, `*_optimisation`, and `*_telematics_eco_driving` for operational overlays.
- Apply a track or package only to the explicitly listed `state_id`s. There is no implied family-wide applicability beyond what is listed here.
- Default v1 interaction rule: do not stack multiple endogenous packages on the same slice of activity. Where a family has multiple accepted packages on the same incumbent states, put them in one family-local non-stacking group.
- Do not apply accepted v1 packages to `deep_electric`, `deep_clean_firmed`, `__electrified`, `__low_carbon_fuels`, `bev`, `fcev_h2`, or other route-change states unless a row below explicitly lists that state.
- Normalise confidence language to the existing repo scale: `High`, `Medium-High`, `Medium`, `Medium-Low`, `Low`.
- When a family is tagged `no_material_v1`, treat that as a final scope decision for v1 rather than missing research.

## 2. Accepted V1 Inventory

These are the only new efficiency tracks and packages that should be carried into v1 implementation work.

### Buildings

| authoring_id | status | canonical concept | family_id | applicable_state_ids | confidence | v1 note |
| --- | --- | --- | --- | --- | --- | --- |
| `buildings__residential__background_standards_drift` | `autonomous_efficiency_track` | `background_efficiency_drift` | `residential_building_services` | `buildings__residential__incumbent_mixed_fuels`, `buildings__residential__electrified_efficiency` | `Medium-Low` | Do not layer on `buildings__residential__deep_electric`. |
| `buildings__residential__thermal_shell_retrofit` | `pure_efficiency_overlay` | `thermal_envelope_retrofit` | `residential_building_services` | `buildings__residential__incumbent_mixed_fuels`, `buildings__residential__electrified_efficiency` | `Medium` | Shares no package stack with any other residential v1 package because this is the only accepted one. |
| `buildings__commercial__background_standards_drift` | `autonomous_efficiency_track` | `background_efficiency_drift` | `commercial_building_services` | `buildings__commercial__incumbent_mixed_fuels`, `buildings__commercial__electrified_efficiency` | `Medium-Low` | Do not layer on `buildings__commercial__deep_electric`. |
| `buildings__commercial__lighting_retrofit` | `pure_efficiency_overlay` | `lighting_system_upgrade` | `commercial_building_services` | `buildings__commercial__incumbent_mixed_fuels`, `buildings__commercial__electrified_efficiency` | `Medium-High` | Put in the same non-stacking group as `buildings__commercial__hvac_tuning_bms`. |
| `buildings__commercial__hvac_tuning_bms` | `operational_efficiency_overlay` | `operational_controls_optimisation` | `commercial_building_services` | `buildings__commercial__incumbent_mixed_fuels`, `buildings__commercial__electrified_efficiency` | `Medium-High` | Put in the same non-stacking group as `buildings__commercial__lighting_retrofit`. |

### Road Transport

| authoring_id | status | canonical concept | family_id | applicable_state_ids | confidence | v1 note |
| --- | --- | --- | --- | --- | --- | --- |
| `road_transport__passenger_road__background_new_vehicle_efficiency_drift` | `autonomous_efficiency_track` | `background_efficiency_drift` | `passenger_road_transport` | `road_transport__passenger_road__ice_fleet` | `Medium-Low` | Do not apply to `hybrid_transition` or `bev`. |
| `road_transport__freight_road__background_diesel_efficiency_drift` | `autonomous_efficiency_track` | `background_efficiency_drift` | `freight_road_transport` | `road_transport__freight_road__diesel` | `Medium-Low` | Do not apply to `efficient_diesel`, `bev`, or `fcev_h2`. |
| `road_transport__freight_road__fleet_telematics_eco_driving` | `operational_efficiency_overlay` | `operational_telematics_eco_driving` | `freight_road_transport` | `road_transport__freight_road__diesel` | `Medium` | Keep materially smaller than the existing diesel-to-efficient-diesel state gap. |

### Industrial Heat

| authoring_id | status | canonical concept | family_id | applicable_state_ids | confidence | v1 note |
| --- | --- | --- | --- | --- | --- | --- |
| `industrial_heat__low_temperature__background_thermal_drift` | `autonomous_efficiency_track` | `background_efficiency_drift` | `low_temperature_heat` | `generic_industrial_heat__low_temperature_heat__fossil` | `Medium-Low` | Fossil incumbent only. |
| `industrial_heat__medium_temperature__background_thermal_drift` | `autonomous_efficiency_track` | `background_efficiency_drift` | `medium_temperature_heat` | `generic_industrial_heat__medium_temperature_heat__fossil` | `Medium-Low` | Fossil incumbent only. |
| `industrial_heat__high_temperature__background_thermal_drift` | `autonomous_efficiency_track` | `background_efficiency_drift` | `high_temperature_heat` | `generic_industrial_heat__high_temperature_heat__fossil` | `Low` | Keep materially smaller than low- and medium-temperature drift. |
| `industrial_heat__low_temperature__thermal_system_retrofit` | `pure_efficiency_overlay` | `thermal_system_retrofit` | `low_temperature_heat` | `generic_industrial_heat__low_temperature_heat__fossil` | `Medium` | Put in the same family-local non-stacking group as `industrial_heat__low_temperature__controls_tuning`. |
| `industrial_heat__medium_temperature__thermal_system_retrofit` | `pure_efficiency_overlay` | `thermal_system_retrofit` | `medium_temperature_heat` | `generic_industrial_heat__medium_temperature_heat__fossil` | `Medium-Low` | Put in the same family-local non-stacking group as `industrial_heat__medium_temperature__controls_tuning`. |
| `industrial_heat__high_temperature__combustion_heat_recovery` | `pure_efficiency_overlay` | `combustion_heat_recovery` | `high_temperature_heat` | `generic_industrial_heat__high_temperature_heat__fossil` | `Low` | Put in the same family-local non-stacking group as `industrial_heat__high_temperature__controls_tuning`. |
| `industrial_heat__low_temperature__controls_tuning` | `operational_efficiency_overlay` | `operational_controls_optimisation` | `low_temperature_heat` | `generic_industrial_heat__low_temperature_heat__fossil` | `Medium` | Fossil incumbent only. |
| `industrial_heat__medium_temperature__controls_tuning` | `operational_efficiency_overlay` | `operational_controls_optimisation` | `medium_temperature_heat` | `generic_industrial_heat__medium_temperature_heat__fossil` | `Medium-Low` | Fossil incumbent only. |
| `industrial_heat__high_temperature__controls_tuning` | `operational_efficiency_overlay` | `operational_controls_optimisation` | `high_temperature_heat` | `generic_industrial_heat__high_temperature_heat__fossil` | `Low` | Fossil incumbent only and deliberately small. |

### Steel And Cement

| authoring_id | status | canonical concept | family_id | applicable_state_ids | confidence | v1 note |
| --- | --- | --- | --- | --- | --- | --- |
| `steel__crude_steel__bf_bof_background_drift` | `autonomous_efficiency_track` | `background_efficiency_drift` | `crude_steel` | `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__bf_bof_ccs_transition` | `Medium-Low` | Do not apply to `scrap_eaf` or `h2_dri_electric`. |
| `steel__crude_steel__bf_bof_bof_gas_recovery` | `pure_efficiency_overlay` | `route_specific_energy_recovery` | `crude_steel` | `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__bf_bof_ccs_transition` | `Medium` | Put in the same crude-steel non-stacking group as the other accepted steel packages. |
| `steel__crude_steel__scrap_eaf_scrap_preheating` | `pure_efficiency_overlay` | `scrap_preheating` | `crude_steel` | `steel__crude_steel__scrap_eaf` | `Medium-Low` | Keep separate state scope but in the same crude-steel non-stacking group. |
| `steel__crude_steel__advanced_process_control` | `operational_efficiency_overlay` | `operational_controls_optimisation` | `crude_steel` | `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__bf_bof_ccs_transition`, `steel__crude_steel__scrap_eaf` | `Medium-Low` | Do not apply to `steel__crude_steel__h2_dri_electric`. |
| `cement__cement_equivalent__background_kiln_grinding_drift` | `autonomous_efficiency_track` | `background_efficiency_drift` | `cement_equivalent` | `cement_clinker__cement_equivalent__conventional`, `cement_clinker__cement_equivalent__low_clinker_alt_fuels` | `Medium-Low` | Do not apply to `cement_clinker__cement_equivalent__ccs_deep`. |
| `cement__cement_equivalent__grinding_system_upgrade` | `pure_efficiency_overlay` | `grinding_system_upgrade` | `cement_equivalent` | `cement_clinker__cement_equivalent__conventional`, `cement_clinker__cement_equivalent__low_clinker_alt_fuels` | `Medium` | Put in the same cement non-stacking group as `cement__cement_equivalent__kiln_ai_process_optimisation`. |
| `cement__cement_equivalent__kiln_ai_process_optimisation` | `operational_efficiency_overlay` | `operational_controls_optimisation` | `cement_equivalent` | `cement_clinker__cement_equivalent__conventional`, `cement_clinker__cement_equivalent__low_clinker_alt_fuels` | `Medium` | Keep materially below the full pathway-state change. |

### Electricity

| authoring_id | status | canonical concept | family_id | applicable_state_ids | confidence | v1 note |
| --- | --- | --- | --- | --- | --- | --- |
| `electricity__grid_supply__thermal_auxiliary_load_tuning` | `operational_efficiency_overlay` | `operational_controls_optimisation` | `electricity` | `electricity__grid_supply__incumbent_thermal_mix` | `Medium-Low` | This is the only accepted electricity package. Do not apply to `policy_frontier` or `deep_clean_firmed`. |

### Explicit `no_material_v1` Families

| family_id | status | v1 implication |
| --- | --- | --- |
| `cropping_horticulture_output_bundle` | `no_material_v1` | Author no `autonomous_efficiency_tracks.csv` or `efficiency_packages.csv` rows until the family is split into narrower agricultural subfamilies. |
| `livestock_output_bundle` | `no_material_v1` | Author no `autonomous_efficiency_tracks.csv` or `efficiency_packages.csv` rows until the family is split into narrower livestock subfamilies. |

## 3. Embodied In Pathway States

These items remain modeled in v1, but only through the existing pathway states rather than through new overlays.

| concept_id | family_id | state_ids | why it stays embodied |
| --- | --- | --- | --- |
| `buildings__residential__electrified_service_bundle` | `residential_building_services` | `buildings__residential__electrified_efficiency`, `buildings__residential__deep_electric` | Carrier-switching heat-pump and appliance changes are inseparable from the transition-state narratives. |
| `buildings__commercial__electrified_service_bundle` | `commercial_building_services` | `buildings__commercial__electrified_efficiency`, `buildings__commercial__deep_electric` | Major HVAC and hot-water electrification is a route change, not an add-on efficiency overlay. |
| `road_transport__passenger_road__hybridisation_bundle` | `passenger_road_transport` | `road_transport__passenger_road__hybrid_transition` | Hybrid drivetrain efficiency is inseparable from drivetrain choice. |
| `road_transport__passenger_road__bev_drivetrain_shift` | `passenger_road_transport` | `road_transport__passenger_road__bev` | The efficiency gain comes with a carrier and drivetrain shift. |
| `road_transport__freight_road__efficient_diesel_bundle` | `freight_road_transport` | `road_transport__freight_road__efficient_diesel` | The existing state already bundles better vehicle efficiency, logistics, and utilisation. |
| `road_transport__freight_road__bev_drivetrain_shift` | `freight_road_transport` | `road_transport__freight_road__bev` | Freight BEV efficiency is inseparable from electrification and duty-cycle suitability. |
| `road_transport__freight_road__fcev_h2_drivetrain_shift` | `freight_road_transport` | `road_transport__freight_road__fcev_h2` | Fuel-cell efficiency is inseparable from hydrogen-route choice. |
| `industrial_heat__low_temperature__electrification_route` | `low_temperature_heat` | `generic_industrial_heat__low_temperature_heat__electrified` | Heat pumps and electric boilers are route changes. |
| `industrial_heat__medium_temperature__electrification_route` | `medium_temperature_heat` | `generic_industrial_heat__medium_temperature_heat__electrified` | Electric-route gains stay in the existing state definition. |
| `industrial_heat__high_temperature__electrification_route` | `high_temperature_heat` | `generic_industrial_heat__high_temperature_heat__electrified` | High-temperature electrification is especially route-specific. |
| `industrial_heat__all_temperatures__low_carbon_fuel_route` | `low_temperature_heat`, `medium_temperature_heat`, `high_temperature_heat` | All corresponding `__low_carbon_fuels` states | Hydrogen and biomass route changes alter carrier and infrastructure requirements. |
| `steel__crude_steel__route_shift_and_ccs_bundle` | `crude_steel` | `steel__crude_steel__scrap_eaf`, `steel__crude_steel__h2_dri_electric`, `steel__crude_steel__bf_bof_ccs_transition` | Major steel intensity changes come from route change and CCS, not portable efficiency. |
| `cement__cement_equivalent__composition_fuel_switch_and_ccs_bundle` | `cement_equivalent` | `cement_clinker__cement_equivalent__low_clinker_alt_fuels`, `cement_clinker__cement_equivalent__ccs_deep` | Clinker-factor reduction, fuel switching, and CCS are not portable efficiency overlays. |
| `agriculture__cropping_horticulture__mitigated_bundle` | `cropping_horticulture_output_bundle` | `agriculture__cropping_horticulture__mitigated` | The limited direct-energy improvement remains bundled with agronomic and process-emissions changes. |
| `agriculture__livestock__mitigated_bundle` | `livestock_output_bundle` | `agriculture__livestock__mitigated` | The energy effect remains bundled with methane, manure, and productivity changes. |
| `electricity__grid_supply__pathway_shift_bundle` | `electricity` | `electricity__grid_supply__policy_frontier`, `electricity__grid_supply__deep_clean_firmed` | Large fuel and emissions improvements come from supply-pathway change, not a portable efficiency package. |

## 4. Explicit Deferred Or Not-Modeled-In-V1 List

### Buildings

| candidate_id | reason_code | why it stays out of v1 |
| --- | --- | --- |
| `buildings__residential__controls_only_behaviour_package` | `insufficient_evidence` | Too behaviour-dependent and rebound-prone at current family scope. |
| `buildings__pv_battery_and_demand_response` | `structural_demand_change` | CER and demand-flexibility logic, not service-efficiency package logic. |
| `buildings__refrigerant_leakage_abatement` | `non_efficiency_abatement` | Non-CO2 abatement, not direct input-per-service efficiency. |
| `buildings__commercial__deep_facade_or_plantroom_retrofit_archetype` | `requires_interaction_engine` | Needs finer commercial typology and stronger interaction handling. |
| `buildings__commercial__kitchen_electrification` | `embodied_route_change` | Subtype-specific fuel switching, not a family-wide efficiency package. |
| `buildings__ratings_finance_and_disclosure` | `not_material_for_v1` | Enabling mechanisms should stay in notes and rollout logic rather than package rows. |

### Road Transport

| candidate_id | reason_code | why it stays out of v1 |
| --- | --- | --- |
| `road_transport__passenger_road__eco_driving_and_maintenance_bundle` | `not_material_for_v1` | Aggregate passenger family is too coarse to support a clean national operational package. |
| `road_transport__passenger_road__higher_vehicle_occupancy_or_rideshare` | `structural_demand_change` | Occupancy and rideshare change service structure rather than vehicle efficiency. |
| `road_transport__freight_road__aerodynamic_and_hardware_retrofit_bundle` | `requires_interaction_engine` | Overlaps the existing `efficient_diesel` state and depends strongly on duty cycle. |
| `road_transport__freight_road__pbs_and_longer_combination_vehicle_productivity` | `requires_interaction_engine` | Network access and productivity reform are too entangled for the current family shape. |
| `road_transport__freight_road__backhaul_and_load_consolidation_platforms` | `requires_interaction_engine` | Overlaps heavily with logistics and utilisation already embodied in `efficient_diesel`. |
| `road_transport__freight_mode_shift` | `structural_demand_change` | Road-to-rail or coastal shift belongs in mode-choice logic, not road-efficiency packages. |

### Industrial Heat

| candidate_id | reason_code | why it stays out of v1 |
| --- | --- | --- |
| `industrial_heat__cross_family_heat_cascading` | `requires_interaction_engine` | Needs site-level coupling across multiple temperature-band families. |
| `industrial_heat__thermal_storage_and_load_shifting` | `requires_interaction_engine` | Not a static row multiplier on current useful-heat states. |
| `industrial_heat__chp_or_cogeneration` | `non_efficiency_abatement` | Changes co-product and onsite-supply structure rather than pure heat efficiency. |
| `industrial_heat__motors_vsds_and_compressed_air` | `not_material_for_v1` | Current industrial-heat families only represent useful heat, not all auxiliary plant loads. |
| `industrial_heat__process_redesign_or_product_substitution` | `structural_demand_change` | Reduces heat demand through process redesign, not portable heat-supply efficiency. |
| `industrial_heat__full_electrification_as_package` | `embodied_route_change` | Electrification belongs in the existing transition states. |
| `industrial_heat__hydrogen_or_biomass_burner_conversion` | `embodied_route_change` | Low-carbon-fuel conversion belongs in the `__low_carbon_fuels` states. |

### Steel And Cement

| candidate_id | reason_code | why it stays out of v1 |
| --- | --- | --- |
| `steel__crude_steel__waste_heat_recovery_broad_bundle` | `requires_interaction_engine` | Mixes several submeasures with different baselines and offset destinations. |
| `steel__crude_steel__top_pressure_recovery_turbine` | `not_material_for_v1` | Current Australian baseline practice already includes TRT. |
| `steel__crude_steel__coke_dry_quenching` | `not_material_for_v1` | Opportunity is too site-specific and capex-heavy for national v1 treatment. |
| `steel__crude_steel__pulverised_coal_injection_optimisation` | `requires_interaction_engine` | Needs explicit BF / coke / hot-metal representation. |
| `steel__crude_steel__efficient_motors_and_vsds` | `not_material_for_v1` | Residual upside is small at crude-steel family scale. |
| `steel__crude_steel__hot_charging_and_direct_rolling` | `not_material_for_v1` | Mostly outside the current crude-steel family boundary. |
| `cement__cement_equivalent__kiln_heat_recovery_power_generation` | `not_material_for_v1` | Remaining Australian waste heat is too low-grade for a generic national package. |
| `cement__cement_equivalent__motor_vsd_package` | `not_material_for_v1` | Modern motors and drives are already mature baseline practice. |
| `cement__cement_equivalent__kiln_insulation_and_sealing` | `not_material_for_v1` | Residual gain is too small and plant-specific for family-level v1 treatment. |
| `cement__cement_equivalent__ccs` | `non_efficiency_abatement` | CCS is important but is not efficiency. |

### Agriculture And Electricity

| candidate_id | reason_code | why it stays out of v1 |
| --- | --- | --- |
| `agriculture__cropping_horticulture__portable_energy_efficiency` | `no_material_v1` | Current family mixes irrigated and non-irrigated contexts too coarsely for a portable package. |
| `agriculture__cropping_horticulture__irrigation_pumping_and_vsd_package` | `requires_interaction_engine` | Needs explicit irrigated subfamilies or irrigation-service modules. |
| `agriculture__cropping_horticulture__cold_store_or_pack_shed_efficiency` | `not_material_for_v1` | Too business-specific for the current coarse output bundle. |
| `agriculture__cropping_horticulture__fertiliser_efficiency_as_energy_package` | `non_efficiency_abatement` | Main value is lower nitrous-oxide process emissions, not direct-energy efficiency. |
| `agriculture__livestock__portable_energy_efficiency` | `no_material_v1` | Current family mixes dairy-like loads with other livestock systems too coarsely. |
| `agriculture__livestock__dairy_shed_refrigeration_and_hot_water_package` | `requires_interaction_engine` | Needs a dairy-specific family boundary. |
| `agriculture__livestock__pumping_irrigation_and_shed_controls_package` | `requires_interaction_engine` | Requires subsector splits such as dairy, feedlot, or shed-based systems. |
| `agriculture__livestock__feed_and_productivity_efficiency_as_energy_package` | `non_efficiency_abatement` | Belongs in productivity and non-CO2 treatment, not direct-energy efficiency. |
| `electricity__grid_supply__network_loss_reduction_package` | `requires_interaction_engine` | Needs regional network structure or explicit sent-out versus delivered accounting. |
| `electricity__grid_supply__transmission_buildout_as_efficiency` | `embodied_route_change` | Transmission buildout is part of the broader supply-pathway state change. |
| `electricity__grid_supply__generator_mix_shift_as_efficiency` | `embodied_route_change` | Generator mix change remains embodied in the pathway states. |

## 5. Implementation Boundary Summary

- Accepted v1 authoring work should create rows only for the `autonomous_efficiency_track`, `pure_efficiency_overlay`, and `operational_efficiency_overlay` items listed in Section 2.
- `embodied_in_pathway_state` items are in scope for the prototype, but only through the existing family-state rows.
- `no_material_v1` and `deferred_or_not_modeled_v1` items should not receive placeholder rows or speculative stubs.
- Autonomous tracks are blocked on one common cleanup step: de-embed the matching year-to-year drift already present in the base state rows before adding explicit track rows.
- Endogenous packages should default to one family-local non-stacking interaction group unless a later issue explicitly introduces richer interaction logic.

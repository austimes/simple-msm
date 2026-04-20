# Industrial Heat Efficiency Research For 2qa.3

This note applies the shared brief in [20260420-efficiency-oracle-research-brief-template.md](./20260420-efficiency-oracle-research-brief-template.md) to the current `low_temperature_heat`, `medium_temperature_heat`, and `high_temperature_heat` families.

It is grounded in the current repo structure, especially:

- `sector_trajectory_library/families/low_temperature_heat/*`
- `sector_trajectory_library/families/medium_temperature_heat/*`
- `sector_trajectory_library/families/high_temperature_heat/*`
- `docs/prd/20260420-sector_state_library_efficiency_expansion_proposal.md`
- `sector_trajectory_library/README.md`

This research also draws on the most relevant external evidence for generic industrial heat efficiency in the current prototype boundary:

- DCCEEW `energy.gov.au` guidance on process heat and steam, especially controls, insulation, boilers, and waste-heat recovery.
- CEFC / Energy Efficiency Council `Australian Manufacturing Gas Efficiency Guide`, especially condensate return, combustion tuning, economisers, waste-heat recovery, and cascading heat use.
- CSIRO / ITP `The Australian Industrial Process Heat Market`, especially the temperature-band evidence that low-temperature applications have the broadest technology and optimisation options while high-temperature changes are more route-specific.
- ARENA `Renewable Energy Options for Industrial Process Heat`, especially the distinction between incremental efficiency, process redesign, and renewable-route substitution.

The current 2025 family-state rows already embed large route-level differences, so the recommended portable packages are intentionally smaller than the state-to-state jumps:

- Low temperature 2025 total input coefficients: fossil `1.10`, electrified `0.32`, low-carbon fuels `1.20` GJ/GJ_useful_heat.
- Medium temperature 2025 total input coefficients: fossil `1.00`, electrified `0.62`, low-carbon fuels `1.20` GJ/GJ_useful_heat.
- High temperature 2025 total input coefficients: fossil `1.00`, electrified `1.10`, low-carbon fuels `1.30` GJ/GJ_useful_heat.

That last high-temperature comparison is important: in the current stylised family, the electrified route is not authored as a pure efficiency gain at all. This is a strong reason to keep high-temperature route changes embodied in pathway states rather than trying to re-express them as generic efficiency overlays.

## 1. Recommendation Summary

### Cross-family conclusion

- Accepted autonomous tracks: modest background thermal-system drift for the fossil incumbent state in each temperature family.
- Accepted pure packages: one shared thermal-loss-reduction concept for low and medium temperature heat, plus a separate high-temperature combustion heat-recovery package.
- Accepted operational packages: one shared controls / tuning / energy-management concept across all three families, with tighter effect sizes at higher temperatures.
- Embodied in pathway states: electrification, industrial heat pumps, electric boilers, resistive or plasma heating, hydrogen burners, biomass route changes, and broader process redesign remain embodied in `__electrified` or `__low_carbon_fuels` states.
- Rejected or deferred: cross-family heat cascading, CHP / cogeneration, thermal storage plus load-shifting bundles, generic motor / VSD packages, and structural product or demand changes.

### Family-by-family view

- `low_temperature_heat`: this is the strongest package candidate family because insulation, condensate return, economisers, blowdown recovery, and controls all map cleanly onto hot-water and low-pressure steam style systems without changing the carrier.
- `medium_temperature_heat`: still package-eligible, but with smaller effects and tighter rollout limits because a larger share of service is tied to process-specific heaters and drying systems that are harder to generalise.
- `high_temperature_heat`: keep portable efficiency very narrow. Only a small combustion-side heat-recovery package and an even smaller controls package are cleanly defensible at this family boundary.

## 2. Applicability Mapping

| candidate_id | classification | family_id | applicable_state_ids | excluded_state_ids | why excluded |
| --- | --- | --- | --- | --- | --- |
| `industrial_heat__low_temperature__background_thermal_drift` | autonomous efficiency track | `low_temperature_heat` | `generic_industrial_heat__low_temperature_heat__fossil` | `generic_industrial_heat__low_temperature_heat__electrified`, `generic_industrial_heat__low_temperature_heat__low_carbon_fuels` | Electrified and low-carbon-fuel states are already authored as alternative heat-supply routes, not incumbent thermal systems. |
| `industrial_heat__medium_temperature__background_thermal_drift` | autonomous efficiency track | `medium_temperature_heat` | `generic_industrial_heat__medium_temperature_heat__fossil` | `generic_industrial_heat__medium_temperature_heat__electrified`, `generic_industrial_heat__medium_temperature_heat__low_carbon_fuels` | Same route-choice boundary as low temperature. |
| `industrial_heat__high_temperature__background_thermal_drift` | autonomous efficiency track | `high_temperature_heat` | `generic_industrial_heat__high_temperature_heat__fossil` | `generic_industrial_heat__high_temperature_heat__electrified`, `generic_industrial_heat__high_temperature_heat__low_carbon_fuels` | High-temperature alternative states are especially route-specific and should stay clean. |
| `industrial_heat__low_temperature__thermal_system_retrofit` | endogenous pure efficiency package | `low_temperature_heat` | `generic_industrial_heat__low_temperature_heat__fossil` | `generic_industrial_heat__low_temperature_heat__electrified`, `generic_industrial_heat__low_temperature_heat__low_carbon_fuels` | The portable package is specifically a fossil steam / hot-water system efficiency wedge, not an electrification sweetener. |
| `industrial_heat__medium_temperature__thermal_system_retrofit` | endogenous pure efficiency package | `medium_temperature_heat` | `generic_industrial_heat__medium_temperature_heat__fossil` | `generic_industrial_heat__medium_temperature_heat__electrified`, `generic_industrial_heat__medium_temperature_heat__low_carbon_fuels` | Same logic, with smaller effect size because the family is less uniformly steam-like. |
| `industrial_heat__high_temperature__combustion_heat_recovery` | endogenous pure efficiency package | `high_temperature_heat` | `generic_industrial_heat__high_temperature_heat__fossil` | `generic_industrial_heat__high_temperature_heat__electrified`, `generic_industrial_heat__high_temperature_heat__low_carbon_fuels` | The accepted package is limited to modest combustion-side recovery and refractory-loss reduction on incumbent fuel-fired systems. |
| `industrial_heat__low_temperature__controls_tuning` | endogenous operational efficiency package | `low_temperature_heat` | `generic_industrial_heat__low_temperature_heat__fossil` | `generic_industrial_heat__low_temperature_heat__electrified`, `generic_industrial_heat__low_temperature_heat__low_carbon_fuels` | Controls should attach to the incumbent fossil thermal system only in v1. |
| `industrial_heat__medium_temperature__controls_tuning` | endogenous operational efficiency package | `medium_temperature_heat` | `generic_industrial_heat__medium_temperature_heat__fossil` | `generic_industrial_heat__medium_temperature_heat__electrified`, `generic_industrial_heat__medium_temperature_heat__low_carbon_fuels` | Same as above. |
| `industrial_heat__high_temperature__controls_tuning` | endogenous operational efficiency package | `high_temperature_heat` | `generic_industrial_heat__high_temperature_heat__fossil` | `generic_industrial_heat__high_temperature_heat__electrified`, `generic_industrial_heat__high_temperature_heat__low_carbon_fuels` | Same as above, with the tightest package effect size. |

### Shared versus family-local concepts

| concept | low_temperature_heat | medium_temperature_heat | high_temperature_heat | v1 treatment |
| --- | --- | --- | --- | --- |
| background burner / boiler / steam-system drift | yes | yes | yes | shared concept with family-specific multipliers |
| insulation, condensate return, economisers, blowdown recovery, low-grade waste-heat reuse | yes | yes | no | shared low/medium pure-package concept |
| combustion-air preheat, recuperation, refractory-loss reduction | no | no | yes | high-temperature-only pure package |
| controls, tuning, setpoint optimisation, sequencing, sensor quality, maintenance discipline | yes | yes | yes | shared concept with family-specific multipliers and caps |
| heat pumps, electric boilers, resistive heating, plasma, MVR, hydrogen / biomass route switching | embodied | embodied | embodied | remain in pathway states |
| cascading heat across multiple process stages or temperature bands | maybe materially true in reality | maybe materially true in reality | maybe materially true in reality | reject for v1 because it crosses family boundaries and needs an interaction engine |

## 3. Candidate Register

### `industrial_heat__low_temperature__background_thermal_drift`

- `classification`: autonomous efficiency track
- `family_ids`: `low_temperature_heat`
- `state_ids`: `generic_industrial_heat__low_temperature_heat__fossil`
- `affected_inputs`: `natural_gas`
- `affected_cost_fields`: none in v1
- `affected_process_emissions`: none
- `suggested_years`: 2030, 2035, 2040, 2045, 2050
- `effect_size`: indicative multiplier path of `1.000`, `0.995`, `0.990`, `0.985`, `0.980`, `0.975` from 2025 to 2050
- `cost_basis`: no explicit package cost because this is an exogenous background assumption
- `rollout_limit_logic`: exogenous and family-wide once enabled
- `sources`:
  - DCCEEW process heat and steam guide: process heating efficiency can be improved through metering, controls, insulation, maintenance, boilers, and waste-heat recovery
  - CEFC gas efficiency guide: recurring combustion tuning, sensor quality, heat-transfer maintenance, and better control logic are established housekeeping measures with short paybacks
- `confidence`: Medium-Low
- `rationale`: Low-temperature fossil heat is still mostly boiler / steam / hot-water service in the current family abstraction, so a small exogenous drift is defensible. It should remain modest because the current year-indexed rows already drift downward over time.

### `industrial_heat__medium_temperature__background_thermal_drift`

- `classification`: autonomous efficiency track
- `family_ids`: `medium_temperature_heat`
- `state_ids`: `generic_industrial_heat__medium_temperature_heat__fossil`
- `affected_inputs`: all direct thermal fuel inputs, scaled proportionally to preserve the authored mix
- `affected_cost_fields`: none in v1
- `affected_process_emissions`: none
- `suggested_years`: 2030, 2035, 2040, 2045, 2050
- `effect_size`: indicative multiplier path of `1.000`, `0.995`, `0.990`, `0.985`, `0.980`, `0.975`
- `cost_basis`: no explicit package cost because this is background drift
- `rollout_limit_logic`: exogenous and family-wide once enabled
- `sources`:
  - DCCEEW process heat guide: setpoints, sequencing, insulation, maintenance, and waste-heat recovery remain relevant above low-temperature hot-water service
  - CSIRO / ITP industrial process heat market: medium-temperature opportunities are material, but more heterogeneous and less uniformly easy than low-temperature uses
- `confidence`: Medium-Low
- `rationale`: The same background concept is valid as for low temperature, but medium-temperature service is less uniform and more process-dependent, so the track should stay small.

### `industrial_heat__high_temperature__background_thermal_drift`

- `classification`: autonomous efficiency track
- `family_ids`: `high_temperature_heat`
- `state_ids`: `generic_industrial_heat__high_temperature_heat__fossil`
- `affected_inputs`: all direct thermal fuel inputs, scaled proportionally
- `affected_cost_fields`: none in v1
- `affected_process_emissions`: none
- `suggested_years`: 2030, 2035, 2040, 2045, 2050
- `effect_size`: indicative multiplier path of `1.000`, `0.997`, `0.994`, `0.991`, `0.988`, `0.985`
- `cost_basis`: no explicit package cost because this is background drift
- `rollout_limit_logic`: exogenous and family-wide once enabled
- `sources`:
  - DCCEEW guide: older ovens, kilns, and furnaces can often still gain a few percent from retrofit, controls, and insulation
  - CSIRO / ITP and ARENA reports: high-temperature decarbonisation is dominated by route changes, so only a very small background efficiency drift is cleanly separable at this family boundary
- `confidence`: Low
- `rationale`: Keep this even smaller than low and medium temperature to avoid implying that the current high-temperature family contains a large portable efficiency wedge.

### `industrial_heat__low_temperature__thermal_system_retrofit`

- `classification`: endogenous pure efficiency package
- `family_ids`: `low_temperature_heat`
- `state_ids`: `generic_industrial_heat__low_temperature_heat__fossil`
- `affected_inputs`: `natural_gas`
- `affected_cost_fields`: positive `output_cost_per_unit` adder for annualised retrofit cost
- `affected_process_emissions`: none
- `suggested_years`: all milestone years, with stronger uptake after 2030
- `effect_size`: default whole-row input multiplier around `0.92`, with a plausible range of `0.90` to `0.94`
- `cost_basis`: indicative annualised non-commodity cost adder of `+0.35` to `+0.80 AUD_2024/GJ_useful_heat`
- `rollout_limit_logic`: share cap on applicable fossil activity, for example `0.10`, `0.20`, `0.30`, `0.40`, `0.50`, `0.60` from 2025 to 2050
- `sources`:
  - DCCEEW process heat guide: insulation for steam / hot-water / condensate piping, economisers, flash-steam recovery, and low-grade heat recovery are all named retrofit opportunities
  - CEFC gas efficiency guide: condensate return, TDS-controlled blowdown, blowdown heat recovery, economisers, and waste-heat reuse are mature measures with short paybacks in steam systems
  - CSIRO / ITP industrial heat market: low-temperature heat has the broadest near-term optimisation and technology opportunities in Australia
- `confidence`: Medium
- `rationale`: This is the cleanest pure package in the whole industrial-heat cluster. It preserves the fossil carrier while reducing thermal losses, and it maps directly to the current stylised low-temperature fossil state.

### `industrial_heat__medium_temperature__thermal_system_retrofit`

- `classification`: endogenous pure efficiency package
- `family_ids`: `medium_temperature_heat`
- `state_ids`: `generic_industrial_heat__medium_temperature_heat__fossil`
- `affected_inputs`: `natural_gas`, `coal`, and `biomass`, scaled proportionally to preserve the authored fuel mix
- `affected_cost_fields`: positive `output_cost_per_unit` adder for annualised retrofit cost
- `affected_process_emissions`: none
- `suggested_years`: all milestone years
- `effect_size`: default whole-row input multiplier around `0.95`, with a plausible range of `0.93` to `0.96`
- `cost_basis`: indicative annualised non-commodity cost adder of `+0.45` to `+1.00 AUD_2024/GJ_useful_heat`
- `rollout_limit_logic`: share cap on applicable fossil activity, for example `0.08`, `0.15`, `0.22`, `0.30`, `0.38`, `0.45` from 2025 to 2050
- `sources`:
  - DCCEEW process heat guide: retrofit insulation, better burners, waste-heat recovery, and better control remain relevant for boilers, furnaces, and dryers
  - CEFC gas efficiency guide: product pre-heating, combustion-air preheating, waste-heat recovery, and cascading heat use can reduce gas consumption in process heating
  - CSIRO / ITP industrial heat market: medium-temperature heat remains a material Australian opportunity set, but it is less universally suitable for a single generic package than low-temperature steam and hot-water service
- `confidence`: Medium-Low
- `rationale`: This is still a useful generic package, but the effect needs to be smaller and the rollout slower because medium-temperature heat spans a wider range of process-specific uses.

### `industrial_heat__high_temperature__combustion_heat_recovery`

- `classification`: endogenous pure efficiency package
- `family_ids`: `high_temperature_heat`
- `state_ids`: `generic_industrial_heat__high_temperature_heat__fossil`
- `affected_inputs`: `coal`, `natural_gas`, and `biomass`, scaled proportionally
- `affected_cost_fields`: positive `output_cost_per_unit` adder for annualised retrofit cost
- `affected_process_emissions`: none
- `suggested_years`: all milestone years
- `effect_size`: default whole-row input multiplier around `0.96`, with a plausible range of `0.94` to `0.98`
- `cost_basis`: indicative annualised non-commodity cost adder of `+0.60` to `+1.40 AUD_2024/GJ_useful_heat`
- `rollout_limit_logic`: share cap on applicable fossil activity, for example `0.05`, `0.10`, `0.15`, `0.20`, `0.25`, `0.30` from 2025 to 2050
- `sources`:
  - DCCEEW process heat guide: older furnaces and kilns can still gain a few percent from insulation retrofits and better burners
  - CEFC gas efficiency guide: combustion-air preheat and waste-heat recovery can reduce gas use in process heating, but the package is inherently more site-specific at higher temperatures
  - ARENA renewable industrial process heat report: high-temperature sectors are much more dependent on process redesign and route changes than on generic efficiency overlays
- `confidence`: Low
- `rationale`: This is the only defensible high-temperature pure package in v1, and it should stay small. Larger savings would blur into subsector-specific redesign or route switching.

### `industrial_heat__low_temperature__controls_tuning`

- `classification`: endogenous operational efficiency package
- `family_ids`: `low_temperature_heat`
- `state_ids`: `generic_industrial_heat__low_temperature_heat__fossil`
- `affected_inputs`: `natural_gas`
- `affected_cost_fields`: low `output_cost_per_unit` adder for controls, audits, and service contracts
- `affected_process_emissions`: none
- `suggested_years`: all milestone years
- `effect_size`: default whole-row input multiplier around `0.97`, with a plausible range of `0.95` to `0.98`
- `cost_basis`: indicative annualised non-commodity cost adder of `+0.05` to `+0.20 AUD_2024/GJ_useful_heat`
- `rollout_limit_logic`: share cap on applicable fossil activity, for example `0.20`, `0.35`, `0.50`, `0.60`, `0.65`, `0.70` from 2025 to 2050
- `sources`:
  - DCCEEW process heat guide: setpoints, pressure control, air-fuel ratios, sequencing, metering, and maintenance are all named quick wins
  - CEFC gas efficiency guide: combustion analysis and tuning, sensor placement, process control, digital combustion control, and operating discipline all show short paybacks and measured gas savings
- `confidence`: Medium
- `rationale`: This is the strongest operational package because low-temperature systems are usually the easiest to tune without changing the carrier or process route.

### `industrial_heat__medium_temperature__controls_tuning`

- `classification`: endogenous operational efficiency package
- `family_ids`: `medium_temperature_heat`
- `state_ids`: `generic_industrial_heat__medium_temperature_heat__fossil`
- `affected_inputs`: all direct thermal fuel inputs, scaled proportionally
- `affected_cost_fields`: low `output_cost_per_unit` adder
- `affected_process_emissions`: none
- `suggested_years`: all milestone years
- `effect_size`: default whole-row input multiplier around `0.98`, with a plausible range of `0.96` to `0.99`
- `cost_basis`: indicative annualised non-commodity cost adder of `+0.08` to `+0.25 AUD_2024/GJ_useful_heat`
- `rollout_limit_logic`: share cap on applicable fossil activity, for example `0.15`, `0.30`, `0.45`, `0.55`, `0.60`, `0.65` from 2025 to 2050
- `sources`:
  - DCCEEW process heat guide: controls, maintenance, and sequencing remain applicable to boilers, dryers, ovens, and process heaters
  - CEFC gas efficiency guide: process-control improvements, combustion tuning, and linked ancillary controls are mature measures with sub-5-year paybacks in many cases
- `confidence`: Medium-Low
- `rationale`: Still portable, but the family is more heterogeneous than low temperature, so keep the energy-intensity reduction smaller.

### `industrial_heat__high_temperature__controls_tuning`

- `classification`: endogenous operational efficiency package
- `family_ids`: `high_temperature_heat`
- `state_ids`: `generic_industrial_heat__high_temperature_heat__fossil`
- `affected_inputs`: all direct thermal fuel inputs, scaled proportionally
- `affected_cost_fields`: low `output_cost_per_unit` adder
- `affected_process_emissions`: none
- `suggested_years`: all milestone years
- `effect_size`: default whole-row input multiplier around `0.985`, with a plausible range of `0.97` to `0.99`
- `cost_basis`: indicative annualised non-commodity cost adder of `+0.10` to `+0.30 AUD_2024/GJ_useful_heat`
- `rollout_limit_logic`: share cap on applicable fossil activity, for example `0.10`, `0.20`, `0.35`, `0.45`, `0.55`, `0.60` from 2025 to 2050
- `sources`:
  - DCCEEW process heat guide: better burners, tighter temperature control, turn-down, and tuning can still deliver measurable savings on older furnaces and kilns
  - CEFC gas efficiency guide: digital combustion control and combustion-air management are still applicable, but the current family is too stylised to justify a large generic operational wedge
- `confidence`: Low
- `rationale`: Keep this as a small operational package only. In high-temperature systems, most large efficiency-looking changes are really process redesign or route change.

### Embodied route changes that should stay in pathway states

- `industrial_heat__low_temperature__electrification_route`
  - `classification`: embodied in pathway state
  - `family_ids`: `low_temperature_heat`
  - `state_ids`: `generic_industrial_heat__low_temperature_heat__electrified`
  - `rationale`: heat pumps, electric boilers, and direct electric heat change the principal carrier and are already represented by the transition state
- `industrial_heat__medium_temperature__electrification_route`
  - `classification`: embodied in pathway state
  - `family_ids`: `medium_temperature_heat`
  - `state_ids`: `generic_industrial_heat__medium_temperature_heat__electrified`
  - `rationale`: electric boilers, advanced heat pumps, and resistive heat are route changes, not portable overlays
- `industrial_heat__high_temperature__electrification_route`
  - `classification`: embodied in pathway state
  - `family_ids`: `high_temperature_heat`
  - `state_ids`: `generic_industrial_heat__high_temperature_heat__electrified`
  - `rationale`: resistive, plasma, and other deep-electrification options are inseparable from route choice in the current family
- `industrial_heat__all_temperatures__low_carbon_fuel_route`
  - `classification`: embodied in pathway state
  - `family_ids`: `low_temperature_heat`, `medium_temperature_heat`, `high_temperature_heat`
  - `state_ids`: the corresponding `__low_carbon_fuels` state ids
  - `rationale`: hydrogen and biomass route changes alter the carrier, infrastructure, and heat-supply configuration and should remain state-embodied

## 4. Rejected Or Deferred Items

### `industrial_heat__cross_family_heat_cascading`

- `reason_code`: `requires_interaction_engine`
- `explanation`: Cascading high-temperature exhaust heat into medium- or low-temperature service is real and often valuable, but the current family structure treats those temperature bands as separate demand families with no site-level coupling.
- `if_deferred`: revisit once the model can represent site integration, multiple linked demands, or process-chain structure.

### `industrial_heat__thermal_storage_and_load_shifting`

- `reason_code`: `requires_interaction_engine`
- `explanation`: Thermal storage, batch timing, and flexible electric operation are important for decarbonisation, but they are not simple static row multipliers on current useful-heat service states.
- `if_deferred`: revisit when temporal structure or storage-linked package logic exists.

### `industrial_heat__chp_or_cogeneration`

- `reason_code`: `non_efficiency_abatement`
- `explanation`: CHP changes co-product structure and onsite supply configuration rather than just reducing heat input per unit of useful heat.

### `industrial_heat__motors_vsds_and_compressed_air`

- `reason_code`: `not_material_for_v1`
- `explanation`: These are real industrial efficiency measures, but the current families only represent useful heat delivery. Generic motor or compressed-air packages would be more appropriate in plant-level or subsector-specific process families.

### `industrial_heat__process_redesign_or_product_substitution`

- `reason_code`: `structural_demand_change`
- `explanation`: Switching from thermal sterilisation to UV, changing product mix, or redesigning the underlying process can reduce heat demand materially, but that is demand or process redesign rather than a portable heat-supply efficiency package.

### `industrial_heat__full_electrification_as_package`

- `reason_code`: `embodied_route_change`
- `explanation`: Industrial heat pumps, electric boilers, resistance drying, microwave heating, or plasma routes should not be turned into packages because they change the carrier and often the whole process configuration.
- `if_deferred`: no deferral needed; the effect already belongs in current transition states.

### `industrial_heat__hydrogen_or_biomass_burner_conversion`

- `reason_code`: `embodied_route_change`
- `explanation`: Hydrogen or biomass conversion belongs in the current `__low_carbon_fuels` states, not an efficiency package bucket.

## 5. Draft Authoring Guidance

### Proposed ids

- Autonomous tracks:
  - `industrial_heat__low_temperature__background_thermal_drift`
  - `industrial_heat__medium_temperature__background_thermal_drift`
  - `industrial_heat__high_temperature__background_thermal_drift`
- Pure packages:
  - `industrial_heat__low_temperature__thermal_system_retrofit`
  - `industrial_heat__medium_temperature__thermal_system_retrofit`
  - `industrial_heat__high_temperature__combustion_heat_recovery`
- Operational packages:
  - `industrial_heat__low_temperature__controls_tuning`
  - `industrial_heat__medium_temperature__controls_tuning`
  - `industrial_heat__high_temperature__controls_tuning`

### Recommended v1 package logic

- Apply portable packages only to the fossil incumbent state in each family.
- Do not allow any v1 package on `__electrified` or `__low_carbon_fuels` states.
- Use one no-stacking group per family so the model chooses at most one endogenous package on a given slice of fossil activity.
- Preserve within-row fuel shares for medium- and high-temperature fossil states when applying package multipliers.

That implies an LP-friendly interaction rule such as:

```text
sum(package_activity[p, family_fossil_state, year] for p in family_nonstacking_group)
<= fossil_state_activity[family_fossil_state, year]
```

### Likely authoring fields

#### `autonomous_efficiency_tracks.csv`

- `track_id`
- `family_id`
- `state_ids`
- `affected_inputs`
- `input_multiplier_by_year`
- `energy_emissions_multiplier_by_year`
- `cost_adjustment_by_year`
- `source_ids_or_notes`
- `confidence`
- `double_counting_note`

#### `efficiency_packages.csv`

- `package_id`
- `family_id`
- `classification` (`pure_efficiency_overlay` or `operational_efficiency_overlay`)
- `state_ids`
- `affected_inputs`
- `input_multiplier_by_year`
- `energy_emissions_multiplier_by_year`
- `delta_output_cost_per_unit_by_year`
- `max_share_by_year`
- `rollout_limit_notes`
- `interaction_family`
- `source_ids_or_notes`
- `confidence`

### Suggested `README.md` notes

- Each industrial heat README should explicitly say that portable v1 efficiency applies only to the incumbent fossil state.
- The READMEs should say that electrified and low-carbon-fuel states already embody route-specific efficiency and should not receive generic add-on packages.
- The high-temperature README should say that only a small combustion-side package is accepted at the current family boundary; broader savings need subsector-specific modelling.

### Suggested `validation.md` checks

- With autonomous tracks and packages off, 2025 incumbent rows must still reproduce the current baseline anchor.
- No accepted package should target `__electrified` or `__low_carbon_fuels` state ids.
- Package multipliers must scale direct input coefficients and direct energy-emissions coefficients together.
- Pure-package savings must remain materially smaller than the incumbent-to-transition-state gap in low and medium temperature families.
- For the high-temperature family, any accepted package should remain a small wedge relative to route-switch uncertainty.

## 6. Open Questions

- Can v1 support the simple no-stacking LP constraint above? If not, the operational packages should likely be deferred and only the pure packages retained.
- Will explicit autonomous tracks be introduced by rebaselining current state rows, or only as reporting overlays? Without a rebaseline, autonomous drift risks double counting against the existing year-indexed coefficients.
- Should the next authoring issue also add industrial-efficiency source-ledger entries for the DCCEEW process heat guide, the CEFC gas efficiency guide, and the CSIRO / ITP process heat report so the eventual package rows can cite canonical `source_id`s instead of free-text notes?

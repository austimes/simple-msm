# Agriculture And Electricity Efficiency Research For 2qa.5

This note applies the shared brief in [20260420-efficiency-oracle-research-brief-template.md](./20260420-efficiency-oracle-research-brief-template.md) to the current `cropping_horticulture_output_bundle`, `livestock_output_bundle`, and `electricity` families.

It is grounded in the current repo structure, especially:

- `sector_trajectory_library/families/cropping_horticulture_output_bundle/*`
- `sector_trajectory_library/families/livestock_output_bundle/*`
- `sector_trajectory_library/families/electricity/*`
- `docs/prd/20260420-sector_state_library_efficiency_expansion_proposal.md`
- `sector_trajectory_library/README.md`

This research also draws on the most relevant external evidence for the current prototype boundary:

- DCCEEW `energy.gov.au` agriculture guidance, which shows that the practical Australian energy-efficiency opportunities are highly subsector-specific: irrigation pumps in irrigated crops, cooling and hot water in dairies, refrigeration and irrigation in fruit, and so on.
- DCCEEW irrigation-infrastructure program material, which frames the main agricultural "efficiency" opportunities around irrigation layout, automation, drip or spray conversion, pipes, meters, and water-delivery systems rather than clean national energy-only overlays.
- AEMO material on NEM loss factors and electricity-demand forecasting, which explicitly separates transmission and distribution losses from power-station auxiliary loads and shows that network losses are a real but system- and geography-dependent effect.
- CSIRO GenCost context already used by the repo's electricity family, which reinforces that major cost and emissions differences between electricity states come from supply-pathway composition, storage, and transmission rather than a generic portable efficiency wedge.

The current 2025 rows already show why the v1 answer should be asymmetric rather than forcing one package per family:

- Cropping and horticulture 2025 total direct inputs: conventional `1362.40`, mitigated `1294.28` GJ/A$m_output_2024, while process emissions are still much larger than direct-energy emissions at `472.34` versus `87.61 tCO2e/A$m_output_2024` on the conventional row.
- Livestock 2025 total direct inputs: conventional `1961.41`, mitigated `1863.34` GJ/A$m_output_2024, while process emissions dominate even more strongly at `1858.30` versus `124.01 tCO2e/A$m_output_2024` on the conventional row.
- Electricity 2025 direct generation-fuel inputs: incumbent thermal mix `7.9`, policy frontier `2.5`, deep clean firmed `1.6 GJ/MWh`, so most visible "efficiency" improvement is already embodied in state-level pathway change.

That combination implies:

- both agriculture bundles should be treated as explicit `no_material_v1` cases for portable packages, because the realistic candidates are too subsector-specific and too entangled with non-CO2 process effects at current family scope; and
- electricity should keep almost all improvement embodied in pathway states, while allowing at most one narrow incumbent-thermal auxiliary-load package.

## 1. Recommendation Summary

### Cropping and horticulture

- Accepted autonomous tracks: none as a new v1 addition.
- Accepted pure packages: none.
- Accepted operational packages: none.
- Embodied in pathway states: the small direct-energy improvement and moderate electrification already bundled into `agriculture__cropping_horticulture__mitigated` should stay state-embodied.
- Rejected or deferred: irrigation pumping and VSD packages, horticulture cold-store and pack-shed efficiency, and fertiliser-efficiency effects relabeled as energy efficiency.
- Conclusion: explicit `no_material_v1` for portable efficiency packages.

### Livestock

- Accepted autonomous tracks: none as a new v1 addition.
- Accepted pure packages: none.
- Accepted operational packages: none.
- Embodied in pathway states: the moderate on-farm energy-efficiency component already bundled into `agriculture__livestock__mitigated` should stay state-embodied with the methane, manure, and productivity changes.
- Rejected or deferred: dairy-shed cooling and hot-water efficiency, pumping or irrigation packages, and feed or herd-productivity effects relabeled as pure energy efficiency.
- Conclusion: explicit `no_material_v1` for portable efficiency packages.

### Electricity

- Accepted autonomous tracks: none for v1. Generic network-loss drift is real, but the current family does not cleanly separate delivered versus sent-out output or regional transmission geometry enough to author it as a portable row with confidence.
- Accepted pure packages: none.
- Accepted operational packages: `electricity__grid_supply__thermal_auxiliary_load_tuning` on `electricity__grid_supply__incumbent_thermal_mix` only.
- Embodied in pathway states: coal retirement, gas-balance changes, VRE build-out, storage, transmission, and broader supply-pathway shifts remain embodied in `electricity__grid_supply__policy_frontier` and `electricity__grid_supply__deep_clean_firmed`.
- Rejected or deferred: generic network-loss-reduction package, transmission-buildout effects treated as efficiency, and generator-mix shifts treated as portable efficiency.
- Conclusion: narrow accepted candidate set, but only one small operational package is materially defensible in v1.

## 2. Applicability Mapping

| candidate_id | classification | family_id | applicable_state_ids | excluded_state_ids | why excluded |
| --- | --- | --- | --- | --- | --- |
| `agriculture__cropping_horticulture__portable_energy_efficiency` | rejected/deferred | `cropping_horticulture_output_bundle` | none | `agriculture__cropping_horticulture__conventional`, `agriculture__cropping_horticulture__mitigated` | The family mixes irrigated and non-irrigated crops, horticulture, machinery use, and non-CO2 process effects at a coarse A$m bundle boundary, so no portable package is cleanly attributable. |
| `agriculture__cropping_horticulture__mitigated_bundle` | embodied in pathway state | `cropping_horticulture_output_bundle` | `agriculture__cropping_horticulture__mitigated` | `agriculture__cropping_horticulture__conventional` | The current mitigated state already bundles improved fertiliser management, moderate electrification, and lower process-emissions intensity. |
| `agriculture__livestock__portable_energy_efficiency` | rejected/deferred | `livestock_output_bundle` | none | `agriculture__livestock__conventional`, `agriculture__livestock__mitigated` | The family mixes dairy-like energy uses with cattle, sheep, and other livestock activity while methane and manure dominate the emissions story, so no portable package is robust at this boundary. |
| `agriculture__livestock__mitigated_bundle` | embodied in pathway state | `livestock_output_bundle` | `agriculture__livestock__mitigated` | `agriculture__livestock__conventional` | The current mitigated state already bundles methane, manure, productivity, and moderate on-farm energy-efficiency changes. |
| `electricity__grid_supply__thermal_auxiliary_load_tuning` | endogenous operational efficiency package | `electricity` | `electricity__grid_supply__incumbent_thermal_mix` | `electricity__grid_supply__policy_frontier`, `electricity__grid_supply__deep_clean_firmed` | Auxiliary-load optimisation is most defensible on the thermal-heavy incumbent state. Applying it to the frontier states would risk double counting route-specific fleet changes already embodied in the authored rows. |
| `electricity__grid_supply__network_loss_reduction` | rejected/deferred | `electricity` | none | `electricity__grid_supply__incumbent_thermal_mix`, `electricity__grid_supply__policy_frontier`, `electricity__grid_supply__deep_clean_firmed` | AEMO shows losses are real and material, but they depend on geography, line loading, and generator location. The current national-average family lacks the regional network representation needed for a clean portable package. |
| `electricity__grid_supply__pathway_shift_bundle` | embodied in pathway state | `electricity` | `electricity__grid_supply__policy_frontier`, `electricity__grid_supply__deep_clean_firmed` | `electricity__grid_supply__incumbent_thermal_mix` | The large fuel and emissions reductions come from changing the supply route, storage and firming mix, and transmission context, not from a portable efficiency overlay. |

## 3. Candidate Register

### `electricity__grid_supply__thermal_auxiliary_load_tuning`

- `classification`: endogenous operational efficiency package
- `family_ids`: `electricity`
- `state_ids`: `electricity__grid_supply__incumbent_thermal_mix`
- `affected_inputs`: `coal`, `natural_gas`
- `affected_cost_fields`: small positive `output_cost_per_unit` adder for controls, maintenance, and tuning effort
- `affected_process_emissions`: none separately; the package should reduce `energy_emissions_by_pollutant` in line with lower direct fuel use
- `suggested_years`: all milestone years, but most relevant while incumbent thermal activity is still material from 2025 to 2035
- `effect_size`: conservative whole-row direct-fuel multiplier of about `0.985` to `0.995`, with the same proportional reduction applied to `energy_co2e`
- `cost_basis`: low annualised operational spend for plant tuning, auxiliary-system optimisation, and maintenance discipline. Keep the cost adder materially smaller than the incumbent-to-policy-frontier cost delta
- `rollout_limit_logic`: a modest package cap is enough because it is low-cost but not universally persistent; for example `0.10`, `0.20`, `0.30`, `0.35`, `0.35`, `0.35` from 2025 to 2050, with diminishing practical relevance as incumbent thermal activity shrinks
- `sources`:
  - AEMO Electricity Demand Forecasting Methodology: auxiliary load is explicitly the difference between as-generated and sent-out electricity and is forecast separately from network losses
  - The same AEMO methodology gives a worked example of a new combined-cycle gas turbine with an assumed auxiliary factor of `3%`, which supports keeping this package in the low-single-digit range rather than treating it as a large wedge
  - Current repo family definition: the incumbent state explicitly carries thermal-fuel inputs and a national-average benchmark role, so a small fuel-and-emissions multiplier is representable without changing the route
- `confidence`: Medium-Low
- `rationale`: This is the only clean electricity package candidate because AEMO already treats auxiliary loads as a distinct operational component. A small incumbent-thermal tuning wedge fits the current row-based data shape. Anything much larger would blur into dispatch, unit retirement, or supply-pathway change.

### `agriculture__cropping_horticulture__mitigated_bundle`

- `classification`: embodied in pathway state
- `family_ids`: `cropping_horticulture_output_bundle`
- `state_ids`: `agriculture__cropping_horticulture__mitigated`
- `affected_inputs`: `refined_liquid_fuels`, `natural_gas`, `electricity`
- `affected_cost_fields`: yes, already represented through `output_cost_per_unit`
- `affected_process_emissions`: yes, primarily through the lower bundled process-emissions intensity
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in state form; the 2025 row already moves total direct inputs from about `1362.40` to `1294.28 GJ/A$m_output_2024` while also lowering process emissions materially
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in state `max_share`
- `sources`:
  - Current family-state description explicitly says the mitigated state combines improved fertiliser management, moderate electrification, and lower process-emissions intensity
  - DCCEEW agriculture guidance shows most practical energy measures are subsector-specific rather than portable across the whole family
  - DCCEEW irrigation infrastructure material shows that the largest tangible crop-side "efficiency" moves are irrigation-system and water-management projects tied to specific irrigated contexts
- `confidence`: High
- `rationale`: The current family boundary is too coarse to split energy-efficiency measures cleanly from agronomy, irrigation, and non-CO2 changes. The right v1 treatment is to keep the limited direct-energy improvement inside the mitigated state rather than inventing a generic package.

### `agriculture__livestock__mitigated_bundle`

- `classification`: embodied in pathway state
- `family_ids`: `livestock_output_bundle`
- `state_ids`: `agriculture__livestock__mitigated`
- `affected_inputs`: `refined_liquid_fuels`, `natural_gas`, `electricity`
- `affected_cost_fields`: yes, already represented through `output_cost_per_unit`
- `affected_process_emissions`: yes, especially through methane and manure reductions already bundled into the state
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in state form; the 2025 row already moves total direct inputs from about `1961.41` to `1863.34 GJ/A$m_output_2024` while also lowering process emissions from about `1858.30` to `1709.64 tCO2e/A$m_output_2024`
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in state `max_share`
- `sources`:
  - Current family-state description explicitly says the mitigated state combines methane, manure, productivity, and moderate on-farm energy-efficiency improvements
  - DCCEEW agriculture guidance shows that the best documented livestock-side energy measures are dairy-specific cooling, hot water, irrigation, and related equipment rather than family-wide livestock packages
  - The repo README already warns that this is a coarse residual agriculture block rather than a farm-system model
- `confidence`: High
- `rationale`: The energy component is real but secondary. At this family boundary it should remain bundled into the existing mitigated pathway state, not decomposed into a v1 efficiency package.

### `electricity__grid_supply__pathway_shift_bundle`

- `classification`: embodied in pathway state
- `family_ids`: `electricity`
- `state_ids`: `electricity__grid_supply__policy_frontier`, `electricity__grid_supply__deep_clean_firmed`
- `affected_inputs`: `coal`, `natural_gas`, plus implicit non-fuel renewable, storage, and transmission-system effects already represented through `output_cost_per_unit`
- `affected_cost_fields`: yes
- `affected_process_emissions`: no separate process-emissions row, but `energy_emissions_by_pollutant` changes materially
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in state form. The 2025 direct-fuel coefficients already fall from `7.9 GJ/MWh` on the incumbent state to `2.5` on `policy_frontier` and `1.6` on `deep_clean_firmed`
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in state availability and `max_share`
- `sources`:
  - Current family-state descriptions explicitly say these states represent different national supply-pathway formulations with different storage, firming, and transmission proxies
  - AEMO loss-factor material shows that network losses depend on where and how power moves through the system, which reinforces that geography and route matter
  - CSIRO GenCost context already used in the family README ties future electricity costs to whole-system generation, storage, and transmission choices rather than a portable single efficiency lever
- `confidence`: High
- `rationale`: In electricity, the major efficiency-looking gains are inseparable from technology mix, transmission context, and balancing strategy. They belong in pathway states.

## 4. Rejected Or Deferred Items

### `agriculture__cropping_horticulture__irrigation_pumping_and_vsd_package`

- `reason_code`: `requires_interaction_engine`
- `explanation`: Australian evidence clearly shows pump and irrigation upgrades can save energy, but the current family mixes irrigated and non-irrigated production and does not separate river-pump, bore-pump, drip, spray, or gravity systems. A generic package would be poorly attributed and highly dependent on regional water-system context.
- `if_deferred`: revisit only after splitting the family into explicit irrigated subfamilies or irrigation-service modules.

### `agriculture__cropping_horticulture__cold_store_or_pack_shed_efficiency`

- `reason_code`: `not_material_for_v1`
- `explanation`: Fruit-business refrigeration and pack-shed efficiency are real and well documented, but they apply to particular horticulture businesses and are not cleanly portable across the current farm-gate output bundle. Some of the relevant energy use may also sit beyond the current coarse family boundary.

### `agriculture__cropping_horticulture__fertiliser_efficiency_as_energy_package`

- `reason_code`: `non_efficiency_abatement`
- `explanation`: Better fertiliser management is important in the family, but its main value here is lower nitrous-oxide process emissions rather than a robust direct-energy-per-output package.

### `agriculture__livestock__dairy_shed_refrigeration_and_hot_water_package`

- `reason_code`: `requires_interaction_engine`
- `explanation`: Dairy energy measures are real and often attractive, but `livestock_output_bundle` is not a dairy family. It mixes dairy-like loads with beef, sheep, and other livestock activity, so a dairy-style efficiency package would be badly targeted at current family scope.
- `if_deferred`: revisit after splitting livestock into dairy versus non-dairy families.

### `agriculture__livestock__pumping_irrigation_and_shed_controls_package`

- `reason_code`: `requires_interaction_engine`
- `explanation`: Pumping, irrigation, ventilation, and shed-control opportunities vary strongly by subsector and farm type. The current livestock bundle does not provide the granularity needed for a clean package.
- `if_deferred`: revisit after adding explicit dairy, feedlot, shed-based, or irrigated pasture subfamilies.

### `agriculture__livestock__feed_and_productivity_efficiency_as_energy_package`

- `reason_code`: `non_efficiency_abatement`
- `explanation`: Feed efficiency, herd productivity, and methane-intensity improvements are important, but they are not clean direct-energy efficiency overlays in the sense used by this prototype. They mainly belong in productivity and non-CO2 abatement treatment.

### `electricity__grid_supply__network_loss_reduction_package`

- `reason_code`: `requires_interaction_engine`
- `explanation`: AEMO states that network losses are about `10%` of transported electricity, so the effect is real. But loss reduction depends on generator location, line loading, network quality, and transmission investment. The current national reduced-form family does not have the regional or delivered-versus-sent-out decomposition needed to author a clean generic package.
- `if_deferred`: revisit after splitting the electricity family into regionally explicit network and generation components or after adding explicit sent-out versus delivered accounting in the canonical shape.

### `electricity__grid_supply__transmission_buildout_as_efficiency`

- `reason_code`: `embodied_route_change`
- `explanation`: New transmission can reduce losses and enable better generation siting, but that is not a portable v1 efficiency package. It is part of the broader supply-pathway build captured by `policy_frontier` and `deep_clean_firmed`.

### `electricity__grid_supply__generator_mix_shift_as_efficiency`

- `reason_code`: `embodied_route_change`
- `explanation`: The large fall in fuel burned per delivered MWh mostly comes from different generation routes, storage, and balancing strategies. It should remain state-embodied rather than being relabeled as a generic efficiency overlay.

## 5. Draft Authoring Guidance

### Proposed ids

- Electricity operational package: `electricity__grid_supply__thermal_auxiliary_load_tuning`

### Agriculture guidance

- Do not author any new `autonomous_efficiency_tracks.csv` or `efficiency_packages.csv` rows for `cropping_horticulture_output_bundle` or `livestock_output_bundle` in v1.
- Instead, add explicit notes in the agriculture family `README.md` files that current direct-energy changes remain bundled into the mitigated states and that subsector-specific energy efficiency is deferred until the family split described in the existing expansion pathway.
- In the eventual canonical inventory, list both agriculture families as `no_material_v1` rather than inventing placeholder package ids just for symmetry.

### Electricity guidance

- If a v1 electricity row is authored, keep it family-local and narrow:
  - `package_id`: `electricity__grid_supply__thermal_auxiliary_load_tuning`
  - `family_id`: `electricity`
  - `classification`: `operational_efficiency_overlay`
  - `state_ids`: `electricity__grid_supply__incumbent_thermal_mix`
  - `affected_inputs`: `coal`, `natural_gas`
  - `input_multiplier_by_year`: very small low-single-digit reduction only
  - `delta_cost_by_year`: low positive annualised service cost
  - `affected_emissions_field`: proportional reduction in `energy_emissions_by_pollutant`
  - `max_share_by_year`: modest cap, because persistence is operational rather than structural
- Do not author a generic electricity loss-reduction package in the current shape.

### Suggested `README.md` notes

- Cropping and livestock READMEs should explicitly say that portable v1 efficiency packages are deferred because current energy-saving opportunities are subsector-specific and the family boundaries are still coarse residual bundles.
- Electricity README should explicitly distinguish three categories:
  - network losses,
  - plant auxiliary loads,
  - broader supply-pathway changes.
  Only the second category is a plausible v1 package candidate.

### Suggested `validation.md` checks

- No new v1 efficiency rows should be added for the two agriculture families unless the family boundaries are first split.
- Any electricity auxiliary-load package must remain materially smaller than the incumbent-to-policy-frontier state gap in both direct-fuel inputs and `energy_co2e`.
- No accepted electricity package should apply to `electricity__grid_supply__deep_clean_firmed`.
- Any future electricity loss-reduction concept must prove how it maps to the delivered-grid boundary and avoids double counting with the transmission proxy already in `output_cost_per_unit`.

## 6. Open Questions

- If `2qa.6` wants to expose electricity loss reduction explicitly for reporting, should the canonical package first add an explicit sent-out versus delivered accounting field rather than forcing the effect into today's single reduced-form row?
- If the electricity auxiliary-load package is authored, should it remain incumbent-only, or is there enough implementation appetite to support a much smaller `policy_frontier` variant with its own tighter cap and validation rule?

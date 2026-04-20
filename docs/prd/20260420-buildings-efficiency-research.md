# Buildings Efficiency Research For 2qa.1

This note applies the shared brief in [20260420-efficiency-oracle-research-brief-template.md](./20260420-efficiency-oracle-research-brief-template.md) to the current `residential_building_services` and `commercial_building_services` families.

It is grounded in the current repo structure, especially:

- `sector_trajectory_library/families/residential_building_services/*`
- `sector_trajectory_library/families/commercial_building_services/*`
- `docs/prd/20260420-sector_state_library_efficiency_expansion_proposal.md`
- `sector_trajectory_library/README.md`

The current 2025 state rows already show large embodied efficiency gaps between the incumbent and transition states, so the recommended portable packages are intentionally narrower than those state-to-state jumps:

- Residential 2025 total input coefficients: incumbent `0.998`, electrified efficiency `0.800`, deep electric `0.650` GJ/GJ_service_eq.
- Commercial 2025 total input coefficients: incumbent `1.000`, electrified efficiency `0.820`, deep electric `0.720` GJ/GJ_service_eq.

## 1. Recommendation Summary

### Residential building services

- Accepted autonomous track: background standards and turnover drift for shell and appliance performance, but only after current family-state rows are decomposed enough to avoid double counting.
- Accepted pure package: thermal-shell retrofit bundle covering insulation, draught sealing, and window / glazing improvement.
- Accepted operational package: none for v1. Household controls-only measures are too behavior-dependent and too weakly evidenced at this aggregate family boundary.
- Embodied in pathway states: heat-pump space heating, heat-pump hot water, induction cooking, and the wider electrified service bundle remain embodied in `buildings__residential__electrified_efficiency` and `buildings__residential__deep_electric`.
- Rejected or deferred: rooftop PV / batteries / demand response, home-energy disclosure, refrigerant management, and controls-only behavioral packages.

### Commercial building services

- Accepted autonomous track: background standards / disclosure / normal refurbishment drift, again only after state rows are decomposed enough to keep attribution clean.
- Accepted pure package: lighting retrofit plus simple lighting controls.
- Accepted operational package: HVAC tuning, commissioning, scheduling, and BMS optimisation.
- Embodied in pathway states: major HVAC electrification, gas boiler replacement with heat pumps, and other carrier-switching service transformations remain embodied in `buildings__commercial__electrified_efficiency` and `buildings__commercial__deep_electric`.
- Rejected or deferred: rooftop PV / batteries / demand response, refrigerant management as an efficiency package, commercial-kitchen electrification as a family-wide package, and deep façade / plantroom retrofit archetypes that need finer building-type splits.

## 2. Applicability Mapping

| candidate_id | classification | family_id | applicable_state_ids | excluded_state_ids | why excluded |
| --- | --- | --- | --- | --- | --- |
| `buildings__residential__background_standards_drift` | autonomous efficiency track | `residential_building_services` | `buildings__residential__incumbent_mixed_fuels`, `buildings__residential__electrified_efficiency` | `buildings__residential__deep_electric` | Deep-electric rows already describe widespread heat pumps plus high shell / appliance efficiency. |
| `buildings__residential__thermal_shell_retrofit` | endogenous pure efficiency package | `residential_building_services` | `buildings__residential__incumbent_mixed_fuels`, `buildings__residential__electrified_efficiency` | `buildings__residential__deep_electric` | Deep-electric rows already appear to include the frontier shell-efficiency effect. |
| `buildings__commercial__background_standards_drift` | autonomous efficiency track | `commercial_building_services` | `buildings__commercial__incumbent_mixed_fuels`, `buildings__commercial__electrified_efficiency` | `buildings__commercial__deep_electric` | Deep-electric rows already represent the most aggressive low-intensity service bundle in the current family. |
| `buildings__commercial__lighting_retrofit` | endogenous pure efficiency package | `commercial_building_services` | `buildings__commercial__incumbent_mixed_fuels`, `buildings__commercial__electrified_efficiency` | `buildings__commercial__deep_electric` | Deep-electric rows are already a high-performance outcome; a generic lighting package would likely double count. |
| `buildings__commercial__hvac_tuning_bms` | endogenous operational efficiency package | `commercial_building_services` | `buildings__commercial__incumbent_mixed_fuels`, `buildings__commercial__electrified_efficiency` | `buildings__commercial__deep_electric` | Same double-counting concern, and v1 should avoid a separate interaction rule just for deep-electric commercial rows. |

## 3. Candidate Register

### `buildings__residential__background_standards_drift`

- `classification`: autonomous efficiency track
- `family_ids`: `residential_building_services`
- `state_ids`: `buildings__residential__incumbent_mixed_fuels`, `buildings__residential__electrified_efficiency`
- `affected_inputs`: primarily electricity-sensitive appliance and cooling loads, plus a smaller reduction in remaining gas / biomass space-conditioning and water-heating intensity
- `affected_cost_fields`: `output_cost_per_unit` can drift down slightly as lower service energy demand reduces implicit appliance / maintenance burden, but commodity-price savings should mainly flow through the input multipliers rather than this field
- `affected_process_emissions`: none
- `suggested_years`: 2030, 2035, 2040, 2045, 2050
- `effect_size`: provisional authoring band of about `0.5%` to `0.8%` annual input-intensity improvement on applicable loads, implemented only after extracting the same background drift from the family-state rows
- `cost_basis`: no separate package cost because this is an exogenous scenario assumption; calibration should mirror the savings AEMO already attributes to NCC, E3, disclosure and state schemes in demand forecasting rather than add a new consumer choice cost
- `rollout_limit_logic`: exogenous and family-wide once enabled; no uptake decision variable
- `sources`:
  - AEMO 2024 Electricity Demand Forecasting Methodology: AEMO explicitly adjusts residential forecasts for NCC, E3 and state-scheme energy-efficiency savings, and captures some fuel-switching through those same energy-efficiency forecasts
  - DCCEEW 2025 Update to the Trajectory for Low Energy Buildings: energy performance improvements in existing buildings are a core policy objective and existing-building upgrades are a major focus
- `confidence`: Medium-Low
- `rationale`: The concept is clearly valid, but the current authored rows already embed a large amount of time-varying efficiency and electrification. The track is accepted only as a future explicit attribution layer, not as an immediate additive overlay on top of current coefficients.

### `buildings__residential__thermal_shell_retrofit`

- `classification`: endogenous pure efficiency package
- `family_ids`: `residential_building_services`
- `state_ids`: `buildings__residential__incumbent_mixed_fuels`, `buildings__residential__electrified_efficiency`
- `affected_inputs`: all space-conditioning-sensitive fuels, especially electricity, natural gas and biomass where present
- `affected_cost_fields`: `output_cost_per_unit` should rise modestly to represent retrofit capex / fixed annualised service cost
- `affected_process_emissions`: none
- `suggested_years`: all milestone years, with stronger effect from 2030 onward
- `effect_size`: family-level total input multiplier of about `0.92` to `0.95` on `buildings__residential__incumbent_mixed_fuels`, and `0.95` to `0.98` on `buildings__residential__electrified_efficiency`
- `cost_basis`: medium capex household retrofit bundle; DCCEEW's Household Energy Upgrades Fund notes insulation reduces average home heating and cooling costs by around `30%` with a `3` to `5` year payback, and improving glazing is a major thermal-shell measure. Climateworks evidence cited by DCCEEW says combined thermal-shell and electrification upgrades can deliver first-year net savings of `$1,058` to `$1,578` depending on climate and archetype.
- `rollout_limit_logic`: slower early uptake because retrofit requires building access, finance and contractor capacity; a pragmatic v1 cap would be low in 2025, material by 2035, and well short of full stock saturation by 2050
- `sources`:
  - DCCEEW Household Energy Upgrades Fund: insulation saves about `30%` of average home heating and cooling costs; up to `40%` of home heating energy can be lost and up to `87%` of heat gained through windows
  - DCCEEW Residential Buildings page and Trajectory update: millions of existing homes were built before meaningful standards and most older homes remain low performing
- `confidence`: Medium
- `rationale`: This is a classic carrier-preserving efficiency measure. It improves service delivery without committing the model to a particular fuel-switch route, and it remains materially smaller than the current repo's incumbent-to-electrified state jump.

### `buildings__commercial__background_standards_drift`

- `classification`: autonomous efficiency track
- `family_ids`: `commercial_building_services`
- `state_ids`: `buildings__commercial__incumbent_mixed_fuels`, `buildings__commercial__electrified_efficiency`
- `affected_inputs`: mostly electricity intensity, plus a smaller reduction in residual gas intensity as normal refurbishment and code / disclosure pressure improves equipment performance
- `affected_cost_fields`: little to no explicit non-commodity cost adder; keep this as an exogenous performance drift
- `affected_process_emissions`: none
- `suggested_years`: 2030, 2035, 2040, 2045, 2050
- `effect_size`: provisional authoring band of about `0.3%` to `0.6%` annual whole-state input-intensity improvement on applicable rows, again only after removing equivalent implicit drift from the state table
- `cost_basis`: no model choice cost; should mirror the portion of AEMO / policy forecast savings already driven by NCC, building disclosure schemes, E3 and state schemes
- `rollout_limit_logic`: exogenous and family-wide once enabled
- `sources`:
  - AEMO 2024 Electricity Demand Forecasting Methodology: AEMO adjusts business forecasts for NCC, building disclosure schemes, E3 and state efficiency schemes
  - NABERS 2022 summary guide: repeated measured disclosure and performance management have transformed office energy performance, showing the direction of commercially realised background improvement pressure
  - DCCEEW 2025 Trajectory update: existing commercial buildings need coordinated policy, finance and upgrade support
- `confidence`: Medium-Low
- `rationale`: As with residential, the concept is accepted but current repo rows likely already contain some of this drift. The research outcome is therefore to keep the concept, but not to layer it blindly on top of existing coefficients.

### `buildings__commercial__lighting_retrofit`

- `classification`: endogenous pure efficiency package
- `family_ids`: `commercial_building_services`
- `state_ids`: `buildings__commercial__incumbent_mixed_fuels`, `buildings__commercial__electrified_efficiency`
- `affected_inputs`: electricity only
- `affected_cost_fields`: modest one-off annualised capex adder to `output_cost_per_unit`
- `affected_process_emissions`: none
- `suggested_years`: all milestone years, with strongest near-term relevance from 2025 to 2035
- `effect_size`: family-level electricity-input multiplier of about `0.88` to `0.95`
- `cost_basis`: low-to-medium capex; the Victorian Energy Upgrades program provides indicative discounts, for example replacing `100` office fluorescent tubes (`24 W` each) with `50` LED luminaires (`16 W` each) receives an indicative `$1,260` discount, implying the measure is mature and already subsidy-supported
- `rollout_limit_logic`: high adoptability because the measure is mature, low-risk and already widely subsidised; rollout can be materially faster than shell retrofits but should still avoid a full-stock assumption in early years
- `sources`:
  - DCCEEW Lighting guide: lighting can consume up to `40%` of energy in commercial premises, LEDs use up to `75%` less energy than old halogens, and occupancy / timer controls are recommended low-complexity add-ons
  - Victorian Energy Upgrades commercial lighting discounts page: concrete LED replacement archetypes and subsidy examples
- `confidence`: Medium-High
- `rationale`: Lighting is separable, electricity-only, already heavily incentivised, and meaningfully material in commercial buildings. It is the cleanest pure-efficiency package candidate in the current commercial family.

### `buildings__commercial__hvac_tuning_bms`

- `classification`: endogenous operational efficiency package
- `family_ids`: `commercial_building_services`
- `state_ids`: `buildings__commercial__incumbent_mixed_fuels`, `buildings__commercial__electrified_efficiency`
- `affected_inputs`: mainly electricity, with gas savings where applicable through reduced heating runtime or better scheduling
- `affected_cost_fields`: low annualised service / controls cost adder to `output_cost_per_unit`
- `affected_process_emissions`: none
- `suggested_years`: all milestone years
- `effect_size`: family-level total input multiplier of about `0.90` to `0.97`, depending on building type and existing controls maturity
- `cost_basis`: low capex / service-contract style measure; the NSW HVAC optimisation guide says optimisation can save up to `50%` of total HVAC energy use and that returns on investment are often measured in months rather than years
- `rollout_limit_logic`: operational packages can scale faster than capital retrofits, but persistence depends on ongoing management quality; use a moderate-to-high maximum share with no assumption of perfect persistence
- `sources`:
  - NSW Government HVAC guide: HVAC can account for up to `50%` of a commercial building's energy use; optimisation can save up to `50%` of total HVAC energy use and is achieved through control changes, schedules, set points and minor repairs
  - DCCEEW / energy.gov.au BMS guidance: BMS and diagnostics support trend analysis, optimisation and reporting against NABERS targets
  - DCCEEW Trajectory update action 41: building maintenance and optimisation is explicitly named as a low-cost, high-benefit intervention for existing commercial buildings
- `confidence`: Medium-High
- `rationale`: This is the strongest operational package candidate because it is materially separable from fuel switching, already common in practice, and does not require the model to represent a new process route.

### `buildings__residential__electrified_service_bundle`

- `classification`: embodied in pathway state
- `family_ids`: `residential_building_services`
- `state_ids`: `buildings__residential__electrified_efficiency`, `buildings__residential__deep_electric`
- `affected_inputs`: electricity replaces gas / liquid fuels / some biomass for heating, hot water and cooking
- `affected_cost_fields`: yes
- `affected_process_emissions`: yes, through collapse of direct combustion emissions
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in existing state rows rather than portable package form
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in state availability and `max_share`
- `sources`:
  - Existing family-state descriptions explicitly mention widespread heat pumps and high shell / appliance efficiency in the transition states
  - AEMO gas-electricity meter linking report shows electrification is an appliance / service-route transition with region-specific rollout patterns, not a uniform carrier-preserving overlay
  - DCCEEW heat-pump and residential building materials highlight heat pumps and appliance replacement as core electrification technologies
- `confidence`: High
- `rationale`: These effects are inseparable from carrier switching and from the current authored state narratives, so they should remain state-embodied.

### `buildings__commercial__electrified_service_bundle`

- `classification`: embodied in pathway state
- `family_ids`: `commercial_building_services`
- `state_ids`: `buildings__commercial__electrified_efficiency`, `buildings__commercial__deep_electric`
- `affected_inputs`: electricity replaces gas and liquid fuel service uses, especially HVAC and hot water
- `affected_cost_fields`: yes
- `affected_process_emissions`: yes, through direct-combustion reductions
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in existing state rows rather than portable package form
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in state availability and `max_share`
- `sources`:
  - Existing commercial state descriptions explicitly say the transition states are lower-intensity, low-fossil or near-zero-direct-emissions service bundles
  - DCCEEW Trajectory update and commercial electrification research both treat major HVAC electrification as a building-retrofit pathway, not a generic overlay
- `confidence`: High
- `rationale`: Major plant electrification changes the carrier set, emissions profile, retrofit scope and infrastructure needs. That is a route change in the sense used by the efficiency-expansion proposal.

## 4. Rejected Or Deferred Items

### `buildings__residential__controls_only_behaviour_package`

- `reason_code`: `insufficient_evidence`
- `explanation`: Residential smart thermostats, occupant prompts and other controls-only measures are real, but the available evidence at current family granularity is too behavior-sensitive and too rebound-prone to support a clean national package row.
- `if_deferred`: would need better Australian measured-performance evidence tied to repeatable archetypes and a clearer persistence treatment.

### `buildings__pv_battery_and_demand_response`

- `reason_code`: `structural_demand_change`
- `explanation`: Rooftop PV, behind-the-meter batteries, tariff response and demand shifting affect supply, timing and net demand rather than pure service efficiency. They should remain in CER / demand-flexibility treatment, not an efficiency package bucket.

### `buildings__refrigerant_leakage_abatement`

- `reason_code`: `non_efficiency_abatement`
- `explanation`: Refrigerant leakage reduction is important for buildings emissions, but it is not primarily an input-per-service efficiency measure. It needs a separate non-CO2 / refrigerant treatment if added later.

### `buildings__commercial__deep_facade_or_plantroom_retrofit_archetype`

- `reason_code`: `requires_interaction_engine`
- `explanation`: Deep commercial façade, central plant and ventilation retrofits are highly heterogeneous by office / retail / hotel / hospital / school typology. In the current aggregate commercial family, a generic package would either be too blunt or would require subtype interactions that v1 does not support.
- `if_deferred`: revisit once `commercial_building_services` is split into more explicit end-use or building-type families.

### `buildings__commercial__kitchen_electrification`

- `reason_code`: `embodied_route_change`
- `explanation`: Commercial-kitchen electrification is material for some commercial subtypes but not portable across the current aggregate `commercial_building_services` family. It is a subtype-specific fuel-switching measure, not a family-wide efficiency package.
- `if_deferred`: revisit after the commercial family is split into narrower typologies.

### `buildings__ratings_finance_and_disclosure`

- `reason_code`: `not_material_for_v1`
- `explanation`: NatHERS disclosure, NABERS disclosure, green loans and assessments are enabling mechanisms, not direct efficiency measures. They should appear in notes and rollout logic, not as packages.

## 5. Draft Authoring Guidance

### Proposed ids

- Residential autonomous track: `buildings__residential__background_standards_drift`
- Commercial autonomous track: `buildings__commercial__background_standards_drift`
- Residential pure package: `buildings__residential__thermal_shell_retrofit`
- Commercial pure package: `buildings__commercial__lighting_retrofit`
- Commercial operational package: `buildings__commercial__hvac_tuning_bms`

### Likely authoring fields

#### `autonomous_efficiency_tracks.csv`

- `track_id`
- `family_id`
- `state_ids` or `all_states_in_family`
- `affected_inputs`
- `multiplier_by_year`
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
- `delta_cost_by_year`
- `max_share_by_year`
- `rollout_limit_notes`
- `interaction_family` (or an explicit `no_stacking_group` if v1 only allows one package per family)
- `source_ids_or_notes`
- `confidence`

### Suggested `README.md` notes

- Residential README should explicitly say that portable v1 efficiency work is limited to shell retrofits; electrified appliances and heat-pump service changes remain embodied in pathway states.
- Commercial README should explicitly distinguish portable lighting and HVAC-optimisation packages from state-embodied electrification.
- Both READMEs should say that deep-electric states are already the current family frontier and should not receive generic add-on packages unless family boundaries change.

### Suggested `validation.md` checks

- With autonomous tracks and packages turned off, 2025 incumbent rows must still reproduce the current baseline anchor.
- Portable package multipliers must remain materially smaller than the incumbent-to-transition state gap in the same family unless there is explicit evidence and an interaction rule.
- No accepted v1 package should apply to the current deep-electric state ids for either building family.
- Commercial operational-package savings should be capped so they do not exceed the portion of building energy plausibly attributable to HVAC optimisation.
- Residential shell package savings should remain smaller than the existing incumbent-to-electrified state jump to avoid silently recreating electrification inside a shell package.

## 6. Open Questions

1. Should future autonomous-track authoring support input-specific multipliers, or only a whole-row multiplier? The buildings evidence is stronger for end-use-specific drift than for a single blended row factor.
2. Is `commercial_building_services` going to stay a single aggregate family through v1, or should subtype splits happen before any kitchen / hospitality / hospital-specific package work is attempted?

## Sources Consulted

1. DCCEEW, Residential buildings: <https://www.dcceew.gov.au/energy/energy-efficiency/buildings/residential-buildings>
2. DCCEEW, Commercial buildings: <https://www.dcceew.gov.au/energy/energy-efficiency/buildings/commercial-buildings>
3. DCCEEW, Household Energy Upgrades Fund: <https://www.energy.gov.au/rebates/household-energy-upgrades-fund>
4. DCCEEW, Update to the Trajectory for Low Energy Buildings (2025): <https://www.energy.gov.au/sites/default/files/2025-08/update-to-the-trajectory-for-low-energy-buildings.pdf>
5. AEMO, Electricity Demand Forecasting Methodology (2024): <https://www.aer.gov.au/system/files/2024-08/AEMO%20-%20Electricity%20Demand%20Forecasting%20Methodology%20-%20August%202024.pdf>
6. AEMO, Gas-Electricity Meter Data Linking Project Report (2025): <https://www.aemo.com.au/-/media/files/electricity/nem/planning_and_forecasting/gaselectricity-meter-data-linking-project/gas-electricity-meter-data-linking-project-report.pdf>
7. NABERS, Energy efficiency in commercial buildings summary (2022): <https://www.nabers.gov.au/sites/default/files/energy_efficiency_in_commercial_buildings_summary.pdf>
8. NSW Government, HVAC guide: <https://www.energy.nsw.gov.au/business-and-industry/guides/technology-guides/heating-ventilation-and-air-conditioning-hvac-guide>
9. DCCEEW, Lighting guide: <https://www.energy.gov.au/business/equipment-guides/lighting>
10. Victorian Energy Upgrades, commercial and industrial lighting discounts: <https://www.energy.vic.gov.au/victorian-energy-upgrades/products/lighting-discounts>

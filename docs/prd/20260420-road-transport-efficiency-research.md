# Road Transport Efficiency Research For 2qa.2

This note applies the shared brief in [20260420-efficiency-oracle-research-brief-template.md](./20260420-efficiency-oracle-research-brief-template.md) to the current `passenger_road_transport` and `freight_road_transport` families.

It is grounded in the current repo structure, especially:

- `sector_trajectory_library/families/passenger_road_transport/*`
- `sector_trajectory_library/families/freight_road_transport/*`
- `docs/prd/20260420-sector_state_library_efficiency_expansion_proposal.md`
- `sector_trajectory_library/README.md`

The current road-transport state rows already contain large efficiency differences that should stay mostly state-embodied rather than being recreated through portable packages:

- Passenger 2025 input coefficients: incumbent ICE `0.00256`, hybrid transition `0.00175`, and BEV `0.00043` GJ/pkm.
- Freight 2025 input coefficients: diesel `0.00205`, efficient diesel `0.00170`, BEV `0.00080`, and FCEV H2 `0.00140` GJ/tkm.

That means the v1 recommendation should be narrow: keep most passenger-road efficiency and most freight diesel-side efficiency embodied in existing states, add only a limited autonomous attribution layer, and accept at most one narrow freight operational package that does not recreate the authored `road_transport__freight_road__efficient_diesel` pathway.

## 1. Recommendation Summary

### Passenger road transport

- Accepted autonomous track: background new-light-vehicle efficiency drift, mainly reflecting stock turnover and Australia's New Vehicle Efficiency Standard, but only after equivalent drift is removed from the current `road_transport__passenger_road__ice_fleet` rows.
- Accepted pure package: none for v1.
- Accepted operational package: none for v1.
- Embodied in pathway states: hybridisation and regenerative-braking efficiency remain embodied in `road_transport__passenger_road__hybrid_transition`, while full drivetrain and carrier shift remain embodied in `road_transport__passenger_road__bev`.
- Rejected or deferred: eco-driving / tyre / maintenance bundles for the aggregate passenger family, higher-occupancy or rideshare style measures, and mode shift or other demand-side measures.

### Freight road transport

- Accepted autonomous track: background diesel-truck efficiency drift for the base diesel state, again only after equivalent drift is extracted from current `road_transport__freight_road__diesel` row trends.
- Accepted pure package: none for v1.
- Accepted operational package: a narrow telematics / eco-driving / idle / tyre-pressure / maintenance package on `road_transport__freight_road__diesel` only.
- Embodied in pathway states: the current `road_transport__freight_road__efficient_diesel` state should remain the repo's bundled diesel-side efficiency pathway, and BEV / FCEV efficiency gains remain embodied in `road_transport__freight_road__bev` and `road_transport__freight_road__fcev_h2`.
- Rejected or deferred: freight aerodynamic / lightweight / AMT hardware bundles as portable v1 packages, PBS / longer-combination / mass-dimension productivity upgrades, backhaul / load-consolidation platforms as a generic national package, freight mode shift, and biofuels / renewable diesel as efficiency.

## 2. Applicability Mapping

| candidate_id | classification | family_id | applicable_state_ids | excluded_state_ids | why excluded |
| --- | --- | --- | --- | --- | --- |
| `road_transport__passenger_road__background_new_vehicle_efficiency_drift` | autonomous efficiency track | `passenger_road_transport` | `road_transport__passenger_road__ice_fleet` | `road_transport__passenger_road__hybrid_transition`, `road_transport__passenger_road__bev` | `hybrid_transition` and `bev` already represent technology-specific efficiency transitions whose authored rows already improve over time. |
| `road_transport__freight_road__background_diesel_efficiency_drift` | autonomous efficiency track | `freight_road_transport` | `road_transport__freight_road__diesel` | `road_transport__freight_road__efficient_diesel`, `road_transport__freight_road__bev`, `road_transport__freight_road__fcev_h2` | `efficient_diesel` is already the authored bundled diesel-efficiency pathway, while BEV and FCEV have different technology-specific improvement drivers. |
| `road_transport__freight_road__fleet_telematics_eco_driving` | endogenous operational efficiency package | `freight_road_transport` | `road_transport__freight_road__diesel` | `road_transport__freight_road__efficient_diesel`, `road_transport__freight_road__bev`, `road_transport__freight_road__fcev_h2` | Applying it to `efficient_diesel` would double count logistics / utilisation gains already embedded in that state, and applying it to BEV / FCEV would require drivetrain-specific interaction rules that v1 does not have. |
| `road_transport__passenger_road__hybridisation_bundle` | embodied in pathway state | `passenger_road_transport` | `road_transport__passenger_road__hybrid_transition` | `road_transport__passenger_road__ice_fleet`, `road_transport__passenger_road__bev` | The efficiency effect is inseparable from hybrid powertrain adoption and regenerative braking. |
| `road_transport__passenger_road__bev_drivetrain_shift` | embodied in pathway state | `passenger_road_transport` | `road_transport__passenger_road__bev` | `road_transport__passenger_road__ice_fleet`, `road_transport__passenger_road__hybrid_transition` | The efficiency gain comes with a carrier and drivetrain change. |
| `road_transport__freight_road__efficient_diesel_bundle` | embodied in pathway state | `freight_road_transport` | `road_transport__freight_road__efficient_diesel` | `road_transport__freight_road__diesel`, `road_transport__freight_road__bev`, `road_transport__freight_road__fcev_h2` | The current state explicitly already bundles better vehicle efficiency, logistics and utilisation. |
| `road_transport__freight_road__bev_drivetrain_shift` | embodied in pathway state | `freight_road_transport` | `road_transport__freight_road__bev` | `road_transport__freight_road__diesel`, `road_transport__freight_road__efficient_diesel`, `road_transport__freight_road__fcev_h2` | The efficiency gain is inseparable from electrification and duty-cycle suitability. |
| `road_transport__freight_road__fcev_h2_drivetrain_shift` | embodied in pathway state | `freight_road_transport` | `road_transport__freight_road__fcev_h2` | `road_transport__freight_road__diesel`, `road_transport__freight_road__efficient_diesel`, `road_transport__freight_road__bev` | The efficiency gain is inseparable from hydrogen fuel-cell route choice and infrastructure assumptions. |

## 3. Candidate Register

### `road_transport__passenger_road__background_new_vehicle_efficiency_drift`

- `classification`: autonomous efficiency track
- `family_ids`: `passenger_road_transport`
- `state_ids`: `road_transport__passenger_road__ice_fleet`
- `affected_inputs`: `refined_liquid_fuels`
- `affected_cost_fields`: little to no explicit `output_cost_per_unit` adder; any modest downward drift should mainly sit in commodity-input effects rather than a separate authored cost reduction
- `affected_process_emissions`: none
- `suggested_years`: 2030, 2035, 2040, 2045, 2050
- `effect_size`: provisional authoring band of about `0.5%` to `0.8%` annual reduction in liquid-fuel input intensity on the applicable state, but only after removing equivalent improvement already embedded in the current row trend. The current `road_transport__passenger_road__ice_fleet` row already falls from `0.00256` to `0.00205` GJ/pkm from 2025 to 2050, about a `20%` improvement overall.
- `cost_basis`: no separate package cost; treat as an exogenous policy-and-turnover assumption driven by new-vehicle supply standards and ordinary replacement, not a user-selected retrofit
- `rollout_limit_logic`: exogenous, stock-turnover paced, and applied only once enabled; no endogenous uptake variable
- `sources`:
  - New Vehicle Efficiency Standard Regulator, What is the NVES?: the standard came into effect on `1 January 2025`, applies to new passenger and light commercial vehicles, and tightens over time
  - New Vehicle Efficiency Standard Regulator, Why the NVES was introduced: emissions targets become more stringent over time to encourage more fuel-efficient vehicles year-on-year
  - CSIRO for AEMO, *Electric vehicle projections 2024*: 2029-30 sales are modelled as combinations of ICE, hybrid, PHEV and BEV vehicles consistent with meeting passenger and light-commercial efficiency standards
- `confidence`: Medium-Low
- `rationale`: This is the cleanest passenger-road autonomous efficiency concept for Australia. But because the current `ice_fleet` rows already decline materially over time, the track is best treated as a future attribution layer rather than a blind overlay on top of current coefficients.

### `road_transport__freight_road__background_diesel_efficiency_drift`

- `classification`: autonomous efficiency track
- `family_ids`: `freight_road_transport`
- `state_ids`: `road_transport__freight_road__diesel`
- `affected_inputs`: `refined_liquid_fuels`
- `affected_cost_fields`: little to no explicit `output_cost_per_unit` change; keep this as an exogenous background performance drift
- `affected_process_emissions`: none
- `suggested_years`: 2030, 2035, 2040, 2045, 2050
- `effect_size`: provisional authoring band of about `0.3%` to `0.6%` annual reduction in diesel input intensity on the applicable state, again only after removing equivalent drift already built into the current state rows. The current `road_transport__freight_road__diesel` row already falls from `0.00205` to `0.00168` GJ/tkm from 2025 to 2050, about an `18%` improvement overall.
- `cost_basis`: no separate package cost; treat as ordinary procurement, replacement and background fleet improvement rather than a model choice
- `rollout_limit_logic`: exogenous and turnover paced; should not be authored as a user-selectable package
- `sources`:
  - DCCEEW, Road transport sector guide: fit-for-purpose procurement, maintenance, gear optimisation and duty-cycle matching all improve fuel efficiency in normal fleet practice
  - NHVR, *Heavy Vehicle Productivity Plan 2025-2030*: newer and more productive vehicles are part of the long-run efficiency and emissions direction, but the transition remains constrained by fleet and network realities
  - Existing row trend in `sector_trajectory_library/families/freight_road_transport/family_states.csv`
- `confidence`: Low-Medium
- `rationale`: There is a plausible background diesel-efficiency drift, but the evidence is weaker than for passenger NVES-driven improvement and the current freight rows already contain a material time decline. This should therefore be a cautious attribution layer only.

### `road_transport__freight_road__fleet_telematics_eco_driving`

- `classification`: endogenous operational efficiency package
- `family_ids`: `freight_road_transport`
- `state_ids`: `road_transport__freight_road__diesel`
- `affected_inputs`: `refined_liquid_fuels`
- `affected_cost_fields`: low annualised service / training / telematics cost adder to `output_cost_per_unit`
- `affected_process_emissions`: none
- `suggested_years`: all milestone years, with strongest practical relevance from 2025 to 2035
- `effect_size`: conservative family-level liquid-fuel multiplier of about `0.94` to `0.98`. This intentionally sits well below the current diesel-to-efficient-diesel gap of roughly `0.83x`, even though the source evidence supports larger gross opportunities in subsets of fleets.
- `cost_basis`: low-capex / low-opex operational bundle covering fuel-data systems, telematics, driver coaching, idle reduction, tyre-pressure management, and minor maintenance optimisation. Author this as a modest `output_cost_per_unit` adder materially smaller than the current diesel-to-efficient-diesel state cost delta.
- `rollout_limit_logic`: faster rollout than vehicle replacement, but not full saturation because persistence depends on management quality and not every operator sustains the gains. A pragmatic v1 cap should stay below majority penetration of diesel activity unless the family is later split by duty cycle.
- `sources`:
  - DCCEEW, Road transport sector guide: energy use can vary by as much as `30%` among drivers on the same route
  - DCCEEW, Road transport sector guide: reducing highway speed from `100` to `90 km/h` can reduce fuel use by nearly `10%`
  - DCCEEW, Road transport sector guide: maintenance programs can save up to `10%`
  - DCCEEW, Road transport sector guide: tyres `10 psi` under recommended pressure can reduce fuel efficiency by around `5%`
  - DCCEEW, Road transport sector guide: low-viscosity lubricants can improve fuel economy by at least `3%`
- `confidence`: Medium
- `rationale`: This is the strongest portable freight package that remains after respecting the existing `efficient_diesel` state. It is operational, relatively low cost, Australia-specific in source coverage, and can be kept materially smaller than the embodied diesel-efficiency pathway.

### `road_transport__passenger_road__hybridisation_bundle`

- `classification`: embodied in pathway state
- `family_ids`: `passenger_road_transport`
- `state_ids`: `road_transport__passenger_road__hybrid_transition`
- `affected_inputs`: lower `refined_liquid_fuels` use through hybrid powertrain efficiency and regenerative braking
- `affected_cost_fields`: yes
- `affected_process_emissions`: lower direct combustion emissions through lower fuel use
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in state form. The current row is already about `0.68x` the ICE energy intensity in 2025.
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in the state `max_share` trajectory
- `sources`:
  - Existing `family_states.csv` rows and state descriptions
  - CSIRO for AEMO, *Electric vehicle projections 2024*: hybrids rise as one route consistent with meeting the NVES target
  - DCCEEW, Road transport sector guide: hybrids can deliver significant fuel savings where regenerative braking is valuable
- `confidence`: High
- `rationale`: Even though the carrier remains liquid fuel, the efficiency gain is inseparable from drivetrain choice. In the current repo this belongs in the pathway state, not a portable package.

### `road_transport__passenger_road__bev_drivetrain_shift`

- `classification`: embodied in pathway state
- `family_ids`: `passenger_road_transport`
- `state_ids`: `road_transport__passenger_road__bev`
- `affected_inputs`: electricity replaces `refined_liquid_fuels`
- `affected_cost_fields`: yes
- `affected_process_emissions`: direct tailpipe emissions fall to zero
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in state form. The current BEV row is about `0.17x` the ICE energy intensity in 2025.
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in the state `max_share` trajectory
- `sources`:
  - Existing `family_states.csv` rows and state descriptions
  - CSIRO for AEMO, *Electric vehicle projections 2024*
  - DCCEEW, Road transport sector guide
- `confidence`: High
- `rationale`: This is a classic embodied-efficiency case: lower energy use comes with a carrier switch, zero tailpipe emissions, charging assumptions, and different fleet-rollout dynamics.

### `road_transport__freight_road__efficient_diesel_bundle`

- `classification`: embodied in pathway state
- `family_ids`: `freight_road_transport`
- `state_ids`: `road_transport__freight_road__efficient_diesel`
- `affected_inputs`: lower `refined_liquid_fuels` use
- `affected_cost_fields`: yes
- `affected_process_emissions`: lower direct combustion emissions through lower fuel use
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in state form. The current row is already about `0.83x` the base diesel energy intensity in 2025.
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in the state `max_share` trajectory
- `sources`:
  - Existing `family_states.csv` state description explicitly says `better vehicle efficiency, logistics and utilisation`
  - DCCEEW, Road transport sector guide documents the kinds of measures that plausibly sit inside such a bundle
- `confidence`: High
- `rationale`: In a richer library this bundle could be decomposed. In the current prototype, it is already the authored diesel-side efficiency pathway. Portable v1 packages should therefore avoid recreating it.

### `road_transport__freight_road__bev_drivetrain_shift`

- `classification`: embodied in pathway state
- `family_ids`: `freight_road_transport`
- `state_ids`: `road_transport__freight_road__bev`
- `affected_inputs`: electricity replaces `refined_liquid_fuels`
- `affected_cost_fields`: yes
- `affected_process_emissions`: direct tailpipe emissions fall to zero
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in state form. The current BEV freight row is about `0.39x` of diesel in 2025.
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in the state `max_share` trajectory
- `sources`:
  - Existing `family_states.csv` rows
  - DCCEEW, Road transport sector guide: electric trucks are more efficient and especially suited for duty cycles involving moderate loads where battery weight does not constrain payload
- `confidence`: High
- `rationale`: The efficiency effect is inseparable from electrification, range / charging suitability, and duty-cycle selection.

### `road_transport__freight_road__fcev_h2_drivetrain_shift`

- `classification`: embodied in pathway state
- `family_ids`: `freight_road_transport`
- `state_ids`: `road_transport__freight_road__fcev_h2`
- `affected_inputs`: hydrogen replaces `refined_liquid_fuels`
- `affected_cost_fields`: yes
- `affected_process_emissions`: direct tailpipe emissions fall to zero
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in state form. The current FCEV row is about `0.68x` of diesel in 2025.
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in the state `max_share` trajectory
- `sources`:
  - Existing `family_states.csv` rows
  - DCCEEW, Road transport sector guide: hydrogen fuel cells are expected to be suited to medium-to-long-distance freight in the longer term and require substantially more electricity than BEVs on a lifecycle basis
- `confidence`: High
- `rationale`: This is a route choice, not a portable efficiency overlay.

## 4. Rejected Or Deferred Items

### `road_transport__passenger_road__eco_driving_and_maintenance_bundle`

- `reason_code`: `not_material_for_v1`
- `explanation`: Passenger road is currently a national aggregate pkm boundary that mixes passenger cars and buses. A generic operational package would mix household driving behaviour, fleet practice and bus operations, making the effect too noisy and too weakly attributable for a clean v1 package row.
- `if_deferred`: revisit after the family is split into at least private light vehicles versus buses or commercial passenger fleets.

### `road_transport__passenger_road__higher_vehicle_occupancy_or_rideshare`

- `reason_code`: `structural_demand_change`
- `explanation`: This changes occupancy and service-delivery structure rather than only reducing input intensity within a fixed technology / service route. It belongs in demand / utilisation assumptions, not an efficiency package.
- `if_deferred`: would require explicit occupancy or passengers-per-vehicle treatment alongside demand interactions.

### `road_transport__freight_road__aerodynamic_and_hardware_retrofit_bundle`

- `reason_code`: `requires_interaction_engine`
- `explanation`: Aerodynamics, lightweighting, AMTs, low-rolling-resistance tyres and gear optimisation are real freight efficiency measures, but at current national-average tkm family scope they are strongly duty-cycle dependent and would materially overlap the existing `road_transport__freight_road__efficient_diesel` state.
- `if_deferred`: revisit after splitting freight into rigid / articulated / urban / linehaul families or after adding explicit no-stacking interaction rules.

### `road_transport__freight_road__pbs_and_longer_combination_vehicle_productivity`

- `reason_code`: `requires_interaction_engine`
- `explanation`: PBS, longer-combination vehicles and mass-dimension changes can reduce fuel per tkm, but the effect depends on access networks, payload limits, pavement rules and truck configuration. In the current aggregate family this is too entangled with network and productivity reform to author as a generic portable package.
- `if_deferred`: revisit with truck-class splits plus explicit access-network or productivity logic.

### `road_transport__freight_road__backhaul_and_load_consolidation_platforms`

- `reason_code`: `requires_interaction_engine`
- `explanation`: Backloading, route consolidation and fleet utilisation improvement are material, but in the current repo they overlap heavily with what `road_transport__freight_road__efficient_diesel` already describes as `logistics and utilisation`. A second generic package would be high-risk double counting.
- `if_deferred`: revisit only if `efficient_diesel` is decomposed into narrower components or replaced by explicit truck-task subfamilies.

### `road_transport__freight_mode_shift`

- `reason_code`: `structural_demand_change`
- `explanation`: Shifting freight from road to rail or coastal shipping is not a road-efficiency package. It is a modal-structure change and should stay in transport-demand or mode-choice treatment.
- `if_deferred`: none; this belongs in a separate structural-change module.

### `road_transport__biofuels_or_renewable_diesel`

- `reason_code`: `non_efficiency_abatement`
- `explanation`: Biofuels may reduce emissions intensity but do not inherently reduce energy input per pkm or per tkm. They should not be classified as efficiency.
- `if_deferred`: treat in fuel-switch or supply-decarbonisation logic, not efficiency.

## 5. Draft Authoring Guidance

### Proposed ids

- Passenger autonomous track: `road_transport__passenger_road__background_new_vehicle_efficiency_drift`
- Freight autonomous track: `road_transport__freight_road__background_diesel_efficiency_drift`
- Freight operational package: `road_transport__freight_road__fleet_telematics_eco_driving`

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
- `classification` (`operational_efficiency_overlay`)
- `state_ids`
- `affected_inputs`
- `input_multiplier_by_year`
- `delta_cost_by_year`
- `max_share_by_year`
- `rollout_limit_notes`
- `interaction_family` or an explicit `no_stacking_group`
- `source_ids_or_notes`
- `confidence`

### Suggested `README.md` notes

- Passenger README should explicitly say that hybrid and BEV efficiency remain embodied in pathway states, that no portable passenger-road efficiency package is recommended for v1 at current family scope, and that any future autonomous passenger efficiency track must first be decomposed out of the current `ice_fleet` time trend.
- Freight README should explicitly say that `road_transport__freight_road__efficient_diesel` already embodies better diesel vehicle efficiency plus logistics / utilisation improvements, that the only accepted portable v1 freight package is a narrow operational-management package on the base diesel state, and that hardware freight diesel packages are deferred until duty-cycle splits or interaction handling exist.

### Suggested `validation.md` checks

- With autonomous tracks and packages turned off, 2025 default states must still reproduce the current passenger and freight baseline anchors.
- No accepted v1 package should apply to `road_transport__passenger_road__hybrid_transition`, `road_transport__passenger_road__bev`, `road_transport__freight_road__efficient_diesel`, `road_transport__freight_road__bev`, or `road_transport__freight_road__fcev_h2`.
- The freight operational-package savings must remain materially smaller than the existing diesel-to-efficient-diesel gap in every milestone year.
- Autonomous-track authoring must not double-apply improvement already present in the state tables.

## 6. Open Questions

1. Should autonomous-efficiency authoring support state-specific application only to selected incumbent fossil states? Road transport strongly benefits from that flexibility.
2. Will `passenger_road_transport` remain a combined private-car-plus-bus family through v1, or will it be split before any passenger operational package work is attempted?
3. Will `freight_road_transport` remain a national-average tkm family through v1, or should rigid / articulated / urban / linehaul splits happen before any aerodynamic or PBS-style efficiency package work is authored?

## References

1. DCCEEW, Road transport sector guide: <https://www.energy.gov.au/business/sector-guides/transport/road-transport>
2. New Vehicle Efficiency Standard Regulator, What is the New Vehicle Efficiency Standard?: <https://www.nvesregulator.gov.au/what-new-vehicle-efficiency-standard>
3. New Vehicle Efficiency Standard Regulator, Why the NVES was introduced: <https://www.nvesregulator.gov.au/what-new-vehicle-efficiency-standard/why-nves-was-introduced>
4. CSIRO for AEMO, *Electric vehicle projections 2024*: <https://www.aemo.com.au/-/media/files/major-publications/isp/2025/stage-2/electric-vehicle-projections-2024.pdf>
5. NHVR, *Heavy Vehicle Productivity Plan 2025-2030*: <https://www.nhvr.gov.au/files/media/document/515/202412-1546-heavy-vehicle-productivity-plan-2025-2030.pdf>

# Steel And Cement Efficiency Research For 2qa.4

This note applies the shared brief in [20260420-efficiency-oracle-research-brief-template.md](./20260420-efficiency-oracle-research-brief-template.md) to the current `crude_steel` and `cement_equivalent` families.

It is grounded in the current repo structure, especially:

- `sector_trajectory_library/families/crude_steel/*`
- `sector_trajectory_library/families/cement_equivalent/*`
- `docs/prd/20260420-sector_state_library_efficiency_expansion_proposal.md`
- `sector_trajectory_library/README.md`

The current authored rows already contain substantial time-varying intensity change, so portable efficiency must stay materially smaller than the state-to-state and year-to-year pathway changes:

- Crude steel 2025 direct-energy proxy, excluding feedstocks and capture service:
  - `steel__crude_steel__bf_bof_conventional` ≈ `20.6 GJ/t_crude_steel`
  - `steel__crude_steel__scrap_eaf` ≈ `2.4 GJ/t_crude_steel`
  - `steel__crude_steel__bf_bof_ccs_transition` ≈ `15.5 GJ/t_crude_steel`
  - `steel__crude_steel__h2_dri_electric` ≈ `12.8 GJ/t_crude_steel`
- The incumbent BF-BOF row already improves from about `20.6` to `18.7 GJ/t` between 2025 and 2050, so most of the big visible steel improvement is already embedded and must not be recreated as a portable wedge.
- Cement-equivalent 2025 direct-energy proxy:
  - `cement_clinker__cement_equivalent__conventional` ≈ `2.16 GJ/t_cement_equivalent`
  - `cement_clinker__cement_equivalent__low_clinker_alt_fuels` ≈ `2.56 GJ/t_cement_equivalent`
  - `cement_clinker__cement_equivalent__ccs_deep` ≈ `2.52 GJ/t_cement_equivalent`
- CIF explicitly says Australian cement kilns are already highly efficient, with more than `97%` of domestic clinker produced in efficient calciner kilns, thermal demand reduced from about `4,700` to `3,445 MJ/t_clinker` over the last 20 years, and future improvement to about `3,345 MJ/t_clinker` being only about another `6%`.

## 1. Recommendation Summary

### Crude steel

- Accepted autonomous track: a narrow BF-BOF route-stable background drift for housekeeping, auxiliary systems and ordinary heat-integration improvement, but only after equivalent drift is extracted from the current BF-BOF state rows.
- Accepted pure packages:
  - BOF gas recovery and reuse on BF-BOF states only.
  - Scrap preheating on `steel__crude_steel__scrap_eaf` only.
- Accepted operational package: advanced process control / monitoring / tuning on incumbent BF-BOF, BF-BOF+CCS and scrap-EAF states, with small savings only.
- Embodied in pathway states: BF-BOF to scrap EAF, BF-BOF to H2-DRI-electric, scrap-ratio changes, and CCS-enabled route changes remain in state rows.
- Rejected or deferred: broad waste-heat umbrella bundles, TRT as a new optional package, CDQ, PCI optimisation, motors/VSD as a standalone steel package, and hot charging/direct rolling.

### Cement equivalent

- Accepted autonomous track: narrow background kiln-and-grinding efficiency drift on `conventional` and `low_clinker_alt_fuels`, again only after current row drift is decomposed.
- Accepted pure package: grinding-system upgrade bundle, centered on VRM / HPGR / classifier improvements.
- Accepted operational package: kiln and mill optimisation through sensors, AI, model-predictive control and tighter process management.
- Embodied in pathway states: clinker-factor reduction, SCM substitution, alternative-fuel substitution and CCS remain in `low_clinker_alt_fuels` and `ccs_deep`.
- Rejected or deferred: kiln waste-heat power generation, motors/VSD as a standalone package, and kiln insulation / sealing as a separate national package.

## 2. Applicability Mapping

| candidate_id | classification | family_id | applicable_state_ids | excluded_state_ids | why excluded |
| --- | --- | --- | --- | --- | --- |
| `steel__crude_steel__bf_bof_background_drift` | autonomous efficiency track | `crude_steel` | `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__bf_bof_ccs_transition` | `steel__crude_steel__scrap_eaf`, `steel__crude_steel__h2_dri_electric` | EAF and H2-DRI-electric rows are already near-frontier route archetypes and their current year-to-year improvement is not cleanly separable from route-specific technology evolution. |
| `steel__crude_steel__bf_bof_bof_gas_recovery` | endogenous pure efficiency package | `crude_steel` | `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__bf_bof_ccs_transition` | `steel__crude_steel__scrap_eaf`, `steel__crude_steel__h2_dri_electric` | BOF gas recovery is specific to the BF-BOF steelmaking train. |
| `steel__crude_steel__scrap_eaf_scrap_preheating` | endogenous pure efficiency package | `crude_steel` | `steel__crude_steel__scrap_eaf` | `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__bf_bof_ccs_transition`, `steel__crude_steel__h2_dri_electric` | Cleanly applies to scrap-EAF melt shops only; the H2-DRI row is a mixed electric-finishing archetype with only minor scrap input and should remain state-embodied in v1. |
| `steel__crude_steel__advanced_process_control` | endogenous operational efficiency package | `crude_steel` | `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__bf_bof_ccs_transition`, `steel__crude_steel__scrap_eaf` | `steel__crude_steel__h2_dri_electric` | The H2-DRI-electric row already behaves like a future high-performance archetype; adding a generic controls wedge would likely double count. |
| `cement__cement_equivalent__background_kiln_grinding_drift` | autonomous efficiency track | `cement_equivalent` | `cement_clinker__cement_equivalent__conventional`, `cement_clinker__cement_equivalent__low_clinker_alt_fuels` | `cement_clinker__cement_equivalent__ccs_deep` | The CCS row already combines frontier process, fuel and capture changes, so clean attribution is not possible without a deeper decomposition. |
| `cement__cement_equivalent__grinding_system_upgrade` | endogenous pure efficiency package | `cement_equivalent` | `cement_clinker__cement_equivalent__conventional`, `cement_clinker__cement_equivalent__low_clinker_alt_fuels` | `cement_clinker__cement_equivalent__ccs_deep` | The CCS row already carries distinct electricity and capture interactions; keep v1 simple. |
| `cement__cement_equivalent__kiln_ai_process_optimisation` | endogenous operational efficiency package | `cement_equivalent` | `cement_clinker__cement_equivalent__conventional`, `cement_clinker__cement_equivalent__low_clinker_alt_fuels` | `cement_clinker__cement_equivalent__ccs_deep` | Same double-counting concern, plus CCS operation introduces a different optimisation problem than conventional kiln tuning. |

## 3. Candidate Register

### `steel__crude_steel__bf_bof_background_drift`

- `classification`: autonomous efficiency track
- `family_ids`: `crude_steel`
- `state_ids`: `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__bf_bof_ccs_transition`
- `affected_inputs`: `coal`, `natural_gas`, `electricity`
- `affected_cost_fields`: little to none as a separate line item; keep as exogenous performance drift rather than a new choice cost
- `affected_process_emissions`: none directly
- `suggested_years`: 2030, 2035, 2040, 2045, 2050
- `effect_size`: provisional authoring band of about `0.2%` to `0.4%` annual improvement on route-stable BF-BOF energy inputs, only after extracting equivalent implicit drift from the current state rows
- `cost_basis`: no separate package cost; this is an exogenous scenario assumption
- `rollout_limit_logic`: exogenous and state-wide once enabled
- `sources`:
  - IEA steel roadmap: process optimisation, monitoring and BAT matter, but state-of-the-art BF-BOF is already close to practical minimum
  - IEA heavy-industry efficiency note: process controls, AI, CDQ and TRT are the main remaining efficiency levers in steel, but route mix dominates aggregate intensity
  - CO2CRC / NSW report: Port Kembla already has implemented several major efficiency measures and is among the better-performing integrated plants
- `confidence`: Medium-Low
- `rationale`: A background track is conceptually justified, but current BF-BOF rows already fall by roughly `9%` from 2025 to 2050. The track should therefore be recorded only as a decomposition layer, not blindly added on top.

### `steel__crude_steel__bf_bof_bof_gas_recovery`

- `classification`: endogenous pure efficiency package
- `family_ids`: `crude_steel`
- `state_ids`: `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__bf_bof_ccs_transition`
- `affected_inputs`: primarily `coal` and `natural_gas` equivalents, with a possible secondary reduction in purchased `electricity` if recovered gas is used internally for steam/power
- `affected_cost_fields`: yes, through annualised retrofit capex and gas-recovery equipment cost
- `affected_process_emissions`: none directly
- `suggested_years`: all milestone years from 2030 onward; do not author as a 2025 baseline add-on
- `effect_size`: conservative authoring band of about `-0.4` to `-0.8 GJ/t_crude_steel` equivalent on BF-route energy inputs, or roughly a `0.96` to `0.98` multiplier on total direct energy inputs for affected BF states
- `cost_basis`: medium-to-high plant retrofit cost for gas capture, cleaning, storage and use integration
- `rollout_limit_logic`: only available on BF-BOF states; realistic rollout should be tied to a major outage / retrofit window and remain well below full family-wide activity in early years
- `sources`:
  - CO2CRC / NSW report: non-combustion BOF gas recovery can recover about `0.55` to `0.92 GJ/t_steel`; the report also states BOF gas at Port Kembla is currently flared
  - IEA steel roadmap: waste-heat recovery and gas recovery are legitimate BAT-style improvements within existing BF-BOF routes
- `confidence`: Medium
- `rationale`: This is the cleanest materially additional Australian steel package because it is route-preserving, current Port Kembla evidence says it is not yet fully utilised, and it can be represented as reduced purchased energy without changing ore, scrap or carrier family.

### `steel__crude_steel__scrap_eaf_scrap_preheating`

- `classification`: endogenous pure efficiency package
- `family_ids`: `crude_steel`
- `state_ids`: `steel__crude_steel__scrap_eaf`
- `affected_inputs`: `electricity` primarily
- `affected_cost_fields`: yes, modest-to-material annualised retrofit cost for tunnel / shaft / conveyor preheat systems and gas handling
- `affected_process_emissions`: none
- `suggested_years`: all milestone years, with more realistic adoption from 2030 onward
- `effect_size`: electricity multiplier of about `0.90` to `0.95` on `steel__crude_steel__scrap_eaf`, equivalent to roughly `0.03` to `0.06 MWh/t_crude_steel` reduction versus current state rows
- `cost_basis`: medium capex retrofit; site-specific economics depend on furnace layout and off-gas handling
- `rollout_limit_logic`: only applies to scrap EAF activity; adoption should be capped because not every EAF configuration can retrofit preheating cleanly and emissions-handling complexity matters
- `sources`:
  - ACEEE Consteel case study: around `10%` reduction in specific electrical energy, with literature support for roughly `38` to `65 kWh/t` savings
  - DOE AHSS bandwidth study: scrap preheating can reduce EAF energy use by up to `100 kWh/t` in strong cases, but v1 should use a much more conservative band
- `confidence`: Medium-Low
- `rationale`: This is a standard carrier-preserving EAF efficiency measure. It is smaller than the route gap between BF-BOF and scrap EAF and does not rely on changing scrap ratios or steel chemistry in the library.

### `steel__crude_steel__advanced_process_control`

- `classification`: endogenous operational efficiency package
- `family_ids`: `crude_steel`
- `state_ids`: `steel__crude_steel__bf_bof_conventional`, `steel__crude_steel__bf_bof_ccs_transition`, `steel__crude_steel__scrap_eaf`
- `affected_inputs`: route-dependent reductions in `coal`, `natural_gas` and `electricity`; do not change `iron_ore`, `scrap_steel`, `hydrogen` or `capture_service`
- `affected_cost_fields`: low-to-medium annualised software, sensors, analytics, training and recommissioning cost
- `affected_process_emissions`: none
- `suggested_years`: all milestone years
- `effect_size`: conservative total-input multiplier of about `0.97` to `0.99` on applicable rows
- `cost_basis`: low capex / service-contract / controls upgrade style cost
- `rollout_limit_logic`: can scale faster than heavy equipment retrofits, but persistence depends on ongoing management quality and maintenance discipline
- `sources`:
  - IEA heavy-industry efficiency note: better controls, monitoring, AI and energy-management systems are standard efficiency levers for steel plants
  - IEA steel roadmap: predictive process control and monitoring are part of operational efficiency improvements to existing equipment
  - CO2CRC / NSW report: efficiency pathway for Port Kembla still relies on improved operation and BAT adoption even though major route change dominates long-run decarbonisation
- `confidence`: Medium-Low
- `rationale`: The literature supports an operational wedge, but the Australian integrated plant is already relatively efficient, so the package should stay small and clearly below the gains from route change.

### `steel__crude_steel__route_shift_and_ccs_bundle`

- `classification`: embodied in pathway state
- `family_ids`: `crude_steel`
- `state_ids`: `steel__crude_steel__scrap_eaf`, `steel__crude_steel__h2_dri_electric`, `steel__crude_steel__bf_bof_ccs_transition`
- `affected_inputs`: yes; route changes alter `iron_ore`, `coal`, `natural_gas`, `electricity`, `hydrogen`, `scrap_steel` and `capture_service`
- `affected_cost_fields`: yes
- `affected_process_emissions`: yes
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in existing state rows rather than package form
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in state availability and `max_share`
- `sources`:
  - current `crude_steel` family-state definitions
  - IEA steel roadmap on route-specific energy and emissions structure
- `confidence`: High
- `rationale`: The big energy and emissions changes come from route change and CCS, not portable efficiency. Scrap-ratio changes and H2-DRI are not separable overlays.

### `cement__cement_equivalent__background_kiln_grinding_drift`

- `classification`: autonomous efficiency track
- `family_ids`: `cement_equivalent`
- `state_ids`: `cement_clinker__cement_equivalent__conventional`, `cement_clinker__cement_equivalent__low_clinker_alt_fuels`
- `affected_inputs`: `electricity` plus route-stable thermal fuel inputs
- `affected_cost_fields`: negligible as a separate line item; keep as exogenous drift
- `affected_process_emissions`: none
- `suggested_years`: 2030, 2035, 2040, 2045, 2050
- `effect_size`: provisional authoring band of about `0.2%` to `0.4%` annual improvement on residual thermal and electrical intensity, only after removing equivalent implicit drift from the current state table
- `cost_basis`: no separate package cost because this is an exogenous scenario assumption
- `rollout_limit_logic`: exogenous and state-wide once enabled
- `sources`:
  - CIF pathway: Australian clinker thermal demand falls from about `3,445` to `3,345 MJ/t_clinker` by 2050, with electricity from about `100` to `90 kWh/t_cement`
  - CIF also says Australian kilns are already highly efficient, so future autonomous drift should remain modest
- `confidence`: Medium-Low
- `rationale`: The concept is valid, but current rows already contain some efficiency drift and substantial composition/fuel change. Use this only as a decomposition aid once rows are cleaned up.

### `cement__cement_equivalent__grinding_system_upgrade`

- `classification`: endogenous pure efficiency package
- `family_ids`: `cement_equivalent`
- `state_ids`: `cement_clinker__cement_equivalent__conventional`, `cement_clinker__cement_equivalent__low_clinker_alt_fuels`
- `affected_inputs`: `electricity` only
- `affected_cost_fields`: yes, modest-to-material annualised mill-upgrade capex
- `affected_process_emissions`: none
- `suggested_years`: all milestone years, strongest from 2030 onward
- `effect_size`: electricity multiplier of about `0.93` to `0.97`, equivalent to roughly `3` to `7 kWh/t_cement_equivalent`
- `cost_basis`: medium capex for VRM / HPGR / classifier and associated plant modifications
- `rollout_limit_logic`: tied to mill replacement or major refurbishment cycles, so uptake should be materially slower than software-only optimisation
- `sources`:
  - CIF pathway: `42%` of plant electricity is used in cement grinding; future Australian electricity demand assumes HPGR and VRM adoption replacing less efficient ball mills
  - IEA heavy-industry efficiency note: grinding technology upgrades are the main route to lower electricity intensity in cement
- `confidence`: Medium
- `rationale`: This is the cleanest cement pure-efficiency overlay because it is electricity-only, carrier-preserving and does not touch clinker factor or fuel switching.

### `cement__cement_equivalent__kiln_ai_process_optimisation`

- `classification`: endogenous operational efficiency package
- `family_ids`: `cement_equivalent`
- `state_ids`: `cement_clinker__cement_equivalent__conventional`, `cement_clinker__cement_equivalent__low_clinker_alt_fuels`
- `affected_inputs`: thermal fuels plus a small `electricity` effect
- `affected_cost_fields`: low-to-medium annualised controls / sensors / commissioning / analytics cost
- `affected_process_emissions`: none
- `suggested_years`: all milestone years
- `effect_size`: thermal-fuel multiplier of about `0.96` to `0.99` plus electricity multiplier of about `0.98` to `0.99`; if v1 only supports a single blended row factor, keep it near `0.97` to `0.99`
- `cost_basis`: low capex and operational-service style spend
- `rollout_limit_logic`: faster than heavy mill replacement, but savings persistence depends on continued operation, data quality and maintenance
- `sources`:
  - CIF pathway section 6.4.2: AI, smart sensors and predictive control can stabilise kiln and grinding operation and reduce specific energy demand
  - CIF innovation areas: advanced control, IoT and smart manufacturing are priority efficiency levers even in already efficient Australian cement plants
- `confidence`: Medium
- `rationale`: This is the strongest cement operational package candidate. It preserves route and carrier while giving a realistic, modest savings wedge.

### `cement__cement_equivalent__composition_fuel_switch_and_ccs_bundle`

- `classification`: embodied in pathway state
- `family_ids`: `cement_equivalent`
- `state_ids`: `cement_clinker__cement_equivalent__low_clinker_alt_fuels`, `cement_clinker__cement_equivalent__ccs_deep`
- `affected_inputs`: yes; these states change clinker factor, fuel mix, and in the CCS case add `capture_service`
- `affected_cost_fields`: yes
- `affected_process_emissions`: yes, materially
- `suggested_years`: all milestone years
- `effect_size`: keep embodied in existing state rows rather than package form
- `cost_basis`: already represented in state-specific `output_cost_per_unit`
- `rollout_limit_logic`: already represented in state availability and `max_share`
- `sources`:
  - current `cement_equivalent` family-state definitions
  - CIF pathway on clinker-efficient cements, fuel substitution and CCS
- `confidence`: High
- `rationale`: Clinker-factor reduction is product-composition change, alternative fuels are fuel switching, and CCS is non-efficiency abatement. None should be re-labeled as portable efficiency.

## 4. Rejected Or Deferred Items

### `steel__crude_steel__waste_heat_recovery_broad_bundle`

- `reason_code`: `requires_interaction_engine`
- `explanation`: As a single package, this candidate improperly mixes BOF gas recovery, sinter-cooler recovery, hot-stove recovery, coke-oven recovery, plant power-generation changes and existing TRT-type measures. Baseline status and offset destination differ by submeasure. Only the narrow BOF gas-recovery subset is clean enough for v1.
- `if_deferred`: would need explicit steel-mill-gas, steam and internal-power submodules or a process-chain steel family.

### `steel__crude_steel__top_pressure_recovery_turbine`

- `reason_code`: `not_material_for_v1`
- `explanation`: The CO2CRC report says Port Kembla installed a top-gas recovery turbine in 1981. That makes TRT part of current Australian baseline practice rather than a credible new optional package for the national crude-steel family.

### `steel__crude_steel__coke_dry_quenching`

- `reason_code`: `not_material_for_v1`
- `explanation`: CDQ is route-preserving and real, but the Australia-scale opportunity is effectively one integrated plant and the cited payback is very long in low-power-price contexts. It is too site-specific and capex-heavy for a simple national v1 package.
- `if_deferred`: revisit if the library later supports facility-specific Port Kembla / Whyalla style states or explicit coke-making modules.

### `steel__crude_steel__pulverised_coal_injection_optimisation`

- `reason_code`: `requires_interaction_engine`
- `explanation`: PCI mainly changes the internal coke-versus-injected-coal balance of the blast furnace. The current reduced-form family does not separately model coke ovens, hot metal or PCI, and Port Kembla already operates PCI, so clean additional attribution is not possible.
- `if_deferred`: would need explicit BF-coke-hot-metal process representation.

### `steel__crude_steel__efficient_motors_and_vsds`

- `reason_code`: `not_material_for_v1`
- `explanation`: Auxiliary motor savings are real but small at crude-steel family scale, and both DCCEEW generic evidence and CO2CRC Port Kembla context suggest much of this is already mature practice. Fold any residual into autonomous drift, not a standalone package.

### `steel__crude_steel__hot_charging_and_direct_rolling`

- `reason_code`: `not_material_for_v1`
- `explanation`: This is mostly a reheating / hot-rolling efficiency measure. The current `crude_steel` family output is one tonne of crude steel at plant gate, so hot charging and direct rolling sit outside the present family boundary.
- `if_deferred`: revisit only if crude steel is split from downstream rolling families or if a separate hot-rolling family is added.

### `steel__crude_steel__scrap_ratio_change`

- `reason_code`: `embodied_route_change`
- `explanation`: Scrap-ratio change is not pure efficiency. It changes the material basis and route and is already represented by the `steel__crude_steel__scrap_eaf` state.

### `cement__cement_equivalent__kiln_heat_recovery_power_generation`

- `reason_code`: `not_material_for_v1`
- `explanation`: CIF explicitly says waste heat in Australian cement production is already used to the highest degree possible, remaining waste heat is below `100°C`, and waste-heat power generation is generally neither economical nor efficient in Australia with a stable grid except in special cases.

### `cement__cement_equivalent__motor_vsd_package`

- `reason_code`: `not_material_for_v1`
- `explanation`: CIF says modern motors and drives are already implemented in most stages of production. The remaining upside is better treated as part of background drift or general plant optimisation, not as a separate national package.

### `cement__cement_equivalent__kiln_insulation_and_sealing`

- `reason_code`: `not_material_for_v1`
- `explanation`: This is a real housekeeping measure, but Australian kilns are already highly efficient precalciner systems. The residual gain is too small and too plant-specific to deserve its own family-level package in v1.

### `cement__cement_equivalent__clinker_factor_reduction`

- `reason_code`: `embodied_route_change`
- `explanation`: Clinker-factor reduction changes product composition. It belongs in `low_clinker_alt_fuels` and `ccs_deep`, not in a portable efficiency layer.

### `cement__cement_equivalent__alternative_fuel_substitution`

- `reason_code`: `embodied_route_change`
- `explanation`: Alternative fuels are fuel switching, not carrier-preserving input reduction. They remain embodied in the pathway states.

### `cement__cement_equivalent__ccs`

- `reason_code`: `non_efficiency_abatement`
- `explanation`: CCS is important but it is not efficiency. It should remain a pathway-state feature and later a dedicated non-efficiency abatement treatment if needed.

## 5. Draft Authoring Guidance

### Proposed ids

- Steel autonomous track: `steel__crude_steel__bf_bof_background_drift`
- Steel pure packages:
  - `steel__crude_steel__bf_bof_bof_gas_recovery`
  - `steel__crude_steel__scrap_eaf_scrap_preheating`
- Steel operational package: `steel__crude_steel__advanced_process_control`
- Cement autonomous track: `cement__cement_equivalent__background_kiln_grinding_drift`
- Cement pure package: `cement__cement_equivalent__grinding_system_upgrade`
- Cement operational package: `cement__cement_equivalent__kiln_ai_process_optimisation`

### Likely authoring fields

#### `autonomous_efficiency_tracks.csv`

- `track_id`
- `family_id`
- `state_ids`
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
- `interaction_family`
- `source_ids_or_notes`
- `confidence`

### Suggested `README.md` notes

- `crude_steel` README should explicitly say that the major intensity gap between BF-BOF, scrap EAF and H2-DRI-electric is route change, not portable efficiency.
- `crude_steel` README should note that v1 portable efficiency is intentionally narrow: BOF gas recovery, scrap preheating and small control improvements only.
- `crude_steel` README should also say that reheating / direct rolling measures are outside the current crude-steel family boundary.
- `cement_equivalent` README should explicitly distinguish:
  - portable grinding and control efficiency,
  - from clinker-factor reduction,
  - alternative-fuel substitution,
  - and CCS.
- `cement_equivalent` README should note that CIF considers Australian kilns already highly efficient, so accepted portable packages are deliberately modest.
- Both READMEs should say that autonomous tracks must not be layered on top of existing state-row drift without first extracting the same drift from the base rows.

### Suggested `validation.md` checks

- With autonomous tracks and packages turned off, 2025 incumbent rows must still reproduce the current baseline anchors.
- No accepted steel efficiency package should alter `iron_ore`, `scrap_steel`, `hydrogen` or `capture_service`.
- No accepted cement efficiency package should alter process-emissions coefficients or implicitly recreate clinker-factor change.
- `steel__crude_steel__bf_bof_bof_gas_recovery` must only apply to BF-BOF states.
- `steel__crude_steel__scrap_eaf_scrap_preheating` must only apply to `steel__crude_steel__scrap_eaf`.
- No accepted steel package should apply to `steel__crude_steel__h2_dri_electric` in v1.
- `cement__cement_equivalent__grinding_system_upgrade` should affect electricity only and stay within roughly `3` to `7 kWh/t_cement_equivalent`.
- `cement__cement_equivalent__kiln_ai_process_optimisation` should stay materially below the full CIF pathway improvement band so it does not silently absorb composition and fuel-switch effects.
- Until explicit interaction handling exists, steel packages should share a common no-stacking or interaction family, and cement packages should do the same.

## 6. Open Questions

1. Will efficiency authoring support commodity-specific multipliers within a state row, or only a single blended multiplier? Steel BOF gas recovery and cement kiln-control packages are much cleaner if `coal` / `gas` / `electricity` can be adjusted separately.
2. Is the planned autonomous-efficiency implementation going to de-embed current row-level drift before tracks are authored? Both `crude_steel` and `cement_equivalent` already contain non-trivial implicit improvement over time.
3. Is `crude_steel` permanently defined at plant-gate crude steel, excluding rolling and reheating? If yes, hot charging / direct rolling should remain out of scope permanently rather than linger as a deferred steel-family efficiency option.

## Sources Consulted

1. Cement Industry Federation, *Decarbonisation Pathways for the Australian Cement and Concrete Sector*: <https://cement.org.au/wp-content/uploads/2021/11/Full_Report_Decarbonisation_Pathways_web_single_page.pdf>
2. IEA, *Driving Energy Efficiency in Heavy Industries*: <https://www.iea.org/articles/driving-energy-efficiency-in-heavy-industries>
3. IEA, *Iron and Steel Technology Roadmap*: <https://www.iea.org/reports/iron-and-steel-technology-roadmap>
4. CO2CRC / NSW Resources, *Reduction of Greenhouse Gas Emissions in Steel Production*: <https://www.resources.nsw.gov.au/sites/default/files/2022-11/report-reduction-of-ghg-emissions-in-steel-industries.pdf>
5. DCCEEW, *Motors and variable speed drives*: <https://www.energy.gov.au/business/equipment-guides/motors-and-variable-speed-drives>
6. ACEEE, *Innovative Energy Conservation through Scrap Pre-heating in an Electric Arc Furnace*: <https://www.aceee.org/files/proceedings/2013/data/papers/1_175.pdf>
7. Climate Change Authority, *Sector Pathways Review 2024*: <https://www.climatechangeauthority.gov.au/sites/default/files/documents/2024-09/2024SectorPathwaysReview.pdf>

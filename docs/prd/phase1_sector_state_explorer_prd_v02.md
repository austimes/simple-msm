# PRD / Technical Specification — Australia Phase 1 Sector State Explorer

Version: 0.2  
Date: 2026-04-07  
Status: revised after demand-path clarification  
Primary input package: `aus_phase1_sector_state_library.zip`

## 1. Product summary

Build a **small stand-alone web application** that turns the Australia Phase 1 sector-state library into a fast, inspectable reduced-form configuration explorer.

The app must let a user:

1. inspect every sector state and understand its cost basis, input coefficients, emissions, limits, confidence, evidence summary, derivation method, review notes, and expansion path,
2. define configurations ranging from **fully exogenous** state picks to **mixed** and **fully endogenous** allocation across one or more sectors,
3. set **commodity prices** with sane editable defaults,
4. set a **carbon price**,
5. run a **generalized solver** that works from the sector-state data rather than sector-specific hard-coded logic,
6. compare configurations and explain the drivers of change in emissions, fuel demand, electrification, fuel switching, process abatement, removals, and cost.

The application must be **completely standalone from VedaLang/Vita**.

## 2. Confirmed decisions

The following decisions are now locked into this spec.

### 2.1 Full endogenous meaning

“Full endogenous” means **endogenous allocation of activity across sector states while service demand remains exogenous**.

The solver chooses activity levels for eligible states subject to demand balance, share bounds, activity caps, and other generic constraints.

### 2.2 Built-in demand growth behavior

The app will ship with a **simple built-in growth preset by sector/service**.

That means a configuration can start from 2025 anchor activity levels and automatically materialize milestone-year demand paths through app-owned growth presets.

These presets are convenience defaults only. They are not part of the research library evidence and must be clearly labeled as such.

### 2.3 Artifact discipline

This revised spec is grounded in the files that are actually present in the current zip, not the larger README-described repository structure.

## 3. Inputs the app must consume

## 3.1 Mandatory current-package inputs

The app must work with the files that are physically present now:

| File | Mandatory use |
|---|---|
| `data/sector_states.csv` | Core state-year rows used by explorer, configuration workspace, and solver |
| `README.md` | High-level methods/about/trust page |
| `docs/phase2_recommendations.md` | Caveats, maturity notes, and expansion-path page |

## 3.2 Optional enrichment inputs

The README references additional ledgers and notes that are not physically present in the current zip snapshot. The app may support them later, but **must not require them** in v1.

Optional future enrichments:

- `data/sector_states_schema.json`
- `data/source_ledger.csv`
- `data/assumptions_ledger.csv`
- `data/calibration_summary.csv`
- `data/uncertainty_summary.csv`
- `data/commodity_taxonomy.csv`
- `docs/methods_overview.md`
- `docs/sector_derivations/*`
- `docs/calibration_validation.md`
- `docs/uncertainty_confidence.md`

## 3.3 Consequence for v1 trust features

Because the current zip does not include separate source and assumption ledgers, v1 trust/explainer features must rely primarily on fields embedded in `sector_states.csv`:

- `source_ids`
- `assumption_ids`
- `evidence_summary`
- `derivation_method`
- `confidence_rating`
- `review_notes`
- `candidate_expansion_pathway`
- `times_or_vedalang_mapping_notes`
- `rollout_limit_notes`
- `availability_conditions`

If the optional ledgers are added later, the app should enrich the same views automatically.

## 4. Product goal

Create the smallest useful app that makes the Phase 1 library:

- runnable,
- reviewable,
- explainable,
- and easy to iterate.

It is not a dispatch model, not a TIMES clone, and not a facility-level industry model. It is a **fast configuration workbench** for the reduced-form Phase 1 library.

## 5. Users

### 5.1 Analyst / modeler

Wants to build configurations quickly, switch sectors between exogenous and endogenous handling, and inspect fuel, cost, and emissions effects.

### 5.2 Technical reviewer

Wants to click into every state and inspect evidence, assumptions, confidence, constraints, and upgrade-path notes.

### 5.3 Sponsor / decision-maker

Wants simple side-by-side configuration compare views and plain-language explanations of what changed.

## 6. Core modeling conventions

### 6.1 Cost boundary

`output_cost_per_unit` is primarily a **real-2024 non-commodity conversion cost**.

The app must therefore compute **fully loaded state cost** at runtime as:

`conversion cost + explicit commodity purchases + carbon-cost effect + optional soft-constraint penalties`

Removals are the main exception because the library treats those costs more like full marginal supply costs.

### 6.2 Emissions boundary

For end-use sectors, `energy_emissions_by_pollutant` contains **direct on-site emissions only**.

Electricity-related emissions are represented in the electricity supply states and must not be double counted.

### 6.3 What is numerically enforceable in the current CSV

The current CSV provides machine-usable numeric bound fields:

- `max_share`
- `min_share`
- `max_activity`

It also provides text fields that are important for interpretation but are **not directly numeric**:

- `rollout_limit_notes`
- `availability_conditions`

The v1 solver must enforce the numeric fields directly and display the text fields prominently.

### 6.4 Uptake-rate treatment in v1

The current CSV does **not** contain a numeric annual uptake-rate column.

To satisfy the need for simple rollout / uptake logic, the app will implement a generic app-level proxy:

- optional **maximum share change per milestone period** for optimized services.

This is a simple cross-year smoothing / rollout constraint, not a claim that the library itself contains a measured uptake-rate value.

### 6.5 Library-driven, not sector-coded

The solver must be generic. It should operate on normalized rows and app-owned role metadata, not on one-off code paths for buildings vs transport vs steel.

The only app-owned metadata outside the library should be:

- output role classification,
- display labels and grouping,
- baseline activity anchors,
- demand-growth presets,
- commodity price presets,
- optional explanation-tag rules.

## 7. Scope

## 7.1 Must-have

- Run fully pinned, mixed, and optimized state-allocation configurations.
- Support carbon price and editable commodity prices.
- Support endogenous or externalized electricity.
- Support optional removals, fixed removal targets, and endogenous removals.
- Show emissions, fuel demand, electricity demand/supply, costs, and state shares.
- Show evidence, confidence, review notes, and expansion notes for every state.
- Explain deltas in terms of electrification, efficiency, fuel switching, hydrogen, CCS, clinker reduction, scrap-EAF shift, removals, and constraints.

## 7.2 Nice-to-have

- Save/load configuration document JSON.
- Shareable HTML or Markdown report.
- Soft-constraint mode for infeasibility diagnosis.
- Automatic enrichment if missing companion ledgers are added later.

## 7.3 Non-goals

- Intra-year temporal modeling
- Dispatch or unit commitment
- Network and transmission modeling
- Endogenous capacity vintaging
- Facility-level industrial process modeling
- Refinery/petrochemical chains
- Demand elasticity or macro feedback
- VedaLang/Vita integration

## 8. Output roles

The raw library does not contain a role field, so the app must ship with a small config that classifies outputs into roles.

### 8.1 Required service/output

Demand must be met exactly.

Use this role for:

- `residential_building_services`
- `commercial_building_services`
- `passenger_road_transport`
- `freight_road_transport`
- `low_temperature_heat`
- `medium_temperature_heat`
- `high_temperature_heat`
- `crude_steel`
- `cement_equivalent`
- `livestock_output_bundle`
- `cropping_horticulture_output_bundle`

### 8.2 Endogenous supply commodity

Provides an intermediate commodity used by other sectors.

Use this role for:

- `electricity`

### 8.3 Optional supply / optional removals

Can be off, targeted, or endogenous up to limits.

Use this role for:

- `land_sequestration`
- `engineered_removals`

## 9. Data normalization requirements

The loader must normalize the CSV into internal tables.

### 9.1 Parse JSON-array columns

The following columns are JSON-encoded strings in the CSV and must be parsed:

- `input_commodities`
- `input_coefficients`
- `input_units`
- `energy_emissions_by_pollutant`
- `process_emissions_by_pollutant`
- `source_ids`
- `assumption_ids`

### 9.2 Recommended internal tables

- `states`
- `state_inputs`
- `state_emissions`
- `state_source_refs`
- `state_assumption_refs`
- `docs`

If optional ledgers are later supplied, add:

- `sources`
- `assumptions`
- `calibration_items`
- `uncertainty_items`

### 9.3 Canonical commodity units

| Commodity | Canonical unit |
|---|---|
| electricity | MWh |
| natural_gas | GJ |
| coal | GJ |
| refined_liquid_fuels | GJ |
| hydrogen | GJ |
| biomass | GJ |
| scrap_steel | t |
| iron_ore | t |
| sequestration_service | tCO2 stored |

### 9.4 Required unit conversions

- electricity: `GJ -> MWh` using `1 MWh = 3.6 GJ`
- fuel inputs already in `GJ/...`
- materials already in `t/...`
- sequestration service in `tCO2 stored/...`

The solver must always operate on normalized coefficients.

## 10. App-owned configuration files

These files are part of the web app, not part of the research library proper.

### 10.1 `app_config/output_roles.json`

Maps each service/output to:

- role,
- display group,
- whether it participates in commodity balance,
- whether demand is required.

### 10.2 `app_config/baseline_activity_anchors.json`

Contains the 2025 anchor values used for fast configuration setup.

Recommended anchors, derived from the existing package:

| Output/service | 2025 default | Unit |
|---|---:|---|
| residential_building_services | 477,000,000 | GJ_service_eq |
| commercial_building_services | 314,000,000 | GJ_service_eq |
| passenger_road_transport | 293,414,730,000 | pkm |
| freight_road_transport | 249,000,000,000 | tkm |
| low_temperature_heat | 120,000,000 | GJ_useful_heat |
| medium_temperature_heat | 140,000,000 | GJ_useful_heat |
| high_temperature_heat | 170,000,000 | GJ_useful_heat |
| crude_steel | 5,700,000 | t_crude_steel |
| cement_equivalent | 9,600,000 | t_cement_equivalent |
| livestock_output_bundle | 31,134.94 | A$m_output_2024 |
| cropping_horticulture_output_bundle | 36,576.29 | A$m_output_2024 |
| electricity residual external demand | 144,018,720 | MWh |

### 10.3 `app_config/demand_growth_presets.json`

This is the key change from the earlier draft.

The app will ship with built-in growth presets keyed by service/output. The presets must be clearly labeled as **app defaults**, not research-library evidence.

Recommended presets:

| Preset | Residential buildings | Commercial buildings | Passenger road | Freight road | Low/med heat | High heat | Steel | Cement | Agriculture bundles | Residual electricity |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `flat_2025` | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.0–0.0% | 0.0% |
| `simple_sector_growth_low` | 0.2% | 0.4% | 0.3% | 0.7% | 0.1% | 0.0% | 0.0% | 0.0% | 0.0–0.1% | 0.0% |
| `simple_sector_growth_central` | 0.6% | 0.9% | 0.8% | 1.2% | 0.5% | 0.4% | 0.4% | 0.3% | 0.2–0.3% | 0.2% |
| `simple_sector_growth_high` | 1.0% | 1.4% | 1.2% | 1.7% | 0.9% | 0.8% | 0.8% | 0.7% | 0.5–0.6% | 0.5% |

### 10.4 `app_config/commodity_price_presets.json`

Must include at least:

- `central_placeholder_2024aud`
- `fossil_shock`
- `cheap_clean_energy`

These presets must also be labeled as app-owned defaults.

## 11. Configuration document JSON design

The configuration document JSON should capture both:

1. the **resolved tables** actually used by the solver, and
2. the **generation metadata** used by the UI to rebuild those tables.

That keeps runs reproducible while still letting the UI feel high-level.

### 11.1 Top-level configuration document components

- years
- service controls
- resolved service demands
- demand-generation metadata
- resolved external commodity demands
- commodity pricing
- carbon price
- solver options

### 11.2 Service control modes

| Mode | Meaning |
|---|---|
| `pinned_single` | One state family supplies 100% of the service |
| `fixed_shares` | User provides a fixed share mix across states |
| `optimize` | Solver allocates activity endogenously |
| `externalized` | Relevant mainly to supply commodities such as electricity; use external price rather than endogenous supply states |
| `off` | Used for optional outputs such as removals |
| `target` | Used for optional outputs when the user specifies a removal target |

### 11.3 Demand generation block

The configuration document should keep a `demand_generation` block with:

- `mode`: manual table or anchor-plus-preset,
- `anchor_year`: 2025,
- `preset_id`,
- `service_anchors`,
- `service_growth_rates_pct_per_year`,
- optional external-commodity anchors and growth rates,
- optional year overrides.

The actual solver still consumes the resolved `service_demands` and `external_commodity_demands` tables.

## 12. Functional requirements

## 12.1 Library explorer

The app must provide a searchable, filterable state explorer.

### Required filters

- sector
- subsector
- service/output
- year
- confidence rating
- region
- state family / label
- source ID
- assumption ID

### Required list columns

- year
- sector
- subsector
- state label
- confidence
- output unit
- output cost per unit
- direct energy emissions
- process emissions
- max share
- max activity

### State detail drawer/page must show

- state label and description
- sector / subsector / service / year
- output cost and cost basis
- input commodity table
- emissions split table
- max/min share and max activity
- rollout limit notes
- availability conditions
- evidence summary
- derivation method
- confidence rating
- review notes
- candidate expansion pathway
- TIMES/VedaLang mapping notes
- raw source IDs and assumption IDs

If optional ledgers are later present, enrich these raw IDs into richer detail rows.

### Required reference-delta panel

For a selected year/service, show the selected state versus a default incumbent/reference state:

- conversion-cost delta
- input deltas by commodity
- direct energy-emissions delta
- process-emissions delta
- max-share delta
- confidence comparison

## 12.2 Configuration workspace

The configuration workspace is the heart of the app.

### Global controls

- milestone years
- commodity price preset and edits
- carbon-price path
- demand-growth preset selector
- electricity mode
- removals mode
- global rollout/uptake proxy toggle

### Per-service row controls

Each required service/output row must allow:

- control-mode selection,
- pinned-state selection if applicable,
- fixed-share editor if applicable,
- enable/disable state families,
- year-specific overrides,
- visibility of max-share trajectories,
- quick link to state details,
- demand anchor and growth-rate display.

### Demand editing modes

The UI must support both:

1. **Anchor + preset mode**
   - choose a preset,
   - edit 2025 anchors if desired,
   - optionally override service-specific growth rates,
   - auto-materialize milestone-year values.

2. **Manual table mode**
   - edit milestone-year demand values directly.

### Electricity mode

Electricity must be switchable between:

- **endogenous supply** using electricity sector states and balance constraints,
- **externalized price mode** using a user-entered electricity price and no endogenous electricity-supply solve.

### Removals mode

Removals must support:

- off,
- fixed target,
- endogenous optimization up to bounds.

## 12.3 Results explorer

The app must show at minimum:

### Overview KPIs

- total system cost
- gross direct emissions
- net emissions after removals
- carbon payments / credits
- electricity supplied
- average electricity cost
- average electricity emissions intensity
- commodity demand by commodity
- activity by sector/service

### Charts

- state-share stacked bars/area by service over time
- emissions by sector over time
- gross vs net emissions over time
- commodity demand by commodity over time
- electricity supply mix over time
- cost decomposition over time
- constraint saturation chart
- frontier chart: fully loaded cost vs direct emissions for any service/year
- configuration A vs B waterfall for emissions, fuel, and cost

### Tables

- activity by state and year
- commodity balance by year
- sector/service summary by year
- constraint report
- state ranking by fully loaded cost for a selected service/year
- “why not chosen” alternatives table

## 12.4 Explainability engine

Explainability is a first-class requirement.

### State-level explanations must answer

- what changed relative to the incumbent/reference,
- why the state is cheaper or more expensive,
- why emissions are lower or higher,
- which fuels/materials changed,
- what makes the state high/medium/low/exploratory confidence,
- what main assumptions are visible in the row,
- what upgrade path is implied.

### Configuration-level explanations must answer

- which states were chosen,
- which constraints were binding,
- which sectors drove emissions change,
- which sectors drove electricity demand change,
- which sectors drove fuel switching,
- which sectors rely on low-confidence or exploratory states.

### Required explanation tags

The app should infer these using simple coefficient-delta and metadata rules:

- electrification
- efficiency improvement
- fossil-to-gas switch
- fossil-to-biomass switch
- fossil-to-hydrogen switch
- CCS / sequestration
- clinker reduction / material substitution
- scrap-EAF shift
- removals
- incumbent lock-in
- rollout cap binding
- exploratory dependence

## 12.5 Methods / trust page

Because the current zip is light, v1 Methods/Trust should be based on:

- `README.md`
- `docs/phase2_recommendations.md`
- embedded state-level evidence fields from `sector_states.csv`

Recommended tabs:

- About this library
- Modeling conventions
- Phase 2 caveats
- Confidence distribution
- State evidence browser

If richer docs are later added, the same page can expand.

## 12.6 Compare mode

A user must be able to compare two saved configurations side-by-side.

Required outputs:

- KPI deltas
- emissions delta by sector/year
- commodity-demand delta by commodity/year
- electricity demand and supply delta
- state-share delta
- cost-decomposition delta
- confidence-exposure delta
- generated narrative summary

## 12.7 Export / import

The app must support:

- export configuration document as JSON,
- import configuration document JSON,
- export core results as CSV,
- export compare results as CSV,
- export a Markdown or HTML summary report.

## 13. Generalized solver specification

The core solve should be linear and transparent.

## 13.1 Decision variables

For each year `y` and state row `s` that is eligible in that year, define:

- `x[s,y]` = activity supplied by that state in that year, in the state output unit.

Optional soft-constraint slack variables may be added if `soft_constraints = true`.

## 13.2 Demand-balance constraints

For each required service/output `r` and year `y`:

`sum(x[s,y] for s in states_of(r,y)) = demand[r,y]`

with additional constraints for pinned or fixed-share modes.

## 13.3 Electricity balance

If electricity is endogenous, for each year `y`:

`electricity_supply_from_grid_states[y] = direct_electricity_inputs_from_all_non_electricity_states[y] + external_commodity_demand[electricity,y]`

If electricity is externalized, the electricity-sector states are bypassed and electricity purchases are priced exogenously.

## 13.4 Optional removals

For optional removals outputs:

- `off`: activity fixed to zero,
- `target`: activity must meet the target,
- `optimize`: activity can enter the solution up to bounds.

## 13.5 State-share and activity bounds

For any state with numeric fields available:

- `x[s,y] <= max_share[s,y] * demand[service(s),y]`
- `x[s,y] >= min_share[s,y] * demand[service(s),y]`
- `x[s,y] <= max_activity[s,y]`

where relevant and non-null.

## 13.6 User control constraints

### Pinned single state

For selected service `r`:

- chosen state gets full activity,
- all other states for `r` are zero.

### Fixed shares

For selected service `r`:

- `x[s,y] = share[s,y] * demand[r,y]` for each state in the fixed mix.

### Optimize

Solver chooses `x[s,y]` subject to bounds and disabled-state filters.

## 13.7 Rollout / uptake proxy

If share smoothing is enabled, the solver applies a generic cross-year cap on share movement for optimized services.

For each state family `f` and adjacent milestone years:

`share[f,y] - share[f,y_prev] <= max_delta_pp`

and

`share[f,y_prev] - share[f,y] <= max_delta_pp`

This is the app’s simple uptake-rate proxy.

## 13.8 Objective function

Minimize, by year and summed across years:

`conversion_cost + commodity_purchase_cost + carbon_cost - eligible_removals_credit + soft_penalties`

Where:

- `conversion_cost = x * output_cost_per_unit`
- `commodity_purchase_cost = x * input_coefficient * commodity_price`
- `carbon_cost = carbon_price * gross_direct_emissions`
- `eligible_removals_credit` applies only if removals crediting is enabled

Confidence ratings are not part of the base objective. They are displayed and reported, not optimized unless a later build adds an explicit confidence penalty option.

## 13.9 Infeasibility handling

If the model is infeasible, the app must report:

- which service/year failed,
- whether the cause is pinned/fixed-share conflict, max-share exhaustion, max-activity exhaustion, disabled states, or electricity balance conflict,
- which user edits would restore feasibility.

## 14. Explainability and attribution logic

The app must provide both deterministic diagnostics and plain-language narratives.

## 14.1 State-choice attribution

For each optimized service/year, compute and show:

- chosen share by state,
- marginal cost ordering,
- which bounds bind,
- which non-chosen states were dominated on cost/emissions,
- which non-chosen states were blocked by caps or user filters.

## 14.2 Configuration-delta attribution

For configuration A vs B, attribute changes to:

- service-demand growth,
- state-choice change,
- commodity-price change,
- carbon-price change,
- electricity-mode change,
- removals activation,
- constraint / rollout effects.

A simple decomposition is acceptable. It does not need to be a perfect Shapley analysis.

## 15. UX / information architecture

Recommended top-level navigation:

1. **Run**
2. **Results**
3. **Compare**
4. **Library**
5. **Methods**

### 15.1 Run page

- left sidebar: years, demand preset, commodity-price preset, carbon price, global toggles
- main table: one row per service/output family
- right panel: configuration summary, warnings, confidence exposure

### 15.2 Results tabs

- Overview
- State Mix
- Fuels / Commodities
- Emissions
- Costs
- Constraints
- Confidence
- Explanations

### 15.3 Library page

- filter pane
- table/list of states
- detail drawer
- related-docs panel

### 15.4 Methods page

- About the library
- Modeling conventions
- Growth presets and anchors
- Confidence overview
- Phase 2 memo

## 16. Technical architecture recommendation

## 16.1 Preferred stack

- **Frontend:** React + TypeScript + Vite
- **State management:** Zustand or Redux Toolkit
- **Data tables:** TanStack Table
- **Charts:** ECharts or Plotly
- **Markdown rendering:** react-markdown
- **Solver:** JavaScript/TypeScript LP package in-browser for small runs, or a tiny server-side Python/Node solver wrapper if preferred for reliability
- **Persistence:** browser local storage first, file import/export second

## 16.2 Solver implementation note

Given the problem size, either of these is fine:

- in-browser LP for a fully static app,
- or a minimal backend exposing `/solve` and `/explain`.

The key requirement is transparency, not architectural purity.

## 17. Acceptance criteria

The build is acceptable only if all of the following are true.

### 17.1 Data and trust

- The app runs using the files currently present in the zip.
- Every state detail view exposes the evidence and confidence fields embedded in `sector_states.csv`.
- README and Phase 2 memo are visible in-app.

### 17.2 Configuration control

- Any required service can be pinned, fixed-share, or optimized.
- Electricity can be endogenous or externalized.
- Removals can be off, targeted, or optimized.
- Demand can be entered as a manual table or generated from anchor-plus-preset logic.

### 17.3 Solver behavior

- Fully pinned configurations solve correctly.
- Mixed configurations solve correctly.
- Fully endogenous state-allocation configurations solve correctly.
- Max-share, min-share, and max-activity fields are enforced when enabled.
- The generic rollout/uptake proxy works across milestone years.

### 17.4 Results and explainability

- Results include cost, emissions, commodity demand, electricity balance, and state shares.
- Compare mode highlights the impact of user choices on emissions, fuel, electricity, and cost.
- The app explains why chosen states differ from incumbent states and why configuration outcomes differ from each other.

## 18. Risks and mitigation

### Risk 1: the current zip is thinner than the README implies

Mitigation: base v1 only on the files that physically exist now; treat richer ledgers/docs as optional enrichment.

### Risk 2: demand growth presets could be mistaken for evidence

Mitigation: label them prominently as app-owned defaults and show their exact numeric rates in the UI.

### Risk 3: users misunderstand “full endogenous”

Mitigation: repeat that v1 solves endogenous state allocation, not endogenous service demand.

### Risk 4: users expect a numeric uptake-rate field from the library

Mitigation: explicitly label share smoothing as a generic app-level rollout proxy, not a discovered library parameter.

### Risk 5: low-confidence sectors dominate optimized runs

Mitigation: show confidence exposure prominently and make it easy to disable exploratory states.

## 19. Bottom line

This app should be a **fast, transparent, standalone explorer** for the Australia Phase 1 sector-state library.

It should stay simple:

- generalized rather than sector-coded,
- explicit about what comes from the library versus app defaults,
- strong on inspectability and explanation,
- and good enough for rapid reduced-form configuration work without any VedaLang/Vita dependency.

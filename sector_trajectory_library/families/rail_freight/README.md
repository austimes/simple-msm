# rail_freight

## What the family represents

This family covers Australian rail freight services as a single national-average technology family for region `AUS`. The service output is total freight transported in billion tonne-kilometres (billion_tkm), dominated by heavy-haul bulk commodity trains — primarily iron ore (Pilbara, WA), coal (Hunter Valley, NSW; Central Queensland), and grain — plus intermodal containerised freight and other non-bulk traffic.

The family spans the main technology transition pathways for rail freight:

- Overhead line electrification (OHL) on high-density bulk corridors
- Hydrogen fuel cell locomotives for non-electrified main lines
- Operational efficiency (train control, dynamic braking recovery)

## Output/service definition

- Family id: `rail_freight`
- Output/service name: `rail_freight_task`
- Output unit: `billion_tkm`
- Output quantity basis: One billion tonne-kilometres of total Australian rail freight. Calibrated to AES 2025 Table F1 rail (sector 47) diesel share allocated to freight = 49 PJ (the heavy-haul / interstate intermodal diesel residual after allocating 12.9 PJ electricity and 3.1 PJ regional diesel to passenger services, 2023-24 column) and BITRE freight linehaul statistics 2023-24 (~700 billion tkm rail freight).
- Demand trajectory: `stable_growing__rail_freight` (+0.8%/yr; stable heavy-haul bulk commodity, growing intermodal/containerised)
- 2025 demand anchor: 700 billion_tkm
- Default incumbent state id: `rail_freight__diesel_electric`

## State inventory

| State id | Label | Stage | Description |
|---|---|---|---|
| `rail_freight__diesel_electric` | Diesel-electric locomotive | Incumbent | AC traction diesel-electric locomotives (GE ES44AC, Wabtec FLXdrive platform, EMD SD70) — the dominant fleet in Australian heavy haul and intermodal. 2025 max_share = 1.00. |
| `rail_freight__overhead_electrification` | Overhead line electrification | Ambition 1 | OHL electrification on high-density freight corridors (Hunter Valley coal, Pilbara iron ore on private haul lines). Electric traction ~30% more energy-efficient than diesel per tkm. High capital cost limits applicability to highest-density corridors. 2025 max_share = 0.01 → 0.30 by 2050. |
| `rail_freight__hydrogen_locomotive` | Hydrogen fuel cell locomotive | Ambition 2 | Hydrogen fuel cell + battery hybrid locomotive for non-electrified main lines. Available from 2030 as demonstration projects scale. 2025 max_share = 0.00 → 0.20 by 2050. |

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — AES 2025 Table F1 (rail diesel 52 PJ; freight share = 49 PJ). See `shared/source_ledger.csv`
- `S013` — BITRE freight linehaul statistics (700 billion tkm anchor). See `shared/source_ledger.csv`
- `S032` — NGA Factors 2025 (diesel 69.9 kgCO2e/GJ). See `shared/source_ledger.csv`

## Main assumptions used

- `A002` — output_cost_per_unit excludes explicitly modelled commodity purchases. See `shared/assumptions_ledger.csv`
- `A003` — Scope 1 boundary only; electricity-related emissions excluded. See `shared/assumptions_ledger.csv`
- `A022` — Feasibility bounds are indicative upper bounds. See `shared/assumptions_ledger.csv`
- `A023` — Cost paths smoothed across milestone years. See `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

Phase 1 uses three technology states (one incumbent, two transition pathways) to represent the main decarbonisation options for Australian rail freight.

The incumbent (`diesel_electric`) anchors to AES 2025 Table F1 (rail diesel freight share, 2023-24) and BITRE freight statistics at national scale (100% coverage). OHL electrification (`overhead_electrification`) represents the capital-intensive but highly effective solution on the highest-density corridors — already operating on some segments of Australian private heavy-haul networks (Rio Tinto AutoHaul, BHP mine haul) and applicable to the Hunter Valley and Central Queensland coal lines. Hydrogen locomotives (`hydrogen_locomotive`) represent the pathway for the ~70% of Australian rail freight on non-electrified lines where OHL capital investment is not economically viable. These three states span the full technology range for rail freight decarbonisation without requiring route-specific decomposition.

## Known caveats

- **AES passenger/freight rail split.** AES 2025 Table F1 sector 47 (Rail transport) reports 64.9 PJ total in 2023-24 (52 PJ diesel + 12.9 PJ electricity). This calibration allocates 49 PJ diesel to freight and assigns 3.1 PJ regional diesel + 12.9 PJ urban metro electricity to passenger. AES does not publish a passenger/freight split, so this allocation carries calibration uncertainty.
- **Private vs public rail network.** Australian rail freight includes both government-operated networks (ARTC interstate, state grain lines) and private heavy-haul networks (Rio Tinto, BHP Billiton Iron Ore, Fortescue). Private networks already use some electrification for mine-to-port haulage. The national average blends these different operational regimes.
- **OHL capital cost excluded.** The `overhead_electrification` state cost represents only operating and energy cost, not the very high capital cost of OHL infrastructure (~AUD 2–5 million/km for greenfield). For investment decisions, OHL electrification requires explicit capital assessment.
- **Hydrogen locomotive availability.** No hydrogen locomotive operates commercially at scale in Australia as of 2025. The first Australian-relevant demonstrations (Wabtec FLXdrive hydrogen, CSIRO/Fortescue hydrogen locomotive R&D) are pre-commercial. The `hydrogen_locomotive` state is available from 2030 and carries a Low-Medium confidence rating.
- **Very low energy intensity per tkm.** Rail freight energy intensity of 35.7 GJ/billion_tkm (= 0.036 MJ/tkm) reflects the exceptional efficiency of heavy-haul rail for bulk commodities. This is correct — heavy-haul trains carrying iron ore or coal are among the most energy-efficient freight modes per tkm due to very high axle loads and long trains (>200 wagons).

## Efficiency artifacts

### Autonomous efficiency tracks

| Track | Applies to | Mechanism | Approx. cumulative reduction (2025–2050) |
|---|---|---|---|
| Background diesel locomotive efficiency drift | `diesel_electric` | Tier 4 Final engine emission standards, improved turbocharging, fuel-injection optimisation through fleet renewal cycles | ~8% (multiplier: 1.000 → 0.916) |
| Background electric traction efficiency drift | `overhead_electrification` | Power electronics improvements (SiC inverters), regenerative braking energy recovery, reduced auxiliary loads | ~7% (multiplier: 1.000 → 0.928) |

### Efficiency packages

| Package | Type | Applies to | Fuel impacted | Input multiplier |
|---|---|---|---|---|
| Train control system optimisation | operational_efficiency_overlay | `diesel_electric` | Diesel | 0.93 (−7%; advanced cruise control, smooth driving profiles, trip optimiser systems) |
| Dynamic braking energy recovery | pure_efficiency_overlay | `diesel_electric` | Diesel | 0.91 (−9%; improved dynamic braking with energy storage or resistor grid optimisation) |

Evidence basis: ARTC and Rio Tinto train control optimisation programmes report 5–10% fuel savings from trip optimiser systems; dynamic braking improvements report 5–12% reductions in diesel consumption in heavy-haul trials (ACARP, Wabtec).

## Expansion path

- **Phase 2:** Disaggregate into sub-families by traffic type: heavy-haul bulk (iron ore, coal), long-haul intermodal, and grain/short-haul. Each has materially different energy intensity, corridor characteristics, and electrification economics.
- Model private heavy-haul network electrification separately from public ARTC network, given different investment decision frameworks.
- Add battery-hybrid locomotive as a fourth state (partially electrified segments + battery buffer) as Wabtec FLXdrive and similar systems mature.
- Link coal freight demand trajectory explicitly to the coal mining sector to ensure consistency between production decline and freight task.

## Maintainer and reviewer

- Maintainer: Mythili Murugesan (`mythili_murugesan`)
- Reviewer: Core Model Review (`core_model_review`)

## Fuel consumption and emissions output from the model

### Incumbent state at 2025 anchor (diesel_electric, 700 billion_tkm)

| Commodity | Coefficient (GJ/billion_tkm) | Total at anchor |
|---|---|---|
| Diesel | 70,000 | 49.0 PJ |
| Electricity | 0 | 0.0 PJ |
| **Total energy** | **70,000** | **49.0 PJ** |

| Emission stream | Coefficient | Total at anchor | Reference |
|---|---|---|---|
| Energy CO2e, scope 1 (diesel only) | 4,893 tCO2e/billion_tkm | 3.43 MtCO2e | NGGI rail freight (heavy haul + interstate intermodal) |
| Electricity CO2e (scope 2, excluded) | — | — | Captured by electricity supply family |
| Process CO2e | 0 | 0 | — |

AES 2025 Table F1 reference: rail (sector 47) shows 64.9 PJ total in 2023-24 (52.0 PJ diesel + 12.9 PJ electricity). Of which rail_freight share = 49 PJ (the diesel-dominated bulk haul / intermodal services). Rail_passenger takes the 12.9 PJ electricity (urban metro) plus 3.1 PJ regional diesel.

Emission factor (NGA 2025, AR5 GWP100): diesel 69.9 kgCO2e/GJ.  
Scope 1 CO2e: 70,000 × 69.9 / 1000 = 4,893 tCO2e/billion_tkm ✓

**Energy efficiency context:** 70,000 GJ/billion_tkm = 0.070 MJ/tkm. For comparison: road freight heavy truck is approximately 1.5–2.0 MJ/tkm. Rail freight is ~20–30× more energy-efficient per tonne-km, reflecting the physics advantage of steel wheel on steel rail for heavy bulk loads.

### Diesel-electric state trajectory

| Year | Diesel (GJ/billion_tkm) | Electricity (GJ/billion_tkm) | Scope 1 CO2e (tCO2e/billion_tkm) |
|---|---|---|---|
| 2025 | 70,000 | 0 | 4,893 |
| 2030 | 67,760 | 0 | 4,737 |
| 2035 | 65,520 | 0 | 4,580 |
| 2040 | 63,280 | 0 | 4,423 |
| 2045 | 61,040 | 0 | 4,267 |
| 2050 | 58,800 | 0 | 4,110 |

### Overhead electrification state at 2050 (indicative best-case)

| Commodity | Coefficient (GJ/billion_tkm) | Scope 1 CO2e |
|---|---|---|
| Electricity | 20,000 | 0 (scope 1; scope 2 excluded per A003) |

The overhead electrification state achieves **100% reduction in scope 1 CO2e** with zero diesel combustion. The ~44% lower energy demand vs diesel reflects electric traction efficiency advantage plus regenerative braking. Scope 2 electricity emissions depend on grid decarbonisation (captured by electricity supply family).

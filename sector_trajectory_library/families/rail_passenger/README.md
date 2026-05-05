# rail_passenger

## What the family represents

This family covers Australian passenger rail services as a single national-average technology family for region `AUS`. The service output is total rail passenger travel in million passenger-kilometres (million_pkm), combining urban metro rail (Sydney, Melbourne, Brisbane, Perth, Adelaide), intercity rail (Sydney–Newcastle, Melbourne–Geelong), and regional diesel services (NSW TrainLink, Queensland regional, Western Australia Prospector, etc.).

The family spans the main technology transition pathways for passenger rail:

- Expansion of overhead line electrification (OHL) to replace diesel regional services
- Hydrogen fuel cell trains for non-electrified regional routes
- Battery-electric trains for shorter non-electrified segments

## Output/service definition

- Family id: `rail_passenger`
- Output/service name: `rail_passenger_travel`
- Output unit: `million_pkm`
- Output quantity basis: One million passenger-kilometres of total Australian passenger rail service. Calibrated to AES 2025 Table F1 rail share allocated to passenger services (16 PJ, consisting of 12.9 PJ electricity for urban metro plus 3.1 PJ diesel for regional services, 2023-24 column) and BITRE Rail Summary Data 2023-24 (22,000 million pkm total rail passenger).
- Demand trajectory: `growing__rail_passenger` (+1.5%/yr; driven by urban population growth, new metro lines, and modal shift investment)
- 2025 demand anchor: 22,000 million_pkm
- Default incumbent state id: `rail_passenger__conventional_mixed`

## State inventory

| State id | Label | Stage | Description |
|---|---|---|---|
| `rail_passenger__conventional_mixed` | Conventional mixed electric/diesel | Incumbent | National-average mix of OHL electric urban trains and diesel regional trains. Electricity ~50% and diesel ~50% of energy (by national average). 2025 max_share = 1.00. |
| `rail_passenger__fully_electrified` | Fully electrified OHL rail | Ambition 1 | Expansion of overhead line electrification to additional intercity and regional corridors. Electric trains use ~30% less energy per pkm than diesel. 2025 max_share = 0.15 → 0.60 by 2050. |
| `rail_passenger__battery_electric_regional` | Battery-electric regional | Ambition 1 | Battery-electric multiple units for shorter non-electrified regional services; no new OHL infrastructure required. 2025 max_share = 0.01 → 0.15 by 2050. |
| `rail_passenger__hydrogen_regional` | Hydrogen fuel cell regional | Ambition 2 | Hydrogen fuel cell trains for non-electrified regional routes where battery range is insufficient (>150 km). Available from 2030. 2025 max_share = 0.00 → 0.20 by 2050. |

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — AES 2025 Table F1 (rail electricity 12.9 PJ allocated to passenger). See `shared/source_ledger.csv`
- `S012` — BITRE Rail Summary Data 2023-24 (22,000 million pkm anchor). See `shared/source_ledger.csv`
- `S032` — NGA Factors 2025 (diesel 69.9 kgCO2e/GJ). See `shared/source_ledger.csv`

## Main assumptions used

- `A002` — output_cost_per_unit excludes explicitly modelled commodity purchases. See `shared/assumptions_ledger.csv`
- `A003` — Scope 1 boundary only; electricity-related emissions excluded. See `shared/assumptions_ledger.csv`
- `A022` — Feasibility bounds are indicative upper bounds. See `shared/assumptions_ledger.csv`
- `A023` — Cost paths smoothed across milestone years. See `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

Phase 1 uses four technology states (one incumbent, three transition pathways) to represent the main decarbonisation options for Australian passenger rail.

The incumbent (`conventional_mixed`) anchors to the national-average energy mix for passenger rail. The `fully_electrified` state represents OHL expansion, which is already the dominant technology in Australian urban rail and is extending to intercity corridors. Battery-electric (`battery_electric_regional`) covers short-range non-electrified regional options that do not require OHL infrastructure. Hydrogen (`hydrogen_regional`) addresses longer non-electrified regional routes where battery range is insufficient, consistent with Alstom Coradia iLint deployments in Europe and Australian state government expressions of interest. Together these four states cover the full range of credible decarbonisation options for Australian passenger rail through 2050.

## Known caveats

- **AES passenger/freight rail split.** AES 2025 Table F1 reports total rail energy (passenger + freight combined, sector 47): 64.9 PJ in 2023-24 (52 PJ diesel + 12.9 PJ electricity). The split applied here allocates the full 12.9 PJ electricity to passenger services (urban metro is electric-dominant) plus 3.1 PJ regional diesel = 16 PJ passenger. The remainder (49 PJ diesel) is rail freight. AES does not publish a published passenger/freight split, so this allocation carries calibration uncertainty.
- **Urban vs regional energy intensity.** The national-average 364 GJ/million_pkm blends energy-intensive diesel regional services (higher energy/pkm) with efficient urban metro rail (lower energy/pkm). Disaggregation by service class would yield materially different intensity parameters for each.
- **OHL electrification capital not modelled.** The `fully_electrified` state's cost (AUD/million_pkm) represents only operating and maintenance costs, not the upfront OHL infrastructure capital. For investment planning purposes, electrification decisions require explicit capital assessment outside this reduced-form model.
- **Hydrogen regional availability.** No hydrogen passenger train has been certified for operation in Australia as of 2025. The `hydrogen_regional` state is available from 2030, reflecting a realistic earliest commercial deployment timeline. Cost and energy coefficients carry Low confidence.

## Efficiency artifacts

### Autonomous efficiency tracks

| Track | Applies to | Mechanism | Approx. cumulative reduction (2025–2050) |
|---|---|---|---|
| Background diesel efficiency drift | `conventional_mixed` (diesel input) | New-generation diesel multiple unit and locomotive engine standards; hybrid diesel-battery power packs | ~10% (multiplier: 1.000 → 0.905) |
| Background electric efficiency drift | `conventional_mixed`, `fully_electrified` (electricity input) | Improvements in power electronics, regenerative braking energy recovery, and traction inverters | ~7% (multiplier: 1.000 → 0.928) |

### Efficiency packages

| Package | Type | Applies to | Fuel impacted | Input multiplier |
|---|---|---|---|---|
| Regenerative braking upgrade | pure_efficiency_overlay | `conventional_mixed`, `fully_electrified` | Electricity | 0.88 (−12%; regenerative braking captures braking energy for reuse) |
| Timetable and loading optimisation | operational_efficiency_overlay | `conventional_mixed` | Electricity, diesel | 0.93 (−7%; improved timetabling, peak load management, reduced empty running) |

Evidence basis: Regenerative braking on urban rail systems consistently delivers 10–15% electricity savings (TfNSW and MTR Corporation reports); timetable optimisation studies for mixed-service operators report 5–8% energy savings.

## Expansion path

- **Phase 2:** Disaggregate into sub-families by service class: urban metro, intercity electrified, regional diesel, and regional non-electrified. Each has materially different energy intensity, cost structure, and transition pathway.
- Model OHL network expansion explicitly with capital cost functions and corridor-by-corridor feasibility.
- Link demand growth to land-use and urban development scenarios.

## Maintainer and reviewer

- Maintainer: Mythili Murugesan (`mythili_murugesan`)
- Reviewer: Core Model Review (`core_model_review`)

## Fuel consumption and emissions output from the model

### Incumbent state at 2025 anchor (conventional_mixed, 22,000 million_pkm)

| Commodity | Coefficient (GJ/million_pkm) | Total at anchor |
|---|---|---|
| Electricity | 586 | 12.9 PJ |
| Diesel | 141 | 3.1 PJ |
| **Total energy** | **727** | **16.0 PJ** |

| Emission stream | Coefficient | Total at anchor | Reference |
|---|---|---|---|
| Energy CO2e, scope 1 (diesel only) | 9.9 tCO2e/million_pkm | 0.22 MtCO2e | NGGI rail passenger diesel scope 1 |
| Electricity CO2e (scope 2, excluded) | — | — | Captured by electricity supply family |
| Process CO2e | 0 | 0 | — |

AES 2025 Table F1 reference: rail (sector 47) shows 64.9 PJ total (52 PJ diesel + 12.9 PJ electricity, 2023-24). All rail electricity (12.9 PJ) is allocated to passenger services (urban metro), and 3.1 PJ of diesel to regional passenger services, giving rail_passenger = 16 PJ. Rail freight = 49 PJ (the remaining diesel).

Emission factor (NGA 2025, AR5 GWP100): diesel 69.9 kgCO2e/GJ.  
Scope 1 CO2e: 141 × 69.9 / 1000 = 9.9 tCO2e/million_pkm ✓

### Conventional mixed state trajectory

| Year | Electricity (GJ/million_pkm) | Diesel (GJ/million_pkm) | Scope 1 CO2e (tCO2e/million_pkm) |
|---|---|---|---|
| 2025 | 586 | 141 | 9.9 |
| 2030 | 594 | 132 | 9.2 |
| 2035 | 603 | 123 | 8.6 |
| 2040 | 611 | 113 | 7.9 |
| 2045 | 619 | 104 | 7.3 |
| 2050 | 627 | 95 | 6.6 |

### Fully electrified state at 2050 (indicative best-case)

| Commodity | Coefficient (GJ/million_pkm) | Scope 1 CO2e |
|---|---|---|
| Electricity | 200 | 0 (scope 1; scope 2 excluded per A003) |

The fully electrified state achieves **100% reduction in scope 1 CO2e** with zero diesel combustion. Scope 2 electricity emissions depend on grid decarbonisation (captured by electricity supply family).

# international_aviation

## What the family represents

This family covers international civil aviation bunker fuel consumed in Australian airports (ANZSIC international air transport) as a single national-average technology family for region `AUS`. The service output is total international air travel departing from or arriving into Australia in million passenger-kilometres (million_pkm), covering long-haul routes to Asia, Europe, North America, and the Pacific.

**Scope boundary:** The model covers fuel bunkered in Australian airports for international flights. This is consistent with NGGI international aviation bunker fuel accounting (IPCC guidelines, Category 1A3a international aviation).

The family captures three main emission-reduction levers:

- Sustainable Aviation Fuel (SAF) blending — the primary near-to-medium-term decarbonisation pathway (no drop-in alternative exists)
- Hydrogen combustion aircraft for long-haul (post-2035 emerging technology)
- Operational and fleet efficiency improvements

## Output/service definition

- Family id: `international_aviation`
- Output/service name: `international_air_travel`
- Output unit: `million_pkm`
- Output quantity basis: One million passenger-kilometres of international air travel bunkered in Australia. Calibrated to AES 2023-24 international aviation bunker fuel (165 PJ) and BITRE international aviation statistics (70,000 million pkm estimate).
- Demand trajectory: `growing__international_aviation` (+2.0%/yr 2025–2035, +1.0%/yr 2035–2050; recovering post-COVID, moderating with SAF mandates and carbon pricing)
- 2025 demand anchor: 70,000 million pkm
- Default incumbent state id: `international_aviation__conventional_jet`

## State inventory

| State id | Label | Stage | Description |
|---|---|---|---|
| `international_aviation__conventional_jet` | Conventional jet | Incumbent | Standard aviation turbine fuel (jet kerosene) for long-haul international flights. Higher energy intensity per pkm than domestic due to longer routes, heavier fuel loads, and slower fleet renewal. 2025 max_share = 1.00. |
| `international_aviation__saf_blend` | SAF blend | Ambition 1 | SAF progressive blend; trajectory slower than domestic aviation (global supply constraint for long-haul volumes). From 0% SAF in 2025 to 80% SAF by 2050. 2025 max_share = 0.00 → 0.50 by 2050. |
| `international_aviation__hydrogen_aircraft` | Hydrogen aircraft | Ambition 2 | Hydrogen combustion turbines for long-range routes; emerging technology not commercially available before 2035. Input: green hydrogen. 2025 max_share = 0.00 → 0.15 by 2050. |

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — AES 2023-24 (international aviation bunker fuel 165 PJ). See `shared/source_ledger.csv`
- `S012` — BITRE international aviation statistics (70,000 million pkm service anchor). See `shared/source_ledger.csv`
- `S032` — NGA Factors 2024 (aviation turbine fuel emission factor 71.5 kgCO2e/GJ). See `shared/source_ledger.csv`

## Main assumptions used

- `A002` — output_cost_per_unit excludes explicitly modelled commodity purchases. See `shared/assumptions_ledger.csv`
- `A003` — Scope 1 boundary only; electricity-related emissions excluded. See `shared/assumptions_ledger.csv`
- `A022` — Feasibility bounds are indicative upper bounds, not normative targets. See `shared/assumptions_ledger.csv`
- `A023` — Cost paths smoothed across milestone years. See `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

Phase 1 uses three technology states (one incumbent, two transition pathways) to represent the main decarbonisation options for international aviation.

The incumbent (`conventional_jet`) anchors to AES 2023-24 international bunker fuel at national scale. SAF (`saf_blend`) is recognised as the only viable near-term decarbonisation pathway for long-haul — there is no credible battery-electric pathway for international routes, and hydrogen is post-2035 at best. Hydrogen aircraft (`hydrogen_aircraft`) is included as the long-term breakthrough pathway consistent with emerging airframer roadmaps (Airbus ZEROe, Airbus H2). These three states span the credible technology range through 2050 without over-fitting to aircraft-type or route-specific detail.

## Known caveats

- **Long-haul energy intensity.** The 2,357 GJ/million_pkm coefficient is approximately twice the domestic intensity, reflecting longer routes, heavier fuel loads at departure, and fleet composition differences (wide-body A380, B787, A350). This national average blends Australian carriers' long-haul performance with stop-over routing patterns.
- **International bunker scope.** The energy and emissions anchor covers fuel physically bunkered in Australia. Some long-haul aircraft taking off from Australia are fuelled in part or fully at connecting hubs (e.g., Singapore, Dubai). The actual attributable emissions depend on bunkering point conventions.
- **SAF supply constraints.** Global SAF production capacity in 2025 is well below 1% of aviation fuel demand. The SAF blend trajectory assumes Australia participates in global SAF scale-up; the rate depends on policy mandates, blending infrastructure, and international SAF market development.
- **Hydrogen aircraft maturity.** No hydrogen aircraft certified for commercial long-haul operations exists. The `hydrogen_aircraft` state is only available from 2035 in the model and carries a Low confidence rating. Its inclusion preserves the long-term pathway option without biasing near-term runs.
- **No radiative forcing multiplier.** Non-CO2 warming effects (NOx, contrails, cirrus) are excluded from the scope 1 CO2e boundary, consistent with NGGI methodology.

## Efficiency artifacts

### Autonomous efficiency tracks

| Track | Applies to | Mechanism | Approx. cumulative reduction (2025–2050) |
|---|---|---|---|
| Background international fleet renewal | `conventional_jet`, `saf_blend` | Wide-body fleet replacement (A380 → A350/B787 → next-generation aircraft); ~15–20% generation-on-generation fuel efficiency improvement | ~10% (multiplier: 1.000 → 0.905) |

### Efficiency packages

| Package | Type | Applies to | Fuel impacted | Input multiplier |
|---|---|---|---|---|
| Aerodynamic and engine efficiency retrofit | pure_efficiency_overlay | `conventional_jet` | Aviation turbine fuel | 0.92 (−8%; winglet, sharklet, nacelle strake improvements) |
| Operational efficiency (load factor, route optimisation) | operational_efficiency_overlay | `conventional_jet`, `saf_blend` | Aviation turbine fuel | 0.94 (−6%; payload optimisation, direct routing, reduced holding time) |

Evidence basis: Airbus and Boeing fleet transition studies report 15–25% fuel efficiency gain from narrow-to-wide-body upgrades; ICAO operational efficiency programmes report 5–8% fuel savings from advanced flight management and routing.

## Expansion path

- **Phase 2:** Disaggregate by route class (short-haul international <5 hours, medium-haul 5–10 hours, ultra-long-haul >10 hours) to recover route-specific fuel intensity and SAF/H2 applicability windows.
- Model wide-body fleet stock rollover explicitly (A380, B747, B777 vs A350, B787) to represent age-based replacement cycles.
- Separate Australian-flagged carrier fuel from foreign-carrier fuel bunkered in Australia if data become available.

## Maintainer and reviewer

- Maintainer: Mythili Murugesan (`mythili_murugesan`)
- Reviewer: Core Model Review (`core_model_review`)

## Fuel consumption and emissions output from the model

### Incumbent state at 2025 anchor (conventional_jet, 70,000 million pkm)

| Commodity | Coefficient (GJ/million_pkm) | Total at anchor |
|---|---|---|
| Aviation turbine fuel | 2,357 | 165.0 PJ |

| Emission stream | Coefficient | Total at anchor | Reference |
|---|---|---|---|
| Energy CO2e (scope 1, NGGI international bunkers) | 168.5 tCO2e/million_pkm | 11.8 MtCO2e | NGGI: international aviation bunkers |
| Process CO2e | 0 | 0 | — |

AES bunker fuel coverage: 165.0 PJ modelled vs 165 PJ AES 2023-24 = **100.0%**.

### Conventional jet state trajectory

| Year | Aviation turbine fuel (GJ/million_pkm) | Energy CO2e (tCO2e/million_pkm) |
|---|---|---|
| 2025 | 2,357 | 168.5 |
| 2030 | 2,280 | 163.0 |
| 2035 | 2,200 | 157.3 |
| 2040 | 2,150 | 153.7 |
| 2045 | 2,120 | 151.6 |
| 2050 | 2,100 | 150.2 |

### SAF blend state — energy and emissions at 2050

| Commodity | Coefficient (GJ/million_pkm) | Scope 1 CO2e treatment |
|---|---|---|
| Aviation turbine fuel (20%) | 471 | 71.5 kgCO2e/GJ |
| Sustainable aviation fuel (80%) | 1,887 | 0 (biogenic, NGA convention) |

Energy CO2e at 2050: **33.7 tCO2e/million_pkm** (80% fossil fuel displaced; 80% emission reduction vs 2025 incumbent).

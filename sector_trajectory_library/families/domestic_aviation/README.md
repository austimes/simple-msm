# domestic_aviation

## What the family represents

This family covers Australian domestic civil aviation (ANZSIC 5100 domestic air transport) as a single national-average technology family for region `AUS`. The service output is total domestic air travel in million passenger-kilometres (million_pkm), covering all scheduled domestic passenger services — metro-to-metro trunk routes (Sydney–Melbourne, Sydney–Brisbane, Melbourne–Brisbane) and regional routes connecting capital cities to regional centres.

The family captures three main emission-reduction levers available to domestic aviation:

- Sustainable Aviation Fuel (SAF) progressive blending — drop-in replacement for conventional jet fuel
- Battery-electric short-haul aircraft for routes below 500 km
- Operational and fleet efficiency improvements

## Output/service definition

- Family id: `domestic_aviation`
- Output/service name: `domestic_air_travel`
- Output unit: `million_pkm`
- Output quantity basis: One million passenger-kilometres of total Australian domestic air travel. Calibrated to AES 2023-24 Table F (85 PJ domestic aviation fuel) and BITRE Aviation Statistical Report 2023-24 (75,500 million pkm domestic services).
- Demand trajectory: `growing_then_flat__domestic_aviation` (+1.5%/yr 2025–2030, +1.0%/yr 2030–2040, +0.5%/yr 2040–2050; recovering post-COVID then moderating with fuel cost and modal competition)
- 2025 demand anchor: 75,500 million pkm
- Default incumbent state id: `domestic_aviation__conventional_jet`

## State inventory

| State id | Label | Stage | Description |
|---|---|---|---|
| `domestic_aviation__conventional_jet` | Conventional jet | Incumbent | Standard aviation turbine fuel (jet kerosene) powered aircraft — current national fleet average. 2025 max_share = 1.00. |
| `domestic_aviation__saf_blend` | SAF blend | Ambition 1 | Sustainable Aviation Fuel drop-in blend, increasing from 5% SAF in 2025 to 100% SAF by 2050. SAF biogenic CO2 is treated as zero in scope 1 per NGA accounting convention. 2025 max_share = 0.02 → 0.60 by 2050. |
| `domestic_aviation__electric_short_haul` | Electric short-haul | Ambition 2 | Battery-electric aircraft for routes below 500 km. Applicable to ~20% of domestic route network by distance. 2025 max_share = 0.00 → 0.20 by 2050. |

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — AES 2023-24 Table F (primary energy calibration basis; 85 PJ domestic aviation). See `shared/source_ledger.csv`
- `S012` — BITRE Aviation Statistical Report 2023-24 (75,500 million pkm domestic service output anchor). See `shared/source_ledger.csv`
- `S032` — NGA Factors 2024 (emission factors: aviation turbine fuel 71.5 kgCO2e/GJ). See `shared/source_ledger.csv`

## Main assumptions used

- `A002` — output_cost_per_unit excludes explicitly modelled commodity purchases. See `shared/assumptions_ledger.csv`
- `A003` — Scope 1 boundary only; electricity-related emissions excluded from end-use coefficients. See `shared/assumptions_ledger.csv`
- `A022` — Feasibility bounds are indicative upper bounds, not normative targets. See `shared/assumptions_ledger.csv`
- `A023` — Cost paths smoothed across milestone years where point-in-time data are sparse. See `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

Phase 1 uses three technology states (one incumbent, two transition pathways) to represent the main emission-abatement options for domestic aviation without requiring a route-specific or aircraft-type model.

The incumbent (`conventional_jet`) anchors to AES 2023-24 and BITRE 2023-24 at national scale (100% energy coverage). SAF blending (`saf_blend`) is the dominant near-term decarbonisation pathway for domestic aviation, directly displacing fossil jet kerosene via drop-in compatibility. Electric short-haul (`electric_short_haul`) represents the emerging technology pathway applicable to short-distance routes. Together these three states span the main near-term to 2050 options without over-fitting to aircraft-type or route-specific detail that national-average source data do not support.

## Known caveats

- **National-average energy intensity.** The 1,126 GJ/million_pkm coefficient blends trunk routes (high load factors, large aircraft) with regional routes (lower load factors, smaller aircraft). Trunk route energy intensity is lower per pkm than regional.
- **SAF scope 1 accounting.** SAF biogenic CO2 is treated as zero in scope 1 per current NGA methodology. Lifecycle (scope 3) emissions from SAF production are excluded from this family. The national SAF supply chain is nascent; cost trajectories carry significant uncertainty.
- **Electric aircraft maturity.** Battery-electric aircraft capable of commercial passenger service on Australian domestic routes are not yet available at scale. The `electric_short_haul` state availability is capped at 0.00 in 2025, increasing gradually from 2030 as technology matures. Cost and energy coefficients carry Low confidence.
- **No radiative forcing multiplier.** Aviation has non-CO2 climate effects (NOx, contrails, cirrus). These are excluded from the scope 1 CO2e boundary of this family, consistent with NGGI methodology.

## Efficiency artifacts

### Autonomous efficiency tracks

| Track | Applies to | Mechanism | Approx. cumulative reduction (2025–2050) |
|---|---|---|---|
| Background aircraft fleet efficiency drift | `conventional_jet`, `saf_blend` | New generation engine programmes (LEAP-1A/1B, GEnX, PW1000G), composite airframes, aerodynamic improvements through fleet renewal | ~12% (multiplier: 1.000 → 0.882) |

### Efficiency packages

| Package | Type | Applies to | Fuel impacted | Input multiplier |
|---|---|---|---|---|
| Flight operations optimisation | operational_efficiency_overlay | `conventional_jet` | Aviation turbine fuel | 0.92 (−8%; route optimisation, reduced taxiing, load factor improvement) |
| Aircraft fleet renewal aerodynamic improvement | pure_efficiency_overlay | `conventional_jet` | Aviation turbine fuel | 0.90 (−10%; winglet retrofits, drag reduction) |

Evidence basis: ICAO operational efficiency programmes report 6–10% fuel savings from route optimisation; winglet and aerodynamic retrofit programmes for current-generation narrowbodies report 5–7% fuel savings.

## Expansion path

- **Phase 2:** Disaggregate into sub-families by route class (trunk metro-to-metro, capital-to-regional, intra-regional) to recover route-specific fuel intensity, load factors, and electrification feasibility.
- Model aircraft-type stock rollover explicitly (A320 family, B737 family, ATR/Dash 8 regional turboprops) to represent fleet replacement cycles.
- Add hydrogen combustion turbine state once Australian domestic hydrogen aircraft programmes mature (anticipated post-2035 for regional routes).
- Incorporate radiative forcing multiplier as a scenario parameter for non-CO2 warming effects.

## Maintainer and reviewer

- Maintainer: Mythili Murugesan (`mythili_murugesan`)
- Reviewer: Core Model Review (`core_model_review`)

## Fuel consumption and emissions output from the model

### Incumbent state at 2025 anchor (conventional_jet, 75,500 million pkm)

| Commodity | Coefficient (GJ/million_pkm) | Total at anchor |
|---|---|---|
| Aviation turbine fuel | 1,126 | 85.0 PJ |

| Emission stream | Coefficient | Total at anchor | Reference |
|---|---|---|---|
| Energy CO2e (scope 1, NGA Cat 1A3a) | 80.5 tCO2e/million_pkm | 6.1 MtCO2e | NGGI 2023-24: ~6.1 MtCO2e domestic aviation |
| Process CO2e | 0 | 0 | — |

AES energy coverage: 85.0 PJ modelled vs 85 PJ AES 2023-24 = **100.0%**.

### Conventional jet state fuel mix trajectory

| Year | Aviation turbine fuel (GJ/million_pkm) | Energy CO2e (tCO2e/million_pkm) |
|---|---|---|
| 2025 | 1,126 | 80.5 |
| 2030 | 1,082 | 77.4 |
| 2035 | 1,038 | 74.2 |
| 2040 | 994 | 71.1 |
| 2045 | 994 | 71.1 |
| 2050 | 1,000 | 71.5 |

### SAF blend state — energy and emissions at 2050

| Commodity | Coefficient (GJ/million_pkm) | Scope 1 CO2e treatment |
|---|---|---|
| Aviation turbine fuel | 0 | 71.5 kgCO2e/GJ |
| Sustainable aviation fuel | 1,000 | 0 (biogenic, NGA convention) |

Energy CO2e at 2050: **0 tCO2e/million_pkm** (100% SAF, full displacement of fossil fuel).

The SAF blend state achieves **100% reduction in scope 1 energy CO2e** at 2050 relative to the 2025 conventional baseline.

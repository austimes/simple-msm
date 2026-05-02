# oil_and_gas_extraction

## What the family represents

This family covers Australian oil and gas extraction (ANZSIC 0700) as a single national-average technology family for region `AUS`. The service output is total gas production in petajoule (PJ_gas), combining LNG exports and domestic pipeline supply on a unified production basis. The family spans all major basin and facility types — onshore QLD coal seam gas (CSG), conventional onshore WA/NT, and offshore facilities (NW Shelf, Browse, Ichthys, Prelude, Darwin LNG) — using national-average AES 2023-24 coefficients.

**Scope boundary:** The model covers upstream extraction energy — wellhead compression, gas gathering, processing, and drilling operations. It explicitly excludes LNG liquefaction own-use energy, which AES classifies as energy transformation (not final energy consumption) and accounts for separately.

The family captures four main emission-reduction levers available to Australian oil and gas producers:

- Electrification of compressor stations (electric motor drives replacing gas turbine drivers)
- Leak detection and repair (LDAR) combined with elimination of routine flaring and venting
- Solar-diesel hybrid systems at remote wellsites
- Integrated combination of all three levers

## Output/service definition

- Family id: `oil_and_gas_extraction`
- Output/service name: `gas_production`
- Output unit: `PJ_gas`
- Output quantity basis: One petajoule of total Australian gas production (LNG export + domestic pipeline supply combined). Calibrated to AES 2023-24 Table F (ANZSIC 0700 final energy = 471 PJ) and NGGI 2023-24 Categories 1A2 (energy combustion) and 1B2b (fugitive oil and gas). Production anchor from Geoscience Australia AECR 2025 (6,100 PJ_gas).
- Demand trajectory: `declining__oil_and_gas_extraction_total` (−1.0%/yr compound; based on AEMO ISP 2024 Step Change scenario, reflecting global LNG demand peaking post-2030)
- 2025 demand anchor: 6,100 PJ_gas (LNG exports ≈ 4,509 PJ, 74%; domestic/pipeline ≈ 1,591 PJ, 26%)
- Default incumbent state id: `oil_and_gas_extraction__conventional`

## State inventory

| State id | Label | Stage | Description |
|---|---|---|---|
| `oil_and_gas_extraction__conventional` | Conventional oil and gas extraction | Incumbent | Gas turbine-driven compressor stations + diesel for remote drilling + grid electricity for fixed facilities. 2025 max_share = 1.00. |
| `oil_and_gas_extraction__electric_compression` | Electric motor drive compression | Ambition 1 | Electric motor drives (EMD) replace gas turbine compressors. Motors are ~3× more thermally efficient than gas turbines (~95% vs ~30–35% η), reducing gas own-use by ~63%. Best applicable to onshore CSG (QLD) and Darwin LNG with grid access. 2025 max_share = 0.01 → 0.40 by 2050. |
| `oil_and_gas_extraction__ldar_no_flare` | LDAR and zero routine flaring | Ambition 1 | Systematic leak detection and repair + elimination of routine flaring and venting. Reduces fugitive CO2e by ~50% immediately, ~81% by 2050. Small electricity penalty (~100 GJ/PJ) for monitoring equipment. 2025 max_share = 0.02 → 0.52 by 2050. |
| `oil_and_gas_extraction__renewable_diesel` | Wellsite solar-diesel hybrid | Ambition 1 | Solar PV + lithium-ion battery replaces approximately 50% of remote wellsite diesel generation. Most applicable to onshore remote sites (QLD CSG wellpads, WA onshore). 2025 max_share = 0.01 → 0.33 by 2050. |
| `oil_and_gas_extraction__integrated_low_emission` | Integrated low-emission | Ambition 2 | Electric compression + LDAR/no-flare + renewable diesel combined. Represents the Safeguard Mechanism policy pathway for deep decarbonisation. 2025 max_share = 0.00 → 0.24 by 2050. |

All state ids are authored across milestone years 2025, 2030, 2035, 2040, 2045, 2050.

## Main sources used

- `S001` — AES 2023-24 Table F (primary energy calibration basis; ANZSIC 0700 final energy = 471 PJ). See `shared/source_ledger.csv`
- `S002` — NGGI 2023-24 Categories 1A2 and 1B2b (energy and fugitive emissions calibration). See `shared/source_ledger.csv`
- `S022` — Geoscience Australia Australian Energy and Climate Review (AECR) 2025 (total gas production anchor). See `shared/source_ledger.csv`

## Main assumptions used

- `A002` — output_cost_per_unit excludes explicitly modelled commodity purchases. See `shared/assumptions_ledger.csv`
- `A003` — Scope 1 boundary only; electricity-related emissions excluded from end-use coefficients. See `shared/assumptions_ledger.csv`
- `A010` — LNG liquefaction own-use excluded from the sector boundary (classified as energy transformation in AES). See `shared/assumptions_ledger.csv`

## Why the current state set is sufficient

Phase 1 uses five technology states (one incumbent, four transition pathways) to represent the main emission-abatement options for Australian oil and gas extraction without requiring a facility-level or basin-level model.

The incumbent (`conventional`) matches both AES 2023-24 final energy (471 PJ, 100.1% coverage) and NGGI 2023-24 emission totals (22 MtCO2e energy CO2e, 22 MtCO2e fugitive CO2e). The two levers that address the dominant energy stream — gas turbine own-use (~81% of extraction energy in 2025) — are the `electric_compression` state (replacing turbines) and the `integrated_low_emission` state (combining all reductions). The `ldar_no_flare` state addresses the fugitive emission stream, which equals the energy stream in the incumbent baseline (both 3,610 tCO2e/PJ in 2025). The `renewable_diesel` state captures the wellsite diesel reduction lever relevant to remote onshore operations (diesel is ~13% of site energy).

Together these five states let the solver distinguish the two distinct and approximately equal emission streams (energy and fugitive) and the three main technology levers (compressor electrification, fugitive abatement, wellsite renewable energy) without over-fitting to facility or basin detail that the national-average source data does not support.

## Known caveats

### LNG liquefaction exclusion
The model boundary excludes LNG liquefaction own-use energy (~124 PJ for the LNG sector; classified under AES energy transformation, not final energy consumption). The full upstream-to-LNG supply chain energy is therefore higher than modelled. This is intentional and consistent with AES methodology, but users comparing to facility-reported NGER or WA EPA data should note the boundary difference.

### Emissions calibration gap
Applying NGA emission factors to the AES fuel split gives an AES-derived combustion CO2e of 23.7 MtCO2e, which is 1.7 MtCO2e higher than NGGI Category 1A2 (22 MtCO2e). The gap arises because gas combusted in routine flaring and venting is classified under NGGI 1B2b (fugitive) rather than 1A2 (stationary combustion). Model energy CO2e is calibrated directly to NGGI 1A2 (22 MtCO2e) to maintain consistency with national inventory accounting. The 1.7 MtCO2e difference is appropriately captured in the fugitive coefficient.

### National average per-PJ coefficient
The per-PJ coefficient averages across onshore CSG (lower compression energy intensity) and offshore LNG facilities (higher gas turbine load). The conventional state therefore understates intensity for high-compression offshore facilities and overstates it for lower-compression CSG operations. Basin-level disaggregation is deferred to Phase 2.

### Electric compression grid access constraint
The `electric_compression` and `integrated_low_emission` states assume grid power is available. Most offshore LNG facilities (NW Shelf, Browse, Ichthys, Prelude) have limited or no grid access. Transition pacing for these facilities is constrained by the max_share trajectory (0.01 in 2025). Only onshore facilities (QLD CSG, Darwin LNG) can realistically access grid-connected electric compression in the near term.

### Previous model revision
This family supersedes the earlier `gas_mining` family. The previous model had a 27% energy overcount (595 PJ vs AES 471 PJ), a 34% energy CO2e overcount (29.5 MtCO2e vs NGGI 22 MtCO2e), and a 9% fugitive undercount (20 MtCO2e vs NGGI 22 MtCO2e). The main causes were inclusion of LNG liquefaction own-use in the energy total and use of an incorrect gas own-use coefficient. These are corrected in the current calibration. See `generate_oil_and_gas_extraction_data.py` for the full revision notes.

## Efficiency artifacts

### Autonomous efficiency tracks

Two background efficiency tracks apply exogenous improvement to fuel use regardless of technology state choice. These represent equipment replacement cycles and engineering advances that occur without explicit policy intervention.

| Track | Applies to | Mechanism | Approx. cumulative reduction (2025–2050) |
|---|---|---|---|
| Background gas turbine efficiency drift | `conventional`, `ldar_no_flare`, `renewable_diesel` | Fleet replacement and aero-thermal design advances | ~12% (multiplier: 1.000 → 0.882) |
| Background diesel efficiency drift | `conventional`, `ldar_no_flare`, `electric_compression` | Fleet replacement and Tier 4 Final engine standards | ~10% (multiplier: 1.000 → 0.905) |

### Efficiency packages

Three optional overlay packages can be applied on top of base state coefficients. Packages reduce input commodity demand by the listed input multipliers.

| Package | Type | Applies to | Fuel impacted | Input multiplier |
|---|---|---|---|---|
| Compressor Station Upgrade (VSD + Heat Integration) | pure_efficiency_overlay | `conventional`, `ldar_no_flare`, `renewable_diesel` | Natural gas | 0.90 (−10% gas fuel) |
| Wellsite Solar-Diesel Hybrid | operational_efficiency_overlay | `conventional`, `ldar_no_flare` | Refined liquid fuels | 0.80 (−20–40% diesel) |
| Electric Compression Smart-Load Management | operational_efficiency_overlay | `electric_compression`, `integrated_low_emission` | Electricity | 0.95 (−5% electricity) |

Evidence basis: Santos/Woodside compressor upgrades report 8–14% gas fuel reduction from VSD retrofits and waste-heat recovery (IEA cites 10% central estimate); ARENA-funded solar-hybrid projects at remote Australian mining and CSG sites demonstrate significant diesel displacement; ABB/Siemens smart-load systems report 4–7% electricity savings via demand optimisation.

## Expansion path

- **Phase 2:** Disaggregate into sub-families by basin and facility type: QLD CSG onshore, WA/NT conventional onshore, offshore LNG (NW Shelf, Browse, Ichthys), and Darwin LNG. Basin-specific fugitive intensities, grid access constraints, and compressor configurations vary materially.
- Add explicit LNG liquefaction own-use as a separate energy transformation state to recover the full supply-chain emission boundary for users who require it.
- Link `ldar_no_flare` and `integrated_low_emission` states to NGER-reported facility-level direct-measurement data as it becomes available under new measurement requirements.
- Refine offshore electric compression pathways as marine grid and floating power technology evidence matures.

## Maintainer and reviewer

- Maintainer: Mythili Murugesan (`mythili_murugesan`)
- Reviewer: Core Model Review (`core_model_review`)

## Fuel consumption and emissions output from the model

### Incumbent state at 2025 anchor (conventional, 6,100 PJ_gas)

| Commodity | Coefficient (GJ/PJ_gas) | Total at anchor |
|---|---|---|
| Natural gas (own-use) | 62,300 | 380 PJ |
| Refined liquid fuels (diesel) | 9,800 | 60 PJ |
| Electricity | 5,100 | 31 PJ |
| **Total energy** | **77,200** | **471 PJ** |

| Emission stream | Coefficient | Total at anchor | NGGI reference |
|---|---|---|---|
| Energy CO2e (scope 1, NGGI Cat 1A2) | 3,610 tCO2e/PJ_gas | 22.0 MtCO2e | NGGI 2023-24: 22 MtCO2e |
| Process CO2e (fugitive, NGGI Cat 1B2b) | 3,610 tCO2e/PJ_gas | 22.0 MtCO2e | NGGI 2023-24: 22 MtCO2e |
| **Total scope 1** | **7,220 tCO2e/PJ_gas** | **44.0 MtCO2e** | — |

AES energy coverage: 471.0 PJ modelled vs 471 PJ AES 2023-24 = **100.1%**.  
NGGI energy coverage: 22.0 MtCO2e modelled vs 22 MtCO2e NGGI Cat 1A2 = **100.0%**.  
NGGI fugitive coverage: 22.0 MtCO2e modelled vs 22 MtCO2e NGGI Cat 1B2b = **100.0%**.

Emission factors applied (NGA 2024, DCCEEW, scope 1, AR5 GWP100): natural gas 51.4 kgCO2e/GJ; diesel 69.9 kgCO2e/GJ.

**Note:** AES-derived combustion CO2e using NGA factors = 23.7 MtCO2e. The 1.7 MtCO2e gap vs NGGI 1A2 (22.0 MtCO2e) reflects routine flaring/venting gas classified as fugitive (NGGI 1B2b) rather than stationary combustion (NGGI 1A2). Model energy CO2e is calibrated to NGGI 1A2.

### Conventional state fuel mix trajectory (background only, no packages)

| Year | Natural gas (GJ/PJ_gas) | Diesel (GJ/PJ_gas) | Electricity (GJ/PJ_gas) | Energy CO2e (tCO2e/PJ_gas) | Fugitive CO2e (tCO2e/PJ_gas) |
|---|---|---|---|---|---|
| 2025 | 62,300 | 9,800 | 5,100 | 3,610 | 3,610 |
| 2030 | 60,700 | 9,600 | 5,200 | 3,520 | 3,300 |
| 2035 | 59,200 | 9,400 | 5,300 | 3,440 | 3,000 |
| 2040 | 57,700 | 9,200 | 5,400 | 3,350 | 2,700 |
| 2045 | 56,500 | 9,000 | 5,500 | 3,280 | 2,450 |
| 2050 | 55,300 | 8,800 | 5,500 | 3,210 | 2,200 |

### Integrated low-emission state — indicative best-case at 2050

| Commodity | Coefficient (GJ/PJ_gas) |
|---|---|
| Natural gas (own-use) | ~11,900 |
| Refined liquid fuels (diesel) | ~1,700 |
| Electricity | ~15,400 |
| **Total energy** | **~29,000** |

| Emission stream | Coefficient |
|---|---|
| Energy CO2e | ~730 tCO2e/PJ_gas |
| Process CO2e (fugitive) | ~680 tCO2e/PJ_gas |

The integrated low-emission state achieves approximately **80% reduction in energy CO2e** and **81% reduction in fugitive CO2e** relative to the 2025 conventional baseline.

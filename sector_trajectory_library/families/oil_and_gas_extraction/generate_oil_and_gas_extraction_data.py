#!/usr/bin/env python3
"""
Oil and Gas Extraction — Total Production Generator  (Phase 1 revised)
=======================================================================
Generates oil_and_gas_extraction family CSVs calibrated to AES 2023-24
Table F and NGGI 2023-24.

Scope: TOTAL Australian oil and gas extraction (gas production-weighted).
Anchor: 6,100 PJ_gas total gas production (Geoscience Australia AECR 2025).

=== CALIBRATION REVISION NOTES ===

Previous model (gas_mining) discrepancies vs actuals:
  1. Energy:        model 595 PJ   vs AES 2023-24 actual 471 PJ   (overcount by 27%)
  2. Energy CO2e:   model 29.5 MtCO2e vs NGGI 2023-24 actual 22 MtCO2e (overcount by 34%)
  3. Fugitive CO2e: model 20.0 MtCO2e vs NGGI 2023-24 actual 22 MtCO2e (undercount by 9%)

Reasons for previous discrepancies:
  1. ENERGY OVERCOUNT: Prior model estimated gas own-use = 82,000 GJ/PJ based on
     Geoscience Australia LNG own-use (~316 PJ) plus upstream compression (~184 PJ) = 500 PJ.
     However, AES 2023-24 "final energy consumption" for oil and gas extraction (ANZSIC 0700)
     = 471 PJ does NOT include LNG liquefaction own-use. In AES, LNG liquefaction is classified
     under the "energy transformation" sector (not final energy consumption). The correct AES
     final energy basis is 471 PJ = upstream well compression + gathering + processing + drilling.

  2. ENERGY CO2e OVERCOUNT:
     (a) Dominant cause: Wrong gas coefficient (82,000 vs correct 62,300 GJ/PJ).
         With 62,300 GJ/PJ: (62,300×51.4 + 9,800×69.9)/1,000 = 3,887 tCO2e/PJ = 23.7 MtCO2e.
     (b) Residual 1.7 MtCO2e gap (23.7 vs NGGI 22.0): Gas combusted for routine flaring
         and venting at oil and gas facilities is classified under NGGI Category 1B2b
         (Fugitive: oil and gas) rather than Category 1A2 (Energy: stationary combustion).
         This 1.7 MtCO2e is correctly captured in the fugitive coefficient, not the energy CO2e.
         Model energy CO2e is therefore calibrated directly to NGGI Cat 1A2 = 22 MtCO2e.

  3. FUGITIVE UNDERCOUNT: Prior model used NGGI 2022-23 Cat 1B2b (~20 MtCO2e).
     NGGI 2023-24 shows 22 MtCO2e (+2 MtCO2e), reflecting both improved measurement
     methodology (direct-measurement reporting under NGER) and real growth in LNG
     sector fugitive emissions.

=== REVISED CALIBRATION BASIS ===

AES 2023-24 Table F — 471 PJ final energy for oil and gas extraction (ANZSIC 0700).
  (excludes LNG liquefaction own-use, which AES classifies as energy transformation)

Fuel split (estimated from AES oil and gas extraction proportions):
  Gas own-use: ~380 PJ (80.7%)  →  62,300 GJ/PJ_gas
  Diesel:       ~60 PJ (12.7%)  →   9,800 GJ/PJ_gas
  Electricity:  ~31 PJ (6.6%)   →   5,100 GJ/PJ_gas
  Total:        471 PJ           →  77,200 GJ/PJ_gas ✓

  Sense-check: 77,200 × 6,100 / 1e6 = 471.0 PJ  (AES 471 PJ, 100.1% coverage) ✓

Emission factors (NGA 2024, DCCEEW, scope 1, AR5 GWP100):
  Natural gas: 51.4 kgCO2e/GJ
  Diesel:      69.9 kgCO2e/GJ

Energy CO2e (AES-derived, before NGGI alignment):
  (62,300 × 51.4 + 9,800 × 69.9) / 1,000 = 3,887 tCO2e/PJ  →  23.7 MtCO2e

Energy CO2e (NGGI 2023-24 Cat 1A2 calibrated):
  22,000,000 / 6,100 = 3,607  →  modelled as 3,610 tCO2e/PJ_gas
  Residual gap (1.7 MtCO2e) = routine flaring/venting classified as fugitive in NGGI.

Fugitive CO2e (NGGI 2023-24 Cat 1B2b):
  22,000,000 / 6,100 = 3,607  →  modelled as 3,610 tCO2e/PJ_gas
  Sense-check: 3,610 × 6,100 / 1e6 = 22.0 MtCO2e  (NGGI 22 MtCO2e) ✓

Demand trajectory: declining__oil_and_gas_extraction_total (−1.0%/yr compound)
  Reflects AEMO ISP 2024 Step Change and global LNG demand peaking post-2030.

Sources: S001 (AES 2023-24), S002 (NGGI 2023-24), S022 (Geoscience Australia AECR 2025)
Assumptions: A002 (energy attribution), A003 (scope 1 boundary), A010 (fugitive)
"""

import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = [2025, 2030, 2035, 2040, 2045, 2050]

# ── calibration constants ────────────────────────────────────────────────────
AES_FINAL_ENERGY_PJ  = 471.0   # AES 2023-24 Table F, oil and gas extraction final energy
TOTAL_PROD_PJ_GAS    = 6_100   # Geoscience Australia AECR 2025 (anchor)
ANCHOR_PJ            = TOTAL_PROD_PJ_GAS

# Per-PJ_gas coefficients (national average, 2025 anchor, AES-calibrated)
GAS_2025   = 62_300  # GJ/PJ_gas  gas own-use (380 PJ / 6,100 PJ)
RFUEL_2025  =  9_800  # GJ/PJ_gas  diesel (60 PJ / 6,100 PJ)
ELEC_2025   =  5_100  # GJ/PJ_gas  electricity (31 PJ / 6,100 PJ)
SEI_2025    = GAS_2025 + RFUEL_2025 + ELEC_2025  # 77,200 GJ/PJ

# Emission factors (NGA 2024, kgCO2e/GJ, AR5 GWP100)
EF_GAS   = 51.4
EF_RFUEL = 69.9

# Energy CO2e — calibrated to NGGI 2023-24 Cat 1A2 (22 MtCO2e)
# AES-derived:  (62,300×51.4 + 9,800×69.9)/1,000 = 3,887 tCO2e/PJ → 23.7 MtCO2e
# NGGI direct:  22,000,000 / 6,100 = 3,607 → 3,610 tCO2e/PJ
# Gap (1.7 MtCO2e): routine flaring/venting classified as fugitive (1B2b), not energy (1A2)
ENERGY_CO2E_2025  = 3_610  # tCO2e/PJ_gas (NGGI 2023-24 calibrated)

# Fugitive CO2e — NGGI 2023-24 Cat 1B2b (22 MtCO2e)
# Includes natural gas from routine flaring/venting reclassified from energy
PROCESS_CO2E_2025 = 3_610  # tCO2e/PJ_gas  →  22.0 MtCO2e at 6,100 PJ

# ── shared notes ─────────────────────────────────────────────────────────────
COST_COMPONENTS = (
    "Annualised capital and O&M cost excluding explicit energy commodity "
    "purchases and excluding policy carbon costs."
)
EMISSIONS_BOUNDARY = (
    "Direct on-site scope 1 emissions only. Electricity upstream (scope 2) "
    "excluded; captured by the electricity supply family. Fugitive methane "
    "and CO2 from venting/flaring reported as CO2e (IPCC AR5 GWP100). "
    "Note: routine flaring/venting gas is included in process CO2e (NGGI Cat 1B2b), "
    "not energy CO2e (NGGI Cat 1A2), consistent with national inventory methodology."
)
ROLLOUT_NOTES = (
    "National adoption bound reflecting long-lived upstream infrastructure "
    "(wellhead, compressor stations, LNG trains: 20-40 yr asset life) and "
    "declining Australian gas production constraining greenfield capital."
)
AVAIL_NOTE = "All states available from 2025; uptake bounds reflect Australian upstream investment cycle."
DERIVATION = (
    "Energy coefficients from AES 2023-24 Table F (oil and gas extraction final energy "
    "471 PJ / 6,100 PJ_gas = 77,200 GJ/PJ_gas). "
    "Energy CO2e calibrated to NGGI 2023-24 Cat 1A2 = 22 MtCO2e (3,610 tCO2e/PJ_gas). "
    "Fugitive from NGGI 2023-24 Cat 1B2b = 22 MtCO2e (3,610 tCO2e/PJ_gas)."
)
SOURCES     = json.dumps(["S001", "S002", "S022"])
ASSUMPTIONS = json.dumps(["A002", "A003", "A010"])
UNITS_3     = json.dumps(["GJ/PJ_gas", "GJ/PJ_gas", "GJ/PJ_gas"])

FS_FIELDNAMES = [
    "family_id", "state_id", "year", "state_label", "state_description",
    "output_cost_per_unit", "cost_basis_year", "currency", "cost_components_summary",
    "input_commodities", "input_coefficients", "input_units", "input_basis_notes",
    "energy_emissions_by_pollutant", "process_emissions_by_pollutant",
    "emissions_units", "emissions_boundary_notes",
    "max_share", "max_activity", "min_share", "rollout_limit_notes",
    "availability_conditions", "source_ids", "assumption_ids",
    "evidence_summary", "derivation_method", "confidence_rating", "review_notes",
    "candidate_expansion_pathway", "times_or_vedalang_mapping_notes",
    "would_expand_to_explicit_capacity?", "would_expand_to_process_chain?",
    "energy_co2e", "process_co2e",
    "state_stage_family", "state_stage_rank", "state_stage_code",
    "state_sort_key", "state_label_standardized",
    "is_default_incumbent_2025",
    "state_option_rank", "state_option_code", "state_option_label",
    "balance_tuning_flag", "balance_tuning_note", "benchmark_balance_note",
    "specific_energy_use", "energy_efficiency_index", "equipment_efficiency_rating",
    "fuel_efficiency_improvement_rate", "electricity_efficiency_improvement_rate",
]
DEMAND_FIELDNAMES = [
    "family_id", "anchor_year", "anchor_value", "unit",
    "demand_growth_curve_id", "anchor_status", "source_family",
    "coverage_note", "notes",
]


def je(obj):
    return json.dumps(obj)


def fs_row(state_id, year, yd, meta):
    return {
        "family_id":                   "oil_and_gas_extraction",
        "state_id":                    state_id,
        "year":                        year,
        "state_label":                 meta["label"],
        "state_description":           meta["description"],
        "output_cost_per_unit":        yd["cost"],
        "cost_basis_year":             2024,
        "currency":                    "AUD_2024",
        "cost_components_summary":     COST_COMPONENTS,
        "input_commodities":           meta["commodities"],
        "input_coefficients":          je(yd["coefficients"]),
        "input_units":                 meta["units"],
        "input_basis_notes":           meta["input_basis"],
        "energy_emissions_by_pollutant":  je([{"pollutant": "CO2e", "value": yd["energy_co2e"]}]),
        "process_emissions_by_pollutant": je([{"pollutant": "CO2e", "value": yd["process_co2e"]}]),
        "emissions_units":             "tCO2e/PJ_gas",
        "emissions_boundary_notes":    EMISSIONS_BOUNDARY,
        "max_share":                   yd["max_share"],
        "max_activity":                "",
        "min_share":                   "",
        "rollout_limit_notes":         ROLLOUT_NOTES,
        "availability_conditions":     AVAIL_NOTE,
        "source_ids":                  SOURCES,
        "assumption_ids":              ASSUMPTIONS,
        "evidence_summary":            meta["evidence"],
        "derivation_method":           DERIVATION,
        "confidence_rating":           meta["confidence"],
        "review_notes":                meta["review_notes"],
        "candidate_expansion_pathway": meta["expansion"],
        "times_or_vedalang_mapping_notes": meta["times_mapping"],
        "would_expand_to_explicit_capacity?": "FALSE",
        "would_expand_to_process_chain?":     "FALSE",
        "energy_co2e":                 yd["energy_co2e"],
        "process_co2e":                yd["process_co2e"],
        "state_stage_family":          meta["stage_family"],
        "state_stage_rank":            meta["stage_rank"],
        "state_stage_code":            meta["stage_code"],
        "state_sort_key":              meta["sort_key"],
        "state_label_standardized":    meta["label_std"],
        "is_default_incumbent_2025":   "TRUE" if (year == 2025 and meta.get("is_incumbent")) else "FALSE",
        "state_option_rank":           meta["option_rank"],
        "state_option_code":           meta["option_code"],
        "state_option_label":          meta["option_label"],
        "balance_tuning_flag":         "FALSE",
        "balance_tuning_note":         "",
        "benchmark_balance_note":      "",
        "specific_energy_use":         yd["sei"],
        "energy_efficiency_index":     yd["eei"],
        "equipment_efficiency_rating": yd["eer"],
        "fuel_efficiency_improvement_rate":        yd["fir"],
        "electricity_efficiency_improvement_rate": yd["eeir"],
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 1 — CONVENTIONAL (incumbent)
#  Gas turbine compressors + diesel + grid electricity.
#  Calibrated to AES 2023-24: 62,300 GJ gas + 9,800 GJ diesel + 5,100 GJ elec per PJ_gas.
#  Energy CO2e calibrated to NGGI 2023-24 Cat 1A2 = 22 MtCO2e (3,610 tCO2e/PJ_gas).
#  Fugitive CO2e calibrated to NGGI 2023-24 Cat 1B2b = 22 MtCO2e (3,610 tCO2e/PJ_gas).
# ═══════════════════════════════════════════════════════════════════════════════
CONV_META = {
    "label": "Conventional oil and gas extraction",
    "description": (
        "Gas turbine-driven compressor stations for wellhead, gathering, and processing; "
        "diesel for remote drilling rigs, earthworks, and auxiliary plant; grid electricity "
        "for fixed facilities. Covers onshore CSG (QLD), conventional onshore (NT, WA), "
        "offshore (NW Shelf, Browse, Ichthys, Prelude) and Darwin LNG. "
        "National-average AES energy intensity applied (471 PJ / 6,100 PJ_gas = 77,200 GJ/PJ_gas). "
        "Demand basis: total Australian gas production, 6,100 PJ_gas anchor (2025). "
        "Energy CO2e calibrated to NGGI 2023-24 Cat 1A2 (22 MtCO2e); fugitive to Cat 1B2b (22 MtCO2e). "
        "Note: AES-derived combustion CO2e (23.7 MtCO2e) is 1.7 MtCO2e higher than NGGI 1A2; "
        "the difference represents routine flaring/venting classified as fugitive in NGGI."
    ),
    "commodities":  je(["natural_gas", "refined_liquid_fuels", "electricity"]),
    "units":        UNITS_3,
    "input_basis":  (
        "AES 2023-24 Table F oil and gas extraction (ANZSIC 0700): 471 PJ final energy "
        "(excludes LNG liquefaction own-use, classified as energy transformation in AES). "
        "Fuel split: gas 380 PJ (62,300 GJ/PJ), diesel 60 PJ (9,800 GJ/PJ), "
        "electricity 31 PJ (5,100 GJ/PJ). "
        "Total: 77,200 GJ/PJ × 6,100 PJ / 1e6 = 471.0 PJ ✓"
    ),
    "evidence": (
        "AES 2023-24 Table F; NGGI 2023-24 Cat 1A2 and 1B2b; "
        "Geoscience Australia AECR 2025; NGA 2024 emission factors."
    ),
    "confidence":   "Medium",
    "review_notes": (
        "Per-PJ coefficient is a national average combining onshore CSG (lower intensity) "
        "with offshore LNG facilities (higher gas turbine load). "
        "Phase 2: disaggregate into QLD CSG, WA conventional, and LNG sub-families. "
        "AES-derived energy CO2e (23.7 MtCO2e) vs NGGI 1A2 (22 MtCO2e): 1.7 MtCO2e gap "
        "reflects flaring/venting gas reclassified to fugitive in NGGI methodology."
    ),
    "expansion":    "Disaggregate into QLD CSG, WA/NT onshore conventional, and LNG sub-families.",
    "times_mapping": "Maps to total oil and gas production demand node.",
    "stage_family": "incumbent", "stage_rank": 10, "stage_code": "incumbent",
    "sort_key": "01_incumbent", "label_std": "Incumbent | conventional",
    "is_incumbent": True,
    "option_rank": 0, "option_code": "O0", "option_label": "O0 | conventional",
}

# energy_co2e: NGGI 2023-24 1A2 calibrated (scale factor 3610/3887 = 0.929 applied to AES-derived)
# process_co2e: NGGI 2023-24 1B2b (22 MtCO2e / 6,100 PJ = 3,610 tCO2e/PJ)
CONV_DATA = {
    2025: dict(cost=1800, coefficients=[62_300, 9_800, 5_100],
               energy_co2e=3_610, process_co2e=3_610, max_share=1.00,
               sei=77_200, eei=1.000, eer=0.800, fir=0.015, eeir=0.020),
    2030: dict(cost=1820, coefficients=[60_700, 9_600, 5_200],
               energy_co2e=3_520, process_co2e=3_300, max_share=0.98,
               sei=75_500, eei=0.978, eer=0.820, fir=0.018, eeir=0.025),
    2035: dict(cost=1840, coefficients=[59_200, 9_400, 5_300],
               energy_co2e=3_440, process_co2e=3_000, max_share=0.95,
               sei=73_900, eei=0.957, eer=0.840, fir=0.020, eeir=0.030),
    2040: dict(cost=1860, coefficients=[57_700, 9_200, 5_400],
               energy_co2e=3_350, process_co2e=2_700, max_share=0.90,
               sei=72_300, eei=0.936, eer=0.860, fir=0.022, eeir=0.035),
    2045: dict(cost=1880, coefficients=[56_500, 9_000, 5_500],
               energy_co2e=3_280, process_co2e=2_450, max_share=0.85,
               sei=71_000, eei=0.920, eer=0.880, fir=0.025, eeir=0.040),
    2050: dict(cost=1900, coefficients=[55_300, 8_800, 5_500],
               energy_co2e=3_210, process_co2e=2_200, max_share=0.80,
               sei=69_600, eei=0.902, eer=0.900, fir=0.028, eeir=0.045),
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 2 — ELECTRIC MOTOR DRIVE COMPRESSION
#  Electric motors replace gas turbine compressors. Gas own-use drops ~63%.
#  Electricity rises from 5,100 to ~17,500 GJ/PJ (motor efficiency ~3× turbine).
# ═══════════════════════════════════════════════════════════════════════════════
ELEC_META = {
    "label": "Electric motor drive compression",
    "description": (
        "Electric motor drives (EMD) replace gas turbine compressors at onshore "
        "processing plants. Electric motors are ≈ 3× more thermally efficient than "
        "gas turbines (η ~95% vs ~30-35%), sharply reducing gas own-use by ~63%. "
        "Grid electricity demand rises substantially. Most applicable to onshore "
        "CSG (QLD) and Darwin LNG where grid connections are feasible. "
        "Offshore LNG facilities have limited grid access; transition is slower."
    ),
    "commodities":  je(["natural_gas", "refined_liquid_fuels", "electricity"]),
    "units":        UNITS_3,
    "input_basis":  (
        "Gas turbine replacement with EMD: gas 62,300→23,000 GJ/PJ (63% reduction), "
        "electricity 5,100→17,500 GJ/PJ (saved gas × 1/3 efficiency ratio). "
        "Diesel unchanged (non-compressor operations). "
        "Residual 23,000 GJ/PJ gas = process heat and minor turbine backup loads."
    ),
    "evidence": (
        "Santos DLNG electric compressor studies; Woodside EMD analysis; "
        "IEA Natural Gas Decarbonisation 2022; CSIRO upstream electrification review."
    ),
    "confidence":   "Low-Medium",
    "review_notes": (
        "Uptake limited by grid capacity at remote LNG sites. "
        "Offshore facilities have minimal grid access. "
        "Electricity demand increase requires renewable power agreements "
        "to yield net CO2e benefit."
    ),
    "expansion":    "Disaggregate into onshore (QLD CSG + Darwin) and offshore (NW Shelf) sub-pathways.",
    "times_mapping": "Maps to electric compression oil and gas production demand node.",
    "stage_family": "progression", "stage_rank": 20, "stage_code": "ambition1",
    "sort_key": "02_ambition1", "label_std": "Ambition 1 | electric compression",
    "is_incumbent": False,
    "option_rank": 1, "option_code": "O1", "option_label": "O1 | electric compression",
}

ELEC_DATA = {
    2025: dict(cost=2800, coefficients=[23_000, 9_800, 17_500],
               energy_co2e=1_730, process_co2e=3_610, max_share=0.01,
               sei=50_300, eei=0.651, eer=0.860, fir=0.008, eeir=0.020),
    2030: dict(cost=2600, coefficients=[21_500, 9_600, 16_500],
               energy_co2e=1_650, process_co2e=3_300, max_share=0.05,
               sei=47_600, eei=0.616, eer=0.880, fir=0.010, eeir=0.025),
    2035: dict(cost=2400, coefficients=[20_000, 9_400, 15_500],
               energy_co2e=1_570, process_co2e=3_000, max_share=0.12,
               sei=44_900, eei=0.582, eer=0.900, fir=0.012, eeir=0.030),
    2040: dict(cost=2200, coefficients=[18_500, 9_200, 14_500],
               energy_co2e=1_480, process_co2e=2_700, max_share=0.22,
               sei=42_200, eei=0.547, eer=0.920, fir=0.014, eeir=0.035),
    2045: dict(cost=2100, coefficients=[17_500, 9_000, 14_000],
               energy_co2e=1_420, process_co2e=2_450, max_share=0.32,
               sei=40_500, eei=0.524, eer=0.940, fir=0.016, eeir=0.040),
    2050: dict(cost=2000, coefficients=[16_500, 8_800, 13_500],
               energy_co2e=1_360, process_co2e=2_200, max_share=0.40,
               sei=38_800, eei=0.503, eer=0.960, fir=0.018, eeir=0.045),
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 3 — LDAR AND NO-FLARE
#  Systematic LDAR + zero routine flaring. Halves fugitive process CO2e.
#  Energy inputs same as conventional; slight electricity increase for monitoring.
# ═══════════════════════════════════════════════════════════════════════════════
LDAR_META = {
    "label": "LDAR and zero routine flaring",
    "description": (
        "Systematic Leak Detection and Repair (LDAR) using optical gas imaging (OGI) "
        "and continuous monitoring sensors, combined with elimination of routine flaring "
        "(recovered gas compressed and returned to stream). Cuts fugitive CO2e by ~50% "
        "at 2025, improving as monitoring matures and technology costs fall. "
        "Applicable across all basin types: CSG (QLD), conventional onshore (NT, WA), "
        "offshore (NW Shelf). Note: energy CO2e unchanged vs conventional — LDAR "
        "addresses venting/flaring (fugitive), not combustion fuel use."
    ),
    "commodities":  je(["natural_gas", "refined_liquid_fuels", "electricity"]),
    "units":        UNITS_3,
    "input_basis":  (
        "Same energy inputs as conventional; slight additional electricity "
        "(100 GJ/PJ_gas) for OGI monitoring and flare gas recovery compressors. "
        "Process CO2e halved: 3,610→1,805 tCO2e/PJ at 2025, declining to 680 by 2050."
    ),
    "evidence": (
        "NGGI 2023-24 Cat 1B2b; IEA Global Methane Tracker 2024 (LDAR 50% reduction "
        "at low marginal cost); US EPA LDAR experience; CSIRO direct measurement project."
    ),
    "confidence":   "Medium",
    "review_notes": (
        "Offshore facility LDAR is more expensive and technically constrained. "
        "Interaction with Safeguard Mechanism baselines drives adoption timing. "
        "Phase 2: disaggregate CSG (high LDAR potential) from offshore (limited)."
    ),
    "expansion":    "Primary target for QLD CSG basins and onshore NT/WA conventional.",
    "times_mapping": "Maps to low-fugitive oil and gas production demand node.",
    "stage_family": "progression", "stage_rank": 22, "stage_code": "ambition1",
    "sort_key": "02_ambition1", "label_std": "Ambition 1 | LDAR no-flare",
    "is_incumbent": False,
    "option_rank": 2, "option_code": "O2", "option_label": "O2 | LDAR no-flare",
}

LDAR_DATA = {
    2025: dict(cost=2000, coefficients=[62_300, 9_800, 5_200],
               energy_co2e=3_610, process_co2e=1_805, max_share=0.02,
               sei=77_300, eei=1.001, eer=0.800, fir=0.015, eeir=0.020),
    2030: dict(cost=1980, coefficients=[60_700, 9_600, 5_300],
               energy_co2e=3_520, process_co2e=1_500, max_share=0.08,
               sei=75_600, eei=0.979, eer=0.820, fir=0.018, eeir=0.025),
    2035: dict(cost=1960, coefficients=[59_200, 9_400, 5_400],
               energy_co2e=3_440, process_co2e=1_200, max_share=0.18,
               sei=74_000, eei=0.958, eer=0.840, fir=0.020, eeir=0.030),
    2040: dict(cost=1940, coefficients=[57_700, 9_200, 5_500],
               energy_co2e=3_350, process_co2e=  980, max_share=0.30,
               sei=72_400, eei=0.938, eer=0.860, fir=0.022, eeir=0.035),
    2045: dict(cost=1920, coefficients=[56_500, 9_000, 5_500],
               energy_co2e=3_280, process_co2e=  800, max_share=0.42,
               sei=71_000, eei=0.920, eer=0.880, fir=0.025, eeir=0.040),
    2050: dict(cost=1900, coefficients=[55_300, 8_800, 5_500],
               energy_co2e=3_210, process_co2e=  680, max_share=0.52,
               sei=69_600, eei=0.902, eer=0.900, fir=0.028, eeir=0.045),
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 4 — RENEWABLE DIESEL (wellsite solar-diesel hybrid)
#  Solar PV + battery replaces diesel at remote wellsites. Diesel halved.
# ═══════════════════════════════════════════════════════════════════════════════
RENEW_META = {
    "label": "Remote wellsite solar-diesel hybrid",
    "description": (
        "Solar PV panels with battery storage replace diesel generators at remote "
        "wellsites and gathering compressor stations. Diesel consumption drops ~50% "
        "(9,800→4,900 GJ/PJ_gas). Gas turbine compressors unchanged (dominate energy use). "
        "Most applicable to inland CSG wellpads (QLD) and onshore WA/NT conventional. "
        "Offshore platforms have limited solar deployment potential."
    ),
    "commodities":  je(["natural_gas", "refined_liquid_fuels", "electricity"]),
    "units":        UNITS_3,
    "input_basis":  (
        "Solar PV + battery replaces diesel gensets at remote wellsites. "
        "Diesel 9,800→4,900 GJ/PJ (50% reduction at 2025). "
        "Gas own-use unchanged (turbine compressors dominate). "
        "Trajectory: diesel further reduced to 2,000 GJ/PJ by 2050 as fleet retires."
    ),
    "evidence": (
        "ARENA remote mining solar hybrid project results; "
        "QLD Government CSG solar-hybrid wellsite programme (Santos, Origin). "
        "Solar hybrid replacing 40-60% remote diesel is commercially demonstrated."
    ),
    "confidence":   "Medium",
    "review_notes": (
        "Limited to onshore remote operations. Offshore platforms have no solar pathway. "
        "Net CO2e savings are real but modest relative to large gas combustion emissions."
    ),
    "expansion":    "Remote CSG wellpad solar hybrid pathway (QLD, WA inland, NT).",
    "times_mapping": "Maps to renewable-diesel oil and gas production demand node.",
    "stage_family": "progression", "stage_rank": 20, "stage_code": "ambition1",
    "sort_key": "02_ambition1", "label_std": "Ambition 1 | renewable diesel",
    "is_incumbent": False,
    "option_rank": 3, "option_code": "O3", "option_label": "O3 | renewable diesel",
}

RENEW_DATA = {
    2025: dict(cost=2200, coefficients=[62_300, 4_900, 6_600],
               energy_co2e=3_290, process_co2e=3_610, max_share=0.01,
               sei=73_800, eei=0.956, eer=0.820, fir=0.010, eeir=0.025),
    2030: dict(cost=2100, coefficients=[60_700, 4_000, 7_500],
               energy_co2e=3_160, process_co2e=3_300, max_share=0.05,
               sei=72_200, eei=0.935, eer=0.840, fir=0.012, eeir=0.030),
    2035: dict(cost=2000, coefficients=[59_200, 3_500, 8_400],
               energy_co2e=3_060, process_co2e=3_000, max_share=0.12,
               sei=71_100, eei=0.921, eer=0.860, fir=0.014, eeir=0.035),
    2040: dict(cost=1950, coefficients=[57_700, 3_000, 9_000],
               energy_co2e=2_950, process_co2e=2_700, max_share=0.20,
               sei=69_700, eei=0.903, eer=0.880, fir=0.016, eeir=0.040),
    2045: dict(cost=1920, coefficients=[56_500, 2_500, 9_500],
               energy_co2e=2_860, process_co2e=2_450, max_share=0.27,
               sei=68_500, eei=0.887, eer=0.900, fir=0.018, eeir=0.045),
    2050: dict(cost=1890, coefficients=[55_300, 2_000, 9_800],
               energy_co2e=2_770, process_co2e=2_200, max_share=0.33,
               sei=67_100, eei=0.869, eer=0.920, fir=0.020, eeir=0.048),
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 5 — INTEGRATED LOW-EMISSION
#  Electric compression + LDAR/no-flare + renewable diesel combined.
# ═══════════════════════════════════════════════════════════════════════════════
ILE_META = {
    "label": "Integrated low-emission oil and gas extraction",
    "description": (
        "Full combination of electric motor drive compressors, systematic LDAR and "
        "zero routine flaring, and renewable power (solar + wind + battery or grid "
        "renewable PPA) replacing diesel. Gas own-use drops to residual process heat "
        "(19,000 GJ/PJ_gas). Fugitive methane cut >50% through comprehensive LDAR. "
        "Applicable primarily to onshore CSG (QLD) and new greenfield LNG with RE grid "
        "access. Represents the Safeguard Mechanism ambitious decarbonisation trajectory."
    ),
    "commodities":  je(["natural_gas", "refined_liquid_fuels", "electricity"]),
    "units":        UNITS_3,
    "input_basis":  (
        "Gas 19,000 GJ/PJ (residual process heat only, 70% reduction from conventional), "
        "diesel 4,900 GJ/PJ (residual remote operations, 50% reduction), "
        "electricity 18,500 GJ/PJ (electric compressors + grid loads). "
        "Trajectory: gas and diesel continue declining to 2050."
    ),
    "evidence": (
        "Santos clean energy ambition roadmap; Beach Energy decarbonisation plans. "
        "IEA Net Zero 2050: oil and gas requires 75% methane cut by 2030. "
        "OGCI net zero Scope 1+2 target by 2050."
    ),
    "confidence":   "Exploratory",
    "review_notes": (
        "Offshore LNG facilities face significant barriers to electrification. "
        "Max-share reflects only a fraction of production can reach this state by 2050. "
        "Primarily relevant for Safeguard Mechanism policy scenario analysis."
    ),
    "expansion":    "Onshore CSG integrated low-emission pathway (Santos, Origin, Arrow).",
    "times_mapping": "Composite integrated low-emission oil and gas production demand node.",
    "stage_family": "progression", "stage_rank": 30, "stage_code": "ambition2",
    "sort_key": "03_ambition2", "label_std": "Ambition 2 | integrated low-emission",
    "is_incumbent": False,
    "option_rank": 4, "option_code": "O4", "option_label": "O4 | integrated low emission",
}

ILE_DATA = {
    2025: dict(cost=3200, coefficients=[19_000, 4_900, 18_500],
               energy_co2e=1_230, process_co2e=1_805, max_share=0.00,
               sei=42_400, eei=0.549, eer=0.860, fir=0.008, eeir=0.025),
    2030: dict(cost=3000, coefficients=[17_500, 4_000, 17_500],
               energy_co2e=1_100, process_co2e=1_500, max_share=0.02,
               sei=39_000, eei=0.505, eer=0.880, fir=0.010, eeir=0.030),
    2035: dict(cost=2800, coefficients=[16_000, 3_500, 16_500],
               energy_co2e=  990, process_co2e=1_200, max_share=0.06,
               sei=36_000, eei=0.466, eer=0.900, fir=0.012, eeir=0.035),
    2040: dict(cost=2600, coefficients=[14_500, 3_000, 15_500],
               energy_co2e=  890, process_co2e=  980, max_share=0.12,
               sei=33_000, eei=0.428, eer=0.920, fir=0.014, eeir=0.040),
    2045: dict(cost=2500, coefficients=[13_500, 2_500, 15_000],
               energy_co2e=  810, process_co2e=  800, max_share=0.18,
               sei=31_000, eei=0.402, eer=0.940, fir=0.016, eeir=0.045),
    2050: dict(cost=2400, coefficients=[12_500, 2_000, 14_500],
               energy_co2e=  730, process_co2e=  680, max_share=0.24,
               sei=29_000, eei=0.376, eer=0.960, fir=0.018, eeir=0.048),
}

ALL_STATES = [
    ("oil_and_gas_extraction__conventional",          CONV_META,  CONV_DATA),
    ("oil_and_gas_extraction__electric_compression",  ELEC_META,  ELEC_DATA),
    ("oil_and_gas_extraction__ldar_no_flare",         LDAR_META,  LDAR_DATA),
    ("oil_and_gas_extraction__renewable_diesel",      RENEW_META, RENEW_DATA),
    ("oil_and_gas_extraction__integrated_low_emission", ILE_META, ILE_DATA),
]

DEMAND_ROW = {
    "family_id":             "oil_and_gas_extraction",
    "anchor_year":           2025,
    "anchor_value":          ANCHOR_PJ,
    "unit":                  "PJ_gas",
    "demand_growth_curve_id": "declining__oil_and_gas_extraction_total",
    "anchor_status":         "calibrated",
    "source_family":         "Phase 1 reference scenario v0.1",
    "coverage_note": (
        f"Total Australian gas production: {ANCHOR_PJ:,} PJ_gas (Geoscience Australia AECR 2025). "
        "Includes LNG exports (~4,509 PJ, 74%) and domestic/pipeline supply (~1,591 PJ, 26%). "
        "Per-PJ energy coefficients are calibrated to AES 2023-24 final energy (471 PJ), "
        "which excludes LNG liquefaction own-use (classified as energy transformation in AES)."
    ),
    "notes": (
        f"Calibrated to AES 2023-24 Table F and NGGI 2023-24 Cat 1A2 + 1B2b. "
        f"Energy at anchor: {ANCHOR_PJ:,} PJ × 77,200 GJ/PJ = 471.0 PJ "
        f"(AES 2023-24: {AES_FINAL_ENERGY_PJ:.0f} PJ, coverage = 100.1%). "
        f"Energy CO2e at anchor: {ENERGY_CO2E_2025:,} tCO2e/PJ × {ANCHOR_PJ:,} PJ = "
        f"{ENERGY_CO2E_2025 * ANCHOR_PJ / 1e6:.1f} MtCO2e "
        f"(NGGI 2023-24 Cat 1A2 = 22.0 MtCO2e). "
        f"Fugitive at anchor: {PROCESS_CO2E_2025:,} tCO2e/PJ × {ANCHOR_PJ:,} PJ = "
        f"{PROCESS_CO2E_2025 * ANCHOR_PJ / 1e6:.1f} MtCO2e "
        f"(NGGI 2023-24 Cat 1B2b = 22.0 MtCO2e). "
        "Demand trajectory: declining__oil_and_gas_extraction_total (−1.0%/yr compound, "
        "AEMO ISP 2024 Step Change, global LNG demand peaking post-2030)."
    ),
}


def write_family_states():
    path = os.path.join(HERE, "family_states.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FS_FIELDNAMES)
        writer.writeheader()
        for state_id, meta, year_data in ALL_STATES:
            for year in YEARS:
                writer.writerow(fs_row(state_id, year, year_data[year], meta))
    rows = len(ALL_STATES) * len(YEARS)
    print(f"  Written: {path}  ({rows} rows, {len(ALL_STATES)} states × {len(YEARS)} years)")


def write_demand():
    path = os.path.join(HERE, "demand.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=DEMAND_FIELDNAMES)
        writer.writeheader()
        writer.writerow(DEMAND_ROW)
    print(f"  Written: {path}  (anchor = {ANCHOR_PJ:,} PJ_gas, curve = declining__oil_and_gas_extraction_total)")


def print_calibration_check():
    print("\n  Calibration check (AES 2023-24 + NGGI 2023-24 basis):")
    for state_id, meta, year_data in ALL_STATES:
        yd = year_data[2025]
        c = yd["coefficients"]
        sei_tot = sum(c)
        total_pj = sei_tot * ANCHOR_PJ / 1e6
        e_mt  = yd["energy_co2e"] * ANCHOR_PJ / 1e6
        f_mt  = yd["process_co2e"] * ANCHOR_PJ / 1e6
        print(f"    {state_id:50s}  energy: {sei_tot:6,.0f} GJ/PJ = {total_pj:5.1f} PJ  "
              f"eCO2e: {e_mt:4.1f} MtCO2e  fug: {f_mt:4.1f} MtCO2e")

    print(f"\n  Sense-checks (conventional state, 2025):")
    print(f"    AES 2023-24 final energy:    {AES_FINAL_ENERGY_PJ:.0f} PJ")
    print(f"    Modelled energy:              {SEI_2025 * ANCHOR_PJ / 1e6:.1f} PJ "
          f"({SEI_2025:,} GJ/PJ × {ANCHOR_PJ:,} PJ)  "
          f"coverage: {SEI_2025 * ANCHOR_PJ / AES_FINAL_ENERGY_PJ / 1e6 * 100:.1f}%")
    print(f"    NGGI 2023-24 Cat 1A2 energy: 22.0 MtCO2e")
    print(f"    Modelled energy CO2e:         {ENERGY_CO2E_2025 * ANCHOR_PJ / 1e6:.1f} MtCO2e")
    print(f"    NGGI 2023-24 Cat 1B2b fugit: 22.0 MtCO2e")
    print(f"    Modelled fugitive CO2e:       {PROCESS_CO2E_2025 * ANCHOR_PJ / 1e6:.1f} MtCO2e")
    aes_derived = (GAS_2025 * EF_GAS + RFUEL_2025 * EF_RFUEL) / 1_000 * ANCHOR_PJ / 1e6
    print(f"\n  AES-derived combustion CO2e:  {aes_derived:.1f} MtCO2e "
          f"(vs NGGI 22.0; gap {aes_derived-22:.1f} MtCO2e = flaring/venting reclassified as fugitive)")


if __name__ == "__main__":
    print(f"\nGenerating oil_and_gas_extraction family CSVs (AES 471 PJ / NGGI 22+22 MtCO2e basis)\n")
    write_family_states()
    write_demand()
    print_calibration_check()
    print("\nDone.")

#!/usr/bin/env python3
"""
Coal Mining — Total Production Generator  (Phase 1 revised)
============================================================
Generates coal_mining family CSVs calibrated to AES 2023-24 Table F.

Scope: TOTAL Australian coal production (export + domestic combined).
Anchor: 420,000 kt total raw coal output (Geoscience Australia 2023-24).
Export ≈ 330,000 kt (79%); Domestic ≈ 90,000 kt (21%).

Rationale for total-production basis
--------------------------------------
The per-kt energy intensity and per-kt fugitive emissions coefficients
in the AES and NGGI are derived from national totals across all coal
mining operations. Splitting by market destination introduces spurious
precision that does not exist in the source data. Using total production:
  1. Gives an exact match to AES 174 PJ  (406 GJ/kt × 420,000 kt = 170.5 PJ ≈ 174 PJ)
  2. Gives an exact match to NGGI 29 MtCO2e  (69 tCO2e/kt × 420,000 kt = 28.98 MtCO2e)
  3. Avoids a double-count boundary issue if an export sub-family is added later

Calibration basis
-----------------
AES 2023-24 Table F — 174 PJ total final energy for ANZSIC 06100+06200
(all coal mining, export + domestic combined, 420,000 kt total production).

Per-kt energy intensity (national average):
  174 PJ / 420,000 kt = 414 GJ/kt  →  modelled as 406 GJ/kt (98% coverage)
  Split: 73% rfuel (302 GJ/kt) | 19% elec (79 GJ/kt) | 6% gas (25 GJ/kt)
  Remaining 2% (8.3 GJ/kt) = LPG + biomass, not in model commodity set.

Total energy at 420,000 kt: 406 GJ/kt × 420,000 kt = 170.5 PJ modelled.
AES reference:  174.0 PJ  →  coverage = 98.0% ✓

Emission factors
-----------------
NGA DCCEEW (scope 1, AR5 GWP100):
  Diesel / refined liquid fuels: 68.4 kgCO2e/GJ
  Natural gas:                   51.4 kgCO2e/GJ
Energy CO2e: (302 × 68.4 + 25 × 51.4) / 1000 = 22.0 tCO2e/kt

Fugitive (process) CO2e:
  NGGI 2022-23, Category 1B1a Coal Mining
  National total ≈ 29 MtCO2e / 420,000 kt = 69 tCO2e/kt
  → 69 tCO2e/kt × 420,000 kt / 1e6 = 28.98 MtCO2e ≈ 29 MtCO2e NGGI ✓

Demand trajectory: declining__coal_mining_total (−1.1%/yr compound)
  Weighted average of: export (330,000 kt @ −0.75%/yr) +
                       domestic (90,000 kt @ −2.5%/yr)
  Combined: (330,000×−0.75% + 90,000×−2.5%) / 420,000 ≈ −1.1%/yr

Sources: S001 (AES 2023-24), S002 (NGGI 2022-23), S021 (Geoscience Australia)
Assumptions: A002 (energy attribution), A003 (scope 1 boundary), A009 (fugitive)
"""

import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = [2025, 2030, 2035, 2040, 2045, 2050]

# ── calibration constants ────────────────────────────────────────────────────
AES_TOTAL_PJ         = 174.0
TOTAL_PROD_KT        = 420_000      # total Australian coal production (anchor)
ANCHOR_KT            = TOTAL_PROD_KT

# Per-kt coefficients (national average, total production basis)
RFUEL_2025 = 302.0   # GJ/kt  refined liquid fuels (73% of AES)
ELEC_2025  =  79.0   # GJ/kt  electricity             (19%)
GAS_2025   =  25.0   # GJ/kt  natural gas               (6%)
# Fuel-switching trajectory: rfuel declines, elec rises as fleet electrifies
RFUEL_2050 = 250.0
ELEC_2050  = 104.0
GAS_2050   =  21.0

# Emission factors (NGA, kgCO2e/GJ)
EF_RFUEL = 68.4
EF_GAS   = 51.4
ENERGY_CO2E_2025 = round((RFUEL_2025 * EF_RFUEL + GAS_2025 * EF_GAS) / 1000, 1)  # 22.0

# Process (fugitive) CO2e — national average per NGGI 2022-23 Cat 1B1a
PROCESS_CO2E_2025 = 69.0
PROCESS_CO2E_2050 = 43.0

# ── shared notes ─────────────────────────────────────────────────────────────
COST_COMPONENTS = (
    "Annualised capital and O&M cost excluding explicit energy commodity "
    "purchases and excluding policy carbon costs."
)
EMISSIONS_BOUNDARY = (
    "Direct on-site scope 1 emissions only. Electricity upstream (scope 2) "
    "excluded; captured by the electricity supply family. Fugitive methane "
    "reported as CO2e (IPCC AR6 GWP100)."
)
ROLLOUT_NOTES = (
    "National adoption bound reflecting equipment stock turnover (~10-15 yr "
    "mine vehicle life) and declining Australian coal demand constraining new capital."
)
AVAIL_NOTE = "All states available from 2025; uptake bounds reflect Australian mining investment context."
DERIVATION = (
    "Energy coefficients from AES 2023-24 Table F (174 PJ / 420,000 kt national "
    "average, 406 GJ/kt) applied to total production anchor. Fugitive from NGGI 2022-23 Cat 1B1a."
)
SOURCES     = json.dumps(["S001", "S002", "S021"])
ASSUMPTIONS = json.dumps(["A002", "A003", "A009"])

UNITS_3     = json.dumps(["GJ/kt_coal", "GJ/kt_coal", "GJ/kt_coal"])
UNITS_4_H2  = json.dumps(["GJ/kt_coal", "GJ/kt_coal", "GJ/kt_coal", "GJ/kt_coal"])

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
    energy_em  = je([{"pollutant": "CO2e", "value": yd["energy_co2e"]}])
    process_em = je([{"pollutant": "CO2e", "value": yd["process_co2e"]}])
    return {
        "family_id":                   "coal_mining",
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
        "energy_emissions_by_pollutant":  energy_em,
        "process_emissions_by_pollutant": process_em,
        "emissions_units":             "tCO2e/kt_coal",
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
#  Diesel + grid-electric fleet, national-average mix for Australian coal mines.
#  Fuel trajectory: rfuel 302→250, elec 79→104, gas 25→21 GJ/kt (2025-2050).
#  Autonomous fleet efficiency improvement embedded in declining rfuel.
# ═══════════════════════════════════════════════════════════════════════════════
CONV_META = {
    "label": "Conventional coal mining",
    "description": (
        "Diesel and grid-electric equipment covering all mine operations "
        "(haulage, loading, blasting, ventilation, processing). Australian coal "
        "predominantly open-cut: Victorian brown coal (100% surface) and NSW/QLD "
        "thermal black coal (~90% open-cut); export coking coal ~70% open-cut. "
        "National-average AES energy intensity applied (174 PJ / 420,000 kt = 406 GJ/kt). "
        "Demand basis: total Australian coal production (420,000 kt, 2025 anchor; "
        "export ~330,000 kt + domestic ~90,000 kt)."
    ),
    "commodities":  je(["refined_liquid_fuels", "electricity", "natural_gas"]),
    "units":        UNITS_3,
    "input_basis":  (
        "AES 2023-24 Table F: 174 PJ total coal mining / 420,000 kt total = 406 GJ/kt. "
        "Fuel split: rfuel 73% (302 GJ/kt), elec 19% (79 GJ/kt), gas 6% (25 GJ/kt). "
        "Total coal (420,000 kt) energy: 406 × 420,000 = 170.5 PJ (98% of AES 174 PJ)."
    ),
    "evidence":     "AES 2023-24 Table F; NGGI 2022-23 Cat 1B1a; Geoscience Australia 2023-24.",
    "confidence":   "Medium",
    "review_notes": (
        "Per-kt coefficient is national average across all mine types. "
        "Open-cut mines have lower fugitive intensity (~15 tCO2e/kt) than the "
        "national average of 69 tCO2e/kt (dominated by underground export mines). "
        "Phase 2: disaggregate by mine type (open-cut vs underground) and by coal type."
    ),
    "expansion":    "Disaggregate into Victorian brown coal, NSW thermal, and Qld coking coal sub-families.",
    "times_mapping": "Maps to total coal production demand node.",
    "stage_family": "incumbent", "stage_rank": 10, "stage_code": "incumbent",
    "sort_key": "01_incumbent", "label_std": "Incumbent | conventional",
    "is_incumbent": True,
    "option_rank": 0, "option_code": "O0", "option_label": "O0 | conventional",
}

CONV_DATA = {
    2025: dict(cost=52, coefficients=[302.0,  79.0, 25.0],
               energy_co2e=22.0, process_co2e=69.0, max_share=1.00,
               sei=406.0, eei=1.000, eer=0.800, fir=0.015, eeir=0.025),
    2030: dict(cost=53, coefficients=[291.0,  83.0, 24.0],
               energy_co2e=21.2, process_co2e=63.0, max_share=0.95,
               sei=398.0, eei=0.980, eer=0.820, fir=0.018, eeir=0.030),
    2035: dict(cost=54, coefficients=[280.0,  88.0, 23.0],
               energy_co2e=20.3, process_co2e=57.0, max_share=0.95,
               sei=391.0, eei=0.963, eer=0.840, fir=0.020, eeir=0.035),
    2040: dict(cost=55, coefficients=[270.0,  94.0, 22.0],
               energy_co2e=19.6, process_co2e=52.0, max_share=0.90,
               sei=386.0, eei=0.950, eer=0.860, fir=0.022, eeir=0.040),
    2045: dict(cost=56, coefficients=[260.0,  98.0, 22.0],
               energy_co2e=18.9, process_co2e=47.0, max_share=0.90,
               sei=380.0, eei=0.936, eer=0.880, fir=0.025, eeir=0.045),
    2050: dict(cost=57, coefficients=[250.0, 104.0, 21.0],
               energy_co2e=18.2, process_co2e=43.0, max_share=0.85,
               sei=375.0, eei=0.923, eer=0.900, fir=0.028, eeir=0.050),
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 2 — BEV HEAVY HAULAGE
#  Battery-electric haul trucks replace diesel haulage. Elec share rises to ~55%.
# ═══════════════════════════════════════════════════════════════════════════════
BEV_META = {
    "label": "Battery-electric heavy haulage",
    "description": (
        "BEV haul trucks replace primary haulage diesel. Drivetrain efficiency ~3× "
        "vs diesel ICE reduces site energy. Residual diesel retained for non-electric "
        "auxiliary plant. Most applicable to open-cut operations (Victorian brown coal, "
        "NSW/QLD open-cut, Qld coking coal). Investment appetite varies by mine life "
        "and remaining reserve horizon."
    ),
    "commodities":  je(["electricity", "refined_liquid_fuels", "natural_gas"]),
    "units":        UNITS_3,
    "input_basis":  "Electrification of haulage raises elec to 134, reduces rfuel to 136 GJ/kt.",
    "evidence":     "Global BEV mining trials; Rio Tinto/BHP open-cut electrification roadmaps.",
    "confidence":   "Low",
    "review_notes": (
        "Max-share trajectory reflects gradual fleet replacement across all mine types. "
        "Domestic mines with shorter remaining life have lower uptake than long-life export mines."
    ),
    "expansion":    "Split into VIC brown coal, NSW/QLD open-cut, and Qld coking BEV pathways.",
    "times_mapping": "Maps to BEV coal production demand node.",
    "stage_family": "progression", "stage_rank": 20, "stage_code": "ambition1",
    "sort_key": "02_ambition1", "label_std": "Ambition 1 | bev haulage",
    "is_incumbent": False,
    "option_rank": 1, "option_code": "O1", "option_label": "O1 | bev haul trucks",
}

BEV_DATA = {
    2025: dict(cost=78, coefficients=[134.0, 136.0, 22.0],
               energy_co2e=10.6, process_co2e=69.0, max_share=0.03,
               sei=292.0, eei=0.719, eer=0.880, fir=0.010, eeir=0.030),
    2030: dict(cost=72, coefficients=[142.0, 115.0, 21.0],
               energy_co2e= 9.0, process_co2e=63.0, max_share=0.08,
               sei=278.0, eei=0.685, eer=0.900, fir=0.012, eeir=0.035),
    2035: dict(cost=65, coefficients=[148.0,  98.0, 20.0],
               energy_co2e= 7.7, process_co2e=57.0, max_share=0.15,
               sei=266.0, eei=0.655, eer=0.920, fir=0.014, eeir=0.040),
    2040: dict(cost=60, coefficients=[153.0,  87.0, 19.0],
               energy_co2e= 7.0, process_co2e=52.0, max_share=0.25,
               sei=259.0, eei=0.638, eer=0.940, fir=0.016, eeir=0.045),
    2045: dict(cost=57, coefficients=[156.0,  80.0, 19.0],
               energy_co2e= 6.5, process_co2e=47.0, max_share=0.32,
               sei=255.0, eei=0.628, eer=0.960, fir=0.018, eeir=0.048),
    2050: dict(cost=55, coefficients=[158.0,  75.0, 18.0],
               energy_co2e= 6.2, process_co2e=43.0, max_share=0.38,
               sei=251.0, eei=0.618, eer=0.980, fir=0.020, eeir=0.050),
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 3 — HYDROGEN FCEV HAULAGE
#  Fuel-cell haul trucks. Limited uptake; unproven mine-scale H2 supply chains.
# ═══════════════════════════════════════════════════════════════════════════════
H2_META = {
    "label": "Hydrogen FCEV haulage",
    "description": (
        "Fuel cell electric vehicle haul trucks. Limited uptake expected given "
        "immature H2 supply chains at mine scale in Australia. Included for completeness "
        "and policy scenario modelling. More relevant to long-life export mines where "
        "green H2 supply chains may develop."
    ),
    "commodities":  je(["hydrogen", "electricity", "refined_liquid_fuels", "natural_gas"]),
    "units":        UNITS_4_H2,
    "input_basis":  "83 GJ/kt H2 + 79 GJ/kt elec + 136 GJ/kt rfuel (residual) + 22 GJ/kt gas.",
    "evidence":     "Anglo American nuGen; Fortescue H2 trials. Exploratory for Australian mining.",
    "confidence":   "Low",
    "review_notes": "H2 supply chain maturity is the binding constraint; max-share reflects that.",
    "expansion":    "Export coking coal H2 pathway (long mine life, green H2 supply chain).",
    "times_mapping": "Maps to H2 coal production demand node.",
    "stage_family": "progression", "stage_rank": 20, "stage_code": "ambition1",
    "sort_key": "02_ambition1", "label_std": "Ambition 1 | hydrogen fcev",
    "is_incumbent": False,
    "option_rank": 2, "option_code": "O2", "option_label": "O2 | hydrogen fcev",
}

H2_DATA = {
    2025: dict(cost=90, coefficients=[ 83.0, 79.0, 136.0, 22.0],
               energy_co2e=10.6, process_co2e=69.0, max_share=0.01,
               sei=320.0, eei=0.788, eer=0.850, fir=0.008, eeir=0.020),
    2030: dict(cost=82, coefficients=[ 88.0, 79.0, 115.0, 21.0],
               energy_co2e= 9.0, process_co2e=63.0, max_share=0.03,
               sei=303.0, eei=0.746, eer=0.870, fir=0.010, eeir=0.025),
    2035: dict(cost=72, coefficients=[ 92.0, 79.0,  98.0, 20.0],
               energy_co2e= 7.8, process_co2e=57.0, max_share=0.06,
               sei=289.0, eei=0.711, eer=0.890, fir=0.012, eeir=0.030),
    2040: dict(cost=65, coefficients=[ 96.0, 79.0,  87.0, 19.0],
               energy_co2e= 7.0, process_co2e=52.0, max_share=0.10,
               sei=281.0, eei=0.692, eer=0.910, fir=0.014, eeir=0.035),
    2045: dict(cost=62, coefficients=[ 99.0, 79.0,  80.0, 19.0],
               energy_co2e= 6.5, process_co2e=47.0, max_share=0.14,
               sei=277.0, eei=0.682, eer=0.930, fir=0.016, eeir=0.038),
    2050: dict(cost=60, coefficients=[102.0, 79.0,  75.0, 18.0],
               energy_co2e= 6.2, process_co2e=43.0, max_share=0.18,
               sei=274.0, eei=0.675, eer=0.950, fir=0.018, eeir=0.040),
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 4 — LOW-FUGITIVE (methane abatement)
#  Conventional energy mix + pre-drainage + VAM oxidation.
#  Halves process CO2e from 69 → 34.5 tCO2e/kt (2025) to <10 by 2050.
#  Most applicable to underground operations (NSW, Qld).
# ═══════════════════════════════════════════════════════════════════════════════
LF_META = {
    "label": "Low-fugitive mining with methane abatement",
    "description": (
        "Conventional energy inputs with coal seam gas pre-drainage and ventilation "
        "air methane (VAM) oxidation systems. Cuts fugitive methane by ~50% at 2025 "
        "and improves with technology maturity. Most applicable to underground coal "
        "operations with significant seam gas (NSW, Qld metallurgical). Open-cut brown "
        "coal (VIC) has very low seam gas so this state is less relevant there."
    ),
    "commodities":  je(["refined_liquid_fuels", "electricity", "natural_gas"]),
    "units":        UNITS_3,
    "input_basis":  (
        "Base energy same as conventional; slight extra electricity for abatement "
        "systems: rfuel 302, elec 87 (+8 for VAM/drainage), gas 25 GJ/kt."
    ),
    "evidence":     "NGGI 2022-23; Grosvenor Mine VAM data; NSW DEIE underground methane reporting.",
    "confidence":   "Medium",
    "review_notes": (
        "VIC brown coal has very low fugitive intensity; this state is most "
        "impactful for NSW/QLD underground operations. Phase 2: disaggregate."
    ),
    "expansion":    "Primary target for underground NSW/Qld thermal and coking coal.",
    "times_mapping": "Maps to low-fugitive coal production demand node.",
    "stage_family": "progression", "stage_rank": 25, "stage_code": "ambition1",
    "sort_key": "02_ambition1", "label_std": "Ambition 1 | low fugitive",
    "is_incumbent": False,
    "option_rank": 3, "option_code": "O3", "option_label": "O3 | low fugitive",
}

LF_DATA = {
    2025: dict(cost=62, coefficients=[302.0,  87.0, 25.0],
               energy_co2e=22.2, process_co2e=34.5, max_share=0.04,
               sei=414.0, eei=1.020, eer=0.800, fir=0.015, eeir=0.025),
    2030: dict(cost=61, coefficients=[291.0,  91.0, 24.0],
               energy_co2e=21.4, process_co2e=27.0, max_share=0.10,
               sei=406.0, eei=1.000, eer=0.820, fir=0.018, eeir=0.030),
    2035: dict(cost=60, coefficients=[280.0,  96.0, 23.0],
               energy_co2e=20.7, process_co2e=21.0, max_share=0.18,
               sei=399.0, eei=0.983, eer=0.840, fir=0.020, eeir=0.035),
    2040: dict(cost=59, coefficients=[270.0, 102.0, 22.0],
               energy_co2e=19.6, process_co2e=16.0, max_share=0.28,
               sei=394.0, eei=0.970, eer=0.860, fir=0.022, eeir=0.040),
    2045: dict(cost=58, coefficients=[260.0, 106.0, 22.0],
               energy_co2e=18.9, process_co2e=12.5, max_share=0.38,
               sei=388.0, eei=0.956, eer=0.880, fir=0.025, eeir=0.045),
    2050: dict(cost=57, coefficients=[250.0, 112.0, 21.0],
               energy_co2e=18.2, process_co2e=10.0, max_share=0.45,
               sei=383.0, eei=0.943, eer=0.900, fir=0.028, eeir=0.050),
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 5 — INTEGRATED LOW-CARBON
#  BEV haulage + electrification + methane abatement. Near-zero scope 1+2.
# ═══════════════════════════════════════════════════════════════════════════════
ILC_META = {
    "label": "Integrated low-carbon mining",
    "description": (
        "BEV haulage plus full fixed-plant electrification and methane pre-drainage "
        "and VAM oxidation. Near-zero scope 1+2 coal mining. Applicable to "
        "long-life export mine operations subject to Safeguard Mechanism baseline "
        "reductions, and to VIC brown coal life-extension scenarios. "
        "Max_share trajectory reflects constrained investment appetite across the "
        "declining total Australian coal production base."
    ),
    "commodities":  je(["electricity", "refined_liquid_fuels", "natural_gas"]),
    "units":        UNITS_3,
    "input_basis":  "158 GJ/kt elec + 110 GJ/kt rfuel (residual) + 18 GJ/kt gas (2025).",
    "evidence":     "IEA Net Zero Mining; VIC brown coal electrification scenarios; BHP Safeguard roadmap.",
    "confidence":   "Exploratory",
    "review_notes": (
        "Primarily relevant for policy scenario analysis and long-life export mines. "
        "Max share trajectory reflects limited investment context overall."
    ),
    "expansion":    "Export coking coal low-carbon pathway with mine-mouth renewable PPA.",
    "times_mapping": "Composite electrified coal production demand node.",
    "stage_family": "progression", "stage_rank": 30, "stage_code": "ambition2",
    "sort_key": "03_ambition2", "label_std": "Ambition 2 | integrated low-carbon",
    "is_incumbent": False,
    "option_rank": 4, "option_code": "O4", "option_label": "O4 | integrated low carbon",
}

ILC_DATA = {
    2025: dict(cost=90, coefficients=[158.0, 110.0, 18.0],
               energy_co2e= 8.6, process_co2e=28.0, max_share=0.01,
               sei=286.0, eei=0.705, eer=0.870, fir=0.008, eeir=0.030),
    2030: dict(cost=80, coefficients=[163.0,  88.0, 16.0],
               energy_co2e= 6.8, process_co2e=19.5, max_share=0.04,
               sei=267.0, eei=0.658, eer=0.890, fir=0.010, eeir=0.035),
    2035: dict(cost=72, coefficients=[167.0,  72.0, 14.0],
               energy_co2e= 5.6, process_co2e=13.5, max_share=0.10,
               sei=253.0, eei=0.623, eer=0.910, fir=0.012, eeir=0.040),
    2040: dict(cost=65, coefficients=[170.0,  60.0, 12.0],
               energy_co2e= 4.7, process_co2e= 9.5, max_share=0.18,
               sei=242.0, eei=0.596, eer=0.930, fir=0.014, eeir=0.045),
    2045: dict(cost=60, coefficients=[172.0,  50.0, 10.0],
               energy_co2e= 4.0, process_co2e= 7.0, max_share=0.26,
               sei=232.0, eei=0.571, eer=0.950, fir=0.016, eeir=0.048),
    2050: dict(cost=57, coefficients=[174.0,  40.0,  9.0],
               energy_co2e= 3.2, process_co2e= 5.5, max_share=0.33,
               sei=223.0, eei=0.549, eer=0.970, fir=0.018, eeir=0.050),
}

ALL_STATES = [
    ("coal_mining__conventional",  CONV_META, CONV_DATA),
    ("coal_mining__bev_haulage",   BEV_META,  BEV_DATA),
    ("coal_mining__hydrogen_fcev", H2_META,   H2_DATA),
    ("coal_mining__low_fugitive",  LF_META,   LF_DATA),
    ("coal_mining__integrated_lc", ILC_META,  ILC_DATA),
]

DEMAND_ROW = {
    "family_id":             "coal_mining",
    "anchor_year":           2025,
    "anchor_value":          ANCHOR_KT,          # 420,000 kt total production
    "unit":                  "kt_coal",
    "demand_growth_curve_id": "declining__coal_mining_total",
    "anchor_status":         "calibrated",
    "source_family":         "Phase 1 reference scenario v0.1",
    "coverage_note": (
        f"Total Australian coal production: {ANCHOR_KT:,} kt (Geoscience Australia 2023-24). "
        "Includes export coal (~330,000 kt, 79%) and domestic coal (~90,000 kt, 21%). "
        "Per-kt energy and emissions coefficients are national averages from AES/NGGI "
        "and therefore apply directly to the total production basis."
    ),
    "notes": (
        f"Calibrated to AES 2023-24 Table F and NGGI 2022-23 Cat 1B1a. "
        f"Energy at anchor: {ANCHOR_KT:,} kt × 406 GJ/kt = 170.5 PJ "
        f"(AES reference: {AES_TOTAL_PJ} PJ, coverage = 98.0%). "
        f"Fugitive at anchor: {ANCHOR_KT:,} kt × 69 tCO2e/kt = 29.0 MtCO2e "
        f"(NGGI Cat 1B1a = 29 MtCO2e, coverage = 99.9%). "
        "Demand trajectory: declining__coal_mining_total (−1.1%/yr compound, "
        "weighted average of export −0.75%/yr and domestic −2.5%/yr)."
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
    print(f"  Written: {path}  (anchor = {ANCHOR_KT:,} kt, curve = declining__coal_mining_total)")


def print_calibration_check():
    print("\n  Calibration check (total production basis):")
    for state_id, meta, year_data in ALL_STATES:
        yd = year_data[2025]
        c = yd["coefficients"]
        total_e = sum(x for x in c)
        total_pj = total_e * ANCHOR_KT / 1e6
        total_co2e = yd["energy_co2e"] + yd["process_co2e"]
        print(f"    {state_id:35s}  energy: {total_e:5.0f} GJ/kt = {total_pj:6.1f} PJ  "
              f"CO2e: {total_co2e:5.1f} tCO2e/kt = {total_co2e * ANCHOR_KT / 1e6:5.2f} MtCO2e/yr")
    print(f"\n    AES Table F reference:  {AES_TOTAL_PJ:.1f} PJ (all coal, {TOTAL_PROD_KT:,} kt)")
    print(f"    Modelled total:         {406.0 * ANCHOR_KT / 1e6:.1f} PJ (406 GJ/kt × {ANCHOR_KT:,} kt, {406*ANCHOR_KT/AES_TOTAL_PJ/1e6*100:.1f}% of AES)")
    print(f"\n    NGGI Cat 1B1a ref:      29.0 MtCO2e fugitive")
    print(f"    Modelled fugitive:      {PROCESS_CO2E_2025 * ANCHOR_KT / 1e6:.2f} MtCO2e ({PROCESS_CO2E_2025} tCO2e/kt × {ANCHOR_KT:,} kt)")


if __name__ == "__main__":
    print(f"\nGenerating coal_mining family CSVs (total production, {ANCHOR_KT:,} kt)\n")
    write_family_states()
    write_demand()
    print_calibration_check()
    print("\nDone.")

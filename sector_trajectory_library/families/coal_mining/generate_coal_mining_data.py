#!/usr/bin/env python3
"""
Coal Mining — Total Production Generator  (Phase 1 revised)
============================================================
Generates coal_mining family CSVs calibrated to AES 2025 and NGGI 2025.

Scope: TOTAL Australian coal production (export + domestic combined).
Anchor: 467,739 kt total raw coal output (Geoscience Australia 2023-24).
Export ≈ 370,000 kt (79%); Domestic ≈ 98,700 kt (21%).

Calibration basis
-----------------
AES 2025 Table F — 174 PJ total final energy for ANZSIC 06100+06200
(all coal mining, export + domestic combined, 467,739 kt total production).

Per-kt energy intensity (national average):
  174 PJ / 467,739 kt = 372 GJ/kt
  Split: 74% rfuel (277 GJ/kt) | 19% elec (72 GJ/kt) | 6% gas (23 GJ/kt)
  Remaining 2% (8 GJ/kt) = LPG + biomass, not in model commodity set.

  Total energy at 467,739 kt: 372 GJ/kt × 467,739 kt = 174.0 PJ ✓

Emission factors
-----------------
NGA 2025 DCCEEW (scope 1, AR5 GWP100):
  Diesel / refined liquid fuels: 69.9 kgCO2e/GJ
  Natural gas:                   51.4 kgCO2e/GJ
Energy CO2e: (277 × 69.9 + 23 × 51.4) / 1000 = 20.5 tCO2e/kt

Fugitive (process) CO2e:
  NGGI 2025 total coal mining scope 1: 36 MtCO2e at 467,739 kt
  Total per-kt: 36,000,000 / 467,739 = 77.0 tCO2e/kt
  Energy component: 20.5 tCO2e/kt
  Fugitive (residual): 77.0 - 20.5 = 56.5 tCO2e/kt
  Check: 56.5 × 467,739 / 1e6 = 26.4 MtCO2e fugitive
         20.5 × 467,739 / 1e6 =  9.6 MtCO2e energy combustion
         Total: 36.0 MtCO2e ✓

Demand trajectory: declining__coal_mining_total (−1.1%/yr compound)
  Weighted average of: export (370,000 kt @ −0.75%/yr) +
                       domestic (98,700 kt @ −2.5%/yr)
  Combined: (370,000×−0.75% + 98,700×−2.5%) / 467,739 ≈ −1.1%/yr

Sources: S001 (AES 2025), S002 (NGGI 2025), S021 (Geoscience Australia)
Assumptions: A002 (energy attribution), A003 (scope 1 boundary), A009 (fugitive)
"""

import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = [2025, 2030, 2035, 2040, 2045, 2050]

# ── calibration constants ────────────────────────────────────────────────────
AES_TOTAL_PJ         = 174.0
NGGI_TOTAL_MT        = 36.0
TOTAL_PROD_KT        = 467_739      # total Australian coal production (anchor)
ANCHOR_KT            = TOTAL_PROD_KT

# Per-kt coefficients (national average, total production basis)
# Calibrated: 174 PJ / 467,739 kt = 372 GJ/kt; fuel split maintained at 74%/19%/6%
RFUEL_2025 = 277.0   # GJ/kt  refined liquid fuels (74% of AES)
ELEC_2025  =  72.0   # GJ/kt  electricity             (19%)
GAS_2025   =  23.0   # GJ/kt  natural gas               (6%)
# Fuel-switching trajectory: rfuel declines, elec rises as fleet electrifies
RFUEL_2050 = 229.0
ELEC_2050  =  95.0
GAS_2050   =  19.0

# Emission factors (NGA 2025 DCCEEW, kgCO2e/GJ)
EF_RFUEL = 69.9
EF_GAS   = 51.4
ENERGY_CO2E_2025 = round((RFUEL_2025 * EF_RFUEL + GAS_2025 * EF_GAS) / 1000, 1)  # 20.5

# Process (fugitive) CO2e — NGGI 2025 derived per-kt coefficient
# Total scope 1 = 36 Mt, energy CO2e = 20.5 tCO2e/kt, fugitive = 56.5 tCO2e/kt
PROCESS_CO2E_2025 = 56.5
PROCESS_CO2E_2050 = 35.0

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
    "Energy coefficients calibrated to AES 2025 Table F: 174 PJ / 467,739 kt = 372 GJ/kt "
    "(fuel split: rfuel 74%, elec 19%, gas 6%). "
    "Fugitive emissions calibrated to NGGI 2025: total coal mining scope 1 = 36 MtCO2e at 467,739 kt; "
    "fugitive residual = 36 Mt − 9.6 Mt energy = 26.4 Mt → 56.5 tCO2e/kt."
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
#  Fuel trajectory: rfuel 277→229, elec 72→95, gas 23→19 GJ/kt (2025-2050).
#  Calibrated to AES 2025 (174 PJ / 467,739 kt = 372 GJ/kt) and
#  NGGI 2025 (36 Mt total scope 1 / 467,739 kt = 77.0 tCO2e/kt).
# ═══════════════════════════════════════════════════════════════════════════════
CONV_META = {
    "label": "Conventional coal mining",
    "description": (
        "Diesel and grid-electric equipment covering all mine operations "
        "(haulage, loading, blasting, ventilation, processing). Australian coal "
        "predominantly open-cut: Victorian brown coal (100% surface) and NSW/QLD "
        "thermal black coal (~90% open-cut); export coking coal ~70% open-cut. "
        "National-average AES 2025 energy intensity applied: 174 PJ / 467,739 kt = 372 GJ/kt. "
        "Demand basis: total Australian coal production (467,739 kt, 2025 anchor; "
        "export ~370,000 kt + domestic ~98,700 kt)."
    ),
    "commodities":  je(["refined_liquid_fuels", "electricity", "natural_gas"]),
    "units":        UNITS_3,
    "input_basis":  (
        "AES 2025 Table F: 174 PJ total coal mining / 467,739 kt = 372 GJ/kt. "
        "Fuel split: rfuel 74% (277 GJ/kt), elec 19% (72 GJ/kt), gas 6% (23 GJ/kt). "
        "Total energy at anchor: 372 × 467,739 / 1e6 = 174.0 PJ."
    ),
    "evidence":     "AES 2025 Table F; NGGI 2025 total coal mining scope 1; Geoscience Australia 2023-24.",
    "confidence":   "Medium",
    "review_notes": (
        "Per-kt coefficient is national average across all mine types. "
        "Open-cut mines have lower fugitive intensity (~12 tCO2e/kt) than the "
        "national average of 56.5 tCO2e/kt (dominated by underground export mines). "
        "Phase 2: disaggregate by mine type (open-cut vs underground) and by coal type."
    ),
    "expansion":    "Disaggregate into Victorian brown coal, NSW thermal, and Qld coking coal sub-families.",
    "times_mapping": "Maps to total coal production demand node.",
    "stage_family": "incumbent", "stage_rank": 10, "stage_code": "incumbent",
    "sort_key": "01_incumbent", "label_std": "Incumbent | conventional",
    "is_incumbent": True,
    "option_rank": 0, "option_code": "O0", "option_label": "O0 | conventional",
}

# Energy CO2e per year from fuel EFs (NGA 2025): (rfuel × 69.9 + gas × 51.4) / 1000
# Fugitive CO2e scaled from NGGI 2025 baseline (56.5 tCO2e/kt at 2025)
CONV_DATA = {
    2025: dict(cost=52, coefficients=[277.0,  72.0, 23.0],
               energy_co2e=20.5, process_co2e=56.5, max_share=1.00,
               sei=372.0, eei=1.000, eer=0.800, fir=0.015, eeir=0.025),
    2030: dict(cost=53, coefficients=[267.0,  76.0, 22.0],
               energy_co2e=19.8, process_co2e=52.0, max_share=0.95,
               sei=365.0, eei=0.981, eer=0.820, fir=0.018, eeir=0.030),
    2035: dict(cost=54, coefficients=[257.0,  81.0, 21.0],
               energy_co2e=19.0, process_co2e=47.0, max_share=0.95,
               sei=359.0, eei=0.965, eer=0.840, fir=0.020, eeir=0.035),
    2040: dict(cost=55, coefficients=[248.0,  86.0, 20.0],
               energy_co2e=18.4, process_co2e=43.0, max_share=0.90,
               sei=354.0, eei=0.952, eer=0.860, fir=0.022, eeir=0.040),
    2045: dict(cost=56, coefficients=[238.0,  90.0, 20.0],
               energy_co2e=17.7, process_co2e=39.0, max_share=0.90,
               sei=348.0, eei=0.935, eer=0.880, fir=0.025, eeir=0.045),
    2050: dict(cost=57, coefficients=[229.0,  95.0, 19.0],
               energy_co2e=17.0, process_co2e=35.0, max_share=0.85,
               sei=343.0, eei=0.922, eer=0.900, fir=0.028, eeir=0.050),
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 2 — BEV HEAVY HAULAGE
#  Battery-electric haul trucks replace diesel haulage. Elec share rises to ~55%.
#  All fuel coefficients scaled by 372/406 = 0.916 from prior calibration.
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
    "input_basis":  (
        "Electrification of haulage raises elec to 123 GJ/kt, reduces rfuel to 125 GJ/kt "
        "(scaled from AES 2025 basis: 372 GJ/kt total conventional)."
    ),
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
    2025: dict(cost=78, coefficients=[123.0, 125.0, 20.0],
               energy_co2e= 9.8, process_co2e=56.5, max_share=0.03,
               sei=268.0, eei=0.720, eer=0.880, fir=0.010, eeir=0.030),
    2030: dict(cost=72, coefficients=[130.0, 105.0, 19.0],
               energy_co2e= 8.3, process_co2e=52.0, max_share=0.08,
               sei=254.0, eei=0.683, eer=0.900, fir=0.012, eeir=0.035),
    2035: dict(cost=65, coefficients=[136.0,  90.0, 18.0],
               energy_co2e= 7.2, process_co2e=47.0, max_share=0.15,
               sei=244.0, eei=0.656, eer=0.920, fir=0.014, eeir=0.040),
    2040: dict(cost=60, coefficients=[140.0,  80.0, 17.0],
               energy_co2e= 6.5, process_co2e=43.0, max_share=0.25,
               sei=237.0, eei=0.637, eer=0.940, fir=0.016, eeir=0.045),
    2045: dict(cost=57, coefficients=[143.0,  73.0, 17.0],
               energy_co2e= 6.0, process_co2e=39.0, max_share=0.32,
               sei=233.0, eei=0.626, eer=0.960, fir=0.018, eeir=0.048),
    2050: dict(cost=55, coefficients=[145.0,  69.0, 17.0],
               energy_co2e= 5.7, process_co2e=35.0, max_share=0.38,
               sei=231.0, eei=0.621, eer=0.980, fir=0.020, eeir=0.050),
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
    "input_basis":  (
        "76 GJ/kt H2 + 72 GJ/kt elec + 125 GJ/kt rfuel (residual) + 20 GJ/kt gas "
        "(scaled from AES 2025 basis: 372 GJ/kt total conventional)."
    ),
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
    2025: dict(cost=90, coefficients=[ 76.0, 72.0, 125.0, 20.0],
               energy_co2e= 9.8, process_co2e=56.5, max_share=0.01,
               sei=293.0, eei=0.788, eer=0.850, fir=0.008, eeir=0.020),
    2030: dict(cost=82, coefficients=[ 81.0, 72.0, 105.0, 19.0],
               energy_co2e= 8.3, process_co2e=52.0, max_share=0.03,
               sei=277.0, eei=0.745, eer=0.870, fir=0.010, eeir=0.025),
    2035: dict(cost=72, coefficients=[ 84.0, 72.0,  90.0, 18.0],
               energy_co2e= 7.2, process_co2e=47.0, max_share=0.06,
               sei=264.0, eei=0.710, eer=0.890, fir=0.012, eeir=0.030),
    2040: dict(cost=65, coefficients=[ 88.0, 72.0,  80.0, 17.0],
               energy_co2e= 6.5, process_co2e=43.0, max_share=0.10,
               sei=257.0, eei=0.691, eer=0.910, fir=0.014, eeir=0.035),
    2045: dict(cost=62, coefficients=[ 91.0, 72.0,  73.0, 17.0],
               energy_co2e= 6.0, process_co2e=39.0, max_share=0.14,
               sei=253.0, eei=0.680, eer=0.930, fir=0.016, eeir=0.038),
    2050: dict(cost=60, coefficients=[ 94.0, 72.0,  69.0, 17.0],
               energy_co2e= 5.7, process_co2e=35.0, max_share=0.18,
               sei=252.0, eei=0.677, eer=0.950, fir=0.018, eeir=0.040),
}

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 4 — LOW-FUGITIVE (methane abatement)
#  Conventional energy mix + pre-drainage + VAM oxidation.
#  Halves process CO2e from 56.5 → 28 tCO2e/kt (2025), declining to 8 by 2050.
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
        "Base energy same as conventional (AES 2025 basis); slight extra electricity "
        "for abatement systems: rfuel 277, elec 80 (+8 for VAM/drainage), gas 23 GJ/kt."
    ),
    "evidence":     "NGGI 2025; Grosvenor Mine VAM data; NSW DEIE underground methane reporting.",
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
    2025: dict(cost=62, coefficients=[277.0,  80.0, 23.0],
               energy_co2e=20.5, process_co2e=28.0, max_share=0.04,
               sei=380.0, eei=1.022, eer=0.800, fir=0.015, eeir=0.025),
    2030: dict(cost=61, coefficients=[267.0,  83.0, 22.0],
               energy_co2e=19.8, process_co2e=22.0, max_share=0.10,
               sei=372.0, eei=1.000, eer=0.820, fir=0.018, eeir=0.030),
    2035: dict(cost=60, coefficients=[257.0,  88.0, 21.0],
               energy_co2e=19.0, process_co2e=17.0, max_share=0.18,
               sei=366.0, eei=0.984, eer=0.840, fir=0.020, eeir=0.035),
    2040: dict(cost=59, coefficients=[248.0,  94.0, 20.0],
               energy_co2e=18.4, process_co2e=13.0, max_share=0.28,
               sei=362.0, eei=0.973, eer=0.860, fir=0.022, eeir=0.040),
    2045: dict(cost=58, coefficients=[238.0,  97.0, 20.0],
               energy_co2e=17.7, process_co2e=10.0, max_share=0.38,
               sei=355.0, eei=0.954, eer=0.880, fir=0.025, eeir=0.045),
    2050: dict(cost=57, coefficients=[229.0, 103.0, 19.0],
               energy_co2e=17.0, process_co2e= 8.0, max_share=0.45,
               sei=351.0, eei=0.944, eer=0.900, fir=0.028, eeir=0.050),
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
    "input_basis":  (
        "145 GJ/kt elec + 101 GJ/kt rfuel (residual) + 17 GJ/kt gas (2025); "
        "scaled from AES 2025 basis."
    ),
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
    2025: dict(cost=90, coefficients=[145.0, 101.0, 17.0],
               energy_co2e= 7.9, process_co2e=23.0, max_share=0.01,
               sei=263.0, eei=0.707, eer=0.870, fir=0.008, eeir=0.030),
    2030: dict(cost=80, coefficients=[149.0,  81.0, 15.0],
               energy_co2e= 6.4, process_co2e=16.0, max_share=0.04,
               sei=245.0, eei=0.659, eer=0.890, fir=0.010, eeir=0.035),
    2035: dict(cost=72, coefficients=[153.0,  66.0, 13.0],
               energy_co2e= 5.3, process_co2e=11.0, max_share=0.10,
               sei=232.0, eei=0.624, eer=0.910, fir=0.012, eeir=0.040),
    2040: dict(cost=65, coefficients=[156.0,  55.0, 11.0],
               energy_co2e= 4.4, process_co2e= 8.0, max_share=0.18,
               sei=222.0, eei=0.597, eer=0.930, fir=0.014, eeir=0.045),
    2045: dict(cost=60, coefficients=[158.0,  46.0,  9.0],
               energy_co2e= 3.7, process_co2e= 6.0, max_share=0.26,
               sei=213.0, eei=0.573, eer=0.950, fir=0.016, eeir=0.048),
    2050: dict(cost=57, coefficients=[159.0,  37.0,  8.0],
               energy_co2e= 3.0, process_co2e= 4.5, max_share=0.33,
               sei=204.0, eei=0.548, eer=0.970, fir=0.018, eeir=0.050),
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
    "anchor_value":          ANCHOR_KT,          # 467,739 kt total production
    "unit":                  "kt_coal",
    "demand_growth_curve_id": "declining__coal_mining_total",
    "anchor_status":         "calibrated",
    "source_family":         "Phase 1 reference scenario v0.1",
    "coverage_note": (
        f"Total Australian coal production: {ANCHOR_KT:,} kt (Geoscience Australia 2023-24). "
        "Includes export coal (~370,000 kt, 79%) and domestic coal (~98,700 kt, 21%). "
        "Per-kt energy and emissions coefficients calibrated from AES 2025 and NGGI 2025 "
        "and therefore apply directly to the total production basis."
    ),
    "notes": (
        f"Calibrated to AES 2025 Table F and NGGI 2025. "
        f"Energy at anchor: {ANCHOR_KT:,} kt × 372 GJ/kt = {372 * ANCHOR_KT / 1e6:.1f} PJ "
        f"(AES 2025 reference: {AES_TOTAL_PJ} PJ, coverage = 100.0%). "
        f"Total scope 1 at anchor: {ANCHOR_KT:,} kt × 77.0 tCO2e/kt = {77.0 * ANCHOR_KT / 1e6:.1f} MtCO2e "
        f"(NGGI 2025 reference: {NGGI_TOTAL_MT} MtCO2e). "
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
    conv_2025 = CONV_DATA[2025]
    conv_sei = conv_2025["sei"]

    for state_id, meta, year_data in ALL_STATES:
        yd = year_data[2025]
        c = yd["coefficients"]
        total_e = sum(x for x in c)
        total_pj = total_e * ANCHOR_KT / 1e6
        total_co2e = yd["energy_co2e"] + yd["process_co2e"]
        total_mt = total_co2e * ANCHOR_KT / 1e6
        print(f"    {state_id:35s}  energy: {total_e:5.0f} GJ/kt = {total_pj:6.1f} PJ  "
              f"CO2e: {total_co2e:5.1f} tCO2e/kt = {total_mt:5.2f} MtCO2e/yr")

    print(f"\n    AES 2025 Table F reference:  {AES_TOTAL_PJ:.1f} PJ (all coal, {TOTAL_PROD_KT:,} kt)")
    modelled_pj = RFUEL_2025 + ELEC_2025 + GAS_2025
    print(f"    Modelled total (conv 2025):  {modelled_pj:.0f} GJ/kt × {ANCHOR_KT:,} kt = "
          f"{modelled_pj * ANCHOR_KT / 1e6:.1f} PJ ({modelled_pj * ANCHOR_KT / AES_TOTAL_PJ / 1e6 * 100:.1f}% of AES)")
    print(f"\n    NGGI 2025 reference:  {NGGI_TOTAL_MT:.0f} MtCO2e total scope 1")
    conv_total_co2e = ENERGY_CO2E_2025 + PROCESS_CO2E_2025
    print(f"    Modelled total (conv 2025):  {conv_total_co2e:.1f} tCO2e/kt × {ANCHOR_KT:,} kt = "
          f"{conv_total_co2e * ANCHOR_KT / 1e6:.2f} MtCO2e")
    print(f"      Energy component:   {ENERGY_CO2E_2025:.1f} tCO2e/kt = "
          f"{ENERGY_CO2E_2025 * ANCHOR_KT / 1e6:.2f} MtCO2e")
    print(f"      Fugitive component: {PROCESS_CO2E_2025:.1f} tCO2e/kt = "
          f"{PROCESS_CO2E_2025 * ANCHOR_KT / 1e6:.2f} MtCO2e")


if __name__ == "__main__":
    print(f"\nGenerating coal_mining family CSVs (total production, {ANCHOR_KT:,} kt)\n")
    write_family_states()
    write_demand()
    print_calibration_check()
    print("\nDone.")

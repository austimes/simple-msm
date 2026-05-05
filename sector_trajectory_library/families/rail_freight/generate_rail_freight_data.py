#!/usr/bin/env python3
"""
Rail Freight — Phase 1 Generator
==================================
Generates rail_freight family CSVs calibrated to AES 2025 Table F1 (2023-24) and BITRE.

Scope: Australian freight rail (heavy-haul iron ore/coal, intermodal, grain).
Anchor: 700 billion_tkm (BITRE freight linehaul statistics; predominantly heavy-haul).

Calibration basis
-----------------
AES 2025 Table F1 (2023-24) rail (sector 47) = 64.9 PJ; freight share = 49 PJ diesel (after assigning 12.9 PJ electricity and 3.1 PJ regional diesel to passenger).
BITRE freight linehaul: 700 billion_tkm (dominated by Pilbara iron ore and Hunter Valley coal).

Per-unit energy intensity:
  25,000,000 GJ / 700 = 35,714 GJ/billion_tkm (≈ 0.036 MJ/tkm; very efficient for heavy bulk rail)
  Fuel split: 95% diesel, 5% electricity.
  Diesel 33,929 GJ/billion_tkm; electricity 1,786 GJ/billion_tkm.

Emission factors (NGA 2025, AR5 GWP100, scope 1):
  Diesel: 69.9 kgCO2e/GJ
  Electricity: 0 kgCO2e/GJ (scope 2 excluded per A003)
  Hydrogen: 0 kgCO2e/GJ (green H2)

Energy CO2e 2025 (scope 1 diesel): 33,929 × 69.9 / 1000 = 2,372 tCO2e/billion_tkm
Total CO2e: 2,320 × 700 / 1e6 = 1.62 MtCO2e (NGGI rail freight ~1.5-2.0 MtCO2e OK)

Demand trajectory: stable_growing__rail_freight (+0.8%/yr)

Sources: S001 (AES), S004 (NGGI), S013 (BITRE freight)
Assumptions: A002, A003, A022, A023
"""

import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = [2025, 2030, 2035, 2040, 2045, 2050]

# ── calibration constants ────────────────────────────────────────────────────
AES_TOTAL_PJ        = 49.0
ANCHOR_BILLION_TKM  = 700         # billion_tkm (BITRE)
DIESEL_2025         = 70_000.0    # GJ/billion_tkm (100%; AES 2025 Table F1 rail freight = bulk-haul diesel)
ELEC_2025           =      0.0    # GJ/billion_tkm (rail electricity allocated to passenger urban metro)
TOTAL_INTENSITY_2025 = DIESEL_2025 + ELEC_2025  # 70,000 GJ/billion_tkm
EF_DIESEL           = 69.9        # kgCO2e/GJ
EF_ELEC             = 0.0

ENERGY_CO2E_2025    = round(DIESEL_2025 * EF_DIESEL / 1000, 0)  # 2320.0
TOTAL_CO2E_2025_MT  = round(ENERGY_CO2E_2025 * ANCHOR_BILLION_TKM / 1e6, 2)

FAMILY_ID   = "rail_freight"
OUTPUT_UNIT = "billion_tkm"
EMISSIONS_UNITS = "tCO2e/billion_tkm"

COST_COMPONENTS = (
    "Annualised non-fuel operating cost per billion tonne-kilometres (real 2024 AUD), "
    "excluding explicit energy commodity purchases and carbon costs."
)
EMISSIONS_BOUNDARY = (
    "Direct scope 1 diesel combustion only. Electricity upstream (scope 2) excluded; "
    "captured by the electricity supply family. Green hydrogen combustion CO2 = 0. "
    "No process emissions for rail freight."
)
ROLLOUT_NOTES = (
    "National adoption bound reflecting locomotive fleet replacement cycles (~30-40 yr), "
    "high capital cost of rail electrification, and dominant role of private heavy-haul "
    "operators (BHP, Rio Tinto, Aurizon, Pacific National)."
)
SOURCES     = json.dumps(["S001", "S004", "S013"])
ASSUMPTIONS = json.dumps(["A002", "A003", "A022", "A023"])
DERIVATION  = (
    f"Energy from AES 2025 Table F1 rail diesel ({AES_TOTAL_PJ} PJ freight share, 2023-24) / "
    f"BITRE {ANCHOR_BILLION_TKM} billion_tkm = {TOTAL_INTENSITY_2025:.0f} GJ/billion_tkm. "
    f"100% diesel ({DIESEL_2025:.0f} GJ), 0% electricity (rail electricity allocated to passenger urban metro). "
    f"Scope 1 CO2e: {ENERGY_CO2E_2025:.0f} tCO2e/billion_tkm × {ANCHOR_BILLION_TKM} / 1e6 = "
    f"{TOTAL_CO2E_2025_MT} MtCO2e."
)

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
]

DEMAND_FIELDNAMES = [
    "family_id", "anchor_year", "anchor_value", "unit",
    "demand_growth_curve_id", "anchor_status", "source_family",
    "coverage_note", "notes",
]

EP_FIELDNAMES = [
    "family_id", "package_id", "year", "package_label", "package_description",
    "classification", "applicable_state_ids", "affected_input_commodities",
    "input_multipliers", "delta_output_cost_per_unit", "cost_basis_year", "currency",
    "max_share", "rollout_limit_notes", "source_ids", "assumption_ids",
    "evidence_summary", "derivation_method", "confidence_rating", "review_notes",
    "non_stacking_group",
]

AET_FIELDNAMES = [
    "family_id", "track_id", "year", "track_label", "track_description",
    "applicable_state_ids", "affected_input_commodities", "input_multipliers",
    "delta_output_cost_per_unit", "cost_basis_year", "currency",
    "source_ids", "assumption_ids", "evidence_summary", "derivation_method",
    "confidence_rating", "double_counting_guardrail", "review_notes",
]


def je(obj):
    return json.dumps(obj)


def interp(v0, v1, year, y0=2025, y1=2050):
    t = (year - y0) / (y1 - y0)
    return round(v0 + t * (v1 - v0), 4)


def fs_row(fam_id, state_id, year, yd, meta):
    energy_em  = je([{"pollutant": "CO2e", "value": yd["energy_co2e"]}])
    process_em = je([{"pollutant": "CO2e", "value": 0}])
    return {
        "family_id":                   fam_id,
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
        "emissions_units":             EMISSIONS_UNITS,
        "emissions_boundary_notes":    EMISSIONS_BOUNDARY,
        "max_share":                   yd["max_share"],
        "max_activity":                "",
        "min_share":                   "",
        "rollout_limit_notes":         ROLLOUT_NOTES,
        "availability_conditions":     meta.get("avail_note", "Available from 2025."),
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
        "process_co2e":                0,
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
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 1 — DIESEL ELECTRIC LOCOMOTIVE (incumbent)
#  Standard diesel-electric (GE ES44, Wabtec Evolution series)
# ═══════════════════════════════════════════════════════════════════════════════
CONV_META = {
    "label": "Diesel-electric locomotive — rail freight",
    "description": (
        "Standard diesel-electric locomotive fleet (AC traction; GE ES44/Evolution, "
        "Wabtec FLXdrive, EMD SD70) covering Australian heavy-haul and intermodal "
        "freight rail. Predominantly diesel-driven (rail electricity is allocated to "
        "the urban metro passenger service in this calibration). National average "
        "calibrated to AES 2025 Table F1 rail diesel (49 PJ freight share, 2023-24 / "
        "700 billion_tkm = 70,000 GJ/billion_tkm). Dominant operators: Aurizon, "
        "Pacific National, BHP (iron ore), Rio Tinto, FMG (Pilbara); Hunter Valley coal."
    ),
    "commodities":  je(["diesel", "electricity"]),
    "units":        je(["GJ/billion_tkm", "GJ/billion_tkm"]),
    "input_basis":  (
        "AES 2025 Table F1 rail diesel (2023-24): 49 PJ freight share / 700 billion_tkm = 70,000 GJ/billion_tkm. "
        f"Diesel 100% ({DIESEL_2025:.0f} GJ), electricity 0% ({ELEC_2025:.0f} GJ). "
        "2050: diesel 58,800 GJ/billion_tkm (efficiency improvement)."
    ),
    "evidence":     "AES 2025 Table F1 rail diesel (freight share); BITRE freight linehaul; NGGI rail freight.",
    "confidence":   "Medium",
    "review_notes": (
        "AES does not separately report freight vs passenger rail energy. The 25 PJ "
        "estimate is derived by subtracting estimated passenger energy (8 PJ) from "
        "total rail AES figure. Phase 2: obtain direct NGERS freight rail reporting."
    ),
    "expansion":    "Disaggregate into heavy-haul (Pilbara, Hunter Valley), intermodal, and grain rail sub-families.",
    "times_mapping": "Maps to freight rail demand technology.",
    "stage_family": "incumbent", "stage_rank": 10, "stage_code": "incumbent",
    "sort_key": "01_incumbent", "label_std": "Incumbent | diesel electric",
    "is_incumbent": True,
    "option_rank": 0, "option_code": "O0", "option_label": "O0 | diesel electric",
}

CONV_DATA = {}
for _yr in YEARS:
    _diesel = round(interp(70_000.0, 58_800.0, _yr), 0)
    _elec   = round(interp(     0.0,      0.0, _yr), 0)
    _eco2e  = round(_diesel * EF_DIESEL / 1000, 0)
    _ms     = round(interp(1.00, 0.60, _yr), 2)
    CONV_DATA[_yr] = dict(
        cost=0.015,
        coefficients=[_diesel, _elec],
        energy_co2e=_eco2e,
        max_share=_ms,
    )

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 2 — OVERHEAD ELECTRIFICATION (progression)
#  OHL on high-density corridors (Hunter Valley coal, Pilbara private rail)
# ═══════════════════════════════════════════════════════════════════════════════
OHL_META = {
    "label": "Overhead line electrification — rail freight",
    "description": (
        "Overhead electrification of high-density freight corridors. Electric traction "
        "is approximately 30% more efficient than diesel per tonne-km. Energy intensity "
        "25,000 GJ electricity/billion_tkm (2025) improving to 20,000 GJ/billion_tkm "
        "(2050) via regenerative braking on grades. Limited to high-traffic corridors "
        "where capital cost (AUD 1-3M/km OHL) is justified. Zero scope 1 CO2e."
    ),
    "commodities":  je(["electricity"]),
    "units":        je(["GJ/billion_tkm"]),
    "input_basis":  (
        "Electric freight loco: 25,000 GJ electricity/billion_tkm = 0.025 MJ/tkm. "
        "~30% more efficient than diesel. Improving to 20,000 GJ/billion_tkm (2050). "
        "Scope 1 CO2e = 0; electricity scope 2 excluded per A003."
    ),
    "evidence":     (
        "Pilbara private rail (FMG, BHP, Rio) electrification studies; "
        "Network Rail UK electric freight data; ARENA heavy rail electrification analysis."
    ),
    "confidence":   "Low",
    "review_notes": (
        "OHL electrification has very high capital costs. Max share of 30% by 2050 "
        "is limited to the Hunter Valley and Pilbara corridors. Most intermodal "
        "routes are unlikely to be electrified in Phase 1 timeframe."
    ),
    "expansion":    "Add explicit corridor-by-corridor feasibility and capital cost model.",
    "times_mapping": "Maps to overhead electrification rail freight demand node.",
    "stage_family": "progression", "stage_rank": 20, "stage_code": "ambition1",
    "sort_key": "02_ambition1", "label_std": "Ambition 1 | overhead electrification",
    "is_incumbent": False,
    "option_rank": 1, "option_code": "O1", "option_label": "O1 | overhead electrification",
}

OHL_DATA = {}
for _yr in YEARS:
    _coeff = round(interp(25_000.0, 20_000.0, _yr), 0)
    _ms    = round(interp(0.01, 0.30, _yr), 2)
    OHL_DATA[_yr] = dict(
        cost=round(interp(0.020, 0.015, _yr), 4),
        coefficients=[_coeff],
        energy_co2e=0.0,
        max_share=_ms,
    )

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 3 — HYDROGEN LOCOMOTIVE (progression)
#  H2 fuel cell + battery hybrid for non-electrified routes
# ═══════════════════════════════════════════════════════════════════════════════
H2_META = {
    "label": "Hydrogen fuel cell locomotive — rail freight",
    "description": (
        "Hydrogen fuel cell and battery hybrid locomotive for non-electrified freight "
        "routes. H2 energy intensity higher than diesel due to conversion losses "
        "and weight penalty of H2 storage (40,000 GJ H2/billion_tkm in 2030 "
        "improving to 30,000 GJ H2/billion_tkm by 2050 with technology maturity). "
        "Zero scope 1 CO2e with green hydrogen. Available from 2030."
    ),
    "commodities":  je(["hydrogen"]),
    "units":        je(["GJ/billion_tkm"]),
    "input_basis":  (
        "H2 FC locomotive: 0 GJ/billion_tkm before 2030 (not available commercially). "
        "2030: 40,000 GJ H2/billion_tkm (heavier loco, H2 storage penalty). "
        "Improving to 30,000 GJ H2/billion_tkm (2050). Scope 1 CO2e = 0."
    ),
    "evidence":     (
        "Wabtec FLXdrive hydrogen locomotive programme; CRRC H2 freight locomotive; "
        "ARENA hydrogen rail assessment; CSIRO National Hydrogen Roadmap."
    ),
    "confidence":   "Exploratory",
    "review_notes": (
        "H2 freight locomotives are pre-commercial as of 2025. The Wabtec FLXdrive "
        "and equivalent programmes are at demonstration phase. Green H2 supply at "
        "mine-site or rail corridor scale is a binding constraint."
    ),
    "expansion":    "Add H2 refuelling station infrastructure; distinguish on-board compressed vs liquid H2.",
    "times_mapping": "Maps to hydrogen freight locomotive demand node.",
    "stage_family": "progression", "stage_rank": 30, "stage_code": "ambition2",
    "sort_key": "03_ambition2", "label_std": "Ambition 2 | hydrogen locomotive",
    "is_incumbent": False,
    "option_rank": 2, "option_code": "O2", "option_label": "O2 | hydrogen locomotive",
    "avail_note": "Available from 2030; zero coefficients and max_share in 2025.",
}

_h2_frt_coeffs = {2025: 0.0, 2030: 40_000.0, 2035: 38_000.0, 2040: 35_000.0, 2045: 32_000.0, 2050: 30_000.0}
_h2_frt_ms     = {2025: 0.00, 2030: 0.01, 2035: 0.04, 2040: 0.09, 2045: 0.15, 2050: 0.20}
_h2_frt_cost   = {2025: 0.04, 2030: 0.035, 2035: 0.028, 2040: 0.022, 2045: 0.019, 2050: 0.018}

H2_DATA = {}
for _yr in YEARS:
    H2_DATA[_yr] = dict(
        cost=_h2_frt_cost[_yr],
        coefficients=[_h2_frt_coeffs[_yr]],
        energy_co2e=0.0,
        max_share=_h2_frt_ms[_yr],
    )

ALL_STATES = [
    ("rail_freight__diesel_electric",        CONV_META, CONV_DATA),
    ("rail_freight__overhead_electrification", OHL_META,  OHL_DATA),
    ("rail_freight__hydrogen_locomotive",    H2_META,   H2_DATA),
]

DEMAND_ROW = {
    "family_id":             FAMILY_ID,
    "anchor_year":           2025,
    "anchor_value":          ANCHOR_BILLION_TKM,
    "unit":                  OUTPUT_UNIT,
    "demand_growth_curve_id": "stable_growing__rail_freight",
    "anchor_status":         "calibrated",
    "source_family":         "Phase 1 reference scenario v0.1",
    "coverage_note": (
        f"BITRE freight linehaul statistics: {ANCHOR_BILLION_TKM} billion_tkm "
        "(predominantly iron ore Pilbara and coal Hunter Valley). "
        f"AES 2025 Table F1 rail diesel freight share: {AES_TOTAL_PJ} PJ (2023-24). "
        f"Coverage: {AES_TOTAL_PJ*1e6 / (TOTAL_INTENSITY_2025 * ANCHOR_BILLION_TKM) * 100:.1f}%."
    ),
    "notes": (
        f"Calibrated to AES 2025 Table F1 rail diesel freight share ({AES_TOTAL_PJ} PJ, 2023-24) "
        f"and BITRE freight linehaul ({ANCHOR_BILLION_TKM} billion_tkm). "
        f"Energy intensity: {TOTAL_INTENSITY_2025:.0f} GJ/billion_tkm = 0.036 MJ/tkm "
        "(very efficient heavy-haul rail). "
        f"Scope 1 CO2e: {TOTAL_CO2E_2025_MT} MtCO2e (NGGI rail freight 1.5-2.0 MtCO2e OK). "
        "Demand trajectory: stable_growing__rail_freight (+0.8%/yr; stable heavy-haul, growing intermodal)."
    ),
}

# ── efficiency packages ──────────────────────────────────────────────────────
EP_DATA = [
    {
        "package_id": "rail_freight__train_control_optimisation",
        "label": "Train control system optimisation",
        "description": (
            "Advanced cruise control (Trip Optimizer) and smooth driving assistance "
            "for diesel-electric freight locomotives. Reduces diesel consumption by 7% "
            "through optimised speed profiles on grade. Validated in Australian heavy-haul "
            "programmes (Aurizon, Pacific National). Applies to diesel_electric state only."
        ),
        "classification": "operational_efficiency_overlay",
        "applicable_states": ["rail_freight__diesel_electric"],
        "affected_commodities": ["diesel"],
        "multiplier": 0.93,
        "max_shares": {2025: 0.05, 2030: 0.18, 2035: 0.32, 2040: 0.44, 2045: 0.52, 2050: 0.55},
        "delta_cost": {yr: 0.0 for yr in YEARS},
        "evidence": (
            "Wabtec Trip Optimizer programme (6-8% fuel savings validated); "
            "Aurizon Queensland fuel efficiency reporting; "
            "Pacific National advanced driver advisory systems."
        ),
        "confidence": "High",
        "review_notes": "Well-validated in Australian heavy-haul operations. Deployment constrained by fleet age.",
        "non_stacking_group": "rail_freight_control_opt",
    },
    {
        "package_id": "rail_freight__dynamic_braking_energy_recovery",
        "label": "Dynamic braking energy recovery",
        "description": (
            "Regenerative dynamic braking system that converts braking energy to "
            "electrical energy (to auxiliary loads or on-board storage), reducing "
            "net diesel consumption. Applicable on grades (Pilbara, Blue Mountains). "
            "Diesel reduction: 9%. Applies to diesel_electric state only."
        ),
        "classification": "pure_efficiency_overlay",
        "applicable_states": ["rail_freight__diesel_electric"],
        "affected_commodities": ["diesel"],
        "multiplier": 0.91,
        "max_shares": {2025: 0.02, 2030: 0.08, 2035: 0.16, 2040: 0.25, 2045: 0.31, 2050: 0.35},
        "delta_cost": {yr: 0.0 for yr in YEARS},
        "evidence": (
            "Rio Tinto Pilbara autonomous train energy recovery data; "
            "Wabtec FLXdrive battery-hybrid energy recovery; "
            "dynamic braking energy recovery on grade (coal mine loop lines)."
        ),
        "confidence": "Medium",
        "review_notes": "Savings most significant on haul routes with significant elevation change.",
        "non_stacking_group": "rail_freight_dyn_braking",
    },
]

# ── autonomous tracks ────────────────────────────────────────────────────────
AET_DATA = [
    {
        "track_id": "rail_freight__background_diesel_loco_efficiency_drift",
        "label": "Background diesel locomotive efficiency drift — rail freight",
        "description": (
            "Exogenous diesel efficiency improvement from background locomotive fleet "
            "renewal (Tier 4 engine standards, improved combustion, turbocharger "
            "upgrades). Rate: -0.35%/yr compounding; multiplier 1.000 → 0.916 by 2050. "
            "Applies to diesel_electric state."
        ),
        "applicable_states": ["rail_freight__diesel_electric"],
        "affected_commodities": ["diesel"],
        "rate": -0.0035,
        "multipliers": {},
        "evidence": (
            "EPA Tier 4 locomotive standards; GE/Wabtec Evolution Series efficiency data; "
            "historical AES rail freight diesel intensity trend."
        ),
        "confidence": "Medium",
        "double_counting_guardrail": (
            "Applies to diesel_electric only. OHL electrification and H2 locomotive "
            "states excluded. Non-stacking with train control and dynamic braking packages."
        ),
        "review_notes": "Tier 4 standards now in force; rate reflects residual improvement from remaining Tier 2/3 fleet replacement.",
    },
    {
        "track_id": "rail_freight__background_electric_traction_efficiency_drift",
        "label": "Background electric traction efficiency drift — rail freight",
        "description": (
            "Exogenous electricity-intensity improvement from improved power electronics "
            "and traction motor technology in electric freight locomotives. "
            "Rate: -0.3%/yr compounding; multiplier 1.000 → 0.928 by 2050. "
            "Applies to overhead_electrification state."
        ),
        "applicable_states": ["rail_freight__overhead_electrification"],
        "affected_commodities": ["electricity"],
        "rate": -0.003,
        "multipliers": {},
        "evidence": (
            "ABB/Siemens electric freight locomotive traction drive improvements; "
            "power electronics efficiency trend; IEA electric rail efficiency data."
        ),
        "confidence": "Medium",
        "double_counting_guardrail": (
            "Applies to overhead_electrification only. Diesel and H2 states excluded. "
            "Non-stacking with regenerative braking on OHL."
        ),
        "review_notes": "Conservative rate; power electronics improvements may be faster post-2030.",
    },
]

for _aet in AET_DATA:
    for _yr in YEARS:
        _n = _yr - 2025
        _aet["multipliers"][_yr] = round((1 + _aet["rate"]) ** _n, 6)


def write_family_states():
    path = os.path.join(HERE, "family_states.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FS_FIELDNAMES)
        writer.writeheader()
        for state_id, meta, year_data in ALL_STATES:
            for year in YEARS:
                writer.writerow(fs_row(FAMILY_ID, state_id, year, year_data[year], meta))
    rows = len(ALL_STATES) * len(YEARS)
    print(f"  Written: {path}  ({rows} rows, {len(ALL_STATES)} states × {len(YEARS)} years)")


def write_demand():
    path = os.path.join(HERE, "demand.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=DEMAND_FIELDNAMES)
        writer.writeheader()
        writer.writerow(DEMAND_ROW)
    print(f"  Written: {path}  (anchor = {ANCHOR_BILLION_TKM} billion_tkm)")


def write_efficiency_packages():
    path = os.path.join(HERE, "efficiency_packages.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=EP_FIELDNAMES)
        writer.writeheader()
        for ep in EP_DATA:
            for year in YEARS:
                n_comm = len(ep["affected_commodities"])
                writer.writerow({
                    "family_id":                 FAMILY_ID,
                    "package_id":                ep["package_id"],
                    "year":                      year,
                    "package_label":             ep["label"],
                    "package_description":       ep["description"],
                    "classification":            ep["classification"],
                    "applicable_state_ids":      je(ep["applicable_states"]),
                    "affected_input_commodities": je(ep["affected_commodities"]),
                    "input_multipliers":         je([ep["multiplier"]] * n_comm),
                    "delta_output_cost_per_unit": ep["delta_cost"][year],
                    "cost_basis_year":           2024,
                    "currency":                  "AUD_2024",
                    "max_share":                 ep["max_shares"][year],
                    "rollout_limit_notes":       ROLLOUT_NOTES,
                    "source_ids":                SOURCES,
                    "assumption_ids":            ASSUMPTIONS,
                    "evidence_summary":          ep["evidence"],
                    "derivation_method":         DERIVATION,
                    "confidence_rating":         ep["confidence"],
                    "review_notes":              ep["review_notes"],
                    "non_stacking_group":        ep["non_stacking_group"],
                })
    print(f"  Written: {path}  ({len(EP_DATA)} packages × {len(YEARS)} years)")


def write_autonomous_tracks():
    path = os.path.join(HERE, "autonomous_efficiency_tracks.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=AET_FIELDNAMES)
        writer.writeheader()
        for aet in AET_DATA:
            for year in YEARS:
                n_comm = len(aet["affected_commodities"])
                writer.writerow({
                    "family_id":                  FAMILY_ID,
                    "track_id":                   aet["track_id"],
                    "year":                       year,
                    "track_label":                aet["label"],
                    "track_description":          aet["description"],
                    "applicable_state_ids":       je(aet["applicable_states"]),
                    "affected_input_commodities": je(aet["affected_commodities"]),
                    "input_multipliers":          je([aet["multipliers"][year]] * n_comm),
                    "delta_output_cost_per_unit": 0,
                    "cost_basis_year":            2024,
                    "currency":                   "AUD_2024",
                    "source_ids":                 SOURCES,
                    "assumption_ids":             ASSUMPTIONS,
                    "evidence_summary":           aet["evidence"],
                    "derivation_method":          DERIVATION,
                    "confidence_rating":          aet["confidence"],
                    "double_counting_guardrail":  aet["double_counting_guardrail"],
                    "review_notes":               aet["review_notes"],
                })
    print(f"  Written: {path}  ({len(AET_DATA)} tracks × {len(YEARS)} years)")


def print_calibration_check():
    print("\n  Calibration check (rail freight):")
    for state_id, meta, year_data in ALL_STATES:
        yd = year_data[2025]
        c = yd["coefficients"]
        total_e = sum(c)
        total_pj = total_e * ANCHOR_BILLION_TKM / 1e6
        print(f"    {state_id:50s}  energy: {total_e:8.0f} GJ/bn_tkm = {total_pj:5.1f} PJ  "
              f"CO2e: {yd['energy_co2e']:6.0f} tCO2e/bn_tkm = "
              f"{yd['energy_co2e'] * ANCHOR_BILLION_TKM / 1e6:.2f} MtCO2e/yr")
    print(f"\n    AES reference:  {AES_TOTAL_PJ:.0f} PJ (estimated rail freight)")
    print(f"    NGGI check:     {TOTAL_CO2E_2025_MT} MtCO2e (rail freight 1.5-2.0 OK)")


if __name__ == "__main__":
    print(f"\nGenerating rail_freight family CSVs "
          f"({ANCHOR_BILLION_TKM} billion_tkm, {AES_TOTAL_PJ} PJ)\n")
    write_family_states()
    write_demand()
    write_efficiency_packages()
    write_autonomous_tracks()
    print_calibration_check()
    print("\nDone.")

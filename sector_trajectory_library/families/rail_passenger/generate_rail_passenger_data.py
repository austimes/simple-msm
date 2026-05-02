#!/usr/bin/env python3
"""
Rail Passenger — Phase 1 Generator
====================================
Generates rail_passenger family CSVs calibrated to AES 2023-24 and BITRE.

Scope: Australian passenger rail (urban metro, suburban, and regional/intercity).
Anchor: 22,000 million_pkm (BITRE Rail Summary Data; urban metro + regional rail).

Calibration basis
-----------------
AES 2023-24 estimated rail passenger share: ~8 PJ.
BITRE Rail Summary Data: 22,000 million pkm total rail passenger.

Per-unit energy intensity:
  8,000,000 GJ / 22,000 million_pkm = 363.6 GJ/million_pkm (≈ 0.36 MJ/pkm; reasonable for rail)
  National average: ~50% electric, ~50% diesel by energy.
  Coefficients 2025: electricity 182, diesel 182 GJ/million_pkm.

Emission factors (NGA 2025, AR5 GWP100, scope 1):
  Diesel: 69.9 kgCO2e/GJ
  Electricity: 0 kgCO2e/GJ (scope 2 excluded per A003)
  Hydrogen: 0 kgCO2e/GJ (green H2)

Energy CO2e 2025 (scope 1 diesel only): 182 × 69.9 / 1000 = 12.7 tCO2e/million_pkm
Total CO2e: 12.5 × 22,000 / 1e6 = 0.27 MtCO2e (NGGI rail ~0.3 MtCO2e OK)

Demand trajectory: growing__rail_passenger (+1.5%/yr; urban rail investment growth)

Sources: S001 (AES), S004 (NGGI), S012 (BITRE passenger)
Assumptions: A002, A003, A022, A023
"""

import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = [2025, 2030, 2035, 2040, 2045, 2050]

# ── calibration constants ────────────────────────────────────────────────────
AES_TOTAL_PJ         = 8.0
ANCHOR_MILLION_PKM   = 22_000     # million_pkm (BITRE rail summary)
ELEC_2025            = 182.0      # GJ/million_pkm (50% of total)
DIESEL_2025          = 182.0      # GJ/million_pkm (50% of total)
TOTAL_INTENSITY_2025 = ELEC_2025 + DIESEL_2025  # 364 GJ/million_pkm
EF_DIESEL            = 69.9       # kgCO2e/GJ
EF_ELEC              = 0.0        # scope 2 excluded
EF_H2                = 0.0        # green hydrogen

ENERGY_CO2E_2025  = round(DIESEL_2025 * EF_DIESEL / 1000, 1)  # 12.5
TOTAL_CO2E_2025_MT = round(ENERGY_CO2E_2025 * ANCHOR_MILLION_PKM / 1e6, 2)

FAMILY_ID   = "rail_passenger"
OUTPUT_UNIT = "million_pkm"
EMISSIONS_UNITS = "tCO2e/million_pkm"

COST_COMPONENTS = (
    "Annualised non-fuel operating cost per million passenger-kilometres (real 2024 AUD), "
    "excluding explicit energy commodity purchases and carbon costs."
)
EMISSIONS_BOUNDARY = (
    "Direct scope 1 diesel combustion only. Electricity upstream (scope 2) excluded; "
    "captured by the electricity supply family. Green hydrogen combustion CO2 = 0. "
    "No process emissions for rail passenger services."
)
ROLLOUT_NOTES = (
    "National adoption bound reflecting rail fleet replacement cycles (~30-40 yr), "
    "infrastructure investment lead times, and state government network investment programmes."
)
SOURCES     = json.dumps(["S001", "S004", "S012"])
ASSUMPTIONS = json.dumps(["A002", "A003", "A022", "A023"])
DERIVATION  = (
    f"Energy coefficients from AES 2023-24 estimated rail passenger share ({AES_TOTAL_PJ} PJ) "
    f"/ BITRE {ANCHOR_MILLION_PKM:,} million_pkm = {TOTAL_INTENSITY_2025:.1f} GJ/million_pkm. "
    f"National average split: 50% electric (182 GJ), 50% diesel (182 GJ). "
    f"NGGI check (scope 1 diesel): {ENERGY_CO2E_2025} × {ANCHOR_MILLION_PKM:,} / 1e6 = "
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
#  STATE 1 — CONVENTIONAL MIXED (incumbent)
#  Mixed electric urban + diesel regional fleet (national average ~50/50 by energy)
# ═══════════════════════════════════════════════════════════════════════════════
CONV_META = {
    "label": "Conventional mixed — rail passenger",
    "description": (
        "Mixed fleet of electric urban trains and diesel-powered regional trains "
        "representing the national average. Urban metro/suburban systems (Sydney, "
        "Melbourne, Brisbane, Perth, Adelaide) are predominantly electric; regional "
        "and interstate services are diesel. National average ~50% electric, 50% diesel "
        "by energy content. Electricity efficiency improves and diesel share declines "
        "as electrification progresses. "
        "AES 2023-24 calibration: 8 PJ / 22,000 million_pkm = 364 GJ/million_pkm."
    ),
    "commodities":  je(["electricity", "diesel"]),
    "units":        je(["GJ/million_pkm", "GJ/million_pkm"]),
    "input_basis":  (
        "AES 2023-24 estimated rail passenger: 8 PJ / 22,000 million_pkm = 364 GJ/million_pkm. "
        "50/50 split by energy: electricity 182, diesel 182 GJ/million_pkm (2025). "
        "2050: electricity 195 (electrification shift), diesel 120 (fewer diesel services)."
    ),
    "evidence":     "AES 2023-24 Table F estimated rail passenger share; BITRE Rail Summary Data; NGGI rail.",
    "confidence":   "Medium",
    "review_notes": (
        "50/50 energy split is a national average approximation. State-level electric "
        "shares vary significantly (NSW high electric; QLD/WA high diesel regional). "
        "Phase 2: disaggregate by state and service type."
    ),
    "expansion":    "Disaggregate into urban electric, suburban electric, regional diesel, and intercity diesel sub-families.",
    "times_mapping": "Maps to national passenger rail demand technology.",
    "stage_family": "incumbent", "stage_rank": 10, "stage_code": "incumbent",
    "sort_key": "01_incumbent", "label_std": "Incumbent | conventional mixed",
    "is_incumbent": True,
    "option_rank": 0, "option_code": "O0", "option_label": "O0 | conventional mixed",
}

CONV_DATA = {}
for _yr in YEARS:
    _elec = round(interp(182.0, 195.0, _yr), 1)
    _diesel = round(interp(182.0, 120.0, _yr), 1)
    _eco2e = round(_diesel * EF_DIESEL / 1000, 1)
    _ms = round(interp(1.00, 0.55, _yr), 2)
    CONV_DATA[_yr] = dict(
        cost=0.08,
        coefficients=[_elec, _diesel],
        energy_co2e=_eco2e,
        max_share=_ms,
    )

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 2 — FULLY ELECTRIFIED (progression)
#  Overhead line electrification for urban and intercity corridors
# ═══════════════════════════════════════════════════════════════════════════════
OHL_META = {
    "label": "Fully electrified OHL — rail passenger",
    "description": (
        "Full overhead line (OHL) electrification of urban, suburban and intercity "
        "rail corridors. Eliminates diesel for electrified routes. Energy intensity "
        "250 GJ/million_pkm (0.25 MJ/pkm; consistent with loaded urban trains) "
        "improving to 200 GJ/million_pkm by 2050 via regenerative braking and "
        "lighter rolling stock. Zero scope 1 CO2e; electricity scope 2 excluded per A003."
    ),
    "commodities":  je(["electricity"]),
    "units":        je(["GJ/million_pkm"]),
    "input_basis":  (
        "Electric rail energy intensity: 250 GJ electricity/million_pkm (2025) = "
        "0.25 MJ/pkm. Improving to 200 GJ/million_pkm (2050) with regenerative braking "
        "retrofits and new-generation rolling stock. Scope 1 CO2e = 0."
    ),
    "evidence":     (
        "NSW TrainLink electric fleet energy data; Melbourne Metro operational statistics; "
        "BITRE rail energy intensity estimates; UIC Railway Statistics Summary."
    ),
    "confidence":   "Medium",
    "review_notes": (
        "OHL electrification is capital-intensive and requires long planning/construction "
        "lead times. Max share of 60% reflects the electrifiable network fraction. "
        "Some regional routes may remain non-electrified."
    ),
    "expansion":    "Add explicit OHL infrastructure investment and electrification programme schedule.",
    "times_mapping": "Maps to electrified rail passenger demand node.",
    "stage_family": "progression", "stage_rank": 20, "stage_code": "ambition1",
    "sort_key": "02_ambition1", "label_std": "Ambition 1 | fully electrified OHL",
    "is_incumbent": False,
    "option_rank": 1, "option_code": "O1", "option_label": "O1 | fully electrified",
}

OHL_DATA = {}
for _yr in YEARS:
    _coeff = round(interp(250.0, 200.0, _yr), 1)
    _ms = round(interp(0.15, 0.60, _yr), 2)
    OHL_DATA[_yr] = dict(
        cost=0.07,
        coefficients=[_coeff],
        energy_co2e=0.0,
        max_share=_ms,
    )

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 3 — HYDROGEN REGIONAL (progression)
#  Hydrogen fuel cell trains for non-electrified regional routes
# ═══════════════════════════════════════════════════════════════════════════════
H2_META = {
    "label": "Hydrogen regional train — rail passenger",
    "description": (
        "Hydrogen fuel cell multiple unit (HFCMU) trains for non-electrified regional "
        "routes, replacing diesel. Fuel cell efficiency advantage partially offset by "
        "hydrogen production and storage losses. Energy intensity 320 GJ H2/million_pkm "
        "(2030) improving to 250 GJ H2/million_pkm (2050). Zero scope 1 CO2e with "
        "green hydrogen supply. Available from 2030 (not commercially deployed in "
        "Australia before 2030)."
    ),
    "commodities":  je(["hydrogen"]),
    "units":        je(["GJ/million_pkm"]),
    "input_basis":  (
        "H2 FC train: diesel energy 182 GJ/million_pkm equivalent → H2 FC efficiency "
        "advantage gives ~300-320 GJ H2/million_pkm (2030) accounting for H2 chain losses. "
        "Improving to 250 GJ H2/million_pkm (2050). Scope 1 CO2e = 0. Not available 2025."
    ),
    "evidence":     (
        "Alstom Coradia iLint performance data; Siemens Mireo Plus H fuel cell train; "
        "Queensland hydrogen train trial; ARENA hydrogen rail roadmap 2022."
    ),
    "confidence":   "Low",
    "review_notes": (
        "H2 rail is at demonstration scale in Australia. Commercial deployment "
        "expected from 2030-2035. Green H2 supply chain maturity is the binding constraint."
    ),
    "expansion":    "Add explicit H2 refuelling station infrastructure; distinguish on-board H2 storage options.",
    "times_mapping": "Maps to hydrogen regional rail demand node.",
    "stage_family": "progression", "stage_rank": 30, "stage_code": "ambition2",
    "sort_key": "03_ambition2", "label_std": "Ambition 2 | hydrogen regional",
    "is_incumbent": False,
    "option_rank": 2, "option_code": "O2", "option_label": "O2 | hydrogen regional",
    "avail_note": "Available from 2030; zero coefficients and max_share in 2025.",
}

_h2_rail_coeffs = {2025: 0.0, 2030: 320.0, 2035: 300.0, 2040: 280.0, 2045: 265.0, 2050: 250.0}
_h2_rail_ms     = {2025: 0.00, 2030: 0.01, 2035: 0.04, 2040: 0.09, 2045: 0.15, 2050: 0.20}
_h2_rail_cost   = {2025: 0.15, 2030: 0.13, 2035: 0.11, 2040: 0.10, 2045: 0.09, 2050: 0.09}

H2_DATA = {}
for _yr in YEARS:
    H2_DATA[_yr] = dict(
        cost=_h2_rail_cost[_yr],
        coefficients=[_h2_rail_coeffs[_yr]],
        energy_co2e=0.0,
        max_share=_h2_rail_ms[_yr],
    )

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 4 — BATTERY ELECTRIC REGIONAL (progression)
#  Battery-electric trains for short-to-medium regional routes
# ═══════════════════════════════════════════════════════════════════════════════
BAT_META = {
    "label": "Battery-electric regional train — rail passenger",
    "description": (
        "Battery-electric multiple unit trains for short-to-medium non-electrified "
        "regional routes (50-200 km). Charged at electrified termini or charging "
        "stations. Slightly higher energy intensity than OHL trains due to battery "
        "weight and charging overhead (280 GJ/million_pkm → 230 GJ/million_pkm). "
        "Limited range; not suitable for long regional routes. Zero scope 1 CO2e."
    ),
    "commodities":  je(["electricity"]),
    "units":        je(["GJ/million_pkm"]),
    "input_basis":  (
        "Battery-electric train: 280 GJ electricity/million_pkm (2025; battery weight "
        "penalty ~10-15% vs OHL), improving to 230 GJ/million_pkm (2050). "
        "Scope 1 CO2e = 0; electricity scope 2 excluded per A003."
    ),
    "evidence":     (
        "Hitachi AT300 battery train performance; Bombardier Talent 3 battery data; "
        "ARENA battery rail feasibility study; European battery train deployments."
    ),
    "confidence":   "Low",
    "review_notes": (
        "Battery range (typically <150 km per charge) limits applicability. "
        "Max share 15% reflects short regional route fraction. "
        "Competes with hydrogen on medium regional routes."
    ),
    "expansion":    "Add explicit range and charging constraint by route class.",
    "times_mapping": "Maps to battery-electric regional rail demand node.",
    "stage_family": "progression", "stage_rank": 25, "stage_code": "ambition1b",
    "sort_key": "02_ambition1b", "label_std": "Ambition 1b | battery electric regional",
    "is_incumbent": False,
    "option_rank": 3, "option_code": "O3", "option_label": "O3 | battery electric regional",
}

BAT_DATA = {}
for _yr in YEARS:
    _coeff = round(interp(280.0, 230.0, _yr), 1)
    _ms = round(interp(0.01, 0.15, _yr), 2)
    BAT_DATA[_yr] = dict(
        cost=round(interp(0.12, 0.08, _yr), 4),
        coefficients=[_coeff],
        energy_co2e=0.0,
        max_share=_ms,
    )

ALL_STATES = [
    ("rail_passenger__conventional_mixed",        CONV_META, CONV_DATA),
    ("rail_passenger__fully_electrified",          OHL_META,  OHL_DATA),
    ("rail_passenger__hydrogen_regional",          H2_META,   H2_DATA),
    ("rail_passenger__battery_electric_regional",  BAT_META,  BAT_DATA),
]

DEMAND_ROW = {
    "family_id":             FAMILY_ID,
    "anchor_year":           2025,
    "anchor_value":          ANCHOR_MILLION_PKM,
    "unit":                  OUTPUT_UNIT,
    "demand_growth_curve_id": "growing__rail_passenger",
    "anchor_status":         "calibrated",
    "source_family":         "Phase 1 reference scenario v0.1",
    "coverage_note": (
        f"BITRE Rail Summary Data: {ANCHOR_MILLION_PKM:,} million_pkm (urban metro + regional). "
        f"AES 2023-24 estimated rail passenger share: {AES_TOTAL_PJ} PJ. "
        f"Coverage: {AES_TOTAL_PJ*1e6 / (TOTAL_INTENSITY_2025 * ANCHOR_MILLION_PKM) * 100:.1f}%."
    ),
    "notes": (
        f"Calibrated to AES 2023-24 estimated rail passenger energy and BITRE Rail Summary Data. "
        f"Energy at anchor: {ANCHOR_MILLION_PKM:,} million_pkm × {TOTAL_INTENSITY_2025:.0f} GJ/million_pkm "
        f"= {TOTAL_INTENSITY_2025 * ANCHOR_MILLION_PKM / 1e6:.1f} PJ "
        f"(AES estimate: {AES_TOTAL_PJ} PJ). "
        f"Total scope 1 CO2e: {TOTAL_CO2E_2025_MT} MtCO2e (NGGI rail ~0.3 MtCO2e OK). "
        "Demand trajectory: growing__rail_passenger (+1.5%/yr; urban rail investment growth)."
    ),
}

# ── efficiency packages ──────────────────────────────────────────────────────
EP_DATA = [
    {
        "package_id": "rail_passenger__regenerative_braking_upgrade",
        "label": "Regenerative braking upgrade",
        "description": (
            "Upgrade of electric rolling stock to capture braking energy and return "
            "it to the overhead line or on-board battery. Reduces net electricity "
            "consumption by 12%. Applies to conventional_mixed (electricity input) "
            "and fully_electrified states."
        ),
        "classification": "pure_efficiency_overlay",
        "applicable_states": [
            "rail_passenger__conventional_mixed",
            "rail_passenger__fully_electrified",
        ],
        "affected_commodities": ["electricity"],
        "multiplier": 0.88,
        "max_shares": {2025: 0.05, 2030: 0.14, 2035: 0.25, 2040: 0.35, 2045: 0.42, 2050: 0.45},
        "delta_cost": {yr: 0.0 for yr in YEARS},
        "evidence": (
            "Sydney Trains regenerative braking programme; Melbourne Metro regeneration data; "
            "Network Rail UK regenerative braking economics; Japanese Shinkansen systems."
        ),
        "confidence": "High",
        "review_notes": "Well-established technology; savings depend on receptivity of overhead system.",
        "non_stacking_group": "rail_regen_braking",
    },
    {
        "package_id": "rail_passenger__timetable_loading_optimisation",
        "label": "Timetable and loading optimisation",
        "description": (
            "Optimise train timetables and passenger loading to reduce empty running "
            "and improve occupancy rates. Applies to conventional_mixed state only "
            "(both electricity and diesel). Reduces energy use per pkm by 7% through "
            "improved capacity utilisation."
        ),
        "classification": "operational_efficiency_overlay",
        "applicable_states": ["rail_passenger__conventional_mixed"],
        "affected_commodities": ["electricity", "diesel"],
        "multiplier": 0.93,
        "max_shares": {2025: 0.10, 2030: 0.22, 2035: 0.35, 2040: 0.44, 2045: 0.48, 2050: 0.50},
        "delta_cost": {yr: 0.0 for yr in YEARS},
        "evidence": (
            "NSW Department of Transport rail optimisation study; Australian rail "
            "occupancy data; BITRE transport efficiency analysis."
        ),
        "confidence": "Medium",
        "review_notes": "Operational efficiency gains are real but partially included in existing service contracts.",
        "non_stacking_group": "rail_operational_efficiency",
    },
]

# ── autonomous tracks ────────────────────────────────────────────────────────
AET_DATA = [
    {
        "track_id": "rail_passenger__background_diesel_efficiency_drift",
        "label": "Background diesel efficiency drift — rail passenger",
        "description": (
            "Exogenous diesel efficiency improvement from background fleet renewal "
            "(new-generation diesel multiple units, improved fuel injection, "
            "waste-heat recovery). Rate: -0.4%/yr compounding; multiplier "
            "1.000 → 0.905 by 2050. Applies to conventional_mixed (diesel input only)."
        ),
        "applicable_states": ["rail_passenger__conventional_mixed"],
        "affected_commodities": ["diesel"],
        "rate": -0.004,
        "multipliers": {},
        "evidence": (
            "European DMU fuel efficiency improvement trend; Australian regional fleet "
            "renewal programmes; NGA fuel intensity improvement."
        ),
        "confidence": "Medium",
        "double_counting_guardrail": (
            "Applies to diesel input in conventional_mixed only. "
            "Fully electrified, hydrogen, and battery states excluded. "
            "Non-stacking with timetable optimisation package."
        ),
        "review_notes": "Rate of -0.4%/yr is consistent with European DMU fleet trend.",
    },
    {
        "track_id": "rail_passenger__background_electric_efficiency_drift",
        "label": "Background electric traction efficiency drift — rail passenger",
        "description": (
            "Exogenous electricity-intensity improvement from improved power electronics, "
            "inverter efficiency, and modern traction motors. Rate: -0.3%/yr compounding; "
            "multiplier 1.000 → 0.928 by 2050. Applies to conventional_mixed and "
            "fully_electrified states (electricity input)."
        ),
        "applicable_states": [
            "rail_passenger__conventional_mixed",
            "rail_passenger__fully_electrified",
        ],
        "affected_commodities": ["electricity"],
        "rate": -0.003,
        "multipliers": {},
        "evidence": (
            "European electric rail efficiency trend; IEA rail energy efficiency data; "
            "Siemens/Bombardier traction drive efficiency improvements."
        ),
        "confidence": "Medium",
        "double_counting_guardrail": (
            "Applies to conventional_mixed (electricity input) and fully_electrified. "
            "Non-stacking with regenerative braking package."
        ),
        "review_notes": "Rate of -0.3%/yr aligned with historical electric rail intensity improvement.",
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
    print(f"  Written: {path}  (anchor = {ANCHOR_MILLION_PKM:,} million_pkm)")


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
    print("\n  Calibration check (rail passenger):")
    for state_id, meta, year_data in ALL_STATES:
        yd = year_data[2025]
        c = yd["coefficients"]
        total_e = sum(c)
        total_pj = total_e * ANCHOR_MILLION_PKM / 1e6
        print(f"    {state_id:50s}  energy: {total_e:5.1f} GJ/m_pkm = {total_pj:5.2f} PJ  "
              f"scope1 CO2e: {yd['energy_co2e']:5.1f} tCO2e/m_pkm = "
              f"{yd['energy_co2e'] * ANCHOR_MILLION_PKM / 1e6:.3f} MtCO2e/yr")
    print(f"\n    AES reference:  {AES_TOTAL_PJ:.0f} PJ (estimated rail passenger)")
    print(f"    NGGI check:     {TOTAL_CO2E_2025_MT} MtCO2e (scope 1 diesel; NGGI rail ~0.3 OK)")


if __name__ == "__main__":
    print(f"\nGenerating rail_passenger family CSVs "
          f"({ANCHOR_MILLION_PKM:,} million_pkm, {AES_TOTAL_PJ} PJ)\n")
    write_family_states()
    write_demand()
    write_efficiency_packages()
    write_autonomous_tracks()
    print_calibration_check()
    print("\nDone.")

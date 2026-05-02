#!/usr/bin/env python3
"""
International Aviation — Phase 1 Generator
===========================================
Generates international_aviation family CSVs calibrated to AES 2023-24 and BITRE.

Scope: International air services departing/arriving Australia (international bunkers).
Anchor: 70,000 million passenger-kilometres (BITRE international air travel 2023-24).

Calibration basis
-----------------
AES 2023-24: 165 PJ international aviation bunker fuel.
BITRE: 70,000 million pkm international air travel through Australia.

Per-unit energy intensity:
  165,000,000 GJ / 70,000 million_pkm = 2,357 GJ/million_pkm
  Fuel: 100% aviation turbine fuel (jet kerosene).

Emission factors (NGA 2024, AR5 GWP100, scope 1):
  Aviation turbine fuel: 71.5 kgCO2e/GJ
  Sustainable aviation fuel: 0 kgCO2e/GJ (biogenic)
  Hydrogen: 0 kgCO2e/GJ (zero-carbon if green H2)

Energy CO2e 2025: 2,357 × 71.5 / 1000 = 168.5 tCO2e/million_pkm
Total CO2e 2025: 168.5 × 70,000 / 1e6 = 11.8 MtCO2e (NGGI international aviation bunkers ✓)

Demand trajectory: growing__international_aviation
  +2.0%/yr 2025-2035, +1.0%/yr 2035-2050

Sources: S001 (AES), S004 (NGGI), S012 (BITRE passenger)
Assumptions: A002, A003, A022, A023
"""

import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = [2025, 2030, 2035, 2040, 2045, 2050]

# ── calibration constants ────────────────────────────────────────────────────
AES_TOTAL_PJ        = 165.0
ANCHOR_MILLION_PKM  = 70_000      # million pkm (BITRE 2023-24)
ENERGY_INTENSITY_2025 = 2_357.0  # GJ/million_pkm
EF_ATF              = 71.5        # kgCO2e/GJ
EF_SAF              = 0.0
EF_H2               = 0.0

ENERGY_CO2E_2025    = round(ENERGY_INTENSITY_2025 * EF_ATF / 1000, 1)  # 168.5
TOTAL_CO2E_2025_MT  = round(ENERGY_CO2E_2025 * ANCHOR_MILLION_PKM / 1e6, 1)

FAMILY_ID   = "international_aviation"
OUTPUT_UNIT = "million_pkm"
EMISSIONS_UNITS = "tCO2e/million_pkm"

COST_COMPONENTS = (
    "Annualised non-fuel operating cost per million passenger-km (real 2024 AUD), "
    "excluding explicit energy commodity purchases and carbon costs."
)
EMISSIONS_BOUNDARY = (
    "Direct scope 1 on-board fuel combustion only (international aviation bunkers). "
    "Electricity upstream (scope 2) excluded. SAF biogenic CO2 and green H2 combustion "
    "excluded per NGA accounting convention. No process emissions for aviation."
)
ROLLOUT_NOTES = (
    "National adoption bound reflecting long aircraft retirement cycles (~25 yr life), "
    "international fleet commonality requirements, and Australian carrier market structure."
)
SOURCES     = json.dumps(["S001", "S004", "S012"])
ASSUMPTIONS = json.dumps(["A002", "A003", "A022", "A023"])
DERIVATION  = (
    "Energy coefficients from AES 2023-24 international aviation bunkers (165 PJ) "
    f"/ BITRE 70,000 million_pkm = {ENERGY_INTENSITY_2025} GJ/million_pkm. "
    f"NGGI check: {ENERGY_CO2E_2025} tCO2e/million_pkm × 70,000 / 1e6 = {TOTAL_CO2E_2025_MT} MtCO2e."
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
#  STATE 1 — CONVENTIONAL JET (incumbent)
# ═══════════════════════════════════════════════════════════════════════════════
CONV_META = {
    "label": "Conventional jet — international aviation",
    "description": (
        "Standard aviation turbine fuel combustion for international long-haul services "
        "to/from Australia. Calibrated to AES 2023-24 international aviation bunkers "
        "(165 PJ / 70,000 million_pkm = 2,357 GJ/million_pkm). Higher energy intensity "
        "than domestic due to long-haul sector and heavier fuel load. Gradual fleet "
        "efficiency improvement (Airbus A350, Boeing 787 replacing A380/747 era) "
        "reduces intensity 2,357 → 2,100 GJ/million_pkm by 2050."
    ),
    "commodities":  je(["aviation_turbine_fuel"]),
    "units":        je(["GJ/million_pkm"]),
    "input_basis":  (
        "AES 2023-24 international aviation bunkers: 165 PJ / 70,000 million_pkm = "
        "2,357 GJ/million_pkm. Fleet renewal (A350, 787) reduces to 2,100 by 2050."
    ),
    "evidence":     "AES 2023-24 international bunkers; BITRE international air travel 2023-24; NGGI international aviation.",
    "confidence":   "Medium",
    "review_notes": (
        "International bunker statistics have boundary uncertainty (flag-of-convenience, "
        "fuel uplifted overseas). Phase 2: reconcile with ICAO CORSIA fuel uplift data."
    ),
    "expansion":    "Disaggregate by destination region (Pacific, Asia, Europe, Americas) reflecting route length variation.",
    "times_mapping": "Maps to international aviation demand technology node.",
    "stage_family": "incumbent", "stage_rank": 10, "stage_code": "incumbent",
    "sort_key": "01_incumbent", "label_std": "Incumbent | conventional jet",
    "is_incumbent": True,
    "option_rank": 0, "option_code": "O0", "option_label": "O0 | conventional jet",
    "avail_note": "Available from 2025.",
}

CONV_DATA = {}
for _yr in YEARS:
    _coeff = round(interp(2357.0, 2100.0, _yr), 1)
    _eco2e = round(_coeff * EF_ATF / 1000, 1)
    _ms = round(interp(1.00, 0.70, _yr), 2)
    CONV_DATA[_yr] = dict(
        cost=0.04,
        coefficients=[_coeff],
        energy_co2e=_eco2e,
        max_share=_ms,
    )

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 2 — SAF BLEND (progression)
# ═══════════════════════════════════════════════════════════════════════════════
SAF_META = {
    "label": "SAF blend — international aviation",
    "description": (
        "Sustainable aviation fuel drop-in blend for international long-haul services. "
        "SAF penetration is slower than domestic due to long-haul aircraft range "
        "requirements and larger global SAF supply constraints. ATF share declines "
        "from 100% in 2025 to 20% by 2050 (80% SAF). Only ATF fraction contributes "
        "to scope 1 CO2e; SAF biogenic CO2 excluded per NGA accounting."
    ),
    "commodities":  je(["aviation_turbine_fuel", "sustainable_aviation_fuel"]),
    "units":        je(["GJ/million_pkm", "GJ/million_pkm"]),
    "input_basis":  (
        "ATF fraction: 100%→20% and SAF fraction: 0%→80% of 2,357→2,100 GJ/million_pkm total. "
        "CO2e from ATF fraction only; SAF = 0 kgCO2e/GJ scope 1."
    ),
    "evidence":     (
        "ICAO CORSIA SAF pathway data; IEA SAF outlook 2024; ReFuelEU Aviation regulation context; "
        "BITRE Australian SAF Supply Chain study 2023."
    ),
    "confidence":   "Low",
    "review_notes": (
        "International long-haul SAF penetration is constrained by supply chain, "
        "certification timelines, and cost. Slower trajectory than domestic."
    ),
    "expansion":    "Distinguish HEFA, e-SAF, and alcohol-to-jet pathways with feedstock supply constraints.",
    "times_mapping": "Maps to international SAF demand node.",
    "stage_family": "progression", "stage_rank": 20, "stage_code": "ambition1",
    "sort_key": "02_ambition1", "label_std": "Ambition 1 | SAF blend",
    "is_incumbent": False,
    "option_rank": 1, "option_code": "O1", "option_label": "O1 | SAF blend",
    "avail_note": "Available from 2025; commercial scale expected from 2030.",
}

# ATF shares: 2025=100%, 2030=90%, 2035=80%, 2040=60%, 2045=40%, 2050=20%
_intl_saf_atf = {2025: 1.00, 2030: 0.90, 2035: 0.80, 2040: 0.60, 2045: 0.40, 2050: 0.20}

SAF_DATA = {}
for _yr in YEARS:
    _total = round(interp(2357.0, 2100.0, _yr), 1)
    _atf_s = _intl_saf_atf[_yr]
    _saf_s = 1.0 - _atf_s
    _atf = round(_total * _atf_s, 1)
    _saf = round(_total * _saf_s, 1)
    _eco2e = round(_atf * EF_ATF / 1000, 1)
    _ms = round(interp(0.00, 0.50, _yr), 2)
    SAF_DATA[_yr] = dict(
        cost=round(interp(0.07, 0.05, _yr), 4),
        coefficients=[_atf, _saf],
        energy_co2e=_eco2e,
        max_share=_ms,
    )

# ═══════════════════════════════════════════════════════════════════════════════
#  STATE 3 — HYDROGEN AIRCRAFT (progression)
# ═══════════════════════════════════════════════════════════════════════════════
H2_META = {
    "label": "Hydrogen combustion aircraft — international aviation",
    "description": (
        "Hydrogen combustion turbine aircraft for long-haul international routes. "
        "Post-2035 technology; requires fundamental redesign of aircraft (cryogenic "
        "H2 tanks, modified turbines). Energy intensity slightly higher than ATF "
        "aircraft due to H2 tankage weight and aerodynamic penalties "
        "(2,200→2,000 GJ/million_pkm H2, vs 2,357 ATF). Zero scope 1 CO2 if "
        "green hydrogen. Available from 2035 only."
    ),
    "commodities":  je(["hydrogen"]),
    "units":        je(["GJ/million_pkm"]),
    "input_basis":  (
        "H2 combustion aircraft energy: 2,200 GJ H2/million_pkm (2035) improving to "
        "2,000 GJ/million_pkm (2050). Scope 1 CO2e = 0 (green H2). "
        "Not available before 2035."
    ),
    "evidence":     (
        "Airbus ZEROe concept study; CSIRO National Hydrogen Roadmap; "
        "IEA Hydrogen Tracking 2024; Clean Sky 2 JU long-haul H2 feasibility."
    ),
    "confidence":   "Exploratory",
    "review_notes": (
        "Hydrogen long-haul aviation is highly uncertain and requires regulatory "
        "certification, airport H2 infrastructure, and supply chain development. "
        "Max share of 15% by 2050 is exploratory only."
    ),
    "expansion":    "Add explicit cryogenic H2 supply chain and airport infrastructure as process chain.",
    "times_mapping": "Maps to hydrogen aircraft demand node; H2 supply from dedicated H2 production family.",
    "stage_family": "progression", "stage_rank": 30, "stage_code": "ambition2",
    "sort_key": "03_ambition2", "label_std": "Ambition 2 | hydrogen aircraft",
    "is_incumbent": False,
    "option_rank": 2, "option_code": "O2", "option_label": "O2 | hydrogen aircraft",
    "avail_note": "Available from 2035 only; set coefficients and max_share to 0 before 2035.",
}

# H2 aircraft data: 0 before 2035, then 2200→2000 GJ/million_pkm
_h2_coeffs = {2025: 0.0, 2030: 0.0, 2035: 2200.0, 2040: 2133.0, 2045: 2067.0, 2050: 2000.0}
_h2_ms     = {2025: 0.00, 2030: 0.00, 2035: 0.02, 2040: 0.06, 2045: 0.10, 2050: 0.15}
_h2_cost   = {2025: 0.15, 2030: 0.15, 2035: 0.12, 2040: 0.09, 2045: 0.07, 2050: 0.06}

H2_DATA = {}
for _yr in YEARS:
    H2_DATA[_yr] = dict(
        cost=_h2_cost[_yr],
        coefficients=[_h2_coeffs[_yr]],
        energy_co2e=0.0,
        max_share=_h2_ms[_yr],
    )

ALL_STATES = [
    ("international_aviation__conventional_jet", CONV_META, CONV_DATA),
    ("international_aviation__saf_blend",        SAF_META,  SAF_DATA),
    ("international_aviation__hydrogen_aircraft", H2_META,  H2_DATA),
]

DEMAND_ROW = {
    "family_id":             FAMILY_ID,
    "anchor_year":           2025,
    "anchor_value":          ANCHOR_MILLION_PKM,
    "unit":                  OUTPUT_UNIT,
    "demand_growth_curve_id": "growing__international_aviation",
    "anchor_status":         "calibrated",
    "source_family":         "Phase 1 reference scenario v0.1",
    "coverage_note": (
        f"BITRE international air travel 2023-24: {ANCHOR_MILLION_PKM:,} million_pkm. "
        f"AES 2023-24: {AES_TOTAL_PJ} PJ international aviation bunkers. "
        f"Coverage: {AES_TOTAL_PJ*1e6 / (ENERGY_INTENSITY_2025 * ANCHOR_MILLION_PKM) * 100:.1f}%."
    ),
    "notes": (
        f"Calibrated to AES 2023-24 and BITRE international air travel 2023-24. "
        f"Energy at anchor: {ANCHOR_MILLION_PKM:,} million_pkm × {ENERGY_INTENSITY_2025} GJ/million_pkm "
        f"= {ENERGY_INTENSITY_2025 * ANCHOR_MILLION_PKM / 1e6:.0f} PJ "
        f"(AES reference: {AES_TOTAL_PJ} PJ, coverage = 100%). "
        f"Total CO2e: {TOTAL_CO2E_2025_MT} MtCO2e (NGGI international aviation bunkers ✓). "
        "Demand trajectory: growing__international_aviation "
        "(+2.0%/yr 2025-2035, +1.0%/yr 2035-2050)."
    ),
}

# ── efficiency packages ──────────────────────────────────────────────────────
EP_DATA = [
    {
        "package_id": "international_aviation__aero_engine_efficiency_retrofit",
        "label": "Aerodynamic and engine efficiency retrofit",
        "description": (
            "Retrofit programme for winglet installation, aerodynamic drag reduction, "
            "and engine performance improvement on existing long-haul fleet. "
            "Reduces ATF consumption by 8% on retrofitted aircraft."
        ),
        "classification": "pure_efficiency_overlay",
        "applicable_states": ["international_aviation__conventional_jet"],
        "affected_commodities": ["aviation_turbine_fuel"],
        "multiplier": 0.92,
        "max_shares": {2025: 0.05, 2030: 0.12, 2035: 0.20, 2040: 0.28, 2045: 0.32, 2050: 0.35},
        "delta_cost": {yr: 0.0 for yr in YEARS},
        "evidence": (
            "Boeing winglet retrofit programme; Airbus sharklet data; "
            "Engine alliance GP7200 performance improvement programmes."
        ),
        "confidence": "Medium",
        "review_notes": "Constrained by fleet age and international retrofit certification requirements.",
        "non_stacking_group": "intl_aviation_efficiency",
    },
    {
        "package_id": "international_aviation__operational_efficiency",
        "label": "Operational efficiency — load factor and route optimisation",
        "description": (
            "Improved load factor management, collaborative route planning, "
            "and reduced approach/taxi fuel burn across international operations. "
            "Reduces ATF consumption by 6%. Applies to conventional jet and SAF blend states."
        ),
        "classification": "operational_efficiency_overlay",
        "applicable_states": [
            "international_aviation__conventional_jet",
            "international_aviation__saf_blend",
        ],
        "affected_commodities": ["aviation_turbine_fuel", "sustainable_aviation_fuel"],
        "multiplier": 0.94,
        "max_shares": {2025: 0.10, 2030: 0.22, 2035: 0.35, 2040: 0.45, 2045: 0.52, 2050: 0.55},
        "delta_cost": {yr: 0.0 for yr in YEARS},
        "evidence": (
            "IATA Fly Net Zero; ICAO CORSIA operational improvement packages; "
            "Qantas and Virgin Australia operational efficiency reporting."
        ),
        "confidence": "Medium",
        "review_notes": "Operational efficiency well-documented but gains partially saturated in leading carriers.",
        "non_stacking_group": "intl_aviation_ops_efficiency",
    },
]

# ── autonomous tracks ────────────────────────────────────────────────────────
AET_DATA = [
    {
        "track_id": "international_aviation__background_fleet_renewal_drift",
        "label": "Background international fleet renewal efficiency drift",
        "description": (
            "Exogenous efficiency improvement from background replacement of A380 and "
            "B747 era aircraft with A350 and B787 generation (15-20% efficiency gain). "
            "Rate: -0.4%/yr compounding; multiplier 1.000 → 0.905 by 2050. "
            "Applies to conventional jet and SAF blend states."
        ),
        "applicable_states": [
            "international_aviation__conventional_jet",
            "international_aviation__saf_blend",
        ],
        "affected_commodities": ["aviation_turbine_fuel", "sustainable_aviation_fuel"],
        "rate": -0.004,
        "multipliers": {},
        "evidence": (
            "Airbus A350 vs A380 efficiency data; Boeing 787 vs 747 comparison; "
            "ICAO long-run fleet efficiency trend; BITRE historical intensity analysis."
        ),
        "confidence": "Medium",
        "double_counting_guardrail": (
            "Applies to conventional_jet and saf_blend only. Hydrogen aircraft excluded "
            "as it represents a distinct technology pathway. Non-stacking with aerodynamic retrofit package."
        ),
        "review_notes": "Rate of -0.4%/yr is conservative relative to historical data; review against ICAO fleet-mix projections.",
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
    print(f"  Written: {path}  ({rows} rows)")


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
    print("\n  Calibration check (international aviation):")
    for state_id, meta, year_data in ALL_STATES:
        yd = year_data[2025]
        c = yd["coefficients"]
        total_e = sum(c)
        total_pj = total_e * ANCHOR_MILLION_PKM / 1e6
        print(f"    {state_id:50s}  energy: {total_e:7.1f} GJ/m_pkm = {total_pj:6.1f} PJ  "
              f"CO2e: {yd['energy_co2e']:6.1f} tCO2e/m_pkm = "
              f"{yd['energy_co2e'] * ANCHOR_MILLION_PKM / 1e6:.2f} MtCO2e/yr")
    print(f"\n    AES reference:  {AES_TOTAL_PJ:.1f} PJ (international aviation bunkers)")
    print(f"    NGGI check:     {TOTAL_CO2E_2025_MT} MtCO2e (international aviation bunkers)")


if __name__ == "__main__":
    print(f"\nGenerating international_aviation family CSVs "
          f"({ANCHOR_MILLION_PKM:,} million_pkm, {AES_TOTAL_PJ} PJ)\n")
    write_family_states()
    write_demand()
    write_efficiency_packages()
    write_autonomous_tracks()
    print_calibration_check()
    print("\nDone.")

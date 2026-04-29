#!/usr/bin/env python3
"""
Coal Mining Sector — Family Data Generator
===========================================
Generates all CSV files for the coal_mining sector family, structured to
address three key modelling questions:

  Q1. Heavy Haulage Pathway  — BEV vs Hydrogen vs Diesel Persistence
  Q2. Electricity Decarbonisation Pace  — reflected through electricity input
      intensity and the five state electricity-coefficient trajectories
  Q3. Fugitive Methane Abatement in Coal  — dedicated low-fugitive and
      integrated low-carbon states with sharply declining process_co2e

Outputs (written to the same directory as this script):
  family_states.csv               — 5 states × 6 milestone years = 30 rows
  efficiency_packages.csv         — 3 packages × 6 years = 18 rows
  autonomous_efficiency_tracks.csv— 2 tracks × 6 years = 12 rows
  demand.csv                      — unchanged anchor row (re-written for completeness)
"""

import csv
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = [2025, 2030, 2035, 2040, 2045, 2050]

# ── shared boilerplate strings ────────────────────────────────────────────────

COST_COMPONENTS = (
    "Annualised capital and O&M cost excluding explicit energy commodity "
    "purchases and excluding policy carbon costs."
)

EMISSIONS_BOUNDARY = (
    "Direct on-site emissions only. Electricity and hydrogen upstream emissions "
    "are excluded from end-use coefficients and represented by supply-side states "
    "to avoid double counting. Fugitive methane (CH4) is captured separately in "
    "process_emissions_by_pollutant."
)

ROLLOUT_NOTES = (
    "Indicative national adoption bound reflecting equipment stock turnover, "
    "capital availability, and mine-site infrastructure constraints. No explicit "
    "vehicle stock model in Phase 1."
)

AVAIL_NOTE = (
    "All states available from 2025 in the reduced-form library; uptake bounds "
    "implicitly reflect infrastructure and stock-turnover constraints."
)

DERIVATION = (
    "Hybrid synthesis: incumbent states calibrated to NGERs, BREE and Geoscience "
    "Australia energy and emissions data; transition states reflect Australian and "
    "international mining equipment cost and performance evidence with smoothed "
    "milestone trajectories."
)

SOURCES = json.dumps(["S001", "S002", "S021"])
ASSUMPTIONS = json.dumps(["A002", "A003", "A009"])

# ── input unit lists (position-matched to input_commodities) ──────────────────
#  Conventional / BEV / low-fugitive / integrated: diesel|elec|expl|water|gas
UNITS_DIESEL_LEAD = json.dumps(
    ["GJ/kt_coal", "GJ/kt_coal", "GJ/kt_coal", "kL/kt_coal", "GJ/kt_coal"]
)
UNITS_ELEC_LEAD = json.dumps(
    ["GJ/kt_coal", "GJ/kt_coal", "GJ/kt_coal", "kL/kt_coal", "GJ/kt_coal"]
)
#  Hydrogen state: h2|elec|diesel|expl|water
UNITS_H2_LEAD = json.dumps(
    ["GJ/kt_coal", "GJ/kt_coal", "GJ/kt_coal", "GJ/kt_coal", "kL/kt_coal"]
)

# ── helper ────────────────────────────────────────────────────────────────────

def lerp(a, b, frac):
    """Linear interpolation between a and b at fraction frac (0=a, 1=b)."""
    return round(a + (b - a) * frac, 6)

def year_frac(year):
    """0 in 2025, 1 in 2050."""
    return (year - 2025) / 25

def compound(start, end, year):
    """Compound decay from start to end over 25 years at given year."""
    f = year_frac(year)
    if start == end or f == 0:
        return round(start, 6)
    rate = (end / start) ** (1 / 25)
    return round(start * (rate ** (year - 2025)), 6)

def je(obj):
    """JSON-encode an object/list for a CSV cell."""
    return json.dumps(obj)

# ═══════════════════════════════════════════════════════════════════════════════
#  FAMILY STATES
# ═══════════════════════════════════════════════════════════════════════════════

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


def fs_row(state_id, year, yd, meta):
    """Build a single family_states row dict."""
    energy_em = je([{"pollutant": "CO2e", "value": yd["energy_co2e"]}])
    process_em = je([{"pollutant": "CH4", "value": yd["process_co2e"]}])
    return {
        "family_id": "coal_mining",
        "state_id": state_id,
        "year": year,
        "state_label": meta["label"],
        "state_description": meta["description"],
        "output_cost_per_unit": yd["cost"],
        "cost_basis_year": 2024,
        "currency": "AUD_2024",
        "cost_components_summary": COST_COMPONENTS,
        "input_commodities": meta["commodities"],
        "input_coefficients": je(yd["coefficients"]),
        "input_units": meta["units"],
        "input_basis_notes": meta["input_basis"],
        "energy_emissions_by_pollutant": energy_em,
        "process_emissions_by_pollutant": process_em,
        "emissions_units": "tCO2e/kt_coal",
        "emissions_boundary_notes": EMISSIONS_BOUNDARY,
        "max_share": yd["max_share"],
        "max_activity": "",
        "min_share": "",
        "rollout_limit_notes": ROLLOUT_NOTES,
        "availability_conditions": AVAIL_NOTE,
        "source_ids": SOURCES,
        "assumption_ids": ASSUMPTIONS,
        "evidence_summary": meta["evidence"],
        "derivation_method": DERIVATION,
        "confidence_rating": meta["confidence"],
        "review_notes": meta["review_notes"],
        "candidate_expansion_pathway": meta["expansion"],
        "times_or_vedalang_mapping_notes": meta["times_mapping"],
        "would_expand_to_explicit_capacity?": "FALSE",
        "would_expand_to_process_chain?": "FALSE",
        "energy_co2e": yd["energy_co2e"],
        "process_co2e": yd["process_co2e"],
        "state_stage_family": meta["stage_family"],
        "state_stage_rank": meta["stage_rank"],
        "state_stage_code": meta["stage_code"],
        "state_sort_key": meta["sort_key"],
        "state_label_standardized": meta["label_std"],
        "is_default_incumbent_2025": "TRUE" if (year == 2025 and meta.get("is_incumbent")) else "FALSE",
        "state_option_rank": meta["option_rank"],
        "state_option_code": meta["option_code"],
        "state_option_label": meta["option_label"],
        "balance_tuning_flag": "FALSE",
        "balance_tuning_note": "",
        "benchmark_balance_note": "",
        "specific_energy_use": yd["sei"],
        "energy_efficiency_index": yd["eei"],
        "equipment_efficiency_rating": yd["eer"],
        "fuel_efficiency_improvement_rate": yd["fir"],
        "electricity_efficiency_improvement_rate": yd["eeir"],
    }


# ── State 1: coal_mining__conventional ───────────────────────────────────────
#  Incumbent diesel + grid-electric fleet. Diesel share slowly erodes as
#  shovels, loaders and conveyors electrify within the conventional fleet.
#  Q1 diesel persistence pathway; baseline for Q2 electricity decarbonisation.

CONV_META = {
    "label": "Conventional coal mining",
    "description": (
        "Diesel and grid-electric equipment covering all mine operations "
        "including haulage, loading, blasting, ventilation and processing. "
        "National-average fleet composition spanning open-cut (≈70%) and "
        "underground (≈30%) operations. Incumbent technology for the 2025 baseline."
    ),
    "commodities": je(["diesel", "electricity", "explosives", "water", "natural_gas"]),
    "units": UNITS_DIESEL_LEAD,
    "input_basis": (
        "National-average input mix combining open-cut (70%) and underground (30%) "
        "operations. Diesel dominates haulage and mobile plant; electricity covers "
        "ventilation, conveyors and processing. Gradual electrification of shovels "
        "and fixed plant embedded in coefficient trajectory."
    ),
    "evidence": (
        "Calibrated to Australian NGERs coal mining energy-and-emissions data, "
        "BREE Energy in Australia, and Geoscience Australia production statistics."
    ),
    "confidence": "Medium",
    "review_notes": (
        "Baseline fleet average; coefficient diesel-to-electricity shift 2025-2050 "
        "embeds gradual electrification of shovels and auxiliary plant within the "
        "conventional fleet. Review fugitive factor against NGERs sector totals "
        "before Phase 2 calibration."
    ),
    "expansion": (
        "Separate open-cut and underground sub-families with explicit haul distances, "
        "mine depths, and equipment rosters."
    ),
    "times_mapping": (
        "Maps to coal-mining demand-technology nodes; could separate haulage "
        "and fixed-plant electricity loads."
    ),
    "stage_family": "incumbent",
    "stage_rank": 10,
    "stage_code": "incumbent",
    "sort_key": "01_incumbent",
    "label_std": "Incumbent | conventional",
    "is_incumbent": True,
    "option_rank": 0,
    "option_code": "O0",
    "option_label": "O0 | conventional",
}

# diesel  elec   expl  water  gas   → per kt_coal (GJ or kL)
CONV_DATA = {
    2025: dict(cost=55, coefficients=[0.700, 0.250, 0.030, 0.010, 0.010],
               energy_co2e=0.090, process_co2e=0.120, max_share=1.00,
               sei=1.20, eei=0.900, eer=0.800, fir=0.015, eeir=0.025),
    2030: dict(cost=56, coefficients=[0.680, 0.270, 0.030, 0.010, 0.010],
               energy_co2e=0.085, process_co2e=0.110, max_share=0.95,
               sei=1.15, eei=0.920, eer=0.820, fir=0.018, eeir=0.030),
    2035: dict(cost=57, coefficients=[0.660, 0.290, 0.030, 0.010, 0.010],
               energy_co2e=0.080, process_co2e=0.100, max_share=0.90,
               sei=1.10, eei=0.940, eer=0.840, fir=0.020, eeir=0.035),
    2040: dict(cost=58, coefficients=[0.640, 0.310, 0.030, 0.010, 0.010],
               energy_co2e=0.075, process_co2e=0.090, max_share=0.85,
               sei=1.05, eei=0.960, eer=0.860, fir=0.022, eeir=0.040),
    2045: dict(cost=59, coefficients=[0.620, 0.330, 0.030, 0.010, 0.010],
               energy_co2e=0.070, process_co2e=0.080, max_share=0.80,
               sei=1.00, eei=0.980, eer=0.880, fir=0.025, eeir=0.045),
    2050: dict(cost=60, coefficients=[0.600, 0.350, 0.030, 0.010, 0.010],
               energy_co2e=0.065, process_co2e=0.070, max_share=0.75,
               sei=0.95, eei=1.000, eer=0.900, fir=0.028, eeir=0.050),
}

# ── State 2: coal_mining__heavy_haulage_bev ───────────────────────────────────
#  Q1 BEV pathway. Battery-electric haul trucks replace diesel primary
#  haulage. Drivetrain efficiency ≈3× vs diesel ICE reduces total site energy.
#  Residual diesel retained for non-electrified ancillary plant.
#  Q2: maximises electricity fraction, capturing full benefit of grid
#  decarbonisation through the electricity supply family.

BEV_META = {
    "label": "Battery-electric heavy haulage",
    "description": (
        "Battery-electric haul trucks (BEV) replace diesel for primary haulage in "
        "open-cut operations. On-board or pantograph charging at dump and loading "
        "points. Auxiliary equipment remains mixed; residual diesel retained for "
        "specialised plant not yet commercially available in electric form. "
        "Q1: BEV heavy haulage pathway. Q2: maximum electricity use, positioning "
        "the mine to benefit from grid decarbonisation."
    ),
    "commodities": je(["electricity", "diesel", "explosives", "water", "natural_gas"]),
    "units": UNITS_ELEC_LEAD,
    "input_basis": (
        "BEV haul trucks replace diesel primary haulage (~0.45 GJ/kt_coal diesel "
        "equivalent). BEV drivetrain efficiency ≈3× ICE reduces electricity demand "
        "to ~0.18 GJ/kt_coal for haulage. Added to existing 0.25 GJ/kt fixed-plant "
        "electricity. Residual diesel (0.05→0.02 GJ/kt) covers pump drives and "
        "specialised ancillary equipment."
    ),
    "evidence": (
        "Global BEV mining-truck pilots (Komatsu 930E-AT electric, Epiroc Minetruck "
        "MT42 Battery) and Australian mining electrification roadmaps. Cost trajectory "
        "reflects ~10-12 % learning rate per cumulative capacity doubling."
    ),
    "confidence": "Low",
    "review_notes": (
        "Electricity coefficient reflects drivetrain efficiency advantage. Charging "
        "electricity demand modelled at mine-face per shift. Max share trajectory "
        "constrained by haul-truck stock turnover (~8-12 yr life) and charging "
        "infrastructure lead time. Review against Pilbara and Bowen Basin pilot data."
    ),
    "expansion": (
        "Separate open-cut BEV haulage sub-family with explicit battery sizing, "
        "charging cycle, grid connection capacity, and haul-profile constraints."
    ),
    "times_mapping": (
        "Maps to electric-vehicle demand node with grid-connected charging "
        "infrastructure capacity constraint and battery storage."
    ),
    "stage_family": "progression",
    "stage_rank": 20,
    "stage_code": "ambition1",
    "sort_key": "02_ambition1",
    "label_std": "Ambition 1 | heavy haulage bev",
    "is_incumbent": False,
    "option_rank": 1,
    "option_code": "O1",
    "option_label": "O1 | heavy haulage bev",
}

# elec  diesel expl  water  gas   → per kt_coal (GJ or kL)
BEV_DATA = {
    2025: dict(cost=78, coefficients=[0.500, 0.050, 0.030, 0.010, 0.010],
               energy_co2e=0.007, process_co2e=0.120, max_share=0.05,
               sei=0.58, eei=0.950, eer=0.880, fir=0.010, eeir=0.030),
    2030: dict(cost=72, coefficients=[0.515, 0.040, 0.030, 0.010, 0.010],
               energy_co2e=0.005, process_co2e=0.110, max_share=0.12,
               sei=0.56, eei=0.970, eer=0.900, fir=0.012, eeir=0.035),
    2035: dict(cost=65, coefficients=[0.525, 0.030, 0.030, 0.010, 0.010],
               energy_co2e=0.004, process_co2e=0.100, max_share=0.25,
               sei=0.54, eei=0.990, eer=0.920, fir=0.014, eeir=0.040),
    2040: dict(cost=60, coefficients=[0.535, 0.025, 0.030, 0.010, 0.010],
               energy_co2e=0.003, process_co2e=0.090, max_share=0.45,
               sei=0.52, eei=1.010, eer=0.940, fir=0.016, eeir=0.045),
    2045: dict(cost=57, coefficients=[0.545, 0.020, 0.030, 0.010, 0.010],
               energy_co2e=0.002, process_co2e=0.080, max_share=0.60,
               sei=0.50, eei=1.030, eer=0.960, fir=0.018, eeir=0.048),
    2050: dict(cost=55, coefficients=[0.550, 0.020, 0.030, 0.010, 0.010],
               energy_co2e=0.002, process_co2e=0.070, max_share=0.70,
               sei=0.48, eei=1.050, eer=0.980, fir=0.020, eeir=0.050),
}

# ── State 3: coal_mining__heavy_haulage_hydrogen ──────────────────────────────
#  Q1 Hydrogen pathway. FCEV haul trucks suited to long-haul cycles where
#  BEV range or charging dwell-time is limiting. Green hydrogen delivered
#  or produced on-site via electrolyser. Later and costlier adoption than BEV.

H2_META = {
    "label": "Hydrogen fuel cell heavy haulage",
    "description": (
        "Hydrogen fuel cell electric vehicle (FCEV) haul trucks replace diesel "
        "for primary haulage on long haul cycles where battery range or charging "
        "dwell time constrains BEV. Green or low-carbon hydrogen delivered by "
        "tube trailer or produced on-site by electrolyser. Residual diesel "
        "retained for ancillary specialised plant. Q1: Hydrogen heavy haulage "
        "pathway."
    ),
    "commodities": je(["hydrogen", "electricity", "diesel", "explosives", "water"]),
    "units": UNITS_H2_LEAD,
    "input_basis": (
        "Hydrogen FCEV drivetrain efficiency ≈2× diesel ICE at wheel. Hydrogen "
        "coefficient (GJ/kt_coal) covers primary haulage cycle assuming green H2 "
        "at ~120 MJ/kg LHV delivered. Electricity retained for all fixed-plant "
        "operations. Residual diesel (0.04→0.015 GJ/kt) covers pump drives and "
        "non-FCEV ancillaries."
    ),
    "evidence": (
        "CSIRO and Geoscience Australia hydrogen roadmaps for mining; global FCEV "
        "truck pilots including Anglo American nuGen prototype and Fortescue "
        "hydrogen haul programme. Cost trajectory reflects hydrogen supply chain "
        "maturation lagging BEV by ~5 years."
    ),
    "confidence": "Low",
    "review_notes": (
        "Hydrogen coefficient assumes green H2 supply-chain emissions handled by "
        "hydrogen supply sector. Max share constrained by H2 supply infrastructure "
        "lead time and tube-trailer logistics. Upper bound lower than BEV because "
        "hydrogen infrastructure is less certain. Review against Fortescue "
        "and BHP H2 haulage pilots post-2027."
    ),
    "expansion": (
        "Separate open-cut hydrogen-haulage sub-family with on-site electrolyser "
        "vs truck-delivery cost optimisation and explicit hydrogen storage."
    ),
    "times_mapping": (
        "Maps to hydrogen-vehicle demand node with upstream green hydrogen supply "
        "and on-site storage capacity constraint."
    ),
    "stage_family": "progression",
    "stage_rank": 20,
    "stage_code": "ambition1",
    "sort_key": "02_ambition1",
    "label_std": "Ambition 1 | heavy haulage hydrogen",
    "is_incumbent": False,
    "option_rank": 2,
    "option_code": "O2",
    "option_label": "O2 | heavy haulage hydrogen",
}

# h2    elec   diesel expl  water  → per kt_coal (GJ or kL)
H2_DATA = {
    2025: dict(cost=90, coefficients=[0.400, 0.250, 0.040, 0.030, 0.010],
               energy_co2e=0.005, process_co2e=0.120, max_share=0.02,
               sei=0.72, eei=0.920, eer=0.850, fir=0.008, eeir=0.020),
    2030: dict(cost=82, coefficients=[0.425, 0.250, 0.030, 0.030, 0.010],
               energy_co2e=0.004, process_co2e=0.110, max_share=0.08,
               sei=0.70, eei=0.940, eer=0.870, fir=0.010, eeir=0.025),
    2035: dict(cost=72, coefficients=[0.455, 0.250, 0.025, 0.030, 0.010],
               energy_co2e=0.003, process_co2e=0.100, max_share=0.18,
               sei=0.68, eei=0.960, eer=0.890, fir=0.012, eeir=0.030),
    2040: dict(cost=65, coefficients=[0.480, 0.250, 0.020, 0.030, 0.010],
               energy_co2e=0.002, process_co2e=0.090, max_share=0.30,
               sei=0.66, eei=0.980, eer=0.910, fir=0.014, eeir=0.035),
    2045: dict(cost=62, coefficients=[0.500, 0.250, 0.018, 0.030, 0.010],
               energy_co2e=0.002, process_co2e=0.080, max_share=0.40,
               sei=0.64, eei=1.000, eer=0.930, fir=0.016, eeir=0.038),
    2050: dict(cost=60, coefficients=[0.515, 0.250, 0.015, 0.030, 0.010],
               energy_co2e=0.002, process_co2e=0.070, max_share=0.45,
               sei=0.62, eei=1.020, eer=0.950, fir=0.018, eeir=0.040),
}

# ── State 4: coal_mining__low_fugitive_abatement ──────────────────────────────
#  Q3 Fugitive Methane Abatement. Conventional energy mix augmented with
#  pre-drainage wells, drainage gas utilisation or flaring, and ventilation
#  air methane (VAM) thermal oxidation. Process emissions cut by ~80% by 2050.

LF_META = {
    "label": "Low-fugitive mining with methane abatement",
    "description": (
        "Conventional diesel and electric energy mix augmented with coal seam "
        "methane pre-drainage wells, drainage gas utilisation or flaring, and "
        "ventilation air methane (VAM) thermal oxidation at underground operations. "
        "Fugitive process emissions are substantially reduced while energy-side "
        "inputs remain comparable to the conventional fleet. Q3: Fugitive Methane "
        "Abatement in Coal."
    ),
    "commodities": je(["diesel", "electricity", "explosives", "water", "natural_gas"]),
    "units": UNITS_DIESEL_LEAD,
    "input_basis": (
        "Same mobile-plant energy mix as conventional. Electricity coefficient "
        "increases ~12% (2025→2050) to power pre-drainage compressors, VAM oxidiser "
        "fans, and drainage monitoring infrastructure. Cost premium reflects capital "
        "and operating cost of pre-drainage wells and VAM oxidation plant."
    ),
    "evidence": (
        "Australian NGERs coal-mine fugitive emission factors; IEA and US EPA "
        "methane abatement cost curve for coal; Grosvenor and Moranbah North VAM "
        "project data; Clean Air Technologies International VAM oxidiser performance."
    ),
    "confidence": "Low",
    "review_notes": (
        "Process_co2e reduced by ~83% by 2050 via pre-drainage capture (flared or "
        "utilised for power) and VAM thermal oxidation. Applicability limited to "
        "underground mines; open-cut fugitive emissions are lower and primarily "
        "addressed by dust and blasting controls. Review against NGER facility-level "
        "data for high-gassiness underground mines."
    ),
    "expansion": (
        "Separate underground and open-cut sub-families with explicit seam gassiness "
        "index, pre-drainage well economics, and VAM concentrations."
    ),
    "times_mapping": (
        "Maps to coal-mining process node with additional methane-capture sub-process "
        "and associated flare or power-utilisation stream."
    ),
    "stage_family": "progression",
    "stage_rank": 25,
    "stage_code": "ambition1",
    "sort_key": "02_ambition1",
    "label_std": "Ambition 1 | low fugitive abatement",
    "is_incumbent": False,
    "option_rank": 3,
    "option_code": "O3",
    "option_label": "O3 | low fugitive abatement",
}

# diesel  elec   expl  water  gas   → per kt_coal (GJ or kL)
LF_DATA = {
    2025: dict(cost=65, coefficients=[0.700, 0.280, 0.030, 0.010, 0.010],
               energy_co2e=0.090, process_co2e=0.060, max_share=0.05,
               sei=1.21, eei=0.900, eer=0.800, fir=0.015, eeir=0.025),
    2030: dict(cost=63, coefficients=[0.680, 0.290, 0.030, 0.010, 0.010],
               energy_co2e=0.085, process_co2e=0.045, max_share=0.15,
               sei=1.16, eei=0.920, eer=0.820, fir=0.018, eeir=0.030),
    2035: dict(cost=62, coefficients=[0.660, 0.300, 0.030, 0.010, 0.010],
               energy_co2e=0.080, process_co2e=0.035, max_share=0.30,
               sei=1.11, eei=0.940, eer=0.840, fir=0.020, eeir=0.035),
    2040: dict(cost=61, coefficients=[0.640, 0.310, 0.030, 0.010, 0.010],
               energy_co2e=0.075, process_co2e=0.028, max_share=0.50,
               sei=1.06, eei=0.960, eer=0.860, fir=0.022, eeir=0.040),
    2045: dict(cost=60, coefficients=[0.620, 0.320, 0.030, 0.010, 0.010],
               energy_co2e=0.070, process_co2e=0.022, max_share=0.65,
               sei=1.01, eei=0.980, eer=0.880, fir=0.025, eeir=0.045),
    2050: dict(cost=59, coefficients=[0.600, 0.330, 0.030, 0.010, 0.010],
               energy_co2e=0.065, process_co2e=0.018, max_share=0.75,
               sei=0.96, eei=1.000, eer=0.900, fir=0.028, eeir=0.050),
}

# ── State 5: coal_mining__integrated_low_carbon ───────────────────────────────
#  Q1 + Q2 + Q3 combined ambition ceiling. BEV primary haulage, maximum
#  site electrification, full methane pre-drainage and VAM capture.
#  Aspirational upper bound for a fully decarbonised coal mine.

ILC_META = {
    "label": "Integrated low-carbon mining",
    "description": (
        "Fully integrated low-carbon configuration combining BEV primary haulage, "
        "maximum electrification of all feasible equipment, and full methane "
        "pre-drainage and VAM oxidation capture. Addresses all three modelling "
        "questions simultaneously: Q1 BEV haulage, Q2 maximum electricity use "
        "to capture grid decarbonisation benefit, Q3 deep fugitive methane "
        "abatement. Aspirational ceiling for a near-zero-direct-emission coal mine."
    ),
    "commodities": je(["electricity", "diesel", "explosives", "water", "natural_gas"]),
    "units": UNITS_ELEC_LEAD,
    "input_basis": (
        "BEV haul trucks plus electrified shovels, drills and conveyors maximise "
        "electricity fraction. Residual diesel for emergency equipment and non-"
        "electrified ancillaries only. Electricity coefficient grows as remaining "
        "diesel loads are progressively replaced. Pre-drainage and VAM systems add "
        "a further ~0.03 GJ/kt_coal electricity load."
    ),
    "evidence": (
        "Aspirational pathway drawing on Fortescue green-mining strategy, BHP "
        "climate action plan, and IEA Mining Sector Net Zero analysis. No "
        "deployed national-scale equivalent exists; Exploratory confidence."
    ),
    "confidence": "Exploratory",
    "review_notes": (
        "Ambition 2 aspirational ceiling: near-zero direct emissions achievable if "
        "electricity grid decarbonises (handled by electricity supply family) and "
        "methane capture is comprehensive. High uncertainty on timeline; 2040+ "
        "deployment is plausible for new greenfield mines with purpose-built "
        "electrification. Upgrade to Low confidence when pilot data available."
    ),
    "expansion": (
        "Full mine electrification model with explicit BEV fleet sizing, renewable "
        "power purchase agreement, methane capture and on-site utilisation chain."
    ),
    "times_mapping": (
        "Composite demand node: BEV haul fleet + fully electric fixed plant + "
        "methane capture process chain linked to electricity supply."
    ),
    "stage_family": "progression",
    "stage_rank": 30,
    "stage_code": "ambition2",
    "sort_key": "03_ambition2",
    "label_std": "Ambition 2 | integrated low carbon",
    "is_incumbent": False,
    "option_rank": 4,
    "option_code": "O4",
    "option_label": "O4 | integrated low carbon",
}

# elec  diesel expl  water  gas   → per kt_coal (GJ or kL)
ILC_DATA = {
    2025: dict(cost=92, coefficients=[0.550, 0.040, 0.030, 0.010, 0.010],
               energy_co2e=0.005, process_co2e=0.050, max_share=0.02,
               sei=0.63, eei=0.930, eer=0.870, fir=0.008, eeir=0.030),
    2030: dict(cost=82, coefficients=[0.570, 0.030, 0.030, 0.010, 0.010],
               energy_co2e=0.004, process_co2e=0.036, max_share=0.08,
               sei=0.61, eei=0.950, eer=0.890, fir=0.010, eeir=0.035),
    2035: dict(cost=72, coefficients=[0.590, 0.022, 0.030, 0.010, 0.010],
               energy_co2e=0.003, process_co2e=0.025, max_share=0.18,
               sei=0.59, eei=0.970, eer=0.910, fir=0.012, eeir=0.040),
    2040: dict(cost=65, coefficients=[0.610, 0.018, 0.030, 0.010, 0.010],
               energy_co2e=0.002, process_co2e=0.018, max_share=0.30,
               sei=0.57, eei=0.990, eer=0.930, fir=0.014, eeir=0.045),
    2045: dict(cost=60, coefficients=[0.625, 0.012, 0.030, 0.010, 0.010],
               energy_co2e=0.001, process_co2e=0.013, max_share=0.40,
               sei=0.55, eei=1.010, eer=0.950, fir=0.016, eeir=0.048),
    2050: dict(cost=57, coefficients=[0.640, 0.010, 0.030, 0.010, 0.010],
               energy_co2e=0.001, process_co2e=0.010, max_share=0.50,
               sei=0.53, eei=1.030, eer=0.970, fir=0.018, eeir=0.050),
}

ALL_STATES = [
    ("coal_mining__conventional",           CONV_META, CONV_DATA),
    ("coal_mining__heavy_haulage_bev",      BEV_META,  BEV_DATA),
    ("coal_mining__heavy_haulage_hydrogen", H2_META,   H2_DATA),
    ("coal_mining__low_fugitive_abatement", LF_META,   LF_DATA),
    ("coal_mining__integrated_low_carbon",  ILC_META,  ILC_DATA),
]


def write_family_states():
    path = os.path.join(HERE, "family_states.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FS_FIELDNAMES)
        writer.writeheader()
        for state_id, meta, year_data in ALL_STATES:
            for year in YEARS:
                writer.writerow(fs_row(state_id, year, year_data[year], meta))
    print(f"  Written: {path}  ({len(ALL_STATES) * len(YEARS)} rows)")


# ═══════════════════════════════════════════════════════════════════════════════
#  EFFICIENCY PACKAGES
# ═══════════════════════════════════════════════════════════════════════════════

EP_FIELDNAMES = [
    "family_id", "package_id", "year",
    "package_label", "package_description", "classification",
    "applicable_state_ids", "affected_input_commodities", "input_multipliers",
    "delta_output_cost_per_unit", "cost_basis_year", "currency",
    "max_share", "rollout_limit_notes",
    "source_ids", "assumption_ids",
    "evidence_summary", "derivation_method",
    "confidence_rating", "review_notes", "non_stacking_group",
]

PACKAGES = [

    # ── Package 1: Haul payload and dispatch optimisation ─────────────────────
    #  Telematics-based truck payload monitoring and automated dispatch reduces
    #  diesel consumption by ~7% on haulage by cutting empty-travel and
    #  sub-optimal loading. Applies only to conventional (diesel haulage) state.
    {
        "package_id": "coal_mining__haul_payload_dispatch_optimisation",
        "label": "Haul payload and dispatch optimisation",
        "description": (
            "Telematics-based truck payload monitoring, automated dispatch "
            "and idle-reduction on the diesel haulage fleet. Reduces diesel "
            "consumption via better loading, reduced empty travel and optimised "
            "haul routes. Applicable to open-cut and underground haul fleet within "
            "the conventional state only."
        ),
        "classification": "operational_efficiency_overlay",
        "applicable_states": ["coal_mining__conventional"],
        "affected_commodities": ["diesel"],
        "evidence": (
            "Australian mining-sector telematics deployments (Wenco, Modular Mining, "
            "Komatsu DISPATCH) report 5-10% fuel savings. Conservative 7% adopted."
        ),
        "confidence": "Medium",
        "review_notes": (
            "Applies only to the diesel incumbent; BEV and hydrogen states are "
            "excluded to avoid double-counting route optimisation improvements."
        ),
        "non_stacking_group": "haul_optimisation",
        # per-year: [diesel_multiplier], delta_cost, max_share
        "years": {
            2025: dict(multipliers=[0.93], delta_cost=0.50, max_share=0.10),
            2030: dict(multipliers=[0.93], delta_cost=0.50, max_share=0.20),
            2035: dict(multipliers=[0.93], delta_cost=0.50, max_share=0.30),
            2040: dict(multipliers=[0.93], delta_cost=0.48, max_share=0.40),
            2045: dict(multipliers=[0.93], delta_cost=0.45, max_share=0.45),
            2050: dict(multipliers=[0.93], delta_cost=0.42, max_share=0.50),
        },
    },

    # ── Package 2: Mine ventilation variable-speed drives ─────────────────────
    #  VSD retrofit on main and auxiliary ventilation fans reduces electricity
    #  consumption by ~12%. Applicable to conventional and low-fugitive states
    #  (both have significant ventilation loads). Excluded from BEV and integrated
    #  states which already embed VSD in their technology baseline.
    {
        "package_id": "coal_mining__ventilation_variable_speed_drives",
        "label": "Mine ventilation variable-speed drives",
        "description": (
            "Variable-speed drive (VSD) retrofit on main-fan and auxiliary "
            "ventilation installations. Reduces electricity consumption by "
            "matching fan speed to actual ventilation demand rather than running "
            "at fixed full speed. Applicable to conventional and low-fugitive "
            "states with significant ventilation electricity loads."
        ),
        "classification": "pure_efficiency_overlay",
        "applicable_states": [
            "coal_mining__conventional",
            "coal_mining__low_fugitive_abatement",
        ],
        "affected_commodities": ["electricity"],
        "evidence": (
            "Underground mine VSD programmes in Queensland and NSW (Anglo American, "
            "Glencore) demonstrate 10-15% electricity reductions on ventilation. "
            "IEA mining efficiency review corroborates 12% central estimate."
        ),
        "confidence": "Medium",
        "review_notes": (
            "BEV and integrated states excluded — their electricity baselines "
            "already reflect modern variable-speed ventilation. Non-stacking with "
            "autonomous electricity drift track to avoid double-counting."
        ),
        "non_stacking_group": "electricity_ventilation",
        "years": {
            2025: dict(multipliers=[0.88], delta_cost=0.30, max_share=0.15),
            2030: dict(multipliers=[0.88], delta_cost=0.30, max_share=0.25),
            2035: dict(multipliers=[0.88], delta_cost=0.28, max_share=0.35),
            2040: dict(multipliers=[0.88], delta_cost=0.26, max_share=0.45),
            2045: dict(multipliers=[0.88], delta_cost=0.24, max_share=0.52),
            2050: dict(multipliers=[0.88], delta_cost=0.22, max_share=0.55),
        },
    },

    # ── Package 3: BEV smart-charging load optimisation ───────────────────────
    #  Smart-charging SCADA integration optimises charging schedules to off-peak
    #  windows and demand-response events, reducing gross electricity drawn by
    #  ~5%. Applicable only to BEV and integrated states with large charging loads.
    {
        "package_id": "coal_mining__bev_smart_charging_optimisation",
        "label": "BEV smart-charging load optimisation",
        "description": (
            "SCADA-integrated smart-charging system shifts BEV fleet charging "
            "to off-peak tariff windows and responds to grid demand-response "
            "signals. Reduces effective grid electricity consumption by ~5% "
            "through charge-schedule optimisation and charger aggregation. "
            "Applicable to BEV and integrated low-carbon states only."
        ),
        "classification": "operational_efficiency_overlay",
        "applicable_states": [
            "coal_mining__heavy_haulage_bev",
            "coal_mining__integrated_low_carbon",
        ],
        "affected_commodities": ["electricity"],
        "evidence": (
            "Mining-site EV smart-charging pilots (Northvolt, ABB, Siemens eMobility) "
            "demonstrate 4-7% net electricity reduction via demand-response. "
            "5% central estimate used; conservative given mine-shift scheduling "
            "constraints."
        ),
        "confidence": "Low",
        "review_notes": (
            "Applies only to states with BEV charging loads; conventional, "
            "hydrogen and low-fugitive states are excluded. Non-stacking with "
            "autonomous electricity drift track."
        ),
        "non_stacking_group": "electricity_bev_charging",
        "years": {
            2025: dict(multipliers=[0.95], delta_cost=0.20, max_share=0.10),
            2030: dict(multipliers=[0.95], delta_cost=0.20, max_share=0.20),
            2035: dict(multipliers=[0.95], delta_cost=0.18, max_share=0.35),
            2040: dict(multipliers=[0.95], delta_cost=0.16, max_share=0.50),
            2045: dict(multipliers=[0.95], delta_cost=0.14, max_share=0.60),
            2050: dict(multipliers=[0.95], delta_cost=0.12, max_share=0.65),
        },
    },
]


def write_efficiency_packages():
    path = os.path.join(HERE, "efficiency_packages.csv")
    rows = []
    for pkg in PACKAGES:
        for year in YEARS:
            yd = pkg["years"][year]
            rows.append({
                "family_id": "coal_mining",
                "package_id": pkg["package_id"],
                "year": year,
                "package_label": pkg["label"],
                "package_description": pkg["description"],
                "classification": pkg["classification"],
                "applicable_state_ids": je(pkg["applicable_states"]),
                "affected_input_commodities": je(pkg["affected_commodities"]),
                "input_multipliers": je(yd["multipliers"]),
                "delta_output_cost_per_unit": yd["delta_cost"],
                "cost_basis_year": 2024,
                "currency": "AUD_2024",
                "max_share": yd["max_share"],
                "rollout_limit_notes": ROLLOUT_NOTES,
                "source_ids": SOURCES,
                "assumption_ids": ASSUMPTIONS,
                "evidence_summary": pkg["evidence"],
                "derivation_method": DERIVATION,
                "confidence_rating": pkg["confidence"],
                "review_notes": pkg["review_notes"],
                "non_stacking_group": pkg["non_stacking_group"],
            })
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=EP_FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written: {path}  ({len(rows)} rows)")


# ═══════════════════════════════════════════════════════════════════════════════
#  AUTONOMOUS EFFICIENCY TRACKS
# ═══════════════════════════════════════════════════════════════════════════════

AET_FIELDNAMES = [
    "family_id", "track_id", "year",
    "track_label", "track_description",
    "applicable_state_ids", "affected_input_commodities", "input_multipliers",
    "delta_output_cost_per_unit", "cost_basis_year", "currency",
    "source_ids", "assumption_ids",
    "evidence_summary", "derivation_method",
    "confidence_rating", "double_counting_guardrail", "review_notes",
]

# Compound multiplier helper: start=1.0, end value at 2050, cumulative
def bg_mult(end_2050, year):
    """Cumulative background efficiency multiplier (1.0 at 2025, end_2050 at 2050)."""
    f = (year - 2025) / 25
    return round(end_2050 ** f, 6)


TRACKS = [

    # ── Track 1: Background diesel efficiency drift ────────────────────────────
    #  Exogenous improvement in diesel-engine fuel efficiency from background
    #  fleet replacement and engine technology advancement (~0.33%/yr compound,
    #  8% cumulative by 2050). This drift is removed from family_state rows
    #  so it is explicitly attributed here.
    {
        "track_id": "coal_mining__background_diesel_efficiency_drift",
        "label": "Background diesel efficiency drift",
        "description": (
            "Exogenous fuel-efficiency improvement in diesel mining equipment "
            "driven by background fleet replacement and engine-technology "
            "advancement (Tier 4/5 emission standards, improved combustion). "
            "Approximately 8% cumulative reduction in diesel intensity per "
            "unit coal output by 2050, compounding at ~0.33%/yr."
        ),
        "applicable_states": [
            "coal_mining__conventional",
            "coal_mining__low_fugitive_abatement",
        ],
        "affected_commodities": ["diesel"],
        "end_2050": 0.920,  # cumulative multiplier by 2050 relative to 2025
        "evidence": (
            "Background diesel-engine efficiency improvement observed in NGERs "
            "mining energy data 2010-2023; consistent with Australian fleet turnover "
            "rates and Tier 4 Final engine standards rollout."
        ),
        "confidence": "Medium-Low",
        "guardrail": (
            "Applies only to conventional and low-fugitive states after the same "
            "embedded improvement is removed from those family_states rows. BEV, "
            "hydrogen, and integrated states are excluded — they replace diesel "
            "rather than improving it."
        ),
        "review_notes": (
            "Kept as a narrow incumbent-diesel calibration artifact so autonomous "
            "drift stays distinct from the BEV and hydrogen pathway states."
        ),
    },

    # ── Track 2: Background electricity efficiency drift ──────────────────────
    #  Exogenous improvement in electric-equipment efficiency from motor
    #  technology, power electronics and operational improvements (~0.36%/yr,
    #  9% cumulative by 2050). Applies to all states with material electricity use.
    {
        "track_id": "coal_mining__background_electricity_efficiency_drift",
        "label": "Background electricity efficiency drift",
        "description": (
            "Exogenous electricity-intensity improvement from advances in electric "
            "motor efficiency (IE3→IE4), power electronics, pump and conveyor "
            "upgrades, and operational discipline. Approximately 9% cumulative "
            "reduction in electricity intensity per unit coal output by 2050, "
            "compounding at ~0.36%/yr."
        ),
        "applicable_states": [
            "coal_mining__conventional",
            "coal_mining__heavy_haulage_bev",
            "coal_mining__low_fugitive_abatement",
            "coal_mining__integrated_low_carbon",
        ],
        "affected_commodities": ["electricity"],
        "end_2050": 0.910,
        "evidence": (
            "IE3/IE4 motor efficiency improvements documented in Australian Energy "
            "Efficiency Opportunities data; BREE industrial electricity efficiency "
            "trend. Separate from the explicit ventilation VSD package to avoid "
            "double-counting that specific measure."
        ),
        "confidence": "Medium-Low",
        "guardrail": (
            "Non-stacking with the ventilation VSD efficiency package — that package "
            "captures targeted ventilation savings; this track covers all remaining "
            "background electric-motor and conveyor improvements. Hydrogen state "
            "excluded because its electricity coefficient is already sized at a "
            "modern efficient baseline."
        ),
        "review_notes": (
            "Review multiplier against ABS energy accounts mining electricity "
            "intensity trend post-2025 to confirm ~0.36%/yr assumption."
        ),
    },
]


def write_autonomous_efficiency_tracks():
    path = os.path.join(HERE, "autonomous_efficiency_tracks.csv")
    rows = []
    for track in TRACKS:
        for year in YEARS:
            mult = bg_mult(track["end_2050"], year)
            rows.append({
                "family_id": "coal_mining",
                "track_id": track["track_id"],
                "year": year,
                "track_label": track["label"],
                "track_description": track["description"],
                "applicable_state_ids": je(track["applicable_states"]),
                "affected_input_commodities": je(track["affected_commodities"]),
                "input_multipliers": je([mult]),
                "delta_output_cost_per_unit": 0,
                "cost_basis_year": 2024,
                "currency": "AUD_2024",
                "source_ids": SOURCES,
                "assumption_ids": ASSUMPTIONS,
                "evidence_summary": track["evidence"],
                "derivation_method": DERIVATION,
                "confidence_rating": track["confidence"],
                "double_counting_guardrail": track["guardrail"],
                "review_notes": track["review_notes"],
            })
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=AET_FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    print(f"  Written: {path}  ({len(rows)} rows)")


# ═══════════════════════════════════════════════════════════════════════════════
#  DEMAND (re-written for completeness; values unchanged)
# ═══════════════════════════════════════════════════════════════════════════════

DEMAND_FIELDNAMES = [
    "family_id", "anchor_year", "anchor_value", "unit",
    "demand_growth_curve_id", "anchor_status", "source_family",
    "coverage_note", "notes",
]

DEMAND_ROW = {
    "family_id": "coal_mining",
    "anchor_year": 2025,
    "anchor_value": 60000,
    "unit": "kt_coal",
    "demand_growth_curve_id": "simple_sector_growth_central__coal_mining",
    "anchor_status": "calibrated",
    "source_family": "Phase 1 reference scenario v0.1",
    "coverage_note": (
        "Covers all Australian black and brown coal mining "
        "(raw output at pit-head, pre-washing and beneficiation)."
    ),
    "notes": (
        "Calibrated to ABS and Geoscience Australia 2024-25. "
        "Real output ~60 Mt (raw coal) at 2024-25. "
        "Demand trajectory governed by external growth curve; "
        "see demand_growth_curves.csv for scenario variants."
    ),
}


def write_demand():
    path = os.path.join(HERE, "demand.csv")
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=DEMAND_FIELDNAMES)
        writer.writeheader()
        writer.writerow(DEMAND_ROW)
    print(f"  Written: {path}  (1 row)")


# ═══════════════════════════════════════════════════════════════════════════════
#  SUMMARY REPORTER  (printed to stdout, not saved as CSV)
# ═══════════════════════════════════════════════════════════════════════════════

def print_summary():
    print("\n" + "=" * 72)
    print("COAL MINING SECTOR — DATA SUMMARY")
    print("=" * 72)

    print("\n-- Family States ----------------------------------------------------------------")
    header = f"{'State':<38} {'Year':>4}  {'Cost':>5}  "
    header += f"{'ElecC':>6}  {'DiesC':>6}  {'H2C':>5}  "
    header += f"{'EnCO2e':>6}  {'PrCO2e':>7}  {'MaxShr':>6}  {'SEI':>5}"
    print(header)
    print("-" * 100)

    def coeff_for(state_id, year_data, commodity):
        """Extract a coefficient by commodity name."""
        all_states_map = {
            "coal_mining__conventional": (CONV_META, CONV_DATA),
            "coal_mining__heavy_haulage_bev": (BEV_META, BEV_DATA),
            "coal_mining__heavy_haulage_hydrogen": (H2_META, H2_DATA),
            "coal_mining__low_fugitive_abatement": (LF_META, LF_DATA),
            "coal_mining__integrated_low_carbon": (ILC_META, ILC_DATA),
        }
        meta, _ = all_states_map[state_id]
        comms = json.loads(meta["commodities"])
        coeffs = year_data["coefficients"]
        try:
            idx = comms.index(commodity)
            return coeffs[idx]
        except ValueError:
            return 0.0

    for state_id, meta, year_data in ALL_STATES:
        for year in YEARS:
            yd = year_data[year]
            ec = coeff_for(state_id, yd, "electricity")
            dc = coeff_for(state_id, yd, "diesel")
            hc = coeff_for(state_id, yd, "hydrogen")
            short_id = state_id.replace("coal_mining__", "")
            row = (
                f"  {short_id:<36} {year:>4}  "
                f"{yd['cost']:>5.0f}  "
                f"{ec:>6.3f}  {dc:>6.3f}  {hc:>5.3f}  "
                f"{yd['energy_co2e']:>6.3f}  {yd['process_co2e']:>7.3f}  "
                f"{yd['max_share']:>6.2f}  {yd['sei']:>5.2f}"
            )
            print(row)
        print()

    print("\n-- Efficiency Packages ----------------------------------------------------------")
    for pkg in PACKAGES:
        pid = pkg["package_id"].replace("coal_mining__", "")
        print(f"  {pid}")
        print(f"    Applies to: {', '.join(s.replace('coal_mining__','') for s in pkg['applicable_states'])}")
        print(f"    Commodity:  {', '.join(pkg['affected_commodities'])}")
        for year in YEARS:
            yd = pkg["years"][year]
            print(f"    {year}: mult={yd['multipliers']}  max_share={yd['max_share']:.2f}  dcost={yd['delta_cost']:.2f}")
        print()

    print("\n-- Autonomous Efficiency Tracks -------------------------------------------------")
    for track in TRACKS:
        tid = track["track_id"].replace("coal_mining__", "")
        print(f"  {tid}")
        print(f"    Applies to: {', '.join(s.replace('coal_mining__','') for s in track['applicable_states'])}")
        print(f"    Commodity:  {', '.join(track['affected_commodities'])}")
        print(f"    Multipliers by year:")
        for year in YEARS:
            mult = bg_mult(track["end_2050"], year)
            print(f"      {year}: {mult:.6f}")
        print()

    print("=" * 72)
    print("Three Key Questions Coverage:")
    print("  Q1 Heavy Haulage — Diesel vs BEV vs H2:")
    print("     coal_mining__conventional           (diesel persistence, O0)")
    print("     coal_mining__heavy_haulage_bev      (BEV pathway, O1)")
    print("     coal_mining__heavy_haulage_hydrogen (H2 FCEV pathway, O2)")
    print("  Q2 Electricity Decarbonisation Pace:")
    print("     Electricity input coefficient in all states captures electrification")
    print("     rate; grid CO2 intensity is handled by the electricity supply family.")
    print("     BEV and integrated states maximise electricity fraction to benefit")
    print("     most from grid decarbonisation.")
    print("  Q3 Fugitive Methane Abatement:")
    print("     coal_mining__low_fugitive_abatement  (pre-drainage + VAM, O3)")
    print("     coal_mining__integrated_low_carbon   (full abatement + BEV, O4)")
    print("=" * 72 + "\n")


# ═══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print(f"\nGenerating coal_mining sector CSV files -> {HERE}\n")
    write_family_states()
    write_efficiency_packages()
    write_autonomous_efficiency_tracks()
    write_demand()
    print_summary()

"""
Update all shared registry CSVs to register the 6 non-road transport families.
Run from the repo root: python scripts/update_non_road_registrations.py
"""
import csv, os, sys

BASE = os.path.join(os.path.dirname(__file__), '..', 'sector_trajectory_library', 'shared')

def read_csv(path):
    with open(path, newline='', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    # Strip None keys caused by trailing commas in header
    return [{k: v for k, v in r.items() if k is not None} for r in rows]

def write_csv(path, rows, fieldnames):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

def ids_in(rows, field):
    return {r[field] for r in rows}

# ──────────────────────────────────────────────────────────────────────────────
# 1. commodities.csv
# ──────────────────────────────────────────────────────────────────────────────
COMM_PATH = os.path.join(BASE, 'commodities.csv')
comm_rows = read_csv(COMM_PATH)
existing_comm = ids_in(comm_rows, 'commodity_id')

new_commodities = [
    {'commodity_id': 'diesel',
     'description': 'Automotive diesel and off-road diesel fuel (distillate).',
     'unit_convention': 'GJ',
     'notes': 'NGA 2024 emission factor 69.9 kgCO2e/GJ (AR5 GWP100). Used by rail freight diesel-electric, domestic aviation ground support, and off-road transport.'},
    {'commodity_id': 'aviation_turbine_fuel',
     'description': 'Aviation turbine fuel (Jet-A1) for civil aviation.',
     'unit_convention': 'GJ',
     'notes': 'NGA 2024 emission factor 71.5 kgCO2e/GJ (AR5 GWP100). Used by domestic and international aviation families.'},
    {'commodity_id': 'sustainable_aviation_fuel',
     'description': 'Sustainable aviation fuel (SAF) — biogenic or synthetic drop-in jet fuel.',
     'unit_convention': 'GJ',
     'notes': 'Biogenic CO2 not counted as scope 1 per NGA convention. Used as zero-emission blend in aviation SAF states.'},
    {'commodity_id': 'marine_diesel_oil',
     'description': 'Marine diesel oil (MDO / distillate marine fuel).',
     'unit_convention': 'GJ',
     'notes': 'NGA 2024 emission factor 74.4 kgCO2e/GJ (AR5 GWP100). Used by domestic and international shipping families.'},
    {'commodity_id': 'heavy_fuel_oil',
     'description': 'Heavy fuel oil (HFO / residual marine fuel) for ocean-going vessels.',
     'unit_convention': 'GJ',
     'notes': 'NGA 2024 emission factor 78.9 kgCO2e/GJ (AR5 GWP100). Used by domestic and international shipping families.'},
    {'commodity_id': 'ammonia',
     'description': 'Green ammonia as a zero-emission marine or industrial fuel.',
     'unit_convention': 'GJ',
     'notes': 'Direct combustion CO2e set to zero when green ammonia sourced from renewable hydrogen. Used by domestic and international shipping zero-emission states.'},
    {'commodity_id': 'liquefied_natural_gas',
     'description': 'Liquefied natural gas (LNG) used as a marine transition fuel.',
     'unit_convention': 'GJ',
     'notes': 'NGA 2024 emission factor approximately 51.3 kgCO2e/GJ for LNG combustion (~30% lower CO2 per GJ than HFO). Methane slip not captured in this factor.'},
]

added_comm = 0
for row in new_commodities:
    if row['commodity_id'] not in existing_comm:
        comm_rows.append(row)
        added_comm += 1

if added_comm:
    write_csv(COMM_PATH, comm_rows, ['commodity_id', 'description', 'unit_convention', 'notes'])
    print(f"commodities.csv: added {added_comm} rows")
else:
    print("commodities.csv: nothing to add (all present)")

# ──────────────────────────────────────────────────────────────────────────────
# 2. commodity_price_curves.csv
# ──────────────────────────────────────────────────────────────────────────────
PRICE_PATH = os.path.join(BASE, 'commodity_price_curves.csv')
price_rows = read_csv(PRICE_PATH)
existing_price = {(r['commodity_id'], r['price_curve_id']) for r in price_rows}

PROV = 'App-owned sensitivity bands.'
new_prices = [
    # diesel — similar to refined_liquid_fuels
    {'commodity_id': 'diesel', 'price_curve_id': 'low',    'label': 'Diesel — low',    'unit': 'AUD_2024_per_GJ', '2025': 22,   '2030': 22.5, '2035': 23,   '2040': 23.5, '2045': 24,   '2050': 24.5, 'provenance_note': PROV},
    {'commodity_id': 'diesel', 'price_curve_id': 'medium', 'label': 'Diesel — medium', 'unit': 'AUD_2024_per_GJ', '2025': 24,   '2030': 24.5, '2035': 25,   '2040': 25.5, '2045': 26,   '2050': 26.5, 'provenance_note': PROV},
    {'commodity_id': 'diesel', 'price_curve_id': 'high',   'label': 'Diesel — high',   'unit': 'AUD_2024_per_GJ', '2025': 28,   '2030': 29,   '2035': 30,   '2040': 31,   '2045': 32,   '2050': 33,   'provenance_note': PROV},
    # aviation_turbine_fuel
    {'commodity_id': 'aviation_turbine_fuel', 'price_curve_id': 'low',    'label': 'Aviation turbine fuel — low',    'unit': 'AUD_2024_per_GJ', '2025': 25, '2030': 25.5, '2035': 26, '2040': 26.5, '2045': 27, '2050': 27.5, 'provenance_note': PROV},
    {'commodity_id': 'aviation_turbine_fuel', 'price_curve_id': 'medium', 'label': 'Aviation turbine fuel — medium', 'unit': 'AUD_2024_per_GJ', '2025': 28, '2030': 29,   '2035': 30, '2040': 31,   '2045': 32, '2050': 33,   'provenance_note': PROV},
    {'commodity_id': 'aviation_turbine_fuel', 'price_curve_id': 'high',   'label': 'Aviation turbine fuel — high',   'unit': 'AUD_2024_per_GJ', '2025': 32, '2030': 33,   '2035': 34, '2040': 35,   '2045': 36, '2050': 37,   'provenance_note': PROV},
    # sustainable_aviation_fuel — premium over ATF, declining with scale
    {'commodity_id': 'sustainable_aviation_fuel', 'price_curve_id': 'low',    'label': 'Sustainable aviation fuel — low',    'unit': 'AUD_2024_per_GJ', '2025': 70, '2030': 65, '2035': 60, '2040': 55, '2045': 50, '2050': 45, 'provenance_note': PROV},
    {'commodity_id': 'sustainable_aviation_fuel', 'price_curve_id': 'medium', 'label': 'Sustainable aviation fuel — medium', 'unit': 'AUD_2024_per_GJ', '2025': 85, '2030': 78, '2035': 70, '2040': 62, '2045': 55, '2050': 50, 'provenance_note': PROV},
    {'commodity_id': 'sustainable_aviation_fuel', 'price_curve_id': 'high',   'label': 'Sustainable aviation fuel — high',   'unit': 'AUD_2024_per_GJ', '2025': 100,'2030': 95, '2035': 90, '2040': 85, '2045': 80, '2050': 75, 'provenance_note': PROV},
    # marine_diesel_oil — similar to diesel
    {'commodity_id': 'marine_diesel_oil', 'price_curve_id': 'low',    'label': 'Marine diesel oil — low',    'unit': 'AUD_2024_per_GJ', '2025': 22,   '2030': 22.5, '2035': 23,   '2040': 23.5, '2045': 24,   '2050': 24.5, 'provenance_note': PROV},
    {'commodity_id': 'marine_diesel_oil', 'price_curve_id': 'medium', 'label': 'Marine diesel oil — medium', 'unit': 'AUD_2024_per_GJ', '2025': 24,   '2030': 24.5, '2035': 25,   '2040': 25.5, '2045': 26,   '2050': 26.5, 'provenance_note': PROV},
    {'commodity_id': 'marine_diesel_oil', 'price_curve_id': 'high',   'label': 'Marine diesel oil — high',   'unit': 'AUD_2024_per_GJ', '2025': 28,   '2030': 29,   '2035': 30,   '2040': 31,   '2045': 32,   '2050': 33,   'provenance_note': PROV},
    # heavy_fuel_oil — cheaper than MDO
    {'commodity_id': 'heavy_fuel_oil', 'price_curve_id': 'low',    'label': 'Heavy fuel oil — low',    'unit': 'AUD_2024_per_GJ', '2025': 18,   '2030': 18.5, '2035': 19,   '2040': 19.5, '2045': 20,   '2050': 20.5, 'provenance_note': PROV},
    {'commodity_id': 'heavy_fuel_oil', 'price_curve_id': 'medium', 'label': 'Heavy fuel oil — medium', 'unit': 'AUD_2024_per_GJ', '2025': 20,   '2030': 20.5, '2035': 21,   '2040': 21.5, '2045': 22,   '2050': 22.5, 'provenance_note': PROV},
    {'commodity_id': 'heavy_fuel_oil', 'price_curve_id': 'high',   'label': 'Heavy fuel oil — high',   'unit': 'AUD_2024_per_GJ', '2025': 24,   '2030': 25,   '2035': 26,   '2040': 27,   '2045': 28,   '2050': 29,   'provenance_note': PROV},
    # ammonia — green ammonia, declining with green H2 cost
    {'commodity_id': 'ammonia', 'price_curve_id': 'low',    'label': 'Green ammonia — low',    'unit': 'AUD_2024_per_GJ', '2025': 35, '2030': 30, '2035': 25, '2040': 22, '2045': 20, '2050': 18, 'provenance_note': PROV},
    {'commodity_id': 'ammonia', 'price_curve_id': 'medium', 'label': 'Green ammonia — medium', 'unit': 'AUD_2024_per_GJ', '2025': 45, '2030': 38, '2035': 32, '2040': 28, '2045': 24, '2050': 20, 'provenance_note': PROV},
    {'commodity_id': 'ammonia', 'price_curve_id': 'high',   'label': 'Green ammonia — high',   'unit': 'AUD_2024_per_GJ', '2025': 60, '2030': 52, '2035': 45, '2040': 40, '2045': 36, '2050': 32, 'provenance_note': PROV},
    # liquefied_natural_gas
    {'commodity_id': 'liquefied_natural_gas', 'price_curve_id': 'low',    'label': 'LNG — low',    'unit': 'AUD_2024_per_GJ', '2025': 12, '2030': 12.5, '2035': 13, '2040': 13.5, '2045': 14, '2050': 14.5, 'provenance_note': PROV},
    {'commodity_id': 'liquefied_natural_gas', 'price_curve_id': 'medium', 'label': 'LNG — medium', 'unit': 'AUD_2024_per_GJ', '2025': 14, '2030': 14.5, '2035': 15, '2040': 15.5, '2045': 16, '2050': 16.5, 'provenance_note': PROV},
    {'commodity_id': 'liquefied_natural_gas', 'price_curve_id': 'high',   'label': 'LNG — high',   'unit': 'AUD_2024_per_GJ', '2025': 18, '2030': 19,   '2035': 20, '2040': 21,   '2045': 22, '2050': 23,   'provenance_note': PROV},
]

added_price = 0
for row in new_prices:
    key = (row['commodity_id'], row['price_curve_id'])
    if key not in existing_price:
        price_rows.append(row)
        added_price += 1

if added_price:
    pf = ['commodity_id', 'price_curve_id', 'label', 'unit', '2025', '2030', '2035', '2040', '2045', '2050', 'provenance_note']
    write_csv(PRICE_PATH, price_rows, pf)
    print(f"commodity_price_curves.csv: added {added_price} rows")
else:
    print("commodity_price_curves.csv: nothing to add")

# ──────────────────────────────────────────────────────────────────────────────
# 3. demand_growth_curves.csv
# ──────────────────────────────────────────────────────────────────────────────
DGC_PATH = os.path.join(BASE, 'demand_growth_curves.csv')
dgc_rows = read_csv(DGC_PATH)
existing_dgc = ids_in(dgc_rows, 'demand_growth_curve_id')

APP_PROV = 'App-owned convenience preset. Not part of the research library evidence.'

new_dgc = [
    # growing_then_flat__domestic_aviation: +1.5%/yr 2025-2030, +1.0%/yr 2030-2040, +0.5%/yr 2040-2050
    # 2030: 1.015^5 = 1.077284, 2035: 1.077284*1.010^5 = 1.132236
    # 2040: 1.132236*1.010^5 = 1.189992
    # 2045: 1.189992*1.005^5 = 1.220041, 2050: 1.220041*1.005^5 = 1.250848
    {'demand_growth_curve_id': 'growing_then_flat__domestic_aviation',
     'label': 'Growing then stable — domestic aviation',
     'description': 'Domestic aviation demand: +1.5%/yr 2025-2030, +1.0%/yr 2030-2040, +0.5%/yr 2040-2050. Reflects post-COVID recovery then stabilisation with SAF mandates.',
     '2025': 1, '2030': 1.077284, '2035': 1.132236, '2040': 1.189992, '2045': 1.220041, '2050': 1.250848,
     'provenance_note': 'Calibrated to BITRE Aviation Statistical Report 2023-24 and AEMO ISP 2024 demand scenarios.'},
    {'demand_growth_curve_id': 'flat_2025__domestic_aviation',
     'label': 'Flat from 2025 — domestic_aviation',
     'description': 'Keeps domestic_aviation at its 2025 anchor across all milestone years.',
     '2025': 1, '2030': 1, '2035': 1, '2040': 1, '2045': 1, '2050': 1,
     'provenance_note': APP_PROV},
    # growing__international_aviation: +2.0%/yr 2025-2035, +1.0%/yr 2035-2050
    # 2030: 1.020^5=1.104081, 2035: 1.020^10=1.218994
    # 2040: 1.218994*1.010^5=1.281175, 2045: 1.281175*1.010^5=1.346528, 2050: 1.346528*1.010^5=1.415215
    {'demand_growth_curve_id': 'growing__international_aviation',
     'label': 'Growing — international aviation',
     'description': 'International aviation demand: +2.0%/yr 2025-2035, +1.0%/yr 2035-2050. Reflects post-COVID recovery and long-haul growth moderating with IMO/carbon pricing.',
     '2025': 1, '2030': 1.104081, '2035': 1.218994, '2040': 1.281175, '2045': 1.346528, '2050': 1.415215,
     'provenance_note': 'Calibrated to BITRE international aviation statistics and ICAO long-term traffic forecasts.'},
    {'demand_growth_curve_id': 'flat_2025__international_aviation',
     'label': 'Flat from 2025 — international_aviation',
     'description': 'Keeps international_aviation at its 2025 anchor across all milestone years.',
     '2025': 1, '2030': 1, '2035': 1, '2040': 1, '2045': 1, '2050': 1,
     'provenance_note': APP_PROV},
    # stable__domestic_shipping: +0.5%/yr
    # 2030: 1.005^5=1.025251, 2035: 1.005^10=1.051140, 2040: 1.005^15=1.077683
    # 2045: 1.005^20=1.104896, 2050: 1.005^25=1.132796
    {'demand_growth_curve_id': 'stable__domestic_shipping',
     'label': 'Stable — domestic shipping',
     'description': 'Domestic coastal shipping demand: +0.5%/yr. Modest growth reflecting stable coastal trade patterns.',
     '2025': 1, '2030': 1.025251, '2035': 1.051140, '2040': 1.077683, '2045': 1.104896, '2050': 1.132796,
     'provenance_note': 'Calibrated to BITRE coastal freight statistics and AES 2023-24.'},
    {'demand_growth_curve_id': 'flat_2025__domestic_shipping',
     'label': 'Flat from 2025 — domestic_shipping',
     'description': 'Keeps domestic_shipping at its 2025 anchor across all milestone years.',
     '2025': 1, '2030': 1, '2035': 1, '2040': 1, '2045': 1, '2050': 1,
     'provenance_note': APP_PROV},
    # growing__international_shipping: +1.5%/yr 2025-2035, +0.5%/yr 2035-2050
    # 2030: 1.015^5=1.077284, 2035: 1.015^10=1.160541
    # 2040: 1.160541*1.005^5=1.189846, 2045: 1.189846*1.005^5=1.219891, 2050: 1.219891*1.005^5=1.250695
    {'demand_growth_curve_id': 'growing__international_shipping',
     'label': 'Growing — international shipping',
     'description': 'International shipping demand: +1.5%/yr 2025-2035, +0.5%/yr 2035-2050. Driven by Australian commodity export growth moderating as IMO decarbonisation targets reshape demand.',
     '2025': 1, '2030': 1.077284, '2035': 1.160541, '2040': 1.189846, '2045': 1.219891, '2050': 1.250695,
     'provenance_note': 'Calibrated to BITRE transport yearbook and IMO GHG Strategy 2023.'},
    {'demand_growth_curve_id': 'flat_2025__international_shipping',
     'label': 'Flat from 2025 — international_shipping',
     'description': 'Keeps international_shipping at its 2025 anchor across all milestone years.',
     '2025': 1, '2030': 1, '2035': 1, '2040': 1, '2045': 1, '2050': 1,
     'provenance_note': APP_PROV},
    # growing__rail_passenger: +1.5%/yr all years
    # 2030: 1.015^5=1.077284, 2035: 1.015^10=1.160541, 2040: 1.015^15=1.250232
    # 2045: 1.015^20=1.346855, 2050: 1.015^25=1.450945
    {'demand_growth_curve_id': 'growing__rail_passenger',
     'label': 'Growing — rail passenger',
     'description': 'Rail passenger demand: +1.5%/yr. Driven by urban population growth, new metro lines, and modal shift investment.',
     '2025': 1, '2030': 1.077284, '2035': 1.160541, '2040': 1.250232, '2045': 1.346855, '2050': 1.450945,
     'provenance_note': 'Calibrated to BITRE Rail Summary Data 2023-24 and state government rail investment plans.'},
    {'demand_growth_curve_id': 'flat_2025__rail_passenger',
     'label': 'Flat from 2025 — rail_passenger',
     'description': 'Keeps rail_passenger at its 2025 anchor across all milestone years.',
     '2025': 1, '2030': 1, '2035': 1, '2040': 1, '2045': 1, '2050': 1,
     'provenance_note': APP_PROV},
    # stable_growing__rail_freight: +0.8%/yr
    # 2030: 1.008^5=1.040645, 2035: 1.008^10=1.082942, 2040: 1.008^15=1.126959
    # 2045: 1.008^20=1.172764, 2050: 1.008^25=1.220431
    {'demand_growth_curve_id': 'stable_growing__rail_freight',
     'label': 'Stable growing — rail freight',
     'description': 'Rail freight demand: +0.8%/yr. Stable heavy-haul bulk commodity, growing intermodal/containerised freight.',
     '2025': 1, '2030': 1.040645, '2035': 1.082942, '2040': 1.126959, '2045': 1.172764, '2050': 1.220431,
     'provenance_note': 'Calibrated to BITRE freight linehaul statistics 2023-24 and AES 2023-24 rail freight energy.'},
    {'demand_growth_curve_id': 'flat_2025__rail_freight',
     'label': 'Flat from 2025 — rail_freight',
     'description': 'Keeps rail_freight at its 2025 anchor across all milestone years.',
     '2025': 1, '2030': 1, '2035': 1, '2040': 1, '2045': 1, '2050': 1,
     'provenance_note': APP_PROV},
]

added_dgc = 0
for row in new_dgc:
    if row['demand_growth_curve_id'] not in existing_dgc:
        dgc_rows.append(row)
        added_dgc += 1

if added_dgc:
    dgcf = ['demand_growth_curve_id', 'label', 'description', '2025', '2030', '2035', '2040', '2045', '2050', 'provenance_note']
    write_csv(DGC_PATH, dgc_rows, dgcf)
    print(f"demand_growth_curves.csv: added {added_dgc} rows")
else:
    print("demand_growth_curves.csv: nothing to add")

# ──────────────────────────────────────────────────────────────────────────────
# 4. families.csv
# ──────────────────────────────────────────────────────────────────────────────
FAM_PATH = os.path.join(BASE, 'families.csv')
fam_rows = read_csv(FAM_PATH)
existing_fam = ids_in(fam_rows, 'family_id')

fam_fields = [k for k in fam_rows[0].keys() if k is not None]

new_families = [
    {'family_id': 'domestic_aviation',
     'sector': 'non_road_transport', 'subsector': 'domestic_aviation',
     'service_or_output_name': 'domestic_air_travel',
     'region': 'AUS', 'output_role': 'required_service', 'output_unit': 'million_pkm',
     'output_quantity_basis': 'One million passenger-kilometres of domestic air travel. Calibrated to AES 2023-24 (85 PJ) and BITRE 2023-24 (75,500 million pkm).',
     'default_incumbent_state_id': 'domestic_aviation__conventional_jet',
     'maintainer_owner_id': 'mythili_murugesan', 'review_owner_id': 'core_model_review',
     'family_status': 'active', 'family_maturity': 'phase1', 'family_resolution': 'modeled',
     'coverage_scope_id': 'domestic_aviation', 'coverage_scope_label': 'Domestic aviation',
     'notes': 'Phase 1 domestic aviation family with three pathway states: conventional jet (incumbent), SAF blend, and hydrogen aircraft. Calibrated to AES 2023-24 Table F (85 PJ) and BITRE Aviation Statistical Report 2023-24 (75,500 million pkm).'},
    {'family_id': 'international_aviation',
     'sector': 'non_road_transport', 'subsector': 'international_aviation',
     'service_or_output_name': 'international_air_travel',
     'region': 'AUS', 'output_role': 'required_service', 'output_unit': 'million_pkm',
     'output_quantity_basis': 'One million passenger-kilometres of international air travel bunkered in Australia. Calibrated to AES 2023-24 (165 PJ) and BITRE (70,000 million pkm estimate).',
     'default_incumbent_state_id': 'international_aviation__conventional_jet',
     'maintainer_owner_id': 'mythili_murugesan', 'review_owner_id': 'core_model_review',
     'family_status': 'active', 'family_maturity': 'phase1', 'family_resolution': 'modeled',
     'coverage_scope_id': 'international_aviation', 'coverage_scope_label': 'International aviation',
     'notes': 'Phase 1 international aviation family with three pathway states: conventional jet (incumbent), SAF blend, and hydrogen aircraft. Covers international bunker fuel per NGGI IPCC Cat 1A3a.'},
    {'family_id': 'domestic_shipping',
     'sector': 'non_road_transport', 'subsector': 'domestic_shipping',
     'service_or_output_name': 'domestic_coastal_freight',
     'region': 'AUS', 'output_role': 'required_service', 'output_unit': 'million_tkm',
     'output_quantity_basis': 'One million tonne-kilometres of domestic coastal and harbour shipping. Calibrated to AES 2023-24 (30 PJ) and BITRE coastal freight statistics (30,000 million tkm estimate).',
     'default_incumbent_state_id': 'domestic_shipping__conventional_diesel',
     'maintainer_owner_id': 'mythili_murugesan', 'review_owner_id': 'core_model_review',
     'family_status': 'active', 'family_maturity': 'phase1', 'family_resolution': 'modeled',
     'coverage_scope_id': 'domestic_shipping', 'coverage_scope_label': 'Domestic shipping',
     'notes': 'Phase 1 domestic shipping family with three pathway states: conventional diesel/HFO (incumbent), battery-electric vessel, and green ammonia vessel. Calibrated to AES 2023-24 Table F (30 PJ domestic water transport).'},
    {'family_id': 'international_shipping',
     'sector': 'non_road_transport', 'subsector': 'international_shipping',
     'service_or_output_name': 'international_maritime_freight',
     'region': 'AUS', 'output_role': 'required_service', 'output_unit': 'million_tkm',
     'output_quantity_basis': 'One million tonne-kilometres of international shipping associated with Australian bunkering. Calibrated to AES 2023-24 (65 PJ) and BITRE transport yearbook (200,000 million tkm estimate).',
     'default_incumbent_state_id': 'international_shipping__conventional_hfo',
     'maintainer_owner_id': 'mythili_murugesan', 'review_owner_id': 'core_model_review',
     'family_status': 'active', 'family_maturity': 'phase1', 'family_resolution': 'modeled',
     'coverage_scope_id': 'international_shipping', 'coverage_scope_label': 'International shipping',
     'notes': 'Phase 1 international shipping family with three pathway states: conventional HFO/MDO (incumbent), LNG transition, and zero-emission fuel (green ammonia). Covers international maritime bunker fuel per NGGI IPCC Cat 1A3d.'},
    {'family_id': 'rail_passenger',
     'sector': 'non_road_transport', 'subsector': 'rail_passenger',
     'service_or_output_name': 'rail_passenger_travel',
     'region': 'AUS', 'output_role': 'required_service', 'output_unit': 'million_pkm',
     'output_quantity_basis': 'One million passenger-kilometres of total Australian passenger rail service. Calibrated to AES 2023-24 (8 PJ) and BITRE Rail Summary Data (22,000 million pkm).',
     'default_incumbent_state_id': 'rail_passenger__conventional_mixed',
     'maintainer_owner_id': 'mythili_murugesan', 'review_owner_id': 'core_model_review',
     'family_status': 'active', 'family_maturity': 'phase1', 'family_resolution': 'modeled',
     'coverage_scope_id': 'rail_passenger', 'coverage_scope_label': 'Rail passenger',
     'notes': 'Phase 1 rail passenger family with four pathway states: conventional mixed electric/diesel (incumbent), fully electrified OHL, battery-electric regional, and hydrogen regional. Calibrated to AES 2023-24 (8 PJ) and BITRE rail statistics (22,000 million pkm).'},
    {'family_id': 'rail_freight',
     'sector': 'non_road_transport', 'subsector': 'rail_freight',
     'service_or_output_name': 'rail_freight_task',
     'region': 'AUS', 'output_role': 'required_service', 'output_unit': 'billion_tkm',
     'output_quantity_basis': 'One billion tonne-kilometres of total Australian rail freight. Calibrated to AES 2023-24 estimated rail freight (~25 PJ) and BITRE freight linehaul statistics 2023-24 (~700 billion tkm).',
     'default_incumbent_state_id': 'rail_freight__diesel_electric',
     'maintainer_owner_id': 'mythili_murugesan', 'review_owner_id': 'core_model_review',
     'family_status': 'active', 'family_maturity': 'phase1', 'family_resolution': 'modeled',
     'coverage_scope_id': 'rail_freight', 'coverage_scope_label': 'Rail freight',
     'notes': 'Phase 1 rail freight family with three pathway states: diesel-electric locomotive (incumbent), overhead line electrification, and hydrogen locomotive. Calibrated to AES 2023-24 estimated rail freight (~25 PJ) and BITRE freight linehaul (700 billion tkm).'},
]

added_fam = 0
for row in new_families:
    if row['family_id'] not in existing_fam:
        fam_rows.append(row)
        added_fam += 1

if added_fam:
    write_csv(FAM_PATH, fam_rows, fam_fields)
    print(f"families.csv: added {added_fam} rows")
else:
    print("families.csv: nothing to add")

# ──────────────────────────────────────────────────────────────────────────────
# 5. system_structure_groups.csv
# ──────────────────────────────────────────────────────────────────────────────
GRP_PATH = os.path.join(BASE, 'system_structure_groups.csv')
grp_rows = read_csv(GRP_PATH)
existing_grp = ids_in(grp_rows, 'group_id')

if 'non_road_transport' not in existing_grp:
    new_grp = {'group_id': 'non_road_transport',
               'group_label': 'Non-road transport',
               'display_order': 25,
               'notes': 'Aviation, maritime shipping, and rail transport families (domestic and international).'}
    grp_rows.append(new_grp)
    write_csv(GRP_PATH, grp_rows, ['group_id', 'group_label', 'display_order', 'notes'])
    print("system_structure_groups.csv: added non_road_transport")
else:
    print("system_structure_groups.csv: non_road_transport already present")

# ──────────────────────────────────────────────────────────────────────────────
# 6. system_structure_members.csv
# ──────────────────────────────────────────────────────────────────────────────
MEM_PATH = os.path.join(BASE, 'system_structure_members.csv')
mem_rows = read_csv(MEM_PATH)
existing_mem = {(r['group_id'], r['family_id']) for r in mem_rows}

new_members = [
    {'group_id': 'non_road_transport', 'family_id': 'domestic_aviation',     'display_order': 10, 'notes': 'Modelled domestic aviation family.'},
    {'group_id': 'non_road_transport', 'family_id': 'international_aviation', 'display_order': 20, 'notes': 'Modelled international aviation family (bunker fuel boundary).'},
    {'group_id': 'non_road_transport', 'family_id': 'domestic_shipping',      'display_order': 30, 'notes': 'Modelled domestic coastal shipping family.'},
    {'group_id': 'non_road_transport', 'family_id': 'international_shipping',  'display_order': 40, 'notes': 'Modelled international maritime shipping family (bunker fuel boundary).'},
    {'group_id': 'non_road_transport', 'family_id': 'rail_passenger',          'display_order': 50, 'notes': 'Modelled passenger rail family.'},
    {'group_id': 'non_road_transport', 'family_id': 'rail_freight',            'display_order': 60, 'notes': 'Modelled freight rail family.'},
]

added_mem = 0
for row in new_members:
    key = (row['group_id'], row['family_id'])
    if key not in existing_mem:
        mem_rows.append(row)
        added_mem += 1

if added_mem:
    write_csv(MEM_PATH, mem_rows, ['group_id', 'family_id', 'display_order', 'notes'])
    print(f"system_structure_members.csv: added {added_mem} rows")
else:
    print("system_structure_members.csv: nothing to add")

print("\nDone.")

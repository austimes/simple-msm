"""
Update all configuration JSON files to add service_controls for the new non-road transport
families and coal_mining/oil_and_gas (where missing).

Run: python scripts/update_configurations.py
"""
import json, os

CONFIG_DIR = os.path.join(os.path.dirname(__file__), '..', 'web', 'src', 'configurations')

# New non-road families: incumbent state ids
NEW_NON_ROAD = {
    'domestic_aviation':     'domestic_aviation__conventional_jet',
    'international_aviation':'international_aviation__conventional_jet',
    'domestic_shipping':     'domestic_shipping__conventional_diesel',
    'international_shipping':'international_shipping__conventional_hfo',
    'rail_passenger':        'rail_passenger__conventional_mixed',
    'rail_freight':          'rail_freight__diesel_electric',
}

# Energy extraction families (already in reference-baseline, missing from others)
ENERGY_EXTRACTION = {
    'coal_mining':           'coal_mining__conventional',
    'oil_and_gas_extraction':'oil_and_gas_extraction__conventional',
}

# New commodities (7)
NEW_COMMODITIES = [
    'diesel',
    'aviation_turbine_fuel',
    'sustainable_aviation_fuel',
    'marine_diesel_oil',
    'heavy_fuel_oil',
    'ammonia',
    'liquefied_natural_gas',
]

def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
        f.write('\n')

def make_control(incumbent_state_id):
    return {'mode': 'optimize', 'active_state_ids': [incumbent_state_id]}

# All config files to update (excluding _index.json)
config_files = [
    'reference-baseline.json',
    'reference-efficiency-off.json',
    'reference-efficiency-open.json',
    'demo-buildings-efficiency.json',
    'demo-freight-efficiency.json',
    'demo-heavy-industry-efficiency.json',
    'demo-industrial-heat-efficiency.json',
]

for filename in config_files:
    path = os.path.join(CONFIG_DIR, filename)
    cfg = load_json(path)
    changed = False

    # ── 1. service_controls ──────────────────────────────────────────────────
    sc = cfg.setdefault('service_controls', {})

    # Add non-road families
    for family_id, incumbent in NEW_NON_ROAD.items():
        if family_id not in sc:
            sc[family_id] = make_control(incumbent)
            changed = True

    # Add energy extraction families (only to configs that don't have them)
    for family_id, incumbent in ENERGY_EXTRACTION.items():
        if family_id not in sc:
            sc[family_id] = make_control(incumbent)
            changed = True

    # ── 2. commodity_pricing ─────────────────────────────────────────────────
    cp = cfg.setdefault('commodity_pricing', {})
    sbc = cp.setdefault('selections_by_commodity', {})
    for commodity_id in NEW_COMMODITIES:
        if commodity_id not in sbc:
            sbc[commodity_id] = 'medium'
            changed = True

    # ── 3. demand_generation service_anchors (for families that aren't there) ─
    # We add anchors for the 6 new non-road families so configs are explicit.
    # Growth rates default to 0 (flat) from 2025 anchor; that's acceptable for now.
    dg = cfg.get('demand_generation', {})
    if dg and 'service_anchors' in dg:
        sa = dg['service_anchors']
        anchors_to_add = {
            'domestic_aviation':     75500.0,
            'international_aviation': 70000.0,
            'domestic_shipping':     30000.0,
            'international_shipping': 200000.0,
            'rail_passenger':        22000.0,
            'rail_freight':          700.0,
            'coal_mining':           420000.0,
            'oil_and_gas_extraction': 6100.0,
        }
        for family_id, anchor in anchors_to_add.items():
            if family_id not in sa:
                sa[family_id] = anchor
                changed = True

    if changed:
        save_json(path, cfg)
        print(f"Updated: {filename}")
    else:
        print(f"No changes: {filename}")

print("\nDone.")

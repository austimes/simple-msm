#!/usr/bin/env python3
"""Recalibrate energy_co2e in family_states.csv files using the latest NGA
emission factors from sector_trajectory_library/shared/nga_emission_factors.csv.

Only applies to bottom-up calibrated families where energy_co2e is derived as:
    energy_co2e = sum(input_coefficient_i * scope1_kgco2e_per_gj_i / 1000)

Families with top-down calibration (aviation, shipping, oil_and_gas) are
excluded because their energy_co2e is derived from NGGI totals divided by
activity volume, not from per-fuel emission factors.

Usage:
    python scripts/recalibrate_emission_factors.py
    python scripts/recalibrate_emission_factors.py --dry-run
"""

import csv
import json
import argparse
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
LIBRARY_DIR = SCRIPT_DIR.parent / "sector_trajectory_library"
SHARED_DIR = LIBRARY_DIR / "shared"
FAMILIES_DIR = LIBRARY_DIR / "families"

# Families calibrated bottom-up: energy_co2e = sum(coeff_i * EF_i / 1000).
# These are the only families the script recalibrates.
BOTTOM_UP_FAMILIES = [
    "coal_mining",
    "rail_freight",
    "rail_passenger",
]


def load_ef_map() -> dict[str, float]:
    path = SHARED_DIR / "nga_emission_factors.csv"
    ef_map: dict[str, float] = {}
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            ef_map[row["commodity_id"]] = float(row["scope1_kgco2e_per_gj"])
    return ef_map


def compute_energy_co2e(commodities: list[str], coefficients: list[float], ef_map: dict[str, float]) -> float | None:
    """Return recalibrated energy_co2e or None if no mapped fuels found."""
    total = 0.0
    has_fuel = False
    for commodity, coeff in zip(commodities, coefficients):
        ef = ef_map.get(commodity)
        if ef is None:
            print(f"  WARNING: commodity '{commodity}' not found in nga_emission_factors.csv — skipping row")
            return None
        if ef > 0:
            has_fuel = True
        total += coeff * ef / 1000.0
    return round(total, 1) if has_fuel else None


def recalibrate_family(family_id: str, ef_map: dict[str, float], dry_run: bool) -> int:
    path = FAMILIES_DIR / family_id / "family_states.csv"
    updated = 0

    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        fieldnames = list(rows[0].keys()) if rows else []

    for row in rows:
        commodities_raw = row.get("input_commodities", "")
        coefficients_raw = row.get("input_coefficients", "")
        if not commodities_raw or not coefficients_raw:
            continue

        try:
            commodities = json.loads(commodities_raw)
            coefficients = [float(x) for x in json.loads(coefficients_raw)]
        except (json.JSONDecodeError, ValueError) as e:
            print(f"  WARNING: could not parse inputs for {family_id} {row.get('state_id')} {row.get('year')}: {e}")
            continue

        new_value = compute_energy_co2e(commodities, coefficients, ef_map)
        if new_value is None:
            continue

        old_value = row.get("energy_co2e", "")
        try:
            old_float = float(old_value)
        except (ValueError, TypeError):
            old_float = None

        if old_float != new_value:
            state_id = row.get("state_id", "?")
            year = row.get("year", "?")
            print(f"  {state_id} {year}: {old_value} -> {new_value}")
            if not dry_run:
                row["energy_co2e"] = new_value
            updated += 1

    if updated > 0 and not dry_run:
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"  Wrote {path}")

    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Show changes without writing files")
    args = parser.parse_args()

    ef_map = load_ef_map()
    print(f"Loaded {len(ef_map)} emission factors from nga_emission_factors.csv")
    for commodity, ef in ef_map.items():
        if ef > 0:
            print(f"  {commodity}: {ef} kgCO2e/GJ")

    total_updated = 0
    for family_id in BOTTOM_UP_FAMILIES:
        print(f"\nRecalibrating {family_id}:")
        n = recalibrate_family(family_id, ef_map, args.dry_run)
        total_updated += n
        if n == 0:
            print("  (no changes)")

    label = "would update" if args.dry_run else "updated"
    print(f"\nDone: {label} {total_updated} rows across {len(BOTTOM_UP_FAMILIES)} families.")
    if args.dry_run:
        print("Run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()

# Australia Phase 1 data-pack update — high-level note

## Purpose of this update

This update keeps the main intent of the earlier balance-ready pack, but simplifies the residual closure layer so it is easier to use in downstream charting and accounting.

The goal is still not perfect accounting. The goal is a more usable present-day baseline where:

- the explicit sector states are better calibrated for 2025-ish commodity use,
- the modeled sectors have explicit demand anchors,
- the omitted parts of the economy are visible as overlays,
- and those overlays can now be shown directly in fuel, emissions, and cost views.

## Main things we are updating

### 1. Better present-day calibration of the explicit sector states
The main sector-state table remains the updated, balance-oriented version of the original state library.

The emphasis is still mainly:

- better commodity / final-energy calibration,
- more reasonable incumbent 2025 behavior,
- and clearer ambition ordering.

### 2. A separate 2025 demand-anchor table
The demand-anchor table is still the present-day companion to the sector states.

Its purpose is to say what quantity of each modeled service/output the default incumbent 2025 configuration should roughly be supplying.

### 3. A simpler overlay layer for omitted sectors
The biggest change in this revision is the overlay structure.

Instead of keeping separate overlay tables for different accounting purposes, the pack now provides one long-form table:

- `residual_overlays_2025.csv`

That table covers omitted-sector closure rows and makes them usable in a more direct way.

At a high level, it includes three kinds of rows:

- `energy_residual` rows for omitted sectors that still consume commodities,
- `nonenergy_residual` rows for omitted emissions categories without commodity demand,
- `net_sink` rows for optional sink overlays such as LULUCF.

### 4. Overlay rows now carry commodity and cost fields
The residual overlay table is no longer just an emissions closure aid.

For energy residuals, it now also carries:

- commodity quantities,
- direct energy emissions,
- baseline commodity-cost values,
- and a simple fixed non-commodity cost field.

This is intended to make the omitted-sector layer visible in:

- fuel / commodity charts,
- emissions charts,
- and cost charts.

### 5. Overlay cost treatment is intentionally lightweight
The cost columns in the overlay table should be understood as a simple accounting aid, not as a full economic calibration.

The intent is:

- commodity quantities can be repriced in a downstream configuration if needed,
- the table still has a baseline cost view out of the box,
- and non-energy overlays can still interact with cost views through carbon pricing even when they do not carry commodity demand.

## What the main data products are now

### 1. Updated main sector-state table
**`sector_state_curves_balanced.csv`**

This remains the main explicit model table.

### 2. Present-day demand/activity anchors
**`service_demand_anchors_2025.csv`**

This remains the 2025 anchor table for modeled service/output quantities.

### 3. Unified residual overlay table
**`residual_overlays_2025.csv`**

This is now the main omitted-sector closure table.

It is the table that tells you what has to be overlaid onto:

- commodity/fuel totals,
- emissions totals,
- and cost totals

to get a more honest present-day national picture.

### 4. Balance check tables
**`commodity_balance_2025.csv`** and **`emissions_balance_2025.csv`**

These remain diagnostic check tables. They show how the explicit modeled layer plus the overlay layer line up against the benchmark totals.

### 5. Optional helper
**`state_options_index.csv`**

This is still only a convenience extract. It is not part of the core conceptual change.

## Simplified way to think about the pack

At this point the pack can be thought of as three layers:

### A. Explicit modeled layer
- `sector_state_curves_balanced.csv`

### B. Present-day anchor and omitted-sector closure layer
- `service_demand_anchors_2025.csv`
- `residual_overlays_2025.csv`

### C. Diagnostic / validation layer
- `commodity_balance_2025.csv`
- `emissions_balance_2025.csv`

## What this update is not trying to do

This update is still **not** trying to:

- make the omitted sectors endogenous,
- provide a full economy-wide production-cost model,
- make the 2025 baseline exact,
- or lock in a permanent implementation structure.

It is a simpler, more chart-ready packaging of the same basic intent: better baseline closure, clearer interpretation, and more honest visibility of what remains outside the explicit model.

## Terminology note

Where the application needs a saved set of choices and post-processing settings, use **configuration** rather than **scenario**.

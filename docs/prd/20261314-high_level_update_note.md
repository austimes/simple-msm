# Australia Phase 1 data-pack update — high-level note

## Purpose of this update

This update is intended to make the Phase 1 data pack more usable as a **ball-park present-day national accounting base** for the standalone explorer/solver.

The goal is not to make the model fully comprehensive or perfectly calibrated. The goal is to improve the starting point so that:

- incumbent 2025-style selections do not obviously understate national fuel use or emissions,
- the parts of the economy that **are** represented have more reasonable present-day demand anchors,
- the parts of the economy that are **not** explicitly represented are shown openly as residual overlays rather than being silently missing,
- and the ordering of sector-state ambition is easier to read directly from the main table.

## Main things we are updating

### 1. Better calibration of the existing sector states

The main sector-state table has been updated so that the present-day incumbent states are better aligned with Australian 2025-ish accounting.

The emphasis of this recalibration is mainly:

- **commodity / final-energy balance**, and
- a more reasonable present-day baseline for the explicit sectors.

This is only a targeted calibration pass. It is not claiming plant-level realism or a full national energy-balance model. The intent is simply to make the explicit modeled sectors less distorted at the 2025 baseline.

### 2. Add an explicit present-day demand-side anchor table

The earlier library mainly described **sector states**. This update adds a separate table of **2025 demand/activity anchors** for the modeled services and outputs.

That table is there to answer a basic question more consistently:

> If we choose incumbent 2025-style sector states, what present-day level of service/output should each modeled sector be supplying?

This makes it easier to reproduce a reasonable present-day national picture without having every downstream user invent their own demand assumptions.

### 3. Add overlays for the parts of the economy that are not explicitly modeled

The Phase 1 model intentionally does not represent the whole economy in explicit sector-state form. This update makes that explicit by adding **residual overlays**.

These overlays are not new modelled sector families. They are accounting layers used to close the gap between:

- the sectors that are explicitly represented in the model, and
- the national totals we want to be roughly consistent with.

There are two kinds of overlay because they play different roles:

- **Residual energy overlays** represent omitted pieces of the economy that still consume commodities and create direct energy emissions.
- **Residual non-energy emissions overlays** represent omitted emissions that are not naturally expressed as commodity demand in the model, such as fugitives and other non-energy residual categories.

They are separated because only the energy overlays affect commodity balance. The non-energy overlays are emissions-only closure items.

### 4. Make climate-ambition ordering clearer in the main table

Some sector and state labels have been regularised so that the ordering from lower ambition to higher ambition is more obvious.

The intent is that a reader should be able to see, directly in the main sector-state table, something like:

- incumbent,
- ambition 1,
- ambition 2,
- ambition 3,

without needing a separate mapping file to understand which option is the more ambitious one.

This is mainly a usability and interpretability improvement.

## What the updated data products are

### 1. Updated main sector-state table

**`sector_state_curves_balanced.csv`**

This is the updated version of the original sector-state curves table.

At a high level, it differs from the earlier main table in three ways:

- some incumbent states have been retuned for better present-day calibration,
- ambition ordering is clearer and more consistent,
- and the table now carries more explicit cues about default incumbent choices and balance-oriented adjustments.

Conceptually, this remains the main explicit representation of the modeled economy.

### 2. New present-day demand/activity table

**`service_demand_anchors_2025.csv`**

This is a new companion table that provides a reasonable 2025 anchor for the modeled sectors/services.

Its role is to say, in effect:

- what the present-day quantity of each modeled service/output roughly is, and
- what the implied energy/emissions look like if the default incumbent state is used.

This is the main new table that helps avoid under-counting simply because demand was underspecified.

### 3. New residual overlay tables

**`residual_energy_overlay_sectors_2025.csv`**

This table represents omitted sectors or subsectors that still matter for **commodity use** and **direct energy emissions**, but are not explicitly modeled as sector-state choices.

**`residual_nonenergy_emissions_overlays_2025.csv`**

This table represents omitted emissions sources that are needed for **emissions accounting** but are not naturally represented as modeled commodity demand.

Together, these tables make the missing parts of the economy visible instead of leaving them implicit.

### 4. New balance / check tables

**`commodity_balance_2025.csv`**

This is a diagnostic table for checking whether the updated explicit sectors plus overlays give a reasonable ball-park view of commodity/final-energy use.

It is best thought of as a **check against benchmarks**, not as the core model input.

**`emissions_balance_2025.csv`**

This is the equivalent diagnostic table for emissions. It shows how the explicit modeled sectors plus the overlay layers line up against benchmark emissions totals.

Again, this is a **check table**, not the core modeled layer.

### 5. Optional helper table

**`state_options_index.csv`**

This is only a convenience extract of state labels/orderings.

It is not conceptually essential if the main sector-state table already contains the clearer naming and ordering fields the downstream system needs. Separate mapping files are not part of the core intent of this update.


### 6. Optional additional check tables

If the team later carries forward separate **activity balance** or **electricity balance** tables, those should be understood as **diagnostic support tables**, not new core model inputs.

Their purpose would simply be to make it easier to check:

- whether present-day activity assumptions look sensible, and
- whether electricity demand/generation closure is behaving sensibly.

They are useful as QA views, but they are not conceptually required to understand this update.

## Simplified way to think about the pack

At a high level, the updated pack can be thought of as three layers:

### A. Explicit modeled layer
- `sector_state_curves_balanced.csv`

### B. Present-day anchor / closure layer
- `service_demand_anchors_2025.csv`
- `residual_energy_overlay_sectors_2025.csv`
- `residual_nonenergy_emissions_overlays_2025.csv`

### C. Diagnostic / validation layer
- `commodity_balance_2025.csv`
- `emissions_balance_2025.csv`

That is the simplest conceptual framing of what has changed.

## What this update is not trying to do

This update is **not** trying to:

- turn the Phase 1 library into a full economy-wide engineering model,
- make every omitted sector endogenous,
- make the 2025 baseline exact,
- or define a permanent implementation structure for the codebase.

It is a data-pack improvement whose purpose is better baseline closure, clearer interpretation, and more honest accounting of what is and is not in the model.

## Terminology note

Where the application needs a saved set of model choices and post-processing settings, use **configuration** rather than **scenario**.

This note is deliberately focused on the intent of the updated data products, not on how any particular codebase should implement them. Only the long-form/core tables are conceptually important here; any helper, wide-form, or intermediate calibration tables can be dropped if they do not fit the downstream system.

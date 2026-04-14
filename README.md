# simple-msm

`simple-msm` exists to be the working home for a rapidly evolving, explainable trajectory library for meaningful parts of Australia's economy. The core product is the checked-in `sector_trajectory_library/`; the web app is intentionally thin and exists to make that library usable, explorable, and testable.

## Quick Start

```bash
cd web
bun install
bun run dev
```

## Why This Exists

The repository is where we work out what a useful family of sector trajectories should look like for Australia, how those trajectories should be structured, and how they should be justified.

Each `family_id` is meant to represent the meaningful options available for some part of Australia's economy: a sector, subsector, or narrower economic slice that has real energy and emissions trade-offs. Each trajectory within a family expresses some combination of cost intensity, emissions intensity, energy intensity, and rollout or availability limits over time.

The point is not only to sketch curves. It is to build a populated data model that can hold the trajectories, the reasoning behind them, the evidence that supports them, and the caveats that should travel with them.

## What The Repository Is For

This is not just a curve store. It is a place to turn trajectories into explainable model ingredients.

For any given trajectory family, the repository should make it possible to answer:

- how the curve was assembled,
- what evidence supports it,
- what assumptions it relies on,
- what limits constrain it,
- how important it is in the broader model,
- how confident we are in it,
- and how it should be validated, challenged, or revised.

That explainability layer is part of the product itself, not an optional documentation exercise around the edges.

## What The Library Looks Like Today

The canonical authored package is [`sector_trajectory_library/`](./sector_trajectory_library/README.md).

- `shared/families.csv` is the family registry that holds family-level metadata such as sector, region, output unit, and default incumbent state.
- `families/<family_id>/family_states.csv` is the current authored state-year trajectory table for that family.
- `families/<family_id>/demand.csv` stores the family demand anchor and linked shared growth curve.
- `families/<family_id>/README.md` and `families/<family_id>/validation.md` keep family-local context and validation expectations beside the data.
- `shared/` holds the shared ledgers, commodity taxonomy, growth curves, price curves, carbon price curves, owner assignments, and external commodity demand tables.
- `schema/` holds JSON-schema companions for the family registry and family-state rows.
- `overlays/` holds package-owned residual closure inputs.
- `validation/` and `exports/legacy/` hold committed diagnostics and compatibility outputs.

This shape should be treated as the current working structure, not a final settled data model. The trajectory library is still evolving, and the package layout will keep changing while the right authored form for explainable trajectories is being worked out.

## Explainability And Validation Structure

The current package already carries the main explainability and validation scaffolding the project needs.

- `shared/source_ledger.csv` records the source families that justify the trajectories.
- `shared/assumptions_ledger.csv` records explicit assumptions that should stay attached to the data.
- Family-local `README.md` files explain what each family represents and why it is shaped the way it is.
- Family-local `validation.md` files record what should be checked, challenged, or watched for that family.
- `family_states.csv` embeds the evidence and assumption ids, plus rollout and availability notes, directly in the state rows.
- `validation/` contains package-level diagnostics that help test whether the current library behaves coherently.

The intent is for the trajectory library to keep data, explanation, and validation close together rather than separating the curves from the reasons they exist.

## Thin Usability Layer

[`web/`](./web/README.md) is the thin usability, optimization, and explainability layer around the package. It loads the checked-in `sector_trajectory_library/`, turns the current configuration into a normalized solve request, and runs the solve in-browser.

That thin layer is there so you can:

- get the app running quickly,
- inspect trajectories and families,
- compare cost and emissions outcomes,
- test how assumptions change results,
- and trace results back to package evidence, assumptions, and family-local context.

The app matters because it makes the library easier to use and interrogate, but it is not the primary reason this repository exists.

## Repository Layout

```text
.
├── sector_trajectory_library/  # Canonical authored trajectory package
├── web/                        # Thin interaction layer for explore / solve / compare workflows
└── docs/prd/                   # Historical PRD and product notes
```

## Current Status And Limits

- The trajectory-library shape is still moving.
- The current package layout is designed for active authoring, explainability, and validation rather than long-term final form.
- `exports/legacy/` remains in the repo for compatibility with existing consumers and workflows.
- The web app is intentionally thin and should not be mistaken for the primary product.
- The current repository is strongest as a working environment for developing the data structure, trajectories, justifications, and interactive testing loop together.

## Further Reading

- [sector_trajectory_library/README.md](./sector_trajectory_library/README.md)
- [web/README.md](./web/README.md)
- [docs/prd/phase1_sector_state_explorer_prd_v02.md](./docs/prd/phase1_sector_state_explorer_prd_v02.md)

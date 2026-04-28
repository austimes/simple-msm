# simple-msm

`simple-msm` is library-first. It exists to design, develop, test, and repeatedly reshape a reusable, interchangeable library of components that represent pieces of Australia's energy and emissions system. The core product is the checked-in [`energy_system_representation_library/`](./energy_system_representation_library/README.md).

The optimizer, CLI, and WebUI are deliberately thin harnesses around that library. They exist to exercise the package, make its results inspectable, and discover the machinery needed for explainable modelling workflows such as experiment sets, modelling to generate alternatives, and tracing results back to evidence, assumptions, and validation notes.

There is no general backward-compatibility promise yet. Library schemas, package layout, CLI contracts, and UI-facing data shapes are expected to change quickly while the useful shape of the system is discovered through repeated use in anger.

## Quick Start

```bash
cd web
bun install
bun run dev
```

For non-browser reproduction from the repo, the first-class CLI also lives in `web/`:

```bash
cd web
bun run msm list
bun run msm prime reference-baseline
```

## Why This Exists

The repository is where we work out what a useful role-topology library should look like for Australia, how those roles and methods should be structured, and how they should be justified.

Each `role_id` represents a function the system must produce, supply, deliver, remove, or account for. Each method within a direct representation expresses some combination of cost intensity, emissions intensity, energy intensity, and rollout or availability limits over time.

The point is not only to sketch curves. It is to build a populated data model that can hold the methods, the reasoning behind them, the evidence that supports them, and the caveats that should travel with them.

## What The Repository Is For

This is not just a curve store. It is a place to turn methods into explainable model ingredients.

For any given role, the repository should make it possible to answer:

- how the method-year rows were assembled,
- what evidence supports them,
- what assumptions they rely on,
- what limits constrain them,
- how important the role is in the broader model,
- how confident we are in it,
- and how it should be validated, challenged, or revised.

That explainability layer is part of the product itself, not an optional documentation exercise around the edges.

## What The Library Looks Like Today

The canonical authored package is [`energy_system_representation_library/`](./energy_system_representation_library/README.md).

- `shared/roles.csv` is the role registry and topology surface.
- `shared/representations.csv` defines the default and optional ways each role can be modelled.
- `shared/role_decomposition_edges.csv` defines child-role activation for decomposition representations.
- The current crude-steel pilot keeps `produce_crude_steel` available as an aggregate pathway bundle while adding an optional decomposition into non-H2 residual coverage, DRI production, and DRI melt/refine child roles.
- `shared/reporting_allocations.csv` maps role activity to reporting sectors, subsectors, and buckets without defining physical topology.
- `roles/<role_id>/methods.csv` lists selectable methods for direct role representations.
- `roles/<role_id>/method_years.csv` stores the numeric method-year rows for cost, inputs, emissions, rollout limits, evidence, assumptions, and validation notes.
- `roles/<role_id>/demand.csv`, `README.md`, and `validation.md` keep role-local anchors, context, and validation expectations beside the data.
- `shared/` holds ledgers, owners, commodities, growth curves, price curves, carbon price curves, topology, representation, and reporting tables.
- `schema/` holds JSON-schema companions for the authored CSV surfaces.
- `validation/` holds committed diagnostics using role/method terminology.

This shape should be treated as the current working structure, not a final settled data model. The representation library is still evolving, and the package layout will keep changing while the right authored form for explainable, interchangeable components is being worked out.

## Explainability And Validation Structure

The current package already carries the main explainability and validation scaffolding the project needs.

- `shared/source_ledger.csv` records the sources that justify the methods.
- `shared/assumptions_ledger.csv` records explicit assumptions that should stay attached to the data.
- Role-local `README.md` files explain what each role represents and why its method set is shaped the way it is.
- Role-local `validation.md` files record what should be checked, challenged, or watched for that role.
- `method_years.csv` embeds the evidence and assumption ids, plus rollout and availability notes, directly in the method-year rows.
- `validation/` contains package-level diagnostics that help test whether the current library behaves coherently.

The intent is for the representation library to keep data, explanation, and validation close together rather than separating the curves from the reasons they exist.

## Thin Usability Layer

[`web/`](./web/README.md) is the thin usability, optimization, and explainability layer around the package. ESRL 2 work is responsible for cutting that layer over to the canonical role, representation, and method surfaces.

That thin layer is there so you can:

- get the app running quickly,
- inspect roles and methods,
- inspect cost and emissions outcomes,
- test how assumptions change results,
- run and compare experiment sets,
- generate and inspect alternative model outcomes,
- and trace results back to package evidence, assumptions, and role-local context.

The app matters because it makes the library easier to use and interrogate, but it is not the primary reason this repository exists.

## Repository Layout

```text
.
├── energy_system_representation_library/  # Canonical authored representation package
├── web/                                   # Thin interaction layer for explore / solve / explain workflows
└── docs/                                  # Historical PRDs plus current implementation plans
```

## Current Status And Limits

- The representation-library shape is still moving, and incompatible changes are expected.
- The current package layout is designed for active authoring, explainability, and validation rather than long-term final form.
- The old family/state package layout has been removed as a canonical surface.
- The CLI and WebUI contracts may change as the library design changes.
- The web app is intentionally thin and should not be mistaken for the primary product.
- The current repository is strongest as a working environment for developing the data structure, methods, justifications, and interactive testing loop together.

## Further Reading

- [energy_system_representation_library/README.md](./energy_system_representation_library/README.md)
- [web/README.md](./web/README.md)
- [docs/plan/20260428-esrl-ontology-decision.md](./docs/plan/20260428-esrl-ontology-decision.md)
- [docs/prd/phase1_sector_state_explorer_prd_v02.md](./docs/prd/phase1_sector_state_explorer_prd_v02.md)

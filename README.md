# simple-msm

`simple-msm` now treats `sector_trajectory_library/` as the primary product. The repository packages a family-scoped sector trajectory library together with a thin web explorer / solver that loads that package directly.

## Repository Shape

- `sector_trajectory_library/` is the canonical authored package.
- `web/` is the Vite + React + TypeScript app that explores, solves, and compares configurations over that package.
- `docs/prd/` keeps historical product notes and PRD material.

## Canonical Package

`sector_trajectory_library/` is organized around `family_id`.

- `shared/families.csv` is the canonical family registry.
- `families/<family_id>/family_states.csv` is the authored state-year trajectory table.
- `families/<family_id>/demand.csv` stores the family anchor plus linked shared growth curve.
- `families/<family_id>/README.md` and `validation.md` keep family-local documentation beside the data.
- `shared/` holds owners, ledgers, commodities, demand curves, price curves, carbon price curves, and external commodity demand anchors.
- `overlays/residual_overlays.csv` is the package-owned residual closure layer.
- `validation/` and `exports/legacy/` are generated artifacts committed for diagnostics and compatibility.

The current package still covers 14 families, 38 state ids, and 228 state-year rows across milestone years 2025, 2030, 2035, 2040, 2045, and 2050.

## Web App

The app loads the checked-in package directly and derives the same internal solver model used before, but now from the structured package layout instead of one monolithic authored CSV.

At a high level it:

1. loads package text files from `sector_trajectory_library/`
2. joins `shared/families.csv` with each family-local `family_states.csv`
3. derives anchors and shared curve registries from package-owned demand / price / carbon tables
4. validates and resolves one active configuration document
5. builds the normalized LP request and solves it in-browser
6. layers residual overlays and validation diagnostics back in for reporting

Saved configuration documents keep the existing JSON shape.

## Running The App

There is no root `package.json`, so run app commands from `web/`.

```bash
cd web
npm install
npm run dev
```

Other common commands:

```bash
cd web
npm run build
npm run lint
npx tsx --test test/*.test.mjs
```

## Key Conventions

- The canonical authored interface is the package structure under `sector_trajectory_library/`, not `sector_state_curves_balanced.csv`.
- Legacy CSVs in `exports/legacy/` exist for compatibility only.
- Validation tables in `validation/` are generated diagnostics, not hand-authored source data.
- Shared curve tables are package-owned. Output-role metadata and explanation rules remain app-owned.

## Repo Map

```text
.
├── sector_trajectory_library/
│   ├── README.md
│   ├── manifest.json
│   ├── schema/
│   ├── shared/
│   ├── families/
│   ├── overlays/
│   ├── validation/
│   └── exports/legacy/
├── docs/
│   └── prd/
└── web/
    ├── package.json
    ├── public/app_config/
    ├── src/
    └── test/
```

## Further Reading

- [sector_trajectory_library/README.md](/Users/gre538/code/simple-msm-iwr/sector_trajectory_library/README.md)
- [web/src/configurations/reference.json](/Users/gre538/code/simple-msm-iwr/web/src/configurations/reference.json)
- [docs/prd/phase1_sector_state_explorer_prd_v02.md](/Users/gre538/code/simple-msm-iwr/docs/prd/phase1_sector_state_explorer_prd_v02.md)

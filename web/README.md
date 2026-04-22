# Web App

`web/` is the thin front end for the trajectory library in `simple-msm`. It loads the checked-in `sector_trajectory_library/`, restores one active configuration document, builds a normalized solve request, and runs the LP solve in-browser so the package can be explored, optimized, and explained interactively.

The app is a usability layer around the trajectory library rather than the primary product. Its job is to make the package easier to interrogate, test, and communicate.

## Configuration Model

The app is configuration-first.

- Built-in configurations live in `src/configurations/*.json` and are full solve documents.
- Imported JSON uses that same document shape.
- Browser autosave persists that same full document as the active working document.
- The solver consumes that same document after demand resolution and optional output scoping.

There is no separate user-facing packaged-reference-plus-overlay workflow.

## Run It

```bash
bun install
bun run dev
```

Open the local URL printed by Vite.

## CLI Reproduction

The same package and configuration documents can be run outside the browser via `msm`.

```bash
bun run msm list
bun run msm reference-baseline
bun run msm user:full-system-base
bun run msm compare reference-baseline user:full-system-base --json
bun run msm prime user:full-system-base --base reference-baseline
```

Notes:

- Run the CLI from `web/`.
- `user:<id>` resolves repo-backed user configs from `src/configurations/user/*.json`.
- Unsaved browser-local drafts are not visible to the CLI; save them as a user config or export the JSON document first.
- `prime` emits a machine-readable, AI-oriented workflow bundle that packages the active configuration, solve summary, top diagnostics, and suggested next actions.

## Quality Checks

```bash
bun run lint
bun run build
bun run test
```

`bun run test` is the supported test entrypoint for the web app. It invokes `tsx --test` over the `test/*.test.{mjs,ts,tsx}` files, which are authored against Node's built-in `node:test` APIs rather than Vitest.

## Main Folders

- `src/configurations/` — built-in full configuration documents.
- `src/components/workspace/` — configuration workspace UI, including import/export and metadata editing.
- `src/data/` — package loading, configuration loading, browser persistence, and demand resolution.
- `src/solver/` — normalized solve-request construction, worker bridge, and LP adapter.
- `test/` — regression coverage for configuration documents, demand resolution, solves, page rendering, and package companions.

## Contributor Notes

- `public/app_config/` contains app-owned registries and defaults such as output roles, demand presets, commodity-price presets, and explanation rules.
- If you add a built-in configuration, keep it as a complete document with explicit demand tables and metadata. Do not rely on reference-document inheritance or overlays.

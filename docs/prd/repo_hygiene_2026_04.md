# Repository Hygiene Audit — 2026-04

## Summary

The repo builds and lints cleanly but has several hygiene issues: one failing test (already tracked), hardcoded absolute paths in README.md, an empty legacy directory (`aus_phase1_sector_state_library/`) that contains only `.DS_Store` files, a stale root-level `node_modules/` directory with no corresponding `package.json`, invalid PRD filenames, a 2.4 MB monolithic JS bundle, and a `CLAUDE.md` with placeholder sections. The codebase is well-structured for agent work overall but would benefit from cleanup.

## Findings by Category

### 1. Dead Code & Unused Modules

- **Empty directory `aus_phase1_sector_state_library/`**: Contains only `.DS_Store` files in `data/` and `docs/` subdirectories. No code, no data, not referenced anywhere in the codebase. Appears to be a legacy artifact.
- **Root-level `node_modules/`**: Contains only a `.vite/vitest` cache directory. No `package.json` exists at the root. This is a stale Vite cache from a prior dev setup.
- **CLAUDE.md placeholder sections**: "Architecture Overview" and "Conventions & Patterns" sections are empty placeholders (`_Add a brief overview..._`). Either fill them or remove the file (AGENTS.md already provides the beads integration).

### 2. Stale Tests

- **One failing test** (`solveSubsets.test.mjs:373`): BEV subset test expects BEV as active state but gets ICE fleet. Already tracked as `simple-msm-5jq`.

### 3. Documentation Drift

- **README.md hardcoded absolute paths**: Lines 39, 67, 98-100 use `/Users/gre538/code/simple-msm/...` absolute paths instead of relative paths. These break for any other developer or CI.
- **PRD filenames `20261314-*`**: Fixed — renamed to `20260413-*` (valid ISO date prefix).

### 4. Code Quality

- **No TODO/FIXME/HACK comments**: Clean ✓
- **Large files**: `lpAdapter.ts` (1975 lines), `compareAnalysis.ts` (1474 lines), `LibraryPage.tsx` (1010 lines) are quite large. These are functional and not blocking, but could benefit from splitting in future.
- **Bundle size warning**: Single JS chunk is 2.4 MB (385 KB gzipped). Vite recommends code-splitting via dynamic imports.

### 5. Configuration & Build Hygiene

- **`.DS_Store` in `.gitignore` but still on disk**: Not committed to git (good), but present in working tree in `docs/`, `aus_phase1_sector_state_library/data/`, `aus_phase1_sector_state_library/docs/`.
- **No CI/CD**: No `.github/workflows/` directory. Build, lint, and test checks are manual only.

### 6. Branch Hygiene

- **1 merged local branch** (`simple-msm-9lo`): Currently an active worktree for in-progress bug fix — this is fine.
- **No stale remote branches**: Clean ✓

### 7. Issue Tracker Hygiene

- **Merge slot open**: `simple-msm-merge-slot` is open (expected).
- **`simple-msm-kj1` epic** (4 sub-issues): Open, not yet started. Its dependency (`simple-msm-75t`) is closed. Ready to work.
- **No stale or orphaned issues**: Clean ✓

## Agent-First Assessment

| Criterion | Score | Notes |
|-----------|-------|-------|
| Discoverability | 4/5 | AGENTS.md + bd integration is strong; CLAUDE.md has empty placeholders |
| Self-documenting | 4/5 | Types, naming, and data model are clear |
| Feedback loops | 4/5 | Build, lint, test all work; one test failure tracked |
| Minimal ambiguity | 3/5 | CLAUDE.md vs AGENTS.md duplication; absolute paths in README |
| Clean boundaries | 4/5 | Good separation: data library / web app / solver |
| Onboarding speed | 4/5 | bd prime + README give quick orientation |

**Overall: 3.8 / 5** — Good shape, minor cleanup needed.

## Recommendation

Priority cleanup: (1) fix README absolute paths, (2) remove empty `aus_phase1_sector_state_library/`, (3) delete stale root `node_modules/`, (4) fill or remove CLAUDE.md placeholders. The failing test is already tracked. CI setup and code-splitting are lower priority but valuable for sustainability.

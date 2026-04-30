# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

## Project Posture

`simple-msm` is library-first. The main product is the reusable, interchangeable trajectory/component library for modelling pieces of Australia's energy and emissions system. The optimizer, CLI, and WebUI are deliberately thin harnesses around that library: they exist to exercise it, test it, explain its outputs, and discover the supporting machinery needed for workflows such as experiment sets, modelling to generate alternatives, and traceable result explanations.

Do not treat the current library shape as stable. This repository is still discovering the right abstractions through repeated use in anger, so there is no general backward-compatibility promise for library schemas, package layout, CLI contracts, or UI-facing data shapes. Prefer clear, useful evolution over compatibility preservation unless a task explicitly says otherwise.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Issue Workflow

When an agent is asked to work on a specific issue, it must always do that work in a dedicated git worktree and land it onto `main` through the acquisition of the beads merge-slot issue to prevent more than one agent at a time merging into `main`.

### A. Work in a worktree

Claim the issue, then do the work in a git worktree.

### B. Landing issue work onto `main`

1. Finish the work in the issue worktree and commit it there first.
2. Return to the primary `main` checkout before merging.
3. Ensure the merge slot exists:
   ```bash
   bd merge-slot create
   ```
   If it already exists, that is fine.
4. Always check the merge slot before trying to acquire it:
   ```bash
   bd merge-slot check
   ```
5. If another agent is holding the slot, do not start merging or conflict resolution work on `main`.
   Attempt to queue for the slot instead:
   ```bash
   bd merge-slot acquire --wait
   ```
   Then wait and retry later. Every agent must check first so it can see whether another agent already holds the slot.
6. If the slot is available, acquire it before touching `main`:
   ```bash
   bd merge-slot acquire
   ```
7. While holding the slot, update `main`, merge the issue branch, resolve conflicts if needed, run the relevant verification, and push the result.
8. Release the merge slot immediately after the merge completes:
   ```bash
   bd merge-slot release
   ```
9. If the merge or push fails after acquiring the slot, resolve the problem or back out as needed, but always release the merge slot before ending the session.

10. Clean up the worktree and branch if merge was successful.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files
- For issue work, always use a dedicated git worktree rather than editing directly in the primary `main` checkout
- Land issue branches onto `main` only through the beads merge slot: create it if needed, check it first, acquire it before merging, and release it immediately after

### Issue and Epic Naming

When creating new beads issues or epics, make the intended work sequence visible in `bd list`.

- Use versioned, sortable titles for related work. Prefix each related epic and issue with a stable version tag and an ordered step number where order matters, for example `[role-graph-v1 00] Epic: Physical role graph`, `[role-graph-v1 01] Define role graph schema`, `[role-graph-v1 02] Migrate library data`.
- Start a new version tag when follow-up work changes scope or supersedes an earlier plan, for example `role-graph-v2` rather than reusing `role-graph-v1`.
- Add beads dependencies whenever order or readiness matters. Later work should depend on earlier work with `bd dep add <later-issue> <earlier-issue>` so blocked work is hidden from `bd ready` and the intended order is clear to agents and humans.
- Prefer a small dependency chain or dependency fan-in over relying only on title ordering. If an issue can genuinely run in parallel, do not add a dependency just to group it.
- For epics, use the version tag in the epic title and apply the same version tag to its child issues so `bd list` shows the set together even without opening each issue.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

---
name: codemap
description: Generates a structured JSON inventory of the repository for AI agent orientation. Triggered by /codemap. Produces codemap-out/codemap.json containing all pages (with routes), API routes (with HTTP methods), proxy auth gates, app special files, migrations, root config, and every source directory with its exports.
---

# codemap

Generates `codemap-out/codemap.json` — a structured, agent-readable inventory of the repository.

Implementation layout: `codemap.mjs` is the orchestrator; execution logic lives in `.agents/skills/codemap/lib/`.

## When to Invoke

| Command | Effect |
|---|---|
| `/codemap` | Scan the repo, write `codemap-out/codemap.json`, report summary |
| `/codemap --update` | Update the codemap tool itself — sync `SOURCE_DIRS` in `codemap.mjs` to match `src/`, then re-run |
| `node .agents/skills/codemap/codemap.mjs hook install --profile=copilot` | Install repo-local post-commit codemap refresh hook using `.github/hooks/post-commit.d` |
| `node .agents/skills/codemap/codemap.mjs hook install --profile=claude` | Install repo-local post-commit codemap refresh hook using `.claude/hooks/post-commit.d` |
| `node .agents/skills/codemap/codemap.mjs hook install --profile=generic` | Install repo-local post-commit codemap refresh hook using `.agents/hooks/post-commit.d` |
| `node .agents/skills/codemap/codemap.mjs hook install` | Install default profile (`generic`) |
| `node .agents/skills/codemap/codemap.mjs hook status` | Show dispatcher + fragment install status for both profiles |
| `node .agents/skills/codemap/codemap.mjs hook uninstall --profile=<profile>` | Remove profile-specific codemap hook fragment |

## What It Does

## Gitignore Note

To prevent generated codemap output from creating extra commits, ensure your repo `.gitignore` includes:

```gitignore
/codemap-out
/codemap
```

The codemap script also auto-appends missing entries when `/codemap` runs.

### `/codemap`

1. Run the script from the repo root:
   ```
   node .agents/skills/codemap/codemap.mjs
   ```
2. Report the summary output lines from stdout (pages, API routes, library components, etc.)
3. Confirm the output path: `codemap-out/codemap.json`

### `/codemap --update`

Updates the codemap tool itself — specifically the `SOURCE_DIRS` config in `codemap.mjs` — to reflect the current state of `src/`.

1. List all immediate subdirectories of `src/` (excluding `app/` — that is handled by the pages/API route scanners, not `SOURCE_DIRS`)
2. Compare against the `SOURCE_DIRS` array in `.agents/skills/codemap/codemap.mjs`
3. For any directory in `src/` **not** in `SOURCE_DIRS`: add an entry with a placeholder `description` and note it for the user to fill in
4. For any entry in `SOURCE_DIRS` whose directory **no longer exists** in `src/`: remove the entry
5. After editing `codemap.mjs`, re-run `/codemap` to regenerate `codemap-out/codemap.json`
6. Report what changed: added entries, removed entries, final directory count

### Hook Commands

Use these to keep codemap updated after relevant commits.

Only one profile fragment should be active at a time. Installing a profile removes codemap fragments from the other profile folders.

1. Install Copilot profile hook:
   ```
   node .agents/skills/codemap/codemap.mjs hook install --profile=copilot
   ```
2. Install Claude profile hook:
   ```
   node .agents/skills/codemap/codemap.mjs hook install --profile=claude
   ```
3. Install Generic profile hook:
   ```
   node .agents/skills/codemap/codemap.mjs hook install --profile=generic
   ```
   or
   ```
   node .agents/skills/codemap/codemap.mjs hook install
   ```
4. Check hook status:
   ```
   node .agents/skills/codemap/codemap.mjs hook status
   ```
5. Uninstall a profile hook:
   ```
   node .agents/skills/codemap/codemap.mjs hook uninstall --profile=copilot
   node .agents/skills/codemap/codemap.mjs hook uninstall --profile=claude
   node .agents/skills/codemap/codemap.mjs hook uninstall --profile=generic
   ```
6. Manual hook execution target:
   ```
   node .agents/skills/codemap/codemap.mjs hook run-post-commit
   ```


## Output Location

`codemap-out/codemap.json` at the project root. The directory is gitignored and created automatically on first run.

## When to Read the Output

At session start, read `codemap-out/codemap.json` to orient before browsing individual files. The codemap answers:
- "What pages exist and what are their routes?"
- "Which pages are auth-protected?"
- "What API routes exist and which HTTP methods do they support?"
- "What does `src/library/` contain?"
- "Which routes does the proxy gate?"

## Error Handling

If the script fails:
- Surface the full Node.js error message
- If `Cannot find module` or `ENOENT`: check that SOURCE_DIRS entries in the CONFIG section match actual directories in `src/`
- If `SyntaxError`: the script has been modified incorrectly — check the CONFIG block
- Node.js ≥ 18 is required (uses ESM `import` syntax)

## Scope

Scan scope is set by SOURCE_DIRS in the CONFIG section of `codemap.mjs`. The `.codemapignore` file at the project root documents intended scope (`src/` only).

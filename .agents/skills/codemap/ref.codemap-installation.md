# PRD: Codemap Installation Guide and Methodology

## Purpose

Define a repeatable way to install codemap in any repository and keep it accurate over time, while avoiding noisy scans and unstable output.

## Core Question

Should install run a full-repo scan, read `.gitignore`, and set codemap indexing scope from non-ignored directories?

## Decision

Use a hybrid strategy, not a full-repo install-time scan.

1. Do not scan the entire repository on install.
2. Do auto-discover `src/` top-level directories for `SOURCE_DIRS` (excluding `app/`).
3. Do respect `.gitignore` during file walking.
4. Keep codemap-specific exclusions in `.codemapignore` for deterministic control.
5. Regenerate codemap on demand (`/codemap`) and after structure changes (`/codemap --update`).

## Why This Strategy Is Better

### Problems with full-repo install scanning

1. Pulls in unrelated folders (tooling, generated assets, caches) unless aggressively filtered.
2. Makes codemap output unstable between machines when local ignored files differ.
3. Increases runtime and output churn for little orientation value.
4. Risks indexing content outside intended app source boundaries.

### Benefits of scoped auto-discovery

1. Keeps codemap aligned to app code structure (`src/*`) where navigation value is highest.
2. Automatically adapts as teams add/remove source domains.
3. Preserves intentional metadata (`description`) instead of replacing with generic full-repo noise.
4. Produces more stable diffs and easier PR review.

## Hook Installation Profiles

Codemap hooks are installed in a repo-local dispatcher at `.git/hooks/post-commit` and can source fragments from one or more profile directories.

### Supported profiles

1. `copilot`: `.github/hooks/post-commit.d`
2. `claude`: `.claude/hooks/post-commit.d`

### Why profiles matter

1. Copilot-centric repos typically keep automation in `.github/hooks/*`.
2. Claude-centric repos may prefer `.claude/hooks/*`.
3. Teams can install both profiles in the same repo if they want shared behavior.
4. Monorepos are supported: dispatcher installs at git root, while fragments execute from project root.

## Installation Methodology (Portable)

## 1. Copy skill files

Copy `.agents/skills/codemap/` into the target repository.

## 2. Set minimal config

In `codemap.mjs`, set only:

1. Framework identifier.
2. Source root (`SRC_DIR`).
3. App router dir (`APP_DIR`) if relevant.
4. Optional proxy path.
5. Optional migrations dir.
6. Root config files list.

Keep engine logic unchanged.

## 3. Initialize source scope

Run `/codemap --update` to sync `SOURCE_DIRS` with immediate `src/` directories (excluding `app/`).

Rules:

1. Add missing entries with placeholder descriptions.
2. Remove entries whose directories no longer exist.
3. Preserve existing descriptions when directory still exists.

## 4. Install hook profile

Choose one:

1. Copilot profile: `node .agents/skills/codemap/codemap.mjs hook install --profile=copilot`
2. Claude profile: `node .agents/skills/codemap/codemap.mjs hook install --profile=claude`
3. Default if omitted: copilot profile.

## 5. Generate baseline map

Run `/codemap` to produce `codemap-out/codemap.json`.

## 6. Validate output

Confirm:

1. Pages present with route mapping.
2. API routes include HTTP methods.
3. App special files present.
4. Proxy section present when configured.
5. `dirs` keys match current `src/` top-level structure.

## Ignore Handling Model

Use layered filtering.

1. Hardcoded engine excludes: `node_modules`, `.next`, `.git`, OS junk.
2. Repository excludes: `.gitignore` patterns (recommended to enable by default).
3. Codemap overrides: `.codemapignore` for codemap-only exclusions.

### Precedence

1. Hardcoded safety excludes always win.
2. `.codemapignore` next.
3. `.gitignore` next.
4. Positive scope constraints from codemap config last (for deterministic inclusion domains).

## Operational Workflow

## Daily/normal use

1. `/codemap` when you need fresh orientation.

## Structural changes in `src/`

1. `/codemap --update`
2. `/codemap`

## Hook lifecycle

1. Check status: `node .agents/skills/codemap/codemap.mjs hook status`
2. Remove Copilot hook: `node .agents/skills/codemap/codemap.mjs hook uninstall --profile=copilot`
3. Remove Claude hook: `node .agents/skills/codemap/codemap.mjs hook uninstall --profile=claude`
4. Hook refresh target: `node .agents/skills/codemap/codemap.mjs hook run-post-commit`

## Optional CI guardrail

1. Run codemap generation in CI.
2. Fail if codemap is out of date relative to tracked source structure policy.

## Non-Goals

1. Full dependency graphing across every repository file.
2. Indexing build artifacts or generated output.
3. Replacing architectural docs or PRDs.

## Success Criteria

1. New repo install completes with only config edits and one update command.
2. Codemap remains stable across machines for the same commit.
3. `SOURCE_DIRS` stays synchronized with real `src/` folders.
4. Output remains focused on developer navigation, not exhaustive repository scraping.
5. Hook install can target Copilot or Claude without code edits.

## Recommended Next Implementation Changes

1. Add `.gitignore` parsing support in `walk` traversal (if not already active).
2. Add `.codemapignore` support for codemap-specific control.
3. Keep `/codemap --update` as the only path that mutates `SOURCE_DIRS`.
4. Keep `/codemap` read-only with respect to tool configuration.

## Open Questions

1. Should CI enforce codemap freshness as blocking or warning-only?
2. Should `SOURCE_DIRS` include non-`src` domains in some repos (for example `packages/*` in monorepos)?
3. Should generated codemap artifacts be committed or always gitignored per team preference?
4. Should both hook profiles be installed by default in poly-agent repos, or remain explicit opt-in?

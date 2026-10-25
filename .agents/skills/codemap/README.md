# codemap

Portable repository inventory for AI agent orientation.

codemap generates a structured JSON map of your project so agents can quickly answer questions like:

- What pages exist and which routes do they map to?
- Which API endpoints exist and what HTTP methods are exported?
- Which source folders exist and what symbols do they export?
- Which routes are protected by proxy/middleware logic?

Output file:

- codemap-out/codemap.json

## What The Skill Does

The codemap skill is an operational wrapper around the codemap engine in [.agents/skills/codemap/codemap.mjs](.agents/skills/codemap/codemap.mjs).

It provides a repeatable workflow to:

1. Scan project source structure.
2. Build a machine-readable inventory.
3. Keep the inventory fresh manually or via post-commit hooks.

The skill definition lives in [.agents/skills/codemap/SKILL.md](.agents/skills/codemap/SKILL.md).

Architecture note:

- `codemap.mjs` is the orchestrator entrypoint.
- Logic is split into `.agents/skills/codemap/lib/` modules.

## Requirements

- Node.js 18+
- Git repository (required for hook installation)

## Gitignore Note

To avoid generated codemap files causing follow-up commits, ensure these entries exist in your repo `.gitignore`:

```gitignore
/codemap-out
```

The codemap script also auto-appends missing entries when you run it.

## Install In A New Repo

If you downloaded or cloned this codemap folder and want to install it into another project:

1. Copy the folder into the target repository:
	 - source: .agents/skills/codemap/
	 - destination: <target-repo>/.agents/skills/codemap/
2. Open [.agents/skills/codemap/codemap.mjs](.agents/skills/codemap/codemap.mjs) in the target repo.
3. Update only the CONFIG block at the top:
	 - FRAMEWORK
	 - SRC_DIR
	 - APP_DIR
	 - PROXY_FILE
	 - MIGRATIONS_DIR
	 - ROOT_CONFIG_FILES
	 - SOURCE_DIRS
4. Run an initial build:

```bash
node .agents/skills/codemap/codemap.mjs
```

5. Verify output exists at codemap-out/codemap.json.

## Usage

Generate codemap:

```bash
node .agents/skills/codemap/codemap.mjs
```

This prints a summary (pages, API routes, indexed source directories) and writes codemap-out/codemap.json.

## Optional: Auto-refresh Hooks

codemap supports repo-local post-commit hook setup with profile-specific fragment folders.

Only one profile fragment should be active at a time. Installing a profile removes codemap fragments from the other profile folders.

Profile targets:

- Copilot profile: .github/hooks/post-commit.d/codemap.sh
- Claude profile: .claude/hooks/post-commit.d/codemap.sh
- Generic profile: .agents/hooks/post-commit.d/codemap.sh

Install hook for Copilot profile:

```bash
node .agents/skills/codemap/codemap.mjs hook install --profile=copilot
```

Install hook for Claude profile:

```bash
node .agents/skills/codemap/codemap.mjs hook install --profile=claude
```

Install hook for Generic profile:

```bash
node .agents/skills/codemap/codemap.mjs hook install --profile=generic
```

Install default profile (generic):

```bash
node .agents/skills/codemap/codemap.mjs hook install
```

Check hook status:

```bash
node .agents/skills/codemap/codemap.mjs hook status
```

Uninstall profile hook:

```bash
node .agents/skills/codemap/codemap.mjs hook uninstall --profile=copilot
node .agents/skills/codemap/codemap.mjs hook uninstall --profile=claude
node .agents/skills/codemap/codemap.mjs hook uninstall --profile=generic
```

Manual post-commit refresh target:

```bash
node .agents/skills/codemap/codemap.mjs hook run-post-commit
```

## Scope Design

codemap is intentionally source-focused rather than full-repo exhaustive.

- Primary index scope comes from SOURCE_DIRS.
- App routes are discovered from SRC_DIR/APP_DIR.
- API routes are discovered from SRC_DIR/APP_DIR/api.

This keeps output stable and high-signal for agent orientation.

## Recommended Workflow

1. Run codemap at project setup.
2. Re-run after adding/removing source folders.
3. Enable hooks if you want automatic refresh after relevant commits.
4. Use codemap-out/codemap.json as the canonical route/source inventory for agent sessions.

## Troubleshooting

- Error: Not inside a Git repository
	- Hook commands require running inside a Git repo.
- Error: Cannot find module / ENOENT
	- Confirm .agents/skills/codemap/codemap.mjs exists in the target repo.
	- Confirm configured source directories actually exist.
- Empty or partial output
	- Check SRC_DIR and APP_DIR values.
	- Confirm SOURCE_DIRS entries match real folder names.

## Files In This Skill

- Orchestrator: [.agents/skills/codemap/codemap.mjs](.agents/skills/codemap/codemap.mjs)
- Core inventory module: [.agents/skills/codemap/lib/codemap-core.mjs](.agents/skills/codemap/lib/codemap-core.mjs)
- Hook module: [.agents/skills/codemap/lib/hooks.mjs](.agents/skills/codemap/lib/hooks.mjs)
- Skill spec: [.agents/skills/codemap/SKILL.md](.agents/skills/codemap/SKILL.md)
- This guide: [.agents/skills/codemap/README.md](.agents/skills/codemap/README.md)

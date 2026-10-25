# Graphify Setup For This Repo

Use this runbook to execute Graphify in this repository and keep it integrated with the local agent workflow.

## Prerequisites

- Python 3.10+ (already satisfied in this environment)
- Graphify CLI installed and available on PATH
- Run all commands from the repository root

## One-Time Local Setup

```bash
brew install uv
uv tool install graphifyy
uv tool update-shell
graphify --version
```

If `graphify` is not found, open a new terminal and run `graphify --version` again.

## Project-Scoped Setup (General)

Install Graphify into this repository (project-scoped) so setup files are written under the repo instead of user home:

```bash
graphify agents install --project
```

Optional platform-specific installs:

```bash
graphify vscode install --project
graphify codex install --project
graphify claude install --project
```

## First Graph Build For This Repo

Build the graph for the full codebase:

```bash
graphify .
```

For a refresh that only processes changes:

```bash
graphify . --update
```

## Expected Output

After `graphify .`, confirm these files exist:

```text
graphify-out/
	graph.html
	GRAPH_REPORT.md
	graph.json
```

## Repo Hygiene

- Keep Graphify skill/setup files under `.agents/` for this project.
- Do not add any `.claude/` paths in prompts, skills, or docs.
- Keep prompt references aligned with `.agents/skills/...`.

## Recommended Next Commands

Once the graph is built, use:

```bash
graphify query "show the auth flow"
graphify path "GameContext" "save_player"
graphify explain "battleRound"
```

## Troubleshooting

- `graphify: command not found`
	- Run `uv tool update-shell`
	- Open a new terminal
- `graphify install --project` created `.claude/`
	- Reinstall with `graphify agents install --project`
	- Move any needed files to `.agents/skills/graphify/`
	- Delete `.claude/`
- Graph seems stale
	- Run `graphify . --update`
- Graph changed heavily after refactor
	- Run `graphify extract . --force`

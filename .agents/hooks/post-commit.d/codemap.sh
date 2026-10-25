#!/bin/sh
# managed-by: codemap-fragment-v1

set -eu

REPO_ROOT=$(git rev-parse --show-toplevel)
PROJECT_ROOT="$REPO_ROOT"
cd "$PROJECT_ROOT"

node .agents/skills/codemap/codemap.mjs hook run-post-commit

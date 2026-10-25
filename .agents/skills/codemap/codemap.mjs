/**
 * codemap.mjs — Portable project inventory for AI agent orientation
 *
 * This script is a DEVELOPMENT TOOL for AI agent assistance and code navigation.
 * It produces a structured JSON inventory of the repo — NOT an SEO sitemap.
 *
 * Usage:  node .agents/skills/codemap/codemap.mjs
 * Output: codemap-out/codemap.json
 *
 * To install in a new repo:
 *   1. Copy this folder (.agents/skills/codemap/) to the target repo
 *   2. Edit the CONFIG section below — everything else is generic engine code
 *   3. Run: node .agents/skills/codemap/codemap.mjs
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { runCodemap } from './lib/codemap-core.mjs';
import { runHookCommand } from './lib/hooks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Edit this section when installing in a new repo. Everything below is engine.

const FRAMEWORK = 'vite-react';

// Source root relative to repo root
const SRC_DIR = 'src';

// No file-based app router is used by this SPA.
const APP_DIR = 'app';

// Set to a source-relative path only when the app has a proxy auth gate.
const PROXY_FILE = null;

// Set to a repo-relative path only when the app has database migrations.
const MIGRATIONS_DIR = null;

// Root config files to include in inventory
const ROOT_CONFIG_FILES = [
  'package.json',
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.node.json',
  'vitest.config.ts',
  'playwright.config.ts',
  'eslint.config.js',
  'postcss.config.js',
  'vercel.json',
];

// Source directories to inventory — add/remove entries for each repo
const SOURCE_DIRS = [
  { name: 'components', description: 'Reusable wallet UI components and shared interaction flows' },
  { name: 'constants', description: 'Static application and feature configuration' },
  { name: 'contexts', description: 'React contexts for wallet and shared application state' },
  { name: 'data', description: 'Bundled application data and metadata' },
  { name: 'features', description: 'Feature-specific wallet workflows and UI modules' },
  { name: 'hooks', description: 'React hooks for SDK lifecycle and application behavior' },
  { name: 'pages', description: 'Screen-level views for wallet, onboarding, and settings flows' },
  { name: 'services', description: 'SDK integrations, persistence, and platform services' },
  { name: 'test', description: 'Shared test setup and fixtures' },
  { name: 'types', description: 'Shared TypeScript domain and SDK types' },
  { name: 'utils', description: 'Formatting, parsing, and other shared helpers' },
];

// ─── END CONFIG ──────────────────────────────────────────────────────────────

const OUT = join(ROOT, 'codemap-out', 'codemap.json');
const GITIGNORE_PATH = join(ROOT, '.gitignore');
const REQUIRED_GITIGNORE_ENTRIES = ['/codemap-out', '/codemap'];

const HOOK_PROFILES = {
  copilot: {
    id: 'copilot',
    fragmentsDirRel: '.github/hooks/post-commit.d',
    fragmentFile: 'codemap.sh',
    description: '.github/hooks/post-commit.d',
  },
  claude: {
    id: 'claude',
    fragmentsDirRel: '.claude/hooks/post-commit.d',
    fragmentFile: 'codemap.sh',
    description: '.claude/hooks/post-commit.d',
  },
  generic: {
    id: 'generic',
    fragmentsDirRel: '.agents/hooks/post-commit.d',
    fragmentFile: 'codemap.sh',
    description: '.agents/hooks/post-commit.d',
  },
};

const HOOK_SUBCOMMANDS = new Set(['install', 'uninstall', 'status', 'run-post-commit']);
const DEFAULT_HOOK_PROFILE = 'generic';
const DISPATCHER_MARKER = '# managed-by: codemap-dispatcher-v1';
const CODEMAP_FRAGMENT_MARKER = '# managed-by: codemap-fragment-v1';

function runCodemapMain() {
  runCodemap({
    root: ROOT,
    outPath: OUT,
    framework: FRAMEWORK,
    srcDir: SRC_DIR,
    appDir: APP_DIR,
    proxyFile: PROXY_FILE,
    migrationsDir: MIGRATIONS_DIR,
    rootConfigFiles: ROOT_CONFIG_FILES,
    sourceDirs: SOURCE_DIRS,
    gitignorePath: GITIGNORE_PATH,
    requiredGitignoreEntries: REQUIRED_GITIGNORE_ENTRIES,
  });
}

function runHooksMain(argv) {
  runHookCommand({
    argv,
    root: ROOT,
    srcDir: SRC_DIR,
    outPath: OUT,
    rootConfigFiles: ROOT_CONFIG_FILES,
    hookProfiles: HOOK_PROFILES,
    defaultHookProfile: DEFAULT_HOOK_PROFILE,
    hookSubcommands: HOOK_SUBCOMMANDS,
    dispatcherMarker: DISPATCHER_MARKER,
    fragmentMarker: CODEMAP_FRAGMENT_MARKER,
    runCodemap: runCodemapMain,
  });
}

const argv = process.argv.slice(2);
if (argv[0] === 'hook') {
  runHooksMain(argv);
} else {
  runCodemapMain();
}

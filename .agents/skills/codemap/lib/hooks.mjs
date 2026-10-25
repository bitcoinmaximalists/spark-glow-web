import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, chmodSync, existsSync, unlinkSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';

function toPosixPath(pathValue) {
  return pathValue.replace(/\\/g, '/');
}

function normalizeProjectSubpath(pathValue) {
  const normalized = toPosixPath(pathValue).replace(/^\.\//, '').replace(/^\/$/, '').replace(/\/$/, '');
  if (normalized === '.' || normalized === '') return '';
  return normalized;
}

function detectGitRepoRoot(root) {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString('utf8').trim();
  } catch {
    return null;
  }
}

function profileKeys(hookProfiles) {
  return Object.keys(hookProfiles);
}

function parseHookProfile(args, hookProfiles, defaultHookProfile) {
  const valid = new Set(profileKeys(hookProfiles));
  let profileArg = null;

  for (const arg of args) {
    if (valid.has(arg)) {
      profileArg = arg;
      continue;
    }
    if (arg.startsWith('--profile=')) {
      profileArg = arg.split('=')[1];
    }
  }

  if (!profileArg) return hookProfiles[defaultHookProfile];
  const selected = hookProfiles[profileArg];
  if (!selected) {
    throw new Error(`Unknown hook profile: ${profileArg}. Use ${profileKeys(hookProfiles).join(', ')}.`);
  }
  return selected;
}

function profileFragmentPath(root, profile) {
  return join(root, profile.fragmentsDirRel, profile.fragmentFile);
}

function isDispatcherManaged(content, marker) {
  return content.includes(marker);
}

function buildDispatcherScript(projectSubpath, hookProfiles, dispatcherMarker) {
  const relDirs = [...new Set(Object.values(hookProfiles).map((profile) => profile.fragmentsDirRel))];
  const dirList = relDirs.map((dir) => `"$PROJECT_ROOT/${dir}"`).join(' ');

  return `#!/bin/sh
${dispatcherMarker}

set -eu

REPO_ROOT=$(git rev-parse --show-toplevel)
PROJECT_ROOT="$REPO_ROOT${projectSubpath ? `/${projectSubpath}` : ''}"

for FRAG_DIR in ${dirList}; do
  [ -d "$FRAG_DIR" ] || continue
  for fragment in "$FRAG_DIR"/*; do
    [ -e "$fragment" ] || continue
    [ -x "$fragment" ] || continue
    echo "[codemap dispatcher] running $(basename "$fragment")"
    (
      cd "$PROJECT_ROOT"
      "$fragment"
    )
  done
done
`;
}

function buildCodemapFragment(projectSubpath, marker) {
  return `#!/bin/sh
${marker}

set -eu

REPO_ROOT=$(git rev-parse --show-toplevel)
PROJECT_ROOT="$REPO_ROOT${projectSubpath ? `/${projectSubpath}` : ''}"
cd "$PROJECT_ROOT"

node .agents/skills/codemap/codemap.mjs hook run-post-commit
`;
}

function listFragmentFiles(root, hookProfiles) {
  const dirs = [...new Set(Object.values(hookProfiles).map((profile) => join(root, profile.fragmentsDirRel)))];
  const files = [];

  for (const fragmentsDir of dirs) {
    if (!existsSync(fragmentsDir)) continue;
    let entries;
    try {
      entries = readdirSync(fragmentsDir);
    } catch {
      continue;
    }

    for (const name of entries) {
      const full = join(fragmentsDir, name);
      try {
        if (statSync(full).isFile()) files.push(full);
      } catch {
        // Skip invalid entries.
      }
    }
  }

  return files;
}

function removeProfileFragment(root, profile) {
  const fragmentPath = profileFragmentPath(root, profile);
  if (!existsSync(fragmentPath)) return false;
  unlinkSync(fragmentPath);
  return true;
}

function getChangedFiles(root) {
  const commands = ['git diff --name-only HEAD~1 HEAD', 'git diff --name-only HEAD'];

  for (const command of commands) {
    try {
      const raw = execSync(command, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
      const files = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (files.length > 0) return files;
    } catch {
      // Try fallback command.
    }
  }

  return [];
}

function toProjectRelativePath(filePath, projectSubpath) {
  const normalized = normalizeProjectSubpath(filePath);
  if (!projectSubpath) return normalized;
  if (normalized === projectSubpath) return '';

  const prefix = `${projectSubpath}/`;
  if (!normalized.startsWith(prefix)) return null;
  return normalized.slice(prefix.length);
}

function isRelevantChange(filePath, srcDir, rootConfigFiles, hookProfiles) {
  if (filePath.startsWith(`${srcDir}/`)) return true;
  if (filePath.startsWith('.agents/skills/codemap/')) return true;

  for (const profile of Object.values(hookProfiles)) {
    const prefix = `${profile.fragmentsDirRel}/`;
    if (filePath.startsWith(prefix)) return true;
  }

  return rootConfigFiles.includes(filePath);
}

export function runHookCommand(options) {
  const {
    argv,
    root,
    srcDir,
    outPath,
    rootConfigFiles,
    hookProfiles,
    defaultHookProfile,
    hookSubcommands,
    dispatcherMarker,
    fragmentMarker,
    runCodemap,
  } = options;

  const repoRoot = detectGitRepoRoot(root);
  if (!repoRoot) {
    throw new Error('Not inside a Git repository. Repo-local codemap hook install is required.');
  }

  const projectSubpath = normalizeProjectSubpath(relative(repoRoot, root));
  if (projectSubpath.startsWith('..')) {
    throw new Error(`Project root is outside the git repository. repo=${repoRoot} project=${root}`);
  }

  const gitHooksDir = join(repoRoot, '.git', 'hooks');
  const postCommitHook = join(gitHooksDir, 'post-commit');

  function printUsage() {
    const profiles = profileKeys(hookProfiles).join('|');
    console.log('codemap hook commands:');
    console.log(`  node .agents/skills/codemap/codemap.mjs hook install [${profiles}]`);
    console.log(`  node .agents/skills/codemap/codemap.mjs hook install   # defaults to ${defaultHookProfile}`);
    for (const key of profileKeys(hookProfiles)) {
      console.log(`  node .agents/skills/codemap/codemap.mjs hook install --profile=${key}`);
    }
    console.log(`  node .agents/skills/codemap/codemap.mjs hook uninstall [${profiles}]`);
    console.log('  node .agents/skills/codemap/codemap.mjs hook status');
    console.log('  node .agents/skills/codemap/codemap.mjs hook run-post-commit');
  }

  function installHook(profile) {
    mkdirSync(gitHooksDir, { recursive: true });
    mkdirSync(join(root, profile.fragmentsDirRel), { recursive: true });

    writeFileSync(postCommitHook, buildDispatcherScript(projectSubpath, hookProfiles, dispatcherMarker));
    chmodSync(postCommitHook, 0o755);

    const fragmentPath = profileFragmentPath(root, profile);
    writeFileSync(fragmentPath, buildCodemapFragment(projectSubpath, fragmentMarker));
    chmodSync(fragmentPath, 0o755);

    let removedOtherProfiles = 0;
    for (const otherProfile of Object.values(hookProfiles)) {
      if (otherProfile.id === profile.id) continue;
      if (removeProfileFragment(root, otherProfile)) removedOtherProfiles += 1;
    }

    console.log('[codemap hook] install: complete');
    console.log('[codemap hook] scope: repo-local only');
    console.log(`[codemap hook] profile: ${profile.id}`);
    console.log(`[codemap hook] removed other profile fragments: ${removedOtherProfiles}`);
    console.log(`[codemap hook] dispatcher: ${toPosixPath(relative(repoRoot, postCommitHook))}`);
    console.log(`[codemap hook] fragment: ${toPosixPath(relative(root, fragmentPath))}`);
  }

  function uninstallHook(profile) {
    const removed = removeProfileFragment(root, profile);

    if (existsSync(postCommitHook)) {
      const existing = readFileSync(postCommitHook, 'utf8');
      if (isDispatcherManaged(existing, dispatcherMarker) && listFragmentFiles(root, hookProfiles).length === 0) {
        unlinkSync(postCommitHook);
      }
    }

    console.log('[codemap hook] uninstall: complete');
    console.log(`[codemap hook] profile: ${profile.id}`);
    console.log(`[codemap hook] fragment removed: ${removed ? 'yes' : 'no'}`);
  }

  function status() {
    const hookExists = existsSync(postCommitHook);
    let dispatcherManaged = false;
    if (hookExists) {
      dispatcherManaged = isDispatcherManaged(readFileSync(postCommitHook, 'utf8'), dispatcherMarker);
    }

    console.log('[codemap hook] status command accepted.');
    console.log('[codemap hook] installation scope: repo-local');
    console.log(`[codemap hook] git root: ${toPosixPath(repoRoot)}`);
    console.log(`[codemap hook] project subpath: ${projectSubpath || '(root)'}`);
    console.log(`[codemap hook] hook path: ${toPosixPath(relative(repoRoot, postCommitHook))}`);
    console.log(`[codemap hook] dispatcher managed: ${dispatcherManaged ? 'yes' : 'no'}`);

    for (const profile of Object.values(hookProfiles)) {
      const installed = existsSync(profileFragmentPath(root, profile));
      console.log(`[codemap hook] ${profile.id} fragment: ${installed ? 'installed' : 'missing'} (${profile.fragmentFile})`);
    }
  }

  function runPostCommit() {
    const changedFiles = getChangedFiles(root);
    if (changedFiles.length === 0) {
      console.log('[codemap hook] no changed files detected; fast exit.');
      return;
    }

    const projectChanged = changedFiles
      .map((filePath) => toProjectRelativePath(filePath, projectSubpath))
      .filter((filePath) => typeof filePath === 'string' && filePath.length > 0);

    if (projectChanged.length === 0) {
      console.log(`[codemap hook] ${changedFiles.length} changed file(s); none in project scope. fast exit.`);
      return;
    }

    const relevant = projectChanged.filter((filePath) => isRelevantChange(filePath, srcDir, rootConfigFiles, hookProfiles));
    if (relevant.length === 0) {
      console.log(`[codemap hook] ${projectChanged.length} project file(s); none affect codemap scope. fast exit.`);
      return;
    }

    console.log(`[codemap hook] ${relevant.length} relevant changed file(s) detected; refreshing codemap.`);
    try {
      runCodemap();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[codemap hook] refresh failed');
      console.error('[codemap hook] command: node .agents/skills/codemap/codemap.mjs hook run-post-commit');
      console.error(`[codemap hook] output file: ${toPosixPath(relative(root, outPath))}`);
      console.error(`[codemap hook] error: ${message}`);
      process.exit(1);
    }
  }

  const subcommand = argv[1];
  if (!hookSubcommands.has(subcommand)) {
    printUsage();
    process.exit(2);
  }

  if (subcommand === 'status') {
    status();
    return;
  }
  if (subcommand === 'run-post-commit') {
    runPostCommit();
    return;
  }

  const profile = parseHookProfile(argv.slice(2), hookProfiles, defaultHookProfile);
  if (subcommand === 'install') {
    installHook(profile);
    return;
  }

  uninstallHook(profile);
}

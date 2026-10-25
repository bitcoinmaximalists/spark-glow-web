import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';

/** Recursively collect all files matching a predicate */
function walk(dir, predicate = () => true, results = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.DS_Store')) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, predicate, results);
    } else if (predicate(entry, full)) {
      results.push(full);
    }
  }
  return results;
}

function buildRel(root) {
  return function rel(abs) {
    return relative(root, abs).replace(/\\/g, '/');
  };
}

/** Extract named exports from a source file using regex (best-effort) */
function extractExports(filePath) {
  let src;
  try {
    src = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const exports = new Set();

  for (const m of src.matchAll(/export\s+default\s+(?:async\s+)?(?:function|class)\s+(\w+)/g)) {
    exports.add(m[1]);
  }
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|class)\s+(\w+)/g)) {
    exports.add(m[1]);
  }
  for (const m of src.matchAll(/export\s+const\s+(\w+)\s*=/g)) {
    exports.add(m[1]);
  }
  for (const m of src.matchAll(/export\s+(?:type|interface)\s+(\w+)/g)) {
    exports.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const name of m[1].split(',')) {
      const trimmed = name.trim().split(/\s+as\s+/).pop().trim();
      if (trimmed) exports.add(trimmed);
    }
  }

  return [...exports];
}

/** Extract HTTP method exports from an API route file */
function extractHttpMethods(filePath) {
  let src;
  try {
    src = readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const methods = [];
  for (const m of src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) {
    methods.push(m[1]);
  }
  return methods;
}

function ensureCodemapGitignoreEntries(gitignorePath, requiredEntries) {
  if (!gitignorePath || !requiredEntries || requiredEntries.length === 0) return;

  let current = '';
  if (existsSync(gitignorePath)) {
    current = readFileSync(gitignorePath, 'utf8');
  }

  const lines = current.split(/\r?\n/);
  const lineSet = new Set(lines.map((line) => line.trim()));
  const missing = requiredEntries.filter((entry) => !lineSet.has(entry));
  if (missing.length === 0) return;

  const chunks = [];
  if (current.length > 0 && !current.endsWith('\n')) chunks.push('\n');
  chunks.push('\n# codemap generated output\n');
  chunks.push(missing.join('\n'));
  chunks.push('\n');

  writeFileSync(gitignorePath, current + chunks.join(''));
  console.log(`[codemap] updated .gitignore with: ${missing.join(', ')}`);
}

export function runCodemap(options) {
  const {
    root,
    outPath,
    framework,
    srcDir,
    appDir,
    proxyFile,
    migrationsDir,
    rootConfigFiles,
    sourceDirs,
    gitignorePath,
    requiredGitignoreEntries,
  } = options;

  ensureCodemapGitignoreEntries(gitignorePath, requiredGitignoreEntries);

  const SRC = join(root, srcDir);
  const rel = buildRel(root);

  function toRoute(absPath, stripFile = 'page.tsx') {
    const appRoot = join(SRC, appDir);
    let r = relative(appRoot, absPath).replace(/\\/g, '/');
    r = r.replace(new RegExp(`/${stripFile}$`), '').replace(new RegExp(`^${stripFile}$`), '');
    r = r.replace(/\/\([^)]+\)/g, '').replace(/^\([^)]+\)\//g, '').replace(/^\([^)]+\)$/, '');
    r = r.replace(/\/+/g, '/').replace(/^\/+|\/+$/g, '');
    return '/' + r;
  }

  function buildPages() {
    const pageFiles = walk(join(SRC, appDir), (name) => name === 'page.tsx');
    return pageFiles
      .map((abs) => {
        const route = toRoute(abs);
        const src = readFileSync(abs, 'utf8');
        const authProtected =
          src.includes('server/auth') ||
          src.includes('getUser') ||
          src.includes('requireAuth') ||
          (src.includes('redirect') && src.includes('not-authorized'));
        return { route, file: rel(abs), authProtected };
      })
      .sort((a, b) => a.route.localeCompare(b.route));
  }

  function buildApiRoutes() {
    const routeFiles = walk(join(SRC, appDir, 'api'), (name) => name === 'route.ts');
    return routeFiles
      .map((abs) => {
        const route = toRoute(abs, 'route.ts');
        const methods = extractHttpMethods(abs);
        return { path: route, file: rel(abs), methods };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  function buildSourceDir(dirName, description) {
    const dir = join(SRC, dirName);
    const files = walk(dir, (name) => /\.(tsx?|mjs|js)$/.test(name));
    return {
      description,
      files: files.map((abs) => ({ file: rel(abs), exports: extractExports(abs) })),
    };
  }

  function buildAppSpecial() {
    const appRoot = join(SRC, appDir);
    const special = ['layout.tsx', 'providers.tsx', 'loading.tsx', 'not-found.tsx', 'global-error.tsx'];
    return special
      .map((name) => {
        const abs = join(appRoot, name);
        try {
          statSync(abs);
          return { file: rel(abs), exports: extractExports(abs) };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  function buildProxy() {
    if (!proxyFile) return null;
    const abs = join(SRC, proxyFile);
    try {
      statSync(abs);
      const src = readFileSync(abs, 'utf8');
      const protectedMatch = src.match(/const protectedRoutes\s*=\s*\[([^\]]+)\]/);
      const staticMatch = src.match(/const staticRoutesPrivate\s*=\s*\[([^\]]+)\]/);
      const parseRouteList = (m) =>
        m ? m[1].match(/["']([^"']+)["']/g)?.map((s) => s.replace(/["']/g, '')) ?? [] : [];
      return {
        file: rel(abs),
        description:
          'Edge proxy (Next.js 16 convention replaces middleware.ts). Auth gateway: verifies JWT cookies and enforces route protection before requests reach handlers.',
        exports: extractExports(abs),
        protectedRoutes: parseRouteList(protectedMatch),
        staticRoutesPrivate: parseRouteList(staticMatch),
      };
    } catch {
      return null;
    }
  }

  function buildMigrations() {
    if (!migrationsDir) return null;
    const migrationsRoot = join(root, migrationsDir);
    const sqlFiles = walk(migrationsRoot, (name) => name.endsWith('.sql'));
    const metaFiles = walk(migrationsRoot, (name) => name.endsWith('.json'));
    return {
      description: `Drizzle Kit generated migration files. Located at root ${migrationsDir}/ (not src/drizzle/). Apply with: drizzle-kit push --force`,
      sql: sqlFiles.map((abs) => ({ file: rel(abs) })),
      meta: metaFiles.map((abs) => ({ file: rel(abs) })),
    };
  }

  function buildRootConfig() {
    return rootConfigFiles
      .map((name) => {
        const abs = join(root, name);
        try {
          statSync(abs);
          const exports = name.endsWith('.json') ? [] : extractExports(abs);
          return { file: rel(abs), exports };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  const dirs = {};
  for (const { name, description } of sourceDirs) {
    dirs[name] = buildSourceDir(name, description);
  }

  const codemap = {
    _note: 'Agent-readable project inventory. Run: node .agents/skills/codemap/codemap.mjs',
    generated: new Date().toISOString(),
    framework,
    pages: buildPages(),
    apiRoutes: buildApiRoutes(),
    appSpecialFiles: buildAppSpecial(),
    proxy: buildProxy(),
    migrations: buildMigrations(),
    rootConfig: buildRootConfig(),
    dirs,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(codemap, null, 2));

  const outRel = relative(root, outPath).replace(/\\/g, '/');
  console.log(`codemap written to ${outRel}`);
  console.log(`  ${codemap.pages.length} pages`);
  console.log(`  ${codemap.apiRoutes.length} API routes`);
  console.log(`  ${codemap.dirs.library?.files.length ?? 0} library components`);
  console.log(`  ${codemap.migrations?.sql.length ?? 0} migration SQL file(s)`);
  console.log(`  ${codemap.dirs.client?.files.length ?? 0} client API file(s)`);
  console.log(`  ${Object.keys(codemap.dirs).length} source directories indexed`);
}

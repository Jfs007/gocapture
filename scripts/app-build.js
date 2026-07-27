#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');
const { syncExtensionBrand } = require('./product-brand');

const rootDir = path.resolve(__dirname, '..');
const packageAppDir = path.join(rootDir, 'package', 'app');
const configPath = path.join(packageAppDir, 'config.json');
const devClientUrl = '__dev__/reload.js';

function usage() {
  console.log(`
Usage:
  node scripts/app-build.js --project <dir> --name <app-name> [options]

Options:
  --project <dir>       Vite project directory. Defaults to ./vue.
  --name <app-name>     Output app name under package/app. Defaults to the project directory name.
  --entry <file>        Entry file relative to the project directory. Defaults to src/main.ts or src/main.js.
  --mode <mode>         Vite mode. Defaults to development in watch mode, production otherwise.
  --target <target>     esbuild target. Defaults to es2015.
  --matches <patterns>  Comma-separated URL match rules. Defaults to <all_urls>.
  --iframe              Allow injection into matched iframes.
  --watch, -w           Rebuild on source changes and enable the dev reload client.
  --sourcemap           Emit sourcemaps.
  --minify              Force minify.
  --no-minify           Disable minify.
  --poll <ms>           Dev reload polling interval. Defaults to 1000.
  --config <file>       Explicit Vite config file.
  --dry-run             Build and print output files without writing package/app or config.json.
  --help, -h            Show this help.
`);
}

function parseArgs(argv) {
  const opts = {};
  const readValue = (key, index) => {
    const value = argv[index + 1];
    if (!value || value.startsWith('-')) {
      throw new Error(`Missing value for --${key}`);
    }
    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--watch' || arg === '-w') {
      opts.watch = true;
      continue;
    }
    if (arg === '--iframe') {
      opts.iframe = true;
      continue;
    }
    if (arg === '--sourcemap') {
      opts.sourcemap = true;
      continue;
    }
    if (arg === '--minify') {
      opts.minify = true;
      continue;
    }
    if (arg === '--no-minify') {
      opts.minify = false;
      continue;
    }
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const eqIndex = arg.indexOf('=');
    const key = arg.slice(2, eqIndex === -1 ? undefined : eqIndex);
    const inlineValue = eqIndex === -1 ? undefined : arg.slice(eqIndex + 1);
    const value = inlineValue === undefined ? readValue(key, i) : inlineValue;
    if (inlineValue === undefined) i++;

    if (![
      'project',
      'name',
      'entry',
      'mode',
      'target',
      'matches',
      'poll',
      'config',
    ].includes(key)) {
      throw new Error(`Unknown option: --${key}`);
    }
    opts[key] = value;
  }

  return opts;
}

function resolveFromRoot(value) {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function defaultProjectDir() {
  return path.join(rootDir, 'vue');
}

function normalizeAppName(name) {
  const normalized = String(name || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (!normalized) {
    throw new Error('App name cannot be empty.');
  }
  if (normalized.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error(`Invalid app name: ${name}`);
  }
  return normalized;
}

function posixJoin(...parts) {
  return parts
    .join('/')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '');
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function findNearestBuildConfig(projectDir, entryPath) {
  const root = path.resolve(projectDir);
  let current = path.dirname(entryPath);
  while (current && current.startsWith(root)) {
    const candidate = path.join(current, 'app-build.config.json');
    if (fs.existsSync(candidate)) return candidate;
    if (current === root) break;
    current = path.dirname(current);
  }
  return '';
}

function loadBuildRuleConfig(projectDir, entryPath) {
  const filePath = findNearestBuildConfig(projectDir, entryPath);
  if (!filePath) return null;

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const next = {};
  if (Array.isArray(raw.matches)) {
    next.matches = raw.matches.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (typeof raw.supportIframe === 'boolean') {
    next.supportIframe = raw.supportIframe;
  }
  if (typeof raw.inject === 'boolean') {
    next.inject = raw.inject;
  }
  if (Array.isArray(raw.injectJsUrls)) {
    next.injectJsUrls = raw.injectJsUrls.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (Array.isArray(raw.injectCssUrls)) {
    next.injectCssUrls = raw.injectCssUrls.map(item => String(item || '').trim()).filter(Boolean);
  }
  next.filePath = filePath;
  return next;
}

function findEntry(projectDir, entry) {
  if (entry) {
    const entryPath = path.isAbsolute(entry) ? entry : path.join(projectDir, entry);
    if (!fs.existsSync(entryPath)) {
      throw new Error(`Entry file not found: ${entryPath}`);
    }
    return entryPath;
  }

  const candidates = [
    'src/main.ts',
    'src/main.js',
    'src/index.ts',
    'src/index.js',
  ];
  const found = candidates
    .map(candidate => path.join(projectDir, candidate))
    .find(candidate => fs.existsSync(candidate));

  if (!found) {
    throw new Error(`Cannot find an entry file in ${projectDir}. Pass --entry explicitly.`);
  }
  return found;
}

function makeGlobalName(appName) {
  const safe = appName.replace(/[^a-zA-Z0-9_$]/g, '_');
  return `GoCaptureApp_${/^[0-9]/.test(safe) ? '_' : ''}${safe}`;
}

function getRequire(projectDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  return createRequire(fs.existsSync(pkgPath) ? pkgPath : path.join(projectDir, 'noop.js'));
}

async function loadVite(projectDir) {
  const projectRequire = getRequire(projectDir);
  let viteEntry;
  try {
    const vitePkg = projectRequire.resolve('vite/package.json');
    viteEntry = path.join(path.dirname(vitePkg), 'dist', 'node', 'index.js');
  } catch (_) {
    const vitePkg = require.resolve('vite/package.json');
    viteEntry = path.join(path.dirname(vitePkg), 'dist', 'node', 'index.js');
  }

  const viteModule = await import(pathToFileURL(viteEntry).href);
  return viteModule.default && viteModule.default.build ? viteModule.default : viteModule;
}

function flattenPlugins(plugins, result = []) {
  if (!plugins) return result;
  const list = Array.isArray(plugins) ? plugins : [plugins];
  for (const item of list) {
    if (!item) continue;
    if (Array.isArray(item)) {
      flattenPlugins(item, result);
      continue;
    }
    result.push(item);
  }
  return result;
}

function hasVuePlugin(config) {
  return flattenPlugins(config.plugins).some(plugin => plugin && plugin.name === 'vite:vue');
}

async function loadVuePlugin(projectDir, config) {
  if (hasVuePlugin(config)) return [];

  const projectRequire = getRequire(projectDir);
  let pluginEntry;
  try {
    pluginEntry = projectRequire.resolve('@vitejs/plugin-vue');
  } catch (_) {
    try {
      pluginEntry = require.resolve('@vitejs/plugin-vue');
    } catch (error) {
      return [];
    }
  }

  const esmEntry = pluginEntry.endsWith('index.cjs')
    ? pluginEntry.replace(/index\.cjs$/, 'index.mjs')
    : pluginEntry;
  const pluginModule = await import(pathToFileURL(fs.existsSync(esmEntry) ? esmEntry : pluginEntry).href);
  const pluginFactory = pluginModule.default || pluginModule;
  const createPlugin = pluginFactory.default || pluginFactory;
  return [createPlugin()];
}

function cloneConfig(config) {
  return {
    ...config,
    build: {
      ...(config.build || {}),
    },
  };
}

function sanitizeBuildConfig(config) {
  const next = cloneConfig(config);
  if (!next.build) next.build = {};
  delete next.build.lib;
  delete next.build.outDir;
  delete next.build.rollupOptions;
  delete next.build.emptyOutDir;
  delete next.build.manifest;
  delete next.build.ssrManifest;
  delete next.build.watch;
  return next;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        result.push(fullPath);
      }
    }
  }
  return result.sort();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readFileMaybe(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function copyIfChanged(from, to) {
  const source = fs.readFileSync(from);
  const target = readFileMaybe(to);
  if (target && Buffer.compare(source, target) === 0) {
    return false;
  }
  ensureDir(path.dirname(to));
  fs.writeFileSync(to, source);
  return true;
}

function loadAppConfig() {
  if (!fs.existsSync(configPath)) {
    return {
      result: {
        cssUrls: [],
        jsUrls: [],
      },
      rules: {},
      canInjectIframeList: [],
      version: makeVersion(),
      success: true,
      api: '',
    };
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function maskVersion(config) {
  return {
    ...config,
    version: '__VERSION__',
  };
}

function makeVersion() {
  const d = new Date();
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '.',
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
    '.',
    pad(d.getMilliseconds(), 3),
  ].join('');
}

function dedupe(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function updateConfig({
  appName,
  jsUrls,
  cssUrls,
  injectJsUrls,
  injectCssUrls,
  matches,
  supportIframe,
  includeDevClient,
  inject,
  poll,
  outputChanged,
  dryRun,
}) {
  const config = loadAppConfig();
  const before = JSON.stringify(maskVersion(config));

  config.result = config.result && typeof config.result === 'object' ? config.result : {};
  config.result.cssUrls = Array.isArray(config.result.cssUrls) ? config.result.cssUrls : [];
  config.result.jsUrls = Array.isArray(config.result.jsUrls) ? config.result.jsUrls : [];
  config.rules = config.rules && typeof config.rules === 'object' ? config.rules : {};
  config.canInjectIframeList = Array.isArray(config.canInjectIframeList) ? config.canInjectIframeList : [];
  if (typeof config.success === 'undefined') config.success = true;
  if (typeof config.api === 'undefined') config.api = '';

  const isManagedUrl = url => {
    return typeof url === 'string' && (url === devClientUrl || url.startsWith(`${appName}/`));
  };

  const managedJs = jsUrls.map(file => posixJoin(appName, file));
  const managedCss = cssUrls.map(file => posixJoin(appName, file));
  const extraManagedJs = (injectJsUrls || []).map(file => posixJoin(appName, file));
  const extraManagedCss = (injectCssUrls || []).map(file => posixJoin(appName, file));
  const nextJs = config.result.jsUrls.filter(url => !isManagedUrl(url));
  const nextCss = config.result.cssUrls.filter(url => !isManagedUrl(url));

  const shouldInject = inject !== false;

  config.result.jsUrls = dedupe(shouldInject
    ? [
        ...nextJs,
        ...(includeDevClient ? [devClientUrl] : []),
        ...managedJs,
        ...extraManagedJs,
      ]
    : [
        ...nextJs,
        ...extraManagedJs,
      ]);
  config.result.cssUrls = dedupe(shouldInject
    ? [
        ...nextCss,
        ...managedCss,
        ...extraManagedCss,
      ]
    : [
        ...nextCss,
        ...extraManagedCss,
      ]);

  for (const key of Object.keys(config.rules)) {
    if (isManagedUrl(key)) delete config.rules[key];
  }

  const rule = { matches, supportIframe };
  if (shouldInject) {
    for (const url of [...managedJs, ...managedCss]) {
      config.rules[url] = rule;
    }
  }
  for (const url of [...extraManagedJs, ...extraManagedCss]) {
    config.rules[url] = rule;
  }
  if (includeDevClient && shouldInject) {
    config.rules[devClientUrl] = rule;
    config.dev = {
      ...(config.dev || {}),
      reload: {
        poll,
      },
    };
  } else if (config.dev && config.dev.reload) {
    const nextDev = { ...config.dev };
    delete nextDev.reload;
    if (Object.keys(nextDev).length) config.dev = nextDev;
    else delete config.dev;
  }

  const configChanged = before !== JSON.stringify(maskVersion(config));
  if (outputChanged || configChanged || !config.version) {
    config.version = makeVersion();
  }

  const text = `${JSON.stringify(config, null, 4)}\n`;
  if (dryRun) {
    console.log('[app-build] dry-run config result:', JSON.stringify(config.result, null, 2));
    return { changed: outputChanged || configChanged };
  }

  const previousText = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  if (previousText !== text) {
    fs.writeFileSync(configPath, text);
    return { changed: true };
  }
  return { changed: outputChanged || configChanged };
}

function scanOutput(outDir) {
  const files = listFiles(outDir);
  const relFiles = files.map(file => posixJoin(path.relative(outDir, file)));
  const jsFiles = relFiles.filter(file => file.endsWith('.js'));
  const cssFiles = relFiles.filter(file => file.endsWith('.css'));
  const otherFiles = relFiles.filter(file => !file.endsWith('.js') && !file.endsWith('.css') && !file.endsWith('.map'));

  if (!jsFiles.includes('index.js')) {
    throw new Error(`Expected Vite to emit index.js, got: ${relFiles.join(', ')}`);
  }

  return { relFiles, jsFiles, cssFiles, otherFiles };
}

function assertNoModuleSyntax(indexFile) {
  const code = fs.readFileSync(indexFile, 'utf8');
  const hasModuleSyntax = /(^|\n)\s*(import|export)\s+/.test(code);
  if (hasModuleSyntax) {
    throw new Error('Output still contains top-level import/export syntax. The app bundle must be non-module JavaScript.');
  }
}

function syncOutput(outDir, targetDir, dryRun) {
  const output = scanOutput(outDir);
  assertNoModuleSyntax(path.join(outDir, 'index.js'));

  let changed = false;
  for (const relFile of output.relFiles) {
    const source = path.join(outDir, relFile);
    const target = path.join(targetDir, relFile);
    if (dryRun) continue;
    changed = copyIfChanged(source, target) || changed;
  }

  if (output.otherFiles.length) {
    console.warn(`[app-build] Non JS/CSS assets emitted: ${output.otherFiles.join(', ')}`);
    console.warn('[app-build] Prefer inlined assets because injected CSS runs in the target page context.');
  }

  return { ...output, changed };
}

function createSyncPlugin(context) {
  return {
    name: 'gocapture-app-sync',
    apply: 'build',
    closeBundle() {
      const output = syncOutput(context.outDir, context.targetDir, context.dryRun);
      const configResult = updateConfig({
        appName: context.appName,
        jsUrls: output.jsFiles,
        cssUrls: output.cssFiles,
        injectJsUrls: context.injectJsUrls,
        injectCssUrls: context.injectCssUrls,
        matches: context.matches,
        supportIframe: context.supportIframe,
        includeDevClient: context.watch,
        inject: context.inject,
        poll: context.poll,
        outputChanged: output.changed || !!context.injectJsUrls?.length || !!context.injectCssUrls?.length,
        dryRun: context.dryRun,
      });

      const destination = context.dryRun
        ? path.relative(rootDir, context.outDir)
        : path.relative(rootDir, context.targetDir);
      console.log(`[app-build] ${context.appName} -> ${destination}`);
      console.log(`[app-build] js: ${output.jsFiles.join(', ') || '-'}`);
      console.log(`[app-build] css: ${output.cssFiles.join(', ') || '-'}`);
      if (configResult.changed) {
        console.log(`[app-build] config version: ${loadAppConfig().version}`);
      }
    },
  };
}

async function loadUserConfig(vite, projectDir, mode, configFile) {
  const explicitConfig = configFile ? resolveFromRoot(configFile) : undefined;
  const result = await vite.loadConfigFromFile(
    { command: 'build', mode, isSsrBuild: false, isPreview: false },
    explicitConfig,
    projectDir
  );
  return result ? result.config : {};
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    usage();
    return;
  }

  const projectDir = resolveFromRoot(opts.project) || defaultProjectDir();
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Project directory not found: ${projectDir}`);
  }

  const appName = normalizeAppName(opts.name || path.basename(projectDir));
  const entry = findEntry(projectDir, opts.entry);
  const watch = !!opts.watch;
  const mode = opts.mode || (watch ? 'development' : 'production');
  const target = opts.target || 'es2015';
  const poll = Math.max(300, Number(opts.poll || 1000));
  const buildRuleConfig = loadBuildRuleConfig(projectDir, entry);
  const matches = buildRuleConfig?.matches?.length ? buildRuleConfig.matches : splitList(opts.matches || '<all_urls>');
  const supportIframe = typeof buildRuleConfig?.supportIframe === 'boolean'
    ? buildRuleConfig.supportIframe
    : !!opts.iframe;
  const inject = buildRuleConfig?.inject !== false;
  const injectJsUrls = buildRuleConfig?.injectJsUrls || [];
  const injectCssUrls = buildRuleConfig?.injectCssUrls || [];
  const minify = typeof opts.minify === 'boolean' ? opts.minify : !watch;
  const dryRun = !!opts.dryRun;
  const nodeEnv = mode === 'production' ? 'production' : 'development';
  const productBrand = syncExtensionBrand(path.join(rootDir, 'package'));
  const outDir = path.join(os.tmpdir(), `${productBrand.id}-app-build-${process.pid}-${appName.replace(/\//g, '-')}`);
  const targetDir = path.join(packageAppDir, ...appName.split('/'));

  const vite = await loadVite(projectDir);
  const userConfig = sanitizeBuildConfig(await loadUserConfig(vite, projectDir, mode, opts.config));
  const plugins = [
    ...(await loadVuePlugin(projectDir, userConfig)),
    createSyncPlugin({
      appName,
      outDir,
      targetDir,
      dryRun,
      matches,
      supportIframe,
      watch,
      inject,
      injectJsUrls,
      injectCssUrls,
      poll,
    }),
  ];

  const appConfig = {
    configFile: false,
    root: projectDir,
    base: '',
    publicDir: false,
    appType: 'custom',
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
      __GOCAPTURE_BUILD_VERSION__: JSON.stringify(makeVersion()),
      __PRODUCT_DISPLAY_NAME__: JSON.stringify(productBrand.displayName),
      __PRODUCT_CLI_COMMAND__: JSON.stringify(productBrand.cliCommand),
    },
    plugins,
    build: {
      outDir,
      emptyOutDir: true,
      target,
      sourcemap: !!opts.sourcemap,
      minify: minify ? 'terser' : false,
      cssCodeSplit: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      lib: {
        entry,
        name: makeGlobalName(appName),
        formats: ['iife'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          entryFileNames: 'index.js',
          chunkFileNames: 'index.js',
          assetFileNames: assetInfo => {
            return assetInfo.name && assetInfo.name.endsWith('.css') ? 'style.css' : 'assets/[name][extname]';
          },
        },
      },
      watch: watch ? { clearScreen: false } : null,
    },
  };

  const merged = vite.mergeConfig(userConfig, appConfig);
  console.log(`[app-build] project: ${path.relative(rootDir, projectDir) || '.'}`);
  console.log(`[app-build] entry: ${path.relative(projectDir, entry)}`);
  console.log(`[app-build] app: package/app/${appName}/index.js`);
  if (buildRuleConfig?.filePath) {
    console.log(`[app-build] rule config: ${path.relative(rootDir, buildRuleConfig.filePath)}`);
  }
  if (watch) {
    console.log('[app-build] watch mode enabled. Keep this process running for dev reload.');
  }

  const result = await vite.build(merged);
  if (watch && result && typeof result.on === 'function') {
    process.on('SIGINT', () => {
      result.close();
      process.exit(0);
    });
  }
}

main().catch(error => {
  console.error(`[app-build] ${error.stack || error.message || error}`);
  process.exit(1);
});

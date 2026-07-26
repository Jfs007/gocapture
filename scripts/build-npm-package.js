#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { applyExtensionEnv, bumpPatchVersion } = require('./extension-env');
const { loadProductBrand, syncExtensionBrand } = require('./product-brand');

const rootDir = path.resolve(__dirname, '..');
const rootPackage = require(path.join(rootDir, 'package.json'));
const productBrand = loadProductBrand();
const defaultOutDir = path.join(rootDir, 'application');

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : '';
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const outDir = path.resolve(argValue('--out') || defaultOutDir);
const packageName = argValue('--name') || process.env.MAGNUS_PACKAGE_NAME || rootPackage.name || '@sep-agent/magnus';
const skipAppBuild = hasFlag('--skip-app-build');
const skipVersionBump = hasFlag('--skip-version-bump');
const sourceServerUrl = normalizeSourceServerUrl(
  argValue('--source-server-url') ||
  process.env.MAGNUS_EXTENSION_SOURCE_URL ||
  process.env.MAGNUS_SOURCE_SERVER_URL ||
  'http://127.0.0.1:17321'
);

const SKIP_DIRS = new Set([
  '.git',
  '.DS_Store',
  '__dev__',
  'node_modules',
]);

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function mkdirp(target) {
  fs.mkdirSync(target, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeSourceServerUrl(value) {
  const text = String(value || '').trim() || 'http://127.0.0.1:17321';
  return text.endsWith('/') ? text : `${text}/`;
}

function sourceServerOrigin(value) {
  return String(value || '').replace(/\/+$/, '');
}

function shouldSkipFile(filePath) {
  const basename = path.basename(filePath);
  if (basename === '.DS_Store') return true;
  if (/\.test\.[cm]?js$/i.test(basename)) return true;
  if (/\.log$/i.test(basename)) return true;
  return false;
}

function copyRecursive(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    if (SKIP_DIRS.has(path.basename(source))) return;
    mkdirp(target);
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }
  if (!stat.isFile() || shouldSkipFile(source)) return;
  mkdirp(path.dirname(target));
  fs.copyFileSync(source, target);
  fs.chmodSync(target, stat.mode);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function updatePackageLockVersion(nextVersion) {
  const lockPath = path.join(rootDir, 'package-lock.json');
  if (!fs.existsSync(lockPath)) return;
  const lock = readJson(lockPath);
  lock.version = nextVersion;
  if (lock.packages?.['']) {
    lock.packages[''].version = nextVersion;
  }
  writeJson(lockPath, lock);
}

function resolveReleaseVersion() {
  const explicitVersion = argValue('--version');
  if (explicitVersion) {
    rootPackage.version = explicitVersion;
  } else if (!skipVersionBump) {
    rootPackage.version = bumpPatchVersion(rootPackage.version || '0.0.0');
  }

  writeJson(path.join(rootDir, 'package.json'), rootPackage);
  updatePackageLockVersion(rootPackage.version);
  return rootPackage.version;
}

function assertRequiredFiles() {
  const required = [
    'bin/magnus.js',
    'scripts/source-server.js',
    'src/server/server.js',
    'package/manifest.json',
    'package/sidepanel.html',
    'package/app/magnus/index.js',
  ];
  for (const rel of required) {
    const filePath = path.join(rootDir, rel);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required release file: ${rel}`);
    }
  }
}

function releasePackageJson(packageVersion) {
  return {
    name: packageName,
    version: packageVersion,
    description: `${productBrand.displayName} local source server, side panel UI, and Chrome extension shell.`,
    bin: {
      magnus: 'bin/magnus.js',
    },
    engines: {
      node: '>=20.18.1',
    },
    dependencies: { ...rootPackage.dependencies },
    keywords: [
      'magnus',
      'chrome-extension',
      'source-code',
      'local-agent',
    ],
    license: rootPackage.license || 'MIT',
  };
}

function releaseReadme() {
  return `# ${productBrand.displayName}

${productBrand.displayName} 本地服务发布包，包含：

- \`magnus\` CLI
- 本地 \`source-server\`
- Side Panel UI 静态资源
- Chrome 插件目录

## 安装

\`\`\`bash
npm install -g ${packageName}
magnus install
\`\`\`

## 安装 Chrome 插件

\`\`\`bash
magnus chrome
\`\`\`

该命令会打开随 npm 包携带的 Chrome 插件目录。随后在 Chrome 打开 \`chrome://extensions\`，开启开发者模式，选择“加载已解压的扩展程序”，选择命令输出的目录。
`;
}

function configureReleaseChromePackage(packageDir) {
  syncExtensionBrand(packageDir);
  applyExtensionEnv({
    packageDir,
    env: 'local',
    appModule: 'Online',
    envOverrides: {
      source: sourceServerUrl,
    },
  });

  const serviceWorkerPath = path.join(packageDir, 'js', 'service-worker.js');
  const serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');
  const nextServiceWorker = serviceWorker.replace(
    /const MAGNUS_SOURCE_SERVER_URL = ['"][^'"]+['"];/,
    `const MAGNUS_SOURCE_SERVER_URL = ${JSON.stringify(sourceServerOrigin(sourceServerUrl))};`
  );
  if (nextServiceWorker === serviceWorker) {
    throw new Error('Unable to patch MAGNUS_SOURCE_SERVER_URL in package/js/service-worker.js');
  }
  fs.writeFileSync(serviceWorkerPath, nextServiceWorker, 'utf8');
}

function main() {
  const packageVersion = resolveReleaseVersion();

  if (!skipAppBuild) {
    run(process.execPath, [
      path.join(rootDir, 'scripts', 'app-build.js'),
      '--project',
      'vue',
      '--name',
      'magnus',
      '--entry',
      'src/sites/magnus/main.ts',
      '--no-minify',
    ]);
  }
  assertRequiredFiles();

  rmrf(outDir);
  mkdirp(outDir);

  copyRecursive(path.join(rootDir, 'bin'), path.join(outDir, 'bin'));
  copyRecursive(path.join(rootDir, 'scripts', 'source-server.js'), path.join(outDir, 'scripts', 'source-server.js'));
  copyRecursive(path.join(rootDir, 'src', 'server'), path.join(outDir, 'src', 'server'));
  copyRecursive(path.join(rootDir, 'config'), path.join(outDir, 'config'));
  copyRecursive(path.join(rootDir, 'package'), path.join(outDir, 'package'));
  configureReleaseChromePackage(path.join(outDir, 'package'));

  writeJson(path.join(outDir, 'package.json'), releasePackageJson(packageVersion));
  fs.writeFileSync(path.join(outDir, 'README.md'), releaseReadme(), 'utf8');

  console.log(`${productBrand.displayName} npm package generated: ${outDir}`);
  console.log(`Package: ${packageName}@${packageVersion}`);
  console.log(`Chrome extension source server: ${sourceServerUrl}`);
  console.log('Publish from the generated directory, not from the development repository:');
  console.log(`  cd ${outDir}`);
  console.log('  npm publish');
}

main();

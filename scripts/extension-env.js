const fs = require('fs');
const path = require('path');

const envConfigs = {
  prod: {
    source: 'https://example.com/chrome-extension-scaffold/',
    api: 'https://api.example.com/',
    site: 'https://app.example.com/index.html',
    env: 'prod'
  },
  dev: {
    source: 'https://dev.example.com/chrome-extension-scaffold/',
    api: 'https://dev-api.example.com/',
    site: 'https://dev-app.example.com/index.html',
    env: 'dev'
  },
  local: {
    source: 'https://dev.example.com/chrome-extension-scaffold/',
    api: 'http://localhost:3000/',
    site: 'http://localhost:3000/',
    env: 'local'
  }
};

function createTimestampParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hours: now.getHours(),
    minutes: now.getMinutes(),
    seconds: now.getSeconds()
  };
}

function createConfigVersion(parts = createTimestampParts()) {
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  const hours = String(parts.hours).padStart(2, '0');
  const minutes = String(parts.minutes).padStart(2, '0');
  const seconds = String(parts.seconds).padStart(2, '0');
  return `${parts.year}${month}${day}.${hours}${minutes}${seconds}`;
}

function assertManifestVersion(version) {
  const valid = /^\d+\.\d+\.\d+$/.test(version)
    && version.split('.').every(part => Number(part) >= 0 && Number(part) <= 65535);

  if (!valid) {
    throw new Error(`manifest.version 不合法: ${version}. 版本号必须是 x.x.x 三段数字，且每段在 0-65535 之间。`);
  }
}

function bumpPatchVersion(version) {
  assertManifestVersion(version);
  const parts = version.split('.').map(Number);
  parts[2] += 1;
  if (parts[2] > 65535) {
    parts[2] = 0;
    parts[1] += 1;
  }
  if (parts[1] > 65535) {
    parts[1] = 0;
    parts[0] += 1;
  }
  if (parts[0] > 65535) {
    throw new Error(`manifest.version 无法继续递增: ${version}`);
  }
  return parts.join('.');
}

function writeJson(filePath, value, spaces = 2) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, spaces), 'utf8');
}

function applyExtensionEnv(options) {
  const {
    packageDir,
    env,
    appModule,
    manifestVersion,
    configVersion,
    envOverrides = {},
    manifestOverrides = {},
  } = options || {};

  if (!packageDir) throw new Error('packageDir is required.');
  if (!env || !envConfigs[env]) {
    throw new Error('请提供有效的环境参数 (prod 或 dev 或 local)');
  }

  const manifestPath = path.join(packageDir, 'manifest.json');
  const configPath = path.join(packageDir, 'app', 'config.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  manifest.env = {
    ...envConfigs[env],
    ...envOverrides,
  };
  manifest.app_module = appModule || (env === 'local' ? 'Offline' : 'Online');

  if (manifestVersion) {
    assertManifestVersion(manifestVersion);
    manifest.version = manifestVersion;
  }
  Object.assign(manifest, manifestOverrides);
  if (manifest.action && manifest.name) {
    manifest.action = {
      ...manifest.action,
      default_title: manifest.name,
    };
  }

  if (configVersion) {
    config.version = configVersion;
  }

  writeJson(manifestPath, manifest, 2);
  writeJson(configPath, config, 4);

  return {
    manifest,
    config,
    manifestPath,
    configPath,
  };
}

module.exports = {
  applyExtensionEnv,
  assertManifestVersion,
  bumpPatchVersion,
  createConfigVersion,
  createTimestampParts,
  envConfigs,
};

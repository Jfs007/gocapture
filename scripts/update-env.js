#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const env = process.argv[2];
const args = process.argv.slice(3);

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

if (!env || !envConfigs[env]) {
  console.error('错误: 请提供有效的环境参数 (prod 或 dev 或 local)');
  console.error('用法: node scripts/update-env.js <prod|dev|local> [--version <manifestVersion>]');
  process.exit(1);
}

const manifestPath = path.join(__dirname, '../package/manifest.json');
const configPath = path.join(__dirname, '../package/app/config.json');

function getArgValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return '';
  return args[index + 1] || '';
}

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

function createConfigVersion(parts) {
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

function zipPackage() {
  return new Promise((resolve, reject) => {
    const packageDir = path.join(__dirname, '../package');
    const distDir = path.join(__dirname, '../package/app');
    const outputPath = path.join(distDir, 'package.zip');

    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      console.log(`压缩完成: ${outputPath}`);
      console.log(`文件大小: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(packageDir, false);
    archive.finalize();
  });
}

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const timestampParts = createTimestampParts();
  const manifestVersion = getArgValue('--version') || bumpPatchVersion(manifest.version || '1.0.0');
  assertManifestVersion(manifestVersion);

  manifest.env = envConfigs[env];
  manifest.app_module = env === 'local' ? 'Offline' : 'Online';
  manifest.version = manifestVersion;
  manifest.name = env === 'prod'
    ? 'Chrome Extension Scaffold'
    : 'Chrome Extension Scaffold (Dev)';
  manifest.short_name = 'Scaffold';
  manifest.action = {
    ...(manifest.action || {}),
    default_title: manifest.name
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.version = createConfigVersion(timestampParts);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');

  console.log(`成功更新环境配置为: ${env}`);
  console.log(`source: ${envConfigs[env].source}`);
  console.log(`api: ${envConfigs[env].api}`);
  console.log(`site: ${envConfigs[env].site}`);
  console.log(`manifest.json version: ${manifest.version}`);
  console.log(`config.json version: ${config.version}`);

  zipPackage().then(() => {
    console.log('所有操作完成');
  }).catch((error) => {
    console.error('压缩失败:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('更新失败:', error.message);
  process.exit(1);
}

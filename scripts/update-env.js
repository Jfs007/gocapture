#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const {
  applyExtensionEnv,
  bumpPatchVersion,
  createConfigVersion,
  createTimestampParts,
  envConfigs,
} = require('./extension-env');

const env = process.argv[2];
const args = process.argv.slice(3);

if (!env || !envConfigs[env]) {
  console.error('错误: 请提供有效的环境参数 (prod 或 dev 或 local)');
  console.error('用法: node scripts/update-env.js <prod|dev|local> [--version <manifestVersion>]');
  process.exit(1);
}

function getArgValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return '';
  return args[index + 1] || '';
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
  const packageDir = path.join(__dirname, '../package');
  const manifestPath = path.join(packageDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const timestampParts = createTimestampParts();
  const manifestVersion = getArgValue('--version') || bumpPatchVersion(manifest.version || '1.0.0');
  const { manifest: nextManifest, config } = applyExtensionEnv({
    packageDir,
    env,
    manifestVersion,
    configVersion: createConfigVersion(timestampParts),
    manifestOverrides: {
      name: env === 'prod'
        ? 'Chrome Extension Scaffold'
        : 'Chrome Extension Scaffold (Dev)',
      short_name: 'Scaffold',
    },
  });

  console.log(`成功更新环境配置为: ${env}`);
  console.log(`source: ${nextManifest.env.source}`);
  console.log(`api: ${nextManifest.env.api}`);
  console.log(`site: ${nextManifest.env.site}`);
  console.log(`manifest.json version: ${nextManifest.version}`);
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

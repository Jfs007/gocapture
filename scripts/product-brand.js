'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'config', 'product.json');

function loadProductBrand() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const id = String(config.id || '').trim();
  const displayName = String(process.env.GOCAPTURE_PRODUCT_NAME || config.displayName || '').trim();
  const packageName = String(config.packageName || '').trim();
  const cliCommand = String(config.cliCommand || '').trim();
  if (!id || !displayName || !packageName || !cliCommand) {
    throw new Error(`Product id, displayName, packageName, and cliCommand are required: ${configPath}`);
  }
  return {
    id,
    displayName,
    packageName,
    cliCommand,
  };
}

function replaceRequired(source, pattern, replacement, filePath) {
  if (!pattern.test(source)) throw new Error(`Unable to synchronize product brand in ${filePath}`);
  return source.replace(pattern, replacement);
}

function syncExtensionBrand(packageDir = path.join(rootDir, 'package')) {
  const brand = loadProductBrand();
  const manifestPath = path.join(packageDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.name = brand.displayName;
  manifest.short_name = brand.displayName;
  manifest.action = {
    ...(manifest.action || {}),
    default_title: brand.displayName,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const sidepanelPath = path.join(packageDir, 'sidepanel.html');
  let sidepanel = fs.readFileSync(sidepanelPath, 'utf8');
  sidepanel = replaceRequired(
    sidepanel,
    /<title>[^<]* Side Panel<\/title>/,
    `<title>${brand.displayName} Side Panel</title>`,
    sidepanelPath,
  );
  sidepanel = replaceRequired(
    sidepanel,
    /(<div id="gocapture-sidepanel-status" class="status">)连接 [^<]+ 本地服务(\.\.\.<\/div>)/,
    `$1连接 ${brand.displayName} 本地服务$2`,
    sidepanelPath,
  );
  sidepanel = replaceRequired(
    sidepanel,
    /(<iframe id="gocapture-sidepanel-frame" title=")[^"]+("><\/iframe>)/,
    `$1${brand.displayName}$2`,
    sidepanelPath,
  );
  fs.writeFileSync(sidepanelPath, sidepanel, 'utf8');

  for (const relativePath of ['js/service-worker.js', 'js/sidepanel.js']) {
    const filePath = path.join(packageDir, relativePath);
    const source = fs.readFileSync(filePath, 'utf8');
    const next = replaceRequired(
      source,
      /const GOCAPTURE_PRODUCT_NAME = ['"][^'"]+['"];/,
      `const GOCAPTURE_PRODUCT_NAME = ${JSON.stringify(brand.displayName)};`,
      filePath,
    );
    fs.writeFileSync(filePath, next, 'utf8');
  }
  return brand;
}

if (require.main === module) {
  const brand = syncExtensionBrand();
  console.log(`Product brand synchronized: ${brand.displayName}`);
}

module.exports = {
  loadProductBrand,
  syncExtensionBrand,
};

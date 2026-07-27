'use strict';

const path = require('path');

const configPath = path.resolve(__dirname, '..', '..', '..', 'config', 'product.json');
const config = require(configPath);

const PRODUCT_ID = String(config.id || '').trim();
const PRODUCT_NAME = String(process.env.GOCAPTURE_PRODUCT_NAME || config.displayName || 'GoCapture').trim();
const PACKAGE_NAME = String(config.packageName || '@sep-agent/gocapture').trim();
const CLI_COMMAND = String(config.cliCommand || 'gocapture').trim();

module.exports = {
  PRODUCT_ID,
  PRODUCT_NAME,
  PACKAGE_NAME,
  CLI_COMMAND,
};

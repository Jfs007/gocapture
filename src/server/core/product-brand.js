'use strict';

const path = require('path');

const configPath = path.resolve(__dirname, '..', '..', '..', 'config', 'product.json');
const config = require(configPath);

const PRODUCT_NAME = String(process.env.MAGNUS_PRODUCT_NAME || config.displayName || 'GoCapture').trim();
const LEGACY_PRODUCT_NAME = String(config.legacyName || 'Magnus').trim();
const CLI_COMMAND = String(config.cliCommand || 'magnus').trim();

module.exports = {
  PRODUCT_NAME,
  LEGACY_PRODUCT_NAME,
  CLI_COMMAND,
};

#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { syncDocumentationBrand } = require('./product-brand');

const mode = process.argv[2] || 'prod';
const allowModes = new Set(['dev', 'prod', 'local']);

if (!allowModes.has(mode)) {
  console.error('Usage: npm run docs:build -- <dev|prod|local>');
  process.exit(1);
}

syncDocumentationBrand();

const result = spawnSync(
  'npx',
  ['vitepress', 'build', 'docs'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      DOCS_ENV: mode
    }
  }
);

process.exit(result.status || 0);

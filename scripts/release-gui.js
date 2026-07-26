#!/usr/bin/env node
'use strict';

const http = require('http');
const { buildRelease, publishRelease, sendReleasePage } = require('./release/release-service');
const { loadProductBrand } = require('./product-brand');

const HOST = process.env.MAGNUS_RELEASE_HOST || '127.0.0.1';
const PORT = Number(process.env.MAGNUS_RELEASE_PORT || 17332);
const productBrand = loadProductBrand();

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendStreamHeaders(res) {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/release')) {
      sendReleasePage(res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/release/build') {
      const body = await readBody(req);
      sendStreamHeaders(res);
      buildRelease(res, body);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/release/publish') {
      const body = await readBody(req);
      sendStreamHeaders(res);
      publishRelease(res, body);
      return;
    }
    sendJson(res, 404, { success: false, error: 'Not found.' });
  } catch (error) {
    sendJson(res, 500, { success: false, error: error.message || String(error) });
  }
}

http.createServer((req, res) => {
  void handle(req, res);
}).listen(PORT, HOST, () => {
  console.log(`${productBrand.displayName} developer release GUI: http://${HOST}:${PORT}/release`);
});

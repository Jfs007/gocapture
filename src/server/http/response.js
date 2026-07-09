'use strict';

const ACCESS_CONTROL_ALLOW_HEADERS = 'content-type,x-magnus-internal';

function sendJson(res, status, payload) {
  const text = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': ACCESS_CONTROL_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(text);
}

function sendStreamHeaders(res) {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': ACCESS_CONTROL_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
}

function writeStreamEvent(res, event) {
  if (res.destroyed || res.writableEnded) return;
  res.write(`${JSON.stringify(event)}\n`);
}

module.exports = {
  ACCESS_CONTROL_ALLOW_HEADERS,
  sendJson,
  sendStreamHeaders,
  writeStreamEvent,
};

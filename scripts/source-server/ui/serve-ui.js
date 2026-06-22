const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..', '..');
const packageAppDir = path.join(rootDir, 'package', 'app');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Not found.' : error.message);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(content);
  });
}

function createUiHtml({ host, port, panelTicket }) {
  const safeTicket = JSON.stringify(panelTicket || '');
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Magnus</title>
    <style>
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #f7f8fa; }
    </style>
  </head>
  <body>
    <script>
      window.__MAGNUS_SIDE_PANEL__ = {
        panelTicket: ${safeTicket},
        sourceServerUrl: "http://${host}:${port}",
        bridgeUrl: "ws://${host}:${port}/bridge"
      };
    </script>
    <script src="/app/magnus/index.js"></script>
  </body>
</html>`;
}

function handleUiRequest(req, res, url, { host, port }) {
  if (url.pathname === '/ui' || url.pathname === '/ui/') {
    sendText(res, 200, createUiHtml({
      host,
      port,
      panelTicket: url.searchParams.get('panelTicket') || '',
    }), 'text/html; charset=utf-8');
    return true;
  }

  if (url.pathname.startsWith('/app/')) {
    const rel = url.pathname.replace(/^\/app\//, '').replace(/\\/g, '/');
    if (!rel || rel.split('/').some(part => part === '..')) {
      sendText(res, 403, 'Forbidden.');
      return true;
    }
    sendFile(res, path.join(packageAppDir, rel));
    return true;
  }

  return false;
}

module.exports = {
  handleUiRequest,
};

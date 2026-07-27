#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const path = require('path');
const chokidar = require('chokidar');

const root = __dirname;
const args = process.argv.slice(2);
const portArgIndex = args.findIndex(arg => arg === '--port' || arg === '-p');
const hostArgIndex = args.findIndex(arg => arg === '--host');
const port = Number(process.env.PORT || (portArgIndex >= 0 ? args[portArgIndex + 1] : 5197));
const host = process.env.HOST || (hostArgIndex >= 0 ? args[hostArgIndex + 1] : '127.0.0.1');
const clients = new Set();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function safeResolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  const target = decoded === '/' ? '/index.html' : decoded;
  const file = path.resolve(root, `.${target}`);
  if (!file.startsWith(root)) return null;
  return file;
}

function injectReloadClient(html) {
  const snippet = `
<script>
(() => {
  const source = new EventSource('/__side_hmr');
  source.addEventListener('reload', () => window.location.reload());
  source.onerror = () => {};
})();
</script>`;
  return html.includes('</body>')
    ? html.replace('</body>', `${snippet}\n</body>`)
    : `${html}${snippet}`;
}

function sendFile(res, file) {
  fs.readFile(file, (error, buffer) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error.code === 'ENOENT' ? 'Not found' : error.message);
      return;
    }

    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    };
    res.writeHead(200, headers);
    if (ext === '.html') {
      res.end(injectReloadClient(buffer.toString('utf8')));
    } else {
      res.end(buffer);
    }
  });
}

function sendReload() {
  for (const res of clients) {
    res.write('event: reload\ndata: now\n\n');
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/__side_hmr') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const file = safeResolve(req.url || '/');
  if (!file) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  sendFile(res, file);
});

chokidar.watch(root, {
  ignored: /(^|[/\\])\../,
  ignoreInitial: true
}).on('all', (event, file) => {
  if (file.endsWith('dev-server.js')) return;
  console.log(`[side-demo] ${event}: ${path.relative(root, file)}`);
  sendReload();
});

server.listen(port, host, () => {
  console.log(`[side-demo] serving ${root}`);
  console.log(`[side-demo] browser shell: http://${host}:${port}/`);
  console.log(`[side-demo] iframe app:    http://${host}:${port}/gocapture-ui.html`);
});

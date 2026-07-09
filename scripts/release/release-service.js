'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const defaultPackageDir = path.join(rootDir, 'outputs', 'magnus-npm-package');

function sendReleasePage(res) {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Magnus Release</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
    body { margin: 0; background: #f6f8fb; color: #172033; }
    main { max-width: 960px; margin: 0 auto; padding: 28px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    p { margin: 0 0 20px; color: #667085; }
    section { margin-top: 18px; padding: 18px; border: 1px solid #d8dee8; border-radius: 10px; background: #fff; }
    h2 { margin: 0 0 14px; font-size: 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    label { display: grid; gap: 6px; color: #344054; font-size: 13px; font-weight: 650; }
    input[type="text"], input[type="password"] { height: 34px; border: 1px solid #cfd7e2; border-radius: 7px; padding: 0 10px; font: inherit; }
    .checks { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; }
    .checks label { display: flex; align-items: center; gap: 6px; font-weight: 500; }
    .actions { display: flex; gap: 10px; margin-top: 16px; }
    button { height: 36px; padding: 0 14px; border: 1px solid #cfd7e2; border-radius: 7px; background: #fff; cursor: pointer; font-weight: 700; }
    button.primary { border-color: #2563eb; background: #2563eb; color: #fff; }
    button:disabled { opacity: .55; cursor: not-allowed; }
    pre { min-height: 260px; max-height: 520px; overflow: auto; margin: 0; padding: 14px; border-radius: 10px; background: #0f172a; color: #e5edf7; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; }
    .hint { margin-top: 10px; color: #667085; font-size: 12px; }
  </style>
</head>
<body>
<main>
  <h1>Magnus Developer Release</h1>
  <p>开发仓库专用发布工具，不随 npm 包分发给最终用户。日志实时输出。</p>

  <section>
    <h2>打包</h2>
    <div class="grid">
      <label>包名 <input id="packageName" type="text" value="@sep-agent/magnus"></label>
      <label>版本（留空自动递增 patch） <input id="version" type="text" placeholder="例如 1.2.0"></label>
      <label>插件 Source Server URL <input id="sourceServerUrl" type="text" value="http://127.0.0.1:17321"></label>
    </div>
    <div class="checks">
      <label><input id="skipAppBuild" type="checkbox"> 跳过前端构建</label>
      <label><input id="skipVersionBump" type="checkbox"> 不递增版本</label>
    </div>
    <div class="actions">
      <button class="primary" id="buildBtn">打包</button>
    </div>
  </section>

  <section>
    <h2>发布</h2>
    <div class="grid">
      <label>Registry <input id="registry" type="text" value="https://registry.npmjs.org/"></label>
      <label>OTP（需要 2FA 时填写） <input id="otp" type="password" inputmode="numeric" placeholder="6 位验证码"></label>
    </div>
    <div class="checks">
      <label><input id="dryRun" type="checkbox"> dry-run</label>
    </div>
    <div class="actions">
      <button class="primary" id="publishBtn">发布</button>
    </div>
    <div class="hint">发布前请确认已在终端完成 npm login。Scoped 包会自动使用 --access public。</div>
  </section>

  <section>
    <h2>日志</h2>
    <pre id="log"></pre>
  </section>
</main>
<script>
const logEl = document.getElementById('log');
const buttons = Array.from(document.querySelectorAll('button'));
function value(id) { return document.getElementById(id).value.trim(); }
function checked(id) { return document.getElementById(id).checked; }
function log(line) { logEl.textContent += line + '\\n'; logEl.scrollTop = logEl.scrollHeight; }
function setBusy(value) { buttons.forEach(button => button.disabled = value); }
async function runStream(path, body) {
  setBusy(true);
  log('> POST ' + path);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === 'log') log(event.message);
        if (event.type === 'done') log('完成，退出码：' + event.code);
        if (event.type === 'error') log('错误：' + event.error);
      }
    }
  } catch (error) {
    log('请求失败：' + (error.message || error));
  } finally {
    setBusy(false);
  }
}
document.getElementById('buildBtn').addEventListener('click', () => {
  logEl.textContent = '';
  runStream('/api/release/build', {
    packageName: value('packageName'),
    version: value('version'),
    sourceServerUrl: value('sourceServerUrl'),
    skipAppBuild: checked('skipAppBuild'),
    skipVersionBump: checked('skipVersionBump')
  });
});
document.getElementById('publishBtn').addEventListener('click', () => {
  runStream('/api/release/publish', {
    registry: value('registry'),
    otp: value('otp'),
    dryRun: checked('dryRun')
  });
});
</script>
</body>
</html>`;
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

function streamCommand(res, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || rootDir,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const write = event => {
    if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
  };
  child.stdout.on('data', chunk => write({ type: 'log', message: String(chunk).trimEnd() }));
  child.stderr.on('data', chunk => {
    const text = String(chunk).trimEnd();
    write({ type: text.toLowerCase().includes('error') ? 'error' : 'log', message: text, error: text });
  });
  child.on('error', error => write({ type: 'error', error: error.message || String(error) }));
  child.on('close', code => {
    write({ type: 'done', code });
    res.end();
  });
  return child;
}

function releaseBuildArgs(body = {}) {
  const args = [path.join(rootDir, 'scripts', 'build-npm-package.js')];
  if (body.packageName) args.push('--name', String(body.packageName));
  if (body.version) args.push('--version', String(body.version));
  if (body.sourceServerUrl) args.push('--source-server-url', String(body.sourceServerUrl));
  if (body.skipAppBuild) args.push('--skip-app-build');
  if (body.skipVersionBump) args.push('--skip-version-bump');
  return args;
}

function releasePublishArgs(body = {}) {
  const args = ['publish', '--access', 'public'];
  if (body.registry) args.push('--registry', String(body.registry));
  if (body.otp) args.push('--otp', String(body.otp));
  if (body.dryRun) args.push('--dry-run');
  return args;
}

function buildRelease(res, body) {
  return streamCommand(res, process.execPath, releaseBuildArgs(body), { cwd: rootDir });
}

function publishRelease(res, body) {
  if (!fs.existsSync(path.join(defaultPackageDir, 'package.json'))) {
    res.write(`${JSON.stringify({ type: 'error', error: '发布目录不存在，请先打包。' })}\n`);
    res.end();
    return null;
  }
  return streamCommand(res, 'npm', releasePublishArgs(body), { cwd: defaultPackageDir });
}

module.exports = {
  buildRelease,
  publishRelease,
  sendReleasePage,
};

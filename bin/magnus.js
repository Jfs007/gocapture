#!/usr/bin/env node
'use strict';

// Magnus CLI —— 把本地 source-server 装成 macOS 用户级常驻服务（LaunchAgent）。
// 登录即起、崩溃自愈、更新自重启（KeepAlive）。命令：install / uninstall / start / stop / restart / status。

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const LABEL = 'com.magnus.source-server';
const packageRoot = path.resolve(__dirname, '..');
const serverScript = path.join(packageRoot, 'scripts', 'source-server.js');
const nodeBin = process.execPath;
const plistDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
const plistPath = path.join(plistDir, `${LABEL}.plist`);
const logDir = path.join(os.homedir(), 'Library', 'Logs', 'magnus');
const logOut = path.join(logDir, 'source-server.log');
const logErr = path.join(logDir, 'source-server.err.log');

const HOST = process.env.MAGNUS_SOURCE_HOST || '127.0.0.1';
const PORT = Number(argValue('--port') || process.env.MAGNUS_SOURCE_PORT || 17321);

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index !== -1 ? process.argv[index + 1] : '';
}

function isMac() {
  return process.platform === 'darwin';
}

function serviceTarget() {
  return `gui/${process.getuid()}/${LABEL}`;
}

function guiDomain() {
  return `gui/${process.getuid()}`;
}

function launchctl(args, { quiet = false } = {}) {
  return spawnSync('launchctl', args, { stdio: quiet ? 'ignore' : 'inherit', encoding: 'utf8' });
}

function isLoaded() {
  return launchctl(['print', serviceTarget()], { quiet: true }).status === 0;
}

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]
  ));
}

function plistContent() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(nodeBin)}</string>
    <string>${xmlEscape(serverScript)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(packageRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>MAGNUS_SOURCE_HOST</key>
    <string>${xmlEscape(HOST)}</string>
    <key>MAGNUS_SOURCE_PORT</key>
    <string>${xmlEscape(String(PORT))}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logOut)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logErr)}</string>
</dict>
</plist>
`;
}

function pingHealth(timeoutMs = 2000) {
  return new Promise(resolve => {
    const req = http.get(`http://${HOST}:${PORT}/health`, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

function requireMac() {
  if (isMac()) return true;
  console.error('该命令目前仅实现了 macOS（LaunchAgent）。其它系统请用 `magnus start` 前台运行，或等待后续支持。');
  process.exit(1);
}

// ---- 命令 ----

function cmdInstall() {
  requireMac();
  fs.mkdirSync(plistDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(plistPath, plistContent(), 'utf8');
  console.log(`已写入 LaunchAgent：${plistPath}`);
  if (isLoaded()) launchctl(['bootout', serviceTarget()], { quiet: true });   // 重新加载以应用最新 plist
  const boot = launchctl(['bootstrap', guiDomain(), plistPath], { quiet: true });
  if (boot.status !== 0) launchctl(['load', '-w', plistPath], { quiet: true }); // 老系统回退
  launchctl(['kickstart', '-k', serviceTarget()], { quiet: true });
  console.log(`已注册并启动：登录即自启、崩溃自愈、更新自重启。端口 ${PORT}。`);
  console.log('查看状态：magnus status   ｜   移除：magnus uninstall');
}

function cmdUninstall() {
  requireMac();
  if (isLoaded()) {
    const out = launchctl(['bootout', serviceTarget()], { quiet: true });
    if (out.status !== 0) launchctl(['unload', '-w', plistPath], { quiet: true });
  }
  if (fs.existsSync(plistPath)) {
    fs.rmSync(plistPath);
    console.log(`已移除 LaunchAgent：${plistPath}`);
  } else {
    console.log('未发现已安装的 LaunchAgent。');
  }
}

function cmdStart() {
  if (isMac() && fs.existsSync(plistPath)) {
    if (!isLoaded()) {
      const boot = launchctl(['bootstrap', guiDomain(), plistPath], { quiet: true });
      if (boot.status !== 0) launchctl(['load', '-w', plistPath], { quiet: true });
    }
    launchctl(['kickstart', '-k', serviceTarget()], { quiet: true });
    console.log(`已启动本地服务（后台）。端口 ${PORT}。`);
    return;
  }
  // 未安装为服务：前台运行一次（Ctrl+C 退出）。
  console.log(`未安装为后台服务，正在前台运行（Ctrl+C 退出）。如需登录自启：magnus install`);
  const child = spawnSync(nodeBin, [serverScript], {
    stdio: 'inherit',
    env: { ...process.env, MAGNUS_SOURCE_HOST: HOST, MAGNUS_SOURCE_PORT: String(PORT) },
  });
  process.exit(child.status || 0);
}

function cmdStop() {
  requireMac();
  if (!fs.existsSync(plistPath)) {
    console.log('未安装为服务。');
    return;
  }
  if (!isLoaded()) {
    console.log('服务未在运行。');
    return;
  }
  const out = launchctl(['bootout', serviceTarget()], { quiet: true });
  if (out.status !== 0) launchctl(['unload', '-w', plistPath], { quiet: true });
  console.log('已停止本地服务（下次登录会自动再起；彻底移除用 magnus uninstall）。');
}

function cmdRestart() {
  requireMac();
  if (!fs.existsSync(plistPath)) {
    console.log('未安装为服务，请先 magnus install。');
    return;
  }
  if (!isLoaded()) {
    const boot = launchctl(['bootstrap', guiDomain(), plistPath], { quiet: true });
    if (boot.status !== 0) launchctl(['load', '-w', plistPath], { quiet: true });
  }
  launchctl(['kickstart', '-k', serviceTarget()], { quiet: true });
  console.log('已重启本地服务。');
}

async function cmdStatus() {
  const installed = fs.existsSync(plistPath);
  const loaded = isMac() && installed && isLoaded();
  const healthy = await pingHealth();
  console.log('Magnus 本地服务状态');
  console.log(`  地址          http://${HOST}:${PORT}`);
  console.log(`  已安装(自启)  ${installed ? '是' : '否'}${installed ? `  (${plistPath})` : ''}`);
  console.log(`  已加载(常驻)  ${loaded ? '是' : '否'}`);
  console.log(`  健康检查      ${healthy ? '在线 ✅' : '离线 ❌'}`);
  console.log(`  server 脚本   ${serverScript}`);
  console.log(`  日志          ${logOut}`);
  if (!installed) console.log('\n未安装为后台服务。`magnus install` 注册登录自启，或 `magnus start` 前台运行。');
  else if (!healthy) console.log('\n服务未响应，可尝试：magnus restart（查看日志：' + logErr + '）');
}

function cmdHelp() {
  console.log(`Magnus CLI —— 本地 source-server 管理（macOS）

用法：magnus <命令> [--port <端口>]

  install     注册为用户级常驻服务：登录即自启、崩溃自愈、更新自重启，并立即启动
  uninstall   停止并移除该服务
  start       启动服务（已安装则后台启动；未安装则前台运行一次）
  stop        停止服务（下次登录会自动再起；彻底移除用 uninstall）
  restart     重启服务
  status      查看安装/运行/健康状态与端口、日志路径
  help        显示本帮助

  默认端口 ${PORT}（可用 --port 或环境变量 MAGNUS_SOURCE_PORT 覆盖）`);
}

const command = (process.argv[2] || 'help').toLowerCase();
const commands = {
  install: cmdInstall,
  uninstall: cmdUninstall,
  start: cmdStart,
  stop: cmdStop,
  restart: cmdRestart,
  status: cmdStatus,
  help: cmdHelp,
  '--help': cmdHelp,
  '-h': cmdHelp,
};

const run = commands[command];
if (!run) {
  console.error(`未知命令：${command}\n`);
  cmdHelp();
  process.exit(1);
}
Promise.resolve(run()).catch(error => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});

'use strict';

// 更新服务：读取当前包版本、查 npm registry 有无新版、执行全局更新并退出（靠 launchd KeepAlive 自重启）。
// 查询用的是 update-notifier 底层同款逻辑（registry 的 dist-tags.latest + semver 比较），不额外引依赖、可控。

const https = require('https');
const path = require('path');
const { spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..', '..');

function packageInfo() {
  let pkg = {};
  try {
    pkg = require(path.join(rootDir, 'package.json'));
  } catch (error) {
    pkg = {};
  }
  return {
    name: process.env.MAGNUS_UPDATE_PACKAGE || pkg.name || '',
    version: pkg.version || '0.0.0',
    registry: process.env.MAGNUS_UPDATE_REGISTRY || 'https://registry.npmjs.org',
  };
}

// latest 是否比 current 新（只比 major.minor.patch，预发布后缀忽略）。
function isNewer(latest, current) {
  const parse = value => String(value || '0').split('-')[0].split('.').map(part => Number(part) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}

function fetchLatestVersion(name, registry, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    if (!name) {
      reject(new Error('包名未配置'));
      return;
    }
    const url = `${registry.replace(/\/$/, '')}/${name.replace('/', '%2f')}/latest`;
    const req = https.get(url, { headers: { Accept: 'application/json' } }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`registry 返回 ${res.statusCode}`));
        return;
      }
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve(String(JSON.parse(raw).version || ''));
        } catch (error) {
          reject(new Error('registry 响应解析失败'));
        }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('registry 查询超时')); });
    req.on('error', reject);
  });
}

async function checkForUpdate() {
  const info = packageInfo();
  try {
    const latest = await fetchLatestVersion(info.name, info.registry);
    return {
      name: info.name,
      current: info.version,
      latest,
      updateAvailable: !!latest && isNewer(latest, info.version),
    };
  } catch (error) {
    return {
      name: info.name,
      current: info.version,
      latest: null,
      updateAvailable: false,
      error: error.message || String(error),
    };
  }
}

// 执行全局更新：npm i -g <name>@latest 完成后 process.exit(0)，由 KeepAlive 用新版本拉起。
// 立即返回「已开始」，安装在后台进行；不阻塞 HTTP 响应。
function applyUpdate(onLog = () => {}) {
  const info = packageInfo();
  if (!info.name) return { started: false, error: '包名未配置，无法更新' };
  const target = `${info.name}@latest`;
  onLog(`开始更新：npm install -g ${target}`);
  const child = spawn('npm', ['install', '-g', target], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  child.stdout.on('data', chunk => onLog(String(chunk).trim()));
  child.stderr.on('data', chunk => onLog(String(chunk).trim()));
  child.on('error', error => onLog(`更新失败：${error.message || error}`));
  child.on('close', code => {
    if (code === 0) {
      onLog('更新完成，服务即将重启以应用新版本…');
      setTimeout(() => process.exit(0), 300);   // KeepAlive 会用新版本重新拉起
    } else {
      onLog(`更新失败：npm 退出码 ${code}（服务保持当前版本运行）`);
    }
  });
  return { started: true, target };
}

module.exports = {
  packageInfo,
  isNewer,
  checkForUpdate,
  applyUpdate,
};

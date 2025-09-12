// build/util.js
const { resolve } = require('path');
const fs = require('fs');

/**
 * 获取项目根目录
 */
function getRootDir() {
  return process.cwd(); // 启动 Node 时的目录
}

/**
 * 自动扫描 src/sites 下的入口
 */
function getSiteEntries() {
  const rootDir = getRootDir();
  const sitesDir = resolve(rootDir, 'src/sites');
  if (!fs.existsSync(sitesDir)) throw new Error(`src/sites 目录不存在: ${sitesDir}`);

  const entries = {};
  fs.readdirSync(sitesDir).forEach(site => {
    const entryPath = resolve(sitesDir, site, 'index.js');
    if (fs.existsSync(entryPath)) entries[site] = entryPath;
  });
  return entries;
}

/**
 * 根据 BUILD_TARGET 获取入口
 */
function getCurrentEntry() {
  const target = process.env.BUILD_TARGET || 'all';
  const allEntries = getSiteEntries();

  if (target === 'all') return allEntries;

  if (allEntries[target]) return { [target]: allEntries[target] };

  throw new Error(`未知的 BUILD_TARGET: ${target}`);
}

/**
 * 构建目标列表（用于 build.js）
 */
function getBuildTargets() {
  return Object.entries(getSiteEntries()).map(([site]) => ({
    name: site,
    target: site,
    emoji: '🌐'
  }));
}

module.exports = { getSiteEntries, getCurrentEntry, getBuildTargets };

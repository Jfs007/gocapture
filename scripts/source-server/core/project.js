const fs = require('fs');
const path = require('path');
const {
  KEY_FILES,
  MAX_FILES,
  MAX_SNIPPET_CHARS,
} = require('./config');
const {
  isSkipped,
  isTextFile,
  safeReadText,
} = require('./fs-utils');
const { posixPath } = require('../utils');

function walkFiles(rootDir) {
  const result = [];
  const stack = [''];

  while (stack.length && result.length < MAX_FILES) {
    const relDir = stack.pop();
    const absDir = path.join(rootDir, relDir);
    let entries = [];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch (error) {
      continue;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (result.length >= MAX_FILES) break;
      const relPath = posixPath(path.join(relDir, entry.name));
      if (isSkipped(relPath)) continue;
      const absPath = path.join(rootDir, relPath);

      if (entry.isDirectory()) {
        stack.push(relPath);
        continue;
      }

      if (!entry.isFile()) continue;
      try {
        const stat = fs.statSync(absPath);
        result.push({
          path: relPath,
          size: stat.size,
          mtimeMs: Math.round(stat.mtimeMs),
        });
      } catch (error) {
      }
    }
  }

  return result.sort((a, b) => a.path.localeCompare(b.path));
}

function inferStack(files, snippets) {
  const paths = files.map(file => file.path);
  const packageText = snippets['package.json'] || '';
  const hits = [];
  const hasPath = matcher => paths.some(matcher);
  const hasPackage = text => packageText.includes(text);

  if (hasPackage('"vue"') || hasPath(file => file.endsWith('.vue'))) hits.push('Vue');
  if (hasPackage('"react"') || hasPath(file => file.endsWith('.jsx') || file.endsWith('.tsx'))) hits.push('React');
  if (hasPackage('"vite"') || hasPath(file => file.startsWith('vite.config.'))) hits.push('Vite');
  if (hasPackage('"webpack"') || hasPath(file => file.includes('webpack.config'))) hits.push('Webpack');
  if (hasPackage('"next"') || hasPath(file => file.startsWith('next.config.'))) hits.push('Next');
  if (hasPackage('"nuxt"') || hasPath(file => file.startsWith('nuxt.config.'))) hits.push('Nuxt');
  if (hasPackage('"typescript"') || hasPath(file => file.endsWith('.ts') || file.endsWith('.tsx'))) hits.push('TypeScript');
  if (hasPackage('"tailwindcss"') || hasPath(file => file.includes('tailwind.config'))) hits.push('Tailwind');
  if (hasPackage('"express"') || hasPath(file => file.includes('controller') || file.includes('router'))) hits.push('Node Backend');
  if (hasPath(file => file.endsWith('.go'))) hits.push('Go');
  if (hasPath(file => file.endsWith('.java'))) hits.push('Java');
  if (hasPath(file => file.endsWith('.py'))) hits.push('Python');
  return Array.from(new Set(hits));
}

function inferProjectKind(files, snippets) {
  const paths = files.map(file => file.path);
  const packageText = snippets['package.json'] || '';
  const hasPath = matcher => paths.some(matcher);
  const hasPackage = text => packageText.includes(text);

  if (hasPackage('"next"') || hasPath(file => file.startsWith('next.config.'))) return 'next';
  if (hasPackage('"nuxt"') || hasPath(file => file.startsWith('nuxt.config.'))) return 'nuxt';
  if (
    hasPackage('"umi"') ||
    hasPackage('"@umijs/') ||
    hasPath(file => file === '.umirc.ts' || file === '.umirc.js' || file.startsWith('config/routes.'))
  ) return 'umi';

  const isVue = hasPackage('"vue"') || hasPath(file => file.endsWith('.vue'));
  const isReact = hasPackage('"react"') || hasPath(file => file.endsWith('.jsx') || file.endsWith('.tsx'));
  const isVite = hasPackage('"vite"') || hasPath(file => file.startsWith('vite.config.'));
  const isWebpack = hasPackage('"webpack"') || hasPath(file => file.includes('webpack.config') || file === 'vue.config.js');

  if (isVue && isVite) return 'vue-vite';
  if (isVue && isWebpack) return 'vue-webpack';
  if (isVue) return 'vue';
  if (isReact && isVite) return 'react-vite';
  if (isReact && isWebpack) return 'react-webpack';
  return 'unknown';
}

function scanProject(rootDir) {
  const resolved = path.resolve(rootDir || '');
  const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Source path is not a directory: ${rootDir}`);
  }

  const files = walkFiles(resolved);
  const snippets = {};
  for (const file of files) {
    if (!KEY_FILES.has(file.path) || !isTextFile(file.path)) continue;
    try {
      snippets[file.path] = safeReadText(path.join(resolved, file.path)).slice(0, MAX_SNIPPET_CHARS);
    } catch (error) {
    }
  }

  const stack = inferStack(files, snippets);
  const kind = inferProjectKind(files, snippets);
  return {
    name: path.basename(resolved),
    path: resolved,
    kind,
    fileCount: files.length,
    maxFiles: MAX_FILES,
    limited: files.length >= MAX_FILES,
    files,
    snippets,
    stack,
    stackText: stack.join(' / '),
    scannedAt: new Date().toISOString(),
  };
}

module.exports = {
  inferProjectKind,
  inferStack,
  scanProject,
  walkFiles,
};

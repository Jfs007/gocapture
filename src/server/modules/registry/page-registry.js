'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const REGISTRY_VERSION = 1;
const REGISTRY_DIR = process.env.MAGNUS_HOME
  ? path.resolve(process.env.MAGNUS_HOME)
  : path.join(os.homedir(), '.magnus');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json');

function nowIso() {
  return new Date().toISOString();
}

function safeJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, file);
}

function normalizeUrlForRegistry(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    const pathname = url.pathname || '/';
    return `${url.origin}${pathname}`;
  } catch (error) {
    return text.replace(/[?#].*$/, '');
  }
}

function defaultUrlPattern(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    return `${url.origin}/`;
  } catch (error) {
    const normalized = normalizeUrlForRegistry(text);
    return normalized.endsWith('/') ? normalized : `${normalized}/`;
  }
}

function normalizePattern(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    const pathname = url.pathname || '/';
    return `${url.origin}${pathname.endsWith('/') ? pathname : `${pathname}/`}`;
  } catch (error) {
    return text.endsWith('/') ? text : `${text}/`;
  }
}

function normalizeRegistry(raw) {
  const bindings = Array.isArray(raw?.bindings) ? raw.bindings : [];
  return {
    version: REGISTRY_VERSION,
    bindings: bindings
      .map(item => ({
        urlPattern: normalizePattern(item?.urlPattern),
        projectRoot: String(item?.projectRoot || '').trim(),
        createdAt: item?.createdAt || nowIso(),
        updatedAt: item?.updatedAt || item?.createdAt || nowIso(),
      }))
      .filter(item => item.urlPattern && item.projectRoot),
  };
}

function readRegistry() {
  return normalizeRegistry(safeJson(REGISTRY_FILE, { version: REGISTRY_VERSION, bindings: [] }));
}

function writeRegistry(registry) {
  const normalized = normalizeRegistry(registry);
  atomicWrite(REGISTRY_FILE, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function bindPageProject(input = {}) {
  const projectRoot = String(input.projectRoot || '').trim();
  const urlPattern = normalizePattern(input.urlPattern || defaultUrlPattern(input.url || input.pageUrl));
  if (!projectRoot) throw new Error('Missing projectRoot.');
  if (!urlPattern) throw new Error('Missing page url or urlPattern.');
  const registry = readRegistry();
  const currentTime = nowIso();
  const existing = registry.bindings.find(item => item.urlPattern === urlPattern);
  if (existing) {
    existing.projectRoot = projectRoot;
    existing.updatedAt = currentTime;
  } else {
    registry.bindings.push({
      urlPattern,
      projectRoot,
      createdAt: currentTime,
      updatedAt: currentTime,
    });
  }
  return {
    registry: writeRegistry(registry),
    binding: registry.bindings.find(item => item.urlPattern === urlPattern),
  };
}

function resolvePageProject(input = {}) {
  const pageUrl = normalizeUrlForRegistry(input.url || input.pageUrl);
  if (!pageUrl) return null;
  const registry = readRegistry();
  const matched = registry.bindings
    .filter(item => pageUrl.startsWith(item.urlPattern))
    .sort((a, b) => b.urlPattern.length - a.urlPattern.length)[0] || null;
  return matched
    ? {
      ...matched,
      pageUrl,
      registryFile: REGISTRY_FILE,
    }
    : null;
}

module.exports = {
  REGISTRY_FILE,
  bindPageProject,
  readRegistry,
  resolvePageProject,
};

const { readProjectText } = require('../../core/fs-utils');
const {
  detectLayoutLike,
  projectFileMap,
  resolveImportFile,
  routeHit,
  routePathMatches,
  routeSourceFiles,
} = require('../utils');

const REACT_ROUTE_FILES = [
  /(^|\/)src\/router\//,
  /(^|\/)src\/routes?\//,
  /(^|\/)src\/pages\/.*routes?\.(js|jsx|ts|tsx)$/,
  /routes?\.(js|jsx|ts|tsx)$/,
  /router\.(js|jsx|ts|tsx)$/,
];

const REACT_COMPONENT_REGISTRY_FILES = [
  /(^|\/)src\/components\/index\.(js|jsx|ts|tsx)$/,
  /(^|\/)src\/containers\/index\.(js|jsx|ts|tsx)$/,
  /(^|\/)src\/pages\/index\.(js|jsx|ts|tsx)$/,
];

function importedNameMap(text) {
  const map = new Map();
  const patterns = [
    /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g,
    /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\.)?lazy\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/g,
    /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      map.set(match[1], match[2]);
    }
  }
  return map;
}

function findEnclosingObjectStart(text, index) {
  const stack = [];
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i <= index; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') stack.push(i);
    if (char === '}') stack.pop();
  }
  return stack.length ? stack[stack.length - 1] : -1;
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = openIndex; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function componentRegistry(project, textCache, fileMap = projectFileMap(project)) {
  const registry = new Map();
  for (const file of project.files || []) {
    if (!REACT_COMPONENT_REGISTRY_FILES.some(pattern => pattern.test(file.path))) continue;
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const imports = importedNameMap(text);
    for (const [name, specifier] of imports.entries()) {
      const componentFile = resolveImportFile(project, file.path, specifier, fileMap);
      if (componentFile) registry.set(name, componentFile);
    }
    const loadablePattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\s*\(\s*\{[\s\S]*?\bloader\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = loadablePattern.exec(text))) {
      const componentFile = resolveImportFile(project, file.path, match[2], fileMap);
      if (componentFile) registry.set(match[1], componentFile);
    }
  }
  return registry;
}

function routeBlocks(text, pagePath) {
  const blocks = [];
  const pathPattern = /\bpath\s*:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = pathPattern.exec(text))) {
    const routePath = match[1];
    if (!routePathMatches(routePath, pagePath)) continue;
    blocks.push({
      routePath,
      start: match.index,
      text: text.slice(match.index, Math.min(text.length, match.index + 1400)),
    });
  }

  const jsxRoutePattern = /<Route\b[\s\S]*?>/g;
  while ((match = jsxRoutePattern.exec(text))) {
    const blockText = match[0];
    const pathMatch = blockText.match(/\bpath\s*=\s*['"]([^'"]+)['"]/);
    if (!pathMatch) continue;
    const routePath = pathMatch[1];
    if (!routePathMatches(routePath, pagePath)) continue;
    blocks.push({
      routePath,
      start: match.index,
      text: blockText,
    });
  }

  const configPattern = /\b(?:key|route)\s*:\s*['"]([^'"]+)['"][\s\S]{0,900}?\bcomponent\s*:\s*['"]([^'"]+)['"]/g;
  const componentStringPattern = /\bcomponent\s*:\s*['"]([^'"]+)['"]/g;
  const seenConfigObjects = new Set();
  while ((match = componentStringPattern.exec(text))) {
    const objectStart = findEnclosingObjectStart(text, match.index);
    if (objectStart === -1 || seenConfigObjects.has(objectStart)) continue;
    const objectEnd = findMatchingBrace(text, objectStart);
    if (objectEnd === -1) continue;
    seenConfigObjects.add(objectStart);
    const objectText = text.slice(objectStart, objectEnd + 1);
    const keyMatch = objectText.match(/\b(?:key|route)\s*:\s*['"]([^'"]+)['"]/);
    if (!keyMatch) continue;
    const routePath = keyMatch[1];
    if (!routePathMatches(routePath, pagePath)) continue;
    blocks.push({
      routePath,
      start: objectStart,
      text: objectText,
      componentName: match[1],
    });
  }
  return blocks;
}

function componentSpecFromBlock(blockText, imports) {
  const lazy = blockText.match(/\b(?:component|element|Component)\s*:\s*(?:React\.)?lazy\s*\(\s*\(\s*\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/);
  if (lazy) return lazy[1];

  const named = blockText.match(/\b(?:component|Component)\s*:\s*([A-Za-z_$][\w$]*)/);
  if (named && imports.has(named[1])) return imports.get(named[1]);

  const jsx = blockText.match(/\belement\s*:\s*<([A-Za-z_$][\w$]*)\b/);
  if (jsx && imports.has(jsx[1])) return imports.get(jsx[1]);

  const jsxComponent = blockText.match(/\bcomponent\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/);
  if (jsxComponent && imports.has(jsxComponent[1])) return imports.get(jsxComponent[1]);

  const jsxElement = blockText.match(/\belement\s*=\s*\{\s*<([A-Za-z_$][\w$]*)\b/);
  if (jsxElement && imports.has(jsxElement[1])) return imports.get(jsxElement[1]);

  return '';
}

function componentFileFromBlock(project, fromFile, block, imports, registry, fileMap) {
  if (block.componentName && registry.has(block.componentName)) {
    return registry.get(block.componentName);
  }
  const specifier = componentSpecFromBlock(block.text, imports);
  return resolveImportFile(project, fromFile, specifier, fileMap);
}

function extractRoutes({ project, pagePath, textCache }) {
  const fileMap = projectFileMap(project);
  const registry = componentRegistry(project, textCache, fileMap);
  const nodes = [];

  for (const file of routeSourceFiles(project, REACT_ROUTE_FILES)) {
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const imports = importedNameMap(text);

    for (const block of routeBlocks(text, pagePath || '/')) {
      const specifier = componentSpecFromBlock(block.text, imports);
      const componentFile = componentFileFromBlock(project, file.path, block, imports, registry, fileMap);
      nodes.push({
        routePath: block.routePath,
        rawPath: block.routePath,
        componentFile,
        sourceFile: file.path,
        framework: 'react',
        adapter: 'react',
        isLeaf: true,
        isLayoutLike: detectLayoutLike(project, componentFile, textCache),
        parent: '',
        meta: {
          componentSpecifier: specifier || block.componentName || '',
        },
      });
    }
  }

  return nodes;
}

function resolve({ project, pagePath, textCache }) {
  const fileMap = projectFileMap(project);
  const registry = componentRegistry(project, textCache, fileMap);
  const hits = [];

  for (const file of routeSourceFiles(project, REACT_ROUTE_FILES)) {
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const imports = importedNameMap(text);

    for (const block of routeBlocks(text, pagePath)) {
      const specifier = componentSpecFromBlock(block.text, imports);
      const componentFile = componentFileFromBlock(project, file.path, block, imports, registry, fileMap);
      if (componentFile) {
        hits.push(routeHit(project, componentFile, {
          adapter: 'react',
          score: 500,
          from: file.path,
          routePath: block.routePath,
          reasons: [
            `页面路径 ${pagePath} 命中 React route path：${block.routePath}`,
            `路由文件：${file.path}`,
            `component import：${specifier || block.componentName || ''}`,
          ],
          textCache,
        }));
        continue;
      }

      hits.push(routeHit(project, file.path, {
        adapter: 'react',
        score: 230,
        from: file.path,
        routePath: block.routePath,
        reasons: [
          `页面路径 ${pagePath} 命中 React route path：${block.routePath}`,
          '未解析到 component 文件，保留路由声明文件作为候选',
        ],
        textCache,
      }));
    }
  }

  return hits.filter(Boolean);
}

module.exports = {
  key: 'react',
  kinds: ['react-vite', 'react-webpack'],
  extractRoutes,
  resolve,
};

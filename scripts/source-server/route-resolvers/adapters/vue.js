const { readProjectText } = require('../../fs-utils');
const {
  cleanPagePath,
  projectFileMap,
  resolveImportFile,
  routeHit,
  routeMatchRank,
  routePathMatches,
  routeSourceFiles,
} = require('../utils');

const VUE_ROUTE_FILES = [
  /(^|\/)src\/router\//,
  /(^|\/)src\/routes?\//,
  /(^|\/)router\//,
  /(^|\/)routes?\//,
  /router\.(js|ts)$/,
  /routes?\.(js|ts)$/,
];

const VUE_APP_ENTRY_FILES = [
  /(^|\/)src\/main\.(js|ts)$/,
  /(^|\/)src\/app\.(js|ts)$/,
  /(^|\/)main\.(js|ts)$/,
  /(^|\/)app\.(js|ts)$/,
];

function importedNameMap(text) {
  const map = new Map();
  const patterns = [
    /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g,
    /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\(\s*\)\s*=>\s*)?import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      map.set(match[1], match[2]);
    }
  }
  return map;
}

function routeBlocks(text, pagePath) {
  const entries = routeEntries(text);
  if (!entries.length) return [];

  const matched = entries
    .map(entry => {
      const rankedPaths = entry.matchPaths
        .map(routePath => ({
          routePath,
          rank: routeMatchRank(routePath, pagePath),
        }))
        .filter(item => item.rank > 0)
        .sort((a, b) => b.rank - a.rank || routeDepth(b.routePath) - routeDepth(a.routePath));
      return {
        ...entry,
        matchedRoutePath: rankedPaths[0]?.routePath || entry.fullPath,
        matchRank: rankedPaths[0]?.rank || 0,
      };
    })
    .filter(entry => entry.matchRank > 0);
  if (!matched.length) return [];

  const bestRank = Math.max(...matched.map(entry => entry.matchRank));
  const bestDepth = Math.max(...matched
    .filter(entry => entry.matchRank === bestRank)
    .map(entry => routeDepth(entry.fullPath)));
  const result = [];
  const seen = new Set();
  for (const entry of matched.filter(item => item.matchRank === bestRank && routeDepth(item.fullPath) === bestDepth)) {
    const chain = [...(entry.ancestors || []), entry];
    for (let index = 0; index < chain.length; index++) {
      const item = chain[index];
      const key = `${entry.fullPath}:${item.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        routePath: item.fullPath || entry.matchedRoutePath,
        fullPath: item.fullPath,
        declaredRoutePath: item.routePath,
        start: item.start,
        text: item.directText,
        isLeaf: index === chain.length - 1,
        distanceToLeaf: chain.length - index - 1,
        leafRoutePath: entry.matchedRoutePath,
      });
    }
  }
  return result;
}

function routeEntries(text) {
  const entries = [];
  const seen = new Set();
  const pathPattern = /\bpath\s*:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = pathPattern.exec(text))) {
    const objectStart = findEnclosingObjectStart(text, match.index);
    if (objectStart === -1 || seen.has(objectStart)) continue;
    const objectEnd = findMatchingBrace(text, objectStart);
    if (objectEnd === -1) continue;
    seen.add(objectStart);
    entries.push({
      routePath: match[1],
      start: objectStart,
      end: objectEnd,
      text: text.slice(objectStart, objectEnd + 1),
    });
  }

  for (const entry of entries) {
    const ancestors = entries
      .filter(item => item.start < entry.start && item.end > entry.end)
      .sort((a, b) => a.start - b.start);
    entry.ancestors = ancestors;
    entry.fullPath = joinRoutePaths([...ancestors.map(item => item.routePath), entry.routePath]);
    entry.matchPaths = routeMatchPaths(entry.fullPath, entry.routePath);
    entry.directText = topLevelObjectText(entry.text);
  }
  return entries;
}

function routeMatchPaths(fullPath, routePath) {
  const result = [cleanPagePath(fullPath)];
  const declared = String(routePath || '').trim();
  if (declared && !declared.startsWith('/')) {
    result.push(cleanPagePath(`/${declared}`));
  }
  return Array.from(new Set(result));
}

function routeDepth(routePath) {
  return cleanPagePath(routePath).replace(/^\/+/, '').split('/').filter(Boolean).length;
}

function joinRoutePaths(paths) {
  let result = '';
  for (const rawPath of paths.filter(Boolean)) {
    const routePath = String(rawPath || '').trim();
    if (!routePath) continue;
    if (routePath.startsWith('/')) {
      result = routePath;
      continue;
    }
    result = `${result.replace(/\/+$/, '')}/${routePath.replace(/^\/+/, '')}`;
  }
  return cleanPagePath(result || '/');
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
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
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
    if (char === '{') {
      stack.push(i);
      continue;
    }
    if (char === '}') {
      stack.pop();
    }
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
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
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

function topLevelObjectText(text) {
  let result = '';
  let curlyDepth = 0;
  let squareDepth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    const keep = () => {
      result += curlyDepth <= 1 && squareDepth === 0 ? char : ' ';
    };

    if (lineComment) {
      if (char === '\n') lineComment = false;
      keep();
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        keep();
        i++;
        result += ' ';
        continue;
      }
      keep();
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      keep();
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      keep();
      i++;
      result += ' ';
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      keep();
      i++;
      result += ' ';
      continue;
    }
    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      keep();
      continue;
    }
    if (char === '{') {
      curlyDepth++;
      keep();
      continue;
    }
    if (char === '}') {
      keep();
      curlyDepth--;
      continue;
    }
    if (char === '[') {
      keep();
      squareDepth++;
      continue;
    }
    if (char === ']') {
      squareDepth--;
      keep();
      continue;
    }
    keep();
  }
  return result;
}

function componentSpecFromBlock(blockText, imports) {
  const dynamic = blockText.match(/\bcomponent\s*:\s*(?:\(\s*\)\s*=>\s*)?import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (dynamic) return dynamic[1];

  const named = blockText.match(/\bcomponent\s*:\s*([A-Za-z_$][\w$]*)/);
  if (named && imports.has(named[1])) return imports.get(named[1]);

  return '';
}

function appComponentSpecifier(text, imports) {
  const createAppCall = text.match(/\bcreateApp\s*\(\s*([A-Za-z_$][\w$]*)\s*\)/);
  if (createAppCall && imports.has(createAppCall[1])) return imports.get(createAppCall[1]);

  const appImport = imports.get('App');
  if (appImport) return appImport;
  return '';
}

function rootAppShellHits(project, pagePath, textCache) {
  const fileMap = projectFileMap(project);
  const hits = [];
  const seen = new Set();

  for (const file of project.files || []) {
    if (!VUE_APP_ENTRY_FILES.some(pattern => pattern.test(file.path))) continue;
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const imports = importedNameMap(text);
    const specifier = appComponentSpecifier(text, imports);
    const componentFile = resolveImportFile(project, file.path, specifier, fileMap);
    if (!componentFile || seen.has(componentFile)) continue;
    seen.add(componentFile);
    hits.push(routeHit(project, componentFile, {
      adapter: 'vue',
      score: 300,
      from: file.path,
      routePath: pagePath,
      reasons: [
        `页面路径 ${pagePath} 命中后追加 Vue 根组件锚点`,
        `入口文件：${file.path}`,
        `app import：${specifier}`,
      ],
      textCache,
    }));
  }

  return hits;
}

function resolve({ project, pagePath, textCache }) {
  const fileMap = projectFileMap(project);
  const hits = [];
  let matchedRoute = false;

  for (const file of routeSourceFiles(project, VUE_ROUTE_FILES)) {
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const imports = importedNameMap(text);

    for (const block of routeBlocks(text, pagePath)) {
      matchedRoute = true;
      const specifier = componentSpecFromBlock(block.text, imports);
      const componentFile = resolveImportFile(project, file.path, specifier, fileMap);
      const isLayout = !block.isLeaf;
      const score = block.isLeaf ? 520 : Math.max(360, 500 - block.distanceToLeaf * 44);
      if (componentFile) {
        hits.push(routeHit(project, componentFile, {
          adapter: 'vue',
          score,
          from: file.path,
          routePath: block.routePath,
          reasons: [
            `页面路径 ${pagePath} 命中 vue-router path：${block.leafRoutePath || block.routePath}`,
            block.declaredRoutePath && block.declaredRoutePath !== block.routePath
              ? `路由声明 path：${block.declaredRoutePath}`
              : '',
            isLayout ? `父级 route component，距叶子页面 ${block.distanceToLeaf} 层` : '叶子页面 route component',
            `路由文件：${file.path}`,
            `component import：${specifier}`,
          ],
          textCache,
        }));
        continue;
      }

      hits.push(routeHit(project, file.path, {
        adapter: 'vue',
        score: isLayout ? 220 : 240,
        from: file.path,
        routePath: block.routePath,
        reasons: [
          `页面路径 ${pagePath} 命中 vue-router path：${block.leafRoutePath || block.routePath}`,
          block.declaredRoutePath && block.declaredRoutePath !== block.routePath
            ? `路由声明 path：${block.declaredRoutePath}`
            : '',
          isLayout ? `父级 route block，距叶子页面 ${block.distanceToLeaf} 层` : '叶子页面 route block',
          '未解析到 component 文件，保留路由声明文件作为候选',
        ],
        textCache,
      }));
    }
  }

  if (matchedRoute) {
    hits.push(...rootAppShellHits(project, pagePath, textCache));
  }

  return hits.filter(Boolean);
}

module.exports = {
  key: 'vue',
  kinds: ['vue', 'vue-vite', 'vue-webpack'],
  resolve,
};

const { readProjectText } = require('../../core/fs-utils');
const {
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

function resolve({ project, pagePath, textCache }) {
  const fileMap = projectFileMap(project);
  const hits = [];

  for (const file of routeSourceFiles(project, REACT_ROUTE_FILES)) {
    const text = readProjectText(project, file, textCache);
    if (!text) continue;
    const imports = importedNameMap(text);

    for (const block of routeBlocks(text, pagePath)) {
      const specifier = componentSpecFromBlock(block.text, imports);
      const componentFile = resolveImportFile(project, file.path, specifier, fileMap);
      if (componentFile) {
        hits.push(routeHit(project, componentFile, {
          adapter: 'react',
          score: 500,
          from: file.path,
          routePath: block.routePath,
          reasons: [
            `页面路径 ${pagePath} 命中 React route path：${block.routePath}`,
            `路由文件：${file.path}`,
            `component import：${specifier}`,
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
  resolve,
};

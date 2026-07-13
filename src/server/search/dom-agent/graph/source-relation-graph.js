'use strict';

const { readProjectText } = require('../../../core/fs-utils');
const { makeSnippet, uniq } = require('../../../utils');
const { buildFileMap, importedFiles, buildReverseImportMap } = require('../../import-trace');
const { MAX_ROUTE_RELATION_DEPTH } = require('../anchor/dom-utils');
const { extractSourceRelations } = require('./relation-adapters/registry');
const {
  componentNamesForFile,
  normalizeComponentName,
} = require('./relation-adapters/markup-bindings');

function exportedSymbols(text) {
  const source = String(text || '');
  const symbols = [];
  const patterns = [
    /\bexport\s+(?:declare\s+)?(?:const|let|var|function|class|enum|interface|type)\s+([A-Za-z_$][\w$]*)/g,
    /\bexport\s*\{([^}]+)\}/g,
  ];
  let match;
  while ((match = patterns[0].exec(source))) symbols.push(match[1]);
  while ((match = patterns[1].exec(source))) {
    for (const item of match[1].split(',')) {
      const value = item.trim().split(/\s+as\s+/i).pop();
      if (/^[A-Za-z_$][\w$]*$/.test(value || '')) symbols.push(value);
    }
  }
  return uniq(symbols);
}

function consumedProps(text) {
  const source = String(text || '');
  const props = new Set();
  let match;
  const defineProps = /\bdefineProps\s*(?:<[^>]*>)?\s*\(\s*\{([\s\S]{0,8000}?)\}\s*\)/g;
  while ((match = defineProps.exec(source))) {
    for (const item of match[1].matchAll(/(?:^|[,\n])\s*([A-Za-z_$][\w$]*)\s*:/g)) props.add(item[1]);
  }
  for (const item of source.matchAll(/\bprops\.([A-Za-z_$][\w$]*)/g)) props.add(item[1]);
  for (const item of source.matchAll(/\bthis\.props\.([A-Za-z_$][\w$]*)/g)) props.add(item[1]);
  for (const item of source.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:this\.)?props\b/g)) {
    for (const name of item[1].split(',')) {
      const value = name.trim().split(/\s*:\s*/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(value || '')) props.add(value);
    }
  }
  for (const item of source.matchAll(/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=)\s*\(\s*\{([^}]+)\}/g)) {
    for (const name of item[1].split(',')) {
      const value = name.trim().split(/\s*[:=]\s*/)[0];
      if (/^[A-Za-z_$][\w$]*$/.test(value || '')) props.add(value);
    }
  }
  for (const item of source.matchAll(/@Input(?:\([^)]*\))?\s*(?:public\s+|protected\s+|private\s+)?([A-Za-z_$][\w$]*)/g)) props.add(item[1]);
  for (const item of source.matchAll(/\bexport\s+let\s+([A-Za-z_$][\w$]*)/g)) props.add(item[1]);
  return Array.from(props);
}

function reverseOwners(project, targets, textCache, maxDepth = 4) {
  const fileMap = buildFileMap(project);
  const reverse = buildReverseImportMap(project, fileMap, textCache);
  const owners = new Map();
  for (const target of targets) {
    const queue = [{ file: target, depth: 0, chain: [target] }];
    const visited = new Set([target]);
    while (queue.length) {
      const current = queue.shift();
      if (current.depth >= maxDepth) continue;
      for (const parent of reverse.get(current.file) || []) {
        if (visited.has(parent)) continue;
        visited.add(parent);
        const chain = [parent, ...current.chain];
        const entries = owners.get(parent) || [];
        entries.push({ target, depth: current.depth + 1, chain });
        owners.set(parent, entries);
        queue.push({ file: parent, depth: current.depth + 1, chain });
      }
    }
  }
  return owners;
}

function expressionUsesSymbol(expression, symbol) {
  return new RegExp(`(^|[^\\w$])${String(symbol).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w$]|$)`).test(expression);
}

function buildSourceRelationGraph(project, inspection, textCache) {
  const candidates = inspection?.candidates || [];
  const fileMap = buildFileMap(project);
  const definitions = candidates.filter(item => item.sourceRole === 'definition-like' || item.valueProvider);
  const renderers = candidates.filter(item => !item.referenceOnly && item.sourceRole === 'render-like');
  if (!definitions.length || !renderers.length) {
    return { status: 'not-applicable', bundles: [], nodes: [], edges: [] };
  }

  const targets = uniq([...definitions, ...renderers].map(item => item.file));
  const owners = reverseOwners(project, targets, textCache);
  const nodes = targets.map(file => ({
    file,
    role: definitions.some(item => item.file === file) ? 'definition' : 'renderer',
  }));
  const edges = [];
  const bundles = [];

  for (const [owner, relations] of owners) {
    const reached = new Set(relations.map(item => item.target));
    const reachedDefinitions = definitions.filter(item => reached.has(item.file));
    const reachedRenderers = renderers.filter(item => reached.has(item.file));
    if (!reachedDefinitions.length || !reachedRenderers.length) continue;
    const ownerFile = fileMap.get(owner);
    const ownerText = ownerFile ? readProjectText(project, ownerFile, textCache) : '';
    const ownerRelations = extractSourceRelations({ project, file: owner, text: ownerText });

    for (const renderer of reachedRenderers) {
      const rendererFile = fileMap.get(renderer.file);
      const rendererText = rendererFile ? readProjectText(project, rendererFile, textCache) : '';
      const componentNames = componentNamesForFile(renderer.file);
      const componentUses = ownerRelations.filter(item => {
        return item.type === 'uses-component'
          && componentNames.includes(normalizeComponentName(item.component));
      });
      if (!componentUses.length) continue;
      const props = consumedProps(rendererText);

      for (const definition of reachedDefinitions) {
        const definitionFile = fileMap.get(definition.file);
        const definitionText = definitionFile ? readProjectText(project, definitionFile, textCache) : '';
        const symbols = exportedSymbols(definitionText).filter(symbol => ownerText.includes(symbol));
        if (!symbols.length) continue;
        for (const use of componentUses) {
          const binding = (use.bindings || []).find(item => {
            return symbols.some(symbol => expressionUsesSymbol(item.expression, symbol));
          });
          if (!binding) continue;
          const symbol = symbols.find(item => expressionUsesSymbol(binding.expression, item));
          const consumesProp = props.includes(binding.prop)
            || new RegExp(`(^|[^\w$])${binding.prop}([^\w$]|$)`).test(rendererText);
          if (!consumesProp) continue;
          const ownerToRenderer = relations.find(item => item.target === renderer.file);
          const ownerToDefinition = relations.find(item => item.target === definition.file);
          const bundleEdges = [
            { type: 'uses-component', from: owner, to: renderer.file, chain: ownerToRenderer?.chain || [], component: use.component },
            { type: 'imports-definition', from: owner, to: definition.file, chain: ownerToDefinition?.chain || [], symbol },
            { type: 'passes-prop', from: owner, to: renderer.file, prop: binding.prop, expression: binding.expression, symbol },
            { type: 'consumes-prop', from: renderer.file, prop: binding.prop },
          ];
          edges.push(...bundleEdges);
          bundles.push({
            owner,
            renderer: renderer.file,
            definition: definition.file,
            symbol,
            prop: binding.prop,
            complete: true,
            edges: bundleEdges,
            ownerSnippet: makeSnippet(ownerText, use.offset || 0, use.excerpt?.length || 0).slice(0, 2400),
          });
        }
      }
    }
  }

  const bundleMap = new Map();
  for (const bundle of bundles) {
    const key = `${bundle.owner}\u0000${bundle.renderer}\u0000${bundle.definition}`;
    const old = bundleMap.get(key);
    if (!old) {
      bundleMap.set(key, { ...bundle, symbols: [bundle.symbol], props: [bundle.prop] });
      continue;
    }
    old.symbols = uniq([...old.symbols, bundle.symbol]);
    old.props = uniq([...old.props, bundle.prop]);
    old.edges = uniq([...old.edges, ...bundle.edges].map(item => JSON.stringify(item))).map(item => JSON.parse(item));
  }
  const uniqueBundles = Array.from(bundleMap.values());
  return {
    status: uniqueBundles.length === 1 ? 'unique-complete' : uniqueBundles.length ? 'ambiguous-complete' : 'incomplete',
    bundles: uniqueBundles,
    nodes: uniq(nodes.map(item => JSON.stringify(item))).map(item => JSON.parse(item)),
    edges: uniq(edges.map(item => JSON.stringify(item))).map(item => JSON.parse(item)),
  };
}

function relationGraphHits(graph, inspection) {
  if (graph?.status !== 'unique-complete' || graph.bundles.length !== 1) return [];
  const bundle = graph.bundles[0];
  const candidates = new Map((inspection?.candidates || []).map(item => [item.file, item]));
  return [
    {
      file: bundle.owner,
      score: 4200,
      stage: 'dom-agent-relation-graph',
      sourceRole: 'render',
      preciseEvidence: true,
      codeSnippet: bundle.ownerSnippet,
      reasons: [`业务文件把 ${bundle.symbol} 通过 ${bundle.prop} 传给直接渲染组件`],
    },
    {
      file: bundle.renderer,
      score: 3900,
      stage: 'dom-agent-relation-graph',
      sourceRole: 'render',
      codeSnippet: candidates.get(bundle.renderer)?.excerpt || '',
      reasons: [`直接渲染组件接收并消费 ${bundle.prop}`],
    },
    {
      file: bundle.definition,
      score: 3400,
      stage: 'dom-agent-relation-graph',
      sourceRole: 'definition',
      codeSnippet: candidates.get(bundle.definition)?.excerpt || '',
      reasons: [`定义传入组件的值 ${bundle.symbol}`],
    },
  ];
}

function relationGraphComposite(graph) {
  if (graph?.status !== 'unique-complete' || graph.bundles.length !== 1) return null;
  const bundle = graph.bundles[0];
  return {
    render: {
      file: bundle.owner,
      role: 'render',
      score: 4200,
      anchors: [bundle.symbol, bundle.prop],
    },
    assembly: null,
    children: [{ file: bundle.renderer, anchor: bundle.prop }],
    references: [{ file: bundle.definition, role: 'definition', anchors: [bundle.symbol] }],
    relations: bundle.edges,
  };
}

// 透明再导出：父文件把子文件的导出「原样再导出」（barrel / index / 简单包装），
// 是组合路径的一部分但没有标签渲染。纯 ESM 语法判断，框架无关。
function reExportsSpecifier(parentText, specifier) {
  const spec = String(specifier || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!spec) return false;
  if (new RegExp(`\\bexport\\s+\\*\\s+from\\s+['"]${spec}['"]`).test(parentText)) return true;
  if (new RegExp(`\\bexport\\s*\\{[^}]*\\}\\s*from\\s+['"]${spec}['"]`).test(parentText)) return true;
  const defImport = new RegExp(
    `\\bimport\\s+([A-Za-z_$][\\w$]*)\\s*(?:,\\s*(?:\\{[^}]*\\}|\\*\\s+as\\s+[\\w$]+))?\\s*from\\s+['"]${spec}['"]`
  ).exec(parentText);
  const local = defImport?.[1];
  if (local) {
    if (new RegExp(`\\bexport\\s+default\\s+${local}\\b`).test(parentText)) return true;
    if (new RegExp(`\\bexport\\s*\\{[^}]*\\b${local}\\b[^}]*\\}`).test(parentText)) return true;
  }
  return false;
}

function fileUsedComponentNames(project, file, fileMap, textCache, cache) {
  if (cache.has(file)) return cache.get(file);
  const fileObj = fileMap.get(file);
  const text = fileObj ? readProjectText(project, fileObj, textCache) : '';
  const names = new Set(
    extractSourceRelations({ project, file, text })
      .filter(relation => relation.type === 'uses-component')
      .map(relation => normalizeComponentName(relation.component))
      .filter(Boolean)
  );
  cache.set(file, names);
  return names;
}

// 路由 → 候选 的可达关系遍历，只沿「渲染组合」走：组件渲染边（父文件把子文件当标签渲染）
// 或透明再导出边（barrel/index 转发）。值/配置导入（store/router/util）与工厂/注册表间接自然被截断——
// 无需任何目录名单或框架判断（组件 = 标签用法，是所有框架的公共形态）。入口首跳放行任意 import
// （路由入口本身就是「指向页面」的注册/转发）。
// 返回 { relations, walls }：relations 形状与旧 traceRouteCandidateRelations 一致
// [{ candidateFile, routeFile, depth, chain }]；walls 是「停下的动态/不透明边」——工厂/注册表/动态 key 等
// 无法静态验证的连线，记录 { file, depth, chain, unfollowed:[{file,specifier}] }，供断点解析器按需接手。
function routeRelationTrace(project, routeTrace, candidates, textCache = new Map()) {
  const fileMap = buildFileMap(project);
  const candidateFiles = new Set((candidates || [])
    .filter(candidate => !candidate.referenceOnly)
    .map(candidate => candidate.file)
    .filter(file => fileMap.has(file)));
  if (!candidateFiles.size) return { relations: [], walls: [] };
  const routeFiles = uniq([
    routeTrace?.bestPageFile || '',
    routeTrace?.bestRoute?.sourceFile || '',
    ...((routeTrace?.hits || []).map(hit => hit?.file || '')),
    ...((routeTrace?.hits || []).map(hit => hit?.from || '')),
  ]).filter(file => fileMap.has(file));
  const usedCache = new Map();
  const relationByCandidate = new Map();
  const walls = [];
  for (const routeFile of routeFiles) {
    const queue = [{ file: routeFile, depth: 0, chain: [routeFile] }];
    const visited = new Set([routeFile]);
    while (queue.length) {
      const current = queue.shift();
      if (candidateFiles.has(current.file)) {
        const old = relationByCandidate.get(current.file);
        if (!old || current.depth < old.depth) {
          relationByCandidate.set(current.file, {
            candidateFile: current.file,
            routeFile,
            depth: current.depth,
            chain: current.chain,
          });
        }
      }
      if (current.depth >= MAX_ROUTE_RELATION_DEPTH) continue;
      const parentObj = fileMap.get(current.file);
      const parentText = current.depth === 0 ? '' : (parentObj ? readProjectText(project, parentObj, textCache) : '');
      const usedComponents = current.depth === 0
        ? null
        : fileUsedComponentNames(project, current.file, fileMap, textCache, usedCache);
      const unfollowed = [];
      for (const child of importedFiles(project, current.file, fileMap, textCache)) {
        if (visited.has(child.file)) continue;
        let isCompositionEdge = current.depth === 0;
        if (!isCompositionEdge) {
          const childNames = componentNamesForFile(child.file);
          if (childNames.some(name => usedComponents.has(name))) isCompositionEdge = true;
          else if (reExportsSpecifier(parentText, child.specifier)) isCompositionEdge = true;
        }
        if (!isCompositionEdge) {
          unfollowed.push({ file: child.file, specifier: child.specifier });
          continue;
        }
        visited.add(child.file);
        queue.push({ file: child.file, depth: current.depth + 1, chain: [...current.chain, child.file] });
      }
      // depth≥1 的节点若有「没跟随的 import」，就是一处可能的断点墙（入口首跳放行一切，不算墙）。
      if (current.depth >= 1 && unfollowed.length) {
        walls.push({ file: current.file, depth: current.depth, chain: current.chain, unfollowed });
      }
    }
  }
  return {
    relations: Array.from(relationByCandidate.values())
      .sort((a, b) => a.depth - b.depth || a.candidateFile.localeCompare(b.candidateFile)),
    walls,
  };
}

function routeComponentRelations(project, routeTrace, candidates, textCache = new Map()) {
  return routeRelationTrace(project, routeTrace, candidates, textCache).relations;
}

function candidateHasStrongEvidence(candidate) {
  if (!candidate || candidate.referenceOnly) return false;
  if ((candidate.matchedGroups || []).some(group => group.source === 'planned-group' && (group.keywords || []).length >= 2)) return true;
  if ((candidate.domTextCoverage?.matchedTextCount || 0) >= 2) return true;
  if ((candidate.domCoverage?.matchedClassCount || 0) >= 2) return true;
  return false;
}

function importReaches(project, fromFile, targetFile, fileMap, textCache, maxDepth = 3) {
  if (fromFile === targetFile) return true;
  const queue = [{ file: fromFile, depth: 0 }];
  const visited = new Set([fromFile]);
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const child of importedFiles(project, current.file, fileMap, textCache)) {
      if (child.file === targetFile) return true;
      if (visited.has(child.file)) continue;
      visited.add(child.file);
      queue.push({ file: child.file, depth: current.depth + 1 });
    }
  }
  return false;
}

// 断点接线：静态遍历跑完后，若有「强证据候选没被路由静态到达」，且某个动态墙的未跟随 import
// 经 import 能通向该候选，就在这个墙上触发断点解析器（LLM 只回下一步验证什么，本地执行、补图）。
// 加法式、可关：无 invoke / 无强未达候选 / 无墙 → 原样返回静态 relations，不发任何模型调用；
// 解析成功才补一条 via:'breakpoint' 的边，give_up/超轮不改。触发天然稀发（常规命中都走静态组件边）。
async function augmentRouteRelationsWithBreakpoints(project, routeTrace, candidates, textCache = new Map(), options = {}) {
  const { invoke, log = () => {}, maxRounds = 2, maxBreakpoints = 2 } = options;
  const trace = routeRelationTrace(project, routeTrace, candidates, textCache);
  if (typeof invoke !== 'function' || !trace.walls.length) return trace.relations;
  const reached = new Set(trace.relations.map(relation => relation.candidateFile));
  const strongUnreached = (candidates || [])
    .filter(candidate => candidateHasStrongEvidence(candidate) && !reached.has(candidate.file))
    .map(candidate => candidate.file);
  if (!strongUnreached.length) return trace.relations;
  const fileMap = buildFileMap(project);
  const { resolveBreakpoint } = require('./breakpoint-resolver'); // 懒加载，避免潜在环
  const added = [];
  let budget = maxBreakpoints;
  for (const wall of trace.walls) {
    if (budget <= 0) break;
    const targets = strongUnreached.filter(target => !reached.has(target)
      && wall.unfollowed.some(item => importReaches(project, item.file, target, fileMap, textCache, 3)));
    if (!targets.length) continue;
    budget -= 1;
    const wallObj = fileMap.get(wall.file);
    const wallText = wallObj ? readProjectText(project, wallObj, textCache) : '';
    const result = await resolveBreakpoint({
      project,
      textCache,
      wallFile: wall.file,
      wallSnippet: makeSnippet(wallText, 0, 0).slice(0, 1600),
      unresolvedImports: wall.unfollowed.map(item => ({ specifier: item.specifier, resolvedFile: item.file })),
      targetCandidates: targets,
      chain: wall.chain,
    }, { invoke, log, maxRounds });
    log(`断点解析 @ ${wall.file}：${result.resolved ? `→ ${result.file}` : `未定(${result.reason})`}`);
    if (result.resolved && strongUnreached.includes(result.file) && !reached.has(result.file)) {
      reached.add(result.file);
      added.push({
        candidateFile: result.file,
        routeFile: wall.chain[0],
        depth: wall.depth + 1,
        chain: [...wall.chain, result.file],
        via: 'breakpoint',
      });
    }
  }
  if (!added.length) return trace.relations;
  return [...trace.relations, ...added]
    .sort((a, b) => a.depth - b.depth || a.candidateFile.localeCompare(b.candidateFile));
}

module.exports = {
  buildSourceRelationGraph,
  consumedProps,
  exportedSymbols,
  relationGraphComposite,
  relationGraphHits,
  reverseOwners,
  routeRelationTrace,
  routeComponentRelations,
  augmentRouteRelationsWithBreakpoints,
};

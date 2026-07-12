const { readProjectText } = require('../../core/fs-utils');
const { escapeRegExp, makeSnippet, uniq } = require('../../utils');
const {
  MAX_EXCERPT_CHARS,
  MAX_INHERITED_KEYWORDS,
  selectionList,
  selectionMarkup,
  parseHtmlLite,
  classTokens,
} = require('./dom-utils');
const { inheritedSearchKeywords } = require('./planner-utils');
const {
  keywordIndexesForSearch,
  searchLayer,
} = require('./search-executor');

// 字符偏移 → 1 基 line:column。
function offsetToLineColumn(text, offset) {
  const clamped = Math.max(0, Math.min(String(text).length, Number(offset) || 0));
  const before = String(text).slice(0, clamped);
  const line = before.split('\n').length;
  const column = clamped - before.lastIndexOf('\n');
  return { line, column };
}

// 收集计划里各关键词在文件中的所有命中偏移（按各自的匹配器：class/attr/style/text/literal）。
function collectPlanKeywordOffsets(text, searches, filePath) {
  const map = new Map();
  for (const search of searches || []) {
    for (const keyword of search.keywords || []) {
      const offsets = keywordIndexesForSearch(text, keyword, search, filePath);
      if (offsets.length) map.set(keyword, uniq([...(map.get(keyword) || []), ...offsets]));
    }
  }
  return map;
}

// 原始选区的稳定锚点：扩区时前端全程保持不变地带回来（即使中间某轮 Planner 返回 need-more、计划为空，
// 也不会丢），保证「细定位」永远能回到用户最初选的那一处，而不是退化成扩区大区域的质心。
function focusAnchorsFromState(agentState) {
  const raw = Array.isArray(agentState?.focusAnchors) ? agentState.focusAnchors : [];
  return uniq(raw.map(value => String(value || '').trim()).filter(value => value.length >= 2))
    .slice(0, MAX_INHERITED_KEYWORDS);
}

// 收敛后「细定位」：文件已确定，回到「原始选区最具体的锚点」在该文件里的精确位置。
//  · 聚焦优先级：显式 focusAnchors（前端全程保持的原始选区锚点）> 上一轮继承锚点 > render 层锚点。
//  · 一个锚点在文件里可能出现多次，取「离其它命中锚点簇最近」的那一次——即真正落在目标渲染结构里的那处。
//  · 返回精确 offset + line:column + 该处代码片段，供编辑器直接跳转。
function computeFineLocation(project, file, plan, agentState, textCache) {
  const fileObj = (project.files || []).find(item => item.path === file);
  if (!fileObj) return null;
  const text = readProjectText(project, fileObj, textCache);
  if (!text) return null;

  const focusFromState = focusAnchorsFromState(agentState);
  const inherited = inheritedSearchKeywords(agentState);
  const extraFocus = uniq([...focusFromState, ...inherited]);
  const searchesForOffsets = [...(plan?.searches || [])];
  if (extraFocus.length) {
    searchesForOffsets.push({
      keywords: extraFocus,
      evidenceKinds: Object.fromEntries(extraFocus.map(keyword => [keyword, 'text'])),
    });
  }
  const offsets = collectPlanKeywordOffsets(text, searchesForOffsets, file);
  if (!offsets.size) return null;

  const renderKeywords = (plan?.searches || [])
    .filter(search => searchLayer(search) === 'render')
    .flatMap(search => search.keywords || []);
  const focusPriority = focusFromState.length
    ? focusFromState
    : (inherited.length ? inherited : renderKeywords);
  const focusKeywords = focusPriority.filter(keyword => offsets.has(keyword));

  const allOffsets = [...offsets.values()].flat();
  const contextCentroid = allOffsets.reduce((sum, value) => sum + value, 0) / allOffsets.length;

  let bestOffset;
  let anchor = '';
  if (focusKeywords.length) {
    const focusOffsets = focusKeywords.flatMap(keyword => offsets.get(keyword).map(offset => ({ keyword, offset })));
    const others = [...offsets.entries()]
      .filter(([keyword]) => !focusKeywords.includes(keyword))
      .flatMap(([, list]) => list);
    const pick = focusOffsets.reduce((best, item) => {
      const distance = others.length
        ? Math.min(...others.map(other => Math.abs(other - item.offset)))
        : Math.abs(item.offset - contextCentroid);
      return distance < best.distance ? { ...item, distance } : best;
    }, { offset: focusOffsets[0].offset, keyword: focusOffsets[0].keyword, distance: Infinity });
    bestOffset = pick.offset;
    anchor = pick.keyword;
  } else {
    bestOffset = Math.round(contextCentroid);
  }

  const { line, column } = offsetToLineColumn(text, bestOffset);
  return { file, offset: bestOffset, line, column, anchor, snippet: makeSnippet(text, bestOffset, 0) };
}

// 把细定位结果写回主渲染命中与 composite.render（供前端跳转到精确行）。
// 在源码里从一个开标签位置起，做同名标签配平，返回该元素 [start,end) 偏移。
function matchElementSpan(text, openIdx, tag) {
  const pattern = new RegExp(`<${escapeRegExp(tag)}\\b|</${escapeRegExp(tag)}\\s*>`, 'gi');
  pattern.lastIndex = openIdx;
  let depth = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match[0][1] === '/') {
      depth -= 1;
      if (depth === 0) return { start: openIdx, end: match.index + match[0].length };
    } else {
      const gt = text.indexOf('>', match.index);
      if (gt === -1) return null;
      if (text[gt - 1] !== '/') depth += 1;
      pattern.lastIndex = gt + 1;
    }
    if (depth < 0) return null;
  }
  return null;
}

// script/style/template 是「语言区域分隔标签」（其内容分别是 JS/CSS/HTML），本身不是要对齐的 DOM 节点，跳过。
const REGION_DELIMITER_TAG = /^(?:script|style|template)$/i;

function allOccurrences(text, value) {
  const out = [];
  let from = 0;
  while (out.length < 50) {
    const index = text.indexOf(value, from);
    if (index === -1) break;
    out.push(index);
    from = index + Math.max(1, value.length);
  }
  return out;
}

// 引号感知的括号配平：从 open 起找到匹配的 close，跳过字符串/模板串里的括号
// （如 style 里的 cubic-bezier(.4, 0, .2, 1) 不应被当成语法括号）。
function matchBalancedSpan(text, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === quote) break;
        i += 1;
      }
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return { start: openIdx, end: i + 1 };
    }
  }
  return null;
}
function matchParenSpan(text, openIdx) {
  return matchBalancedSpan(text, openIdx, '(', ')');
}

// 包含某位置的所有 open/close 配平块（{…} 函数体/对象、[…] 数组）。引号感知，跳过字符串内的括号。
function bracketSpansContaining(text, pos, open, close) {
  const spans = [];
  let scanned = 0;
  for (let i = 0; i <= pos && i < text.length; i += 1) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      i += 1;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === c) break;
        i += 1;
      }
      continue;
    }
    if (c !== open) continue;
    scanned += 1;
    if (scanned > 4000) break;
    const span = matchBalancedSpan(text, i, open, close);
    if (span && span.end > pos) spans.push(span);
    if (spans.length > 300) break;
  }
  return spans;
}

// 包含某位置的所有 HTML 标签元素（可选：切片须字面含全部 texts）。HTML 标签形态涵盖 Vue template / JSX / 原生 HTML。
function elementSpansContaining(text, pos, texts = []) {
  const openPattern = /<([A-Za-z][\w-]*)\b[^>]*?>/g;
  const spans = [];
  let match;
  let scanned = 0;
  while ((match = openPattern.exec(text)) && scanned < 4000) {
    scanned += 1;
    if (match.index > pos) break;
    if (/\/>\s*$/.test(match[0]) || REGION_DELIMITER_TAG.test(match[1])) continue;
    const span = matchElementSpan(text, match.index, match[1]);
    if (span && span.start <= pos && span.end >= pos) {
      const slice = text.slice(span.start, span.end);
      if (texts.every(value => slice.includes(value))) spans.push(span);
    }
    if (spans.length > 200) break;
  }
  return spans;
}

// 包含某位置的所有 JS 渲染调用（可选：切片须字面含全部 texts）。渲染调用形态涵盖 Vue render / React / JSX 产物。
const RENDER_CALL_RE = /(?<![\w.$])(?:h|createElement|jsx|jsxs|_jsx|_jsxs)\s*\(|(?<![\w$])React\.createElement\s*\(/g;
function renderCallSpansContaining(text, pos, texts = []) {
  RENDER_CALL_RE.lastIndex = 0;
  const spans = [];
  let match;
  let scanned = 0;
  while ((match = RENDER_CALL_RE.exec(text)) && scanned < 8000) {
    scanned += 1;
    const callStart = match.index;
    if (callStart > pos) break;               // 之后的调用都起始于 pos 之后，不可能包含它
    const span = matchParenSpan(text, callStart + match[0].length - 1);
    if (span && span.end > pos) {
      const slice = text.slice(callStart, span.end);
      if (texts.every(value => slice.includes(value))) spans.push({ start: callStart, end: span.end });
    }
    if (spans.length > 400) break;
  }
  return spans;
}

// 包含某位置、且切片字面含全部锚点的最小 DOM 节点表达（标签或渲染调用，取更小）。
function smallestUnitContainingAllAt(text, pos, anchors) {
  const spans = [...elementSpansContaining(text, pos, anchors), ...renderCallSpansContaining(text, pos, anchors)];
  spans.sort((a, b) => (a.end - a.start) - (b.end - b.start));
  return spans[0] || null;
}

// 本地判定 exact 的「诚实门槛」：一组锚点是否「唯一、无歧义」地钉住一个 DOM 节点表达。
// 以最稀有锚点的每个出现位置为锚，取「含全部锚点的最小 DOM 单元」，去重后必须只剩唯一一个才算钉住。
// 多义（同名文案出现多处等）一律不算 —— 交给 LLM，而不是本地硬凑一个。
function uniquePinnedSpan(text, anchors) {
  if (!anchors.length) return null;
  const withPositions = anchors.map(value => ({ value, positions: allOccurrences(text, value) }));
  if (withPositions.some(item => !item.positions.length)) return null;   // 有锚点根本不在源码 → 不算钉住
  const rarest = withPositions.slice().sort((a, b) => a.positions.length - b.positions.length)[0];
  const found = [];
  const seen = new Set();
  for (const pos of rarest.positions) {
    const span = smallestUnitContainingAllAt(text, pos, anchors);
    if (!span) continue;
    const key = `${span.start}:${span.end}`;
    if (!seen.has(key)) { seen.add(key); found.push(span); }
  }
  return found.length === 1 ? found[0] : null;
}

// 拿不准时交给 LLM 的「上下文区域」：包含某位置、长度不超过 cap 的「最大」配平单元。
// 除了标签/渲染调用，还纳入 {…}/[…] 块（如整个 render 函数体/列配置），这样即使定位点被兄弟带偏，
// 仍能把兄弟邻域一并带上（如 ¥3 那格里同时看到 ¥itemCost / ¥expressCost / 查看），供 LLM 结构对齐。
function enclosingRegionAt(text, pos, cap) {
  const spans = [
    ...elementSpansContaining(text, pos),
    ...renderCallSpansContaining(text, pos),
    ...bracketSpansContaining(text, pos, '{', '}'),
    ...bracketSpansContaining(text, pos, '[', ']'),
  ];
  if (!spans.length) return null;
  const underCap = spans.filter(span => span.end - span.start <= cap);
  if (underCap.length) return underCap.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
  return spans.sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
}

// 包含整个 [lo,hi] 区间的「最小」配平块（元素 / 渲染调用 / {…} / […]，长度 ≤ cap）。
function smallestBlockContainingRange(text, lo, hi, cap) {
  const spans = [
    ...elementSpansContaining(text, lo),
    ...renderCallSpansContaining(text, lo),
    ...bracketSpansContaining(text, lo, '{', '}'),
    ...bracketSpansContaining(text, lo, '[', ']'),
  ].filter(span => span.start <= lo && span.end >= hi && (span.end - span.start) <= cap);
  spans.sort((a, b) => (a.end - a.start) - (b.end - b.start));
  return spans[0] || null;
}

// 按「容器锚点」（如选区所在列的 data-col-key 值 cost）定位选区大致所在的源码区块。
// 容器标识在源码里往往在「它的定义/渲染块」内密集出现（cost 列的配置里同时有 key:'cost'/itemCost/expressCost/handleViewCost）：
// 取密度最高的那簇，返回「恰好包住整簇的最小配平块」（= 那一列的配置对象/渲染块，而不是整个 columns 数组）。
// 这样即使选区自身没有锚点，也能把 LLM 引到正确的那一列区块里去判定。成功返回 { snippet, startLine, endLine }。
function regionByContainerAnchors(project, file, anchors, textCache) {
  const fileObj = (project.files || []).find(item => item.path === file);
  if (!fileObj) return null;
  const text = readProjectText(project, fileObj, textCache);
  if (!text) return null;
  const present = uniq((Array.isArray(anchors) ? anchors : [])
    .map(value => String(value || '').trim())
    .filter(value => value.length >= 2 && text.includes(value)));
  if (!present.length) return null;
  const positions = [];
  for (const value of present) for (const pos of allOccurrences(text, value)) positions.push(pos);
  if (!positions.length) return null;
  let best = positions[0];
  let bestCount = -1;
  for (const pos of positions) {
    const count = positions.filter(other => Math.abs(other - pos) <= 1200).length;
    if (count > bestCount) { bestCount = count; best = pos; }
  }
  const cluster = positions.filter(pos => Math.abs(pos - best) <= 1200);
  const lo = Math.min(...cluster);
  const hi = Math.max(...cluster);
  const region = smallestBlockContainingRange(text, lo, hi, MAX_EXCERPT_CHARS)
    || enclosingRegionAt(text, best, MAX_EXCERPT_CHARS);
  if (!region) return null;
  return {
    snippet: text.slice(region.start, region.end),
    startLine: offsetToLineColumn(text, region.start).line,
    endLine: offsetToLineColumn(text, region.end).line,
  };
}

// DOM 对齐的源码「修改范围」，带诚实置信度。
// DOM 是最终产物：源码无论写成 HTML 标签形态（<div>…，涵盖 Vue template/JSX/原生 HTML）还是
// JS 渲染调用形态（h('div',…)/createElement/jsx），描述的都是同一个 DOM 节点；两种形态统一处理。
// 三档诚实分流（只认「原始选区自身」的锚点，扩区带进来的兄弟文案绝不作数）：
//   · exact：原始选区锚点在源码里「唯一、无歧义」钉住一个 DOM 节点 → 本地权威定位，后链路可直接用；
//   · approximate：原始选区有锚点但多义/动态 → 定位点已被原始锚点锚定，回「含兄弟邻域的 render 区域」交 LLM 对齐；
//   · unlocated：原始选区没有任何能命中源码的锚点（如纯运行时数值 ¥3）→ 本地无法可靠定位。
//     此时绝不用扩区后的选区/整行检索词硬凑一个区域（那会漂到别的列，误导后链路），
//     而是明确告诉后链路「没定位到」，让变更计划 LLM 依据原始选区身份(值/样式/所在容器)+完整文件自己定位。
// 返回 { alignment, needsAlign, startLine, endLine, snippet }；file 读不到时返回 null。
function computeSourceScope(project, file, body, textCache, location, focusAnchors = []) {
  const fileObj = (project.files || []).find(item => item.path === file);
  if (!fileObj) return null;
  const text = readProjectText(project, fileObj, textCache);
  if (!text) return null;

  const unlocated = { alignment: 'unlocated', needsAlign: true, startLine: 0, endLine: 0, snippet: '' };
  const originAnchors = uniq((Array.isArray(focusAnchors) ? focusAnchors : [])
    .map(value => String(value || '').trim())
    .filter(value => value.length >= 2 && text.includes(value)));
  if (!originAnchors.length) return unlocated;   // 原始选区无可命中锚点 → 不硬凑，交给 LLM

  const pinned = uniquePinnedSpan(text, originAnchors);
  if (pinned) {
    const snippet = text.slice(pinned.start, pinned.end);
    return {
      alignment: 'exact',
      needsAlign: false,
      startLine: offsetToLineColumn(text, pinned.start).line,
      endLine: offsetToLineColumn(text, pinned.end).line,
      snippet: snippet.length > MAX_EXCERPT_CHARS ? snippet.slice(0, MAX_EXCERPT_CHARS) : snippet,
    };
  }

  // 有锚点但多义/动态：定位点已被原始锚点锚定，取含邻域的区域交 LLM。
  if (!location || !Number.isInteger(location.offset)) return unlocated;
  const region = enclosingRegionAt(text, location.offset, MAX_EXCERPT_CHARS);
  if (!region) return unlocated;
  return {
    alignment: 'approximate',
    needsAlign: true,
    startLine: offsetToLineColumn(text, region.start).line,
    endLine: offsetToLineColumn(text, region.end).line,
    snippet: text.slice(region.start, region.end),
  };
}

function attachFineLocation(result, project, plan, agentState, textCache, body = null) {
  const file = result?.composite?.render?.file || result?.hits?.[0]?.file;
  if (!file || !plan) return result;
  const explicitFocusAnchors = focusAnchorsFromState(agentState || body?.agentState || null);
  const location = computeFineLocation(project, file, plan, agentState, textCache);
  const scope = computeSourceScope(project, file, body, textCache, location, explicitFocusAnchors);
  if (!location && !scope) return result;
  const topHit = (result.hits || []).find(hit => hit.file === file);
  if (topHit) {
    const originUnlocated = explicitFocusAnchors.length > 0 && scope?.alignment === 'unlocated';
    if (location && !originUnlocated) {
      topHit.line = location.line;
      topHit.column = location.column;
      topHit.preciseOffset = location.offset;
      topHit.locatedAnchor = location.anchor;
    }
    // DOM 对齐范围优先作为精确片段（= 修改范围）；对不齐时退回 fine-location 的锚点片段。
    if (scope) {
      topHit.preciseSnippet = scope.snippet;
      topHit.scopeStartLine = scope.startLine;
      topHit.scopeEndLine = scope.endLine;
      topHit.scopeAlignment = scope.alignment;   // 'exact' | 'approximate'：告知后链路该范围可信度
      topHit.scopeNeedsAlign = !!scope.needsAlign; // approximate 时为 true：该片段是待对齐区域，非精确节点
      if (originUnlocated) {
        delete topHit.line;
        delete topHit.column;
        delete topHit.preciseOffset;
        delete topHit.locatedAnchor;
      } else if (!location) {
        topHit.line = scope.startLine;
      }
    } else if (location?.snippet) {
      topHit.preciseSnippet = location.snippet;
      topHit.scopeAlignment = 'approximate';     // 仅锚点附近片段，非 DOM 对齐，弱证据
      topHit.scopeNeedsAlign = true;
    }
  }
  if (result.composite && result.composite.render && result.composite.render.file === file) {
    const originUnlocated = explicitFocusAnchors.length > 0 && scope?.alignment === 'unlocated';
    if (location && !originUnlocated) {
      result.composite.render.line = location.line;
      result.composite.render.column = location.column;
      result.composite.render.anchor = location.anchor;
    }
    if (scope) {
      result.composite.render.scopeStartLine = scope.startLine;
      result.composite.render.scopeEndLine = scope.endLine;
      result.composite.render.scopeAlignment = scope.alignment;
      result.composite.render.scopeNeedsAlign = !!scope.needsAlign;
      if (originUnlocated) {
        delete result.composite.render.line;
        delete result.composite.render.column;
        delete result.composite.render.anchor;
      }
    }
  }
  return result;
}

module.exports = {
  offsetToLineColumn,
  focusAnchorsFromState,
  computeFineLocation,
  computeSourceScope,
  regionByContainerAnchors,
  attachFineLocation,
};

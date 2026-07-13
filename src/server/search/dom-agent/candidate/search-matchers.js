const path = require('path');
const { isTextFile } = require('../../../core/fs-utils');
const { escapeRegExp, uniq } = require('../../../utils');
const {
  MAX_KEYWORD_INDEXES,
  STYLE_EXTENSIONS,
} = require('../anchor/dom-utils');

function sourceFiles(project) {
  return (project.files || []).filter(file => isTextFile(file.path));
}

function keywordIndexes(text, keyword) {
  const indexes = [];
  const lowerText = String(text || '').toLowerCase();
  const needle = String(keyword || '').toLowerCase();
  if (!needle) return indexes;
  let from = 0;
  while (indexes.length < MAX_KEYWORD_INDEXES) {
    const index = lowerText.indexOf(needle, from);
    if (index === -1) break;
    indexes.push(index);
    from = index + Math.max(1, needle.length);
  }
  return indexes;
}

function classTokenIndexes(text, keyword, filePath = '') {
  const source = String(text || '');
  const value = String(keyword || '').trim();
  if (!source || !value) return [];
  const indexes = [];
  const escaped = escapeRegExp(value);
  const ext = path.posix.extname(filePath || '').toLowerCase();
  const patterns = [
    new RegExp(`\\bclass(?:Name)?\\s*=\\s*["'][^"']*(?<![\\w-])${escaped}(?![\\w-])[^"']*["']`, 'gi'),
    new RegExp(`\\bclass(?:Name)?\\s*:\\s*["'\`][^"'\`]*(?<![\\w-])${escaped}(?![\\w-])[^"'\`]*["'\`]`, 'gi'),
    new RegExp(`\\bclass(?:Name)?\\s*:\\s*[\\[{][\\s\\S]{0,220}(?<![\\w-])["'\`]?${escaped}["'\`]?(?![\\w-])`, 'gi'),
    new RegExp(`['"]class['"]\\s*:\\s*["'\`][^"'\`]*(?<![\\w-])${escaped}(?![\\w-])[^"'\`]*["'\`]`, 'gi'),
    new RegExp(`h\\([^\\n]{0,220}\\bclass\\s*:\\s*[\\s\\S]{0,220}(?<![\\w-])["'\`]?${escaped}["'\`]?(?![\\w-])`, 'gi'),
    // 绑定类表达式里以「带引号的字符串字面量」出现的类名：
    //   :class="{ 'dom-list': true }" / :class="['dom-list', x]" / :class="ok ? 'dom-list' : ''"
    //   className={clsx('dom-list', ...)} 等（Vue :class / v-bind:class / React clsx/classnames 通用）。
    new RegExp(`(?::|v-bind:)?class(?:Name)?\\s*=\\s*["'{\\[][\\s\\S]{0,300}?(?<![\\w-])["'\`]${escaped}["'\`](?![\\w-])`, 'gi'),
    new RegExp(`classnames?\\s*\\([\\s\\S]{0,300}?(?<![\\w-])["'\`]${escaped}["'\`](?![\\w-])`, 'gi'),
    new RegExp(`\\bclsx\\s*\\([\\s\\S]{0,300}?(?<![\\w-])["'\`]${escaped}["'\`](?![\\w-])`, 'gi'),
  ];
  if (STYLE_EXTENSIONS.has(ext)) {
    patterns.push(new RegExp(`(^|[\\s,{>+~])\\.${escaped}(?![\\w-])`, 'g'));
  }
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) && indexes.length < 20) {
      const index = match.index + Math.max(0, match[0].indexOf(value));
      indexes.push(index);
    }
  }
  return uniq(indexes).sort((a, b) => a - b);
}

function attributePairIndexes(text, pair) {
  const source = String(text || '');
  const key = String(pair?.key || '').trim();
  const value = String(pair?.value || '').trim();
  if (!source || !key || !value) return [];
  const escapedKey = escapeRegExp(key);
  const escapedValue = escapeRegExp(value);
  const patterns = [
    new RegExp(`(?:^|[\\s<{])(?::)?${escapedKey}\\s*=\\s*["'][^"']*${escapedValue}[^"']*["']`, 'gmi'),
    new RegExp(`["'\`]${escapedKey}["'\`]\\s*:\\s*["'\`][^"'\`]*${escapedValue}[^"'\`]*["'\`]`, 'gmi'),
  ];
  const indexes = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) && indexes.length < 20) {
      indexes.push(match.index);
    }
  }
  return uniq(indexes).sort((a, b) => a - b);
}

function attributeTokenIndexes(text, keyword, search, type) {
  const pairs = (search?.attributePairs || []).filter(pair => {
    return type === 'attribute-name'
      ? pair.key === keyword
      : pair.value === keyword;
  });
  return uniq(pairs.flatMap(pair => attributePairIndexes(text, pair))).sort((a, b) => a - b);
}

function styleTokenIndexes(text, keyword) {
  const source = String(text || '');
  const value = String(keyword || '').trim();
  if (!source || !value) return [];
  const escaped = escapeRegExp(value);
  const patterns = [
    new RegExp(`\\bstyle\\s*=\\s*["'][^"']*${escaped}[^"']*["']`, 'gi'),
    new RegExp(`(?:^|[;{]\\s*)[A-Za-z-]+\\s*:\\s*[^;}\\n]*${escaped}`, 'gmi'),
    new RegExp(`\\bstyle\\s*:\\s*(?:["'\`][^"'\`]*${escaped}|\\{[^}]*${escaped})`, 'gi'),
  ];
  const indexes = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) && indexes.length < 20) indexes.push(match.index);
  }
  return uniq(indexes).sort((a, b) => a - b);
}

function keywordType(search, keyword) {
  return search?.keywordTypes?.[keyword] || '';
}

function textEvidenceIndexes(text, keyword) {
  const source = String(text || '');
  const value = String(keyword || '');
  if (!source || !value) return [];
  const indexes = keywordIndexes(source, value);
  const wordLike = /[\p{L}\p{N}_]/u;
  return indexes.filter(index => {
    const before = index > 0 ? source[index - 1] : '';
    const after = source[index + value.length] || '';
    const startsWord = wordLike.test(value[0] || '');
    const endsWord = wordLike.test(value[value.length - 1] || '');
    if (startsWord && before && wordLike.test(before)) return false;
    if (endsWord && after && wordLike.test(after)) return false;
    return true;
  });
}

function keywordIndexesForSearch(text, keyword, search, filePath = '') {
  const type = keywordType(search, keyword);
  if (type === 'class-token') return classTokenIndexes(text, keyword, filePath);
  if (type === 'attribute-name' || type === 'attribute-value') {
    return attributeTokenIndexes(text, keyword, search, type);
  }
  if (type === 'style-token') return styleTokenIndexes(text, keyword);
  if (search?.evidenceKinds?.[keyword] === 'text') return textEvidenceIndexes(text, keyword);
  return keywordIndexes(text, keyword);
}

function collectGroupHits(text, search, filePath = '') {
  const hits = new Map();
  for (const keyword of search.keywords) {
    const indexes = keywordIndexesForSearch(text, keyword, search, filePath);
    if (indexes.length) hits.set(keyword, indexes);
  }
  return hits;
}

function searchLayer(search) {
  if (search?.layer === 'scope' || search?.scopeOnly) return 'scope';
  if (search?.layer === 'child' || search?.childAnchor) return 'child';
  return 'render';
}

function candidateSort(a, b) {
  const scoreDiff = b.score - a.score;
  if (scoreDiff) return scoreDiff;
  const styleDiff = Number(STYLE_EXTENSIONS.has(path.posix.extname(a.file)))
    - Number(STYLE_EXTENSIONS.has(path.posix.extname(b.file)));
  if (styleDiff) return styleDiff;
  return a.file.localeCompare(b.file);
}

function bestKeywordWindow(hits, keywordOrder, maxSpread = 16000) {
  const allowed = new Set(keywordOrder || []);
  const events = [];
  for (const [keyword, indexes] of hits.entries()) {
    if (!allowed.has(keyword)) continue;
    for (const index of indexes) events.push({ keyword, index });
  }
  events.sort((a, b) => a.index - b.index);
  let best = null;
  for (let left = 0; left < events.length; left += 1) {
    const counts = new Map();
    for (let right = left; right < events.length; right += 1) {
      const event = events[right];
      if (event.index - events[left].index > maxSpread) break;
      counts.set(event.keyword, (counts.get(event.keyword) || 0) + 1);
      const keywords = keywordOrder.filter(keyword => counts.has(keyword));
      const spread = event.index - events[left].index;
      if (
        !best
        || keywords.length > best.keywords.length
        || (keywords.length === best.keywords.length && spread < best.spread)
      ) {
        const windowEvents = events.slice(left, right + 1);
        best = {
          keywords,
          positions: keywords.map(keyword => {
            return windowEvents.find(item => item.keyword === keyword)?.index;
          }).filter(Number.isFinite),
          spread,
        };
      }
    }
  }
  return best || { keywords: [], positions: [], spread: 0 };
}

module.exports = {
  sourceFiles,
  keywordIndexes,
  classTokenIndexes,
  keywordType,
  textEvidenceIndexes,
  keywordIndexesForSearch,
  collectGroupHits,
  searchLayer,
  candidateSort,
  bestKeywordWindow,
};

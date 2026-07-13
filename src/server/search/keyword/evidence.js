const {
  makeSnippet,
  tokenize,
  uniq,
} = require('../../utils');

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePhrase(value, minLength = 2) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length >= minLength ? text : '';
}

function maskCommentsPreserveLength(value) {
  const text = String(value || '');
  let result = '';
  let quote = '';
  let escaped = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1] || '';

    if (quote) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      result += char;
      continue;
    }

    if (char === '<' && text.startsWith('<!--', index)) {
      const end = text.indexOf('-->', index + 4);
      const stop = end === -1 ? text.length : end + 3;
      const raw = text.slice(index, stop);
      result += raw.replace(/[^\n\r]/g, ' ');
      index = stop - 1;
      continue;
    }

    if (char === '/' && next === '/') {
      const end = text.indexOf('\n', index + 2);
      const stop = end === -1 ? text.length : end;
      const raw = text.slice(index, stop);
      result += raw.replace(/[^\n\r]/g, ' ');
      index = stop - 1;
      continue;
    }

    if (char === '/' && next === '*') {
      const end = text.indexOf('*/', index + 2);
      const stop = end === -1 ? text.length : end + 2;
      const raw = text.slice(index, stop);
      result += raw.replace(/[^\n\r]/g, ' ');
      index = stop - 1;
      continue;
    }

    result += char;
  }
  return result;
}

function isTextContinuationChar(char) {
  return /[\p{L}\p{N}_$-]/u.test(String(char || ''));
}

function isBoundaryMatch(text, index, length, needle) {
  const value = String(needle || '');
  const first = value[0] || '';
  const last = value[value.length - 1] || '';
  const before = index > 0 ? text[index - 1] : '';
  const after = index + length < text.length ? text[index + length] : '';
  const beforeOk = !isTextContinuationChar(first) || !isTextContinuationChar(before);
  const afterOk = !isTextContinuationChar(last) || !isTextContinuationChar(after);
  return beforeOk && afterOk;
}

function findNeedleIndex(text, needle, fromIndex = 0) {
  const content = String(text || '');
  const value = String(needle || '');
  if (!content || !value) return -1;
  let index = Math.max(0, fromIndex);
  while (index < content.length) {
    const found = content.indexOf(value, index);
    if (found === -1) return -1;
    if (isBoundaryMatch(content, found, value.length, value)) return found;
    index = found + Math.max(1, value.length);
  }
  return -1;
}

function isClassContinuationChar(char) {
  return /[\p{L}\p{N}_-]/u.test(String(char || ''));
}

function isClassTokenBoundary(text, index, length) {
  const before = index > 0 ? text[index - 1] : '';
  const after = index + length < text.length ? text[index + length] : '';
  return !isClassContinuationChar(before) && !isClassContinuationChar(after);
}

function findTokenInClassContext(source, token, contextStart = 0) {
  const text = String(source || '');
  const value = String(token || '').trim();
  if (!text || !value) return -1;
  const lowerText = text.toLowerCase();
  const lowerValue = value.toLowerCase();
  let index = 0;
  while (index < lowerText.length) {
    const found = lowerText.indexOf(lowerValue, index);
    if (found === -1) return -1;
    if (value.includes(' ') || isClassTokenBoundary(text, found, value.length)) {
      return contextStart + found;
    }
    index = found + Math.max(1, value.length);
  }
  return -1;
}

function findClassTokenIndex(text, token, fromIndex = 0) {
  const content = String(text || '');
  const value = String(token || '').trim();
  if (!content || !value) return -1;
  const startAt = Math.max(0, fromIndex);
  const contexts = [];
  const pushContext = (start, body) => {
    if (start < startAt && start + String(body || '').length < startAt) return;
    const index = findTokenInClassContext(body, value, start);
    if (index >= startAt) contexts.push(index);
  };

  const quotedClassPattern = /(?:[:@])?\bclass(?:Name)?\s*=\s*(["'`])([\s\S]{0,1200}?)\1/gi;
  let match;
  while ((match = quotedClassPattern.exec(content))) {
    pushContext(match.index, match[0]);
  }

  const propClassPattern = /\bclass(?:Name)?\s*:\s*(["'`])([\s\S]{0,1200}?)\1/gi;
  while ((match = propClassPattern.exec(content))) {
    pushContext(match.index, match[0]);
  }

  const expressionClassPattern = /\bclass(?:Name)?\s*[:=]\s*[\[{][\s\S]{0,900}?[\]}]/gi;
  while ((match = expressionClassPattern.exec(content))) {
    pushContext(match.index, match[0]);
  }

  const cssSelectorPattern = new RegExp(`(^|[^\\p{L}\\p{N}_-])\\.${escapeRegExp(value)}(?![\\p{L}\\p{N}_-])`, 'giu');
  while ((match = cssSelectorPattern.exec(content))) {
    const dotOffset = match[0].lastIndexOf('.');
    const index = match.index + dotOffset + 1;
    if (index >= startAt) contexts.push(index);
  }

  return contexts.length ? Math.min(...contexts) : -1;
}

function numericStyleValue(value) {
  const matched = String(value || '').trim().match(/^(\d+(?:\.\d+)?)px$/i);
  return matched ? matched[1] : '';
}

const MEDIA_ATTR_KEYS = new Set(['src', 'srcset', 'poster', 'data-src', 'data-original', 'data-lazy-src']);
const GENERIC_STYLE_VALUES = new Set([
  'auto',
  'none',
  'normal',
  'initial',
  'inherit',
  'unset',
  'static',
  'relative',
  'block',
  'inline',
  'flex',
  'grid',
  'table',
  'visible',
  'hidden',
  'center',
  'left',
  'right',
  'top',
  'bottom',
  'transparent',
  'rgba(0, 0, 0, 0)',
  'rgba(0,0,0,0)',
]);
const USEFUL_STYLE_KEYS = new Set([
  'width',
  'height',
  'minWidth',
  'min-width',
  'maxWidth',
  'max-width',
  'objectFit',
  'object-fit',
  'borderRadius',
  'border-radius',
  'backgroundSize',
  'background-size',
  'backgroundPosition',
  'background-position',
  'fontSize',
  'font-size',
  'fontWeight',
  'font-weight',
]);

function tokenizeUrlValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const pieces = [];
  try {
    const url = new URL(raw, 'http://local.invalid');
    if (!/^https?:$/i.test(url.protocol) || url.hostname === 'local.invalid') {
      pieces.push(url.hostname || '');
    }
    pieces.push(...url.pathname.split('/'));
  } catch (error) {
    pieces.push(raw);
  }
  return uniq(
    pieces
      .flatMap(piece => tokenize(piece))
      .filter(token => token.length >= 6)
  ).slice(0, 10);
}

function sanitizeInlineStyle(value) {
  return String(value || '').replace(/url\([^)]*\)/gi, 'url([runtime])');
}

function infoResourceTokens(info, limit = 16) {
  const attrs = info?.attrs || {};
  const style = info?.computedStyle || {};
  const tokens = [];
  if (String(info?.tag || '').toLowerCase() === 'img') {
    tokens.push('img', 'image', 'src');
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (!value) continue;
    const lowerKey = key.toLowerCase();
    if (MEDIA_ATTR_KEYS.has(lowerKey)) {
      tokens.push(lowerKey, 'image', lowerKey === 'poster' ? 'poster' : 'src');
    }
    if (lowerKey === 'magnus-media' && String(value).toLowerCase() === 'image') {
      tokens.push('img', 'image', 'src');
    }
  }
  if (style.backgroundImage && style.backgroundImage !== 'none') {
    tokens.push('background-image', 'backgroundImage', 'background', 'image');
  }
  if (/background-image|url\(/i.test(String(info?.inlineStyle || ''))) {
    tokens.push('background-image', 'background', 'image');
  }
  return uniq(tokens).slice(0, limit);
}

function infoClassTokens(info, limit = 12) {
  return orderedClassTokens(info?.className, limit);
}

function orderedClassTokens(value, limit = 12) {
  return uniq(
    String(value || '')
      .split(/\s+/)
      .map(item => item.trim())
      .filter(item => {
        if (item.length < 2 || item.length > 80) return false;
        if (/^\d+$/.test(item)) return false;
        return true;
      })
  ).slice(0, limit);
}

function looksHashedClass(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/^css-[a-z0-9]{5,}$/i.test(text)) return true;
  if (/^_[a-z0-9]{5,}$/i.test(text)) return true;
  if (/[a-z]__[a-z0-9_-]+__[a-z0-9]{5,}$/i.test(text)) return true;
  if (/^[a-z0-9_-]*[a-f0-9]{7,}[a-z0-9_-]*$/i.test(text) && !/[A-Z]/.test(text)) return true;
  return false;
}

function isWeakGeneratedClass(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  return looksHashedClass(text);
}

function isIconClass(value) {
  const text = String(value || '').trim();
  return /(^|[-_])icon($|[-_])|^iconfont$|^i-/.test(text);
}

function isGenericText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > 80) return true;
  if (/^\d+(?:\.\d+)?$/.test(text)) return true;
  if (!/[\p{L}\p{N}]/u.test(text)) return true;
  return /^(true|false|null|undefined|yes|no|ok|确定|取消|编辑|删除|复制|保存|提交|关闭|更多|展开|收起)$/i.test(text);
}

function textEvidenceValues(value, limit = 10) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const pieces = raw.length <= 40
    ? [raw]
    : raw.split(/[\n\r\t,，。；;|/\\()[\]{}<>:：]+|\s{2,}/);
  return uniq(pieces
    .map(item => item.trim())
    .filter(item => !isGenericText(item)))
    .sort((a, b) => b.length - a.length)
    .slice(0, limit);
}

function isBusinessHref(value) {
  const text = String(value || '').trim();
  if (!text || text === '[present]') return false;
  if (/^(javascript:|#|mailto:|tel:)/i.test(text)) return false;
  try {
    const url = new URL(text, 'http://local.invalid');
    const path = `${url.pathname || ''}${url.hash || ''}`;
    return path.length > 1 && !/^\/?$/.test(path);
  } catch (error) {
    return /\/[\w-]+/.test(text);
  }
}

function getInfoAttr(info, key) {
  return String(info?.attrs?.[key] || '').trim();
}

function searchTextValue(info) {
  return String(info?.searchText || info?.text || '');
}

function subtreeAttrValues(info, key, limit = 6) {
  return uniq((Array.isArray(subtreeInfo(info).attrs) ? subtreeInfo(info).attrs : [])
    .filter(entry => String(entry?.key || '').toLowerCase() === String(key || '').toLowerCase())
    .map(entry => String(entry?.value || '').trim())
    .filter(Boolean))
    .slice(0, limit);
}

function businessHrefValues(info, limit = 4) {
  const values = [
    getInfoAttr(info, 'href'),
    ...subtreeAttrValues(info, 'href', limit),
  ].filter(isBusinessHref);
  return uniq(values.map(value => {
    try {
      const url = new URL(value, 'http://local.invalid');
      return `${url.pathname || ''}${url.hash || ''}` || value;
    } catch (error) {
      return value;
    }
  })).slice(0, limit);
}

function numericBridgeValues(info) {
  const values = [];
  for (const key of ['width', 'height']) {
    const attrValue = numericStyleValue(getInfoAttr(info, key));
    const computedValue = numericStyleValue(info?.computedStyle?.[key]);
    for (const value of [attrValue, computedValue]) {
      if (!value) continue;
      values.push(`${key}: ${value}`);
      values.push(`${key}:${value}`);
    }
  }
  return uniq(values).slice(0, 6);
}

function slashJoinBridgeValues(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const parts = text.split(/\s*\/\s*/).map(item => item.trim()).filter(Boolean);
  if (parts.length < 2) return [];
  if (parts.some(item => item.length > 24)) return [];
  return [
    `join(' / ')`,
    `join(" / ")`,
    `' / '`,
    `" / "`,
  ];
}

function infoTextCandidates(info, limit = 8) {
  return uniq([
    ...textEvidenceValues(searchTextValue(info), Math.min(limit, 6)),
    ...(Array.isArray(subtreeInfo(info).texts) ? subtreeInfo(info).texts : [])
      .flatMap(item => textEvidenceValues(item, 2)),
  ])
    .filter(item => item.length <= 24)
    .slice(0, limit);
}

function navLikeClassHit(info) {
  const values = [
    String(info?.className || ''),
    String(info?.selector || ''),
    ...((Array.isArray(subtreeInfo(info).classNames) ? subtreeInfo(info).classNames : []).slice(0, 10)),
  ].join(' ');
  return /(nav|menu|submenu|sidebar|sider|topnav|navbar|header|tab|tabs)/i.test(values);
}

function menuRoleHit(info) {
  const role = getInfoAttr(info, 'role');
  return /^(menu|menuitem|menubar|navigation|tab|tablist)$/i.test(role);
}

function detectSelectionKind(selection) {
  const index = Number(selection?.index || 0);
  const infos = [
    selection?.element,
    ...(selection?.element?.ancestors || []).slice(0, 2),
    selection?.asset,
  ].filter(Boolean);
  const hrefs = uniq(infos.flatMap(info => businessHrefValues(info, 2))).slice(0, 4);
  const texts = uniq(infos.flatMap(info => infoTextCandidates(info, 6))).slice(0, 8);
  const shortTexts = texts.filter(text => text.length <= 12);
  const hasNavClass = infos.some(navLikeClassHit);
  const hasMenuRole = infos.some(menuRoleHit);
  const hasIcon = infos.some(info => orderedClassTokens(info?.className, 12).some(isIconClass));

  if (hrefs.length && (hasNavClass || hasMenuRole || (hasIcon && shortTexts.length > 0))) {
    return {
      selectionIndex: index,
      kind: 'route-link-like',
      confidence: 0.95,
      reasons: uniq([
        hrefs.length ? `包含业务路由：${hrefs.join('，')}` : '',
        hasNavClass ? 'class/selector 命中 nav/menu 语义' : '',
        hasMenuRole ? 'role 命中 menu/menuitem/navigation' : '',
        hasIcon ? '同时存在业务 icon' : '',
      ].filter(Boolean)),
    };
  }

  const multiLabelText = texts.some(text => text.length <= 24 && /\s/.test(text.trim()));
  if ((hasNavClass || hasMenuRole) && (shortTexts.length >= 2 || multiLabelText)) {
    return {
      selectionIndex: index,
      kind: 'global-nav-like',
      confidence: 0.88,
      reasons: uniq([
        hasNavClass ? 'class/selector 命中 nav/menu 语义' : '',
        hasMenuRole ? 'role 命中 menu/menuitem/navigation' : '',
        shortTexts.length ? `存在多个短文案：${shortTexts.slice(0, 4).join('，')}` : '',
      ].filter(Boolean)),
    };
  }

  return {
    selectionIndex: index,
    kind: 'generic',
    confidence: 0.4,
    reasons: [],
  };
}

function selectorTailValues(selector, limit = 3) {
  return uniq(String(selector || '')
    .split('>')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(-limit)
    .flatMap(part => {
      const values = [];
      const classMatches = Array.from(part.matchAll(/\.([a-zA-Z0-9_-]+)/g)).map(match => match[1]);
      values.push(...classMatches.filter(item => !isWeakGeneratedClass(item)).slice(0, 2));
      const idMatch = part.match(/#([a-zA-Z0-9_-]+)/);
      if (idMatch) values.push(idMatch[1]);
      return values;
    }))
    .slice(0, 6);
}

function dataAttrEntries(attrs) {
  return Object.entries(attrs || {})
    .filter(([key]) => /^data-/i.test(key) && !/^data-v-/i.test(key));
}

function styleEvidencePairs(styleValue = {}, inlineStyle = '') {
  const result = [];
  for (const [key, rawValue] of Object.entries(styleValue || {})) {
    if (!USEFUL_STYLE_KEYS.has(key)) continue;
    const value = String(rawValue || '').trim();
    if (!value || GENERIC_STYLE_VALUES.has(value.toLowerCase())) continue;
    if (/^0(?:px|%)?$/i.test(value)) continue;
    result.push(`${key}:${value}`);
  }
  const inline = String(inlineStyle || '');
  for (const part of inline.split(';')) {
    const [rawKey, ...rest] = part.split(':');
    const key = String(rawKey || '').trim();
    const value = rest.join(':').trim();
    if (!key || !value || !USEFUL_STYLE_KEYS.has(key)) continue;
    if (GENERIC_STYLE_VALUES.has(value.toLowerCase())) continue;
    result.push(`${key}:${sanitizeInlineStyle(value)}`);
  }
  return uniq(result).slice(0, 10);
}

function addStructuredEvidence(result, evidence) {
  if (evidence.kind !== 'text' && evidence.kind !== 'class' && evidence.kind !== 'icon') return;
  const value = String(evidence.value || '').replace(/\s+/g, ' ').trim();
  if (!value) return;
  if (value.length > 160) return;
  const normalized = {
    kind: evidence.kind,
    value,
    weight: Number(evidence.weight || 0),
    strong: !!evidence.strong,
    label: evidence.label || evidence.kind,
    scope: evidence.scope || '',
    selectionIndex: evidence.selectionIndex || 0,
  };
  const key = `${normalized.kind}:${normalized.value.toLowerCase()}:${normalized.scope}:${normalized.selectionIndex}`;
  const old = result.map.get(key);
  if (!old || old.weight < normalized.weight || (!old.strong && normalized.strong)) {
    result.map.set(key, normalized);
  }
}

function addNodeStructuredEvidences(result, info, options = {}) {
  if (!info) return;
  const scope = options.scope || 'self';
  const selectionIndex = options.selectionIndex || 0;
  const factor = options.factor || 1;
  const tag = String(info.tag || '').toLowerCase();
  const noTextNode = ['img', 'svg', 'button', 'i'].includes(tag) && !normalizePhrase(searchTextValue(info), 2);

  for (const text of textEvidenceValues(searchTextValue(info), noTextNode ? 2 : 8)) {
    addStructuredEvidence(result, {
      kind: 'text',
      value: text,
      weight: Math.round((noTextNode ? 30 : 96) * factor),
      strong: !noTextNode,
      label: `${options.label || '选区'}文案`,
      scope,
      selectionIndex,
    });
  }

  for (const cls of infoClassTokens(info, 16)) {
    const icon = isIconClass(cls);
    const weakGenerated = isWeakGeneratedClass(cls);
    addStructuredEvidence(result, {
      kind: icon ? 'icon' : 'class',
      value: cls,
      weight: Math.round((icon ? 92 : weakGenerated ? 12 : noTextNode ? 86 : 72) * factor),
      strong: icon || !weakGenerated,
      label: weakGenerated ? `${options.label || '选区'}生成类名` : `${options.label || '选区'}class`,
      scope,
      selectionIndex,
    });
  }

  const subtree = subtreeInfo(info);
  const classValues = Array.isArray(subtree.classNames) ? subtree.classNames : subtree.class;
  for (const cls of (Array.isArray(classValues) ? classValues : []).slice(0, 24)) {
    if (!cls) continue;
    const icon = isIconClass(cls);
    const weakGenerated = isWeakGeneratedClass(cls);
    addStructuredEvidence(result, {
      kind: icon ? 'icon' : 'class',
      value: cls,
      weight: Math.round((icon ? 76 : weakGenerated ? 8 : 58) * factor),
      strong: icon || !weakGenerated,
      label: `${options.label || '选区'}向下 class`,
      scope,
      selectionIndex,
    });
  }
  const textValues = Array.isArray(subtree.texts) ? subtree.texts : subtree.text;
  for (const text of (Array.isArray(textValues) ? textValues : []).flatMap(item => textEvidenceValues(item, 3)).slice(0, 16)) {
    addStructuredEvidence(result, {
      kind: 'text',
      value: text,
      weight: Math.round(68 * factor),
      strong: true,
      label: `${options.label || '选区'}向下文案`,
      scope,
      selectionIndex,
    });
  }
}

function addBridgeStructuredEvidences(result, info, options = {}) {
  if (!info) return;
  const scope = options.scope || 'self';
  const selectionIndex = options.selectionIndex || 0;
  const factor = options.factor || 1;
  const dataColKey = getInfoAttr(info, 'data-col-key');
  const bridgeValues = [];

  if (/^[a-zA-Z0-9_.-]{2,40}$/.test(dataColKey)) {
    bridgeValues.push(
      `key: '${dataColKey}'`,
      `key: "${dataColKey}"`,
      `dataIndex: '${dataColKey}'`,
      `dataIndex: "${dataColKey}"`
    );
  }

  for (const href of businessHrefValues(info, 4)) {
    bridgeValues.push(href);
  }

  for (const dimension of numericBridgeValues(info)) {
    bridgeValues.push(dimension);
  }

  for (const text of infoTextCandidates(info, 4)) {
    bridgeValues.push(...slashJoinBridgeValues(text));
  }

  for (const value of uniq(bridgeValues).slice(0, 16)) {
    addStructuredEvidence(result, {
      kind: 'text',
      value,
      weight: Math.round((value.startsWith('key:') || value.startsWith('dataIndex:') ? 118 : value.startsWith('/') ? 104 : value.includes('join(') ? 96 : 44) * factor),
      strong: value.startsWith('key:') || value.startsWith('dataIndex:') || value.startsWith('/') || value.includes('join('),
      label: `${options.label || '选区'}桥接证据`,
      scope,
      selectionIndex,
    });
  }
}

function extractStructuredEvidences(body, selections, selectionInstructions) {
  const result = { map: new Map() };

  for (const selection of selections) {
    const index = Number(selection.index || 0);
    const instruction = selectionInstructions.get(index) || '';
    addNodeStructuredEvidences(result, selection.element, {
      scope: 'self',
      selectionIndex: index,
      factor: 1,
      label: '当前选区',
    });
    addBridgeStructuredEvidences(result, selection.element, {
      scope: 'self',
      selectionIndex: index,
      factor: 1,
      label: '当前选区',
    });
    for (const ancestor of (selection.element?.ancestors || []).slice(0, 4)) {
      addNodeStructuredEvidences(result, ancestor, {
        scope: 'ancestor',
        selectionIndex: index,
        factor: 0.62,
        label: '父级扩区',
      });
      addBridgeStructuredEvidences(result, ancestor, {
        scope: 'ancestor',
        selectionIndex: index,
        factor: 0.62,
        label: '父级扩区',
      });
    }
    if (selection.asset) {
      addNodeStructuredEvidences(result, selection.asset, {
        scope: 'asset',
        selectionIndex: index,
        factor: 0.72,
        label: '扩大选区',
      });
      addBridgeStructuredEvidences(result, selection.asset, {
        scope: 'asset',
        selectionIndex: index,
        factor: 0.72,
        label: '扩大选区',
      });
    }
  }

  return Array.from(result.map.values())
    .sort((a, b) => Number(b.strong) - Number(a.strong) || b.weight - a.weight)
    .slice(0, 120);
}

function infoTextPhrases(info, limit = 4) {
  return uniq([
    normalizePhrase(searchTextValue(info), 3),
  ].filter(Boolean)).slice(0, limit);
}

function infoTextTokens(info, limit = 18) {
  return uniq(tokenize(searchTextValue(info))).slice(0, limit);
}

function infoAttrTokens(info, limit = 16) {
  const attrs = info?.attrs || {};
  const tokens = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (!value) continue;
    const lowerKey = key.toLowerCase();
    if (MEDIA_ATTR_KEYS.has(lowerKey)) {
      tokens.push(lowerKey, 'image', lowerKey === 'poster' ? 'poster' : 'src');
      continue;
    }
    if (lowerKey === 'href') {
      tokens.push(...tokenizeUrlValue(value));
      continue;
    }
    if (lowerKey === 'width' || lowerKey === 'height') {
      continue;
    }
    if (String(value).trim() === '[present]') continue;
    tokens.push(...tokenize(value));
  }
  return uniq(tokens.filter(token => String(token || '').length >= 3)).slice(0, limit);
}

function infoStyleTokens(info, limit = 16) {
  return styleTokensFromValue(info?.computedStyle || {}, info?.inlineStyle || '', limit);
}

function styleTokensFromValue(styleValue, inlineStyle = '', limit = 16) {
  const style = styleValue || {};
  const tokens = uniq([
    style.display || '',
    style.position || '',
    style.color || '',
    style.backgroundColor || '',
    style.objectFit || '',
    style.borderRadius || '',
    style.fontSize || '',
    style.fontWeight || '',
    style.textAlign || '',
    style.padding || '',
    style.margin || '',
    style.gap || '',
    style.alignItems || '',
    style.justifyContent || '',
    style.width || '',
    style.height || '',
    style.backgroundSize || '',
    style.backgroundPosition || '',
    style.backgroundRepeat || '',
    ...(style.backgroundImage && style.backgroundImage !== 'none' ? ['background-image', 'backgroundImage', 'background', 'image'] : []),
    ...tokenize(sanitizeInlineStyle(inlineStyle).replace(/[:;]/g, ' ')),
  ].filter(Boolean));
  const widthPx = numericStyleValue(style.width);
  const heightPx = numericStyleValue(style.height);
  if (widthPx) tokens.push(`${widthPx}px`);
  if (heightPx) tokens.push(`${heightPx}px`);
  return uniq(tokens.filter(token => String(token || '').length >= 3)).slice(0, limit);
}

function subtreeInfo(info) {
  const subtree = info?.searchSubtree || info?.subtree || info?.descendants || {};
  return subtree && typeof subtree === 'object' ? subtree : {};
}

function subtreeClassTokens(info, limit = 32) {
  const subtree = subtreeInfo(info);
  const classValues = Array.isArray(subtree.classNames) ? subtree.classNames : subtree.class;
  return uniq((Array.isArray(classValues) ? classValues : [])
    .flatMap(value => orderedClassTokens(value, 4)))
    .slice(0, limit);
}

function subtreeTextPhrases(info, limit = 12) {
  const subtree = subtreeInfo(info);
  const textValues = Array.isArray(subtree.texts) ? subtree.texts : subtree.text;
  return uniq((Array.isArray(textValues) ? textValues : [])
    .map(value => normalizePhrase(value, 3))
    .filter(Boolean))
    .slice(0, limit);
}

function subtreeTextTokens(info, limit = 32) {
  const subtree = subtreeInfo(info);
  const textValues = Array.isArray(subtree.texts) ? subtree.texts : subtree.text;
  return uniq((Array.isArray(textValues) ? textValues : [])
    .flatMap(value => tokenize(value)))
    .slice(0, limit);
}

function attrEntryTokens(key, value) {
  const lowerKey = String(key || '').toLowerCase();
  const rawValue = String(value || '').trim();
  const tokens = [];
  if (!rawValue) return tokens;
  if (MEDIA_ATTR_KEYS.has(lowerKey)) {
    tokens.push(lowerKey, 'image', lowerKey === 'poster' ? 'poster' : 'src');
    return tokens;
  }
  if (lowerKey === 'magnus-media' && rawValue.toLowerCase() === 'image') {
    tokens.push('img', 'image', 'src');
    return tokens;
  }
  if (lowerKey === 'href') {
    tokens.push(...tokenizeUrlValue(rawValue));
    return tokens;
  }
  if (lowerKey !== 'width' && lowerKey !== 'height') tokens.push(...tokenize(lowerKey));
  if (rawValue !== '[present]') tokens.push(...tokenize(rawValue));
  return tokens;
}

function subtreeAttrTokens(info, limit = 28) {
  const subtree = subtreeInfo(info);
  const attrs = Array.isArray(subtree.attrs) ? subtree.attrs : [];
  const tokens = [];
  for (const entry of attrs) {
    if (!entry || typeof entry !== 'object') continue;
    tokens.push(...attrEntryTokens(entry.key, entry.value));
  }
  return uniq(tokens.filter(token => String(token || '').length >= 3)).slice(0, limit);
}

function subtreeStyleTokens(info, limit = 28) {
  const subtree = subtreeInfo(info);
  const styleValues = Array.isArray(subtree.styles) ? subtree.styles : subtree.style;
  const styles = Array.isArray(styleValues) ? styleValues : [];
  const tokens = [];
  for (const entry of styles) {
    if (!entry || typeof entry !== 'object') continue;
    const style = entry.style || entry.computedStyle || {};
    tokens.push(...styleTokensFromValue(style, style.inlineStyle || entry.inlineStyle || '', 12));
  }
  return uniq(tokens.filter(token => String(token || '').length >= 3)).slice(0, limit);
}

function subtreeResourceTokens(info, limit = 16) {
  const subtree = subtreeInfo(info);
  const tokens = [];
  for (const entry of Array.isArray(subtree.attrs) ? subtree.attrs : []) {
    if (!entry || typeof entry !== 'object') continue;
    const lowerKey = String(entry.key || '').toLowerCase();
    const value = String(entry.value || '').toLowerCase();
    if (MEDIA_ATTR_KEYS.has(lowerKey) || (lowerKey === 'magnus-media' && value === 'image')) {
      tokens.push('img', 'image', 'src', lowerKey);
    }
  }
  const styleValues = Array.isArray(subtree.styles) ? subtree.styles : subtree.style;
  for (const entry of Array.isArray(styleValues) ? styleValues : []) {
    const style = entry?.style || entry?.computedStyle || {};
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      tokens.push('background-image', 'backgroundImage', 'background', 'image');
    }
  }
  return uniq(tokens).slice(0, limit);
}

function infoSubtreeSignal(info, limits = {}) {
  return {
    classTokens: subtreeClassTokens(info, limits.classLimit ?? 32),
    classOrderTokens: subtreeClassTokens(info, limits.classOrderLimit ?? limits.classLimit ?? 32),
    textPhrases: subtreeTextPhrases(info, limits.phraseLimit ?? 12),
    textTokens: subtreeTextTokens(info, limits.textLimit ?? 32),
    attrTokens: subtreeAttrTokens(info, limits.attrLimit ?? 28),
    styleTokens: subtreeStyleTokens(info, limits.styleLimit ?? 28),
    resourceTokens: subtreeResourceTokens(info, limits.resourceLimit ?? 16),
  };
}

function infoSignal(info, limits = {}) {
  const classLimit = limits.classLimit || 24;
  const classOrderLimit = limits.classOrderLimit || classLimit;
  const phraseLimit = limits.phraseLimit || 10;
  const textLimit = limits.textLimit || 28;
  const classTokens = infoClassTokens(info, classLimit);
  const subtreeSignal = infoSubtreeSignal(info, {
    classLimit,
    classOrderLimit,
    phraseLimit,
    textLimit,
    attrLimit: 0,
    styleLimit: 0,
    resourceLimit: 0,
  });
  return {
    classTokens: uniq([...classTokens, ...subtreeSignal.classTokens]).slice(0, classLimit),
    classOrderTokens: uniq([...classTokens, ...subtreeSignal.classOrderTokens]).slice(0, classOrderLimit),
    textPhrases: uniq([...infoTextPhrases(info, phraseLimit), ...subtreeSignal.textPhrases]).slice(0, phraseLimit),
    textTokens: uniq([...infoTextTokens(info, textLimit), ...subtreeSignal.textTokens]).slice(0, textLimit),
    attrTokens: [],
    styleTokens: [],
    resourceTokens: [],
  };
}

function appendInfoSignal(target, signal) {
  target.classTokens.push(...signal.classTokens);
  target.classOrderTokens.push(...signal.classOrderTokens);
  target.textPhrases.push(...signal.textPhrases);
  target.textTokens.push(...signal.textTokens);
  target.attrTokens.push(...signal.attrTokens);
  target.styleTokens.push(...signal.styleTokens);
  target.resourceTokens.push(...signal.resourceTokens);
}

function isLikelyComponentPath(filePath) {
  return /(^|\/)(components?|widgets?|dialog|modal)\//i.test(filePath);
}

function buildSelectionLayers(selection) {
  const element = selection?.element || {};
  const asset = selection?.asset || {};
  const ancestors = Array.isArray(element.ancestors) ? element.ancestors : [];
  const layers = [];

  const aggregate = {
    classTokens: [],
    classOrderTokens: [],
    textPhrases: [],
    textTokens: [],
    attrTokens: [],
    styleTokens: [],
    resourceTokens: [],
  };

  const elementSignal = infoSignal(element);
  appendInfoSignal(aggregate, elementSignal);
  layers.push({
    scope: 'self',
    label: '当前选区',
    depth: 0,
    tag: String(element.tag || '').toLowerCase(),
    ownClassTokens: uniq(elementSignal.classTokens).slice(0, 14),
    ownClassOrderTokens: uniq(elementSignal.classOrderTokens).slice(0, 14),
    ownTextPhrases: uniq(elementSignal.textPhrases).slice(0, 6),
    ownTextTokens: uniq(elementSignal.textTokens).slice(0, 14),
    ownAttrTokens: uniq(elementSignal.attrTokens).slice(0, 16),
    ownStyleTokens: uniq(elementSignal.styleTokens).slice(0, 16),
    ownResourceTokens: uniq(elementSignal.resourceTokens).slice(0, 16),
    classTokens: uniq(aggregate.classTokens).slice(0, 14),
    classOrderTokens: uniq(aggregate.classOrderTokens).slice(0, 14),
    textPhrases: uniq(aggregate.textPhrases).slice(0, 6),
    textTokens: uniq(aggregate.textTokens).slice(0, 14),
    attrTokens: uniq(aggregate.attrTokens).slice(0, 16),
    styleTokens: uniq(aggregate.styleTokens).slice(0, 16),
    resourceTokens: uniq(aggregate.resourceTokens).slice(0, 16),
  });

  for (let index = 0; index < ancestors.length; index++) {
    const ancestorSignal = infoSignal(ancestors[index]);
    appendInfoSignal(aggregate, ancestorSignal);
    layers.push({
      scope: 'ancestor',
      label: `向上扩大 ${index + 1} 层`,
      depth: index + 1,
      tag: String(element.tag || '').toLowerCase(),
      ownClassTokens: uniq(ancestorSignal.classTokens).slice(0, 14),
      ownClassOrderTokens: uniq(ancestorSignal.classOrderTokens).slice(0, 14),
      ownTextPhrases: uniq(ancestorSignal.textPhrases).slice(0, 6),
      ownTextTokens: uniq(ancestorSignal.textTokens).slice(0, 16),
      ownAttrTokens: uniq(ancestorSignal.attrTokens).slice(0, 16),
      ownStyleTokens: uniq(ancestorSignal.styleTokens).slice(0, 12),
      ownResourceTokens: uniq(ancestorSignal.resourceTokens).slice(0, 14),
      classTokens: uniq(aggregate.classTokens).slice(0, 16),
      classOrderTokens: uniq(aggregate.classOrderTokens).slice(0, 16),
      textPhrases: uniq(aggregate.textPhrases).slice(0, 8),
      textTokens: uniq(aggregate.textTokens).slice(0, 18),
      attrTokens: uniq(aggregate.attrTokens).slice(0, 18),
      styleTokens: uniq(aggregate.styleTokens).slice(0, 18),
      resourceTokens: uniq(aggregate.resourceTokens).slice(0, 18),
    });
  }

  if (asset && (asset.className || asset.text)) {
    const assetSignal = infoSignal(asset);
    appendInfoSignal(aggregate, assetSignal);
    layers.push({
      scope: 'asset',
      label: '扩大选区',
      depth: ancestors.length + 1,
      tag: String(element.tag || '').toLowerCase(),
      ownClassTokens: uniq(assetSignal.classTokens).slice(0, 16),
      ownClassOrderTokens: uniq(assetSignal.classOrderTokens).slice(0, 16),
      ownTextPhrases: uniq(assetSignal.textPhrases).slice(0, 8),
      ownTextTokens: uniq(assetSignal.textTokens).slice(0, 20),
      ownAttrTokens: uniq(assetSignal.attrTokens).slice(0, 18),
      ownStyleTokens: uniq(assetSignal.styleTokens).slice(0, 14),
      ownResourceTokens: uniq(assetSignal.resourceTokens).slice(0, 16),
      classTokens: uniq(aggregate.classTokens).slice(0, 18),
      classOrderTokens: uniq(aggregate.classOrderTokens).slice(0, 18),
      textPhrases: uniq(aggregate.textPhrases).slice(0, 10),
      textTokens: uniq(aggregate.textTokens).slice(0, 22),
      attrTokens: uniq(aggregate.attrTokens).slice(0, 18),
      styleTokens: uniq(aggregate.styleTokens).slice(0, 18),
      resourceTokens: uniq(aggregate.resourceTokens).slice(0, 18),
    });
  }

  return layers;
}

const GROUP_WEAK_TOKENS = new Set([
  'role',
  'app',
  'index',
  'menu',
  'menuitem',
  'button',
  'true',
  'false',
  'display',
  'none',
  'hidden',
  'absolute',
  'relative',
]);

function routeLikeAttrValues(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '[present]') return [];
  const values = [];
  const cleaned = raw
    .replace(/^#/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
  if (/^\/[\w./-]{2,}$/.test(cleaned)) values.push(cleaned);
  return uniq(values).filter(item => item.length >= 6 && item !== '/app' && item !== '/index');
}

function isRuntimeAttrKey(key) {
  const lowerKey = String(key || '').toLowerCase();
  return lowerKey === 'tabindex'
    || lowerKey === 'draggable'
    || lowerKey === 'aria-describedby'
    || lowerKey.startsWith('data-rbd-')
    || lowerKey.startsWith('data-react')
    || lowerKey.startsWith('data-v-');
}

function groupAttrTokens(attrs = {}, tag = '') {
  const tokens = [];
  for (const [key, value] of Object.entries(attrs || {})) {
    const lowerKey = String(key || '').toLowerCase();
    const rawValue = String(value || '').trim();
    if (!rawValue) continue;
    if (isRuntimeAttrKey(lowerKey)) continue;
    if (lowerKey === 'role' || lowerKey.startsWith('aria-expanded') || lowerKey.startsWith('aria-haspopup')) continue;
    if (lowerKey === 'class' || lowerKey === 'style') continue;
    if (lowerKey === 'magnus-media' && rawValue === 'image') {
      tokens.push('img', 'image');
      continue;
    }
    if (MEDIA_ATTR_KEYS.has(lowerKey)) {
      tokens.push('img', 'image', lowerKey);
      continue;
    }
    if (lowerKey === 'alt' || lowerKey === 'title' || lowerKey === 'aria-label' || lowerKey === 'data-icon') {
      tokens.push(...tokenize(rawValue));
      continue;
    }
    if (lowerKey === 'href') {
      tokens.push(...routeLikeAttrValues(rawValue));
      continue;
    }
    if (lowerKey === 'id' || lowerKey === 'name') {
      tokens.push(...routeLikeAttrValues(rawValue));
      continue;
    }
    if (lowerKey.startsWith('data-')) {
      tokens.push(...routeLikeAttrValues(rawValue));
    }
  }
  if (String(tag || '').toLowerCase() === 'img') tokens.push('img', 'image');
  return uniq(tokens)
    .filter(token => token.length >= 2 && !GROUP_WEAK_TOKENS.has(token.toLowerCase()))
    .slice(0, 12);
}

function nodeSelectionGroup(node, selectionIndex, index) {
  const tag = String(node?.tag || '').toLowerCase();
  const classTokens = orderedClassTokens(node?.className, 10)
    .filter(token => !isWeakGeneratedClass(token) || isIconClass(token))
    .slice(0, 8);
  const textPhrases = textEvidenceValues(node?.text, 4).slice(0, 4);
  const textTokens = uniq(textPhrases.flatMap(text => tokenize(text))).slice(0, 8);
  const attrTokens = groupAttrTokens(node?.attrs || {}, tag);
  const styleTokens = styleTokensFromValue(node?.style || {}, node?.style?.inlineStyle || '', 8)
    .filter(token => !GROUP_WEAK_TOKENS.has(token.toLowerCase()))
    .slice(0, 8);
  const resourceTokens = tag === 'img' || attrTokens.some(token => token === 'image' || token === 'img')
    ? ['img', 'image']
    : [];
  const values = uniq([
    ...classTokens,
    ...textPhrases,
    ...textTokens,
    ...attrTokens,
    ...styleTokens,
    ...resourceTokens,
  ]).filter(value => value.length >= 2 && value.length <= 80);
  if (!values.length) return null;
  const strongValues = uniq([
    ...classTokens,
    ...textPhrases,
    ...attrTokens,
    ...resourceTokens,
  ]).filter(value => value.length >= 2 && value.length <= 80);
  if (!strongValues.length) return null;
  return {
    id: `s${selectionIndex || 0}-node-${index}`,
    selectionIndex,
    label: [
      tag || 'node',
      node?.firstClassName ? `.${node.firstClassName}` : '',
      textPhrases[0] ? ` "${textPhrases[0].slice(0, 24)}"` : '',
    ].join(''),
    tag,
    classTokens,
    textPhrases,
    textTokens,
    attrTokens,
    styleTokens,
    resourceTokens,
    values,
    strongValues,
  };
}

function buildSelectionGroups(selection) {
  const selectionIndex = Number(selection?.index || 0);
  const info = selection?.element || {};
  const subtree = info?.searchSubtree || info?.subtree || {};
  const nodes = Array.isArray(subtree.nodes) ? subtree.nodes : [];
  const groups = [];
  for (const [index, node] of nodes.entries()) {
    const group = nodeSelectionGroup(node, selectionIndex, index);
    if (group) groups.push(group);
  }
  return groups.slice(0, 24);
}

function buildSearchEvidence(body) {
  const selections = Array.isArray(body.selections) ? body.selections : [];
  const selectionInstructions = new Map(
    (Array.isArray(body.selectionInstructions) ? body.selectionInstructions : [])
      .map(item => [Number(item?.index || 0), String(item?.instruction || '')])
      .filter(item => item[0] > 0 && item[1])
  );

  const phrases = [];
  const selectionSignals = [];
  const weightedTokens = [];
  const structuredEvidences = extractStructuredEvidences(body, selections, selectionInstructions);
  const selectionKinds = selections.map(selection => detectSelectionKind(selection));
  const selectionGroups = selections.flatMap(selection => buildSelectionGroups(selection));
  const addToken = (value, weight, label) => {
    for (const token of tokenize(value)) {
      weightedTokens.push({ token, weight, label });
    }
  };
  const addClassTokens = (info, weight, label) => {
    for (const token of infoClassTokens(info, 24)) {
      weightedTokens.push({ token, weight, label });
    }
  };
  const addPhrase = (value, weight, label) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length >= 2) phrases.push({ text, weight, label });
  };
  const addSubtreeEvidence = (info, weights, labelPrefix) => {
    const signal = infoSubtreeSignal(info, {
      classLimit: 28,
      classOrderLimit: 28,
      phraseLimit: 12,
      textLimit: 28,
      attrLimit: 0,
      styleLimit: 0,
      resourceLimit: 0,
    });
    for (const token of signal.classTokens) weightedTokens.push({ token, weight: weights.classWeight, label: `${labelPrefix} class` });
    for (const text of signal.textPhrases) addPhrase(text, weights.textWeight, `${labelPrefix}文案`);
    for (const token of signal.textTokens) weightedTokens.push({ token, weight: weights.textTokenWeight, label: `${labelPrefix}文案` });
  };

  addToken(body.className, 38, 'className');
  addPhrase(body.text, 80, '选区文案');
  addToken(body.text, 24, '选区文案');
  addPhrase(body.manualEvidence, 70, '用户补充证据');
  addToken(body.manualEvidence, 30, '用户补充证据');

  for (const selection of selections) {
    addClassTokens(selection.element, 46, 'className');
    addPhrase(searchTextValue(selection.element), 90, '选区文案');
    addToken(searchTextValue(selection.element), 28, '选区文案');
    addSubtreeEvidence(selection.element, {
      classWeight: 42,
      textWeight: 64,
      textTokenWeight: 24,
    }, '选区向下');
    addClassTokens(selection.asset, 26, '扩大选区 className');
    addPhrase(searchTextValue(selection.asset), 34, '扩大选区文案');
    addToken(searchTextValue(selection.asset), 12, '扩大选区文案');
    for (const ancestor of selection.element?.ancestors || []) {
      addClassTokens(ancestor, 24, '父级 className');
      addPhrase(searchTextValue(ancestor), 42, '父级文案');
      addToken(searchTextValue(ancestor), 14, '父级文案');
      addSubtreeEvidence(ancestor, {
        classWeight: 24,
        textWeight: 38,
        textTokenWeight: 14,
      }, '父级向下');
    }

    const signal = {
      index: Number(selection.index || selectionSignals.length + 1),
      tag: String(selection.element?.tag || '').toLowerCase(),
      instructionText: '',
      instructionTokens: [],
      layers: buildSelectionLayers(selection),
    };
    if (
      signal.layers.some(layer => layer.textPhrases.length || layer.textTokens.length || layer.classTokens.length)
    ) {
      selectionSignals.push(signal);
    }
  }

  const merged = new Map();
  for (const item of weightedTokens) {
    const key = item.token.toLowerCase();
    const old = merged.get(key);
    if (!old || old.weight < item.weight) {
      merged.set(key, item);
    }
  }

  return {
    tokens: Array.from(merged.values()).slice(0, 180),
    phrases: phrases.slice(0, 80),
    selectionSignals: selectionSignals.slice(0, 24),
    selectionGroups: selectionGroups.slice(0, 48),
    structuredEvidences,
    selectionKinds: selectionKinds
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 24),
  };
}

function scoreFile(file, evidence) {
  let score = 0;
  const lowerPath = file.path.toLowerCase();
  const reasons = [];
  for (const item of evidence.tokens) {
    const lower = item.token.toLowerCase();
    if (lowerPath.includes(lower)) {
      score += lowerPath.endsWith(lower) ? item.weight + 28 : item.weight;
      reasons.push(`路径命中(${item.label})：${item.token}`);
    }
  }
  return { score, reasons };
}

function countOccurrences(lowerText, lowerNeedle, limit = 2) {
  if (!lowerText || !lowerNeedle) return 0;
  let count = 0;
  let index = 0;
  while (count < limit) {
    index = findNeedleIndex(lowerText, lowerNeedle, index);
    if (index === -1) break;
    count++;
    index += lowerNeedle.length;
  }
  return count;
}

function isExactTextCandidate(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length >= 4) return true;
  const compact = text.replace(/\s+/g, '');
  return /[\u3400-\u9fff]/u.test(compact) && compact.length >= 2 && !isGenericText(text);
}

function findBestExactTextMatch(text, evidence, searchableText = text) {
  const lowerText = String(searchableText || '').toLowerCase();
  const phrases = evidence.phrases
    .filter(phrase => phrase.label === '选区文案' || phrase.label === '用户补充证据')
    .map(phrase => ({
      label: phrase.label,
      text: String(phrase.text || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter(phrase => isExactTextCandidate(phrase.text))
    .sort((a, b) => b.text.length - a.text.length);

  let best = null;
  for (const phrase of phrases) {
    const lower = phrase.text.toLowerCase();
    const matchCount = countOccurrences(lowerText, lower, 6);
    if (matchCount < 1) continue;
    const index = findNeedleIndex(lowerText, lower);
    const current = {
      exactMatchLabel: phrase.label,
      exactMatchText: phrase.text,
      exactMatchCount: matchCount,
      exactSnippet: makeSnippet(text, index, phrase.text.length),
    };
    if (!best) {
      best = current;
      continue;
    }
    const bestPriority = best.exactMatchLabel === '用户补充证据' ? 2 : 1;
    const currentPriority = current.exactMatchLabel === '用户补充证据' ? 2 : 1;
    if (currentPriority > bestPriority) {
      best = current;
      continue;
    }
    if (currentPriority === bestPriority) {
      if (current.exactMatchCount === 1 && best.exactMatchCount !== 1) {
        best = current;
        continue;
      }
      if (current.exactMatchCount === best.exactMatchCount && current.exactMatchText.length > best.exactMatchText.length) {
        best = current;
      }
    }
  }

  if (!best) {
    return {
      exactMatchLabel: '',
      exactMatchText: '',
      exactMatchCount: 0,
      exactSnippet: '',
    };
  }
  return best;
}

function matchedTokenList(lowerText, tokens, minLength = 3, limit = 2) {
  const result = [];
  for (const token of tokens || []) {
    const value = String(token || '').trim();
    if (value.length < minLength) continue;
    if (findNeedleIndex(lowerText, value.toLowerCase()) === -1) continue;
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function matchedClassTokenList(text, tokens, minLength = 3, limit = 2) {
  const result = [];
  for (const token of tokens || []) {
    const value = String(token || '').trim();
    if (value.length < minLength) continue;
    if (findClassTokenIndex(text, value) === -1) continue;
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function matchedPhraseList(lowerText, phrases, minLength = 3, limit = 2) {
  const result = [];
  for (const phrase of phrases || []) {
    const value = normalizePhrase(phrase, minLength);
    if (!value) continue;
    if (findNeedleIndex(lowerText, value.toLowerCase()) === -1) continue;
    result.push(value);
    if (result.length >= limit) break;
  }
  return result;
}

function tagPatternIndex(text, tag) {
  const patterns = [
    `<${tag}`,
    `h('${tag}'`,
    `h("${tag}"`,
    `createelement('${tag}'`,
    `createelement("${tag}"`,
  ];
  const lowerText = String(text || '').toLowerCase();
  for (const pattern of patterns) {
    const index = findNeedleIndex(lowerText, pattern.toLowerCase());
    if (index !== -1) return { index, pattern };
  }
  return null;
}

function firstMatchedValue(text, values) {
  const lowerText = String(text || '').toLowerCase();
  for (const value of values || []) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    const index = findNeedleIndex(lowerText, raw.toLowerCase());
    if (index !== -1) return { index, value: raw };
  }
  return null;
}

function scoreSelectionContext(text, evidence, searchableText = text) {
  const lowerText = String(searchableText || '').toLowerCase();
  let best = {
    selectionIndex: 0,
    contextScore: 0,
    contextReasons: [],
    contextScope: '',
    contextLayerDepth: 0,
    strongMatchCount: 0,
    contextSnippet: '',
  };

  for (const signal of evidence.selectionSignals || []) {
    for (const layer of signal.layers || []) {
      let score = 0;
      const reasons = [];
      const classMatches = matchedClassTokenList(searchableText, layer.classTokens, 3, 4);
      const textMatches = matchedPhraseList(lowerText, layer.textPhrases, 3, 3);
      const textTokenMatches = matchedTokenList(lowerText, layer.textTokens, 3, 4)
        .filter(token => !textMatches.some(phrase => phrase.includes(token)));
      const anchorMatchCount = classMatches.length + textMatches.length + textTokenMatches.length;
      const strongMatchCount = anchorMatchCount;

      if (classMatches.length) {
        score += classMatches.length * 24;
        reasons.push(`${layer.label} className 同文件命中：${classMatches.join('、')}`);
      }
      if (textMatches.length) {
        score += textMatches.length * (layer.scope === 'self' ? 20 : 24);
        reasons.push(`${layer.label}文案同文件命中：${textMatches.join('、')}`);
      }
      if (textTokenMatches.length) {
        score += textTokenMatches.length * 16;
        reasons.push(`${layer.label}文本片段同文件命中：${textTokenMatches.join('、')}`);
      }
      if (layer.depth > 0 && anchorMatchCount > 0) {
        score += 12 + Math.min(24, layer.depth * 6);
        reasons.push(`扩大上下文后继续命中：${layer.label}`);
      }
      if (layer.scope === 'asset' && anchorMatchCount >= 2) {
        score += 18;
        reasons.push('扩大选区证据命中');
      }

      if (score > best.contextScore) {
        const snippetSource = firstMatchedValue(searchableText, [
          ...textMatches,
          ...textTokenMatches,
        ]) || (classMatches.length
          ? { index: findClassTokenIndex(searchableText, classMatches[0]), value: classMatches[0] }
          : null);
        const snippet = snippetSource
          ? makeSnippet(text, snippetSource.index, snippetSource.value.length)
          : '';
        best = {
          selectionIndex: signal.index,
          contextScore: score,
          contextReasons: reasons.slice(0, 6),
          contextScope: layer.scope,
          contextLayerDepth: layer.depth,
          strongMatchCount,
          contextSnippet: snippet,
        };
      }
    }
  }

  return best;
}

function scoreRefinementLayerText(text, layer) {
  const searchableText = maskCommentsPreserveLength(text);
  const lowerText = String(searchableText || '').toLowerCase();
  if (!lowerText || !layer) {
    return {
      matched: false,
      score: 0,
      strongMatchCount: 0,
      reasons: [],
    };
  }

  const classMatches = matchedClassTokenList(searchableText, layer.ownClassTokens || [], 3, 4);
  const textMatches = matchedPhraseList(lowerText, layer.ownTextPhrases || [], 3, 3);
  const textTokenMatches = matchedTokenList(lowerText, layer.ownTextTokens || [], 3, 5)
    .filter(token => !textMatches.some(phrase => phrase.includes(token)));
  const strongMatchCount = classMatches.length + textMatches.length + textTokenMatches.length;
  const score = (classMatches.length * 24)
    + (textMatches.length * 42)
    + (textTokenMatches.length * 18);
  const reasons = [];
  if (classMatches.length) reasons.push(`${layer.label} className 命中：${classMatches.join('、')}`);
  if (textMatches.length) reasons.push(`${layer.label}文案命中：${textMatches.join('、')}`);
  if (textTokenMatches.length) reasons.push(`${layer.label}文案 token 命中：${textTokenMatches.join('、')}`);

  return {
    matched: strongMatchCount >= 2 || (textMatches.length >= 1 && score >= 42),
    score,
    strongMatchCount,
    reasons: reasons.slice(0, 6),
  };
}

function scoreFileText(file, text, evidence) {
  const pathScore = scoreFile(file, evidence);
  let score = pathScore.score;
  const reasons = [...pathScore.reasons];
  let snippet = '';
  const searchableText = maskCommentsPreserveLength(text);
  const lowerText = String(searchableText || '').toLowerCase();
  const exactMatch = findBestExactTextMatch(text, evidence, searchableText);
  const contextMatch = scoreSelectionContext(text, evidence, searchableText);
  const exactMatchCount = exactMatch.exactMatchCount || 0;
  const exactTextLength = String(exactMatch.exactMatchText || '').trim().length;
  const uniqueExactMatch = {
    uniqueMatchLabel: exactMatchCount === 1 ? exactMatch.exactMatchLabel : '',
    uniqueMatchText: exactMatchCount === 1 ? exactMatch.exactMatchText : '',
    uniqueMatchCount: exactMatchCount === 1 ? 1 : 0,
    uniqueSnippet: exactMatchCount === 1 ? exactMatch.exactSnippet : '',
  };
  const hasContextSupport = contextMatch.contextScore >= 34;
  const needsBroaderContext = exactMatch.exactMatchLabel !== '用户补充证据' && exactTextLength > 0 && exactTextLength <= 12;
  const structuralEvidence = exactMatchCount === 0
    && contextMatch.contextScore >= 92
    && contextMatch.contextLayerDepth >= 1
    && contextMatch.strongMatchCount >= 3;
  const preciseEvidence = exactMatchCount > 0
    ? (
      exactMatch.exactMatchLabel === '用户补充证据'
        ? (exactMatchCount === 1 || contextMatch.contextScore >= 18)
        : needsBroaderContext
          ? ((exactMatchCount === 1 && contextMatch.contextScore >= 26 && contextMatch.contextLayerDepth >= 1) || (exactMatchCount > 1 && hasContextSupport))
          : ((exactMatchCount === 1 && contextMatch.contextScore >= 18) || (exactMatchCount > 1 && hasContextSupport))
    )
    : structuralEvidence;

  if (contextMatch.contextScore > 0) {
    score += Math.min(78, contextMatch.contextScore);
    reasons.push(...contextMatch.contextReasons);
  }

  if (exactMatchCount === 1) {
    if (preciseEvidence) {
      const boost = exactMatch.exactMatchLabel === '用户补充证据' ? 180 : 92;
      score += boost;
      reasons.push(`精准命中(${exactMatch.exactMatchLabel})：${exactMatch.exactMatchText.slice(0, 80)}`);
    } else {
      score += exactMatch.exactMatchLabel === '用户补充证据' ? 96 : 18;
      reasons.push(`文件内唯一文案但缺少页面上下文：${exactMatch.exactMatchText.slice(0, 80)}`);
    }
  } else if (exactMatchCount > 1 && preciseEvidence) {
    const boost = exactMatch.exactMatchLabel === '用户补充证据' ? 120 : 68;
    score += boost;
    reasons.push(`上下文精准命中(${exactMatch.exactMatchLabel})：${exactMatch.exactMatchText.slice(0, 80)}；文件内出现 ${exactMatchCount} 次`);
  } else if (structuralEvidence) {
    score += 96;
    reasons.push(`结构化精准命中：扩大到${contextMatch.contextScope === 'asset' ? '扩大选区' : '上层上下文'}后仍能稳定命中`);
  }

  if (isLikelyComponentPath(file.path) && exactMatchCount === 1 && !preciseEvidence && contextMatch.contextScore < 18) {
    score -= 42;
    reasons.push('降权：仅子组件内唯一文案，缺少当前选区上下文');
  }

  for (const phrase of evidence.phrases) {
    const lower = phrase.text.toLowerCase();
    const index = findNeedleIndex(lowerText, lower);
    if (index === -1) continue;
    score += phrase.weight;
    reasons.push(`内容命中(${phrase.label})：${phrase.text.slice(0, 80)}`);
    if (!snippet) snippet = makeSnippet(text, index, phrase.text.length);
  }

  for (const item of evidence.tokens) {
    const lower = item.token.toLowerCase();
    const isClassToken = /class/i.test(String(item.label || ''));
    const index = isClassToken
      ? findClassTokenIndex(searchableText, item.token)
      : findNeedleIndex(lowerText, lower);
    if (index === -1) continue;
    score += item.token.length >= 6 ? item.weight : Math.max(10, Math.round(item.weight * 0.65));
    reasons.push(`内容命中(${item.label})：${item.token}`);
    if (!snippet) snippet = makeSnippet(text, index, item.token.length);
  }

  if (!snippet && contextMatch.contextSnippet) snippet = contextMatch.contextSnippet;

  return {
    score,
    reasons: uniq(reasons),
    snippet,
    exactMatchLabel: exactMatch.exactMatchLabel,
    exactMatchText: exactMatch.exactMatchText,
    exactMatchCount,
    exactSnippet: exactMatch.exactSnippet,
    contextScore: contextMatch.contextScore,
    contextReasons: contextMatch.contextReasons,
    contextSelectionIndex: contextMatch.selectionIndex,
    contextScope: contextMatch.contextScope,
    contextLayerDepth: contextMatch.contextLayerDepth,
    contextStrongMatchCount: contextMatch.strongMatchCount,
    preciseEvidence,
    preciseSnippet: preciseEvidence ? (uniqueExactMatch.uniqueSnippet || exactMatch.exactSnippet || contextMatch.contextSnippet || snippet) : '',
    ...uniqueExactMatch,
  };
}

module.exports = {
  buildSearchEvidence,
  findClassTokenIndex,
  findNeedleIndex,
  maskCommentsPreserveLength,
  orderedClassTokens,
  scoreFile,
  scoreRefinementLayerText,
  scoreFileText,
};

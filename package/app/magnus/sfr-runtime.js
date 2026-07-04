(function installMagnusSfrRuntime() {
  const BOOT = window.__MAGNUS_SFR_BOOT__ || {};
  const RUNTIME_KEY = '__MAGNUS_SFR__';
  const OVERLAY_ID = 'magnus-sfr-picker-overlay';
  const BADGE_ID = 'magnus-sfr-picker-badge';
  const SELECTION_NODE_LIMIT = 80;

  if (window[RUNTIME_KEY] && typeof window[RUNTIME_KEY].destroy === 'function') {
    window[RUNTIME_KEY].destroy();
  }

  function createId(prefix) {
    const value = (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${String(value).replace(/-/g, '').slice(0, 24)}`;
  }

  function compactText(value, max = 500) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function compactMarkup(value, max = 1200) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim()
      .slice(0, max);
  }

  function extractSearchTerms(text) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    const pieces = value
      .split(/[\n\r\t,，。；;|/\\()[\]{}<>:：]+|\s{2,}/)
      .map(item => item.trim())
      .filter(Boolean);
    const result = [];
    for (const piece of pieces) {
      if (result.length >= 24) break;
      if (/^\d+$/.test(piece)) continue;
      if (/^id[:：]?\s*\d+$/i.test(piece)) continue;
      if (piece.length < 2 || piece.length > 16) continue;
      result.push(piece);
    }
    return Array.from(new Set(result));
  }

  function addEvidenceTerms(target, values, perValueLimit = 12, totalLimit = 72) {
    if (!(target instanceof Set) || target.size >= totalLimit) return;
    for (const value of values || []) {
      if (target.size >= totalLimit) break;
      for (const term of extractSearchTerms(value).slice(0, perValueLimit)) {
        target.add(term);
        if (target.size >= totalLimit) break;
      }
    }
  }

  function evidenceGrowth(baseSet, nextSet) {
    let added = 0;
    let duplicated = 0;
    for (const item of nextSet || []) {
      if (baseSet?.has(item)) duplicated++;
      else added++;
    }
    return { added, duplicated };
  }

  function getClassName(element) {
    if (!element) return '';
    const value = element.getAttribute ? element.getAttribute('class') : element.className;
    return compactText(typeof value === 'string' ? value : '', 320);
  }

  function getElementText(element, max = 320) {
    return compactText(element?.innerText || element?.textContent || '', max);
  }

  function getDirectText(element) {
    if (!element || !element.childNodes) return '';
    const text = Array.from(element.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.nodeValue || '')
      .join(' ');
    return compactText(text, 160);
  }

  function getFirstClassName(element) {
    const list = Array.from(element?.classList || []);
    return compactText(list[0] || '', 120);
  }

  function getStyleInfo(element) {
    const style = window.getComputedStyle(element);
    const hasBackgroundImage = style.backgroundImage && style.backgroundImage !== 'none';
    return {
      display: style.display,
      position: style.position,
      color: style.color,
      backgroundColor: style.backgroundColor,
      backgroundImage: hasBackgroundImage ? '[present]' : '',
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      backgroundRepeat: style.backgroundRepeat,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      textAlign: style.textAlign,
      border: style.border,
      borderRadius: style.borderRadius,
      margin: style.margin,
      padding: style.padding,
      gap: style.gap,
      alignItems: style.alignItems,
      justifyContent: style.justifyContent,
      objectFit: style.objectFit,
      width: style.width,
      height: style.height,
    };
  }

  function getSubtreeStyleEvidence(element) {
    if (!element) return null;
    const inlineStyle = compactText(element.getAttribute?.('style') || '', 240);
    const style = getStyleInfo(element);
    const result = {};
    const backgroundColor = String(style.backgroundColor || '').trim();
    const color = String(style.color || '').trim();

    if (inlineStyle) result.inlineStyle = inlineStyle;
    if (style.display && /flex|grid|table|inline-flex|inline-grid/i.test(style.display)) result.display = style.display;
    if (style.position && /absolute|fixed|sticky/i.test(style.position)) result.position = style.position;
    if (color && !/^rgb\(0,\s*0,\s*0\)$/i.test(color)) result.color = color;
    if (backgroundColor && !/^(rgba\(0,\s*0,\s*0,\s*0\)|transparent)$/i.test(backgroundColor)) result.backgroundColor = backgroundColor;
    if (style.backgroundImage && style.backgroundImage !== 'none') result.backgroundImage = '[present]';
    if (style.backgroundSize && style.backgroundSize !== 'auto') result.backgroundSize = style.backgroundSize;
    if (style.backgroundPosition && style.backgroundPosition !== '0% 0%') result.backgroundPosition = style.backgroundPosition;
    if (style.fontSize) result.fontSize = style.fontSize;
    if (style.fontWeight && !/^400$|^normal$/i.test(style.fontWeight)) result.fontWeight = style.fontWeight;
    if (style.textAlign && !/^start|left$/i.test(style.textAlign)) result.textAlign = style.textAlign;
    if (style.borderRadius && !/^0(px)?$/i.test(style.borderRadius)) result.borderRadius = style.borderRadius;
    if (style.objectFit && style.objectFit !== 'fill') result.objectFit = style.objectFit;
    if (style.width && !/^auto$/i.test(style.width)) result.width = style.width;
    if (style.height && !/^auto$/i.test(style.height)) result.height = style.height;

    return Object.keys(result).length ? result : null;
  }

  function cssPath(element) {
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && parts.length < 6) {
      const tag = node.tagName.toLowerCase();
      const firstClass = node.classList && node.classList[0] ? `.${node.classList[0]}` : '';
      parts.unshift(`${tag}${firstClass}`);
      if (node === document.body || node === document.documentElement) break;
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function getSelectorPart(element) {
    if (!element || !element.tagName) return '';
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = Array.from(element.classList || []).slice(0, 3).map(name => `.${name}`).join('');
    return `${tag}${id}${classes}`;
  }

  function getSelectorPath(element, limit = 4) {
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && parts.length < limit) {
      parts.unshift(getSelectorPart(node));
      if (node.id) break;
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function collectAttrs(element) {
    const attrs = {};
    if (!element || !element.attributes) return attrs;
    for (const attr of Array.from(element.attributes)) {
      if (!attr || !attr.name) continue;
      const name = attr.name;
      if (name === 'class' || name === 'style') continue;
      if (name.startsWith('data-') || ['role', 'type', 'href', 'src', 'alt', 'title', 'aria-label'].includes(name)) {
        attrs[name] = compactText(attr.value, 260);
      }
    }
    return attrs;
  }

  function getElementAttrs(element) {
    if (!element || !element.tagName) return {};
    const tag = element.tagName.toLowerCase();
    const attrs = {};
    const commonAttrs = ['id', 'name', 'role', 'title', 'aria-label', 'placeholder', 'href'];
    for (const key of commonAttrs) {
      const value = element.getAttribute?.(key);
      if (value) attrs[key] = compactText(value, 240);
    }
    for (const attr of Array.from(element.attributes || [])) {
      const key = String(attr.name || '').toLowerCase();
      if (!key.startsWith('data-') || /^data-v-/.test(key)) continue;
      const value = element.getAttribute?.(key);
      attrs[key] = value ? compactText(value, 240) : '[present]';
    }
    let hasMediaSource = false;
    for (const key of ['src', 'srcset', 'poster', 'data-src', 'data-original', 'data-lazy-src']) {
      const value = element.getAttribute?.(key);
      if (value) {
        attrs[key] = '[present]';
        hasMediaSource = true;
      }
    }
    if (tag === 'img') {
      if (element.currentSrc || element.src) {
        attrs.src = '[present]';
        hasMediaSource = true;
      }
      if (element.alt) attrs.alt = compactText(element.alt, 240);
      if (element.getAttribute?.('width')) attrs.width = compactText(element.getAttribute('width'), 40);
      if (element.getAttribute?.('height')) attrs.height = compactText(element.getAttribute('height'), 40);
    }
    if (tag === 'img' || hasMediaSource) attrs['magnus-media'] = 'image';
    return attrs;
  }

  function collectAncestors(element) {
    const ancestors = [];
    let node = element?.parentElement || null;
    while (node && node.nodeType === 1 && ancestors.length < 4) {
      ancestors.push({
        tag: node.tagName.toLowerCase(),
        className: node.className ? compactText(node.className, 180) : '',
        text: compactText(node.innerText || node.textContent || '', 180),
      });
      if (node === document.body || node === document.documentElement) break;
      node = node.parentElement;
    }
    return ancestors;
  }

  function collectSubtree(element) {
    const subtree = getSubtreeEvidence(element);
    return {
      class: subtree.classNames,
      text: subtree.texts,
      attrs: subtree.attrs,
      style: subtree.styles,
      nodes: subtree.nodes,
      nodeCount: subtree.nodeCount,
      truncated: subtree.truncated,
    };
  }

  function isBusinessSourceFile(file) {
    const value = String(file || '').replace(/\\/g, '/');
    if (!value) return false;
    return !/(^|\/)(node_modules|dist|build|vendor)\//i.test(value);
  }

  function componentNameFromVueType(type) {
    return type?.name || type?.__name || type?.displayName || '';
  }

  function closestElementWith(element, predicate, depth = 40) {
    let node = element || null;
    for (let i = 0; i < depth && node && node.nodeType === 1; i++) {
      try {
        if (predicate(node)) return { node, domDepth: i };
      } catch (error) {
      }
      node = node.parentElement || null;
    }
    return { node: null, domDepth: -1 };
  }

  function findVue3ComponentChain(element, depth = 20) {
    const chain = [];
    const anchor = closestElementWith(element, node => !!(node.__vueParentComponent || node.__vue_app__?._instance));
    let component = anchor.node?.__vueParentComponent || anchor.node?.__vue_app__?._instance || null;
    let fileDepth = 0;
    for (let i = 0; i < depth && component; i++) {
      const file = component.type?.__file || '';
      chain.push({
        depth: fileDepth,
        domDepth: anchor.domDepth,
        framework: 'vue3',
        name: componentNameFromVueType(component.type),
        file,
        fileDepth: file ? fileDepth : -1,
        isBusinessComponent: isBusinessSourceFile(file),
      });
      if (file) fileDepth++;
      if (fileDepth >= 3) break;
      component = component.parent || null;
    }
    return chain;
  }

  function findVue2ComponentChain(element, depth = 20) {
    const chain = [];
    const anchor = closestElementWith(element, node => !!node.__vue__);
    let vm = anchor.node?.__vue__ || null;
    let fileDepth = 0;
    for (let i = 0; i < depth && vm; i++) {
      const file = vm.$options?.__file || '';
      chain.push({
        depth: fileDepth,
        domDepth: anchor.domDepth,
        framework: 'vue2',
        name: vm.$options?.name || '',
        file,
        fileDepth: file ? fileDepth : -1,
        isBusinessComponent: isBusinessSourceFile(file),
      });
      if (file) fileDepth++;
      if (fileDepth >= 3) break;
      vm = vm.$parent || null;
    }
    return chain;
  }

  function normalizeReactFiber(value) {
    if (!value) return null;
    if (value.current) return value.current;
    if (value._internalRoot?.current) return value._internalRoot.current;
    if (value.stateNode?.current) return value.stateNode.current;
    return value;
  }

  function reactFiberFromElement(element) {
    let node = element || null;
    while (node && node.nodeType === 1) {
      const key = Object.keys(node).find(item =>
        item.startsWith('__reactFiber') ||
        item.startsWith('__reactInternalInstance') ||
        item.startsWith('__reactContainer')
      );
      if (key) return normalizeReactFiber(node[key]);
      if (node._reactRootContainer?._internalRoot?.current) return normalizeReactFiber(node._reactRootContainer._internalRoot);
      node = node.parentElement;
    }
    return null;
  }

  function fiberDisplayName(fiber) {
    const type = fiber?.elementType || fiber?.type;
    if (!type) return '';
    return type.displayName || type.name || (typeof type === 'string' ? type : '');
  }

  function findReactComponentChain(element, depth = 40) {
    const chain = [];
    let fiber = reactFiberFromElement(element);
    let fileDepth = 0;
    for (let i = 0; i < depth && fiber; i++) {
      const source = fiber._debugSource || null;
      const file = source?.fileName || '';
      const name = fiberDisplayName(fiber);
      if (file || name) {
        chain.push({
          depth: fileDepth,
          framework: 'react',
          name,
          file,
          fileDepth: file ? fileDepth : -1,
          line: source?.lineNumber || 0,
          column: source?.columnNumber || 0,
          isBusinessComponent: isBusinessSourceFile(file),
        });
        if (file) fileDepth++;
        if (fileDepth >= 3) break;
      }
      fiber = fiber.return || null;
    }
    return chain;
  }

  function inspectAngularComponent(element) {
    const ng = window.ng;
    if (!ng?.getComponent && !ng?.getOwningComponent) return null;
    const anchor = closestElementWith(element, node => {
      try {
        return !!(ng.getComponent?.(node) || ng.getOwningComponent?.(node));
      } catch (error) {
        return false;
      }
    });
    if (!anchor.node) return null;
    let component = null;
    try {
      component = ng.getComponent?.(anchor.node) || ng.getOwningComponent?.(anchor.node);
    } catch (error) {
      component = null;
    }
    if (!component) return null;
    const definition = component.constructor?.ɵcmp || component.constructor?.ɵdir || {};
    const selector = Array.isArray(definition.selectors?.[0])
      ? definition.selectors[0].join('')
      : '';
    return {
      framework: 'angular',
      componentChain: [{
        depth: 0,
        domDepth: anchor.domDepth,
        framework: 'angular',
        name: component.constructor?.name || '',
        selector,
        isBusinessComponent: false,
      }],
    };
  }

  function firstDirectLocation(chain, source) {
    // Vue 组件链只带 __file、不带 line/column（仅 React 分支会给行列），
    // 旧实现要求 line>0，导致 Vue 永远拿不到 directLocation。这里放宽为「有业务源码文件即可」，
    // 有行列时标 exact、只有文件时标 file，让 Vue 的 __file 也能直接命中源码。
    const item = (chain || []).find(entry => entry.file && entry.isBusinessComponent);
    if (!item) return null;
    const hasLine = Number(item.line || 0) > 0;
    return {
      file: item.file,
      line: item.line || 0,
      column: item.column || 0,
      confidence: hasLine ? 'exact' : 'file',
      source,
    };
  }

  function inferUiSemanticKind(element) {
    if (!element) return 'unknown';
    const marker = `${element.tagName || ''} ${getClassName(element)} ${element.getAttribute?.('role') || ''}`.toLowerCase();
    if (element.closest?.('[role="dialog"], dialog, .modal, .drawer, .n-modal, .el-dialog, .ant-modal')) return 'modal';
    if (/table|thead|tbody|tr|td|th|data-table|grid/.test(marker) || element.querySelector?.('table, thead, tbody, tr, td, th, [role="table"], [role="grid"]')) return 'table';
    if (element.querySelector?.('input, textarea, select, [contenteditable="true"]') || /form|field|input|select|checkbox|radio/.test(marker)) return 'form';
    if (/list|item|card|row/.test(marker)) return 'list';
    return 'unknown';
  }

  function extractDomFingerprint(element) {
    const texts = new Set();
    const labels = new Set();
    const inputValues = new Set();
    const inputNames = new Set();
    const attributes = new Set();
    const ids = new Set();
    const classTokens = new Set();
    const componentHints = new Set();
    const tagSequence = [];
    const dataAttributes = {};
    const queue = [element];
    let inspected = 0;
    while (queue.length && inspected < 80) {
      const node = queue.shift();
      if (!node || node.nodeType !== 1) continue;
      inspected++;
      const tag = String(node.tagName || '').toLowerCase();
      if (['script', 'style', 'noscript', 'template'].includes(tag)) continue;
      tagSequence.push(tag);
      if (node.id) ids.add(compactText(node.id, 120));
      for (const className of Array.from(node.classList || [])) {
        classTokens.add(className);
        if (/^(x-|md-|mda-|app-|biz-|page-|layout-|[a-z][\w-]*(__|--))/.test(className)) {
          componentHints.add(className);
        }
      }
      if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
        if (node.value) inputValues.add(compactText(node.value, 160));
        if (node.name) inputNames.add(compactText(node.name, 120));
      }
      for (const attr of Array.from(node.attributes || [])) {
        const name = String(attr.name || '').toLowerCase();
        if (name.startsWith('data-v-')) continue;
        if (name.startsWith('data-')) {
          dataAttributes[name] = attr.value ? compactText(attr.value, 180) : '[present]';
        }
        if (
          name === 'name' ||
          name === 'path' ||
          name === 'value' ||
          name === 'title' ||
          name === 'alt' ||
          name === 'aria-label' ||
          name === 'placeholder' ||
          name.startsWith('data-')
        ) {
          attributes.add(`${name}=${compactText(attr.value || '[present]', 160)}`);
        }
      }
      const directText = getDirectText(node);
      if (directText && directText.length <= 120) texts.add(directText);
      const allText = getElementText(node, 180);
      if (allText && allText.length <= 120) texts.add(allText);
      if (tag === 'label' || node.getAttribute?.('aria-label') || node.getAttribute?.('data-label') || /label/.test(getClassName(node))) {
        const label = compactText(node.getAttribute?.('aria-label') || node.getAttribute?.('data-label') || allText, 120);
        if (label) labels.add(label);
      }
      for (const child of Array.from(node.children || [])) {
        if (queue.length + inspected >= 80) break;
        queue.push(child);
      }
    }
    return {
      texts: Array.from(texts).slice(0, 40),
      labels: Array.from(labels).slice(0, 32),
      inputValues: Array.from(inputValues).slice(0, 24),
      inputNames: Array.from(inputNames).slice(0, 24),
      attributes: Array.from(attributes).slice(0, 48),
      ids: Array.from(ids).slice(0, 24),
      dataAttributes,
      classTokens: Array.from(classTokens).slice(0, 64),
      componentHints: Array.from(componentHints).slice(0, 32),
      tagSequence: tagSequence.slice(0, 80),
      structuralPaths: [getSelectorPath(element, 6)].filter(Boolean),
      uiSemanticKind: inferUiSemanticKind(element),
    };
  }

  function inspectSourceLocate(element) {
    const vue3Chain = findVue3ComponentChain(element);
    if (vue3Chain.length) {
      return {
        framework: 'vue3',
        componentChain: vue3Chain,
        directLocation: firstDirectLocation(vue3Chain, 'runtime') || undefined,
        domFingerprint: extractDomFingerprint(element),
      };
    }
    const vue2Chain = findVue2ComponentChain(element);
    if (vue2Chain.length) {
      return {
        framework: 'vue2',
        componentChain: vue2Chain,
        directLocation: firstDirectLocation(vue2Chain, 'runtime') || undefined,
        domFingerprint: extractDomFingerprint(element),
      };
    }
    const reactChain = findReactComponentChain(element);
    if (reactChain.length) {
      return {
        framework: 'react',
        componentChain: reactChain,
        directLocation: firstDirectLocation(reactChain, 'runtime') || undefined,
        domFingerprint: extractDomFingerprint(element),
      };
    }
    const angular = inspectAngularComponent(element);
    if (angular) {
      return {
        ...angular,
        directLocation: undefined,
        domFingerprint: extractDomFingerprint(element),
      };
    }
    return {
      framework: 'unknown',
      componentChain: [],
      directLocation: undefined,
      domFingerprint: extractDomFingerprint(element),
    };
  }

  function getSubtreeEvidence(element, options = {}) {
    if (!element) {
      return {
        classNames: [],
        texts: [],
        attrs: [],
        styles: [],
        nodes: [],
        nodeCount: 0,
        truncated: false,
      };
    }

    const nodeLimit = options.nodeLimit || SELECTION_NODE_LIMIT;
    const queue = [element];
    const classNames = [];
    const texts = [];
    const attrs = [];
    const styles = [];
    const nodes = [];
    let inspected = 0;
    let truncated = false;

    const addUnique = (list, value, limit) => {
      const text = compactText(value, 240);
      if (!text || list.includes(text) || list.length >= limit) return;
      list.push(text);
    };

    while (queue.length && inspected < nodeLimit) {
      const node = queue.shift();
      if (!node || node.nodeType !== 1) continue;
      const tag = String(node.tagName || '').toLowerCase();
      if (['script', 'style', 'noscript', 'template'].includes(tag)) continue;
      inspected++;

      const className = getClassName(node);
      const firstClassName = getFirstClassName(node);
      const directText = getDirectText(node);
      const attrInfo = getElementAttrs(node);
      const styleInfo = getSubtreeStyleEvidence(node);

      addUnique(classNames, firstClassName, options.classLimit || 48);
      if (node === element) addUnique(texts, getElementText(node), options.textLimit || 48);
      addUnique(texts, directText, options.textLimit || 48);

      for (const [key, value] of Object.entries(attrInfo)) {
        if (!value || attrs.length >= (options.attrLimit || 48)) continue;
        attrs.push({
          tag,
          className: firstClassName,
          key,
          value: compactText(value, 240),
        });
      }

      if (styleInfo && styles.length < (options.styleLimit || 36)) {
        styles.push({
          tag,
          className: firstClassName,
          style: styleInfo,
        });
      }

      if (nodes.length < (options.nodeSummaryLimit || 48)) {
        nodes.push({
          tag,
          className,
          firstClassName,
          text: directText,
          attrs: attrInfo,
          style: styleInfo || null,
        });
      }

      for (const child of Array.from(node.children || [])) {
        if (queue.length + inspected >= nodeLimit) {
          truncated = true;
          break;
        }
        queue.push(child);
      }
    }
    if (queue.length > 0) truncated = true;

    return {
      classNames,
      texts,
      attrs,
      styles,
      nodes,
      nodeCount: inspected,
      truncated,
    };
  }

  function getContextEvidence(element, options = {}) {
    if (!element) {
      return {
        text: '',
        nodeCount: 0,
        textTerms: new Set(),
        classTerms: new Set(),
        attrTerms: new Set(),
        styleTerms: new Set(),
      };
    }
    const subtree = getSubtreeEvidence(element, options.subtreeOptions || {
      nodeLimit: 40,
      classLimit: 24,
      textLimit: 24,
      attrLimit: 24,
      styleLimit: 16,
    });
    const attrs = getElementAttrs(element);
    const text = getElementText(element, options.textLimit || 1200);
    const textTerms = new Set();
    const classTerms = new Set();
    const attrTerms = new Set();
    const styleTerms = new Set();

    addEvidenceTerms(textTerms, [text, ...subtree.texts], 12, 36);
    addEvidenceTerms(classTerms, [getClassName(element), ...subtree.classNames], 8, 24);
    addEvidenceTerms(attrTerms, Object.entries(attrs).flatMap(([key, value]) => [key, value]), 8, 24);
    addEvidenceTerms(attrTerms, subtree.attrs.flatMap(item => [item?.key, item?.value]), 8, 36);
    addEvidenceTerms(styleTerms, subtree.styles.flatMap(item => Object.entries(item?.style || {}).flatMap(([key, value]) => [key, value])), 8, 24);

    return {
      text,
      nodeCount: subtree.nodeCount || 0,
      textTerms,
      classTerms,
      attrTerms,
      styleTerms,
    };
  }

  function isVisibleSelectionElement(element, pointer) {
    if (!element || !document.documentElement.contains(element)) return false;
    if (element.hidden || element.getAttribute?.('aria-hidden') === 'true') return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || element.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none'
      || style.visibility === 'hidden'
      || style.visibility === 'collapse'
      || style.contentVisibility === 'hidden'
      || style.pointerEvents === 'none'
      || Number(style.opacity) <= 0) {
      return false;
    }
    if (!pointer || !Number.isFinite(pointer.x) || !Number.isFinite(pointer.y)) return true;
    const hit = document.elementFromPoint(pointer.x, pointer.y);
    return !!hit && (hit === element || element.contains(hit));
  }

  function findNextSizedAncestor(element, pointer, maxDepth = 24) {
    if (!element) return null;
    const baseRect = element.getBoundingClientRect();
    const baseWidth = Math.round(baseRect.width);
    const baseHeight = Math.round(baseRect.height);
    let node = element.parentElement;
    let depth = 0;

    while (node && node !== document.documentElement && depth < maxDepth) {
      depth++;
      if (!isVisibleSelectionElement(node, pointer)) {
        node = node.parentElement;
        continue;
      }
      const rect = node.getBoundingClientRect();
      if (Math.round(rect.width) !== baseWidth || Math.round(rect.height) !== baseHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }


  function scoreContextPromotion(baseEvidence, nextEvidence) {
    const textGrowth = evidenceGrowth(baseEvidence?.textTerms, nextEvidence?.textTerms);
    const classGrowth = evidenceGrowth(baseEvidence?.classTerms, nextEvidence?.classTerms);
    const attrGrowth = evidenceGrowth(baseEvidence?.attrTerms, nextEvidence?.attrTerms);
    const styleGrowth = evidenceGrowth(baseEvidence?.styleTerms, nextEvidence?.styleTerms);
    const novelScore = textGrowth.added * 4 + classGrowth.added * 3 + attrGrowth.added * 5 + styleGrowth.added * 2;
    const duplicatePenalty = textGrowth.duplicated + classGrowth.duplicated + attrGrowth.duplicated + styleGrowth.duplicated;
    const breadthPenalty = Math.max(0, Number(nextEvidence?.nodeCount || 0) - Number(baseEvidence?.nodeCount || 0) - 4) * 2;
    const textLengthPenalty = Math.max(0, String(nextEvidence?.text || '').length - String(baseEvidence?.text || '').length - 160) / 24;
    const score = novelScore - duplicatePenalty - breadthPenalty - textLengthPenalty;
    return {
      score,
      novelCount: textGrowth.added + classGrowth.added + attrGrowth.added + styleGrowth.added,
    };
  }

  function shouldPromoteContext(baseEvidence, nextEvidence) {
    const result = scoreContextPromotion(baseEvidence, nextEvidence);
    if (result.novelCount <= 0) return false;
    if (result.novelCount >= 3 && result.score >= 6) return true;
    if (result.novelCount >= 2 && result.score >= 8) return true;
    return result.score >= 10;
  }

  function hasUsefulAncestorFallback(baseEvidence, nextEvidence) {
    const baseText = String(baseEvidence?.text || '').replace(/\s+/g, ' ').trim();
    const nextText = String(nextEvidence?.text || '').replace(/\s+/g, ' ').trim();
    const textGrowth = evidenceGrowth(baseEvidence?.textTerms, nextEvidence?.textTerms);
    const classGrowth = evidenceGrowth(baseEvidence?.classTerms, nextEvidence?.classTerms);
    const attrGrowth = evidenceGrowth(baseEvidence?.attrTerms, nextEvidence?.attrTerms);
    const styleGrowth = evidenceGrowth(baseEvidence?.styleTerms, nextEvidence?.styleTerms);
    const addedEvidence = textGrowth.added + classGrowth.added + attrGrowth.added + styleGrowth.added;
    if (addedEvidence >= 2) return true;
    if (textGrowth.added >= 1 && (classGrowth.added + attrGrowth.added + styleGrowth.added) >= 1) return true;
    if (baseText && nextText && nextText.length > baseText.length && nextText.length <= 260) return true;
    if (!baseText && nextText && nextText.length <= 220) return true;
    return false;
  }

  function getAncestorInfo(element) {
    const result = [];
    let node = element.parentElement;
    let currentEvidence = getContextEvidence(element, {
      subtreeOptions: {
        nodeLimit: 40,
        classLimit: 24,
        textLimit: 24,
        attrLimit: 24,
        styleLimit: 16,
      },
    });
    let inspected = 0;
    while (node && node !== document.body && result.length < 4 && inspected < 16) {
      inspected++;
      const nextEvidence = getContextEvidence(node, {
        subtreeOptions: {
          nodeLimit: 40,
          classLimit: 24,
          textLimit: 24,
          attrLimit: 24,
          styleLimit: 16,
        },
      });
      if (!shouldPromoteContext(currentEvidence, nextEvidence) && !hasUsefulAncestorFallback(currentEvidence, nextEvidence)) {
        node = node.parentElement;
        continue;
      }
      const rect = node.getBoundingClientRect();
      result.push({
        tag: node.tagName.toLowerCase(),
        selector: getSelectorPath(node),
        className: getClassName(node),
        attrs: getElementAttrs(node),
        text: compactText(nextEvidence.text, 180),
        subtree: collectSubtree(node),
        inlineStyle: compactText(node.getAttribute?.('style') || '', 240),
        computedStyle: getStyleInfo(node),
        box: {
          x: Math.round(rect.left + window.scrollX),
          y: Math.round(rect.top + window.scrollY),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      });
      currentEvidence = nextEvidence;
      node = node.parentElement;
    }
    return result;
  }

  function getElementInfo(element) {
    const rect = element.getBoundingClientRect();
    return {
      uid: createId('selection'),
      tag: element.tagName.toLowerCase(),
      tagName: element.tagName.toLowerCase(),
      selector: getSelectorPath(element),
      className: getClassName(element),
      attrs: getElementAttrs(element),
      text: compactText(element.innerText || element.textContent || '', 1000),
      searchText: compactText(element.innerText || element.textContent || '', 500),
      subtree: collectSubtree(element),
      innerHtml: compactMarkup(element.innerHTML || '', 960),
      outerHtml: compactMarkup(element.outerHTML || '', 1200),
      rawOuterHtml: compactMarkup(element.outerHTML || '', 180000),
      inlineStyle: compactText(element.getAttribute('style') || '', 500),
      style: getStyleInfo(element),
      computedStyle: getStyleInfo(element),
      box: {
        x: Math.round(rect.left + window.scrollX),
        y: Math.round(rect.top + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      viewportBox: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      ancestors: getAncestorInfo(element),
      page: {
        url: location.href,
        title: document.title,
      },
    };
  }

  function resolveSelectionAssetElement(element) {
    let resolved = element;
    let node = element?.parentElement || null;
    let currentEvidence = getContextEvidence(element, {
      subtreeOptions: {
        nodeLimit: 32,
        classLimit: 20,
        textLimit: 20,
        attrLimit: 20,
        styleLimit: 12,
      },
    });
    let usefulDepth = 0;
    let inspected = 0;
    while (node && node.nodeType === 1 && usefulDepth < 4 && inspected < 16) {
      inspected++;
      const nextEvidence = getContextEvidence(node, {
        subtreeOptions: {
          nodeLimit: 32,
          classLimit: 20,
          textLimit: 20,
          attrLimit: 20,
          styleLimit: 12,
        },
      });
      if (shouldPromoteContext(currentEvidence, nextEvidence)) {
        resolved = node;
        currentEvidence = nextEvidence;
        usefulDepth++;
        break;
      }
      if (node === document.body || node === document.documentElement) break;
      node = node.parentElement;
    }
    return resolved;
  }

  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      'position:fixed',
      'z-index:2147483646',
      'display:none',
      'border:2px solid rgba(45,116,218,.95)',
      'background:rgba(45,116,218,.08)',
      'border-radius:4px',
      'pointer-events:none',
    ].join(';');
    const badge = document.createElement('div');
    badge.id = BADGE_ID;
    badge.textContent = '空格确认 · W 扩大 · S 缩小';
    badge.style.cssText = [
      'position:fixed',
      'z-index:2147483647',
      'display:none',
      'height:24px',
      'padding:0 8px',
      'border-radius:6px',
      'background:#111827',
      'color:#fff',
      'font:12px/24px -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif',
      'pointer-events:none',
    ].join(';');
    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(badge);
    return { overlay, badge };
  }

  function getMdWeb() {
    try {
      const requireFn = typeof window._require === 'function'
        ? window._require
        : (typeof _require === 'function' ? _require : null);
      if (requireFn) {
        const mdChrome = requireFn('mdChrome');
        if (mdChrome?.web?.cmd) return mdChrome.web;
      }
    } catch (error) {
    }
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function clipRectToViewport(rect) {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.left + rect.width);
    const bottom = Math.min(window.innerHeight, rect.top + rect.height);
    return {
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }

  async function captureVisibleTabDataUrl() {
    const mdWeb = getMdWeb();
    if (!mdWeb?.cmd) return '';
    try {
      const result = await mdWeb.cmd({
        cmd: 'Base.tabs.captureVisibleTab',
        params: [{ format: 'png' }],
      });
      return result?.success ? (result.result || '') : '';
    } catch (error) {
      return '';
    }
  }

  function normalizeHeaders(value) {
    if (!value) return {};
    if (typeof Headers !== 'undefined' && value instanceof Headers) {
      const result = {};
      value.forEach((headerValue, headerKey) => {
        result[String(headerKey).toLowerCase()] = String(headerValue || '');
      });
      return result;
    }
    if (Array.isArray(value)) {
      return value.reduce((result, item) => {
        if (Array.isArray(item) && item.length >= 2) {
          result[String(item[0]).toLowerCase()] = String(item[1] || '');
        }
        return result;
      }, {});
    }
    if (typeof value === 'object') {
      return Object.entries(value).reduce((result, [key, headerValue]) => {
        result[String(key).toLowerCase()] = String(headerValue || '');
        return result;
      }, {});
    }
    return {};
  }

  function flattenKeys(value, prefix = '', result = [], depth = 0, limit = 36) {
    if (!value || typeof value !== 'object' || depth > 2 || result.length >= limit) return result;
    const entries = Array.isArray(value)
      ? value.slice(0, 1).map((item, index) => [String(index), item])
      : Object.entries(value).slice(0, 18);
    for (const [key, child] of entries) {
      if (result.length >= limit) break;
      const fullKey = prefix ? `${prefix}.${key}` : key;
      result.push(fullKey);
      if (child && typeof child === 'object') flattenKeys(child, fullKey, result, depth + 1, limit);
    }
    return result;
  }

  function normalizeRequestInfo(raw) {
    const data = raw || {};
    let pathname = data.url || '';
    try {
      pathname = new URL(data.url, location.href).pathname;
    } catch (error) {
    }
    return {
      url: data.url || '',
      pathname,
      method: data.method || 'GET',
      headers: normalizeHeaders(data.request?.headers || data.headers),
      requestKeys: flattenKeys(data.request?.body || {}, '', [], 0, 28),
      capturedAt: Date.now(),
    };
  }

  function normalizeWebRequestCacheItem(item) {
    if (!item) return null;
    if (item.type === 'WEB_REQUEST_RESPONSE' && item.data) return item.data;
    return item;
  }

  async function cropSelectionThumbnail(sourceUrl, rect) {
    if (!sourceUrl || !rect || rect.width <= 0 || rect.height <= 0) return '';
    const image = await loadImage(sourceUrl);
    const scaleX = image.width / Math.max(window.innerWidth, 1);
    const scaleY = image.height / Math.max(window.innerHeight, 1);
    const sw = Math.max(1, Math.round(rect.width * scaleX));
    const sh = Math.max(1, Math.round(rect.height * scaleY));
    const sx = Math.max(0, Math.round(rect.left * scaleX));
    const sy = Math.max(0, Math.round(rect.top * scaleY));
    const preferredScale = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const maxOutputWidth = 1200;
    const maxOutputHeight = 1200;
    const ratio = Math.min(maxOutputWidth / sw, maxOutputHeight / sh, preferredScale);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * ratio));
    canvas.height = Math.max(1, Math.round(sh * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }

  class MagnusSfrRuntime {
    constructor() {
      this.runtimeId = createId('runtime');
      this.pageSessionId = '';
      this.socket = null;
      this.pickerEnabled = false;
      this.hoveredElement = null;
      this.selectionLevelPath = [];
      this.lastPointer = null;
      this.lastConfirmAt = 0;
      this.lastPointerActivityAt = 0;
      this.pendingMessages = [];
      this.selectionRefs = new Map();
      this.selections = [];
      this.overlayParts = null;
      this.destroyed = false;
      this.handlePointerMove = this.handlePointerMove.bind(this);
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleKeyPress = this.handleKeyPress.bind(this);
      this.handleKeyUp = this.handleKeyUp.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleRouteChange = this.handleRouteChange.bind(this);
      this.handlePageMessage = this.handlePageMessage.bind(this);
      this.webRequestApiInstalled = false;
      this.webRequestRetryCount = 0;
      this.webRequestRetryTimer = 0;
    }

    start() {
      this.connect();
      this.patchHistory();
      window.addEventListener('popstate', this.handleRouteChange, true);
      window.addEventListener('hashchange', this.handleRouteChange, true);
      window.addEventListener('message', this.handlePageMessage, true);
      this.installWebRequestApiListenerWithRetry();
    }

    connect() {
      const bridgeUrl = BOOT.bridgeUrl || 'ws://127.0.0.1:17321/bridge';
      const socket = new WebSocket(bridgeUrl);
      this.socket = socket;
      socket.addEventListener('open', () => {
        this.sendNow({
          type: 'runtime.register',
          runtimeId: this.runtimeId,
          browserTabId: BOOT.browserTabId,
          windowId: BOOT.windowId,
          workspaceId: BOOT.workspaceId,
          page: {
            url: location.href,
            title: document.title,
          },
        });
        this.flushPendingMessages();
      });
      socket.addEventListener('message', event => this.handleMessage(event));
      socket.addEventListener('close', () => {
        if (this.destroyed) return;
        window.setTimeout(() => this.connect(), 1000);
      });
    }

    send(message) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.pendingMessages.push(message);
        if (this.pendingMessages.length > 120) this.pendingMessages.splice(0, this.pendingMessages.length - 120);
        return;
      }
      this.sendNow(message);
    }

    sendNow(message) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify(message));
    }

    flushPendingMessages() {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.pendingMessages.length) return;
      const messages = this.pendingMessages.splice(0);
      for (const message of messages) this.sendNow(message);
    }

    emit(type, payload) {
      this.send({
        type: 'runtime.event',
        runtimeId: this.runtimeId,
        pageSessionId: this.pageSessionId,
        event: { type, payload },
      });
    }

    handleMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if (message.type === 'runtime.bound_session') {
        this.pageSessionId = message.pageSessionId || '';
        if (BOOT.autoStartPicker) {
          this.startPicker();
        }
      } else if (message.type === 'page.command.START_PICKER' || message.type === 'page.command.picker.start') {
        this.startPicker();
      } else if (message.type === 'page.command.STOP_PICKER' || message.type === 'page.command.picker.stop') {
        this.stopPicker();
      } else if (message.type === 'page.command.selection.highlight') {
        this.highlightSelection(message.command?.payload || {});
      } else if (message.type === 'page.command.selection.expand') {
        this.expandSelection(message.command?.payload || {});
      } else if (message.type === 'page.command.selection.remove') {
        this.removeSelectionByUid(message.command?.payload?.uid || '');
      } else if (message.type === 'page.command.selection.clear') {
        this.clearSelections();
      } else if (message.type === 'page.command.context.get') {
        this.emitPageContext();
      } else if (message.type === 'page.command.picker.key') {
        this.handleRemotePickerKey(message.command?.payload || {});
      }
    }

    readStorageValue(key) {
      try {
        return localStorage.getItem(key) || '';
      } catch (error) {
        return '';
      }
    }

    emitPageContext() {
      this.emit('page.context', {
        url: location.href,
        title: document.title,
        route: `${location.pathname}${location.search}`,
        project: {
          projectId: this.readStorageValue('projectId'),
          tenantId: this.readStorageValue('tenantId'),
          appId: this.readStorageValue('appId'),
        },
      });
    }

    patchHistory() {
      const rawPushState = history.pushState;
      const rawReplaceState = history.replaceState;
      const runtime = this;
      history.pushState = function pushState(...args) {
        const result = rawPushState.apply(this, args);
        window.setTimeout(runtime.handleRouteChange, 0);
        return result;
      };
      history.replaceState = function replaceState(...args) {
        const result = rawReplaceState.apply(this, args);
        window.setTimeout(runtime.handleRouteChange, 0);
        return result;
      };
      this.restoreHistory = () => {
        history.pushState = rawPushState;
        history.replaceState = rawReplaceState;
      };
    }

    handleRouteChange() {
      this.selectionRefs.clear();
      this.selections = [];
      this.hideOverlay();
      this.emit('page.route_changed', {
        url: location.href,
        title: document.title,
      });
    }

    rememberWebRequestPayload(payload) {
      const info = normalizeRequestInfo(payload || {});
      if (!info.url && !info.pathname) return;
      this.emit('network.request', info);
    }

    replayWebRequestCaches(api) {
      if (!api || !Array.isArray(api.caches) || !api.caches.length) return;
      const caches = api.caches.splice(0);
      caches.forEach(item => {
        const payload = normalizeWebRequestCacheItem(item);
        if (payload) this.rememberWebRequestPayload(payload);
      });
    }

    installWebRequestApiListener() {
      const api = window.__WEB_REQUEST_API__;
      if (!api || typeof api.onResponse !== 'function') return false;

      this.webRequestApiInstalled = true;
      window.__MAGNUS_WEB_REQUEST_HANDLER__ = payload => this.rememberWebRequestPayload(payload);

      if (!api.__MAGNUS_RUNTIME_LISTENER__) {
        api.onResponse(payload => {
          const handler = window.__MAGNUS_WEB_REQUEST_HANDLER__;
          if (typeof handler === 'function') handler(payload);
        });
        api.__MAGNUS_RUNTIME_LISTENER__ = true;
      }

      this.replayWebRequestCaches(api);
      if (typeof api.ready === 'function') api.ready();
      return true;
    }

    installWebRequestApiListenerWithRetry() {
      if (this.installWebRequestApiListener()) return;
      if (this.webRequestRetryCount >= 20) return;
      this.webRequestRetryCount += 1;
      this.webRequestRetryTimer = window.setTimeout(() => this.installWebRequestApiListenerWithRetry(), 250);
    }

    handlePageMessage(event) {
      if (this.webRequestApiInstalled) return;
      const message = event.data || {};
      if (message.type !== 'WEB_REQUEST_RESPONSE') return;
      this.rememberWebRequestPayload(message.data || {});
    }

    startPicker() {
      if (this.pickerEnabled) return;
      this.pickerEnabled = true;
      this.overlayParts = this.overlayParts || createOverlay();
      document.documentElement.style.cursor = 'crosshair';
      window.addEventListener('pointermove', this.handlePointerMove, true);
      window.addEventListener('mousemove', this.handlePointerMove, true);
      window.addEventListener('pointerover', this.handlePointerMove, true);
      window.addEventListener('keydown', this.handleKeyDown, true);
      window.addEventListener('keypress', this.handleKeyPress, true);
      window.addEventListener('keyup', this.handleKeyUp, true);
      document.addEventListener('keydown', this.handleKeyDown, true);
      document.addEventListener('keypress', this.handleKeyPress, true);
      document.addEventListener('keyup', this.handleKeyUp, true);
      window.addEventListener('click', this.handleClick, true);
      this.emit('picker.state', { enabled: true });
    }

    stopPicker() {
      this.pickerEnabled = false;
      document.documentElement.style.cursor = '';
      window.removeEventListener('pointermove', this.handlePointerMove, true);
      window.removeEventListener('mousemove', this.handlePointerMove, true);
      window.removeEventListener('pointerover', this.handlePointerMove, true);
      window.removeEventListener('keydown', this.handleKeyDown, true);
      window.removeEventListener('keypress', this.handleKeyPress, true);
      window.removeEventListener('keyup', this.handleKeyUp, true);
      document.removeEventListener('keydown', this.handleKeyDown, true);
      document.removeEventListener('keypress', this.handleKeyPress, true);
      document.removeEventListener('keyup', this.handleKeyUp, true);
      window.removeEventListener('click', this.handleClick, true);
      this.hideOverlay();
      this.emit('picker.state', { enabled: false });
    }

    handlePointerMove(event) {
      if (!this.pickerEnabled) return;
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (!element || element.nodeType !== 1) return;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      if (this.selectionLevelPath[0] !== element) {
        this.selectionLevelPath = [element];
      }
      const target = this.selectionLevelPath[this.selectionLevelPath.length - 1] || element;
      this.hoveredElement = target;
      this.showOverlay(target);
      this.emitPointerActivity();
    }

    handleClick(event) {
      if (!this.pickerEnabled) return;
      this.lastPointer = { x: event.clientX, y: event.clientY };
    }

    emitPointerActivity() {
      if (document.hasFocus()) return;
      const now = Date.now();
      if (now - this.lastPointerActivityAt < 250) return;
      this.lastPointerActivityAt = now;
      this.emit('picker.pointer_active', { active: true });
    }

    handleRemotePickerKey(payload) {
      const key = String(payload.key || '').toLowerCase();
      const code = String(payload.code || '');
      const event = {
        key,
        code,
        repeat: false,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {},
      };
      if (this.isSelectionLevelKey(event)) {
        this.adjustSelectionLevel(event);
        return;
      }
      if (this.isConfirmKey(event)) {
        this.confirmHoveredSelection(event);
      }
    }

    isSelectionLevelKey(event) {
      return (event.code === 'KeyW' || event.code === 'KeyS'
        || String(event.key || '').toLowerCase() === 'w'
        || String(event.key || '').toLowerCase() === 's')
        && !event.metaKey
        && !event.ctrlKey
        && !event.altKey;
    }

    adjustSelectionLevel(event) {
      if (!this.pickerEnabled || !this.isSelectionLevelKey(event) || event.repeat) return false;
      const current = this.resolveCurrentElement();
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!current) return true;

      const isExpand = event.code === 'KeyW' || String(event.key || '').toLowerCase() === 'w';
      let next = current;
      if (isExpand) {
        next = findNextSizedAncestor(current, this.lastPointer) || current;
        if (next !== current) {
          if (!this.selectionLevelPath.length) this.selectionLevelPath = [current];
          this.selectionLevelPath.push(next);
        }
      } else if (this.selectionLevelPath.length > 1) {
        this.selectionLevelPath.pop();
        next = this.selectionLevelPath[this.selectionLevelPath.length - 1];
      }

      this.hoveredElement = next;
      this.showOverlay(next);
      return true;
    }

    isConfirmKey(event) {
      return (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar')
        && !event.metaKey
        && !event.ctrlKey
        && !event.altKey;
    }

    resolveCurrentElement() {
      if (this.hoveredElement && document.documentElement.contains(this.hoveredElement)) {
        return this.hoveredElement;
      }
      if (!this.lastPointer) return null;
      const element = document.elementFromPoint(this.lastPointer.x, this.lastPointer.y);
      if (element && element.nodeType === 1) return element;
      const hovered = Array.from(document.querySelectorAll(':hover')).pop();
      return hovered && hovered.nodeType === 1 ? hovered : null;
    }

    confirmHoveredSelection(event) {
      if (!this.pickerEnabled || !this.isConfirmKey(event) || event.repeat) return;
      const now = Date.now();
      if (now - this.lastConfirmAt < 220) return;
      const element = this.resolveCurrentElement();
      if (!element) return;
      this.lastConfirmAt = now;
      this.hoveredElement = element;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.addSelection(element);
    }

    handleKeyDown(event) {
      if (this.adjustSelectionLevel(event)) return;
      this.confirmHoveredSelection(event);
    }

    handleKeyPress(event) {
      if (this.pickerEnabled && this.isSelectionLevelKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
      this.confirmHoveredSelection(event);
    }

    handleKeyUp(event) {
      if (this.pickerEnabled && this.isSelectionLevelKey(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }
      if (!this.pickerEnabled || !this.isConfirmKey(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }

    showOverlay(element) {
      const rect = element.getBoundingClientRect();
      const { overlay, badge } = this.overlayParts || {};
      if (!overlay || !badge || rect.width <= 0 || rect.height <= 0) return;
      overlay.style.display = 'block';
      overlay.style.borderColor = 'rgba(45,116,218,.95)';
      overlay.style.left = `${Math.round(rect.left)}px`;
      overlay.style.top = `${Math.round(rect.top)}px`;
      overlay.style.width = `${Math.max(1, Math.round(rect.width))}px`;
      overlay.style.height = `${Math.max(1, Math.round(rect.height))}px`;
      badge.style.display = 'block';
      badge.style.left = `${Math.max(8, Math.round(rect.left))}px`;
      badge.style.top = `${Math.max(8, Math.round(rect.top - 30))}px`;
    }

    hideOverlay() {
      if (!this.overlayParts) return;
      this.overlayParts.overlay.style.display = 'none';
      this.overlayParts.badge.style.display = 'none';
    }

    emitSelectionChanged(selection) {
      this.emit('selection.changed', {
        selection,
        selections: this.selections,
      });
    }

    getSelectionRef(uid) {
      if (!uid) return null;
      const ref = this.selectionRefs.get(uid);
      if (ref?.el && document.documentElement.contains(ref.el)) return ref;
      this.selectionRefs.delete(uid);
      return null;
    }

    bindSelectionElement(selection, element) {
      if (!selection?.uid || !element) return;
      try {
        Object.defineProperty(selection, 'el', {
          value: element,
          configurable: true,
          enumerable: false,
          writable: true,
        });
      } catch (error) {
      }
      this.selectionRefs.set(selection.uid, { el: element, selection });
      window.__MAGNUS_SFR_SELECTION_REFS__ = this.selectionRefs;
    }

    refreshSelectionFromElement(selection, element) {
      if (!selection?.uid || !element) return selection;
      const info = getElementInfo(element);
      const sourceLocate = inspectSourceLocate(element);
      selection.element = info;
      selection.info = info;
      selection.sourceLocate = sourceLocate;
      selection.sourceEvidence = sourceLocate;
      info.sourceLocate = sourceLocate;
      const assetElement = resolveSelectionAssetElement(element);
      const assetInfo = getElementInfo(assetElement) || info;
      selection.asset = assetInfo;
      selection.assetInfo = assetInfo;
      return selection;
    }

    highlightSelection(payload = {}) {
      const uid = payload.uid || payload.selectionUid || '';
      if (!uid) {
        this.hideOverlay();
        return;
      }
      const ref = this.getSelectionRef(uid);
      if (!ref?.el) return;
      this.showOverlay(ref.el);
      const { overlay } = this.overlayParts || {};
      if (overlay) overlay.style.borderColor = '#16a34a';
    }

    expandSelection(payload = {}) {
      const uid = payload.uid || payload.selectionUid || '';
      const ref = this.getSelectionRef(uid);
      if (!ref?.selection || !ref.el) return;
      const next = findNextSizedAncestor(ref.el, null) || ref.el;
      this.refreshSelectionFromElement(ref.selection, next);
      this.bindSelectionElement(ref.selection, next);
      this.showOverlay(next);
      this.emitSelectionChanged(ref.selection);
      void this.updateSelectionThumbnail(ref.selection, next);
    }

    removeSelectionByUid(uid) {
      if (!uid) return;
      this.selectionRefs.delete(uid);
      this.selections = this.selections.filter(item => item.uid !== uid);
      this.emitSelectionChanged(this.selections[this.selections.length - 1] || null);
      this.hideOverlay();
    }

    clearSelections() {
      this.selectionRefs.clear();
      this.selections = [];
      this.emitSelectionChanged(null);
      this.hideOverlay();
    }

    async updateSelectionThumbnail(selection, element) {
      try {
        const assetElement = resolveSelectionAssetElement(element);
        const assetInfo = getElementInfo(assetElement) || selection.element || selection;
        const rect = clipRectToViewport(element.getBoundingClientRect());
        const fullCapture = await captureVisibleTabDataUrl();
        const thumbnailUrl = await cropSelectionThumbnail(fullCapture, rect);
        const target = this.selections.find(item => item.uid === selection.uid);
        if (!target) return;
        target.asset = assetInfo;
        target.assetInfo = assetInfo;
        target.thumbnailUrl = thumbnailUrl || '';
        target.thumbnailCaptured = !!thumbnailUrl;
        this.emitSelectionChanged(target);
      } catch (error) {
      }
    }

    addSelection(element) {
      const sourceLocate = inspectSourceLocate(element);
      const info = getElementInfo(element);
      info.sourceLocate = sourceLocate;
      const selection = {
        uid: info.uid,
        element: info,
        info,
        asset: null,
        assetInfo: null,
        sourceLocate,
        sourceEvidence: sourceLocate,
      };
      selection.thumbnailUrl = '';
      selection.thumbnailCaptured = false;
      this.selections.push(selection);
      this.bindSelectionElement(selection, element);
      this.emitSelectionChanged(selection);
      this.hoveredElement = null;
      this.hideOverlay();
      void this.updateSelectionThumbnail(selection, element);
    }

    destroy() {
      this.destroyed = true;
      this.stopPicker();
      this.restoreHistory?.();
      window.removeEventListener('popstate', this.handleRouteChange, true);
      window.removeEventListener('hashchange', this.handleRouteChange, true);
      window.removeEventListener('message', this.handlePageMessage, true);
      if (this.webRequestRetryTimer) window.clearTimeout(this.webRequestRetryTimer);
      if (this.socket) this.socket.close();
      const overlay = document.getElementById(OVERLAY_ID);
      const badge = document.getElementById(BADGE_ID);
      overlay?.remove();
      badge?.remove();
    }
  }

  const runtime = new MagnusSfrRuntime();
  window[RUNTIME_KEY] = runtime;
  runtime.start();
  if (BOOT.autoStartPicker) {
    runtime.startPicker();
  }
})();

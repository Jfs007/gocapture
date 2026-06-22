(function installMagnusSfrRuntime() {
  const BOOT = window.__MAGNUS_SFR_BOOT__ || {};
  const RUNTIME_KEY = '__MAGNUS_SFR__';
  const OVERLAY_ID = 'magnus-sfr-picker-overlay';
  const BADGE_ID = 'magnus-sfr-picker-badge';

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
    const classSet = new Set();
    const textSet = new Set();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let count = 0;
    while (walker.nextNode() && count < 60) {
      count++;
      const node = walker.currentNode;
      if (node.nodeType === 1) {
        const first = node.classList && node.classList[0];
        if (first) classSet.add(first);
      } else if (node.nodeType === 3) {
        const text = compactText(node.nodeValue || '', 80);
        if (text) textSet.add(text);
      }
    }
    return {
      class: Array.from(classSet).slice(0, 24),
      text: Array.from(textSet).slice(0, 24),
    };
  }

  function collectEvidence(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      uid: createId('selection'),
      tag: element.tagName.toLowerCase(),
      tagName: element.tagName.toLowerCase(),
      selector: cssPath(element),
      className: compactText(element.className || '', 260),
      attrs: collectAttrs(element),
      text: compactText(element.innerText || element.textContent || '', 1000),
      searchText: compactText(element.innerText || element.textContent || '', 500),
      inlineStyle: compactText(element.getAttribute('style') || '', 500),
      style: {
        width: style.width,
        height: style.height,
        color: style.color,
        backgroundImage: style.backgroundImage,
        objectFit: style.objectFit,
        borderRadius: style.borderRadius,
      },
      box: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      ancestors: collectAncestors(element),
      subtree: collectSubtree(element),
      page: {
        url: location.href,
        title: document.title,
      },
    };
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
    badge.textContent = '空格键确认选区';
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

  function isEditableTarget(target) {
    const element = target && target.nodeType === 1 ? target : target?.parentElement;
    if (!element) return false;
    const tag = element.tagName ? element.tagName.toLowerCase() : '';
    return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
  }

  function getMdWeb() {
    try {
      const requireFn = typeof window._require === 'function'
        ? window._require
        : (typeof _require === 'function' ? _require : null);
      if (!requireFn) return null;
      const mdChrome = requireFn('mdChrome');
      return mdChrome?.web || null;
    } catch (error) {
      return null;
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
      this.lastPointer = null;
      this.selections = [];
      this.overlayParts = null;
      this.destroyed = false;
      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleKeyUp = this.handleKeyUp.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleRouteChange = this.handleRouteChange.bind(this);
    }

    start() {
      this.connect();
      this.patchHistory();
      window.addEventListener('popstate', this.handleRouteChange, true);
      window.addEventListener('hashchange', this.handleRouteChange, true);
    }

    connect() {
      const bridgeUrl = BOOT.bridgeUrl || 'ws://127.0.0.1:17321/bridge';
      const socket = new WebSocket(bridgeUrl);
      this.socket = socket;
      socket.addEventListener('open', () => {
        this.send({
          type: 'runtime.register',
          runtimeId: this.runtimeId,
          browserTabId: BOOT.browserTabId,
          windowId: BOOT.windowId,
          page: {
            url: location.href,
            title: document.title,
          },
        });
      });
      socket.addEventListener('message', event => this.handleMessage(event));
      socket.addEventListener('close', () => {
        if (this.destroyed) return;
        window.setTimeout(() => this.connect(), 1000);
      });
    }

    send(message) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(JSON.stringify(message));
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
        this.startPicker();
      } else if (message.type === 'page.command.START_PICKER' || message.type === 'page.command.picker.start') {
        this.startPicker();
      } else if (message.type === 'page.command.STOP_PICKER' || message.type === 'page.command.picker.stop') {
        this.stopPicker();
      }
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
      this.emit('page.route_changed', {
        url: location.href,
        title: document.title,
      });
    }

    startPicker() {
      if (this.pickerEnabled) return;
      this.pickerEnabled = true;
      this.overlayParts = this.overlayParts || createOverlay();
      document.documentElement.style.cursor = 'crosshair';
      window.addEventListener('mousemove', this.handleMouseMove, true);
      window.addEventListener('keydown', this.handleKeyDown, true);
      window.addEventListener('keyup', this.handleKeyUp, true);
      document.addEventListener('keydown', this.handleKeyDown, true);
      document.addEventListener('keyup', this.handleKeyUp, true);
      window.addEventListener('click', this.handleClick, true);
      this.emit('picker.state', { enabled: true });
    }

    stopPicker() {
      this.pickerEnabled = false;
      document.documentElement.style.cursor = '';
      window.removeEventListener('mousemove', this.handleMouseMove, true);
      window.removeEventListener('keydown', this.handleKeyDown, true);
      window.removeEventListener('keyup', this.handleKeyUp, true);
      document.removeEventListener('keydown', this.handleKeyDown, true);
      document.removeEventListener('keyup', this.handleKeyUp, true);
      window.removeEventListener('click', this.handleClick, true);
      this.hideOverlay();
      this.emit('picker.state', { enabled: false });
    }

    handleMouseMove(event) {
      if (!this.pickerEnabled) return;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (!element || element.nodeType !== 1) return;
      this.hoveredElement = element;
      this.showOverlay(element);
    }

    handleClick(event) {
      if (!this.pickerEnabled || isEditableTarget(event.target)) return;
      this.lastPointer = { x: event.clientX, y: event.clientY };
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
      return element && element.nodeType === 1 ? element : null;
    }

    confirmHoveredSelection(event) {
      if (!this.pickerEnabled || !this.isConfirmKey(event) || event.repeat || isEditableTarget(event.target)) return;
      const element = this.resolveCurrentElement();
      if (!element) return;
      this.hoveredElement = element;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.addSelection(element);
    }

    handleKeyDown(event) {
      this.confirmHoveredSelection(event);
    }

    handleKeyUp(event) {
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

    async updateSelectionThumbnail(selection, element) {
      try {
        const rect = clipRectToViewport(element.getBoundingClientRect());
        const fullCapture = await captureVisibleTabDataUrl();
        const thumbnailUrl = await cropSelectionThumbnail(fullCapture, rect);
        if (!thumbnailUrl) return;
        const target = this.selections.find(item => item.uid === selection.uid);
        if (!target) return;
        target.thumbnailUrl = thumbnailUrl;
        target.thumbnailCaptured = true;
        this.emitSelectionChanged(target);
      } catch (error) {
      }
    }

    addSelection(element) {
      const selection = collectEvidence(element);
      selection.thumbnailUrl = '';
      selection.thumbnailCaptured = false;
      this.selections.push(selection);
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
})();

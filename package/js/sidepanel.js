let sourceServerUrl = '';
const GOCAPTURE_PRODUCT_NAME = "GoCapture";
const IFRAME_ID = 'gocapture-sidepanel-frame';
let loadedPanelTicket = '';

function getFrame() {
  return document.getElementById(IFRAME_ID);
}

function setStatus(text) {
  const status = document.getElementById('gocapture-sidepanel-status');
  if (status) status.textContent = text || '';
}

function parsePanelContext() {
  const params = new URLSearchParams(location.search);
  return {
    tabId: Number(params.get('tabId') || 0),
    workspaceId: params.get('workspaceId') || '',
    panelTicket: params.get('panelTicket') || '',
  };
}

const panelContext = parsePanelContext();

function panelUrl(panelTicket) {
  return `${sourceServerUrl}/ui/?panelTicket=${encodeURIComponent(panelTicket)}`;
}

function settingsUrl(context) {
  const params = new URLSearchParams();
  if (context.workspaceId) params.set('workspaceId', context.workspaceId);
  if (context.tabId) params.set('tabId', String(context.tabId));
  if (context.page?.url) params.set('pageUrl', context.page.url);
  return `${sourceServerUrl}/settings?${params.toString()}`;
}

function loadIframe(panelTicket, options = {}) {
  const frame = getFrame();
  if (!frame) return;
  if (!panelTicket) {
    frame.removeAttribute('src');
    loadedPanelTicket = '';
    setStatus(`缺少 panelTicket，无法加载 ${GOCAPTURE_PRODUCT_NAME} UI。`);
    return;
  }
  if (!options.force && loadedPanelTicket === panelTicket && frame.getAttribute('src')) {
    setStatus('');
    return;
  }
  frame.setAttribute('allow', 'clipboard-write');
  frame.src = panelUrl(panelTicket);
  loadedPanelTicket = panelTicket;
  setStatus('');
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

async function loadGoCaptureConfig() {
  const response = await sendRuntimeMessage({ cmd: 'gocapture.getConfig' });
  if (!response || response.success === false || !response.sourceServerUrl) {
    throw new Error(response?.error || `读取 ${GOCAPTURE_PRODUCT_NAME} 配置失败。`);
  }
  sourceServerUrl = response.sourceServerUrl;
}

async function rebindPanel(context) {
  if (!context.tabId || !context.workspaceId) {
    throw new Error('缺少 tabId 或 workspaceId，无法重新绑定。');
  }
  const response = await sendRuntimeMessage({
    cmd: 'gocapture.rebindPanel',
    tabId: context.tabId,
    workspaceId: context.workspaceId,
  });
  if (!response || response.success === false) {
    throw new Error(response?.error || '重新绑定失败。');
  }
  context.workspaceId = response.workspace?.workspaceId || context.workspaceId || '';
  context.tabId = Number(response.workspace?.tabId || context.tabId || 0);
  context.page = response.workspace?.page || context.page || null;
  return response.panelTicket;
}

async function preparePanel(context) {
  if (!context.tabId) {
    const consumed = await sendRuntimeMessage({ cmd: 'gocapture.consumeOpenRequest' });
    const request = consumed?.request || null;
    if (request?.tabId) context.tabId = Number(request.tabId);
  }
  if (!context.tabId) {
    throw new Error(`当前 SidePanel 未绑定页面，请点击 ${GOCAPTURE_PRODUCT_NAME} 插件图标打开当前页面的工作区。`);
  }
  const response = await sendRuntimeMessage({
    cmd: 'gocapture.openPanel',
    tabId: context.tabId,
    openPanel: false,
  });
  if (!response || response.success === false) {
    throw new Error(response?.error || `初始化 ${GOCAPTURE_PRODUCT_NAME} 失败。`);
  }
  context.workspaceId = response.workspace?.workspaceId || context.workspaceId || '';
  context.tabId = Number(response.workspace?.tabId || context.tabId || 0);
  context.page = response.workspace?.page || context.page || null;
  context.panelTicket = response.panelTicket || '';
  return context.panelTicket;
}

async function requestRebindPanel(options = {}) {
  setStatus(options.status || '重新绑定页面...');
  const panelTicket = await rebindPanel(panelContext);
  panelContext.panelTicket = panelTicket;
  loadIframe(panelTicket, { force: options.force ?? panelTicket !== loadedPanelTicket });
  return panelTicket;
}

async function writeClipboardText(text) {
  if (!text) return false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (error) {
    ok = false;
  }
  textarea.parentNode?.removeChild(textarea);
  return ok;
}

window.addEventListener('message', event => {
  const message = event.data || {};
  const frame = getFrame();
  if (frame && event.source !== frame.contentWindow) return;
  if (message.type === 'gocapture.settings.open') {
    (async () => {
      try {
        setStatus('正在打开设置...');
        if (!panelContext.workspaceId || !panelContext.tabId) {
          const panelTicket = await rebindPanel(panelContext);
          panelContext.panelTicket = panelTicket;
        }
        const url = settingsUrl(panelContext);
        if (chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url });
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
        setStatus('');
      } catch (error) {
        console.error('[GoCapture] open settings failed:', error);
        setStatus(`打开设置失败：${error.message || error}`);
      }
    })();
    return;
  }
  if (message.type === 'gocapture.sidepanel.reload') {
    const requestId = message.requestId || '';
    (async () => {
      try {
        setStatus('更新完成，正在重新绑定页面...');
        const panelTicket = await rebindPanel(panelContext);
        panelContext.panelTicket = panelTicket;
        event.source?.postMessage({
          type: 'gocapture.sidepanel.reload.result',
          requestId,
          ok: true,
        }, event.origin || '*');
        loadIframe(panelTicket, { force: true });
      } catch (error) {
        console.error('[GoCapture] side panel reload failed:', error);
        setStatus(`重新绑定失败：${error.message || error}`);
        event.source?.postMessage({
          type: 'gocapture.sidepanel.reload.result',
          requestId,
          ok: false,
          error: error.message || String(error),
        }, event.origin || '*');
      }
    })();
    return;
  }
  if (message.type === 'gocapture.sidepanel.rebind') {
    const requestId = message.requestId || '';
    (async () => {
      try {
        await requestRebindPanel({ status: '重新绑定页面...' });
        event.source?.postMessage({
          type: 'gocapture.sidepanel.rebind.result',
          requestId,
          ok: true,
        }, event.origin || '*');
      } catch (error) {
        console.error('[GoCapture] side panel rebind failed:', error);
        setStatus(`绑定失败：${error.message || error}`);
        event.source?.postMessage({
          type: 'gocapture.sidepanel.rebind.result',
          requestId,
          ok: false,
          error: error.message || String(error),
        }, event.origin || '*');
      }
    })();
    return;
  }
  if (message.type !== 'gocapture.clipboard.write') return;
  writeClipboardText(String(message.text || '')).then(ok => {
    event.source?.postMessage({
      type: 'gocapture.clipboard.result',
      requestId: message.requestId || '',
      ok,
    }, event.origin || '*');
  });
});

document.addEventListener('DOMContentLoaded', () => {
  loadGoCaptureConfig().then(() => {
    if (panelContext.panelTicket) {
      loadIframe(panelContext.panelTicket);
      return;
    }
    setStatus(`正在初始化 ${GOCAPTURE_PRODUCT_NAME}...`);
    return preparePanel(panelContext).then(panelTicket => {
      loadIframe(panelTicket);
    });
  }).catch(error => {
    console.error('[GoCapture] side panel init failed:', error);
    setStatus(`初始化失败：${error.message || error}`);
  });

});

let sourceServerUrl = '';
const IFRAME_ID = 'magnus-sidepanel-frame';

function getFrame() {
  return document.getElementById(IFRAME_ID);
}

function setStatus(text) {
  const status = document.getElementById('magnus-sidepanel-status');
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

function panelUrl(panelTicket) {
  return `${sourceServerUrl}/ui/?panelTicket=${encodeURIComponent(panelTicket)}`;
}

function loadIframe(panelTicket) {
  const frame = getFrame();
  if (!frame) return;
  if (!panelTicket) {
    frame.removeAttribute('src');
    setStatus('缺少 panelTicket，无法加载 Magnus UI。');
    return;
  }
  frame.src = panelUrl(panelTicket);
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

async function loadMagnusConfig() {
  const response = await sendRuntimeMessage({ cmd: 'magnus.getConfig' });
  if (!response || response.success === false || !response.sourceServerUrl) {
    throw new Error(response?.error || '读取 Magnus 配置失败。');
  }
  sourceServerUrl = response.sourceServerUrl;
}

async function rebindPanel(context) {
  if (!context.tabId || !context.workspaceId) {
    throw new Error('缺少 tabId 或 workspaceId，无法重新绑定。');
  }
  const response = await sendRuntimeMessage({
    cmd: 'magnus.rebindPanel',
    tabId: context.tabId,
    workspaceId: context.workspaceId,
  });
  if (!response || response.success === false) {
    throw new Error(response?.error || '重新绑定失败。');
  }
  return response.panelTicket;
}

async function preparePanel(context) {
  if (!context.tabId) {
    const consumed = await sendRuntimeMessage({ cmd: 'magnus.consumeOpenRequest' });
    const request = consumed?.request || null;
    if (request?.tabId) context.tabId = Number(request.tabId);
  }
  if (!context.tabId) {
    throw new Error('当前 SidePanel 未绑定页面，请点击 Magnus 插件图标打开当前页面的工作区。');
  }
  const response = await sendRuntimeMessage({
    cmd: 'magnus.openPanel',
    tabId: context.tabId,
    openPanel: false,
  });
  if (!response || response.success === false) {
    throw new Error(response?.error || '初始化 Magnus 失败。');
  }
  context.workspaceId = response.workspace?.workspaceId || context.workspaceId || '';
  context.tabId = Number(response.workspace?.tabId || context.tabId || 0);
  context.panelTicket = response.panelTicket || '';
  return context.panelTicket;
}

document.addEventListener('DOMContentLoaded', () => {
  const context = parsePanelContext();
  loadMagnusConfig().then(() => {
    if (context.panelTicket) {
      loadIframe(context.panelTicket);
      return;
    }
    setStatus('正在初始化 Magnus...');
    return preparePanel(context).then(panelTicket => {
      loadIframe(panelTicket);
    });
  }).catch(error => {
    console.error('[Magnus] side panel init failed:', error);
    setStatus(`初始化失败：${error.message || error}`);
  });

  const rebindButton = document.getElementById('magnus-sidepanel-rebind');
  if (rebindButton) {
    rebindButton.addEventListener('click', async () => {
      try {
        setStatus('重新绑定页面...');
        const panelTicket = await rebindPanel(context);
        context.panelTicket = panelTicket;
        loadIframe(panelTicket);
      } catch (error) {
        console.error('[Magnus] side panel rebind failed:', error);
        setStatus(`绑定失败：${error.message || error}`);
      }
    });
  }
});

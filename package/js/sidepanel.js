const SOURCE_SERVER_URL = 'http://127.0.0.1:17321';
const IFRAME_ID = 'magnus-sidepanel-frame';

let bindSeq = 0;

function getFrame() {
  return document.getElementById(IFRAME_ID);
}

function setStatus(text) {
  const status = document.getElementById('magnus-sidepanel-status');
  if (status) status.textContent = text || '';
}

async function postJson(pathname, body) {
  const response = await fetch(`${SOURCE_SERVER_URL}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Magnus-Internal': 'source-server',
    },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function queryActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tabs && tabs[0] ? tabs[0] : null);
    });
  });
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

async function installRuntime(tab) {
  if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    throw new Error(`当前页面不支持注入 Magnus runtime：${tab?.url || ''}`);
  }
  const response = await sendRuntimeMessage({
    cmd: 'install',
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.url || '',
    page: {
      url: tab.url || '',
      title: tab.title || '',
    },
    magnusBoot: {
      browserTabId: tab.id,
      windowId: tab.windowId,
      sourceServerUrl: SOURCE_SERVER_URL,
      bridgeUrl: SOURCE_SERVER_URL.replace(/^http/, 'ws') + '/bridge',
      autoStartPicker: true,
    },
  });
  if (!response || response.success === false) {
    throw new Error(response?.error || 'Install runtime failed.');
  }
  const jsUrls = Array.isArray(response.config?.jsUrls) ? response.config.jsUrls : [];
  const hasRuntime = jsUrls.some(url => String(url || '').includes('/app/magnus/sfr-runtime.js'));
  if (!hasRuntime) {
    throw new Error(`当前页面未匹配 Magnus runtime 注入规则：${tab.url || ''}`);
  }
}

async function bindCurrentTab() {
  const seq = ++bindSeq;
  const frame = getFrame();
  try {
    setStatus('绑定当前页面...');
    const tab = await queryActiveTab();
    if (!tab?.id) throw new Error('No active tab.');
    await installRuntime(tab);
    const result = await postJson('/api/panel/bind', {
      tabId: tab.id,
      windowId: tab.windowId,
      page: {
        url: tab.url || '',
        title: tab.title || '',
      },
    });
    if (seq !== bindSeq) return;
    const nextUrl = `${SOURCE_SERVER_URL}/ui/?panelTicket=${encodeURIComponent(result.panelTicket)}`;
    if (frame) frame.src = nextUrl;
    setStatus('');
  } catch (error) {
    if (seq !== bindSeq) return;
    console.error('[Magnus] side panel bind failed:', error);
    setStatus(`绑定失败：${error.message || error}`);
    if (frame) frame.removeAttribute('src');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  bindCurrentTab();
  const rebindButton = document.getElementById('magnus-sidepanel-rebind');
  if (rebindButton) rebindButton.addEventListener('click', bindCurrentTab);
});

chrome.tabs.onActivated.addListener(() => {
  bindCurrentTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    bindCurrentTab();
  }
});

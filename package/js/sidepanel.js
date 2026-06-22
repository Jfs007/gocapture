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

function executeScript(target, details) {
  return chrome.scripting.executeScript({
    target,
    ...details,
  });
}

async function injectRuntime(tab) {
  if (!tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url)) return;
  const boot = {
    browserTabId: tab.id,
    windowId: tab.windowId,
    sourceServerUrl: SOURCE_SERVER_URL,
    bridgeUrl: SOURCE_SERVER_URL.replace(/^http/, 'ws') + '/bridge',
  };
  await executeScript({ tabId: tab.id }, {
    world: 'MAIN',
    func: value => {
      window.__MAGNUS_SFR_BOOT__ = value;
    },
    args: [boot],
  });
  await executeScript({ tabId: tab.id }, {
    world: 'MAIN',
    files: ['app/magnus/sfr-runtime.js'],
  });
}

async function bindCurrentTab() {
  const seq = ++bindSeq;
  const frame = getFrame();
  try {
    setStatus('绑定当前页面...');
    const tab = await queryActiveTab();
    if (!tab?.id) throw new Error('No active tab.');
    await injectRuntime(tab).catch(error => {
      console.warn('[Magnus] inject SFR failed:', error);
    });
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

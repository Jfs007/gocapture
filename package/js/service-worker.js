
const localConfig = {
  jsUrls: ['chrome/cli.js', 'chrome/web.js', "chrome/web-hook.js"]
}
let _VERSION_ = '';
// 全局缓存对象
let ExeCodeMap = {};
/**
 * 获取远程数据
 */
async function fetchData(url) {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch (error) {
    console.error('获取远程数据失败:', error);
    return null;
  }
}


function isUrlMatch(url, matches) {
  const patterns = Array.isArray(matches) ? matches : [matches];
  if (!patterns.length) return true;
  return patterns.some(p => matchOne(url, normalizePattern(p)))
}

function matchPort(actual, expected) {
  if (!expected) return true
  return actual === expected
}

function splitHostPort(patternHost) {
  const idx = patternHost.lastIndexOf(':')
  if (idx > -1 && /^\d+$/.test(patternHost.slice(idx + 1))) {
    return {
      host: patternHost.slice(0, idx),
      port: patternHost.slice(idx + 1)
    }
  }
  return { host: patternHost, port: null }
}


function normalizePattern(pattern) {
  if (pattern === '<all_urls>') return pattern

  let p = pattern.trim()

  // 1️⃣ 没有 scheme
  if (!p.includes('://')) {
    p = '*://' + p
  }

  // 2️⃣ 没有 path
  const idx = p.indexOf('/', p.indexOf('://') + 3)
  if (idx === -1) {
    p += '/*'
  }

  // 3️⃣ 只有 / 结尾
  if (p.endsWith('/')) {
    p += '*'
  }

  return p
}

function matchOne(url, pattern) {
  if (pattern === '<all_urls>') return true

  let urlObj
  try {
    urlObj = new URL(url)
  } catch {
    return false
  }

  const [scheme, rest] = pattern.split('://')
  const [hostPart, ...pathParts] = rest.split('/')
  const pathPattern = '/' + pathParts.join('/')

  const { host: hostPattern, port: portPattern } = splitHostPort(hostPart)

  return (
    matchScheme(urlObj.protocol.slice(0, -1), scheme) &&
    matchHost(urlObj.hostname, hostPattern) &&
    matchPort(urlObj.port, portPattern) &&
    matchPath(urlObj.pathname, pathPattern)
  )
}


function matchScheme(protocol, scheme) {
  return scheme === '*' || scheme === protocol
}

function matchHost(host, pattern) {
  if (pattern === '*') return true

  // *.example.com
  if (pattern.startsWith('*.')) {
    const bare = pattern.slice(2)
    return host === bare || host.endsWith('.' + bare)
  }

  return wildcardMatch(host, pattern)
}

function matchPath(path, pattern) {
  return wildcardMatch(path, pattern)
}

function wildcardMatch(str, pattern) {
  const regex = new RegExp(
    '^' +
    pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*') +
    '$'
  )
  return regex.test(str)
}


async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
/**
 * 填充iframe target信息
 */
function fillIframeIdToData(message, sender, execData) {
  // iframe id 优先使用 message.myIframeId，否则用 sender.frameId
  let frameId = message.myIframeId || (sender && sender.frameId);
  let frameIds = frameId ? [frameId] : undefined;

  // tab id
  let tabId = message.tabId || (sender.tab && sender.tab.id);
  // 填充 target
  execData.target = { tabId };
  if (frameIds) execData.target.frameIds = frameIds;

  // 如果 message 指定了执行目标，则覆盖 target
  if (message.executeTarget) execData.target = message.executeTarget;

  return execData;
}

/**
 * Chrome runtime 消息监听调用
 * @param {Object} message - 消息对象，对应 e
 * @param {Object} sender - 消息发送者信息，对应 t
 * @param {Function} sendResponse - 回调响应函数，对应 r
 */
function InjectLister(message, sender, sendResponse) {
  // 默认执行环境（world）
  let world = message.world || "MAIN";
  // 如果 type === 2，执行文件注入
  if (message.type === 2) {
    const execData = fillIframeTarget(
      message,
      sender,
      { world, files: message.fileNames }
    );
    chrome.scripting.executeScript(execData).then(result => {

      sendResponse(result);
    });

    return; // 早返回
  }
  // 默认执行函数注入
  let args = message.args || [message.params];
  const execData = fillIframeTarget(
    message,
    sender,
    { function: injectScript, args, world }
  );

  chrome.scripting.executeScript(execData).then(result => {
    sendResponse(result);
  });
}
/**
 * 执行注入的函数
 * @param {Object} params - 参数对象
 */
function injectScript(params) {
  if (!params) return;
  if (params.type === "eval" && params.value) {
    return eval(params.value);
  }
}
/**
 * 填充 iframe/tab 信息，生成 chrome.scripting.executeScript 所需对象
 * @param {Object} message - 消息对象
 * @param {Object} sender - 消息发送者
 * @param {Object} execData - 执行数据对象
 * @returns {Object} 带 target 信息的执行数据
 */
function fillIframeTarget(message, sender, execData) {
  // iframe id 优先使用 message.myIframeId，否则用 sender.frameId
  let frameId = message.myIframeId || sender.frameId;
  let frameIds = frameId ? [frameId] : undefined;

  // tab id
  let tabId = message.tabId || (sender.tab && sender.tab.id);
  // 填充 target
  execData.target = { tabId };
  if (frameIds) execData.target.frameIds = frameIds;

  // 如果 message 指定了执行目标，则覆盖 target
  if (message.executeTarget) execData.target = message.executeTarget;

  return execData;
}

// 导出对象
const injectCmd = { Lister: InjectLister };
// https://cdn.itaored.com/static/fed/testldd-chrome-plugin/install-package
let CONFIG_BASE_URL = '';
let APP_API = '';
function GetRemoteConfigUrl() {
  return `${CONFIG_BASE_URL}app/config.json?t=${Date.now()}`;
}
function GetLocalAppConfigUrl() {
  try {
    return chrome.runtime.getURL('app/config.json') + '?id=' + Date.now();
  } catch (error) {
    return ''
  }
}
/**
 * 检查给定 URL 是否在允许的子 URL 列表中
 * @param {string} url - 需要检查的 URL
 * @returns {Promise<boolean>} 如果 URL 匹配列表中的任意一项，则返回 true，否则 false
 */
async function checkHasSubUrl(url) {
  let hasMatch = false;

  try {
    // 从 chrome.storage.local 获取 enable_sub_urls 配置
    const data = await chrome.storage.local.get(["enable_sub_urls"]);

    // 遍历允许的 URL 列表，检查是否包含目标 URL
    const urls = data.enable_sub_urls?.urls || [];
    for (const allowedUrl of urls) {
      if (url.includes(allowedUrl)) {
        hasMatch = true;
        break; // 一旦匹配就退出循环
      }
    }
  } catch (err) {
    // 出错时默认返回 false，不影响主流程
    console.warn("checkHasSubUrl error:", err);
  }

  return hasMatch;
}

/**
 * 获取配置
 * @param {Object} context - 上下文对象，原来的 e
 * @param {Object} sender - 消息发送者信息，原来的 t
 * @param {Function} callback - 可选回调函数，原来的 r
 * @returns {Promise<Object|undefined>} 返回配置对象，如果不满足条件则返回 undefined
 */
async function GetConfig(context, sender, callback) {
  const url = sender.url;
  // 1️⃣ 判断是否子 iframe
  // 2️⃣ 获取 manifest 信息
  context.isSub = sender.frameId && sender.frameId > 0;

  const manifest = chrome.runtime.getManifest();
  const { site } = manifest.env || {};
  if (context.isSub) {
    if (url.indexOf(site) < 0) return;
    // if (!url) return; // 没有 url 就不请求
    // if (!(await checkHasSubUrl(url))) return; // url 不在允许列表
  }
  if (manifest.env) {
    CONFIG_BASE_URL = manifest.env.source;
    APP_API = manifest.env.api;
  }
  // 处理作者名
  let authorName = manifest.author_name || manifest.authorName || "";
  // 处理渠道信息
  const channel = manifest.channel || "";

  // 3️⃣ 构建请求头信息
  const headers = {
    z_channel: channel,
    z_crxid: chrome.runtime.id,
    z_v: manifest.version,
    z_authorname: authorName,
  };

  if (context.isOnlineConfig) headers.z_isOnlineConfig = 1;
  if (context.isDevConfig) headers.z_isdevconfig = 1;
  if (context.isSub) headers.z_issub = true;
  // 当前页面 URL
  headers.z_current = url;
  const GetConfigUrl = manifest.app_module == 'Offline' ? GetLocalAppConfigUrl : GetRemoteConfigUrl;
  // 4️⃣ 请求配置
  const response = await fetch(GetConfigUrl(), { headers });
  const data = await response.json();




  // 5️⃣ 返回结果，并调用回调
  const result = data.result || [];
  const version = data.version || '';
  const rules = data.rules || {};
  const reResult = {};
  if (version !== _VERSION_) {
    console.log(version, _VERSION_, '版本更新，清理缓存');
    _VERSION_ = version;
    ExeCodeMap = {};

  }
  // console.log('配置', result);
  Object.keys(result).map(key => {
    let item = result[key] || [];
    item = item.filter(url => {
      const urlRule = rules[url];

      const { matches, supportIframe } = urlRule || {};
      // 如果是iframe 且不支持iframe 则不注入
      if (context.isSub && !supportIframe) return false;
      const isMatch = isUrlMatch(sender?.url || '', matches || []);
      return isMatch;
    });
    reResult[key] = item.map(url => manifest.app_module == 'Offline' ? chrome.runtime.getURL(`app/${url}`) : `${CONFIG_BASE_URL}app/${url}`);
  });
  if (callback) callback(reResult);
  return reResult;
}



/**
 * 主入口函数，用于动态注入 JS/CSS 到页面或 iframe
 * @param {Object} message - 来自 chrome.runtime.onMessage 的消息对象
 * @param {Object} sender - 消息发送者信息
 * @param {Function} sendResponse - 回调函数，用于异步返回
 */
async function hotCodeLister(message, sender, sendResponse) {
  console.log('注入代码', sender, message);
  // 2️⃣ 注入本地通用 JS 文件
  await requestLocalExecuteScript({}, message, sender);

  // 1️⃣ 获取当前页面/iframe配置，包括要加载的 JS/CSS URL
  const config = await GetConfig(message, sender, sendResponse);

  if (!config || (!config.jsUrls && !config.cssUrls)) return;

  // 3️⃣ 注入本地通用 CSS 文件
  await requestLocalExecuteCss(config, message, sender);

  // 4️⃣ 注入配置中指定的 CSS 文件
  for (let cssUrl of config.cssUrls || []) {
    await executeCss(cssUrl, config, message, sender);
  }

  // 5️⃣ 注入配置中指定的 JS 文件
  // for (let jsUrl of config.jsUrls || []) {


  // }
  const rules = config.rules || {};
  config.jsUrls.map(async jsUrl => {
    await executeScript(jsUrl, config, message, sender);
  })
}

/**
 * 注入本地 JS 文件列表
 */
async function requestLocalExecuteScript(config, message, sender) {
  let files = localConfig.jsUrls;
  if (!files.length) return;

  if (config.requestLocalExecuteJs) files = config.requestLocalExecuteJs;

  const world = config.world || "MAIN";
  let execData = { world, files };
  execData = fillIframeIdToData(message, sender, execData);

  return chrome.scripting.executeScript(execData);
}

/**
 * 注入本地 CSS 文件列表
 */
async function requestLocalExecuteCss(config, message, sender) {
  let files = [];
  if (!files.length) return;
  if (config.requestLocalExecuteCss) files = config.requestLocalExecuteCss;

  let execData = { files };
  execData = fillIframeIdToData(message, sender, execData);

  return chrome.scripting.insertCSS(execData);
}

/**
 * 注入远程或配置的 JS 文件
 */
async function executeScript(url, config, message, sender) {
  const key = `js_${url}`;
  let code = ExeCodeMap[key];
  if (!code) {
    code = await fetchData(url + '?id=' + Date.now());
    if (code) ExeCodeMap[key] = code;
  }

  if (code) return executeScript2(code, config, message, sender);
}

/**
 * 使用 chrome.scripting.executeScript 执行 JS
 */
async function executeScript2(code, config, message, sender) {
  const world = config.world || "MAIN";
  let execData = { function: injectJsCode, args: [code], world };
  execData = fillIframeIdToData(message, sender, execData);
  return chrome.scripting.executeScript(execData);
}

/**
 * 注入远程或配置的 CSS 文件
 */
async function executeCss(url, config, message, sender) {
  const key = `css_${url}`;
  let code = ExeCodeMap[key];

  if (!code) {
    code = await fetchData(url);
    if (code) ExeCodeMap[key] = code;
  }

  if (code) return executeCss2(code, config, message, sender);
}

/**
 * 将 CSS 内容注入到页面
 */
async function executeCss2(cssContent, config, message, sender) {
  const script = `
    const style = document.createElement('style');
    style.innerHTML = \`${cssContent}\`;
    document.head.appendChild(style);
  `;

  const world = config.world || "MAIN";
  let execData = { function: injectJsCode, args: [script], world };
  execData = fillIframeIdToData(message, sender, execData);

  return chrome.scripting.executeScript(execData);
}

/**
 * 注入函数，用于 chrome.scripting.executeScript 执行
 */
function injectJsCode(code) {
  if (!code) return;
  return eval(code); // 你也可以换成 new Function(code)() 更安全
}


const HotCodeCmd = {
  Lister: hotCodeLister
}



// ---------------------------
// 删除 Cookie
// ---------------------------
async function removeCookie(options, unused, callback) {
  if (options.name) {
    // 删除单个 Cookie
    chrome.cookies.remove({ url: options.url, name: options.name }, callback);
  } else if (options.names) {
    // 删除多个 Cookie
    options.names.forEach((name) => {
      chrome.cookies.remove({ url: options.url, name });
    });
  } else if (options.removeInfos) {
    // 删除自定义 Cookie 对象列表
    options.removeInfos.forEach((cookieInfo) => {
      chrome.cookies.remove(cookieInfo);
    });
  }

  callback(); // 通知调用方操作完成
}

// ---------------------------
// 设置 Cookie
// ---------------------------
function setCookies(options, unused, callback) {
  const domainUrl = options?.domainUrl || "";
  const cookieData = options.cookieData;

  for (const cookieName in cookieData) {
    const cookieValueOrDetail = cookieData[cookieName];
    let cookieDetail = cookieValueOrDetail.detail || {
      url: domainUrl,
      name: cookieName,
      value: cookieValueOrDetail,
      secure: options.secure || false,
      httpOnly: options.httpOnly || false,
    };

    if (options.domain) {
      cookieDetail.domain = options.domain;
    }

    chrome.cookies.set(cookieDetail, () => { });
  }

  callback(); // 通知调用方设置完成
}

// ---------------------------
// 消息处理分发器
// ---------------------------
async function cookieLister(message, sender, sendResponse) {
  if (message.cmd === "removeCookie") {
    return removeCookie(message, sender, sendResponse);
  }

  if (message.cmd === "setCookies") {
    return setCookies(message, sender, sendResponse);
  }

  // 默认操作：获取指定域名下所有 Cookie
  const allCookies = await chrome.cookies.getAll({ domain: message.myDomain });
  // console.log('获取 Cookie:', allCookies, message);
  const cookiesArray = [];
  let cookiesString = "";

  allCookies.forEach((cookie, index) => {
    const cookieObj = { ...cookie, name: cookie.name, value: cookie.value };
    cookiesArray.push(cookieObj);

    cookiesString += `${cookieObj.name}=${cookieObj.value}`;
    if (index < allCookies.length - 1) cookiesString += ";";
  });

  // 返回 Cookie 数据
  sendResponse && sendResponse({ cookies: cookiesArray, cookiesStr: cookiesString });
}


const cookieCmd = {
  Lister: cookieLister
}




chrome.runtime.onMessage.addListener(((message, sender, sendResponse) => (onMessageLister(message, sender, sendResponse), !0)));

chrome.runtime.onMessageExternal.addListener(function (message, sender, sendResponse) {
  onMessageLister(message, sender, sendResponse);
});



// 提取正则匹配的第一个分组结果
function matchFirstGroup(text, regex) {
  if (!text) return false;
  const match = regex.exec(text);
  return !!(match && match.length > 1) && match[1];
}
var headerPre = "md-header-";
// 更新请求头规则
async function updateRequestRules(requestConfig) {
  const headers = requestConfig.headers || requestConfig.header;
  const preservedHeaders = {};
  let hasCustomHeader = false;
  let domainFilter = "";

  // 提取 URL 域名
  if (requestConfig.url) {
    domainFilter = matchFirstGroup(requestConfig.url, /\/\/([^\/]+)/);
  }

  const customHeaderRules = [];
  for (let headerKey in headers) {
    const headerValue = headers[headerKey];
    headerKey = String(headerKey).toLowerCase();

    if (headerKey.includes(headerPre)) {
      hasCustomHeader = true;
      const cleanKey = headerKey.replace(headerPre, "");
      customHeaderRules.push({ header: cleanKey, operation: "set", value: headerValue });
    } else {
      preservedHeaders[headerKey] = headerValue;
    }
  }

  // 没有特殊 header 就直接返回
  if (!hasCustomHeader) return preservedHeaders;

  // 默认规则
  let requestHeadersRule = [...customHeaderRules];
  let condition = { urlFilter: domainFilter, resourceTypes: ["xmlhttprequest"] };

  if (requestConfig.requestHeaders) {
    requestHeadersRule = requestConfig.requestHeaders;
  }
  if (requestConfig.condition) {
    condition = requestConfig.condition;
  }

  // 规则模板
  let rulesToAdd = [
    {
      id: 14,
      priority: 1,
      action: { type: "modifyHeaders", requestHeaders: requestHeadersRule },
      condition,
    },
  ];
  let rulesToRemove = [14];

  // 自定义规则替换
  if (requestConfig.addRules && requestConfig.addRules.length > 0) {
    rulesToAdd = requestConfig.addRules;
  }
  if (requestConfig.removeRuleIds && requestConfig.removeRuleIds.length > 0) {
    rulesToRemove = requestConfig.removeRuleIds;
  }

  // 更新 session 规则
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: rulesToRemove,
    addRules: rulesToAdd,
  });

  return preservedHeaders;
}

// 清理规则并设置默认 ping 请求头
async function clearRequestRules() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [14, 999],
    addRules: [
      {
        id: 999,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "referer", operation: "set", value: "https://aaabg.com" },
            { header: "origin", operation: "set", value: "https://aaabg.com" },
          ],
        },
        condition: { resourceTypes: ["ping"], urlFilter: "aaabg.com" },
      },
    ],
  });
}

// 获取 Base64 内容
function fetchAsBase64(url, callback) {
  fetch(url)
    .then((res) => res.blob())
    .then((blob) => {
      const reader = new FileReader();
      reader.onload = (e) => callback(e.currentTarget.result);
      reader.readAsDataURL(blob);
    })
    .catch(() => { });
}

// 请求规则工具
const httpRule = {
  update: updateRequestRules,
  clear: clearRequestRules,
};
const fetchPatch = (url) => {
  const manifest = chrome.runtime.getManifest();
  const { api } = manifest.env || {};
  console.log(api, 'api');
  if (!(/^https?:\/\//i.test(url))) {
    return api + url;
  }
  return url;
}

export function appendParams(
  url,
  params = {}
) {
  if (!params || Object.keys(params).length === 0) return url

  // 1. 拆 hash
  const [urlWithoutHash, hash = ''] = url.split('#')
  const hashPart = hash ? `#${hash}` : ''
  // 2. 拆 query
  const [path, query = ''] = urlWithoutHash.split('?')

  const queryMap = {}

  // 3. 解析原有 query
  if (query) {
    query.split('&').forEach(pair => {
      if (!pair) return
      const [k, v = ''] = pair.split('=')
      queryMap[decodeURIComponent(k)] = decodeURIComponent(v)
    })
  }

  // 4. 合并新 params（覆盖）
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return

    if (typeof value === 'object') {
      queryMap[key] = JSON.stringify(value)
    } else {
      queryMap[key] = String(value)
    }
  })

  // 5. 重新拼 query
  const newQuery = Object.entries(queryMap)
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
    )
    .join('&')

  return newQuery
    ? `${path}?${newQuery}${hashPart}`
    : `${path}${hashPart}`
}

async function fetchInspectConfig(config) {
  let fetchOptions = { headers: await httpRule.update(config) };
  if (config.method) fetchOptions.method = config.method;

  if (config.data) fetchOptions.body = JSON.stringify(config.data);

  if (config.fetchParams) fetchOptions = config.fetchParams;
  // base64 模式
  if (config.type && config.type.toLowerCase() === "base64") {
    return fetchAsBase64(config.url, callback);
  };
  let url = fetchPatch(config.url);

  if (config.method && config.method.toLowerCase() == 'get') {
    url = appendParams(url, config.data);
    fetchOptions.body = undefined;
  }
  return {
    url,
    fetchOptions
  }

}

// 包装 fetch
async function fetchWithRules(config, sender, callback) {
  // let fetchOptions = { headers: await httpRule.update(config) };
  // if (config.method) fetchOptions.method = config.method;

  // if (config.data) fetchOptions.body = JSON.stringify(config.data);

  // if (config.fetchParams) fetchOptions = config.fetchParams;
  // // base64 模式
  // if (config.type && config.type.toLowerCase() === "base64") {
  //   return fetchAsBase64(config.url, callback);
  // };
  // let url = fetchPatch(config.url);

  // if (config.method && config.method.toLowerCase() == 'get') {
  //   url = appendParams(url, config.data);
  //   fetchOptions.body = undefined;
  // }
  const { url, fetchOptions } = await fetchInspectConfig(config)

  console.log('Fetch URL:', url, fetchOptions);

  fetch(url, fetchOptions)
    .then(async (res) => {
      if (config.blob) {
        // 👇 关键一步：转 blob
        const blob = await res.blob();
        return blob;
      }
      if (!res.ok) throw await res.text();
      return res.text();
    })
    .then((responseText) => {
      let parsedResult = null;
      try {
        parsedResult = JSON.parse(responseText);
      } catch (_) {
        parsedResult = responseText;
      }
      const result = {
        result: parsedResult || responseText,
        resultContent: responseText,
        success: true,
      };

      if (config.isNotNeedClearRules) return callback(result);
      console.log('clear rules', result);
      httpRule.clear().then(() => callback(result));
    })
    .catch((err) => {
      const result = { result: err, success: false };

      if (config.isNotNeedClearRules) return callback(result);

      httpRule.clear().then(() => callback(result));
    });
}

const fetchCmd = {
  Lister: fetchWithRules,
};


const removeCookie2 = async (options = {}, handle = () => { }) => {
  chrome.browsingData.removeCookies({
    origins: options.origins
  }, function () {
    handle && handle();
    // chrome.tabs.reload(tab.id);
  });
};

async function changeAccount(message, sender, sendResponse) {
  let tabid = sender ? sender.tab.id : null;
  if (!tabid) {
    const tab = await getCurrentTab() || {};
    tabid = tab.id;
  }
  removeCookie2(message, () => {
    chrome.tabs.reload(tabid);
    sendResponse && sendResponse({})
  })
};

const ChangeAccountCmd = {
  Lister: (message, sender, sendResponse) => {
    changeAccount(message, sender, sendResponse)
  }
}

async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument()
  if (exists) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'js/offscreen.html',
      reasons: ['BLOBS'],
      justification: 'download binary file'
    });
  } catch (error) {
  }

}

const DownFileCmd = {
  Lister: async (message, sender, sendResponse) => {
    message.blob = true;
    message.method = message.method || 'post';
    const { url, fetchOptions } = await fetchInspectConfig(message);
    // await ensureOffscreen();
    // chrome.runtime.sendMessage({
    //   cmd: 'downFile',
    //   url,
    //   fetchOptions,
    //   filename: message.filename
    // });

  }
}

function onMessageLister(message, sender, sendResponse) {
  if ("downFile" === message.cmd) return DownFileCmd.Lister(message, sender, sendResponse);
  if ("openPopup" === message.cmd) {
    chrome.action.openPopup();
    return;
  }
  if ("get-manifest" === message.cmd) {
    sendResponse && sendResponse(chrome.runtime.getManifest());
    return;
  }
  if ("changeAccount" === message.cmd) return ChangeAccountCmd.Lister(message, sender, sendResponse);
  if ("start" === message.cmd) return HotCodeCmd.Lister(message, sender, sendResponse);
  if ("inject" === message.cmd) return injectCmd.Lister(message, sender, sendResponse);
  if ("fetch" === message.cmd || "ajax" === message.cmd) return fetchCmd.Lister(message, sender, sendResponse);
  if ("getCookie" === message.cmd || "removeCookie" === message.cmd || "setCookies" === message.cmd) return cookieCmd.Lister(message, sender, sendResponse);
}


let INSTALLER_RELOAD = false;
chrome.runtime.onInstalled.addListener((details) => {
  INSTALLER_RELOAD = true;
});


const localConfig = {
  jsUrls: ['chrome/cli.js', 'chrome/web.js']
}

// 全局缓存对象
const myExeCodeMap = {};

// 简化的模块管理
const moduleManager = {
  // 模块代码缓存
  moduleCache: new Map(),
  
  /**
   * 加载模块
   * @param {string} moduleName - 模块名
   */
  async loadModule(moduleName) {
    // 检查缓存
    if (this.moduleCache.has(moduleName)) {
      return this.moduleCache.get(moduleName);
    }
    
    try {
      // 构建模块路径
      const modulePath = `cp_modules/${moduleName}/index.js`;
      const url = chrome.runtime.getURL(modulePath);
      
      // 获取模块代码
      const code = await fetchData(url);
      if (!code) {
        throw new Error(`Failed to load module: ${moduleName}`);
      }
      
      // 缓存代码
      this.moduleCache.set(moduleName, code);
      console.log(`✅ 模块加载成功: ${moduleName}`);
      
      return code;
    } catch (error) {
      console.error(`❌ 模块加载失败: ${moduleName}`, error);
      throw error;
    }
  }
};
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

/**
 * 填充iframe target信息
 */
function fillIframeIdToData(message, sender, execData) {
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



function GetRemoteConfigUrl() {
  return `${`https://plug${(new Date).getTime() % 100}.zzbtool.com`}/zzbPlug/v3config`;
}

function GetLocalAppConfigUrl() {
  try {
    return chrome.runtime.getURL('app/config.json') + '?id=' + Date.now() ;
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
  context.isSub = sender.frameId && sender.frameId > 0;
  if (context.isSub) {
    if (!url) return; // 没有 url 就不请求
    if (!(await checkHasSubUrl(url))) return; // url 不在允许列表
  }
  // 2️⃣ 获取 manifest 信息
  const manifest = chrome.runtime.getManifest();
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
  const reResult = {};
  Object.keys(result).map(key => {
    const item = result[key] || [];
    reResult[key] = item.map(url =>  manifest.app_module == 'Offline' ? chrome.runtime.getURL(`app/${url}`) : url);
  })
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
  // 1️⃣ 获取当前页面/iframe配置，包括要加载的 JS/CSS URL
  const config = await GetConfig(message, sender, sendResponse);

  if (!config || (!config.jsUrls && !config.cssUrls)) return;
  // 2️⃣ 注入本地通用 JS 文件（jquery/layer/...）
  await requestLocalExecuteScript(config, message, sender);

  // 3️⃣ 注入本地通用 CSS 文件
  await requestLocalExecuteCss(config, message, sender);

  // 4️⃣ 注入配置中指定的 CSS 文件
  for (let cssUrl of config.cssUrls || []) {
    await executeCss(cssUrl, config, message, sender);
  }

  // 5️⃣ 注入配置中指定的 JS 文件
  for (let jsUrl of config.jsUrls || []) {

    await executeScript(jsUrl, config, message, sender);
  }
}

/**
 * 注入本地 JS 文件列表
 */
async function requestLocalExecuteScript(config, message, sender) {
  let files = localConfig.jsUrls;
  if(!files.length) return;

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
  if(!files.length) return;
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
  let code = myExeCodeMap[key];
  if (!code) {
    code = await fetchData(url+ '?id=' + Date.now());
    if (code) myExeCodeMap[key] = code;
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
  let code = myExeCodeMap[key];

  if (!code) {
    code = await fetchData(url);
    if (code) myExeCodeMap[key] = code;
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





chrome.runtime.onMessage.addListener(((message, sender, sendResponse) => (onMessageLister(message, sender, sendResponse), !0)));

chrome.runtime.onMessageExternal.addListener(function (message, sender, sendResponse) {
  onMessageLister(message, sender, sendResponse);
});


function onMessageLister(message, sender, sendResponse) {
  if ("start" === message.cmd) return HotCodeCmd.Lister(message, sender, sendResponse);
  if ("inject" === message.cmd) return injectCmd.Lister(message, sender, sendResponse);
  if ("importModule" === message.cmd) return moduleCmd.Lister(message, sender, sendResponse);
}

// 模块命令处理器
const moduleCmd = {
  async Lister(message, sender, sendResponse) {
    try {
      const { moduleName, action = 'import' } = message;
      
      if (action === 'import') {
        // 加载模块代码
        const moduleCode = await moduleManager.loadModule(moduleName);
        
        // 注入模块代码到目标页面
        const execData = fillIframeTarget(
          message,
          sender,
          { function: injectJsCode, args: [moduleCode], world: "MAIN" }
        );
        
        const result = await chrome.scripting.executeScript(execData);
        sendResponse({ success: true, result });
      } else {
        sendResponse({ success: false, error: `Unknown action: ${action}` });
      }
    } catch (error) {
      console.error('Module command error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
};







(function() {
  "use strict";
  var __vite_style__ = document.createElement("style");
  __vite_style__.textContent = "\n.jinritemai-floating-toolbox {\n  width: 300px;\n  background: #fff;\n  border-radius: 8px;\n  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);\n  border: 1px solid #e8e8e8;\n  overflow: hidden;\n}\n.jinritemai-floating-toolbox .toolbox-header {\n  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n  color: white;\n  padding: 8px 12px;\n  cursor: move;\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  user-select: none;\n}\n.jinritemai-floating-toolbox .toolbox-title {\n  font-size: 13px;\n  font-weight: 500;\n}\n.jinritemai-floating-toolbox .toolbox-actions {\n  display: flex;\n  gap: 4px;\n}\n.jinritemai-floating-toolbox .minimize-btn {\n  background: none;\n  border: none;\n  color: white;\n  cursor: pointer;\n  font-size: 14px;\n  width: 20px;\n  height: 20px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 2px;\n}\n.jinritemai-floating-toolbox .minimize-btn:hover {\n  background: rgba(255, 255, 255, 0.1);\n}\n.jinritemai-floating-toolbox .toolbox-content {\n  padding: 16px;\n}\n.jinritemai-floating-toolbox .status-section {\n  margin-bottom: 16px;\n  padding: 12px;\n  background: #f8f9fa;\n  border-radius: 6px;\n}\n.jinritemai-floating-toolbox .status-item {\n  display: flex;\n  align-items: center;\n  margin-bottom: 8px;\n}\n.jinritemai-floating-toolbox .status-label {\n  font-size: 12px;\n  color: #666;\n  margin-right: 8px;\n}\n.jinritemai-floating-toolbox .status-value {\n  font-size: 12px;\n  font-weight: 500;\n}\n.jinritemai-floating-toolbox .status-connected {\n  color: #52c41a;\n}\n.jinritemai-floating-toolbox .login-tips {\n  font-size: 11px;\n  color: #999;\n  line-height: 1.4;\n}\n.jinritemai-floating-toolbox .action-section {\n  margin-bottom: 16px;\n}\n\n/* NModal 内容样式 */\n.modal-content {\n  display: flex;\n  align-items: center;\n  gap: 16px;\n  padding: 16px 0;\n}\n.loading-spinner {\n  font-size: 24px;\n  animation: spin 1s linear infinite;\n}\n@keyframes spin {\n0% { transform: rotate(0deg);\n}\n100% { transform: rotate(360deg);\n}\n}\n.modal-text {\n  flex: 1;\n}\n.modal-text p {\n  /* margin: 8px 0; */\n  font-size: 14px;\n  color: #666;\n}\n.modal-footer {\n  display: flex;\n  gap: 12px;\n  justify-content: flex-end;\n}\n.btn-large {\n  width: 100%;\n}\n/*$vite$:1*/";
  document.head.appendChild(__vite_style__);
  const App$1 = async () => {
    const loadsh = _require("loadsh");
    const CR = _require("chromeRedux");
    const webHook = _require("webHook");
    let app = await CR.get("DOUYIN_GOODS2");
    if (app.step == "AI_PUT_GOODS_INFO") {
      loadsh.showToast({
        message: "上传主图中,请勿操作...",
        duration: -1
      });
    }
    async function uploadMainImage() {
      var _a, _b;
      if (app.step !== "AI_PUT_GOODS_INFO") return;
      const uploader = document.querySelector(".material-upload-button input");
      const { mainImages, baseInfo } = app.goodsInfo || { mainImages: [], baseInfo: {} };
      if (!(mainImages || []).length) return;
      const title = (_a = baseInfo == null ? void 0 : baseInfo.title_info) == null ? void 0 : _a.title;
      const safeTitle = (_b = baseInfo == null ? void 0 : baseInfo.title_info) == null ? void 0 : _b.safeTitle;
      loadsh.simulateInput(document.querySelector("#pg-title-input"), title);
      const getBlobs = (mainImages || []).map((image) => {
        return loadsh.imageToBlob(image.url);
      });
      const blobs = await Promise.all(getBlobs);
      loadsh.simulateUpload(uploader, blobs.map((blob, i) => {
        return { blob, name: `主图_${safeTitle.slice(0, 14)}_${i}.png` };
      }));
    }
    function addSchemeRuleDangerLevel({ modifier }) {
      if (app.step !== "ADD_GOODS_DRAFT_INFO") return;
      webHook.addRule({
        urlPattern: "addWithSchema",
        modifier
      });
    }
    function removeSchemeRuleSafeLevel() {
      webHook.removeRule("addWithSchema");
    }
    let skuAndSpecs = {};
    let goodsInfo = {
      categoryPath: [],
      likeCategroyPath: []
    };
    let uploadDetailImageCount = 0;
    async function updateDetailImage() {
      var _a;
      uploadDetailImageCount = 0;
      loadsh.showToast({
        message: "上传详情图中,请勿操作...",
        duration: -1
      });
      const uploader = document.querySelector('.goods-publish-highlight-item input[type="file"]');
      const { detailImages, baseInfo } = app.goodsInfo || { detailImages: [], baseInfo: {} };
      const safeTitle = (_a = baseInfo == null ? void 0 : baseInfo.title_info) == null ? void 0 : _a.safeTitle;
      try {
        const getBlobs = (detailImages || []).filter((image) => image.url_list && image.url_list[0]).map((image) => {
          return loadsh.imageToBlob(image.url_list[0]);
        });
        const blobs = await Promise.all(getBlobs);
        loadsh.simulateUpload(uploader, blobs.map((blob, i) => {
          return { blob, name: `详图_${safeTitle.slice(0, 14)}_${i}.png` };
        }));
      } catch (error) {
      }
    }
    async function setCate() {
      const categoryIds = app.goodsInfo.categoryIds || [];
      const lastCid = categoryIds[categoryIds.length - 1];
      try {
        const cid = categoryIds[categoryIds.length - 2];
        const cateRes = await fetch(`https://fxg.jinritemai.com/product/tproduct/categoryOptionsN?cid=${cid}`, {});
        const cateJson = await cateRes.json();
        const item = cateJson.data.find((_) => _.id == lastCid) || {};
        const cateItemRes = await fetch(`https://fxg.jinritemai.com/product/tproduct/searchCategoryN?key=${item.name}`);
        const cateItemJson = await cateItemRes.json();
        const compareItem = cateItemJson.data[0];
        goodsInfo.categoryPath = ["first", "second", "third", "fourth"].map((key) => {
          return compareItem[key + "_name"];
        }).filter((_) => _);
        validateGoodsCate();
      } catch (error) {
      }
    }
    async function validateGoodsCate() {
      const likeCategroyPath = goodsInfo.likeCategroyPath;
      if (likeCategroyPath[likeCategroyPath.length - 1] != goodsInfo.categoryPath[goodsInfo.categoryPath.length - 1]) {
        const btns = document.querySelectorAll(".ecom-g-btn-link");
        const tuijianBtn = [...btns].find((_) => _.innerText == "更多推荐");
        const becopyDiv = tuijianBtn.previousElementSibling;
        const copyDiv = becopyDiv.cloneNode();
        copyDiv.innerText = `检测到榜单同商品类目: ${goodsInfo.categoryPath.join(" > ")}，非平台推荐`;
        copyDiv.style.color = "#ff3b52";
        becopyDiv.parentNode.insertBefore(copyDiv, becopyDiv);
        loadsh.showToast({
          message: "监测到平台推荐类目与榜单同品类目不一致，自行选择后点击【下一步】",
          duration: -1
        });
        tuijianBtn.click();
      }
    }
    const api_hook = {
      "tshopuser/getContractTemplate": () => {
        uploadMainImage();
      },
      "refetchSchema?action=weight_unit_refresh": async (res, options = {}) => {
        setCate();
        if (app.step !== "AI_PUT_GOODS_INFO") return;
        const btns = document.querySelectorAll(".ecom-g-btn");
        const nextBtn = [...btns].find((_) => _.innerText == "下一步");
        if (nextBtn) nextBtn.click();
      },
      "product/img/batchupload?_bid=ffa_goods|repeat": (res) => {
        if (app.step !== "ADD_GOODS_DRAFT_INFO") return;
        if (uploadDetailImageCount == 0) {
          const defaultDetailImgDelIcon = document.querySelector('[class*="styles_previewInstanceImgSortableList"] div[role="button"]:first-of-type [class*="styles_iconDelete"]');
          defaultDetailImgDelIcon && defaultDetailImgDelIcon.click();
          console.log(defaultDetailImgDelIcon, "defaultDetailImgDelIcon");
        }
        uploadDetailImageCount = res.result.data.length + uploadDetailImageCount;
        if (uploadDetailImageCount == app.goodsInfo.detailImages.length) {
          addSchemeRuleDangerLevel({
            modifier: `(body) => {
            const skuAndSpecs = ${JSON.stringify(skuAndSpecs)};
            body.schema.model.sku_detail = skuAndSpecs.sku_detail;
            body.schema.model.spec_detail = skuAndSpecs.spec_detail;
            return body
            }`
          });
          const btns = document.querySelectorAll(".ecom-g-btn");
          const saveBtn = [...btns].find((_) => _.innerText == "保存草稿");
          saveBtn && saveBtn.click();
        }
      },
      "tproduct/addWithSchema": async (res) => {
        removeSchemeRuleSafeLevel();
        if (app.step !== "ADD_GOODS_DRAFT_INFO") return;
        const data = res.result.data || {};
        await CR.commit("DOUYIN_GOODS2/RESET");
        if (!data.product_id) {
          setTimeout(() => {
            loadsh.showToast({
              message: "创建失败，请手动创建该商品!",
              duration: -1
            });
          }, 800);
          return;
        }
        window.close();
        window.open(`https://fxg.jinritemai.com/ffa/g/create?product_id=${data.product_id}`);
      },
      "tproduct/predictCategoryN": (res) => {
        var _a, _b;
        const data = ((_b = (_a = res.result) == null ? void 0 : _a.data) == null ? void 0 : _b.candidate_category_details) || [];
        const compareItem = data[0];
        const likeCategroyPath = ["first", "second", "third", "fourth"].map((key) => {
          return compareItem[key + "_cname"];
        }).filter((_) => _);
        goodsInfo.likeCategroyPath = likeCategroyPath;
      },
      "tproduct/listProductTemplate": () => {
        if (app.step != "ADD_GOODS_DRAFT_INFO") return;
        setTimeout(() => {
          updateDetailImage();
        }, 60);
      },
      "tproduct/getSchema|repeat": async (res) => {
        var _a, _b, _c, _d;
        const result = res.result;
        const items = (_b = (_a = result.data) == null ? void 0 : _a.model) == null ? void 0 : _b.spec_detail.items;
        const specDetail = (_d = (_c = result.data) == null ? void 0 : _c.model) == null ? void 0 : _d.spec_detail;
        skuAndSpecs = utils.parseSku(app.goodsInfo.skuInfo, items || [], specDetail);
        console.log(skuAndSpecs, items, "items");
      }
    };
    window.addEventListener("message", function(event) {
      const { type, data } = event.data;
      if (type == "WEB_REQUEST_RESPONSE") {
        const url = data ? data.url : "-";
        const regex = /^([^|]+)(?:\|([a-zA-Z]+))?$/;
        let action = "";
        const matchUrl = Object.keys(api_hook).find((matchUrl2) => {
          const match = matchUrl2.match(regex);
          const [_, originUrl, matchAction] = match || [];
          action = matchAction;
          if (url.indexOf(originUrl) > -1) return true;
        });
        const hook = api_hook[matchUrl] || (() => {
        });
        if (!hook.isExec) {
          hook(data, event.data);
          action != "repeat" && (hook.isExec = true);
        }
      }
    });
    window.addEventListener("click", async (e) => {
      if (e.target.closest(".ecom-g-btn") && e.target.innerText == "下一步") {
        await CR.commit("DOUYIN_GOODS2/SET_STEP", "ADD_GOODS_DRAFT_INFO");
        app = await CR.get("DOUYIN_GOODS2");
      }
    });
  };
  /**
  * @vue/shared v3.5.21
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  const EMPTY_OBJ = Object.freeze({});
  const EMPTY_ARR = Object.freeze([]);
  const isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // uppercase letter
  (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
  const extend = Object.assign;
  const isArray = Array.isArray;
  const isMap = (val) => toTypeString(val) === "[object Map]";
  const isSet = (val) => toTypeString(val) === "[object Set]";
  const isFunction = (val) => typeof val === "function";
  const isString = (val) => typeof val === "string";
  const isSymbol = (val) => typeof val === "symbol";
  const isObject = (val) => val !== null && typeof val === "object";
  const objectToString = Object.prototype.toString;
  const toTypeString = (value) => objectToString.call(value);
  const isPlainObject = (val) => toTypeString(val) === "[object Object]";
  let _globalThis;
  const getGlobalThis = () => {
    return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
  };
  function normalizeStyle(value) {
    if (isArray(value)) {
      const res = {};
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);
        if (normalized) {
          for (const key in normalized) {
            res[key] = normalized[key];
          }
        }
      }
      return res;
    } else if (isString(value) || isObject(value)) {
      return value;
    }
  }
  const listDelimiterRE = /;(?![^(]*\))/g;
  const propertyDelimiterRE = /:([^]+)/;
  const styleCommentRE = /\/\*[^]*?\*\//g;
  function parseStringStyle(cssText) {
    const ret = {};
    cssText.replace(styleCommentRE, "").split(listDelimiterRE).forEach((item) => {
      if (item) {
        const tmp = item.split(propertyDelimiterRE);
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
      }
    });
    return ret;
  }
  function normalizeClass(value) {
    let res = "";
    if (isString(value)) {
      res = value;
    } else if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const normalized = normalizeClass(value[i]);
        if (normalized) {
          res += normalized + " ";
        }
      }
    } else if (isObject(value)) {
      for (const name in value) {
        if (value[name]) {
          res += name + " ";
        }
      }
    }
    return res.trim();
  }
  const isRef$1 = (val) => {
    return !!(val && val["__v_isRef"] === true);
  };
  const toDisplayString = (val) => {
    return isString(val) ? val : val == null ? "" : isArray(val) || isObject(val) && (val.toString === objectToString || !isFunction(val.toString)) ? isRef$1(val) ? toDisplayString(val.value) : JSON.stringify(val, replacer, 2) : String(val);
  };
  const replacer = (_key, val) => {
    if (isRef$1(val)) {
      return replacer(_key, val.value);
    } else if (isMap(val)) {
      return {
        [`Map(${val.size})`]: [...val.entries()].reduce(
          (entries, [key, val2], i) => {
            entries[stringifySymbol(key, i) + " =>"] = val2;
            return entries;
          },
          {}
        )
      };
    } else if (isSet(val)) {
      return {
        [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v))
      };
    } else if (isSymbol(val)) {
      return stringifySymbol(val);
    } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
      return String(val);
    }
    return val;
  };
  const stringifySymbol = (v, i = "") => {
    var _a;
    return (
      // Symbol.description in es2019+ so we need to cast here to pass
      // the lib: es2016 check
      isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v
    );
  };
  /**
  * @vue/reactivity v3.5.21
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  new Set(
    /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol)
  );
  function isReactive(value) {
    if (isReadonly(value)) {
      return isReactive(value["__v_raw"]);
    }
    return !!(value && value["__v_isReactive"]);
  }
  function isReadonly(value) {
    return !!(value && value["__v_isReadonly"]);
  }
  function isShallow(value) {
    return !!(value && value["__v_isShallow"]);
  }
  function isProxy(value) {
    return value ? !!value["__v_raw"] : false;
  }
  function toRaw(observed) {
    const raw = observed && observed["__v_raw"];
    return raw ? toRaw(raw) : observed;
  }
  function isRef(r) {
    return r ? r["__v_isRef"] === true : false;
  }
  /**
  * @vue/runtime-core v3.5.21
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  const stack = [];
  function pushWarningContext(vnode) {
    stack.push(vnode);
  }
  function popWarningContext() {
    stack.pop();
  }
  let isWarning = false;
  function warn$1(msg, ...args) {
    if (isWarning) return;
    isWarning = true;
    const instance = stack.length ? stack[stack.length - 1].component : null;
    const appWarnHandler = instance && instance.appContext.config.warnHandler;
    const trace = getComponentTrace();
    if (appWarnHandler) {
      callWithErrorHandling(
        appWarnHandler,
        instance,
        11,
        [
          // eslint-disable-next-line no-restricted-syntax
          msg + args.map((a) => {
            var _a, _b;
            return (_b = (_a = a.toString) == null ? void 0 : _a.call(a)) != null ? _b : JSON.stringify(a);
          }).join(""),
          instance && instance.proxy,
          trace.map(
            ({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`
          ).join("\n"),
          trace
        ]
      );
    } else {
      const warnArgs = [`[Vue warn]: ${msg}`, ...args];
      if (trace.length && // avoid spamming console during tests
      true) {
        warnArgs.push(`
`, ...formatTrace(trace));
      }
      console.warn(...warnArgs);
    }
    isWarning = false;
  }
  function getComponentTrace() {
    let currentVNode = stack[stack.length - 1];
    if (!currentVNode) {
      return [];
    }
    const normalizedStack = [];
    while (currentVNode) {
      const last = normalizedStack[0];
      if (last && last.vnode === currentVNode) {
        last.recurseCount++;
      } else {
        normalizedStack.push({
          vnode: currentVNode,
          recurseCount: 0
        });
      }
      const parentInstance = currentVNode.component && currentVNode.component.parent;
      currentVNode = parentInstance && parentInstance.vnode;
    }
    return normalizedStack;
  }
  function formatTrace(trace) {
    const logs = [];
    trace.forEach((entry, i) => {
      logs.push(...i === 0 ? [] : [`
`], ...formatTraceEntry(entry));
    });
    return logs;
  }
  function formatTraceEntry({ vnode, recurseCount }) {
    const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
    const isRoot = vnode.component ? vnode.component.parent == null : false;
    const open = ` at <${formatComponentName(
      vnode.component,
      vnode.type,
      isRoot
    )}`;
    const close = `>` + postfix;
    return vnode.props ? [open, ...formatProps(vnode.props), close] : [open + close];
  }
  function formatProps(props) {
    const res = [];
    const keys = Object.keys(props);
    keys.slice(0, 3).forEach((key) => {
      res.push(...formatProp(key, props[key]));
    });
    if (keys.length > 3) {
      res.push(` ...`);
    }
    return res;
  }
  function formatProp(key, value, raw) {
    if (isString(value)) {
      value = JSON.stringify(value);
      return raw ? value : [`${key}=${value}`];
    } else if (typeof value === "number" || typeof value === "boolean" || value == null) {
      return raw ? value : [`${key}=${value}`];
    } else if (isRef(value)) {
      value = formatProp(key, toRaw(value.value), true);
      return raw ? value : [`${key}=Ref<`, value, `>`];
    } else if (isFunction(value)) {
      return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
    } else {
      value = toRaw(value);
      return raw ? value : [`${key}=`, value];
    }
  }
  const ErrorTypeStrings$1 = {
    ["sp"]: "serverPrefetch hook",
    ["bc"]: "beforeCreate hook",
    ["c"]: "created hook",
    ["bm"]: "beforeMount hook",
    ["m"]: "mounted hook",
    ["bu"]: "beforeUpdate hook",
    ["u"]: "updated",
    ["bum"]: "beforeUnmount hook",
    ["um"]: "unmounted hook",
    ["a"]: "activated hook",
    ["da"]: "deactivated hook",
    ["ec"]: "errorCaptured hook",
    ["rtc"]: "renderTracked hook",
    ["rtg"]: "renderTriggered hook",
    [0]: "setup function",
    [1]: "render function",
    [2]: "watcher getter",
    [3]: "watcher callback",
    [4]: "watcher cleanup function",
    [5]: "native event handler",
    [6]: "component event handler",
    [7]: "vnode hook",
    [8]: "directive hook",
    [9]: "transition hook",
    [10]: "app errorHandler",
    [11]: "app warnHandler",
    [12]: "ref function",
    [13]: "async component loader",
    [14]: "scheduler flush",
    [15]: "component update",
    [16]: "app unmount cleanup function"
  };
  function callWithErrorHandling(fn, instance, type, args) {
    try {
      return args ? fn(...args) : fn();
    } catch (err) {
      handleError(err, instance, type);
    }
  }
  function handleError(err, instance, type, throwInDev = true) {
    const contextVNode = instance ? instance.vnode : null;
    const { errorHandler, throwUnhandledErrorInProduction } = instance && instance.appContext.config || EMPTY_OBJ;
    if (instance) {
      let cur = instance.parent;
      const exposedInstance = instance.proxy;
      const errorInfo = ErrorTypeStrings$1[type];
      while (cur) {
        const errorCapturedHooks = cur.ec;
        if (errorCapturedHooks) {
          for (let i = 0; i < errorCapturedHooks.length; i++) {
            if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) {
              return;
            }
          }
        }
        cur = cur.parent;
      }
      if (errorHandler) {
        callWithErrorHandling(errorHandler, null, 10, [
          err,
          exposedInstance,
          errorInfo
        ]);
        return;
      }
    }
    logError(err, type, contextVNode, throwInDev, throwUnhandledErrorInProduction);
  }
  function logError(err, type, contextVNode, throwInDev = true, throwInProd = false) {
    {
      const info = ErrorTypeStrings$1[type];
      if (contextVNode) {
        pushWarningContext(contextVNode);
      }
      warn$1(`Unhandled error${info ? ` during execution of ${info}` : ``}`);
      if (contextVNode) {
        popWarningContext();
      }
      if (throwInDev) {
        throw err;
      } else {
        console.error(err);
      }
    }
  }
  const queue = [];
  let flushIndex = -1;
  const pendingPostFlushCbs = [];
  let activePostFlushCbs = null;
  let postFlushIndex = 0;
  const resolvedPromise = /* @__PURE__ */ Promise.resolve();
  let currentFlushPromise = null;
  const RECURSION_LIMIT = 100;
  function findInsertionIndex(id) {
    let start = flushIndex + 1;
    let end = queue.length;
    while (start < end) {
      const middle = start + end >>> 1;
      const middleJob = queue[middle];
      const middleJobId = getId(middleJob);
      if (middleJobId < id || middleJobId === id && middleJob.flags & 2) {
        start = middle + 1;
      } else {
        end = middle;
      }
    }
    return start;
  }
  function queueJob(job) {
    if (!(job.flags & 1)) {
      const jobId = getId(job);
      const lastJob = queue[queue.length - 1];
      if (!lastJob || // fast path when the job id is larger than the tail
      !(job.flags & 2) && jobId >= getId(lastJob)) {
        queue.push(job);
      } else {
        queue.splice(findInsertionIndex(jobId), 0, job);
      }
      job.flags |= 1;
      queueFlush();
    }
  }
  function queueFlush() {
    if (!currentFlushPromise) {
      currentFlushPromise = resolvedPromise.then(flushJobs);
    }
  }
  function queuePostFlushCb(cb) {
    if (!isArray(cb)) {
      if (activePostFlushCbs && cb.id === -1) {
        activePostFlushCbs.splice(postFlushIndex + 1, 0, cb);
      } else if (!(cb.flags & 1)) {
        pendingPostFlushCbs.push(cb);
        cb.flags |= 1;
      }
    } else {
      pendingPostFlushCbs.push(...cb);
    }
    queueFlush();
  }
  function flushPostFlushCbs(seen) {
    if (pendingPostFlushCbs.length) {
      const deduped = [...new Set(pendingPostFlushCbs)].sort(
        (a, b) => getId(a) - getId(b)
      );
      pendingPostFlushCbs.length = 0;
      if (activePostFlushCbs) {
        activePostFlushCbs.push(...deduped);
        return;
      }
      activePostFlushCbs = deduped;
      {
        seen = seen || /* @__PURE__ */ new Map();
      }
      for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
        const cb = activePostFlushCbs[postFlushIndex];
        if (checkRecursiveUpdates(seen, cb)) {
          continue;
        }
        if (cb.flags & 4) {
          cb.flags &= -2;
        }
        if (!(cb.flags & 8)) cb();
        cb.flags &= -2;
      }
      activePostFlushCbs = null;
      postFlushIndex = 0;
    }
  }
  const getId = (job) => job.id == null ? job.flags & 2 ? -1 : Infinity : job.id;
  function flushJobs(seen) {
    {
      seen = seen || /* @__PURE__ */ new Map();
    }
    const check = (job) => checkRecursiveUpdates(seen, job);
    try {
      for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
        const job = queue[flushIndex];
        if (job && !(job.flags & 8)) {
          if (check(job)) {
            continue;
          }
          if (job.flags & 4) {
            job.flags &= ~1;
          }
          callWithErrorHandling(
            job,
            job.i,
            job.i ? 15 : 14
          );
          if (!(job.flags & 4)) {
            job.flags &= ~1;
          }
        }
      }
    } finally {
      for (; flushIndex < queue.length; flushIndex++) {
        const job = queue[flushIndex];
        if (job) {
          job.flags &= -2;
        }
      }
      flushIndex = -1;
      queue.length = 0;
      flushPostFlushCbs(seen);
      currentFlushPromise = null;
      if (queue.length || pendingPostFlushCbs.length) {
        flushJobs(seen);
      }
    }
  }
  function checkRecursiveUpdates(seen, fn) {
    const count = seen.get(fn) || 0;
    if (count > RECURSION_LIMIT) {
      const instance = fn.i;
      const componentName = instance && getComponentName(instance.type);
      handleError(
        `Maximum recursive updates exceeded${componentName ? ` in component <${componentName}>` : ``}. This means you have a reactive effect that is mutating its own dependencies and thus recursively triggering itself. Possible sources include component template, render function, updated hook or watcher source function.`,
        null,
        10
      );
      return true;
    }
    seen.set(fn, count + 1);
    return false;
  }
  const hmrDirtyComponents = /* @__PURE__ */ new Map();
  {
    const g = getGlobalThis();
    if (!g.__VUE_HMR_RUNTIME__) {
      g.__VUE_HMR_RUNTIME__ = {
        createRecord: tryWrap(createRecord),
        rerender: tryWrap(rerender),
        reload: tryWrap(reload)
      };
    }
  }
  const map = /* @__PURE__ */ new Map();
  function createRecord(id, initialDef) {
    if (map.has(id)) {
      return false;
    }
    map.set(id, {
      initialDef: normalizeClassComponent(initialDef),
      instances: /* @__PURE__ */ new Set()
    });
    return true;
  }
  function normalizeClassComponent(component) {
    return isClassComponent(component) ? component.__vccOpts : component;
  }
  function rerender(id, newRender) {
    const record = map.get(id);
    if (!record) {
      return;
    }
    record.initialDef.render = newRender;
    [...record.instances].forEach((instance) => {
      if (newRender) {
        instance.render = newRender;
        normalizeClassComponent(instance.type).render = newRender;
      }
      instance.renderCache = [];
      if (!(instance.job.flags & 8)) {
        instance.update();
      }
    });
  }
  function reload(id, newComp) {
    const record = map.get(id);
    if (!record) return;
    newComp = normalizeClassComponent(newComp);
    updateComponentDef(record.initialDef, newComp);
    const instances = [...record.instances];
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i];
      const oldComp = normalizeClassComponent(instance.type);
      let dirtyInstances = hmrDirtyComponents.get(oldComp);
      if (!dirtyInstances) {
        if (oldComp !== record.initialDef) {
          updateComponentDef(oldComp, newComp);
        }
        hmrDirtyComponents.set(oldComp, dirtyInstances = /* @__PURE__ */ new Set());
      }
      dirtyInstances.add(instance);
      instance.appContext.propsCache.delete(instance.type);
      instance.appContext.emitsCache.delete(instance.type);
      instance.appContext.optionsCache.delete(instance.type);
      if (instance.ceReload) {
        dirtyInstances.add(instance);
        instance.ceReload(newComp.styles);
        dirtyInstances.delete(instance);
      } else if (instance.parent) {
        queueJob(() => {
          if (!(instance.job.flags & 8)) {
            instance.parent.update();
            dirtyInstances.delete(instance);
          }
        });
      } else if (instance.appContext.reload) {
        instance.appContext.reload();
      } else if (typeof window !== "undefined") {
        window.location.reload();
      } else {
        console.warn(
          "[HMR] Root or manually mounted instance modified. Full reload required."
        );
      }
      if (instance.root.ce && instance !== instance.root) {
        instance.root.ce._removeChildStyle(oldComp);
      }
    }
    queuePostFlushCb(() => {
      hmrDirtyComponents.clear();
    });
  }
  function updateComponentDef(oldComp, newComp) {
    extend(oldComp, newComp);
    for (const key in oldComp) {
      if (key !== "__file" && !(key in newComp)) {
        delete oldComp[key];
      }
    }
  }
  function tryWrap(fn) {
    return (id, arg) => {
      try {
        return fn(id, arg);
      } catch (e) {
        console.error(e);
        console.warn(
          `[HMR] Something went wrong during Vue component hot-reload. Full reload required.`
        );
      }
    };
  }
  function emit$1(event, ...args) {
  }
  const devtoolsComponentUpdated = /* @__PURE__ */ createDevtoolsComponentHook(
    "component:updated"
    /* COMPONENT_UPDATED */
  );
  // @__NO_SIDE_EFFECTS__
  function createDevtoolsComponentHook(hook) {
    return (component) => {
      emit$1(
        hook,
        component.appContext.app,
        component.uid,
        component.parent ? component.parent.uid : void 0,
        component
      );
    };
  }
  let currentRenderingInstance = null;
  let currentScopeId = null;
  function setCurrentRenderingInstance(instance) {
    const prev = currentRenderingInstance;
    currentRenderingInstance = instance;
    currentScopeId = instance && instance.type.__scopeId || null;
    return prev;
  }
  function withCtx(fn, ctx = currentRenderingInstance, isNonScopedSlot) {
    if (!ctx) return fn;
    if (fn._n) {
      return fn;
    }
    const renderFnWithContext = (...args) => {
      if (renderFnWithContext._d) {
        setBlockTracking(-1);
      }
      const prevInstance = setCurrentRenderingInstance(ctx);
      let res;
      try {
        res = fn(...args);
      } finally {
        setCurrentRenderingInstance(prevInstance);
        if (renderFnWithContext._d) {
          setBlockTracking(1);
        }
      }
      {
        devtoolsComponentUpdated(ctx);
      }
      return res;
    };
    renderFnWithContext._n = true;
    renderFnWithContext._c = true;
    renderFnWithContext._d = true;
    return renderFnWithContext;
  }
  const isTeleport = (type) => type.__isTeleport;
  function setTransitionHooks(vnode, hooks) {
    if (vnode.shapeFlag & 6 && vnode.component) {
      vnode.transition = hooks;
      setTransitionHooks(vnode.component.subTree, hooks);
    } else if (vnode.shapeFlag & 128) {
      vnode.ssContent.transition = hooks.clone(vnode.ssContent);
      vnode.ssFallback.transition = hooks.clone(vnode.ssFallback);
    } else {
      vnode.transition = hooks;
    }
  }
  getGlobalThis().requestIdleCallback || ((cb) => setTimeout(cb, 1));
  getGlobalThis().cancelIdleCallback || ((id) => clearTimeout(id));
  const NULL_DYNAMIC_COMPONENT = Symbol.for("v-ndc");
  const PublicInstanceProxyHandlers = {};
  {
    PublicInstanceProxyHandlers.ownKeys = (target) => {
      warn$1(
        `Avoid app logic that relies on enumerating keys on a component instance. The keys will be empty in production mode to avoid performance overhead.`
      );
      return Reflect.ownKeys(target);
    };
  }
  const internalObjectProto = {};
  const isInternalObject = (obj) => Object.getPrototypeOf(obj) === internalObjectProto;
  const isSuspense = (type) => type.__isSuspense;
  const Fragment = Symbol.for("v-fgt");
  const Text = Symbol.for("v-txt");
  const Comment = Symbol.for("v-cmt");
  const Static = Symbol.for("v-stc");
  const blockStack = [];
  let currentBlock = null;
  function openBlock(disableTracking = false) {
    blockStack.push(currentBlock = disableTracking ? null : []);
  }
  function closeBlock() {
    blockStack.pop();
    currentBlock = blockStack[blockStack.length - 1] || null;
  }
  let isBlockTreeEnabled = 1;
  function setBlockTracking(value, inVOnce = false) {
    isBlockTreeEnabled += value;
    if (value < 0 && currentBlock && inVOnce) {
      currentBlock.hasOnce = true;
    }
  }
  function setupBlock(vnode) {
    vnode.dynamicChildren = isBlockTreeEnabled > 0 ? currentBlock || EMPTY_ARR : null;
    closeBlock();
    if (isBlockTreeEnabled > 0 && currentBlock) {
      currentBlock.push(vnode);
    }
    return vnode;
  }
  function createElementBlock(type, props, children, patchFlag, dynamicProps, shapeFlag) {
    return setupBlock(
      createBaseVNode(
        type,
        props,
        children,
        patchFlag,
        dynamicProps,
        shapeFlag,
        true
      )
    );
  }
  function createBlock(type, props, children, patchFlag, dynamicProps) {
    return setupBlock(
      createVNode(
        type,
        props,
        children,
        patchFlag,
        dynamicProps,
        true
      )
    );
  }
  function isVNode(value) {
    return value ? value.__v_isVNode === true : false;
  }
  const createVNodeWithArgsTransform = (...args) => {
    return _createVNode(
      ...args
    );
  };
  const normalizeKey = ({ key }) => key != null ? key : null;
  const normalizeRef = ({
    ref: ref3,
    ref_key,
    ref_for
  }) => {
    if (typeof ref3 === "number") {
      ref3 = "" + ref3;
    }
    return ref3 != null ? isString(ref3) || isRef(ref3) || isFunction(ref3) ? { i: currentRenderingInstance, r: ref3, k: ref_key, f: !!ref_for } : ref3 : null;
  };
  function createBaseVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, shapeFlag = type === Fragment ? 0 : 1, isBlockNode = false, needFullChildrenNormalization = false) {
    const vnode = {
      __v_isVNode: true,
      __v_skip: true,
      type,
      props,
      key: props && normalizeKey(props),
      ref: props && normalizeRef(props),
      scopeId: currentScopeId,
      slotScopeIds: null,
      children,
      component: null,
      suspense: null,
      ssContent: null,
      ssFallback: null,
      dirs: null,
      transition: null,
      el: null,
      anchor: null,
      target: null,
      targetStart: null,
      targetAnchor: null,
      staticCount: 0,
      shapeFlag,
      patchFlag,
      dynamicProps,
      dynamicChildren: null,
      appContext: null,
      ctx: currentRenderingInstance
    };
    if (needFullChildrenNormalization) {
      normalizeChildren(vnode, children);
      if (shapeFlag & 128) {
        type.normalize(vnode);
      }
    } else if (children) {
      vnode.shapeFlag |= isString(children) ? 8 : 16;
    }
    if (vnode.key !== vnode.key) {
      warn$1(`VNode created with invalid key (NaN). VNode type:`, vnode.type);
    }
    if (isBlockTreeEnabled > 0 && // avoid a block node from tracking itself
    !isBlockNode && // has current parent block
    currentBlock && // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    (vnode.patchFlag > 0 || shapeFlag & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
    // vnode should not be considered dynamic due to handler caching.
    vnode.patchFlag !== 32) {
      currentBlock.push(vnode);
    }
    return vnode;
  }
  const createVNode = createVNodeWithArgsTransform;
  function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
    if (!type || type === NULL_DYNAMIC_COMPONENT) {
      if (!type) {
        warn$1(`Invalid vnode type when creating vnode: ${type}.`);
      }
      type = Comment;
    }
    if (isVNode(type)) {
      const cloned = cloneVNode(
        type,
        props,
        true
        /* mergeRef: true */
      );
      if (children) {
        normalizeChildren(cloned, children);
      }
      if (isBlockTreeEnabled > 0 && !isBlockNode && currentBlock) {
        if (cloned.shapeFlag & 6) {
          currentBlock[currentBlock.indexOf(type)] = cloned;
        } else {
          currentBlock.push(cloned);
        }
      }
      cloned.patchFlag = -2;
      return cloned;
    }
    if (isClassComponent(type)) {
      type = type.__vccOpts;
    }
    if (props) {
      props = guardReactiveProps(props);
      let { class: klass, style } = props;
      if (klass && !isString(klass)) {
        props.class = normalizeClass(klass);
      }
      if (isObject(style)) {
        if (isProxy(style) && !isArray(style)) {
          style = extend({}, style);
        }
        props.style = normalizeStyle(style);
      }
    }
    const shapeFlag = isString(type) ? 1 : isSuspense(type) ? 128 : isTeleport(type) ? 64 : isObject(type) ? 4 : isFunction(type) ? 2 : 0;
    if (shapeFlag & 4 && isProxy(type)) {
      type = toRaw(type);
      warn$1(
        `Vue received a Component that was made a reactive object. This can lead to unnecessary performance overhead and should be avoided by marking the component with \`markRaw\` or using \`shallowRef\` instead of \`ref\`.`,
        `
Component that was made reactive: `,
        type
      );
    }
    return createBaseVNode(
      type,
      props,
      children,
      patchFlag,
      dynamicProps,
      shapeFlag,
      isBlockNode,
      true
    );
  }
  function guardReactiveProps(props) {
    if (!props) return null;
    return isProxy(props) || isInternalObject(props) ? extend({}, props) : props;
  }
  function cloneVNode(vnode, extraProps, mergeRef = false, cloneTransition = false) {
    const { props, ref: ref3, patchFlag, children, transition } = vnode;
    const mergedProps = extraProps ? mergeProps(props || {}, extraProps) : props;
    const cloned = {
      __v_isVNode: true,
      __v_skip: true,
      type: vnode.type,
      props: mergedProps,
      key: mergedProps && normalizeKey(mergedProps),
      ref: extraProps && extraProps.ref ? (
        // #2078 in the case of <component :is="vnode" ref="extra"/>
        // if the vnode itself already has a ref, cloneVNode will need to merge
        // the refs so the single vnode can be set on multiple refs
        mergeRef && ref3 ? isArray(ref3) ? ref3.concat(normalizeRef(extraProps)) : [ref3, normalizeRef(extraProps)] : normalizeRef(extraProps)
      ) : ref3,
      scopeId: vnode.scopeId,
      slotScopeIds: vnode.slotScopeIds,
      children: patchFlag === -1 && isArray(children) ? children.map(deepCloneVNode) : children,
      target: vnode.target,
      targetStart: vnode.targetStart,
      targetAnchor: vnode.targetAnchor,
      staticCount: vnode.staticCount,
      shapeFlag: vnode.shapeFlag,
      // if the vnode is cloned with extra props, we can no longer assume its
      // existing patch flag to be reliable and need to add the FULL_PROPS flag.
      // note: preserve flag for fragments since they use the flag for children
      // fast paths only.
      patchFlag: extraProps && vnode.type !== Fragment ? patchFlag === -1 ? 16 : patchFlag | 16 : patchFlag,
      dynamicProps: vnode.dynamicProps,
      dynamicChildren: vnode.dynamicChildren,
      appContext: vnode.appContext,
      dirs: vnode.dirs,
      transition,
      // These should technically only be non-null on mounted VNodes. However,
      // they *should* be copied for kept-alive vnodes. So we just always copy
      // them since them being non-null during a mount doesn't affect the logic as
      // they will simply be overwritten.
      component: vnode.component,
      suspense: vnode.suspense,
      ssContent: vnode.ssContent && cloneVNode(vnode.ssContent),
      ssFallback: vnode.ssFallback && cloneVNode(vnode.ssFallback),
      placeholder: vnode.placeholder,
      el: vnode.el,
      anchor: vnode.anchor,
      ctx: vnode.ctx,
      ce: vnode.ce
    };
    if (transition && cloneTransition) {
      setTransitionHooks(
        cloned,
        transition.clone(cloned)
      );
    }
    return cloned;
  }
  function deepCloneVNode(vnode) {
    const cloned = cloneVNode(vnode);
    if (isArray(vnode.children)) {
      cloned.children = vnode.children.map(deepCloneVNode);
    }
    return cloned;
  }
  function createTextVNode(text = " ", flag = 0) {
    return createVNode(Text, null, text, flag);
  }
  function createStaticVNode(content, numberOfNodes) {
    const vnode = createVNode(Static, null, content);
    vnode.staticCount = numberOfNodes;
    return vnode;
  }
  function createCommentVNode(text = "", asBlock = false) {
    return asBlock ? (openBlock(), createBlock(Comment, null, text)) : createVNode(Comment, null, text);
  }
  function normalizeChildren(vnode, children) {
    let type = 0;
    const { shapeFlag } = vnode;
    if (children == null) {
      children = null;
    } else if (isArray(children)) {
      type = 16;
    } else if (typeof children === "object") {
      if (shapeFlag & (1 | 64)) {
        const slot = children.default;
        if (slot) {
          slot._c && (slot._d = false);
          normalizeChildren(vnode, slot());
          slot._c && (slot._d = true);
        }
        return;
      } else {
        type = 32;
        const slotFlag = children._;
        if (!slotFlag && !isInternalObject(children)) {
          children._ctx = currentRenderingInstance;
        } else if (slotFlag === 3 && currentRenderingInstance) {
          if (currentRenderingInstance.slots._ === 1) {
            children._ = 1;
          } else {
            children._ = 2;
            vnode.patchFlag |= 1024;
          }
        }
      }
    } else if (isFunction(children)) {
      children = { default: children, _ctx: currentRenderingInstance };
      type = 32;
    } else {
      children = String(children);
      if (shapeFlag & 64) {
        type = 16;
        children = [createTextVNode(children)];
      } else {
        type = 8;
      }
    }
    vnode.children = children;
    vnode.shapeFlag |= type;
  }
  function mergeProps(...args) {
    const ret = {};
    for (let i = 0; i < args.length; i++) {
      const toMerge = args[i];
      for (const key in toMerge) {
        if (key === "class") {
          if (ret.class !== toMerge.class) {
            ret.class = normalizeClass([ret.class, toMerge.class]);
          }
        } else if (key === "style") {
          ret.style = normalizeStyle([ret.style, toMerge.style]);
        } else if (isOn(key)) {
          const existing = ret[key];
          const incoming = toMerge[key];
          if (incoming && existing !== incoming && !(isArray(existing) && existing.includes(incoming))) {
            ret[key] = existing ? [].concat(existing, incoming) : incoming;
          }
        } else if (key !== "") {
          ret[key] = toMerge[key];
        }
      }
    }
    return ret;
  }
  {
    const g = getGlobalThis();
    const registerGlobalSetter = (key, setter) => {
      let setters;
      if (!(setters = g[key])) setters = g[key] = [];
      setters.push(setter);
      return (v) => {
        if (setters.length > 1) setters.forEach((set) => set(v));
        else setters[0](v);
      };
    };
    registerGlobalSetter(
      `__VUE_INSTANCE_SETTERS__`,
      (v) => v
    );
    registerGlobalSetter(
      `__VUE_SSR_SETTERS__`,
      (v) => v
    );
  }
  const classifyRE = /(?:^|[-_])\w/g;
  const classify = (str) => str.replace(classifyRE, (c) => c.toUpperCase()).replace(/[-_]/g, "");
  function getComponentName(Component, includeInferred = true) {
    return isFunction(Component) ? Component.displayName || Component.name : Component.name || includeInferred && Component.__name;
  }
  function formatComponentName(instance, Component, isRoot = false) {
    let name = getComponentName(Component);
    if (!name && Component.__file) {
      const match = Component.__file.match(/([^/\\]+)\.\w+$/);
      if (match) {
        name = match[1];
      }
    }
    if (!name && instance && instance.parent) {
      const inferFromRegistry = (registry) => {
        for (const key in registry) {
          if (registry[key] === Component) {
            return key;
          }
        }
      };
      name = inferFromRegistry(
        instance.components || instance.parent.type.components
      ) || inferFromRegistry(instance.appContext.components);
    }
    return name ? classify(name) : isRoot ? `App` : `Anonymous`;
  }
  function isClassComponent(value) {
    return isFunction(value) && "__vccOpts" in value;
  }
  function initCustomFormatter() {
    if (typeof window === "undefined") {
      return;
    }
    const vueStyle = { style: "color:#3ba776" };
    const numberStyle = { style: "color:#1677ff" };
    const stringStyle = { style: "color:#f5222d" };
    const keywordStyle = { style: "color:#eb2f96" };
    const formatter = {
      __vue_custom_formatter: true,
      header(obj) {
        if (!isObject(obj)) {
          return null;
        }
        if (obj.__isVue) {
          return ["div", vueStyle, `VueInstance`];
        } else if (isRef(obj)) {
          const value = obj.value;
          return [
            "div",
            {},
            ["span", vueStyle, genRefFlag(obj)],
            "<",
            formatValue(value),
            `>`
          ];
        } else if (isReactive(obj)) {
          return [
            "div",
            {},
            ["span", vueStyle, isShallow(obj) ? "ShallowReactive" : "Reactive"],
            "<",
            formatValue(obj),
            `>${isReadonly(obj) ? ` (readonly)` : ``}`
          ];
        } else if (isReadonly(obj)) {
          return [
            "div",
            {},
            ["span", vueStyle, isShallow(obj) ? "ShallowReadonly" : "Readonly"],
            "<",
            formatValue(obj),
            ">"
          ];
        }
        return null;
      },
      hasBody(obj) {
        return obj && obj.__isVue;
      },
      body(obj) {
        if (obj && obj.__isVue) {
          return [
            "div",
            {},
            ...formatInstance(obj.$)
          ];
        }
      }
    };
    function formatInstance(instance) {
      const blocks = [];
      if (instance.type.props && instance.props) {
        blocks.push(createInstanceBlock("props", toRaw(instance.props)));
      }
      if (instance.setupState !== EMPTY_OBJ) {
        blocks.push(createInstanceBlock("setup", instance.setupState));
      }
      if (instance.data !== EMPTY_OBJ) {
        blocks.push(createInstanceBlock("data", toRaw(instance.data)));
      }
      const computed2 = extractKeys(instance, "computed");
      if (computed2) {
        blocks.push(createInstanceBlock("computed", computed2));
      }
      const injected = extractKeys(instance, "inject");
      if (injected) {
        blocks.push(createInstanceBlock("injected", injected));
      }
      blocks.push([
        "div",
        {},
        [
          "span",
          {
            style: keywordStyle.style + ";opacity:0.66"
          },
          "$ (internal): "
        ],
        ["object", { object: instance }]
      ]);
      return blocks;
    }
    function createInstanceBlock(type, target) {
      target = extend({}, target);
      if (!Object.keys(target).length) {
        return ["span", {}];
      }
      return [
        "div",
        { style: "line-height:1.25em;margin-bottom:0.6em" },
        [
          "div",
          {
            style: "color:#476582"
          },
          type
        ],
        [
          "div",
          {
            style: "padding-left:1.25em"
          },
          ...Object.keys(target).map((key) => {
            return [
              "div",
              {},
              ["span", keywordStyle, key + ": "],
              formatValue(target[key], false)
            ];
          })
        ]
      ];
    }
    function formatValue(v, asRaw = true) {
      if (typeof v === "number") {
        return ["span", numberStyle, v];
      } else if (typeof v === "string") {
        return ["span", stringStyle, JSON.stringify(v)];
      } else if (typeof v === "boolean") {
        return ["span", keywordStyle, v];
      } else if (isObject(v)) {
        return ["object", { object: asRaw ? toRaw(v) : v }];
      } else {
        return ["span", stringStyle, String(v)];
      }
    }
    function extractKeys(instance, type) {
      const Comp = instance.type;
      if (isFunction(Comp)) {
        return;
      }
      const extracted = {};
      for (const key in instance.ctx) {
        if (isKeyOfType(Comp, key, type)) {
          extracted[key] = instance.ctx[key];
        }
      }
      return extracted;
    }
    function isKeyOfType(Comp, key, type) {
      const opts = Comp[type];
      if (isArray(opts) && opts.includes(key) || isObject(opts) && key in opts) {
        return true;
      }
      if (Comp.extends && isKeyOfType(Comp.extends, key, type)) {
        return true;
      }
      if (Comp.mixins && Comp.mixins.some((m) => isKeyOfType(m, key, type))) {
        return true;
      }
    }
    function genRefFlag(v) {
      if (isShallow(v)) {
        return `ShallowRef`;
      }
      if (v.effect) {
        return `ComputedRef`;
      }
      return `Ref`;
    }
    if (window.devtoolsFormatters) {
      window.devtoolsFormatters.push(formatter);
    } else {
      window.devtoolsFormatters = [formatter];
    }
  }
  /**
  * vue v3.5.21
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  function initDev() {
    {
      initCustomFormatter();
    }
  }
  {
    initDev();
  }
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main = {
    __name: "app",
    setup(__props, { expose: __expose }) {
      __expose();
      const { ref, reactive, computed, onMounted, onUnmounted } = window.MdUiComponent;
      const { NButton, NModal } = window.MdUiComponent.NaiveUI;
      const isMinimized = ref(false);
      const isDragging = ref(false);
      const loginModal = reactive({ show: false });
      const position = reactive({ x: 20, y: 100 });
      const dragStart = reactive({ x: 0, y: 0 });
      const floatingStyle = computed(() => ({
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999
      }));
      const toggleMinimize = () => {
        isMinimized.value = !isMinimized.value;
        console.log("✅ 最小化状态已更新:", isMinimized.value);
      };
      const handleOneClickMove = () => {
        console.log("🎯 点击一键搬品，显示弹窗");
        loginModal.show = true;
      };
      const cancelLogin = () => {
        console.log("取消登录");
        loginModal.show = false;
      };
      const confirmLogin = async () => {
        console.log("🔄 确认登录");
        loginModal.show = false;
        const loadsh = _require("loadsh");
        const mdChrome = _require("mdChrome");
        const cookies = await mdChrome.web.cmd({
          cmd: "getCookie",
          myDomain: ".douyin.com"
        });
        const HAOHUO_HREF = location.href;
        const url = new URL(HAOHUO_HREF);
        const product_id = url.searchParams.get("id");
        const res = await mdChrome.web.cmd({
          cmd: "ajax",
          data: `product_id=${product_id}`,
          method: "POST",
          headers: {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "md-header-Origin": "https://live.douyin.com",
            "md-header-referer": "https://live.douyin.com/",
            cookie: cookies.cookiesStr
          },
          url: "https://live.douyin.com/aweme/v1/web/ecom/product/sku/list/"
        });
        const res2 = await mdChrome.web.cmd({
          cmd: "ajax",
          data: `promotion_ids=${product_id}&ec_promotion_id=${product_id}`,
          method: "POST",
          headers: {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "md-header-Origin": "https://live.douyin.com",
            "md-header-referer": "https://live.douyin.com/",
            cookie: cookies.cookiesStr
          },
          url: "https://live.douyin.com/ecom/product/detail/saas/pc/"
        });
        console.log(res, res2, "res");
        if (loadsh && loadsh.showToast) {
          loadsh.showToast({
            message: "登录成功，开始搬品操作！"
          });
        }
      };
      const startDrag = (e) => {
        isDragging.value = true;
        dragStart.x = e.clientX - position.x;
        dragStart.y = e.clientY - position.y;
        document.addEventListener("mousemove", drag);
        document.addEventListener("mouseup", stopDrag);
        e.preventDefault();
      };
      const drag = (e) => {
        if (!isDragging.value) return;
        position.x = Math.max(0, Math.min(window.innerWidth - 300, e.clientX - dragStart.x));
        position.y = Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragStart.y));
      };
      const stopDrag = () => {
        isDragging.value = false;
        document.removeEventListener("mousemove", drag);
        document.removeEventListener("mouseup", stopDrag);
      };
      onMounted(() => {
        console.log("🎉 一键搬品工具已加载");
      });
      onUnmounted(() => {
        document.removeEventListener("mousemove", drag);
        document.removeEventListener("mouseup", stopDrag);
      });
      const __returned__ = { ref, reactive, computed, onMounted, onUnmounted, NButton, NModal, isMinimized, isDragging, loginModal, position, dragStart, floatingStyle, toggleMinimize, handleOneClickMove, cancelLogin, confirmLogin, startDrag, drag, stopDrag };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  const _hoisted_1 = { class: "toolbox-actions" };
  const _hoisted_2 = {
    key: 0,
    class: "toolbox-content"
  };
  const _hoisted_3 = { class: "action-section" };
  const _hoisted_4 = { class: "modal-footer" };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return openBlock(), createElementBlock(
      "div",
      {
        class: "jinritemai-floating-toolbox",
        style: normalizeStyle($setup.floatingStyle)
      },
      [
        createBaseVNode(
          "div",
          {
            class: "toolbox-header",
            onMousedown: $setup.startDrag
          },
          [
            _cache[1] || (_cache[1] = createBaseVNode(
              "span",
              { class: "toolbox-title" },
              "一键搬品工具",
              -1
              /* CACHED */
            )),
            createBaseVNode("div", _hoisted_1, [
              createBaseVNode(
                "button",
                {
                  class: "minimize-btn",
                  onClick: $setup.toggleMinimize
                },
                toDisplayString($setup.isMinimized ? "□" : "_"),
                1
                /* TEXT */
              )
            ])
          ],
          32
          /* NEED_HYDRATION */
        ),
        !$setup.isMinimized ? (openBlock(), createElementBlock("div", _hoisted_2, [
          createCommentVNode(" 工具状态 "),
          _cache[3] || (_cache[3] = createStaticVNode('<div class="status-section"><div class="status-item"><span class="status-label">工具状态：</span><span class="status-value status-connected">就绪</span></div><div class="login-tips"> 点击搬品按钮开始操作 </div></div>', 1)),
          createCommentVNode(" 操作按钮 "),
          createBaseVNode("div", _hoisted_3, [
            createVNode($setup["NButton"], {
              class: "btn-large",
              type: "primary",
              onClick: $setup.handleOneClickMove
            }, {
              default: withCtx(() => [..._cache[2] || (_cache[2] = [
                createTextVNode(
                  " 一键搬品 ",
                  -1
                  /* CACHED */
                )
              ])]),
              _: 1
              /* STABLE */
            })
          ])
        ])) : createCommentVNode("v-if", true),
        createCommentVNode(" 等待登录模态框 - 使用NModal "),
        createVNode($setup["NModal"], {
          show: $setup.loginModal.show,
          "onUpdate:show": _cache[0] || (_cache[0] = ($event) => $setup.loginModal.show = $event),
          "mask-closable": false,
          preset: "card",
          title: "等待抖音登录",
          style: { "width": "400px" }
        }, {
          footer: withCtx(() => [
            createBaseVNode("div", _hoisted_4, [
              createVNode($setup["NButton"], {
                onClick: $setup.cancelLogin,
                secondary: ""
              }, {
                default: withCtx(() => [..._cache[4] || (_cache[4] = [
                  createTextVNode(
                    "取消",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              }),
              createVNode($setup["NButton"], {
                onClick: $setup.confirmLogin,
                type: "primary"
              }, {
                default: withCtx(() => [..._cache[5] || (_cache[5] = [
                  createTextVNode(
                    "确认登录",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              })
            ])
          ]),
          default: withCtx(() => [
            _cache[6] || (_cache[6] = createBaseVNode(
              "div",
              { class: "modal-content" },
              [
                createBaseVNode("div", { class: "loading-spinner" }, "⟳"),
                createBaseVNode("div", { class: "modal-text" }, [
                  createBaseVNode("p", null, "请在新打开的抖音页面完成登录"),
                  createBaseVNode("p", null, '登录成功后点击"确认登录"按钮')
                ])
              ],
              -1
              /* CACHED */
            ))
          ]),
          _: 1
          /* STABLE */
        }, 8, ["show"])
      ],
      4
      /* STYLE */
    );
  }
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__file", "/Users/jojo/Documents/work-place/madao/shop-chrome-plugins/vue/src/sites/jinritemai.com/components/app.vue"]]);
  const App2 = () => {
    const CR = _require("chromeRedux");
    const loadsh = _require("loadsh");
    const { createBaseApp } = MdUiComponent.Components;
    const app = createBaseApp(App, {
      options: {
        id: "jinritemai-floating-toolbox",
        style: "position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;"
      }
    });
    document.body.appendChild(app.__el__);
    console.log("move app", app);
    const style = document.createElement("style");
    style.textContent = `
        #jinritemai-floating-toolbox .jinritemai-floating-toolbox,
        #jinritemai-floating-toolbox .jinritemai-floating-toolbox * {
            pointer-events: auto !important;
        }
    `;
    document.head.appendChild(style);
    console.log("✅ 悬浮窗创建成功", CR);
    const doSetBaseInfo = () => async function setBaseInfo(res) {
      try {
        const mediaList = loadsh.getProperty(res.result, "promotion_h5.head_figure_data.media_list");
        const basicInfoData = loadsh.getProperty(res.result, "promotion_h5.basic_info_data") || {};
        const ecom_pitaya_json_str = loadsh.getProperty(res.result, "promotion_h5.page_meta.track_meta.ecom_pitaya_json_str");
        const { category_ids: categoryIds } = JSON.parse(ecom_pitaya_json_str || '{ "category_ids": null }');
        const imageList = (mediaList || []).find((_) => _.type == "image") || {};
        const mainImages = imageList.content_list || [];
        await CR.commit("DOUYIN_GOODS2/SET_GOODS_INFO", {
          categoryIds: categoryIds ? categoryIds.filter((_) => +_) : void 0,
          mainImages: mainImages.map((_, i) => {
            return {
              ..._,
              imgName: "主图_" + i
            };
          }),
          baseInfo: {
            product_id: basicInfoData.product_id,
            title_info: Object.assign(basicInfoData.title_info || {}, { safeTitle: (basicInfoData.title_info.title || "").replace(/\//g, "") })
          }
        });
        await CR.commit("DOUYIN_GOODS2/SET_STEP", "PRE_GET_GOODS_INFO");
      } catch (error) {
        console.log(error, "error");
      }
    };
    const api_hook = {
      "v2/shop/promotion/pack/h5": doSetBaseInfo(),
      "v2/shop/promotion/pack/detail": async (res) => {
        const detailImgs = loadsh.getProperty(res.result, "detail_info.detail_imgs") || [];
        try {
          await CR.commit("DOUYIN_GOODS2/SET_GOODS_INFO", {
            detailImages: detailImgs.map((_, i) => {
              return {
                ..._,
                imgName: "详图_" + i
              };
            })
          });
          await CR.commit("DOUYIN_GOODS2/SET_STEP", "PRE_GET_GOODS_INFO");
        } catch (error) {
        }
      },
      "web/ecom/order/confirm/edit": async (res) => {
        await CR.commit("DOUYIN_GOODS2/SET_STEP", "AI_PUT_GOODS_INFO");
        window.open("https://fxg.jinritemai.com/ffa/g/create");
      },
      "v1/web/ecom/product/sku/list": async (res) => {
        var _a;
        await CR.commit("DOUYIN_GOODS2/SET_GOODS_INFO", {
          skuInfo: (_a = res == null ? void 0 : res.result) == null ? void 0 : _a.data
        });
      },
      "product/detail/saas/pc|repeat": doSetBaseInfo()
    };
    window.addEventListener("message", function(event) {
      const { type, data } = event.data;
      if (type == "WEB_REQUEST_RESPONSE") {
        const url = data ? data.url : "-";
        const matchUrl = Object.keys(api_hook).find((matchUrl2) => {
          if (url.indexOf(matchUrl2) > -1) return true;
        });
        const hook = api_hook[matchUrl] || (() => {
        });
        if (!hook.isExec) {
          hook(data);
          hook.isExec = true;
        }
      }
    });
  };
  const initApp = async () => {
    const HAOHUO_HREF = location.href;
    const mdChrome = _require("mdChrome");
    await Promise.all([
      mdChrome.web.injectScript("cp_modules/store/index.js"),
      mdChrome.web.injectScript("cp_modules/loadsh/index.js"),
      mdChrome.web.injectScript("cp_modules/web-hook/index.js")
    ]);
    const CR = _require("chromeRedux");
    const DOUYIN_GOODS = {
      state: {
        goodsInfo: {
          categoryIds: [],
          mainImages: [],
          skuInfo: {
            specs: [],
            skus: [],
            pic: {},
            big_pic: {}
          },
          detailImages: [],
          baseInfo: {}
        },
        // PRE_GET_GOODS_INFO | AI_PUT_GOODS_INFO | ADD_GOODS_DRAFT_INFO | SAVE_COMPLETE_GOODS_DRAFT
        step: "PRE_GET_GOODS_INFO"
      },
      mutations: {
        SET_GOODS_INFO(state, payload) {
          state.goodsInfo = Object.assign({}, state.goodsInfo, payload || {});
        },
        SET_STEP(state, payload) {
          state.step = payload || "PRE_GET_GOODS_INFO";
        },
        RESET(state) {
          state.step = "PRE_GET_GOODS_INFO";
          state.goodsInfo = {
            categoryIds: [],
            mainImages: [],
            skuInfo: {
              specs: [],
              skus: [],
              pic: {},
              big_pic: {}
            },
            detailImages: [],
            baseInfo: {}
          };
        }
      }
    };
    CR.registerModule("DOUYIN_GOODS2", DOUYIN_GOODS);
    CR.init();
    if (HAOHUO_HREF.indexOf("https://haohuo.jinritemai.com/") >= 0) return App2();
    if (HAOHUO_HREF.indexOf("https://fxg.jinritemai.com/ffa/g/create") >= 0) return App$1();
  };
  initApp();
})();

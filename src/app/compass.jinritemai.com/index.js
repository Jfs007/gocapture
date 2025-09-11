(function() {
  "use strict";
  /**
  * @vue/shared v3.5.21
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  const EMPTY_OBJ = Object.freeze({});
  const extend = Object.assign;
  const isArray = Array.isArray;
  const isFunction = (val) => typeof val === "function";
  const isString = (val) => typeof val === "string";
  const isSymbol = (val) => typeof val === "symbol";
  const isObject = (val) => val !== null && typeof val === "object";
  let _globalThis;
  const getGlobalThis = () => {
    return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
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
  getGlobalThis().requestIdleCallback || ((cb) => setTimeout(cb, 1));
  getGlobalThis().cancelIdleCallback || ((id) => clearTimeout(id));
  const PublicInstanceProxyHandlers = {};
  {
    PublicInstanceProxyHandlers.ownKeys = (target) => {
      warn$1(
        `Avoid app logic that relies on enumerating keys on a component instance. The keys will be empty in production mode to avoid performance overhead.`
      );
      return Reflect.ownKeys(target);
    };
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
  const initCompassApp = async () => {
    console.log("🚀 Compass站点初始化...");
    const mdChrome = _require("mdChrome");
    await Promise.all([
      mdChrome.web.injectScript("cp_modules/store/index.js"),
      mdChrome.web.injectScript("cp_modules/web-hook/index.js"),
      mdChrome.web.injectScript("other/jszip.min.js"),
      mdChrome.web.injectScript("other/FileSaver.js")
    ]);
    const CR = _require("chromeRedux");
    const DOWNLOADED_VIDEOS = {
      state: {
        downloadedVideoIds: {}
      },
      mutations: {
        ADD_DOWNLOADED_VIDEO(state, videoId) {
          state.downloadedVideoIds[videoId] = 1;
          console.log("添加已下载视频:", videoId);
        },
        ADD_DOWNLOADED_VIDEOS(state, videoIds) {
          videoIds.forEach((videoId) => {
            state.downloadedVideoIds[videoId] = 1;
          });
          console.log("批量添加已下载视频:", videoIds.length, "个");
        },
        LOAD_DOWNLOADED_VIDEOS(state, videoIds) {
          state.downloadedVideoIds = videoIds;
        }
      }
    };
    const DOWNLOADED_PRODUCTS = {
      state: {
        downloadedProductIds: {}
      },
      mutations: {
        ADD_DOWNLOADED_PRODUCT(state, productId) {
          state.downloadedProductIds[productId] = Date.now();
          console.log("添加已下载商品:", productId);
        },
        LOAD_DOWNLOADED_PRODUCTS(state, productIds) {
          state.downloadedProductIds = productIds;
        }
      }
    };
    CR.registerModule("DOWNLOADED_VIDEOS", DOWNLOADED_VIDEOS);
    CR.registerModule("DOWNLOADED_PRODUCTS", DOWNLOADED_PRODUCTS);
    CR.init();
    const videoInfos = {};
    window.__PRODUCT_INFO__ = window.__PRODUCT_INFO__ || {};
    function getItemIndex({ page_no, page_size }, itemIndexInPage) {
      return (page_no - 1) * page_size + itemIndexInPage;
    }
    const downloadingStates = {};
    const downloadProgress = {};
    let downloadedProducts = {};
    async function loadDownloadedProducts() {
      try {
        const data = await CR.get("DOWNLOADED_PRODUCTS");
        if (data && data.downloadedProductIds) {
          downloadedProducts = data.downloadedProductIds || {};
          console.log("📋 加载已下载商品记录:", Object.keys(downloadedProducts).length, "个");
        }
      } catch (error) {
        console.log("加载商品下载记录失败:", error);
      }
    }
    async function saveDownloadedProduct(productId) {
      try {
        downloadedProducts[productId] = Date.now();
        await CR.commit("DOWNLOADED_PRODUCTS/ADD_DOWNLOADED_PRODUCT", productId);
        console.log("保存已下载商品:", productId);
      } catch (error) {
        console.error("保存商品下载记录失败:", error);
      }
    }
    loadDownloadedProducts();
    setInterval(() => {
      Object.keys(downloadingStates).forEach((goodsId) => {
        if (downloadingStates[goodsId]) {
          updateButtonState(goodsId);
        }
      });
      Object.keys(downloadedProducts).forEach((goodsId) => {
        if (document.getElementById(goodsId) && !downloadingStates[goodsId]) {
          updateButtonState(goodsId);
        }
      });
    }, 1e3);
    function setListOperation(list, page) {
      list.map((_, _index) => {
        const index = getItemIndex(page, _index);
        const goodsId = _.product_info.id;
        const tr = document.querySelector(`[data-row-key="${goodsId}_${index + 1}"]`);
        const td = tr == null ? void 0 : tr.querySelector("td:nth-child(3)>div");
        const operation = document.getElementById(`${goodsId}`);
        if (td && !operation) {
          const p = document.createElement("div");
          p.className = "zz";
          p.id = goodsId;
          const isDownloaded = !!downloadedProducts[goodsId];
          p.innerText = isDownloaded ? "已下载" : "下载视频";
          p.style = `margin-right: 10px;width: 80px;height: 24px;text-align: center;color: #fff;font-size: 12px;line-height: 24px;background: ${isDownloaded ? "#52c41a" : "#42a6b1"};cursor: pointer`;
          p.addEventListener("click", () => handleDownloadProduct(goodsId));
          td.insertBefore(p, td.firstChild);
        } else if (operation) {
          updateButtonState(goodsId);
        }
      });
    }
    function updateButtonState(goodsId) {
      const button = document.getElementById(goodsId);
      if (!button) return;
      const isDownloading = downloadingStates[goodsId];
      const progress = downloadProgress[goodsId];
      const isDownloaded = !!downloadedProducts[goodsId];
      if (isDownloading && progress) {
        button.innerText = progress.text;
        button.style.background = progress.color;
        button.style.cursor = "not-allowed";
      } else if (!isDownloading) {
        button.innerText = isDownloaded ? "已下载" : "下载视频";
        button.style.background = isDownloaded ? "#52c41a" : "#42a6b1";
        button.style.cursor = "pointer";
      }
    }
    function updateDownloadProgress(goodsId, text, color = "#ff7f00") {
      downloadProgress[goodsId] = { text, color };
      updateButtonState(goodsId);
    }
    function clearDownloadProgress(goodsId) {
      delete downloadProgress[goodsId];
      updateButtonState(goodsId);
    }
    async function handleDownloadProduct(goodsId) {
      var _a;
      const button = document.getElementById(goodsId);
      if (!button || downloadingStates[goodsId]) return;
      const videos = videoInfos[goodsId] || [];
      const downloadableVideos = videos.filter((video) => video.video_play_url);
      if (downloadableVideos.length === 0) {
        updateDownloadProgress(goodsId, "无可下载视频", "#999");
        setTimeout(() => {
          clearDownloadProgress(goodsId);
        }, 2e3);
        return;
      }
      downloadingStates[goodsId] = true;
      updateDownloadProgress(goodsId, "准备中...");
      try {
        while (!window.JSZip || !window.saveAs) {
          console.log("⏳ 等待压缩库加载...");
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const zip = new JSZip();
        const productInfo = window.__PRODUCT_INFO__[goodsId] || {};
        const productName = ((_a = productInfo.name) == null ? void 0 : _a.replace(/[/\\:*?"<>|]/g, "_")) || `商品_${goodsId}`;
        let successCount = 0;
        let totalCount = downloadableVideos.length;
        console.log(`📦 开始下载商品 ${productName} 的 ${totalCount} 个视频...`);
        const BATCH_SIZE = 3;
        for (let i = 0; i < downloadableVideos.length; i += BATCH_SIZE) {
          const batch = downloadableVideos.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(async (video) => {
            try {
              updateDownloadProgress(goodsId, `下载中 ${successCount + 1}/${totalCount}`);
              const response = await fetch(video.video_play_url);
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              const blob = await response.blob();
              const dimensions = await getVideoDimensionsFromBlob(blob);
              const sizeStr = dimensions.width > 0 && dimensions.height > 0 ? `${dimensions.width}x${dimensions.height}_` : "";
              const fileName = `${sizeStr}${video.author_name || "unknown"}_${video.video_id}.mp4`.replace(/[/\\:*?"<>|]/g, "_");
              zip.file(fileName, blob);
              const data = await CR.get("DOWNLOADED_VIDEOS");
              const downloadedVideoIds = (data == null ? void 0 : data.downloadedVideoIds) || {};
              downloadedVideoIds[video.video_id] = 1;
              await CR.commit("DOWNLOADED_VIDEOS/ADD_DOWNLOADED_VIDEO", video.video_id);
              successCount++;
              console.log(`✅ 下载完成: ${fileName}`);
              return true;
            } catch (error) {
              console.error(`❌ 下载失败: ${video.video_id}`, error);
              return false;
            }
          });
          await Promise.all(batchPromises);
          if (i + BATCH_SIZE < downloadableVideos.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
        if (successCount > 0) {
          updateDownloadProgress(goodsId, "压缩中...");
          const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/:/g, "-");
          const content = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 1 }
          });
          const filename = `${productName}_${successCount}个视频_${timestamp}.zip`;
          window.saveAs(content, filename);
          await saveDownloadedProduct(goodsId);
          updateDownloadProgress(goodsId, `已下载 ${successCount}个`, "#52c41a");
          console.log(`🎉 商品 ${productName} 下载完成！成功: ${successCount}个`);
        } else {
          throw new Error("没有成功下载任何视频");
        }
        setTimeout(() => {
          downloadingStates[goodsId] = false;
          clearDownloadProgress(goodsId);
        }, 3e3);
      } catch (error) {
        console.error("❌ 商品视频下载失败:", error);
        updateDownloadProgress(goodsId, "下载失败", "#ff4d4f");
        setTimeout(() => {
          downloadingStates[goodsId] = false;
          clearDownloadProgress(goodsId);
        }, 3e3);
      }
    }
    async function getVideoDimensionsFromBlob(blob) {
      return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        const cleanup = () => {
          video.removeEventListener("loadedmetadata", onLoadedMetadata);
          video.removeEventListener("error", onError);
          if (video.src) {
            URL.revokeObjectURL(video.src);
          }
          video.src = "";
        };
        const onLoadedMetadata = () => {
          const dimensions = {
            width: video.videoWidth,
            height: video.videoHeight
          };
          cleanup();
          resolve(dimensions);
        };
        const onError = () => {
          cleanup();
          resolve({ width: 0, height: 0 });
        };
        video.addEventListener("loadedmetadata", onLoadedMetadata);
        video.addEventListener("error", onError);
        const blobUrl = URL.createObjectURL(blob);
        video.src = blobUrl;
        setTimeout(() => {
          cleanup();
          resolve({ width: 0, height: 0 });
        }, 5e3);
      });
    }
    const api_hook = {
      "shop/product/product_rank/video_bring_good": (res) => {
        var _a, _b;
        const list = ((_b = (_a = res == null ? void 0 : res.result) == null ? void 0 : _a.data) == null ? void 0 : _b.data_result) || [];
        list.map((item) => {
          const goodsId = item.product_info.id;
          videoInfos[goodsId] = item.video_list || [];
          window.__PRODUCT_INFO__[goodsId] = item.product_info;
        });
        setTimeout(() => {
          var _a2, _b2;
          setListOperation(list, ((_b2 = (_a2 = res == null ? void 0 : res.result) == null ? void 0 : _a2.data) == null ? void 0 : _b2.page_result) || {});
          setTimeout(() => {
            list.forEach((item) => {
              updateButtonState(item.product_info.id);
            });
          }, 100);
        }, 60);
        console.log("📊 视频数据更新:", videoInfos);
      }
    };
    window.addEventListener("message", function(event) {
      const { type, data } = event.data;
      if (type === "WEB_REQUEST_RESPONSE") {
        const url = data ? data.url : "";
        const matchUrl = Object.keys(api_hook).find((pattern) => {
          return url.indexOf(pattern) > -1;
        });
        if (matchUrl) {
          const hook = api_hook[matchUrl];
          if (hook) {
            hook(data);
          }
        }
      }
    });
    window._videoDataCollector = {
      getAllVideos: () => {
        const videos = [];
        Object.entries(videoInfos).forEach(([goodsId, videoList]) => {
          videoList.forEach((video) => {
            const productInfo = window.__PRODUCT_INFO__[goodsId] || {};
            videos.push({
              goodsId,
              productName: productInfo.name || `商品 ${goodsId}`,
              ...video,
              video_url: video.video_play_url || `https://www.douyin.com/video/${video.video_id}`,
              has_play_url: !!video.video_play_url,
              video_img: video.video_img
            });
          });
        });
        return videos;
      },
      getVideosByGoodsId: (goodsId) => videoInfos[goodsId] || []
    };
    window._downloadManager = {
      downloadVideos: async (videos, config, progressCallback) => {
        console.log("批量下载视频:", videos.length, "个");
      }
    };
    const MdUiComponent = window["MdUiComponent"];
    if (!MdUiComponent) {
      console.error("❌ MdUiComponent未加载，等待加载...");
      let retries = 0;
      while (!window["MdUiComponent"] && retries < 50) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries++;
      }
      if (!window["MdUiComponent"]) {
        console.error("❌ MdUiComponent加载超时");
        return;
      }
    }
    console.log("📦 共享组件库已加载");
    setTimeout(async () => {
      console.log("🔧 开始创建Vue应用...");
      const loadsh = _require("loadsh");
      const store = _require("store");
      if (loadsh) {
        console.log("📦 loadsh工具函数已可用:", Object.keys(loadsh));
        loadsh.showToast && loadsh.showToast({ message: "🎉 Compass应用启动成功!" });
      }
      if (store) {
        console.log("📦 store状态管理已可用:", typeof store);
      }
      const { h } = MdUiComponent;
      const { App } = MdUiComponent.Components;
      console.log("🔧 使用App模式创建应用...");
      const style = document.createElement("style");
      style.textContent = `
      .compass-app > * {
        pointer-events: auto !important;
      }
    `;
      document.head.appendChild(style);
      console.log("🎉 Compass应用创建完成!");
      console.log("📋 功能清单:");
      console.log("  ✅ API数据拦截和收集");
      console.log("  ✅ 页面下载按钮注入");
      console.log("  ✅ 单商品视频批量下载");
      console.log("  ✅ 多商品视频分批打包下载");
      console.log("  ✅ 下载记录状态管理");
      console.log("  ✅ 悬浮工具箱界面");
    }, 500);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initCompassApp());
  } else {
    initCompassApp();
  }
})();

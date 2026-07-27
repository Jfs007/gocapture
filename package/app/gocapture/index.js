var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : Symbol.for("Symbol." + name);
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var __forAwait = (obj, it, method) => (it = obj[__knownSymbol("asyncIterator")]) ? it.call(obj) : (obj = obj[__knownSymbol("iterator")](), it = {}, method = (key, fn) => (fn = obj[key]) && (it[key] = (arg) => new Promise((yes, no, done) => (arg = fn.call(obj, arg), done = arg.done, Promise.resolve(arg.value).then((value) => yes({ value, done }), no)))), method("next"), method("return"), it);
(function() {
  "use strict";
  /**
  * @vue/shared v3.5.35
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  var _a;
  // @__NO_SIDE_EFFECTS__
  function makeMap(str) {
    const map = /* @__PURE__ */ Object.create(null);
    for (const key of str.split(",")) map[key] = 1;
    return (val) => val in map;
  }
  const EMPTY_OBJ = {};
  const EMPTY_ARR = [];
  const NOOP = () => {
  };
  const NO = () => false;
  const isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // uppercase letter
  (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
  const isModelListener = (key) => key.startsWith("onUpdate:");
  const extend = Object.assign;
  const remove = (arr, el) => {
    const i = arr.indexOf(el);
    if (i > -1) {
      arr.splice(i, 1);
    }
  };
  const hasOwnProperty$1 = Object.prototype.hasOwnProperty;
  const hasOwn = (val, key) => hasOwnProperty$1.call(val, key);
  const isArray = Array.isArray;
  const isMap = (val) => toTypeString(val) === "[object Map]";
  const isSet = (val) => toTypeString(val) === "[object Set]";
  const isDate = (val) => toTypeString(val) === "[object Date]";
  const isFunction = (val) => typeof val === "function";
  const isString = (val) => typeof val === "string";
  const isSymbol = (val) => typeof val === "symbol";
  const isObject = (val) => val !== null && typeof val === "object";
  const isPromise = (val) => {
    return (isObject(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
  };
  const objectToString = Object.prototype.toString;
  const toTypeString = (value) => objectToString.call(value);
  const toRawType = (value) => {
    return toTypeString(value).slice(8, -1);
  };
  const isPlainObject$1 = (val) => toTypeString(val) === "[object Object]";
  const isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
  const isReservedProp = /* @__PURE__ */ makeMap(
    // the leading comma is intentional so empty string "" is also included
    ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
  );
  const cacheStringFunction = (fn) => {
    const cache = /* @__PURE__ */ Object.create(null);
    return (str) => {
      const hit = cache[str];
      return hit || (cache[str] = fn(str));
    };
  };
  const camelizeRE = /-\w/g;
  const camelize = cacheStringFunction(
    (str) => {
      return str.replace(camelizeRE, (c2) => c2.slice(1).toUpperCase());
    }
  );
  const hyphenateRE = /\B([A-Z])/g;
  const hyphenate = cacheStringFunction(
    (str) => str.replace(hyphenateRE, "-$1").toLowerCase()
  );
  const capitalize = cacheStringFunction((str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
  const toHandlerKey = cacheStringFunction(
    (str) => {
      const s = str ? `on${capitalize(str)}` : ``;
      return s;
    }
  );
  const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
  const invokeArrayFns = (fns, ...arg) => {
    for (let i = 0; i < fns.length; i++) {
      fns[i](...arg);
    }
  };
  const def = (obj, key, value, writable = false) => {
    Object.defineProperty(obj, key, {
      configurable: true,
      enumerable: false,
      writable,
      value
    });
  };
  const looseToNumber = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? val : n;
  };
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
  const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
  const isSpecialBooleanAttr = /* @__PURE__ */ makeMap(specialBooleanAttrs);
  function includeBooleanAttr(value) {
    return !!value || value === "";
  }
  function looseCompareArrays(a, b) {
    if (a.length !== b.length) return false;
    let equal = true;
    for (let i = 0; equal && i < a.length; i++) {
      equal = looseEqual(a[i], b[i]);
    }
    return equal;
  }
  function looseEqual(a, b) {
    if (a === b) return true;
    let aValidType = isDate(a);
    let bValidType = isDate(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? a.getTime() === b.getTime() : false;
    }
    aValidType = isSymbol(a);
    bValidType = isSymbol(b);
    if (aValidType || bValidType) {
      return a === b;
    }
    aValidType = isArray(a);
    bValidType = isArray(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareArrays(a, b) : false;
    }
    aValidType = isObject(a);
    bValidType = isObject(b);
    if (aValidType || bValidType) {
      if (!aValidType || !bValidType) {
        return false;
      }
      const aKeysCount = Object.keys(a).length;
      const bKeysCount = Object.keys(b).length;
      if (aKeysCount !== bKeysCount) {
        return false;
      }
      for (const key in a) {
        const aHasKey = a.hasOwnProperty(key);
        const bHasKey = b.hasOwnProperty(key);
        if (aHasKey && !bHasKey || !aHasKey && bHasKey || !looseEqual(a[key], b[key])) {
          return false;
        }
      }
    }
    return String(a) === String(b);
  }
  function looseIndexOf(arr, val) {
    return arr.findIndex((item) => looseEqual(item, val));
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
    } else if (isObject(val) && !isArray(val) && !isPlainObject$1(val)) {
      return String(val);
    }
    return val;
  };
  const stringifySymbol = (v, i = "") => {
    var _a2;
    return (
      // Symbol.description in es2019+ so we need to cast here to pass
      // the lib: es2016 check
      isSymbol(v) ? `Symbol(${(_a2 = v.description) != null ? _a2 : i})` : v
    );
  };
  /**
  * @vue/reactivity v3.5.35
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  let activeEffectScope;
  class EffectScope {
    // TODO isolatedDeclarations "__v_skip"
    constructor(detached = false) {
      this.detached = detached;
      this._active = true;
      this._on = 0;
      this.effects = [];
      this.cleanups = [];
      this._isPaused = false;
      this._warnOnRun = true;
      this.__v_skip = true;
      if (!detached && activeEffectScope) {
        if (activeEffectScope.active) {
          this.parent = activeEffectScope;
          this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
            this
          ) - 1;
        } else {
          this._active = false;
          this._warnOnRun = false;
        }
      }
    }
    get active() {
      return this._active;
    }
    pause() {
      if (this._active) {
        this._isPaused = true;
        let i, l;
        if (this.scopes) {
          for (i = 0, l = this.scopes.length; i < l; i++) {
            this.scopes[i].pause();
          }
        }
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].pause();
        }
      }
    }
    /**
     * Resumes the effect scope, including all child scopes and effects.
     */
    resume() {
      if (this._active) {
        if (this._isPaused) {
          this._isPaused = false;
          let i, l;
          if (this.scopes) {
            for (i = 0, l = this.scopes.length; i < l; i++) {
              this.scopes[i].resume();
            }
          }
          for (i = 0, l = this.effects.length; i < l; i++) {
            this.effects[i].resume();
          }
        }
      }
    }
    run(fn) {
      if (this._active) {
        const currentEffectScope = activeEffectScope;
        try {
          activeEffectScope = this;
          return fn();
        } finally {
          activeEffectScope = currentEffectScope;
        }
      }
    }
    /**
     * This should only be called on non-detached scopes
     * @internal
     */
    on() {
      if (++this._on === 1) {
        this.prevScope = activeEffectScope;
        activeEffectScope = this;
      }
    }
    /**
     * This should only be called on non-detached scopes
     * @internal
     */
    off() {
      if (this._on > 0 && --this._on === 0) {
        if (activeEffectScope === this) {
          activeEffectScope = this.prevScope;
        } else {
          let current = activeEffectScope;
          while (current) {
            if (current.prevScope === this) {
              current.prevScope = this.prevScope;
              break;
            }
            current = current.prevScope;
          }
        }
        this.prevScope = void 0;
      }
    }
    stop(fromParent) {
      if (this._active) {
        this._active = false;
        let i, l;
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].stop();
        }
        this.effects.length = 0;
        for (i = 0, l = this.cleanups.length; i < l; i++) {
          this.cleanups[i]();
        }
        this.cleanups.length = 0;
        if (this.scopes) {
          for (i = 0, l = this.scopes.length; i < l; i++) {
            this.scopes[i].stop(true);
          }
          this.scopes.length = 0;
        }
        if (!this.detached && this.parent && !fromParent) {
          const last = this.parent.scopes.pop();
          if (last && last !== this) {
            this.parent.scopes[this.index] = last;
            last.index = this.index;
          }
        }
        this.parent = void 0;
      }
    }
  }
  function effectScope(detached) {
    return new EffectScope(detached);
  }
  function getCurrentScope() {
    return activeEffectScope;
  }
  function onScopeDispose(fn, failSilently = false) {
    if (activeEffectScope) {
      activeEffectScope.cleanups.push(fn);
    }
  }
  let activeSub;
  const pausedQueueEffects = /* @__PURE__ */ new WeakSet();
  class ReactiveEffect {
    constructor(fn) {
      this.fn = fn;
      this.deps = void 0;
      this.depsTail = void 0;
      this.flags = 1 | 4;
      this.next = void 0;
      this.cleanup = void 0;
      this.scheduler = void 0;
      if (activeEffectScope) {
        if (activeEffectScope.active) {
          activeEffectScope.effects.push(this);
        } else {
          this.flags &= -2;
        }
      }
    }
    pause() {
      this.flags |= 64;
    }
    resume() {
      if (this.flags & 64) {
        this.flags &= -65;
        if (pausedQueueEffects.has(this)) {
          pausedQueueEffects.delete(this);
          this.trigger();
        }
      }
    }
    /**
     * @internal
     */
    notify() {
      if (this.flags & 2 && !(this.flags & 32)) {
        return;
      }
      if (!(this.flags & 8)) {
        batch(this);
      }
    }
    run() {
      if (!(this.flags & 1)) {
        return this.fn();
      }
      this.flags |= 2;
      cleanupEffect(this);
      prepareDeps(this);
      const prevEffect = activeSub;
      const prevShouldTrack = shouldTrack;
      activeSub = this;
      shouldTrack = true;
      try {
        return this.fn();
      } finally {
        cleanupDeps(this);
        activeSub = prevEffect;
        shouldTrack = prevShouldTrack;
        this.flags &= -3;
      }
    }
    stop() {
      if (this.flags & 1) {
        for (let link = this.deps; link; link = link.nextDep) {
          removeSub(link);
        }
        this.deps = this.depsTail = void 0;
        cleanupEffect(this);
        this.onStop && this.onStop();
        this.flags &= -2;
      }
    }
    trigger() {
      if (this.flags & 64) {
        pausedQueueEffects.add(this);
      } else if (this.scheduler) {
        this.scheduler();
      } else {
        this.runIfDirty();
      }
    }
    /**
     * @internal
     */
    runIfDirty() {
      if (isDirty(this)) {
        this.run();
      }
    }
    get dirty() {
      return isDirty(this);
    }
  }
  let batchDepth = 0;
  let batchedSub;
  let batchedComputed;
  function batch(sub, isComputed2 = false) {
    sub.flags |= 8;
    if (isComputed2) {
      sub.next = batchedComputed;
      batchedComputed = sub;
      return;
    }
    sub.next = batchedSub;
    batchedSub = sub;
  }
  function startBatch() {
    batchDepth++;
  }
  function endBatch() {
    if (--batchDepth > 0) {
      return;
    }
    if (batchedComputed) {
      let e = batchedComputed;
      batchedComputed = void 0;
      while (e) {
        const next = e.next;
        e.next = void 0;
        e.flags &= -9;
        e = next;
      }
    }
    let error;
    while (batchedSub) {
      let e = batchedSub;
      batchedSub = void 0;
      while (e) {
        const next = e.next;
        e.next = void 0;
        e.flags &= -9;
        if (e.flags & 1) {
          try {
            ;
            e.trigger();
          } catch (err) {
            if (!error) error = err;
          }
        }
        e = next;
      }
    }
    if (error) throw error;
  }
  function prepareDeps(sub) {
    for (let link = sub.deps; link; link = link.nextDep) {
      link.version = -1;
      link.prevActiveLink = link.dep.activeLink;
      link.dep.activeLink = link;
    }
  }
  function cleanupDeps(sub) {
    let head;
    let tail = sub.depsTail;
    let link = tail;
    while (link) {
      const prev = link.prevDep;
      if (link.version === -1) {
        if (link === tail) tail = prev;
        removeSub(link);
        removeDep(link);
      } else {
        head = link;
      }
      link.dep.activeLink = link.prevActiveLink;
      link.prevActiveLink = void 0;
      link = prev;
    }
    sub.deps = head;
    sub.depsTail = tail;
  }
  function isDirty(sub) {
    for (let link = sub.deps; link; link = link.nextDep) {
      if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) {
        return true;
      }
    }
    if (sub._dirty) {
      return true;
    }
    return false;
  }
  function refreshComputed(computed2) {
    if (computed2.flags & 4 && !(computed2.flags & 16)) {
      return;
    }
    computed2.flags &= -17;
    if (computed2.globalVersion === globalVersion) {
      return;
    }
    computed2.globalVersion = globalVersion;
    if (!computed2.isSSR && computed2.flags & 128 && (!computed2.deps && !computed2._dirty || !isDirty(computed2))) {
      return;
    }
    computed2.flags |= 2;
    const dep = computed2.dep;
    const prevSub = activeSub;
    const prevShouldTrack = shouldTrack;
    activeSub = computed2;
    shouldTrack = true;
    try {
      prepareDeps(computed2);
      const value = computed2.fn(computed2._value);
      if (dep.version === 0 || hasChanged(value, computed2._value)) {
        computed2.flags |= 128;
        computed2._value = value;
        dep.version++;
      }
    } catch (err) {
      dep.version++;
      throw err;
    } finally {
      activeSub = prevSub;
      shouldTrack = prevShouldTrack;
      cleanupDeps(computed2);
      computed2.flags &= -3;
    }
  }
  function removeSub(link, soft = false) {
    const { dep, prevSub, nextSub } = link;
    if (prevSub) {
      prevSub.nextSub = nextSub;
      link.prevSub = void 0;
    }
    if (nextSub) {
      nextSub.prevSub = prevSub;
      link.nextSub = void 0;
    }
    if (dep.subs === link) {
      dep.subs = prevSub;
      if (!prevSub && dep.computed) {
        dep.computed.flags &= -5;
        for (let l = dep.computed.deps; l; l = l.nextDep) {
          removeSub(l, true);
        }
      }
    }
    if (!soft && !--dep.sc && dep.map) {
      dep.map.delete(dep.key);
    }
  }
  function removeDep(link) {
    const { prevDep, nextDep } = link;
    if (prevDep) {
      prevDep.nextDep = nextDep;
      link.prevDep = void 0;
    }
    if (nextDep) {
      nextDep.prevDep = prevDep;
      link.nextDep = void 0;
    }
  }
  let shouldTrack = true;
  const trackStack = [];
  function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
  }
  function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === void 0 ? true : last;
  }
  function cleanupEffect(e) {
    const { cleanup } = e;
    e.cleanup = void 0;
    if (cleanup) {
      const prevSub = activeSub;
      activeSub = void 0;
      try {
        cleanup();
      } finally {
        activeSub = prevSub;
      }
    }
  }
  let globalVersion = 0;
  class Link {
    constructor(sub, dep) {
      this.sub = sub;
      this.dep = dep;
      this.version = dep.version;
      this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
    }
  }
  class Dep {
    // TODO isolatedDeclarations "__v_skip"
    constructor(computed2) {
      this.computed = computed2;
      this.version = 0;
      this.activeLink = void 0;
      this.subs = void 0;
      this.map = void 0;
      this.key = void 0;
      this.sc = 0;
      this.__v_skip = true;
    }
    track(debugInfo) {
      if (!activeSub || !shouldTrack || activeSub === this.computed) {
        return;
      }
      let link = this.activeLink;
      if (link === void 0 || link.sub !== activeSub) {
        link = this.activeLink = new Link(activeSub, this);
        if (!activeSub.deps) {
          activeSub.deps = activeSub.depsTail = link;
        } else {
          link.prevDep = activeSub.depsTail;
          activeSub.depsTail.nextDep = link;
          activeSub.depsTail = link;
        }
        addSub(link);
      } else if (link.version === -1) {
        link.version = this.version;
        if (link.nextDep) {
          const next = link.nextDep;
          next.prevDep = link.prevDep;
          if (link.prevDep) {
            link.prevDep.nextDep = next;
          }
          link.prevDep = activeSub.depsTail;
          link.nextDep = void 0;
          activeSub.depsTail.nextDep = link;
          activeSub.depsTail = link;
          if (activeSub.deps === link) {
            activeSub.deps = next;
          }
        }
      }
      return link;
    }
    trigger(debugInfo) {
      this.version++;
      globalVersion++;
      this.notify(debugInfo);
    }
    notify(debugInfo) {
      startBatch();
      try {
        if (false) ;
        for (let link = this.subs; link; link = link.prevSub) {
          if (link.sub.notify()) {
            ;
            link.sub.dep.notify();
          }
        }
      } finally {
        endBatch();
      }
    }
  }
  function addSub(link) {
    link.dep.sc++;
    if (link.sub.flags & 4) {
      const computed2 = link.dep.computed;
      if (computed2 && !link.dep.subs) {
        computed2.flags |= 4 | 16;
        for (let l = computed2.deps; l; l = l.nextDep) {
          addSub(l);
        }
      }
      const currentTail = link.dep.subs;
      if (currentTail !== link) {
        link.prevSub = currentTail;
        if (currentTail) currentTail.nextSub = link;
      }
      link.dep.subs = link;
    }
  }
  const targetMap = /* @__PURE__ */ new WeakMap();
  const ITERATE_KEY = /* @__PURE__ */ Symbol(
    ""
  );
  const MAP_KEY_ITERATE_KEY = /* @__PURE__ */ Symbol(
    ""
  );
  const ARRAY_ITERATE_KEY = /* @__PURE__ */ Symbol(
    ""
  );
  function track(target, type, key) {
    if (shouldTrack && activeSub) {
      let depsMap = targetMap.get(target);
      if (!depsMap) {
        targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
      }
      let dep = depsMap.get(key);
      if (!dep) {
        depsMap.set(key, dep = new Dep());
        dep.map = depsMap;
        dep.key = key;
      }
      {
        dep.track();
      }
    }
  }
  function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);
    if (!depsMap) {
      globalVersion++;
      return;
    }
    const run = (dep) => {
      if (dep) {
        {
          dep.trigger();
        }
      }
    };
    startBatch();
    if (type === "clear") {
      depsMap.forEach(run);
    } else {
      const targetIsArray = isArray(target);
      const isArrayIndex = targetIsArray && isIntegerKey(key);
      if (targetIsArray && key === "length") {
        const newLength = Number(newValue);
        depsMap.forEach((dep, key2) => {
          if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !isSymbol(key2) && key2 >= newLength) {
            run(dep);
          }
        });
      } else {
        if (key !== void 0 || depsMap.has(void 0)) {
          run(depsMap.get(key));
        }
        if (isArrayIndex) {
          run(depsMap.get(ARRAY_ITERATE_KEY));
        }
        switch (type) {
          case "add":
            if (!targetIsArray) {
              run(depsMap.get(ITERATE_KEY));
              if (isMap(target)) {
                run(depsMap.get(MAP_KEY_ITERATE_KEY));
              }
            } else if (isArrayIndex) {
              run(depsMap.get("length"));
            }
            break;
          case "delete":
            if (!targetIsArray) {
              run(depsMap.get(ITERATE_KEY));
              if (isMap(target)) {
                run(depsMap.get(MAP_KEY_ITERATE_KEY));
              }
            }
            break;
          case "set":
            if (isMap(target)) {
              run(depsMap.get(ITERATE_KEY));
            }
            break;
        }
      }
    }
    endBatch();
  }
  function getDepFromReactive(object, key) {
    const depMap = targetMap.get(object);
    return depMap && depMap.get(key);
  }
  function reactiveReadArray(array) {
    const raw = /* @__PURE__ */ toRaw(array);
    if (raw === array) return raw;
    track(raw, "iterate", ARRAY_ITERATE_KEY);
    return /* @__PURE__ */ isShallow(array) ? raw : raw.map(toReactive);
  }
  function shallowReadArray(arr) {
    track(arr = /* @__PURE__ */ toRaw(arr), "iterate", ARRAY_ITERATE_KEY);
    return arr;
  }
  function toWrapped(target, item) {
    if (/* @__PURE__ */ isReadonly(target)) {
      return /* @__PURE__ */ isReactive(target) ? toReadonly(toReactive(item)) : toReadonly(item);
    }
    return toReactive(item);
  }
  const arrayInstrumentations = {
    __proto__: null,
    [Symbol.iterator]() {
      return iterator(this, Symbol.iterator, (item) => toWrapped(this, item));
    },
    concat(...args) {
      return reactiveReadArray(this).concat(
        ...args.map((x) => isArray(x) ? reactiveReadArray(x) : x)
      );
    },
    entries() {
      return iterator(this, "entries", (value) => {
        value[1] = toWrapped(this, value[1]);
        return value;
      });
    },
    every(fn, thisArg) {
      return apply(this, "every", fn, thisArg, void 0, arguments);
    },
    filter(fn, thisArg) {
      return apply(
        this,
        "filter",
        fn,
        thisArg,
        (v) => v.map((item) => toWrapped(this, item)),
        arguments
      );
    },
    find(fn, thisArg) {
      return apply(
        this,
        "find",
        fn,
        thisArg,
        (item) => toWrapped(this, item),
        arguments
      );
    },
    findIndex(fn, thisArg) {
      return apply(this, "findIndex", fn, thisArg, void 0, arguments);
    },
    findLast(fn, thisArg) {
      return apply(
        this,
        "findLast",
        fn,
        thisArg,
        (item) => toWrapped(this, item),
        arguments
      );
    },
    findLastIndex(fn, thisArg) {
      return apply(this, "findLastIndex", fn, thisArg, void 0, arguments);
    },
    // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
    forEach(fn, thisArg) {
      return apply(this, "forEach", fn, thisArg, void 0, arguments);
    },
    includes(...args) {
      return searchProxy(this, "includes", args);
    },
    indexOf(...args) {
      return searchProxy(this, "indexOf", args);
    },
    join(separator) {
      return reactiveReadArray(this).join(separator);
    },
    // keys() iterator only reads `length`, no optimization required
    lastIndexOf(...args) {
      return searchProxy(this, "lastIndexOf", args);
    },
    map(fn, thisArg) {
      return apply(this, "map", fn, thisArg, void 0, arguments);
    },
    pop() {
      return noTracking(this, "pop");
    },
    push(...args) {
      return noTracking(this, "push", args);
    },
    reduce(fn, ...args) {
      return reduce(this, "reduce", fn, args);
    },
    reduceRight(fn, ...args) {
      return reduce(this, "reduceRight", fn, args);
    },
    shift() {
      return noTracking(this, "shift");
    },
    // slice could use ARRAY_ITERATE but also seems to beg for range tracking
    some(fn, thisArg) {
      return apply(this, "some", fn, thisArg, void 0, arguments);
    },
    splice(...args) {
      return noTracking(this, "splice", args);
    },
    toReversed() {
      return reactiveReadArray(this).toReversed();
    },
    toSorted(comparer) {
      return reactiveReadArray(this).toSorted(comparer);
    },
    toSpliced(...args) {
      return reactiveReadArray(this).toSpliced(...args);
    },
    unshift(...args) {
      return noTracking(this, "unshift", args);
    },
    values() {
      return iterator(this, "values", (item) => toWrapped(this, item));
    }
  };
  function iterator(self2, method, wrapValue) {
    const arr = shallowReadArray(self2);
    const iter = arr[method]();
    if (arr !== self2 && !/* @__PURE__ */ isShallow(self2)) {
      iter._next = iter.next;
      iter.next = () => {
        const result = iter._next();
        if (!result.done) {
          result.value = wrapValue(result.value);
        }
        return result;
      };
    }
    return iter;
  }
  const arrayProto = Array.prototype;
  function apply(self2, method, fn, thisArg, wrappedRetFn, args) {
    const arr = shallowReadArray(self2);
    const needsWrap = arr !== self2 && !/* @__PURE__ */ isShallow(self2);
    const methodFn = arr[method];
    if (methodFn !== arrayProto[method]) {
      const result2 = methodFn.apply(self2, args);
      return needsWrap ? toReactive(result2) : result2;
    }
    let wrappedFn = fn;
    if (arr !== self2) {
      if (needsWrap) {
        wrappedFn = function(item, index) {
          return fn.call(this, toWrapped(self2, item), index, self2);
        };
      } else if (fn.length > 2) {
        wrappedFn = function(item, index) {
          return fn.call(this, item, index, self2);
        };
      }
    }
    const result = methodFn.call(arr, wrappedFn, thisArg);
    return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
  }
  function reduce(self2, method, fn, args) {
    const arr = shallowReadArray(self2);
    const needsWrap = arr !== self2 && !/* @__PURE__ */ isShallow(self2);
    let wrappedFn = fn;
    let wrapInitialAccumulator = false;
    if (arr !== self2) {
      if (needsWrap) {
        wrapInitialAccumulator = args.length === 0;
        wrappedFn = function(acc, item, index) {
          if (wrapInitialAccumulator) {
            wrapInitialAccumulator = false;
            acc = toWrapped(self2, acc);
          }
          return fn.call(this, acc, toWrapped(self2, item), index, self2);
        };
      } else if (fn.length > 3) {
        wrappedFn = function(acc, item, index) {
          return fn.call(this, acc, item, index, self2);
        };
      }
    }
    const result = arr[method](wrappedFn, ...args);
    return wrapInitialAccumulator ? toWrapped(self2, result) : result;
  }
  function searchProxy(self2, method, args) {
    const arr = /* @__PURE__ */ toRaw(self2);
    track(arr, "iterate", ARRAY_ITERATE_KEY);
    const res = arr[method](...args);
    if ((res === -1 || res === false) && /* @__PURE__ */ isProxy(args[0])) {
      args[0] = /* @__PURE__ */ toRaw(args[0]);
      return arr[method](...args);
    }
    return res;
  }
  function noTracking(self2, method, args = []) {
    pauseTracking();
    startBatch();
    const res = (/* @__PURE__ */ toRaw(self2))[method].apply(self2, args);
    endBatch();
    resetTracking();
    return res;
  }
  const isNonTrackableKeys = /* @__PURE__ */ makeMap(`__proto__,__v_isRef,__isVue`);
  const builtInSymbols = new Set(
    /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol)
  );
  function hasOwnProperty(key) {
    if (!isSymbol(key)) key = String(key);
    const obj = /* @__PURE__ */ toRaw(this);
    track(obj, "has", key);
    return obj.hasOwnProperty(key);
  }
  class BaseReactiveHandler {
    constructor(_isReadonly = false, _isShallow = false) {
      this._isReadonly = _isReadonly;
      this._isShallow = _isShallow;
    }
    get(target, key, receiver) {
      if (key === "__v_skip") return target["__v_skip"];
      const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
      if (key === "__v_isReactive") {
        return !isReadonly2;
      } else if (key === "__v_isReadonly") {
        return isReadonly2;
      } else if (key === "__v_isShallow") {
        return isShallow2;
      } else if (key === "__v_raw") {
        if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || // receiver is not the reactive proxy, but has the same prototype
        // this means the receiver is a user proxy of the reactive proxy
        Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
          return target;
        }
        return;
      }
      const targetIsArray = isArray(target);
      if (!isReadonly2) {
        let fn;
        if (targetIsArray && (fn = arrayInstrumentations[key])) {
          return fn;
        }
        if (key === "hasOwnProperty") {
          return hasOwnProperty;
        }
      }
      const res = Reflect.get(
        target,
        key,
        // if this is a proxy wrapping a ref, return methods using the raw ref
        // as receiver so that we don't have to call `toRaw` on the ref in all
        // its class methods
        /* @__PURE__ */ isRef(target) ? target : receiver
      );
      if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
        return res;
      }
      if (!isReadonly2) {
        track(target, "get", key);
      }
      if (isShallow2) {
        return res;
      }
      if (/* @__PURE__ */ isRef(res)) {
        const value = targetIsArray && isIntegerKey(key) ? res : res.value;
        return isReadonly2 && isObject(value) ? /* @__PURE__ */ readonly(value) : value;
      }
      if (isObject(res)) {
        return isReadonly2 ? /* @__PURE__ */ readonly(res) : /* @__PURE__ */ reactive(res);
      }
      return res;
    }
  }
  class MutableReactiveHandler extends BaseReactiveHandler {
    constructor(isShallow2 = false) {
      super(false, isShallow2);
    }
    set(target, key, value, receiver) {
      let oldValue = target[key];
      const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key);
      if (!this._isShallow) {
        const isOldValueReadonly = /* @__PURE__ */ isReadonly(oldValue);
        if (!/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
          oldValue = /* @__PURE__ */ toRaw(oldValue);
          value = /* @__PURE__ */ toRaw(value);
        }
        if (!isArrayWithIntegerKey && /* @__PURE__ */ isRef(oldValue) && !/* @__PURE__ */ isRef(value)) {
          if (isOldValueReadonly) {
            return true;
          } else {
            oldValue.value = value;
            return true;
          }
        }
      }
      const hadKey = isArrayWithIntegerKey ? Number(key) < target.length : hasOwn(target, key);
      const result = Reflect.set(
        target,
        key,
        value,
        /* @__PURE__ */ isRef(target) ? target : receiver
      );
      if (target === /* @__PURE__ */ toRaw(receiver)) {
        if (!hadKey) {
          trigger(target, "add", key, value);
        } else if (hasChanged(value, oldValue)) {
          trigger(target, "set", key, value);
        }
      }
      return result;
    }
    deleteProperty(target, key) {
      const hadKey = hasOwn(target, key);
      target[key];
      const result = Reflect.deleteProperty(target, key);
      if (result && hadKey) {
        trigger(target, "delete", key, void 0);
      }
      return result;
    }
    has(target, key) {
      const result = Reflect.has(target, key);
      if (!isSymbol(key) || !builtInSymbols.has(key)) {
        track(target, "has", key);
      }
      return result;
    }
    ownKeys(target) {
      track(
        target,
        "iterate",
        isArray(target) ? "length" : ITERATE_KEY
      );
      return Reflect.ownKeys(target);
    }
  }
  class ReadonlyReactiveHandler extends BaseReactiveHandler {
    constructor(isShallow2 = false) {
      super(true, isShallow2);
    }
    set(target, key) {
      return true;
    }
    deleteProperty(target, key) {
      return true;
    }
  }
  const mutableHandlers = /* @__PURE__ */ new MutableReactiveHandler();
  const readonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler();
  const shallowReactiveHandlers = /* @__PURE__ */ new MutableReactiveHandler(true);
  const shallowReadonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler(true);
  const toShallow = (value) => value;
  const getProto = (v) => Reflect.getPrototypeOf(v);
  function createIterableMethod(method, isReadonly2, isShallow2) {
    return function(...args) {
      const target = this["__v_raw"];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const targetIsMap = isMap(rawTarget);
      const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
      const isKeyOnly = method === "keys" && targetIsMap;
      const innerIterator = target[method](...args);
      const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
      !isReadonly2 && track(
        rawTarget,
        "iterate",
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
      );
      return extend(
        // inheriting all iterator properties
        Object.create(innerIterator),
        {
          // iterator protocol
          next() {
            const { value, done } = innerIterator.next();
            return done ? { value, done } : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done
            };
          }
        }
      );
    };
  }
  function createReadonlyMethod(type) {
    return function(...args) {
      return type === "delete" ? false : type === "clear" ? void 0 : this;
    };
  }
  function createInstrumentations(readonly2, shallow) {
    const instrumentations = {
      get(key) {
        const target = this["__v_raw"];
        const rawTarget = /* @__PURE__ */ toRaw(target);
        const rawKey = /* @__PURE__ */ toRaw(key);
        if (!readonly2) {
          if (hasChanged(key, rawKey)) {
            track(rawTarget, "get", key);
          }
          track(rawTarget, "get", rawKey);
        }
        const { has } = getProto(rawTarget);
        const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
        if (has.call(rawTarget, key)) {
          return wrap(target.get(key));
        } else if (has.call(rawTarget, rawKey)) {
          return wrap(target.get(rawKey));
        } else if (target !== rawTarget) {
          target.get(key);
        }
      },
      get size() {
        const target = this["__v_raw"];
        !readonly2 && track(/* @__PURE__ */ toRaw(target), "iterate", ITERATE_KEY);
        return target.size;
      },
      has(key) {
        const target = this["__v_raw"];
        const rawTarget = /* @__PURE__ */ toRaw(target);
        const rawKey = /* @__PURE__ */ toRaw(key);
        if (!readonly2) {
          if (hasChanged(key, rawKey)) {
            track(rawTarget, "has", key);
          }
          track(rawTarget, "has", rawKey);
        }
        return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
      },
      forEach(callback, thisArg) {
        const observed = this;
        const target = observed["__v_raw"];
        const rawTarget = /* @__PURE__ */ toRaw(target);
        const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive;
        !readonly2 && track(rawTarget, "iterate", ITERATE_KEY);
        return target.forEach((value, key) => {
          return callback.call(thisArg, wrap(value), wrap(key), observed);
        });
      }
    };
    extend(
      instrumentations,
      readonly2 ? {
        add: createReadonlyMethod("add"),
        set: createReadonlyMethod("set"),
        delete: createReadonlyMethod("delete"),
        clear: createReadonlyMethod("clear")
      } : {
        add(value) {
          const target = /* @__PURE__ */ toRaw(this);
          const proto = getProto(target);
          const rawValue = /* @__PURE__ */ toRaw(value);
          const valueToAdd = !shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value) ? rawValue : value;
          const hadKey = proto.has.call(target, valueToAdd) || hasChanged(value, valueToAdd) && proto.has.call(target, value) || hasChanged(rawValue, valueToAdd) && proto.has.call(target, rawValue);
          if (!hadKey) {
            target.add(valueToAdd);
            trigger(target, "add", valueToAdd, valueToAdd);
          }
          return this;
        },
        set(key, value) {
          if (!shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
            value = /* @__PURE__ */ toRaw(value);
          }
          const target = /* @__PURE__ */ toRaw(this);
          const { has, get } = getProto(target);
          let hadKey = has.call(target, key);
          if (!hadKey) {
            key = /* @__PURE__ */ toRaw(key);
            hadKey = has.call(target, key);
          }
          const oldValue = get.call(target, key);
          target.set(key, value);
          if (!hadKey) {
            trigger(target, "add", key, value);
          } else if (hasChanged(value, oldValue)) {
            trigger(target, "set", key, value);
          }
          return this;
        },
        delete(key) {
          const target = /* @__PURE__ */ toRaw(this);
          const { has, get } = getProto(target);
          let hadKey = has.call(target, key);
          if (!hadKey) {
            key = /* @__PURE__ */ toRaw(key);
            hadKey = has.call(target, key);
          }
          get ? get.call(target, key) : void 0;
          const result = target.delete(key);
          if (hadKey) {
            trigger(target, "delete", key, void 0);
          }
          return result;
        },
        clear() {
          const target = /* @__PURE__ */ toRaw(this);
          const hadItems = target.size !== 0;
          const result = target.clear();
          if (hadItems) {
            trigger(
              target,
              "clear",
              void 0,
              void 0
            );
          }
          return result;
        }
      }
    );
    const iteratorMethods = [
      "keys",
      "values",
      "entries",
      Symbol.iterator
    ];
    iteratorMethods.forEach((method) => {
      instrumentations[method] = createIterableMethod(method, readonly2, shallow);
    });
    return instrumentations;
  }
  function createInstrumentationGetter(isReadonly2, shallow) {
    const instrumentations = createInstrumentations(isReadonly2, shallow);
    return (target, key, receiver) => {
      if (key === "__v_isReactive") {
        return !isReadonly2;
      } else if (key === "__v_isReadonly") {
        return isReadonly2;
      } else if (key === "__v_raw") {
        return target;
      }
      return Reflect.get(
        hasOwn(instrumentations, key) && key in target ? instrumentations : target,
        key,
        receiver
      );
    };
  }
  const mutableCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(false, false)
  };
  const shallowCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(false, true)
  };
  const readonlyCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(true, false)
  };
  const shallowReadonlyCollectionHandlers = {
    get: /* @__PURE__ */ createInstrumentationGetter(true, true)
  };
  const reactiveMap = /* @__PURE__ */ new WeakMap();
  const shallowReactiveMap = /* @__PURE__ */ new WeakMap();
  const readonlyMap = /* @__PURE__ */ new WeakMap();
  const shallowReadonlyMap = /* @__PURE__ */ new WeakMap();
  function targetTypeMap(rawType) {
    switch (rawType) {
      case "Object":
      case "Array":
        return 1;
      case "Map":
      case "Set":
      case "WeakMap":
      case "WeakSet":
        return 2;
      default:
        return 0;
    }
  }
  // @__NO_SIDE_EFFECTS__
  function reactive(target) {
    if (/* @__PURE__ */ isReadonly(target)) {
      return target;
    }
    return createReactiveObject(
      target,
      false,
      mutableHandlers,
      mutableCollectionHandlers,
      reactiveMap
    );
  }
  // @__NO_SIDE_EFFECTS__
  function shallowReactive(target) {
    return createReactiveObject(
      target,
      false,
      shallowReactiveHandlers,
      shallowCollectionHandlers,
      shallowReactiveMap
    );
  }
  // @__NO_SIDE_EFFECTS__
  function readonly(target) {
    return createReactiveObject(
      target,
      true,
      readonlyHandlers,
      readonlyCollectionHandlers,
      readonlyMap
    );
  }
  // @__NO_SIDE_EFFECTS__
  function shallowReadonly(target) {
    return createReactiveObject(
      target,
      true,
      shallowReadonlyHandlers,
      shallowReadonlyCollectionHandlers,
      shallowReadonlyMap
    );
  }
  function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
    if (!isObject(target)) {
      return target;
    }
    if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) {
      return target;
    }
    if (target["__v_skip"] || !Object.isExtensible(target)) {
      return target;
    }
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
      return existingProxy;
    }
    const targetType = targetTypeMap(toRawType(target));
    if (targetType === 0) {
      return target;
    }
    const proxy = new Proxy(
      target,
      targetType === 2 ? collectionHandlers : baseHandlers
    );
    proxyMap.set(target, proxy);
    return proxy;
  }
  // @__NO_SIDE_EFFECTS__
  function isReactive(value) {
    if (/* @__PURE__ */ isReadonly(value)) {
      return /* @__PURE__ */ isReactive(value["__v_raw"]);
    }
    return !!(value && value["__v_isReactive"]);
  }
  // @__NO_SIDE_EFFECTS__
  function isReadonly(value) {
    return !!(value && value["__v_isReadonly"]);
  }
  // @__NO_SIDE_EFFECTS__
  function isShallow(value) {
    return !!(value && value["__v_isShallow"]);
  }
  // @__NO_SIDE_EFFECTS__
  function isProxy(value) {
    return value ? !!value["__v_raw"] : false;
  }
  // @__NO_SIDE_EFFECTS__
  function toRaw(observed) {
    const raw = observed && observed["__v_raw"];
    return raw ? /* @__PURE__ */ toRaw(raw) : observed;
  }
  function markRaw(value) {
    if (!hasOwn(value, "__v_skip") && Object.isExtensible(value)) {
      def(value, "__v_skip", true);
    }
    return value;
  }
  const toReactive = (value) => isObject(value) ? /* @__PURE__ */ reactive(value) : value;
  const toReadonly = (value) => isObject(value) ? /* @__PURE__ */ readonly(value) : value;
  // @__NO_SIDE_EFFECTS__
  function isRef(r) {
    return r ? r["__v_isRef"] === true : false;
  }
  // @__NO_SIDE_EFFECTS__
  function ref(value) {
    return createRef(value, false);
  }
  function createRef(rawValue, shallow) {
    if (/* @__PURE__ */ isRef(rawValue)) {
      return rawValue;
    }
    return new RefImpl(rawValue, shallow);
  }
  class RefImpl {
    constructor(value, isShallow2) {
      this.dep = new Dep();
      this["__v_isRef"] = true;
      this["__v_isShallow"] = false;
      this._rawValue = isShallow2 ? value : /* @__PURE__ */ toRaw(value);
      this._value = isShallow2 ? value : toReactive(value);
      this["__v_isShallow"] = isShallow2;
    }
    get value() {
      {
        this.dep.track();
      }
      return this._value;
    }
    set value(newValue) {
      const oldValue = this._rawValue;
      const useDirectValue = this["__v_isShallow"] || /* @__PURE__ */ isShallow(newValue) || /* @__PURE__ */ isReadonly(newValue);
      newValue = useDirectValue ? newValue : /* @__PURE__ */ toRaw(newValue);
      if (hasChanged(newValue, oldValue)) {
        this._rawValue = newValue;
        this._value = useDirectValue ? newValue : toReactive(newValue);
        {
          this.dep.trigger();
        }
      }
    }
  }
  function unref(ref2) {
    return /* @__PURE__ */ isRef(ref2) ? ref2.value : ref2;
  }
  const shallowUnwrapHandlers = {
    get: (target, key, receiver) => key === "__v_raw" ? target : unref(Reflect.get(target, key, receiver)),
    set: (target, key, value, receiver) => {
      const oldValue = target[key];
      if (/* @__PURE__ */ isRef(oldValue) && !/* @__PURE__ */ isRef(value)) {
        oldValue.value = value;
        return true;
      } else {
        return Reflect.set(target, key, value, receiver);
      }
    }
  };
  function proxyRefs(objectWithRefs) {
    return /* @__PURE__ */ isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
  }
  // @__NO_SIDE_EFFECTS__
  function toRefs(object) {
    const ret = isArray(object) ? new Array(object.length) : {};
    for (const key in object) {
      ret[key] = propertyToRef(object, key);
    }
    return ret;
  }
  class ObjectRefImpl {
    constructor(_object, key, _defaultValue) {
      this._object = _object;
      this._defaultValue = _defaultValue;
      this["__v_isRef"] = true;
      this._value = void 0;
      this._key = isSymbol(key) ? key : String(key);
      this._raw = /* @__PURE__ */ toRaw(_object);
      let shallow = true;
      let obj = _object;
      if (!isArray(_object) || isSymbol(this._key) || !isIntegerKey(this._key)) {
        do {
          shallow = !/* @__PURE__ */ isProxy(obj) || /* @__PURE__ */ isShallow(obj);
        } while (shallow && (obj = obj["__v_raw"]));
      }
      this._shallow = shallow;
    }
    get value() {
      let val = this._object[this._key];
      if (this._shallow) {
        val = unref(val);
      }
      return this._value = val === void 0 ? this._defaultValue : val;
    }
    set value(newVal) {
      if (this._shallow && /* @__PURE__ */ isRef(this._raw[this._key])) {
        const nestedRef = this._object[this._key];
        if (/* @__PURE__ */ isRef(nestedRef)) {
          nestedRef.value = newVal;
          return;
        }
      }
      this._object[this._key] = newVal;
    }
    get dep() {
      return getDepFromReactive(this._raw, this._key);
    }
  }
  class GetterRefImpl {
    constructor(_getter) {
      this._getter = _getter;
      this["__v_isRef"] = true;
      this["__v_isReadonly"] = true;
      this._value = void 0;
    }
    get value() {
      return this._value = this._getter();
    }
  }
  // @__NO_SIDE_EFFECTS__
  function toRef(source, key, defaultValue) {
    if (/* @__PURE__ */ isRef(source)) {
      return source;
    } else if (isFunction(source)) {
      return new GetterRefImpl(source);
    } else if (isObject(source) && arguments.length > 1) {
      return propertyToRef(source, key, defaultValue);
    } else {
      return /* @__PURE__ */ ref(source);
    }
  }
  function propertyToRef(source, key, defaultValue) {
    return new ObjectRefImpl(source, key, defaultValue);
  }
  class ComputedRefImpl {
    constructor(fn, setter, isSSR) {
      this.fn = fn;
      this.setter = setter;
      this._value = void 0;
      this.dep = new Dep(this);
      this.__v_isRef = true;
      this.deps = void 0;
      this.depsTail = void 0;
      this.flags = 16;
      this.globalVersion = globalVersion - 1;
      this.next = void 0;
      this.effect = this;
      this["__v_isReadonly"] = !setter;
      this.isSSR = isSSR;
    }
    /**
     * @internal
     */
    notify() {
      this.flags |= 16;
      if (!(this.flags & 8) && // avoid infinite self recursion
      activeSub !== this) {
        batch(this, true);
        return true;
      }
    }
    get value() {
      const link = this.dep.track();
      refreshComputed(this);
      if (link) {
        link.version = this.dep.version;
      }
      return this._value;
    }
    set value(newValue) {
      if (this.setter) {
        this.setter(newValue);
      }
    }
  }
  // @__NO_SIDE_EFFECTS__
  function computed$1(getterOrOptions, debugOptions, isSSR = false) {
    let getter;
    let setter;
    if (isFunction(getterOrOptions)) {
      getter = getterOrOptions;
    } else {
      getter = getterOrOptions.get;
      setter = getterOrOptions.set;
    }
    const cRef = new ComputedRefImpl(getter, setter, isSSR);
    return cRef;
  }
  const INITIAL_WATCHER_VALUE = {};
  const cleanupMap = /* @__PURE__ */ new WeakMap();
  let activeWatcher = void 0;
  function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
    if (owner) {
      let cleanups = cleanupMap.get(owner);
      if (!cleanups) cleanupMap.set(owner, cleanups = []);
      cleanups.push(cleanupFn);
    }
  }
  function watch$1(source, cb, options = EMPTY_OBJ) {
    const { immediate, deep, once, scheduler, augmentJob, call } = options;
    const reactiveGetter = (source2) => {
      if (deep) return source2;
      if (/* @__PURE__ */ isShallow(source2) || deep === false || deep === 0)
        return traverse(source2, 1);
      return traverse(source2);
    };
    let effect2;
    let getter;
    let cleanup;
    let boundCleanup;
    let forceTrigger = false;
    let isMultiSource = false;
    if (/* @__PURE__ */ isRef(source)) {
      getter = () => source.value;
      forceTrigger = /* @__PURE__ */ isShallow(source);
    } else if (/* @__PURE__ */ isReactive(source)) {
      getter = () => reactiveGetter(source);
      forceTrigger = true;
    } else if (isArray(source)) {
      isMultiSource = true;
      forceTrigger = source.some((s) => /* @__PURE__ */ isReactive(s) || /* @__PURE__ */ isShallow(s));
      getter = () => source.map((s) => {
        if (/* @__PURE__ */ isRef(s)) {
          return s.value;
        } else if (/* @__PURE__ */ isReactive(s)) {
          return reactiveGetter(s);
        } else if (isFunction(s)) {
          return call ? call(s, 2) : s();
        } else ;
      });
    } else if (isFunction(source)) {
      if (cb) {
        getter = call ? () => call(source, 2) : source;
      } else {
        getter = () => {
          if (cleanup) {
            pauseTracking();
            try {
              cleanup();
            } finally {
              resetTracking();
            }
          }
          const currentEffect = activeWatcher;
          activeWatcher = effect2;
          try {
            return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
          } finally {
            activeWatcher = currentEffect;
          }
        };
      }
    } else {
      getter = NOOP;
    }
    if (cb && deep) {
      const baseGetter = getter;
      const depth = deep === true ? Infinity : deep;
      getter = () => traverse(baseGetter(), depth);
    }
    const scope = getCurrentScope();
    const watchHandle = () => {
      effect2.stop();
      if (scope && scope.active) {
        remove(scope.effects, effect2);
      }
    };
    if (once && cb) {
      const _cb = cb;
      cb = (...args) => {
        _cb(...args);
        watchHandle();
      };
    }
    let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
    const job = (immediateFirstRun) => {
      if (!(effect2.flags & 1) || !effect2.dirty && !immediateFirstRun) {
        return;
      }
      if (cb) {
        const newValue = effect2.run();
        if (deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue))) {
          if (cleanup) {
            cleanup();
          }
          const currentWatcher = activeWatcher;
          activeWatcher = effect2;
          try {
            const args = [
              newValue,
              // pass undefined as the old value when it's changed for the first time
              oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
              boundCleanup
            ];
            oldValue = newValue;
            call ? call(cb, 3, args) : (
              // @ts-expect-error
              cb(...args)
            );
          } finally {
            activeWatcher = currentWatcher;
          }
        }
      } else {
        effect2.run();
      }
    };
    if (augmentJob) {
      augmentJob(job);
    }
    effect2 = new ReactiveEffect(getter);
    effect2.scheduler = scheduler ? () => scheduler(job, false) : job;
    boundCleanup = (fn) => onWatcherCleanup(fn, false, effect2);
    cleanup = effect2.onStop = () => {
      const cleanups = cleanupMap.get(effect2);
      if (cleanups) {
        if (call) {
          call(cleanups, 4);
        } else {
          for (const cleanup2 of cleanups) cleanup2();
        }
        cleanupMap.delete(effect2);
      }
    };
    if (cb) {
      if (immediate) {
        job(true);
      } else {
        oldValue = effect2.run();
      }
    } else if (scheduler) {
      scheduler(job.bind(null, true), true);
    } else {
      effect2.run();
    }
    watchHandle.pause = effect2.pause.bind(effect2);
    watchHandle.resume = effect2.resume.bind(effect2);
    watchHandle.stop = watchHandle;
    return watchHandle;
  }
  function traverse(value, depth = Infinity, seen) {
    if (depth <= 0 || !isObject(value) || value["__v_skip"]) {
      return value;
    }
    seen = seen || /* @__PURE__ */ new Map();
    if ((seen.get(value) || 0) >= depth) {
      return value;
    }
    seen.set(value, depth);
    depth--;
    if (/* @__PURE__ */ isRef(value)) {
      traverse(value.value, depth, seen);
    } else if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        traverse(value[i], depth, seen);
      }
    } else if (isSet(value) || isMap(value)) {
      value.forEach((v) => {
        traverse(v, depth, seen);
      });
    } else if (isPlainObject$1(value)) {
      for (const key in value) {
        traverse(value[key], depth, seen);
      }
      for (const key of Object.getOwnPropertySymbols(value)) {
        if (Object.prototype.propertyIsEnumerable.call(value, key)) {
          traverse(value[key], depth, seen);
        }
      }
    }
    return value;
  }
  /**
  * @vue/runtime-core v3.5.35
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  const stack = [];
  let isWarning = false;
  function warn$1(msg, ...args) {
    if (isWarning) return;
    isWarning = true;
    pauseTracking();
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
            var _a2, _b;
            return (_b = (_a2 = a.toString) == null ? void 0 : _a2.call(a)) != null ? _b : JSON.stringify(a);
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
    resetTracking();
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
    } else if (/* @__PURE__ */ isRef(value)) {
      value = formatProp(key, /* @__PURE__ */ toRaw(value.value), true);
      return raw ? value : [`${key}=Ref<`, value, `>`];
    } else if (isFunction(value)) {
      return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
    } else {
      value = /* @__PURE__ */ toRaw(value);
      return raw ? value : [`${key}=`, value];
    }
  }
  function callWithErrorHandling(fn, instance, type, args) {
    try {
      return args ? fn(...args) : fn();
    } catch (err) {
      handleError(err, instance, type);
    }
  }
  function callWithAsyncErrorHandling(fn, instance, type, args) {
    if (isFunction(fn)) {
      const res = callWithErrorHandling(fn, instance, type, args);
      if (res && isPromise(res)) {
        res.catch((err) => {
          handleError(err, instance, type);
        });
      }
      return res;
    }
    if (isArray(fn)) {
      const values = [];
      for (let i = 0; i < fn.length; i++) {
        values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
      }
      return values;
    }
  }
  function handleError(err, instance, type, throwInDev = true) {
    const contextVNode = instance ? instance.vnode : null;
    const { errorHandler, throwUnhandledErrorInProduction } = instance && instance.appContext.config || EMPTY_OBJ;
    if (instance) {
      let cur = instance.parent;
      const exposedInstance = instance.proxy;
      const errorInfo = `https://vuejs.org/error-reference/#runtime-${type}`;
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
        pauseTracking();
        callWithErrorHandling(errorHandler, null, 10, [
          err,
          exposedInstance,
          errorInfo
        ]);
        resetTracking();
        return;
      }
    }
    logError(err, type, contextVNode, throwInDev, throwUnhandledErrorInProduction);
  }
  function logError(err, type, contextVNode, throwInDev = true, throwInProd = false) {
    if (throwInProd) {
      throw err;
    } else {
      console.error(err);
    }
  }
  const queue = [];
  let flushIndex = -1;
  const pendingPostFlushCbs = [];
  let activePostFlushCbs = null;
  let postFlushIndex = 0;
  const resolvedPromise = /* @__PURE__ */ Promise.resolve();
  let currentFlushPromise = null;
  function nextTick(fn) {
    const p2 = currentFlushPromise || resolvedPromise;
    return fn ? p2.then(this ? fn.bind(this) : fn) : p2;
  }
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
  function flushPreFlushCbs(instance, seen, i = flushIndex + 1) {
    for (; i < queue.length; i++) {
      const cb = queue[i];
      if (cb && cb.flags & 2) {
        if (instance && cb.id !== instance.uid) {
          continue;
        }
        queue.splice(i, 1);
        i--;
        if (cb.flags & 4) {
          cb.flags &= -2;
        }
        cb();
        if (!(cb.flags & 4)) {
          cb.flags &= -2;
        }
      }
    }
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
      for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
        const cb = activePostFlushCbs[postFlushIndex];
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
    try {
      for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
        const job = queue[flushIndex];
        if (job && !(job.flags & 8)) {
          if (false) ;
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
      flushPostFlushCbs();
      currentFlushPromise = null;
      if (queue.length || pendingPostFlushCbs.length) {
        flushJobs();
      }
    }
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
      return res;
    };
    renderFnWithContext._n = true;
    renderFnWithContext._c = true;
    renderFnWithContext._d = true;
    return renderFnWithContext;
  }
  function withDirectives(vnode, directives) {
    if (currentRenderingInstance === null) {
      return vnode;
    }
    const instance = getComponentPublicInstance(currentRenderingInstance);
    const bindings = vnode.dirs || (vnode.dirs = []);
    for (let i = 0; i < directives.length; i++) {
      let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i];
      if (dir) {
        if (isFunction(dir)) {
          dir = {
            mounted: dir,
            updated: dir
          };
        }
        if (dir.deep) {
          traverse(value);
        }
        bindings.push({
          dir,
          instance,
          value,
          oldValue: void 0,
          arg,
          modifiers
        });
      }
    }
    return vnode;
  }
  function invokeDirectiveHook(vnode, prevVNode, instance, name) {
    const bindings = vnode.dirs;
    const oldBindings = prevVNode && prevVNode.dirs;
    for (let i = 0; i < bindings.length; i++) {
      const binding = bindings[i];
      if (oldBindings) {
        binding.oldValue = oldBindings[i].value;
      }
      let hook = binding.dir[name];
      if (hook) {
        pauseTracking();
        callWithAsyncErrorHandling(hook, instance, 8, [
          vnode.el,
          binding,
          vnode,
          prevVNode
        ]);
        resetTracking();
      }
    }
  }
  function provide(key, value) {
    if (currentInstance) {
      let provides = currentInstance.provides;
      const parentProvides = currentInstance.parent && currentInstance.parent.provides;
      if (parentProvides === provides) {
        provides = currentInstance.provides = Object.create(parentProvides);
      }
      provides[key] = value;
    }
  }
  function inject(key, defaultValue, treatDefaultAsFactory = false) {
    const instance = getCurrentInstance();
    if (instance || currentApp) {
      let provides = currentApp ? currentApp._context.provides : instance ? instance.parent == null || instance.ce ? instance.vnode.appContext && instance.vnode.appContext.provides : instance.parent.provides : void 0;
      if (provides && key in provides) {
        return provides[key];
      } else if (arguments.length > 1) {
        return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
      } else ;
    }
  }
  function hasInjectionContext() {
    return !!(getCurrentInstance() || currentApp);
  }
  const ssrContextKey = /* @__PURE__ */ Symbol.for("v-scx");
  const useSSRContext = () => {
    {
      const ctx = inject(ssrContextKey);
      return ctx;
    }
  };
  function watch(source, cb, options) {
    return doWatch(source, cb, options);
  }
  function doWatch(source, cb, options = EMPTY_OBJ) {
    const { immediate, deep, flush, once } = options;
    const baseWatchOptions = extend({}, options);
    const runsImmediately = cb && immediate || !cb && flush !== "post";
    let ssrCleanup;
    if (isInSSRComponentSetup) {
      if (flush === "sync") {
        const ctx = useSSRContext();
        ssrCleanup = ctx.__watcherHandles || (ctx.__watcherHandles = []);
      } else if (!runsImmediately) {
        const watchStopHandle = () => {
        };
        watchStopHandle.stop = NOOP;
        watchStopHandle.resume = NOOP;
        watchStopHandle.pause = NOOP;
        return watchStopHandle;
      }
    }
    const instance = currentInstance;
    baseWatchOptions.call = (fn, type, args) => callWithAsyncErrorHandling(fn, instance, type, args);
    let isPre = false;
    if (flush === "post") {
      baseWatchOptions.scheduler = (job) => {
        queuePostRenderEffect(job, instance && instance.suspense);
      };
    } else if (flush !== "sync") {
      isPre = true;
      baseWatchOptions.scheduler = (job, isFirstRun) => {
        if (isFirstRun) {
          job();
        } else {
          queueJob(job);
        }
      };
    }
    baseWatchOptions.augmentJob = (job) => {
      if (cb) {
        job.flags |= 4;
      }
      if (isPre) {
        job.flags |= 2;
        if (instance) {
          job.id = instance.uid;
          job.i = instance;
        }
      }
    };
    const watchHandle = watch$1(source, cb, baseWatchOptions);
    if (isInSSRComponentSetup) {
      if (ssrCleanup) {
        ssrCleanup.push(watchHandle);
      } else if (runsImmediately) {
        watchHandle();
      }
    }
    return watchHandle;
  }
  function instanceWatch(source, value, options) {
    const publicThis = this.proxy;
    const getter = isString(source) ? source.includes(".") ? createPathGetter(publicThis, source) : () => publicThis[source] : source.bind(publicThis, publicThis);
    let cb;
    if (isFunction(value)) {
      cb = value;
    } else {
      cb = value.handler;
      options = value;
    }
    const reset = setCurrentInstance(this);
    const res = doWatch(getter, cb.bind(publicThis), options);
    reset();
    return res;
  }
  function createPathGetter(ctx, path) {
    const segments = path.split(".");
    return () => {
      let cur = ctx;
      for (let i = 0; i < segments.length && cur; i++) {
        cur = cur[segments[i]];
      }
      return cur;
    };
  }
  const pendingMounts = /* @__PURE__ */ new WeakMap();
  const TeleportEndKey = /* @__PURE__ */ Symbol("_vte");
  const isTeleport = (type) => type.__isTeleport;
  const isTeleportDisabled = (props) => props && (props.disabled || props.disabled === "");
  const isTeleportDeferred = (props) => props && (props.defer || props.defer === "");
  const isTargetSVG = (target) => typeof SVGElement !== "undefined" && target instanceof SVGElement;
  const isTargetMathML = (target) => typeof MathMLElement === "function" && target instanceof MathMLElement;
  const resolveTarget = (props, select) => {
    const targetSelector = props && props.to;
    if (isString(targetSelector)) {
      if (!select) {
        return null;
      } else {
        const target = select(targetSelector);
        return target;
      }
    } else {
      return targetSelector;
    }
  };
  const TeleportImpl = {
    name: "Teleport",
    __isTeleport: true,
    process(n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, internals) {
      const {
        mc: mountChildren,
        pc: patchChildren,
        pbc: patchBlockChildren,
        o: { insert, querySelector, createText, createComment, parentNode }
      } = internals;
      const disabled = isTeleportDisabled(n2.props);
      let { dynamicChildren } = n2;
      const mount2 = (vnode, container2, anchor2) => {
        if (vnode.shapeFlag & 16) {
          mountChildren(
            vnode.children,
            container2,
            anchor2,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        }
      };
      const mountToTarget = (vnode = n2) => {
        const disabled2 = isTeleportDisabled(vnode.props);
        const target = vnode.target = resolveTarget(vnode.props, querySelector);
        const targetAnchor = prepareAnchor(target, vnode, createText, insert);
        if (target) {
          if (namespace !== "svg" && isTargetSVG(target)) {
            namespace = "svg";
          } else if (namespace !== "mathml" && isTargetMathML(target)) {
            namespace = "mathml";
          }
          if (parentComponent && parentComponent.isCE) {
            (parentComponent.ce._teleportTargets || (parentComponent.ce._teleportTargets = /* @__PURE__ */ new Set())).add(target);
          }
          if (!disabled2) {
            mount2(vnode, target, targetAnchor);
            updateCssVars(vnode, false);
          }
        }
      };
      const queuePendingMount = (vnode) => {
        const mountJob = () => {
          if (pendingMounts.get(vnode) !== mountJob) return;
          pendingMounts.delete(vnode);
          if (isTeleportDisabled(vnode.props)) {
            const mountContainer = parentNode(vnode.el) || container;
            mount2(vnode, mountContainer, vnode.anchor);
            updateCssVars(vnode, true);
          }
          mountToTarget(vnode);
        };
        pendingMounts.set(vnode, mountJob);
        queuePostRenderEffect(mountJob, parentSuspense);
      };
      if (n1 == null) {
        const placeholder = n2.el = createText("");
        const mainAnchor = n2.anchor = createText("");
        insert(placeholder, container, anchor);
        insert(mainAnchor, container, anchor);
        if (isTeleportDeferred(n2.props) || parentSuspense && parentSuspense.pendingBranch) {
          queuePendingMount(n2);
          return;
        }
        if (disabled) {
          mount2(n2, container, mainAnchor);
          updateCssVars(n2, true);
        }
        mountToTarget();
      } else {
        n2.el = n1.el;
        const mainAnchor = n2.anchor = n1.anchor;
        const pendingMount = pendingMounts.get(n1);
        if (pendingMount) {
          pendingMount.flags |= 8;
          pendingMounts.delete(n1);
          queuePendingMount(n2);
          return;
        }
        n2.targetStart = n1.targetStart;
        const target = n2.target = n1.target;
        const targetAnchor = n2.targetAnchor = n1.targetAnchor;
        const wasDisabled = isTeleportDisabled(n1.props);
        const currentContainer = wasDisabled ? container : target;
        const currentAnchor = wasDisabled ? mainAnchor : targetAnchor;
        if (namespace === "svg" || isTargetSVG(target)) {
          namespace = "svg";
        } else if (namespace === "mathml" || isTargetMathML(target)) {
          namespace = "mathml";
        }
        if (dynamicChildren) {
          patchBlockChildren(
            n1.dynamicChildren,
            dynamicChildren,
            currentContainer,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds
          );
          traverseStaticChildren(n1, n2, true);
        } else if (!optimized) {
          patchChildren(
            n1,
            n2,
            currentContainer,
            currentAnchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            false
          );
        }
        if (disabled) {
          if (!wasDisabled) {
            moveTeleport(
              n2,
              container,
              mainAnchor,
              internals,
              1
            );
          } else {
            if (n2.props && n1.props && n2.props.to !== n1.props.to) {
              n2.props.to = n1.props.to;
            }
          }
        } else {
          if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
            const nextTarget = n2.target = resolveTarget(
              n2.props,
              querySelector
            );
            if (nextTarget) {
              moveTeleport(
                n2,
                nextTarget,
                null,
                internals,
                0
              );
            }
          } else if (wasDisabled) {
            moveTeleport(
              n2,
              target,
              targetAnchor,
              internals,
              1
            );
          }
        }
        updateCssVars(n2, disabled);
      }
    },
    remove(vnode, parentComponent, parentSuspense, { um: unmount2, o: { remove: hostRemove } }, doRemove) {
      const {
        shapeFlag,
        children,
        anchor,
        targetStart,
        targetAnchor,
        target,
        props
      } = vnode;
      const shouldRemove = doRemove || !isTeleportDisabled(props);
      const pendingMount = pendingMounts.get(vnode);
      if (pendingMount) {
        pendingMount.flags |= 8;
        pendingMounts.delete(vnode);
      }
      if (target) {
        hostRemove(targetStart);
        hostRemove(targetAnchor);
      }
      doRemove && hostRemove(anchor);
      if (!pendingMount && shapeFlag & 16) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          unmount2(
            child,
            parentComponent,
            parentSuspense,
            shouldRemove,
            !!child.dynamicChildren
          );
        }
      }
    },
    move: moveTeleport,
    hydrate: hydrateTeleport
  };
  function moveTeleport(vnode, container, parentAnchor, { o: { insert }, m: move }, moveType = 2) {
    if (moveType === 0) {
      insert(vnode.targetAnchor, container, parentAnchor);
    }
    const { el, anchor, shapeFlag, children, props } = vnode;
    const isReorder = moveType === 2;
    if (isReorder) {
      insert(el, container, parentAnchor);
    }
    if (!pendingMounts.has(vnode) && (!isReorder || isTeleportDisabled(props))) {
      if (shapeFlag & 16) {
        for (let i = 0; i < children.length; i++) {
          move(
            children[i],
            container,
            parentAnchor,
            2
          );
        }
      }
    }
    if (isReorder) {
      insert(anchor, container, parentAnchor);
    }
  }
  function hydrateTeleport(node, vnode, parentComponent, parentSuspense, slotScopeIds, optimized, {
    o: { nextSibling, parentNode, querySelector, insert, createText }
  }, hydrateChildren) {
    function hydrateAnchor(target2, targetNode) {
      let targetAnchor = targetNode;
      while (targetAnchor) {
        if (targetAnchor && targetAnchor.nodeType === 8) {
          if (targetAnchor.data === "teleport start anchor") {
            vnode.targetStart = targetAnchor;
          } else if (targetAnchor.data === "teleport anchor") {
            vnode.targetAnchor = targetAnchor;
            target2._lpa = vnode.targetAnchor && nextSibling(vnode.targetAnchor);
            break;
          }
        }
        targetAnchor = nextSibling(targetAnchor);
      }
    }
    function hydrateDisabledTeleport(node2, vnode2) {
      vnode2.anchor = hydrateChildren(
        nextSibling(node2),
        vnode2,
        parentNode(node2),
        parentComponent,
        parentSuspense,
        slotScopeIds,
        optimized
      );
    }
    const target = vnode.target = resolveTarget(
      vnode.props,
      querySelector
    );
    const disabled = isTeleportDisabled(vnode.props);
    if (target) {
      const targetNode = target._lpa || target.firstChild;
      if (vnode.shapeFlag & 16) {
        if (disabled) {
          hydrateDisabledTeleport(node, vnode);
          hydrateAnchor(target, targetNode);
          if (!vnode.targetAnchor) {
            prepareAnchor(
              target,
              vnode,
              createText,
              insert,
              // if target is the same as the main view, insert anchors before current node
              // to avoid hydrating mismatch
              parentNode(node) === target ? node : null
            );
          }
        } else {
          vnode.anchor = nextSibling(node);
          hydrateAnchor(target, targetNode);
          if (!vnode.targetAnchor) {
            prepareAnchor(target, vnode, createText, insert);
          }
          hydrateChildren(
            targetNode && nextSibling(targetNode),
            vnode,
            target,
            parentComponent,
            parentSuspense,
            slotScopeIds,
            optimized
          );
        }
      }
      updateCssVars(vnode, disabled);
    } else if (disabled) {
      if (vnode.shapeFlag & 16) {
        hydrateDisabledTeleport(node, vnode);
        vnode.targetStart = node;
        vnode.targetAnchor = nextSibling(node);
      }
    }
    return vnode.anchor && nextSibling(vnode.anchor);
  }
  const Teleport = TeleportImpl;
  function updateCssVars(vnode, isDisabled) {
    const ctx = vnode.ctx;
    if (ctx && ctx.ut) {
      let node, anchor;
      if (isDisabled) {
        node = vnode.el;
        anchor = vnode.anchor;
      } else {
        node = vnode.targetStart;
        anchor = vnode.targetAnchor;
      }
      while (node && node !== anchor) {
        if (node.nodeType === 1) node.setAttribute("data-v-owner", ctx.uid);
        node = node.nextSibling;
      }
      ctx.ut();
    }
  }
  function prepareAnchor(target, vnode, createText, insert, anchor = null) {
    const targetStart = vnode.targetStart = createText("");
    const targetAnchor = vnode.targetAnchor = createText("");
    targetStart[TeleportEndKey] = targetAnchor;
    if (target) {
      insert(targetStart, target, anchor);
      insert(targetAnchor, target, anchor);
    }
    return targetAnchor;
  }
  const leaveCbKey = /* @__PURE__ */ Symbol("_leaveCb");
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
  // @__NO_SIDE_EFFECTS__
  function defineComponent(options, extraOptions) {
    return isFunction(options) ? (
      // #8236: extend call and options.name access are considered side-effects
      // by Rollup, so we have to wrap it in a pure-annotated IIFE.
      /* @__PURE__ */ (() => extend({ name: options.name }, extraOptions, { setup: options }))()
    ) : options;
  }
  function markAsyncBoundary(instance) {
    instance.ids = [instance.ids[0] + instance.ids[2]++ + "-", 0, 0];
  }
  function isTemplateRefKey(refs, key) {
    let desc;
    return !!((desc = Object.getOwnPropertyDescriptor(refs, key)) && !desc.configurable);
  }
  const pendingSetRefMap = /* @__PURE__ */ new WeakMap();
  function setRef(rawRef, oldRawRef, parentSuspense, vnode, isUnmount = false) {
    if (isArray(rawRef)) {
      rawRef.forEach(
        (r, i) => setRef(
          r,
          oldRawRef && (isArray(oldRawRef) ? oldRawRef[i] : oldRawRef),
          parentSuspense,
          vnode,
          isUnmount
        )
      );
      return;
    }
    if (isAsyncWrapper(vnode) && !isUnmount) {
      if (vnode.shapeFlag & 512 && vnode.type.__asyncResolved && vnode.component.subTree.component) {
        setRef(rawRef, oldRawRef, parentSuspense, vnode.component.subTree);
      }
      return;
    }
    const refValue = vnode.shapeFlag & 4 ? getComponentPublicInstance(vnode.component) : vnode.el;
    const value = isUnmount ? null : refValue;
    const { i: owner, r: ref3 } = rawRef;
    const oldRef = oldRawRef && oldRawRef.r;
    const refs = owner.refs === EMPTY_OBJ ? owner.refs = {} : owner.refs;
    const setupState = owner.setupState;
    const rawSetupState = /* @__PURE__ */ toRaw(setupState);
    const canSetSetupRef = setupState === EMPTY_OBJ ? NO : (key) => {
      if (isTemplateRefKey(refs, key)) {
        return false;
      }
      return hasOwn(rawSetupState, key);
    };
    const canSetRef = (ref22, key) => {
      if (key && isTemplateRefKey(refs, key)) {
        return false;
      }
      return true;
    };
    if (oldRef != null && oldRef !== ref3) {
      invalidatePendingSetRef(oldRawRef);
      if (isString(oldRef)) {
        refs[oldRef] = null;
        if (canSetSetupRef(oldRef)) {
          setupState[oldRef] = null;
        }
      } else if (/* @__PURE__ */ isRef(oldRef)) {
        const oldRawRefAtom = oldRawRef;
        if (canSetRef(oldRef, oldRawRefAtom.k)) {
          oldRef.value = null;
        }
        if (oldRawRefAtom.k) refs[oldRawRefAtom.k] = null;
      }
    }
    if (isFunction(ref3)) {
      callWithErrorHandling(ref3, owner, 12, [value, refs]);
    } else {
      const _isString = isString(ref3);
      const _isRef = /* @__PURE__ */ isRef(ref3);
      if (_isString || _isRef) {
        const doSet = () => {
          if (rawRef.f) {
            const existing = _isString ? canSetSetupRef(ref3) ? setupState[ref3] : refs[ref3] : canSetRef() || !rawRef.k ? ref3.value : refs[rawRef.k];
            if (isUnmount) {
              isArray(existing) && remove(existing, refValue);
            } else {
              if (!isArray(existing)) {
                if (_isString) {
                  refs[ref3] = [refValue];
                  if (canSetSetupRef(ref3)) {
                    setupState[ref3] = refs[ref3];
                  }
                } else {
                  const newVal = [refValue];
                  if (canSetRef(ref3, rawRef.k)) {
                    ref3.value = newVal;
                  }
                  if (rawRef.k) refs[rawRef.k] = newVal;
                }
              } else if (!existing.includes(refValue)) {
                existing.push(refValue);
              }
            }
          } else if (_isString) {
            refs[ref3] = value;
            if (canSetSetupRef(ref3)) {
              setupState[ref3] = value;
            }
          } else if (_isRef) {
            if (canSetRef(ref3, rawRef.k)) {
              ref3.value = value;
            }
            if (rawRef.k) refs[rawRef.k] = value;
          } else ;
        };
        if (value) {
          const job = () => {
            doSet();
            pendingSetRefMap.delete(rawRef);
          };
          job.id = -1;
          pendingSetRefMap.set(rawRef, job);
          queuePostRenderEffect(job, parentSuspense);
        } else {
          invalidatePendingSetRef(rawRef);
          doSet();
        }
      }
    }
  }
  function invalidatePendingSetRef(rawRef) {
    const pendingSetRef = pendingSetRefMap.get(rawRef);
    if (pendingSetRef) {
      pendingSetRef.flags |= 8;
      pendingSetRefMap.delete(rawRef);
    }
  }
  getGlobalThis().requestIdleCallback || ((cb) => setTimeout(cb, 1));
  getGlobalThis().cancelIdleCallback || ((id) => clearTimeout(id));
  const isAsyncWrapper = (i) => !!i.type.__asyncLoader;
  const isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
  function onActivated(hook, target) {
    registerKeepAliveHook(hook, "a", target);
  }
  function onDeactivated(hook, target) {
    registerKeepAliveHook(hook, "da", target);
  }
  function registerKeepAliveHook(hook, type, target = currentInstance) {
    const wrappedHook = hook.__wdc || (hook.__wdc = () => {
      let current = target;
      while (current) {
        if (current.isDeactivated) {
          return;
        }
        current = current.parent;
      }
      return hook();
    });
    injectHook(type, wrappedHook, target);
    if (target) {
      let current = target.parent;
      while (current && current.parent) {
        if (isKeepAlive(current.parent.vnode)) {
          injectToKeepAliveRoot(wrappedHook, type, target, current);
        }
        current = current.parent;
      }
    }
  }
  function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
    const injected = injectHook(
      type,
      hook,
      keepAliveRoot,
      true
      /* prepend */
    );
    onUnmounted(() => {
      remove(keepAliveRoot[type], injected);
    }, target);
  }
  function injectHook(type, hook, target = currentInstance, prepend = false) {
    if (target) {
      const hooks = target[type] || (target[type] = []);
      const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
        pauseTracking();
        const reset = setCurrentInstance(target);
        const res = callWithAsyncErrorHandling(hook, target, type, args);
        reset();
        resetTracking();
        return res;
      });
      if (prepend) {
        hooks.unshift(wrappedHook);
      } else {
        hooks.push(wrappedHook);
      }
      return wrappedHook;
    }
  }
  const createHook = (lifecycle) => (hook, target = currentInstance) => {
    if (!isInSSRComponentSetup || lifecycle === "sp") {
      injectHook(lifecycle, (...args) => hook(...args), target);
    }
  };
  const onBeforeMount = createHook("bm");
  const onMounted = createHook("m");
  const onBeforeUpdate = createHook(
    "bu"
  );
  const onUpdated = createHook("u");
  const onBeforeUnmount = createHook(
    "bum"
  );
  const onUnmounted = createHook("um");
  const onServerPrefetch = createHook(
    "sp"
  );
  const onRenderTriggered = createHook("rtg");
  const onRenderTracked = createHook("rtc");
  function onErrorCaptured(hook, target = currentInstance) {
    injectHook("ec", hook, target);
  }
  const COMPONENTS = "components";
  const NULL_DYNAMIC_COMPONENT = /* @__PURE__ */ Symbol.for("v-ndc");
  function resolveDynamicComponent(component) {
    if (isString(component)) {
      return resolveAsset(COMPONENTS, component, false) || component;
    } else {
      return component || NULL_DYNAMIC_COMPONENT;
    }
  }
  function resolveAsset(type, name, warnMissing = true, maybeSelfReference = false) {
    const instance = currentRenderingInstance || currentInstance;
    if (instance) {
      const Component = instance.type;
      {
        const selfName = getComponentName(
          Component,
          false
        );
        if (selfName && (selfName === name || selfName === camelize(name) || selfName === capitalize(camelize(name)))) {
          return Component;
        }
      }
      const res = (
        // local registration
        // check instance[type] first which is resolved for options API
        resolve(instance[type] || Component[type], name) || // global registration
        resolve(instance.appContext[type], name)
      );
      if (!res && maybeSelfReference) {
        return Component;
      }
      return res;
    }
  }
  function resolve(registry, name) {
    return registry && (registry[name] || registry[camelize(name)] || registry[capitalize(camelize(name))]);
  }
  function renderList(source, renderItem, cache, index) {
    let ret;
    const cached = cache;
    const sourceIsArray = isArray(source);
    if (sourceIsArray || isString(source)) {
      const sourceIsReactiveArray = sourceIsArray && /* @__PURE__ */ isReactive(source);
      let needsWrap = false;
      let isReadonlySource = false;
      if (sourceIsReactiveArray) {
        needsWrap = !/* @__PURE__ */ isShallow(source);
        isReadonlySource = /* @__PURE__ */ isReadonly(source);
        source = shallowReadArray(source);
      }
      ret = new Array(source.length);
      for (let i = 0, l = source.length; i < l; i++) {
        ret[i] = renderItem(
          needsWrap ? isReadonlySource ? toReadonly(toReactive(source[i])) : toReactive(source[i]) : source[i],
          i,
          void 0,
          cached
        );
      }
    } else if (typeof source === "number") {
      {
        ret = new Array(source);
        for (let i = 0; i < source; i++) {
          ret[i] = renderItem(i + 1, i, void 0, cached);
        }
      }
    } else if (isObject(source)) {
      if (source[Symbol.iterator]) {
        ret = Array.from(
          source,
          (item, i) => renderItem(item, i, void 0, cached)
        );
      } else {
        const keys = Object.keys(source);
        ret = new Array(keys.length);
        for (let i = 0, l = keys.length; i < l; i++) {
          const key = keys[i];
          ret[i] = renderItem(source[key], key, i, cached);
        }
      }
    } else {
      ret = [];
    }
    return ret;
  }
  function renderSlot(slots, name, props = {}, fallback, noSlotted) {
    if (currentRenderingInstance.ce || currentRenderingInstance.parent && isAsyncWrapper(currentRenderingInstance.parent) && currentRenderingInstance.parent.ce) {
      const hasProps = Object.keys(props).length > 0;
      return openBlock(), createBlock(
        Fragment,
        null,
        [createVNode("slot", props, fallback)],
        hasProps ? -2 : 64
      );
    }
    let slot = slots[name];
    if (slot && slot._c) {
      slot._d = false;
    }
    openBlock();
    const validSlotContent = slot && ensureValidVNode(slot(props));
    const slotKey = props.key || // slot content array of a dynamic conditional slot may have a branch
    // key attached in the `createSlots` helper, respect that
    validSlotContent && validSlotContent.key;
    const rendered = createBlock(
      Fragment,
      {
        key: (slotKey && !isSymbol(slotKey) ? slotKey : `_${name}`) + // #7256 force differentiate fallback content from actual content
        (!validSlotContent && fallback ? "_fb" : "")
      },
      validSlotContent || [],
      validSlotContent && slots._ === 1 ? 64 : -2
    );
    if (rendered.scopeId) {
      rendered.slotScopeIds = [rendered.scopeId + "-s"];
    }
    if (slot && slot._c) {
      slot._d = true;
    }
    return rendered;
  }
  function ensureValidVNode(vnodes) {
    return vnodes.some((child) => {
      if (!isVNode(child)) return true;
      if (child.type === Comment) return false;
      if (child.type === Fragment && !ensureValidVNode(child.children))
        return false;
      return true;
    }) ? vnodes : null;
  }
  const getPublicInstance = (i) => {
    if (!i) return null;
    if (isStatefulComponent(i)) return getComponentPublicInstance(i);
    return getPublicInstance(i.parent);
  };
  const publicPropertiesMap = (
    // Move PURE marker to new line to workaround compiler discarding it
    // due to type annotation
    /* @__PURE__ */ extend(/* @__PURE__ */ Object.create(null), {
      $: (i) => i,
      $el: (i) => i.vnode.el,
      $data: (i) => i.data,
      $props: (i) => i.props,
      $attrs: (i) => i.attrs,
      $slots: (i) => i.slots,
      $refs: (i) => i.refs,
      $parent: (i) => getPublicInstance(i.parent),
      $root: (i) => getPublicInstance(i.root),
      $host: (i) => i.ce,
      $emit: (i) => i.emit,
      $options: (i) => resolveMergedOptions(i),
      $forceUpdate: (i) => i.f || (i.f = () => {
        queueJob(i.update);
      }),
      $nextTick: (i) => i.n || (i.n = nextTick.bind(i.proxy)),
      $watch: (i) => instanceWatch.bind(i)
    })
  );
  const hasSetupBinding = (state, key) => state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key);
  const PublicInstanceProxyHandlers = {
    get({ _: instance }, key) {
      if (key === "__v_skip") {
        return true;
      }
      const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
      if (key[0] !== "$") {
        const n = accessCache[key];
        if (n !== void 0) {
          switch (n) {
            case 1:
              return setupState[key];
            case 2:
              return data[key];
            case 4:
              return ctx[key];
            case 3:
              return props[key];
          }
        } else if (hasSetupBinding(setupState, key)) {
          accessCache[key] = 1;
          return setupState[key];
        } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
          accessCache[key] = 2;
          return data[key];
        } else if (hasOwn(props, key)) {
          accessCache[key] = 3;
          return props[key];
        } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
          accessCache[key] = 4;
          return ctx[key];
        } else if (shouldCacheAccess) {
          accessCache[key] = 0;
        }
      }
      const publicGetter = publicPropertiesMap[key];
      let cssModule, globalProperties;
      if (publicGetter) {
        if (key === "$attrs") {
          track(instance.attrs, "get", "");
        }
        return publicGetter(instance);
      } else if (
        // css module (injected by vue-loader)
        (cssModule = type.__cssModules) && (cssModule = cssModule[key])
      ) {
        return cssModule;
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache[key] = 4;
        return ctx[key];
      } else if (
        // global properties
        globalProperties = appContext.config.globalProperties, hasOwn(globalProperties, key)
      ) {
        {
          return globalProperties[key];
        }
      } else ;
    },
    set({ _: instance }, key, value) {
      const { data, setupState, ctx } = instance;
      if (hasSetupBinding(setupState, key)) {
        setupState[key] = value;
        return true;
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        data[key] = value;
        return true;
      } else if (hasOwn(instance.props, key)) {
        return false;
      }
      if (key[0] === "$" && key.slice(1) in instance) {
        return false;
      } else {
        {
          ctx[key] = value;
        }
      }
      return true;
    },
    has({
      _: { data, setupState, accessCache, ctx, appContext, props, type }
    }, key) {
      let cssModules;
      return !!(accessCache[key] || data !== EMPTY_OBJ && key[0] !== "$" && hasOwn(data, key) || hasSetupBinding(setupState, key) || hasOwn(props, key) || hasOwn(ctx, key) || hasOwn(publicPropertiesMap, key) || hasOwn(appContext.config.globalProperties, key) || (cssModules = type.__cssModules) && cssModules[key]);
    },
    defineProperty(target, key, descriptor) {
      if (descriptor.get != null) {
        target._.accessCache[key] = 0;
      } else if (hasOwn(descriptor, "value")) {
        this.set(target, key, descriptor.value, null);
      }
      return Reflect.defineProperty(target, key, descriptor);
    }
  };
  function normalizePropsOrEmits(props) {
    return isArray(props) ? props.reduce(
      (normalized, p2) => (normalized[p2] = null, normalized),
      {}
    ) : props;
  }
  let shouldCacheAccess = true;
  function applyOptions(instance) {
    const options = resolveMergedOptions(instance);
    const publicThis = instance.proxy;
    const ctx = instance.ctx;
    shouldCacheAccess = false;
    if (options.beforeCreate) {
      callHook(options.beforeCreate, instance, "bc");
    }
    const {
      // state
      data: dataOptions,
      computed: computedOptions,
      methods,
      watch: watchOptions,
      provide: provideOptions,
      inject: injectOptions,
      // lifecycle
      created,
      beforeMount,
      mounted,
      beforeUpdate,
      updated,
      activated,
      deactivated,
      beforeDestroy,
      beforeUnmount,
      destroyed,
      unmounted,
      render: render2,
      renderTracked,
      renderTriggered,
      errorCaptured,
      serverPrefetch,
      // public API
      expose,
      inheritAttrs,
      // assets
      components,
      directives,
      filters
    } = options;
    const checkDuplicateProperties = null;
    if (injectOptions) {
      resolveInjections(injectOptions, ctx, checkDuplicateProperties);
    }
    if (methods) {
      for (const key in methods) {
        const methodHandler = methods[key];
        if (isFunction(methodHandler)) {
          {
            ctx[key] = methodHandler.bind(publicThis);
          }
        }
      }
    }
    if (dataOptions) {
      const data = dataOptions.call(publicThis, publicThis);
      if (!isObject(data)) ;
      else {
        instance.data = /* @__PURE__ */ reactive(data);
      }
    }
    shouldCacheAccess = true;
    if (computedOptions) {
      for (const key in computedOptions) {
        const opt = computedOptions[key];
        const get = isFunction(opt) ? opt.bind(publicThis, publicThis) : isFunction(opt.get) ? opt.get.bind(publicThis, publicThis) : NOOP;
        const set = !isFunction(opt) && isFunction(opt.set) ? opt.set.bind(publicThis) : NOOP;
        const c2 = computed({
          get,
          set
        });
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          get: () => c2.value,
          set: (v) => c2.value = v
        });
      }
    }
    if (watchOptions) {
      for (const key in watchOptions) {
        createWatcher(watchOptions[key], ctx, publicThis, key);
      }
    }
    if (provideOptions) {
      const provides = isFunction(provideOptions) ? provideOptions.call(publicThis) : provideOptions;
      Reflect.ownKeys(provides).forEach((key) => {
        provide(key, provides[key]);
      });
    }
    if (created) {
      callHook(created, instance, "c");
    }
    function registerLifecycleHook(register, hook) {
      if (isArray(hook)) {
        hook.forEach((_hook) => register(_hook.bind(publicThis)));
      } else if (hook) {
        register(hook.bind(publicThis));
      }
    }
    registerLifecycleHook(onBeforeMount, beforeMount);
    registerLifecycleHook(onMounted, mounted);
    registerLifecycleHook(onBeforeUpdate, beforeUpdate);
    registerLifecycleHook(onUpdated, updated);
    registerLifecycleHook(onActivated, activated);
    registerLifecycleHook(onDeactivated, deactivated);
    registerLifecycleHook(onErrorCaptured, errorCaptured);
    registerLifecycleHook(onRenderTracked, renderTracked);
    registerLifecycleHook(onRenderTriggered, renderTriggered);
    registerLifecycleHook(onBeforeUnmount, beforeUnmount);
    registerLifecycleHook(onUnmounted, unmounted);
    registerLifecycleHook(onServerPrefetch, serverPrefetch);
    if (isArray(expose)) {
      if (expose.length) {
        const exposed = instance.exposed || (instance.exposed = {});
        expose.forEach((key) => {
          Object.defineProperty(exposed, key, {
            get: () => publicThis[key],
            set: (val) => publicThis[key] = val,
            enumerable: true
          });
        });
      } else if (!instance.exposed) {
        instance.exposed = {};
      }
    }
    if (render2 && instance.render === NOOP) {
      instance.render = render2;
    }
    if (inheritAttrs != null) {
      instance.inheritAttrs = inheritAttrs;
    }
    if (components) instance.components = components;
    if (directives) instance.directives = directives;
    if (serverPrefetch) {
      markAsyncBoundary(instance);
    }
  }
  function resolveInjections(injectOptions, ctx, checkDuplicateProperties = NOOP) {
    if (isArray(injectOptions)) {
      injectOptions = normalizeInject(injectOptions);
    }
    for (const key in injectOptions) {
      const opt = injectOptions[key];
      let injected;
      if (isObject(opt)) {
        if ("default" in opt) {
          injected = inject(
            opt.from || key,
            opt.default,
            true
          );
        } else {
          injected = inject(opt.from || key);
        }
      } else {
        injected = inject(opt);
      }
      if (/* @__PURE__ */ isRef(injected)) {
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          get: () => injected.value,
          set: (v) => injected.value = v
        });
      } else {
        ctx[key] = injected;
      }
    }
  }
  function callHook(hook, instance, type) {
    callWithAsyncErrorHandling(
      isArray(hook) ? hook.map((h2) => h2.bind(instance.proxy)) : hook.bind(instance.proxy),
      instance,
      type
    );
  }
  function createWatcher(raw, ctx, publicThis, key) {
    let getter = key.includes(".") ? createPathGetter(publicThis, key) : () => publicThis[key];
    if (isString(raw)) {
      const handler = ctx[raw];
      if (isFunction(handler)) {
        {
          watch(getter, handler);
        }
      }
    } else if (isFunction(raw)) {
      {
        watch(getter, raw.bind(publicThis));
      }
    } else if (isObject(raw)) {
      if (isArray(raw)) {
        raw.forEach((r) => createWatcher(r, ctx, publicThis, key));
      } else {
        const handler = isFunction(raw.handler) ? raw.handler.bind(publicThis) : ctx[raw.handler];
        if (isFunction(handler)) {
          watch(getter, handler, raw);
        }
      }
    } else ;
  }
  function resolveMergedOptions(instance) {
    const base = instance.type;
    const { mixins, extends: extendsOptions } = base;
    const {
      mixins: globalMixins,
      optionsCache: cache,
      config: { optionMergeStrategies }
    } = instance.appContext;
    const cached = cache.get(base);
    let resolved;
    if (cached) {
      resolved = cached;
    } else if (!globalMixins.length && !mixins && !extendsOptions) {
      {
        resolved = base;
      }
    } else {
      resolved = {};
      if (globalMixins.length) {
        globalMixins.forEach(
          (m) => mergeOptions(resolved, m, optionMergeStrategies, true)
        );
      }
      mergeOptions(resolved, base, optionMergeStrategies);
    }
    if (isObject(base)) {
      cache.set(base, resolved);
    }
    return resolved;
  }
  function mergeOptions(to, from, strats, asMixin = false) {
    const { mixins, extends: extendsOptions } = from;
    if (extendsOptions) {
      mergeOptions(to, extendsOptions, strats, true);
    }
    if (mixins) {
      mixins.forEach(
        (m) => mergeOptions(to, m, strats, true)
      );
    }
    for (const key in from) {
      if (asMixin && key === "expose") ;
      else {
        const strat = internalOptionMergeStrats[key] || strats && strats[key];
        to[key] = strat ? strat(to[key], from[key]) : from[key];
      }
    }
    return to;
  }
  const internalOptionMergeStrats = {
    data: mergeDataFn,
    props: mergeEmitsOrPropsOptions,
    emits: mergeEmitsOrPropsOptions,
    // objects
    methods: mergeObjectOptions,
    computed: mergeObjectOptions,
    // lifecycle
    beforeCreate: mergeAsArray,
    created: mergeAsArray,
    beforeMount: mergeAsArray,
    mounted: mergeAsArray,
    beforeUpdate: mergeAsArray,
    updated: mergeAsArray,
    beforeDestroy: mergeAsArray,
    beforeUnmount: mergeAsArray,
    destroyed: mergeAsArray,
    unmounted: mergeAsArray,
    activated: mergeAsArray,
    deactivated: mergeAsArray,
    errorCaptured: mergeAsArray,
    serverPrefetch: mergeAsArray,
    // assets
    components: mergeObjectOptions,
    directives: mergeObjectOptions,
    // watch
    watch: mergeWatchOptions,
    // provide / inject
    provide: mergeDataFn,
    inject: mergeInject
  };
  function mergeDataFn(to, from) {
    if (!from) {
      return to;
    }
    if (!to) {
      return from;
    }
    return function mergedDataFn() {
      return extend(
        isFunction(to) ? to.call(this, this) : to,
        isFunction(from) ? from.call(this, this) : from
      );
    };
  }
  function mergeInject(to, from) {
    return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
  }
  function normalizeInject(raw) {
    if (isArray(raw)) {
      const res = {};
      for (let i = 0; i < raw.length; i++) {
        res[raw[i]] = raw[i];
      }
      return res;
    }
    return raw;
  }
  function mergeAsArray(to, from) {
    return to ? [...new Set([].concat(to, from))] : from;
  }
  function mergeObjectOptions(to, from) {
    return to ? extend(/* @__PURE__ */ Object.create(null), to, from) : from;
  }
  function mergeEmitsOrPropsOptions(to, from) {
    if (to) {
      if (isArray(to) && isArray(from)) {
        return [.../* @__PURE__ */ new Set([...to, ...from])];
      }
      return extend(
        /* @__PURE__ */ Object.create(null),
        normalizePropsOrEmits(to),
        normalizePropsOrEmits(from != null ? from : {})
      );
    } else {
      return from;
    }
  }
  function mergeWatchOptions(to, from) {
    if (!to) return from;
    if (!from) return to;
    const merged = extend(/* @__PURE__ */ Object.create(null), to);
    for (const key in from) {
      merged[key] = mergeAsArray(to[key], from[key]);
    }
    return merged;
  }
  function createAppContext() {
    return {
      app: null,
      config: {
        isNativeTag: NO,
        performance: false,
        globalProperties: {},
        optionMergeStrategies: {},
        errorHandler: void 0,
        warnHandler: void 0,
        compilerOptions: {}
      },
      mixins: [],
      components: {},
      directives: {},
      provides: /* @__PURE__ */ Object.create(null),
      optionsCache: /* @__PURE__ */ new WeakMap(),
      propsCache: /* @__PURE__ */ new WeakMap(),
      emitsCache: /* @__PURE__ */ new WeakMap()
    };
  }
  let uid$1 = 0;
  function createAppAPI(render2, hydrate) {
    return function createApp2(rootComponent, rootProps = null) {
      if (!isFunction(rootComponent)) {
        rootComponent = extend({}, rootComponent);
      }
      if (rootProps != null && !isObject(rootProps)) {
        rootProps = null;
      }
      const context = createAppContext();
      const installedPlugins = /* @__PURE__ */ new WeakSet();
      const pluginCleanupFns = [];
      let isMounted = false;
      const app = context.app = {
        _uid: uid$1++,
        _component: rootComponent,
        _props: rootProps,
        _container: null,
        _context: context,
        _instance: null,
        version,
        get config() {
          return context.config;
        },
        set config(v) {
        },
        use(plugin, ...options) {
          if (installedPlugins.has(plugin)) ;
          else if (plugin && isFunction(plugin.install)) {
            installedPlugins.add(plugin);
            plugin.install(app, ...options);
          } else if (isFunction(plugin)) {
            installedPlugins.add(plugin);
            plugin(app, ...options);
          } else ;
          return app;
        },
        mixin(mixin) {
          {
            if (!context.mixins.includes(mixin)) {
              context.mixins.push(mixin);
            }
          }
          return app;
        },
        component(name, component) {
          if (!component) {
            return context.components[name];
          }
          context.components[name] = component;
          return app;
        },
        directive(name, directive) {
          if (!directive) {
            return context.directives[name];
          }
          context.directives[name] = directive;
          return app;
        },
        mount(rootContainer, isHydrate, namespace) {
          if (!isMounted) {
            const vnode = app._ceVNode || createVNode(rootComponent, rootProps);
            vnode.appContext = context;
            if (namespace === true) {
              namespace = "svg";
            } else if (namespace === false) {
              namespace = void 0;
            }
            {
              render2(vnode, rootContainer, namespace);
            }
            isMounted = true;
            app._container = rootContainer;
            rootContainer.__vue_app__ = app;
            return getComponentPublicInstance(vnode.component);
          }
        },
        onUnmount(cleanupFn) {
          pluginCleanupFns.push(cleanupFn);
        },
        unmount() {
          if (isMounted) {
            callWithAsyncErrorHandling(
              pluginCleanupFns,
              app._instance,
              16
            );
            render2(null, app._container);
            delete app._container.__vue_app__;
          }
        },
        provide(key, value) {
          context.provides[key] = value;
          return app;
        },
        runWithContext(fn) {
          const lastApp = currentApp;
          currentApp = app;
          try {
            return fn();
          } finally {
            currentApp = lastApp;
          }
        }
      };
      return app;
    };
  }
  let currentApp = null;
  const getModelModifiers = (props, modelName) => {
    return modelName === "modelValue" || modelName === "model-value" ? props.modelModifiers : props[`${modelName}Modifiers`] || props[`${camelize(modelName)}Modifiers`] || props[`${hyphenate(modelName)}Modifiers`];
  };
  function emit(instance, event, ...rawArgs) {
    if (instance.isUnmounted) return;
    const props = instance.vnode.props || EMPTY_OBJ;
    let args = rawArgs;
    const isModelListener2 = event.startsWith("update:");
    const modifiers = isModelListener2 && getModelModifiers(props, event.slice(7));
    if (modifiers) {
      if (modifiers.trim) {
        args = rawArgs.map((a) => isString(a) ? a.trim() : a);
      }
      if (modifiers.number) {
        args = rawArgs.map(looseToNumber);
      }
    }
    let handlerName;
    let handler = props[handlerName = toHandlerKey(event)] || // also try camelCase event handler (#2249)
    props[handlerName = toHandlerKey(camelize(event))];
    if (!handler && isModelListener2) {
      handler = props[handlerName = toHandlerKey(hyphenate(event))];
    }
    if (handler) {
      callWithAsyncErrorHandling(
        handler,
        instance,
        6,
        args
      );
    }
    const onceHandler = props[handlerName + `Once`];
    if (onceHandler) {
      if (!instance.emitted) {
        instance.emitted = {};
      } else if (instance.emitted[handlerName]) {
        return;
      }
      instance.emitted[handlerName] = true;
      callWithAsyncErrorHandling(
        onceHandler,
        instance,
        6,
        args
      );
    }
  }
  const mixinEmitsCache = /* @__PURE__ */ new WeakMap();
  function normalizeEmitsOptions(comp, appContext, asMixin = false) {
    const cache = asMixin ? mixinEmitsCache : appContext.emitsCache;
    const cached = cache.get(comp);
    if (cached !== void 0) {
      return cached;
    }
    const raw = comp.emits;
    let normalized = {};
    let hasExtends = false;
    if (!isFunction(comp)) {
      const extendEmits = (raw2) => {
        const normalizedFromExtend = normalizeEmitsOptions(raw2, appContext, true);
        if (normalizedFromExtend) {
          hasExtends = true;
          extend(normalized, normalizedFromExtend);
        }
      };
      if (!asMixin && appContext.mixins.length) {
        appContext.mixins.forEach(extendEmits);
      }
      if (comp.extends) {
        extendEmits(comp.extends);
      }
      if (comp.mixins) {
        comp.mixins.forEach(extendEmits);
      }
    }
    if (!raw && !hasExtends) {
      if (isObject(comp)) {
        cache.set(comp, null);
      }
      return null;
    }
    if (isArray(raw)) {
      raw.forEach((key) => normalized[key] = null);
    } else {
      extend(normalized, raw);
    }
    if (isObject(comp)) {
      cache.set(comp, normalized);
    }
    return normalized;
  }
  function isEmitListener(options, key) {
    if (!options || !isOn(key)) {
      return false;
    }
    key = key.slice(2).replace(/Once$/, "");
    return hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, hyphenate(key)) || hasOwn(options, key);
  }
  function markAttrsAccessed() {
  }
  function renderComponentRoot(instance) {
    const {
      type: Component,
      vnode,
      proxy,
      withProxy,
      propsOptions: [propsOptions],
      slots,
      attrs,
      emit: emit2,
      render: render2,
      renderCache,
      props,
      data,
      setupState,
      ctx,
      inheritAttrs
    } = instance;
    const prev = setCurrentRenderingInstance(instance);
    let result;
    let fallthroughAttrs;
    try {
      if (vnode.shapeFlag & 4) {
        const proxyToUse = withProxy || proxy;
        const thisProxy = false ? new Proxy(proxyToUse, {
          get(target, key, receiver) {
            warn$1(
              `Property '${String(
                key
              )}' was accessed via 'this'. Avoid using 'this' in templates.`
            );
            return Reflect.get(target, key, receiver);
          }
        }) : proxyToUse;
        result = normalizeVNode(
          render2.call(
            thisProxy,
            proxyToUse,
            renderCache,
            false ? /* @__PURE__ */ shallowReadonly(props) : props,
            setupState,
            data,
            ctx
          )
        );
        fallthroughAttrs = attrs;
      } else {
        const render22 = Component;
        if (false) ;
        result = normalizeVNode(
          render22.length > 1 ? render22(
            false ? /* @__PURE__ */ shallowReadonly(props) : props,
            false ? {
              get attrs() {
                markAttrsAccessed();
                return /* @__PURE__ */ shallowReadonly(attrs);
              },
              slots,
              emit: emit2
            } : { attrs, slots, emit: emit2 }
          ) : render22(
            false ? /* @__PURE__ */ shallowReadonly(props) : props,
            null
          )
        );
        fallthroughAttrs = Component.props ? attrs : getFunctionalFallthrough(attrs);
      }
    } catch (err) {
      blockStack.length = 0;
      handleError(err, instance, 1);
      result = createVNode(Comment);
    }
    let root = result;
    if (fallthroughAttrs && inheritAttrs !== false) {
      const keys = Object.keys(fallthroughAttrs);
      const { shapeFlag } = root;
      if (keys.length) {
        if (shapeFlag & (1 | 6)) {
          if (propsOptions && keys.some(isModelListener)) {
            fallthroughAttrs = filterModelListeners(
              fallthroughAttrs,
              propsOptions
            );
          }
          root = cloneVNode(root, fallthroughAttrs, false, true);
        }
      }
    }
    if (vnode.dirs) {
      root = cloneVNode(root, null, false, true);
      root.dirs = root.dirs ? root.dirs.concat(vnode.dirs) : vnode.dirs;
    }
    if (vnode.transition) {
      setTransitionHooks(root, vnode.transition);
    }
    {
      result = root;
    }
    setCurrentRenderingInstance(prev);
    return result;
  }
  const getFunctionalFallthrough = (attrs) => {
    let res;
    for (const key in attrs) {
      if (key === "class" || key === "style" || isOn(key)) {
        (res || (res = {}))[key] = attrs[key];
      }
    }
    return res;
  };
  const filterModelListeners = (attrs, props) => {
    const res = {};
    for (const key in attrs) {
      if (!isModelListener(key) || !(key.slice(9) in props)) {
        res[key] = attrs[key];
      }
    }
    return res;
  };
  function shouldUpdateComponent(prevVNode, nextVNode, optimized) {
    const { props: prevProps, children: prevChildren, component } = prevVNode;
    const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
    const emits = component.emitsOptions;
    if (nextVNode.dirs || nextVNode.transition) {
      return true;
    }
    if (optimized && patchFlag >= 0) {
      if (patchFlag & 1024) {
        return true;
      }
      if (patchFlag & 16) {
        if (!prevProps) {
          return !!nextProps;
        }
        return hasPropsChanged(prevProps, nextProps, emits);
      } else if (patchFlag & 8) {
        const dynamicProps = nextVNode.dynamicProps;
        for (let i = 0; i < dynamicProps.length; i++) {
          const key = dynamicProps[i];
          if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emits, key)) {
            return true;
          }
        }
      }
    } else {
      if (prevChildren || nextChildren) {
        if (!nextChildren || !nextChildren.$stable) {
          return true;
        }
      }
      if (prevProps === nextProps) {
        return false;
      }
      if (!prevProps) {
        return !!nextProps;
      }
      if (!nextProps) {
        return true;
      }
      return hasPropsChanged(prevProps, nextProps, emits);
    }
    return false;
  }
  function hasPropsChanged(prevProps, nextProps, emitsOptions) {
    const nextKeys = Object.keys(nextProps);
    if (nextKeys.length !== Object.keys(prevProps).length) {
      return true;
    }
    for (let i = 0; i < nextKeys.length; i++) {
      const key = nextKeys[i];
      if (hasPropValueChanged(nextProps, prevProps, key) && !isEmitListener(emitsOptions, key)) {
        return true;
      }
    }
    return false;
  }
  function hasPropValueChanged(nextProps, prevProps, key) {
    const nextProp = nextProps[key];
    const prevProp = prevProps[key];
    if (key === "style" && isObject(nextProp) && isObject(prevProp)) {
      return !looseEqual(nextProp, prevProp);
    }
    return nextProp !== prevProp;
  }
  function updateHOCHostEl({ vnode, parent, suspense }, el) {
    while (parent) {
      const root = parent.subTree;
      if (root.suspense && root.suspense.activeBranch === vnode) {
        root.suspense.vnode.el = root.el = el;
        vnode = root;
      }
      if (root === vnode) {
        (vnode = parent.vnode).el = el;
        parent = parent.parent;
      } else {
        break;
      }
    }
    if (suspense && suspense.activeBranch === vnode) {
      suspense.vnode.el = el;
    }
  }
  const internalObjectProto = {};
  const createInternalObject = () => Object.create(internalObjectProto);
  const isInternalObject = (obj) => Object.getPrototypeOf(obj) === internalObjectProto;
  function initProps(instance, rawProps, isStateful, isSSR = false) {
    const props = {};
    const attrs = createInternalObject();
    instance.propsDefaults = /* @__PURE__ */ Object.create(null);
    setFullProps(instance, rawProps, props, attrs);
    for (const key in instance.propsOptions[0]) {
      if (!(key in props)) {
        props[key] = void 0;
      }
    }
    if (isStateful) {
      instance.props = isSSR ? props : /* @__PURE__ */ shallowReactive(props);
    } else {
      if (!instance.type.props) {
        instance.props = attrs;
      } else {
        instance.props = props;
      }
    }
    instance.attrs = attrs;
  }
  function updateProps(instance, rawProps, rawPrevProps, optimized) {
    const {
      props,
      attrs,
      vnode: { patchFlag }
    } = instance;
    const rawCurrentProps = /* @__PURE__ */ toRaw(props);
    const [options] = instance.propsOptions;
    let hasAttrsChanged = false;
    if (
      // always force full diff in dev
      // - #1942 if hmr is enabled with sfc component
      // - vite#872 non-sfc component used by sfc component
      (optimized || patchFlag > 0) && !(patchFlag & 16)
    ) {
      if (patchFlag & 8) {
        const propsToUpdate = instance.vnode.dynamicProps;
        for (let i = 0; i < propsToUpdate.length; i++) {
          let key = propsToUpdate[i];
          if (isEmitListener(instance.emitsOptions, key)) {
            continue;
          }
          const value = rawProps[key];
          if (options) {
            if (hasOwn(attrs, key)) {
              if (value !== attrs[key]) {
                attrs[key] = value;
                hasAttrsChanged = true;
              }
            } else {
              const camelizedKey = camelize(key);
              props[camelizedKey] = resolvePropValue(
                options,
                rawCurrentProps,
                camelizedKey,
                value,
                instance,
                false
              );
            }
          } else {
            if (value !== attrs[key]) {
              attrs[key] = value;
              hasAttrsChanged = true;
            }
          }
        }
      }
    } else {
      if (setFullProps(instance, rawProps, props, attrs)) {
        hasAttrsChanged = true;
      }
      let kebabKey;
      for (const key in rawCurrentProps) {
        if (!rawProps || // for camelCase
        !hasOwn(rawProps, key) && // it's possible the original props was passed in as kebab-case
        // and converted to camelCase (#955)
        ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey))) {
          if (options) {
            if (rawPrevProps && // for camelCase
            (rawPrevProps[key] !== void 0 || // for kebab-case
            rawPrevProps[kebabKey] !== void 0)) {
              props[key] = resolvePropValue(
                options,
                rawCurrentProps,
                key,
                void 0,
                instance,
                true
              );
            }
          } else {
            delete props[key];
          }
        }
      }
      if (attrs !== rawCurrentProps) {
        for (const key in attrs) {
          if (!rawProps || !hasOwn(rawProps, key) && true) {
            delete attrs[key];
            hasAttrsChanged = true;
          }
        }
      }
    }
    if (hasAttrsChanged) {
      trigger(instance.attrs, "set", "");
    }
  }
  function setFullProps(instance, rawProps, props, attrs) {
    const [options, needCastKeys] = instance.propsOptions;
    let hasAttrsChanged = false;
    let rawCastValues;
    if (rawProps) {
      for (let key in rawProps) {
        if (isReservedProp(key)) {
          continue;
        }
        const value = rawProps[key];
        let camelKey;
        if (options && hasOwn(options, camelKey = camelize(key))) {
          if (!needCastKeys || !needCastKeys.includes(camelKey)) {
            props[camelKey] = value;
          } else {
            (rawCastValues || (rawCastValues = {}))[camelKey] = value;
          }
        } else if (!isEmitListener(instance.emitsOptions, key)) {
          if (!(key in attrs) || value !== attrs[key]) {
            attrs[key] = value;
            hasAttrsChanged = true;
          }
        }
      }
    }
    if (needCastKeys) {
      const rawCurrentProps = /* @__PURE__ */ toRaw(props);
      const castValues = rawCastValues || EMPTY_OBJ;
      for (let i = 0; i < needCastKeys.length; i++) {
        const key = needCastKeys[i];
        props[key] = resolvePropValue(
          options,
          rawCurrentProps,
          key,
          castValues[key],
          instance,
          !hasOwn(castValues, key)
        );
      }
    }
    return hasAttrsChanged;
  }
  function resolvePropValue(options, props, key, value, instance, isAbsent) {
    const opt = options[key];
    if (opt != null) {
      const hasDefault = hasOwn(opt, "default");
      if (hasDefault && value === void 0) {
        const defaultValue = opt.default;
        if (opt.type !== Function && !opt.skipFactory && isFunction(defaultValue)) {
          const { propsDefaults } = instance;
          if (key in propsDefaults) {
            value = propsDefaults[key];
          } else {
            const reset = setCurrentInstance(instance);
            value = propsDefaults[key] = defaultValue.call(
              null,
              props
            );
            reset();
          }
        } else {
          value = defaultValue;
        }
        if (instance.ce) {
          instance.ce._setProp(key, value);
        }
      }
      if (opt[
        0
        /* shouldCast */
      ]) {
        if (isAbsent && !hasDefault) {
          value = false;
        } else if (opt[
          1
          /* shouldCastTrue */
        ] && (value === "" || value === hyphenate(key))) {
          value = true;
        }
      }
    }
    return value;
  }
  const mixinPropsCache = /* @__PURE__ */ new WeakMap();
  function normalizePropsOptions(comp, appContext, asMixin = false) {
    const cache = asMixin ? mixinPropsCache : appContext.propsCache;
    const cached = cache.get(comp);
    if (cached) {
      return cached;
    }
    const raw = comp.props;
    const normalized = {};
    const needCastKeys = [];
    let hasExtends = false;
    if (!isFunction(comp)) {
      const extendProps = (raw2) => {
        hasExtends = true;
        const [props, keys] = normalizePropsOptions(raw2, appContext, true);
        extend(normalized, props);
        if (keys) needCastKeys.push(...keys);
      };
      if (!asMixin && appContext.mixins.length) {
        appContext.mixins.forEach(extendProps);
      }
      if (comp.extends) {
        extendProps(comp.extends);
      }
      if (comp.mixins) {
        comp.mixins.forEach(extendProps);
      }
    }
    if (!raw && !hasExtends) {
      if (isObject(comp)) {
        cache.set(comp, EMPTY_ARR);
      }
      return EMPTY_ARR;
    }
    if (isArray(raw)) {
      for (let i = 0; i < raw.length; i++) {
        const normalizedKey = camelize(raw[i]);
        if (validatePropName(normalizedKey)) {
          normalized[normalizedKey] = EMPTY_OBJ;
        }
      }
    } else if (raw) {
      for (const key in raw) {
        const normalizedKey = camelize(key);
        if (validatePropName(normalizedKey)) {
          const opt = raw[key];
          const prop = normalized[normalizedKey] = isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt);
          const propType = prop.type;
          let shouldCast = false;
          let shouldCastTrue = true;
          if (isArray(propType)) {
            for (let index = 0; index < propType.length; ++index) {
              const type = propType[index];
              const typeName = isFunction(type) && type.name;
              if (typeName === "Boolean") {
                shouldCast = true;
                break;
              } else if (typeName === "String") {
                shouldCastTrue = false;
              }
            }
          } else {
            shouldCast = isFunction(propType) && propType.name === "Boolean";
          }
          prop[
            0
            /* shouldCast */
          ] = shouldCast;
          prop[
            1
            /* shouldCastTrue */
          ] = shouldCastTrue;
          if (shouldCast || hasOwn(prop, "default")) {
            needCastKeys.push(normalizedKey);
          }
        }
      }
    }
    const res = [normalized, needCastKeys];
    if (isObject(comp)) {
      cache.set(comp, res);
    }
    return res;
  }
  function validatePropName(key) {
    if (key[0] !== "$" && !isReservedProp(key)) {
      return true;
    }
    return false;
  }
  const isInternalKey = (key) => key === "_" || key === "_ctx" || key === "$stable";
  const normalizeSlotValue = (value) => isArray(value) ? value.map(normalizeVNode) : [normalizeVNode(value)];
  const normalizeSlot = (key, rawSlot, ctx) => {
    if (rawSlot._n) {
      return rawSlot;
    }
    const normalized = withCtx((...args) => {
      if (false) ;
      return normalizeSlotValue(rawSlot(...args));
    }, ctx);
    normalized._c = false;
    return normalized;
  };
  const normalizeObjectSlots = (rawSlots, slots, instance) => {
    const ctx = rawSlots._ctx;
    for (const key in rawSlots) {
      if (isInternalKey(key)) continue;
      const value = rawSlots[key];
      if (isFunction(value)) {
        slots[key] = normalizeSlot(key, value, ctx);
      } else if (value != null) {
        const normalized = normalizeSlotValue(value);
        slots[key] = () => normalized;
      }
    }
  };
  const normalizeVNodeSlots = (instance, children) => {
    const normalized = normalizeSlotValue(children);
    instance.slots.default = () => normalized;
  };
  const assignSlots = (slots, children, optimized) => {
    for (const key in children) {
      if (optimized || !isInternalKey(key)) {
        slots[key] = children[key];
      }
    }
  };
  const initSlots = (instance, children, optimized) => {
    const slots = instance.slots = createInternalObject();
    if (instance.vnode.shapeFlag & 32) {
      const type = children._;
      if (type) {
        assignSlots(slots, children, optimized);
        if (optimized) {
          def(slots, "_", type, true);
        }
      } else {
        normalizeObjectSlots(children, slots);
      }
    } else if (children) {
      normalizeVNodeSlots(instance, children);
    }
  };
  const updateSlots = (instance, children, optimized) => {
    const { vnode, slots } = instance;
    let needDeletionCheck = true;
    let deletionComparisonTarget = EMPTY_OBJ;
    if (vnode.shapeFlag & 32) {
      const type = children._;
      if (type) {
        if (optimized && type === 1) {
          needDeletionCheck = false;
        } else {
          assignSlots(slots, children, optimized);
        }
      } else {
        needDeletionCheck = !children.$stable;
        normalizeObjectSlots(children, slots);
      }
      deletionComparisonTarget = children;
    } else if (children) {
      normalizeVNodeSlots(instance, children);
      deletionComparisonTarget = { default: 1 };
    }
    if (needDeletionCheck) {
      for (const key in slots) {
        if (!isInternalKey(key) && deletionComparisonTarget[key] == null) {
          delete slots[key];
        }
      }
    }
  };
  const queuePostRenderEffect = queueEffectWithSuspense;
  function createRenderer(options) {
    return baseCreateRenderer(options);
  }
  function baseCreateRenderer(options, createHydrationFns) {
    const target = getGlobalThis();
    target.__VUE__ = true;
    const {
      insert: hostInsert,
      remove: hostRemove,
      patchProp: hostPatchProp,
      createElement: hostCreateElement,
      createText: hostCreateText,
      createComment: hostCreateComment,
      setText: hostSetText,
      setElementText: hostSetElementText,
      parentNode: hostParentNode,
      nextSibling: hostNextSibling,
      setScopeId: hostSetScopeId = NOOP,
      insertStaticContent: hostInsertStaticContent
    } = options;
    const patch = (n1, n2, container, anchor = null, parentComponent = null, parentSuspense = null, namespace = void 0, slotScopeIds = null, optimized = !!n2.dynamicChildren) => {
      if (n1 === n2) {
        return;
      }
      if (n1 && !isSameVNodeType(n1, n2)) {
        anchor = getNextHostNode(n1);
        unmount2(n1, parentComponent, parentSuspense, true);
        n1 = null;
      }
      if (n2.patchFlag === -2) {
        optimized = false;
        n2.dynamicChildren = null;
      }
      const { type, ref: ref3, shapeFlag } = n2;
      switch (type) {
        case Text:
          processText(n1, n2, container, anchor);
          break;
        case Comment:
          processCommentNode(n1, n2, container, anchor);
          break;
        case Static:
          if (n1 == null) {
            mountStaticNode(n2, container, anchor, namespace);
          }
          break;
        case Fragment:
          processFragment(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          break;
        default:
          if (shapeFlag & 1) {
            processElement(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else if (shapeFlag & 6) {
            processComponent(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else if (shapeFlag & 64) {
            type.process(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized,
              internals
            );
          } else if (shapeFlag & 128) {
            type.process(
              n1,
              n2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized,
              internals
            );
          } else ;
      }
      if (ref3 != null && parentComponent) {
        setRef(ref3, n1 && n1.ref, parentSuspense, n2 || n1, !n2);
      } else if (ref3 == null && n1 && n1.ref != null) {
        setRef(n1.ref, null, parentSuspense, n1, true);
      }
    };
    const processText = (n1, n2, container, anchor) => {
      if (n1 == null) {
        hostInsert(
          n2.el = hostCreateText(n2.children),
          container,
          anchor
        );
      } else {
        const el = n2.el = n1.el;
        if (n2.children !== n1.children) {
          hostSetText(el, n2.children);
        }
      }
    };
    const processCommentNode = (n1, n2, container, anchor) => {
      if (n1 == null) {
        hostInsert(
          n2.el = hostCreateComment(n2.children || ""),
          container,
          anchor
        );
      } else {
        n2.el = n1.el;
      }
    };
    const mountStaticNode = (n2, container, anchor, namespace) => {
      [n2.el, n2.anchor] = hostInsertStaticContent(
        n2.children,
        container,
        anchor,
        namespace,
        n2.el,
        n2.anchor
      );
    };
    const moveStaticNode = ({ el, anchor }, container, nextSibling) => {
      let next;
      while (el && el !== anchor) {
        next = hostNextSibling(el);
        hostInsert(el, container, nextSibling);
        el = next;
      }
      hostInsert(anchor, container, nextSibling);
    };
    const removeStaticNode = ({ el, anchor }) => {
      let next;
      while (el && el !== anchor) {
        next = hostNextSibling(el);
        hostRemove(el);
        el = next;
      }
      hostRemove(anchor);
    };
    const processElement = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      if (n2.type === "svg") {
        namespace = "svg";
      } else if (n2.type === "math") {
        namespace = "mathml";
      }
      if (n1 == null) {
        mountElement(
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } else {
        const customElement = n1.el && n1.el._isVueCE ? n1.el : null;
        try {
          if (customElement) {
            customElement._beginPatch();
          }
          patchElement(
            n1,
            n2,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } finally {
          if (customElement) {
            customElement._endPatch();
          }
        }
      }
    };
    const mountElement = (vnode, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      let el;
      let vnodeHook;
      const { props, shapeFlag, transition, dirs } = vnode;
      el = vnode.el = hostCreateElement(
        vnode.type,
        namespace,
        props && props.is,
        props
      );
      if (shapeFlag & 8) {
        hostSetElementText(el, vnode.children);
      } else if (shapeFlag & 16) {
        mountChildren(
          vnode.children,
          el,
          null,
          parentComponent,
          parentSuspense,
          resolveChildrenNamespace(vnode, namespace),
          slotScopeIds,
          optimized
        );
      }
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, "created");
      }
      setScopeId(el, vnode, vnode.scopeId, slotScopeIds, parentComponent);
      if (props) {
        for (const key in props) {
          if (key !== "value" && !isReservedProp(key)) {
            hostPatchProp(el, key, null, props[key], namespace, parentComponent);
          }
        }
        if ("value" in props) {
          hostPatchProp(el, "value", null, props.value, namespace);
        }
        if (vnodeHook = props.onVnodeBeforeMount) {
          invokeVNodeHook(vnodeHook, parentComponent, vnode);
        }
      }
      if (dirs) {
        invokeDirectiveHook(vnode, null, parentComponent, "beforeMount");
      }
      const needCallTransitionHooks = needTransition(parentSuspense, transition);
      if (needCallTransitionHooks) {
        transition.beforeEnter(el);
      }
      hostInsert(el, container, anchor);
      if ((vnodeHook = props && props.onVnodeMounted) || needCallTransitionHooks || dirs) {
        queuePostRenderEffect(() => {
          try {
            vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
            needCallTransitionHooks && transition.enter(el);
            dirs && invokeDirectiveHook(vnode, null, parentComponent, "mounted");
          } finally {
          }
        }, parentSuspense);
      }
    };
    const setScopeId = (el, vnode, scopeId, slotScopeIds, parentComponent) => {
      if (scopeId) {
        hostSetScopeId(el, scopeId);
      }
      if (slotScopeIds) {
        for (let i = 0; i < slotScopeIds.length; i++) {
          hostSetScopeId(el, slotScopeIds[i]);
        }
      }
      if (parentComponent) {
        let subTree = parentComponent.subTree;
        if (vnode === subTree || isSuspense(subTree.type) && (subTree.ssContent === vnode || subTree.ssFallback === vnode)) {
          const parentVNode = parentComponent.vnode;
          setScopeId(
            el,
            parentVNode,
            parentVNode.scopeId,
            parentVNode.slotScopeIds,
            parentComponent.parent
          );
        }
      }
    };
    const mountChildren = (children, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized, start = 0) => {
      for (let i = start; i < children.length; i++) {
        const child = children[i] = optimized ? cloneIfMounted(children[i]) : normalizeVNode(children[i]);
        patch(
          null,
          child,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      }
    };
    const patchElement = (n1, n2, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      const el = n2.el = n1.el;
      let { patchFlag, dynamicChildren, dirs } = n2;
      patchFlag |= n1.patchFlag & 16;
      const oldProps = n1.props || EMPTY_OBJ;
      const newProps = n2.props || EMPTY_OBJ;
      let vnodeHook;
      parentComponent && toggleRecurse(parentComponent, false);
      if (vnodeHook = newProps.onVnodeBeforeUpdate) {
        invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
      }
      if (dirs) {
        invokeDirectiveHook(n2, n1, parentComponent, "beforeUpdate");
      }
      parentComponent && toggleRecurse(parentComponent, true);
      if (oldProps.innerHTML && newProps.innerHTML == null || oldProps.textContent && newProps.textContent == null) {
        hostSetElementText(el, "");
      }
      if (dynamicChildren) {
        patchBlockChildren(
          n1.dynamicChildren,
          dynamicChildren,
          el,
          parentComponent,
          parentSuspense,
          resolveChildrenNamespace(n2, namespace),
          slotScopeIds
        );
      } else if (!optimized) {
        patchChildren(
          n1,
          n2,
          el,
          null,
          parentComponent,
          parentSuspense,
          resolveChildrenNamespace(n2, namespace),
          slotScopeIds,
          false
        );
      }
      if (patchFlag > 0) {
        if (patchFlag & 16) {
          patchProps(el, oldProps, newProps, parentComponent, namespace);
        } else {
          if (patchFlag & 2) {
            if (oldProps.class !== newProps.class) {
              hostPatchProp(el, "class", null, newProps.class, namespace);
            }
          }
          if (patchFlag & 4) {
            hostPatchProp(el, "style", oldProps.style, newProps.style, namespace);
          }
          if (patchFlag & 8) {
            const propsToUpdate = n2.dynamicProps;
            for (let i = 0; i < propsToUpdate.length; i++) {
              const key = propsToUpdate[i];
              const prev = oldProps[key];
              const next = newProps[key];
              if (next !== prev || key === "value") {
                hostPatchProp(el, key, prev, next, namespace, parentComponent);
              }
            }
          }
        }
        if (patchFlag & 1) {
          if (n1.children !== n2.children) {
            hostSetElementText(el, n2.children);
          }
        }
      } else if (!optimized && dynamicChildren == null) {
        patchProps(el, oldProps, newProps, parentComponent, namespace);
      }
      if ((vnodeHook = newProps.onVnodeUpdated) || dirs) {
        queuePostRenderEffect(() => {
          vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, n2, n1);
          dirs && invokeDirectiveHook(n2, n1, parentComponent, "updated");
        }, parentSuspense);
      }
    };
    const patchBlockChildren = (oldChildren, newChildren, fallbackContainer, parentComponent, parentSuspense, namespace, slotScopeIds) => {
      for (let i = 0; i < newChildren.length; i++) {
        const oldVNode = oldChildren[i];
        const newVNode = newChildren[i];
        const container = (
          // oldVNode may be an errored async setup() component inside Suspense
          // which will not have a mounted element
          oldVNode.el && // - In the case of a Fragment, we need to provide the actual parent
          // of the Fragment itself so it can move its children.
          (oldVNode.type === Fragment || // - In the case of different nodes, there is going to be a replacement
          // which also requires the correct parent container
          !isSameVNodeType(oldVNode, newVNode) || // - In the case of a component, it could contain anything.
          oldVNode.shapeFlag & (6 | 64 | 128)) ? hostParentNode(oldVNode.el) : (
            // In other cases, the parent container is not actually used so we
            // just pass the block element here to avoid a DOM parentNode call.
            fallbackContainer
          )
        );
        patch(
          oldVNode,
          newVNode,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          true
        );
      }
    };
    const patchProps = (el, oldProps, newProps, parentComponent, namespace) => {
      if (oldProps !== newProps) {
        if (oldProps !== EMPTY_OBJ) {
          for (const key in oldProps) {
            if (!isReservedProp(key) && !(key in newProps)) {
              hostPatchProp(
                el,
                key,
                oldProps[key],
                null,
                namespace,
                parentComponent
              );
            }
          }
        }
        for (const key in newProps) {
          if (isReservedProp(key)) continue;
          const next = newProps[key];
          const prev = oldProps[key];
          if (next !== prev && key !== "value") {
            hostPatchProp(el, key, prev, next, namespace, parentComponent);
          }
        }
        if ("value" in newProps) {
          hostPatchProp(el, "value", oldProps.value, newProps.value, namespace);
        }
      }
    };
    const processFragment = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      const fragmentStartAnchor = n2.el = n1 ? n1.el : hostCreateText("");
      const fragmentEndAnchor = n2.anchor = n1 ? n1.anchor : hostCreateText("");
      let { patchFlag, dynamicChildren, slotScopeIds: fragmentSlotScopeIds } = n2;
      if (fragmentSlotScopeIds) {
        slotScopeIds = slotScopeIds ? slotScopeIds.concat(fragmentSlotScopeIds) : fragmentSlotScopeIds;
      }
      if (n1 == null) {
        hostInsert(fragmentStartAnchor, container, anchor);
        hostInsert(fragmentEndAnchor, container, anchor);
        mountChildren(
          // #10007
          // such fragment like `<></>` will be compiled into
          // a fragment which doesn't have a children.
          // In this case fallback to an empty array
          n2.children || [],
          container,
          fragmentEndAnchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      } else {
        if (patchFlag > 0 && patchFlag & 64 && dynamicChildren && // #2715 the previous fragment could've been a BAILed one as a result
        // of renderSlot() with no valid children
        n1.dynamicChildren && n1.dynamicChildren.length === dynamicChildren.length) {
          patchBlockChildren(
            n1.dynamicChildren,
            dynamicChildren,
            container,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds
          );
          if (
            // #2080 if the stable fragment has a key, it's a <template v-for> that may
            //  get moved around. Make sure all root level vnodes inherit el.
            // #2134 or if it's a component root, it may also get moved around
            // as the component is being moved.
            n2.key != null || parentComponent && n2 === parentComponent.subTree
          ) {
            traverseStaticChildren(
              n1,
              n2,
              true
              /* shallow */
            );
          }
        } else {
          patchChildren(
            n1,
            n2,
            container,
            fragmentEndAnchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        }
      }
    };
    const processComponent = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      n2.slotScopeIds = slotScopeIds;
      if (n1 == null) {
        if (n2.shapeFlag & 512) {
          parentComponent.ctx.activate(
            n2,
            container,
            anchor,
            namespace,
            optimized
          );
        } else {
          mountComponent(
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            optimized
          );
        }
      } else {
        updateComponent(n1, n2, optimized);
      }
    };
    const mountComponent = (initialVNode, container, anchor, parentComponent, parentSuspense, namespace, optimized) => {
      const instance = initialVNode.component = createComponentInstance(
        initialVNode,
        parentComponent,
        parentSuspense
      );
      if (isKeepAlive(initialVNode)) {
        instance.ctx.renderer = internals;
      }
      {
        setupComponent(instance, false, optimized);
      }
      if (instance.asyncDep) {
        parentSuspense && parentSuspense.registerDep(instance, setupRenderEffect, optimized);
        if (!initialVNode.el) {
          const placeholder = instance.subTree = createVNode(Comment);
          processCommentNode(null, placeholder, container, anchor);
          initialVNode.placeholder = placeholder.el;
        }
      } else {
        setupRenderEffect(
          instance,
          initialVNode,
          container,
          anchor,
          parentSuspense,
          namespace,
          optimized
        );
      }
    };
    const updateComponent = (n1, n2, optimized) => {
      const instance = n2.component = n1.component;
      if (shouldUpdateComponent(n1, n2, optimized)) {
        if (instance.asyncDep && !instance.asyncResolved) {
          updateComponentPreRender(instance, n2, optimized);
          return;
        } else {
          instance.next = n2;
          instance.update();
        }
      } else {
        n2.el = n1.el;
        instance.vnode = n2;
      }
    };
    const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, namespace, optimized) => {
      const componentUpdateFn = () => {
        if (!instance.isMounted) {
          let vnodeHook;
          const { el, props } = initialVNode;
          const { bm, m, parent, root, type } = instance;
          const isAsyncWrapperVNode = isAsyncWrapper(initialVNode);
          toggleRecurse(instance, false);
          if (bm) {
            invokeArrayFns(bm);
          }
          if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeBeforeMount)) {
            invokeVNodeHook(vnodeHook, parent, initialVNode);
          }
          toggleRecurse(instance, true);
          {
            if (root.ce && root.ce._hasShadowRoot()) {
              root.ce._injectChildStyle(
                type,
                instance.parent ? instance.parent.type : void 0
              );
            }
            const subTree = instance.subTree = renderComponentRoot(instance);
            patch(
              null,
              subTree,
              container,
              anchor,
              instance,
              parentSuspense,
              namespace
            );
            initialVNode.el = subTree.el;
          }
          if (m) {
            queuePostRenderEffect(m, parentSuspense);
          }
          if (!isAsyncWrapperVNode && (vnodeHook = props && props.onVnodeMounted)) {
            const scopedInitialVNode = initialVNode;
            queuePostRenderEffect(
              () => invokeVNodeHook(vnodeHook, parent, scopedInitialVNode),
              parentSuspense
            );
          }
          if (initialVNode.shapeFlag & 256 || parent && isAsyncWrapper(parent.vnode) && parent.vnode.shapeFlag & 256) {
            instance.a && queuePostRenderEffect(instance.a, parentSuspense);
          }
          instance.isMounted = true;
          initialVNode = container = anchor = null;
        } else {
          let { next, bu, u, parent, vnode } = instance;
          {
            const nonHydratedAsyncRoot = locateNonHydratedAsyncRoot(instance);
            if (nonHydratedAsyncRoot) {
              if (next) {
                next.el = vnode.el;
                updateComponentPreRender(instance, next, optimized);
              }
              nonHydratedAsyncRoot.asyncDep.then(() => {
                queuePostRenderEffect(() => {
                  if (!instance.isUnmounted) update();
                }, parentSuspense);
              });
              return;
            }
          }
          let originNext = next;
          let vnodeHook;
          toggleRecurse(instance, false);
          if (next) {
            next.el = vnode.el;
            updateComponentPreRender(instance, next, optimized);
          } else {
            next = vnode;
          }
          if (bu) {
            invokeArrayFns(bu);
          }
          if (vnodeHook = next.props && next.props.onVnodeBeforeUpdate) {
            invokeVNodeHook(vnodeHook, parent, next, vnode);
          }
          toggleRecurse(instance, true);
          const nextTree = renderComponentRoot(instance);
          const prevTree = instance.subTree;
          instance.subTree = nextTree;
          patch(
            prevTree,
            nextTree,
            // parent may have changed if it's in a teleport
            hostParentNode(prevTree.el),
            // anchor may have changed if it's in a fragment
            getNextHostNode(prevTree),
            instance,
            parentSuspense,
            namespace
          );
          next.el = nextTree.el;
          if (originNext === null) {
            updateHOCHostEl(instance, nextTree.el);
          }
          if (u) {
            queuePostRenderEffect(u, parentSuspense);
          }
          if (vnodeHook = next.props && next.props.onVnodeUpdated) {
            queuePostRenderEffect(
              () => invokeVNodeHook(vnodeHook, parent, next, vnode),
              parentSuspense
            );
          }
        }
      };
      instance.scope.on();
      const effect2 = instance.effect = new ReactiveEffect(componentUpdateFn);
      instance.scope.off();
      const update = instance.update = effect2.run.bind(effect2);
      const job = instance.job = effect2.runIfDirty.bind(effect2);
      job.i = instance;
      job.id = instance.uid;
      effect2.scheduler = () => queueJob(job);
      toggleRecurse(instance, true);
      update();
    };
    const updateComponentPreRender = (instance, nextVNode, optimized) => {
      nextVNode.component = instance;
      const prevProps = instance.vnode.props;
      instance.vnode = nextVNode;
      instance.next = null;
      updateProps(instance, nextVNode.props, prevProps, optimized);
      updateSlots(instance, nextVNode.children, optimized);
      pauseTracking();
      flushPreFlushCbs(instance);
      resetTracking();
    };
    const patchChildren = (n1, n2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized = false) => {
      const c1 = n1 && n1.children;
      const prevShapeFlag = n1 ? n1.shapeFlag : 0;
      const c2 = n2.children;
      const { patchFlag, shapeFlag } = n2;
      if (patchFlag > 0) {
        if (patchFlag & 128) {
          patchKeyedChildren(
            c1,
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          return;
        } else if (patchFlag & 256) {
          patchUnkeyedChildren(
            c1,
            c2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
          return;
        }
      }
      if (shapeFlag & 8) {
        if (prevShapeFlag & 16) {
          unmountChildren(c1, parentComponent, parentSuspense);
        }
        if (c2 !== c1) {
          hostSetElementText(container, c2);
        }
      } else {
        if (prevShapeFlag & 16) {
          if (shapeFlag & 16) {
            patchKeyedChildren(
              c1,
              c2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else {
            unmountChildren(c1, parentComponent, parentSuspense, true);
          }
        } else {
          if (prevShapeFlag & 8) {
            hostSetElementText(container, "");
          }
          if (shapeFlag & 16) {
            mountChildren(
              c2,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          }
        }
      }
    };
    const patchUnkeyedChildren = (c1, c2, container, anchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      c1 = c1 || EMPTY_ARR;
      c2 = c2 || EMPTY_ARR;
      const oldLength = c1.length;
      const newLength = c2.length;
      const commonLength = Math.min(oldLength, newLength);
      let i;
      for (i = 0; i < commonLength; i++) {
        const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
        patch(
          c1[i],
          nextChild,
          container,
          null,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized
        );
      }
      if (oldLength > newLength) {
        unmountChildren(
          c1,
          parentComponent,
          parentSuspense,
          true,
          false,
          commonLength
        );
      } else {
        mountChildren(
          c2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          namespace,
          slotScopeIds,
          optimized,
          commonLength
        );
      }
    };
    const patchKeyedChildren = (c1, c2, container, parentAnchor, parentComponent, parentSuspense, namespace, slotScopeIds, optimized) => {
      let i = 0;
      const l2 = c2.length;
      let e1 = c1.length - 1;
      let e2 = l2 - 1;
      while (i <= e1 && i <= e2) {
        const n1 = c1[i];
        const n2 = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
        if (isSameVNodeType(n1, n2)) {
          patch(
            n1,
            n2,
            container,
            null,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else {
          break;
        }
        i++;
      }
      while (i <= e1 && i <= e2) {
        const n1 = c1[e1];
        const n2 = c2[e2] = optimized ? cloneIfMounted(c2[e2]) : normalizeVNode(c2[e2]);
        if (isSameVNodeType(n1, n2)) {
          patch(
            n1,
            n2,
            container,
            null,
            parentComponent,
            parentSuspense,
            namespace,
            slotScopeIds,
            optimized
          );
        } else {
          break;
        }
        e1--;
        e2--;
      }
      if (i > e1) {
        if (i <= e2) {
          const nextPos = e2 + 1;
          const anchor = nextPos < l2 ? c2[nextPos].el : parentAnchor;
          while (i <= e2) {
            patch(
              null,
              c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]),
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
            i++;
          }
        }
      } else if (i > e2) {
        while (i <= e1) {
          unmount2(c1[i], parentComponent, parentSuspense, true);
          i++;
        }
      } else {
        const s1 = i;
        const s2 = i;
        const keyToNewIndexMap = /* @__PURE__ */ new Map();
        for (i = s2; i <= e2; i++) {
          const nextChild = c2[i] = optimized ? cloneIfMounted(c2[i]) : normalizeVNode(c2[i]);
          if (nextChild.key != null) {
            keyToNewIndexMap.set(nextChild.key, i);
          }
        }
        let j;
        let patched = 0;
        const toBePatched = e2 - s2 + 1;
        let moved = false;
        let maxNewIndexSoFar = 0;
        const newIndexToOldIndexMap = new Array(toBePatched);
        for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;
        for (i = s1; i <= e1; i++) {
          const prevChild = c1[i];
          if (patched >= toBePatched) {
            unmount2(prevChild, parentComponent, parentSuspense, true);
            continue;
          }
          let newIndex;
          if (prevChild.key != null) {
            newIndex = keyToNewIndexMap.get(prevChild.key);
          } else {
            for (j = s2; j <= e2; j++) {
              if (newIndexToOldIndexMap[j - s2] === 0 && isSameVNodeType(prevChild, c2[j])) {
                newIndex = j;
                break;
              }
            }
          }
          if (newIndex === void 0) {
            unmount2(prevChild, parentComponent, parentSuspense, true);
          } else {
            newIndexToOldIndexMap[newIndex - s2] = i + 1;
            if (newIndex >= maxNewIndexSoFar) {
              maxNewIndexSoFar = newIndex;
            } else {
              moved = true;
            }
            patch(
              prevChild,
              c2[newIndex],
              container,
              null,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
            patched++;
          }
        }
        const increasingNewIndexSequence = moved ? getSequence(newIndexToOldIndexMap) : EMPTY_ARR;
        j = increasingNewIndexSequence.length - 1;
        for (i = toBePatched - 1; i >= 0; i--) {
          const nextIndex = s2 + i;
          const nextChild = c2[nextIndex];
          const anchorVNode = c2[nextIndex + 1];
          const anchor = nextIndex + 1 < l2 ? (
            // #13559, #14173 fallback to el placeholder for unresolved async component
            anchorVNode.el || resolveAsyncComponentPlaceholder(anchorVNode)
          ) : parentAnchor;
          if (newIndexToOldIndexMap[i] === 0) {
            patch(
              null,
              nextChild,
              container,
              anchor,
              parentComponent,
              parentSuspense,
              namespace,
              slotScopeIds,
              optimized
            );
          } else if (moved) {
            if (j < 0 || i !== increasingNewIndexSequence[j]) {
              move(nextChild, container, anchor, 2);
            } else {
              j--;
            }
          }
        }
      }
    };
    const move = (vnode, container, anchor, moveType, parentSuspense = null) => {
      const { el, type, transition, children, shapeFlag } = vnode;
      if (shapeFlag & 6) {
        move(vnode.component.subTree, container, anchor, moveType);
        return;
      }
      if (shapeFlag & 128) {
        vnode.suspense.move(container, anchor, moveType);
        return;
      }
      if (shapeFlag & 64) {
        type.move(vnode, container, anchor, internals);
        return;
      }
      if (type === Fragment) {
        hostInsert(el, container, anchor);
        for (let i = 0; i < children.length; i++) {
          move(children[i], container, anchor, moveType);
        }
        hostInsert(vnode.anchor, container, anchor);
        return;
      }
      if (type === Static) {
        moveStaticNode(vnode, container, anchor);
        return;
      }
      const needTransition2 = moveType !== 2 && shapeFlag & 1 && transition;
      if (needTransition2) {
        if (moveType === 0) {
          if (transition.persisted && !el[leaveCbKey]) {
            hostInsert(el, container, anchor);
          } else {
            transition.beforeEnter(el);
            hostInsert(el, container, anchor);
            queuePostRenderEffect(() => transition.enter(el), parentSuspense);
          }
        } else {
          const { leave, delayLeave, afterLeave } = transition;
          const remove22 = () => {
            if (vnode.ctx.isUnmounted) {
              hostRemove(el);
            } else {
              hostInsert(el, container, anchor);
            }
          };
          const performLeave = () => {
            const wasLeaving = el._isLeaving || !!el[leaveCbKey];
            if (el._isLeaving) {
              el[leaveCbKey](
                true
                /* cancelled */
              );
            }
            if (transition.persisted && !wasLeaving) {
              remove22();
            } else {
              leave(el, () => {
                remove22();
                afterLeave && afterLeave();
              });
            }
          };
          if (delayLeave) {
            delayLeave(el, remove22, performLeave);
          } else {
            performLeave();
          }
        }
      } else {
        hostInsert(el, container, anchor);
      }
    };
    const unmount2 = (vnode, parentComponent, parentSuspense, doRemove = false, optimized = false) => {
      const {
        type,
        props,
        ref: ref3,
        children,
        dynamicChildren,
        shapeFlag,
        patchFlag,
        dirs,
        cacheIndex,
        memo
      } = vnode;
      if (patchFlag === -2) {
        optimized = false;
      }
      if (ref3 != null) {
        pauseTracking();
        setRef(ref3, null, parentSuspense, vnode, true);
        resetTracking();
      }
      if (cacheIndex != null) {
        parentComponent.renderCache[cacheIndex] = void 0;
      }
      if (shapeFlag & 256) {
        parentComponent.ctx.deactivate(vnode);
        return;
      }
      const shouldInvokeDirs = shapeFlag & 1 && dirs;
      const shouldInvokeVnodeHook = !isAsyncWrapper(vnode);
      let vnodeHook;
      if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeBeforeUnmount)) {
        invokeVNodeHook(vnodeHook, parentComponent, vnode);
      }
      if (shapeFlag & 6) {
        unmountComponent(vnode.component, parentSuspense, doRemove);
      } else {
        if (shapeFlag & 128) {
          vnode.suspense.unmount(parentSuspense, doRemove);
          return;
        }
        if (shouldInvokeDirs) {
          invokeDirectiveHook(vnode, null, parentComponent, "beforeUnmount");
        }
        if (shapeFlag & 64) {
          vnode.type.remove(
            vnode,
            parentComponent,
            parentSuspense,
            internals,
            doRemove
          );
        } else if (dynamicChildren && // #5154
        // when v-once is used inside a block, setBlockTracking(-1) marks the
        // parent block with hasOnce: true
        // so that it doesn't take the fast path during unmount - otherwise
        // components nested in v-once are never unmounted.
        !dynamicChildren.hasOnce && // #1153: fast path should not be taken for non-stable (v-for) fragments
        (type !== Fragment || patchFlag > 0 && patchFlag & 64)) {
          unmountChildren(
            dynamicChildren,
            parentComponent,
            parentSuspense,
            false,
            true
          );
        } else if (type === Fragment && patchFlag & (128 | 256) || !optimized && shapeFlag & 16) {
          unmountChildren(children, parentComponent, parentSuspense);
        }
        if (doRemove) {
          remove2(vnode);
        }
      }
      const shouldInvalidateMemo = memo != null && cacheIndex == null;
      if (shouldInvokeVnodeHook && (vnodeHook = props && props.onVnodeUnmounted) || shouldInvokeDirs || shouldInvalidateMemo) {
        queuePostRenderEffect(() => {
          vnodeHook && invokeVNodeHook(vnodeHook, parentComponent, vnode);
          shouldInvokeDirs && invokeDirectiveHook(vnode, null, parentComponent, "unmounted");
          if (shouldInvalidateMemo) {
            vnode.el = null;
          }
        }, parentSuspense);
      }
    };
    const remove2 = (vnode) => {
      const { type, el, anchor, transition } = vnode;
      if (type === Fragment) {
        {
          removeFragment(el, anchor);
        }
        return;
      }
      if (type === Static) {
        removeStaticNode(vnode);
        return;
      }
      const performRemove = () => {
        hostRemove(el);
        if (transition && !transition.persisted && transition.afterLeave) {
          transition.afterLeave();
        }
      };
      if (vnode.shapeFlag & 1 && transition && !transition.persisted) {
        const { leave, delayLeave } = transition;
        const performLeave = () => leave(el, performRemove);
        if (delayLeave) {
          delayLeave(vnode.el, performRemove, performLeave);
        } else {
          performLeave();
        }
      } else {
        performRemove();
      }
    };
    const removeFragment = (cur, end) => {
      let next;
      while (cur !== end) {
        next = hostNextSibling(cur);
        hostRemove(cur);
        cur = next;
      }
      hostRemove(end);
    };
    const unmountComponent = (instance, parentSuspense, doRemove) => {
      const { bum, scope, job, subTree, um, m, a } = instance;
      invalidateMount(m);
      invalidateMount(a);
      if (bum) {
        invokeArrayFns(bum);
      }
      scope.stop();
      if (job) {
        job.flags |= 8;
        unmount2(subTree, instance, parentSuspense, doRemove);
      }
      if (um) {
        queuePostRenderEffect(um, parentSuspense);
      }
      queuePostRenderEffect(() => {
        instance.isUnmounted = true;
      }, parentSuspense);
    };
    const unmountChildren = (children, parentComponent, parentSuspense, doRemove = false, optimized = false, start = 0) => {
      for (let i = start; i < children.length; i++) {
        unmount2(children[i], parentComponent, parentSuspense, doRemove, optimized);
      }
    };
    const getNextHostNode = (vnode) => {
      if (vnode.shapeFlag & 6) {
        return getNextHostNode(vnode.component.subTree);
      }
      if (vnode.shapeFlag & 128) {
        return vnode.suspense.next();
      }
      const el = hostNextSibling(vnode.anchor || vnode.el);
      const teleportEnd = el && el[TeleportEndKey];
      return teleportEnd ? hostNextSibling(teleportEnd) : el;
    };
    let isFlushing = false;
    const render2 = (vnode, container, namespace) => {
      let instance;
      if (vnode == null) {
        if (container._vnode) {
          unmount2(container._vnode, null, null, true);
          instance = container._vnode.component;
        }
      } else {
        patch(
          container._vnode || null,
          vnode,
          container,
          null,
          null,
          null,
          namespace
        );
      }
      container._vnode = vnode;
      if (!isFlushing) {
        isFlushing = true;
        flushPreFlushCbs(instance);
        flushPostFlushCbs();
        isFlushing = false;
      }
    };
    const internals = {
      p: patch,
      um: unmount2,
      m: move,
      r: remove2,
      mt: mountComponent,
      mc: mountChildren,
      pc: patchChildren,
      pbc: patchBlockChildren,
      n: getNextHostNode,
      o: options
    };
    let hydrate;
    return {
      render: render2,
      hydrate,
      createApp: createAppAPI(render2)
    };
  }
  function resolveChildrenNamespace({ type, props }, currentNamespace) {
    return currentNamespace === "svg" && type === "foreignObject" || currentNamespace === "mathml" && type === "annotation-xml" && props && props.encoding && props.encoding.includes("html") ? void 0 : currentNamespace;
  }
  function toggleRecurse({ effect: effect2, job }, allowed) {
    if (allowed) {
      effect2.flags |= 32;
      job.flags |= 4;
    } else {
      effect2.flags &= -33;
      job.flags &= -5;
    }
  }
  function needTransition(parentSuspense, transition) {
    return (!parentSuspense || parentSuspense && !parentSuspense.pendingBranch) && transition && !transition.persisted;
  }
  function traverseStaticChildren(n1, n2, shallow = false) {
    const ch1 = n1.children;
    const ch2 = n2.children;
    if (isArray(ch1) && isArray(ch2)) {
      for (let i = 0; i < ch1.length; i++) {
        const c1 = ch1[i];
        let c2 = ch2[i];
        if (c2.shapeFlag & 1 && !c2.dynamicChildren) {
          if (c2.patchFlag <= 0 || c2.patchFlag === 32) {
            c2 = ch2[i] = cloneIfMounted(ch2[i]);
            c2.el = c1.el;
          }
          if (!shallow && c2.patchFlag !== -2)
            traverseStaticChildren(c1, c2);
        }
        if (c2.type === Text) {
          if (c2.patchFlag === -1) {
            c2 = ch2[i] = cloneIfMounted(c2);
          }
          c2.el = c1.el;
        }
        if (c2.type === Comment && !c2.el) {
          c2.el = c1.el;
        }
      }
    }
  }
  function getSequence(arr) {
    const p2 = arr.slice();
    const result = [0];
    let i, j, u, v, c2;
    const len = arr.length;
    for (i = 0; i < len; i++) {
      const arrI = arr[i];
      if (arrI !== 0) {
        j = result[result.length - 1];
        if (arr[j] < arrI) {
          p2[i] = j;
          result.push(i);
          continue;
        }
        u = 0;
        v = result.length - 1;
        while (u < v) {
          c2 = u + v >> 1;
          if (arr[result[c2]] < arrI) {
            u = c2 + 1;
          } else {
            v = c2;
          }
        }
        if (arrI < arr[result[u]]) {
          if (u > 0) {
            p2[i] = result[u - 1];
          }
          result[u] = i;
        }
      }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
      result[u] = v;
      v = p2[v];
    }
    return result;
  }
  function locateNonHydratedAsyncRoot(instance) {
    const subComponent = instance.subTree.component;
    if (subComponent) {
      if (subComponent.asyncDep && !subComponent.asyncResolved) {
        return subComponent;
      } else {
        return locateNonHydratedAsyncRoot(subComponent);
      }
    }
  }
  function invalidateMount(hooks) {
    if (hooks) {
      for (let i = 0; i < hooks.length; i++)
        hooks[i].flags |= 8;
    }
  }
  function resolveAsyncComponentPlaceholder(anchorVnode) {
    if (anchorVnode.placeholder) {
      return anchorVnode.placeholder;
    }
    const instance = anchorVnode.component;
    if (instance) {
      return resolveAsyncComponentPlaceholder(instance.subTree);
    }
    return null;
  }
  const isSuspense = (type) => type.__isSuspense;
  function queueEffectWithSuspense(fn, suspense) {
    if (suspense && suspense.pendingBranch) {
      if (isArray(fn)) {
        suspense.effects.push(...fn);
      } else {
        suspense.effects.push(fn);
      }
    } else {
      queuePostFlushCb(fn);
    }
  }
  const Fragment = /* @__PURE__ */ Symbol.for("v-fgt");
  const Text = /* @__PURE__ */ Symbol.for("v-txt");
  const Comment = /* @__PURE__ */ Symbol.for("v-cmt");
  const Static = /* @__PURE__ */ Symbol.for("v-stc");
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
  function isSameVNodeType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key;
  }
  const normalizeKey = ({ key }) => key != null ? key : null;
  const normalizeRef = ({
    ref: ref3,
    ref_key,
    ref_for
  }) => {
    if (typeof ref3 === "number") {
      ref3 = "" + ref3;
    }
    return ref3 != null ? isString(ref3) || /* @__PURE__ */ isRef(ref3) || isFunction(ref3) ? { i: currentRenderingInstance, r: ref3, k: ref_key, f: !!ref_for } : ref3 : null;
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
  const createVNode = _createVNode;
  function _createVNode(type, props = null, children = null, patchFlag = 0, dynamicProps = null, isBlockNode = false) {
    if (!type || type === NULL_DYNAMIC_COMPONENT) {
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
      let { class: klass, style: style2 } = props;
      if (klass && !isString(klass)) {
        props.class = normalizeClass(klass);
      }
      if (isObject(style2)) {
        if (/* @__PURE__ */ isProxy(style2) && !isArray(style2)) {
          style2 = extend({}, style2);
        }
        props.style = normalizeStyle(style2);
      }
    }
    const shapeFlag = isString(type) ? 1 : isSuspense(type) ? 128 : isTeleport(type) ? 64 : isObject(type) ? 4 : isFunction(type) ? 2 : 0;
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
    return /* @__PURE__ */ isProxy(props) || isInternalObject(props) ? extend({}, props) : props;
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
      children,
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
  function normalizeVNode(child) {
    if (child == null || typeof child === "boolean") {
      return createVNode(Comment);
    } else if (isArray(child)) {
      return createVNode(
        Fragment,
        null,
        // #3666, avoid reference pollution when reusing vnode
        child.slice()
      );
    } else if (isVNode(child)) {
      return cloneIfMounted(child);
    } else {
      return createVNode(Text, null, String(child));
    }
  }
  function cloneIfMounted(child) {
    return child.el === null && child.patchFlag !== -1 || child.memo ? child : cloneVNode(child);
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
          } else if (incoming == null && existing == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
          // the model listener.
          !isModelListener(key)) {
            ret[key] = incoming;
          }
        } else if (key !== "") {
          ret[key] = toMerge[key];
        }
      }
    }
    return ret;
  }
  function invokeVNodeHook(hook, instance, vnode, prevVNode = null) {
    callWithAsyncErrorHandling(hook, instance, 7, [
      vnode,
      prevVNode
    ]);
  }
  const emptyAppContext = createAppContext();
  let uid = 0;
  function createComponentInstance(vnode, parent, suspense) {
    const type = vnode.type;
    const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
    const instance = {
      uid: uid++,
      vnode,
      type,
      parent,
      appContext,
      root: null,
      // to be immediately set
      next: null,
      subTree: null,
      // will be set synchronously right after creation
      effect: null,
      update: null,
      // will be set synchronously right after creation
      job: null,
      scope: new EffectScope(
        true
        /* detached */
      ),
      render: null,
      proxy: null,
      exposed: null,
      exposeProxy: null,
      withProxy: null,
      provides: parent ? parent.provides : Object.create(appContext.provides),
      ids: parent ? parent.ids : ["", 0, 0],
      accessCache: null,
      renderCache: [],
      // local resolved assets
      components: null,
      directives: null,
      // resolved props and emits options
      propsOptions: normalizePropsOptions(type, appContext),
      emitsOptions: normalizeEmitsOptions(type, appContext),
      // emit
      emit: null,
      // to be set immediately
      emitted: null,
      // props default value
      propsDefaults: EMPTY_OBJ,
      // inheritAttrs
      inheritAttrs: type.inheritAttrs,
      // state
      ctx: EMPTY_OBJ,
      data: EMPTY_OBJ,
      props: EMPTY_OBJ,
      attrs: EMPTY_OBJ,
      slots: EMPTY_OBJ,
      refs: EMPTY_OBJ,
      setupState: EMPTY_OBJ,
      setupContext: null,
      // suspense related
      suspense,
      suspenseId: suspense ? suspense.pendingId : 0,
      asyncDep: null,
      asyncResolved: false,
      // lifecycle hooks
      // not using enums here because it results in computed properties
      isMounted: false,
      isUnmounted: false,
      isDeactivated: false,
      bc: null,
      c: null,
      bm: null,
      m: null,
      bu: null,
      u: null,
      um: null,
      bum: null,
      da: null,
      a: null,
      rtg: null,
      rtc: null,
      ec: null,
      sp: null
    };
    {
      instance.ctx = { _: instance };
    }
    instance.root = parent ? parent.root : instance;
    instance.emit = emit.bind(null, instance);
    if (vnode.ce) {
      vnode.ce(instance);
    }
    return instance;
  }
  let currentInstance = null;
  const getCurrentInstance = () => currentInstance || currentRenderingInstance;
  let internalSetCurrentInstance;
  let setInSSRSetupState;
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
    internalSetCurrentInstance = registerGlobalSetter(
      `__VUE_INSTANCE_SETTERS__`,
      (v) => currentInstance = v
    );
    setInSSRSetupState = registerGlobalSetter(
      `__VUE_SSR_SETTERS__`,
      (v) => isInSSRComponentSetup = v
    );
  }
  const setCurrentInstance = (instance) => {
    const prev = currentInstance;
    internalSetCurrentInstance(instance);
    instance.scope.on();
    return () => {
      instance.scope.off();
      internalSetCurrentInstance(prev);
    };
  };
  const unsetCurrentInstance = () => {
    currentInstance && currentInstance.scope.off();
    internalSetCurrentInstance(null);
  };
  function isStatefulComponent(instance) {
    return instance.vnode.shapeFlag & 4;
  }
  let isInSSRComponentSetup = false;
  function setupComponent(instance, isSSR = false, optimized = false) {
    isSSR && setInSSRSetupState(isSSR);
    const { props, children } = instance.vnode;
    const isStateful = isStatefulComponent(instance);
    initProps(instance, props, isStateful, isSSR);
    initSlots(instance, children, optimized || isSSR);
    const setupResult = isStateful ? setupStatefulComponent(instance, isSSR) : void 0;
    isSSR && setInSSRSetupState(false);
    return setupResult;
  }
  function setupStatefulComponent(instance, isSSR) {
    const Component = instance.type;
    instance.accessCache = /* @__PURE__ */ Object.create(null);
    instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers);
    const { setup } = Component;
    if (setup) {
      pauseTracking();
      const setupContext = instance.setupContext = setup.length > 1 ? createSetupContext(instance) : null;
      const reset = setCurrentInstance(instance);
      const setupResult = callWithErrorHandling(
        setup,
        instance,
        0,
        [
          instance.props,
          setupContext
        ]
      );
      const isAsyncSetup = isPromise(setupResult);
      resetTracking();
      reset();
      if ((isAsyncSetup || instance.sp) && !isAsyncWrapper(instance)) {
        markAsyncBoundary(instance);
      }
      if (isAsyncSetup) {
        setupResult.then(unsetCurrentInstance, unsetCurrentInstance);
        if (isSSR) {
          return setupResult.then((resolvedResult) => {
            handleSetupResult(instance, resolvedResult);
          }).catch((e) => {
            handleError(e, instance, 0);
          });
        } else {
          instance.asyncDep = setupResult;
        }
      } else {
        handleSetupResult(instance, setupResult);
      }
    } else {
      finishComponentSetup(instance);
    }
  }
  function handleSetupResult(instance, setupResult, isSSR) {
    if (isFunction(setupResult)) {
      if (instance.type.__ssrInlineRender) {
        instance.ssrRender = setupResult;
      } else {
        instance.render = setupResult;
      }
    } else if (isObject(setupResult)) {
      instance.setupState = proxyRefs(setupResult);
    } else ;
    finishComponentSetup(instance);
  }
  function finishComponentSetup(instance, isSSR, skipOptions) {
    const Component = instance.type;
    if (!instance.render) {
      instance.render = Component.render || NOOP;
    }
    {
      const reset = setCurrentInstance(instance);
      pauseTracking();
      try {
        applyOptions(instance);
      } finally {
        resetTracking();
        reset();
      }
    }
  }
  const attrsProxyHandlers = {
    get(target, key) {
      track(target, "get", "");
      return target[key];
    }
  };
  function createSetupContext(instance) {
    const expose = (exposed) => {
      instance.exposed = exposed || {};
    };
    {
      return {
        attrs: new Proxy(instance.attrs, attrsProxyHandlers),
        slots: instance.slots,
        emit: instance.emit,
        expose
      };
    }
  }
  function getComponentPublicInstance(instance) {
    if (instance.exposed) {
      return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
        get(target, key) {
          if (key in target) {
            return target[key];
          } else if (key in publicPropertiesMap) {
            return publicPropertiesMap[key](instance);
          }
        },
        has(target, key) {
          return key in target || key in publicPropertiesMap;
        }
      }));
    } else {
      return instance.proxy;
    }
  }
  const classifyRE = /(?:^|[-_])\w/g;
  const classify$1 = (str) => str.replace(classifyRE, (c2) => c2.toUpperCase()).replace(/[-_]/g, "");
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
    if (!name && instance) {
      const inferFromRegistry = (registry) => {
        for (const key in registry) {
          if (registry[key] === Component) {
            return key;
          }
        }
      };
      name = inferFromRegistry(instance.components) || instance.parent && inferFromRegistry(
        instance.parent.type.components
      ) || inferFromRegistry(instance.appContext.components);
    }
    return name ? classify$1(name) : isRoot ? `App` : `Anonymous`;
  }
  function isClassComponent(value) {
    return isFunction(value) && "__vccOpts" in value;
  }
  const computed = (getterOrOptions, debugOptions) => {
    const c2 = /* @__PURE__ */ computed$1(getterOrOptions, debugOptions, isInSSRComponentSetup);
    return c2;
  };
  function h(type, propsOrChildren, children) {
    try {
      setBlockTracking(-1);
      const l = arguments.length;
      if (l === 2) {
        if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
          if (isVNode(propsOrChildren)) {
            return createVNode(type, null, [propsOrChildren]);
          }
          return createVNode(type, propsOrChildren);
        } else {
          return createVNode(type, null, propsOrChildren);
        }
      } else {
        if (l > 3) {
          children = Array.prototype.slice.call(arguments, 2);
        } else if (l === 3 && isVNode(children)) {
          children = [children];
        }
        return createVNode(type, propsOrChildren, children);
      }
    } finally {
      setBlockTracking(1);
    }
  }
  const version = "3.5.35";
  /**
  * @vue/runtime-dom v3.5.35
  * (c) 2018-present Yuxi (Evan) You and Vue contributors
  * @license MIT
  **/
  let policy = void 0;
  const tt = typeof window !== "undefined" && window.trustedTypes;
  if (tt) {
    try {
      policy = /* @__PURE__ */ tt.createPolicy("vue", {
        createHTML: (val) => val
      });
    } catch (e) {
    }
  }
  const unsafeToTrustedHTML = policy ? (val) => policy.createHTML(val) : (val) => val;
  const svgNS = "http://www.w3.org/2000/svg";
  const mathmlNS = "http://www.w3.org/1998/Math/MathML";
  const doc = typeof document !== "undefined" ? document : null;
  const templateContainer = doc && /* @__PURE__ */ doc.createElement("template");
  const nodeOps = {
    insert: (child, parent, anchor) => {
      parent.insertBefore(child, anchor || null);
    },
    remove: (child) => {
      const parent = child.parentNode;
      if (parent) {
        parent.removeChild(child);
      }
    },
    createElement: (tag, namespace, is, props) => {
      const el = namespace === "svg" ? doc.createElementNS(svgNS, tag) : namespace === "mathml" ? doc.createElementNS(mathmlNS, tag) : is ? doc.createElement(tag, { is }) : doc.createElement(tag);
      if (tag === "select" && props && props.multiple != null) {
        el.setAttribute("multiple", props.multiple);
      }
      return el;
    },
    createText: (text) => doc.createTextNode(text),
    createComment: (text) => doc.createComment(text),
    setText: (node, text) => {
      node.nodeValue = text;
    },
    setElementText: (el, text) => {
      el.textContent = text;
    },
    parentNode: (node) => node.parentNode,
    nextSibling: (node) => node.nextSibling,
    querySelector: (selector) => doc.querySelector(selector),
    setScopeId(el, id) {
      el.setAttribute(id, "");
    },
    // __UNSAFE__
    // Reason: innerHTML.
    // Static content here can only come from compiled templates.
    // As long as the user only uses trusted templates, this is safe.
    insertStaticContent(content, parent, anchor, namespace, start, end) {
      const before = anchor ? anchor.previousSibling : parent.lastChild;
      if (start && (start === end || start.nextSibling)) {
        while (true) {
          parent.insertBefore(start.cloneNode(true), anchor);
          if (start === end || !(start = start.nextSibling)) break;
        }
      } else {
        templateContainer.innerHTML = unsafeToTrustedHTML(
          namespace === "svg" ? `<svg>${content}</svg>` : namespace === "mathml" ? `<math>${content}</math>` : content
        );
        const template = templateContainer.content;
        if (namespace === "svg" || namespace === "mathml") {
          const wrapper = template.firstChild;
          while (wrapper.firstChild) {
            template.appendChild(wrapper.firstChild);
          }
          template.removeChild(wrapper);
        }
        parent.insertBefore(template, anchor);
      }
      return [
        // first
        before ? before.nextSibling : parent.firstChild,
        // last
        anchor ? anchor.previousSibling : parent.lastChild
      ];
    }
  };
  const vtcKey = /* @__PURE__ */ Symbol("_vtc");
  function patchClass(el, value, isSVG) {
    const transitionClasses = el[vtcKey];
    if (transitionClasses) {
      value = (value ? [value, ...transitionClasses] : [...transitionClasses]).join(" ");
    }
    if (value == null) {
      el.removeAttribute("class");
    } else if (isSVG) {
      el.setAttribute("class", value);
    } else {
      el.className = value;
    }
  }
  const vShowOriginalDisplay = /* @__PURE__ */ Symbol("_vod");
  const vShowHidden = /* @__PURE__ */ Symbol("_vsh");
  const vShow = {
    // used for prop mismatch check during hydration
    name: "show",
    beforeMount(el, { value }, { transition }) {
      el[vShowOriginalDisplay] = el.style.display === "none" ? "" : el.style.display;
      if (transition && value) {
        transition.beforeEnter(el);
      } else {
        setDisplay(el, value);
      }
    },
    mounted(el, { value }, { transition }) {
      if (transition && value) {
        transition.enter(el);
      }
    },
    updated(el, { value, oldValue }, { transition }) {
      if (!value === !oldValue) return;
      if (transition) {
        if (value) {
          transition.beforeEnter(el);
          setDisplay(el, true);
          transition.enter(el);
        } else {
          transition.leave(el, () => {
            setDisplay(el, false);
          });
        }
      } else {
        setDisplay(el, value);
      }
    },
    beforeUnmount(el, { value }) {
      setDisplay(el, value);
    }
  };
  function setDisplay(el, value) {
    el.style.display = value ? el[vShowOriginalDisplay] : "none";
    el[vShowHidden] = !value;
  }
  const CSS_VAR_TEXT = /* @__PURE__ */ Symbol("");
  const displayRE = /(?:^|;)\s*display\s*:/;
  function patchStyle(el, prev, next) {
    const style2 = el.style;
    const isCssString = isString(next);
    let hasControlledDisplay = false;
    if (next && !isCssString) {
      if (prev) {
        if (!isString(prev)) {
          for (const key in prev) {
            if (next[key] == null) {
              setStyle(style2, key, "");
            }
          }
        } else {
          for (const prevStyle of prev.split(";")) {
            const key = prevStyle.slice(0, prevStyle.indexOf(":")).trim();
            if (next[key] == null) {
              setStyle(style2, key, "");
            }
          }
        }
      }
      for (const key in next) {
        if (key === "display") {
          hasControlledDisplay = true;
        }
        const value = next[key];
        if (value != null) {
          if (!shouldPreserveTextareaResizeStyle(
            el,
            key,
            !isString(prev) && prev ? prev[key] : void 0,
            value
          )) {
            setStyle(style2, key, value);
          }
        } else {
          setStyle(style2, key, "");
        }
      }
    } else {
      if (isCssString) {
        if (prev !== next) {
          const cssVarText = style2[CSS_VAR_TEXT];
          if (cssVarText) {
            next += ";" + cssVarText;
          }
          style2.cssText = next;
          hasControlledDisplay = displayRE.test(next);
        }
      } else if (prev) {
        el.removeAttribute("style");
      }
    }
    if (vShowOriginalDisplay in el) {
      el[vShowOriginalDisplay] = hasControlledDisplay ? style2.display : "";
      if (el[vShowHidden]) {
        style2.display = "none";
      }
    }
  }
  const importantRE = /\s*!important$/;
  function setStyle(style2, name, val) {
    if (isArray(val)) {
      val.forEach((v) => setStyle(style2, name, v));
    } else {
      if (val == null) val = "";
      if (name.startsWith("--")) {
        style2.setProperty(name, val);
      } else {
        const prefixed = autoPrefix(style2, name);
        if (importantRE.test(val)) {
          style2.setProperty(
            hyphenate(prefixed),
            val.replace(importantRE, ""),
            "important"
          );
        } else {
          style2[prefixed] = val;
        }
      }
    }
  }
  const prefixes = ["Webkit", "Moz", "ms"];
  const prefixCache = {};
  function autoPrefix(style2, rawName) {
    const cached = prefixCache[rawName];
    if (cached) {
      return cached;
    }
    let name = camelize(rawName);
    if (name !== "filter" && name in style2) {
      return prefixCache[rawName] = name;
    }
    name = capitalize(name);
    for (let i = 0; i < prefixes.length; i++) {
      const prefixed = prefixes[i] + name;
      if (prefixed in style2) {
        return prefixCache[rawName] = prefixed;
      }
    }
    return rawName;
  }
  function shouldPreserveTextareaResizeStyle(el, key, prev, next) {
    return el.tagName === "TEXTAREA" && (key === "width" || key === "height") && isString(next) && prev === next;
  }
  const xlinkNS = "http://www.w3.org/1999/xlink";
  function patchAttr(el, key, value, isSVG, instance, isBoolean = isSpecialBooleanAttr(key)) {
    if (isSVG && key.startsWith("xlink:")) {
      if (value == null) {
        el.removeAttributeNS(xlinkNS, key.slice(6, key.length));
      } else {
        el.setAttributeNS(xlinkNS, key, value);
      }
    } else {
      if (value == null || isBoolean && !includeBooleanAttr(value)) {
        el.removeAttribute(key);
      } else {
        el.setAttribute(
          key,
          isBoolean ? "" : isSymbol(value) ? String(value) : value
        );
      }
    }
  }
  function patchDOMProp(el, key, value, parentComponent, attrName) {
    if (key === "innerHTML" || key === "textContent") {
      if (value != null) {
        el[key] = key === "innerHTML" ? unsafeToTrustedHTML(value) : value;
      }
      return;
    }
    const tag = el.tagName;
    if (key === "value" && tag !== "PROGRESS" && // custom elements may use _value internally
    !tag.includes("-")) {
      const oldValue = tag === "OPTION" ? el.getAttribute("value") || "" : el.value;
      const newValue = value == null ? (
        // #11647: value should be set as empty string for null and undefined,
        // but <input type="checkbox"> should be set as 'on'.
        el.type === "checkbox" ? "on" : ""
      ) : String(value);
      if (oldValue !== newValue || !("_value" in el)) {
        el.value = newValue;
      }
      if (value == null) {
        el.removeAttribute(key);
      }
      el._value = value;
      return;
    }
    let needRemove = false;
    if (value === "" || value == null) {
      const type = typeof el[key];
      if (type === "boolean") {
        value = includeBooleanAttr(value);
      } else if (value == null && type === "string") {
        value = "";
        needRemove = true;
      } else if (type === "number") {
        value = 0;
        needRemove = true;
      }
    }
    try {
      el[key] = value;
    } catch (e) {
    }
    needRemove && el.removeAttribute(attrName || key);
  }
  function addEventListener(el, event, handler, options) {
    el.addEventListener(event, handler, options);
  }
  function removeEventListener(el, event, handler, options) {
    el.removeEventListener(event, handler, options);
  }
  const veiKey = /* @__PURE__ */ Symbol("_vei");
  function patchEvent(el, rawName, prevValue, nextValue, instance = null) {
    const invokers = el[veiKey] || (el[veiKey] = {});
    const existingInvoker = invokers[rawName];
    if (nextValue && existingInvoker) {
      existingInvoker.value = nextValue;
    } else {
      const [name, options] = parseName(rawName);
      if (nextValue) {
        const invoker = invokers[rawName] = createInvoker(
          nextValue,
          instance
        );
        addEventListener(el, name, invoker, options);
      } else if (existingInvoker) {
        removeEventListener(el, name, existingInvoker, options);
        invokers[rawName] = void 0;
      }
    }
  }
  const optionsModifierRE = /(?:Once|Passive|Capture)$/;
  function parseName(name) {
    let options;
    if (optionsModifierRE.test(name)) {
      options = {};
      let m;
      while (m = name.match(optionsModifierRE)) {
        name = name.slice(0, name.length - m[0].length);
        options[m[0].toLowerCase()] = true;
      }
    }
    const event = name[2] === ":" ? name.slice(3) : hyphenate(name.slice(2));
    return [event, options];
  }
  let cachedNow = 0;
  const p = /* @__PURE__ */ Promise.resolve();
  const getNow = () => cachedNow || (p.then(() => cachedNow = 0), cachedNow = Date.now());
  function createInvoker(initialValue, instance) {
    const invoker = (e) => {
      if (!e._vts) {
        e._vts = Date.now();
      } else if (e._vts <= invoker.attached) {
        return;
      }
      const value = invoker.value;
      if (isArray(value)) {
        const originalStop = e.stopImmediatePropagation;
        e.stopImmediatePropagation = () => {
          originalStop.call(e);
          e._stopped = true;
        };
        const handlers = value.slice();
        const args = [e];
        for (let i = 0; i < handlers.length; i++) {
          if (e._stopped) {
            break;
          }
          const handler = handlers[i];
          if (handler) {
            callWithAsyncErrorHandling(
              handler,
              instance,
              5,
              args
            );
          }
        }
      } else {
        callWithAsyncErrorHandling(
          value,
          instance,
          5,
          [e]
        );
      }
    };
    invoker.value = initialValue;
    invoker.attached = getNow();
    return invoker;
  }
  const isNativeOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // lowercase letter
  key.charCodeAt(2) > 96 && key.charCodeAt(2) < 123;
  const patchProp = (el, key, prevValue, nextValue, namespace, parentComponent) => {
    const isSVG = namespace === "svg";
    if (key === "class") {
      patchClass(el, nextValue, isSVG);
    } else if (key === "style") {
      patchStyle(el, prevValue, nextValue);
    } else if (isOn(key)) {
      if (!isModelListener(key)) {
        patchEvent(el, key, prevValue, nextValue, parentComponent);
      }
    } else if (key[0] === "." ? (key = key.slice(1), true) : key[0] === "^" ? (key = key.slice(1), false) : shouldSetAsProp(el, key, nextValue, isSVG)) {
      patchDOMProp(el, key, nextValue);
      if (!el.tagName.includes("-") && (key === "value" || key === "checked" || key === "selected")) {
        patchAttr(el, key, nextValue, isSVG, parentComponent, key !== "value");
      }
    } else if (
      // #11081 force set props for possible async custom element
      el._isVueCE && // #12408 check if it's declared prop or it's async custom element
      (shouldSetAsPropForVueCE(el, key) || // @ts-expect-error _def is private
      el._def.__asyncLoader && (/[A-Z]/.test(key) || !isString(nextValue)))
    ) {
      patchDOMProp(el, camelize(key), nextValue, parentComponent, key);
    } else {
      if (key === "true-value") {
        el._trueValue = nextValue;
      } else if (key === "false-value") {
        el._falseValue = nextValue;
      }
      patchAttr(el, key, nextValue, isSVG);
    }
  };
  function shouldSetAsProp(el, key, value, isSVG) {
    if (isSVG) {
      if (key === "innerHTML" || key === "textContent") {
        return true;
      }
      if (key in el && isNativeOn(key) && isFunction(value)) {
        return true;
      }
      return false;
    }
    if (key === "spellcheck" || key === "draggable" || key === "translate" || key === "autocorrect") {
      return false;
    }
    if (key === "sandbox" && el.tagName === "IFRAME") {
      return false;
    }
    if (key === "form") {
      return false;
    }
    if (key === "list" && el.tagName === "INPUT") {
      return false;
    }
    if (key === "type" && el.tagName === "TEXTAREA") {
      return false;
    }
    if (key === "width" || key === "height") {
      const tag = el.tagName;
      if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "SOURCE") {
        return false;
      }
    }
    if (isNativeOn(key) && isString(value)) {
      return false;
    }
    return key in el;
  }
  function shouldSetAsPropForVueCE(el, key) {
    const props = (
      // @ts-expect-error _def is private
      el._def.props
    );
    if (!props) {
      return false;
    }
    const camelKey = camelize(key);
    return Array.isArray(props) ? props.some((prop) => camelize(prop) === camelKey) : Object.keys(props).some((prop) => camelize(prop) === camelKey);
  }
  const getModelAssigner = (vnode) => {
    const fn = vnode.props["onUpdate:modelValue"] || false;
    return isArray(fn) ? (value) => invokeArrayFns(fn, value) : fn;
  };
  function onCompositionStart(e) {
    e.target.composing = true;
  }
  function onCompositionEnd(e) {
    const target = e.target;
    if (target.composing) {
      target.composing = false;
      target.dispatchEvent(new Event("input"));
    }
  }
  const assignKey = /* @__PURE__ */ Symbol("_assign");
  function castValue(value, trim, number) {
    if (trim) value = value.trim();
    if (number) value = looseToNumber(value);
    return value;
  }
  const vModelText = {
    created(el, { modifiers: { lazy, trim, number } }, vnode) {
      el[assignKey] = getModelAssigner(vnode);
      const castToNumber = number || vnode.props && vnode.props.type === "number";
      addEventListener(el, lazy ? "change" : "input", (e) => {
        if (e.target.composing) return;
        el[assignKey](castValue(el.value, trim, castToNumber));
      });
      if (trim || castToNumber) {
        addEventListener(el, "change", () => {
          el.value = castValue(el.value, trim, castToNumber);
        });
      }
      if (!lazy) {
        addEventListener(el, "compositionstart", onCompositionStart);
        addEventListener(el, "compositionend", onCompositionEnd);
        addEventListener(el, "change", onCompositionEnd);
      }
    },
    // set value on mounted so it's after min/max for type="range"
    mounted(el, { value }) {
      el.value = value == null ? "" : value;
    },
    beforeUpdate(el, { value, oldValue, modifiers: { lazy, trim, number } }, vnode) {
      el[assignKey] = getModelAssigner(vnode);
      if (el.composing) return;
      const elValue = (number || el.type === "number") && !/^0\d/.test(el.value) ? looseToNumber(el.value) : el.value;
      const newValue = value == null ? "" : value;
      if (elValue === newValue) {
        return;
      }
      const rootNode = el.getRootNode();
      if ((rootNode instanceof Document || rootNode instanceof ShadowRoot) && rootNode.activeElement === el && el.type !== "range") {
        if (lazy && value === oldValue) {
          return;
        }
        if (trim && el.value.trim() === newValue) {
          return;
        }
      }
      el.value = newValue;
    }
  };
  const vModelSelect = {
    // <select multiple> value need to be deep traversed
    deep: true,
    created(el, { value, modifiers: { number } }, vnode) {
      const isSetModel = isSet(value);
      addEventListener(el, "change", () => {
        const selectedVal = Array.prototype.filter.call(el.options, (o) => o.selected).map(
          (o) => number ? looseToNumber(getValue(o)) : getValue(o)
        );
        el[assignKey](
          el.multiple ? isSetModel ? new Set(selectedVal) : selectedVal : selectedVal[0]
        );
        el._assigning = true;
        nextTick(() => {
          el._assigning = false;
        });
      });
      el[assignKey] = getModelAssigner(vnode);
    },
    // set value in mounted & updated because <select> relies on its children
    // <option>s.
    mounted(el, { value }) {
      setSelected(el, value);
    },
    beforeUpdate(el, _binding, vnode) {
      el[assignKey] = getModelAssigner(vnode);
    },
    updated(el, { value }) {
      if (!el._assigning) {
        setSelected(el, value);
      }
    }
  };
  function setSelected(el, value) {
    const isMultiple = el.multiple;
    const isArrayValue = isArray(value);
    if (isMultiple && !isArrayValue && !isSet(value)) {
      return;
    }
    for (let i = 0, l = el.options.length; i < l; i++) {
      const option = el.options[i];
      const optionValue = getValue(option);
      if (isMultiple) {
        if (isArrayValue) {
          const optionType = typeof optionValue;
          if (optionType === "string" || optionType === "number") {
            option.selected = value.some((v) => String(v) === String(optionValue));
          } else {
            option.selected = looseIndexOf(value, optionValue) > -1;
          }
        } else {
          option.selected = value.has(optionValue);
        }
      } else if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) el.selectedIndex = i;
        return;
      }
    }
    if (!isMultiple && el.selectedIndex !== -1) {
      el.selectedIndex = -1;
    }
  }
  function getValue(el) {
    return "_value" in el ? el._value : el.value;
  }
  const systemModifiers = ["ctrl", "shift", "alt", "meta"];
  const modifierGuards = {
    stop: (e) => e.stopPropagation(),
    prevent: (e) => e.preventDefault(),
    self: (e) => e.target !== e.currentTarget,
    ctrl: (e) => !e.ctrlKey,
    shift: (e) => !e.shiftKey,
    alt: (e) => !e.altKey,
    meta: (e) => !e.metaKey,
    left: (e) => "button" in e && e.button !== 0,
    middle: (e) => "button" in e && e.button !== 1,
    right: (e) => "button" in e && e.button !== 2,
    exact: (e, modifiers) => systemModifiers.some((m) => e[`${m}Key`] && !modifiers.includes(m))
  };
  const withModifiers = (fn, modifiers) => {
    if (!fn) return fn;
    const cache = fn._withMods || (fn._withMods = {});
    const cacheKey = modifiers.join(".");
    return cache[cacheKey] || (cache[cacheKey] = (event, ...args) => {
      for (let i = 0; i < modifiers.length; i++) {
        const guard = modifierGuards[modifiers[i]];
        if (guard && guard(event, modifiers)) return;
      }
      return fn(event, ...args);
    });
  };
  const keyNames = {
    esc: "escape",
    space: " ",
    up: "arrow-up",
    left: "arrow-left",
    right: "arrow-right",
    down: "arrow-down",
    delete: "backspace"
  };
  const withKeys = (fn, modifiers) => {
    const cache = fn._withKeys || (fn._withKeys = {});
    const cacheKey = modifiers.join(".");
    return cache[cacheKey] || (cache[cacheKey] = (event) => {
      if (!("key" in event)) {
        return;
      }
      const eventKey = hyphenate(event.key);
      if (modifiers.some(
        (k) => k === eventKey || keyNames[k] === eventKey
      )) {
        return fn(event);
      }
    });
  };
  const rendererOptions = /* @__PURE__ */ extend({ patchProp }, nodeOps);
  let renderer;
  function ensureRenderer() {
    return renderer || (renderer = createRenderer(rendererOptions));
  }
  const createApp = (...args) => {
    const app = ensureRenderer().createApp(...args);
    const { mount: mount2 } = app;
    app.mount = (containerOrSelector) => {
      const container = normalizeContainer(containerOrSelector);
      if (!container) return;
      const component = app._component;
      if (!isFunction(component) && !component.render && !component.template) {
        component.template = container.innerHTML;
      }
      if (container.nodeType === 1) {
        container.textContent = "";
      }
      const proxy = mount2(container, false, resolveRootNamespace(container));
      if (container instanceof Element) {
        container.removeAttribute("v-cloak");
        container.setAttribute("data-v-app", "");
      }
      return proxy;
    };
    return app;
  };
  function resolveRootNamespace(container) {
    if (container instanceof SVGElement) {
      return "svg";
    }
    if (typeof MathMLElement === "function" && container instanceof MathMLElement) {
      return "mathml";
    }
  }
  function normalizeContainer(container) {
    if (isString(container)) {
      const res = document.querySelector(container);
      return res;
    }
    return container;
  }
  const PRODUCT_NAME = "GoCapture";
  const CLI_COMMAND = "gocapture";
  const GOCAPTURE_COMMANDS_KEY = Symbol("gocapture.commands");
  function provideGoCaptureCommands(commands) {
    provide(GOCAPTURE_COMMANDS_KEY, commands);
  }
  function useGoCaptureCommands() {
    const commands = inject(GOCAPTURE_COMMANDS_KEY);
    if (!commands) throw new Error(`${PRODUCT_NAME} commands are not provided`);
    return commands;
  }
  /*!
   * pinia v3.0.4
   * (c) 2025 Eduardo San Martin Morote
   * @license MIT
   */
  let activePinia;
  const setActivePinia = (pinia) => activePinia = pinia;
  const piniaSymbol = (
    /* istanbul ignore next */
    Symbol()
  );
  function isPlainObject(o) {
    return o && typeof o === "object" && Object.prototype.toString.call(o) === "[object Object]" && typeof o.toJSON !== "function";
  }
  var MutationType;
  (function(MutationType2) {
    MutationType2["direct"] = "direct";
    MutationType2["patchObject"] = "patch object";
    MutationType2["patchFunction"] = "patch function";
  })(MutationType || (MutationType = {}));
  function createPinia() {
    const scope = effectScope(true);
    const state = scope.run(() => /* @__PURE__ */ ref({}));
    let _p = [];
    let toBeInstalled = [];
    const pinia = markRaw({
      install(app) {
        setActivePinia(pinia);
        pinia._a = app;
        app.provide(piniaSymbol, pinia);
        app.config.globalProperties.$pinia = pinia;
        toBeInstalled.forEach((plugin) => _p.push(plugin));
        toBeInstalled = [];
      },
      use(plugin) {
        if (!this._a) {
          toBeInstalled.push(plugin);
        } else {
          _p.push(plugin);
        }
        return this;
      },
      _p,
      // it's actually undefined here
      // @ts-expect-error
      _a: null,
      _e: scope,
      _s: /* @__PURE__ */ new Map(),
      state
    });
    return pinia;
  }
  const noop = () => {
  };
  function addSubscription(subscriptions, callback, detached, onCleanup = noop) {
    subscriptions.add(callback);
    const removeSubscription = () => {
      const isDel = subscriptions.delete(callback);
      isDel && onCleanup();
    };
    if (!detached && getCurrentScope()) {
      onScopeDispose(removeSubscription);
    }
    return removeSubscription;
  }
  function triggerSubscriptions(subscriptions, ...args) {
    subscriptions.forEach((callback) => {
      callback(...args);
    });
  }
  const fallbackRunWithContext = (fn) => fn();
  const ACTION_MARKER = Symbol();
  const ACTION_NAME = Symbol();
  function mergeReactiveObjects(target, patchToApply) {
    if (target instanceof Map && patchToApply instanceof Map) {
      patchToApply.forEach((value, key) => target.set(key, value));
    } else if (target instanceof Set && patchToApply instanceof Set) {
      patchToApply.forEach(target.add, target);
    }
    for (const key in patchToApply) {
      if (!patchToApply.hasOwnProperty(key))
        continue;
      const subPatch = patchToApply[key];
      const targetValue = target[key];
      if (isPlainObject(targetValue) && isPlainObject(subPatch) && target.hasOwnProperty(key) && !/* @__PURE__ */ isRef(subPatch) && !/* @__PURE__ */ isReactive(subPatch)) {
        target[key] = mergeReactiveObjects(targetValue, subPatch);
      } else {
        target[key] = subPatch;
      }
    }
    return target;
  }
  const skipHydrateSymbol = (
    /* istanbul ignore next */
    Symbol()
  );
  function shouldHydrate(obj) {
    return !isPlainObject(obj) || !Object.prototype.hasOwnProperty.call(obj, skipHydrateSymbol);
  }
  const { assign } = Object;
  function isComputed(o) {
    return !!(/* @__PURE__ */ isRef(o) && o.effect);
  }
  function createOptionsStore(id, options, pinia, hot) {
    const { state, actions, getters } = options;
    const initialState = pinia.state.value[id];
    let store;
    function setup() {
      if (!initialState && true) {
        pinia.state.value[id] = state ? state() : {};
      }
      const localState = /* @__PURE__ */ toRefs(pinia.state.value[id]);
      return assign(localState, actions, Object.keys(getters || {}).reduce((computedGetters, name) => {
        computedGetters[name] = markRaw(computed(() => {
          setActivePinia(pinia);
          const store2 = pinia._s.get(id);
          return getters[name].call(store2, store2);
        }));
        return computedGetters;
      }, {}));
    }
    store = createSetupStore(id, setup, options, pinia, hot, true);
    return store;
  }
  function createSetupStore($id, setup, options = {}, pinia, hot, isOptionsStore) {
    let scope;
    const optionsForPlugin = assign({ actions: {} }, options);
    const $subscribeOptions = { deep: true };
    let isListening;
    let isSyncListening;
    let subscriptions = /* @__PURE__ */ new Set();
    let actionSubscriptions = /* @__PURE__ */ new Set();
    let debuggerEvents;
    const initialState = pinia.state.value[$id];
    if (!isOptionsStore && !initialState && true) {
      pinia.state.value[$id] = {};
    }
    let activeListener;
    function $patch(partialStateOrMutator) {
      let subscriptionMutation;
      isListening = isSyncListening = false;
      if (typeof partialStateOrMutator === "function") {
        partialStateOrMutator(pinia.state.value[$id]);
        subscriptionMutation = {
          type: MutationType.patchFunction,
          storeId: $id,
          events: debuggerEvents
        };
      } else {
        mergeReactiveObjects(pinia.state.value[$id], partialStateOrMutator);
        subscriptionMutation = {
          type: MutationType.patchObject,
          payload: partialStateOrMutator,
          storeId: $id,
          events: debuggerEvents
        };
      }
      const myListenerId = activeListener = Symbol();
      nextTick().then(() => {
        if (activeListener === myListenerId) {
          isListening = true;
        }
      });
      isSyncListening = true;
      triggerSubscriptions(subscriptions, subscriptionMutation, pinia.state.value[$id]);
    }
    const $reset = isOptionsStore ? function $reset2() {
      const { state } = options;
      const newState = state ? state() : {};
      this.$patch(($state) => {
        assign($state, newState);
      });
    } : (
      /* istanbul ignore next */
      noop
    );
    function $dispose() {
      scope.stop();
      subscriptions.clear();
      actionSubscriptions.clear();
      pinia._s.delete($id);
    }
    const action = (fn, name = "") => {
      if (ACTION_MARKER in fn) {
        fn[ACTION_NAME] = name;
        return fn;
      }
      const wrappedAction = function() {
        setActivePinia(pinia);
        const args = Array.from(arguments);
        const afterCallbackSet = /* @__PURE__ */ new Set();
        const onErrorCallbackSet = /* @__PURE__ */ new Set();
        function after(callback) {
          afterCallbackSet.add(callback);
        }
        function onError(callback) {
          onErrorCallbackSet.add(callback);
        }
        triggerSubscriptions(actionSubscriptions, {
          args,
          name: wrappedAction[ACTION_NAME],
          store,
          after,
          onError
        });
        let ret;
        try {
          ret = fn.apply(this && this.$id === $id ? this : store, args);
        } catch (error) {
          triggerSubscriptions(onErrorCallbackSet, error);
          throw error;
        }
        if (ret instanceof Promise) {
          return ret.then((value) => {
            triggerSubscriptions(afterCallbackSet, value);
            return value;
          }).catch((error) => {
            triggerSubscriptions(onErrorCallbackSet, error);
            return Promise.reject(error);
          });
        }
        triggerSubscriptions(afterCallbackSet, ret);
        return ret;
      };
      wrappedAction[ACTION_MARKER] = true;
      wrappedAction[ACTION_NAME] = name;
      return wrappedAction;
    };
    const partialStore = {
      _p: pinia,
      // _s: scope,
      $id,
      $onAction: addSubscription.bind(null, actionSubscriptions),
      $patch,
      $reset,
      $subscribe(callback, options2 = {}) {
        const removeSubscription = addSubscription(subscriptions, callback, options2.detached, () => stopWatcher());
        const stopWatcher = scope.run(() => watch(() => pinia.state.value[$id], (state) => {
          if (options2.flush === "sync" ? isSyncListening : isListening) {
            callback({
              storeId: $id,
              type: MutationType.direct,
              events: debuggerEvents
            }, state);
          }
        }, assign({}, $subscribeOptions, options2)));
        return removeSubscription;
      },
      $dispose
    };
    const store = /* @__PURE__ */ reactive(partialStore);
    pinia._s.set($id, store);
    const runWithContext = pinia._a && pinia._a.runWithContext || fallbackRunWithContext;
    const setupStore = runWithContext(() => pinia._e.run(() => (scope = effectScope()).run(() => setup({ action }))));
    for (const key in setupStore) {
      const prop = setupStore[key];
      if (/* @__PURE__ */ isRef(prop) && !isComputed(prop) || /* @__PURE__ */ isReactive(prop)) {
        if (!isOptionsStore) {
          if (initialState && shouldHydrate(prop)) {
            if (/* @__PURE__ */ isRef(prop)) {
              prop.value = initialState[key];
            } else {
              mergeReactiveObjects(prop, initialState[key]);
            }
          }
          pinia.state.value[$id][key] = prop;
        }
      } else if (typeof prop === "function") {
        const actionValue = action(prop, key);
        setupStore[key] = actionValue;
        optionsForPlugin.actions[key] = prop;
      } else ;
    }
    assign(store, setupStore);
    assign(/* @__PURE__ */ toRaw(store), setupStore);
    Object.defineProperty(store, "$state", {
      get: () => pinia.state.value[$id],
      set: (state) => {
        $patch(($state) => {
          assign($state, state);
        });
      }
    });
    pinia._p.forEach((extender) => {
      {
        assign(store, scope.run(() => extender({
          store,
          app: pinia._a,
          pinia,
          options: optionsForPlugin
        })));
      }
    });
    if (initialState && isOptionsStore && options.hydrate) {
      options.hydrate(store.$state, initialState);
    }
    isListening = true;
    isSyncListening = true;
    return store;
  }
  /*! #__NO_SIDE_EFFECTS__ */
  // @__NO_SIDE_EFFECTS__
  function defineStore(id, setup, setupOptions) {
    let options;
    const isSetupStore = typeof setup === "function";
    options = isSetupStore ? setupOptions : setup;
    function useStore(pinia, hot) {
      const hasContext = hasInjectionContext();
      pinia = // in test mode, ignore the argument provided as we can always retrieve a
      // pinia instance with getActivePinia()
      pinia || (hasContext ? inject(piniaSymbol, null) : null);
      if (pinia)
        setActivePinia(pinia);
      pinia = activePinia;
      if (!pinia._s.has(id)) {
        if (isSetupStore) {
          createSetupStore(id, setup, options, pinia);
        } else {
          createOptionsStore(id, options, pinia);
        }
      }
      const store = pinia._s.get(id);
      return store;
    }
    useStore.$id = id;
    return useStore;
  }
  function storeToRefs(store) {
    const rawStore = /* @__PURE__ */ toRaw(store);
    const refs = {};
    for (const key in rawStore) {
      const value = rawStore[key];
      if (value.effect) {
        refs[key] = // ...
        computed({
          get: () => store[key],
          set(value2) {
            store[key] = value2;
          }
        });
      } else if (/* @__PURE__ */ isRef(value) || /* @__PURE__ */ isReactive(value)) {
        refs[key] = // ---
        /* @__PURE__ */ toRef(store, key);
      }
    }
    return refs;
  }
  const useChatStore = /* @__PURE__ */ defineStore("gocapture.chat", () => {
    const messages = /* @__PURE__ */ ref([]);
    function setMessages(nextMessages) {
      messages.value = Array.isArray(nextMessages) ? nextMessages : [];
    }
    function append(message) {
      messages.value.push(message);
    }
    function clear() {
      messages.value = [];
    }
    return {
      messages,
      setMessages,
      append,
      clear
    };
  });
  const useProjectStore = /* @__PURE__ */ defineStore("gocapture.project", () => {
    const current = /* @__PURE__ */ ref(null);
    const serviceStatus = /* @__PURE__ */ ref("idle");
    const serviceError = /* @__PURE__ */ ref("");
    const serviceMessage = /* @__PURE__ */ ref("");
    const pageContext = /* @__PURE__ */ ref(null);
    function setProject(project) {
      current.value = project;
    }
    function setServiceStatus(status, message = "", error = "") {
      serviceStatus.value = status;
      serviceMessage.value = message;
      serviceError.value = error;
    }
    function setPageContext(value) {
      pageContext.value = value || null;
    }
    return {
      current,
      pageContext,
      serviceStatus,
      serviceError,
      serviceMessage,
      setProject,
      setServiceStatus,
      setPageContext
    };
  });
  const useSearchStore = /* @__PURE__ */ defineStore("gocapture.search", () => {
    const status = /* @__PURE__ */ ref("idle");
    const candidates = /* @__PURE__ */ ref([]);
    const composite = /* @__PURE__ */ ref(null);
    const changePlan = /* @__PURE__ */ ref(null);
    const candidateLoading = /* @__PURE__ */ ref(false);
    const searchRunning = /* @__PURE__ */ ref(false);
    const selectedCandidatePaths = /* @__PURE__ */ ref([]);
    const expandedCandidatePath = /* @__PURE__ */ ref("");
    const apiTrace = /* @__PURE__ */ ref(null);
    const i18nTrace = /* @__PURE__ */ ref(null);
    const definitionTrace = /* @__PURE__ */ ref(null);
    const startedAt = /* @__PURE__ */ ref(0);
    const finishedAt = /* @__PURE__ */ ref(0);
    const error = /* @__PURE__ */ ref("");
    const keywords = /* @__PURE__ */ ref("");
    const includeApiEvidence = /* @__PURE__ */ ref(true);
    const modelAssistAttempted = /* @__PURE__ */ ref(false);
    const showCandidatePicker = /* @__PURE__ */ ref(false);
    const needsMoreEvidence = /* @__PURE__ */ ref(false);
    const serverNeedsMoreEvidence = /* @__PURE__ */ ref(false);
    const processLogs = /* @__PURE__ */ ref([]);
    const agentUsed = /* @__PURE__ */ ref(false);
    const selectedCandidates = computed(() => {
      const selected = new Set(selectedCandidatePaths.value);
      return candidates.value.filter((item) => selected.has(item.file));
    });
    function start() {
      status.value = "loading";
      candidateLoading.value = true;
      searchRunning.value = true;
      error.value = "";
      keywords.value = "";
      startedAt.value = Date.now();
      finishedAt.value = 0;
      modelAssistAttempted.value = false;
      serverNeedsMoreEvidence.value = false;
      processLogs.value = [];
      agentUsed.value = false;
    }
    function appendProcessLog(log) {
      if (!log) return;
      processLogs.value.push(log);
    }
    function applyResult(result) {
      var _a2;
      candidates.value = Array.isArray(result == null ? void 0 : result.hits) ? result.hits : [];
      composite.value = (result == null ? void 0 : result.composite) || null;
      selectedCandidatePaths.value = ((_a2 = candidates.value[0]) == null ? void 0 : _a2.file) ? [candidates.value[0].file] : [];
      expandedCandidatePath.value = "";
      apiTrace.value = (result == null ? void 0 : result.apiTrace) || null;
      i18nTrace.value = (result == null ? void 0 : result.i18nTrace) || null;
      definitionTrace.value = (result == null ? void 0 : result.definitionTrace) || null;
      status.value = candidates.value.length ? "success" : "idle";
      candidateLoading.value = false;
      searchRunning.value = false;
      finishedAt.value = Date.now();
    }
    function fail(reason) {
      status.value = "error";
      candidateLoading.value = false;
      searchRunning.value = false;
      error.value = `${(reason == null ? void 0 : reason.message) || reason || ""}`;
      finishedAt.value = Date.now();
    }
    function reset() {
      status.value = "idle";
      candidateLoading.value = false;
      searchRunning.value = false;
      candidates.value = [];
      composite.value = null;
      changePlan.value = null;
      selectedCandidatePaths.value = [];
      expandedCandidatePath.value = "";
      apiTrace.value = null;
      i18nTrace.value = null;
      definitionTrace.value = null;
      startedAt.value = 0;
      finishedAt.value = 0;
      error.value = "";
      modelAssistAttempted.value = false;
      serverNeedsMoreEvidence.value = false;
      processLogs.value = [];
      agentUsed.value = false;
    }
    return {
      status,
      candidates,
      composite,
      changePlan,
      candidateLoading,
      searchRunning,
      selectedCandidatePaths,
      expandedCandidatePath,
      apiTrace,
      i18nTrace,
      definitionTrace,
      startedAt,
      finishedAt,
      error,
      keywords,
      includeApiEvidence,
      modelAssistAttempted,
      showCandidatePicker,
      needsMoreEvidence,
      serverNeedsMoreEvidence,
      processLogs,
      agentUsed,
      selectedCandidates,
      start,
      appendProcessLog,
      applyResult,
      fail,
      reset
    };
  });
  const SOURCE_SERVER_URL = typeof window !== "undefined" && ((_a = window.__GOCAPTURE_SIDE_PANEL__) == null ? void 0 : _a.sourceServerUrl) || "http://127.0.0.1:17321";
  const GOCAPTURE_INTERNAL_REQUEST_HEADER = "X-GoCapture-Internal";
  const GOCAPTURE_INTERNAL_REQUEST_VALUE = "source-server";
  const SOURCE_SERVER_HEALTH_URL = `${SOURCE_SERVER_URL}/health`;
  function createSourceServerHeaders(extraHeaders) {
    return __spreadValues({
      "Content-Type": "application/json",
      [GOCAPTURE_INTERNAL_REQUEST_HEADER]: GOCAPTURE_INTERNAL_REQUEST_VALUE
    }, extraHeaders || {});
  }
  function sourceServerJson(_0) {
    return __async(this, arguments, function* (pathname, options = {}) {
      const timeoutMs = Number(options.timeoutMs || 1e4);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, timeoutMs);
      try {
        const response = yield fetch(`${SOURCE_SERVER_URL}${pathname}`, {
          method: options.method || "GET",
          headers: createSourceServerHeaders(options.headers),
          body: options.body ? JSON.stringify(options.body) : void 0,
          signal: controller.signal
        });
        const data = yield response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
          const error = new Error(data.error || `本地源码服务请求失败：${response.status}`);
          error.payload = data;
          throw error;
        }
        return data;
      } catch (error) {
        if (error && error.name === "AbortError") {
          throw new Error(options.timeoutMessage || `本地源码服务 ${timeoutMs / 1e3} 秒未响应`);
        }
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }
    });
  }
  function sourceServerNdjson(_0) {
    return __async(this, arguments, function* (pathname, options = {}) {
      const timeoutMs = Number(options.timeoutMs || 1e4);
      const controller = options.controller || new AbortController();
      let timedOut = false;
      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        const response = yield fetch(`${SOURCE_SERVER_URL}${pathname}`, {
          method: options.method || "GET",
          headers: createSourceServerHeaders(options.headers),
          body: options.body ? JSON.stringify(options.body) : void 0,
          signal: controller.signal
        });
        if (!response.ok) {
          const text = yield response.text().catch(() => "");
          throw new Error(text || `本地源码服务请求失败：${response.status}`);
        }
        if (!response.body) return null;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let result = null;
        while (true) {
          const { done, value } = yield reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const event = JSON.parse(trimmed);
            if (typeof options.onEvent === "function") options.onEvent(event);
            if (event.type === "result") result = event.result || null;
            if (event.type === "error") {
              const error = new Error(event.error || "本地源码服务请求失败");
              error.payload = event;
              throw error;
            }
          }
        }
        const finalLine = buffer.trim();
        if (finalLine) {
          const event = JSON.parse(finalLine);
          if (typeof options.onEvent === "function") options.onEvent(event);
          if (event.type === "result") result = event.result || null;
          if (event.type === "error") {
            const error = new Error(event.error || "本地源码服务请求失败");
            error.payload = event;
            throw error;
          }
        }
        return result;
      } catch (error) {
        if (error && error.name === "AbortError") {
          const abortError = new Error(timedOut ? options.timeoutMessage || `本地源码服务 ${timeoutMs / 1e3} 秒未响应` : options.abortMessage || "请求已停止");
          abortError.name = timedOut ? "TimeoutError" : "AbortError";
          throw abortError;
        }
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }
    });
  }
  function probeSourceServer(timeoutMs = 2500) {
    return __async(this, null, function* () {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, timeoutMs);
      try {
        const response = yield fetch(SOURCE_SERVER_HEALTH_URL, {
          method: "GET",
          signal: controller.signal
        });
        if (!response.ok) {
          return { online: false, url: SOURCE_SERVER_HEALTH_URL, message: `HTTP ${response.status}` };
        }
        const data = yield response.json().catch(() => ({}));
        if ((data == null ? void 0 : data.success) === false) {
          return { online: false, url: SOURCE_SERVER_HEALTH_URL, message: data.error || "health success=false" };
        }
        return { online: true, url: SOURCE_SERVER_HEALTH_URL, message: "" };
      } catch (error) {
        if ((error == null ? void 0 : error.name) === "AbortError") {
          return { online: false, url: SOURCE_SERVER_HEALTH_URL, message: `health timeout (${timeoutMs}ms)` };
        }
        const message = error instanceof Error ? error.message : String(error || "unknown error");
        return { online: false, url: SOURCE_SERVER_HEALTH_URL, message };
      } finally {
        window.clearTimeout(timeoutId);
      }
    });
  }
  function normalizeSourceServerProject(raw) {
    const files = Array.isArray(raw.files) ? raw.files : [];
    return {
      name: raw.name || "本地项目",
      path: raw.path || "",
      kind: raw.kind || "unknown",
      source: "source-server",
      fileCount: raw.fileCount || files.length,
      files,
      snippets: raw.snippets || {},
      context: raw.context || null,
      stack: raw.stack || [],
      stackText: raw.stackText || "",
      limited: !!raw.limited
    };
  }
  function listConnectAgentMessages(projectRoot, providerId = "codex", limit = 500) {
    return __async(this, null, function* () {
      if (!projectRoot) return [];
      const query = new URLSearchParams({
        projectRoot,
        providerId,
        limit: String(limit)
      });
      const data = yield sourceServerJson(`/api/connect-agents/messages?${query}`, {
        timeoutMs: 5e3,
        timeoutMessage: "加载 Agent 对话历史超时"
      });
      return Array.isArray(data == null ? void 0 : data.messages) ? data.messages : [];
    });
  }
  function listConnectAgents(refresh = false, projectRoot = "") {
    return __async(this, null, function* () {
      const query = new URLSearchParams();
      if (refresh) query.set("refresh", "1");
      if (projectRoot) query.set("projectRoot", projectRoot);
      const suffix = query.toString() ? `?${query}` : "";
      const data = yield sourceServerJson(`/api/connect-agents${suffix}`, {
        timeoutMs: refresh ? 12e3 : 5e3,
        timeoutMessage: "检查 Agent 连接状态超时"
      });
      return Array.isArray(data == null ? void 0 : data.providers) ? data.providers : [];
    });
  }
  function connectAgent(providerId, auth) {
    return __async(this, null, function* () {
      const data = yield sourceServerJson(`/api/connect-agents/${encodeURIComponent(providerId)}/connect`, {
        method: "POST",
        body: {},
        timeoutMs: 15e3,
        timeoutMessage: "连接 Agent 超时"
      });
      return data.provider;
    });
  }
  function listConnectAgentThreads(providerId, projectRoot) {
    return __async(this, null, function* () {
      var _a2, _b, _c;
      const query = new URLSearchParams({ projectRoot });
      const data = yield sourceServerJson(
        `/api/connect-agents/${encodeURIComponent(providerId)}/threads?${query}`,
        {
          timeoutMs: 15e3,
          timeoutMessage: "加载 Agent 任务超时"
        }
      );
      return {
        project: Array.isArray((_a2 = data == null ? void 0 : data.threads) == null ? void 0 : _a2.project) ? data.threads.project : [],
        recent: Array.isArray((_b = data == null ? void 0 : data.threads) == null ? void 0 : _b.recent) ? data.threads.recent : [],
        projectlessStateAvailable: !!((_c = data == null ? void 0 : data.threads) == null ? void 0 : _c.projectlessStateAvailable)
      };
    });
  }
  function bindConnectAgentThread(providerId, projectRoot, threadId) {
    return __async(this, null, function* () {
      const data = yield sourceServerJson(
        `/api/connect-agents/${encodeURIComponent(providerId)}/bind-thread`,
        {
          method: "POST",
          body: { projectRoot, threadId },
          timeoutMs: 15e3,
          timeoutMessage: "绑定 Agent 任务超时"
        }
      );
      return data.session;
    });
  }
  function runConnectAgentTask(providerId, input, options) {
    return __async(this, null, function* () {
      return yield sourceServerNdjson(
        `/api/connect-agents/${encodeURIComponent(providerId)}/tasks/stream`,
        {
          method: "POST",
          body: input,
          controller: options.controller,
          onEvent: options.onEvent,
          timeoutMs: 30 * 60 * 1e3,
          timeoutMessage: "Codex 开发任务执行超时",
          abortMessage: "Codex 开发任务已取消"
        }
      );
    });
  }
  const useConnectAgentStore = /* @__PURE__ */ defineStore("gocapture.connect-agent", () => {
    const providers = /* @__PURE__ */ ref([]);
    const loading = /* @__PURE__ */ ref(false);
    const connectionError = /* @__PURE__ */ ref("");
    const task = /* @__PURE__ */ ref(null);
    const taskStatus = /* @__PURE__ */ ref("idle");
    const taskLogs = /* @__PURE__ */ ref([]);
    const taskError = /* @__PURE__ */ ref("");
    const taskStartedAt = /* @__PURE__ */ ref(0);
    const taskFinishedAt = /* @__PURE__ */ ref(0);
    const taskController = /* @__PURE__ */ ref(null);
    const timeline = /* @__PURE__ */ ref([]);
    const timelineLoading = /* @__PURE__ */ ref(false);
    const timelineProjectRoot = /* @__PURE__ */ ref("");
    const threadGroups = /* @__PURE__ */ ref({
      project: [],
      recent: [],
      projectlessStateAvailable: false
    });
    const threadPickerVisible = /* @__PURE__ */ ref(false);
    const threadLoading = /* @__PURE__ */ ref(false);
    const bindingThreadId = /* @__PURE__ */ ref("");
    const selectedProviderId = /* @__PURE__ */ ref("");
    const pickerProviderId = /* @__PURE__ */ ref("");
    const currentProjectRoot = /* @__PURE__ */ ref("");
    const activeProvider = computed(() => {
      const selected = providers.value.find((provider) => provider.id === selectedProviderId.value);
      if (selected) return selected;
      return providers.value.find((provider) => provider.projectThreadId) || providers.value.find((provider) => provider.connected) || null;
    });
    const pickerProvider = computed(() => providers.value.find((provider) => provider.id === pickerProviderId.value) || null);
    const taskRunning = computed(() => taskStatus.value === "running");
    function refreshProviders(refresh = false, projectRoot = "") {
      return __async(this, null, function* () {
        const root = String(projectRoot || "").trim();
        if (root) {
          currentProjectRoot.value = root;
        }
        loading.value = true;
        connectionError.value = "";
        try {
          setProviders(yield listConnectAgents(refresh, root));
          restoreSelectedProvider(root);
          return providers.value;
        } catch (error) {
          connectionError.value = (error == null ? void 0 : error.message) || "无法检查 Agent 连接状态";
          return [];
        } finally {
          loading.value = false;
        }
      });
    }
    function connectProvider(providerId, projectRoot = "") {
      return __async(this, null, function* () {
        const id = String(providerId || "").trim();
        const root = String(projectRoot || "").trim();
        loading.value = true;
        connectionError.value = "";
        try {
          const available = yield listConnectAgents(true, root);
          setProviders(available);
          const provider = available.find((item) => item.id === id);
          if (!provider) throw new Error("当前版本未提供所选 Agent");
          if (!provider.installed) throw new Error(provider.message || `未检测到 ${provider.name}`);
          const connected = provider.connected ? provider : yield connectAgent(provider.id);
          upsertProvider(connected);
          selectProvider(id, root);
          if (root) {
            setProviders(yield listConnectAgents(false, root));
            return providers.value.find((item) => item.id === id) || connected;
          }
          return connected;
        } catch (error) {
          connectionError.value = (error == null ? void 0 : error.message) || "Agent 连接失败";
          return null;
        } finally {
          loading.value = false;
        }
      });
    }
    function openAgentPicker(projectRoot) {
      return __async(this, null, function* () {
        var _a2;
        const root = String(projectRoot || "").trim();
        if (!root) {
          connectionError.value = "请先连接项目源码";
          return false;
        }
        currentProjectRoot.value = root;
        threadPickerVisible.value = true;
        threadLoading.value = true;
        connectionError.value = "";
        try {
          yield refreshProviders(true, root);
          const initialProvider = activeProvider.value;
          pickerProviderId.value = (initialProvider == null ? void 0 : initialProvider.id) || ((_a2 = providers.value[0]) == null ? void 0 : _a2.id) || "";
          if ((initialProvider == null ? void 0 : initialProvider.connected) && initialProvider.supportsThreadBinding) {
            threadGroups.value = yield listConnectAgentThreads(initialProvider.id, root);
          } else {
            clearThreadGroups();
          }
          return true;
        } catch (error) {
          connectionError.value = (error == null ? void 0 : error.message) || "无法加载 Codex 任务";
          return false;
        } finally {
          threadLoading.value = false;
        }
      });
    }
    function closeThreadPicker() {
      if (bindingThreadId.value) return;
      threadPickerVisible.value = false;
    }
    function chooseProvider(providerId) {
      return __async(this, null, function* () {
        const root = currentProjectRoot.value;
        const provider = yield connectProvider(providerId, root);
        if (!provider) return false;
        pickerProviderId.value = provider.id;
        if (!provider.supportsThreadBinding) {
          clearThreadGroups();
          yield loadTimeline(root, provider.id);
          threadPickerVisible.value = false;
          return true;
        }
        threadLoading.value = true;
        try {
          threadGroups.value = yield listConnectAgentThreads(provider.id, root);
          return true;
        } catch (error) {
          connectionError.value = (error == null ? void 0 : error.message) || `无法加载 ${provider.name} 任务`;
          return false;
        } finally {
          threadLoading.value = false;
        }
      });
    }
    function bindThread(projectRoot, threadId) {
      return __async(this, null, function* () {
        const root = String(projectRoot || "").trim();
        const id = String(threadId || "").trim();
        const providerId = pickerProviderId.value;
        if (!root || !id || !providerId) return false;
        bindingThreadId.value = id;
        connectionError.value = "";
        try {
          const session = yield bindConnectAgentThread(providerId, root, id);
          selectProvider(providerId, root);
          setProviders(yield listConnectAgents(false, root));
          yield loadTimeline(root, providerId);
          threadPickerVisible.value = false;
          return !!(session == null ? void 0 : session.threadId);
        } catch (error) {
          connectionError.value = (error == null ? void 0 : error.message) || "绑定 Agent 任务失败";
          return false;
        } finally {
          bindingThreadId.value = "";
        }
      });
    }
    function loadTimeline(projectRoot, providerId = "") {
      return __async(this, null, function* () {
        const root = String(projectRoot || "").trim();
        const resolvedProviderId = providerId || selectedProviderId.value || "codex";
        timelineProjectRoot.value = root;
        if (!root) {
          timeline.value = [];
          return [];
        }
        timelineLoading.value = true;
        try {
          const messages = yield listConnectAgentMessages(root, resolvedProviderId);
          if (timelineProjectRoot.value === root) setTimeline(messages);
          return messages;
        } catch (e) {
          if (timelineProjectRoot.value === root) timeline.value = [];
          return [];
        } finally {
          if (timelineProjectRoot.value === root) timelineLoading.value = false;
        }
      });
    }
    function setProviders(nextProviders) {
      providers.value = Array.isArray(nextProviders) ? nextProviders : [];
    }
    function selectProvider(providerId, root = currentProjectRoot.value) {
      selectedProviderId.value = String(providerId || "");
      pickerProviderId.value = selectedProviderId.value;
      if (root && selectedProviderId.value) {
        window.localStorage.setItem(providerStorageKey(root), selectedProviderId.value);
      }
    }
    function restoreSelectedProvider(root) {
      const saved = root ? window.localStorage.getItem(providerStorageKey(root)) || "" : "";
      const provider = providers.value.find((item) => item.id === saved) || providers.value.find((item) => item.projectThreadId) || providers.value.find((item) => item.connected);
      if (provider) selectProvider(provider.id, root);
    }
    function clearThreadGroups() {
      threadGroups.value = {
        project: [],
        recent: [],
        projectlessStateAvailable: false
      };
    }
    function upsertProvider(provider) {
      providers.value = providers.value.filter((item) => item.id !== provider.id).concat(provider);
    }
    function setTimeline(messages) {
      timeline.value = [...Array.isArray(messages) ? messages : []].sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
    }
    function upsertTimelineMessage(message) {
      if (!(message == null ? void 0 : message.id)) return;
      const index = timeline.value.findIndex((item) => item.id === message.id);
      if (index >= 0) {
        timeline.value[index] = __spreadValues(__spreadValues({}, timeline.value[index]), message);
        return;
      }
      timeline.value.push(message);
    }
    function beginTask(controller) {
      task.value = null;
      taskStatus.value = "running";
      taskLogs.value = [];
      taskError.value = "";
      taskStartedAt.value = Date.now();
      taskFinishedAt.value = 0;
      taskController.value = controller;
    }
    function applyTaskEvent(event) {
      var _a2, _b, _c, _d, _e, _f, _g, _h, _i;
      if (event == null ? void 0 : event.timelineMessage) upsertTimelineMessage(event.timelineMessage);
      if (event == null ? void 0 : event.task) task.value = __spreadValues(__spreadValues({}, task.value || {}), event.task);
      if (((_a2 = event == null ? void 0 : event.event) == null ? void 0 : _a2.method) === "item/agentMessage/delta") {
        task.value = __spreadProps(__spreadValues({}, task.value || {}), {
          finalResponse: `${((_b = task.value) == null ? void 0 : _b.finalResponse) || ""}${((_d = (_c = event.event) == null ? void 0 : _c.params) == null ? void 0 : _d.delta) || ""}`
        });
      }
      if (((_e = event == null ? void 0 : event.event) == null ? void 0 : _e.method) === "item/completed" && ((_h = (_g = (_f = event.event) == null ? void 0 : _f.params) == null ? void 0 : _g.item) == null ? void 0 : _h.type) === "agentMessage") {
        const text = String(event.event.params.item.text || "");
        if (text.length > String(((_i = task.value) == null ? void 0 : _i.finalResponse) || "").length) {
          task.value = __spreadProps(__spreadValues({}, task.value || {}), { finalResponse: text });
        }
      }
      const message = String((event == null ? void 0 : event.message) || "").trim();
      if (message && taskLogs.value[taskLogs.value.length - 1] !== message) {
        taskLogs.value.push(message);
      }
    }
    function completeTask(result) {
      task.value = result;
      if (result.threadId && activeProvider.value) {
        upsertProvider(__spreadProps(__spreadValues({}, activeProvider.value), {
          projectThreadId: result.threadId
        }));
      }
      taskStatus.value = result.status === "completed" ? "completed" : "failed";
      taskFinishedAt.value = Number(result.finishedAt || Date.now());
      taskController.value = null;
    }
    function failTask(error) {
      var _a2;
      const payload = error == null ? void 0 : error.payload;
      if (payload == null ? void 0 : payload.task) task.value = __spreadValues(__spreadValues({}, task.value || {}), payload.task);
      taskError.value = (error == null ? void 0 : error.message) || String(error || "Codex 开发任务失败");
      taskStatus.value = ((_a2 = task.value) == null ? void 0 : _a2.status) === "cancelled" ? "cancelled" : "failed";
      taskFinishedAt.value = Date.now();
      taskController.value = null;
    }
    function cancelTask() {
      var _a2;
      (_a2 = taskController.value) == null ? void 0 : _a2.abort();
    }
    function resetTask() {
      if (taskRunning.value) cancelTask();
      task.value = null;
      taskStatus.value = "idle";
      taskLogs.value = [];
      taskError.value = "";
      taskStartedAt.value = 0;
      taskFinishedAt.value = 0;
      taskController.value = null;
    }
    return {
      providers,
      loading,
      connectionError,
      task,
      taskStatus,
      taskLogs,
      taskError,
      taskStartedAt,
      taskFinishedAt,
      taskController,
      timeline,
      timelineLoading,
      timelineProjectRoot,
      threadGroups,
      threadPickerVisible,
      threadLoading,
      bindingThreadId,
      selectedProviderId,
      pickerProviderId,
      pickerProvider,
      activeProvider,
      taskRunning,
      refreshProviders,
      loadTimeline,
      connectProvider,
      openAgentPicker,
      chooseProvider,
      closeThreadPicker,
      bindThread,
      selectProvider,
      setProviders,
      upsertProvider,
      setTimeline,
      upsertTimelineMessage,
      beginTask,
      applyTaskEvent,
      completeTask,
      failTask,
      cancelTask,
      resetTask
    };
  });
  function providerStorageKey(projectRoot) {
    return `gocapture.connect-agent.provider:${projectRoot}`;
  }
  const ROUND_PATTERN = /第\s*(\d+)\s*轮/;
  function firstLine(value) {
    return value.split("\n", 1)[0].trim();
  }
  function textAfterColon(value) {
    const index = value.indexOf("：");
    return index >= 0 ? value.slice(index + 1).trim() : value.trim();
  }
  function toolTitle(value, fallback) {
    const explicit = value.match(/(?:工具调用：|工具结果：|本地调用：|本地输出：|Agent Tool [→✓✗])\s*([^\s({]+)/);
    if (explicit == null ? void 0 : explicit[1]) return explicit[1];
    const body = textAfterColon(firstLine(value));
    const match = body.match(/^([^\s({]+)/);
    return (match == null ? void 0 : match[1]) || fallback;
  }
  function parseToolInput(value) {
    const start = value.indexOf("{");
    if (start < 0) return null;
    try {
      return JSON.parse(value.slice(start));
    } catch (e) {
      return null;
    }
  }
  function compactList(value, limit = 2) {
    if (!Array.isArray(value)) return "";
    const items = value.map((item) => typeof item === "object" && item ? String(item.text || item.file || item.path || "") : String(item || "")).filter(Boolean);
    if (!items.length) return "";
    return `${items.slice(0, limit).join("、")}${items.length > limit ? ` 等 ${items.length} 项` : ""}`;
  }
  function toolCallTitle(raw) {
    const name = toolTitle(raw, "工具");
    const input = parseToolInput(raw);
    if (!input) return `调用 ${name}`;
    const target = compactList(input.files) || String(input.file || input.path || input.target || "") || compactList(input.roots);
    const focus = String(input.around || "") || compactList(input.terms) || compactList(input.symbols) || compactList(input.anchors);
    const details = [target, focus].filter(Boolean);
    return `调用 ${name}${details.length ? ` · ${details.join(" · ")}` : ""}`;
  }
  function modelRound(value) {
    const match = value.match(ROUND_PATTERN);
    return match ? Number(match[1]) : null;
  }
  function modelSummary(head, label) {
    const details = textAfterColon(head);
    return details && details !== head ? `${label} · ${details.replace(/；/g, " · ")}` : label;
  }
  function classify(raw) {
    const head = firstLine(raw);
    if (/^Agent 模型输入上下文：?/.test(head)) {
      return { kind: "llm-input", actor: "LLM", title: `${PRODUCT_NAME} → Agent 输入` };
    }
    if (/失败|报错|异常|\berror\b/i.test(head)) {
      return { kind: "error", actor: "错误", title: head || "执行失败" };
    }
    if (/最终裁决|最终输出|最终结果|源码上下文已绑定|选区源码上下文已绑定/.test(head)) {
      return { kind: "decision", actor: "结果", title: head.split("：")[0] || "最终结果" };
    }
    if (/工具调用：|^本地调用：|Agent Tool →/.test(head)) {
      return { kind: "tool-call", actor: "本地工具", title: toolCallTitle(raw) };
    }
    if (/工具结果：|^本地输出：|Agent Tool ✓/.test(head)) {
      return { kind: "tool-result", actor: "本地工具", title: `${toolTitle(head, "工具")} 返回` };
    }
    if (/Agent Tool ✗/.test(head)) {
      return { kind: "error", actor: "错误", title: head };
    }
    if (/模型输入|模型输入上下文|API 模型请求|Agent 输入（|模型阶段：/.test(head)) {
      const round = modelRound(head);
      const context = /输入上下文/.test(head);
      const label = round ? `第 ${round} 轮${context ? "输入上下文" : "输入"}` : context ? "模型输入上下文" : "模型输入";
      return { kind: "llm-input", actor: "LLM", title: context ? label : modelSummary(head, label) };
    }
    if (/LangChain 模型响应/.test(head)) {
      const round = modelRound(head);
      return { kind: "llm-output", actor: "LLM", title: modelSummary(head, round ? `第 ${round} 轮模型耗时` : "模型耗时") };
    }
    if (/模型输出|API 模型响应|模型返回|Agent 输出（/.test(head)) {
      const round = modelRound(head);
      const body = /输出正文/.test(head);
      const label = round ? `第 ${round} 轮${body ? "输出正文" : "输出"}` : body ? "模型输出正文" : "模型输出";
      return { kind: "llm-output", actor: "LLM", title: body ? label : modelSummary(head, label) };
    }
    return { kind: "process", actor: "流程", title: head || "流程记录" };
  }
  function buildLogChain(logs) {
    return (Array.isArray(logs) ? logs : []).map((value) => String(value != null ? value : "").trim()).filter(Boolean).map((raw, index) => {
      const classified = classify(raw);
      return __spreadProps(__spreadValues({}, classified), {
        id: `log-${index}`,
        raw,
        expandable: raw.includes("\n") || raw.length > 180,
        round: modelRound(raw)
      });
    });
  }
  function serializeLogs(logs) {
    return (Array.isArray(logs) ? logs : []).map((value) => String(value != null ? value : "").trim()).filter(Boolean).join("\n\n");
  }
  function ampCount(selector) {
    let cnt = 0;
    for (let i = 0; i < selector.length; ++i) {
      if (selector[i] === "&")
        ++cnt;
    }
    return cnt;
  }
  const seperatorRegex = /\s*,(?![^(]*\))\s*/g;
  const extraSpaceRegex = /\s+/g;
  function resolveSelectorWithAmp(amp, selector) {
    const nextAmp = [];
    selector.split(seperatorRegex).forEach((partialSelector) => {
      let round = ampCount(partialSelector);
      if (!round) {
        amp.forEach((partialAmp) => {
          nextAmp.push(
            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            (partialAmp && partialAmp + " ") + partialSelector
          );
        });
        return;
      } else if (round === 1) {
        amp.forEach((partialAmp) => {
          nextAmp.push(partialSelector.replace("&", partialAmp));
        });
        return;
      }
      let partialNextAmp = [
        partialSelector
      ];
      while (round--) {
        const nextPartialNextAmp = [];
        partialNextAmp.forEach((selectorItr) => {
          amp.forEach((partialAmp) => {
            nextPartialNextAmp.push(selectorItr.replace("&", partialAmp));
          });
        });
        partialNextAmp = nextPartialNextAmp;
      }
      partialNextAmp.forEach((part) => nextAmp.push(part));
    });
    return nextAmp;
  }
  function resolveSelector(amp, selector) {
    const nextAmp = [];
    selector.split(seperatorRegex).forEach((partialSelector) => {
      amp.forEach((partialAmp) => {
        nextAmp.push((partialAmp && partialAmp + " ") + partialSelector);
      });
    });
    return nextAmp;
  }
  function parseSelectorPath(selectorPaths) {
    let amp = [""];
    selectorPaths.forEach((selector) => {
      selector = selector && selector.trim();
      if (
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        !selector
      ) {
        return;
      }
      if (selector.includes("&")) {
        amp = resolveSelectorWithAmp(amp, selector);
      } else {
        amp = resolveSelector(amp, selector);
      }
    });
    return amp.join(", ").replace(extraSpaceRegex, " ");
  }
  const kebabRegex = /[A-Z]/g;
  function kebabCase(pattern) {
    return pattern.replace(kebabRegex, (match) => "-" + match.toLowerCase());
  }
  function upwrapProperty(prop, indent = "  ") {
    if (typeof prop === "object" && prop !== null) {
      return " {\n" + Object.entries(prop).map((v) => {
        return indent + `  ${kebabCase(v[0])}: ${v[1]};`;
      }).join("\n") + "\n" + indent + "}";
    }
    return `: ${prop};`;
  }
  function upwrapProperties(props, instance, params) {
    if (typeof props === "function") {
      return props({
        context: instance.context,
        props: params
      });
    }
    return props;
  }
  function createStyle(selector, props, instance, params) {
    if (!props)
      return "";
    const unwrappedProps = upwrapProperties(props, instance, params);
    if (!unwrappedProps)
      return "";
    if (typeof unwrappedProps === "string") {
      return `${selector} {
${unwrappedProps}
}`;
    }
    const propertyNames = Object.keys(unwrappedProps);
    if (propertyNames.length === 0) {
      if (instance.config.keepEmptyBlock)
        return selector + " {\n}";
      return "";
    }
    const statements = selector ? [
      selector + " {"
    ] : [];
    propertyNames.forEach((propertyName) => {
      const property = unwrappedProps[propertyName];
      if (propertyName === "raw") {
        statements.push("\n" + property + "\n");
        return;
      }
      propertyName = kebabCase(propertyName);
      if (property !== null && property !== void 0) {
        statements.push(`  ${propertyName}${upwrapProperty(property)}`);
      }
    });
    if (selector) {
      statements.push("}");
    }
    return statements.join("\n");
  }
  function loopCNodeListWithCallback(children, options, callback) {
    if (!children)
      return;
    children.forEach((child) => {
      if (Array.isArray(child)) {
        loopCNodeListWithCallback(child, options, callback);
      } else if (typeof child === "function") {
        const grandChildren = child(options);
        if (Array.isArray(grandChildren)) {
          loopCNodeListWithCallback(grandChildren, options, callback);
        } else if (grandChildren) {
          callback(grandChildren);
        }
      } else if (child) {
        callback(child);
      }
    });
  }
  function traverseCNode(node, selectorPaths, styles2, instance, params, styleSheet) {
    const $ = node.$;
    if (!$ || typeof $ === "string") {
      selectorPaths.push($);
    } else if (typeof $ === "function") {
      selectorPaths.push($({
        context: instance.context,
        props: params
      }));
    } else {
      if ($.before)
        $.before(instance.context);
      if (!$.$ || typeof $.$ === "string") {
        selectorPaths.push($.$);
      } else if ($.$) {
        selectorPaths.push($.$({
          context: instance.context,
          props: params
        }));
      }
    }
    const selector = parseSelectorPath(selectorPaths);
    const style2 = createStyle(selector, node.props, instance, params);
    if (styleSheet && style2) {
      styleSheet.insertRule(style2);
    }
    if (!styleSheet && style2.length)
      styles2.push(style2);
    if (node.children) {
      loopCNodeListWithCallback(node.children, {
        context: instance.context,
        props: params
      }, (childNode) => {
        if (typeof childNode === "string") {
          const style3 = createStyle(selector, { raw: childNode }, instance, params);
          if (styleSheet) {
            styleSheet.insertRule(style3);
          } else {
            styles2.push(style3);
          }
        } else {
          traverseCNode(childNode, selectorPaths, styles2, instance, params, styleSheet);
        }
      });
    }
    selectorPaths.pop();
    if ($ && $.after)
      $.after(instance.context);
  }
  function render(node, instance, props, insertRule = false) {
    const styles2 = [];
    traverseCNode(node, [], styles2, instance, props, insertRule ? node.instance.__styleSheet : void 0);
    if (insertRule)
      return "";
    return styles2.join("\n\n");
  }
  function murmur2(str) {
    var h2 = 0;
    var k, i = 0, len = str.length;
    for (; len >= 4; ++i, len -= 4) {
      k = str.charCodeAt(i) & 255 | (str.charCodeAt(++i) & 255) << 8 | (str.charCodeAt(++i) & 255) << 16 | (str.charCodeAt(++i) & 255) << 24;
      k = /* Math.imul(k, m): */
      (k & 65535) * 1540483477 + ((k >>> 16) * 59797 << 16);
      k ^= /* k >>> r: */
      k >>> 24;
      h2 = /* Math.imul(k, m): */
      (k & 65535) * 1540483477 + ((k >>> 16) * 59797 << 16) ^ /* Math.imul(h, m): */
      (h2 & 65535) * 1540483477 + ((h2 >>> 16) * 59797 << 16);
    }
    switch (len) {
      case 3:
        h2 ^= (str.charCodeAt(i + 2) & 255) << 16;
      case 2:
        h2 ^= (str.charCodeAt(i + 1) & 255) << 8;
      case 1:
        h2 ^= str.charCodeAt(i) & 255;
        h2 = /* Math.imul(h, m): */
        (h2 & 65535) * 1540483477 + ((h2 >>> 16) * 59797 << 16);
    }
    h2 ^= h2 >>> 13;
    h2 = /* Math.imul(h, m): */
    (h2 & 65535) * 1540483477 + ((h2 >>> 16) * 59797 << 16);
    return ((h2 ^ h2 >>> 15) >>> 0).toString(36);
  }
  function removeElement(el) {
    if (!el)
      return;
    const parentElement = el.parentElement;
    if (parentElement)
      parentElement.removeChild(el);
  }
  function queryElement(id) {
    return document.querySelector(`style[cssr-id="${id}"]`);
  }
  function createElement(id) {
    const el = document.createElement("style");
    el.setAttribute("cssr-id", id);
    return el;
  }
  if (window) {
    window.__cssrContext = {};
  }
  function getCount(el) {
    const count = el.getAttribute("mount-count");
    if (count === null)
      return null;
    return Number(count);
  }
  function setCount(el, count) {
    el.setAttribute("mount-count", String(count));
  }
  function unmount(intance, node, id, count) {
    const { els } = node;
    if (id === void 0) {
      els.forEach(removeElement);
      node.els = [];
    } else {
      const target = queryElement(id);
      if (target && els.includes(target)) {
        const mountCount = getCount(target);
        if (!count) {
          if (mountCount !== null) {
            console.error(`[css-render/unmount]: The style with target='${id}' is mounted in no-count mode.`);
          } else {
            removeElement(target);
            node.els = els.filter((el) => el !== target);
          }
        } else {
          if (mountCount === null) {
            console.error(`[css-render/unmount]: The style with target='${id}' is mounted in count mode.`);
          } else {
            if (mountCount <= 1) {
              removeElement(target);
              node.els = els.filter((el) => el !== target);
            } else
              setCount(target, mountCount - 1);
          }
        }
      }
    }
  }
  function addElementToList(els, target) {
    els.push(target);
  }
  function mount(instance, node, id, props, head, count, boost, force, ssrAdapter) {
    if (boost && !ssrAdapter) {
      if (id === void 0) {
        console.error("[css-render/mount]: `id` is required in `boost` mode.");
        return;
      }
      const cssrContext = window.__cssrContext;
      if (!cssrContext[id]) {
        cssrContext[id] = true;
        render(node, instance, props, boost);
      }
      return;
    }
    let target;
    const { els } = node;
    let style2;
    if (id === void 0) {
      style2 = node.render(props);
      id = murmur2(style2);
    }
    if (ssrAdapter) {
      ssrAdapter(id, style2 !== null && style2 !== void 0 ? style2 : node.render(props));
      return;
    }
    const queriedTarget = queryElement(id);
    if (force || queriedTarget === null) {
      target = queriedTarget === null ? createElement(id) : queriedTarget;
      if (style2 === void 0)
        style2 = node.render(props);
      target.textContent = style2;
      if (queriedTarget !== null)
        return;
      if (head) {
        const firstStyleEl = document.head.getElementsByTagName("style")[0] || null;
        document.head.insertBefore(target, firstStyleEl);
      } else {
        document.head.appendChild(target);
      }
      if (count) {
        setCount(target, 1);
      }
      addElementToList(els, target);
    } else {
      const mountCount = getCount(queriedTarget);
      if (count) {
        if (mountCount === null) {
          console.error(`[css-render/mount]: The style with id='${id}' has been mounted in no-count mode.`);
        } else {
          setCount(queriedTarget, mountCount + 1);
        }
      } else {
        if (mountCount !== null) {
          console.error(`[css-render/mount]: The style with id='${id}' has been mounted in count mode.`);
        }
      }
    }
    return queriedTarget !== null && queriedTarget !== void 0 ? queriedTarget : target;
  }
  function wrappedRender(props) {
    return render(this, this.instance, props);
  }
  function wrappedMount(options = {}) {
    const { target, id, ssr, props, count = false, head = false, boost = false, force = false } = options;
    const targetElement = mount(this.instance, this, id !== null && id !== void 0 ? id : target, props, head, count, boost, force, ssr);
    return targetElement;
  }
  function wrappedUnmount(options = {}) {
    const { id, target, delay = 0, count = false } = options;
    if (delay === 0)
      unmount(this.instance, this, id !== null && id !== void 0 ? id : target, count);
    else {
      setTimeout(() => unmount(this.instance, this, id !== null && id !== void 0 ? id : target, count), delay);
    }
  }
  const createCNode = function(instance, $, props, children) {
    return {
      instance,
      $,
      props,
      children,
      els: [],
      render: wrappedRender,
      mount: wrappedMount,
      unmount: wrappedUnmount
    };
  };
  const c$1 = function(instance, $, props, children) {
    if (Array.isArray($)) {
      return createCNode(instance, { $: null }, null, $);
    }
    if (Array.isArray(props)) {
      return createCNode(instance, $, null, props);
    } else if (Array.isArray(children)) {
      return createCNode(instance, $, props, children);
    } else {
      return createCNode(instance, $, props, null);
    }
  };
  function CssRender(config = {}) {
    let styleSheet = null;
    const cssr = {
      c: (...args) => c$1(cssr, ...args),
      use: (plugin, ...args) => plugin.install(cssr, ...args),
      find: queryElement,
      context: {},
      config,
      get __styleSheet() {
        if (!styleSheet) {
          const style2 = document.createElement("style");
          document.head.appendChild(style2);
          styleSheet = document.styleSheets[document.styleSheets.length - 1];
          return styleSheet;
        }
        return styleSheet;
      }
    };
    return cssr;
  }
  const { c } = CssRender();
  const style = c(".xicon", {
    width: "1em",
    height: "1em",
    display: "inline-flex"
  }, [
    c("svg", {
      width: "1em",
      height: "1em"
    }),
    c("svg:not([fill])", {
      fill: "currentColor"
    })
  ]);
  const mountStyle = () => {
    style.mount({ id: "xicons-icon" });
  };
  const iconConfigProviderProps = {
    size: [String, Number],
    color: String,
    tag: String
  };
  const iconConfigInjectionKey = Symbol("IconConfigInjection");
  const defaultTag = "span";
  const Icon = /* @__PURE__ */ defineComponent({
    name: "Icon",
    props: iconConfigProviderProps,
    setup(props, { slots }) {
      const IconConfigProvider = inject(iconConfigInjectionKey, null);
      const mergedSizeRef = computed(() => {
        var _a2;
        const _size = (_a2 = props.size) !== null && _a2 !== void 0 ? _a2 : IconConfigProvider === null || IconConfigProvider === void 0 ? void 0 : IconConfigProvider.size;
        if (_size === void 0) {
          return void 0;
        }
        if (typeof _size === "number" || /^\d+$/.test(_size))
          return `${_size}px`;
        return _size;
      });
      const mergedColorRef = computed(() => {
        const { color } = props;
        if (color === void 0) {
          if (IconConfigProvider) {
            return IconConfigProvider.color;
          }
          return void 0;
        }
        return color;
      });
      const mergedTagRef = computed(() => {
        var _a2;
        const { tag } = props;
        if (tag === void 0) {
          return (_a2 = IconConfigProvider === null || IconConfigProvider === void 0 ? void 0 : IconConfigProvider.tag) !== null && _a2 !== void 0 ? _a2 : defaultTag;
        }
        return tag;
      });
      onBeforeMount(() => {
        mountStyle();
      });
      return () => h(mergedTagRef.value, {
        class: "xicon",
        style: {
          color: mergedColorRef.value,
          fontSize: mergedSizeRef.value
        }
      }, [
        renderSlot(slots, "default")
      ]);
    }
  });
  const _hoisted_1$o = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const AddOutline = /* @__PURE__ */ defineComponent({
    name: "AddOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$o,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32",
              d: "M256 112v288"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32",
              d: "M400 256H112"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$n = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const AlbumsOutline = /* @__PURE__ */ defineComponent({
    name: "AlbumsOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$n,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "rect",
            {
              x: "64",
              y: "176",
              width: "384",
              height: "256",
              rx: "28.87",
              ry: "28.87",
              fill: "none",
              stroke: "currentColor",
              "stroke-linejoin": "round",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-miterlimit": "10",
              "stroke-width": "32",
              d: "M144 80h224",
              fill: "currentColor"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-miterlimit": "10",
              "stroke-width": "32",
              d: "M112 128h288",
              fill: "currentColor"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$m = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const ArrowBackOutline = /* @__PURE__ */ defineComponent({
    name: "ArrowBackOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$m,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "48",
              d: "M244 400L100 256l144-144"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "48",
              d: "M120 256h292"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$l = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const BookOutline = /* @__PURE__ */ defineComponent({
    name: "BookOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$l,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              d: "M256 160c16-63.16 76.43-95.41 208-96a15.94 15.94 0 0 1 16 16v288a16 16 0 0 1-16 16c-128 0-177.45 25.81-208 64c-30.37-38-80-64-208-64c-9.88 0-16-8.05-16-17.93V80a15.94 15.94 0 0 1 16-16c131.57.59 192 32.84 208 96z",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32",
              d: "M256 160v288"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$k = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const CloseOutline = /* @__PURE__ */ defineComponent({
    name: "CloseOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$k,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32",
              d: "M368 368L144 144"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32",
              d: "M368 144L144 368"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$j = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const CogOutline = /* @__PURE__ */ defineComponent({
    name: "CogOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$j,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              d: "M456.7 242.27l-26.08-4.2a8 8 0 0 1-6.6-6.82c-.5-3.2-1-6.41-1.7-9.51a8.08 8.08 0 0 1 3.9-8.62l23.09-12.82a8.05 8.05 0 0 0 3.9-9.92l-4-11a7.94 7.94 0 0 0-9.4-5l-25.89 5a8 8 0 0 1-8.59-4.11q-2.25-4.2-4.8-8.41a8.16 8.16 0 0 1 .7-9.52l17.29-19.94a8 8 0 0 0 .3-10.62l-7.49-9a7.88 7.88 0 0 0-10.5-1.51l-22.69 13.63a8 8 0 0 1-9.39-.9c-2.4-2.11-4.9-4.21-7.4-6.22a8 8 0 0 1-2.5-9.11l9.4-24.75A8 8 0 0 0 365 78.77l-10.2-5.91a8 8 0 0 0-10.39 2.21l-16.64 20.84a7.15 7.15 0 0 1-8.5 2.5s-5.6-2.3-9.8-3.71A8 8 0 0 1 304 87l.4-26.45a8.07 8.07 0 0 0-6.6-8.42l-11.59-2a8.07 8.07 0 0 0-9.1 5.61l-8.6 25.05a8 8 0 0 1-7.79 5.41h-9.8a8.07 8.07 0 0 1-7.79-5.41l-8.6-25.05a8.07 8.07 0 0 0-9.1-5.61l-11.59 2a8.07 8.07 0 0 0-6.6 8.42l.4 26.45a8 8 0 0 1-5.49 7.71c-2.3.9-7.3 2.81-9.7 3.71c-2.8 1-6.1.2-8.8-2.91l-16.51-20.34A8 8 0 0 0 156.75 73l-10.2 5.91a7.94 7.94 0 0 0-3.3 10.09l9.4 24.75a8.06 8.06 0 0 1-2.5 9.11c-2.5 2-5 4.11-7.4 6.22a8 8 0 0 1-9.39.9L111 116.14a8 8 0 0 0-10.5 1.51l-7.49 9a8 8 0 0 0 .3 10.62l17.29 19.94a8 8 0 0 1 .7 9.52q-2.55 4-4.8 8.41a8.11 8.11 0 0 1-8.59 4.11l-25.89-5a8 8 0 0 0-9.4 5l-4 11a8.05 8.05 0 0 0 3.9 9.92L85.58 213a7.94 7.94 0 0 1 3.9 8.62c-.6 3.2-1.2 6.31-1.7 9.51a8.08 8.08 0 0 1-6.6 6.82l-26.08 4.2a8.09 8.09 0 0 0-7.1 7.92v11.72a7.86 7.86 0 0 0 7.1 7.92l26.08 4.2a8 8 0 0 1 6.6 6.82c.5 3.2 1 6.41 1.7 9.51a8.08 8.08 0 0 1-3.9 8.62L62.49 311.7a8.05 8.05 0 0 0-3.9 9.92l4 11a7.94 7.94 0 0 0 9.4 5l25.89-5a8 8 0 0 1 8.59 4.11q2.25 4.2 4.8 8.41a8.16 8.16 0 0 1-.7 9.52l-17.29 19.96a8 8 0 0 0-.3 10.62l7.49 9a7.88 7.88 0 0 0 10.5 1.51l22.69-13.63a8 8 0 0 1 9.39.9c2.4 2.11 4.9 4.21 7.4 6.22a8 8 0 0 1 2.5 9.11l-9.4 24.75a8 8 0 0 0 3.3 10.12l10.2 5.91a8 8 0 0 0 10.39-2.21l16.79-20.64c2.1-2.6 5.5-3.7 8.2-2.6c3.4 1.4 5.7 2.2 9.9 3.61a8 8 0 0 1 5.49 7.71l-.4 26.45a8.07 8.07 0 0 0 6.6 8.42l11.59 2a8.07 8.07 0 0 0 9.1-5.61l8.6-25a8 8 0 0 1 7.79-5.41h9.8a8.07 8.07 0 0 1 7.79 5.41l8.6 25a8.07 8.07 0 0 0 9.1 5.61l11.59-2a8.07 8.07 0 0 0 6.6-8.42l-.4-26.45a8 8 0 0 1 5.49-7.71c4.2-1.41 7-2.51 9.6-3.51s5.8-1 8.3 2.1l17 20.94A8 8 0 0 0 355 439l10.2-5.91a7.93 7.93 0 0 0 3.3-10.12l-9.4-24.75a8.08 8.08 0 0 1 2.5-9.12c2.5-2 5-4.1 7.4-6.21a8 8 0 0 1 9.39-.9L401 395.66a8 8 0 0 0 10.5-1.51l7.49-9a8 8 0 0 0-.3-10.62l-17.29-19.94a8 8 0 0 1-.7-9.52q2.55-4.05 4.8-8.41a8.11 8.11 0 0 1 8.59-4.11l25.89 5a8 8 0 0 0 9.4-5l4-11a8.05 8.05 0 0 0-3.9-9.92l-23.09-12.82a7.94 7.94 0 0 1-3.9-8.62c.6-3.2 1.2-6.31 1.7-9.51a8.08 8.08 0 0 1 6.6-6.82l26.08-4.2a8.09 8.09 0 0 0 7.1-7.92V250a8.25 8.25 0 0 0-7.27-7.73zM256 112a143.82 143.82 0 0 1 139.38 108.12A16 16 0 0 1 379.85 240H274.61a16 16 0 0 1-13.91-8.09l-52.1-91.71a16 16 0 0 1 9.85-23.39A146.94 146.94 0 0 1 256 112zM112 256a144 144 0 0 1 43.65-103.41a16 16 0 0 1 25.17 3.47L233.06 248a16 16 0 0 1 0 15.87l-52.67 91.7a16 16 0 0 1-25.18 3.36A143.94 143.94 0 0 1 112 256zm144 144a146.9 146.9 0 0 1-38.19-4.95a16 16 0 0 1-9.76-23.44l52.58-91.55a16 16 0 0 1 13.88-8H379.9a16 16 0 0 1 15.52 19.88A143.84 143.84 0 0 1 256 400z",
              fill: "currentColor"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$i = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const ConstructOutline = /* @__PURE__ */ defineComponent({
    name: "ConstructOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$i,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              d: "M436.67 184.11a27.17 27.17 0 0 1-38.3 0l-22.48-22.49a27.15 27.15 0 0 1 0-38.29l50.89-50.89a.85.85 0 0 0-.26-1.38C393.68 57 351.09 64.15 324.05 91c-25.88 25.69-27.35 64.27-17.87 98a27 27 0 0 1-7.67 27.14l-173 160.76a40.76 40.76 0 1 0 57.57 57.54l162.15-173.3a27 27 0 0 1 26.77-7.7c33.46 8.94 71.49 7.26 97.07-17.94c27.49-27.08 33.42-74.94 20.1-102.33a.85.85 0 0 0-1.36-.22z",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-miterlimit": "10",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              d: "M224 284c-17.48-17-25.49-24.91-31-30.29a18.24 18.24 0 0 1-3.33-21.35a20.76 20.76 0 0 1 3.5-4.62l15.68-15.29a18.66 18.66 0 0 1 5.63-3.87a18.11 18.11 0 0 1 20 3.62c5.45 5.29 15.43 15 33.41 32.52",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              d: "M317.07 291.3c40.95 38.1 90.62 83.27 110 99.41a13.46 13.46 0 0 1 .94 19.92L394.63 444a14 14 0 0 1-20.29-.76c-16.53-19.18-61.09-67.11-99.27-107",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              d: "M17.34 193.5l29.41-28.74a4.71 4.71 0 0 1 3.41-1.35a4.85 4.85 0 0 1 3.41 1.35h0a9.86 9.86 0 0 0 8.19 2.77c3.83-.42 7.92-1.6 10.57-4.12c6-5.8-.94-17.23 4.34-24.54a207 207 0 0 1 19.78-22.6c6-5.88 29.84-28.32 69.9-44.45A107.31 107.31 0 0 1 206.67 64c22.59 0 40 10 46.26 15.67a89.54 89.54 0 0 1 10.28 11.64a78.92 78.92 0 0 0-9.21-2.77a68.82 68.82 0 0 0-20-1.26c-13.33 1.09-29.41 7.26-38 14c-13.9 11-19.87 25.72-20.81 44.71c-.68 14.12 2.72 22.1 36.1 55.49a6.6 6.6 0 0 1-.34 9.16l-18.22 18a6.88 6.88 0 0 1-9.54.09c-21.94-21.94-36.65-33.09-45-38.16s-15.07-6.5-18.3-6.85a30.85 30.85 0 0 0-18.27 3.87a11.39 11.39 0 0 0-2.64 2a14.14 14.14 0 0 0 .42 20.08l1.71 1.6a4.63 4.63 0 0 1 0 6.64L71.73 246.6a4.71 4.71 0 0 1-3.41 1.4a4.86 4.86 0 0 1-3.41-1.35l-47.57-46.43a4.88 4.88 0 0 1 0-6.72z",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$h = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const CopyOutline = /* @__PURE__ */ defineComponent({
    name: "CopyOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$h,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "rect",
            {
              x: "128",
              y: "128",
              width: "336",
              height: "336",
              rx: "57",
              ry: "57",
              fill: "none",
              stroke: "currentColor",
              "stroke-linejoin": "round",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              d: "M383.5 128l.5-24a56.16 56.16 0 0 0-56-56H112a64.19 64.19 0 0 0-64 64v216a56.16 56.16 0 0 0 56 56h24",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$g = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const FolderOpenOutline = /* @__PURE__ */ defineComponent({
    name: "FolderOpenOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$g,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              d: "M64 192v-72a40 40 0 0 1 40-40h75.89a40 40 0 0 1 22.19 6.72l27.84 18.56a40 40 0 0 0 22.19 6.72H408a40 40 0 0 1 40 40v40",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              d: "M479.9 226.55L463.68 392a40 40 0 0 1-39.93 40H88.25a40 40 0 0 1-39.93-40L32.1 226.55A32 32 0 0 1 64 192h384.1a32 32 0 0 1 31.8 34.55z",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$f = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const HelpCircleOutline = /* @__PURE__ */ defineComponent({
    name: "HelpCircleOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$f,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              d: "M256 80a176 176 0 1 0 176 176A176 176 0 0 0 256 80z",
              fill: "none",
              stroke: "currentColor",
              "stroke-miterlimit": "10",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              d: "M200 202.29s.84-17.5 19.57-32.57C230.68 160.77 244 158.18 256 158c10.93-.14 20.69 1.67 26.53 4.45c10 4.76 29.47 16.38 29.47 41.09c0 26-17 37.81-36.37 50.8S251 281.43 251 296",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-miterlimit": "10",
              "stroke-width": "28"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "circle",
            {
              cx: "250",
              cy: "348",
              r: "20",
              fill: "currentColor"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$e = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const ImagesOutline = /* @__PURE__ */ defineComponent({
    name: "ImagesOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock("svg", _hoisted_1$e, _cache[0] || (_cache[0] = [createStaticVNode('<path d="M432 112V96a48.14 48.14 0 0 0-48-48H64a48.14 48.14 0 0 0-48 48v256a48.14 48.14 0 0 0 48 48h16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></path><rect x="96" y="128" width="400" height="336" rx="45.99" ry="45.99" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><ellipse cx="372.92" cy="219.64" rx="30.77" ry="30.55" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"></ellipse><path d="M342.15 372.17L255 285.78a30.93 30.93 0 0 0-42.18-1.21L96 387.64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path><path d="M265.23 464l118.59-117.73a31 31 0 0 1 41.46-1.87L496 402.91" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path>', 5)]));
    }
  });
  const _hoisted_1$d = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const LogoCodepen = /* @__PURE__ */ defineComponent({
    name: "LogoCodepen",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock("svg", _hoisted_1$d, _cache[0] || (_cache[0] = [createStaticVNode('<path d="M241.24 303.94c-15.32-10.36-30.74-20.57-46.06-30.93c-2-1.38-3.43-1.48-5.5 0l-38.88 26.12C182 319.9 244 361.32 244 361.32v-53.79c0-1.22-1.55-2.78-2.76-3.59z" fill="currentColor"></path><path d="M195.09 240.67q23.19-15.24 46.11-30.86a7.54 7.54 0 0 0 2.8-5.34v-51.7s-62 41.12-93.26 61.94c13.7 9.16 26.67 17.91 39.78 26.44c1.02.66 3.4.28 4.57-.48z" fill="currentColor"></path><path d="M269.84 209.35q23.71 16.07 47.63 31.82a4.3 4.3 0 0 0 3.83 0l39.76-26.47L268 152.48v53.35a4.79 4.79 0 0 0 1.84 3.52z" fill="currentColor"></path><path d="M258.11 230.37a5.27 5.27 0 0 0-4.74.17c-4.82 3-9.47 6.2-14.17 9.35c-8.25 5.53-25.35 17-25.35 17l38.84 25.86a6.18 6.18 0 0 0 6.26.11l39-26s-34.07-22.66-39.84-26.49z" fill="currentColor"></path><path d="M141 237.12v39.61l29.62-19.84L141 237.12z" fill="currentColor"></path><path d="M256 32C132.29 32 32 132.29 32 256s100.29 224 224 224s224-100.29 224-224S379.71 32 256 32zm139 265c0 5.78-2.65 9.86-7.51 13.09q-61.71 41-123.29 82.19c-5.85 3.92-11.17 3.75-17-.14q-61.17-41-122.63-81.67c-5.11-3.39-7.59-7.56-7.59-13.73V217c0-6.14 2.52-10.34 7.62-13.72c40.91-27.13 81.94-54.36 122.73-81.68c5.82-3.89 11.09-4 16.94-.09q61.54 41.21 123.26 82.19c4.68 3.11 7.45 6.95 7.45 12.66z" fill="currentColor"></path><path d="M316.25 273.23q-22.59 15.34-45.39 30.34c-2.41 1.58-2.89 3.31-2.86 6.19v51.34l93-62l-38.53-25.88c-2.3-1.61-3.89-1.57-6.22.01z" fill="currentColor"></path><path d="M370 276.68v-39.62l-29.59 19.87L370 276.68z" fill="currentColor"></path>', 8)]));
    }
  });
  const _hoisted_1$c = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const RefreshOutline = /* @__PURE__ */ defineComponent({
    name: "RefreshOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$c,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              d: "M320 146s24.36-12-64-12a160 160 0 1 0 160 160",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-miterlimit": "10",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32",
              d: "M256 58l80 80l-80 80"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$b = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const SearchOutline = /* @__PURE__ */ defineComponent({
    name: "SearchOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$b,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              d: "M221.09 64a157.09 157.09 0 1 0 157.09 157.09A157.1 157.1 0 0 0 221.09 64z",
              fill: "none",
              stroke: "currentColor",
              "stroke-miterlimit": "10",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          ),
          createBaseVNode(
            "path",
            {
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-miterlimit": "10",
              "stroke-width": "32",
              d: "M338.29 338.29L448 448"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _hoisted_1$a = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const SettingsOutline = /* @__PURE__ */ defineComponent({
    name: "SettingsOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$a,
        _cache[0] || (_cache[0] = [
          createBaseVNode(
            "path",
            {
              d: "M262.29 192.31a64 64 0 1 0 57.4 57.4a64.13 64.13 0 0 0-57.4-57.4zM416.39 256a154.34 154.34 0 0 1-1.53 20.79l45.21 35.46a10.81 10.81 0 0 1 2.45 13.75l-42.77 74a10.81 10.81 0 0 1-13.14 4.59l-44.9-18.08a16.11 16.11 0 0 0-15.17 1.75A164.48 164.48 0 0 1 325 400.8a15.94 15.94 0 0 0-8.82 12.14l-6.73 47.89a11.08 11.08 0 0 1-10.68 9.17h-85.54a11.11 11.11 0 0 1-10.69-8.87l-6.72-47.82a16.07 16.07 0 0 0-9-12.22a155.3 155.3 0 0 1-21.46-12.57a16 16 0 0 0-15.11-1.71l-44.89 18.07a10.81 10.81 0 0 1-13.14-4.58l-42.77-74a10.8 10.8 0 0 1 2.45-13.75l38.21-30a16.05 16.05 0 0 0 6-14.08c-.36-4.17-.58-8.33-.58-12.5s.21-8.27.58-12.35a16 16 0 0 0-6.07-13.94l-38.19-30A10.81 10.81 0 0 1 49.48 186l42.77-74a10.81 10.81 0 0 1 13.14-4.59l44.9 18.08a16.11 16.11 0 0 0 15.17-1.75A164.48 164.48 0 0 1 187 111.2a15.94 15.94 0 0 0 8.82-12.14l6.73-47.89A11.08 11.08 0 0 1 213.23 42h85.54a11.11 11.11 0 0 1 10.69 8.87l6.72 47.82a16.07 16.07 0 0 0 9 12.22a155.3 155.3 0 0 1 21.46 12.57a16 16 0 0 0 15.11 1.71l44.89-18.07a10.81 10.81 0 0 1 13.14 4.58l42.77 74a10.8 10.8 0 0 1-2.45 13.75l-38.21 30a16.05 16.05 0 0 0-6.05 14.08c.33 4.14.55 8.3.55 12.47z",
              fill: "none",
              stroke: "currentColor",
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              "stroke-width": "32"
            },
            null,
            -1
            /* HOISTED */
          )
        ])
      );
    }
  });
  const _sfc_main$b = /* @__PURE__ */ defineComponent({
    __name: "GoCaptureIcon",
    props: {
      name: {},
      size: { default: 18 },
      depth: { default: 1 }
    },
    setup(__props) {
      const props = __props;
      const icons = {
        add: AddOutline,
        agent: LogoCodepen,
        albums: AlbumsOutline,
        back: ArrowBackOutline,
        book: BookOutline,
        close: CloseOutline,
        copy: CopyOutline,
        cog: CogOutline,
        construct: ConstructOutline,
        folder: FolderOpenOutline,
        help: HelpCircleOutline,
        images: ImagesOutline,
        refresh: RefreshOutline,
        search: SearchOutline,
        settings: SettingsOutline
      };
      const component = computed(() => icons[props.name] || CogOutline);
      return (_ctx, _cache) => {
        return openBlock(), createBlock(unref(Icon), {
          size: __props.size,
          depth: __props.depth
        }, {
          default: withCtx(() => [
            (openBlock(), createBlock(resolveDynamicComponent(component.value)))
          ]),
          _: 1
          /* STABLE */
        }, 8, ["size", "depth"]);
      };
    }
  });
  const _hoisted_1$9 = { class: "mda-thread-group" };
  const _hoisted_2$8 = {
    key: 0,
    class: "mda-thread-list"
  };
  const _hoisted_3$8 = ["disabled", "onClick"];
  const _hoisted_4$8 = { class: "mda-thread-row-main" };
  const _hoisted_5$8 = { class: "mda-thread-row-meta" };
  const _hoisted_6$7 = {
    key: 1,
    class: "mda-thread-group-empty"
  };
  const _sfc_main$a = /* @__PURE__ */ defineComponent({
    __name: "ThreadGroup",
    props: {
      title: {},
      emptyText: {},
      threads: {},
      bindingId: {}
    },
    emits: ["bind"],
    setup(__props) {
      function formatThreadTime(seconds) {
        if (!seconds) return "";
        return new Date(seconds * 1e3).toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        });
      }
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock("section", _hoisted_1$9, [
          createBaseVNode(
            "h3",
            null,
            toDisplayString(__props.title),
            1
            /* TEXT */
          ),
          __props.threads.length ? (openBlock(), createElementBlock("div", _hoisted_2$8, [
            (openBlock(true), createElementBlock(
              Fragment,
              null,
              renderList(__props.threads, (thread) => {
                return openBlock(), createElementBlock("button", {
                  key: thread.id,
                  class: "mda-thread-row",
                  type: "button",
                  disabled: !!__props.bindingId,
                  onClick: ($event) => _ctx.$emit("bind", thread.id)
                }, [
                  createBaseVNode("span", _hoisted_4$8, [
                    createBaseVNode(
                      "strong",
                      null,
                      toDisplayString(thread.name || thread.preview || "未命名任务"),
                      1
                      /* TEXT */
                    ),
                    createBaseVNode(
                      "span",
                      null,
                      toDisplayString(thread.preview || thread.cwd || thread.id),
                      1
                      /* TEXT */
                    )
                  ]),
                  createBaseVNode("span", _hoisted_5$8, [
                    createBaseVNode(
                      "time",
                      null,
                      toDisplayString(formatThreadTime(thread.updatedAt)),
                      1
                      /* TEXT */
                    ),
                    createBaseVNode(
                      "span",
                      null,
                      toDisplayString(__props.bindingId === thread.id ? "绑定中…" : "绑定"),
                      1
                      /* TEXT */
                    )
                  ])
                ], 8, _hoisted_3$8);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])) : (openBlock(), createElementBlock(
            "p",
            _hoisted_6$7,
            toDisplayString(__props.emptyText),
            1
            /* TEXT */
          ))
        ]);
      };
    }
  });
  const _hoisted_1$8 = {
    class: "mda-chat-thread",
    "aria-label": "页面改造对话"
  };
  const _hoisted_2$7 = { class: "mda-message-avatar" };
  const _hoisted_3$7 = { class: "mda-message-bubble" };
  const _hoisted_4$7 = {
    key: 0,
    class: "mda-message-work"
  };
  const _hoisted_5$7 = ["aria-expanded", "onClick"];
  const _hoisted_6$6 = { class: "mda-message-work-label" };
  const _hoisted_7$6 = {
    key: 1,
    class: "mda-message-work-label"
  };
  const _hoisted_8$5 = ["onClick"];
  const _hoisted_9$5 = {
    key: 1,
    class: "mda-message-logs"
  };
  const _hoisted_10$5 = {
    class: "mda-log-chain",
    role: "list",
    "aria-label": "Agent 调用链"
  };
  const _hoisted_11$5 = { class: "mda-log-node-body" };
  const _hoisted_12$5 = ["aria-expanded", "onClick"];
  const _hoisted_13$5 = { class: "mda-log-node-actor" };
  const _hoisted_14$5 = { class: "mda-log-node-title" };
  const _hoisted_15$5 = {
    key: 1,
    class: "mda-log-node-head"
  };
  const _hoisted_16$5 = { class: "mda-log-node-actor" };
  const _hoisted_17$4 = { class: "mda-log-node-title" };
  const _hoisted_18$4 = {
    key: 2,
    class: "mda-message-log-item is-candidate-log"
  };
  const _hoisted_19$4 = { class: "mda-log-file-label" };
  const _hoisted_20$4 = ["onClick"];
  const _hoisted_21$4 = {
    key: 3,
    class: "mda-message-log-pre"
  };
  const _hoisted_22$3 = {
    key: 0,
    class: "mda-message-title"
  };
  const _hoisted_23$2 = {
    key: 1,
    class: "mda-message-text"
  };
  const _hoisted_24$2 = {
    key: 2,
    class: "mda-message-pre"
  };
  const _hoisted_25$2 = {
    key: 3,
    class: "mda-message-actions"
  };
  const _hoisted_26$2 = ["disabled"];
  const _hoisted_27$2 = {
    key: 4,
    class: "mda-message-actions"
  };
  const _hoisted_28$2 = {
    key: 5,
    class: "mda-message-actions"
  };
  const _hoisted_29$2 = ["disabled"];
  const _hoisted_30$2 = {
    key: 6,
    class: "mda-project-config-actions"
  };
  const _hoisted_31$2 = { class: "mda-project-config-main" };
  const _hoisted_32$2 = ["datetime", "title"];
  const _hoisted_33$2 = {
    key: 0,
    class: "mda-warning"
  };
  const _hoisted_34$2 = {
    key: 1,
    class: "mda-warning"
  };
  const _hoisted_35$2 = {
    class: "mda-thread-picker",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "选择开发 Agent"
  };
  const _hoisted_36$2 = { class: "mda-thread-picker-head" };
  const _hoisted_37$1 = {
    class: "mda-agent-provider-grid",
    "aria-label": "可用 Agent"
  };
  const _hoisted_38$1 = ["disabled", "onClick"];
  const _hoisted_39$1 = { class: "mda-agent-provider-icon" };
  const _hoisted_40$1 = { class: "mda-agent-provider-main" };
  const _hoisted_41$1 = {
    key: 0,
    class: "mda-thread-picker-state"
  };
  const _hoisted_42$1 = {
    key: 2,
    class: "mda-agent-provider-note"
  };
  const _hoisted_43$1 = {
    key: 3,
    class: "mda-thread-picker-error"
  };
  const _sfc_main$9 = {
    __name: "ChatThread",
    setup(__props) {
      const commands = useGoCaptureCommands();
      const chatStore = useChatStore();
      const projectStore = useProjectStore();
      const searchStore = useSearchStore();
      const connectAgentStore = useConnectAgentStore();
      const messages = computed(() => chatStore.messages);
      const sourceServiceStatus = computed(() => projectStore.serviceStatus);
      const sourceServiceError = computed(() => projectStore.serviceError);
      const candidateError = computed(() => searchStore.error);
      const activeAgentLabel = computed(() => {
        const provider = connectAgentStore.activeProvider;
        if (!provider) return "选择 Agent";
        return `${provider.name}${provider.projectThreadName ? ` · ${provider.projectThreadName}` : ""}`;
      });
      const nowTick = /* @__PURE__ */ ref(Date.now());
      const logOpenState = /* @__PURE__ */ ref({});
      const logNodeOpenState = /* @__PURE__ */ ref({});
      let clockTimer = 0;
      function openAgentPicker() {
        return __async(this, null, function* () {
          var _a2;
          yield connectAgentStore.openAgentPicker(((_a2 = projectStore.current) == null ? void 0 : _a2.path) || "");
        });
      }
      function chooseAgent(providerId) {
        return __async(this, null, function* () {
          yield connectAgentStore.chooseProvider(providerId);
        });
      }
      function bindAgentThread(threadId) {
        return __async(this, null, function* () {
          var _a2;
          yield connectAgentStore.bindThread(((_a2 = projectStore.current) == null ? void 0 : _a2.path) || "", threadId);
        });
      }
      function providerSummary(provider) {
        if (!provider.installed) return provider.message || "未检测到本地 CLI";
        if (provider.projectThreadName) return provider.projectThreadName;
        if (provider.supportsThreadBinding) return "选择一个项目任务继续对话";
        return provider.message || "首次开发时建立项目会话";
      }
      watch(messages, (nextMessages) => {
        const nextState = {};
        for (const message of nextMessages || []) {
          if (!(message == null ? void 0 : message.id)) continue;
          if (Object.prototype.hasOwnProperty.call(logOpenState.value, message.id)) {
            nextState[message.id] = logOpenState.value[message.id];
          } else {
            nextState[message.id] = !!message.logExpanded;
          }
        }
        logOpenState.value = nextState;
      }, { immediate: true });
      onMounted(() => {
        clockTimer = window.setInterval(() => {
          nowTick.value = Date.now();
        }, 1e3);
      });
      onBeforeUnmount(() => {
        window.clearInterval(clockTimer);
      });
      function avatarText(role) {
        if (role === "user") return "你";
        if (role === "agent") return "模型";
        return "系统";
      }
      function hasLogs(message) {
        return Array.isArray(message == null ? void 0 : message.logs) && message.logs.length > 0;
      }
      function showMessageWork(message) {
        return (message == null ? void 0 : message.role) !== "user" && (hasLogs(message) || Number((message == null ? void 0 : message.durationStartedAt) || 0) > 0);
      }
      function isLogExpanded(id, fallback) {
        if (!id) return !!fallback;
        return Object.prototype.hasOwnProperty.call(logOpenState.value, id) ? logOpenState.value[id] : !!fallback;
      }
      function toggleLog(id, fallback) {
        logOpenState.value = __spreadProps(__spreadValues({}, logOpenState.value), {
          [id]: !isLogExpanded(id, fallback)
        });
      }
      function logChain(logs) {
        return buildLogChain(logs || []);
      }
      function nodeKey(messageId, index) {
        return `${messageId}:${index}`;
      }
      function nodeDefaultExpanded(kind) {
        return kind === "llm-output" || kind === "tool-call" || kind === "decision" || kind === "error";
      }
      function isNodeExpanded(messageId, index, kind) {
        const key = nodeKey(messageId, index);
        return Object.prototype.hasOwnProperty.call(logNodeOpenState.value, key) ? logNodeOpenState.value[key] : nodeDefaultExpanded(kind);
      }
      function toggleNode(messageId, index, kind) {
        const key = nodeKey(messageId, index);
        logNodeOpenState.value = __spreadProps(__spreadValues({}, logNodeOpenState.value), {
          [key]: !isNodeExpanded(messageId, index, kind)
        });
      }
      function copyAllLogs(logs) {
        commands.copyText(serializeLogs(logs || []));
      }
      function formatDuration(ms) {
        const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1e3));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
      }
      function messageDurationMs(message) {
        const startedAt = Number((message == null ? void 0 : message.durationStartedAt) || 0);
        if (!startedAt) return 0;
        const finishedAt = Number((message == null ? void 0 : message.durationFinishedAt) || 0);
        return Math.max(0, (finishedAt || nowTick.value) - startedAt);
      }
      function messageWorkLabel(message) {
        const duration = messageDurationMs(message);
        return `${(message == null ? void 0 : message.durationActive) ? "处理中" : "已处理"} ${formatDuration(duration)}`;
      }
      function messageDate(value) {
        const date = new Date(Number(value || 0));
        return Number.isNaN(date.getTime()) ? null : date;
      }
      function messageTime(value) {
        const date = messageDate(value);
        if (!date) return "";
        return new Intl.DateTimeFormat("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).format(date);
      }
      function messageFullTime(value) {
        const date = messageDate(value);
        if (!date) return "";
        return new Intl.DateTimeFormat("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).format(date);
      }
      function messageDateTime(value) {
        var _a2;
        return ((_a2 = messageDate(value)) == null ? void 0 : _a2.toISOString()) || "";
      }
      function isCandidateLog(log) {
        return /^候选\s+\d+:\s+/.test(log) || /^文件:\s+/.test(log);
      }
      function candidatePrefix(log) {
        const match = String(log || "").match(/^(候选\s+\d+:\s+|文件:\s+)/);
        return match ? match[1] : "";
      }
      function candidateFile(log) {
        return String(log || "").replace(/^(候选\s+\d+:\s+|文件:\s+)/, "").trim();
      }
      return (_ctx, _cache) => {
        var _a2, _b;
        return openBlock(), createElementBlock("section", _hoisted_1$8, [
          (openBlock(true), createElementBlock(
            Fragment,
            null,
            renderList(messages.value, (message) => {
              return openBlock(), createElementBlock(
                "article",
                {
                  key: message.id,
                  class: normalizeClass(["mda-chat-message", `is-${message.role}`])
                },
                [
                  createBaseVNode(
                    "div",
                    _hoisted_2$7,
                    toDisplayString(avatarText(message.role)),
                    1
                    /* TEXT */
                  ),
                  createBaseVNode("div", _hoisted_3$7, [
                    showMessageWork(message) ? (openBlock(), createElementBlock("div", _hoisted_4$7, [
                      hasLogs(message) ? (openBlock(), createElementBlock("button", {
                        key: 0,
                        class: "mda-message-work-toggle",
                        type: "button",
                        "aria-expanded": String(isLogExpanded(message.id, message.logExpanded)),
                        onClick: ($event) => toggleLog(message.id, message.logExpanded)
                      }, [
                        createBaseVNode(
                          "span",
                          _hoisted_6$6,
                          toDisplayString(messageWorkLabel(message)),
                          1
                          /* TEXT */
                        ),
                        createBaseVNode(
                          "i",
                          {
                            class: normalizeClass(["mda-message-work-caret", { "is-open": isLogExpanded(message.id, message.logExpanded) }])
                          },
                          null,
                          2
                          /* CLASS */
                        )
                      ], 8, _hoisted_5$7)) : (openBlock(), createElementBlock(
                        "div",
                        _hoisted_7$6,
                        toDisplayString(messageWorkLabel(message)),
                        1
                        /* TEXT */
                      )),
                      hasLogs(message) ? (openBlock(), createElementBlock("button", {
                        key: 2,
                        class: "mda-message-log-copy",
                        type: "button",
                        title: "复制全部日志",
                        "aria-label": "复制全部日志",
                        onClick: ($event) => copyAllLogs(message.logs)
                      }, [
                        createVNode(_sfc_main$b, {
                          name: "copy",
                          size: 15
                        })
                      ], 8, _hoisted_8$5)) : createCommentVNode("v-if", true)
                    ])) : createCommentVNode("v-if", true),
                    hasLogs(message) && isLogExpanded(message.id, message.logExpanded) ? (openBlock(), createElementBlock("div", _hoisted_9$5, [
                      createBaseVNode("div", _hoisted_10$5, [
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(logChain(message.logs), (node, logIndex) => {
                            return openBlock(), createElementBlock(
                              "div",
                              {
                                key: node.id,
                                class: normalizeClass(["mda-log-node", `is-${node.kind}`]),
                                role: "listitem"
                              },
                              [
                                _cache[5] || (_cache[5] = createBaseVNode(
                                  "span",
                                  {
                                    class: "mda-log-node-marker",
                                    "aria-hidden": "true"
                                  },
                                  null,
                                  -1
                                  /* CACHED */
                                )),
                                createBaseVNode("div", _hoisted_11$5, [
                                  node.expandable ? (openBlock(), createElementBlock("button", {
                                    key: 0,
                                    class: "mda-log-node-head is-expandable",
                                    type: "button",
                                    "aria-expanded": String(isNodeExpanded(message.id, logIndex, node.kind)),
                                    onClick: ($event) => toggleNode(message.id, logIndex, node.kind)
                                  }, [
                                    createBaseVNode(
                                      "span",
                                      _hoisted_13$5,
                                      toDisplayString(node.actor),
                                      1
                                      /* TEXT */
                                    ),
                                    createBaseVNode(
                                      "span",
                                      _hoisted_14$5,
                                      toDisplayString(node.title),
                                      1
                                      /* TEXT */
                                    ),
                                    createBaseVNode(
                                      "i",
                                      {
                                        class: normalizeClass(["mda-message-work-caret", { "is-open": isNodeExpanded(message.id, logIndex, node.kind) }])
                                      },
                                      null,
                                      2
                                      /* CLASS */
                                    )
                                  ], 8, _hoisted_12$5)) : (openBlock(), createElementBlock("div", _hoisted_15$5, [
                                    createBaseVNode(
                                      "span",
                                      _hoisted_16$5,
                                      toDisplayString(node.actor),
                                      1
                                      /* TEXT */
                                    ),
                                    createBaseVNode(
                                      "span",
                                      _hoisted_17$4,
                                      toDisplayString(node.title),
                                      1
                                      /* TEXT */
                                    )
                                  ])),
                                  isCandidateLog(node.raw) ? (openBlock(), createElementBlock("div", _hoisted_18$4, [
                                    createBaseVNode(
                                      "span",
                                      _hoisted_19$4,
                                      toDisplayString(candidatePrefix(node.raw)),
                                      1
                                      /* TEXT */
                                    ),
                                    createBaseVNode("button", {
                                      class: "mda-log-file-link",
                                      type: "button",
                                      onClick: ($event) => unref(commands).openSourceFile(candidateFile(node.raw))
                                    }, toDisplayString(candidateFile(node.raw)), 9, _hoisted_20$4)
                                  ])) : node.expandable && isNodeExpanded(message.id, logIndex, node.kind) ? (openBlock(), createElementBlock(
                                    "pre",
                                    _hoisted_21$4,
                                    toDisplayString(node.raw),
                                    1
                                    /* TEXT */
                                  )) : createCommentVNode("v-if", true)
                                ])
                              ],
                              2
                              /* CLASS */
                            );
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])
                    ])) : createCommentVNode("v-if", true),
                    createBaseVNode(
                      "div",
                      {
                        class: normalizeClass(["mda-message-content", { "has-work": showMessageWork(message) }])
                      },
                      [
                        message.title ? (openBlock(), createElementBlock(
                          "div",
                          _hoisted_22$3,
                          toDisplayString(message.title),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true),
                        message.text ? (openBlock(), createElementBlock(
                          "div",
                          _hoisted_23$2,
                          toDisplayString(message.text),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true),
                        message.pre ? (openBlock(), createElementBlock(
                          "pre",
                          _hoisted_24$2,
                          toDisplayString(message.pre),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true),
                        message.action === "choose-project" ? (openBlock(), createElementBlock("div", _hoisted_25$2, [
                          createBaseVNode("button", {
                            class: "mda-btn mda-btn-primary",
                            type: "button",
                            disabled: sourceServiceStatus.value === "loading",
                            onClick: _cache[0] || (_cache[0] = (...args) => unref(commands).selectProject && unref(commands).selectProject(...args))
                          }, toDisplayString(sourceServiceStatus.value === "loading" ? "选择中" : "选择源码"), 9, _hoisted_26$2)
                        ])) : createCommentVNode("v-if", true),
                        message.action === "copy-prompt" ? (openBlock(), createElementBlock("div", _hoisted_27$2, [
                          createBaseVNode("button", {
                            class: "mda-btn",
                            type: "button",
                            onClick: _cache[1] || (_cache[1] = (...args) => unref(commands).copyPrompt && unref(commands).copyPrompt(...args))
                          }, "复制提示词")
                        ])) : createCommentVNode("v-if", true),
                        message.action === "connect-agent" ? (openBlock(), createElementBlock("div", _hoisted_28$2, [
                          createBaseVNode("button", {
                            class: "mda-btn mda-btn-primary",
                            type: "button",
                            disabled: unref(connectAgentStore).loading,
                            onClick: openAgentPicker
                          }, toDisplayString(unref(connectAgentStore).loading ? "检查中..." : "关联开发 Agent"), 9, _hoisted_29$2)
                        ])) : createCommentVNode("v-if", true),
                        message.action === "agent-settings" ? (openBlock(), createElementBlock("div", _hoisted_30$2, [
                          createBaseVNode("button", {
                            class: "mda-project-config-card is-locator-step",
                            type: "button",
                            onClick: _cache[2] || (_cache[2] = ($event) => unref(commands).openSettings("locator"))
                          }, [..._cache[6] || (_cache[6] = [
                            createBaseVNode(
                              "span",
                              { class: "mda-project-config-main" },
                              [
                                createBaseVNode("em", null, "可选职责 · 前置定位"),
                                createBaseVNode("strong", null, "Locator"),
                                createBaseVNode("small", null, "未配置时由开发 Agent 直接定位")
                              ],
                              -1
                              /* CACHED */
                            ),
                            createBaseVNode(
                              "b",
                              null,
                              "配置",
                              -1
                              /* CACHED */
                            ),
                            createBaseVNode(
                              "span",
                              { class: "mda-locator-card-help" },
                              [
                                createTextVNode(" 为什么配置 Locator？ "),
                                createBaseVNode("span", {
                                  class: "mda-locator-help-tip",
                                  role: "tooltip"
                                }, " Locator 可先用成本更低的模型定位源码，再把精确位置交给关联 Agent，减少主 Agent 的检索轮次和 Token 消耗。 ")
                              ],
                              -1
                              /* CACHED */
                            )
                          ])]),
                          createBaseVNode("button", {
                            class: "mda-project-config-card",
                            type: "button",
                            onClick: openAgentPicker
                          }, [
                            createBaseVNode("span", _hoisted_31$2, [
                              _cache[7] || (_cache[7] = createBaseVNode(
                                "em",
                                null,
                                "主要职责 · 开发执行",
                                -1
                                /* CACHED */
                              )),
                              _cache[8] || (_cache[8] = createBaseVNode(
                                "strong",
                                null,
                                "开发 Agent",
                                -1
                                /* CACHED */
                              )),
                              createBaseVNode(
                                "small",
                                null,
                                toDisplayString(activeAgentLabel.value),
                                1
                                /* TEXT */
                              )
                            ]),
                            _cache[9] || (_cache[9] = createBaseVNode(
                              "b",
                              null,
                              "重新选择",
                              -1
                              /* CACHED */
                            ))
                          ])
                        ])) : createCommentVNode("v-if", true),
                        message.createdAt ? (openBlock(), createElementBlock("time", {
                          key: 7,
                          class: "mda-message-time",
                          datetime: messageDateTime(message.createdAt),
                          title: messageFullTime(message.createdAt)
                        }, toDisplayString(messageTime(message.createdAt)), 9, _hoisted_32$2)) : createCommentVNode("v-if", true)
                      ],
                      2
                      /* CLASS */
                    )
                  ])
                ],
                2
                /* CLASS */
              );
            }),
            128
            /* KEYED_FRAGMENT */
          )),
          sourceServiceError.value ? (openBlock(), createElementBlock(
            "div",
            _hoisted_33$2,
            toDisplayString(sourceServiceError.value),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true),
          candidateError.value ? (openBlock(), createElementBlock(
            "div",
            _hoisted_34$2,
            toDisplayString(candidateError.value),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true),
          (openBlock(), createBlock(Teleport, { to: "body" }, [
            unref(connectAgentStore).threadPickerVisible ? (openBlock(), createElementBlock("div", {
              key: 0,
              class: "mda-thread-picker-backdrop",
              role: "presentation",
              onClick: _cache[4] || (_cache[4] = withModifiers((...args) => unref(connectAgentStore).closeThreadPicker && unref(connectAgentStore).closeThreadPicker(...args), ["self"]))
            }, [
              createBaseVNode("section", _hoisted_35$2, [
                createBaseVNode("header", _hoisted_36$2, [
                  _cache[10] || (_cache[10] = createBaseVNode(
                    "div",
                    null,
                    [
                      createBaseVNode("h2", null, "选择开发 Agent"),
                      createBaseVNode("p", null, "Agent 与当前项目关联；支持任务绑定的 Agent 会继续使用所选任务上下文。")
                    ],
                    -1
                    /* CACHED */
                  )),
                  createBaseVNode("button", {
                    class: "mda-thread-picker-close",
                    type: "button",
                    "aria-label": "关闭",
                    onClick: _cache[3] || (_cache[3] = (...args) => unref(connectAgentStore).closeThreadPicker && unref(connectAgentStore).closeThreadPicker(...args))
                  }, [
                    createVNode(_sfc_main$b, {
                      name: "close",
                      size: 18
                    })
                  ])
                ]),
                createBaseVNode("div", _hoisted_37$1, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(unref(connectAgentStore).providers, (provider) => {
                      return openBlock(), createElementBlock("button", {
                        key: provider.id,
                        class: normalizeClass(["mda-agent-provider-card", { "is-selected": unref(connectAgentStore).pickerProviderId === provider.id }]),
                        type: "button",
                        disabled: unref(connectAgentStore).loading,
                        onClick: ($event) => chooseAgent(provider.id)
                      }, [
                        createBaseVNode("span", _hoisted_39$1, [
                          createVNode(_sfc_main$b, {
                            name: "agent",
                            size: 22
                          })
                        ]),
                        createBaseVNode("span", _hoisted_40$1, [
                          createBaseVNode(
                            "strong",
                            null,
                            toDisplayString(provider.name),
                            1
                            /* TEXT */
                          ),
                          createBaseVNode(
                            "small",
                            null,
                            toDisplayString(providerSummary(provider)),
                            1
                            /* TEXT */
                          )
                        ]),
                        createBaseVNode(
                          "span",
                          {
                            class: normalizeClass(["mda-agent-provider-state", { "is-connected": provider.connected }])
                          },
                          toDisplayString(provider.connected ? "已连接" : provider.installed ? "可连接" : "未安装"),
                          3
                          /* TEXT, CLASS */
                        )
                      ], 10, _hoisted_38$1);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                unref(connectAgentStore).threadLoading ? (openBlock(), createElementBlock("div", _hoisted_41$1, "正在读取 Agent 任务…")) : ((_a2 = unref(connectAgentStore).pickerProvider) == null ? void 0 : _a2.supportsThreadBinding) ? (openBlock(), createElementBlock(
                  Fragment,
                  { key: 1 },
                  [
                    createVNode(_sfc_main$a, {
                      title: "当前项目",
                      "empty-text": `${unref(connectAgentStore).pickerProvider.name} 中还没有这个项目的任务`,
                      threads: unref(connectAgentStore).threadGroups.project,
                      "binding-id": unref(connectAgentStore).bindingThreadId,
                      onBind: bindAgentThread
                    }, null, 8, ["empty-text", "threads", "binding-id"]),
                    createVNode(_sfc_main$a, {
                      title: "最近",
                      "empty-text": `没有可绑定的最近任务，请先在 ${unref(connectAgentStore).pickerProvider.name} 中新建任务`,
                      threads: unref(connectAgentStore).threadGroups.recent,
                      "binding-id": unref(connectAgentStore).bindingThreadId,
                      onBind: bindAgentThread
                    }, null, 8, ["empty-text", "threads", "binding-id"])
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : ((_b = unref(connectAgentStore).pickerProvider) == null ? void 0 : _b.connected) ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_42$1,
                  toDisplayString(unref(connectAgentStore).pickerProvider.name) + " 已关联。首次发送开发需求时会为当前项目建立并保存会话。 ",
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                unref(connectAgentStore).connectionError ? (openBlock(), createElementBlock(
                  "p",
                  _hoisted_43$1,
                  toDisplayString(unref(connectAgentStore).connectionError),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true)
              ])
            ])) : createCommentVNode("v-if", true)
          ]))
        ]);
      };
    }
  };
  const useAppUiStore = /* @__PURE__ */ defineStore("gocapture.appUi", () => {
    const runtimeConnected = /* @__PURE__ */ ref(false);
    const serviceOnline = /* @__PURE__ */ ref(null);
    const serviceHealthMessage = /* @__PURE__ */ ref("");
    const serviceHealthUrl = /* @__PURE__ */ ref("");
    const mcpPanelOpen = /* @__PURE__ */ ref(false);
    const toastText = /* @__PURE__ */ ref("");
    const toastTimer = /* @__PURE__ */ ref(null);
    function setRuntimeConnected(value) {
      runtimeConnected.value = !!value;
    }
    function setServiceOnline(value, message = "", url = "") {
      serviceOnline.value = value;
      serviceHealthMessage.value = message || "";
      serviceHealthUrl.value = url || "";
    }
    function setMcpPanelOpen(value) {
      mcpPanelOpen.value = !!value;
    }
    function setToast(text) {
      toastText.value = text || "";
      cleanupToastTimer();
      if (text) {
        toastTimer.value = window.setTimeout(() => {
          toastText.value = "";
          toastTimer.value = null;
        }, 1800);
      }
    }
    function cleanupToastTimer() {
      if (!toastTimer.value) return;
      clearTimeout(toastTimer.value);
      toastTimer.value = null;
    }
    function cleanupToast() {
      cleanupToastTimer();
      toastText.value = "";
    }
    return {
      runtimeConnected,
      serviceOnline,
      serviceHealthMessage,
      serviceHealthUrl,
      mcpPanelOpen,
      toastText,
      setRuntimeConnected,
      setServiceOnline,
      setMcpPanelOpen,
      setToast,
      cleanupToast
    };
  });
  const useComposerStore = /* @__PURE__ */ defineStore("gocapture.composer", () => {
    const content = /* @__PURE__ */ ref("");
    const finalPrompt = /* @__PURE__ */ ref("");
    const isSending = /* @__PURE__ */ ref(false);
    const mentionMenuVisible = /* @__PURE__ */ ref(false);
    const trimmedContent = computed(() => content.value.trim());
    function setContent(value) {
      content.value = String(value || "");
      if (finalPrompt.value) finalPrompt.value = "";
    }
    function setSending(value) {
      isSending.value = !!value;
    }
    function setFinalPrompt(value) {
      finalPrompt.value = String(value || "");
    }
    function clearContent() {
      content.value = "";
    }
    return {
      content,
      finalPrompt,
      isSending,
      mentionMenuVisible,
      trimmedContent,
      setContent,
      setSending,
      setFinalPrompt,
      clearContent
    };
  });
  const useModelStore = /* @__PURE__ */ defineStore("gocapture.model", () => {
    const selectedModelId = /* @__PURE__ */ ref(null);
    const configs = /* @__PURE__ */ ref([]);
    const useModelAssist = /* @__PURE__ */ ref(false);
    const canUseModelAssist = /* @__PURE__ */ ref(false);
    const editorOpen = /* @__PURE__ */ ref(false);
    const form = /* @__PURE__ */ ref({});
    const status = /* @__PURE__ */ ref("idle");
    const logs = /* @__PURE__ */ ref([]);
    const result = /* @__PURE__ */ ref(null);
    const error = /* @__PURE__ */ ref("");
    const startedAt = /* @__PURE__ */ ref(0);
    const finishedAt = /* @__PURE__ */ ref(0);
    const selectedModel = computed(() => {
      return configs.value.find((item) => item.id === selectedModelId.value) || null;
    });
    function start() {
      status.value = "running";
      logs.value = [];
      result.value = null;
      error.value = "";
      startedAt.value = Date.now();
      finishedAt.value = 0;
    }
    function appendLog(log) {
      logs.value.push(log);
    }
    function applyResult(nextResult) {
      result.value = nextResult;
      status.value = (nextResult == null ? void 0 : nextResult.stopped) ? "stopped" : "success";
      finishedAt.value = Date.now();
    }
    function fail(reason) {
      status.value = "error";
      error.value = `${(reason == null ? void 0 : reason.message) || reason || ""}`;
      finishedAt.value = Date.now();
    }
    function reset() {
      status.value = "idle";
      logs.value = [];
      result.value = null;
      error.value = "";
      startedAt.value = 0;
      finishedAt.value = 0;
    }
    return {
      selectedModelId,
      configs,
      useModelAssist,
      canUseModelAssist,
      editorOpen,
      form,
      status,
      logs,
      result,
      error,
      startedAt,
      finishedAt,
      selectedModel,
      start,
      appendLog,
      applyResult,
      fail,
      reset
    };
  });
  const useRouteStore = /* @__PURE__ */ defineStore("gocapture.route", () => {
    const pageUrl = /* @__PURE__ */ ref("");
    const pagePath = /* @__PURE__ */ ref("/");
    const resolverTrace = /* @__PURE__ */ ref(null);
    const status = /* @__PURE__ */ ref("idle");
    const error = /* @__PURE__ */ ref("");
    function setPage(url, path) {
      pageUrl.value = url;
      pagePath.value = path || "/";
    }
    function applyTrace(trace) {
      resolverTrace.value = trace;
      status.value = (trace == null ? void 0 : trace.matched) ? "success" : "idle";
      error.value = "";
    }
    function fail(reason) {
      status.value = "error";
      error.value = `${(reason == null ? void 0 : reason.message) || reason || ""}`;
    }
    return {
      pageUrl,
      pagePath,
      resolverTrace,
      status,
      error,
      setPage,
      applyTrace,
      fail
    };
  });
  function compactText(text, limit = 240) {
    let value = String(text || "").replace(/\s+/g, " ").trim();
    if (value.length > limit) value = `${value.slice(0, limit)}...`;
    return value;
  }
  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function extractSearchTerms(text) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    const pieces = value.split(/[\n\r\t,，。；;|/\\()[\]{}<>:：]+|\s{2,}/).map((item) => item.trim()).filter(Boolean);
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
  const useSelectionStore = /* @__PURE__ */ defineStore("gocapture.selection", () => {
    const items = /* @__PURE__ */ ref([]);
    const activeId = /* @__PURE__ */ ref(null);
    const confirmed = /* @__PURE__ */ ref(false);
    const filesConfirmed = /* @__PURE__ */ ref(false);
    const customEvidence = /* @__PURE__ */ ref("");
    const evidenceMessages = /* @__PURE__ */ ref([]);
    const latest = computed(() => items.value[items.value.length - 1] || null);
    const hasSelection = computed(() => items.value.length > 0);
    const promptAssets = computed(() => {
      return items.value.map((item, index) => {
        const info = item.element || {};
        const assetInfo = item.asset || info;
        return {
          uid: item.uid,
          token: `@选区${index + 1}`,
          index: index + 1,
          label: `选区 ${index + 1}`,
          summary: compactText(info.text || info.className || info.tag || assetInfo.text || `选区${index + 1}`, 24),
          thumbnailUrl: item.thumbnailUrl || "",
          className: info.className || "",
          text: info.text || "",
          selector: info.selector || "",
          innerHtml: info.innerHtml || "",
          outerHtml: info.outerHtml || "",
          inlineStyle: info.inlineStyle || "",
          computedStyle: info.computedStyle || null,
          box: info.box || null,
          assetSelector: assetInfo.selector || "",
          assetText: assetInfo.text || "",
          assetInnerHtml: assetInfo.innerHtml || "",
          assetOuterHtml: assetInfo.outerHtml || "",
          assetInlineStyle: assetInfo.inlineStyle || "",
          assetComputedStyle: assetInfo.computedStyle || null,
          assetBox: assetInfo.box || null,
          thumbnailCaptured: !!item.thumbnailUrl
        };
      });
    });
    function mapRuntimeSelection(raw, index, previous) {
      const element = (raw == null ? void 0 : raw.element) || (raw == null ? void 0 : raw.info) || raw || {};
      const uid2 = (raw == null ? void 0 : raw.uid) || element.uid || `remote-selection-${Date.now()}-${index}`;
      const thumbnailUrl = (raw == null ? void 0 : raw.thumbnailUrl) || (raw == null ? void 0 : raw.thumbnail) || (previous == null ? void 0 : previous.thumbnailUrl) || "";
      return {
        uid: uid2,
        createdAt: Number((raw == null ? void 0 : raw.createdAt) || (raw == null ? void 0 : raw.capturedAt) || (previous == null ? void 0 : previous.createdAt) || Date.now()),
        pageBindingId: (raw == null ? void 0 : raw.pageBindingId) || (raw == null ? void 0 : raw.workspaceId) || (previous == null ? void 0 : previous.pageBindingId) || "",
        element,
        asset: (raw == null ? void 0 : raw.asset) || element,
        sourceLocate: (raw == null ? void 0 : raw.sourceLocate) || (raw == null ? void 0 : raw.sourceEvidence) || element.sourceLocate || null,
        sourceBinding: (raw == null ? void 0 : raw.sourceBinding) || (previous == null ? void 0 : previous.sourceBinding) || null,
        thumbnailUrl,
        thumbnailCaptured: !!thumbnailUrl
      };
    }
    function replaceSelections(rawSelections) {
      var _a2;
      const previousById = new Map(items.value.map((item) => [item.uid, item]));
      items.value = (Array.isArray(rawSelections) ? rawSelections : []).map((raw, index) => {
        const element = (raw == null ? void 0 : raw.element) || (raw == null ? void 0 : raw.info) || raw || {};
        const uid2 = (raw == null ? void 0 : raw.uid) || element.uid || "";
        return mapRuntimeSelection(raw, index, uid2 ? previousById.get(uid2) : void 0);
      });
      activeId.value = ((_a2 = latest.value) == null ? void 0 : _a2.uid) || null;
      confirmed.value = false;
      filesConfirmed.value = false;
    }
    function bindSourceContext(id, binding) {
      const item = items.value.find((selection) => selection.uid === id);
      if (!item) return false;
      item.sourceBinding = binding;
      return true;
    }
    function restoreLocationReferences(references, projectRoot) {
      var _a2;
      for (const reference of references) {
        const uid2 = String((reference == null ? void 0 : reference.selectionId) || "").trim();
        const targets = (Array.isArray(reference == null ? void 0 : reference.locations) ? reference.locations : []).map((location) => ({
          file: String((location == null ? void 0 : location.file) || "").trim(),
          role: "render",
          line: Number((location == null ? void 0 : location.startLine) || 0),
          anchor: String((location == null ? void 0 : location.anchor) || "").trim()
        })).filter((location) => location.file && (location.line || location.anchor));
        if (!uid2 || !targets.length) continue;
        const existing = items.value.find((item) => item.uid === uid2);
        const sourceBinding2 = {
          selectionId: uid2,
          projectRoot,
          designRequirement: "",
          targets,
          resolvedAt: Date.now()
        };
        if (existing) {
          existing.sourceBinding = sourceBinding2;
          if (reference.thumbnail) existing.thumbnailUrl = reference.thumbnail;
          continue;
        }
        const first = targets[0];
        items.value.push(mapRuntimeSelection({
          uid: uid2,
          element: {
            tag: "source",
            className: "",
            text: first.anchor || first.file,
            selector: first.file
          },
          sourceBinding: sourceBinding2,
          thumbnailUrl: reference.thumbnail || ""
        }, items.value.length));
      }
      activeId.value = ((_a2 = latest.value) == null ? void 0 : _a2.uid) || null;
    }
    function sourceBinding(id) {
      var _a2;
      return ((_a2 = items.value.find((selection) => selection.uid === id)) == null ? void 0 : _a2.sourceBinding) || null;
    }
    function bindAgentContext(id, context, fallbackBinding) {
      const item = items.value.find((selection) => selection.uid === id);
      if (!item) return false;
      item.sourceBinding = __spreadProps(__spreadValues({}, item.sourceBinding || fallbackBinding), {
        selectionId: id,
        agentContext: context
      });
      return true;
    }
    function removeSelection(id) {
      var _a2;
      items.value = items.value.filter((item) => item.uid !== id);
      if (activeId.value === id) activeId.value = ((_a2 = latest.value) == null ? void 0 : _a2.uid) || null;
      confirmed.value = false;
      filesConfirmed.value = false;
    }
    function clear() {
      items.value = [];
      activeId.value = null;
      confirmed.value = false;
      filesConfirmed.value = false;
      customEvidence.value = "";
      evidenceMessages.value = [];
    }
    function setActive(id) {
      activeId.value = id;
    }
    function markConfirmed(value) {
      confirmed.value = value;
      if (!value) filesConfirmed.value = false;
    }
    return {
      items,
      activeId,
      confirmed,
      filesConfirmed,
      customEvidence,
      evidenceMessages,
      latest,
      hasSelection,
      promptAssets,
      replaceSelections,
      bindSourceContext,
      restoreLocationReferences,
      bindAgentContext,
      sourceBinding,
      removeSelection,
      clear,
      setActive,
      markConfirmed
    };
  });
  function candidateStageLabel(hit) {
    const labels = {
      keyword: "关键词命中",
      reverse: "组件反查",
      "import-chain": "import 链路",
      "route-import-chain": "页面链路",
      "api-endpoint": "接口定义",
      "api-usage": "接口调用",
      "api-upstream": "上层引用",
      "model-agent": "模型定位",
      "runtime-source": "框架运行时定位",
      "route-resolver": "页面路由"
    };
    return labels[hit == null ? void 0 : hit.stage] || "候选命中";
  }
  function candidateStageExplanation(hit) {
    const reasons = hit.reasons || [];
    const uniqueLine = hit.preciseEvidence ? `可靠证据: 选区上下文与命中文案在同文件汇合${hit.exactMatchText ? `；命中 "${hit.exactMatchText}"` : ""}${hit.contextScore ? `；上下文分 ${hit.contextScore}` : ""}` : hit.uniqueSnippet && hit.uniqueMatchCount === 1 ? `可靠证据: 文件内唯一文案命中(${hit.uniqueMatchLabel || "文案"}) "${hit.uniqueMatchText || "-"}"，但仍需结合页面上下文判断` : "可靠证据: 暂无强页面上下文证据，当前只作为候选参与排序";
    if (hit.stage === "import-chain" || hit.stage === "route-import-chain") {
      return [
        hit.stage === "route-import-chain" ? `定位过程: 先用页面 path 命中当前页面入口 ${hit.anchorFile || hit.from || "-"}，再沿 import 链路访问到该候选文件` : `定位过程: 先用补充线索命中 ${hit.anchorFile || hit.from || "-"}，再沿 import 链路访问到该候选文件`,
        hit.importChain && hit.importChain.length ? `import 链路: ${hit.importChain.join(" -> ")}` : "",
        uniqueLine,
        ...reasons.slice(0, 6).map((reason) => `依据: ${reason}`)
      ];
    }
    if (hit.stage === "reverse") {
      return [
        `定位过程: 先命中子组件/模块 ${hit.from || "-"}，再反查哪些页面或模块引用它`,
        uniqueLine,
        ...reasons.slice(0, 6).map((reason) => `依据: ${reason}`)
      ];
    }
    if (hit.stage === "api-endpoint" || hit.stage === "api-usage" || hit.stage === "api-upstream") {
      return [
        "定位过程: 先用接口端点搜索接口封装，再追踪函数/符号引用到页面或模块",
        hit.from ? `来源: ${hit.from}` : "",
        uniqueLine,
        ...reasons.slice(0, 6).map((reason) => `依据: ${reason}`)
      ];
    }
    if (hit.stage === "route-resolver") {
      return [
        `定位过程: 先按当前页面 path 选择 ${hit.routeAdapter || "unknown"} 路由适配器，再解析路由声明或文件系统路由`,
        hit.from ? `来源: ${hit.from}` : "",
        hit.routePath ? `路由 path: ${hit.routePath}` : "",
        uniqueLine,
        ...reasons.slice(0, 6).map((reason) => `依据: ${reason}`)
      ];
    }
    if (hit.stage === "model-agent") {
      const preModelSource = hit.preModelStage ? `本地来源: ${candidateStageLabel({ stage: hit.preModelStage })}` : "";
      const preModelRuntimeReasons = hit.preModelStage === "runtime-source" ? (hit.preModelReasons || []).slice(0, 4).map((reason) => `运行时依据: ${reason}`) : [];
      return [
        `定位过程: 模型阅读本地预检索结果、候选文件内容和选区证据后推荐该文件`,
        preModelSource,
        hit.modelAdapter ? `模型: ${hit.modelAdapter}` : "",
        hit.modelConfidence ? `置信度: ${hit.modelConfidence}%` : "",
        hit.modelLocateLevel ? `定位层级: ${hit.modelLocateLevel}${hit.modelDowngradedToDirection ? "；片段未逐字验证，已降级为源码方向" : ""}` : "",
        hit.modelCodeSnippet ? `${hit.modelSnippetVerified === false ? "模型源码方向片段" : "模型代码片段"}: ${hit.modelCodeSnippet}` : "",
        hit.modelDirectionGuess ? `推测方向: ${hit.modelDirectionGuess}` : "",
        hit.modelPrompt ? `模型提示词: ${hit.modelPrompt}` : "",
        uniqueLine,
        ...preModelRuntimeReasons,
        ...reasons.slice(0, 6).map((reason) => `依据: ${reason}`)
      ];
    }
    if (hit.stage === "runtime-source") {
      return [
        `定位过程: 由页面运行时组件实例/Fiber/调试字段直接提供源码线索`,
        hit.framework ? `框架: ${hit.framework}` : "",
        hit.sourceConfidence ? `置信度: ${hit.sourceConfidence}` : "",
        hit.sourceComponentName ? `组件: ${hit.sourceComponentName}` : "",
        hit.sourceLine ? `源码位置: ${hit.sourceLine}${hit.sourceColumn ? `:${hit.sourceColumn}` : ""}` : "",
        hit.sourceRuntimeFile ? `运行时路径: ${hit.sourceRuntimeFile}` : "",
        ...reasons.slice(0, 6).map((reason) => `依据: ${reason}`)
      ];
    }
    return [
      "定位过程: 直接用页面文案、className、URL path、用户补充证据检索源码内容和路径",
      uniqueLine,
      ...reasons.slice(0, 6).map((reason) => `依据: ${reason}`)
    ];
  }
  function candidateLogLines(hit, index) {
    if (!hit) return [];
    const lines = [
      index != null ? `候选 ${index + 1}: ${hit.file}` : `文件: ${hit.file}`,
      `命中方式: ${candidateStageLabel(hit)}；分数 ${hit.score}`,
      hit.exactMatchText ? `文案命中统计: "${hit.exactMatchText}" 在该文件出现 ${hit.exactMatchCount || 0} 次` : "",
      ...candidateStageExplanation(hit)
    ].filter(Boolean);
    if (hit.preciseSnippet || hit.uniqueSnippet && hit.uniqueMatchCount === 1) {
      lines.push(`源码片段:
${hit.preciseSnippet || hit.uniqueSnippet}`);
    }
    return lines;
  }
  function candidateDetailTitle(hit) {
    return (hit == null ? void 0 : hit.preciseSnippet) || (hit == null ? void 0 : hit.uniqueSnippet) && hit.uniqueMatchCount === 1 ? "查看命中片段和日志" : "查看检索日志";
  }
  function candidateLogText(hit) {
    return candidateLogLines(hit).join("\n");
  }
  const _hoisted_1$7 = {
    key: 0,
    class: "mda-composer-options mda-composite"
  };
  const _hoisted_2$6 = { class: "mda-composite-row" };
  const _hoisted_3$6 = {
    key: 0,
    class: "mda-composite-line"
  };
  const _hoisted_4$6 = {
    key: 0,
    class: "mda-composite-row"
  };
  const _hoisted_5$6 = {
    key: 1,
    class: "mda-composite-row"
  };
  const _hoisted_6$5 = ["onClick"];
  const _hoisted_7$5 = ["onClick"];
  const _hoisted_8$4 = {
    key: 0,
    class: "mda-composite-anchor"
  };
  const _hoisted_9$4 = ["onClick"];
  const _hoisted_10$4 = {
    key: 1,
    class: "mda-composer-options mda-plan"
  };
  const _hoisted_11$4 = { class: "mda-plan-body" };
  const _hoisted_12$4 = {
    key: 0,
    class: "mda-plan-summary"
  };
  const _hoisted_13$4 = {
    key: 1,
    class: "mda-plan-block"
  };
  const _hoisted_14$4 = ["onClick"];
  const _hoisted_15$4 = {
    key: 0,
    class: "mda-composite-line"
  };
  const _hoisted_16$4 = {
    key: 0,
    class: "mda-composite-anchor"
  };
  const _hoisted_17$3 = {
    key: 1,
    class: "mda-plan-what"
  };
  const _hoisted_18$3 = {
    key: 2,
    class: "mda-plan-why"
  };
  const _hoisted_19$3 = {
    key: 2,
    class: "mda-plan-block"
  };
  const _hoisted_20$3 = ["onClick"];
  const _hoisted_21$3 = { class: "mda-composite-anchor" };
  const _hoisted_22$2 = { class: "mda-plan-block-title" };
  const _hoisted_23$1 = {
    key: 3,
    class: "mda-plan-block"
  };
  const _hoisted_24$1 = ["checked", "onChange"];
  const _hoisted_25$1 = {
    key: 2,
    class: "mda-composer-options"
  };
  const _hoisted_26$1 = { class: "mda-collapsible-head" };
  const _hoisted_27$1 = {
    key: 0,
    class: "mda-collapsed-summary"
  };
  const _hoisted_28$1 = {
    key: 1,
    class: "mda-choice-list"
  };
  const _hoisted_29$1 = { class: "mda-choice-check" };
  const _hoisted_30$1 = ["checked", "onChange"];
  const _hoisted_31$1 = ["onClick"];
  const _hoisted_32$1 = {
    key: 0,
    class: "mda-composite-line"
  };
  const _hoisted_33$1 = { class: "mda-choice-meta" };
  const _hoisted_34$1 = ["onClick"];
  const _hoisted_35$1 = {
    key: 0,
    class: "mda-candidate-log"
  };
  const _hoisted_36$1 = {
    key: 3,
    class: "mda-composer-options"
  };
  const _sfc_main$8 = {
    __name: "CandidateOptions",
    setup(__props) {
      const commands = useGoCaptureCommands();
      const searchStore = useSearchStore();
      const modelStore = useModelStore();
      const showCandidatePicker = computed(() => searchStore.showCandidatePicker);
      const needsMoreEvidence = computed(() => searchStore.needsMoreEvidence);
      const candidateHits = computed(() => searchStore.candidates);
      const composite = computed(() => searchStore.composite);
      const changePlan = computed(() => searchStore.changePlan);
      const checkedQuestions = /* @__PURE__ */ ref([]);
      const hasChangePlanContent = computed(() => {
        const plan = changePlan.value;
        if (!plan) return false;
        return !!(plan.summary || (plan.targets || []).length || (plan.affected || []).length || (plan.reusePatterns || []).length || (plan.risks || []).length || (plan.verification || []).length || (plan.openQuestions || []).length);
      });
      const plainPlanSections = [
        { key: "reusePatterns", label: "可复用模式" },
        { key: "risks", label: "风险" },
        { key: "verification", label: "验证" }
      ];
      const openQuestions = computed(() => {
        var _a2;
        return Array.isArray((_a2 = changePlan.value) == null ? void 0 : _a2.openQuestions) ? changePlan.value.openQuestions : [];
      });
      const openQuestionItems = computed(() => openQuestions.value.map((line, index) => ({ text: planLineText(line), key: `open-${index}-${planLineText(line)}` })).filter((item) => item.text));
      const selectedCandidatePaths = computed(() => searchStore.selectedCandidatePaths);
      const expandedCandidatePath = computed(() => searchStore.expandedCandidatePath);
      const modelAssistLoading = computed(() => modelStore.status === "running");
      const collapsed = /* @__PURE__ */ ref(false);
      watch(modelAssistLoading, (value) => {
        if (value) collapsed.value = true;
      });
      watch(openQuestions, (questions) => {
        const allowed = new Set(questions.map(planLineText).filter(Boolean));
        checkedQuestions.value = checkedQuestions.value.filter((item) => allowed.has(item));
      }, { immediate: true });
      function isCandidateSelected(hit) {
        return !!hit && selectedCandidatePaths.value.includes(hit.file);
      }
      function isQuestionChecked(line) {
        return checkedQuestions.value.includes(line);
      }
      function toggleQuestion(line) {
        if (isQuestionChecked(line)) {
          checkedQuestions.value = checkedQuestions.value.filter((item) => item !== line);
          return;
        }
        checkedQuestions.value = [...checkedQuestions.value, line];
      }
      function planLineText(value) {
        if (value == null) return "";
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
        if (Array.isArray(value)) return value.map(planLineText).filter(Boolean).join("；");
        if (typeof value === "object") {
          const preferred = [
            "text",
            "title",
            "description",
            "reason",
            "question",
            "content",
            "message",
            "risk",
            "verification",
            "expected",
            "action",
            "value",
            "label"
          ];
          for (const key of preferred) {
            const text = planLineText(value[key]);
            if (text) return text;
          }
          return Object.entries(value).map(([key, item]) => {
            const text = planLineText(item);
            return text ? `${key}: ${text}` : "";
          }).filter(Boolean).join("；");
        }
        return "";
      }
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock(
          Fragment,
          null,
          [
            composite.value ? (openBlock(), createElementBlock("div", _hoisted_1$7, [
              _cache[10] || (_cache[10] = createBaseVNode(
                "div",
                { class: "mda-option-title" },
                "源码组合定位",
                -1
                /* CACHED */
              )),
              createBaseVNode("div", _hoisted_2$6, [
                _cache[4] || (_cache[4] = createBaseVNode(
                  "span",
                  { class: "mda-composite-tag mda-composite-render" },
                  "主渲染",
                  -1
                  /* CACHED */
                )),
                createBaseVNode("button", {
                  class: "mda-file-link",
                  type: "button",
                  onClick: _cache[0] || (_cache[0] = ($event) => unref(commands).openSourceFile(composite.value.render.file, composite.value.render.line, composite.value.render.column))
                }, [
                  createTextVNode(
                    toDisplayString(composite.value.render.file),
                    1
                    /* TEXT */
                  ),
                  composite.value.render.line ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_3$6,
                    ":" + toDisplayString(composite.value.render.line),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
                ])
              ]),
              composite.value.regionOwner ? (openBlock(), createElementBlock("div", _hoisted_4$6, [
                _cache[5] || (_cache[5] = createBaseVNode(
                  "span",
                  { class: "mda-composite-tag" },
                  "区域所有者",
                  -1
                  /* CACHED */
                )),
                createBaseVNode(
                  "button",
                  {
                    class: "mda-file-link",
                    type: "button",
                    onClick: _cache[1] || (_cache[1] = ($event) => unref(commands).openSourceFile(composite.value.regionOwner.file))
                  },
                  toDisplayString(composite.value.regionOwner.file),
                  1
                  /* TEXT */
                )
              ])) : composite.value.assembly ? (openBlock(), createElementBlock("div", _hoisted_5$6, [
                _cache[6] || (_cache[6] = createBaseVNode(
                  "span",
                  { class: "mda-composite-tag" },
                  "装配",
                  -1
                  /* CACHED */
                )),
                createBaseVNode(
                  "button",
                  {
                    class: "mda-file-link",
                    type: "button",
                    onClick: _cache[2] || (_cache[2] = ($event) => unref(commands).openSourceFile(composite.value.assembly.file))
                  },
                  toDisplayString(composite.value.assembly.file),
                  1
                  /* TEXT */
                )
              ])) : createCommentVNode("v-if", true),
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(composite.value.coRenders || [], (co) => {
                  return openBlock(), createElementBlock("div", {
                    key: `co-${co.file}`,
                    class: "mda-composite-row"
                  }, [
                    _cache[7] || (_cache[7] = createBaseVNode(
                      "span",
                      { class: "mda-composite-tag mda-composite-render" },
                      "并列渲染",
                      -1
                      /* CACHED */
                    )),
                    createBaseVNode("button", {
                      class: "mda-file-link",
                      type: "button",
                      onClick: ($event) => unref(commands).openSourceFile(co.file)
                    }, toDisplayString(co.file), 9, _hoisted_6$5)
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(composite.value.children || [], (child) => {
                  return openBlock(), createElementBlock("div", {
                    key: `child-${child.file}`,
                    class: "mda-composite-row"
                  }, [
                    _cache[8] || (_cache[8] = createBaseVNode(
                      "span",
                      { class: "mda-composite-tag" },
                      "子组件",
                      -1
                      /* CACHED */
                    )),
                    createBaseVNode("button", {
                      class: "mda-file-link",
                      type: "button",
                      onClick: ($event) => unref(commands).openSourceFile(child.file)
                    }, toDisplayString(child.file), 9, _hoisted_7$5),
                    child.anchor ? (openBlock(), createElementBlock(
                      "span",
                      _hoisted_8$4,
                      toDisplayString(child.anchor),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true)
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(composite.value.bridgeFiles || [], (bridge) => {
                  return openBlock(), createElementBlock("div", {
                    key: `bridge-${bridge.file}`,
                    class: "mda-composite-row"
                  }, [
                    _cache[9] || (_cache[9] = createBaseVNode(
                      "span",
                      { class: "mda-composite-tag" },
                      "装配桥梁",
                      -1
                      /* CACHED */
                    )),
                    createBaseVNode("button", {
                      class: "mda-file-link",
                      type: "button",
                      onClick: ($event) => unref(commands).openSourceFile(bridge.file)
                    }, toDisplayString(bridge.file), 9, _hoisted_9$4)
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : createCommentVNode("v-if", true),
            hasChangePlanContent.value ? (openBlock(), createElementBlock("div", _hoisted_10$4, [
              _cache[14] || (_cache[14] = createBaseVNode(
                "div",
                { class: "mda-option-title" },
                "修改计划",
                -1
                /* CACHED */
              )),
              createBaseVNode("div", _hoisted_11$4, [
                changePlan.value.summary ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_12$4,
                  toDisplayString(changePlan.value.summary),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                (changePlan.value.targets || []).length ? (openBlock(), createElementBlock("div", _hoisted_13$4, [
                  _cache[11] || (_cache[11] = createBaseVNode(
                    "div",
                    { class: "mda-plan-block-title" },
                    "改动点",
                    -1
                    /* CACHED */
                  )),
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(changePlan.value.targets, (target, index) => {
                      return openBlock(), createElementBlock("div", {
                        key: `t-${index}`,
                        class: "mda-plan-target"
                      }, [
                        createBaseVNode("button", {
                          class: "mda-file-link",
                          type: "button",
                          onClick: ($event) => unref(commands).openSourceFile(target.file, target.line)
                        }, [
                          createTextVNode(
                            toDisplayString(target.file),
                            1
                            /* TEXT */
                          ),
                          target.line ? (openBlock(), createElementBlock(
                            "span",
                            _hoisted_15$4,
                            ":" + toDisplayString(target.line),
                            1
                            /* TEXT */
                          )) : createCommentVNode("v-if", true)
                        ], 8, _hoisted_14$4),
                        target.anchor ? (openBlock(), createElementBlock(
                          "span",
                          _hoisted_16$4,
                          toDisplayString(target.anchor),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true),
                        target.whatToChange ? (openBlock(), createElementBlock(
                          "div",
                          _hoisted_17$3,
                          "改：" + toDisplayString(target.whatToChange),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true),
                        target.why ? (openBlock(), createElementBlock(
                          "div",
                          _hoisted_18$3,
                          "因：" + toDisplayString(target.why),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true)
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])) : createCommentVNode("v-if", true),
                (changePlan.value.affected || []).length ? (openBlock(), createElementBlock("div", _hoisted_19$3, [
                  _cache[12] || (_cache[12] = createBaseVNode(
                    "div",
                    { class: "mda-plan-block-title" },
                    "连带影响",
                    -1
                    /* CACHED */
                  )),
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(changePlan.value.affected, (item, index) => {
                      return openBlock(), createElementBlock("div", {
                        key: `a-${index}`,
                        class: "mda-plan-line"
                      }, [
                        createBaseVNode("button", {
                          class: "mda-file-link",
                          type: "button",
                          onClick: ($event) => unref(commands).openSourceFile(item.file)
                        }, toDisplayString(item.file), 9, _hoisted_20$3),
                        createBaseVNode(
                          "span",
                          _hoisted_21$3,
                          toDisplayString(item.reason),
                          1
                          /* TEXT */
                        )
                      ]);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])) : createCommentVNode("v-if", true),
                (openBlock(), createElementBlock(
                  Fragment,
                  null,
                  renderList(plainPlanSections, (section) => {
                    return createBaseVNode("div", {
                      key: section.key,
                      class: "mda-plan-block"
                    }, [
                      (changePlan.value[section.key] || []).length ? (openBlock(), createElementBlock(
                        Fragment,
                        { key: 0 },
                        [
                          createBaseVNode(
                            "div",
                            _hoisted_22$2,
                            toDisplayString(section.label),
                            1
                            /* TEXT */
                          ),
                          (openBlock(true), createElementBlock(
                            Fragment,
                            null,
                            renderList(changePlan.value[section.key], (line, index) => {
                              return openBlock(), createElementBlock(
                                "div",
                                {
                                  key: `${section.key}-${index}`,
                                  class: "mda-plan-line"
                                },
                                "· " + toDisplayString(planLineText(line)),
                                1
                                /* TEXT */
                              );
                            }),
                            128
                            /* KEYED_FRAGMENT */
                          ))
                        ],
                        64
                        /* STABLE_FRAGMENT */
                      )) : createCommentVNode("v-if", true)
                    ]);
                  }),
                  64
                  /* STABLE_FRAGMENT */
                )),
                openQuestionItems.value.length ? (openBlock(), createElementBlock("div", _hoisted_23$1, [
                  _cache[13] || (_cache[13] = createBaseVNode(
                    "div",
                    { class: "mda-plan-block-title" },
                    "待确认",
                    -1
                    /* CACHED */
                  )),
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(openQuestionItems.value, (item) => {
                      return openBlock(), createElementBlock(
                        "label",
                        {
                          key: item.key,
                          class: normalizeClass(["mda-plan-check", { "is-checked": isQuestionChecked(item.text) }])
                        },
                        [
                          createBaseVNode("input", {
                            type: "checkbox",
                            checked: isQuestionChecked(item.text),
                            onChange: ($event) => toggleQuestion(item.text)
                          }, null, 40, _hoisted_24$1),
                          createBaseVNode(
                            "span",
                            null,
                            toDisplayString(item.text),
                            1
                            /* TEXT */
                          )
                        ],
                        2
                        /* CLASS */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])) : createCommentVNode("v-if", true)
              ])
            ])) : createCommentVNode("v-if", true),
            showCandidatePicker.value ? (openBlock(), createElementBlock("div", _hoisted_25$1, [
              createBaseVNode("div", _hoisted_26$1, [
                _cache[15] || (_cache[15] = createBaseVNode(
                  "div",
                  { class: "mda-option-title" },
                  "存在多个命中文件，请确认",
                  -1
                  /* CACHED */
                )),
                createBaseVNode(
                  "button",
                  {
                    class: "mda-collapse-btn",
                    type: "button",
                    onClick: _cache[3] || (_cache[3] = ($event) => collapsed.value = !collapsed.value)
                  },
                  toDisplayString(collapsed.value ? "展开" : "收起"),
                  1
                  /* TEXT */
                )
              ]),
              collapsed.value ? (openBlock(), createElementBlock(
                "div",
                _hoisted_27$1,
                " 已选 " + toDisplayString(selectedCandidatePaths.value.length || 0) + " / " + toDisplayString(candidateHits.value.length) + " 个文件 ",
                1
                /* TEXT */
              )) : (openBlock(), createElementBlock("div", _hoisted_28$1, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(candidateHits.value, (hit) => {
                    return openBlock(), createElementBlock(
                      "article",
                      {
                        key: hit.file,
                        class: normalizeClass(["mda-choice-card", { "is-selected": isCandidateSelected(hit) }])
                      },
                      [
                        createBaseVNode("div", _hoisted_29$1, [
                          createBaseVNode("input", {
                            type: "checkbox",
                            checked: isCandidateSelected(hit),
                            onChange: ($event) => unref(commands).toggleCandidateFile(hit)
                          }, null, 40, _hoisted_30$1),
                          createBaseVNode("button", {
                            class: "mda-file-link",
                            type: "button",
                            onClick: withModifiers(($event) => unref(commands).openSourceFile(hit.file, hit.line, hit.column), ["stop"])
                          }, [
                            createTextVNode(
                              toDisplayString(hit.file),
                              1
                              /* TEXT */
                            ),
                            hit.line ? (openBlock(), createElementBlock(
                              "span",
                              _hoisted_32$1,
                              ":" + toDisplayString(hit.line),
                              1
                              /* TEXT */
                            )) : createCommentVNode("v-if", true)
                          ], 8, _hoisted_31$1)
                        ]),
                        createBaseVNode(
                          "div",
                          _hoisted_33$1,
                          toDisplayString(unref(candidateStageLabel)(hit)) + " · " + toDisplayString(hit.score),
                          1
                          /* TEXT */
                        ),
                        createBaseVNode("button", {
                          class: "mda-link-btn",
                          type: "button",
                          onClick: ($event) => unref(commands).toggleCandidateDetail(hit)
                        }, toDisplayString(expandedCandidatePath.value === hit.file ? "收起" : unref(candidateDetailTitle)(hit)), 9, _hoisted_34$1),
                        expandedCandidatePath.value === hit.file ? (openBlock(), createElementBlock(
                          "pre",
                          _hoisted_35$1,
                          toDisplayString(unref(candidateLogText)(hit)),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true)
                      ],
                      2
                      /* CLASS */
                    );
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ]))
            ])) : createCommentVNode("v-if", true),
            needsMoreEvidence.value ? (openBlock(), createElementBlock("div", _hoisted_36$1, [..._cache[16] || (_cache[16] = [
              createBaseVNode(
                "div",
                { class: "mda-option-title" },
                "线索不足，需要补充页面证据",
                -1
                /* CACHED */
              ),
              createBaseVNode(
                "div",
                { class: "mda-option-desc" },
                "当前选区缺少稳定源码锚点，系统已基于当前选区自动扩区并继续检索。若仍未定位，说明当前 DOM 链路没有足够稳定证据。",
                -1
                /* CACHED */
              )
            ])])) : createCommentVNode("v-if", true)
          ],
          64
          /* STABLE_FRAGMENT */
        );
      };
    }
  };
  const _hoisted_1$6 = ["value", "readonly", "placeholder"];
  const _hoisted_2$5 = ["onClick"];
  const _hoisted_3$5 = {
    key: 1,
    class: "mda-composer-shortcut-thumb is-empty"
  };
  const _hoisted_4$5 = { class: "mda-composer-shortcut-meta" };
  const _hoisted_5$5 = {
    key: 0,
    class: "mda-composer-shortcut-empty"
  };
  const _sfc_main$7 = {
    __name: "ComposerInput",
    setup(__props, { expose: __expose }) {
      useGoCaptureCommands();
      const composerStore = useComposerStore();
      const modelStore = useModelStore();
      const projectStore = useProjectStore();
      const searchStore = useSearchStore();
      const selectionStore = useSelectionStore();
      const inputRef = /* @__PURE__ */ ref(null);
      const shortcutMenuRef = /* @__PURE__ */ ref(null);
      const shortcutMenuOpen = /* @__PURE__ */ ref(false);
      const shortcutMenuQuery = /* @__PURE__ */ ref("");
      const shortcutRangeStart = /* @__PURE__ */ ref(-1);
      const shortcutRangeEnd = /* @__PURE__ */ ref(-1);
      const shortcutActiveIndex = /* @__PURE__ */ ref(0);
      const selectionStart = /* @__PURE__ */ ref(0);
      const selectionEnd = /* @__PURE__ */ ref(0);
      const composerEditable = computed(() => selectionStore.items.length > 0);
      const composerPlaceholder = computed(() => {
        if (!projectStore.current) return "请选择项目源码";
        if (!selectionStore.items.length) return "移动鼠标高亮页面区域，按空格键添加选区";
        if (modelStore.status === "running") return "模型定位中，可点击停止";
        if (searchStore.showCandidatePicker) return "请选择候选文件后继续";
        return "输入修改要求，可用 @选区 或 @选区1 引用已选区";
      });
      const promptAssets = computed(() => selectionStore.promptAssets);
      const composerInputValue = computed(() => composerEditable.value ? composerStore.content : composerPlaceholder.value);
      const shortcutAssets = computed(() => {
        const query = shortcutMenuQuery.value.trim().toLowerCase();
        const items = Array.isArray(promptAssets.value) ? promptAssets.value : [];
        if (!query) return items;
        return items.filter((asset) => {
          const text = [
            asset.token,
            asset.label,
            asset.summary,
            asset.text,
            asset.className
          ].filter(Boolean).join(" ").toLowerCase();
          return text.includes(query);
        });
      });
      watch(composerInputValue, () => {
        nextTick(() => {
          syncComposerHeight();
        });
      });
      watch([promptAssets, composerEditable], ([assets, editable]) => {
        if (!editable || !(assets && assets.length)) closeShortcutMenu();
      });
      watch(shortcutAssets, (assets) => {
        if (!assets.length) {
          shortcutActiveIndex.value = 0;
          return;
        }
        if (shortcutActiveIndex.value >= assets.length) {
          shortcutActiveIndex.value = assets.length - 1;
        }
      });
      onMounted(() => {
        window.addEventListener("pointerdown", handleGlobalPointerDown, true);
        nextTick(() => {
          syncComposerHeight();
        });
      });
      onBeforeUnmount(() => {
        window.removeEventListener("pointerdown", handleGlobalPointerDown, true);
      });
      __expose({
        focusEvidenceInput(cursor = null) {
          focusComposer(cursor);
        },
        insertAsset(asset) {
          insertAssetToken(asset, { replaceMention: false });
        }
      });
      function handleGlobalPointerDown(event) {
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        const insideShortcutMenu = shortcutMenuRef.value && path.includes(shortcutMenuRef.value);
        const insideComposerInput = inputRef.value && path.includes(inputRef.value);
        if (!insideShortcutMenu && !insideComposerInput) {
          closeShortcutMenu();
        }
      }
      function assetThumbStyle(asset) {
        return (asset == null ? void 0 : asset.thumbnailUrl) ? { backgroundImage: `url("${asset.thumbnailUrl}")` } : {};
      }
      function syncComposerHeight(target = inputRef.value) {
        if (!target) return;
        target.style.height = "auto";
        target.style.height = `${Math.min(Math.max(target.scrollHeight, 72), 184)}px`;
      }
      function focusComposer(cursor = null) {
        nextTick(() => {
          if (!inputRef.value || typeof inputRef.value.focus !== "function") return;
          inputRef.value.focus();
          if (cursor != null && typeof inputRef.value.setSelectionRange === "function") {
            inputRef.value.setSelectionRange(cursor, cursor);
            selectionStart.value = cursor;
            selectionEnd.value = cursor;
          }
          syncComposerHeight(inputRef.value);
        });
      }
      function closeShortcutMenu() {
        shortcutMenuOpen.value = false;
        shortcutMenuQuery.value = "";
        shortcutRangeStart.value = -1;
        shortcutRangeEnd.value = -1;
        shortcutActiveIndex.value = 0;
      }
      function resolveShortcutState(value, caret) {
        if (!promptAssets.value.length) return null;
        const before = String(value || "").slice(0, Math.max(0, caret));
        const match = before.match(/(^|[\s(（,，;；])@([^\s@]*)$/);
        if (!match) return null;
        return {
          start: before.length - match[2].length - 1,
          end: before.length,
          query: match[2] || ""
        };
      }
      function updateComposerSelection(target) {
        if (!target) return;
        selectionStart.value = Number(target.selectionStart || 0);
        selectionEnd.value = Number(target.selectionEnd || selectionStart.value);
      }
      function updateShortcutMenu(target) {
        if (!target || !composerEditable.value) {
          closeShortcutMenu();
          return;
        }
        const state = resolveShortcutState(target.value, target.selectionStart || 0);
        if (!state) {
          closeShortcutMenu();
          return;
        }
        shortcutMenuOpen.value = true;
        shortcutMenuQuery.value = state.query;
        shortcutRangeStart.value = state.start;
        shortcutRangeEnd.value = state.end;
        if (shortcutActiveIndex.value >= shortcutAssets.value.length) {
          shortcutActiveIndex.value = 0;
        }
      }
      function handleComposerInput(event) {
        var _a2;
        composerStore.setContent(((_a2 = event == null ? void 0 : event.target) == null ? void 0 : _a2.value) || "");
        updateComposerSelection(event.target);
        updateShortcutMenu(event.target);
        syncComposerHeight(event.target);
      }
      function handleComposerCursor(event) {
        updateComposerSelection(event.target);
        updateShortcutMenu(event.target);
      }
      function moveShortcutActive(step) {
        if (!shortcutMenuOpen.value || !shortcutAssets.value.length) return;
        const total = shortcutAssets.value.length;
        shortcutActiveIndex.value = (shortcutActiveIndex.value + step + total) % total;
      }
      function handleComposerKeydown(event) {
        if (!shortcutMenuOpen.value) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveShortcutActive(1);
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveShortcutActive(-1);
          return;
        }
        if (event.key === "Tab") {
          if (!shortcutAssets.value.length) return;
          event.preventDefault();
          selectShortcutAsset(shortcutAssets.value[shortcutActiveIndex.value]);
          return;
        }
        if (event.key === "Enter") {
          if (!shortcutAssets.value.length) return;
          event.preventDefault();
          selectShortcutAsset(shortcutAssets.value[shortcutActiveIndex.value]);
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeShortcutMenu();
        }
      }
      function insertAssetToken(asset, options = {}) {
        if (!asset) return;
        const currentValue = String(composerInputValue.value || "");
        const replaceMention = !!options.replaceMention;
        const replaceStart = replaceMention && shortcutRangeStart.value >= 0 ? shortcutRangeStart.value : Math.min(selectionStart.value, currentValue.length);
        const replaceEnd = replaceMention && shortcutRangeEnd.value >= replaceStart ? shortcutRangeEnd.value : Math.min(selectionEnd.value, currentValue.length);
        const before = currentValue.slice(0, replaceStart);
        const after = currentValue.slice(replaceEnd);
        const prefix = replaceMention || !before || /\s$/.test(before) ? "" : " ";
        const suffix = after && /^\s/.test(after) ? "" : " ";
        const nextValue = `${before}${prefix}${asset.token}${suffix}${after}`;
        const cursor = (before + prefix + asset.token + suffix).length;
        composerStore.setContent(nextValue);
        closeShortcutMenu();
        focusComposer(cursor);
      }
      function selectShortcutAsset(asset) {
        insertAssetToken(asset, { replaceMention: true });
      }
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock(
          Fragment,
          null,
          [
            createBaseVNode("textarea", {
              ref_key: "inputRef",
              ref: inputRef,
              value: composerInputValue.value,
              class: "mda-composer-input",
              readonly: !composerEditable.value,
              placeholder: composerPlaceholder.value,
              rows: "1",
              onInput: handleComposerInput,
              onClick: handleComposerCursor,
              onKeyup: handleComposerCursor,
              onSelect: handleComposerCursor,
              onFocus: handleComposerCursor,
              onKeydown: handleComposerKeydown
            }, null, 40, _hoisted_1$6),
            shortcutMenuOpen.value ? (openBlock(), createElementBlock(
              "div",
              {
                key: 0,
                ref_key: "shortcutMenuRef",
                ref: shortcutMenuRef,
                class: "mda-composer-shortcut"
              },
              [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(shortcutAssets.value, (asset, index) => {
                    return openBlock(), createElementBlock("button", {
                      key: asset.uid,
                      class: normalizeClass(["mda-composer-shortcut-item", { "is-active": index === shortcutActiveIndex.value }]),
                      type: "button",
                      onMousedown: _cache[0] || (_cache[0] = withModifiers(() => {
                      }, ["prevent"])),
                      onClick: withModifiers(($event) => selectShortcutAsset(asset), ["prevent"])
                    }, [
                      asset.thumbnailUrl ? (openBlock(), createElementBlock(
                        "span",
                        {
                          key: 0,
                          class: "mda-composer-shortcut-thumb",
                          style: normalizeStyle(assetThumbStyle(asset))
                        },
                        null,
                        4
                        /* STYLE */
                      )) : (openBlock(), createElementBlock(
                        "span",
                        _hoisted_3$5,
                        toDisplayString(asset.index),
                        1
                        /* TEXT */
                      )),
                      createBaseVNode("span", _hoisted_4$5, [
                        createBaseVNode(
                          "strong",
                          null,
                          toDisplayString(asset.token),
                          1
                          /* TEXT */
                        ),
                        createBaseVNode(
                          "em",
                          null,
                          toDisplayString(asset.summary),
                          1
                          /* TEXT */
                        )
                      ])
                    ], 42, _hoisted_2$5);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !shortcutAssets.value.length ? (openBlock(), createElementBlock("div", _hoisted_5$5, "@ 无匹配选区")) : createCommentVNode("v-if", true)
              ],
              512
              /* NEED_PATCH */
            )) : createCommentVNode("v-if", true)
          ],
          64
          /* STABLE_FRAGMENT */
        );
      };
    }
  };
  const _hoisted_1$5 = { class: "mda-composer-prebar" };
  const _hoisted_2$4 = { class: "mda-composer-prebar-main" };
  const _hoisted_3$4 = ["disabled"];
  const _hoisted_4$4 = {
    key: 0,
    class: "mda-asset-strip"
  };
  const _hoisted_5$4 = ["title", "onClick", "onKeydown"];
  const _hoisted_6$4 = {
    key: 1,
    class: "mda-asset-thumb is-empty"
  };
  const _hoisted_7$4 = ["onClick"];
  const _sfc_main$6 = {
    __name: "ComposerPrebar",
    emits: ["insert-asset"],
    setup(__props) {
      const commands = useGoCaptureCommands();
      const composerStore = useComposerStore();
      const searchStore = useSearchStore();
      const selectionStore = useSelectionStore();
      const promptAssets = computed(() => selectionStore.promptAssets);
      const includeApiEvidence = computed(() => searchStore.includeApiEvidence);
      const candidateLoading = computed(() => searchStore.status === "loading");
      const promptText = computed(() => composerStore.finalPrompt);
      function toggleApiEvidence() {
        commands.setIncludeApiEvidence(!includeApiEvidence.value);
        commands.onSearchOptionChange();
      }
      function assetTooltip(asset) {
        if (!asset) return "";
        return [
          `${asset.token} · 点击插入`,
          "可在设置页查看资产详情",
          asset.text ? `文案: ${asset.text}` : "",
          asset.className ? `class: ${asset.className}` : ""
        ].filter(Boolean).join("\n");
      }
      function assetThumbStyle(asset) {
        return (asset == null ? void 0 : asset.thumbnailUrl) ? { backgroundImage: `url("${asset.thumbnailUrl}")` } : {};
      }
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock("div", _hoisted_1$5, [
          createBaseVNode("div", _hoisted_2$4, [
            createBaseVNode("button", {
              class: normalizeClass(["mda-assist-chip", { "is-active": includeApiEvidence.value }]),
              type: "button",
              disabled: candidateLoading.value || !!promptText.value,
              onClick: toggleApiEvidence
            }, [..._cache[0] || (_cache[0] = [
              createBaseVNode(
                "span",
                { class: "mda-chip-shield" },
                null,
                -1
                /* CACHED */
              ),
              createBaseVNode(
                "span",
                null,
                "接口线索",
                -1
                /* CACHED */
              )
            ])], 10, _hoisted_3$4),
            promptAssets.value.length ? (openBlock(), createElementBlock("div", _hoisted_4$4, [
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(promptAssets.value, (asset) => {
                  return openBlock(), createElementBlock("article", {
                    key: asset.token,
                    class: "mda-asset-card"
                  }, [
                    createBaseVNode("div", {
                      class: "mda-asset-chip",
                      role: "button",
                      tabindex: "0",
                      title: assetTooltip(asset),
                      onClick: ($event) => _ctx.$emit("insert-asset", asset),
                      onKeydown: [
                        withKeys(withModifiers(($event) => _ctx.$emit("insert-asset", asset), ["prevent"]), ["enter"]),
                        withKeys(withModifiers(($event) => _ctx.$emit("insert-asset", asset), ["prevent"]), ["space"])
                      ]
                    }, [
                      asset.thumbnailUrl ? (openBlock(), createElementBlock(
                        "span",
                        {
                          key: 0,
                          class: "mda-asset-thumb",
                          style: normalizeStyle(assetThumbStyle(asset))
                        },
                        null,
                        4
                        /* STYLE */
                      )) : (openBlock(), createElementBlock(
                        "span",
                        _hoisted_6$4,
                        toDisplayString(asset.index),
                        1
                        /* TEXT */
                      )),
                      createBaseVNode("button", {
                        class: "mda-asset-remove",
                        type: "button",
                        title: "移除这个选区",
                        onClick: withModifiers(($event) => unref(commands).removeSelection(asset.uid), ["stop"])
                      }, "×", 8, _hoisted_7$4)
                    ], 40, _hoisted_5$4)
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : createCommentVNode("v-if", true)
          ])
        ]);
      };
    }
  };
  const _hoisted_1$4 = { class: "mda-composer-wrap" };
  const _hoisted_2$3 = { class: "mda-result-module" };
  const _hoisted_3$3 = {
    key: 0,
    class: "mda-result-module-head"
  };
  const _hoisted_4$3 = { class: "mda-result-module-body" };
  const _hoisted_5$3 = { class: "mda-composer" };
  const _hoisted_6$3 = { class: "mda-composer-toolbar" };
  const _hoisted_7$3 = { class: "mda-toolbar-left" };
  const _hoisted_8$3 = ["title"];
  const _hoisted_9$3 = { class: "mda-toolbar-right" };
  const _hoisted_10$3 = ["title", "disabled"];
  const _hoisted_11$3 = {
    key: 0,
    class: "mda-stop-icon"
  };
  const _hoisted_12$3 = { key: 1 };
  const _hoisted_13$3 = {
    key: 2,
    class: "mda-send-arrow"
  };
  const _hoisted_14$3 = { class: "mda-route-inline" };
  const _hoisted_15$3 = {
    key: 1,
    class: "mda-route-empty"
  };
  const _hoisted_16$3 = {
    key: 1,
    class: "mda-toast"
  };
  const _sfc_main$5 = {
    __name: "ComposerPanel",
    setup(__props, { expose: __expose }) {
      const composerInputRef = /* @__PURE__ */ ref(null);
      const buildVersion = "20260728.012423.331";
      const commands = useGoCaptureCommands();
      const appUiStore = useAppUiStore();
      const composerStore = useComposerStore();
      const connectAgentStore = useConnectAgentStore();
      const modelStore = useModelStore();
      const projectStore = useProjectStore();
      const routeStore = useRouteStore();
      const searchStore = useSearchStore();
      const selectionStore = useSelectionStore();
      const candidateLoading = computed(() => searchStore.status === "loading");
      const resultModuleCollapsed = /* @__PURE__ */ ref(false);
      const hasResultModule = computed(() => {
        var _a2;
        return (((_a2 = searchStore.candidates) == null ? void 0 : _a2.length) || 0) > 0 || !!searchStore.composite || !!searchStore.changePlan;
      });
      const selectedItems = computed(() => selectionStore.items);
      const project = computed(() => projectStore.current);
      const modelAssistLoading = computed(() => modelStore.status === "running");
      const routeResolverTrace = computed(() => routeStore.resolverTrace);
      const toastText = computed(() => appUiStore.toastText);
      const composerCanSend = computed(() => {
        var _a2;
        if (modelAssistLoading.value || connectAgentStore.taskRunning) return true;
        if (candidateLoading.value) return false;
        if (!project.value) return false;
        if (!((_a2 = connectAgentStore.activeProvider) == null ? void 0 : _a2.connected)) return false;
        if (connectAgentStore.activeProvider.requiresThreadBinding && !connectAgentStore.activeProvider.projectThreadId) return false;
        if (!selectedItems.value.length) return false;
        if (searchStore.showCandidatePicker) return searchStore.selectedCandidates.length > 0;
        return composerStore.trimmedContent.length > 0;
      });
      const routeHit = computed(() => {
        const trace = routeResolverTrace.value;
        if (!trace || !trace.matched || !Array.isArray(trace.hits) || !trace.hits.length) return null;
        return trace.hits[0];
      });
      const routeFilePath = computed(() => {
        var _a2;
        return ((_a2 = routeHit.value) == null ? void 0 : _a2.file) || "";
      });
      __expose({
        focusEvidenceInput() {
          var _a2, _b;
          (_b = (_a2 = composerInputRef.value) == null ? void 0 : _a2.focusEvidenceInput) == null ? void 0 : _b.call(_a2);
        }
      });
      function handleAssetInsert(asset) {
        var _a2, _b;
        (_b = (_a2 = composerInputRef.value) == null ? void 0 : _a2.insertAsset) == null ? void 0 : _b.call(_a2, asset);
      }
      function copyRouteFilePath() {
        if (!routeFilePath.value) return;
        commands.copyText(routeFilePath.value);
      }
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock("section", _hoisted_1$4, [
          createBaseVNode("div", _hoisted_2$3, [
            hasResultModule.value ? (openBlock(), createElementBlock("div", _hoisted_3$3, [
              _cache[4] || (_cache[4] = createBaseVNode(
                "span",
                { class: "mda-result-module-title" },
                "定位与修改计划",
                -1
                /* CACHED */
              )),
              createBaseVNode(
                "button",
                {
                  class: "mda-collapse-btn",
                  type: "button",
                  onClick: _cache[0] || (_cache[0] = ($event) => resultModuleCollapsed.value = !resultModuleCollapsed.value)
                },
                toDisplayString(resultModuleCollapsed.value ? "展开" : "收起"),
                1
                /* TEXT */
              )
            ])) : createCommentVNode("v-if", true),
            withDirectives(createBaseVNode(
              "div",
              _hoisted_4$3,
              [
                createVNode(_sfc_main$8),
                createVNode(_sfc_main$6, { onInsertAsset: handleAssetInsert })
              ],
              512
              /* NEED_PATCH */
            ), [
              [vShow, !(hasResultModule.value && resultModuleCollapsed.value)]
            ])
          ]),
          createBaseVNode("div", _hoisted_5$3, [
            createVNode(
              _sfc_main$7,
              {
                ref_key: "composerInputRef",
                ref: composerInputRef
              },
              null,
              512
              /* NEED_PATCH */
            ),
            createBaseVNode("div", _hoisted_6$3, [
              createBaseVNode("div", _hoisted_7$3, [
                selectedItems.value.length ? (openBlock(), createElementBlock("button", {
                  key: 0,
                  class: "mda-inline-text-btn",
                  type: "button",
                  onClick: _cache[1] || (_cache[1] = (...args) => unref(commands).clearSelections && unref(commands).clearSelections(...args))
                }, "清空选区")) : createCommentVNode("v-if", true),
                createBaseVNode("span", {
                  class: "mda-build-version",
                  title: `构建版本 ${unref(buildVersion)}`
                }, "build " + toDisplayString(unref(buildVersion)), 9, _hoisted_8$3)
              ]),
              createBaseVNode("div", _hoisted_9$3, [
                createBaseVNode("button", {
                  class: normalizeClass(["mda-send-btn", { "is-stopping": modelAssistLoading.value || unref(connectAgentStore).taskRunning }]),
                  type: "button",
                  title: modelAssistLoading.value || unref(connectAgentStore).taskRunning ? "停止当前任务" : "提交",
                  disabled: !composerCanSend.value,
                  onClick: _cache[2] || (_cache[2] = (...args) => unref(commands).sendRequest && unref(commands).sendRequest(...args))
                }, [
                  modelAssistLoading.value || unref(connectAgentStore).taskRunning ? (openBlock(), createElementBlock("span", _hoisted_11$3)) : candidateLoading.value ? (openBlock(), createElementBlock("span", _hoisted_12$3, "检索")) : (openBlock(), createElementBlock("span", _hoisted_13$3))
                ], 10, _hoisted_10$3)
              ])
            ])
          ]),
          createBaseVNode("div", _hoisted_14$3, [
            routeResolverTrace.value ? (openBlock(), createElementBlock(
              Fragment,
              { key: 0 },
              [
                _cache[5] || (_cache[5] = createBaseVNode(
                  "span",
                  { class: "mda-route-label" },
                  "页面源码地址",
                  -1
                  /* CACHED */
                )),
                routeFilePath.value ? (openBlock(), createElementBlock(
                  "button",
                  {
                    key: 0,
                    class: "mda-route-file",
                    type: "button",
                    onClick: _cache[3] || (_cache[3] = ($event) => unref(commands).openSourceFile(routeFilePath.value))
                  },
                  toDisplayString(routeFilePath.value),
                  1
                  /* TEXT */
                )) : (openBlock(), createElementBlock("span", _hoisted_15$3, "暂无命中")),
                routeFilePath.value ? (openBlock(), createElementBlock("button", {
                  key: 2,
                  class: "mda-copy-icon",
                  type: "button",
                  title: "复制页面源码地址",
                  "aria-label": "复制页面源码地址",
                  onClick: copyRouteFilePath
                })) : createCommentVNode("v-if", true)
              ],
              64
              /* STABLE_FRAGMENT */
            )) : createCommentVNode("v-if", true),
            toastText.value ? (openBlock(), createElementBlock(
              "span",
              _hoisted_16$3,
              toDisplayString(toastText.value),
              1
              /* TEXT */
            )) : createCommentVNode("v-if", true)
          ])
        ]);
      };
    }
  };
  function useMcpStatus() {
    const servers = /* @__PURE__ */ ref([]);
    const logs = /* @__PURE__ */ ref([]);
    const config = /* @__PURE__ */ ref({});
    const loading = /* @__PURE__ */ ref(false);
    const error = /* @__PURE__ */ ref("");
    let timer = null;
    function refresh() {
      return __async(this, null, function* () {
        loading.value = true;
        error.value = "";
        try {
          const data = yield sourceServerJson("/api/agent/mcp/status", { timeoutMs: 5e3 });
          servers.value = Array.isArray(data.servers) ? data.servers : [];
          logs.value = Array.isArray(data.logs) ? data.logs : [];
          config.value = data.config && typeof data.config === "object" ? data.config : {};
        } catch (err) {
          error.value = (err == null ? void 0 : err.message) || String(err);
        } finally {
          loading.value = false;
        }
      });
    }
    function reload() {
      return __async(this, null, function* () {
        loading.value = true;
        error.value = "";
        try {
          const data = yield sourceServerJson("/api/agent/mcp/reload", {
            method: "POST",
            body: {},
            timeoutMs: 35e3
          });
          servers.value = Array.isArray(data.servers) ? data.servers : [];
          logs.value = Array.isArray(data.logs) ? data.logs : [];
        } catch (err) {
          error.value = (err == null ? void 0 : err.message) || String(err);
        } finally {
          loading.value = false;
        }
      });
    }
    function stop(name) {
      return __async(this, null, function* () {
        loading.value = true;
        error.value = "";
        try {
          const data = yield sourceServerJson("/api/agent/mcp/stop", {
            method: "POST",
            body: { name },
            timeoutMs: 8e3
          });
          servers.value = Array.isArray(data.servers) ? data.servers : [];
          logs.value = Array.isArray(data.logs) ? data.logs : [];
        } catch (err) {
          error.value = (err == null ? void 0 : err.message) || String(err);
        } finally {
          loading.value = false;
        }
      });
    }
    function startPolling(intervalMs = 2e3) {
      stopPolling();
      void refresh();
      timer = window.setInterval(refresh, intervalMs);
    }
    function stopPolling() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    onScopeDispose(stopPolling);
    return { servers, logs, config, loading, error, refresh, reload, stop, startPolling, stopPolling };
  }
  const _hoisted_1$3 = {
    class: "mda-mcp-panel",
    role: "dialog",
    "aria-label": "MCP 状态"
  };
  const _hoisted_2$2 = { class: "mda-mcp-head" };
  const _hoisted_3$2 = { class: "mda-mcp-head-actions" };
  const _hoisted_4$2 = ["disabled"];
  const _hoisted_5$2 = ["disabled"];
  const _hoisted_6$2 = { class: "mda-mcp-body" };
  const _hoisted_7$2 = {
    key: 0,
    class: "mda-mcp-error"
  };
  const _hoisted_8$2 = { class: "mda-mcp-config" };
  const _hoisted_9$2 = { class: "mda-mcp-section-title" };
  const _hoisted_10$2 = {
    key: 1,
    class: "mda-mcp-empty"
  };
  const _hoisted_11$2 = {
    key: 2,
    class: "mda-mcp-servers"
  };
  const _hoisted_12$2 = { class: "mda-mcp-server-head" };
  const _hoisted_13$2 = { class: "mda-mcp-server-name" };
  const _hoisted_14$2 = { class: "mda-mcp-server-status" };
  const _hoisted_15$2 = ["disabled", "onClick"];
  const _hoisted_16$2 = {
    key: 0,
    class: "mda-mcp-server-error"
  };
  const _hoisted_17$2 = {
    key: 1,
    class: "mda-mcp-tools"
  };
  const _hoisted_18$2 = { class: "mda-mcp-logs" };
  const _hoisted_19$2 = {
    key: 0,
    class: "mda-mcp-empty"
  };
  const _hoisted_20$2 = { class: "mda-mcp-log-time" };
  const _hoisted_21$2 = { class: "mda-mcp-log-line" };
  const _sfc_main$4 = /* @__PURE__ */ defineComponent({
    __name: "McpStatusPanel",
    props: {
      visible: { type: Boolean }
    },
    emits: ["close"],
    setup(__props) {
      const props = __props;
      const { servers, logs, config, loading, error, refresh, reload, stop, startPolling, stopPolling } = useMcpStatus();
      watch(() => props.visible, (open) => {
        if (open) startPolling();
        else stopPolling();
      }, { immediate: true });
      function formatTime(iso) {
        try {
          return new Date(iso).toLocaleTimeString();
        } catch (e) {
          return "";
        }
      }
      return (_ctx, _cache) => {
        return __props.visible ? (openBlock(), createElementBlock("div", {
          key: 0,
          class: "mda-mcp-overlay",
          onClick: _cache[3] || (_cache[3] = withModifiers(($event) => _ctx.$emit("close"), ["self"]))
        }, [
          createBaseVNode("section", _hoisted_1$3, [
            createBaseVNode("header", _hoisted_2$2, [
              _cache[4] || (_cache[4] = createBaseVNode(
                "span",
                { class: "mda-mcp-title" },
                "MCP 服务",
                -1
                /* CACHED */
              )),
              createBaseVNode("div", _hoisted_3$2, [
                createBaseVNode("button", {
                  class: "mda-mcp-btn",
                  type: "button",
                  disabled: unref(loading),
                  onClick: _cache[0] || (_cache[0] = //@ts-ignore
                  (...args) => unref(reload) && unref(reload)(...args))
                }, toDisplayString(unref(loading) ? "处理中…" : "重新加载"), 9, _hoisted_4$2),
                createBaseVNode("button", {
                  class: "mda-mcp-btn",
                  type: "button",
                  disabled: unref(loading),
                  onClick: _cache[1] || (_cache[1] = //@ts-ignore
                  (...args) => unref(refresh) && unref(refresh)(...args))
                }, toDisplayString(unref(loading) ? "刷新中…" : "刷新"), 9, _hoisted_5$2),
                createBaseVNode("button", {
                  class: "mda-mcp-btn",
                  type: "button",
                  onClick: _cache[2] || (_cache[2] = ($event) => _ctx.$emit("close"))
                }, "关闭")
              ])
            ]),
            createBaseVNode("div", _hoisted_6$2, [
              unref(error) ? (openBlock(), createElementBlock(
                "div",
                _hoisted_7$2,
                "读取失败：" + toDisplayString(unref(error)),
                1
                /* TEXT */
              )) : createCommentVNode("v-if", true),
              createBaseVNode("div", _hoisted_8$2, [
                createBaseVNode("div", null, [
                  _cache[5] || (_cache[5] = createBaseVNode(
                    "strong",
                    null,
                    "用户配置",
                    -1
                    /* CACHED */
                  )),
                  createBaseVNode(
                    "code",
                    null,
                    toDisplayString(unref(config).user || "~/.gocapture/mcp.json"),
                    1
                    /* TEXT */
                  )
                ]),
                createBaseVNode("div", null, [
                  _cache[6] || (_cache[6] = createBaseVNode(
                    "strong",
                    null,
                    "项目配置",
                    -1
                    /* CACHED */
                  )),
                  createBaseVNode(
                    "code",
                    null,
                    toDisplayString(unref(config).project || "<projectRoot>/.mcp.json"),
                    1
                    /* TEXT */
                  )
                ])
              ]),
              createBaseVNode(
                "div",
                _hoisted_9$2,
                "已登记的 MCP（" + toDisplayString(unref(servers).length) + "）",
                1
                /* TEXT */
              ),
              !unref(servers).length ? (openBlock(), createElementBlock("div", _hoisted_10$2, [..._cache[7] || (_cache[7] = [
                createTextVNode(
                  " 暂无。请在项目根放 ",
                  -1
                  /* CACHED */
                ),
                createBaseVNode(
                  "code",
                  null,
                  ".mcp.json",
                  -1
                  /* CACHED */
                ),
                createTextVNode(
                  " 或 ",
                  -1
                  /* CACHED */
                ),
                createBaseVNode(
                  "code",
                  null,
                  "~/.gocapture/mcp.json",
                  -1
                  /* CACHED */
                ),
                createTextVNode(
                  " 后重新绑定项目。 ",
                  -1
                  /* CACHED */
                )
              ])])) : (openBlock(), createElementBlock("ul", _hoisted_11$2, [
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(unref(servers), (server) => {
                    return openBlock(), createElementBlock("li", {
                      key: server.name,
                      class: "mda-mcp-server"
                    }, [
                      createBaseVNode("div", _hoisted_12$2, [
                        createBaseVNode(
                          "span",
                          {
                            class: normalizeClass(["mda-mcp-dot", server.status === "ready" ? "is-ready" : "is-failed"])
                          },
                          null,
                          2
                          /* CLASS */
                        ),
                        createBaseVNode(
                          "span",
                          _hoisted_13$2,
                          toDisplayString(server.name),
                          1
                          /* TEXT */
                        ),
                        createBaseVNode(
                          "span",
                          _hoisted_14$2,
                          toDisplayString(server.status === "ready" ? `就绪 · ${server.toolCount} 个工具` : server.status === "failed" ? "失败" : server.status),
                          1
                          /* TEXT */
                        ),
                        server.status === "ready" ? (openBlock(), createElementBlock("button", {
                          key: 0,
                          class: "mda-mcp-mini-btn",
                          type: "button",
                          disabled: unref(loading),
                          onClick: ($event) => unref(stop)(server.name)
                        }, "停止", 8, _hoisted_15$2)) : createCommentVNode("v-if", true)
                      ]),
                      server.error ? (openBlock(), createElementBlock(
                        "div",
                        _hoisted_16$2,
                        toDisplayString(server.error),
                        1
                        /* TEXT */
                      )) : createCommentVNode("v-if", true),
                      server.tools && server.tools.length ? (openBlock(), createElementBlock("ul", _hoisted_17$2, [
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(server.tools, (tool) => {
                            return openBlock(), createElementBlock(
                              "li",
                              {
                                key: tool,
                                class: "mda-mcp-tool"
                              },
                              toDisplayString(tool),
                              1
                              /* TEXT */
                            );
                          }),
                          128
                          /* KEYED_FRAGMENT */
                        ))
                      ])) : createCommentVNode("v-if", true)
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])),
              _cache[8] || (_cache[8] = createBaseVNode(
                "div",
                { class: "mda-mcp-section-title" },
                "日志",
                -1
                /* CACHED */
              )),
              createBaseVNode("div", _hoisted_18$2, [
                !unref(logs).length ? (openBlock(), createElementBlock("div", _hoisted_19$2, "暂无日志")) : createCommentVNode("v-if", true),
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(unref(logs), (log, index) => {
                    return openBlock(), createElementBlock("div", {
                      key: index,
                      class: "mda-mcp-log"
                    }, [
                      createBaseVNode(
                        "span",
                        _hoisted_20$2,
                        toDisplayString(formatTime(log.at)),
                        1
                        /* TEXT */
                      ),
                      createBaseVNode(
                        "span",
                        _hoisted_21$2,
                        toDisplayString(log.line),
                        1
                        /* TEXT */
                      )
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ])
          ])
        ])) : createCommentVNode("v-if", true);
      };
    }
  });
  function flattenKeys(value, prefix = "", result = [], depth = 0, limit = 36) {
    if (!value || typeof value !== "object" || depth > 2 || result.length >= limit) return result;
    const entries = Array.isArray(value) ? value.slice(0, 1).map((item, index) => [String(index), item]) : Object.entries(value).slice(0, 18);
    for (const [key, child] of entries) {
      if (result.length >= limit) break;
      const fullKey = prefix ? `${prefix}.${key}` : key;
      result.push(fullKey);
      if (child && typeof child === "object") flattenKeys(child, fullKey, result, depth + 1, limit);
    }
    return result;
  }
  function flattenPrimitiveValues(value, result = [], depth = 0, limit = 80) {
    if (result.length >= limit || depth > 3 || value == null) return result;
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).replace(/\s+/g, " ").trim();
      if (text.length >= 2 && text.length <= 80 && !/^(true|false|null|undefined)$/i.test(text)) {
        result.push(text);
      }
      return result;
    }
    if (typeof value !== "object") return result;
    const entries = Array.isArray(value) ? value.slice(0, 8).map((item, index) => [String(index), item]) : Object.entries(value).slice(0, 28);
    for (const [, child] of entries) {
      if (result.length >= limit) break;
      flattenPrimitiveValues(child, result, depth + 1, limit);
    }
    return result;
  }
  function normalizeHeaders(value) {
    if (!value) return {};
    if (typeof Headers !== "undefined" && value instanceof Headers) {
      const result = {};
      value.forEach((headerValue, headerKey) => {
        result[String(headerKey).toLowerCase()] = String(headerValue || "");
      });
      return result;
    }
    if (Array.isArray(value)) {
      return value.reduce((result, item) => {
        if (Array.isArray(item) && item.length >= 2) {
          result[String(item[0]).toLowerCase()] = String(item[1] || "");
        }
        return result;
      }, {});
    }
    if (typeof value === "object") {
      return Object.entries(value).reduce((result, [key, headerValue]) => {
        result[String(key).toLowerCase()] = String(headerValue || "");
        return result;
      }, {});
    }
    return {};
  }
  function normalizeRequestInfo(raw, baseUrl) {
    var _a2, _b;
    const data = raw || {};
    let pathname = data.url || "";
    try {
      pathname = new URL(data.url, baseUrl).pathname;
    } catch (error) {
    }
    return {
      url: data.url || "",
      pathname,
      method: data.method || "GET",
      headers: normalizeHeaders(((_a2 = data.request) == null ? void 0 : _a2.headers) || data.headers),
      requestKeys: flattenKeys(((_b = data.request) == null ? void 0 : _b.body) || {}, "", [], 0, 28),
      responseKeys: flattenKeys(data.result || {}, "", [], 0, 36),
      responseValues: flattenPrimitiveValues(data.result || {}, [], 0, 80),
      capturedAt: Date.now()
    };
  }
  const useRequestStore = /* @__PURE__ */ defineStore("gocapture.request", () => {
    const items = /* @__PURE__ */ ref([]);
    const enabled = /* @__PURE__ */ ref(true);
    const recent = computed(() => enabled.value ? items.value.slice(0, 5) : []);
    function apiResponseValues() {
      const values = items.value.slice(0, 8).flatMap((item) => item.responseValues || []).map((value) => String(value || "").replace(/\s+/g, " ").trim()).filter((value) => value.length >= 2 && value.length <= 80);
      return Array.from(new Set(values)).sort((a, b) => b.length - a.length).slice(0, 180);
    }
    function denoiseTextByApi(text, limit = 140) {
      let value = String(text || "").replace(/\s+/g, " ").trim();
      if (!value) return "";
      for (const dynamicValue of apiResponseValues()) {
        if (!dynamicValue || dynamicValue.length < 2) continue;
        value = value.replace(new RegExp(escapeRegExp(dynamicValue), "g"), " ");
      }
      value = value.replace(/\bY\d{4}M\d{2}\b/g, " ").replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ").replace(/\b\d{2}-\d{2}\b/g, " ").replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, " ").replace(/\s+/g, " ").trim();
      return compactText(value, limit);
    }
    function remember(request) {
      if (!(request == null ? void 0 : request.url) && !(request == null ? void 0 : request.pathname)) return;
      const key = `${request.method || "GET"} ${request.url || request.pathname}`;
      items.value = [
        request,
        ...items.value.filter((item) => `${item.method || "GET"} ${item.url || item.pathname}` !== key)
      ].slice(0, 40);
    }
    function clear() {
      items.value = [];
    }
    function setEnabled(value) {
      enabled.value = !!value;
    }
    return {
      items,
      enabled,
      recent,
      denoiseTextByApi,
      remember,
      clear,
      setEnabled
    };
  });
  function usePageRequests() {
    const requestStore = useRequestStore();
    const { items: recentRequests } = storeToRefs(requestStore);
    function getHeaderValue(headers, name) {
      if (!headers || !name) return "";
      const target = String(name).toLowerCase();
      if (typeof headers.get === "function") return headers.get(name) || headers.get(target) || "";
      if (Array.isArray(headers)) {
        const item = headers.find(([key]) => String(key || "").toLowerCase() === target);
        return item ? String(item[1] || "") : "";
      }
      if (typeof headers === "object") {
        const key = Object.keys(headers).find((item) => item.toLowerCase() === target);
        return key ? String(headers[key] || "") : "";
      }
      return "";
    }
    function hasInternalGoCaptureHeader(info) {
      return getHeaderValue(info.headers, GOCAPTURE_INTERNAL_REQUEST_HEADER) === GOCAPTURE_INTERNAL_REQUEST_VALUE;
    }
    function isInternalGoCaptureRequest(info) {
      if (hasInternalGoCaptureHeader(info)) return true;
      try {
        const url = new URL(info.url || "", window.location.href);
        const sourceUrl = new URL(SOURCE_SERVER_URL);
        if (url.origin !== sourceUrl.origin) return false;
        return url.pathname === "/health" || url.pathname.startsWith("/api/source/") || url.pathname.startsWith("/api/route/") || url.pathname.startsWith("/api/model/") || url.pathname.startsWith("/api/search");
      } catch (error) {
        return false;
      }
    }
    function rememberRequest(info) {
      if (!info.url) return;
      if (isInternalGoCaptureRequest(info)) return;
      requestStore.remember(info);
    }
    function apiResponseValues() {
      const values = recentRequests.value.slice(0, 8).flatMap((item) => item.responseValues || []).map((value) => String(value || "").replace(/\s+/g, " ").trim()).filter((value) => value.length >= 2 && value.length <= 80);
      return Array.from(new Set(values)).sort((a, b) => b.length - a.length).slice(0, 180);
    }
    function denoiseTextByApi(text, limit = 140) {
      let value = String(text || "").replace(/\s+/g, " ").trim();
      if (!value) return "";
      for (const dynamicValue of apiResponseValues()) {
        if (!dynamicValue || dynamicValue.length < 2) continue;
        value = value.replace(new RegExp(escapeRegExp(dynamicValue), "g"), " ");
      }
      value = value.replace(/\bY\d{4}M\d{2}\b/g, " ").replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ").replace(/\b\d{2}-\d{2}\b/g, " ").replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, " ").replace(/\s+/g, " ").trim();
      return compactText(value, limit);
    }
    return {
      recentRequests,
      rememberRequest,
      denoiseTextByApi
    };
  }
  function hashRoutePath(hash) {
    const value = String(hash || "").replace(/^#/, "");
    if (!value) return "";
    const route = value.startsWith("!/") ? value.slice(1) : value;
    if (!route.startsWith("/")) return "";
    return route.split("?")[0] || "/";
  }
  function readCurrentHref(api) {
    var _a2, _b, _c, _d;
    if ((_c = (_b = (_a2 = api.sidePanelConfig) == null ? void 0 : _a2.snapshot) == null ? void 0 : _b.page) == null ? void 0 : _c.url) {
      return api.sidePanelConfig.snapshot.page.url;
    }
    if ((_d = api.sidePanelConfig) == null ? void 0 : _d.panelTicket) {
      return "";
    }
    try {
      return window.location.href || "";
    } catch (error) {
      return "";
    }
  }
  function isGoCaptureUiHref(href) {
    try {
      const url = new URL(href);
      return url.pathname === "/ui" || url.pathname === "/ui/";
    } catch (error) {
      return false;
    }
  }
  function pageHostText(href) {
    try {
      return new URL(href).host || href;
    } catch (error) {
      return "-";
    }
  }
  function pageUrlPath(href) {
    try {
      const url = new URL(href);
      return hashRoutePath(url.hash) || url.pathname || "/";
    } catch (error) {
      return "/";
    }
  }
  function installLocationWatcher(currentPageHref) {
    const rawPushState = window.history.pushState;
    const rawReplaceState = window.history.replaceState;
    const syncCurrentUrl = () => {
      const nextHref = readCurrentHref({ sidePanelConfig: window.__GOCAPTURE_SIDE_PANEL__ || {} });
      if (!nextHref || isGoCaptureUiHref(nextHref)) return;
      if (nextHref && nextHref !== currentPageHref.value) currentPageHref.value = nextHref;
    };
    const onChanged = () => window.setTimeout(syncCurrentUrl, 0);
    window.history.pushState = function pushState(...args) {
      const result = rawPushState.apply(this, args);
      onChanged();
      return result;
    };
    window.history.replaceState = function replaceState(...args) {
      const result = rawReplaceState.apply(this, args);
      onChanged();
      return result;
    };
    window.addEventListener("popstate", onChanged, true);
    window.addEventListener("hashchange", onChanged, true);
    return () => {
      window.history.pushState = rawPushState;
      window.history.replaceState = rawReplaceState;
      window.removeEventListener("popstate", onChanged, true);
      window.removeEventListener("hashchange", onChanged, true);
    };
  }
  function useRouteResolver({
    project,
    currentPageHref,
    pageUrlPath: pageUrlPath2,
    sourceServerJson: sourceServerJson2
  }) {
    const routeStore = useRouteStore();
    const { resolverTrace: routeResolverTrace } = storeToRefs(routeStore);
    let routeResolveSeq = 0;
    let routeResolveTimer = 0;
    function sameRouteTracePage(trace) {
      const tracePath = String((trace == null ? void 0 : trace.pagePath) || "").trim();
      return !tracePath || tracePath === pageUrlPath2.value;
    }
    function applyRouteResolverTrace(nextTrace) {
      const currentTrace = routeResolverTrace.value;
      if (!nextTrace) return;
      if (nextTrace.matched) {
        routeStore.applyTrace(nextTrace);
        return;
      }
      if ((currentTrace == null ? void 0 : currentTrace.matched) && sameRouteTracePage(currentTrace)) return;
      routeStore.applyTrace(nextTrace);
    }
    function scheduleRouteResolve() {
      if (routeResolveTimer) window.clearTimeout(routeResolveTimer);
      routeResolveTimer = window.setTimeout(() => {
        routeResolveTimer = 0;
        resolveCurrentPageRoute();
      }, 80);
    }
    function resolveCurrentPageRoute() {
      return __async(this, null, function* () {
        var _a2;
        if (!project.value || project.value.source !== "source-server") {
          routeStore.applyTrace(null);
          return;
        }
        if (!currentPageHref.value || isGoCaptureUiHref(currentPageHref.value)) {
          routeStore.status = "idle";
          routeStore.error = "";
          return;
        }
        const seq = ++routeResolveSeq;
        routeStore.status = "loading";
        routeStore.error = "";
        try {
          const data = yield sourceServerJson2("/api/route/resolve", {
            method: "POST",
            body: {
              url: currentPageHref.value,
              pagePath: pageUrlPath2.value
            },
            timeoutMs: 5e3,
            timeoutMessage: "页面路由解析超过 5 秒"
          });
          if (seq !== routeResolveSeq) return;
          routeStore.applyTrace(data.routeResolver || null);
        } catch (error) {
          if (seq !== routeResolveSeq) return;
          routeStore.applyTrace({
            projectKind: ((_a2 = project.value) == null ? void 0 : _a2.kind) || "unknown",
            pagePath: pageUrlPath2.value,
            adapters: [],
            matched: false,
            hits: [],
            errors: [error.message || String(error)]
          });
          routeStore.fail(error);
        }
      });
    }
    function cleanupRouteResolver() {
      if (routeResolveTimer) {
        window.clearTimeout(routeResolveTimer);
        routeResolveTimer = 0;
      }
    }
    return {
      routeResolverTrace,
      sameRouteTracePage,
      applyRouteResolverTrace,
      scheduleRouteResolve,
      resolveCurrentPageRoute,
      cleanupRouteResolver
    };
  }
  const LATEST_PANEL_BINDING_KEY = "gocapture:sidepanel-binding:latest";
  function readLatestPanelBinding() {
    try {
      const raw = window.localStorage.getItem(LATEST_PANEL_BINDING_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : null;
    } catch (error) {
      return null;
    }
  }
  function rememberLatestPanelBinding(snapshot) {
    if (!(snapshot == null ? void 0 : snapshot.workspaceId) && (snapshot == null ? void 0 : snapshot.browserTabId) == null) return;
    try {
      window.localStorage.setItem(LATEST_PANEL_BINDING_KEY, JSON.stringify({
        workspaceId: snapshot.workspaceId || "",
        browserTabId: snapshot.browserTabId,
        windowId: snapshot.windowId,
        page: snapshot.page || null,
        savedAt: Date.now()
      }));
    } catch (error) {
    }
  }
  function useSidePanelBridge({
    sidePanelConfig,
    currentPageHref,
    onNetworkRequest,
    onRuntimeEvent,
    onCommandResult,
    scheduleRouteResolve,
    startPickerOnConnect = true
  }) {
    const appUiStore = useAppUiStore();
    let socket = null;
    let pageSessionId = "";
    let relayPageKeyboard = false;
    let keyboardRelayInstalled = false;
    function selectionList(source) {
      return Array.isArray(source == null ? void 0 : source.selections) ? source.selections : (source == null ? void 0 : source.selection) ? [source.selection] : [];
    }
    function applyRemoteSnapshot(snapshot) {
      var _a2;
      if (!snapshot) return;
      if ((_a2 = snapshot.page) == null ? void 0 : _a2.url) {
        currentPageHref.value = snapshot.page.url;
        onRuntimeEvent == null ? void 0 : onRuntimeEvent({ type: "runtime.connected", payload: { page: snapshot.page } });
      }
      if (snapshot.pageContext) {
        onRuntimeEvent == null ? void 0 : onRuntimeEvent({ type: "page.context", payload: snapshot.pageContext });
      }
      const selections = selectionList(snapshot);
      if (selections.length) {
        onRuntimeEvent == null ? void 0 : onRuntimeEvent({ type: "selection.changed", payload: { selections } });
      }
    }
    function applyRemoteSessionEvent(message) {
      var _a2;
      const event = (message == null ? void 0 : message.event) || {};
      const payload = event.payload || {};
      if (event.type === "picker.pointer_active") {
        relayPageKeyboard = payload.active !== false;
        return;
      }
      if (event.type) onRuntimeEvent == null ? void 0 : onRuntimeEvent({ type: event.type, payload });
      if (event.type === "selection.changed") {
        appUiStore.setToast(`已添加选区 ${selectionList(payload).length}`);
        return;
      }
      if (event.type === "page.route_changed") {
        currentPageHref.value = payload.url || currentPageHref.value;
        scheduleRouteResolve();
        return;
      }
      if (event.type === "runtime.connected" && ((_a2 = payload.page) == null ? void 0 : _a2.url)) {
        currentPageHref.value = payload.page.url;
        return;
      }
      if (event.type === "network.request") {
        onNetworkRequest == null ? void 0 : onNetworkRequest(payload);
      }
    }
    function connectSidePanelBridge() {
      const config = sidePanelConfig.value || {};
      if (!config.panelTicket || !config.bridgeUrl) return;
      installKeyboardRelay();
      try {
        const nextSocket = new WebSocket(config.bridgeUrl);
        socket = nextSocket;
        nextSocket.addEventListener("open", () => {
          nextSocket.send(JSON.stringify({
            type: "sideiframe.connect",
            panelTicket: config.panelTicket
          }));
        });
        nextSocket.addEventListener("message", (event) => {
          let message = null;
          try {
            message = JSON.parse(event.data);
          } catch (error) {
            return;
          }
          if (message.type === "sideiframe.bound_session") {
            pageSessionId = message.pageSessionId || "";
            rememberLatestPanelBinding(message.snapshot);
            applyRemoteSnapshot(message.snapshot);
            sendSidePanelCommand("context.get");
            if (startPickerOnConnect) sendSidePanelCommand("picker.start");
          } else if (message.type === "session.event") {
            applyRemoteSessionEvent(message);
          } else if (message.type === "session.command_result") {
            onCommandResult == null ? void 0 : onCommandResult(message);
          } else if (message.type === "error") {
            appUiStore.setToast(message.error || "Side Panel Bridge 连接失败");
          }
        });
        nextSocket.addEventListener("close", () => {
          if (socket === nextSocket) socket = null;
        });
      } catch (error) {
        appUiStore.setToast(error.message || "连接 Side Panel Bridge 失败");
      }
    }
    function disconnectSidePanelBridge() {
      socket == null ? void 0 : socket.close();
      socket = null;
      pageSessionId = "";
      relayPageKeyboard = false;
      uninstallKeyboardRelay();
    }
    function isPickerShortcut(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return false;
      return event.code === "KeyW" || event.code === "KeyS" || event.code === "Space" || event.key === " " || event.key === "Spacebar";
    }
    function handleKeyboardRelay(event) {
      if (!relayPageKeyboard || event.repeat || !isPickerShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      sendSidePanelCommand("picker.key", {
        code: event.code,
        key: event.key
      });
    }
    function disableKeyboardRelay() {
      relayPageKeyboard = false;
    }
    function installKeyboardRelay() {
      if (keyboardRelayInstalled) return;
      keyboardRelayInstalled = true;
      window.addEventListener("keydown", handleKeyboardRelay, true);
      window.addEventListener("pointermove", disableKeyboardRelay, true);
    }
    function uninstallKeyboardRelay() {
      if (!keyboardRelayInstalled) return;
      keyboardRelayInstalled = false;
      window.removeEventListener("keydown", handleKeyboardRelay, true);
      window.removeEventListener("pointermove", disableKeyboardRelay, true);
    }
    function sendSidePanelCommand(type, payload, options = {}) {
      const targetPageSessionId = options.pageBindingId ? "" : pageSessionId;
      if (!socket || socket.readyState !== WebSocket.OPEN || !targetPageSessionId && !options.pageBindingId) {
        appUiStore.setToast("页面 Runtime 未连接");
        return;
      }
      socket.send(JSON.stringify({
        type: "session.command",
        requestId: `cmd-${Date.now()}`,
        pageSessionId: targetPageSessionId,
        pageBindingId: options.pageBindingId || "",
        command: {
          type,
          payload: payload || {}
        }
      }));
    }
    function startRemotePicker() {
      sendSidePanelCommand("picker.start");
    }
    return {
      connectSidePanelBridge,
      disconnectSidePanelBridge,
      sendSidePanelCommand,
      startRemotePicker
    };
  }
  const MAX_PROJECT_FILES = 800;
  const MAX_SNIPPET_BYTES = 18e4;
  const PROJECT_SNIPPET_FILES = [
    "package.json",
    "vite.config.js",
    "vite.config.ts",
    "vue.config.js",
    "webpack.config.js",
    "src/main.js",
    "src/main.ts",
    "src/App.vue",
    "index.html"
  ];
  const SKIP_DIRS = /* @__PURE__ */ new Set([
    ".git",
    ".idea",
    ".vscode",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    ".nuxt",
    ".output",
    ".cache"
  ]);
  function normalizePath(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  }
  function shouldSkipPath(path) {
    const parts = normalizePath(path).split("/");
    return parts.some((part) => SKIP_DIRS.has(part));
  }
  function inferStack(files, snippets) {
    const paths = files.map((file) => file.path);
    const packageText = snippets["package.json"] || "";
    const hits = [];
    const hasPath = (matcher) => paths.some(matcher);
    const hasPackage = (text) => packageText.includes(text);
    if (hasPackage('"vue"') || hasPath((path) => path.endsWith(".vue"))) hits.push("Vue");
    if (hasPackage('"react"') || hasPath((path) => path.endsWith(".jsx") || path.endsWith(".tsx"))) hits.push("React");
    if (hasPackage('"vite"') || hasPath((path) => path.startsWith("vite.config."))) hits.push("Vite");
    if (hasPackage('"webpack"') || hasPath((path) => path.includes("webpack.config"))) hits.push("Webpack");
    if (hasPackage('"typescript"') || hasPath((path) => path.endsWith(".ts") || path.endsWith(".tsx"))) hits.push("TypeScript");
    if (hasPackage('"tailwindcss"') || hasPath((path) => path.includes("tailwind.config"))) hits.push("Tailwind");
    return Array.from(new Set(hits));
  }
  function readSnippetFromFile(file) {
    return __async(this, null, function* () {
      if (!file || !PROJECT_SNIPPET_FILES.includes(file.path)) return null;
      if (file.size > MAX_SNIPPET_BYTES) return null;
      try {
        const text = yield file.raw.text();
        return [file.path, text.slice(0, 3e3)];
      } catch (error) {
        return null;
      }
    });
  }
  function buildProjectFromFileList(fileList) {
    return __async(this, null, function* () {
      var _a2, _b;
      const rawFiles = Array.from(fileList || []);
      const firstPath = normalizePath(((_a2 = rawFiles[0]) == null ? void 0 : _a2.webkitRelativePath) || ((_b = rawFiles[0]) == null ? void 0 : _b.name) || "");
      const rootName = firstPath.includes("/") ? firstPath.split("/")[0] : "本地项目";
      const files = [];
      for (const file of rawFiles) {
        const fullPath = normalizePath(file.webkitRelativePath || file.name);
        const path = fullPath.startsWith(`${rootName}/`) ? fullPath.slice(rootName.length + 1) : fullPath;
        if (!path || shouldSkipPath(path)) continue;
        files.push({
          path,
          name: file.name,
          size: file.size,
          raw: file
        });
        if (files.length >= MAX_PROJECT_FILES) break;
      }
      const snippets = {};
      const pairs = yield Promise.all(files.map(readSnippetFromFile));
      pairs.filter(Boolean).forEach((pair) => {
        if (!pair) return;
        const [path, text] = pair;
        snippets[path] = text;
      });
      const stack2 = inferStack(files, snippets);
      return {
        name: rootName,
        source: "file-input",
        fileCount: files.length,
        files: files.map((_c) => {
          var _d = _c, { raw } = _d, file = __objRest(_d, ["raw"]);
          return file;
        }),
        snippets,
        stack: stack2,
        stackText: stack2.join(" / "),
        limited: rawFiles.length > files.length
      };
    });
  }
  function scanDirectoryHandle(handle) {
    return __async(this, null, function* () {
      const files = [];
      const snippets = {};
      function walk(dirHandle, prefix) {
        return __async(this, null, function* () {
          if (files.length >= MAX_PROJECT_FILES) return;
          try {
            for (var iter = __forAwait(dirHandle.entries()), more, temp, error; more = !(temp = yield iter.next()).done; more = false) {
              const [name, child] = temp.value;
              if (files.length >= MAX_PROJECT_FILES) break;
              const path = normalizePath(prefix ? `${prefix}/${name}` : name);
              if (shouldSkipPath(path)) continue;
              if (child.kind === "directory") {
                yield walk(child, path);
                continue;
              }
              if (child.kind !== "file") continue;
              try {
                const file = yield child.getFile();
                const item = {
                  path,
                  name,
                  size: file.size,
                  lastModified: file.lastModified
                };
                files.push(item);
                if (PROJECT_SNIPPET_FILES.includes(path) && file.size <= MAX_SNIPPET_BYTES) {
                  snippets[path] = (yield file.text()).slice(0, 3e3);
                }
              } catch (error2) {
              }
            }
          } catch (temp) {
            error = [temp];
          } finally {
            try {
              more && (temp = iter.return) && (yield temp.call(iter));
            } finally {
              if (error)
                throw error[0];
            }
          }
        });
      }
      yield walk(handle, "");
      const stack2 = inferStack(files, snippets);
      return {
        name: handle.name || "本地项目",
        source: "directory-picker",
        fileCount: files.length,
        files,
        snippets,
        stack: stack2,
        stackText: stack2.join(" / "),
        limited: files.length >= MAX_PROJECT_FILES
      };
    });
  }
  function useSourceProject({ currentPageHref }) {
    const projectStore = useProjectStore();
    const appUiStore = useAppUiStore();
    const composerStore = useComposerStore();
    const modelStore = useModelStore();
    const searchStore = useSearchStore();
    const selectionStore = useSelectionStore();
    const {
      current: project,
      serviceStatus: sourceServiceStatus,
      serviceError: sourceServiceError,
      serviceMessage: sourceServiceMessage
    } = storeToRefs(projectStore);
    const fileInputRef = /* @__PURE__ */ ref(null);
    function boundPageUrl() {
      const pageUrl = String((currentPageHref == null ? void 0 : currentPageHref.value) || "").trim();
      if (!pageUrl || pageUrl.includes("/settings")) return "";
      return pageUrl;
    }
    function rememberProjectPath(projectValue) {
      return __async(this, null, function* () {
        if (!projectValue || projectValue.source !== "source-server" || !projectValue.path) return;
        const pageUrl = boundPageUrl();
        if (!pageUrl) return;
        try {
          yield sourceServerJson("/api/registry/bind", {
            method: "POST",
            body: {
              url: pageUrl,
              projectRoot: projectValue.path
            },
            timeoutMs: 5e3,
            timeoutMessage: "保存页面项目绑定超时"
          });
        } catch (error) {
        }
      });
    }
    function savedProjectPath() {
      return __async(this, null, function* () {
        var _a2;
        const pageUrl = boundPageUrl();
        if (!pageUrl) return "";
        try {
          const data = yield sourceServerJson(`/api/registry/resolve?url=${encodeURIComponent(pageUrl)}`, {
            timeoutMs: 3e3,
            timeoutMessage: "读取页面项目绑定超时"
          });
          const projectRoot = (_a2 = data == null ? void 0 : data.binding) == null ? void 0 : _a2.projectRoot;
          return typeof projectRoot === "string" ? projectRoot : "";
        } catch (error) {
          return "";
        }
      });
    }
    function projectInterpreterAdapter() {
      if (!modelStore.selectedModelId) return null;
      return modelStore.configs.find((item) => item.id === modelStore.selectedModelId) || null;
    }
    function runProjectInterpreter(path, fallbackProject) {
      return __async(this, null, function* () {
        var _a2;
        const adapter = projectInterpreterAdapter();
        if ((_a2 = fallbackProject == null ? void 0 : fallbackProject.context) == null ? void 0 : _a2.interpreted) return fallbackProject;
        if (!adapter) return fallbackProject;
        sourceServiceMessage.value = "正在大致了解项目：读取配置、目录结构并生成 Project.md...";
        const result = yield sourceServerNdjson("/api/source/interpret/stream", {
          method: "POST",
          body: { path, adapter },
          timeoutMs: Math.max(Number(adapter.timeoutMs || 12e4) * 3 + 3e4, 24e4),
          timeoutMessage: "Project Interpreter 执行超时，请检查模型配置或稍后重试",
          onEvent(event) {
            if (event.type === "log" && event.log) sourceServiceMessage.value = event.log;
          }
        });
        return (result == null ? void 0 : result.project) || fallbackProject;
      });
    }
    function resetAfterProjectChange(options = {}) {
      const preserveUi = !!options.preserveUi;
      if (!preserveUi) {
        selectionStore.confirmed = false;
        selectionStore.filesConfirmed = false;
        selectionStore.customEvidence = "";
        selectionStore.evidenceMessages = [];
        composerStore.setFinalPrompt("");
        composerStore.clearContent();
      }
      searchStore.reset();
      modelStore.reset();
    }
    function restoreSavedProject() {
      return __async(this, null, function* () {
        const path = yield savedProjectPath();
        if (!path || project.value || sourceServiceStatus.value === "loading") return false;
        sourceServiceStatus.value = "loading";
        sourceServiceError.value = "";
        sourceServiceMessage.value = "正在恢复已保存的本地源码路径...";
        try {
          yield sourceServerJson("/health", {
            timeoutMs: 3e3,
            timeoutMessage: "本地源码服务未响应，请确认已运行 npm run source:server"
          });
          sourceServiceMessage.value = "正在恢复源码路径并扫描项目...";
          const data = yield sourceServerJson("/api/source/scan", {
            method: "POST",
            body: { path },
            timeoutMs: 2e4,
            timeoutMessage: "恢复源码路径超时，请重新选择项目源码"
          });
          projectStore.setProject(normalizeSourceServerProject(data.project || {}));
          const interpretedProject = yield runProjectInterpreter(path, data.project || {});
          projectStore.setProject(normalizeSourceServerProject(interpretedProject || {}));
          projectStore.setServiceStatus("connected");
          resetAfterProjectChange({ preserveUi: true });
          appUiStore.setToast(`已恢复 ${project.value.name}`);
          return true;
        } catch (error) {
          projectStore.setServiceStatus("idle", "", `恢复已保存源码路径失败：${error.message || error}`);
          return false;
        }
      });
    }
    function chooseProjectFromSourceServer() {
      return __async(this, null, function* () {
        sourceServiceStatus.value = "loading";
        sourceServiceError.value = "";
        sourceServiceMessage.value = "正在检查本地源码服务...";
        yield sourceServerJson("/health", {
          timeoutMs: 3e3,
          timeoutMessage: "本地源码服务未响应，请确认已运行 npm run source:server"
        });
        sourceServiceMessage.value = "等待系统目录选择器，请在弹窗中选择源码目录...";
        const data = yield sourceServerJson("/api/source/select", {
          method: "POST",
          body: {},
          timeoutMs: 9e4,
          timeoutMessage: "等待目录选择器超时，请确认系统弹窗是否被遮挡"
        });
        const selectedProject = data.project || {};
        projectStore.setProject(normalizeSourceServerProject(selectedProject));
        yield rememberProjectPath(project.value);
        resetAfterProjectChange();
        const interpretedProject = yield runProjectInterpreter(selectedProject.path, selectedProject);
        projectStore.setProject(normalizeSourceServerProject(interpretedProject || {}));
        yield rememberProjectPath(project.value);
        projectStore.setServiceStatus("connected");
        appUiStore.setToast(`已关联 ${project.value.name}`);
      });
    }
    function chooseProject() {
      return __async(this, null, function* () {
        appUiStore.setToast("正在选择项目...");
        try {
          yield chooseProjectFromSourceServer();
          return;
        } catch (error) {
          projectStore.setServiceStatus("fallback", "", `${error.message || error}。请先运行 npm run source:server；当前将使用浏览器目录选择兜底，无法拿到真实路径。`);
        }
        if (window.showDirectoryPicker && window.isSecureContext) {
          try {
            const handle = yield window.showDirectoryPicker({ mode: "read" });
            projectStore.setProject(yield scanDirectoryHandle(handle));
            resetAfterProjectChange();
            projectStore.setServiceStatus(sourceServiceStatus.value, sourceServiceMessage.value, "");
            appUiStore.setToast(`已关联 ${project.value.name}`);
            return;
          } catch (error) {
            if (error && error.name === "AbortError") {
              appUiStore.setToast("已取消选择");
              return;
            }
            appUiStore.setToast("目录选择器不可用，改用文件夹输入");
          }
        }
        if (fileInputRef.value) {
          fileInputRef.value.value = "";
          fileInputRef.value.click();
        }
      });
    }
    function onFileInputChange(event) {
      return __async(this, null, function* () {
        const files = event.target.files;
        if (!files || !files.length) return;
        projectStore.setProject(yield buildProjectFromFileList(files));
        resetAfterProjectChange();
        projectStore.setServiceStatus(sourceServiceStatus.value, sourceServiceMessage.value, "");
        appUiStore.setToast(`已关联 ${project.value.name}`);
      });
    }
    return {
      fileInputRef,
      project,
      sourceServiceStatus,
      sourceServiceError,
      sourceServiceMessage,
      chooseProject,
      onFileInputChange,
      restoreSavedProject
    };
  }
  const CURRENT_KEY = "gocapture:sidepanel-ui:current";
  const PAGE_KEY_PREFIX = "gocapture:sidepanel-ui:page:";
  function storageKey(href) {
    const value = String(href || "").trim();
    return value ? `${PAGE_KEY_PREFIX}${value}` : CURRENT_KEY;
  }
  function readState(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : null;
    } catch (error) {
      return null;
    }
  }
  function writeState(key, state) {
    try {
      const payload = JSON.stringify(__spreadProps(__spreadValues({}, state), {
        savedAt: Date.now()
      }));
      window.localStorage.setItem(key, payload);
      window.localStorage.setItem(CURRENT_KEY, payload);
    } catch (error) {
    }
  }
  function restoreState(state) {
    if (!state) return;
    const composerStore = useComposerStore();
    if (!composerStore.content && state.content) {
      composerStore.setContent(state.content);
    }
    if (!composerStore.finalPrompt && state.finalPrompt) {
      composerStore.setFinalPrompt(state.finalPrompt);
    }
  }
  function currentState() {
    const composerStore = useComposerStore();
    return {
      content: composerStore.content,
      finalPrompt: composerStore.finalPrompt
    };
  }
  function useSidePanelUiPersistence(currentPageHref) {
    let restoredKey = "";
    function restoreForCurrentPage() {
      const key = storageKey(currentPageHref.value);
      if (restoredKey === key) return;
      restoredKey = key;
      restoreState(readState(key) || readState(CURRENT_KEY));
    }
    restoreForCurrentPage();
    watch(currentPageHref, restoreForCurrentPage);
    watch(currentState, (state) => {
      writeState(storageKey(currentPageHref.value), state);
    }, { deep: true });
  }
  function useSearchFacade() {
    const composerStore = useComposerStore();
    const modelStore = useModelStore();
    const requestStore = useRequestStore();
    const routeStore = useRouteStore();
    const searchStore = useSearchStore();
    const selectionStore = useSelectionStore();
    const {
      candidates: candidateHits,
      composite: compositeResult,
      changePlan: changePlanResult,
      apiTrace,
      i18nTrace,
      definitionTrace,
      candidateLoading,
      searchRunning,
      error: candidateError,
      startedAt: searchStartedAt,
      finishedAt: searchFinishedAt,
      includeApiEvidence,
      selectedCandidatePaths,
      expandedCandidatePath,
      modelAssistAttempted,
      keywords: searchKeywords,
      processLogs,
      agentUsed,
      serverNeedsMoreEvidence
    } = storeToRefs(searchStore);
    const { resolverTrace: routeResolverTrace } = storeToRefs(routeStore);
    const { recent: recentRequests } = storeToRefs(requestStore);
    const { filesConfirmed } = storeToRefs(selectionStore);
    const modelAssistLoading = computed(() => modelStore.status === "running");
    const searchApiRequests = computed(() => includeApiEvidence.value ? recentRequests.value.slice(0, 5) : []);
    const selectedCandidateHits = computed(() => {
      const selected = new Set(selectedCandidatePaths.value);
      return candidateHits.value.filter((hit) => selected.has(hit.file));
    });
    const routeResolverMatched = computed(() => {
      var _a2;
      return !!((_a2 = routeResolverTrace.value) == null ? void 0 : _a2.matched);
    });
    const hasReliableCandidateEvidence = computed(() => {
      return routeResolverMatched.value || candidateHits.value.some((hit) => {
        return hit.stage === "model-agent" || hit.preciseEvidence;
      });
    });
    const localNeedsMoreEvidence = computed(() => {
      if (serverNeedsMoreEvidence.value) return true;
      return candidateHits.value.length > 1 && !filesConfirmed.value && !hasReliableCandidateEvidence.value;
    });
    const needsMoreEvidence = computed(() => localNeedsMoreEvidence.value && !modelAssistLoading.value && !modelAssistAttempted.value);
    const showCandidatePicker = computed(() => {
      return candidateHits.value.length > 1 && !filesConfirmed.value && !localNeedsMoreEvidence.value && !modelAssistLoading.value;
    });
    watch([candidateLoading, searchRunning, candidateError, candidateHits], ([loading, running, error]) => {
      if (error) searchStore.status = "error";
      else if (loading || running) searchStore.status = "loading";
      else if (candidateHits.value.length) searchStore.status = "success";
      else searchStore.status = "idle";
    }, { immediate: true, deep: true });
    watch([showCandidatePicker, needsMoreEvidence], ([showPicker, needsEvidence]) => {
      searchStore.showCandidatePicker = !!showPicker;
      searchStore.needsMoreEvidence = !!needsEvidence;
    }, { immediate: true });
    function invalidateCandidateConfirm() {
      selectionStore.filesConfirmed = false;
      composerStore.setFinalPrompt("");
    }
    function clearCandidateState() {
      candidateHits.value = [];
      compositeResult.value = null;
      changePlanResult.value = null;
      candidateError.value = "";
      searchRunning.value = false;
      candidateLoading.value = false;
      searchStartedAt.value = 0;
      searchFinishedAt.value = 0;
      selectedCandidatePaths.value = [];
      expandedCandidatePath.value = "";
      selectionStore.filesConfirmed = false;
      modelAssistAttempted.value = false;
      modelStore.reset();
      composerStore.setFinalPrompt("");
    }
    return {
      candidateHits,
      compositeResult,
      changePlanResult,
      apiTrace,
      i18nTrace,
      definitionTrace,
      candidateLoading,
      searchRunning,
      candidateError,
      searchStartedAt,
      searchFinishedAt,
      searchKeywords,
      includeApiEvidence,
      selectedCandidatePaths,
      expandedCandidatePath,
      modelAssistAttempted,
      processLogs,
      agentUsed,
      serverNeedsMoreEvidence,
      searchApiRequests,
      selectedCandidateHits,
      needsMoreEvidence,
      showCandidatePicker,
      appendProcessLog: searchStore.appendProcessLog,
      invalidateCandidateConfirm,
      clearCandidateState
    };
  }
  function createComposerFacade(store) {
    const promptIntent = computed({
      get: () => store.content,
      set: (value) => store.setContent(String(value || ""))
    });
    const promptText = computed({
      get: () => store.finalPrompt,
      set: (value) => store.setFinalPrompt(String(value || ""))
    });
    function invalidatePrompt() {
      store.setFinalPrompt("");
    }
    function resetPromptComposer() {
      store.setFinalPrompt("");
      store.clearContent();
    }
    return {
      promptIntent,
      promptText,
      invalidatePrompt,
      resetPromptComposer
    };
  }
  function loadProjectSelectionReferences(projectRoot) {
    return __async(this, null, function* () {
      if (!projectRoot) return [];
      const data = yield sourceServerJson(
        `/api/connect-agents/selections?projectRoot=${encodeURIComponent(projectRoot)}`
      );
      return Array.isArray(data == null ? void 0 : data.selections) ? data.selections : [];
    });
  }
  function deleteProjectSelectionReferences(_0) {
    return __async(this, arguments, function* (projectRoot, selectionIds = []) {
      if (!projectRoot) return;
      yield sourceServerJson("/api/connect-agents/selections", {
        method: "DELETE",
        body: { projectRoot, selectionIds }
      });
    });
  }
  function createClearSelectionsUseCase(deps) {
    const appUiStore = useAppUiStore();
    return function clearSelections(notifyRuntime = true) {
      return __async(this, null, function* () {
        yield deleteProjectSelectionReferences(deps.context.getProjectRoot());
        if (notifyRuntime) deps.bridge.sendCommand("selection.clear");
        deps.selectionStore.clear();
        deps.context.resetCandidateState();
        deps.context.resetComposer();
        appUiStore.setToast("");
      });
    };
  }
  function createExpandSelectionUseCase(deps) {
    return function expandSelection(uid2) {
      return __async(this, null, function* () {
        if (!uid2) return;
        const selection = deps.selectionStore.items.find((item) => item.uid === uid2);
        deps.bridge.sendCommand("selection.expand", { uid: uid2 }, {
          pageBindingId: (selection == null ? void 0 : selection.pageBindingId) || ""
        });
      });
    };
  }
  function createPreviewSelectionUseCase(deps) {
    function previewSelection(asset) {
      const uid2 = (asset == null ? void 0 : asset.uid) || "";
      const selection = deps.selectionStore.items.find((item) => item.uid === uid2);
      deps.bridge.sendCommand("selection.highlight", { uid: uid2 }, {
        pageBindingId: (selection == null ? void 0 : selection.pageBindingId) || ""
      });
    }
    function restoreSelectionPreview() {
      deps.bridge.sendCommand("selection.highlight", { uid: "" });
    }
    return { previewSelection, restoreSelectionPreview };
  }
  function createRemoveSelectionUseCase(deps) {
    const appUiStore = useAppUiStore();
    return function removeSelection(uid2) {
      return __async(this, null, function* () {
        if (!uid2) return;
        const selection = deps.selectionStore.items.find((item) => item.uid === uid2);
        if (!selection) return;
        yield deleteProjectSelectionReferences(deps.context.getProjectRoot(), [uid2]);
        deps.bridge.sendCommand("selection.remove", { uid: uid2 }, {
          pageBindingId: selection.pageBindingId || ""
        });
        deps.selectionStore.removeSelection(uid2);
        deps.context.resetCandidateState();
        const mentionsSelection = deps.context.getComposerContent().includes("@选区");
        appUiStore.setToast(mentionsSelection ? "已移除选区，请检查输入框中的 @选区 引用" : "已移除选区");
      });
    };
  }
  function createSelectionFacade(store) {
    const appUiStore = useAppUiStore();
    const selectedItems = computed(() => {
      return store.items.map((item) => ({
        uid: item.uid,
        element: null,
        info: item.element || {},
        assetElement: null,
        assetInfo: item.asset || item.element || {},
        sourceBinding: item.sourceBinding || null,
        thumbnailUrl: item.thumbnailUrl || ""
      }));
    });
    const filesConfirmed = computed({
      get: () => store.filesConfirmed,
      set: (value) => {
        store.filesConfirmed = value;
      }
    });
    const selectionConfirmed = computed({
      get: () => store.confirmed,
      set: (value) => store.markConfirmed(value)
    });
    const customEvidence = computed({
      get: () => store.customEvidence,
      set: (value) => {
        store.customEvidence = value;
      }
    });
    const evidenceMessages = computed({
      get: () => store.evidenceMessages,
      set: (value) => {
        store.evidenceMessages = value;
      }
    });
    function selectionPayloads(instruction = "") {
      const ids = new Set(referencedSelectionIds(instruction));
      return store.items.map((item, index) => {
        var _a2;
        return {
          uid: item.uid,
          selectionId: item.uid,
          index: index + 1,
          token: `@选区${index + 1}`,
          element: item.element,
          asset: item.asset || null,
          sourceLocate: item.sourceLocate || ((_a2 = item.element) == null ? void 0 : _a2.sourceLocate) || null,
          thumbnailCaptured: !!item.thumbnailUrl
        };
      }).filter((item) => ids.has(item.uid));
    }
    function selectionThumbnails(instruction = "") {
      const ids = new Set(referencedSelectionIds(instruction));
      return store.items.filter((item) => item.thumbnailUrl && ids.has(item.uid)).map((item) => ({
        selectionId: item.uid,
        thumbnail: item.thumbnailUrl || ""
      }));
    }
    function confirmSelectionContext(invalidatePrompt) {
      if (!store.hasSelection) return false;
      store.markConfirmed(true);
      store.filesConfirmed = false;
      invalidatePrompt == null ? void 0 : invalidatePrompt();
      appUiStore.setToast("选区已确认");
      return true;
    }
    function referencedSelectionIds(instruction) {
      var _a2;
      const value = String(instruction || "");
      const matches = Array.from(value.matchAll(/@(?:\[)?选区(?:(\d+))?(?:\])?/g));
      const activeId = store.activeId || ((_a2 = store.items[store.items.length - 1]) == null ? void 0 : _a2.uid) || "";
      if (!matches.length || matches.some((match) => !match[1])) return activeId ? [activeId] : [];
      return Array.from(new Set(matches.map((match) => {
        var _a3;
        return ((_a3 = store.items[Number(match[1]) - 1]) == null ? void 0 : _a3.uid) || "";
      }).filter(Boolean)));
    }
    function reusableSourceBindings(instruction, projectRoot) {
      const ids = referencedSelectionIds(instruction);
      if (!ids.length) return [];
      const bindings = ids.map((uid2) => {
        const index = store.items.findIndex((item) => item.uid === uid2);
        return {
          uid: uid2,
          index: index + 1,
          token: index >= 0 ? `@选区${index + 1}` : "",
          binding: store.sourceBinding(uid2)
        };
      });
      if (bindings.some((item) => {
        return !item.binding || item.binding.projectRoot !== projectRoot || !item.binding.targets.length;
      })) return [];
      return bindings;
    }
    function bindSourceContext(ids, binding) {
      for (const uid2 of ids) store.bindSourceContext(uid2, __spreadProps(__spreadValues({}, binding), {
        selectionId: uid2
      }));
    }
    function restoreLocationReferences(references, projectRoot) {
      store.restoreLocationReferences(references, projectRoot);
    }
    function bindAgentLocations({
      references,
      projectRoot,
      designRequirement
    }) {
      for (const item of references || []) {
        const uid2 = String((item == null ? void 0 : item.selectionId) || "");
        const targets = (Array.isArray(item == null ? void 0 : item.locations) ? item.locations : []).map((location) => ({
          file: String((location == null ? void 0 : location.file) || "").trim(),
          role: "render",
          line: Number((location == null ? void 0 : location.startLine) || 0),
          anchor: String((location == null ? void 0 : location.anchor) || "").trim()
        })).filter((location) => location.file);
        if (!uid2 || !targets.length) continue;
        store.bindSourceContext(uid2, {
          selectionId: uid2,
          projectRoot,
          designRequirement,
          targets,
          resolvedAt: Date.now()
        });
      }
    }
    return {
      selectedItems,
      filesConfirmed,
      selectionConfirmed,
      customEvidence,
      evidenceMessages,
      selectionPayloads,
      selectionThumbnails,
      confirmSelectionContext,
      referencedSelectionIds,
      reusableSourceBindings,
      bindSourceContext,
      restoreLocationReferences,
      bindAgentLocations
    };
  }
  function setupSelectionRuntime(options) {
    const selectionStore = useSelectionStore();
    const composerStore = useComposerStore();
    const searchStore = useSearchStore();
    const modelStore = useModelStore();
    const selection = createSelectionFacade(selectionStore);
    const deps = {
      bridge: { sendCommand: options.sendCommand },
      selectionStore,
      context: {
        resetComposer: () => {
          composerStore.setFinalPrompt("");
          composerStore.clearContent();
        },
        resetCandidateState: () => {
          selectionStore.filesConfirmed = false;
          searchStore.reset();
          modelStore.reset();
          composerStore.setFinalPrompt("");
        },
        getComposerContent: () => composerStore.content || "",
        getProjectRoot: options.getProjectRoot
      }
    };
    const preview = createPreviewSelectionUseCase(deps);
    Object.assign(selection, {
      expandSelection: createExpandSelectionUseCase(deps),
      removeSelection: createRemoveSelectionUseCase(deps),
      clearSelections: createClearSelectionsUseCase(deps),
      previewSelection: preview.previewSelection,
      restoreSelectionPreview: preview.restoreSelectionPreview
    });
    return selection;
  }
  function createSearchLogLines({
    combinedSelectionText,
    normalizeInstructionText,
    referencedPromptAssets
  }) {
    const composerStore = useComposerStore();
    const projectStore = useProjectStore();
    const requestStore = useRequestStore();
    const routeStore = useRouteStore();
    const searchStore = useSearchStore();
    const { content: promptIntent } = storeToRefs(composerStore);
    const { current: project } = storeToRefs(projectStore);
    const { recent: recentRequests } = storeToRefs(requestStore);
    const { pagePath: pageUrlPath2, resolverTrace: routeResolverTrace } = storeToRefs(routeStore);
    const {
      candidates: candidateHits,
      includeApiEvidence,
      apiTrace,
      i18nTrace,
      definitionTrace
    } = storeToRefs(searchStore);
    const searchApiRequests = computed(() => includeApiEvidence.value ? recentRequests.value.slice(0, 5) : []);
    return function searchLogLines() {
      var _a2, _b;
      const selectedItems = referencedPromptAssets(promptIntent.value);
      const routeLines = routeResolverLogLines({ routeResolverTrace, pageUrlPath: pageUrlPath2, project });
      const lines = [
        `1. 收集页面证据: pagePath=${pageUrlPath2.value}；本轮引用选区=${selectedItems.length}；className=${selectedItems.map((item) => item.className).filter(Boolean).join(" ") || "-"}`,
        `   源码项目: ${((_a2 = project.value) == null ? void 0 : _a2.path) || ((_b = project.value) == null ? void 0 : _b.name) || "-"}`,
        ...routeLines,
        `3. 组合检索词: ${combinedSelectionText() || "-"}`,
        `4. 用户指令: ${normalizeInstructionText(promptIntent.value) || "-"}`,
        "5. 源码检索: 再按文案/className/url path/用户指令搜索开发源码文件，跳过 node_modules/dist/build 等非源码目录",
        "6. 链路推断: 对页面线索或用户指令命中的文件继续沿 import 链路向下追踪，并对组件候选做引用反查"
      ];
      if (includeApiEvidence.value) {
        const endpoints = searchApiRequests.value.map((item) => item.pathname || item.url).filter(Boolean).slice(0, 5);
        lines.push(`7. 接口线索: ${endpoints.length ? endpoints.join("；") : "未捕获到接口端点"}`);
        lines.push(...apiTraceLogLines(apiTrace));
      }
      lines.push(...i18nTraceLogLines(i18nTrace));
      lines.push(...definitionTraceLogLines(definitionTrace));
      for (const [index, hit] of candidateHits.value.slice(0, 8).entries()) {
        lines.push(...candidateLogLines(hit, index));
      }
      return lines;
    };
  }
  function i18nTraceLogLines(i18nTrace) {
    var _a2, _b;
    const trace = i18nTrace == null ? void 0 : i18nTrace.value;
    if (!trace || !trace.active) return [];
    const lines = [];
    const hints = [
      ...((_a2 = trace.environment) == null ? void 0 : _a2.packageHints) || [],
      ...(((_b = trace.environment) == null ? void 0 : _b.codeHints) || []).slice(0, 3)
    ].filter(Boolean);
    lines.push(`9. 国际化识别: 已启用；线索=${hints.length ? hints.join("，") : "语言文件/目录命中"}`);
    for (const item of (trace.definitions || []).slice(0, 4)) {
      lines.push(`   国际化文案: ${item.file}；key=${item.keyPath}；text=${item.phrase}`);
    }
    for (const item of (trace.usages || []).slice(0, 4)) {
      lines.push(`   国际化使用: ${item.file}；key=${item.i18nKey || item.keyPath || "-"}；来源=${item.i18nDefinitionFile || item.from || "-"}`);
    }
    return lines;
  }
  function definitionTraceLogLines(definitionTrace) {
    const trace = definitionTrace == null ? void 0 : definitionTrace.value;
    if (!trace || !trace.active) return [];
    const lines = ["10. 字面量定义链: 已启用"];
    for (const item of (trace.definitions || []).slice(0, 4)) {
      lines.push(`   定义文案: ${item.file}；symbol=${item.symbol || "-"}；key=${item.keyPath || "-"}；text=${item.phrase}`);
    }
    for (const item of (trace.usages || []).slice(0, 4)) {
      lines.push(`   定义使用: ${item.file}；symbol=${item.definitionSymbol || "-"}；key=${item.definitionKeyPath || "-"}；来源=${item.definitionFile || item.from || "-"}`);
    }
    return lines;
  }
  function apiTraceLogLines(apiTrace) {
    var _a2;
    const trace = apiTrace == null ? void 0 : apiTrace.value;
    if (!trace || !Array.isArray(trace.endpoints) || !trace.endpoints.length) return [];
    const lines = [];
    for (const endpoint of trace.endpoints.slice(0, 4)) {
      const endpointLabel = [endpoint.method, endpoint.path].filter(Boolean).join(" ") || endpoint.path || endpoint.url || "-";
      const names = (endpoint.symbols || []).slice(0, 6).join(", ") || "-";
      lines.push(`8. 接口识别: ${endpointLabel}；接口名=${names}`);
      for (const file of endpoint.files || []) {
        lines.push(`   接口文件: ${file.file}${((_a2 = file.symbols) == null ? void 0 : _a2.length) ? `；符号=${file.symbols.join(", ")}` : ""}`);
      }
      for (const chain of endpoint.chains || []) {
        lines.push(`   接口引用链: ${chain.chain.join(" -> ")}${chain.symbol ? `；引用=${chain.symbol}` : ""}`);
      }
    }
    return lines;
  }
  function routeResolverLogLines({ routeResolverTrace, pageUrlPath: pageUrlPath2, project }) {
    var _a2, _b;
    const trace = routeResolverTrace == null ? void 0 : routeResolverTrace.value;
    const tracePath = String((trace == null ? void 0 : trace.pagePath) || "").trim();
    const isStaleTrace = !!tracePath && tracePath !== pageUrlPath2.value;
    if (!trace || isStaleTrace) {
      return [
        `2. 页面路由适配: ${isStaleTrace ? `旧结果已忽略(${tracePath})` : "未执行或本地服务未返回结果"}；projectKind=${((_a2 = project.value) == null ? void 0 : _a2.kind) || "unknown"}；pagePath=${pageUrlPath2.value}`
      ];
    }
    const adapters = trace.adapters && trace.adapters.length ? trace.adapters.join(", ") : "-";
    const status = trace.matched ? `命中 ${trace.hits.length} 个文件` : "未命中";
    const lines = [
      `2. 页面路由适配: ${status}；projectKind=${trace.projectKind || ((_b = project.value) == null ? void 0 : _b.kind) || "unknown"}；pagePath=${trace.pagePath || pageUrlPath2.value}；adapters=${adapters}`
    ];
    if (trace.matched) {
      for (const [index, hit] of (trace.hits || []).slice(0, 5).entries()) {
        lines.push(`   路由命中 ${index + 1}: ${hit.file}；adapter=${hit.adapter || "-"}；routePath=${hit.routePath || "-"}；score=${hit.score}`);
        const reason = (hit.reasons || []).find((item) => item && !item.startsWith("路由适配器"));
        if (reason) lines.push(`   路由依据 ${index + 1}: ${reason}`);
      }
    } else {
      lines.push("   路由结果: 当前页面 path 没有通过路由表或文件系统路由定位到页面文件，继续走文案/className/API 检索。");
    }
    if (trace.errors && trace.errors.length) {
      lines.push(`   路由适配异常: ${trace.errors.slice(0, 3).join("；")}`);
    }
    return lines;
  }
  function createSearchContextTools({ denoiseTextByApi }) {
    function contextTextTerms(info) {
      return extractSearchTerms(denoiseTextByApi((info == null ? void 0 : info.text) || ""));
    }
    function contextClassTerms(info) {
      return extractSearchTerms((info == null ? void 0 : info.className) || "");
    }
    function contextAttrTerms(info) {
      const attrs = (info == null ? void 0 : info.attrs) || {};
      const terms = [];
      for (const [key, value] of Object.entries(attrs)) {
        if (String(value || "").trim() === "[present]") continue;
        terms.push(...extractSearchTerms(key));
        terms.push(...extractSearchTerms(value));
      }
      return Array.from(new Set(terms));
    }
    function contextStyleTerms(info) {
      const style2 = (info == null ? void 0 : info.computedStyle) || {};
      const terms = [];
      for (const key of ["width", "height", "objectFit", "fontSize", "fontWeight", "backgroundSize", "backgroundPosition"]) {
        terms.push(...extractSearchTerms(style2[key] || ""));
      }
      return Array.from(new Set(terms));
    }
    function searchContextTerms(info) {
      return Array.from(/* @__PURE__ */ new Set([
        ...contextTextTerms(info),
        ...contextClassTerms(info),
        ...contextAttrTerms(info),
        ...contextStyleTerms(info)
      ]));
    }
    function hasUsefulExpandedFallback(selfInfo, expandedInfo) {
      const selfText = String(denoiseTextByApi((selfInfo == null ? void 0 : selfInfo.text) || "") || "").replace(/\s+/g, " ").trim();
      const expandedText = String(denoiseTextByApi((expandedInfo == null ? void 0 : expandedInfo.text) || "") || "").replace(/\s+/g, " ").trim();
      const selfTerms = new Set(searchContextTerms(selfInfo));
      const expandedTerms = searchContextTerms(expandedInfo);
      const addedTerms = expandedTerms.filter((term) => !selfTerms.has(term));
      if (addedTerms.length >= 2) return true;
      if (contextTextTerms(expandedInfo).some((term) => !selfTerms.has(term)) && [
        ...contextClassTerms(expandedInfo),
        ...contextAttrTerms(expandedInfo),
        ...contextStyleTerms(expandedInfo)
      ].some((term) => !selfTerms.has(term))) return true;
      if (selfText && expandedText && expandedText.length > selfText.length && expandedText.length <= 260) return true;
      if (!selfText && expandedText && expandedText.length <= 220) return true;
      return false;
    }
    function searchContextSpecificityScore(info) {
      const phrase = String(denoiseTextByApi((info == null ? void 0 : info.text) || "") || "").trim();
      const phraseScore = phrase.length >= 2 && phrase.length <= 32 ? 14 : phrase.length > 32 ? 8 : 0;
      return phraseScore + contextTextTerms(info).length * 6 + contextClassTerms(info).length * 6 + contextAttrTerms(info).length * 8 + contextStyleTerms(info).length * 4;
    }
    function searchContextBreadthScore(info) {
      var _a2, _b;
      const subtree = (info == null ? void 0 : info.subtree) || {};
      const nodeCount = Number(subtree.nodeCount || 0);
      const textCount = Array.isArray(subtree.texts) ? subtree.texts.length : 0;
      const attrCount = Array.isArray(subtree.attrs) ? subtree.attrs.length : 0;
      const styleCount = Array.isArray(subtree.styles) ? subtree.styles.length : 0;
      const textLength = String(denoiseTextByApi((info == null ? void 0 : info.text) || "") || "").length;
      const boxWidth = Number(((_a2 = info == null ? void 0 : info.box) == null ? void 0 : _a2.width) || 0);
      const boxHeight = Number(((_b = info == null ? void 0 : info.box) == null ? void 0 : _b.height) || 0);
      const area = Math.max(0, boxWidth * boxHeight);
      return nodeCount * 2 + textCount * 3 + attrCount + styleCount + Math.min(30, Math.floor(textLength / 12)) + Math.min(40, Math.floor(area / 5e4));
    }
    function shouldKeepExpandedSearchContext(selfInfo, expandedInfo) {
      if (!selfInfo || !expandedInfo) return false;
      if (hasUsefulExpandedFallback(selfInfo, expandedInfo)) return true;
      const selfSpecificity = searchContextSpecificityScore(selfInfo);
      if (selfSpecificity < 18) return true;
      const selfTerms = new Set(searchContextTerms(selfInfo));
      const expandedTerms = searchContextTerms(expandedInfo);
      const novelTerms = expandedTerms.filter((term) => !selfTerms.has(term));
      const breadthGap = searchContextBreadthScore(expandedInfo) - searchContextBreadthScore(selfInfo);
      if (novelTerms.length >= 4 && breadthGap <= 18) return true;
      return breadthGap <= 12;
    }
    return {
      shouldKeepExpandedSearchContext
    };
  }
  function useSearchPrompt() {
    const appUiStore = useAppUiStore();
    const composerStore = useComposerStore();
    const projectStore = useProjectStore();
    const requestStore = useRequestStore();
    const routeStore = useRouteStore();
    const searchStore = useSearchStore();
    const selectionStore = useSelectionStore();
    const {
      content: promptIntent,
      finalPrompt: promptText
    } = storeToRefs(composerStore);
    const { current: project } = storeToRefs(projectStore);
    const { recent: searchApiRequests } = storeToRefs(requestStore);
    const {
      pageUrl: currentPageHref,
      pagePath: pageUrlPath2,
      resolverTrace: routeResolverTrace
    } = storeToRefs(routeStore);
    const {
      candidates: candidateHits,
      selectedCandidatePaths,
      selectedCandidates: selectedCandidateHits,
      apiTrace,
      i18nTrace,
      definitionTrace,
      keywords: searchKeywords,
      includeApiEvidence
    } = storeToRefs(searchStore);
    const {
      customEvidence,
      evidenceMessages
    } = storeToRefs(selectionStore);
    const selectedItems = computed(() => selectionStore.items.map((item) => ({
      uid: item.uid,
      element: null,
      info: item.element || {},
      assetElement: null,
      assetInfo: item.asset || item.element || {},
      thumbnailUrl: item.thumbnailUrl || ""
    })));
    const selectionPayloads = () => selectionStore.items.map((item, index) => {
      var _a2;
      return {
        uid: item.uid,
        selectionId: item.uid,
        index: index + 1,
        token: `@选区${index + 1}`,
        element: item.element,
        asset: null,
        sourceLocate: item.sourceLocate || ((_a2 = item.element) == null ? void 0 : _a2.sourceLocate) || null,
        thumbnailCaptured: !!item.thumbnailUrl
      };
    });
    const denoiseTextByApi = requestStore.denoiseTextByApi;
    const searchContext = createSearchContextTools({ denoiseTextByApi });
    function filteredAncestorsForSearch(info) {
      return ((info == null ? void 0 : info.ancestors) || []).filter((ancestor) => searchContext.shouldKeepExpandedSearchContext(info, ancestor));
    }
    function filteredAssetForSearch(info, asset) {
      return searchContext.shouldKeepExpandedSearchContext(info, asset) ? asset : null;
    }
    function promptAssetToken(index) {
      return `@选区${index}`;
    }
    function selectionChatSummary() {
      var _a2, _b;
      const latest = selectedItems.value[selectedItems.value.length - 1];
      const latestText = ((_a2 = latest == null ? void 0 : latest.info) == null ? void 0 : _a2.text) || ((_b = latest == null ? void 0 : latest.info) == null ? void 0 : _b.className) || "";
      return [
        `${selectedItems.value.length} 个选区已保存，可在输入框里用 @选区1 引用。`,
        latestText ? `最近选区：${compactText(latestText, 80)}` : ""
      ].filter(Boolean).join("\n");
    }
    function selectionAttrSummary(info) {
      const attrs = Object.entries((info == null ? void 0 : info.attrs) || {}).filter(([key, value]) => {
        const text = String(value || "").trim();
        if (!text || text === "[present]" || text.length > 40) return false;
        return !/^(class|style|src|href)$/i.test(String(key || ""));
      }).slice(0, 3).map(([key, value]) => `${key}=${value}`);
      return attrs.join("；");
    }
    function selectionReferenceSummary(info) {
      const text = compactText((info == null ? void 0 : info.text) || "", 40);
      const attrText = selectionAttrSummary(info);
      const nodeParts = [
        (info == null ? void 0 : info.tag) ? `tag=${info.tag}` : "",
        (info == null ? void 0 : info.className) ? `className=${compactText(info.className, 30)}` : "",
        attrText ? `attrs=${attrText}` : ""
      ].filter(Boolean);
      const nodeText = nodeParts.join("；");
      if (!text) return compactText(nodeText || "-", 80);
      if (text.length <= 8 || /^[A-Za-z0-9_\u4e00-\u9fa5-]+$/.test(text)) {
        return compactText([text, nodeText].filter(Boolean).join("；"), 80);
      }
      return compactText(text, 80);
    }
    function promptAssetItems() {
      return selectionPayloads().map((item) => {
        const info = item.element || {};
        const text = compactText(info.text || "", 120);
        const fallback = compactText([info.tag || "-", info.className || ""].filter(Boolean).join(".").replace(/\.+/g, "."), 40);
        return {
          uid: item.uid,
          token: promptAssetToken(item.index),
          index: item.index,
          tag: info.tag || "-",
          className: info.className || "",
          text,
          attrs: info.attrs || {},
          ancestors: ancestorPromptLine(info),
          summary: compactText(selectionReferenceSummary(info) || text || fallback || `选区${item.index}`, 40)
        };
      });
    }
    function buildPromptIntentDraft() {
      return promptAssetItems().map((asset) => asset.token).filter(Boolean).join(" ");
    }
    function normalizeInstructionText(value) {
      return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean).join("\n").trim();
    }
    function sanitizeModelInstructionText(value) {
      let text = normalizeInstructionText(value);
      if (!text) return "";
      text = text.replace(/需要引入[^。\n；]*(?:http|axios|request|fetch)[^。\n；]*/ig, "沿用项目现有 API 调用方式完成接口请求");
      text = text.replace(/[（(]如[^）)]*(?:http|axios|request|fetch|@\/)[^）)]*[）)]/ig, "");
      text = text.split("\n").map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd()).join("\n").trim();
      return text;
    }
    function selectedPromptHits() {
      return selectedCandidateHits.value.length ? selectedCandidateHits.value : candidateHits.value.slice(0, 1);
    }
    function normalizeSnippetText(value) {
      const text = String(value || "").trim();
      if (!text) return "";
      const lines = text.split("\n");
      const cropped = lines.slice(0, 14).join("\n");
      if (cropped.length > 420) return `${cropped.slice(0, 420)}...`;
      return lines.length > 14 ? `${cropped}
...` : cropped;
    }
    function finalPromptTaskLines(command) {
      const hits = selectedPromptHits();
      return hits.map((hit, index) => {
        const modelLocation = normalizeSnippetText(hit.modelCodeSnippet || "");
        const hasReliableUiSource = !!(hit.preciseSnippet || hit.uniqueSnippet) && !!(hit.preciseEvidence || hit.exactMatchText || hit.uniqueMatchText || (hit.contextScore || 0) > 0 || (hit.contextReasons || []).length);
        const uiSource = hasReliableUiSource ? normalizeSnippetText(hit.preciseSnippet || hit.uniqueSnippet || "") : "";
        const fallbackSource = normalizeSnippetText(hit.snippet || "");
        const location = modelLocation || uiSource || fallbackSource;
        const source = modelLocation || uiSource || fallbackSource;
        const requirement = command || "按当前页面上下文完成修改";
        const directionLevel = hit.modelLocateLevel === "direction";
        const directionGuess = sanitizeModelInstructionText(hit.modelDirectionGuess || "");
        const shouldShowUiSource = directionLevel && uiSource && uiSource !== location;
        const importChain = Array.isArray(hit.importChain) && hit.importChain.length ? hit.importChain.join(" -> ") : "";
        return [
          hits.length > 1 ? `任务 ${index + 1}:` : "",
          `文件: ${hit.file}`,
          hit.selectionDesignRequirement ? `已确认设计需求: ${hit.selectionDesignRequirement}` : "",
          shouldShowUiSource ? `UI源码:
${uiSource}` : "",
          location ? `${directionLevel ? "源码方向" : "位置"}:
${location}` : "",
          source && !directionLevel ? `源码:
${source}` : "",
          importChain ? `相关引用链: ${importChain}` : "",
          directionGuess ? `推测方向: ${directionGuess}` : "",
          `需求: ${requirement}`
        ].filter(Boolean).join("\n");
      }).join("\n\n");
    }
    function agentSafetyGuardLines() {
      return [
        "执行准则:",
        "- 上面的文件/源码方向来自页面选区定位，只作为优先检查线索，不是最终结论。",
        "- 修改前必须重新阅读相关源码，验证页面选区、文案/class/结构、组件引用链或事件链是否能对应到该文件。",
        "- 如果验证发现该方向不匹配、证据不足，或真正逻辑在父组件/子组件/组合式函数/常量/API 调用处，必须沿引用链重新定位后再修改。",
        "- 不要为了贴合上述方向而臆测不存在的变量、函数、接口、导入路径或状态管理方式；优先复用项目现有实现。"
      ].join("\n");
    }
    function referencedPromptAssets(text) {
      const assets = promptAssetItems();
      if (!assets.length) return [];
      const value = String(text || "");
      const matches = Array.from(value.matchAll(/@(?:\[)?选区(?:(\d+))?(?:\])?/g));
      const activeAsset = assets.find((asset) => asset.uid === selectionStore.activeId) || assets[assets.length - 1];
      if (!matches.length || matches.some((match) => !match[1])) {
        return activeAsset ? [activeAsset] : [];
      }
      const indexes = /* @__PURE__ */ new Set();
      matches.forEach((match) => indexes.add(Number(match[1])));
      return assets.filter((asset) => indexes.has(asset.index));
    }
    function selectionPromptInstructions(text) {
      const assets = promptAssetItems();
      const referencedAssets = referencedPromptAssets(text);
      const value = normalizeInstructionText(text);
      if (!assets.length || !value) return [];
      const matches = Array.from(value.matchAll(/@(?:\[)?选区(?:(\d+))?(?:\])?/g));
      if (!matches.length) {
        return referencedAssets.map((asset) => ({
          index: asset.index,
          token: asset.token,
          instruction: value
        }));
      }
      const grouped = /* @__PURE__ */ new Map();
      for (let index = 0; index < matches.length; index++) {
        const match = matches[index];
        const start = (match.index || 0) + match[0].length;
        const end = index + 1 < matches.length ? matches[index + 1].index || value.length : value.length;
        const instruction = value.slice(start, end).replace(/^[\s，,；;:：-]+/, "").trim() || "按当前页面上下文处理";
        const indexes = match[1] ? [Number(match[1])] : referencedAssets.map((asset) => asset.index);
        for (const assetIndex of indexes) {
          const existing = grouped.get(assetIndex) || [];
          existing.push(instruction);
          grouped.set(assetIndex, existing);
        }
      }
      return assets.filter((asset) => grouped.has(asset.index)).map((asset) => ({
        index: asset.index,
        token: asset.token,
        instruction: grouped.get(asset.index).join("；")
      }));
    }
    function selectionTextReferenceLines(text) {
      return referencedPromptAssets(text).map((asset) => {
        return `${asset.token}: ${selectionReferenceSummary(asset)}`;
      }).join("；");
    }
    function selectionNodeLine(info) {
      return [
        `tag=${info.tag || "-"}`,
        `className=${info.className || "-"}`,
        `box=${info.box.width}x${info.box.height}@${info.box.x},${info.box.y}`
      ].join("；");
    }
    function ancestorPromptLine(info) {
      return (info.ancestors || []).slice(0, 3).map((ancestor) => {
        const text = denoiseTextByApi(ancestor.text, 80);
        const parts = [
          ancestor.tag || "-",
          ancestor.className ? `className=${ancestor.className}` : "",
          text ? `文案=${text}` : ""
        ].filter(Boolean);
        return parts.join("；");
      }).filter(Boolean).join(" > ");
    }
    function modificationCommand() {
      const instructions = new Map(selectionPromptInstructions(promptIntent.value).map((item) => [item.index, item.instruction]));
      const activeIndexes = new Set(referencedPromptAssets(promptIntent.value).map((asset) => asset.index));
      return selectionPayloads().filter((item) => activeIndexes.has(item.index)).filter((item) => {
        var _a2, _b;
        return instructions.has(item.index) || ((_a2 = item.element) == null ? void 0 : _a2.text) || ((_b = item.element) == null ? void 0 : _b.className);
      }).map((item) => {
        const info = item.element;
        const denoisedText = denoiseTextByApi(info.text);
        const ancestors = ancestorPromptLine(info);
        return [
          `选区 ${item.index}: ${instructions.get(item.index) || "按页面上下文修改"}`,
          `  当前节点: ${selectionNodeLine(info)}`,
          `  节点文案: ${denoisedText || "-"}`,
          ancestors ? `  父级线索: ${ancestors}` : ""
        ].filter(Boolean).join("\n");
      }).join("\n");
    }
    function combinedSelectionText(options = {}) {
      options.expandedRetry === true;
      if (searchKeywords.value.trim()) return searchKeywords.value.trim();
      const terms = [];
      const promptInstructions = selectionPromptInstructions(promptIntent.value);
      if (promptInstructions.length) {
        for (const item of promptInstructions) {
          terms.push(...extractSearchTerms(item.instruction));
        }
      } else {
        terms.push(...extractSearchTerms(String(promptIntent.value || "").replace(/@(?:\[)?选区(?:(\d+))?(?:\])?/g, " ")));
      }
      for (const message of evidenceMessages.value) {
        terms.push(...extractSearchTerms(message));
      }
      terms.push(...extractSearchTerms(customEvidence.value));
      const activeIndexes = new Set(referencedPromptAssets(promptIntent.value).map((asset) => asset.index));
      for (const [index, item] of selectedItems.value.entries()) {
        if (!activeIndexes.has(index + 1)) continue;
        terms.push(...extractSearchTerms(denoiseTextByApi(item.info.text)));
        terms.push(...extractSearchTerms(item.info.className));
        terms.push(...subtreeSearchTerms(item.info.subtree));
      }
      return Array.from(new Set(terms)).slice(0, 28).join(" ");
    }
    function subtreeSearchTerms(subtree) {
      if (!subtree) return [];
      const terms = [];
      for (const className of subtree.classNames || []) terms.push(...extractSearchTerms(className));
      for (const text of subtree.texts || []) terms.push(...extractSearchTerms(denoiseTextByApi(text)));
      for (const attr of subtree.attrs || []) {
        terms.push(...extractSearchTerms(attr == null ? void 0 : attr.key));
        terms.push(...extractSearchTerms(attr == null ? void 0 : attr.value));
      }
      for (const item of subtree.styles || []) {
        const style2 = (item == null ? void 0 : item.style) || {};
        for (const value of Object.values(style2)) terms.push(...extractSearchTerms(value));
      }
      return terms;
    }
    function denoiseSubtree(subtree) {
      if (!subtree) return subtree;
      return __spreadProps(__spreadValues({}, subtree), {
        texts: (subtree.texts || []).map((text) => denoiseTextByApi(text))
      });
    }
    function searchReadyInfo(info, options = {}) {
      if (!info) return info;
      const includeAncestors = options.includeAncestors !== false;
      return __spreadValues(__spreadProps(__spreadValues({}, info), {
        searchText: denoiseTextByApi(info.text || ""),
        searchSubtree: denoiseSubtree(info.subtree)
      }), includeAncestors ? {
        ancestors: (info.ancestors || []).map((ancestor) => searchReadyInfo(ancestor, { includeAncestors: false }))
      } : {});
    }
    function searchPayload(options = {}) {
      const expandedRetry = options.expandedRetry === true;
      const activeAssets = referencedPromptAssets(promptIntent.value);
      const activeIndexes = new Set(activeAssets.map((asset) => asset.index));
      const activeSelectionIds = activeAssets.map((asset) => asset.uid).filter(Boolean);
      const selections = selectionPayloads().filter((item) => activeIndexes.has(item.index)).map((item) => {
        var _a2;
        const filteredAncestors = expandedRetry ? ((_a2 = item.element) == null ? void 0 : _a2.ancestors) || [] : filteredAncestorsForSearch(item.element);
        const filteredAsset = expandedRetry ? item.asset || null : filteredAssetForSearch(item.element, item.asset);
        return __spreadProps(__spreadValues({}, item), {
          element: __spreadProps(__spreadValues({}, searchReadyInfo(item.element)), {
            ancestors: filteredAncestors.map((ancestor) => searchReadyInfo(ancestor, { includeAncestors: false }))
          }),
          asset: filteredAsset ? searchReadyInfo(filteredAsset, { includeAncestors: false }) : null
        });
      });
      const apiRequests = searchApiRequests.value.map((item) => ({
        url: item.url,
        pathname: item.pathname,
        method: item.method,
        requestKeys: item.requestKeys
      }));
      const query = combinedSelectionText({ expandedRetry });
      const pageHref = (currentPageHref == null ? void 0 : currentPageHref.value) || window.location.href;
      return {
        query,
        url: pageHref,
        pageUrl: pageHref,
        pagePath: pageUrlPath2.value,
        activeSelectionIds,
        className: selections.map((item) => {
          var _a2;
          return ((_a2 = item.element) == null ? void 0 : _a2.className) || "";
        }).filter(Boolean).join(" "),
        text: query,
        userPrompt: normalizeInstructionText(promptIntent.value),
        manualEvidence: evidenceMessages.value.join("\n"),
        selectionInstructions: selectionPromptInstructions(promptIntent.value),
        selectionTexts: selections.map((item) => {
          var _a2, _b, _c;
          return {
            index: item.index,
            text: ((_a2 = item.element) == null ? void 0 : _a2.text) || "",
            searchText: ((_b = item.element) == null ? void 0 : _b.searchText) || "",
            className: ((_c = item.element) == null ? void 0 : _c.className) || ""
          };
        }),
        selections,
        apiRequests,
        includeApi: includeApiEvidence.value,
        mode: "ui-first",
        expansionMode: expandedRetry ? "expanded-retry" : "base",
        apiPaths: apiRequests.map((item) => item.pathname || item.url),
        apiKeys: apiRequests.flatMap((item) => item.requestKeys || []),
        agentState: options.agentState || null,
        limit: 30
      };
    }
    function generatePrompt(options = {}) {
      const command = normalizeInstructionText(options.userInstruction || buildPromptIntentDraft()) || modificationCommand();
      const enhancedPrompts = Array.from(new Set(
        selectedPromptHits().map((hit) => String(hit.modelEnhancedPrompt || "").trim()).filter(Boolean)
      ));
      if (enhancedPrompts.length) {
        promptText.value = enhancedPrompts.join("\n\n");
        appUiStore.setToast("提示词已生成");
        return;
      }
      const tasks = finalPromptTaskLines(command);
      const selectionReference = selectionTextReferenceLines(command);
      promptText.value = [
        `当前 page: ${(currentPageHref == null ? void 0 : currentPageHref.value) || window.location.href}`,
        `页面路径: ${pageUrlPath2.value}`,
        tasks || `需求: ${command}`,
        selectionReference ? `选区文本参考: ${selectionReference}` : "",
        agentSafetyGuardLines()
      ].filter(Boolean).join("\n\n");
      appUiStore.setToast("提示词已生成");
    }
    const searchLogLines = createSearchLogLines({
      combinedSelectionText,
      normalizeInstructionText,
      referencedPromptAssets
    });
    return {
      selectionChatSummary,
      selectionNodeLine,
      ancestorPromptLine,
      combinedSelectionText,
      searchPayload,
      searchLogLines,
      generatePrompt,
      promptAssetItems,
      referencedPromptAssets,
      buildPromptIntentDraft
    };
  }
  function setupPromptRuntime() {
    return useSearchPrompt();
  }
  const MODEL_STORAGE_KEY = "gocapture:model-adapters";
  const MODEL_SELECTED_KEY = "gocapture:model-adapters:selected";
  const MODEL_SYNC_CHANNEL = "gocapture:model-adapters:sync";
  function loadJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }
  function saveJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
    }
  }
  function loadText(key, fallback = "") {
    try {
      const raw = window.localStorage.getItem(key);
      return typeof raw === "string" ? raw : fallback;
    } catch (error) {
      return fallback;
    }
  }
  function saveText(key, value) {
    try {
      if (value) window.localStorage.setItem(key, value);
      else window.localStorage.removeItem(key);
    } catch (error) {
    }
  }
  function extensionStorage() {
    try {
      const requireFn = typeof window._require === "function" ? window._require : typeof _require === "function" ? _require : null;
      if (!requireFn) return null;
      const storage = requireFn("md.storage");
      return storage && storage.local ? storage.local : null;
    } catch (error) {
      return null;
    }
  }
  function loadPersistedModelState() {
    return __async(this, null, function* () {
      const localModels = loadJson(MODEL_STORAGE_KEY, []);
      const localSelectedId = loadText(MODEL_SELECTED_KEY, "");
      const storage = extensionStorage();
      if (!storage) {
        return {
          models: localModels,
          selectedId: localSelectedId,
          migrated: false
        };
      }
      try {
        const data = yield storage.get([MODEL_STORAGE_KEY, MODEL_SELECTED_KEY]);
        const hasModels = Array.isArray(data == null ? void 0 : data[MODEL_STORAGE_KEY]);
        const hasSelectedId = typeof (data == null ? void 0 : data[MODEL_SELECTED_KEY]) === "string";
        if (hasModels || hasSelectedId) {
          return {
            models: hasModels ? data[MODEL_STORAGE_KEY] : [],
            selectedId: hasSelectedId ? data[MODEL_SELECTED_KEY] : "",
            migrated: false
          };
        }
      } catch (error) {
      }
      return {
        models: localModels,
        selectedId: localSelectedId,
        migrated: !!(localModels.length || localSelectedId)
      };
    });
  }
  function persistModelState(models, selectedId) {
    return __async(this, null, function* () {
      saveJson(MODEL_STORAGE_KEY, models);
      saveText(MODEL_SELECTED_KEY, selectedId);
      const storage = extensionStorage();
      if (storage) {
        try {
          yield storage.set({
            [MODEL_STORAGE_KEY]: models,
            [MODEL_SELECTED_KEY]: selectedId || ""
          });
        } catch (error) {
        }
      }
      broadcastModelState();
    });
  }
  function broadcastModelState() {
    if (typeof BroadcastChannel !== "function") return;
    const channel = new BroadcastChannel(MODEL_SYNC_CHANNEL);
    channel.postMessage({ type: "changed" });
    channel.close();
  }
  function defaultModelForm() {
    return {
      id: "",
      name: "DeepSeek",
      provider: "deepseek",
      type: "api",
      endpoint: "https://api.deepseek.com/chat/completions",
      apiKey: "",
      model: "deepseek-v4-pro",
      proxyUrl: "",
      timeoutMs: 12e4
    };
  }
  function providerModelForm(provider) {
    return defaultModelForm();
  }
  function normalizeModel(raw) {
    const item = raw || {};
    if (item.provider !== "deepseek") return null;
    return {
      id: item.id || `model-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: item.name || "DeepSeek",
      provider: "deepseek",
      type: "api",
      endpoint: item.endpoint || "https://api.deepseek.com/chat/completions",
      apiKey: item.apiKey || "",
      model: item.model || "deepseek-v4-pro",
      proxyUrl: item.proxyUrl || "",
      timeoutMs: Number(item.timeoutMs || 12e4)
    };
  }
  function useModelAdapters() {
    const modelStore = useModelStore();
    const appUiStore = useAppUiStore();
    const projectStore = useProjectStore();
    const routeStore = useRouteStore();
    const searchStore = useSearchStore();
    const prompt = useSearchPrompt();
    const { current: project } = storeToRefs(projectStore);
    const { resolverTrace: routeResolverTrace } = storeToRefs(routeStore);
    const {
      candidates: candidateHits,
      changePlan,
      selectedCandidatePaths,
      apiTrace,
      i18nTrace,
      definitionTrace
    } = storeToRefs(searchStore);
    const { searchPayload } = prompt;
    if (!modelStore.configs.length) modelStore.configs = loadJson(MODEL_STORAGE_KEY, []).map(normalizeModel).filter(Boolean);
    if (!modelStore.selectedModelId) modelStore.selectedModelId = loadText(MODEL_SELECTED_KEY, "");
    modelStore.useModelAssist = !!modelStore.selectedModelId;
    const {
      configs: modelConfigs,
      selectedModelId,
      useModelAssist,
      editorOpen: modelEditorOpen,
      form: modelForm,
      error: modelAssistError,
      logs: modelAssistLogs,
      result: modelAssistResult,
      startedAt: modelAssistStartedAt,
      finishedAt: modelAssistFinishedAt
    } = storeToRefs(modelStore);
    let modelAssistController = null;
    const selectedModel = computed(() => {
      return modelConfigs.value.find((item) => item.id === selectedModelId.value) || null;
    });
    const canUseModelAssist = computed(() => {
      return !!selectedModel.value && !!project.value && project.value.source === "source-server";
    });
    const modelAssistLoading = computed({
      get: () => modelStore.status === "running",
      set: (value) => {
        var _a2;
        if (value) {
          modelStore.status = "running";
          return;
        }
        if (modelStore.status !== "running") return;
        if (modelAssistError.value) modelStore.status = "error";
        else if ((_a2 = modelAssistResult.value) == null ? void 0 : _a2.stopped) modelStore.status = "stopped";
        else if (modelAssistResult.value) modelStore.status = "success";
        else modelStore.status = "idle";
      }
    });
    watch(canUseModelAssist, (value) => {
      modelStore.canUseModelAssist = !!value;
    }, { immediate: true });
    function persistModels() {
      void persistModelState(modelConfigs.value, selectedModelId.value);
    }
    function hydratePersistedModels() {
      return __async(this, null, function* () {
        const state = yield loadPersistedModelState();
        const nextModels = (Array.isArray(state.models) ? state.models : []).map(normalizeModel).filter(Boolean);
        const validSelectedId = nextModels.some((item) => item.id === state.selectedId) ? state.selectedId : "";
        modelConfigs.value = nextModels;
        selectedModelId.value = validSelectedId;
        useModelAssist.value = !!validSelectedId;
        if (state.migrated || state.selectedId && state.selectedId !== validSelectedId) {
          void persistModelState(nextModels, validSelectedId);
        }
      });
    }
    function handleStorageChange(event) {
      if (event.key !== MODEL_STORAGE_KEY && event.key !== MODEL_SELECTED_KEY) return;
      void hydratePersistedModels();
    }
    const syncChannel = typeof BroadcastChannel === "function" ? new BroadcastChannel(MODEL_SYNC_CHANNEL) : null;
    if (syncChannel) {
      syncChannel.onmessage = () => {
        void hydratePersistedModels();
      };
    }
    window.addEventListener("storage", handleStorageChange);
    onScopeDispose(() => {
      syncChannel == null ? void 0 : syncChannel.close();
      window.removeEventListener("storage", handleStorageChange);
    });
    function openModelEditor(model) {
      modelForm.value = model ? __spreadValues({}, model) : defaultModelForm();
      modelEditorOpen.value = true;
    }
    function openProviderModelEditor(provider) {
      modelForm.value = providerModelForm();
      modelEditorOpen.value = true;
    }
    function closeModelEditor() {
      modelEditorOpen.value = false;
    }
    function saveModelForm() {
      const normalized = normalizeModel(modelForm.value);
      if (!normalized) {
        appUiStore.setToast("当前模型供应商尚未安装适配器");
        return;
      }
      const index = modelConfigs.value.findIndex((item) => item.id === normalized.id);
      if (index === -1) modelConfigs.value.push(normalized);
      else modelConfigs.value.splice(index, 1, normalized);
      selectedModelId.value = normalized.id;
      useModelAssist.value = true;
      persistModels();
      modelEditorOpen.value = false;
      appUiStore.setToast("模型已保存");
    }
    function removeSelectedModel() {
      var _a2;
      if (!selectedModelId.value) return;
      modelConfigs.value = modelConfigs.value.filter((item) => item.id !== selectedModelId.value);
      selectedModelId.value = ((_a2 = modelConfigs.value[0]) == null ? void 0 : _a2.id) || "";
      persistModels();
      if (!selectedModelId.value) useModelAssist.value = false;
      appUiStore.setToast("模型已移除");
    }
    function setSelectedModel(id) {
      selectedModelId.value = id || "";
      useModelAssist.value = !!selectedModelId.value;
      persistModels();
    }
    function selectModelAndEnable(id) {
      selectedModelId.value = id || "";
      useModelAssist.value = !!selectedModelId.value;
      persistModels();
      if (selectedModelId.value) appUiStore.setToast("模型已启用");
    }
    function disableModelAssist() {
      selectedModelId.value = "";
      useModelAssist.value = false;
      persistModels();
      appUiStore.setToast("模型已停用");
    }
    function setUseModelAssist(value) {
      useModelAssist.value = !!value;
      if (useModelAssist.value && !selectedModel.value) {
        openModelEditor();
      }
    }
    function resetModelAssist() {
      modelAssistError.value = "";
      modelAssistLogs.value = [];
      modelAssistResult.value = null;
      modelAssistStartedAt.value = 0;
      modelAssistFinishedAt.value = 0;
      modelStore.status = "idle";
    }
    function mergeModelTargets(result) {
      var _a2;
      const targets = ((result == null ? void 0 : result.modelItems) || (result == null ? void 0 : result.targetFiles) || []).filter((item) => item.exists);
      const nextChangePlan = (result == null ? void 0 : result.changePlan) || ((_a2 = targets.find((item) => item.changePlan)) == null ? void 0 : _a2.changePlan) || null;
      if (nextChangePlan) changePlan.value = nextChangePlan;
      if (!targets.length) return;
      const oldHits = candidateHits.value.slice();
      const byFile = new Map(oldHits.map((hit) => [hit.file, hit]));
      const promoted = targets.map((target, index) => {
        var _a3, _b;
        const old = byFile.get(target.file);
        const score = Math.max((old == null ? void 0 : old.score) || 0, 980 - index * 40 + Math.round((target.confidence || 0) * 0.2));
        return __spreadProps(__spreadValues({}, old || {
          file: target.file,
          from: "",
          snippet: "",
          uniqueSnippet: "",
          uniqueMatchLabel: "",
          uniqueMatchText: "",
          uniqueMatchCount: 0
        }), {
          score,
          stage: "model-agent",
          preModelStage: (old == null ? void 0 : old.stage) || "",
          preModelStageLabel: (old == null ? void 0 : old.stage) ? old.stage : "",
          preModelReasons: (old == null ? void 0 : old.reasons) || [],
          reasons: [
            `模型定位：${target.enhancedPrompt || target.prompt || target.reason || ((_a3 = result.parsed) == null ? void 0 : _a3.summary) || result.rawText || "-"}`,
            target.directionGuess ? `推测方向：${target.directionGuess}` : "",
            target.codeSnippet ? `模型代码片段：${target.codeSnippet}` : "",
            ...(old == null ? void 0 : old.reasons) || []
          ].filter(Boolean).slice(0, 10),
          modelPrompt: target.enhancedPrompt || target.prompt || target.reason || "",
          modelEnhancedPrompt: target.enhancedPrompt || "",
          modelChangePlan: target.changePlan || null,
          modelExperienceMode: target.experienceMode || "",
          modelUsedExperienceIds: target.usedExperienceIds || [],
          modelCodeSnippet: target.codeSnippet || "",
          modelLocateLevel: target.fileOnly ? "file" : target.locateLevel || "exact",
          modelFileOnly: !!target.fileOnly,
          modelSelectionFallback: !!target.selectionFallback,
          modelSnippetSource: target.snippetSource || "",
          modelDirectionGuess: target.directionGuess || "",
          modelSnippetVerified: target.fileOnly ? true : target.snippetVerified !== false,
          modelDowngradedToDirection: !!target.downgradedToDirection,
          modelConfidence: target.confidence,
          modelAdapter: ((_b = result.adapter) == null ? void 0 : _b.name) || ""
        });
      });
      const promotedFiles = new Set(promoted.map((hit) => hit.file));
      candidateHits.value = [
        ...promoted,
        ...oldHits.filter((hit) => !promotedFiles.has(hit.file))
      ].sort((a, b) => b.score - a.score);
      selectedCandidatePaths.value = promoted.map((hit) => hit.file);
    }
    function runModelAssist() {
      return __async(this, null, function* () {
        var _a2, _b, _c, _d, _e, _f;
        if (!useModelAssist.value || !canUseModelAssist.value) return null;
        if (modelAssistLoading.value) return null;
        const controller = new AbortController();
        modelAssistController = controller;
        modelAssistStartedAt.value = Date.now();
        modelAssistFinishedAt.value = 0;
        modelAssistLoading.value = true;
        modelAssistError.value = "";
        modelAssistLogs.value = ["模型定位请求已发起"];
        modelAssistResult.value = null;
        try {
          const result = yield sourceServerNdjson("/api/model/locate/stream", {
            method: "POST",
            controller,
            body: {
              adapter: selectedModel.value,
              searchPayload: searchPayload(),
              pagePath: ((_a2 = routeResolverTrace.value) == null ? void 0 : _a2.pagePath) || "",
              routeResolver: routeResolverTrace.value,
              apiTrace: (apiTrace == null ? void 0 : apiTrace.value) || null,
              i18nTrace: (i18nTrace == null ? void 0 : i18nTrace.value) || null,
              definitionTrace: (definitionTrace == null ? void 0 : definitionTrace.value) || null,
              candidateHits: candidateHits.value.slice(0, 4),
              selectedCandidateHits: candidateHits.value.filter((hit) => selectedCandidatePaths.value.includes(hit.file)).slice(0, 4)
            },
            timeoutMs: Number(selectedModel.value.timeoutMs || 12e4) * 3 + 5e3,
            timeoutMessage: "模型定位超时",
            abortMessage: "模型定位已停止",
            onEvent(event) {
              if (event.type === "log" && event.log) {
                modelAssistLogs.value = [...modelAssistLogs.value, event.log];
              }
              if (event.type === "result") {
                modelAssistResult.value = event.result || null;
              }
              if (event.type === "error" && Array.isArray(event.logs)) {
                modelAssistLogs.value = event.logs;
              }
            }
          });
          modelAssistResult.value = result || modelAssistResult.value || null;
          modelAssistLogs.value = ((_b = modelAssistResult.value) == null ? void 0 : _b.logs) || [];
          mergeModelTargets(modelAssistResult.value);
          appUiStore.setToast("模型定位已完成");
          return modelAssistResult.value;
        } catch (error) {
          if ((error == null ? void 0 : error.name) === "AbortError") {
            const stoppedLogs = [...modelAssistLogs.value, "已手动停止"];
            modelAssistLogs.value = stoppedLogs;
            modelAssistResult.value = {
              adapter: {
                id: ((_c = selectedModel.value) == null ? void 0 : _c.id) || "",
                name: ((_d = selectedModel.value) == null ? void 0 : _d.name) || "模型",
                type: ((_e = selectedModel.value) == null ? void 0 : _e.type) || ""
              },
              stopped: true,
              modelItems: [],
              targetFiles: [],
              logs: stoppedLogs
            };
            modelAssistError.value = "";
            appUiStore.setToast("已手动停止");
            return modelAssistResult.value;
          }
          modelAssistError.value = error.message || String(error);
          modelAssistLogs.value = ((_f = error.payload) == null ? void 0 : _f.logs) || modelAssistLogs.value;
          appUiStore.setToast("模型定位失败");
          return null;
        } finally {
          modelAssistFinishedAt.value = Date.now();
          modelAssistLoading.value = false;
          if (modelAssistController === controller) modelAssistController = null;
        }
      });
    }
    function runSelectionContextAssist() {
      return __async(this, arguments, function* (options = {}) {
        var _a2, _b, _c, _d, _e, _f;
        const selectionBindings = Array.isArray(options.selectionBindings) ? options.selectionBindings : [];
        const userInstruction = String(options.userInstruction || "").trim();
        if (!useModelAssist.value || !canUseModelAssist.value) return null;
        if (modelAssistLoading.value) return null;
        if (!selectionBindings.length) return null;
        const controller = new AbortController();
        modelAssistController = controller;
        modelAssistStartedAt.value = Date.now();
        modelAssistFinishedAt.value = 0;
        modelAssistLoading.value = true;
        modelAssistError.value = "";
        modelAssistLogs.value = ["选区上下文增强请求已发起"];
        modelAssistResult.value = null;
        try {
          const payload = searchPayload();
          const result = yield sourceServerNdjson("/api/model/selection-context/stream", {
            method: "POST",
            controller,
            body: {
              adapter: selectedModel.value,
              searchPayload: __spreadProps(__spreadValues({}, payload), {
                userPrompt: userInstruction || payload.userPrompt || ""
              }),
              pagePath: ((_a2 = routeResolverTrace.value) == null ? void 0 : _a2.pagePath) || "",
              routeResolver: routeResolverTrace.value,
              selectionBindings: selectionBindings.map((item) => {
                var _a3, _b2, _c2, _d2, _e2;
                return {
                  uid: item.uid,
                  designRequirement: ((_a3 = item.binding) == null ? void 0 : _a3.designRequirement) || "",
                  projectRoot: ((_b2 = item.binding) == null ? void 0 : _b2.projectRoot) || "",
                  targets: Array.isArray((_c2 = item.binding) == null ? void 0 : _c2.targets) ? item.binding.targets : [],
                  investigation: ((_d2 = item.binding) == null ? void 0 : _d2.investigation) || null,
                  originSelections: Array.isArray((_e2 = item.binding) == null ? void 0 : _e2.originSelections) ? item.binding.originSelections : []
                };
              }),
              candidateHits: candidateHits.value.slice(0, 4),
              selectedCandidateHits: candidateHits.value.filter((hit) => selectedCandidatePaths.value.includes(hit.file)).slice(0, 4)
            },
            timeoutMs: Number(selectedModel.value.timeoutMs || 12e4) * 3 + 5e3,
            timeoutMessage: "选区上下文增强超时",
            abortMessage: "选区上下文增强已停止",
            onEvent(event) {
              if (event.type === "log" && event.log) {
                modelAssistLogs.value = [...modelAssistLogs.value, event.log];
              }
              if (event.type === "result") {
                modelAssistResult.value = event.result || null;
              }
              if (event.type === "error" && Array.isArray(event.logs)) {
                modelAssistLogs.value = event.logs;
              }
            }
          });
          modelAssistResult.value = result || modelAssistResult.value || null;
          modelAssistLogs.value = ((_b = modelAssistResult.value) == null ? void 0 : _b.logs) || [];
          mergeModelTargets(modelAssistResult.value);
          appUiStore.setToast("选区上下文增强已完成");
          return modelAssistResult.value;
        } catch (error) {
          if ((error == null ? void 0 : error.name) === "AbortError") {
            const stoppedLogs = [...modelAssistLogs.value, "已手动停止"];
            modelAssistLogs.value = stoppedLogs;
            modelAssistResult.value = {
              adapter: {
                id: ((_c = selectedModel.value) == null ? void 0 : _c.id) || "",
                name: ((_d = selectedModel.value) == null ? void 0 : _d.name) || "模型",
                type: ((_e = selectedModel.value) == null ? void 0 : _e.type) || ""
              },
              stopped: true,
              modelItems: [],
              targetFiles: [],
              logs: stoppedLogs
            };
            modelAssistError.value = "";
            appUiStore.setToast("已手动停止");
            return modelAssistResult.value;
          }
          modelAssistError.value = error.message || String(error);
          modelAssistLogs.value = ((_f = error.payload) == null ? void 0 : _f.logs) || modelAssistLogs.value;
          appUiStore.setToast("选区上下文增强失败");
          return null;
        } finally {
          modelAssistFinishedAt.value = Date.now();
          modelAssistLoading.value = false;
          if (modelAssistController === controller) modelAssistController = null;
        }
      });
    }
    function stopModelAssist() {
      if (!modelAssistLoading.value || !modelAssistController) return;
      modelAssistLogs.value = [...modelAssistLogs.value, "正在停止模型定位..."];
      modelAssistController.abort();
    }
    void hydratePersistedModels();
    return {
      modelConfigs,
      selectedModelId,
      selectedModel,
      useModelAssist,
      canUseModelAssist,
      modelEditorOpen,
      modelForm,
      modelAssistLoading,
      modelAssistError,
      modelAssistLogs,
      modelAssistResult,
      modelAssistStartedAt,
      modelAssistFinishedAt,
      openModelEditor,
      openProviderModelEditor,
      closeModelEditor,
      saveModelForm,
      removeSelectedModel,
      setSelectedModel,
      selectModelAndEnable,
      disableModelAssist,
      setUseModelAssist,
      resetModelAssist,
      runModelAssist,
      runSelectionContextAssist,
      stopModelAssist
    };
  }
  function setupModelRuntime() {
    return useModelAdapters();
  }
  function useChatMessages() {
    const composerStore = useComposerStore();
    const modelStore = useModelStore();
    const projectStore = useProjectStore();
    const searchStore = useSearchStore();
    const selectionStore = useSelectionStore();
    const connectAgentStore = useConnectAgentStore();
    const prompt = useSearchPrompt();
    const { finalPrompt: promptText } = storeToRefs(composerStore);
    const {
      error: modelAssistError,
      logs: modelAssistLogs,
      result: modelAssistResult,
      startedAt: modelAssistStartedAt,
      finishedAt: modelAssistFinishedAt
    } = storeToRefs(modelStore);
    const {
      current: project,
      serviceStatus: sourceServiceStatus,
      serviceMessage: sourceServiceMessage
    } = storeToRefs(projectStore);
    const {
      candidates: candidateHits,
      candidateLoading,
      searchRunning,
      includeApiEvidence,
      needsMoreEvidence,
      startedAt: searchStartedAt,
      finishedAt: searchFinishedAt
    } = storeToRefs(searchStore);
    const {
      processLogs: searchProcessLogs,
      agentUsed: searchAgentUsed
    } = storeToRefs(searchStore);
    const {
      confirmed: selectionConfirmed,
      evidenceMessages,
      filesConfirmed
    } = storeToRefs(selectionStore);
    const selectedItems = computed(() => selectionStore.items.map((item) => ({
      uid: item.uid,
      element: null,
      info: item.element || {},
      assetElement: null,
      assetInfo: item.asset || item.element || {},
      thumbnailUrl: item.thumbnailUrl || ""
    })));
    const modelAssistLoading = computed(() => modelStore.status === "running");
    const { selectionChatSummary, searchLogLines } = prompt;
    const sourceServiceText = computed(() => {
      if (sourceServiceStatus.value === "loading") return sourceServiceMessage.value || "正在连接本地源码服务...";
      if (sourceServiceStatus.value === "connected") return "已连接本地源码服务，可读取真实源码路径";
      if (sourceServiceStatus.value === "fallback") return "本地源码服务不可用，已退回浏览器目录选择";
      return "本地源码服务用于选择源码路径和扫描文件";
    });
    const chatMessages = computed(() => {
      var _a2, _b;
      const messages = [];
      const finish = () => chronologicalMessages(messages, {
        selectionCreatedAt: latestSelectionTimestamp(selectionStore.items),
        searchStartedAt: Number((searchStartedAt == null ? void 0 : searchStartedAt.value) || 0),
        searchFinishedAt: Number((searchFinishedAt == null ? void 0 : searchFinishedAt.value) || 0),
        modelStartedAt: Number((modelAssistStartedAt == null ? void 0 : modelAssistStartedAt.value) || 0),
        modelFinishedAt: Number((modelAssistFinishedAt == null ? void 0 : modelAssistFinishedAt.value) || 0)
      });
      if (!project.value) {
        messages.push({
          id: "need-project",
          role: "system",
          title: "请选择项目源码",
          text: "项目源码是必须信息。选择后才能把页面选区映射到候选文件。",
          action: "choose-project"
        });
        if (sourceServiceText.value) {
          messages.push({
            id: "source-status",
            role: "system",
            text: sourceServiceText.value
          });
        }
        return finish();
      }
      const activeAgent = connectAgentStore.activeProvider;
      const currentTask = connectAgentStore.task;
      const projectThreadId = (currentTask == null ? void 0 : currentTask.threadId) || (activeAgent == null ? void 0 : activeAgent.projectThreadId) || "";
      const agentBound = !!(activeAgent == null ? void 0 : activeAgent.connected) && (!activeAgent.requiresThreadBinding || !!activeAgent.projectThreadId);
      const projectMessage = {
        id: "project-ready",
        role: "system",
        title: "项目已连接",
        text: [
          `${project.value.name} · ${project.value.fileCount} 个文件 · ${project.value.stackText || "未识别技术栈"}`,
          project.value.path ? `源码目录：${project.value.path}` : "",
          activeAgent ? agentBound ? `开发 Agent：${activeAgent.name}${activeAgent.version ? ` · ${activeAgent.version}` : ""}` : `开发 Agent：${activeAgent.name} 已连接，尚未绑定任务` : connectAgentStore.loading ? "开发 Agent：正在检查" : "开发 Agent：未关联",
          agentBound ? `项目 Thread：${projectThreadId || "首次任务时建立"}` : "",
          agentBound ? modelStore.selectedModel ? `Locator：${modelStore.selectedModel.name}` : "Locator：由开发 Agent 处理" : ""
        ].filter(Boolean).join("\n"),
        action: agentBound ? "agent-settings" : "connect-agent"
      };
      messages.push(projectMessage);
      messages.push(...connectAgentTimelineMessages({
        records: connectAgentStore.timeline,
        currentTask,
        taskStatus: connectAgentStore.taskStatus,
        currentLogs: connectAgentStore.taskLogs,
        taskStartedAt: connectAgentStore.taskStartedAt,
        taskFinishedAt: connectAgentStore.taskFinishedAt,
        agentName: (activeAgent == null ? void 0 : activeAgent.name) || "开发 Agent"
      }));
      if (connectAgentStore.loading && !connectAgentStore.activeProvider) {
        return finish();
      }
      if (!((_a2 = connectAgentStore.activeProvider) == null ? void 0 : _a2.connected) || connectAgentStore.activeProvider.requiresThreadBinding && !connectAgentStore.activeProvider.projectThreadId) {
        return finish();
      }
      if (!selectedItems.value.length) {
        messages.push({
          id: "need-selection",
          role: "system",
          title: "等待页面选区",
          text: "移动鼠标高亮页面区域，按空格键添加选区。选区会保存下来，可在输入框里用 @选区1 引用并描述修改要求。"
        });
        return finish();
      }
      messages.push({
        id: "selection-context",
        role: "system",
        title: "已捕获选区",
        text: [
          selectionChatSummary(),
          ...selectionStore.items.map((item, index) => {
            var _a3, _b2;
            const meaning = (_b2 = (_a3 = item.sourceBinding) == null ? void 0 : _a3.agentContext) == null ? void 0 : _b2.meaning;
            return meaning ? `@选区${index + 1}：${meaning}` : "";
          }).filter(Boolean)
        ].filter(Boolean).join("\n")
      });
      if (selectionConfirmed.value) {
        messages.push({
          id: "selection-confirmed",
          role: "user",
          text: "选区已确认"
        });
      }
      for (const [index, text] of evidenceMessages.value.entries()) {
        messages.push({
          id: `custom-evidence-${index}`,
          role: "user",
          text
        });
      }
      if (searchRunning == null ? void 0 : searchRunning.value) {
        messages.push({
          id: "searching",
          role: searchAgentUsed.value ? "agent" : "system",
          title: searchAgentUsed.value ? "DOM 源码定位 Agent" : "源码检索",
          text: searchAgentUsed.value ? "正在让模型生成检索计划，并由本地执行候选检索和源码事实对照。" : includeApiEvidence.value ? "正在基于选区和接口端点追踪候选文件。" : "正在基于选区文案、className 和页面路径检索候选文件。",
          logs: searchProcessLogs.value || [],
          durationStartedAt: (searchStartedAt == null ? void 0 : searchStartedAt.value) || 0,
          durationFinishedAt: (searchFinishedAt == null ? void 0 : searchFinishedAt.value) || 0,
          durationActive: true,
          logExpanded: true
        });
      } else if (((searchFinishedAt == null ? void 0 : searchFinishedAt.value) || 0) > 0) {
        messages.push({
          id: "search-log",
          role: searchAgentUsed.value ? "agent" : "system",
          title: searchAgentUsed.value ? "DOM 源码定位 Agent" : "源码检索",
          text: candidateHits.value.length ? `找到 ${candidateHits.value.length} 个候选文件。` : "未命中候选文件。",
          logs: [
            ...searchProcessLogs.value || [],
            ...searchLogLines()
          ],
          durationStartedAt: (searchStartedAt == null ? void 0 : searchStartedAt.value) || 0,
          durationFinishedAt: (searchFinishedAt == null ? void 0 : searchFinishedAt.value) || 0,
          durationActive: false,
          logExpanded: false
        });
      }
      if (modelAssistLoading == null ? void 0 : modelAssistLoading.value) {
        messages.push({
          id: "model-locating",
          role: "agent",
          title: "模型定位",
          text: "正在让模型阅读本地预检索结果和候选文件内容，进一步判断应修改的源码文件。",
          logs: (modelAssistLogs == null ? void 0 : modelAssistLogs.value) || [],
          durationStartedAt: (modelAssistStartedAt == null ? void 0 : modelAssistStartedAt.value) || 0,
          durationFinishedAt: (modelAssistFinishedAt == null ? void 0 : modelAssistFinishedAt.value) || 0,
          durationActive: true,
          logExpanded: true
        });
      } else if (modelAssistResult == null ? void 0 : modelAssistResult.value) {
        const result = modelAssistResult.value;
        const targets = result.modelItems || result.targetFiles || [];
        const targetLogs = targets.slice(0, 5).flatMap((item, index) => {
          const locateLevel = item.locateLevel || item.modelLocateLevel || "exact";
          const fileOnly = !!(item.fileOnly || item.modelFileOnly || locateLevel === "file");
          const selectionFallback = !!(item.selectionFallback || item.modelSelectionFallback || item.snippetSource === "selection-fallback" || item.modelSnippetSource === "selection-fallback");
          const snippetVerified = item.snippetVerified !== false && item.modelSnippetVerified !== false;
          return [
            `模型返回 ${index + 1}: ${item.path || item.file}${item.confidence ? ` · ${item.confidence}%` : ""}${item.exists === false ? " · 文件不存在" : ""}`,
            fileOnly ? "定位结果: 文件命中" : selectionFallback ? "定位层级: direction；源码不足，使用选区兜底" : `定位层级: ${locateLevel}${item.downgradedToDirection || item.modelDowngradedToDirection ? "；片段未逐字验证，已降级为源码方向" : ""}`,
            item.codeSnippet ? `${selectionFallback ? "选区兜底" : snippetVerified ? "code片段" : "源码方向片段"}: ${item.codeSnippet}` : "",
            item.directionGuess ? `推测方向: ${item.directionGuess}` : "",
            item.prompt ? `提示词: ${item.prompt}` : item.reason || "-"
          ].filter(Boolean);
        });
        messages.push({
          id: "model-result",
          role: "agent",
          title: `模型定位 · ${((_b = result.adapter) == null ? void 0 : _b.name) || "模型"}`,
          text: result.stopped ? "模型定位已手动停止。" : targets.length ? "模型已定位到修改点，可继续生成最终提示词。" : "模型未定位到可用修改点。",
          logs: [
            ...result.logs || [],
            ...targetLogs,
            !targetLogs.length && result.rawText ? `模型原始返回:
${result.rawText}` : ""
          ].filter(Boolean),
          durationStartedAt: (modelAssistStartedAt == null ? void 0 : modelAssistStartedAt.value) || 0,
          durationFinishedAt: (modelAssistFinishedAt == null ? void 0 : modelAssistFinishedAt.value) || 0,
          durationActive: false,
          logExpanded: true
        });
      } else if (modelAssistError == null ? void 0 : modelAssistError.value) {
        messages.push({
          id: "model-error",
          role: "agent",
          title: "模型定位失败",
          text: modelAssistError.value,
          logs: (modelAssistLogs == null ? void 0 : modelAssistLogs.value) || [],
          durationStartedAt: (modelAssistStartedAt == null ? void 0 : modelAssistStartedAt.value) || 0,
          durationFinishedAt: (modelAssistFinishedAt == null ? void 0 : modelAssistFinishedAt.value) || 0,
          durationActive: false,
          logExpanded: true
        });
      }
      const locatorFeedbackVisible = connectAgentStore.taskStatus === "idle";
      if (!candidateLoading.value && needsMoreEvidence.value && locatorFeedbackVisible) {
        messages.push({
          id: "need-more-evidence",
          role: "system",
          title: "线索不足，需要补充页面证据",
          text: [
            "当前选区检索到了多个候选文件，系统已基于当前选区自动向上扩区并继续检索。",
            "如果自动扩区后仍然失败，说明当前 DOM 链路还不能把候选收敛到唯一源码方向。"
          ].join("\n")
        });
      } else if (!candidateLoading.value && candidateHits.value.length > 1 && !filesConfirmed.value && locatorFeedbackVisible) {
        messages.push({
          id: "multi-candidates",
          role: "system",
          title: "存在多个命中文件，请确认",
          text: `默认选择最高命中：${candidateHits.value[0].file}`
        });
      } else if (!candidateLoading.value && candidateHits.value.length === 1 && !filesConfirmed.value && locatorFeedbackVisible) {
        messages.push({
          id: "single-candidate",
          role: "system",
          text: `本地检索命中 ${candidateHits.value[0].file}，等待模型定位确认。`
        });
      }
      if (filesConfirmed.value) {
        messages.push({
          id: "files-confirmed",
          role: "user",
          text: "确认文件"
        });
      }
      if (promptText.value) {
        messages.push({
          id: "final-prompt",
          role: "system",
          title: "最终提示词",
          pre: promptText.value,
          action: "copy-prompt"
        });
      }
      return finish();
    });
    return {
      sourceServiceText,
      chatMessages
    };
  }
  function connectAgentTimelineMessages({
    records,
    currentTask,
    taskStatus,
    currentLogs,
    taskStartedAt,
    taskFinishedAt,
    agentName
  }) {
    var _a2, _b, _c, _d, _e;
    const groups = /* @__PURE__ */ new Map();
    for (const record of Array.isArray(records) ? records : []) {
      const taskId = String((record == null ? void 0 : record.taskId) || (record == null ? void 0 : record.id) || "");
      if (!taskId) continue;
      if (!groups.has(taskId)) {
        groups.set(taskId, {
          taskId,
          request: null,
          events: [],
          result: null,
          firstAt: String((record == null ? void 0 : record.createdAt) || "")
        });
      }
      const group = groups.get(taskId);
      if (record.kind === "request") group.request = record;
      else if (record.kind === "result" || record.kind === "error") group.result = record;
      else if (record.text) group.events.push(record);
    }
    const messages = [];
    const entries = [...groups.values()].sort((left, right) => left.firstAt.localeCompare(right.firstAt));
    for (const group of entries) {
      if (group.request) {
        const pageUrl = String(((_b = (_a2 = group.request) == null ? void 0 : _a2.metadata) == null ? void 0 : _b.pageUrl) || "");
        messages.push({
          id: `connect-agent-user-${group.request.id}`,
          role: "user",
          text: [
            String(group.request.text || ""),
            pageUrl ? `页面：${pageUrl}` : ""
          ].filter(Boolean).join("\n"),
          createdAt: timestampOf(group.request.createdAt)
        });
      }
      const isCurrent = (currentTask == null ? void 0 : currentTask.taskId) === group.taskId;
      const running = isCurrent && taskStatus === "running";
      const result = group.result;
      const durationStartedAt = timestampOf((_c = group.request) == null ? void 0 : _c.createdAt) || timestampOf(group.firstAt) || (isCurrent ? Number(taskStartedAt || (currentTask == null ? void 0 : currentTask.startedAt) || 0) : 0);
      const durationFinishedAt = result ? timestampOf(result.createdAt) || Number(((_d = result == null ? void 0 : result.metadata) == null ? void 0 : _d.finishedAt) || 0) : isCurrent && taskStatus !== "running" ? Number(taskFinishedAt || (currentTask == null ? void 0 : currentTask.finishedAt) || 0) : 0;
      const changedFiles = Array.isArray((_e = result == null ? void 0 : result.metadata) == null ? void 0 : _e.changedFiles) ? result.metadata.changedFiles : isCurrent && Array.isArray(currentTask == null ? void 0 : currentTask.changedFiles) ? currentTask.changedFiles : [];
      const logs = uniqueLines([
        ...group.events.map((event) => String(event.text || "")),
        ...isCurrent ? currentLogs || [] : [],
        isCurrent && (currentTask == null ? void 0 : currentTask.threadId) ? `threadId: ${currentTask.threadId}` : (result == null ? void 0 : result.threadId) ? `threadId: ${result.threadId}` : "",
        isCurrent && (currentTask == null ? void 0 : currentTask.turnId) ? `turnId: ${currentTask.turnId}` : (result == null ? void 0 : result.turnId) ? `turnId: ${result.turnId}` : "",
        ...changedFiles.map((file) => `修改文件: ${file}`)
      ]);
      messages.push({
        id: `connect-agent-agent-${group.taskId}`,
        role: "agent",
        title: `${agentName} 开发任务`,
        text: running ? `${agentName} 正在项目中执行修改和验证。` : (result == null ? void 0 : result.kind) === "error" ? `${agentName} 开发任务失败。` : result ? `${agentName} 已完成项目修改。` : `${agentName} 开发任务未完成。`,
        pre: (result == null ? void 0 : result.text) || (!running && isCurrent ? (currentTask == null ? void 0 : currentTask.finalResponse) || "" : ""),
        logs,
        createdAt: running ? earliestTimestamp([
          ...group.events.map((event) => event.createdAt),
          durationStartedAt
        ]) || durationStartedAt : timestampOf(result == null ? void 0 : result.createdAt) || durationFinishedAt || durationStartedAt,
        durationStartedAt,
        durationFinishedAt,
        durationActive: running,
        logExpanded: running
      });
    }
    return messages;
  }
  function uniqueLines(lines) {
    return [...new Set(lines.map((line) => String(line || "").trim()).filter(Boolean))];
  }
  function timestampOf(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const timestamp = Date.parse(String(value || ""));
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  function latestSelectionTimestamp(items) {
    return Math.max(0, ...(Array.isArray(items) ? items : []).map((item) => {
      var _a2;
      return Number(
        (item == null ? void 0 : item.createdAt) || (item == null ? void 0 : item.capturedAt) || ((_a2 = item == null ? void 0 : item.sourceBinding) == null ? void 0 : _a2.resolvedAt) || 0
      );
    }));
  }
  function earliestTimestamp(values) {
    const timestamps = values.map(timestampOf).filter((timestamp) => timestamp > 0);
    return timestamps.length ? Math.min(...timestamps) : 0;
  }
  function chronologicalMessages(messages, context) {
    const explicitTimes = messages.map((message) => timestampOf(message.createdAt)).filter((timestamp) => timestamp > 0);
    const firstActivityAt = earliestTimestamp([
      context.selectionCreatedAt,
      context.searchStartedAt,
      context.modelStartedAt,
      ...explicitTimes
    ]) || Date.now();
    const lastLocatorAt = Math.max(
      context.searchFinishedAt,
      context.searchStartedAt,
      context.modelFinishedAt,
      context.modelStartedAt,
      context.selectionCreatedAt,
      firstActivityAt
    );
    return messages.map((message, index) => __spreadProps(__spreadValues({}, message), {
      createdAt: timestampOf(message.createdAt) || inferredMessageTimestamp(message.id, index, __spreadProps(__spreadValues({}, context), {
        firstActivityAt,
        lastLocatorAt
      })),
      __sequence: index
    })).sort((left, right) => {
      return left.createdAt - right.createdAt || left.__sequence - right.__sequence;
    }).map((_a2) => {
      var _b = _a2, { __sequence } = _b, message = __objRest(_b, ["__sequence"]);
      return message;
    });
  }
  function inferredMessageTimestamp(id, index, context) {
    if (id === "project-ready" || id === "need-project" || id === "source-status") {
      return context.firstActivityAt - 2 + index;
    }
    if (id === "need-selection") return context.firstActivityAt;
    if (id === "selection-context") {
      return context.selectionCreatedAt || context.firstActivityAt;
    }
    if (id === "selection-confirmed" || id.startsWith("custom-evidence-")) {
      return context.searchStartedAt > 0 ? context.searchStartedAt - 1 : (context.selectionCreatedAt || context.firstActivityAt) + 1;
    }
    if (id === "searching" || id === "search-log") {
      return context.searchStartedAt || context.searchFinishedAt || context.firstActivityAt;
    }
    if (id === "model-locating" || id === "model-result" || id === "model-error") {
      return context.modelStartedAt || context.modelFinishedAt || context.lastLocatorAt;
    }
    if (id === "need-more-evidence" || id === "multi-candidates" || id === "single-candidate") {
      return (context.searchFinishedAt || context.searchStartedAt || context.lastLocatorAt) + 1;
    }
    if (id === "files-confirmed" || id === "final-prompt") {
      return context.lastLocatorAt + 1;
    }
    return context.firstActivityAt + index;
  }
  function setupChatRuntime() {
    const chatStore = useChatStore();
    const message = useChatMessages();
    watch(message.chatMessages, (value) => {
      chatStore.setMessages(value || []);
    }, { immediate: true });
    return message;
  }
  function createGoCaptureRuntimeState(runtime) {
    var _a2;
    const { api, currentPageHref, sidePanelConfig, routePagePath, pageHost } = runtime;
    const composerStore = useComposerStore();
    const composer = createComposerFacade(composerStore);
    const requests = usePageRequests();
    useSidePanelUiPersistence(currentPageHref);
    let search = null;
    let bridge = null;
    let model = null;
    const source = useSourceProject({ currentPageHref });
    const selection = setupSelectionRuntime({
      sendCommand: (type, payload, options) => bridge == null ? void 0 : bridge.sendSidePanelCommand(type, payload, options),
      getProjectRoot: () => {
        var _a3;
        return ((_a3 = source.project.value) == null ? void 0 : _a3.path) || "";
      }
    });
    const route = useRouteResolver({
      project: source.project,
      currentPageHref,
      pageUrlPath: routePagePath,
      sourceServerJson
    });
    search = useSearchFacade();
    bridge = useSidePanelBridge({
      sidePanelConfig,
      currentPageHref,
      onRuntimeEvent: (_a2 = api.bootstrap) == null ? void 0 : _a2.handleRuntimeEvent,
      onCommandResult: (message2) => {
        var _a3;
        const payload = (message2 == null ? void 0 : message2.payload) || {};
        if (!(payload == null ? void 0 : payload.reason) && !(payload == null ? void 0 : payload.uid)) return;
        const status = (message2 == null ? void 0 : message2.ok) ? "成功" : "失败";
        const detail = payload.reason ? `；原因=${payload.reason}` : "";
        const target = payload.tag ? `；目标=${payload.tag}${payload.className ? `.${String(payload.className).replace(/\s+/g, ".")}` : ""}` : "";
        const debug = [
          payload.requestedPageBindingId ? `请求绑定=${payload.requestedPageBindingId}` : "",
          payload.runtimePageBindingId ? `运行时绑定=${payload.runtimePageBindingId}` : "",
          payload.commandPageSessionId ? `命令session=${payload.commandPageSessionId}` : "",
          payload.runtimePageSessionId ? `运行时session=${payload.runtimePageSessionId}` : "",
          payload.targetRuntimeId ? `目标runtime=${payload.targetRuntimeId}` : "",
          payload.runtimeId ? `运行时runtime=${payload.runtimeId}` : "",
          payload.pageUrl ? `页面=${payload.pageUrl}` : "",
          typeof payload.selectionCount === "number" ? `运行时选区数=${payload.selectionCount}` : "",
          Array.isArray(payload.knownSelectionIds) ? `运行时已知选区=${payload.knownSelectionIds.join(",") || "-"}` : ""
        ].filter(Boolean).join("；");
        (_a3 = search.appendProcessLog) == null ? void 0 : _a3.call(search, `页面命令回执：${status}${detail}${target}${debug ? `；${debug}` : ""}`);
      },
      onNetworkRequest: (payload) => {
        requests.rememberRequest(normalizeRequestInfo(payload || {}, currentPageHref.value));
      },
      scheduleRouteResolve: route.scheduleRouteResolve,
      startPickerOnConnect: api.sidePanel !== false
    });
    const prompt = setupPromptRuntime();
    model = setupModelRuntime();
    const message = setupChatRuntime();
    return {
      api,
      currentPageHref,
      requests,
      source,
      route,
      search,
      selection,
      composer,
      bridge,
      prompt,
      model,
      message
    };
  }
  function sourceTargetsFromCandidates(candidates) {
    return (Array.isArray(candidates) ? candidates : []).filter((hit) => hit == null ? void 0 : hit.file).map((hit) => {
      var _a2, _b;
      return {
        file: String(hit.file),
        role: String(hit.role || hit.sourceRole || "related"),
        line: Number(hit.line || 0),
        anchor: String(hit.anchor || ""),
        targetSnippet: String(hit.targetSnippet || ""),
        // unlocated：本地未能把选区定位到具体源码，绝不用漂移的粗片段（会误导 LLM 到别的列）——
        // 留空，让变更计划 LLM 依据原始选区身份 + 完整文件自己定位。
        codeSnippet: hit.scopeAlignment === "unlocated" ? "" : String(
          hit.modelCodeSnippet || hit.preciseSnippet || hit.uniqueSnippet || hit.snippet || ""
        ),
        importChain: Array.isArray(hit.importChain) ? hit.importChain.map(String) : [],
        directionGuess: String(hit.modelDirectionGuess || ""),
        locateLevel: String(hit.modelLocateLevel || "exact"),
        scopeAlignment: String(hit.scopeAlignment || ((_b = (_a2 = hit.composite) == null ? void 0 : _a2.render) == null ? void 0 : _b.scopeAlignment) || ""),
        reasons: Array.isArray(hit.reasons) ? hit.reasons.map(String).slice(0, 8) : []
      };
    });
  }
  function candidateHitsFromBindings(bindings) {
    const targets = dedupeBoundTargets(bindings.flatMap((item) => {
      return item.binding.targets.map((target) => __spreadProps(__spreadValues({}, target), {
        designRequirement: item.binding.designRequirement
      }));
    }));
    return targets.map((target, index) => ({
      file: target.file,
      score: 1200 - index * 20,
      stage: "selection-context",
      reasons: [
        "复用当前选区已确认的源码上下文",
        ...target.reasons || []
      ],
      snippet: target.codeSnippet || "",
      modelCodeSnippet: target.codeSnippet || "",
      modelDirectionGuess: target.directionGuess || "",
      role: target.role || "related",
      modelLocateLevel: target.locateLevel || "exact",
      scopeAlignment: target.scopeAlignment || "",
      modelSnippetVerified: true,
      importChain: target.importChain || [],
      selectionDesignRequirement: target.designRequirement || ""
    }));
  }
  function dedupeBoundTargets(targets) {
    var _a2;
    const byFile = /* @__PURE__ */ new Map();
    for (const target of targets) {
      if (!(target == null ? void 0 : target.file)) continue;
      const old = byFile.get(target.file);
      if (!old) {
        byFile.set(target.file, target);
        continue;
      }
      byFile.set(target.file, __spreadProps(__spreadValues({}, old), {
        codeSnippet: old.codeSnippet || target.codeSnippet || "",
        line: old.line || target.line || 0,
        anchor: old.anchor || target.anchor || "",
        targetSnippet: old.targetSnippet || target.targetSnippet || "",
        importChain: ((_a2 = old.importChain) == null ? void 0 : _a2.length) ? old.importChain : target.importChain || [],
        directionGuess: old.directionGuess || target.directionGuess || "",
        reasons: Array.from(/* @__PURE__ */ new Set([...old.reasons || [], ...target.reasons || []]))
      }));
    }
    return Array.from(byFile.values());
  }
  const MAX_AUTO_EXPAND_ATTEMPTS = 5;
  function createComposerWorkflow(state) {
    const { source, route, search, selection, composer, model, prompt } = state;
    const appUiStore = useAppUiStore();
    const connectAgentStore = useConnectAgentStore();
    let lastOriginSelections = [];
    function ancestorContainerAnchors(el) {
      const out = [];
      for (const ancestor of Array.isArray(el == null ? void 0 : el.ancestors) ? el.ancestors.slice(0, 5) : []) {
        for (const [key, rawValue] of Object.entries((ancestor == null ? void 0 : ancestor.attrs) || {})) {
          const k = String(key || "").toLowerCase();
          if (!/^data-/.test(k) && k !== "id" && k !== "name" || /^data-v-/.test(k)) continue;
          const value = String(rawValue || "").trim();
          if (/^[A-Za-z][\w-]{1,39}$/.test(value) && !/^__.*__$/.test(value) && !/^\d+$/.test(value)) {
            out.push(`${key}=${value}`);
          }
        }
        for (const cls of String((ancestor == null ? void 0 : ancestor.className) || "").split(/\s+/)) {
          const t = cls.trim();
          if (t && !/^(n-|el-|ivu-|ant-|van-|flex|grid|is-|has-|mt-|mb-|ml-|mr-|w-|h-|p-|m-)/.test(t)) out.push(t);
        }
      }
      return Array.from(new Set(out)).slice(0, 6);
    }
    function captureOriginSelections(instruction) {
      var _a2, _b;
      try {
        const assets = ((_a2 = prompt.referencedPromptAssets) == null ? void 0 : _a2.call(prompt, instruction)) || [];
        const items = ((_b = selection.selectedItems) == null ? void 0 : _b.value) || [];
        const itemsById = new Map(items.map((item) => [item.uid, item]));
        return assets.map((asset) => {
          var _a3;
          return {
            token: asset.token,
            tag: asset.tag,
            text: asset.text,
            className: asset.className,
            attrs: asset.attrs,
            ancestors: asset.ancestors,
            container: ancestorContainerAnchors((_a3 = itemsById.get(asset.uid)) == null ? void 0 : _a3.element),
            summary: asset.summary
          };
        });
      } catch (e) {
        return [];
      }
    }
    function sendComposer() {
      return __async(this, null, function* () {
        var _a2;
        if (connectAgentStore.taskRunning) {
          connectAgentStore.cancelTask();
          return;
        }
        if (model.modelAssistLoading.value) {
          model.stopModelAssist();
          return;
        }
        if (!source.project.value) return;
        const instruction = composer.promptIntent.value.trim();
        if (!instruction) return;
        if (!((_a2 = connectAgentStore.activeProvider) == null ? void 0 : _a2.connected)) {
          appUiStore.setToast("请先关联 Codex 开发 Agent");
          return;
        }
        if (yield reuseSelectionSourceContext(instruction)) return;
        if (search.showCandidatePicker.value) {
          yield runModelAssistForCandidates(instruction);
          return;
        }
        if (!selection.confirmSelectionContext(composer.invalidatePrompt)) return;
        if (!model.selectedModel.value) {
          yield runConnectedAgentFromLocalEvidence(instruction);
          return;
        }
        yield searchCandidateFiles();
      });
    }
    function runConnectedAgentFromLocalEvidence(instruction) {
      return __async(this, null, function* () {
        var _a2;
        lastOriginSelections = captureOriginSelections(instruction);
        (_a2 = search.clearCandidateState) == null ? void 0 : _a2.call(search);
        search.processLogs.value = [
          `Locator 专用模型未配置：跳过 ${PRODUCT_NAME} Locator Agent`,
          "先整理路由、压缩 DOM 和已捕获页面事实，再交给关联 Agent"
        ];
        search.searchStartedAt.value = Date.now();
        search.searchFinishedAt.value = 0;
        connectAgentStore.resetTask();
        yield runConnectedAgent(instruction, [], {
          searchPayload: prompt.searchPayload()
        });
        search.searchFinishedAt.value = Date.now();
      });
    }
    function searchCandidateFiles() {
      return __async(this, null, function* () {
        var _a2, _b, _c, _d, _e;
        search.candidateLoading.value = true;
        search.candidateError.value = "";
        search.serverNeedsMoreEvidence.value = false;
        search.modelAssistAttempted.value = false;
        model.resetModelAssist();
        selection.filesConfirmed.value = false;
        try {
          if (!route.sameRouteTracePage(route.routeResolverTrace.value)) {
            yield route.resolveCurrentPageRoute();
          }
          search.searchRunning.value = true;
          search.searchStartedAt.value = Date.now();
          search.searchFinishedAt.value = 0;
          search.processLogs.value = [];
          search.agentUsed.value = false;
          connectAgentStore.resetTask();
          const timeoutMs = search.includeApiEvidence.value ? 3e4 : 12e3;
          const data = yield runSearchWithOptionalRetry(timeoutMs);
          search.candidateHits.value = Array.isArray(data.hits) ? data.hits : [];
          search.compositeResult.value = data.composite || null;
          route.applyRouteResolverTrace(data.routeResolver || null);
          search.apiTrace.value = data.apiTrace || null;
          search.i18nTrace.value = data.i18nTrace || null;
          search.definitionTrace.value = data.definitionTrace || null;
          search.serverNeedsMoreEvidence.value = !!(data.needsMoreEvidence || data.needMoreDom || ((_a2 = data.agent) == null ? void 0 : _a2.needMoreDom));
          if (!search.candidateHits.value.length) {
            search.selectedCandidatePaths.value = [];
            if (search.serverNeedsMoreEvidence.value) {
              search.candidateError.value = "自动扩区后仍证据不足，未能定位源码。";
            } else {
              search.candidateError.value = "未找到候选文件。可以继续补充选区，或在输入框里补充更具体的修改要求后重试。";
            }
          } else {
            search.selectedCandidatePaths.value = [search.candidateHits.value[0].file];
            search.expandedCandidatePath.value = "";
            appUiStore.setToast(`找到 ${search.candidateHits.value.length} 个候选文件`);
          }
          if (((_b = data.agent) == null ? void 0 : _b.enabled) && search.candidateHits.value.length) {
            const instruction = composer.promptIntent.value.trim();
            const resolvedComposite = ((_c = data.agent) == null ? void 0 : _c.status) === "resolved" && !!((_d = data.composite) == null ? void 0 : _d.render);
            if (resolvedComposite) {
              search.selectedCandidatePaths.value = search.candidateHits.value.map((hit) => hit.file);
              selection.filesConfirmed.value = true;
              bindResolvedSelectionContext(instruction, data);
              yield runChangePlanForResolved(instruction);
            }
            return search.candidateHits.value;
          }
          if (shouldAutoRunModelAssist(search.candidateHits.value)) {
            const modelHandled = yield runModelAssistForCandidates(composer.promptIntent.value.trim());
            if (modelHandled) return ((_e = model.modelAssistResult.value) == null ? void 0 : _e.stopped) ? [] : search.candidateHits.value;
          }
          return search.candidateHits.value;
        } catch (error) {
          search.selectedCandidatePaths.value = [];
          search.candidateError.value = `${error.message || error}。`;
          return [];
        } finally {
          search.candidateLoading.value = false;
        }
      });
    }
    function originAnchorsFromSelection(instruction) {
      var _a2;
      const items = ((_a2 = selection.selectedItems) == null ? void 0 : _a2.value) || [];
      const [uid2 = ""] = selection.referencedSelectionIds(instruction);
      const selected = items.find((item) => item.uid === uid2);
      const el = (selected == null ? void 0 : selected.element) || (selected == null ? void 0 : selected.info) || {};
      const anchors = [];
      const markup = String(el.rawOuterHtml || el.outerHtml || "");
      for (const match of markup.matchAll(/\bdata-(?!v-)[\w-]+="([^"]{2,})"/g)) {
        const value = String(match[1] || "").trim();
        if (value && !/^__.*__$/.test(value) && !/^[\d.]+$/.test(value)) anchors.push(value);
      }
      for (const word of String(el.text || "").split(/\s+/)) {
        const token = word.trim();
        if (token.length >= 2 && token.length <= 12 && !/^[¥$]?[\d.,:：/%\-]+$/.test(token) && !/^ID[:：]/i.test(token)) anchors.push(token);
      }
      for (const cls of String(el.className || "").split(/\s+/)) {
        const token = cls.trim();
        if (token && !/^(n-|el-|ivu-|ant-|van-|flex|grid|is-|has-|mt-|mb-|ml-|mr-|w-|h-|p-|m-)/.test(token)) anchors.push(token);
      }
      return Array.from(new Set(anchors)).slice(0, 6);
    }
    function runSearchWithOptionalRetry(timeoutMs) {
      return __async(this, null, function* () {
        var _a2;
        try {
          const focusAnchors = originAnchorsFromSelection(composer.promptIntent.value);
          lastOriginSelections = captureOriginSelections(composer.promptIntent.value);
          let firstPass = yield runSearchRequest(prompt.searchPayload(), timeoutMs, "第 1 轮：原始选区检索");
          for (let attempt = 1; attempt <= MAX_AUTO_EXPAND_ATTEMPTS && shouldAutoExpandSearch(firstPass); attempt += 1) {
            const expanded = yield expandReferencedSelectionForMoreEvidence(
              attempt,
              composer.promptIntent.value
            );
            if (!expanded) break;
            const retryState = buildAgentRetryState(firstPass, attempt);
            if (focusAnchors.length) retryState.focusAnchors = focusAnchors;
            firstPass = yield runSearchRequest(prompt.searchPayload({
              agentState: retryState
            }), timeoutMs, `第 ${attempt + 1} 轮：自动扩区后继续检索`);
          }
          const firstHits = Array.isArray(firstPass == null ? void 0 : firstPass.hits) ? firstPass.hits : [];
          if ((_a2 = firstPass == null ? void 0 : firstPass.agent) == null ? void 0 : _a2.enabled) return firstPass;
          if (!shouldRetryExpandedSearch(firstHits)) return firstPass;
          const secondPass = yield runSearchRequest(prompt.searchPayload({ expandedRetry: true }), timeoutMs, "扩展上下文兜底检索");
          const secondHits = Array.isArray(secondPass == null ? void 0 : secondPass.hits) ? secondPass.hits : [];
          return isBetterSearchResult(secondHits, firstHits) ? secondPass : firstPass;
        } finally {
          search.searchFinishedAt.value = Date.now();
          search.searchRunning.value = false;
        }
      });
    }
    function runChangePlanForResolved(instruction) {
      return __async(this, null, function* () {
        var _a2;
        const bindings = selection.reusableSourceBindings(instruction, projectRoot());
        if (!bindings.length) {
          prompt.generatePrompt({ userInstruction: instruction });
          return;
        }
        if (yield runConnectedAgent(instruction, bindings)) return;
        if (!model.useModelAssist.value || !model.canUseModelAssist.value) {
          prompt.generatePrompt({ userInstruction: instruction });
          return;
        }
        search.modelAssistAttempted.value = true;
        const modelResult = yield model.runSelectionContextAssist({ userInstruction: instruction, selectionBindings: bindings });
        if (modelResult == null ? void 0 : modelResult.stopped) return;
        search.changePlanResult.value = (modelResult == null ? void 0 : modelResult.changePlan) || ((_a2 = search.candidateHits.value[0]) == null ? void 0 : _a2.modelChangePlan) || null;
        prompt.generatePrompt({ userInstruction: instruction });
      });
    }
    function runSearchRequest(body, timeoutMs, label = "") {
      return __async(this, null, function* () {
        var _a2;
        if (label) search.appendProcessLog(`检索请求开始：${label}`);
        return yield sourceServerNdjson("/api/search/stream", {
          method: "POST",
          body: __spreadProps(__spreadValues({}, body), {
            projectRoot: projectRoot(),
            adapter: model.selectedModel.value || null
          }),
          timeoutMs: Math.max(timeoutMs, Number(((_a2 = model.selectedModel.value) == null ? void 0 : _a2.timeoutMs) || 12e4) * 2 + 5e3),
          timeoutMessage: search.includeApiEvidence.value ? "源码检索超时，请确认项目源码目录是否选错，或减少捕获接口/补充关键词后重试" : "源码检索超时，请确认项目源码目录是否选错，或补充关键词后重试",
          onEvent(event) {
            if (event.type === "log" && event.log) {
              search.appendProcessLog(event.log);
              if (String(event.log).startsWith("DOM Agent 触发判断：启用")) {
                search.agentUsed.value = true;
              }
            }
          }
        });
      });
    }
    function runModelAssistForCandidates(userInstruction) {
      return __async(this, null, function* () {
        if (!search.candidateHits.value.length) return false;
        search.modelAssistAttempted.value = true;
        if (!model.useModelAssist.value || !model.canUseModelAssist.value) {
          const text = modelAssistUnavailableText();
          search.candidateError.value = text;
          appUiStore.setToast(text);
          return true;
        }
        const modelResult = yield model.runModelAssist();
        if (modelResult == null ? void 0 : modelResult.stopped) return true;
        if (hasUsableModelResult(modelResult)) {
          selection.filesConfirmed.value = true;
          bindResolvedSelectionContext(userInstruction);
          prompt.generatePrompt({ userInstruction });
          return true;
        }
        return false;
      });
    }
    function expandReferencedSelectionForMoreEvidence(attempt, instruction) {
      return __async(this, null, function* () {
        var _a2, _b, _c, _d;
        ((_a2 = selection.selectedItems) == null ? void 0 : _a2.value) || [];
        const [uid2 = ""] = selection.referencedSelectionIds(instruction);
        const before = selectionSnapshotById(uid2);
        if (!uid2 || typeof selection.expandSelection !== "function") return false;
        (_b = search.appendProcessLog) == null ? void 0 : _b.call(search, `证据不足：自动扩大当前选区 ${uid2}（第 ${attempt} 次）`);
        yield selection.expandSelection(uid2);
        const changed = yield waitForSelectionSnapshotChange(before);
        if (changed) {
          (_c = search.appendProcessLog) == null ? void 0 : _c.call(search, "自动扩区完成：选区对象已更新，继续检索");
          appUiStore.setToast("已自动扩大当前选区并继续检索");
          return true;
        }
        (_d = search.appendProcessLog) == null ? void 0 : _d.call(search, "自动扩区停止：未检测到选区变化");
        return false;
      });
    }
    function selectionSnapshotById(uid2) {
      var _a2;
      const items = ((_a2 = selection.selectedItems) == null ? void 0 : _a2.value) || [];
      return latestSelectionSnapshotFromItems(items.filter((item) => item.uid === uid2));
    }
    function waitForSelectionSnapshotChange(before) {
      return __async(this, null, function* () {
        const startedAt = Date.now();
        while (Date.now() - startedAt < 1500) {
          yield sleep$1(80);
          const current = selectionSnapshotById(before.uid);
          if (current.uid && current.uid === before.uid && current.signature && current.signature !== before.signature) {
            return true;
          }
        }
        return false;
      });
    }
    function modelAssistUnavailableText() {
      if (!model.selectedModel.value) return "模型定位未启用：请先在输入框模型菜单里选择或配置模型。";
      if (!source.project.value || source.project.value.source !== "source-server") {
        return "模型定位不可用：请通过本地源码服务重新关联项目，模型需要读取真实源码文件。";
      }
      return "模型定位不可用：请检查模型配置。";
    }
    function projectRoot() {
      var _a2, _b;
      return String(((_a2 = source.project.value) == null ? void 0 : _a2.path) || ((_b = source.project.value) == null ? void 0 : _b.root) || "").trim();
    }
    function bindResolvedSelectionContext(userInstruction, searchResult = null) {
      const ids = selection.referencedSelectionIds(userInstruction);
      if (ids.length !== 1) return;
      const selected = search.selectedCandidateHits.value.length ? search.selectedCandidateHits.value : search.candidateHits.value.slice(0, 1);
      const targets = sourceTargetsFromCandidates(selected);
      const root = projectRoot();
      if (!root || !targets.length) return;
      selection.bindSourceContext(ids, {
        projectRoot: root,
        designRequirement: userInstruction,
        targets,
        investigation: sourceInvestigationFromResult(searchResult),
        originSelections: lastOriginSelections,
        resolvedAt: Date.now()
      });
      search.appendProcessLog(`选区源码上下文已绑定：${ids[0]} -> ${targets.map((target) => target.file).join("、")}`);
    }
    function sourceInvestigationFromResult(result) {
      var _a2;
      const locator = ((_a2 = result == null ? void 0 : result.agent) == null ? void 0 : _a2.locator) || (result == null ? void 0 : result.agent) || null;
      if (!locator || locator.status !== "resolved") return null;
      return {
        status: "resolved",
        reason: String(locator.reason || ""),
        coveredDom: Array.isArray(locator.coveredDom) ? locator.coveredDom.map(String) : [],
        missingEvidence: Array.isArray(locator.missingEvidence) ? locator.missingEvidence.map(String) : [],
        relations: (Array.isArray(locator.relations) ? locator.relations : []).map((relation) => ({
          from: String((relation == null ? void 0 : relation.from) || ""),
          to: String((relation == null ? void 0 : relation.to) || ""),
          type: String((relation == null ? void 0 : relation.type) || "related"),
          evidence: String((relation == null ? void 0 : relation.evidence) || "")
        })).filter((relation) => relation.from && relation.to)
      };
    }
    function reuseSelectionSourceContext(userInstruction) {
      return __async(this, null, function* () {
        const bindings = selection.reusableSourceBindings(userInstruction, projectRoot());
        if (!bindings.length) return false;
        search.candidateHits.value = candidateHitsFromBindings(bindings);
        if (!search.candidateHits.value.length) return false;
        search.selectedCandidatePaths.value = search.candidateHits.value.map((hit) => hit.file);
        search.candidateError.value = "";
        search.processLogs.value = [
          `复用选区源码上下文：${bindings.map((item) => item.uid).join("、")}`,
          "已跳过 DOM Agent、本地源码检索和源码定位模型"
        ];
        search.searchRunning.value = false;
        search.candidateLoading.value = false;
        search.searchStartedAt.value = Date.now();
        search.searchFinishedAt.value = 0;
        search.modelAssistAttempted.value = true;
        selection.filesConfirmed.value = false;
        if (yield runConnectedAgent(userInstruction, bindings)) {
          search.searchFinishedAt.value = Date.now();
          selection.filesConfirmed.value = true;
          return true;
        }
        if (!model.useModelAssist.value || !model.canUseModelAssist.value) {
          const text = modelAssistUnavailableText();
          search.candidateError.value = text;
          search.searchFinishedAt.value = Date.now();
          appUiStore.setToast(text);
          return true;
        }
        const modelResult = yield model.runSelectionContextAssist({
          userInstruction,
          selectionBindings: bindings
        });
        search.searchFinishedAt.value = Date.now();
        if (modelResult == null ? void 0 : modelResult.stopped) return true;
        if (hasUsableModelResult(modelResult)) {
          selection.filesConfirmed.value = true;
          prompt.generatePrompt({ userInstruction });
          appUiStore.setToast("已复用选区源码上下文并完成模型增强");
          return true;
        }
        search.candidateError.value = model.modelAssistError.value || "选区源码上下文增强失败，请重试。";
        return true;
      });
    }
    function runConnectedAgent(_0, _1) {
      return __async(this, arguments, function* (userInstruction, bindings, options = {}) {
        const provider = connectAgentStore.activeProvider;
        if (!(provider == null ? void 0 : provider.connected)) return false;
        const controller = new AbortController();
        connectAgentStore.beginTask(controller);
        selection.filesConfirmed.value = bindings.length > 0;
        search.appendProcessLog(bindings.length ? `Connect Agent 分流：DOM Locator 已完成，交给 ${provider.name}` : `Connect Agent 分流：本地事实准备完成后，由 ${provider.name} 自行定位并开发`);
        try {
          const result = yield runConnectAgentTask(provider.id, {
            projectRoot: projectRoot(),
            pageUrl: state.currentPageHref.value,
            userInstruction,
            selectionBindings: bindings,
            selectionThumbnails: selection.selectionThumbnails(userInstruction),
            searchPayload: options.searchPayload || null
          }, {
            controller,
            onEvent: (event) => {
              var _a2;
              connectAgentStore.applyTaskEvent(event);
              if ((event == null ? void 0 : event.type) === "locator-evidence" && ((_a2 = event.evidence) == null ? void 0 : _a2.route)) {
                route.applyRouteResolverTrace({
                  pagePath: event.evidence.route.pagePath,
                  matched: event.evidence.route.matched,
                  bestPageFile: event.evidence.route.bestPageFile,
                  hits: event.evidence.route.hits
                });
              }
            }
          });
          connectAgentStore.completeTask(result);
          selection.bindAgentLocations({
            references: result.selectionLocations || [],
            projectRoot: projectRoot(),
            designRequirement: userInstruction
          });
          appUiStore.setToast(`${provider.name} 已完成开发任务`);
        } catch (error) {
          connectAgentStore.failTask(error);
          appUiStore.setToast((error == null ? void 0 : error.message) || `${provider.name} 开发任务失败`);
        }
        return true;
      });
    }
    return {
      sendComposer,
      searchCandidateFiles,
      runModelAssistForCandidates
    };
  }
  function buildAgentRetryState(previousResult, attempt) {
    var _a2, _b;
    const agent = (previousResult == null ? void 0 : previousResult.agent) || {};
    const inspectionCandidates = Array.isArray((_a2 = agent == null ? void 0 : agent.inspection) == null ? void 0 : _a2.candidates) ? agent.inspection.candidates : [];
    return {
      expansionRetry: true,
      expansionRoundsUsed: attempt,
      previousPlan: (agent == null ? void 0 : agent.plan) || null,
      previousCandidates: inspectionCandidates.slice(0, 8).map((item) => ({
        file: (item == null ? void 0 : item.file) || "",
        score: (item == null ? void 0 : item.score) || 0,
        matchedGroups: Array.isArray(item == null ? void 0 : item.matchedGroups) ? item.matchedGroups.map((group) => ({
          keywords: Array.isArray(group == null ? void 0 : group.keywords) ? group.keywords : [],
          source: (group == null ? void 0 : group.source) || "",
          range: (group == null ? void 0 : group.range) || ""
        })) : []
      })),
      previousReason: ((_b = agent == null ? void 0 : agent.evidence) == null ? void 0 : _b.reason) || ""
    };
  }
  function shouldAutoExpandSearch(result) {
    var _a2;
    const hits = Array.isArray(result == null ? void 0 : result.hits) ? result.hits : [];
    if (hits.length) return false;
    return !!((result == null ? void 0 : result.needsMoreEvidence) || (result == null ? void 0 : result.needMoreDom) || ((_a2 = result == null ? void 0 : result.agent) == null ? void 0 : _a2.needMoreDom));
  }
  function latestSelectionSnapshotFromItems(items) {
    const latest = items[items.length - 1];
    if (!(latest == null ? void 0 : latest.uid)) return { uid: "", signature: "" };
    const info = latest.info || latest.element || {};
    const asset = latest.assetInfo || latest.asset || {};
    return {
      uid: latest.uid,
      signature: JSON.stringify([
        info.tag || info.tagName || "",
        info.selector || "",
        info.className || "",
        info.text || "",
        info.searchText || "",
        info.outerHtml || info.rawOuterHtml || "",
        asset.selector || "",
        asset.className || "",
        asset.text || "",
        asset.outerHtml || asset.rawOuterHtml || ""
      ]).slice(0, 2e4)
    };
  }
  function sleep$1(ms) {
    return new Promise((resolve2) => setTimeout(resolve2, ms));
  }
  function hasUsableModelResult(result) {
    return ((result == null ? void 0 : result.modelItems) || (result == null ? void 0 : result.targetFiles) || []).some((item) => {
      return item && item.exists !== false && (item.path || item.file);
    });
  }
  function shouldAutoRunModelAssist(hits) {
    const list = Array.isArray(hits) ? hits : [];
    return list.length > 0;
  }
  function hasStrongSearchEvidence(hits) {
    const list = Array.isArray(hits) ? hits : [];
    return list.some((hit) => {
      if (!hit) return false;
      if (hit.preciseEvidence || hit.uniqueMatchText || hit.uniqueSnippet) return true;
      if (Number(hit.exactMatchCount || 0) === 1 && Number(hit.contextScore || 0) >= 18) return true;
      if (Number(hit.contextStrongMatchCount || 0) >= 2) return true;
      if (Number(hit.contextScore || 0) >= 32 && (hit.contextReasons || []).length >= 2) return true;
      return false;
    });
  }
  function shouldRetryExpandedSearch(hits) {
    const list = Array.isArray(hits) ? hits : [];
    if (list.length < 2) return false;
    if (hasStrongSearchEvidence(list)) return false;
    if (list.length >= 6) return true;
    const exactLikeHits = list.filter((hit) => (hit == null ? void 0 : hit.exactMatchText) || (hit == null ? void 0 : hit.uniqueMatchText)).length;
    return exactLikeHits <= 1;
  }
  function isBetterSearchResult(nextHits, currentHits) {
    var _a2, _b;
    const next = Array.isArray(nextHits) ? nextHits : [];
    const current = Array.isArray(currentHits) ? currentHits : [];
    if (!next.length) return false;
    const nextStrong = hasStrongSearchEvidence(next);
    const currentStrong = hasStrongSearchEvidence(current);
    if (nextStrong !== currentStrong) return nextStrong;
    if (next.length !== current.length) return next.length < current.length;
    return Number(((_a2 = next[0]) == null ? void 0 : _a2.score) || 0) > Number(((_b = current[0]) == null ? void 0 : _b.score) || 0);
  }
  function createGoCaptureActions(state) {
    const { api, currentPageHref, source, search, selection, composer, model } = state;
    const workflow = createComposerWorkflow(state);
    return {
      chooseProject: source.chooseProject,
      onFileInputChange: source.onFileInputChange,
      previewSelection: selection.previewSelection,
      restoreSelectionPreview: selection.restoreSelectionPreview,
      expandSelection: selection.expandSelection,
      removeSelection: selection.removeSelection,
      clearSelections: selection.clearSelections,
      sendComposer: workflow.sendComposer,
      openSourceFile,
      openSettings: (section) => openSettings(api, (currentPageHref == null ? void 0 : currentPageHref.value) || "", section),
      rebindSidePanel,
      copyTextWithToast,
      toggleCandidateFile: (hit) => toggleCandidateFile(hit, search),
      toggleCandidateDetail: (hit) => toggleCandidateDetail(hit, search),
      setIncludeApiEvidence: (value) => {
        search.includeApiEvidence.value = !!value;
      },
      onSearchOptionChange: () => search.clearCandidateState(),
      openModelEditor: model.openModelEditor,
      openProviderModelEditor: model.openProviderModelEditor,
      closeModelEditor: model.closeModelEditor,
      saveModelForm: model.saveModelForm,
      removeSelectedModel: model.removeSelectedModel,
      setSelectedModel: model.setSelectedModel,
      selectModelAndEnable: model.selectModelAndEnable,
      disableModelAssist: model.disableModelAssist,
      setUseModelAssist: model.setUseModelAssist,
      resetModelAssist: model.resetModelAssist,
      stopModelAssist: model.stopModelAssist
    };
  }
  function rebindSidePanel() {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "gocapture.sidepanel.rebind" }, "*");
      return;
    }
    window.location.reload();
  }
  function openSettings(api, currentPageHref, section = "") {
    var _a2, _b;
    const baseUrl = ((_a2 = api == null ? void 0 : api.sidePanelConfig) == null ? void 0 : _a2.sourceServerUrl) || window.location.origin;
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
    const binding = readLatestPanelBinding();
    if ((binding == null ? void 0 : binding.workspaceId) || (binding == null ? void 0 : binding.browserTabId)) {
      const params = new URLSearchParams();
      if (binding.workspaceId) params.set("workspaceId", binding.workspaceId);
      if (binding.browserTabId != null) params.set("tabId", String(binding.browserTabId));
      if (binding.windowId != null) params.set("windowId", String(binding.windowId));
      const pageUrl = ((_b = binding.page) == null ? void 0 : _b.url) || currentPageHref || "";
      if (pageUrl) params.set("pageUrl", pageUrl);
      if (section) params.set("section", section);
      window.open(`${normalizedBaseUrl}/settings?${params.toString()}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "gocapture.settings.open",
        sourceServerUrl: baseUrl
      }, "*");
      return;
    }
    const suffix = section ? `?section=${encodeURIComponent(section)}` : "";
    window.open(`${normalizedBaseUrl}/settings${suffix}`, "_blank", "noopener,noreferrer");
  }
  function openSourceFile(file, line, column) {
    return __async(this, null, function* () {
      if (!file) return;
      const appUiStore = useAppUiStore();
      try {
        yield sourceServerJson("/api/source/open", {
          method: "POST",
          body: { file, line: Number(line) > 0 ? line : void 0, column: Number(column) > 0 ? column : void 0 },
          timeoutMs: 5e3,
          timeoutMessage: "打开源码文件超时，请确认本地源码服务可用"
        });
        appUiStore.setToast(`已打开 ${file}`);
      } catch (error) {
        appUiStore.setToast(error.message || "打开源码文件失败");
      }
    });
  }
  function toggleCandidateFile(hit, search, selection) {
    if (!hit) return;
    const selected = new Set(search.selectedCandidatePaths.value);
    if (selected.has(hit.file)) selected.delete(hit.file);
    else selected.add(hit.file);
    search.selectedCandidatePaths.value = Array.from(selected);
    search.invalidateCandidateConfirm();
  }
  function toggleCandidateDetail(hit, search) {
    if (!hit) return;
    search.expandedCandidatePath.value = search.expandedCandidatePath.value === hit.file ? "" : hit.file;
  }
  function copyTextWithToast(text) {
    const appUiStore = useAppUiStore();
    copyText(text).then((ok) => {
      appUiStore.setToast(ok ? "已复制" : "复制失败");
    });
  }
  function copyText(text) {
    if (!text) return Promise.resolve(false);
    return copyTextByHost(text).catch(() => false).then((ok) => ok || copyTextInFrame(text));
  }
  function copyTextByHost(text) {
    if (!window.parent || window.parent === window) return Promise.resolve(false);
    return new Promise((resolve2) => {
      const requestId = `gocapture-clipboard-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let settled = false;
      const cleanup = () => {
        window.removeEventListener("message", handleMessage);
        window.clearTimeout(timer);
      };
      const done = (ok) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve2(ok);
      };
      const handleMessage = (event) => {
        const message = event.data || {};
        if ((message == null ? void 0 : message.type) !== "gocapture.clipboard.result" || message.requestId !== requestId) return;
        done(!!message.ok);
      };
      const timer = window.setTimeout(() => done(false), 3e3);
      window.addEventListener("message", handleMessage);
      window.parent.postMessage({
        type: "gocapture.clipboard.write",
        requestId,
        text
      }, "*");
    });
  }
  function copyTextInFrame(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    }
    return new Promise((resolve2) => {
      var _a2;
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (error) {
        ok = false;
      }
      (_a2 = textarea.parentNode) == null ? void 0 : _a2.removeChild(textarea);
      resolve2(ok);
    });
  }
  function provideGoCaptureRuntime(api, state, actions) {
    var _a2, _b;
    const { source, route, composer } = state;
    const commands = {
      sendRequest: actions.sendComposer,
      resolveRoute: route.resolveCurrentPageRoute,
      selectProject: source.chooseProject,
      openSourceFile: actions.openSourceFile,
      openSettings: actions.openSettings,
      rebindSidePanel: actions.rebindSidePanel,
      copyPrompt: () => actions.copyTextWithToast(composer.promptText.value),
      copyText: actions.copyTextWithToast,
      previewSelection: actions.previewSelection,
      restoreSelectionPreview: actions.restoreSelectionPreview,
      expandSelection: actions.expandSelection,
      removeSelection: actions.removeSelection,
      clearSelections: actions.clearSelections,
      toggleCandidateFile: actions.toggleCandidateFile,
      toggleCandidateDetail: actions.toggleCandidateDetail,
      setIncludeApiEvidence: actions.setIncludeApiEvidence,
      onSearchOptionChange: actions.onSearchOptionChange,
      openModelEditor: actions.openModelEditor,
      openProviderModelEditor: actions.openProviderModelEditor,
      closeModelEditor: actions.closeModelEditor,
      saveModelForm: actions.saveModelForm,
      removeSelectedModel: actions.removeSelectedModel,
      setSelectedModel: actions.setSelectedModel,
      selectModelAndEnable: actions.selectModelAndEnable,
      disableModelAssist: actions.disableModelAssist,
      setUseModelAssist: actions.setUseModelAssist,
      resetModelAssist: actions.resetModelAssist,
      stopModelAssist: actions.stopModelAssist
    };
    provideGoCaptureCommands(((_b = (_a2 = api.bootstrap) == null ? void 0 : _a2.createCommands) == null ? void 0 : _b.call(_a2, commands)) || commands);
  }
  function registerRuntimeApi(api, state) {
    const { bridge, selection } = state;
    api.start = () => bridge.sendSidePanelCommand("picker.start");
    api.stop = () => bridge.sendSidePanelCommand("picker.stop");
    api.toggle = () => bridge.sendSidePanelCommand("picker.start");
    api.clear = selection.clearSelections;
    api.getSelected = () => ({
      element: null,
      selections: selection.selectionPayloads()
    });
  }
  function createGoCaptureRuntime(api) {
    const currentPageHref = /* @__PURE__ */ ref(readCurrentHref(api));
    const sidePanelConfig = computed(() => api.sidePanelConfig || {});
    const routePagePath = computed(() => pageUrlPath(currentPageHref.value));
    const pageHost = computed(() => pageHostText(currentPageHref.value));
    const routeStore = useRouteStore();
    const appUiStore = useAppUiStore();
    const connectAgentStore = useConnectAgentStore();
    let cleanupLocationWatcher = null;
    const runtime = {
      api,
      currentPageHref,
      sidePanelConfig,
      routePagePath,
      pageHost
    };
    const state = createGoCaptureRuntimeState(runtime);
    const { source, route, search, bridge } = state;
    let selectionRestoreRequest = 0;
    const actions = createGoCaptureActions(state);
    provideGoCaptureRuntime(api, state, actions);
    watch([source.project, currentPageHref], () => {
      var _a2;
      const projectRoot = ((_a2 = source.project.value) == null ? void 0 : _a2.path) || "";
      routeStore.setPage(currentPageHref.value, routePagePath.value);
      search.i18nTrace.value = null;
      search.definitionTrace.value = null;
      route.scheduleRouteResolve();
      void connectAgentStore.refreshProviders(false, projectRoot).then(() => connectAgentStore.loadTimeline(projectRoot));
      if (projectRoot) {
        const request = ++selectionRestoreRequest;
        void loadProjectSelectionReferences(projectRoot).then((references) => {
          var _a3;
          if (request !== selectionRestoreRequest) return;
          if (((_a3 = source.project.value) == null ? void 0 : _a3.path) !== projectRoot) return;
          state.selection.restoreLocationReferences(references, projectRoot);
        });
      }
    }, { immediate: true });
    watch(currentPageHref, () => {
      source.restoreSavedProject();
    });
    onMounted(() => {
      var _a2;
      registerRuntimeApi(api, state);
      cleanupLocationWatcher = installLocationWatcher(currentPageHref);
      source.restoreSavedProject();
      route.scheduleRouteResolve();
      bridge.connectSidePanelBridge();
      const projectRoot = ((_a2 = source.project.value) == null ? void 0 : _a2.path) || "";
      void connectAgentStore.refreshProviders(false, projectRoot).then(() => connectAgentStore.loadTimeline(projectRoot));
    });
    onBeforeUnmount(() => {
      bridge.disconnectSidePanelBridge();
      route.cleanupRouteResolver();
      cleanupLocationWatcher == null ? void 0 : cleanupLocationWatcher();
      cleanupLocationWatcher = null;
      appUiStore.cleanupToast();
    });
    return {
      currentPageHref,
      fileInputRef: source.fileInputRef,
      onFileInputChange: source.onFileInputChange,
      openSettings: actions.openSettings,
      rebindSidePanel: actions.rebindSidePanel,
      pageHost
    };
  }
  function useServiceHealth() {
    const appUi = useAppUiStore();
    const probing = /* @__PURE__ */ ref(false);
    let timer = null;
    function probe() {
      return __async(this, null, function* () {
        if (probing.value) return appUi.serviceOnline === true;
        probing.value = true;
        try {
          const result = yield probeSourceServer();
          appUi.setServiceOnline(result.online, result.message, result.url);
          const online = result.online;
          schedule(online ? 15e3 : 4e3);
          return online;
        } finally {
          probing.value = false;
        }
      });
    }
    function schedule(delay) {
      stop();
      timer = window.setTimeout(probe, delay);
    }
    function stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    onMounted(() => {
      void probe();
    });
    onScopeDispose(stop);
    return { probe };
  }
  const sleep = (ms) => new Promise((resolve2) => setTimeout(resolve2, ms));
  function reloadThroughSidePanelHost(timeoutMs = 4e3) {
    if (typeof window === "undefined" || window.parent === window) return Promise.resolve(false);
    const requestId = `update-reload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return new Promise((resolve2) => {
      let settled = false;
      const cleanup = () => {
        window.clearTimeout(timer);
        window.removeEventListener("message", onMessage);
      };
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve2(ok);
      };
      const onMessage = (event) => {
        const message = event.data || {};
        if (message.type !== "gocapture.sidepanel.reload.result" || message.requestId !== requestId) return;
        finish(!!message.ok);
      };
      const timer = window.setTimeout(() => finish(false), timeoutMs);
      window.addEventListener("message", onMessage);
      window.parent.postMessage({
        type: "gocapture.sidepanel.reload",
        requestId,
        reason: "update-complete"
      }, "*");
    });
  }
  function reloadAfterUpdate() {
    return __async(this, null, function* () {
      const delegated = yield reloadThroughSidePanelHost();
      if (delegated) return;
      window.location.reload();
    });
  }
  function useUpdateCheck() {
    const info = /* @__PURE__ */ ref(null);
    const applying = /* @__PURE__ */ ref(false);
    const applyMessage = /* @__PURE__ */ ref("");
    function check() {
      return __async(this, null, function* () {
        try {
          const data = yield sourceServerJson("/api/update/check", { timeoutMs: 6e3 });
          info.value = data && data.updateAvailable ? data : null;
        } catch (e) {
          info.value = null;
        }
      });
    }
    function readStatus() {
      return __async(this, null, function* () {
        try {
          return yield sourceServerJson("/api/update/status", { timeoutMs: 1500 });
        } catch (e) {
          return null;
        }
      });
    }
    function waitForNewVersion(oldVersion, maxSeconds = 90) {
      return __async(this, null, function* () {
        var _a2, _b;
        for (let i = 0; i < maxSeconds; i += 1) {
          try {
            const data = yield sourceServerJson("/api/version", { timeoutMs: 1500 });
            if (data && data.version && data.version !== oldVersion) return true;
          } catch (e) {
          }
          const status = yield readStatus();
          if ((status == null ? void 0 : status.status) === "failed") {
            const lastLog = ((_a2 = status.logs) == null ? void 0 : _a2.slice(-1)[0]) || "";
            throw new Error(status.error || lastLog || "更新失败");
          }
          if ((status == null ? void 0 : status.status) === "running") {
            const lastLog = (_b = status.logs) == null ? void 0 : _b.slice(-1)[0];
            applyMessage.value = lastLog ? `更新中：${lastLog}` : "更新中，服务将自动重启…";
          } else if ((status == null ? void 0 : status.status) === "succeeded") {
            applyMessage.value = "更新完成，等待服务重启…";
          }
          yield sleep(1e3);
        }
        return false;
      });
    }
    function apply2() {
      return __async(this, null, function* () {
        if (applying.value || !info.value) return;
        const oldVersion = info.value.current;
        applying.value = true;
        applyMessage.value = "正在下载更新…";
        try {
          yield sourceServerJson("/api/update/apply", { method: "POST", body: {}, timeoutMs: 8e3 });
        } catch (e) {
        }
        applyMessage.value = "更新中，服务将自动重启…";
        try {
          const ok = yield waitForNewVersion(oldVersion);
          if (ok) {
            applyMessage.value = "更新完成，正在刷新…";
            yield reloadAfterUpdate();
          } else {
            applying.value = false;
            applyMessage.value = "未检测到服务自动重启，请运行 gocapture restart 后重试。";
            void check();
          }
        } catch (error) {
          applying.value = false;
          applyMessage.value = `更新失败：${error instanceof Error ? error.message : String(error)}`;
          void check();
        }
      });
    }
    onMounted(() => {
      void check();
    });
    return { info, applying, applyMessage, check, apply: apply2 };
  }
  const _hoisted_1$2 = { class: "mda-root" };
  const _hoisted_2$1 = ["aria-label"];
  const _hoisted_3$1 = { class: "mda-head" };
  const _hoisted_4$1 = { class: "mda-head-main" };
  const _hoisted_5$1 = { class: "mda-title" };
  const _hoisted_6$1 = { class: "mda-title-wordmark" };
  const _hoisted_7$1 = { class: "mda-subtitle" };
  const _hoisted_8$1 = { class: "mda-head-actions" };
  const _hoisted_9$1 = {
    key: 0,
    class: "mda-service-down",
    role: "alert"
  };
  const _hoisted_10$1 = { class: "mda-service-down-main" };
  const _hoisted_11$1 = { class: "mda-service-down-hint" };
  const _hoisted_12$1 = { class: "mda-service-down-hint" };
  const _hoisted_13$1 = ["disabled"];
  const _hoisted_14$1 = {
    key: 1,
    class: "mda-update-bar",
    role: "status"
  };
  const _hoisted_15$1 = { class: "mda-update-main" };
  const _hoisted_16$1 = { class: "mda-update-title" };
  const _hoisted_17$1 = { class: "mda-update-hint" };
  const _hoisted_18$1 = {
    key: 1,
    class: "mda-update-spinner",
    "aria-hidden": "true"
  };
  const _hoisted_19$1 = { class: "mda-body mda-chat-body" };
  const _hoisted_20$1 = {
    key: 2,
    class: "mda-project-checking",
    role: "status",
    "aria-live": "polite"
  };
  const _hoisted_21$1 = { class: "mda-project-checking-box" };
  const _hoisted_22$1 = { class: "mda-project-checking-text" };
  const _sfc_main$3 = /* @__PURE__ */ defineComponent({
    __name: "GoCapturePanel",
    props: {
      api: {}
    },
    setup(__props) {
      const props = __props;
      const projectStore = useProjectStore();
      const appUiStore = useAppUiStore();
      const { serviceOnline, serviceHealthMessage, serviceHealthUrl, mcpPanelOpen } = storeToRefs(appUiStore);
      const { probe: probeHealth } = useServiceHealth();
      const retryChecking = /* @__PURE__ */ ref(false);
      function retryHealth() {
        return __async(this, null, function* () {
          retryChecking.value = true;
          try {
            yield probeHealth();
          } finally {
            retryChecking.value = false;
          }
        });
      }
      const { info: updateInfo, applying: updateApplying, applyMessage: updateMessage, apply: applyUpdate } = useUpdateCheck();
      const projectChecking = computed(() => {
        return !!projectStore.current && projectStore.serviceStatus === "loading";
      });
      const projectCheckingText = computed(() => {
        return projectStore.serviceMessage || "正在读取配置并生成项目上下文...";
      });
      const {
        fileInputRef,
        onFileInputChange,
        openSettings: openSettings2,
        rebindSidePanel: rebindSidePanel2,
        pageHost
      } = createGoCaptureRuntime(props.api);
      return (_ctx, _cache) => {
        var _a2;
        return openBlock(), createElementBlock("main", _hoisted_1$2, [
          createBaseVNode("section", {
            class: "mda-panel",
            "aria-label": unref(PRODUCT_NAME)
          }, [
            createBaseVNode("header", _hoisted_3$1, [
              createBaseVNode("div", _hoisted_4$1, [
                createBaseVNode("div", _hoisted_5$1, [
                  createBaseVNode(
                    "span",
                    _hoisted_6$1,
                    toDisplayString(unref(PRODUCT_NAME)),
                    1
                    /* TEXT */
                  )
                ]),
                createBaseVNode(
                  "div",
                  _hoisted_7$1,
                  toDisplayString(unref(pageHost)),
                  1
                  /* TEXT */
                )
              ]),
              createBaseVNode("div", _hoisted_8$1, [
                createBaseVNode(
                  "span",
                  {
                    class: "mda-head-icon",
                    role: "button",
                    tabindex: "0",
                    title: "重新绑定当前页面",
                    "aria-label": "重新绑定当前页面",
                    onClick: _cache[0] || (_cache[0] = //@ts-ignore
                    (...args) => unref(rebindSidePanel2) && unref(rebindSidePanel2)(...args)),
                    onKeydown: [
                      _cache[1] || (_cache[1] = withKeys(withModifiers(
                        //@ts-ignore
                        (...args) => unref(rebindSidePanel2) && unref(rebindSidePanel2)(...args),
                        ["prevent"]
                      ), ["enter"])),
                      _cache[2] || (_cache[2] = withKeys(withModifiers(
                        //@ts-ignore
                        (...args) => unref(rebindSidePanel2) && unref(rebindSidePanel2)(...args),
                        ["prevent"]
                      ), ["space"]))
                    ]
                  },
                  [
                    createVNode(_sfc_main$b, {
                      name: "refresh",
                      size: 19
                    })
                  ],
                  32
                  /* NEED_HYDRATION */
                ),
                createBaseVNode(
                  "span",
                  {
                    class: "mda-head-icon",
                    role: "button",
                    tabindex: "0",
                    title: "打开设置",
                    "aria-label": "打开设置",
                    onClick: _cache[3] || (_cache[3] = //@ts-ignore
                    (...args) => unref(openSettings2) && unref(openSettings2)(...args)),
                    onKeydown: [
                      _cache[4] || (_cache[4] = withKeys(withModifiers(
                        //@ts-ignore
                        (...args) => unref(openSettings2) && unref(openSettings2)(...args),
                        ["prevent"]
                      ), ["enter"])),
                      _cache[5] || (_cache[5] = withKeys(withModifiers(
                        //@ts-ignore
                        (...args) => unref(openSettings2) && unref(openSettings2)(...args),
                        ["prevent"]
                      ), ["space"]))
                    ]
                  },
                  [
                    createVNode(_sfc_main$b, {
                      name: "cog",
                      size: 20
                    })
                  ],
                  32
                  /* NEED_HYDRATION */
                )
              ])
            ]),
            unref(serviceOnline) === false ? (openBlock(), createElementBlock("div", _hoisted_9$1, [
              _cache[13] || (_cache[13] = createBaseVNode(
                "span",
                { class: "mda-service-down-icon" },
                "⚠",
                -1
                /* CACHED */
              )),
              createBaseVNode("div", _hoisted_10$1, [
                _cache[12] || (_cache[12] = createBaseVNode(
                  "div",
                  { class: "mda-service-down-title" },
                  "本地服务不可达",
                  -1
                  /* CACHED */
                )),
                createBaseVNode("div", _hoisted_11$1, [
                  _cache[9] || (_cache[9] = createTextVNode(
                    " 正在探测 ",
                    -1
                    /* CACHED */
                  )),
                  createBaseVNode(
                    "code",
                    null,
                    toDisplayString(unref(serviceHealthUrl) || "/health"),
                    1
                    /* TEXT */
                  ),
                  unref(serviceHealthMessage) ? (openBlock(), createElementBlock(
                    Fragment,
                    { key: 0 },
                    [
                      createTextVNode(
                        "，失败原因：" + toDisplayString(unref(serviceHealthMessage)),
                        1
                        /* TEXT */
                      )
                    ],
                    64
                    /* STABLE_FRAGMENT */
                  )) : createCommentVNode("v-if", true)
                ]),
                createBaseVNode("div", _hoisted_12$1, [
                  _cache[10] || (_cache[10] = createTextVNode(
                    "如果服务已启动，请运行 ",
                    -1
                    /* CACHED */
                  )),
                  createBaseVNode(
                    "code",
                    null,
                    toDisplayString(unref(CLI_COMMAND)) + " status",
                    1
                    /* TEXT */
                  ),
                  _cache[11] || (_cache[11] = createTextVNode(
                    " 检查端口是否一致。",
                    -1
                    /* CACHED */
                  ))
                ])
              ]),
              createBaseVNode("button", {
                class: "mda-service-down-retry",
                type: "button",
                disabled: retryChecking.value,
                onClick: retryHealth
              }, toDisplayString(retryChecking.value ? "检查中…" : "重试"), 9, _hoisted_13$1)
            ])) : ((_a2 = unref(updateInfo)) == null ? void 0 : _a2.updateAvailable) ? (openBlock(), createElementBlock("div", _hoisted_14$1, [
              _cache[14] || (_cache[14] = createBaseVNode(
                "span",
                { class: "mda-update-icon" },
                "⬆",
                -1
                /* CACHED */
              )),
              createBaseVNode("div", _hoisted_15$1, [
                createBaseVNode(
                  "div",
                  _hoisted_16$1,
                  toDisplayString(unref(updateApplying) ? "更新中…" : `发现新版本 v${unref(updateInfo).latest}`),
                  1
                  /* TEXT */
                ),
                createBaseVNode(
                  "div",
                  _hoisted_17$1,
                  toDisplayString(unref(updateMessage) || `当前 v${unref(updateInfo).current}，可一键更新（服务会自动重启）`),
                  1
                  /* TEXT */
                )
              ]),
              !unref(updateApplying) ? (openBlock(), createElementBlock("button", {
                key: 0,
                class: "mda-update-btn",
                type: "button",
                onClick: _cache[6] || (_cache[6] = //@ts-ignore
                (...args) => unref(applyUpdate) && unref(applyUpdate)(...args))
              }, "更新")) : (openBlock(), createElementBlock("span", _hoisted_18$1))
            ])) : createCommentVNode("v-if", true),
            createBaseVNode("div", _hoisted_19$1, [
              createBaseVNode(
                "input",
                {
                  ref_key: "fileInputRef",
                  ref: fileInputRef,
                  class: "mda-file-input",
                  type: "file",
                  webkitdirectory: "",
                  multiple: "",
                  onChange: _cache[7] || (_cache[7] = //@ts-ignore
                  (...args) => unref(onFileInputChange) && unref(onFileInputChange)(...args))
                },
                null,
                544
                /* NEED_HYDRATION, NEED_PATCH */
              ),
              createVNode(_sfc_main$9),
              createVNode(_sfc_main$5)
            ]),
            projectChecking.value ? (openBlock(), createElementBlock("div", _hoisted_20$1, [
              createBaseVNode("div", _hoisted_21$1, [
                _cache[16] || (_cache[16] = createBaseVNode(
                  "div",
                  { class: "mda-project-checking-spinner" },
                  null,
                  -1
                  /* CACHED */
                )),
                createBaseVNode("div", null, [
                  _cache[15] || (_cache[15] = createBaseVNode(
                    "div",
                    { class: "mda-project-checking-title" },
                    "正在检查项目",
                    -1
                    /* CACHED */
                  )),
                  createBaseVNode(
                    "div",
                    _hoisted_22$1,
                    toDisplayString(projectCheckingText.value),
                    1
                    /* TEXT */
                  )
                ])
              ])
            ])) : createCommentVNode("v-if", true),
            createVNode(_sfc_main$4, {
              visible: unref(mcpPanelOpen),
              onClose: _cache[8] || (_cache[8] = ($event) => unref(appUiStore).setMcpPanelOpen(false))
            }, null, 8, ["visible"])
          ], 8, _hoisted_2$1)
        ]);
      };
    }
  });
  const useMemoryStore = /* @__PURE__ */ defineStore("gocapture.memory", () => {
    const projectStore = useProjectStore();
    const open = /* @__PURE__ */ ref(false);
    const loading = /* @__PURE__ */ ref(false);
    const saving = /* @__PURE__ */ ref(false);
    const error = /* @__PURE__ */ ref("");
    const message = /* @__PURE__ */ ref("");
    const snapshot = /* @__PURE__ */ ref(null);
    const toolProviders = /* @__PURE__ */ ref([]);
    const tools = /* @__PURE__ */ ref([]);
    const resourceProviders = /* @__PURE__ */ ref([]);
    const resources = /* @__PURE__ */ ref([]);
    function openPanel() {
      return __async(this, null, function* () {
        open.value = true;
        yield load();
      });
    }
    function closePanel() {
      open.value = false;
      error.value = "";
      message.value = "";
    }
    function load() {
      return __async(this, null, function* () {
        var _a2;
        if (!((_a2 = projectStore.current) == null ? void 0 : _a2.path) || projectStore.current.source !== "source-server") {
          snapshot.value = null;
          error.value = "请先关联本地源码项目";
          return;
        }
        loading.value = true;
        error.value = "";
        message.value = "";
        try {
          const projectPath = projectStore.current.path;
          const [result, toolResult, resourceResult] = yield Promise.all([
            sourceServerJson("/api/memory/read", {
              method: "POST",
              body: { projectPath },
              timeoutMs: 1e4,
              timeoutMessage: "读取记忆超时，请确认本地源码服务可用"
            }),
            sourceServerJson("/api/agent/tools", {
              timeoutMs: 5e3,
              timeoutMessage: "读取工具清单超时"
            }),
            sourceServerJson(`/api/agent/resources?projectPath=${encodeURIComponent(projectPath)}`, {
              timeoutMs: 5e3,
              timeoutMessage: "读取资源清单超时"
            })
          ]);
          snapshot.value = result.memory || null;
          toolProviders.value = Array.isArray(toolResult.providers) ? toolResult.providers : [];
          tools.value = Array.isArray(toolResult.tools) ? toolResult.tools : [];
          resourceProviders.value = Array.isArray(resourceResult.providers) ? resourceResult.providers : [];
          resources.value = Array.isArray(resourceResult.resources) ? resourceResult.resources : [];
        } catch (cause) {
          error.value = (cause == null ? void 0 : cause.message) || "读取记忆失败";
        } finally {
          loading.value = false;
        }
      });
    }
    function saveExperience(payload) {
      return __async(this, null, function* () {
        return save("/api/experience", payload, "项目经验已保存");
      });
    }
    function save(pathname, payload, successMessage) {
      return __async(this, null, function* () {
        var _a2;
        saving.value = true;
        error.value = "";
        message.value = "";
        try {
          const result = yield sourceServerJson(pathname, {
            method: "POST",
            body: __spreadProps(__spreadValues({}, payload), {
              projectPath: ((_a2 = projectStore.current) == null ? void 0 : _a2.path) || ""
            }),
            timeoutMs: 1e4,
            timeoutMessage: "保存记忆超时，请确认本地源码服务可用"
          });
          snapshot.value = result.memory || null;
          message.value = successMessage;
          return true;
        } catch (cause) {
          error.value = (cause == null ? void 0 : cause.message) || "保存记忆失败";
          return false;
        } finally {
          saving.value = false;
        }
      });
    }
    return {
      open,
      loading,
      saving,
      error,
      message,
      snapshot,
      toolProviders,
      tools,
      resourceProviders,
      resources,
      openPanel,
      closePanel,
      load,
      saveExperience
    };
  });
  const _hoisted_1$1 = ["aria-label"];
  const _hoisted_2 = {
    key: 0,
    class: "mda-memory-head"
  };
  const _hoisted_3 = { class: "mda-settings-layout" };
  const _hoisted_4 = {
    key: 0,
    class: "mda-settings-sidebar"
  };
  const _hoisted_5 = { class: "mda-settings-search" };
  const _hoisted_6 = { class: "mda-settings-main" };
  const _hoisted_7 = {
    key: 0,
    class: "mda-settings-main-head"
  };
  const _hoisted_8 = {
    key: 1,
    class: "mda-memory-tabs",
    "aria-label": "记忆类型"
  };
  const _hoisted_9 = {
    key: 2,
    class: "mda-memory-state"
  };
  const _hoisted_10 = {
    key: 3,
    class: "mda-memory-state is-error"
  };
  const _hoisted_11 = {
    key: 4,
    class: "mda-memory-body"
  };
  const _hoisted_12 = {
    key: 1,
    class: "mda-locator-settings"
  };
  const _hoisted_13 = { class: "mda-locator-settings-intro" };
  const _hoisted_14 = {
    class: "mda-locator-choice",
    role: "radiogroup",
    "aria-label": "Locator 定位方式"
  };
  const _hoisted_15 = ["aria-checked"];
  const _hoisted_16 = ["aria-checked", "onClick"];
  const _hoisted_17 = ["aria-label", "title", "onClick"];
  const _hoisted_18 = { class: "mda-locator-add-row" };
  const _hoisted_19 = {
    key: 0,
    class: "mda-memory-empty"
  };
  const _hoisted_20 = {
    key: 1,
    class: "mda-settings-assets"
  };
  const _hoisted_21 = {
    key: 1,
    class: "mda-settings-asset-thumb is-empty"
  };
  const _hoisted_22 = { class: "mda-settings-asset-main" };
  const _hoisted_23 = {
    key: 0,
    class: "mda-memory-empty"
  };
  const _hoisted_24 = { class: "mda-memory-field" };
  const _hoisted_25 = ["value"];
  const _hoisted_26 = {
    key: 0,
    class: "mda-memory-form"
  };
  const _hoisted_27 = { class: "mda-memory-field" };
  const _hoisted_28 = { class: "mda-memory-field" };
  const _hoisted_29 = ["value"];
  const _hoisted_30 = { class: "mda-memory-field" };
  const _hoisted_31 = { class: "mda-memory-field" };
  const _hoisted_32 = { class: "mda-memory-field" };
  const _hoisted_33 = { class: "mda-memory-field" };
  const _hoisted_34 = { class: "mda-memory-actions" };
  const _hoisted_35 = ["disabled"];
  const _hoisted_36 = {
    key: 0,
    class: "mda-memory-empty"
  };
  const _hoisted_37 = {
    key: 1,
    class: "mda-memory-form"
  };
  const _hoisted_38 = { class: "mda-memory-project-doc" };
  const _hoisted_39 = {
    key: 5,
    class: "mda-settings-toast",
    role: "status"
  };
  const _hoisted_40 = {
    class: "mda-model-editor",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Locator 模型配置"
  };
  const _hoisted_41 = { class: "mda-model-editor-head" };
  const _hoisted_42 = { class: "mda-model-editor-body" };
  const _hoisted_43 = { class: "mda-model-grid" };
  const _hoisted_44 = { class: "is-wide" };
  const _hoisted_45 = { class: "is-wide" };
  const _hoisted_46 = { class: "is-wide" };
  const _hoisted_47 = { class: "mda-model-actions" };
  const _sfc_main$2 = /* @__PURE__ */ defineComponent({
    __name: "MemorySettingsPanel",
    props: {
      mode: { default: "panel" },
      modelRuntime: { default: null }
    },
    emits: ["back", "select-project"],
    setup(__props) {
      const props = __props;
      const memory = useMemoryStore();
      const appUi = useAppUiStore();
      const selectionStore = useSelectionStore();
      const requestedSection = new URLSearchParams(window.location.search).get("section");
      const allowedSections = /* @__PURE__ */ new Set(["locator", "assets", "tools", "project"]);
      const initialTab = allowedSections.has(String(requestedSection)) ? requestedSection : "locator";
      const tab = /* @__PURE__ */ ref(initialTab);
      const locatorEditorExpanded = /* @__PURE__ */ ref(false);
      const locatorEditingId = /* @__PURE__ */ ref("");
      const experienceId = /* @__PURE__ */ ref("");
      const experienceDraft = /* @__PURE__ */ reactive({
        name: "",
        role: "",
        keywords: "",
        usageFiles: "",
        doc: ""
      });
      const experiences = computed(() => {
        var _a2;
        return ((_a2 = memory.snapshot) == null ? void 0 : _a2.experiences) || [];
      });
      const toolProviders = computed(() => memory.toolProviders || []);
      const tools = computed(() => memory.tools || []);
      const resourceProviders = computed(() => memory.resourceProviders || []);
      const resources = computed(() => memory.resources || []);
      const locatorModels = computed(() => {
        var _a2;
        return unref((_a2 = props.modelRuntime) == null ? void 0 : _a2.modelConfigs) || [];
      });
      const locatorSelectedId = computed(() => {
        var _a2;
        return String(unref((_a2 = props.modelRuntime) == null ? void 0 : _a2.selectedModelId) || "");
      });
      const locatorSelectedModel = computed(() => {
        var _a2;
        return unref((_a2 = props.modelRuntime) == null ? void 0 : _a2.selectedModel) || null;
      });
      const locatorForm = computed(() => {
        var _a2;
        return unref((_a2 = props.modelRuntime) == null ? void 0 : _a2.modelForm) || {};
      });
      const selectionAssets = computed(() => selectionStore.promptAssets || []);
      const activeExperience = computed(() => experiences.value.find((item) => item.componentPath === experienceId.value) || null);
      const projectLabel = computed(() => {
        var _a2, _b;
        return ((_b = (_a2 = memory.snapshot) == null ? void 0 : _a2.project) == null ? void 0 : _b.name) || "当前源码项目";
      });
      const isPage = computed(() => props.mode === "page");
      const visible = computed(() => isPage.value || memory.open);
      const memoryDependent = computed(() => tab.value === "tools" || tab.value === "project");
      const activeTitle = computed(() => {
        if (tab.value === "locator") return "Locator";
        if (tab.value === "assets") return "选区资产";
        if (tab.value === "experiences") return "Experience";
        if (tab.value === "tools") return "Tools / Resources";
        return "项目摘要";
      });
      function chooseLocatorModel(id) {
        var _a2, _b, _c, _d;
        if (id) (_b = (_a2 = props.modelRuntime) == null ? void 0 : _a2.selectModelAndEnable) == null ? void 0 : _b.call(_a2, id);
        else (_d = (_c = props.modelRuntime) == null ? void 0 : _c.disableModelAssist) == null ? void 0 : _d.call(_c);
      }
      function showExperienceComingSoon() {
        appUi.setToast("Experience 功能开发中");
      }
      function editLocatorModel(model) {
        var _a2, _b, _c, _d;
        if (model) (_b = (_a2 = props.modelRuntime) == null ? void 0 : _a2.openModelEditor) == null ? void 0 : _b.call(_a2, model);
        else (_d = (_c = props.modelRuntime) == null ? void 0 : _c.openProviderModelEditor) == null ? void 0 : _d.call(_c, "deepseek");
        locatorEditingId.value = String((model == null ? void 0 : model.id) || "");
        locatorEditorExpanded.value = true;
      }
      function saveLocatorModel() {
        var _a2, _b;
        (_b = (_a2 = props.modelRuntime) == null ? void 0 : _a2.saveModelForm) == null ? void 0 : _b.call(_a2);
        locatorEditingId.value = "";
        locatorEditorExpanded.value = false;
      }
      function removeLocatorModel() {
        var _a2, _b;
        (_b = (_a2 = props.modelRuntime) == null ? void 0 : _a2.removeSelectedModel) == null ? void 0 : _b.call(_a2);
        locatorEditingId.value = "";
        locatorEditorExpanded.value = false;
      }
      watch(experiences, (value) => {
        var _a2;
        if (!value.some((item) => item.componentPath === experienceId.value)) experienceId.value = ((_a2 = value[0]) == null ? void 0 : _a2.componentPath) || "";
      }, { immediate: true });
      watch(activeExperience, (experience) => {
        if (!experience) return;
        experienceDraft.name = experience.name || "";
        experienceDraft.role = experience.role || "";
        experienceDraft.keywords = toLines(experience.keywords);
        experienceDraft.usageFiles = toLines(experience.usageFiles);
        experienceDraft.doc = experience.doc || "";
      }, { immediate: true });
      function toLines(value) {
        return Array.isArray(value) ? value.join("\n") : "";
      }
      function fromLines(value) {
        return value.split("\n").map((item) => item.trim()).filter(Boolean);
      }
      function saveExperience() {
        return __async(this, null, function* () {
          if (!activeExperience.value) return;
          const ok = yield memory.saveExperience({
            componentPath: activeExperience.value.componentPath,
            name: experienceDraft.name,
            role: experienceDraft.role,
            keywords: fromLines(experienceDraft.keywords),
            usageFiles: fromLines(experienceDraft.usageFiles),
            doc: experienceDraft.doc
          });
          if (ok) appUi.setToast("Experience 已保存");
        });
      }
      function assetThumbStyle(asset) {
        return (asset == null ? void 0 : asset.thumbnailUrl) ? { backgroundImage: `url("${asset.thumbnailUrl}")` } : {};
      }
      return (_ctx, _cache) => {
        var _a2;
        return visible.value ? (openBlock(), createElementBlock("div", {
          key: 0,
          class: normalizeClass(["mda-memory-shell", { "is-page": isPage.value }]),
          role: "dialog",
          "aria-modal": "true",
          "aria-label": `${unref(PRODUCT_NAME)} 设置`
        }, [
          !isPage.value ? (openBlock(), createElementBlock("header", _hoisted_2, [
            createBaseVNode("div", null, [
              _cache[27] || (_cache[27] = createBaseVNode(
                "strong",
                null,
                "记忆设置",
                -1
                /* CACHED */
              )),
              createBaseVNode(
                "span",
                null,
                toDisplayString(projectLabel.value),
                1
                /* TEXT */
              )
            ]),
            createBaseVNode("button", {
              class: "mda-icon mda-memory-close",
              type: "button",
              title: "关闭",
              "aria-label": "关闭",
              onClick: _cache[0] || (_cache[0] = //@ts-ignore
              (...args) => unref(memory).closePanel && unref(memory).closePanel(...args))
            }, "×")
          ])) : createCommentVNode("v-if", true),
          createBaseVNode("div", _hoisted_3, [
            isPage.value ? (openBlock(), createElementBlock("aside", _hoisted_4, [
              createBaseVNode("button", {
                class: "mda-settings-back",
                type: "button",
                onClick: _cache[1] || (_cache[1] = ($event) => _ctx.$emit("back"))
              }, [
                createVNode(_sfc_main$b, {
                  name: "back",
                  size: 16
                }),
                createBaseVNode(
                  "span",
                  null,
                  "返回 " + toDisplayString(unref(PRODUCT_NAME)),
                  1
                  /* TEXT */
                )
              ]),
              createBaseVNode("label", _hoisted_5, [
                createVNode(_sfc_main$b, {
                  name: "search",
                  size: 17
                }),
                _cache[28] || (_cache[28] = createBaseVNode(
                  "input",
                  {
                    type: "text",
                    placeholder: "搜索设置...",
                    disabled: ""
                  },
                  null,
                  -1
                  /* CACHED */
                ))
              ]),
              _cache[35] || (_cache[35] = createBaseVNode(
                "div",
                { class: "mda-settings-group-label" },
                "Agent",
                -1
                /* CACHED */
              )),
              createBaseVNode(
                "button",
                {
                  class: normalizeClass(["mda-settings-nav", { "is-active": tab.value === "locator" }]),
                  type: "button",
                  onClick: _cache[2] || (_cache[2] = ($event) => tab.value = "locator")
                },
                [
                  createVNode(_sfc_main$b, {
                    name: "search",
                    size: 17
                  }),
                  _cache[29] || (_cache[29] = createTextVNode(
                    "Locator ",
                    -1
                    /* CACHED */
                  ))
                ],
                2
                /* CLASS */
              ),
              _cache[36] || (_cache[36] = createBaseVNode(
                "div",
                { class: "mda-settings-group-label" },
                "项目",
                -1
                /* CACHED */
              )),
              createBaseVNode(
                "button",
                {
                  class: normalizeClass(["mda-settings-nav", { "is-active": tab.value === "assets" }]),
                  type: "button",
                  onClick: _cache[3] || (_cache[3] = ($event) => tab.value = "assets")
                },
                [
                  createVNode(_sfc_main$b, {
                    name: "images",
                    size: 17
                  }),
                  _cache[30] || (_cache[30] = createTextVNode(
                    "选区资产 ",
                    -1
                    /* CACHED */
                  ))
                ],
                2
                /* CLASS */
              ),
              createBaseVNode("button", {
                class: "mda-settings-nav is-coming-soon",
                type: "button",
                onClick: showExperienceComingSoon
              }, [
                createVNode(_sfc_main$b, {
                  name: "book",
                  size: 17
                }),
                _cache[31] || (_cache[31] = createBaseVNode(
                  "span",
                  null,
                  "Experience",
                  -1
                  /* CACHED */
                )),
                _cache[32] || (_cache[32] = createBaseVNode(
                  "small",
                  null,
                  "开发中",
                  -1
                  /* CACHED */
                ))
              ]),
              createBaseVNode(
                "button",
                {
                  class: normalizeClass(["mda-settings-nav", { "is-active": tab.value === "project" }]),
                  type: "button",
                  onClick: _cache[4] || (_cache[4] = ($event) => tab.value = "project")
                },
                [
                  createVNode(_sfc_main$b, {
                    name: "folder",
                    size: 17
                  }),
                  _cache[33] || (_cache[33] = createTextVNode(
                    "项目摘要 ",
                    -1
                    /* CACHED */
                  ))
                ],
                2
                /* CLASS */
              ),
              _cache[37] || (_cache[37] = createBaseVNode(
                "div",
                { class: "mda-settings-group-label" },
                "扩展",
                -1
                /* CACHED */
              )),
              createBaseVNode(
                "button",
                {
                  class: normalizeClass(["mda-settings-nav", { "is-active": tab.value === "tools" }]),
                  type: "button",
                  onClick: _cache[5] || (_cache[5] = ($event) => tab.value = "tools")
                },
                [
                  createVNode(_sfc_main$b, {
                    name: "construct",
                    size: 17
                  }),
                  _cache[34] || (_cache[34] = createTextVNode(
                    "Tools / Resources ",
                    -1
                    /* CACHED */
                  ))
                ],
                2
                /* CLASS */
              )
            ])) : createCommentVNode("v-if", true),
            createBaseVNode("main", _hoisted_6, [
              isPage.value ? (openBlock(), createElementBlock("header", _hoisted_7, [
                createBaseVNode("div", null, [
                  createBaseVNode(
                    "span",
                    null,
                    toDisplayString(unref(PRODUCT_NAME)) + " 设置",
                    1
                    /* TEXT */
                  ),
                  createBaseVNode(
                    "strong",
                    null,
                    toDisplayString(activeTitle.value),
                    1
                    /* TEXT */
                  ),
                  createBaseVNode(
                    "em",
                    null,
                    toDisplayString(projectLabel.value),
                    1
                    /* TEXT */
                  )
                ]),
                createBaseVNode("button", {
                  class: "mda-settings-primary",
                  type: "button",
                  onClick: _cache[6] || (_cache[6] = ($event) => _ctx.$emit("select-project"))
                }, "选择源码")
              ])) : createCommentVNode("v-if", true),
              !isPage.value ? (openBlock(), createElementBlock("nav", _hoisted_8, [
                createBaseVNode("button", {
                  type: "button",
                  onClick: showExperienceComingSoon
                }, "Experience · 开发中"),
                createBaseVNode(
                  "button",
                  {
                    type: "button",
                    class: normalizeClass({ "is-active": tab.value === "tools" }),
                    onClick: _cache[7] || (_cache[7] = ($event) => tab.value = "tools")
                  },
                  "Tools",
                  2
                  /* CLASS */
                ),
                createBaseVNode(
                  "button",
                  {
                    type: "button",
                    class: normalizeClass({ "is-active": tab.value === "project" }),
                    onClick: _cache[8] || (_cache[8] = ($event) => tab.value = "project")
                  },
                  "项目摘要",
                  2
                  /* CLASS */
                )
              ])) : createCommentVNode("v-if", true),
              memoryDependent.value && unref(memory).loading ? (openBlock(), createElementBlock("div", _hoisted_9, "正在读取记忆...")) : memoryDependent.value && unref(memory).error && !unref(memory).snapshot ? (openBlock(), createElementBlock("div", _hoisted_10, [
                createBaseVNode(
                  "span",
                  null,
                  toDisplayString(unref(memory).error),
                  1
                  /* TEXT */
                ),
                createBaseVNode("button", {
                  type: "button",
                  onClick: _cache[9] || (_cache[9] = //@ts-ignore
                  (...args) => unref(memory).load && unref(memory).load(...args))
                }, "重试")
              ])) : (openBlock(), createElementBlock("section", _hoisted_11, [
                memoryDependent.value && (unref(memory).message || unref(memory).error) ? (openBlock(), createElementBlock(
                  "div",
                  {
                    key: 0,
                    class: normalizeClass(["mda-memory-feedback", { "is-error": !!unref(memory).error }])
                  },
                  toDisplayString(unref(memory).error || unref(memory).message),
                  3
                  /* TEXT, CLASS */
                )) : createCommentVNode("v-if", true),
                tab.value === "locator" ? (openBlock(), createElementBlock("div", _hoisted_12, [
                  createBaseVNode("div", _hoisted_13, [
                    _cache[38] || (_cache[38] = createBaseVNode(
                      "div",
                      null,
                      [
                        createBaseVNode("strong", null, "Locator 专用模型"),
                        createBaseVNode("p", null, "可选。使用成本更低的模型先定位源码，再把精确位置交给关联 Agent，可减少主 Agent 的检索轮次和 Token 消耗。未配置时由关联 Agent 完成定位和开发。")
                      ],
                      -1
                      /* CACHED */
                    )),
                    createBaseVNode(
                      "span",
                      {
                        class: normalizeClass({ "is-enabled": !!locatorSelectedModel.value })
                      },
                      toDisplayString(locatorSelectedModel.value ? "已启用" : "由 Agent 处理"),
                      3
                      /* TEXT, CLASS */
                    )
                  ]),
                  createBaseVNode("div", _hoisted_14, [
                    _cache[41] || (_cache[41] = createBaseVNode(
                      "span",
                      { class: "mda-locator-choice-label" },
                      "定位方式",
                      -1
                      /* CACHED */
                    )),
                    createBaseVNode("button", {
                      class: normalizeClass(["mda-locator-option", { "is-selected": !locatorSelectedId.value }]),
                      type: "button",
                      role: "radio",
                      "aria-checked": String(!locatorSelectedId.value),
                      onClick: _cache[10] || (_cache[10] = ($event) => chooseLocatorModel(""))
                    }, [..._cache[39] || (_cache[39] = [
                      createBaseVNode(
                        "i",
                        {
                          class: "mda-locator-radio",
                          "aria-hidden": "true"
                        },
                        null,
                        -1
                        /* CACHED */
                      ),
                      createBaseVNode(
                        "span",
                        null,
                        [
                          createBaseVNode("strong", null, "由开发 Agent 处理"),
                          createBaseVNode("small", null, "不单独运行 Locator 模型")
                        ],
                        -1
                        /* CACHED */
                      )
                    ])], 10, _hoisted_15),
                    (openBlock(true), createElementBlock(
                      Fragment,
                      null,
                      renderList(locatorModels.value, (item) => {
                        return openBlock(), createElementBlock("div", {
                          key: item.id,
                          class: "mda-locator-option-row"
                        }, [
                          createBaseVNode("button", {
                            class: normalizeClass(["mda-locator-option", { "is-selected": locatorSelectedId.value === item.id }]),
                            type: "button",
                            role: "radio",
                            "aria-checked": String(locatorSelectedId.value === item.id),
                            onClick: ($event) => chooseLocatorModel(item.id)
                          }, [
                            _cache[40] || (_cache[40] = createBaseVNode(
                              "i",
                              {
                                class: "mda-locator-radio",
                                "aria-hidden": "true"
                              },
                              null,
                              -1
                              /* CACHED */
                            )),
                            createBaseVNode("span", null, [
                              createBaseVNode(
                                "strong",
                                null,
                                toDisplayString(item.name),
                                1
                                /* TEXT */
                              ),
                              createBaseVNode(
                                "small",
                                null,
                                toDisplayString(item.model) + toDisplayString(item.endpoint ? ` · ${item.endpoint}` : ""),
                                1
                                /* TEXT */
                              )
                            ])
                          ], 10, _hoisted_16),
                          createBaseVNode("button", {
                            class: "mda-locator-option-edit",
                            type: "button",
                            "aria-label": `编辑 ${item.name}`,
                            title: `编辑 ${item.name}`,
                            onClick: ($event) => editLocatorModel(item)
                          }, [
                            createVNode(_sfc_main$b, {
                              name: "settings",
                              size: 17
                            })
                          ], 8, _hoisted_17)
                        ]);
                      }),
                      128
                      /* KEYED_FRAGMENT */
                    ))
                  ]),
                  createBaseVNode("div", _hoisted_18, [
                    createBaseVNode("button", {
                      type: "button",
                      onClick: _cache[11] || (_cache[11] = ($event) => editLocatorModel(null))
                    }, [
                      createVNode(_sfc_main$b, {
                        name: "add",
                        size: 16
                      }),
                      _cache[42] || (_cache[42] = createBaseVNode(
                        "span",
                        null,
                        "添加 Locator 模型",
                        -1
                        /* CACHED */
                      ))
                    ])
                  ])
                ])) : tab.value === "assets" ? (openBlock(), createElementBlock(
                  Fragment,
                  { key: 2 },
                  [
                    !selectionAssets.value.length ? (openBlock(), createElementBlock("div", _hoisted_19, "当前页面暂无选区资产。")) : (openBlock(), createElementBlock("div", _hoisted_20, [
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(selectionAssets.value, (asset) => {
                          return openBlock(), createElementBlock("article", {
                            key: asset.uid,
                            class: "mda-settings-asset"
                          }, [
                            asset.thumbnailUrl ? (openBlock(), createElementBlock(
                              "div",
                              {
                                key: 0,
                                class: "mda-settings-asset-thumb",
                                style: normalizeStyle(assetThumbStyle(asset))
                              },
                              null,
                              4
                              /* STYLE */
                            )) : (openBlock(), createElementBlock(
                              "div",
                              _hoisted_21,
                              toDisplayString(asset.index),
                              1
                              /* TEXT */
                            )),
                            createBaseVNode("div", _hoisted_22, [
                              createBaseVNode(
                                "strong",
                                null,
                                toDisplayString(asset.token),
                                1
                                /* TEXT */
                              ),
                              createBaseVNode(
                                "span",
                                null,
                                toDisplayString(asset.summary),
                                1
                                /* TEXT */
                              ),
                              createBaseVNode(
                                "code",
                                null,
                                toDisplayString(asset.selector || asset.className || asset.text || "-"),
                                1
                                /* TEXT */
                              )
                            ])
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ]))
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : tab.value === "experiences" ? (openBlock(), createElementBlock(
                  Fragment,
                  { key: 3 },
                  [
                    !experiences.value.length ? (openBlock(), createElementBlock("div", _hoisted_23, "当前项目暂无已保存 Experience。")) : (openBlock(), createElementBlock(
                      Fragment,
                      { key: 1 },
                      [
                        createBaseVNode("label", _hoisted_24, [
                          _cache[43] || (_cache[43] = createBaseVNode(
                            "span",
                            null,
                            "Experience",
                            -1
                            /* CACHED */
                          )),
                          withDirectives(createBaseVNode(
                            "select",
                            {
                              "onUpdate:modelValue": _cache[12] || (_cache[12] = ($event) => experienceId.value = $event)
                            },
                            [
                              (openBlock(true), createElementBlock(
                                Fragment,
                                null,
                                renderList(experiences.value, (experience) => {
                                  var _a3;
                                  return openBlock(), createElementBlock("option", {
                                    key: experience.componentPath,
                                    value: experience.componentPath
                                  }, toDisplayString(experience.name) + " · " + toDisplayString(((_a3 = experience.validation) == null ? void 0 : _a3.valid) ? "有效" : "已失效"), 9, _hoisted_25);
                                }),
                                128
                                /* KEYED_FRAGMENT */
                              ))
                            ],
                            512
                            /* NEED_PATCH */
                          ), [
                            [vModelSelect, experienceId.value]
                          ])
                        ]),
                        activeExperience.value ? (openBlock(), createElementBlock("div", _hoisted_26, [
                          createBaseVNode("label", _hoisted_27, [
                            _cache[44] || (_cache[44] = createBaseVNode(
                              "span",
                              null,
                              "名称",
                              -1
                              /* CACHED */
                            )),
                            withDirectives(createBaseVNode(
                              "input",
                              {
                                "onUpdate:modelValue": _cache[13] || (_cache[13] = ($event) => experienceDraft.name = $event),
                                type: "text"
                              },
                              null,
                              512
                              /* NEED_PATCH */
                            ), [
                              [vModelText, experienceDraft.name]
                            ])
                          ]),
                          createBaseVNode("label", _hoisted_28, [
                            _cache[45] || (_cache[45] = createBaseVNode(
                              "span",
                              null,
                              "公共能力路径",
                              -1
                              /* CACHED */
                            )),
                            createBaseVNode("input", {
                              value: activeExperience.value.componentPath,
                              type: "text",
                              disabled: ""
                            }, null, 8, _hoisted_29)
                          ]),
                          createBaseVNode("label", _hoisted_30, [
                            _cache[46] || (_cache[46] = createBaseVNode(
                              "span",
                              null,
                              "角色",
                              -1
                              /* CACHED */
                            )),
                            withDirectives(createBaseVNode(
                              "input",
                              {
                                "onUpdate:modelValue": _cache[14] || (_cache[14] = ($event) => experienceDraft.role = $event),
                                type: "text"
                              },
                              null,
                              512
                              /* NEED_PATCH */
                            ), [
                              [vModelText, experienceDraft.role]
                            ])
                          ]),
                          createBaseVNode("label", _hoisted_31, [
                            _cache[47] || (_cache[47] = createBaseVNode(
                              "span",
                              null,
                              [
                                createTextVNode("检索关键词 "),
                                createBaseVNode("small", null, "每行一个")
                              ],
                              -1
                              /* CACHED */
                            )),
                            withDirectives(createBaseVNode(
                              "textarea",
                              {
                                "onUpdate:modelValue": _cache[15] || (_cache[15] = ($event) => experienceDraft.keywords = $event),
                                rows: "4"
                              },
                              null,
                              512
                              /* NEED_PATCH */
                            ), [
                              [vModelText, experienceDraft.keywords]
                            ])
                          ]),
                          createBaseVNode("label", _hoisted_32, [
                            _cache[48] || (_cache[48] = createBaseVNode(
                              "span",
                              null,
                              [
                                createTextVNode("证据文件 "),
                                createBaseVNode("small", null, "每行一个；文件不存在时经验自动失效")
                              ],
                              -1
                              /* CACHED */
                            )),
                            withDirectives(createBaseVNode(
                              "textarea",
                              {
                                "onUpdate:modelValue": _cache[16] || (_cache[16] = ($event) => experienceDraft.usageFiles = $event),
                                rows: "5",
                                class: "is-code"
                              },
                              null,
                              512
                              /* NEED_PATCH */
                            ), [
                              [vModelText, experienceDraft.usageFiles]
                            ])
                          ]),
                          createBaseVNode("label", _hoisted_33, [
                            _cache[49] || (_cache[49] = createBaseVNode(
                              "span",
                              null,
                              [
                                createTextVNode("Experience 文档 "),
                                createBaseVNode("small", null, "Markdown")
                              ],
                              -1
                              /* CACHED */
                            )),
                            withDirectives(createBaseVNode(
                              "textarea",
                              {
                                "onUpdate:modelValue": _cache[17] || (_cache[17] = ($event) => experienceDraft.doc = $event),
                                rows: "18",
                                class: "is-code"
                              },
                              null,
                              512
                              /* NEED_PATCH */
                            ), [
                              [vModelText, experienceDraft.doc]
                            ])
                          ]),
                          createBaseVNode("div", _hoisted_34, [
                            createBaseVNode("button", {
                              class: "is-primary",
                              type: "button",
                              disabled: unref(memory).saving,
                              onClick: saveExperience
                            }, toDisplayString(unref(memory).saving ? "保存中..." : "保存 Experience"), 9, _hoisted_35)
                          ])
                        ])) : createCommentVNode("v-if", true)
                      ],
                      64
                      /* STABLE_FRAGMENT */
                    ))
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : tab.value === "tools" ? (openBlock(), createElementBlock(
                  Fragment,
                  { key: 4 },
                  [
                    !toolProviders.value.length && !resourceProviders.value.length && !tools.value.length && !resources.value.length ? (openBlock(), createElementBlock("div", _hoisted_36, "当前没有可用 Tool 或 Resource。")) : (openBlock(), createElementBlock("div", _hoisted_37, [
                      _cache[50] || (_cache[50] = createBaseVNode(
                        "div",
                        { class: "mda-memory-section-title" },
                        "Tool Providers",
                        -1
                        /* CACHED */
                      )),
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(toolProviders.value, (provider) => {
                          return openBlock(), createElementBlock("div", {
                            key: provider.id,
                            class: "mda-memory-provider"
                          }, [
                            createBaseVNode("div", null, [
                              createBaseVNode(
                                "strong",
                                null,
                                toDisplayString(provider.title || provider.id),
                                1
                                /* TEXT */
                              ),
                              createBaseVNode(
                                "small",
                                null,
                                toDisplayString(provider.id) + " · " + toDisplayString(provider.source || "builtin") + " · " + toDisplayString(provider.toolCount || 0) + " tools",
                                1
                                /* TEXT */
                              )
                            ]),
                            createBaseVNode(
                              "p",
                              null,
                              toDisplayString(provider.description),
                              1
                              /* TEXT */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      )),
                      _cache[51] || (_cache[51] = createBaseVNode(
                        "div",
                        { class: "mda-memory-section-title" },
                        "Tools",
                        -1
                        /* CACHED */
                      )),
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(tools.value, (tool) => {
                          return openBlock(), createElementBlock("div", {
                            key: tool.name,
                            class: "mda-memory-tool"
                          }, [
                            createBaseVNode("div", null, [
                              createBaseVNode(
                                "strong",
                                null,
                                toDisplayString(tool.name),
                                1
                                /* TEXT */
                              ),
                              createBaseVNode(
                                "small",
                                null,
                                toDisplayString(tool.providerId || tool.source || "builtin") + " · " + toDisplayString(tool.category) + " · " + toDisplayString(tool.access),
                                1
                                /* TEXT */
                              )
                            ]),
                            createBaseVNode(
                              "p",
                              null,
                              toDisplayString(tool.description),
                              1
                              /* TEXT */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      )),
                      _cache[52] || (_cache[52] = createBaseVNode(
                        "div",
                        { class: "mda-memory-section-title" },
                        "Resource Providers",
                        -1
                        /* CACHED */
                      )),
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(resourceProviders.value, (provider) => {
                          return openBlock(), createElementBlock("div", {
                            key: provider.id,
                            class: "mda-memory-provider"
                          }, [
                            createBaseVNode("div", null, [
                              createBaseVNode(
                                "strong",
                                null,
                                toDisplayString(provider.title || provider.id),
                                1
                                /* TEXT */
                              ),
                              createBaseVNode(
                                "small",
                                null,
                                toDisplayString(provider.id) + " · " + toDisplayString(provider.source || "builtin") + " · " + toDisplayString(provider.resourceCount || 0) + " resources",
                                1
                                /* TEXT */
                              )
                            ]),
                            createBaseVNode(
                              "p",
                              null,
                              toDisplayString(provider.description),
                              1
                              /* TEXT */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      )),
                      _cache[53] || (_cache[53] = createBaseVNode(
                        "div",
                        { class: "mda-memory-section-title" },
                        "Resources",
                        -1
                        /* CACHED */
                      )),
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(resources.value, (resource) => {
                          return openBlock(), createElementBlock("div", {
                            key: resource.uri,
                            class: "mda-memory-tool"
                          }, [
                            createBaseVNode("div", null, [
                              createBaseVNode(
                                "strong",
                                null,
                                toDisplayString(resource.name),
                                1
                                /* TEXT */
                              ),
                              createBaseVNode(
                                "small",
                                null,
                                toDisplayString(resource.providerId || "builtin") + " · " + toDisplayString(resource.category) + " · " + toDisplayString(resource.mimeType),
                                1
                                /* TEXT */
                              )
                            ]),
                            createBaseVNode(
                              "p",
                              null,
                              toDisplayString(resource.description),
                              1
                              /* TEXT */
                            )
                          ]);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ]))
                  ],
                  64
                  /* STABLE_FRAGMENT */
                )) : (openBlock(), createElementBlock(
                  Fragment,
                  { key: 5 },
                  [
                    _cache[54] || (_cache[54] = createBaseVNode(
                      "div",
                      { class: "mda-memory-project-note" },
                      "Project.md 由源码扫描和 Experience 索引自动生成，不在这里手工修改。",
                      -1
                      /* CACHED */
                    )),
                    createBaseVNode(
                      "pre",
                      _hoisted_38,
                      toDisplayString(((_a2 = unref(memory).snapshot) == null ? void 0 : _a2.projectDocument) || "暂无项目摘要。"),
                      1
                      /* TEXT */
                    )
                  ],
                  64
                  /* STABLE_FRAGMENT */
                ))
              ])),
              isPage.value && unref(appUi).toastText ? (openBlock(), createElementBlock(
                "div",
                _hoisted_39,
                toDisplayString(unref(appUi).toastText),
                1
                /* TEXT */
              )) : createCommentVNode("v-if", true)
            ])
          ]),
          (openBlock(), createBlock(Teleport, { to: "body" }, [
            locatorEditorExpanded.value ? (openBlock(), createElementBlock("div", {
              key: 0,
              class: "mda-model-modal",
              role: "presentation",
              onClick: _cache[26] || (_cache[26] = withModifiers(($event) => locatorEditorExpanded.value = false, ["self"]))
            }, [
              createBaseVNode("section", _hoisted_40, [
                createBaseVNode("header", _hoisted_41, [
                  _cache[55] || (_cache[55] = createBaseVNode(
                    "div",
                    null,
                    [
                      createBaseVNode("strong", null, "Locator 模型"),
                      createBaseVNode("p", null, "仅用于源码定位；保存后立即应用到当前页面。")
                    ],
                    -1
                    /* CACHED */
                  )),
                  createBaseVNode("button", {
                    class: "mda-model-close",
                    type: "button",
                    "aria-label": "关闭",
                    onClick: _cache[18] || (_cache[18] = ($event) => locatorEditorExpanded.value = false)
                  }, [
                    createVNode(_sfc_main$b, {
                      name: "close",
                      size: 18
                    })
                  ])
                ]),
                createBaseVNode("div", _hoisted_42, [
                  createBaseVNode("div", _hoisted_43, [
                    createBaseVNode("label", null, [
                      _cache[56] || (_cache[56] = createBaseVNode(
                        "span",
                        null,
                        "名称",
                        -1
                        /* CACHED */
                      )),
                      withDirectives(createBaseVNode(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[19] || (_cache[19] = ($event) => locatorForm.value.name = $event),
                          class: "mda-model-input",
                          type: "text"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [vModelText, locatorForm.value.name]
                      ])
                    ]),
                    createBaseVNode("label", null, [
                      _cache[58] || (_cache[58] = createBaseVNode(
                        "span",
                        null,
                        "Model",
                        -1
                        /* CACHED */
                      )),
                      withDirectives(createBaseVNode(
                        "select",
                        {
                          "onUpdate:modelValue": _cache[20] || (_cache[20] = ($event) => locatorForm.value.model = $event),
                          class: "mda-model-input"
                        },
                        [..._cache[57] || (_cache[57] = [
                          createBaseVNode(
                            "option",
                            { value: "deepseek-v4-pro" },
                            "deepseek-v4-pro",
                            -1
                            /* CACHED */
                          ),
                          createBaseVNode(
                            "option",
                            { value: "deepseek-v4-flash" },
                            "deepseek-v4-flash",
                            -1
                            /* CACHED */
                          )
                        ])],
                        512
                        /* NEED_PATCH */
                      ), [
                        [vModelSelect, locatorForm.value.model]
                      ])
                    ]),
                    createBaseVNode("label", _hoisted_44, [
                      _cache[59] || (_cache[59] = createBaseVNode(
                        "span",
                        null,
                        "Endpoint",
                        -1
                        /* CACHED */
                      )),
                      withDirectives(createBaseVNode(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[21] || (_cache[21] = ($event) => locatorForm.value.endpoint = $event),
                          class: "mda-model-input",
                          type: "text"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [vModelText, locatorForm.value.endpoint]
                      ])
                    ]),
                    createBaseVNode("label", _hoisted_45, [
                      _cache[60] || (_cache[60] = createBaseVNode(
                        "span",
                        null,
                        "API Key",
                        -1
                        /* CACHED */
                      )),
                      withDirectives(createBaseVNode(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[22] || (_cache[22] = ($event) => locatorForm.value.apiKey = $event),
                          class: "mda-model-input",
                          type: "password"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [vModelText, locatorForm.value.apiKey]
                      ])
                    ]),
                    createBaseVNode("label", _hoisted_46, [
                      _cache[61] || (_cache[61] = createBaseVNode(
                        "span",
                        null,
                        "代理地址",
                        -1
                        /* CACHED */
                      )),
                      withDirectives(createBaseVNode(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[23] || (_cache[23] = ($event) => locatorForm.value.proxyUrl = $event),
                          class: "mda-model-input",
                          type: "text",
                          placeholder: "可留空"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [vModelText, locatorForm.value.proxyUrl]
                      ])
                    ]),
                    createBaseVNode("label", null, [
                      _cache[62] || (_cache[62] = createBaseVNode(
                        "span",
                        null,
                        "超时（毫秒）",
                        -1
                        /* CACHED */
                      )),
                      withDirectives(createBaseVNode(
                        "input",
                        {
                          "onUpdate:modelValue": _cache[24] || (_cache[24] = ($event) => locatorForm.value.timeoutMs = $event),
                          class: "mda-model-input",
                          type: "number",
                          min: "5000",
                          step: "1000"
                        },
                        null,
                        512
                        /* NEED_PATCH */
                      ), [
                        [
                          vModelText,
                          locatorForm.value.timeoutMs,
                          void 0,
                          { number: true }
                        ]
                      ])
                    ])
                  ])
                ]),
                createBaseVNode("footer", _hoisted_47, [
                  locatorEditingId.value && locatorEditingId.value === locatorSelectedId.value ? (openBlock(), createElementBlock("button", {
                    key: 0,
                    class: "mda-model-delete",
                    type: "button",
                    onClick: removeLocatorModel
                  }, "删除")) : createCommentVNode("v-if", true),
                  createBaseVNode("button", {
                    type: "button",
                    onClick: _cache[25] || (_cache[25] = ($event) => locatorEditorExpanded.value = false)
                  }, "取消"),
                  createBaseVNode("button", {
                    class: "is-primary",
                    type: "button",
                    onClick: saveLocatorModel
                  }, "保存并启用")
                ])
              ])
            ])) : createCommentVNode("v-if", true)
          ]))
        ], 10, _hoisted_1$1)) : createCommentVNode("v-if", true);
      };
    }
  });
  const _hoisted_1 = { class: "mda-settings-page" };
  const _sfc_main$1 = /* @__PURE__ */ defineComponent({
    __name: "SettingsPage",
    props: {
      api: {}
    },
    setup(__props) {
      var _a2;
      const props = __props;
      const panelTicket = /* @__PURE__ */ ref("");
      const initialParams = new URLSearchParams(window.location.search);
      const initialRecent = readLatestPanelBinding() || {};
      const targetPageHref = /* @__PURE__ */ ref(initialParams.get("pageUrl") || ((_a2 = initialRecent == null ? void 0 : initialRecent.page) == null ? void 0 : _a2.url) || "");
      const runtime = {
        api: __spreadProps(__spreadValues({}, props.api), {
          sidePanel: false
        }),
        currentPageHref: targetPageHref,
        sidePanelConfig: computed(() => __spreadProps(__spreadValues({}, props.api.sidePanelConfig || {}), {
          panelTicket: panelTicket.value
        })),
        routePagePath: computed(() => window.location.pathname),
        pageHost: computed(() => "settings")
      };
      const state = createGoCaptureRuntimeState(runtime);
      const memory = useMemoryStore();
      const fileInputRef = state.source.fileInputRef;
      const onFileInputChange = state.source.onFileInputChange;
      onMounted(() => __async(this, null, function* () {
        yield ensurePanelTicket();
        state.bridge.connectSidePanelBridge();
        yield state.source.restoreSavedProject();
        yield refreshSelectionAssets();
        yield memory.load();
      }));
      onBeforeUnmount(() => {
        state.bridge.disconnectSidePanelBridge();
      });
      function goBack() {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        window.close();
      }
      function chooseProjectAndReload() {
        return __async(this, null, function* () {
          yield state.source.chooseProject();
          yield refreshSelectionAssets();
          yield memory.load();
        });
      }
      function refreshSelectionAssets() {
        return __async(this, null, function* () {
          var _a3;
          const projectRoot = ((_a3 = state.source.project.value) == null ? void 0 : _a3.path) || "";
          if (!projectRoot) return;
          const references = yield loadProjectSelectionReferences(projectRoot);
          state.selection.restoreLocationReferences(references, projectRoot);
        });
      }
      function ensurePanelTicket() {
        return __async(this, null, function* () {
          var _a3, _b, _c;
          if (panelTicket.value) return;
          const params = new URLSearchParams(window.location.search);
          const recent = readLatestPanelBinding() || {};
          const workspaceId = params.get("workspaceId") || recent.workspaceId || "";
          const tabId = Number(params.get("tabId") || recent.browserTabId || 0);
          const windowId = Number(params.get("windowId") || recent.windowId || 0);
          if (!workspaceId && !tabId) {
            panelTicket.value = params.get("panelTicket") || "";
            return;
          }
          const result = yield sourceServerJson("/api/panel/bind", {
            method: "POST",
            body: {
              workspaceId,
              tabId,
              windowId,
              page: recent.page || null
            },
            timeoutMs: 5e3,
            timeoutMessage: "设置页绑定当前页面超时"
          });
          panelTicket.value = (result == null ? void 0 : result.panelTicket) || "";
          const pageUrl = ((_b = (_a3 = result == null ? void 0 : result.snapshot) == null ? void 0 : _a3.page) == null ? void 0 : _b.url) || ((_c = recent == null ? void 0 : recent.page) == null ? void 0 : _c.url) || params.get("pageUrl") || "";
          if (pageUrl) targetPageHref.value = pageUrl;
        });
      }
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock("main", _hoisted_1, [
          createBaseVNode(
            "input",
            {
              ref_key: "fileInputRef",
              ref: fileInputRef,
              class: "mda-file-input",
              type: "file",
              webkitdirectory: "",
              multiple: "",
              onChange: _cache[0] || (_cache[0] = //@ts-ignore
              (...args) => unref(onFileInputChange) && unref(onFileInputChange)(...args))
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ),
          createVNode(_sfc_main$2, {
            mode: "page",
            "model-runtime": unref(state).model,
            onBack: goBack,
            onSelectProject: chooseProjectAndReload
          }, null, 8, ["model-runtime"])
        ]);
      };
    }
  });
  const _sfc_main = /* @__PURE__ */ defineComponent({
    __name: "App",
    props: {
      api: {}
    },
    setup(__props) {
      const isSettingsPage = computed(() => {
        return typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") === "/settings";
      });
      return (_ctx, _cache) => {
        return isSettingsPage.value ? (openBlock(), createBlock(_sfc_main$1, {
          key: 0,
          api: __props.api
        }, null, 8, ["api"])) : (openBlock(), createBlock(_sfc_main$3, {
          key: 1,
          api: __props.api
        }, null, 8, ["api"]));
      };
    }
  });
  function createGoCaptureStores(pinia) {
    return {
      appUiStore: useAppUiStore(pinia),
      chatStore: useChatStore(pinia),
      composerStore: useComposerStore(pinia),
      modelStore: useModelStore(pinia),
      projectStore: useProjectStore(pinia),
      requestStore: useRequestStore(pinia),
      routeStore: useRouteStore(pinia),
      searchStore: useSearchStore(pinia),
      selectionStore: useSelectionStore(pinia)
    };
  }
  function createRuntimeEventHandler(stores) {
    return function handleRuntimeEvent(event) {
      return __async(this, null, function* () {
        var _a2;
        switch (event.type) {
          case "selection.changed": {
            const payload = event.payload;
            const selections = Array.isArray(payload == null ? void 0 : payload.selections) ? payload.selections : (payload == null ? void 0 : payload.selection) ? [payload.selection] : [];
            const runtimeIds = new Set(selections.map((item) => {
              var _a3;
              return String((item == null ? void 0 : item.uid) || ((_a3 = item == null ? void 0 : item.element) == null ? void 0 : _a3.uid) || "");
            }).filter(Boolean));
            const retained = stores.selectionStore.items.filter((item) => item.sourceBinding && !runtimeIds.has(item.uid));
            stores.selectionStore.replaceSelections([
              ...selections,
              ...retained
            ]);
            break;
          }
          case "page.route_changed": {
            const payload = event.payload;
            stores.routeStore.setPage((payload == null ? void 0 : payload.url) || "", stores.routeStore.pagePath);
            const sourceBoundSelections = stores.selectionStore.items.filter((item) => item.sourceBinding);
            if (sourceBoundSelections.length !== stores.selectionStore.items.length) {
              stores.selectionStore.replaceSelections(sourceBoundSelections);
            }
            break;
          }
          case "page.context": {
            stores.projectStore.setPageContext(event.payload);
            break;
          }
          case "network.request": {
            stores.requestStore.remember(event.payload);
            break;
          }
          case "runtime.connected": {
            const payload = event.payload;
            stores.appUiStore.setRuntimeConnected(true);
            if ((_a2 = payload == null ? void 0 : payload.page) == null ? void 0 : _a2.url) stores.routeStore.setPage(payload.page.url, stores.routeStore.pagePath);
            break;
          }
        }
      });
    };
  }
  function createSendRequestUseCase(stores, runComposerWorkflow) {
    return function sendRequest() {
      return __async(this, null, function* () {
        stores.composerStore.setSending(true);
        try {
          yield runComposerWorkflow();
        } finally {
          stores.composerStore.setSending(false);
        }
      });
    };
  }
  function createGoCaptureBootstrap() {
    const pinia = createPinia();
    const stores = createGoCaptureStores(pinia);
    const handleRuntimeEvent = createRuntimeEventHandler(stores);
    return {
      pinia,
      stores,
      handleRuntimeEvent,
      createCommands(commands) {
        return __spreadProps(__spreadValues({}, commands), {
          sendRequest: createSendRequestUseCase(stores, commands.sendRequest)
        });
      }
    };
  }
  const styles = `:host {
  all: initial;
  color-scheme: light;
}

.mda-root,
.mda-root * {
  box-sizing: border-box;
}

.mda-root {
  position: fixed;
  inset: 0;
  background: #f7f8fa;
  pointer-events: auto;
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-panel {
  /* position: fixed; */
  position: relative;
  inset: 0;
  width: 100%;
  max-width: none;
  height: 100vh;
  background: #f7f8fa;
  color: #1f2328;
  border-left: 0;
  box-shadow: none;
  pointer-events: auto;
  overflow: hidden;
}

.mda-project-checking {
  position: absolute;
  inset: 56px 0 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(247, 248, 250, 0.78);
  backdrop-filter: blur(2px);
}

.mda-project-checking-box {
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(360px, 92%);
  padding: 16px;
  border: 1px solid #d8dee6;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.16);
}

.mda-project-checking-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid #dbe4ef;
  border-top-color: #2563eb;
  border-radius: 999px;
  animation: mda-spin 0.8s linear infinite;
  flex: 0 0 auto;
}

.mda-project-checking-title {
  font-weight: 700;
  color: #111827;
}

.mda-project-checking-text {
  margin-top: 3px;
  color: #667085;
  font-size: 12px;
  line-height: 1.45;
}

@keyframes mda-spin {
  to {
    transform: rotate(360deg);
  }
}

.mda-floating-note {
  position: fixed;
  z-index: 2147483647;
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid rgba(37, 99, 235, 0.55);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.2);
  pointer-events: auto;
  cursor: auto;
}

.mda-selection-highlight {
  position: fixed;
  z-index: 2147483643;
  border: 2px solid rgba(37, 99, 235, 0.88);
  border-radius: 4px;
  background: rgba(37, 99, 235, 0.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85), 0 0 0 4px rgba(37, 99, 235, 0.12);
  pointer-events: none;
}

.mda-selection-highlight.has-note {
  border-color: rgba(22, 163, 74, 0.9);
  background: rgba(22, 163, 74, 0.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85), 0 0 0 4px rgba(22, 163, 74, 0.13);
}

.mda-selection-highlight.is-editing {
  border-color: #111827;
  background: rgba(17, 24, 39, 0.08);
  box-shadow: 0 0 0 1px #ffffff, 0 0 0 5px rgba(17, 24, 39, 0.16);
}

.mda-change-badge {
  position: fixed;
  z-index: 2147483645;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #16a34a;
  color: #ffffff;
  font: 12px/22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  box-shadow: 0 8px 20px rgba(22, 163, 74, 0.28);
  cursor: pointer;
  pointer-events: auto;
  white-space: nowrap;
}

.mda-change-badge:hover {
  background: #15803d;
}

.mda-floating-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #111827;
  font-size: 12px;
  font-weight: 700;
}

.mda-floating-textarea {
  width: 100%;
  min-height: 72px;
  resize: vertical;
  border: 1px solid #cfd7e2;
  border-radius: 6px;
  padding: 7px 8px;
  background: #ffffff;
  color: #111827;
  outline: none;
  font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-floating-textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.mda-head {
  position: relative;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 88px 0 14px;
  background: #ffffff;
  border-bottom: 1px solid #d8dee6;
  cursor: default;
  user-select: none;
}

.mda-head-main {
  min-width: 0;
}

.mda-title {
  font-weight: 700;
  font-size: 14px;
  color: #15191f;
}

.mda-subtitle {
  margin-top: 1px;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #6b7280;
  font-size: 12px;
}

.mda-icon {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #4b5563;
  cursor: pointer;
  font-size: 17px;
  line-height: 26px;
}

.mda-icon:hover {
  background: #eef2f6;
  border-color: #d8dee6;
  color: #111827;
}

.mda-head-actions {
  position: absolute;
  top: 14px;
  right: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 3;
}

.mda-head-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #4b5563;
  cursor: pointer;
}

.mda-head-icon:hover {
  background: #eef2f6;
  color: #111827;
}

.mda-body {
  display: grid;
  align-content: start;
  gap: 10px;
  height: calc(100vh - 56px);
  padding: 12px;
  overflow: auto;
}

.mda-chat-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.mda-chat-thread {
  flex: 1 1 auto;
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 0;
  padding: 12px;
  overflow: auto;
}

.mda-chat-message {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.mda-chat-message.is-user {
  grid-template-columns: minmax(0, 1fr) 32px;
}

.mda-chat-message.is-user .mda-message-avatar {
  grid-column: 2;
  grid-row: 1;
  background: #2563eb;
}

.mda-chat-message.is-user .mda-message-bubble {
  grid-column: 1;
  justify-self: end;
  max-width: 86%;
  background: #e8f0ff;
  border-color: #b8cdfb;
}

.mda-chat-message.is-agent .mda-message-avatar {
  background: #0f766e;
  font-size: 11px;
}

.mda-chat-message.is-agent .mda-message-bubble {
  background: #f0fdfa;
  border-color: #99f6e4;
}

.mda-message-avatar {
  width: 34px;
  height: 24px;
  border-radius: 6px;
  background: #111827;
  color: #ffffff;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  line-height: 24px;
}

.mda-message-bubble {
  display: grid;
  gap: 7px;
  min-width: 0;
  padding: 10px;
  border: 1px solid #d8dee6;
  border-radius: 8px;
  background: #ffffff;
}

.mda-message-title {
  color: #111827;
  font-size: 13px;
  font-weight: 750;
}

.mda-message-text {
  color: #4b5563;
  font-size: 12px;
  white-space: pre-wrap;
}

.mda-message-pre {
  max-height: 280px;
  margin: 0;
  padding: 9px;
  overflow: auto;
  border-radius: 6px;
  background: #0f172a;
  color: #e5edf7;
  font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap;
}

.mda-message-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mda-composer-wrap {
  flex: 0 0 auto;
  display: grid;
  gap: 8px;
  padding: 6px 10px;
  border-top: 1px solid #d8dee6;
  background: #ffffff;
}

.mda-composer-options {
  display: grid;
  gap: 8px;
  padding: 9px;
  border: 1px solid #d8dee6;
  border-radius: 8px;
  background: #f8fafc;
}

.mda-composite {
  background: #f2f7ff;
  border-color: #c7dbf5;
}

.mda-composite-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.mda-composite-tag {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 4px;
  background: #e2e8f0;
  color: #475569;
  font-size: 11px;
}

.mda-composite-tag.mda-composite-render {
  background: #dbeafe;
  color: #1d4ed8;
}

.mda-composite-anchor {
  color: #94a3b8;
  font-size: 11px;
}

.mda-composite-line {
  color: #2563eb;
  font-weight: 600;
}

.mda-plan {
  background: #f6fdf7;
  border-color: #c7e8cf;
}

/* 修改计划正文限高滚动，避免内容过长挡住聊天区与输入框 */
.mda-plan-body {
  display: grid;
  gap: 8px;
  max-height: 38vh;
  overflow-y: auto;
}

/* 「定位与修改计划」整块模块：一个头部、一个收起开关，整块折叠 */
.mda-result-module {
  display: grid;
  gap: 8px;
}

.mda-result-module-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 2px 0;
}

.mda-result-module-title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.mda-result-module-body {
  display: grid;
  gap: 8px;
  max-height: 60vh;
  overflow-y: auto;
}

.mda-plan-summary {
  font-size: 12px;
  color: #14532d;
  font-weight: 600;
}

.mda-plan-block {
  display: grid;
  gap: 4px;
}

.mda-plan-block-title {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}

.mda-plan-target {
  display: grid;
  gap: 2px;
  padding: 4px 6px;
  border-left: 2px solid #86efac;
  background: #fff;
  border-radius: 4px;
}

.mda-plan-what,
.mda-plan-why {
  font-size: 12px;
  color: #334155;
}

.mda-plan-why {
  color: #94a3b8;
}

.mda-plan-line {
  font-size: 12px;
  color: #475569;
}

.mda-plan-check {
  display: grid;
  grid-template-columns: 16px 1fr;
  align-items: start;
  gap: 6px;
  padding: 5px 6px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  line-height: 1.45;
  color: #334155;
  cursor: pointer;
}

.mda-plan-check input {
  width: 14px;
  height: 14px;
  margin: 1px 0 0;
}

.mda-plan-check.is-checked {
  color: #64748b;
  background: #f8fafc;
}

.mda-plan-check.is-checked span {
  text-decoration: line-through;
}

.mda-composer-options.is-compact {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  border: 0;
  background: transparent;
}

.mda-model-select {
  max-width: 154px;
  height: 26px;
  min-width: 0;
  border: 1px solid #cfd7e2;
  border-radius: 6px;
  background: #ffffff;
  color: #344054;
  font: 12px/24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-model-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(2px);
}

.mda-model-editor {
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  max-height: min(720px, calc(100vh - 40px));
  overflow: hidden;
  border: 1px solid #e4e7ec;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 24px 64px rgba(16, 24, 40, 0.24);
  outline: none;
}

.mda-model-editor-head,
.mda-model-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mda-model-editor-head {
  flex: 0 0 auto;
  padding: 18px 20px 14px;
  border-bottom: 1px solid #eaecf0;
}

.mda-model-editor-head strong {
  color: #111827;
  font-size: 16px;
}

.mda-model-editor-head p {
  margin: 4px 0 0;
  color: #667085;
  font-size: 12px;
  line-height: 1.45;
}

.mda-model-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #667085;
  cursor: pointer;
  font: 24px/1 Arial, sans-serif;
}

.mda-model-close:hover {
  background: #f2f4f7;
  color: #101828;
}

.mda-model-editor-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 20px;
}

.mda-model-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.mda-model-grid label {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: #667085;
  font-size: 11px;
}

.mda-model-grid label.is-wide {
  grid-column: 1 / -1;
}

.mda-model-input {
  width: 100%;
  height: 30px;
  min-width: 0;
  border: 1px solid #cfd7e2;
  border-radius: 6px;
  padding: 0 8px;
  background: #ffffff;
  color: #111827;
  outline: none;
  font: 12px/28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-model-input:focus,
.mda-model-select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.mda-model-hint {
  margin: 12px 0 0;
  color: #667085;
  font-size: 11px;
  line-height: 1.4;
}

.mda-model-actions {
  flex: 0 0 auto;
  justify-content: flex-end;
  padding: 12px 20px;
  border-top: 1px solid #eaecf0;
  background: #f9fafb;
}

.mda-model-actions .mda-model-delete {
  margin-right: auto;
  color: #b42318;
}

.mda-model-actions button {
  height: 32px;
  padding: 0 12px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #fff;
  color: #344054;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.mda-model-actions button.is-primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

@media (max-width: 520px) {
  .mda-model-modal {
    align-items: flex-end;
    padding: 12px;
  }

  .mda-model-editor {
    max-height: calc(100vh - 24px);
  }

  .mda-model-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .mda-model-grid label.is-wide {
    grid-column: auto;
  }
}

.mda-option-title {
  color: #111827;
  font-size: 12px;
  font-weight: 700;
}

.mda-option-desc {
  color: #667085;
  font-size: 12px;
  line-height: 1.55;
}

.mda-choice-list {
  display: grid;
  gap: 7px;
  max-height: 300px;
  overflow: auto;
}

.mda-choice-card {
  display: grid;
  gap: 5px;
  padding: 8px;
  border: 1px solid #dbe3ee;
  border-radius: 7px;
  background: #ffffff;
}

.mda-choice-card.is-selected {
  border-color: #2563eb;
  background: #eff6ff;
}

.mda-choice-check {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 7px;
  align-items: center;
  min-width: 0;
  color: #111827;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.mda-choice-check input {
  width: 14px;
  height: 14px;
  margin: 0;
}

.mda-choice-check span,
.mda-file-link {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-file-link {
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.mda-file-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.mda-choice-meta {
  color: #64748b;
  font-size: 12px;
}

.mda-route-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 2px;
}

.mda-route-label {
  color: #667085;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.mda-route-file {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.mda-route-file:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.mda-route-empty {
  flex: 1 1 auto;
  min-width: 0;
  color: #98a2b3;
  font-size: 12px;
}

.mda-copy-icon {
  position: relative;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
}

.mda-copy-icon::before,
.mda-copy-icon::after {
  content: "";
  position: absolute;
  width: 9px;
  height: 10px;
  border: 1.5px solid #667085;
  border-radius: 2px;
}

.mda-copy-icon::before {
  top: 4px;
  left: 7px;
  background: #ffffff;
}

.mda-copy-icon::after {
  top: 7px;
  left: 4px;
  background: #ffffff;
}

.mda-copy-icon:hover {
  background: #f2f4f7;
}

.mda-copy-icon:hover::before,
.mda-copy-icon:hover::after {
  border-color: #101828;
}

.mda-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.mda-composer-input {
  width: 100%;
  height: 38px;
  min-width: 0;
  border: 1px solid #cfd7e2;
  border-radius: 8px;
  padding: 0 10px;
  background: #ffffff;
  color: #111827;
  outline: none;
  font: 13px/38px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-send-btn {
  height: 38px;
  padding: 0 13px;
  border: 1px solid #2563eb;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
}

.mda-send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mda-agent-body {
  gap: 12px;
}

.mda-agent-thread {
  display: grid;
  gap: 10px;
}

.mda-agent-message {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  padding: 10px;
  border: 1px solid #d8dee6;
  border-radius: 8px;
  background: #ffffff;
}

.mda-agent-avatar {
  width: 34px;
  height: 24px;
  border-radius: 6px;
  background: #111827;
  color: #ffffff;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  line-height: 24px;
}

.mda-agent-content {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.mda-agent-title {
  color: #111827;
  font-size: 13px;
  font-weight: 750;
}

.mda-agent-text {
  color: #4b5563;
  font-size: 12px;
}

.mda-agent-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mda-section {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #d8dee6;
  border-radius: 8px;
  background: #ffffff;
}

.mda-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.mda-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}

.mda-section-desc {
  margin-top: 2px;
  color: #6b7280;
  font-size: 12px;
}

.mda-toolbar,
.mda-copy-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mda-btn {
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #cfd7e2;
  border-radius: 6px;
  background: #ffffff;
  color: #263241;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  font-weight: 650;
  line-height: 30px;
  white-space: nowrap;
}

.mda-btn:hover {
  background: #f1f5f9;
}

.mda-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.mda-btn-primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.mda-btn-primary:hover {
  background: #1d4ed8;
}

.mda-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 99px;
  background: #9ca3af;
}

.mda-dot.is-active {
  background: #16a34a;
  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.14);
}

.mda-file-input {
  display: none;
}

.mda-empty {
  min-height: 48px;
  padding: 10px;
  border: 1px dashed #cfd7e2;
  border-radius: 6px;
  color: #6b7280;
  background: #f8fafc;
  font-size: 12px;
}

.mda-project {
  display: grid;
  gap: 6px;
}

.mda-project-name {
  font-weight: 700;
  color: #111827;
}

.mda-project-meta {
  color: #5b6573;
  font-size: 12px;
}

.mda-project-path {
  padding: 7px 8px;
  border-radius: 6px;
  background: #f1f5f9;
  color: #334155;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}

.mda-warning {
  padding: 8px 10px;
  border: 1px solid #f4c27a;
  border-radius: 6px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 12px;
}

.mda-request-summary {
  color: #5b6573;
  font-size: 12px;
}

.mda-search-input {
  width: 100%;
  min-height: 58px;
  resize: vertical;
  border: 1px solid #cfd7e2;
  border-radius: 6px;
  padding: 7px 8px;
  background: #ffffff;
  color: #111827;
  outline: none;
  font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-search-input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.mda-check-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4b5563;
  font-size: 12px;
}

.mda-check-row input {
  width: 14px;
  height: 14px;
  margin: 0;
}

.mda-candidate-list {
  display: grid;
  gap: 8px;
}

.mda-candidate-card {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  background: #fbfdff;
}

.mda-candidate-card.is-selected {
  border-color: #2563eb;
  background: #eff6ff;
}

.mda-candidate-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.mda-candidate-check {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 7px;
  align-items: center;
  min-width: 0;
}

.mda-candidate-check input {
  width: 14px;
  height: 14px;
  margin: 0;
}

.mda-candidate-head strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.mda-candidate-head span {
  height: 22px;
  min-width: 34px;
  padding: 0 8px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  text-align: center;
  font: 12px/22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.mda-candidate-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mda-candidate-stage {
  color: #64748b;
  font-size: 12px;
}

.mda-candidate-reasons span {
  max-width: 100%;
  padding: 3px 6px;
  border-radius: 999px;
  background: #eef2f6;
  color: #394454;
  font-size: 11px;
  line-height: 1.35;
}

.mda-candidate-snippet,
.mda-candidate-log {
  max-height: 150px;
  margin: 0;
  padding: 8px;
  overflow: auto;
  border-radius: 6px;
  background: #0f172a;
  color: #e5edf7;
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap;
}

.mda-log-file-label {
  flex: none;
}

.mda-log-file-link {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-log-file-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.mda-link-btn {
  justify-self: start;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  cursor: pointer;
  font: 12px/24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-link-btn:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.mda-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mda-tag {
  max-width: 180px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: #eef2f6;
  color: #394454;
  font: 12px/24px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-info {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.mda-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid #e2e8f0;
}

.mda-row:last-child {
  border-bottom: 0;
}

.mda-row span {
  color: #6b7280;
  font-size: 12px;
}

.mda-row strong {
  min-width: 0;
  color: #1f2937;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-selection-list {
  display: grid;
  gap: 8px;
}

.mda-selection-card {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  background: #fbfdff;
}

.mda-selection-card:hover {
  border-color: #9db8f8;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.mda-selection-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mda-selection-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #111827;
}

.mda-inline-badge {
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font: 11px/18px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-mini-btn {
  height: 24px;
  padding: 0 8px;
  border: 1px solid #cfd7e2;
  border-radius: 5px;
  background: #ffffff;
  color: #4b5563;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  line-height: 22px;
}

.mda-mini-btn:hover {
  background: #f1f5f9;
  color: #111827;
}

.mda-selection-meta {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 8px;
  color: #5b6573;
  font-size: 12px;
}

.mda-selection-meta span {
  font-weight: 700;
}

.mda-selection-meta strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #1f2937;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.mda-selection-text {
  max-height: 44px;
  overflow: auto;
  color: #4b5563;
  font-size: 12px;
}

.mda-note {
  min-height: 74px;
  resize: vertical;
}

.mda-textarea,
.mda-prompt {
  width: 100%;
  min-width: 0;
  resize: vertical;
  border: 1px solid #cfd7e2;
  border-radius: 6px;
  padding: 9px 10px;
  background: #ffffff;
  color: #111827;
  outline: none;
  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-textarea:focus,
.mda-prompt:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.mda-prompt {
  min-height: 230px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.mda-toast {
  flex: 1 1 auto;
  min-width: 0;
  color: #047857;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Codex-like chat surface overrides. */
.mda-panel {
  width: 100%;
  /* max-width: min(440px, calc(100vw - 18px)); */
  background: #ffffff;
  border-left-color: #e5e7eb;
  box-shadow: -12px 0 28px rgba(15, 23, 42, 0.14);
}

.mda-head {
  height: 52px;
  padding: 0 12px 0 16px;
  border-bottom-color: #eceff3;
  background: #ffffff;
}

.mda-title {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 680;
}

.mda-title-wordmark {
  color: #111827;
  font-size: 17px;
  font-weight: 760;
  line-height: 1;
  letter-spacing: 0;
}

.mda-subtitle {
  max-width: 306px;
  color: #667085;
}

.mda-chat-body {
  background: #ffffff;
}

.mda-chat-thread {
  gap: 14px;
  padding: 16px 14px 18px;
  background: #ffffff;
}

.mda-chat-message,
.mda-chat-message.is-user {
  display: flex;
  gap: 9px;
  align-items: flex-start;
}

.mda-chat-message.is-user {
  justify-content: flex-end;
}

.mda-message-avatar {
  flex: 0 0 auto;
  width: auto;
  min-width: 34px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: #f2f4f7;
  color: #344054;
  font-size: 11px;
  font-weight: 650;
  line-height: 22px;
}

.mda-chat-message.is-user .mda-message-avatar {
  display: none;
}

.mda-chat-message.is-agent .mda-message-avatar {
  color: #fff;
}

.mda-message-bubble {
  gap: 6px;
  max-width: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.mda-message-work {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
}

.mda-message-log-copy {
  display: inline-grid;
  width: 26px;
  height: 26px;
  margin-left: auto;
  padding: 0;
  place-items: center;
  border: 0;
  background: transparent;
  color: #667085;
  cursor: pointer;
}

.mda-message-log-copy:hover {
  color: #101828;
}

.mda-message-work-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #667085;
  cursor: pointer;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-message-work-label {
  color: #667085;
  font-size: 12px;
  font-weight: 500;
}

.mda-message-work-caret {
  width: 8px;
  height: 8px;
  border-right: 1.5px solid #98a2b3;
  border-bottom: 1.5px solid #98a2b3;
  transform: rotate(45deg) translateY(-1px);
  transition: transform 160ms ease;
}

.mda-message-work-caret.is-open {
  transform: rotate(225deg) translateY(-1px);
}

.mda-message-logs {
  min-width: 0;
}

.mda-log-chain {
  display: grid;
  min-width: 0;
  padding: 4px 0 2px 5px;
}

.mda-log-node {
  --mda-log-color: #98a2b3;
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  min-width: 0;
  padding-bottom: 8px;
}

.mda-log-node:not(:last-child)::before {
  position: absolute;
  top: 12px;
  bottom: -4px;
  left: 5px;
  width: 1px;
  background: #d0d5dd;
  content: '';
}

.mda-log-node-marker {
  position: relative;
  z-index: 1;
  width: 9px;
  height: 9px;
  margin-top: 8px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--mda-log-color);
  box-shadow: 0 0 0 1px var(--mda-log-color);
}

.mda-log-node.is-llm-input,
.mda-log-node.is-llm-output {
  --mda-log-color: #4f7ff0;
}

.mda-log-node.is-tool-call,
.mda-log-node.is-tool-result {
  --mda-log-color: #32a676;
}

.mda-log-node.is-decision {
  --mda-log-color: #8b5bd6;
}

.mda-log-node.is-error {
  --mda-log-color: #e5484d;
}

.mda-log-node-body {
  min-width: 0;
}

.mda-log-node-head {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 25px;
  align-items: center;
  gap: 7px;
  padding: 3px 5px;
  border: 0;
  background: transparent;
  color: #344054;
  text-align: left;
}

.mda-log-node-head.is-expandable {
  cursor: pointer;
}

.mda-log-node-head.is-expandable:hover {
  background: #f8fafc;
}

.mda-log-node-actor {
  flex: 0 0 auto;
  color: var(--mda-log-color);
  font-size: 11px;
  font-weight: 700;
}

.mda-log-node-title {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-log-node-head .mda-message-work-caret {
  flex: 0 0 auto;
  margin-left: auto;
}

.mda-message-log-item {
  color: #667085;
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
}

.mda-message-log-pre {
  max-height: 360px;
  margin: 0;
  padding: 8px 9px;
  overflow: auto;
  border: 1px solid #e4e7ec;
  border-radius: 6px;
  background: #ffffff;
  color: #344054;
  font: 11px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap;
}

.mda-message-log-item.is-candidate-log {
  display: flex;
  gap: 4px;
  align-items: baseline;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #d0d5dd;
  border-radius: 10px;
  background: #f8fafc;
  color: #344054;
  font-weight: 650;
}

.mda-message-content {
  display: grid;
  gap: 6px;
}

.mda-message-time {
  justify-self: end;
  margin-top: 2px;
  color: #98a2b3;
  font-size: 10px;
  font-weight: 400;
  line-height: 1.2;
}

.mda-message-content.has-work {
  padding-top: 10px;
  border-top: 1px solid #eaecf0;
}

.mda-chat-message.is-agent .mda-message-bubble {
  display: grid;
  gap: 8px;
  padding: 10px 11px;
  border: 1px solid #99f6e4;
  border-radius: 12px;
  background: #f0fdfa;
}

.mda-chat-message.is-user .mda-message-bubble {
  max-width: 86%;
  padding: 9px 11px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #f6f7f9;
}

.mda-message-title {
  color: #101828;
  font-size: 13px;
  font-weight: 680;
}

.mda-message-text {
  color: #344054;
  font-size: 12px;
  line-height: 1.55;
}

.mda-message-pre {
  max-height: 320px;
  border: 1px solid #e4e7ec;
  border-radius: 10px;
  background: #101828;
  color: #f2f4f7;
}

.mda-composer-wrap {
  gap: 10px;
  padding: 12px;
  border-top-color: #eceff3;
  background: #ffffff;
}

.mda-composer-options {
  gap: 8px;
  padding: 10px;
  border-color: #e4e7ec;
  border-radius: 12px;
  background: #f9fafb;
}

.mda-collapsible-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.mda-collapse-btn {
  flex: 0 0 auto;
  height: 24px;
  padding: 0 8px;
  border: 1px solid #d0d5dd;
  border-radius: 7px;
  background: #ffffff;
  color: #344054;
  cursor: pointer;
  font: 12px/22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-collapse-btn:hover {
  background: #f2f4f7;
  color: #101828;
}

.mda-collapsed-summary {
  min-width: 0;
  overflow: hidden;
  color: #667085;
  font-size: 12px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-composer-options.is-compact {
  padding: 0 2px;
}

.mda-choice-list {
  gap: 8px;
  max-height: 260px;
}

.mda-choice-card {
  gap: 6px;
  padding: 9px;
  border-color: #e4e7ec;
  border-radius: 10px;
  background: #ffffff;
}

.mda-choice-card.is-selected {
  border-color: #98a2b3;
  background: #f2f4f7;
}

.mda-choice-check {
  color: #101828;
}

.mda-choice-meta {
  color: #667085;
}

.mda-composer {
  gap: 9px;
  align-items: end;
  padding: 9px;
  border: 1px solid #d0d5dd;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);
}

.mda-composer-input {
  height: 34px;
  border: 0;
  border-radius: 0;
  padding: 0 2px;
  background: transparent;
  color: #101828;
  font-size: 13px;
  line-height: 34px;
}

.mda-composer-input:not([readonly]) {
  cursor: text;
}

.mda-send-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 34px;
  padding: 0;
  border-color: #101828;
  border-radius: 11px;
  background: #101828;
  font-weight: 650;
}

.mda-send-btn:not(:disabled):hover {
  background: #1d2939;
}

.mda-btn-primary {
  border-color: #101828;
  background: #101828;
}

.mda-btn-primary:hover {
  background: #1d2939;
}

.mda-link-btn {
  color: #344054;
}

.mda-link-btn:hover {
  color: #101828;
}

.mda-composer-prebar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 28px;
  /* padding: 8px 8px 10px 6px; */
  overflow: visible;
}

.mda-composer-prebar-main {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-end;
  gap: 8px;
  min-width: 0;
  overflow: visible;
}

.mda-asset-strip {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 0;
  min-width: 0;
  padding: 10px 10px 12px 10px;
  overflow: visible;
  isolation: isolate;
}

.mda-asset-card {
  position: relative;
  flex: 0 0 auto;
  width: 62px;
  height: 84px;
  margin-left: -62px;
  overflow: visible;
  z-index: 1;
  transition: margin-left 180ms ease;
}

.mda-asset-card:first-child {
  margin-left: 0;
}

.mda-asset-strip:hover .mda-asset-card {
  margin-left: 10px;
}

.mda-asset-strip:hover .mda-asset-card:first-child {
  margin-left: 0;
}

.mda-asset-card:hover {
  z-index: 40;
}

.mda-asset-card:nth-child(6n + 1) .mda-asset-chip {
  --mda-asset-rotate: -9deg;
}

.mda-asset-card:nth-child(6n + 2) .mda-asset-chip {
  --mda-asset-rotate: 6deg;
}

.mda-asset-card:nth-child(6n + 3) .mda-asset-chip {
  --mda-asset-rotate: -4deg;
}

.mda-asset-card:nth-child(6n + 4) .mda-asset-chip {
  --mda-asset-rotate: 9deg;
}

.mda-asset-card:nth-child(6n + 5) .mda-asset-chip {
  --mda-asset-rotate: -7deg;
}

.mda-asset-card:nth-child(6n + 6) .mda-asset-chip {
  --mda-asset-rotate: 4deg;
}

.mda-asset-chip {
  position: relative;
  display: block;
  width: 62px;
  height: 84px;
  padding: 4px 4px 10px;
  border: 0;
  border-radius: 3px;
  background: #ffffff;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.16);
  cursor: pointer;
  overflow: visible;
  transform: translateY(0) rotate(var(--mda-asset-rotate, -4deg));
  transform-origin: center bottom;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.mda-asset-thumb {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 1px;
  background: #e5e7eb center center / cover no-repeat;
  background-size: contain;
  background-position: center;
  color: #667085;
  font: 12px/70px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  text-align: center;
}

.mda-asset-thumb.is-empty {
  background-image: linear-gradient(135deg, #eef2ff, #e2e8f0);
}

.mda-asset-chip:hover {
  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.22);
  transform: translateY(-4px) rotate(0deg);
}

.mda-asset-remove {
  position: absolute;
  top: -10px;
  right: -10px;
  z-index: 45;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #20252d;
  color: #f8fafc;
  font: 16px/26px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.28);
  transition: opacity 160ms ease, transform 160ms ease;
  transform: translateY(4px);
}

.mda-asset-card:hover .mda-asset-remove,
.mda-asset-card:focus-within .mda-asset-remove,
.mda-asset-chip:hover .mda-asset-remove,
.mda-asset-chip:focus .mda-asset-remove {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.mda-asset-remove:hover {
  background: #111827;
}

.mda-popover-panel {
  position: fixed;
  z-index: 2147483647;
  display: block;
  min-width: 0;
  min-height: 72px;
  overflow: auto;
  border: 1px solid #d0d5dd;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.99);
  color: #101828;
  box-shadow: 0 18px 44px rgba(16, 24, 40, 0.18);
  backdrop-filter: blur(10px);
  pointer-events: auto;
}

.mda-asset-popover {
  display: grid;
  gap: 10px;
  padding: 12px;
  min-width: 0;
}

.mda-asset-popover-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.mda-asset-popover-badge {
  flex: 0 0 auto;
  min-width: 0;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #e0edff;
  color: #1d4ed8;
  font: 11px/22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.mda-asset-popover-title-wrap {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.mda-asset-popover-title {
  color: #101828;
  font-size: 12px;
  font-weight: 700;
}

.mda-asset-popover-subtitle {
  color: #667085;
  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}

.mda-asset-popover-grid {
  display: grid;
  gap: 8px;
}

.mda-asset-popover-grid-item,
.mda-asset-popover-section {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.mda-asset-popover-grid-item span,
.mda-asset-popover-section span {
  color: #475467;
  font-size: 11px;
  font-weight: 650;
}

.mda-asset-popover-grid-item pre,
.mda-asset-popover-section pre {
  margin: 0;
  padding: 7px 8px;
  overflow: auto;
  border-radius: 8px;
  background: #f8fafc;
  color: #344054;
  font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.mda-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
  padding: 10px 12px;
  border: 1px solid #d9dee7;
  border-radius: 20px;
  background: #ffffff;
  box-shadow: 0 2px 10px rgba(16, 24, 40, 0.08);
}

.mda-composer-input {
  display: block;
  width: 100%;
  min-height: 72px;
  max-height: 184px;
  border: 0;
  border-radius: 0;
  padding: 4px 2px 0;
  background: transparent;
  color: #101828;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  overflow: auto;
  white-space: pre-wrap;
  outline: none;
}

.mda-composer-shortcut {
  display: grid;
  gap: 5px;
  max-height: 188px;
  padding-top: 6px;
  overflow: auto;
  border-top: 1px solid #eef2f6;
}

.mda-composer-shortcut-item {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 0;
  border-radius: 12px;
  background: #f8fafc;
  color: #101828;
  text-align: left;
  cursor: pointer;
}

.mda-composer-shortcut-item.is-active,
.mda-composer-shortcut-item:hover {
  background: #eaf2ff;
}

.mda-composer-shortcut-thumb {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #e5e7eb center center / cover no-repeat;
  color: #667085;
  font: 12px/34px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  text-align: center;
}

.mda-composer-shortcut-thumb.is-empty {
  background-image: linear-gradient(135deg, #eef2ff, #e2e8f0);
}

.mda-composer-shortcut-meta {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.mda-composer-shortcut-meta strong {
  color: #1d4ed8;
  font: 12px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.mda-composer-shortcut-meta em {
  overflow: hidden;
  color: #667085;
  font-style: normal;
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-composer-shortcut-empty {
  padding: 6px 2px 2px;
  color: #98a2b3;
  font-size: 12px;
}

.mda-composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.mda-toolbar-left,
.mda-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mda-toolbar-left {
  flex: 1 1 auto;
}

.mda-toolbar-right {
  flex: 0 0 auto;
}

.mda-add-menu {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
}

.mda-add-trigger {
  display: inline-grid;
  width: 30px;
  height: 30px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: #f2f4f7;
  color: #344054;
  cursor: pointer;
}

.mda-add-trigger:hover,
.mda-add-trigger[aria-expanded="true"] {
  background: #e7ebf0;
  color: #101828;
}

.mda-add-panel {
  display: grid;
  gap: 4px;
  padding: 12px;
}

.mda-add-panel-title {
  padding: 0 6px 8px;
  color: #98a2b3;
  font-size: 13px;
  font-weight: 650;
}

.mda-add-section-title {
  padding: 8px 6px 5px;
  color: #667085;
  font-size: 12px;
  font-weight: 700;
}

.mda-connect-agent-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #101828;
  text-align: left;
  cursor: pointer;
}

.mda-connect-agent-row:hover:not(:disabled) {
  background: #f2f4f7;
}

.mda-connect-agent-row:disabled {
  cursor: wait;
}

.mda-connect-agent-icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 7px;
  background: #101828;
  color: #ffffff;
  font: 700 15px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.mda-connect-agent-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.mda-connect-agent-copy strong {
  font-size: 14px;
  font-weight: 720;
}

.mda-connect-agent-copy span {
  overflow: hidden;
  color: #667085;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-connect-agent-action {
  color: #175cd3;
  font-size: 12px;
  font-weight: 700;
}

.mda-connect-agent-action.is-connected {
  color: #067647;
}

.mda-connect-agent-action.is-unavailable,
.mda-connect-agent-action.is-login-required,
.mda-connect-agent-action.is-error {
  color: #b42318;
}

.mda-connect-agent-error {
  margin: 5px 6px 0;
  padding: 8px 10px;
  border-radius: 7px;
  background: #fef3f2;
  color: #b42318;
  font-size: 12px;
  line-height: 1.5;
}

/* Claude Code 授权表单 */
.mda-cca-auth {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  margin: 4px 6px 8px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(15, 23, 42, 0.03);
}
.mda-cca-tabs {
  display: flex;
  padding: 2px;
  gap: 2px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
}
.mda-cca-tab {
  flex: 1;
  padding: 5px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(15, 23, 42, 0.6);
  font-size: 12px;
  line-height: 1.4;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.mda-cca-tab.is-active {
  background: #fff;
  color: var(--primary-color, #0091ff);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
  font-weight: 600;
}
.mda-cca-input {
  width: 100%;
  box-sizing: border-box;
  height: 32px;
  padding: 0 10px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 8px;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}
.mda-cca-input:focus {
  border-color: var(--primary-color, #0091ff);
}
.mda-cca-hint {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(15, 23, 42, 0.5);
}
.mda-cca-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.mda-cca-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.mda-cca-btn.is-primary {
  background: var(--primary-color, #0091ff);
  color: #fff;
}
.mda-cca-btn.is-ghost {
  background: transparent;
  color: rgba(15, 23, 42, 0.55);
}
.mda-cca-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.mda-tool-icon-btn,
.mda-send-btn {
  flex: 0 0 auto;
}

.mda-tool-icon-btn {
  position: relative;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #667085;
  cursor: pointer;
}

.mda-tool-icon-btn::before,
.mda-tool-icon-btn::after {
  content: "";
  position: absolute;
  left: 8px;
  right: 8px;
  top: 14px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

.mda-tool-icon-btn::after {
  transform: rotate(90deg);
}

.mda-tool-icon-btn:hover {
  background: #f2f4f7;
  color: #101828;
}

.mda-tool-icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mda-assist-chip,
.mda-inline-text-btn,
.mda-model-trigger {
  height: 28px;
  border: 0;
  background: transparent;
  color: #344054;
  font: 12px/28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-assist-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 4px;
  color: #344054;
  cursor: pointer;
}

.mda-assist-chip.is-active {
  color: #1d87f5;
}

.mda-assist-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mda-chip-shield {
  position: relative;
  width: 17px;
  height: 17px;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}

.mda-chip-shield::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 2px;
  width: 3px;
  height: 8px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(38deg);
}

.mda-inline-text-btn {
  max-width: 90px;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 31px;
}

.mda-inline-text-btn:hover {
  color: #101828;
}

.mda-project-config-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  margin-top: 10px;
}

.mda-project-config-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-width: 0;
  min-height: 68px;
  padding: 11px 13px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #fff;
  color: #475467;
  text-align: left;
  cursor: pointer;
}

.mda-project-config-card:hover {
  border-color: #98a2b3;
  background: #f9fafb;
}

.mda-project-config-card.is-locator-step {
  border-left: 3px solid #1677ff;
  background: #f8fbff;
}

.mda-project-config-main {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.mda-project-config-card strong,
.mda-project-config-card small,
.mda-project-config-card em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-project-config-card strong {
  color: #101828;
  font-size: 12px;
}

.mda-project-config-card small {
  color: #667085;
  font-size: 10px;
}

.mda-project-config-card em {
  color: #667085;
  font-size: 10px;
  font-style: normal;
}

.mda-project-config-card.is-locator-step em {
  color: #1677ff;
}

.mda-project-config-card b {
  color: #1677ff;
  font-size: 11px;
  font-weight: 600;
}

.mda-locator-card-help {
  position: relative;
  display: inline-flex;
  grid-column: 1 / -1;
  justify-self: end;
  align-items: center;
  color: #1677ff;
  font-size: 11px;
  font-weight: 400;
  cursor: help;
  outline: none;
}

.mda-locator-card-help:hover {
  color: #0958d9;
  text-decoration: underline;
}

.mda-locator-help-tip {
  position: absolute;
  right: 0;
  bottom: calc(100% + 8px);
  z-index: 30;
  width: min(300px, calc(100vw - 48px));
  padding: 9px 11px;
  border-radius: 6px;
  background: #101828;
  color: #ffffff;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity 120ms ease, transform 120ms ease;
}

.mda-locator-card-help:hover .mda-locator-help-tip,
.mda-project-config-card.is-locator-step:focus-visible .mda-locator-help-tip {
  opacity: 1;
  transform: translateY(0);
}

.mda-build-version {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  line-height: 31px;
  color: #98a2b3;
  white-space: nowrap;
  user-select: text;
}

.mda-model-menu {
  position: relative;
  flex: 0 0 auto;
}

.mda-model-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 160px;
  min-width: 0;
  padding: 0 2px;
  color: #101828;
  cursor: pointer;
}

.mda-model-trigger.is-active {
  color: #1d4ed8;
}

.mda-model-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.mda-model-trigger strong,
.mda-model-trigger em {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-model-trigger strong {
  font-size: 12px;
  font-weight: 650;
}

.mda-model-trigger em {
  color: #667085;
  font-style: normal;
  font-weight: 650;
}

.mda-model-trigger i {
  width: 9px;
  height: 9px;
  border-right: 2px solid #667085;
  border-bottom: 2px solid #667085;
  transform: rotate(45deg) translateY(-2px);
}

.mda-model-dropdown {
  position: absolute;
  right: -8px;
  bottom: calc(100% + 10px);
  z-index: 40;
  display: grid;
  gap: 4px;
  width: 220px;
  padding: 10px;
  border: 1px solid #e4e7ec;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 40px rgba(16, 24, 40, 0.16);
  backdrop-filter: blur(12px);
}

.mda-model-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  min-height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #101828;
  cursor: pointer;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  text-align: left;
}

.mda-model-option:hover,
.mda-model-option.is-selected {
  background: #f5f7fb;
}

.mda-model-option.is-selected::after {
  content: "";
  flex: 0 0 auto;
  width: 6px;
  height: 10px;
  margin-left: 4px;
  border-right: 2px solid #111827;
  border-bottom: 2px solid #111827;
  transform: rotate(45deg);
}

.mda-model-option span,
.mda-model-option em {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-model-option span {
  font-size: 12px;
  font-weight: 650;
}

.mda-model-option em {
  color: #667085;
  font-style: normal;
}

.mda-model-divider {
  height: 1px;
  margin: 4px 2px;
  background: #eceff3;
}

.mda-send-btn {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #161b22;
  color: #ffffff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.mda-send-arrow {
  position: relative;
  width: 16px;
  height: 16px;
}

.mda-send-arrow::before {
  content: "";
  position: absolute;
  left: 7px;
  top: 3px;
  width: 2px;
  height: 12px;
  border-radius: 999px;
  background: #ffffff;
}

.mda-send-arrow::after {
  content: "";
  position: absolute;
  left: 3px;
  top: 2px;
  width: 8px;
  height: 8px;
  border-top: 2px solid #ffffff;
  border-left: 2px solid #ffffff;
  transform: rotate(45deg);
}

.mda-send-btn:not(:disabled):hover {
  background: #1f2937;
}

.mda-send-btn.is-stopping {
  border-color: #101828;
  background: #101828;
  color: #ffffff;
  opacity: 0.72;
}

.mda-send-btn.is-stopping:not(:disabled):hover {
  background: #101828;
  opacity: 0.86;
}

.mda-stop-icon {
  display: block;
  width: 13px;
  height: 13px;
  border-radius: 3px;
  background: currentColor;
}

.mda-send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 460px) {
  .mda-composer-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .mda-toolbar-left,
  .mda-toolbar-right {
    width: 100%;
    justify-content: space-between;
  }

  .mda-model-trigger {
    max-width: 140px;
  }

  .mda-model-dropdown {
    right: 0;
    width: min(220px, calc(100vw - 40px));
  }
}

.mda-floating-note {
  border-color: #d0d5dd;
  border-radius: 12px;
  box-shadow: 0 18px 44px rgba(16, 24, 40, 0.22);
}

.mda-floating-textarea {
  border-color: #d0d5dd;
  border-radius: 9px;
}

.mda-floating-textarea:focus {
  border-color: #101828;
  box-shadow: 0 0 0 3px rgba(16, 24, 40, 0.1);
}

.mda-settings-trigger {
  flex: 0 0 auto;
  font-size: 16px;
}

.mda-memory-shell {
  position: absolute;
  z-index: 50;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #f7f8fa;
  color: #1f2328;
}

.mda-memory-head {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px 8px 14px;
  border-bottom: 1px solid #d8dee6;
  background: #ffffff;
}

.mda-memory-head > div {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.mda-memory-head strong {
  font-size: 14px;
}

.mda-memory-head span {
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-memory-close {
  font-size: 21px;
}

.mda-memory-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-bottom: 1px solid #d8dee6;
  background: #ffffff;
}

.mda-memory-tabs button {
  min-width: 0;
  height: 38px;
  padding: 0 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #667085;
  cursor: pointer;
  font-size: 12px;
}

.mda-memory-tabs button:hover {
  color: #111827;
  background: #f8fafc;
}

.mda-memory-tabs button.is-active {
  border-bottom-color: #2563eb;
  color: #111827;
  font-weight: 700;
}

.mda-memory-body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 14px;
  overflow: auto;
}

.mda-memory-feedback {
  margin-bottom: 12px;
  padding: 8px 10px;
  border: 1px solid #abefc6;
  border-radius: 6px;
  background: #ecfdf3;
  color: #067647;
  font-size: 12px;
}

.mda-memory-feedback.is-error {
  border-color: #fecdca;
  background: #fef3f2;
  color: #b42318;
}

.mda-memory-state,
.mda-memory-empty {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 180px;
  padding: 24px;
  color: #667085;
  text-align: center;
}

.mda-memory-state.is-error {
  color: #b42318;
}

.mda-memory-state button {
  height: 30px;
  padding: 0 12px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #ffffff;
  cursor: pointer;
}

.mda-memory-form {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.mda-memory-field {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.mda-memory-field > span {
  color: #344054;
  font-size: 12px;
  font-weight: 650;
}

.mda-memory-field small {
  color: #98a2b3;
  font-size: 11px;
  font-weight: 400;
}

.mda-memory-field input,
.mda-memory-field select,
.mda-memory-field textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid #cfd7e2;
  border-radius: 6px;
  background: #ffffff;
  color: #1f2937;
  outline: none;
  font: inherit;
}

.mda-memory-field input,
.mda-memory-field select {
  height: 34px;
  padding: 0 9px;
}

.mda-memory-field textarea {
  min-height: 66px;
  padding: 8px 9px;
  resize: vertical;
  line-height: 1.5;
}

.mda-memory-field textarea.is-code {
  font: 11px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.mda-memory-field input:focus,
.mda-memory-field select:focus,
.mda-memory-field textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.mda-memory-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.mda-memory-advanced {
  border-top: 1px solid #e4e7ec;
  padding-top: 10px;
}

.mda-memory-advanced summary {
  cursor: pointer;
  color: #344054;
  font-size: 12px;
  font-weight: 700;
}

.mda-memory-advanced[open] {
  display: grid;
  gap: 12px;
}

.mda-memory-advanced[open] summary {
  margin-bottom: 2px;
}

.mda-memory-actions {
  position: sticky;
  bottom: -14px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 14px;
  background: #f7f8fa;
}

.mda-memory-actions button {
  height: 34px;
  padding: 0 13px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #ffffff;
  color: #344054;
  cursor: pointer;
  font-weight: 650;
}

.mda-memory-actions button.is-primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
}

.mda-memory-actions button.is-danger {
  border-color: #fda29b;
  color: #b42318;
}

.mda-memory-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.mda-locator-settings {
  display: grid;
  gap: 16px;
  max-width: 760px;
}

.mda-locator-choice {
  display: grid;
  gap: 6px;
}

.mda-locator-choice-label {
  margin-bottom: 2px;
  color: #344054;
  font-size: 12px;
  font-weight: 650;
}

.mda-locator-option {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 11px;
  align-items: center;
  width: 100%;
  min-height: 58px;
  padding: 10px 12px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #ffffff;
  color: #344054;
  text-align: left;
  cursor: pointer;
}

.mda-locator-option:hover {
  border-color: #98a2b3;
  background: #f9fafb;
}

.mda-locator-option.is-selected {
  border-color: #1677ff;
  background: #f5f9ff;
}

.mda-locator-option-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38px;
  gap: 6px;
}

.mda-locator-option-edit {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  align-self: center;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #fff;
  color: #475467;
  cursor: pointer;
}

.mda-locator-option-edit:hover {
  border-color: #98a2b3;
  background: #f9fafb;
  color: #101828;
}

.mda-locator-option > span {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.mda-locator-option strong,
.mda-locator-option small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-locator-option strong {
  color: #101828;
  font-size: 13px;
}

.mda-locator-option small {
  color: #667085;
  font-size: 11px;
}

.mda-locator-radio {
  position: relative;
  width: 16px;
  height: 16px;
  border: 1.5px solid #98a2b3;
  border-radius: 50%;
}

.mda-locator-option.is-selected .mda-locator-radio {
  border-color: #1677ff;
}

.mda-locator-option.is-selected .mda-locator-radio::after {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: #1677ff;
}

.mda-locator-settings-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e4e7ec;
}

.mda-locator-settings-intro strong {
  color: #101828;
  font-size: 15px;
}

.mda-locator-settings-intro p {
  max-width: 620px;
  margin: 5px 0 0;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.mda-locator-settings-intro > span {
  flex: 0 0 auto;
  color: #667085;
  font-size: 12px;
}

.mda-locator-settings-intro > span.is-enabled {
  color: #067647;
}

.mda-locator-add-row {
  display: flex;
}

.mda-locator-add-row button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 9px;
  border: 0;
  background: transparent;
  color: #1677ff;
  font-size: 12px;
  cursor: pointer;
}

.mda-locator-add-row button:hover {
  color: #0958d9;
  background: #f5f9ff;
}

.mda-memory-section-title {
  margin-top: 4px;
  color: #344054;
  font-size: 12px;
  font-weight: 750;
}

.mda-memory-tool,
.mda-memory-provider {
  display: grid;
  gap: 6px;
  padding: 10px 11px;
  border: 1px solid #d8dee6;
  border-radius: 6px;
  background: #ffffff;
}

.mda-memory-tool > div,
.mda-memory-provider > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.mda-memory-tool strong,
.mda-memory-provider strong {
  color: #111827;
  font-size: 13px;
}

.mda-memory-tool small,
.mda-memory-provider small {
  color: #667085;
  font-size: 11px;
}

.mda-memory-tool p,
.mda-memory-provider p {
  margin: 0;
  color: #475467;
  font-size: 12px;
  line-height: 1.45;
}

.mda-memory-project-note {
  margin-bottom: 10px;
  color: #667085;
  font-size: 12px;
}

.mda-memory-project-doc {
  min-height: 240px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid #d8dee6;
  border-radius: 6px;
  background: #ffffff;
  color: #344054;
  font: 11px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.mda-chat-body {
  height: calc(100vh - 52px);
}

.mda-settings-page,
.mda-settings-page .mda-memory-shell {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100vh;
  background: #ffffff;
  color: #1f2328;
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-memory-shell.is-page {
  position: fixed;
  z-index: 1;
  background: #ffffff;
}

.mda-settings-layout {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.mda-memory-shell:not(.is-page) .mda-settings-layout {
  display: flex;
  flex-direction: column;
}

.mda-settings-sidebar {
  flex: 0 0 270px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  padding: 16px 12px;
  border-right: 1px solid #eceff3;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.98));
}

.mda-settings-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  height: 36px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #667085;
  cursor: pointer;
  text-align: left;
  font: 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-settings-back:hover {
  background: #e6ebf2;
  color: #101828;
}

.mda-settings-search {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  margin: 10px 0 18px;
}

.mda-settings-search .xicon {
  position: absolute;
  left: 11px;
  top: 50%;
  color: #98a2b3;
  transform: translateY(-50%);
}

.mda-settings-search input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  height: 34px;
  padding: 0 12px 0 32px;
  border: 1px solid #d8dee6;
  border-radius: 10px;
  background: #ffffff;
  color: #667085;
  outline: none;
  font: 13px/34px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-settings-group-label {
  margin: 14px 10px 8px;
  color: #98a2b3;
  font-size: 12px;
  font-weight: 700;
}

.mda-settings-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #344054;
  cursor: pointer;
  text-align: left;
  font: 13px/34px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-settings-nav:hover,
.mda-settings-nav.is-active {
  background: #eef2f6;
  color: #101828;
}

.mda-settings-nav.is-active {
  font-weight: 700;
}

.mda-settings-nav > span {
  min-width: 0;
}

.mda-settings-nav .xicon {
  flex: 0 0 auto;
}

.mda-settings-nav > small {
  margin-left: auto;
  color: #98a2b3;
  font-size: 10px;
  font-weight: 500;
}

.mda-settings-nav.is-coming-soon:hover {
  color: #667085;
}

.mda-settings-back .xicon {
  flex: 0 0 auto;
}

.mda-settings-main {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #ffffff;
}

.mda-settings-toast {
  position: absolute;
  right: 24px;
  bottom: 22px;
  z-index: 10;
  max-width: min(360px, calc(100% - 48px));
  padding: 9px 12px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #101828;
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(16, 24, 40, 0.2);
  font-size: 12px;
}

.mda-settings-main-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 92px;
  padding: 22px 28px;
  border-bottom: 1px solid #f0f2f5;
}

.mda-settings-main-head div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.mda-settings-main-head span {
  color: #667085;
  font-size: 12px;
}

.mda-settings-main-head strong {
  color: #101828;
  font-size: 24px;
  line-height: 1.2;
}

.mda-settings-main-head em {
  overflow: hidden;
  color: #98a2b3;
  font-style: normal;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-settings-primary {
  flex: 0 0 auto;
  height: 34px;
  padding: 0 14px;
  border: 1px solid #101828;
  border-radius: 10px;
  background: #101828;
  color: #ffffff;
  cursor: pointer;
  font: 13px/32px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  font-weight: 700;
}

.mda-settings-primary:hover {
  background: #1d2939;
}

.mda-memory-shell.is-page .mda-memory-body {
  width: min(860px, calc(100vw - 340px));
  padding: 28px;
}

.mda-memory-shell.is-page .mda-memory-form {
  gap: 16px;
  margin-top: 18px;
}

.mda-memory-shell.is-page .mda-memory-field input,
.mda-memory-shell.is-page .mda-memory-field select {
  height: 38px;
}

.mda-memory-shell.is-page .mda-memory-tool,
.mda-memory-shell.is-page .mda-memory-provider {
  border-radius: 10px;
}

.mda-settings-assets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.mda-settings-asset {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 12px;
  border: 1px solid #e4e7ec;
  border-radius: 12px;
  background: #ffffff;
}

.mda-settings-asset-thumb {
  width: 84px;
  height: 84px;
  border-radius: 8px;
  background: #f2f4f7 center center / contain no-repeat;
  color: #667085;
  display: grid;
  place-items: center;
  font: 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.mda-settings-asset-thumb.is-empty {
  background-image: linear-gradient(135deg, #eef2ff, #e2e8f0);
}

.mda-settings-asset-main {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.mda-settings-asset-main strong {
  color: #101828;
  font-size: 13px;
}

.mda-settings-asset-main span,
.mda-settings-asset-main code {
  min-width: 0;
  overflow: hidden;
  color: #667085;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-settings-asset-main code {
  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

@media (max-width: 720px) {
  .mda-settings-sidebar {
    flex-basis: 210px;
  }

  .mda-memory-shell.is-page .mda-memory-body {
    width: auto;
    padding: 18px;
  }
}

/* 本地服务未启动提示条 */
.mda-service-down {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 12px 0;
  padding: 10px 12px;
  border: 1px solid #f0c36d;
  background: #fff8e6;
  border-radius: 8px;
  color: #7a5b00;
}
.mda-service-down-icon {
  font-size: 16px;
  line-height: 1;
}
.mda-service-down-main {
  flex: 1 1 auto;
  min-width: 0;
}
.mda-service-down-title {
  font-size: 13px;
  font-weight: 600;
}
.mda-service-down-hint {
  font-size: 12px;
  margin-top: 2px;
  color: #8a6d1f;
}
.mda-service-down-hint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: rgba(122, 91, 0, 0.1);
  padding: 1px 5px;
  border-radius: 4px;
}
.mda-service-down-retry {
  flex: 0 0 auto;
  padding: 5px 12px;
  border: 1px solid #e0a93b;
  background: #fff;
  color: #7a5b00;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.mda-service-down-retry:disabled {
  opacity: 0.6;
  cursor: default;
}

/* 新版本更新提示条 */
.mda-update-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 12px 0;
  padding: 10px 12px;
  border: 1px solid #9ecbff;
  background: #eef6ff;
  border-radius: 8px;
  color: #0b4a86;
}
.mda-update-icon { font-size: 15px; line-height: 1; }
.mda-update-main { flex: 1 1 auto; min-width: 0; }
.mda-update-title { font-size: 13px; font-weight: 600; }
.mda-update-hint { font-size: 12px; margin-top: 2px; color: #2b6cb0; }
.mda-update-btn {
  flex: 0 0 auto;
  padding: 5px 14px;
  border: none;
  background: #1a73e8;
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.mda-update-btn:hover { background: #1666d0; }
.mda-update-spinner {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  border: 2px solid #9ecbff;
  border-top-color: #1a73e8;
  border-radius: 50%;
  animation: mda-update-spin 0.8s linear infinite;
}
@keyframes mda-update-spin { to { transform: rotate(360deg); } }

/* MCP 状态面板 */
.mda-mcp-overlay {
  position: absolute; inset: 0; z-index: 40;
  background: rgba(15, 23, 42, 0.32);
  display: flex; align-items: stretch; justify-content: stretch;
}
.mda-mcp-panel {
  display: flex; flex-direction: column; width: 100%; height: 100%;
  background: #fff;
}
.mda-mcp-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-bottom: 1px solid #eef0f3;
}
.mda-mcp-title { font-size: 14px; font-weight: 600; }
.mda-mcp-head-actions { display: flex; gap: 6px; }
.mda-mcp-btn {
  padding: 4px 12px; border: 1px solid #d7dbe0; background: #fff;
  border-radius: 6px; font-size: 12px; cursor: pointer;
}
.mda-mcp-btn:disabled { opacity: 0.6; cursor: default; }
.mda-mcp-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; }
.mda-mcp-error { color: #d03050; font-size: 12px; margin-bottom: 8px; }
.mda-mcp-section-title { font-size: 12px; font-weight: 600; color: #667085; margin: 12px 0 6px; }
.mda-mcp-config {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  background: #f8fafc;
}
.mda-mcp-config div {
  display: grid;
  gap: 3px;
}
.mda-mcp-config strong {
  color: #667085;
  font-size: 11px;
}
.mda-mcp-config code {
  color: #344054;
  font: 11px/1.45 ui-monospace, Menlo, monospace;
  word-break: break-all;
}
.mda-mcp-empty { font-size: 12px; color: #98a2b3; }
.mda-mcp-empty code { background: #f2f4f7; padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, Menlo, monospace; }
.mda-mcp-servers { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.mda-mcp-server { border: 1px solid #eef0f3; border-radius: 8px; padding: 8px 10px; }
.mda-mcp-server-head { display: flex; align-items: center; gap: 6px; }
.mda-mcp-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.mda-mcp-dot.is-ready { background: #12b76a; }
.mda-mcp-dot.is-failed { background: #f04438; }
.mda-mcp-server-name { font-size: 13px; font-weight: 600; }
.mda-mcp-server-status { font-size: 11px; color: #667085; margin-left: auto; }
.mda-mcp-mini-btn {
  flex: 0 0 auto;
  padding: 2px 8px;
  border: 1px solid #d7dbe0;
  border-radius: 6px;
  background: #fff;
  color: #344054;
  cursor: pointer;
  font-size: 11px;
}
.mda-mcp-mini-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.mda-mcp-server-error { font-size: 11px; color: #d03050; margin-top: 4px; word-break: break-all; }
.mda-mcp-tools { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.mda-mcp-tool { font-size: 11px; font-family: ui-monospace, Menlo, monospace; color: #344054; }
.mda-mcp-logs {
  border: 1px solid #eef0f3; border-radius: 8px; padding: 8px;
  background: #0b1020; max-height: 240px; overflow-y: auto;
}
.mda-mcp-log { display: flex; gap: 8px; font-size: 11px; font-family: ui-monospace, Menlo, monospace; line-height: 1.6; }
.mda-mcp-log-time { color: #64748b; flex: 0 0 auto; }
.mda-mcp-log-line { color: #cbd5e1; word-break: break-all; }

/* 左下角菜单（绑定项目 / MCP 设置 / 设置） */
.mda-menu-wrap { position: relative; display: inline-flex; }
.mda-menu-backdrop { position: fixed; inset: 0; z-index: 49; }
.mda-menu {
  position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 50;
  min-width: 132px; padding: 4px;
  background: #fff; border: 1px solid #e4e7ec; border-radius: 8px;
  box-shadow: 0 6px 20px rgba(16, 24, 40, 0.14);
}
.mda-menu-item {
  display: block; width: 100%; text-align: left;
  padding: 7px 10px; border: none; background: transparent;
  border-radius: 6px; font-size: 13px; color: #344054; cursor: pointer;
}
.mda-menu-item:hover { background: #f2f4f7; }

.mda-thread-picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(16, 24, 40, 0.42);
}

.mda-thread-picker {
  width: min(620px, calc(100vw - 32px));
  max-height: min(720px, calc(100vh - 40px));
  overflow: auto;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 24px 56px rgba(16, 24, 40, 0.22);
}

.mda-thread-picker-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid #eaecf0;
  background: #fff;
}

.mda-thread-picker-head h2 {
  margin: 0;
  color: #101828;
  font-size: 18px;
  letter-spacing: 0;
}

.mda-thread-picker-head p {
  margin: 5px 0 0;
  color: #667085;
  font-size: 13px;
  line-height: 1.5;
}

.mda-thread-picker-close {
  display: grid;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  background: transparent;
  color: #475467;
  cursor: pointer;
}

.mda-thread-picker-close:hover {
  background: #f2f4f7;
}

.mda-thread-picker-state,
.mda-thread-picker-error {
  margin: 20px;
  color: #667085;
  font-size: 13px;
}

.mda-thread-picker-error {
  color: #b42318;
}

.mda-agent-provider-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 18px 20px 6px;
}

.mda-agent-provider-card {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-width: 0;
  min-height: 76px;
  padding: 11px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #fff;
  color: #344054;
  text-align: left;
  cursor: pointer;
}

.mda-agent-provider-card:hover:not(:disabled) {
  border-color: #98a2b3;
  background: #f9fafb;
}

.mda-agent-provider-card.is-selected {
  border-color: #1677ff;
  background: #f5f9ff;
}

.mda-agent-provider-card:disabled {
  cursor: wait;
  opacity: 0.65;
}

.mda-agent-provider-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 6px;
  background: #f2f4f7;
  color: #344054;
}

.mda-agent-provider-main {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.mda-agent-provider-main strong,
.mda-agent-provider-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-agent-provider-main strong {
  color: #101828;
  font-size: 13px;
}

.mda-agent-provider-main small {
  color: #667085;
  font-size: 11px;
}

.mda-agent-provider-state {
  grid-column: 2;
  color: #667085;
  font-size: 10px;
}

.mda-agent-provider-state.is-connected {
  color: #067647;
}

.mda-agent-provider-note {
  margin: 16px 20px 20px;
  padding: 12px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #f9fafb;
  color: #475467;
  font-size: 12px;
  line-height: 1.55;
}

@media (max-width: 560px) {
  .mda-agent-provider-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.mda-thread-group {
  padding: 18px 20px 4px;
}

.mda-thread-group:last-of-type {
  padding-bottom: 20px;
}

.mda-thread-group h3 {
  margin: 0 0 8px;
  color: #475467;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
}

.mda-thread-list {
  display: grid;
  gap: 2px;
}

.mda-thread-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  width: 100%;
  min-height: 58px;
  padding: 9px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #101828;
  text-align: left;
  cursor: pointer;
}

.mda-thread-row:hover:not(:disabled) {
  background: #f2f4f7;
}

.mda-thread-row:disabled {
  opacity: 0.65;
  cursor: wait;
}

.mda-thread-row-main,
.mda-thread-row-meta {
  display: grid;
  min-width: 0;
}

.mda-thread-row-main {
  gap: 4px;
}

.mda-thread-row-main strong,
.mda-thread-row-main span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mda-thread-row-main strong {
  font-size: 14px;
}

.mda-thread-row-main span,
.mda-thread-row-meta time {
  color: #667085;
  font-size: 12px;
}

.mda-thread-row-meta {
  gap: 4px;
  justify-items: end;
}

.mda-thread-row-meta > span {
  color: #175cd3;
  font-size: 12px;
  font-weight: 700;
}

.mda-thread-group-empty {
  margin: 0;
  padding: 14px 10px;
  color: #98a2b3;
  font-size: 13px;
}
`;
  (function bootstrapGoCaptureSidePanel() {
    const APP_KEY = "__GOCAPTURE_DEV_ASSISTANT__";
    const ROOT_ID = "gocapture-side-panel-root";
    const sidePanelConfig = window.__GOCAPTURE_SIDE_PANEL__ || {};
    const oldApp = window[APP_KEY];
    if (oldApp && typeof oldApp.destroy === "function") {
      oldApp.destroy();
    }
    const bootstrap = createGoCaptureBootstrap();
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
    const mountEl = document.createElement("div");
    mountEl.id = ROOT_ID;
    document.body.appendChild(mountEl);
    const api = {
      host: mountEl,
      app: null,
      sidePanel: true,
      sidePanelConfig,
      bootstrap,
      start() {
      },
      stop() {
      },
      toggle() {
      },
      clear() {
      },
      getSelected() {
        return null;
      },
      destroy() {
        if (api.app) {
          api.app.unmount();
          api.app = null;
        }
        if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
        if (mountEl.parentNode) mountEl.parentNode.removeChild(mountEl);
        if (window[APP_KEY] === api) {
          window[APP_KEY] = null;
        }
      }
    };
    const app = createApp(_sfc_main, { api });
    app.use(bootstrap.pinia);
    api.app = app;
    window[APP_KEY] = api;
    app.mount(mountEl);
  })();
})();

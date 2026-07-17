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
  const TeleportEndKey = /* @__PURE__ */ Symbol("_vte");
  const isTeleport = (type) => type.__isTeleport;
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
  const classify = (str) => str.replace(classifyRE, (c2) => c2.toUpperCase()).replace(/[-_]/g, "");
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
    return name ? classify(name) : isRoot ? `App` : `Anonymous`;
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
  const MAGNUS_COMMANDS_KEY = Symbol("magnus.commands");
  function provideMagnusCommands(commands) {
    provide(MAGNUS_COMMANDS_KEY, commands);
  }
  function useMagnusCommands() {
    const commands = inject(MAGNUS_COMMANDS_KEY);
    if (!commands) throw new Error("Magnus commands are not provided");
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
  const useChatStore = /* @__PURE__ */ defineStore("magnus.chat", () => {
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
  const useProjectStore = /* @__PURE__ */ defineStore("magnus.project", () => {
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
  const useSearchStore = /* @__PURE__ */ defineStore("magnus.search", () => {
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
  const _hoisted_1$j = {
    class: "mda-chat-thread",
    "aria-label": "页面改造对话"
  };
  const _hoisted_2$9 = { class: "mda-message-avatar" };
  const _hoisted_3$9 = { class: "mda-message-bubble" };
  const _hoisted_4$9 = {
    key: 0,
    class: "mda-message-work"
  };
  const _hoisted_5$9 = ["aria-expanded", "onClick"];
  const _hoisted_6$7 = { class: "mda-message-work-label" };
  const _hoisted_7$7 = {
    key: 1,
    class: "mda-message-work-label"
  };
  const _hoisted_8$6 = {
    key: 1,
    class: "mda-message-logs"
  };
  const _hoisted_9$6 = { class: "mda-log-file-label" };
  const _hoisted_10$6 = ["onClick"];
  const _hoisted_11$6 = {
    key: 1,
    class: "mda-message-log-pre"
  };
  const _hoisted_12$6 = {
    key: 0,
    class: "mda-message-title"
  };
  const _hoisted_13$6 = {
    key: 1,
    class: "mda-message-text"
  };
  const _hoisted_14$6 = {
    key: 2,
    class: "mda-message-pre"
  };
  const _hoisted_15$6 = {
    key: 3,
    class: "mda-message-actions"
  };
  const _hoisted_16$6 = ["disabled"];
  const _hoisted_17$4 = {
    key: 4,
    class: "mda-message-actions"
  };
  const _hoisted_18$4 = {
    key: 0,
    class: "mda-warning"
  };
  const _hoisted_19$4 = {
    key: 1,
    class: "mda-warning"
  };
  const _sfc_main$c = {
    __name: "ChatThread",
    setup(__props) {
      const commands = useMagnusCommands();
      const chatStore = useChatStore();
      const projectStore = useProjectStore();
      const searchStore = useSearchStore();
      const messages = computed(() => chatStore.messages);
      const sourceServiceStatus = computed(() => projectStore.serviceStatus);
      const sourceServiceError = computed(() => projectStore.serviceError);
      const candidateError = computed(() => searchStore.error);
      const nowTick = /* @__PURE__ */ ref(Date.now());
      const logOpenState = /* @__PURE__ */ ref({});
      let clockTimer = 0;
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
      function isCandidateLog(log) {
        return /^候选\s+\d+:\s+/.test(log) || /^文件:\s+/.test(log);
      }
      function isMultilineLog(log) {
        return typeof log === "string" && /\n/.test(log);
      }
      function candidatePrefix(log) {
        const match = String(log || "").match(/^(候选\s+\d+:\s+|文件:\s+)/);
        return match ? match[1] : "";
      }
      function candidateFile(log) {
        return String(log || "").replace(/^(候选\s+\d+:\s+|文件:\s+)/, "").trim();
      }
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock("section", _hoisted_1$j, [
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
                    _hoisted_2$9,
                    toDisplayString(avatarText(message.role)),
                    1
                    /* TEXT */
                  ),
                  createBaseVNode("div", _hoisted_3$9, [
                    showMessageWork(message) ? (openBlock(), createElementBlock("div", _hoisted_4$9, [
                      hasLogs(message) ? (openBlock(), createElementBlock("button", {
                        key: 0,
                        class: "mda-message-work-toggle",
                        type: "button",
                        "aria-expanded": String(isLogExpanded(message.id, message.logExpanded)),
                        onClick: ($event) => toggleLog(message.id, message.logExpanded)
                      }, [
                        createBaseVNode(
                          "span",
                          _hoisted_6$7,
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
                      ], 8, _hoisted_5$9)) : (openBlock(), createElementBlock(
                        "div",
                        _hoisted_7$7,
                        toDisplayString(messageWorkLabel(message)),
                        1
                        /* TEXT */
                      ))
                    ])) : createCommentVNode("v-if", true),
                    hasLogs(message) && isLogExpanded(message.id, message.logExpanded) ? (openBlock(), createElementBlock("div", _hoisted_8$6, [
                      (openBlock(true), createElementBlock(
                        Fragment,
                        null,
                        renderList(message.logs, (log, logIndex) => {
                          return openBlock(), createElementBlock(
                            "div",
                            {
                              key: logIndex,
                              class: normalizeClass(["mda-message-log-item", { "is-candidate-log": isCandidateLog(log) }])
                            },
                            [
                              isCandidateLog(log) ? (openBlock(), createElementBlock(
                                Fragment,
                                { key: 0 },
                                [
                                  createBaseVNode(
                                    "span",
                                    _hoisted_9$6,
                                    toDisplayString(candidatePrefix(log)),
                                    1
                                    /* TEXT */
                                  ),
                                  createBaseVNode("button", {
                                    class: "mda-log-file-link",
                                    type: "button",
                                    onClick: ($event) => unref(commands).openSourceFile(candidateFile(log))
                                  }, toDisplayString(candidateFile(log)), 9, _hoisted_10$6)
                                ],
                                64
                                /* STABLE_FRAGMENT */
                              )) : isMultilineLog(log) ? (openBlock(), createElementBlock(
                                "pre",
                                _hoisted_11$6,
                                toDisplayString(log),
                                1
                                /* TEXT */
                              )) : (openBlock(), createElementBlock(
                                Fragment,
                                { key: 2 },
                                [
                                  createTextVNode(
                                    toDisplayString(log),
                                    1
                                    /* TEXT */
                                  )
                                ],
                                64
                                /* STABLE_FRAGMENT */
                              ))
                            ],
                            2
                            /* CLASS */
                          );
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      ))
                    ])) : createCommentVNode("v-if", true),
                    createBaseVNode(
                      "div",
                      {
                        class: normalizeClass(["mda-message-content", { "has-work": showMessageWork(message) }])
                      },
                      [
                        message.title ? (openBlock(), createElementBlock(
                          "div",
                          _hoisted_12$6,
                          toDisplayString(message.title),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true),
                        message.text ? (openBlock(), createElementBlock(
                          "div",
                          _hoisted_13$6,
                          toDisplayString(message.text),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true),
                        message.pre ? (openBlock(), createElementBlock(
                          "pre",
                          _hoisted_14$6,
                          toDisplayString(message.pre),
                          1
                          /* TEXT */
                        )) : createCommentVNode("v-if", true),
                        message.action === "choose-project" ? (openBlock(), createElementBlock("div", _hoisted_15$6, [
                          createBaseVNode("button", {
                            class: "mda-btn mda-btn-primary",
                            type: "button",
                            disabled: sourceServiceStatus.value === "loading",
                            onClick: _cache[0] || (_cache[0] = (...args) => unref(commands).selectProject && unref(commands).selectProject(...args))
                          }, toDisplayString(sourceServiceStatus.value === "loading" ? "选择中" : "选择源码"), 9, _hoisted_16$6)
                        ])) : createCommentVNode("v-if", true),
                        message.action === "copy-prompt" ? (openBlock(), createElementBlock("div", _hoisted_17$4, [
                          createBaseVNode("button", {
                            class: "mda-btn",
                            type: "button",
                            onClick: _cache[1] || (_cache[1] = (...args) => unref(commands).copyPrompt && unref(commands).copyPrompt(...args))
                          }, "复制提示词")
                        ])) : createCommentVNode("v-if", true)
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
            _hoisted_18$4,
            toDisplayString(sourceServiceError.value),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true),
          candidateError.value ? (openBlock(), createElementBlock(
            "div",
            _hoisted_19$4,
            toDisplayString(candidateError.value),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true)
        ]);
      };
    }
  };
  const useAppUiStore = /* @__PURE__ */ defineStore("magnus.appUi", () => {
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
  const useComposerStore = /* @__PURE__ */ defineStore("magnus.composer", () => {
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
  const useModelStore = /* @__PURE__ */ defineStore("magnus.model", () => {
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
  const useRouteStore = /* @__PURE__ */ defineStore("magnus.route", () => {
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
  const useSelectionStore = /* @__PURE__ */ defineStore("magnus.selection", () => {
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
      return {
        uid: uid2,
        pageBindingId: (raw == null ? void 0 : raw.pageBindingId) || (raw == null ? void 0 : raw.workspaceId) || (previous == null ? void 0 : previous.pageBindingId) || "",
        element,
        asset: (raw == null ? void 0 : raw.asset) || element,
        sourceLocate: (raw == null ? void 0 : raw.sourceLocate) || (raw == null ? void 0 : raw.sourceEvidence) || element.sourceLocate || null,
        sourceBinding: (raw == null ? void 0 : raw.sourceBinding) || (previous == null ? void 0 : previous.sourceBinding) || null,
        thumbnailUrl: (raw == null ? void 0 : raw.thumbnailUrl) || (raw == null ? void 0 : raw.thumbnail) || "",
        thumbnailCaptured: !!((raw == null ? void 0 : raw.thumbnailUrl) || (raw == null ? void 0 : raw.thumbnail))
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
    function sourceBinding(id) {
      var _a2;
      return ((_a2 = items.value.find((selection) => selection.uid === id)) == null ? void 0 : _a2.sourceBinding) || null;
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
  const _hoisted_1$i = {
    key: 0,
    class: "mda-composer-options mda-composite"
  };
  const _hoisted_2$8 = { class: "mda-composite-row" };
  const _hoisted_3$8 = {
    key: 0,
    class: "mda-composite-line"
  };
  const _hoisted_4$8 = {
    key: 0,
    class: "mda-composite-row"
  };
  const _hoisted_5$8 = {
    key: 1,
    class: "mda-composite-row"
  };
  const _hoisted_6$6 = ["onClick"];
  const _hoisted_7$6 = ["onClick"];
  const _hoisted_8$5 = {
    key: 0,
    class: "mda-composite-anchor"
  };
  const _hoisted_9$5 = ["onClick"];
  const _hoisted_10$5 = {
    key: 1,
    class: "mda-composer-options mda-plan"
  };
  const _hoisted_11$5 = { class: "mda-plan-body" };
  const _hoisted_12$5 = {
    key: 0,
    class: "mda-plan-summary"
  };
  const _hoisted_13$5 = {
    key: 1,
    class: "mda-plan-block"
  };
  const _hoisted_14$5 = ["onClick"];
  const _hoisted_15$5 = {
    key: 0,
    class: "mda-composite-line"
  };
  const _hoisted_16$5 = {
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
  const _hoisted_22$1 = { class: "mda-plan-block-title" };
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
  const _sfc_main$b = {
    __name: "CandidateOptions",
    setup(__props) {
      const commands = useMagnusCommands();
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
            composite.value ? (openBlock(), createElementBlock("div", _hoisted_1$i, [
              _cache[10] || (_cache[10] = createBaseVNode(
                "div",
                { class: "mda-option-title" },
                "源码组合定位",
                -1
                /* CACHED */
              )),
              createBaseVNode("div", _hoisted_2$8, [
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
                    _hoisted_3$8,
                    ":" + toDisplayString(composite.value.render.line),
                    1
                    /* TEXT */
                  )) : createCommentVNode("v-if", true)
                ])
              ]),
              composite.value.regionOwner ? (openBlock(), createElementBlock("div", _hoisted_4$8, [
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
              ])) : composite.value.assembly ? (openBlock(), createElementBlock("div", _hoisted_5$8, [
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
                    }, toDisplayString(co.file), 9, _hoisted_6$6)
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
                    }, toDisplayString(child.file), 9, _hoisted_7$6),
                    child.anchor ? (openBlock(), createElementBlock(
                      "span",
                      _hoisted_8$5,
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
                    }, toDisplayString(bridge.file), 9, _hoisted_9$5)
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : createCommentVNode("v-if", true),
            hasChangePlanContent.value ? (openBlock(), createElementBlock("div", _hoisted_10$5, [
              _cache[14] || (_cache[14] = createBaseVNode(
                "div",
                { class: "mda-option-title" },
                "修改计划",
                -1
                /* CACHED */
              )),
              createBaseVNode("div", _hoisted_11$5, [
                changePlan.value.summary ? (openBlock(), createElementBlock(
                  "div",
                  _hoisted_12$5,
                  toDisplayString(changePlan.value.summary),
                  1
                  /* TEXT */
                )) : createCommentVNode("v-if", true),
                (changePlan.value.targets || []).length ? (openBlock(), createElementBlock("div", _hoisted_13$5, [
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
                            _hoisted_15$5,
                            ":" + toDisplayString(target.line),
                            1
                            /* TEXT */
                          )) : createCommentVNode("v-if", true)
                        ], 8, _hoisted_14$5),
                        target.anchor ? (openBlock(), createElementBlock(
                          "span",
                          _hoisted_16$5,
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
                            _hoisted_22$1,
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
  const _hoisted_1$h = ["value", "readonly", "placeholder"];
  const _hoisted_2$7 = ["onClick"];
  const _hoisted_3$7 = {
    key: 1,
    class: "mda-composer-shortcut-thumb is-empty"
  };
  const _hoisted_4$7 = { class: "mda-composer-shortcut-meta" };
  const _hoisted_5$7 = {
    key: 0,
    class: "mda-composer-shortcut-empty"
  };
  const _sfc_main$a = {
    __name: "ComposerInput",
    setup(__props, { expose: __expose }) {
      useMagnusCommands();
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
            }, null, 40, _hoisted_1$h),
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
                        _hoisted_3$7,
                        toDisplayString(asset.index),
                        1
                        /* TEXT */
                      )),
                      createBaseVNode("span", _hoisted_4$7, [
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
                    ], 42, _hoisted_2$7);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                )),
                !shortcutAssets.value.length ? (openBlock(), createElementBlock("div", _hoisted_5$7, "@ 无匹配选区")) : createCommentVNode("v-if", true)
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
  const _hoisted_1$g = { class: "mda-composer-prebar" };
  const _hoisted_2$6 = { class: "mda-composer-prebar-main" };
  const _hoisted_3$6 = ["disabled"];
  const _hoisted_4$6 = {
    key: 0,
    class: "mda-asset-strip"
  };
  const _hoisted_5$6 = ["title", "onClick", "onKeydown"];
  const _hoisted_6$5 = {
    key: 1,
    class: "mda-asset-thumb is-empty"
  };
  const _hoisted_7$5 = ["onClick"];
  const _sfc_main$9 = {
    __name: "ComposerPrebar",
    emits: ["insert-asset"],
    setup(__props) {
      const commands = useMagnusCommands();
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
        return openBlock(), createElementBlock("div", _hoisted_1$g, [
          createBaseVNode("div", _hoisted_2$6, [
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
            ])], 10, _hoisted_3$6),
            promptAssets.value.length ? (openBlock(), createElementBlock("div", _hoisted_4$6, [
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
                        _hoisted_6$5,
                        toDisplayString(asset.index),
                        1
                        /* TEXT */
                      )),
                      createBaseVNode("button", {
                        class: "mda-asset-remove",
                        type: "button",
                        title: "移除这个选区",
                        onClick: withModifiers(($event) => unref(commands).removeSelection(asset.uid), ["stop"])
                      }, "×", 8, _hoisted_7$5)
                    ], 40, _hoisted_5$6)
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
  const _hoisted_1$f = ["disabled"];
  const _hoisted_2$5 = { key: 0 };
  const _hoisted_3$5 = {
    key: 0,
    class: "mda-model-dropdown"
  };
  const _hoisted_4$5 = ["onClick"];
  const _hoisted_5$5 = {
    key: 0,
    class: "mda-model-divider"
  };
  const _sfc_main$8 = {
    __name: "ModelMenu",
    setup(__props) {
      const commands = useMagnusCommands();
      const modelStore = useModelStore();
      const searchStore = useSearchStore();
      const menuRef = /* @__PURE__ */ ref(null);
      const open = /* @__PURE__ */ ref(false);
      const modelConfigs = computed(() => modelStore.configs);
      const selectedModelId = computed(() => modelStore.selectedModelId);
      const selectedModel = computed(() => modelStore.selectedModel);
      const modelAssistLoading = computed(() => modelStore.status === "running");
      const candidateLoading = computed(() => searchStore.status === "loading");
      const activeModelLabel = computed(() => {
        var _a2;
        return ((_a2 = selectedModel.value) == null ? void 0 : _a2.name) || "不启用";
      });
      const activeModelMeta = computed(() => {
        if (!selectedModel.value) return "";
        if (modelAssistLoading.value) return "定位中";
        if (selectedModel.value.provider === "deepseek") return "DeepSeek API";
        return formatModelType(selectedModel.value.type);
      });
      watch(modelAssistLoading, (value) => {
        if (value) open.value = false;
      });
      onMounted(() => {
        window.addEventListener("pointerdown", handleGlobalPointerDown, true);
      });
      onBeforeUnmount(() => {
        window.removeEventListener("pointerdown", handleGlobalPointerDown, true);
      });
      function handleGlobalPointerDown(event) {
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        if (menuRef.value && (path.includes(menuRef.value) || menuRef.value.contains(event.target))) return;
        open.value = false;
      }
      function toggleMenu() {
        open.value = !open.value;
      }
      function closeMenu() {
        open.value = false;
      }
      function modelOptionMeta(model) {
        if (!model) return "";
        if (model.provider === "deepseek") return "DeepSeek API";
        return formatModelType(model.type);
      }
      function formatModelType(type) {
        return type === "api" ? "API" : "Cli";
      }
      function selectDisabledModel() {
        commands.disableModelAssist();
        closeMenu();
      }
      function selectSavedModel(model) {
        if (!model) return;
        commands.selectModelAndEnable(model.id);
        closeMenu();
      }
      function editSelectedModel() {
        closeMenu();
        commands.openModelEditor(selectedModel.value);
      }
      function createDeepSeekModel() {
        closeMenu();
        commands.openProviderModelEditor("deepseek");
      }
      function createCustomApiModel() {
        closeMenu();
        commands.openModelEditor({
          id: "",
          name: "",
          provider: "custom",
          type: "api",
          command: "",
          endpoint: "",
          apiKey: "",
          model: "",
          proxyUrl: "",
          timeoutMs: 12e4
        });
      }
      function createExecModel() {
        closeMenu();
        commands.openModelEditor();
      }
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock(
          "div",
          {
            ref_key: "menuRef",
            ref: menuRef,
            class: "mda-model-menu"
          },
          [
            createBaseVNode("button", {
              class: normalizeClass(["mda-model-trigger", { "is-active": !!selectedModelId.value }]),
              type: "button",
              disabled: candidateLoading.value || modelAssistLoading.value,
              onClick: toggleMenu
            }, [
              createBaseVNode(
                "strong",
                null,
                toDisplayString(activeModelLabel.value),
                1
                /* TEXT */
              ),
              activeModelMeta.value ? (openBlock(), createElementBlock(
                "em",
                _hoisted_2$5,
                toDisplayString(activeModelMeta.value),
                1
                /* TEXT */
              )) : createCommentVNode("v-if", true),
              _cache[0] || (_cache[0] = createBaseVNode(
                "i",
                null,
                null,
                -1
                /* CACHED */
              ))
            ], 10, _hoisted_1$f),
            open.value ? (openBlock(), createElementBlock("div", _hoisted_3$5, [
              createBaseVNode(
                "button",
                {
                  class: normalizeClass(["mda-model-option", { "is-selected": !selectedModelId.value }]),
                  type: "button",
                  onClick: selectDisabledModel
                },
                [..._cache[1] || (_cache[1] = [
                  createBaseVNode(
                    "span",
                    null,
                    "不启用",
                    -1
                    /* CACHED */
                  )
                ])],
                2
                /* CLASS */
              ),
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(modelConfigs.value, (model) => {
                  return openBlock(), createElementBlock("button", {
                    key: model.id,
                    class: normalizeClass(["mda-model-option", { "is-selected": selectedModelId.value === model.id }]),
                    type: "button",
                    onClick: ($event) => selectSavedModel(model)
                  }, [
                    createBaseVNode(
                      "span",
                      null,
                      toDisplayString(model.name),
                      1
                      /* TEXT */
                    ),
                    createBaseVNode(
                      "em",
                      null,
                      toDisplayString(modelOptionMeta(model)),
                      1
                      /* TEXT */
                    )
                  ], 10, _hoisted_4$5);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              modelConfigs.value.length ? (openBlock(), createElementBlock("div", _hoisted_5$5)) : createCommentVNode("v-if", true),
              selectedModel.value ? (openBlock(), createElementBlock("button", {
                key: 1,
                class: "mda-model-option",
                type: "button",
                onClick: editSelectedModel
              }, [..._cache[2] || (_cache[2] = [
                createBaseVNode(
                  "span",
                  null,
                  "配置当前模型",
                  -1
                  /* CACHED */
                )
              ])])) : createCommentVNode("v-if", true),
              createBaseVNode("button", {
                class: "mda-model-option",
                type: "button",
                onClick: createDeepSeekModel
              }, [..._cache[3] || (_cache[3] = [
                createBaseVNode(
                  "span",
                  null,
                  "DeepSeek",
                  -1
                  /* CACHED */
                ),
                createBaseVNode(
                  "em",
                  null,
                  "API",
                  -1
                  /* CACHED */
                )
              ])]),
              createBaseVNode("button", {
                class: "mda-model-option",
                type: "button",
                onClick: createCustomApiModel
              }, [..._cache[4] || (_cache[4] = [
                createBaseVNode(
                  "span",
                  null,
                  "新增 API 模型",
                  -1
                  /* CACHED */
                )
              ])]),
              createBaseVNode("button", {
                class: "mda-model-option",
                type: "button",
                onClick: createExecModel
              }, [..._cache[5] || (_cache[5] = [
                createBaseVNode(
                  "span",
                  null,
                  "新增 Cli 模型",
                  -1
                  /* CACHED */
                )
              ])])
            ])) : createCommentVNode("v-if", true)
          ],
          512
          /* NEED_PATCH */
        );
      };
    }
  };
  const _hoisted_1$e = {
    key: 0,
    class: "mda-model-editor"
  };
  const _hoisted_2$4 = { class: "mda-model-editor-head" };
  const _hoisted_3$4 = { class: "mda-model-grid" };
  const _hoisted_4$4 = {
    key: 0,
    class: "is-wide"
  };
  const _hoisted_5$4 = ["value"];
  const _hoisted_6$4 = ["value"];
  const _hoisted_7$4 = ["value"];
  const _hoisted_8$4 = {
    key: 1,
    class: "is-wide"
  };
  const _hoisted_9$4 = {
    key: 2,
    class: "is-wide"
  };
  const _hoisted_10$4 = { key: 3 };
  const _hoisted_11$4 = { key: 4 };
  const _hoisted_12$4 = { key: 5 };
  const _hoisted_13$4 = { class: "is-wide" };
  const _hoisted_14$4 = { class: "mda-model-hint" };
  const _hoisted_15$4 = { class: "mda-model-actions" };
  const _hoisted_16$4 = ["disabled"];
  const _sfc_main$7 = {
    __name: "ModelEditorPanel",
    setup(__props) {
      const commands = useMagnusCommands();
      const modelStore = useModelStore();
      const searchStore = useSearchStore();
      const modelConfigs = computed(() => modelStore.configs);
      const selectedModelId = computed(() => modelStore.selectedModelId);
      const selectedModel = computed(() => modelStore.selectedModel);
      const modelEditorOpen = computed(() => modelStore.editorOpen);
      const modelForm = computed({
        get: () => modelStore.form,
        set: (value) => {
          modelStore.form = value || {};
        }
      });
      const modelAssistLoading = computed(() => modelStore.status === "running");
      const candidateLoading = computed(() => searchStore.status === "loading");
      const modelTypeHint = computed(() => {
        return modelForm.value.type === "exec" ? "Cli 启动较慢，适合后续改代码；定位阶段会启用轻量 JSON 约束。" : "API 模型更适合快速源码定位。";
      });
      function onModelEditorSelect(event) {
        const id = event.target.value || "";
        if (!id) {
          commands.setSelectedModel("");
          commands.openModelEditor();
          return;
        }
        const model = modelConfigs.value.find((item) => item.id === id);
        commands.setSelectedModel(id);
        commands.openModelEditor(model);
      }
      function onModelProviderChange(event) {
        const provider = event.target.value || "custom";
        if (provider === "deepseek") {
          modelForm.value = __spreadProps(__spreadValues({}, modelForm.value), {
            provider: "deepseek",
            type: "api",
            endpoint: "https://api.deepseek.com/chat/completions",
            model: modelForm.value.model || "deepseek-v4-pro",
            name: modelForm.value.name || "DeepSeek"
          });
          return;
        }
        modelForm.value = __spreadProps(__spreadValues({}, modelForm.value), {
          provider: "custom"
        });
      }
      function formatModelType(type) {
        return type === "api" ? "API" : "Cli";
      }
      return (_ctx, _cache) => {
        return modelEditorOpen.value ? (openBlock(), createElementBlock("div", _hoisted_1$e, [
          createBaseVNode("div", _hoisted_2$4, [
            _cache[12] || (_cache[12] = createBaseVNode(
              "strong",
              null,
              "模型适配器",
              -1
              /* CACHED */
            )),
            createBaseVNode("button", {
              class: "mda-mini-btn",
              type: "button",
              onClick: _cache[0] || (_cache[0] = (...args) => unref(commands).closeModelEditor && unref(commands).closeModelEditor(...args))
            }, "关闭")
          ]),
          createBaseVNode("div", _hoisted_3$4, [
            modelConfigs.value.length ? (openBlock(), createElementBlock("label", _hoisted_4$4, [
              _cache[14] || (_cache[14] = createBaseVNode(
                "span",
                null,
                "当前模型",
                -1
                /* CACHED */
              )),
              createBaseVNode("select", {
                value: selectedModelId.value,
                class: "mda-model-input",
                onChange: onModelEditorSelect
              }, [
                _cache[13] || (_cache[13] = createBaseVNode(
                  "option",
                  { value: "" },
                  "新增模型",
                  -1
                  /* CACHED */
                )),
                (openBlock(true), createElementBlock(
                  Fragment,
                  null,
                  renderList(modelConfigs.value, (model) => {
                    return openBlock(), createElementBlock("option", {
                      key: model.id,
                      value: model.id
                    }, toDisplayString(model.name) + " · " + toDisplayString(formatModelType(model.type)), 9, _hoisted_6$4);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ], 40, _hoisted_5$4)
            ])) : createCommentVNode("v-if", true),
            createBaseVNode("label", null, [
              _cache[16] || (_cache[16] = createBaseVNode(
                "span",
                null,
                "供应商",
                -1
                /* CACHED */
              )),
              createBaseVNode("select", {
                value: modelForm.value.provider || "custom",
                class: "mda-model-input",
                onChange: onModelProviderChange
              }, [..._cache[15] || (_cache[15] = [
                createBaseVNode(
                  "option",
                  { value: "custom" },
                  "自定义",
                  -1
                  /* CACHED */
                ),
                createBaseVNode(
                  "option",
                  { value: "deepseek" },
                  "DeepSeek",
                  -1
                  /* CACHED */
                )
              ])], 40, _hoisted_7$4)
            ]),
            createBaseVNode("label", null, [
              _cache[17] || (_cache[17] = createBaseVNode(
                "span",
                null,
                "名称",
                -1
                /* CACHED */
              )),
              withDirectives(createBaseVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => modelForm.value.name = $event),
                  class: "mda-model-input",
                  placeholder: "Codex / Claude / OpenAI"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vModelText, modelForm.value.name]
              ])
            ]),
            createBaseVNode("label", null, [
              _cache[19] || (_cache[19] = createBaseVNode(
                "span",
                null,
                "类型",
                -1
                /* CACHED */
              )),
              withDirectives(createBaseVNode(
                "select",
                {
                  "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => modelForm.value.type = $event),
                  class: "mda-model-input"
                },
                [..._cache[18] || (_cache[18] = [
                  createBaseVNode(
                    "option",
                    { value: "exec" },
                    "Cli",
                    -1
                    /* CACHED */
                  ),
                  createBaseVNode(
                    "option",
                    { value: "api" },
                    "API",
                    -1
                    /* CACHED */
                  )
                ])],
                512
                /* NEED_PATCH */
              ), [
                [vModelSelect, modelForm.value.type]
              ])
            ]),
            modelForm.value.type === "exec" ? (openBlock(), createElementBlock("label", _hoisted_8$4, [
              _cache[20] || (_cache[20] = createBaseVNode(
                "span",
                null,
                "命令",
                -1
                /* CACHED */
              )),
              withDirectives(createBaseVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => modelForm.value.command = $event),
                  class: "mda-model-input",
                  placeholder: "codex exec"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vModelText, modelForm.value.command]
              ])
            ])) : createCommentVNode("v-if", true),
            modelForm.value.type === "api" ? (openBlock(), createElementBlock("label", _hoisted_9$4, [
              _cache[21] || (_cache[21] = createBaseVNode(
                "span",
                null,
                "Endpoint",
                -1
                /* CACHED */
              )),
              withDirectives(createBaseVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => modelForm.value.endpoint = $event),
                  class: "mda-model-input",
                  placeholder: "https://api.openai.com/v1/chat/completions"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vModelText, modelForm.value.endpoint]
              ])
            ])) : createCommentVNode("v-if", true),
            modelForm.value.type === "api" && modelForm.value.provider === "deepseek" ? (openBlock(), createElementBlock("label", _hoisted_10$4, [
              _cache[23] || (_cache[23] = createBaseVNode(
                "span",
                null,
                "Model",
                -1
                /* CACHED */
              )),
              withDirectives(createBaseVNode(
                "select",
                {
                  "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => modelForm.value.model = $event),
                  class: "mda-model-input"
                },
                [..._cache[22] || (_cache[22] = [
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
                [vModelSelect, modelForm.value.model]
              ])
            ])) : modelForm.value.type === "api" ? (openBlock(), createElementBlock("label", _hoisted_11$4, [
              _cache[24] || (_cache[24] = createBaseVNode(
                "span",
                null,
                "Model",
                -1
                /* CACHED */
              )),
              withDirectives(createBaseVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => modelForm.value.model = $event),
                  class: "mda-model-input",
                  placeholder: "gpt-4.1"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vModelText, modelForm.value.model]
              ])
            ])) : createCommentVNode("v-if", true),
            modelForm.value.type === "api" ? (openBlock(), createElementBlock("label", _hoisted_12$4, [
              _cache[25] || (_cache[25] = createBaseVNode(
                "span",
                null,
                "API Key",
                -1
                /* CACHED */
              )),
              withDirectives(createBaseVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => modelForm.value.apiKey = $event),
                  class: "mda-model-input",
                  type: "password",
                  placeholder: "sk-..."
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vModelText, modelForm.value.apiKey]
              ])
            ])) : createCommentVNode("v-if", true),
            createBaseVNode("label", _hoisted_13$4, [
              _cache[26] || (_cache[26] = createBaseVNode(
                "span",
                null,
                "代理地址",
                -1
                /* CACHED */
              )),
              withDirectives(createBaseVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => modelForm.value.proxyUrl = $event),
                  class: "mda-model-input",
                  placeholder: "http://127.0.0.1:7890，可留空"
                },
                null,
                512
                /* NEED_PATCH */
              ), [
                [vModelText, modelForm.value.proxyUrl]
              ])
            ]),
            createBaseVNode("label", null, [
              _cache[27] || (_cache[27] = createBaseVNode(
                "span",
                null,
                "超时 ms",
                -1
                /* CACHED */
              )),
              withDirectives(createBaseVNode(
                "input",
                {
                  "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => modelForm.value.timeoutMs = $event),
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
                  modelForm.value.timeoutMs,
                  void 0,
                  { number: true }
                ]
              ])
            ])
          ]),
          createBaseVNode(
            "p",
            _hoisted_14$4,
            toDisplayString(modelTypeHint.value),
            1
            /* TEXT */
          ),
          createBaseVNode("div", _hoisted_15$4, [
            selectedModel.value ? (openBlock(), createElementBlock("button", {
              key: 0,
              class: "mda-mini-btn",
              type: "button",
              disabled: candidateLoading.value || modelAssistLoading.value,
              onClick: _cache[10] || (_cache[10] = (...args) => unref(commands).removeSelectedModel && unref(commands).removeSelectedModel(...args))
            }, "删除模型", 8, _hoisted_16$4)) : createCommentVNode("v-if", true),
            createBaseVNode("button", {
              class: "mda-btn mda-btn-primary",
              type: "button",
              onClick: _cache[11] || (_cache[11] = (...args) => unref(commands).saveModelForm && unref(commands).saveModelForm(...args))
            }, "保存模型")
          ])
        ])) : createCommentVNode("v-if", true);
      };
    }
  };
  const _hoisted_1$d = { class: "mda-composer-wrap" };
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
  const _sfc_main$6 = {
    __name: "ComposerPanel",
    setup(__props, { expose: __expose }) {
      const composerInputRef = /* @__PURE__ */ ref(null);
      const buildVersion = "20260716.233919.188";
      const commands = useMagnusCommands();
      const appUiStore = useAppUiStore();
      const composerStore = useComposerStore();
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
        if (modelAssistLoading.value) return true;
        if (candidateLoading.value) return false;
        if (!project.value) return false;
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
        return openBlock(), createElementBlock("section", _hoisted_1$d, [
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
                createVNode(_sfc_main$b),
                createVNode(_sfc_main$7),
                createVNode(_sfc_main$9, { onInsertAsset: handleAssetInsert })
              ],
              512
              /* NEED_PATCH */
            ), [
              [vShow, !(hasResultModule.value && resultModuleCollapsed.value)]
            ])
          ]),
          createBaseVNode("div", _hoisted_5$3, [
            createVNode(
              _sfc_main$a,
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
                createVNode(_sfc_main$8),
                createBaseVNode("button", {
                  class: normalizeClass(["mda-send-btn", { "is-stopping": modelAssistLoading.value }]),
                  type: "button",
                  title: modelAssistLoading.value ? "停止模型定位" : "提交",
                  disabled: !composerCanSend.value,
                  onClick: _cache[2] || (_cache[2] = (...args) => unref(commands).sendRequest && unref(commands).sendRequest(...args))
                }, [
                  modelAssistLoading.value ? (openBlock(), createElementBlock("span", _hoisted_11$3)) : candidateLoading.value ? (openBlock(), createElementBlock("span", _hoisted_12$3, "检索")) : (openBlock(), createElementBlock("span", _hoisted_13$3))
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
  const _hoisted_1$c = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const AlbumsOutline = /* @__PURE__ */ defineComponent({
    name: "AlbumsOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$c,
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
  const _hoisted_1$b = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const ArrowBackOutline = /* @__PURE__ */ defineComponent({
    name: "ArrowBackOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$b,
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
  const _hoisted_1$a = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const BookOutline = /* @__PURE__ */ defineComponent({
    name: "BookOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$a,
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
  const _hoisted_1$9 = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const CogOutline = /* @__PURE__ */ defineComponent({
    name: "CogOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$9,
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
  const _hoisted_1$8 = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const ConstructOutline = /* @__PURE__ */ defineComponent({
    name: "ConstructOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$8,
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
  const _hoisted_1$7 = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const FolderOpenOutline = /* @__PURE__ */ defineComponent({
    name: "FolderOpenOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$7,
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
  const _hoisted_1$6 = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const ImagesOutline = /* @__PURE__ */ defineComponent({
    name: "ImagesOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock("svg", _hoisted_1$6, _cache[0] || (_cache[0] = [createStaticVNode('<path d="M432 112V96a48.14 48.14 0 0 0-48-48H64a48.14 48.14 0 0 0-48 48v256a48.14 48.14 0 0 0 48 48h16" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></path><rect x="96" y="128" width="400" height="336" rx="45.99" ry="45.99" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="32"></rect><ellipse cx="372.92" cy="219.64" rx="30.77" ry="30.55" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"></ellipse><path d="M342.15 372.17L255 285.78a30.93 30.93 0 0 0-42.18-1.21L96 387.64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path><path d="M265.23 464l118.59-117.73a31 31 0 0 1 41.46-1.87L496 402.91" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"></path>', 5)]));
    }
  });
  const _hoisted_1$5 = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const RefreshOutline = /* @__PURE__ */ defineComponent({
    name: "RefreshOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$5,
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
  const _hoisted_1$4 = {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    viewBox: "0 0 512 512"
  };
  const SearchOutline = /* @__PURE__ */ defineComponent({
    name: "SearchOutline",
    render: function render2(_ctx, _cache) {
      return openBlock(), createElementBlock(
        "svg",
        _hoisted_1$4,
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
  const _sfc_main$5 = /* @__PURE__ */ defineComponent({
    __name: "MagnusIcon",
    props: {
      name: {},
      size: { default: 18 },
      depth: { default: 1 }
    },
    setup(__props) {
      const props = __props;
      const icons = {
        albums: AlbumsOutline,
        back: ArrowBackOutline,
        book: BookOutline,
        cog: CogOutline,
        construct: ConstructOutline,
        folder: FolderOpenOutline,
        images: ImagesOutline,
        refresh: RefreshOutline,
        search: SearchOutline
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
  const SOURCE_SERVER_URL = typeof window !== "undefined" && ((_a = window.__MAGNUS_SIDE_PANEL__) == null ? void 0 : _a.sourceServerUrl) || "http://127.0.0.1:17321";
  const MAGNUS_INTERNAL_REQUEST_HEADER = "X-Magnus-Internal";
  const MAGNUS_INTERNAL_REQUEST_VALUE = "source-server";
  const SOURCE_SERVER_HEALTH_URL = `${SOURCE_SERVER_URL}/health`;
  function createSourceServerHeaders(extraHeaders) {
    return __spreadValues({
      "Content-Type": "application/json",
      [MAGNUS_INTERNAL_REQUEST_HEADER]: MAGNUS_INTERNAL_REQUEST_VALUE
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
                    toDisplayString(unref(config).user || "~/.magnus/mcp.json"),
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
                  "~/.magnus/mcp.json",
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
  const useRequestStore = /* @__PURE__ */ defineStore("magnus.request", () => {
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
    function hasInternalMagnusHeader(info) {
      return getHeaderValue(info.headers, MAGNUS_INTERNAL_REQUEST_HEADER) === MAGNUS_INTERNAL_REQUEST_VALUE;
    }
    function isInternalMagnusRequest(info) {
      if (hasInternalMagnusHeader(info)) return true;
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
      if (isInternalMagnusRequest(info)) return;
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
  function isMagnusUiHref(href) {
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
      const nextHref = readCurrentHref({ sidePanelConfig: window.__MAGNUS_SIDE_PANEL__ || {} });
      if (!nextHref || isMagnusUiHref(nextHref)) return;
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
        if (!currentPageHref.value || isMagnusUiHref(currentPageHref.value)) {
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
  const LATEST_PANEL_BINDING_KEY = "magnus:sidepanel-binding:latest";
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
  const CURRENT_KEY = "magnus:sidepanel-ui:current";
  const PAGE_KEY_PREFIX = "magnus:sidepanel-ui:page:";
  const MAX_SELECTIONS = 12;
  function hasSourceBinding(selection) {
    const binding = selection == null ? void 0 : selection.sourceBinding;
    return Array.isArray(binding == null ? void 0 : binding.targets) && binding.targets.length > 0;
  }
  function sourceBoundSelections(selections) {
    return selections.filter(hasSourceBinding);
  }
  function withoutSelectionAsset(selection) {
    if (!selection || typeof selection !== "object") return selection;
    const _a2 = selection, { asset: _asset, assetInfo: _assetInfo } = _a2, rest = __objRest(_a2, ["asset", "assetInfo"]);
    return rest;
  }
  function persistedSelections(selections) {
    return sourceBoundSelections(selections).map(withoutSelectionAsset);
  }
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
    const selectionStore = useSelectionStore();
    if (!composerStore.content && state.content) {
      composerStore.setContent(state.content);
    }
    if (!composerStore.finalPrompt && state.finalPrompt) {
      composerStore.setFinalPrompt(state.finalPrompt);
    }
    const selections = Array.isArray(state.selections) ? persistedSelections(state.selections) : [];
    if (!selectionStore.items.length && selections.length) {
      selectionStore.replaceSelections(selections);
    }
  }
  function currentState() {
    const composerStore = useComposerStore();
    const selectionStore = useSelectionStore();
    return {
      content: composerStore.content,
      finalPrompt: composerStore.finalPrompt,
      selections: persistedSelections(selectionStore.items).slice(0, MAX_SELECTIONS)
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
  function createClearSelectionsUseCase(deps) {
    const appUiStore = useAppUiStore();
    return function clearSelections(notifyRuntime = true) {
      return __async(this, null, function* () {
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
    function selectionPayloads() {
      return store.items.map((item, index) => {
        var _a2;
        return {
          index: index + 1,
          token: `@选区${index + 1}`,
          element: item.element,
          asset: item.asset || null,
          sourceLocate: item.sourceLocate || ((_a2 = item.element) == null ? void 0 : _a2.sourceLocate) || null,
          thumbnailCaptured: !!item.thumbnailUrl
        };
      });
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
      const value = String(instruction || "");
      const matches = Array.from(value.matchAll(/@(?:\[)?选区(?:(\d+))?(?:\])?/g));
      if (!matches.length) return [];
      if (matches.some((match) => !match[1])) return store.items.map((item) => item.uid);
      return Array.from(new Set(matches.map((match) => {
        var _a2;
        return ((_a2 = store.items[Number(match[1]) - 1]) == null ? void 0 : _a2.uid) || "";
      }).filter(Boolean)));
    }
    function reusableSourceBindings(instruction, projectRoot) {
      const ids = referencedSelectionIds(instruction);
      if (!ids.length) return [];
      const bindings = ids.map((uid2) => ({
        uid: uid2,
        binding: store.sourceBinding(uid2)
      }));
      if (bindings.some((item) => {
        return !item.binding || item.binding.projectRoot !== projectRoot || !item.binding.targets.length;
      })) return [];
      return bindings;
    }
    function bindSourceContext(ids, binding) {
      for (const uid2 of ids) store.bindSourceContext(uid2, binding);
    }
    return {
      selectedItems,
      filesConfirmed,
      selectionConfirmed,
      customEvidence,
      evidenceMessages,
      selectionPayloads,
      confirmSelectionContext,
      referencedSelectionIds,
      reusableSourceBindings,
      bindSourceContext
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
        getComposerContent: () => composerStore.content || ""
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
    normalizeInstructionText
  }) {
    const composerStore = useComposerStore();
    const projectStore = useProjectStore();
    const requestStore = useRequestStore();
    const routeStore = useRouteStore();
    const searchStore = useSearchStore();
    const selectionStore = useSelectionStore();
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
    const selectedItems = computed(() => selectionStore.items.map((item) => ({
      info: item.element || {}
    })));
    const searchApiRequests = computed(() => includeApiEvidence.value ? recentRequests.value.slice(0, 5) : []);
    return function searchLogLines() {
      var _a2, _b;
      const routeLines = routeResolverLogLines({ routeResolverTrace, pageUrlPath: pageUrlPath2, project });
      const lines = [
        `1. 收集页面证据: pagePath=${pageUrlPath2.value}；选区数=${selectedItems.value.length}；className=${selectedItems.value.map((item) => item.info.className).filter(Boolean).join(" ") || "-"}`,
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
      if (!matches.length) return assets;
      if (matches.some((match) => !match[1])) return assets;
      const indexes = /* @__PURE__ */ new Set();
      matches.forEach((match) => indexes.add(Number(match[1])));
      return assets.filter((asset) => indexes.has(asset.index));
    }
    function selectionPromptInstructions(text) {
      const assets = promptAssetItems();
      const value = normalizeInstructionText(text);
      if (!assets.length || !value) return [];
      const matches = Array.from(value.matchAll(/@(?:\[)?选区(?:(\d+))?(?:\])?/g));
      if (!matches.length) {
        return assets.map((asset) => ({
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
        const indexes = match[1] ? [Number(match[1])] : assets.map((asset) => asset.index);
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
      return selectionPayloads().filter((item) => {
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
      for (const item of selectedItems.value) {
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
      const selections = selectionPayloads().map((item) => {
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
        className: selectedItems.value.map((item) => item.info.className).join(" "),
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
      normalizeInstructionText
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
      buildPromptIntentDraft
    };
  }
  function setupPromptRuntime() {
    return useSearchPrompt();
  }
  const MODEL_STORAGE_KEY = "magnus:model-adapters";
  const MODEL_SELECTED_KEY = "magnus:model-adapters:selected";
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
      if (!storage) return;
      try {
        yield storage.set({
          [MODEL_STORAGE_KEY]: models,
          [MODEL_SELECTED_KEY]: selectedId || ""
        });
      } catch (error) {
      }
    });
  }
  function defaultModelForm() {
    return {
      id: "",
      name: "",
      provider: "custom",
      type: "exec",
      command: "codex exec",
      endpoint: "",
      apiKey: "",
      model: "",
      proxyUrl: "",
      timeoutMs: 12e4
    };
  }
  function providerModelForm(provider) {
    if (provider === "deepseek") {
      return __spreadProps(__spreadValues({}, defaultModelForm()), {
        name: "DeepSeek",
        provider: "deepseek",
        type: "api",
        command: "",
        endpoint: "https://api.deepseek.com/chat/completions",
        model: "deepseek-v4-pro"
      });
    }
    return defaultModelForm();
  }
  function normalizeModel(raw) {
    const item = raw || {};
    const type = item.type === "api" ? "api" : "exec";
    const provider = item.provider === "deepseek" ? "deepseek" : "custom";
    const defaultName = provider === "deepseek" ? "DeepSeek" : type === "api" ? "API 模型" : "Cli 模型";
    const normalizedName = item.name === "Exec 模型" ? "Cli 模型" : item.name;
    return {
      id: item.id || `model-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: normalizedName || defaultName,
      provider,
      type,
      command: item.command || "",
      endpoint: item.endpoint || (provider === "deepseek" ? "https://api.deepseek.com/chat/completions" : ""),
      apiKey: item.apiKey || "",
      model: item.model || (provider === "deepseek" ? "deepseek-v4-pro" : ""),
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
    if (!modelStore.configs.length) modelStore.configs = loadJson(MODEL_STORAGE_KEY, []).map(normalizeModel);
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
        const nextModels = (Array.isArray(state.models) ? state.models : []).map(normalizeModel);
        const validSelectedId = nextModels.some((item) => item.id === state.selectedId) ? state.selectedId : "";
        modelConfigs.value = nextModels;
        selectedModelId.value = validSelectedId;
        useModelAssist.value = !!validSelectedId;
        if (state.migrated || state.selectedId && state.selectedId !== validSelectedId) {
          void persistModelState(nextModels, validSelectedId);
        }
      });
    }
    function openModelEditor(model) {
      modelForm.value = model ? __spreadValues({}, model) : defaultModelForm();
      modelEditorOpen.value = true;
    }
    function openProviderModelEditor(provider) {
      modelForm.value = providerModelForm(provider);
      modelEditorOpen.value = true;
    }
    function closeModelEditor() {
      modelEditorOpen.value = false;
    }
    function saveModelForm() {
      const normalized = normalizeModel(modelForm.value);
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
                var _a3, _b2, _c2, _d2;
                return {
                  uid: item.uid,
                  designRequirement: ((_a3 = item.binding) == null ? void 0 : _a3.designRequirement) || "",
                  projectRoot: ((_b2 = item.binding) == null ? void 0 : _b2.projectRoot) || "",
                  targets: Array.isArray((_c2 = item.binding) == null ? void 0 : _c2.targets) ? item.binding.targets : [],
                  originSelections: Array.isArray((_d2 = item.binding) == null ? void 0 : _d2.originSelections) ? item.binding.originSelections : []
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
      var _a2;
      const messages = [];
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
        return messages;
      }
      messages.push({
        id: "project-ready",
        role: "system",
        title: "项目已连接",
        text: [
          `${project.value.name} · ${project.value.fileCount} 个文件 · ${project.value.stackText || "未识别技术栈"}`,
          project.value.path ? `源码目录：${project.value.path}` : ""
        ].filter(Boolean).join("\n")
      });
      if (!selectedItems.value.length) {
        messages.push({
          id: "need-selection",
          role: "system",
          title: "等待页面选区",
          text: "移动鼠标高亮页面区域，按空格键添加选区。选区会保存下来，可在输入框里用 @选区1 引用并描述修改要求。"
        });
        return messages;
      }
      messages.push({
        id: "selection-context",
        role: "system",
        title: "已捕获选区",
        text: selectionChatSummary()
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
          title: `模型定位 · ${((_a2 = result.adapter) == null ? void 0 : _a2.name) || "模型"}`,
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
      if (!candidateLoading.value && needsMoreEvidence.value) {
        messages.push({
          id: "need-more-evidence",
          role: "system",
          title: "线索不足，需要补充页面证据",
          text: [
            "当前选区检索到了多个候选文件，系统已基于当前选区自动向上扩区并继续检索。",
            "如果自动扩区后仍然失败，说明当前 DOM 链路还不能把候选收敛到唯一源码方向。"
          ].join("\n")
        });
      } else if (!candidateLoading.value && candidateHits.value.length > 1 && !filesConfirmed.value) {
        messages.push({
          id: "multi-candidates",
          role: "system",
          title: "存在多个命中文件，请确认",
          text: `默认选择最高命中：${candidateHits.value[0].file}`
        });
      } else if (!candidateLoading.value && candidateHits.value.length === 1 && !filesConfirmed.value) {
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
      return messages;
    });
    return {
      sourceServiceText,
      chatMessages
    };
  }
  function setupChatRuntime() {
    const chatStore = useChatStore();
    const message = useChatMessages();
    watch(message.chatMessages, (value) => {
      chatStore.setMessages(value || []);
    }, { immediate: true });
    return message;
  }
  function createMagnusRuntimeState(runtime) {
    var _a2;
    const { api, currentPageHref, sidePanelConfig, routePagePath, pageHost } = runtime;
    const composerStore = useComposerStore();
    const composer = createComposerFacade(composerStore);
    const requests = usePageRequests();
    useSidePanelUiPersistence(currentPageHref);
    let search = null;
    let bridge = null;
    let model = null;
    const selection = setupSelectionRuntime({
      sendCommand: (type, payload, options) => bridge == null ? void 0 : bridge.sendSidePanelCommand(type, payload, options)
    });
    const source = useSourceProject({ currentPageHref });
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
    function captureOriginSelections() {
      var _a2, _b;
      try {
        const assets = ((_a2 = prompt.promptAssetItems) == null ? void 0 : _a2.call(prompt)) || [];
        const items = ((_b = selection.selectedItems) == null ? void 0 : _b.value) || [];
        return assets.map((asset, index) => {
          var _a3;
          return {
            token: asset.token,
            tag: asset.tag,
            text: asset.text,
            className: asset.className,
            attrs: asset.attrs,
            ancestors: asset.ancestors,
            container: ancestorContainerAnchors((_a3 = items[index]) == null ? void 0 : _a3.element),
            // 选区所在容器/列的标识
            summary: asset.summary
          };
        });
      } catch (e) {
        return [];
      }
    }
    function sendComposer() {
      return __async(this, null, function* () {
        if (model.modelAssistLoading.value) {
          model.stopModelAssist();
          return;
        }
        if (!source.project.value) return;
        const instruction = composer.promptIntent.value.trim();
        if (!instruction) return;
        if (yield reuseSelectionSourceContext(instruction)) return;
        if (search.showCandidatePicker.value) {
          yield runModelAssistForCandidates(instruction);
          return;
        }
        if (!selection.confirmSelectionContext(composer.invalidatePrompt)) return;
        yield searchCandidateFiles();
      });
    }
    function searchCandidateFiles() {
      return __async(this, null, function* () {
        var _a2, _b, _c;
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
            const topHit = search.candidateHits.value[0];
            const resolvedConfidently = search.candidateHits.value.length === 1 || !!(topHit == null ? void 0 : topHit.preciseEvidence);
            if (resolvedConfidently) {
              selection.filesConfirmed.value = true;
              bindResolvedSelectionContext(instruction);
              yield runChangePlanForResolved(instruction);
            }
            return search.candidateHits.value;
          }
          if (shouldAutoRunModelAssist(search.candidateHits.value)) {
            const modelHandled = yield runModelAssistForCandidates(composer.promptIntent.value.trim());
            if (modelHandled) return ((_c = model.modelAssistResult.value) == null ? void 0 : _c.stopped) ? [] : search.candidateHits.value;
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
    function originAnchorsFromSelection() {
      var _a2;
      const items = ((_a2 = selection.selectedItems) == null ? void 0 : _a2.value) || [];
      const latest = items[items.length - 1];
      const el = (latest == null ? void 0 : latest.element) || (latest == null ? void 0 : latest.info) || {};
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
          const focusAnchors = originAnchorsFromSelection();
          lastOriginSelections = captureOriginSelections();
          let firstPass = yield runSearchRequest(prompt.searchPayload(), timeoutMs, "第 1 轮：原始选区检索");
          for (let attempt = 1; attempt <= MAX_AUTO_EXPAND_ATTEMPTS && shouldAutoExpandSearch(firstPass); attempt += 1) {
            const expanded = yield expandLatestSelectionForMoreEvidence(attempt);
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
        if (!model.useModelAssist.value || !model.canUseModelAssist.value) {
          prompt.generatePrompt({ userInstruction: instruction });
          return;
        }
        const bindings = selection.reusableSourceBindings(instruction, projectRoot());
        if (!bindings.length) {
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
    function expandLatestSelectionForMoreEvidence(attempt) {
      return __async(this, null, function* () {
        var _a2, _b, _c, _d;
        const before = latestSelectionSnapshot();
        const items = ((_a2 = selection.selectedItems) == null ? void 0 : _a2.value) || [];
        const latest = items[items.length - 1];
        const uid2 = (latest == null ? void 0 : latest.uid) || "";
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
    function latestSelectionSnapshot() {
      var _a2;
      return latestSelectionSnapshotFromItems(((_a2 = selection.selectedItems) == null ? void 0 : _a2.value) || []);
    }
    function waitForSelectionSnapshotChange(before) {
      return __async(this, null, function* () {
        const startedAt = Date.now();
        while (Date.now() - startedAt < 1500) {
          yield sleep$1(80);
          const current = latestSelectionSnapshot();
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
    function bindResolvedSelectionContext(userInstruction) {
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
        originSelections: lastOriginSelections,
        resolvedAt: Date.now()
      });
      search.appendProcessLog(`选区源码上下文已绑定：${ids[0]} -> ${targets.map((target) => target.file).join("、")}`);
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
  function createMagnusActions(state) {
    const { api, currentPageHref, source, search, selection, model } = state;
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
      openSettings: () => openSettings(api, (currentPageHref == null ? void 0 : currentPageHref.value) || ""),
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
      window.parent.postMessage({ type: "magnus.sidepanel.rebind" }, "*");
      return;
    }
    window.location.reload();
  }
  function openSettings(api, currentPageHref) {
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
      window.open(`${normalizedBaseUrl}/settings?${params.toString()}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: "magnus.settings.open",
        sourceServerUrl: baseUrl
      }, "*");
      return;
    }
    window.open(`${normalizedBaseUrl}/settings`, "_blank", "noopener,noreferrer");
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
      const requestId = `magnus-clipboard-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
        if ((message == null ? void 0 : message.type) !== "magnus.clipboard.result" || message.requestId !== requestId) return;
        done(!!message.ok);
      };
      const timer = window.setTimeout(() => done(false), 3e3);
      window.addEventListener("message", handleMessage);
      window.parent.postMessage({
        type: "magnus.clipboard.write",
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
  function provideMagnusRuntime(api, state, actions) {
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
    provideMagnusCommands(((_b = (_a2 = api.bootstrap) == null ? void 0 : _a2.createCommands) == null ? void 0 : _b.call(_a2, commands)) || commands);
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
  function createMagnusRuntime(api) {
    const currentPageHref = /* @__PURE__ */ ref(readCurrentHref(api));
    const sidePanelConfig = computed(() => api.sidePanelConfig || {});
    const routePagePath = computed(() => pageUrlPath(currentPageHref.value));
    const pageHost = computed(() => pageHostText(currentPageHref.value));
    const routeStore = useRouteStore();
    const appUiStore = useAppUiStore();
    let cleanupLocationWatcher = null;
    const runtime = {
      api,
      currentPageHref,
      sidePanelConfig,
      routePagePath,
      pageHost
    };
    const state = createMagnusRuntimeState(runtime);
    const { source, route, search, bridge } = state;
    const actions = createMagnusActions(state);
    provideMagnusRuntime(api, state, actions);
    watch([source.project, currentPageHref], () => {
      routeStore.setPage(currentPageHref.value, routePagePath.value);
      search.i18nTrace.value = null;
      search.definitionTrace.value = null;
      route.scheduleRouteResolve();
    }, { immediate: true });
    watch(currentPageHref, () => {
      source.restoreSavedProject();
    });
    onMounted(() => {
      registerRuntimeApi(api, state);
      cleanupLocationWatcher = installLocationWatcher(currentPageHref);
      source.restoreSavedProject();
      route.scheduleRouteResolve();
      bridge.connectSidePanelBridge();
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
        if (message.type !== "magnus.sidepanel.reload.result" || message.requestId !== requestId) return;
        finish(!!message.ok);
      };
      const timer = window.setTimeout(() => finish(false), timeoutMs);
      window.addEventListener("message", onMessage);
      window.parent.postMessage({
        type: "magnus.sidepanel.reload",
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
            applyMessage.value = "未检测到服务自动重启，请运行 magnus restart 后重试。";
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
  const magnusLogo = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBYRXhpZgAATU0AKgAAAAgAAgESAAMAAAABAAEAAIdpAAQAAAABAAAAJgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAACn6ADAAQAAAABAAABXQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgBXQKfAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAKv/aAAwDAQACEQMRAD8A/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9H9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAON+IHxB8GfCzwjqHjr4gatDouh6XH5k9zMTgDoFVVBZ3Y8Kigsx4AJr8Kfjn/wWA8barqN3on7Pvh+20TS8PDHqmsxGe/kLgBZobYOsEBUnKiUz7uNyKcpXhH/AAUZ/aS1r41fF/WfBFjqiv4E8D3UlnZwRjbFNdxqI7q5l+bMriUPHG3CrGPkG53Z/wA0d5+0PdyqnmPzg/dIx8pOM556j+8Oe2AD7muv+Cj/AO2zb3skqfEyQ4b7h0vSDHzghP8Ajyz39j/OvtH9n/8A4K6eLbfVrfR/2hNJtNS0WeYQf2vpcTW11boA26a4gLPFP8wGRF5RVQzBWOEr8QIUEsknmsWBOEUnPO7JJ642j+L2xV4rKkUcgUIztynAIZcruKjqSQSTjtjpxQB/b94K8beEviN4X0/xr4G1WDW9D1SPzba7tn3xuucEeqsrAq6sAysCrAMCB1NfzS/8EtP2hb34W/FxPhXrt+7eF/iFMIEjkc+VbawCy28kanhftGPJfHLsYyfuV/S1QAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//S/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACuY8b6tPoPgzX9ctt3nadp91cptXe26GJnGFHU5HA7109Z+raZa61pV7o98C1tfwyQSgEglJVKMARyODQB/DYtzd3Omj+0NzuT8zEY2s2MjAAHXp6dO1UIZJGA/d7FY/IoJAwDgkHqcYycdTXf/ED4f6z8K/Fes/DvxRCbfUfDl7cWNwgycvA+0SKxAJWVQro20ZVlbvXDRxR7/IuSVVBlv9rH3Se/HGO39QBsiJHK8bNvi4DSJxkZDDtz24/HBqZImdppZAVj/jI4AweMe5Hr65qurpHJH5QJuAzKgxnYRwzYHPAOR16egq7H5scqJG+HZwEx8vKjg55PA46f1oA0/D3ibWfBPiTSvFmjqyXnh2/g1KNW+49xZSLcI5I/hLIOB7j0x/ccjB1DryGAI/Gv43v2ZfhDc/Gf42+DPASWy3FpqWsRNexvL5bNaQN514RtZXytukmCp7D15/sjoAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//T/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD8tv+Cgf7DJ+OdlJ8WfhbYJL48s4447qyGxF1WFdsasWd0RZ4EHysTl0UJyQgr+bzWNB1zR9fm0DxFp82j6jZSeXc2tzE8U0LKcMkiuA6kYOcgYPHQV/cZXkvxN+A3wa+MsAh+KHg7TfETpG8Uc9zApuYVcYPk3C4miPoyOpB5BBoA/i5tIkgjnkbqARuI5JJwcEcjcOpz9etbugeG9Y17W7bSvDWnTarq12witrO0jee5ndzgiOKMM5xk7gBx0PFf1AT/wDBL/8AY0nmaZvCN6oclig1rUtmSc9DccfhX1h8Lvgj8Jfgrpj6T8LPCtj4dhmCiaS3izcT7M7TPcPummIzwZHYjpQB8Zf8E/P2Mrn9nLw1ceOviDFH/wAJ94igWKWFGDrp1pkP9nDgkNI7ANKwO0YVV4BZv0goooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//1P38ooooAKKKKACiiigAooooAKKKKACiiigAorzTxp8Z/g/8OJhbfEHx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AooooAKKKKAP/9P9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACuE8Y/C74Z/ERI4/iB4R0jxMsOdg1Swt70JuGDt89HxkcHFd3RQB84P+x5+yjIct8HvCY6/d0WzXr9Iq6PQv2av2dfDE8N14d+F/hfTri2cSRSwaNZRyo46MriLcGGOuc17ZRQA1VVFCIAqjgAcAU6iigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/1P38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9k=";
  const _hoisted_1$2 = { class: "mda-root" };
  const _hoisted_2$1 = {
    class: "mda-panel",
    "aria-label": "Magnus"
  };
  const _hoisted_3$1 = { class: "mda-head" };
  const _hoisted_4$1 = { class: "mda-head-main" };
  const _hoisted_5$1 = { class: "mda-title" };
  const _hoisted_6$1 = ["src"];
  const _hoisted_7$1 = { class: "mda-subtitle" };
  const _hoisted_8$1 = { class: "mda-head-actions" };
  const _hoisted_9$1 = {
    key: 0,
    class: "mda-service-down",
    role: "alert"
  };
  const _hoisted_10$1 = { class: "mda-service-down-main" };
  const _hoisted_11$1 = { class: "mda-service-down-hint" };
  const _hoisted_12$1 = ["disabled"];
  const _hoisted_13$1 = {
    key: 1,
    class: "mda-update-bar",
    role: "status"
  };
  const _hoisted_14$1 = { class: "mda-update-main" };
  const _hoisted_15$1 = { class: "mda-update-title" };
  const _hoisted_16$1 = { class: "mda-update-hint" };
  const _hoisted_17$1 = {
    key: 1,
    class: "mda-update-spinner",
    "aria-hidden": "true"
  };
  const _hoisted_18$1 = { class: "mda-body mda-chat-body" };
  const _hoisted_19$1 = {
    key: 2,
    class: "mda-project-checking",
    role: "status",
    "aria-live": "polite"
  };
  const _hoisted_20$1 = { class: "mda-project-checking-box" };
  const _hoisted_21$1 = { class: "mda-project-checking-text" };
  const _sfc_main$3 = /* @__PURE__ */ defineComponent({
    __name: "MagnusPanel",
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
      } = createMagnusRuntime(props.api);
      return (_ctx, _cache) => {
        var _a2;
        return openBlock(), createElementBlock("main", _hoisted_1$2, [
          createBaseVNode("section", _hoisted_2$1, [
            createBaseVNode("header", _hoisted_3$1, [
              createBaseVNode("div", _hoisted_4$1, [
                createBaseVNode("div", _hoisted_5$1, [
                  createBaseVNode("img", {
                    class: "mda-title-logo",
                    src: unref(magnusLogo),
                    alt: "Magnus"
                  }, null, 8, _hoisted_6$1)
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
                    createVNode(_sfc_main$5, {
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
                    createVNode(_sfc_main$5, {
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
              _cache[12] || (_cache[12] = createBaseVNode(
                "span",
                { class: "mda-service-down-icon" },
                "⚠",
                -1
                /* CACHED */
              )),
              createBaseVNode("div", _hoisted_10$1, [
                _cache[10] || (_cache[10] = createBaseVNode(
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
                _cache[11] || (_cache[11] = createBaseVNode(
                  "div",
                  { class: "mda-service-down-hint" },
                  [
                    createTextVNode("如果服务已启动，请运行 "),
                    createBaseVNode("code", null, "magnus status"),
                    createTextVNode(" 检查端口是否一致。")
                  ],
                  -1
                  /* CACHED */
                ))
              ]),
              createBaseVNode("button", {
                class: "mda-service-down-retry",
                type: "button",
                disabled: retryChecking.value,
                onClick: retryHealth
              }, toDisplayString(retryChecking.value ? "检查中…" : "重试"), 9, _hoisted_12$1)
            ])) : ((_a2 = unref(updateInfo)) == null ? void 0 : _a2.updateAvailable) ? (openBlock(), createElementBlock("div", _hoisted_13$1, [
              _cache[13] || (_cache[13] = createBaseVNode(
                "span",
                { class: "mda-update-icon" },
                "⬆",
                -1
                /* CACHED */
              )),
              createBaseVNode("div", _hoisted_14$1, [
                createBaseVNode(
                  "div",
                  _hoisted_15$1,
                  toDisplayString(unref(updateApplying) ? "更新中…" : `发现新版本 v${unref(updateInfo).latest}`),
                  1
                  /* TEXT */
                ),
                createBaseVNode(
                  "div",
                  _hoisted_16$1,
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
              }, "更新")) : (openBlock(), createElementBlock("span", _hoisted_17$1))
            ])) : createCommentVNode("v-if", true),
            createBaseVNode("div", _hoisted_18$1, [
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
              createVNode(_sfc_main$c),
              createVNode(_sfc_main$6)
            ]),
            projectChecking.value ? (openBlock(), createElementBlock("div", _hoisted_19$1, [
              createBaseVNode("div", _hoisted_20$1, [
                _cache[15] || (_cache[15] = createBaseVNode(
                  "div",
                  { class: "mda-project-checking-spinner" },
                  null,
                  -1
                  /* CACHED */
                )),
                createBaseVNode("div", null, [
                  _cache[14] || (_cache[14] = createBaseVNode(
                    "div",
                    { class: "mda-project-checking-title" },
                    "正在检查项目",
                    -1
                    /* CACHED */
                  )),
                  createBaseVNode(
                    "div",
                    _hoisted_21$1,
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
          ])
        ]);
      };
    }
  });
  const useMemoryStore = /* @__PURE__ */ defineStore("magnus.memory", () => {
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
    function saveSession(payload) {
      return __async(this, null, function* () {
        return save("/api/memory/session", payload, "任务会话已保存");
      });
    }
    function removeSession(id) {
      return __async(this, null, function* () {
        return save("/api/memory/session/remove", { id }, "任务会话已清除");
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
      saveExperience,
      saveSession,
      removeSession
    };
  });
  const _hoisted_1$1 = {
    key: 0,
    class: "mda-memory-head"
  };
  const _hoisted_2 = { class: "mda-settings-layout" };
  const _hoisted_3 = {
    key: 0,
    class: "mda-settings-sidebar"
  };
  const _hoisted_4 = { class: "mda-settings-search" };
  const _hoisted_5 = { class: "mda-settings-main" };
  const _hoisted_6 = {
    key: 0,
    class: "mda-settings-main-head"
  };
  const _hoisted_7 = {
    key: 1,
    class: "mda-memory-tabs",
    "aria-label": "记忆类型"
  };
  const _hoisted_8 = {
    key: 2,
    class: "mda-memory-state"
  };
  const _hoisted_9 = {
    key: 3,
    class: "mda-memory-state is-error"
  };
  const _hoisted_10 = {
    key: 4,
    class: "mda-memory-body"
  };
  const _hoisted_11 = {
    key: 0,
    class: "mda-memory-empty"
  };
  const _hoisted_12 = { class: "mda-memory-field" };
  const _hoisted_13 = ["value"];
  const _hoisted_14 = {
    key: 0,
    class: "mda-memory-form"
  };
  const _hoisted_15 = { class: "mda-memory-field" };
  const _hoisted_16 = { class: "mda-memory-field" };
  const _hoisted_17 = { class: "mda-memory-field" };
  const _hoisted_18 = { class: "mda-memory-field" };
  const _hoisted_19 = { class: "mda-memory-field" };
  const _hoisted_20 = { class: "mda-memory-field" };
  const _hoisted_21 = { class: "mda-memory-actions" };
  const _hoisted_22 = ["disabled"];
  const _hoisted_23 = ["disabled"];
  const _hoisted_24 = {
    key: 0,
    class: "mda-memory-empty"
  };
  const _hoisted_25 = {
    key: 1,
    class: "mda-settings-assets"
  };
  const _hoisted_26 = {
    key: 1,
    class: "mda-settings-asset-thumb is-empty"
  };
  const _hoisted_27 = { class: "mda-settings-asset-main" };
  const _hoisted_28 = {
    key: 0,
    class: "mda-memory-empty"
  };
  const _hoisted_29 = { class: "mda-memory-field" };
  const _hoisted_30 = ["value"];
  const _hoisted_31 = {
    key: 0,
    class: "mda-memory-form"
  };
  const _hoisted_32 = { class: "mda-memory-field" };
  const _hoisted_33 = { class: "mda-memory-row" };
  const _hoisted_34 = { class: "mda-memory-field" };
  const _hoisted_35 = { class: "mda-memory-field" };
  const _hoisted_36 = { class: "mda-memory-field" };
  const _hoisted_37 = { class: "mda-memory-field" };
  const _hoisted_38 = { class: "mda-memory-field" };
  const _hoisted_39 = { class: "mda-memory-field" };
  const _hoisted_40 = { class: "mda-memory-advanced" };
  const _hoisted_41 = { class: "mda-memory-field" };
  const _hoisted_42 = { class: "mda-memory-field" };
  const _hoisted_43 = { class: "mda-memory-field" };
  const _hoisted_44 = { class: "mda-memory-actions" };
  const _hoisted_45 = ["disabled"];
  const _hoisted_46 = {
    key: 0,
    class: "mda-memory-empty"
  };
  const _hoisted_47 = {
    key: 1,
    class: "mda-memory-form"
  };
  const _hoisted_48 = { class: "mda-memory-project-doc" };
  const _sfc_main$2 = /* @__PURE__ */ defineComponent({
    __name: "MemorySettingsPanel",
    props: {
      mode: { default: "panel" }
    },
    emits: ["back", "select-project"],
    setup(__props) {
      const props = __props;
      const memory = useMemoryStore();
      const appUi = useAppUiStore();
      const selectionStore = useSelectionStore();
      const tab = /* @__PURE__ */ ref("sessions");
      const sessionId = /* @__PURE__ */ ref("");
      const experienceId = /* @__PURE__ */ ref("");
      const sessionDraft = /* @__PURE__ */ reactive({
        requirements: "",
        targetFiles: "",
        confirmedExperienceIds: "",
        confirmedFacts: "",
        assumptions: "",
        lastEnhancedPrompt: ""
      });
      const experienceDraft = /* @__PURE__ */ reactive({
        name: "",
        status: "needs-verification",
        confidence: "medium",
        triggerTags: "",
        applicableWhen: "",
        notApplicableWhen: "",
        context: "",
        recipes: "[]",
        sourceContracts: "[]",
        verificationChecklist: "[]"
      });
      const sessions = computed(() => {
        var _a2;
        return ((_a2 = memory.snapshot) == null ? void 0 : _a2.taskSessions) || [];
      });
      const experiences = computed(() => {
        var _a2;
        return ((_a2 = memory.snapshot) == null ? void 0 : _a2.experiences) || [];
      });
      const toolProviders = computed(() => memory.toolProviders || []);
      const tools = computed(() => memory.tools || []);
      const resourceProviders = computed(() => memory.resourceProviders || []);
      const resources = computed(() => memory.resources || []);
      const selectionAssets = computed(() => selectionStore.promptAssets || []);
      const activeSession = computed(() => sessions.value.find((item) => item.id === sessionId.value) || null);
      const activeExperience = computed(() => experiences.value.find((item) => {
        var _a2;
        return ((_a2 = item.meta) == null ? void 0 : _a2.id) === experienceId.value;
      }) || null);
      const projectLabel = computed(() => {
        var _a2, _b;
        return ((_b = (_a2 = memory.snapshot) == null ? void 0 : _a2.project) == null ? void 0 : _b.name) || "当前源码项目";
      });
      const isPage = computed(() => props.mode === "page");
      const visible = computed(() => isPage.value || memory.open);
      const activeTitle = computed(() => {
        if (tab.value === "sessions") return "任务记忆";
        if (tab.value === "assets") return "选区资产";
        if (tab.value === "experiences") return "Experience";
        if (tab.value === "tools") return "Tools / Resources";
        return "项目摘要";
      });
      watch(sessions, (value) => {
        var _a2;
        if (!value.some((item) => item.id === sessionId.value)) sessionId.value = ((_a2 = value[0]) == null ? void 0 : _a2.id) || "";
      }, { immediate: true });
      watch(experiences, (value) => {
        var _a2, _b;
        if (!value.some((item) => {
          var _a3;
          return ((_a3 = item.meta) == null ? void 0 : _a3.id) === experienceId.value;
        })) experienceId.value = ((_b = (_a2 = value[0]) == null ? void 0 : _a2.meta) == null ? void 0 : _b.id) || "";
      }, { immediate: true });
      watch(activeSession, (session) => {
        if (!session) return;
        sessionDraft.requirements = toLines(session.requirements);
        sessionDraft.targetFiles = toLines(session.targetFiles);
        sessionDraft.confirmedExperienceIds = toLines(session.confirmedExperienceIds);
        sessionDraft.confirmedFacts = toLines(session.confirmedFacts);
        sessionDraft.assumptions = toLines(session.assumptions);
        sessionDraft.lastEnhancedPrompt = session.lastEnhancedPrompt || "";
      }, { immediate: true });
      watch(activeExperience, (experience) => {
        var _a2, _b, _c, _d, _e, _f;
        if (!experience) return;
        experienceDraft.name = ((_a2 = experience.meta) == null ? void 0 : _a2.name) || "";
        experienceDraft.status = ((_b = experience.meta) == null ? void 0 : _b.status) || "needs-verification";
        experienceDraft.confidence = ((_c = experience.meta) == null ? void 0 : _c.confidence) || "medium";
        experienceDraft.triggerTags = toLines((_d = experience.meta) == null ? void 0 : _d.triggerTags);
        experienceDraft.applicableWhen = toLines((_e = experience.meta) == null ? void 0 : _e.applicableWhen);
        experienceDraft.notApplicableWhen = toLines((_f = experience.meta) == null ? void 0 : _f.notApplicableWhen);
        experienceDraft.context = experience.context || "";
        experienceDraft.recipes = formatJson(experience.recipes);
        experienceDraft.sourceContracts = formatJson(experience.sourceContracts);
        experienceDraft.verificationChecklist = formatJson(experience.verificationChecklist);
      }, { immediate: true });
      function toLines(value) {
        return Array.isArray(value) ? value.join("\n") : "";
      }
      function fromLines(value) {
        return value.split("\n").map((item) => item.trim()).filter(Boolean);
      }
      function formatJson(value) {
        return JSON.stringify(Array.isArray(value) ? value : [], null, 2);
      }
      function parseJsonArray(value, label) {
        const parsed = JSON.parse(value || "[]");
        if (!Array.isArray(parsed)) throw new Error(`${label} 必须是 JSON 数组`);
        return parsed;
      }
      function saveSession() {
        return __async(this, null, function* () {
          if (!activeSession.value) return;
          const ok = yield memory.saveSession({
            id: activeSession.value.id,
            requirements: fromLines(sessionDraft.requirements),
            targetFiles: fromLines(sessionDraft.targetFiles),
            confirmedExperienceIds: fromLines(sessionDraft.confirmedExperienceIds),
            confirmedFacts: fromLines(sessionDraft.confirmedFacts),
            assumptions: fromLines(sessionDraft.assumptions),
            lastEnhancedPrompt: sessionDraft.lastEnhancedPrompt
          });
          if (ok) appUi.setToast("任务会话已保存");
        });
      }
      function removeSession() {
        return __async(this, null, function* () {
          if (!activeSession.value) return;
          const ok = yield memory.removeSession(activeSession.value.id);
          if (ok) appUi.setToast("任务会话已清除");
        });
      }
      function saveExperience() {
        return __async(this, null, function* () {
          if (!activeExperience.value) return;
          try {
            const ok = yield memory.saveExperience({
              id: activeExperience.value.meta.id,
              name: experienceDraft.name,
              status: experienceDraft.status,
              confidence: experienceDraft.confidence,
              triggerTags: fromLines(experienceDraft.triggerTags),
              applicableWhen: fromLines(experienceDraft.applicableWhen),
              notApplicableWhen: fromLines(experienceDraft.notApplicableWhen),
              context: experienceDraft.context,
              recipes: parseJsonArray(experienceDraft.recipes, "Recipes"),
              sourceContracts: parseJsonArray(experienceDraft.sourceContracts, "Source contracts"),
              verificationChecklist: parseJsonArray(experienceDraft.verificationChecklist, "Checklist")
            });
            if (ok) appUi.setToast("Experience 已保存");
          } catch (cause) {
            memory.error = (cause == null ? void 0 : cause.message) || "结构化约束格式错误";
          }
        });
      }
      function formatTime(value) {
        return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      }
      function assetThumbStyle(asset) {
        return (asset == null ? void 0 : asset.thumbnailUrl) ? { backgroundImage: `url("${asset.thumbnailUrl}")` } : {};
      }
      return (_ctx, _cache) => {
        var _a2;
        return visible.value ? (openBlock(), createElementBlock(
          "div",
          {
            key: 0,
            class: normalizeClass(["mda-memory-shell", { "is-page": isPage.value }]),
            role: "dialog",
            "aria-modal": "true",
            "aria-label": "Magnus 设置"
          },
          [
            !isPage.value ? (openBlock(), createElementBlock("header", _hoisted_1$1, [
              createBaseVNode("div", null, [
                _cache[31] || (_cache[31] = createBaseVNode(
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
            createBaseVNode("div", _hoisted_2, [
              isPage.value ? (openBlock(), createElementBlock("aside", _hoisted_3, [
                createBaseVNode("button", {
                  class: "mda-settings-back",
                  type: "button",
                  onClick: _cache[1] || (_cache[1] = ($event) => _ctx.$emit("back"))
                }, [
                  createVNode(_sfc_main$5, {
                    name: "back",
                    size: 16
                  }),
                  _cache[32] || (_cache[32] = createBaseVNode(
                    "span",
                    null,
                    "返回 Magnus",
                    -1
                    /* CACHED */
                  ))
                ]),
                createBaseVNode("label", _hoisted_4, [
                  createVNode(_sfc_main$5, {
                    name: "search",
                    size: 17
                  }),
                  _cache[33] || (_cache[33] = createBaseVNode(
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
                _cache[39] || (_cache[39] = createBaseVNode(
                  "div",
                  { class: "mda-settings-group-label" },
                  "项目",
                  -1
                  /* CACHED */
                )),
                createBaseVNode(
                  "button",
                  {
                    class: normalizeClass(["mda-settings-nav", { "is-active": tab.value === "sessions" }]),
                    type: "button",
                    onClick: _cache[2] || (_cache[2] = ($event) => tab.value = "sessions")
                  },
                  [
                    createVNode(_sfc_main$5, {
                      name: "albums",
                      size: 17
                    }),
                    _cache[34] || (_cache[34] = createTextVNode(
                      "任务记忆 ",
                      -1
                      /* CACHED */
                    ))
                  ],
                  2
                  /* CLASS */
                ),
                createBaseVNode(
                  "button",
                  {
                    class: normalizeClass(["mda-settings-nav", { "is-active": tab.value === "assets" }]),
                    type: "button",
                    onClick: _cache[3] || (_cache[3] = ($event) => tab.value = "assets")
                  },
                  [
                    createVNode(_sfc_main$5, {
                      name: "images",
                      size: 17
                    }),
                    _cache[35] || (_cache[35] = createTextVNode(
                      "选区资产 ",
                      -1
                      /* CACHED */
                    ))
                  ],
                  2
                  /* CLASS */
                ),
                createBaseVNode(
                  "button",
                  {
                    class: normalizeClass(["mda-settings-nav", { "is-active": tab.value === "experiences" }]),
                    type: "button",
                    onClick: _cache[4] || (_cache[4] = ($event) => tab.value = "experiences")
                  },
                  [
                    createVNode(_sfc_main$5, {
                      name: "book",
                      size: 17
                    }),
                    _cache[36] || (_cache[36] = createTextVNode(
                      "Experience ",
                      -1
                      /* CACHED */
                    ))
                  ],
                  2
                  /* CLASS */
                ),
                createBaseVNode(
                  "button",
                  {
                    class: normalizeClass(["mda-settings-nav", { "is-active": tab.value === "project" }]),
                    type: "button",
                    onClick: _cache[5] || (_cache[5] = ($event) => tab.value = "project")
                  },
                  [
                    createVNode(_sfc_main$5, {
                      name: "folder",
                      size: 17
                    }),
                    _cache[37] || (_cache[37] = createTextVNode(
                      "项目摘要 ",
                      -1
                      /* CACHED */
                    ))
                  ],
                  2
                  /* CLASS */
                ),
                _cache[40] || (_cache[40] = createBaseVNode(
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
                    onClick: _cache[6] || (_cache[6] = ($event) => tab.value = "tools")
                  },
                  [
                    createVNode(_sfc_main$5, {
                      name: "construct",
                      size: 17
                    }),
                    _cache[38] || (_cache[38] = createTextVNode(
                      "Tools / Resources ",
                      -1
                      /* CACHED */
                    ))
                  ],
                  2
                  /* CLASS */
                )
              ])) : createCommentVNode("v-if", true),
              createBaseVNode("main", _hoisted_5, [
                isPage.value ? (openBlock(), createElementBlock("header", _hoisted_6, [
                  createBaseVNode("div", null, [
                    _cache[41] || (_cache[41] = createBaseVNode(
                      "span",
                      null,
                      "Magnus 设置",
                      -1
                      /* CACHED */
                    )),
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
                    onClick: _cache[7] || (_cache[7] = ($event) => _ctx.$emit("select-project"))
                  }, "选择源码")
                ])) : createCommentVNode("v-if", true),
                !isPage.value ? (openBlock(), createElementBlock("nav", _hoisted_7, [
                  createBaseVNode(
                    "button",
                    {
                      type: "button",
                      class: normalizeClass({ "is-active": tab.value === "sessions" }),
                      onClick: _cache[8] || (_cache[8] = ($event) => tab.value = "sessions")
                    },
                    "任务会话",
                    2
                    /* CLASS */
                  ),
                  createBaseVNode(
                    "button",
                    {
                      type: "button",
                      class: normalizeClass({ "is-active": tab.value === "experiences" }),
                      onClick: _cache[9] || (_cache[9] = ($event) => tab.value = "experiences")
                    },
                    "Experience",
                    2
                    /* CLASS */
                  ),
                  createBaseVNode(
                    "button",
                    {
                      type: "button",
                      class: normalizeClass({ "is-active": tab.value === "tools" }),
                      onClick: _cache[10] || (_cache[10] = ($event) => tab.value = "tools")
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
                      onClick: _cache[11] || (_cache[11] = ($event) => tab.value = "project")
                    },
                    "项目摘要",
                    2
                    /* CLASS */
                  )
                ])) : createCommentVNode("v-if", true),
                unref(memory).loading ? (openBlock(), createElementBlock("div", _hoisted_8, "正在读取记忆...")) : unref(memory).error && !unref(memory).snapshot ? (openBlock(), createElementBlock("div", _hoisted_9, [
                  createBaseVNode(
                    "span",
                    null,
                    toDisplayString(unref(memory).error),
                    1
                    /* TEXT */
                  ),
                  createBaseVNode("button", {
                    type: "button",
                    onClick: _cache[12] || (_cache[12] = //@ts-ignore
                    (...args) => unref(memory).load && unref(memory).load(...args))
                  }, "重试")
                ])) : (openBlock(), createElementBlock("section", _hoisted_10, [
                  unref(memory).message || unref(memory).error ? (openBlock(), createElementBlock(
                    "div",
                    {
                      key: 0,
                      class: normalizeClass(["mda-memory-feedback", { "is-error": !!unref(memory).error }])
                    },
                    toDisplayString(unref(memory).error || unref(memory).message),
                    3
                    /* TEXT, CLASS */
                  )) : createCommentVNode("v-if", true),
                  tab.value === "sessions" ? (openBlock(), createElementBlock(
                    Fragment,
                    { key: 1 },
                    [
                      !sessions.value.length ? (openBlock(), createElementBlock("div", _hoisted_11, "当前项目暂无活跃任务会话。")) : (openBlock(), createElementBlock(
                        Fragment,
                        { key: 1 },
                        [
                          createBaseVNode("label", _hoisted_12, [
                            _cache[42] || (_cache[42] = createBaseVNode(
                              "span",
                              null,
                              "页面会话",
                              -1
                              /* CACHED */
                            )),
                            withDirectives(createBaseVNode(
                              "select",
                              {
                                "onUpdate:modelValue": _cache[13] || (_cache[13] = ($event) => sessionId.value = $event)
                              },
                              [
                                (openBlock(true), createElementBlock(
                                  Fragment,
                                  null,
                                  renderList(sessions.value, (session) => {
                                    return openBlock(), createElementBlock("option", {
                                      key: session.id,
                                      value: session.id
                                    }, toDisplayString(session.pageKey) + " · " + toDisplayString(formatTime(session.updatedAt)), 9, _hoisted_13);
                                  }),
                                  128
                                  /* KEYED_FRAGMENT */
                                ))
                              ],
                              512
                              /* NEED_PATCH */
                            ), [
                              [vModelSelect, sessionId.value]
                            ])
                          ]),
                          activeSession.value ? (openBlock(), createElementBlock("div", _hoisted_14, [
                            createBaseVNode("label", _hoisted_15, [
                              _cache[43] || (_cache[43] = createBaseVNode(
                                "span",
                                null,
                                [
                                  createTextVNode("累计需求 "),
                                  createBaseVNode("small", null, "每行一条")
                                ],
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "textarea",
                                {
                                  "onUpdate:modelValue": _cache[14] || (_cache[14] = ($event) => sessionDraft.requirements = $event),
                                  rows: "5"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, sessionDraft.requirements]
                              ])
                            ]),
                            createBaseVNode("label", _hoisted_16, [
                              _cache[44] || (_cache[44] = createBaseVNode(
                                "span",
                                null,
                                [
                                  createTextVNode("目标文件 "),
                                  createBaseVNode("small", null, "每行一个")
                                ],
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "textarea",
                                {
                                  "onUpdate:modelValue": _cache[15] || (_cache[15] = ($event) => sessionDraft.targetFiles = $event),
                                  rows: "3"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, sessionDraft.targetFiles]
                              ])
                            ]),
                            createBaseVNode("label", _hoisted_17, [
                              _cache[45] || (_cache[45] = createBaseVNode(
                                "span",
                                null,
                                [
                                  createTextVNode("已确认 Experience "),
                                  createBaseVNode("small", null, "每行一个 Experience ID")
                                ],
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "textarea",
                                {
                                  "onUpdate:modelValue": _cache[16] || (_cache[16] = ($event) => sessionDraft.confirmedExperienceIds = $event),
                                  rows: "3"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, sessionDraft.confirmedExperienceIds]
                              ])
                            ]),
                            createBaseVNode("label", _hoisted_18, [
                              _cache[46] || (_cache[46] = createBaseVNode(
                                "span",
                                null,
                                [
                                  createTextVNode("已确认事实 "),
                                  createBaseVNode("small", null, "每行一条")
                                ],
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "textarea",
                                {
                                  "onUpdate:modelValue": _cache[17] || (_cache[17] = ($event) => sessionDraft.confirmedFacts = $event),
                                  rows: "4"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, sessionDraft.confirmedFacts]
                              ])
                            ]),
                            createBaseVNode("label", _hoisted_19, [
                              _cache[47] || (_cache[47] = createBaseVNode(
                                "span",
                                null,
                                [
                                  createTextVNode("待确认假设 "),
                                  createBaseVNode("small", null, "每行一条")
                                ],
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "textarea",
                                {
                                  "onUpdate:modelValue": _cache[18] || (_cache[18] = ($event) => sessionDraft.assumptions = $event),
                                  rows: "4"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, sessionDraft.assumptions]
                              ])
                            ]),
                            createBaseVNode("label", _hoisted_20, [
                              _cache[48] || (_cache[48] = createBaseVNode(
                                "span",
                                null,
                                "上一版增强提示词",
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "textarea",
                                {
                                  "onUpdate:modelValue": _cache[19] || (_cache[19] = ($event) => sessionDraft.lastEnhancedPrompt = $event),
                                  rows: "10",
                                  class: "is-code"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, sessionDraft.lastEnhancedPrompt]
                              ])
                            ]),
                            createBaseVNode("div", _hoisted_21, [
                              createBaseVNode("button", {
                                class: "is-danger",
                                type: "button",
                                disabled: unref(memory).saving,
                                onClick: removeSession
                              }, "清除此会话", 8, _hoisted_22),
                              createBaseVNode("button", {
                                class: "is-primary",
                                type: "button",
                                disabled: unref(memory).saving,
                                onClick: saveSession
                              }, toDisplayString(unref(memory).saving ? "保存中..." : "保存会话"), 9, _hoisted_23)
                            ])
                          ])) : createCommentVNode("v-if", true)
                        ],
                        64
                        /* STABLE_FRAGMENT */
                      ))
                    ],
                    64
                    /* STABLE_FRAGMENT */
                  )) : tab.value === "assets" ? (openBlock(), createElementBlock(
                    Fragment,
                    { key: 2 },
                    [
                      !selectionAssets.value.length ? (openBlock(), createElementBlock("div", _hoisted_24, "当前页面暂无选区资产。")) : (openBlock(), createElementBlock("div", _hoisted_25, [
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
                                _hoisted_26,
                                toDisplayString(asset.index),
                                1
                                /* TEXT */
                              )),
                              createBaseVNode("div", _hoisted_27, [
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
                      !experiences.value.length ? (openBlock(), createElementBlock("div", _hoisted_28, "当前项目暂无已保存 Experience。")) : (openBlock(), createElementBlock(
                        Fragment,
                        { key: 1 },
                        [
                          createBaseVNode("label", _hoisted_29, [
                            _cache[49] || (_cache[49] = createBaseVNode(
                              "span",
                              null,
                              "Experience",
                              -1
                              /* CACHED */
                            )),
                            withDirectives(createBaseVNode(
                              "select",
                              {
                                "onUpdate:modelValue": _cache[20] || (_cache[20] = ($event) => experienceId.value = $event)
                              },
                              [
                                (openBlock(true), createElementBlock(
                                  Fragment,
                                  null,
                                  renderList(experiences.value, (experience) => {
                                    return openBlock(), createElementBlock("option", {
                                      key: experience.meta.id,
                                      value: experience.meta.id
                                    }, toDisplayString(experience.meta.name) + " · " + toDisplayString(experience.meta.status), 9, _hoisted_30);
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
                          activeExperience.value ? (openBlock(), createElementBlock("div", _hoisted_31, [
                            createBaseVNode("label", _hoisted_32, [
                              _cache[50] || (_cache[50] = createBaseVNode(
                                "span",
                                null,
                                "名称",
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "input",
                                {
                                  "onUpdate:modelValue": _cache[21] || (_cache[21] = ($event) => experienceDraft.name = $event),
                                  type: "text"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, experienceDraft.name]
                              ])
                            ]),
                            createBaseVNode("div", _hoisted_33, [
                              createBaseVNode("label", _hoisted_34, [
                                _cache[52] || (_cache[52] = createBaseVNode(
                                  "span",
                                  null,
                                  "状态",
                                  -1
                                  /* CACHED */
                                )),
                                withDirectives(createBaseVNode(
                                  "select",
                                  {
                                    "onUpdate:modelValue": _cache[22] || (_cache[22] = ($event) => experienceDraft.status = $event)
                                  },
                                  [..._cache[51] || (_cache[51] = [
                                    createBaseVNode(
                                      "option",
                                      { value: "active" },
                                      "active",
                                      -1
                                      /* CACHED */
                                    ),
                                    createBaseVNode(
                                      "option",
                                      { value: "needs-verification" },
                                      "needs-verification",
                                      -1
                                      /* CACHED */
                                    ),
                                    createBaseVNode(
                                      "option",
                                      { value: "stale" },
                                      "stale",
                                      -1
                                      /* CACHED */
                                    )
                                  ])],
                                  512
                                  /* NEED_PATCH */
                                ), [
                                  [vModelSelect, experienceDraft.status]
                                ])
                              ]),
                              createBaseVNode("label", _hoisted_35, [
                                _cache[54] || (_cache[54] = createBaseVNode(
                                  "span",
                                  null,
                                  "置信度",
                                  -1
                                  /* CACHED */
                                )),
                                withDirectives(createBaseVNode(
                                  "select",
                                  {
                                    "onUpdate:modelValue": _cache[23] || (_cache[23] = ($event) => experienceDraft.confidence = $event)
                                  },
                                  [..._cache[53] || (_cache[53] = [
                                    createBaseVNode(
                                      "option",
                                      { value: "high" },
                                      "high",
                                      -1
                                      /* CACHED */
                                    ),
                                    createBaseVNode(
                                      "option",
                                      { value: "medium" },
                                      "medium",
                                      -1
                                      /* CACHED */
                                    ),
                                    createBaseVNode(
                                      "option",
                                      { value: "low" },
                                      "low",
                                      -1
                                      /* CACHED */
                                    )
                                  ])],
                                  512
                                  /* NEED_PATCH */
                                ), [
                                  [vModelSelect, experienceDraft.confidence]
                                ])
                              ])
                            ]),
                            createBaseVNode("label", _hoisted_36, [
                              _cache[55] || (_cache[55] = createBaseVNode(
                                "span",
                                null,
                                [
                                  createTextVNode("触发标签 "),
                                  createBaseVNode("small", null, "每行一个")
                                ],
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "textarea",
                                {
                                  "onUpdate:modelValue": _cache[24] || (_cache[24] = ($event) => experienceDraft.triggerTags = $event),
                                  rows: "3"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, experienceDraft.triggerTags]
                              ])
                            ]),
                            createBaseVNode("label", _hoisted_37, [
                              _cache[56] || (_cache[56] = createBaseVNode(
                                "span",
                                null,
                                [
                                  createTextVNode("适用条件 "),
                                  createBaseVNode("small", null, "每行一条")
                                ],
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "textarea",
                                {
                                  "onUpdate:modelValue": _cache[25] || (_cache[25] = ($event) => experienceDraft.applicableWhen = $event),
                                  rows: "4"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, experienceDraft.applicableWhen]
                              ])
                            ]),
                            createBaseVNode("label", _hoisted_38, [
                              _cache[57] || (_cache[57] = createBaseVNode(
                                "span",
                                null,
                                [
                                  createTextVNode("不适用条件 "),
                                  createBaseVNode("small", null, "每行一条")
                                ],
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "textarea",
                                {
                                  "onUpdate:modelValue": _cache[26] || (_cache[26] = ($event) => experienceDraft.notApplicableWhen = $event),
                                  rows: "4"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, experienceDraft.notApplicableWhen]
                              ])
                            ]),
                            createBaseVNode("label", _hoisted_39, [
                              _cache[58] || (_cache[58] = createBaseVNode(
                                "span",
                                null,
                                [
                                  createTextVNode("Experience 正文 "),
                                  createBaseVNode("small", null, "Markdown")
                                ],
                                -1
                                /* CACHED */
                              )),
                              withDirectives(createBaseVNode(
                                "textarea",
                                {
                                  "onUpdate:modelValue": _cache[27] || (_cache[27] = ($event) => experienceDraft.context = $event),
                                  rows: "14",
                                  class: "is-code"
                                },
                                null,
                                512
                                /* NEED_PATCH */
                              ), [
                                [vModelText, experienceDraft.context]
                              ])
                            ]),
                            createBaseVNode("details", _hoisted_40, [
                              _cache[62] || (_cache[62] = createBaseVNode(
                                "summary",
                                null,
                                "结构化约束",
                                -1
                                /* CACHED */
                              )),
                              createBaseVNode("label", _hoisted_41, [
                                _cache[59] || (_cache[59] = createBaseVNode(
                                  "span",
                                  null,
                                  "Recipes JSON",
                                  -1
                                  /* CACHED */
                                )),
                                withDirectives(createBaseVNode(
                                  "textarea",
                                  {
                                    "onUpdate:modelValue": _cache[28] || (_cache[28] = ($event) => experienceDraft.recipes = $event),
                                    rows: "8",
                                    class: "is-code"
                                  },
                                  null,
                                  512
                                  /* NEED_PATCH */
                                ), [
                                  [vModelText, experienceDraft.recipes]
                                ])
                              ]),
                              createBaseVNode("label", _hoisted_42, [
                                _cache[60] || (_cache[60] = createBaseVNode(
                                  "span",
                                  null,
                                  "Source contracts JSON",
                                  -1
                                  /* CACHED */
                                )),
                                withDirectives(createBaseVNode(
                                  "textarea",
                                  {
                                    "onUpdate:modelValue": _cache[29] || (_cache[29] = ($event) => experienceDraft.sourceContracts = $event),
                                    rows: "8",
                                    class: "is-code"
                                  },
                                  null,
                                  512
                                  /* NEED_PATCH */
                                ), [
                                  [vModelText, experienceDraft.sourceContracts]
                                ])
                              ]),
                              createBaseVNode("label", _hoisted_43, [
                                _cache[61] || (_cache[61] = createBaseVNode(
                                  "span",
                                  null,
                                  "Checklist JSON",
                                  -1
                                  /* CACHED */
                                )),
                                withDirectives(createBaseVNode(
                                  "textarea",
                                  {
                                    "onUpdate:modelValue": _cache[30] || (_cache[30] = ($event) => experienceDraft.verificationChecklist = $event),
                                    rows: "8",
                                    class: "is-code"
                                  },
                                  null,
                                  512
                                  /* NEED_PATCH */
                                ), [
                                  [vModelText, experienceDraft.verificationChecklist]
                                ])
                              ])
                            ]),
                            createBaseVNode("div", _hoisted_44, [
                              createBaseVNode("button", {
                                class: "is-primary",
                                type: "button",
                                disabled: unref(memory).saving,
                                onClick: saveExperience
                              }, toDisplayString(unref(memory).saving ? "保存中..." : "保存 Experience"), 9, _hoisted_45)
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
                      !toolProviders.value.length && !resourceProviders.value.length && !tools.value.length && !resources.value.length ? (openBlock(), createElementBlock("div", _hoisted_46, "当前没有可用 Tool 或 Resource。")) : (openBlock(), createElementBlock("div", _hoisted_47, [
                        _cache[63] || (_cache[63] = createBaseVNode(
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
                        _cache[64] || (_cache[64] = createBaseVNode(
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
                        _cache[65] || (_cache[65] = createBaseVNode(
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
                        _cache[66] || (_cache[66] = createBaseVNode(
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
                      _cache[67] || (_cache[67] = createBaseVNode(
                        "div",
                        { class: "mda-memory-project-note" },
                        "Project.md 由源码扫描和 Experience 索引自动生成，不在这里手工修改。",
                        -1
                        /* CACHED */
                      )),
                      createBaseVNode(
                        "pre",
                        _hoisted_48,
                        toDisplayString(((_a2 = unref(memory).snapshot) == null ? void 0 : _a2.projectDocument) || "暂无项目摘要。"),
                        1
                        /* TEXT */
                      )
                    ],
                    64
                    /* STABLE_FRAGMENT */
                  ))
                ]))
              ])
            ])
          ],
          2
          /* CLASS */
        )) : createCommentVNode("v-if", true);
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
      const state = createMagnusRuntimeState(runtime);
      const memory = useMemoryStore();
      const fileInputRef = state.source.fileInputRef;
      const onFileInputChange = state.source.onFileInputChange;
      onMounted(() => __async(this, null, function* () {
        yield ensurePanelTicket();
        state.bridge.connectSidePanelBridge();
        yield state.source.restoreSavedProject();
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
          yield memory.load();
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
            onBack: goBack,
            onSelectProject: chooseProjectAndReload
          })
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
  function createMagnusStores(pinia) {
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
            stores.selectionStore.replaceSelections(selections);
            break;
          }
          case "page.route_changed": {
            const payload = event.payload;
            stores.routeStore.setPage((payload == null ? void 0 : payload.url) || "", stores.routeStore.pagePath);
            const sourceBoundSelections2 = stores.selectionStore.items.filter((item) => item.sourceBinding);
            if (sourceBoundSelections2.length !== stores.selectionStore.items.length) {
              stores.selectionStore.replaceSelections(sourceBoundSelections2);
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
  function createMagnusBootstrap() {
    const pinia = createPinia();
    const stores = createMagnusStores(pinia);
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
  const styles = ':host {\n  all: initial;\n  color-scheme: light;\n}\n\n.mda-root,\n.mda-root * {\n  box-sizing: border-box;\n}\n\n.mda-root {\n  position: fixed;\n  inset: 0;\n  background: #f7f8fa;\n  pointer-events: auto;\n  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-panel {\n  /* position: fixed; */\n  position: relative;\n  inset: 0;\n  width: 100%;\n  max-width: none;\n  height: 100vh;\n  background: #f7f8fa;\n  color: #1f2328;\n  border-left: 0;\n  box-shadow: none;\n  pointer-events: auto;\n  overflow: hidden;\n}\n\n.mda-project-checking {\n  position: absolute;\n  inset: 56px 0 0;\n  z-index: 40;\n  display: grid;\n  place-items: center;\n  padding: 24px;\n  background: rgba(247, 248, 250, 0.78);\n  backdrop-filter: blur(2px);\n}\n\n.mda-project-checking-box {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  width: min(360px, 92%);\n  padding: 16px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #ffffff;\n  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.16);\n}\n\n.mda-project-checking-spinner {\n  width: 22px;\n  height: 22px;\n  border: 2px solid #dbe4ef;\n  border-top-color: #2563eb;\n  border-radius: 999px;\n  animation: mda-spin 0.8s linear infinite;\n  flex: 0 0 auto;\n}\n\n.mda-project-checking-title {\n  font-weight: 700;\n  color: #111827;\n}\n\n.mda-project-checking-text {\n  margin-top: 3px;\n  color: #667085;\n  font-size: 12px;\n  line-height: 1.45;\n}\n\n@keyframes mda-spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n.mda-floating-note {\n  position: fixed;\n  z-index: 2147483647;\n  display: grid;\n  gap: 6px;\n  padding: 8px;\n  border: 1px solid rgba(37, 99, 235, 0.55);\n  border-radius: 8px;\n  background: #ffffff;\n  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.2);\n  pointer-events: auto;\n  cursor: auto;\n}\n\n.mda-selection-highlight {\n  position: fixed;\n  z-index: 2147483643;\n  border: 2px solid rgba(37, 99, 235, 0.88);\n  border-radius: 4px;\n  background: rgba(37, 99, 235, 0.08);\n  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85), 0 0 0 4px rgba(37, 99, 235, 0.12);\n  pointer-events: none;\n}\n\n.mda-selection-highlight.has-note {\n  border-color: rgba(22, 163, 74, 0.9);\n  background: rgba(22, 163, 74, 0.08);\n  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85), 0 0 0 4px rgba(22, 163, 74, 0.13);\n}\n\n.mda-selection-highlight.is-editing {\n  border-color: #111827;\n  background: rgba(17, 24, 39, 0.08);\n  box-shadow: 0 0 0 1px #ffffff, 0 0 0 5px rgba(17, 24, 39, 0.16);\n}\n\n.mda-change-badge {\n  position: fixed;\n  z-index: 2147483645;\n  height: 22px;\n  padding: 0 8px;\n  border-radius: 999px;\n  background: #16a34a;\n  color: #ffffff;\n  font: 12px/22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n  box-shadow: 0 8px 20px rgba(22, 163, 74, 0.28);\n  cursor: pointer;\n  pointer-events: auto;\n  white-space: nowrap;\n}\n\n.mda-change-badge:hover {\n  background: #15803d;\n}\n\n.mda-floating-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  color: #111827;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-floating-textarea {\n  width: 100%;\n  min-height: 72px;\n  resize: vertical;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  padding: 7px 8px;\n  background: #ffffff;\n  color: #111827;\n  outline: none;\n  font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-floating-textarea:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);\n}\n\n.mda-head {\n  position: relative;\n  height: 56px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 0 88px 0 14px;\n  background: #ffffff;\n  border-bottom: 1px solid #d8dee6;\n  cursor: default;\n  user-select: none;\n}\n\n.mda-head-main {\n  min-width: 0;\n}\n\n.mda-title {\n  font-weight: 700;\n  font-size: 14px;\n  color: #15191f;\n}\n\n.mda-subtitle {\n  margin-top: 1px;\n  max-width: 280px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: #6b7280;\n  font-size: 12px;\n}\n\n.mda-icon {\n  width: 28px;\n  height: 28px;\n  border: 1px solid transparent;\n  border-radius: 6px;\n  background: transparent;\n  color: #4b5563;\n  cursor: pointer;\n  font-size: 17px;\n  line-height: 26px;\n}\n\n.mda-icon:hover {\n  background: #eef2f6;\n  border-color: #d8dee6;\n  color: #111827;\n}\n\n.mda-head-actions {\n  position: absolute;\n  top: 14px;\n  right: 18px;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  z-index: 3;\n}\n\n.mda-head-icon {\n  display: grid;\n  place-items: center;\n  width: 28px;\n  height: 28px;\n  border-radius: 8px;\n  color: #4b5563;\n  cursor: pointer;\n}\n\n.mda-head-icon:hover {\n  background: #eef2f6;\n  color: #111827;\n}\n\n.mda-body {\n  display: grid;\n  align-content: start;\n  gap: 10px;\n  height: calc(100vh - 56px);\n  padding: 12px;\n  overflow: auto;\n}\n\n.mda-chat-body {\n  display: flex;\n  flex-direction: column;\n  gap: 0;\n  padding: 0;\n  overflow: hidden;\n}\n\n.mda-chat-thread {\n  flex: 1 1 auto;\n  display: grid;\n  align-content: start;\n  gap: 10px;\n  min-height: 0;\n  padding: 12px;\n  overflow: auto;\n}\n\n.mda-chat-message {\n  display: grid;\n  grid-template-columns: 42px minmax(0, 1fr);\n  gap: 10px;\n  align-items: start;\n}\n\n.mda-chat-message.is-user {\n  grid-template-columns: minmax(0, 1fr) 32px;\n}\n\n.mda-chat-message.is-user .mda-message-avatar {\n  grid-column: 2;\n  grid-row: 1;\n  background: #2563eb;\n}\n\n.mda-chat-message.is-user .mda-message-bubble {\n  grid-column: 1;\n  justify-self: end;\n  max-width: 86%;\n  background: #e8f0ff;\n  border-color: #b8cdfb;\n}\n\n.mda-chat-message.is-agent .mda-message-avatar {\n  background: #0f766e;\n  font-size: 11px;\n}\n\n.mda-chat-message.is-agent .mda-message-bubble {\n  background: #f0fdfa;\n  border-color: #99f6e4;\n}\n\n.mda-message-avatar {\n  width: 34px;\n  height: 24px;\n  border-radius: 6px;\n  background: #111827;\n  color: #ffffff;\n  text-align: center;\n  font-size: 12px;\n  font-weight: 700;\n  line-height: 24px;\n}\n\n.mda-message-bubble {\n  display: grid;\n  gap: 7px;\n  min-width: 0;\n  padding: 10px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #ffffff;\n}\n\n.mda-message-title {\n  color: #111827;\n  font-size: 13px;\n  font-weight: 750;\n}\n\n.mda-message-text {\n  color: #4b5563;\n  font-size: 12px;\n  white-space: pre-wrap;\n}\n\n.mda-message-pre {\n  max-height: 280px;\n  margin: 0;\n  padding: 9px;\n  overflow: auto;\n  border-radius: 6px;\n  background: #0f172a;\n  color: #e5edf7;\n  font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  white-space: pre-wrap;\n}\n\n.mda-message-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n\n.mda-composer-wrap {\n  flex: 0 0 auto;\n  display: grid;\n  gap: 8px;\n  padding: 6px 10px;\n  border-top: 1px solid #d8dee6;\n  background: #ffffff;\n}\n\n.mda-composer-options {\n  display: grid;\n  gap: 8px;\n  padding: 9px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #f8fafc;\n}\n\n.mda-composite {\n  background: #f2f7ff;\n  border-color: #c7dbf5;\n}\n\n.mda-composite-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12px;\n}\n\n.mda-composite-tag {\n  flex: 0 0 auto;\n  padding: 1px 6px;\n  border-radius: 4px;\n  background: #e2e8f0;\n  color: #475569;\n  font-size: 11px;\n}\n\n.mda-composite-tag.mda-composite-render {\n  background: #dbeafe;\n  color: #1d4ed8;\n}\n\n.mda-composite-anchor {\n  color: #94a3b8;\n  font-size: 11px;\n}\n\n.mda-composite-line {\n  color: #2563eb;\n  font-weight: 600;\n}\n\n.mda-plan {\n  background: #f6fdf7;\n  border-color: #c7e8cf;\n}\n\n/* 修改计划正文限高滚动，避免内容过长挡住聊天区与输入框 */\n.mda-plan-body {\n  display: grid;\n  gap: 8px;\n  max-height: 38vh;\n  overflow-y: auto;\n}\n\n/* 「定位与修改计划」整块模块：一个头部、一个收起开关，整块折叠 */\n.mda-result-module {\n  display: grid;\n  gap: 8px;\n}\n\n.mda-result-module-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 2px 2px 0;\n}\n\n.mda-result-module-title {\n  font-size: 12px;\n  font-weight: 600;\n  color: #334155;\n}\n\n.mda-result-module-body {\n  display: grid;\n  gap: 8px;\n  max-height: 60vh;\n  overflow-y: auto;\n}\n\n.mda-plan-summary {\n  font-size: 12px;\n  color: #14532d;\n  font-weight: 600;\n}\n\n.mda-plan-block {\n  display: grid;\n  gap: 4px;\n}\n\n.mda-plan-block-title {\n  font-size: 11px;\n  color: #64748b;\n  font-weight: 600;\n}\n\n.mda-plan-target {\n  display: grid;\n  gap: 2px;\n  padding: 4px 6px;\n  border-left: 2px solid #86efac;\n  background: #fff;\n  border-radius: 4px;\n}\n\n.mda-plan-what,\n.mda-plan-why {\n  font-size: 12px;\n  color: #334155;\n}\n\n.mda-plan-why {\n  color: #94a3b8;\n}\n\n.mda-plan-line {\n  font-size: 12px;\n  color: #475569;\n}\n\n.mda-plan-check {\n  display: grid;\n  grid-template-columns: 16px 1fr;\n  align-items: start;\n  gap: 6px;\n  padding: 5px 6px;\n  border: 1px solid #e2e8f0;\n  border-radius: 6px;\n  background: #fff;\n  font-size: 12px;\n  line-height: 1.45;\n  color: #334155;\n  cursor: pointer;\n}\n\n.mda-plan-check input {\n  width: 14px;\n  height: 14px;\n  margin: 1px 0 0;\n}\n\n.mda-plan-check.is-checked {\n  color: #64748b;\n  background: #f8fafc;\n}\n\n.mda-plan-check.is-checked span {\n  text-decoration: line-through;\n}\n\n.mda-composer-options.is-compact {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0;\n  border: 0;\n  background: transparent;\n}\n\n.mda-model-select {\n  max-width: 154px;\n  height: 26px;\n  min-width: 0;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  background: #ffffff;\n  color: #344054;\n  font: 12px/24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-model-editor {\n  display: grid;\n  gap: 8px;\n  padding: 9px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #f8fafc;\n}\n\n.mda-model-editor-head,\n.mda-model-actions {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.mda-model-editor-head strong {\n  color: #111827;\n  font-size: 12px;\n}\n\n.mda-model-grid {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);\n  gap: 8px;\n}\n\n.mda-model-grid label {\n  display: grid;\n  gap: 4px;\n  min-width: 0;\n  color: #667085;\n  font-size: 11px;\n}\n\n.mda-model-grid label.is-wide {\n  grid-column: 1 / -1;\n}\n\n.mda-model-input {\n  width: 100%;\n  height: 30px;\n  min-width: 0;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  padding: 0 8px;\n  background: #ffffff;\n  color: #111827;\n  outline: none;\n  font: 12px/28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-model-input:focus,\n.mda-model-select:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);\n}\n\n.mda-model-hint {\n  margin: -2px 0 0;\n  color: #667085;\n  font-size: 11px;\n  line-height: 1.4;\n}\n\n.mda-option-title {\n  color: #111827;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-option-desc {\n  color: #667085;\n  font-size: 12px;\n  line-height: 1.55;\n}\n\n.mda-choice-list {\n  display: grid;\n  gap: 7px;\n  max-height: 300px;\n  overflow: auto;\n}\n\n.mda-choice-card {\n  display: grid;\n  gap: 5px;\n  padding: 8px;\n  border: 1px solid #dbe3ee;\n  border-radius: 7px;\n  background: #ffffff;\n}\n\n.mda-choice-card.is-selected {\n  border-color: #2563eb;\n  background: #eff6ff;\n}\n\n.mda-choice-check {\n  display: grid;\n  grid-template-columns: 16px minmax(0, 1fr);\n  gap: 7px;\n  align-items: center;\n  min-width: 0;\n  color: #111827;\n  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-choice-check input {\n  width: 14px;\n  height: 14px;\n  margin: 0;\n}\n\n.mda-choice-check span,\n.mda-file-link {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-file-link {\n  width: 100%;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: #2563eb;\n  cursor: pointer;\n  text-align: left;\n  font: inherit;\n}\n\n.mda-file-link:hover {\n  color: #1d4ed8;\n  text-decoration: underline;\n}\n\n.mda-choice-meta {\n  color: #64748b;\n  font-size: 12px;\n}\n\n.mda-route-inline {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  padding: 0 2px;\n}\n\n.mda-route-label {\n  color: #667085;\n  font-size: 12px;\n  font-weight: 650;\n  white-space: nowrap;\n}\n\n.mda-route-file {\n  flex: 1 1 auto;\n  min-width: 0;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: #2563eb;\n  cursor: pointer;\n  overflow: hidden;\n  text-align: left;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-route-file:hover {\n  color: #1d4ed8;\n  text-decoration: underline;\n}\n\n.mda-route-empty {\n  flex: 1 1 auto;\n  min-width: 0;\n  color: #98a2b3;\n  font-size: 12px;\n}\n\n.mda-copy-icon {\n  position: relative;\n  flex: 0 0 auto;\n  width: 20px;\n  height: 20px;\n  border: 0;\n  border-radius: 5px;\n  background: transparent;\n  cursor: pointer;\n}\n\n.mda-copy-icon::before,\n.mda-copy-icon::after {\n  content: "";\n  position: absolute;\n  width: 9px;\n  height: 10px;\n  border: 1.5px solid #667085;\n  border-radius: 2px;\n}\n\n.mda-copy-icon::before {\n  top: 4px;\n  left: 7px;\n  background: #ffffff;\n}\n\n.mda-copy-icon::after {\n  top: 7px;\n  left: 4px;\n  background: #ffffff;\n}\n\n.mda-copy-icon:hover {\n  background: #f2f4f7;\n}\n\n.mda-copy-icon:hover::before,\n.mda-copy-icon:hover::after {\n  border-color: #101828;\n}\n\n.mda-composer {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 8px;\n  align-items: center;\n}\n\n.mda-composer-input {\n  width: 100%;\n  height: 38px;\n  min-width: 0;\n  border: 1px solid #cfd7e2;\n  border-radius: 8px;\n  padding: 0 10px;\n  background: #ffffff;\n  color: #111827;\n  outline: none;\n  font: 13px/38px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-send-btn {\n  height: 38px;\n  padding: 0 13px;\n  border: 1px solid #2563eb;\n  border-radius: 8px;\n  background: #2563eb;\n  color: #ffffff;\n  cursor: pointer;\n  font-family: inherit;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-send-btn:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n\n.mda-agent-body {\n  gap: 12px;\n}\n\n.mda-agent-thread {\n  display: grid;\n  gap: 10px;\n}\n\n.mda-agent-message {\n  display: grid;\n  grid-template-columns: 42px minmax(0, 1fr);\n  gap: 10px;\n  align-items: start;\n  padding: 10px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #ffffff;\n}\n\n.mda-agent-avatar {\n  width: 34px;\n  height: 24px;\n  border-radius: 6px;\n  background: #111827;\n  color: #ffffff;\n  text-align: center;\n  font-size: 12px;\n  font-weight: 700;\n  line-height: 24px;\n}\n\n.mda-agent-content {\n  display: grid;\n  gap: 7px;\n  min-width: 0;\n}\n\n.mda-agent-title {\n  color: #111827;\n  font-size: 13px;\n  font-weight: 750;\n}\n\n.mda-agent-text {\n  color: #4b5563;\n  font-size: 12px;\n}\n\n.mda-agent-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n\n.mda-section {\n  display: grid;\n  gap: 10px;\n  padding: 12px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #ffffff;\n}\n\n.mda-section-head {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.mda-section-title {\n  font-size: 13px;\n  font-weight: 700;\n  color: #111827;\n}\n\n.mda-section-desc {\n  margin-top: 2px;\n  color: #6b7280;\n  font-size: 12px;\n}\n\n.mda-toolbar,\n.mda-copy-grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 8px;\n}\n\n.mda-btn {\n  min-width: 0;\n  height: 32px;\n  padding: 0 10px;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  background: #ffffff;\n  color: #263241;\n  cursor: pointer;\n  font-family: inherit;\n  font-size: 12px;\n  font-weight: 650;\n  line-height: 30px;\n  white-space: nowrap;\n}\n\n.mda-btn:hover {\n  background: #f1f5f9;\n}\n\n.mda-btn:disabled {\n  opacity: 0.48;\n  cursor: not-allowed;\n}\n\n.mda-btn-primary {\n  background: #2563eb;\n  border-color: #2563eb;\n  color: #ffffff;\n}\n\n.mda-btn-primary:hover {\n  background: #1d4ed8;\n}\n\n.mda-dot {\n  flex: 0 0 auto;\n  width: 8px;\n  height: 8px;\n  margin-top: 5px;\n  border-radius: 99px;\n  background: #9ca3af;\n}\n\n.mda-dot.is-active {\n  background: #16a34a;\n  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.14);\n}\n\n.mda-file-input {\n  display: none;\n}\n\n.mda-empty {\n  min-height: 48px;\n  padding: 10px;\n  border: 1px dashed #cfd7e2;\n  border-radius: 6px;\n  color: #6b7280;\n  background: #f8fafc;\n  font-size: 12px;\n}\n\n.mda-project {\n  display: grid;\n  gap: 6px;\n}\n\n.mda-project-name {\n  font-weight: 700;\n  color: #111827;\n}\n\n.mda-project-meta {\n  color: #5b6573;\n  font-size: 12px;\n}\n\n.mda-project-path {\n  padding: 7px 8px;\n  border-radius: 6px;\n  background: #f1f5f9;\n  color: #334155;\n  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  word-break: break-all;\n}\n\n.mda-warning {\n  padding: 8px 10px;\n  border: 1px solid #f4c27a;\n  border-radius: 6px;\n  background: #fff7ed;\n  color: #9a3412;\n  font-size: 12px;\n}\n\n.mda-request-summary {\n  color: #5b6573;\n  font-size: 12px;\n}\n\n.mda-search-input {\n  width: 100%;\n  min-height: 58px;\n  resize: vertical;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  padding: 7px 8px;\n  background: #ffffff;\n  color: #111827;\n  outline: none;\n  font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-search-input:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);\n}\n\n.mda-check-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: #4b5563;\n  font-size: 12px;\n}\n\n.mda-check-row input {\n  width: 14px;\n  height: 14px;\n  margin: 0;\n}\n\n.mda-candidate-list {\n  display: grid;\n  gap: 8px;\n}\n\n.mda-candidate-card {\n  display: grid;\n  gap: 8px;\n  padding: 10px;\n  border: 1px solid #dbe3ee;\n  border-radius: 8px;\n  background: #fbfdff;\n}\n\n.mda-candidate-card.is-selected {\n  border-color: #2563eb;\n  background: #eff6ff;\n}\n\n.mda-candidate-head {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 8px;\n  align-items: center;\n}\n\n.mda-candidate-check {\n  display: grid;\n  grid-template-columns: 16px minmax(0, 1fr);\n  gap: 7px;\n  align-items: center;\n  min-width: 0;\n}\n\n.mda-candidate-check input {\n  width: 14px;\n  height: 14px;\n  margin: 0;\n}\n\n.mda-candidate-head strong {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: #111827;\n  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-candidate-head span {\n  height: 22px;\n  min-width: 34px;\n  padding: 0 8px;\n  border-radius: 999px;\n  background: #dbeafe;\n  color: #1d4ed8;\n  text-align: center;\n  font: 12px/22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-candidate-reasons {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.mda-candidate-stage {\n  color: #64748b;\n  font-size: 12px;\n}\n\n.mda-candidate-reasons span {\n  max-width: 100%;\n  padding: 3px 6px;\n  border-radius: 999px;\n  background: #eef2f6;\n  color: #394454;\n  font-size: 11px;\n  line-height: 1.35;\n}\n\n.mda-candidate-snippet,\n.mda-candidate-log {\n  max-height: 150px;\n  margin: 0;\n  padding: 8px;\n  overflow: auto;\n  border-radius: 6px;\n  background: #0f172a;\n  color: #e5edf7;\n  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  white-space: pre-wrap;\n}\n\n.mda-log-file-label {\n  flex: none;\n}\n\n.mda-log-file-link {\n  min-width: 0;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: #2563eb;\n  cursor: pointer;\n  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  text-align: left;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-log-file-link:hover {\n  color: #1d4ed8;\n  text-decoration: underline;\n}\n\n.mda-link-btn {\n  justify-self: start;\n  height: 24px;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: #2563eb;\n  cursor: pointer;\n  font: 12px/24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-link-btn:hover {\n  color: #1d4ed8;\n  text-decoration: underline;\n}\n\n.mda-tags {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.mda-tag {\n  max-width: 180px;\n  height: 24px;\n  padding: 0 8px;\n  border-radius: 999px;\n  background: #eef2f6;\n  color: #394454;\n  font: 12px/24px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-info {\n  border: 1px solid #e2e8f0;\n  border-radius: 6px;\n  overflow: hidden;\n}\n\n.mda-row {\n  display: grid;\n  grid-template-columns: 64px minmax(0, 1fr);\n  gap: 10px;\n  padding: 8px 10px;\n  border-bottom: 1px solid #e2e8f0;\n}\n\n.mda-row:last-child {\n  border-bottom: 0;\n}\n\n.mda-row span {\n  color: #6b7280;\n  font-size: 12px;\n}\n\n.mda-row strong {\n  min-width: 0;\n  color: #1f2937;\n  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-selection-list {\n  display: grid;\n  gap: 8px;\n}\n\n.mda-selection-card {\n  display: grid;\n  gap: 8px;\n  padding: 10px;\n  border: 1px solid #dbe3ee;\n  border-radius: 8px;\n  background: #fbfdff;\n}\n\n.mda-selection-card:hover {\n  border-color: #9db8f8;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);\n}\n\n.mda-selection-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.mda-selection-title {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 12px;\n  font-weight: 700;\n  color: #111827;\n}\n\n.mda-inline-badge {\n  height: 18px;\n  padding: 0 6px;\n  border-radius: 999px;\n  background: #dcfce7;\n  color: #166534;\n  font: 11px/18px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-mini-btn {\n  height: 24px;\n  padding: 0 8px;\n  border: 1px solid #cfd7e2;\n  border-radius: 5px;\n  background: #ffffff;\n  color: #4b5563;\n  cursor: pointer;\n  font-family: inherit;\n  font-size: 12px;\n  line-height: 22px;\n}\n\n.mda-mini-btn:hover {\n  background: #f1f5f9;\n  color: #111827;\n}\n\n.mda-selection-meta {\n  display: grid;\n  grid-template-columns: 54px minmax(0, 1fr);\n  gap: 8px;\n  color: #5b6573;\n  font-size: 12px;\n}\n\n.mda-selection-meta span {\n  font-weight: 700;\n}\n\n.mda-selection-meta strong {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: #1f2937;\n  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-selection-text {\n  max-height: 44px;\n  overflow: auto;\n  color: #4b5563;\n  font-size: 12px;\n}\n\n.mda-note {\n  min-height: 74px;\n  resize: vertical;\n}\n\n.mda-textarea,\n.mda-prompt {\n  width: 100%;\n  min-width: 0;\n  resize: vertical;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  padding: 9px 10px;\n  background: #ffffff;\n  color: #111827;\n  outline: none;\n  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-textarea:focus,\n.mda-prompt:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);\n}\n\n.mda-prompt {\n  min-height: 230px;\n  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  font-size: 12px;\n}\n\n.mda-toast {\n  flex: 1 1 auto;\n  min-width: 0;\n  color: #047857;\n  font-size: 12px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n/* Codex-like chat surface overrides. */\n.mda-panel {\n  width: 100%;\n  /* max-width: min(440px, calc(100vw - 18px)); */\n  background: #ffffff;\n  border-left-color: #e5e7eb;\n  box-shadow: -12px 0 28px rgba(15, 23, 42, 0.14);\n}\n\n.mda-head {\n  height: 52px;\n  padding: 0 12px 0 16px;\n  border-bottom-color: #eceff3;\n  background: #ffffff;\n}\n\n.mda-title {\n  display: flex;\n  align-items: center;\n  font-size: 13px;\n  font-weight: 680;\n}\n\n.mda-title-logo {\n  display: block;\n  width: auto;\n  height: 28px;\n  object-fit: contain;\n}\n\n.mda-subtitle {\n  max-width: 306px;\n  color: #667085;\n}\n\n.mda-chat-body {\n  background: #ffffff;\n}\n\n.mda-chat-thread {\n  gap: 14px;\n  padding: 16px 14px 18px;\n  background: #ffffff;\n}\n\n.mda-chat-message,\n.mda-chat-message.is-user {\n  display: flex;\n  gap: 9px;\n  align-items: flex-start;\n}\n\n.mda-chat-message.is-user {\n  justify-content: flex-end;\n}\n\n.mda-message-avatar {\n  flex: 0 0 auto;\n  width: auto;\n  min-width: 34px;\n  height: 22px;\n  padding: 0 7px;\n  border-radius: 999px;\n  background: #f2f4f7;\n  color: #344054;\n  font-size: 11px;\n  font-weight: 650;\n  line-height: 22px;\n}\n\n.mda-chat-message.is-user .mda-message-avatar {\n  display: none;\n}\n\n.mda-chat-message.is-agent .mda-message-avatar {\n  color: #fff;\n}\n\n.mda-message-bubble {\n  gap: 6px;\n  max-width: 100%;\n  padding: 0;\n  border: 0;\n  border-radius: 0;\n  background: transparent;\n}\n\n.mda-message-work {\n  display: flex;\n  align-items: center;\n  min-height: 24px;\n}\n\n.mda-message-work-toggle {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: #667085;\n  cursor: pointer;\n  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-message-work-label {\n  color: #667085;\n  font-size: 12px;\n  font-weight: 500;\n}\n\n.mda-message-work-caret {\n  width: 8px;\n  height: 8px;\n  border-right: 1.5px solid #98a2b3;\n  border-bottom: 1.5px solid #98a2b3;\n  transform: rotate(45deg) translateY(-1px);\n  transition: transform 160ms ease;\n}\n\n.mda-message-work-caret.is-open {\n  transform: rotate(225deg) translateY(-1px);\n}\n\n.mda-message-logs {\n  display: grid;\n  gap: 6px;\n}\n\n.mda-message-log-item {\n  color: #667085;\n  font-size: 12px;\n  line-height: 1.55;\n  word-break: break-word;\n}\n\n.mda-message-log-pre {\n  max-height: 360px;\n  margin: 0;\n  padding: 8px 9px;\n  overflow: auto;\n  border: 1px solid #e4e7ec;\n  border-radius: 10px;\n  background: #ffffff;\n  color: #344054;\n  font: 11px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  white-space: pre-wrap;\n}\n\n.mda-message-log-item.is-candidate-log {\n  display: flex;\n  gap: 4px;\n  align-items: baseline;\n  min-width: 0;\n  padding: 6px 8px;\n  border: 1px solid #d0d5dd;\n  border-radius: 10px;\n  background: #f8fafc;\n  color: #344054;\n  font-weight: 650;\n}\n\n.mda-message-content {\n  display: grid;\n  gap: 6px;\n}\n\n.mda-message-content.has-work {\n  padding-top: 10px;\n  border-top: 1px solid #eaecf0;\n}\n\n.mda-chat-message.is-agent .mda-message-bubble {\n  display: grid;\n  gap: 8px;\n  padding: 10px 11px;\n  border: 1px solid #99f6e4;\n  border-radius: 12px;\n  background: #f0fdfa;\n}\n\n.mda-chat-message.is-user .mda-message-bubble {\n  max-width: 86%;\n  padding: 9px 11px;\n  border: 1px solid #e5e7eb;\n  border-radius: 14px;\n  background: #f6f7f9;\n}\n\n.mda-message-title {\n  color: #101828;\n  font-size: 13px;\n  font-weight: 680;\n}\n\n.mda-message-text {\n  color: #344054;\n  font-size: 12px;\n  line-height: 1.55;\n}\n\n.mda-message-pre {\n  max-height: 320px;\n  border: 1px solid #e4e7ec;\n  border-radius: 10px;\n  background: #101828;\n  color: #f2f4f7;\n}\n\n.mda-composer-wrap {\n  gap: 10px;\n  padding: 12px;\n  border-top-color: #eceff3;\n  background: #ffffff;\n}\n\n.mda-composer-options {\n  gap: 8px;\n  padding: 10px;\n  border-color: #e4e7ec;\n  border-radius: 12px;\n  background: #f9fafb;\n}\n\n.mda-collapsible-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  min-width: 0;\n}\n\n.mda-collapse-btn {\n  flex: 0 0 auto;\n  height: 24px;\n  padding: 0 8px;\n  border: 1px solid #d0d5dd;\n  border-radius: 7px;\n  background: #ffffff;\n  color: #344054;\n  cursor: pointer;\n  font: 12px/22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-collapse-btn:hover {\n  background: #f2f4f7;\n  color: #101828;\n}\n\n.mda-collapsed-summary {\n  min-width: 0;\n  overflow: hidden;\n  color: #667085;\n  font-size: 12px;\n  line-height: 1.45;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-composer-options.is-compact {\n  padding: 0 2px;\n}\n\n.mda-choice-list {\n  gap: 8px;\n  max-height: 260px;\n}\n\n.mda-choice-card {\n  gap: 6px;\n  padding: 9px;\n  border-color: #e4e7ec;\n  border-radius: 10px;\n  background: #ffffff;\n}\n\n.mda-choice-card.is-selected {\n  border-color: #98a2b3;\n  background: #f2f4f7;\n}\n\n.mda-choice-check {\n  color: #101828;\n}\n\n.mda-choice-meta {\n  color: #667085;\n}\n\n.mda-composer {\n  gap: 9px;\n  align-items: end;\n  padding: 9px;\n  border: 1px solid #d0d5dd;\n  border-radius: 16px;\n  background: #ffffff;\n  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);\n}\n\n.mda-composer-input {\n  height: 34px;\n  border: 0;\n  border-radius: 0;\n  padding: 0 2px;\n  background: transparent;\n  color: #101828;\n  font-size: 13px;\n  line-height: 34px;\n}\n\n.mda-composer-input:not([readonly]) {\n  cursor: text;\n}\n\n.mda-send-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 58px;\n  height: 34px;\n  padding: 0;\n  border-color: #101828;\n  border-radius: 11px;\n  background: #101828;\n  font-weight: 650;\n}\n\n.mda-send-btn:not(:disabled):hover {\n  background: #1d2939;\n}\n\n.mda-btn-primary {\n  border-color: #101828;\n  background: #101828;\n}\n\n.mda-btn-primary:hover {\n  background: #1d2939;\n}\n\n.mda-link-btn {\n  color: #344054;\n}\n\n.mda-link-btn:hover {\n  color: #101828;\n}\n\n.mda-model-editor {\n  border-color: #e4e7ec;\n  border-radius: 14px;\n  background: #ffffff;\n  box-shadow: 0 12px 32px rgba(16, 24, 40, 0.1);\n}\n\n.mda-model-actions {\n  justify-content: flex-end;\n}\n\n.mda-model-actions .mda-mini-btn {\n  margin-right: auto;\n}\n\n.mda-composer-prebar {\n  display: flex;\n  align-items: center;\n  justify-content: flex-start;\n  min-height: 28px;\n  /* padding: 8px 8px 10px 6px; */\n  overflow: visible;\n}\n\n.mda-composer-prebar-main {\n  display: flex;\n  flex-wrap: nowrap;\n  align-items: flex-end;\n  gap: 8px;\n  min-width: 0;\n  overflow: visible;\n}\n\n.mda-asset-strip {\n  position: relative;\n  display: flex;\n  align-items: flex-end;\n  gap: 0;\n  min-width: 0;\n  padding: 10px 10px 12px 10px;\n  overflow: visible;\n  isolation: isolate;\n}\n\n.mda-asset-card {\n  position: relative;\n  flex: 0 0 auto;\n  width: 62px;\n  height: 84px;\n  margin-left: -62px;\n  overflow: visible;\n  z-index: 1;\n  transition: margin-left 180ms ease;\n}\n\n.mda-asset-card:first-child {\n  margin-left: 0;\n}\n\n.mda-asset-strip:hover .mda-asset-card {\n  margin-left: 10px;\n}\n\n.mda-asset-strip:hover .mda-asset-card:first-child {\n  margin-left: 0;\n}\n\n.mda-asset-card:hover {\n  z-index: 40;\n}\n\n.mda-asset-card:nth-child(6n + 1) .mda-asset-chip {\n  --mda-asset-rotate: -9deg;\n}\n\n.mda-asset-card:nth-child(6n + 2) .mda-asset-chip {\n  --mda-asset-rotate: 6deg;\n}\n\n.mda-asset-card:nth-child(6n + 3) .mda-asset-chip {\n  --mda-asset-rotate: -4deg;\n}\n\n.mda-asset-card:nth-child(6n + 4) .mda-asset-chip {\n  --mda-asset-rotate: 9deg;\n}\n\n.mda-asset-card:nth-child(6n + 5) .mda-asset-chip {\n  --mda-asset-rotate: -7deg;\n}\n\n.mda-asset-card:nth-child(6n + 6) .mda-asset-chip {\n  --mda-asset-rotate: 4deg;\n}\n\n.mda-asset-chip {\n  position: relative;\n  display: block;\n  width: 62px;\n  height: 84px;\n  padding: 4px 4px 10px;\n  border: 0;\n  border-radius: 3px;\n  background: #ffffff;\n  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.16);\n  cursor: pointer;\n  overflow: visible;\n  transform: translateY(0) rotate(var(--mda-asset-rotate, -4deg));\n  transform-origin: center bottom;\n  transition: transform 180ms ease, box-shadow 180ms ease;\n}\n\n.mda-asset-thumb {\n  display: block;\n  width: 100%;\n  height: 100%;\n  border-radius: 1px;\n  background: #e5e7eb center center / cover no-repeat;\n  background-size: contain;\n  background-position: center;\n  color: #667085;\n  font: 12px/70px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n  text-align: center;\n}\n\n.mda-asset-thumb.is-empty {\n  background-image: linear-gradient(135deg, #eef2ff, #e2e8f0);\n}\n\n.mda-asset-chip:hover {\n  box-shadow: 0 14px 26px rgba(15, 23, 42, 0.22);\n  transform: translateY(-4px) rotate(0deg);\n}\n\n.mda-asset-remove {\n  position: absolute;\n  top: -10px;\n  right: -10px;\n  z-index: 45;\n  width: 26px;\n  height: 26px;\n  padding: 0;\n  border: 0;\n  border-radius: 999px;\n  background: #20252d;\n  color: #f8fafc;\n  font: 16px/26px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n  cursor: pointer;\n  opacity: 0;\n  pointer-events: none;\n  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.28);\n  transition: opacity 160ms ease, transform 160ms ease;\n  transform: translateY(4px);\n}\n\n.mda-asset-card:hover .mda-asset-remove,\n.mda-asset-card:focus-within .mda-asset-remove,\n.mda-asset-chip:hover .mda-asset-remove,\n.mda-asset-chip:focus .mda-asset-remove {\n  opacity: 1;\n  pointer-events: auto;\n  transform: translateY(0);\n}\n\n.mda-asset-remove:hover {\n  background: #111827;\n}\n\n.mda-popover-panel {\n  position: fixed;\n  z-index: 2147483647;\n  display: block;\n  min-width: 0;\n  min-height: 72px;\n  overflow: auto;\n  border: 1px solid #d0d5dd;\n  border-radius: 14px;\n  background: rgba(255, 255, 255, 0.99);\n  color: #101828;\n  box-shadow: 0 18px 44px rgba(16, 24, 40, 0.18);\n  backdrop-filter: blur(10px);\n  pointer-events: auto;\n}\n\n.mda-asset-popover {\n  display: grid;\n  gap: 10px;\n  padding: 12px;\n  min-width: 0;\n}\n\n.mda-asset-popover-head {\n  display: flex;\n  align-items: flex-start;\n  gap: 8px;\n}\n\n.mda-asset-popover-badge {\n  flex: 0 0 auto;\n  min-width: 0;\n  height: 22px;\n  padding: 0 8px;\n  border-radius: 999px;\n  background: #e0edff;\n  color: #1d4ed8;\n  font: 11px/22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-asset-popover-title-wrap {\n  min-width: 0;\n  display: grid;\n  gap: 3px;\n}\n\n.mda-asset-popover-title {\n  color: #101828;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-asset-popover-subtitle {\n  color: #667085;\n  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  word-break: break-all;\n}\n\n.mda-asset-popover-grid {\n  display: grid;\n  gap: 8px;\n}\n\n.mda-asset-popover-grid-item,\n.mda-asset-popover-section {\n  display: grid;\n  gap: 4px;\n  min-width: 0;\n}\n\n.mda-asset-popover-grid-item span,\n.mda-asset-popover-section span {\n  color: #475467;\n  font-size: 11px;\n  font-weight: 650;\n}\n\n.mda-asset-popover-grid-item pre,\n.mda-asset-popover-section pre {\n  margin: 0;\n  padding: 7px 8px;\n  overflow: auto;\n  border-radius: 8px;\n  background: #f8fafc;\n  color: #344054;\n  font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n\n.mda-composer {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  gap: 8px;\n  align-items: stretch;\n  padding: 10px 12px;\n  border: 1px solid #d9dee7;\n  border-radius: 20px;\n  background: #ffffff;\n  box-shadow: 0 2px 10px rgba(16, 24, 40, 0.08);\n}\n\n.mda-composer-input {\n  display: block;\n  width: 100%;\n  min-height: 72px;\n  max-height: 184px;\n  border: 0;\n  border-radius: 0;\n  padding: 4px 2px 0;\n  background: transparent;\n  color: #101828;\n  font-size: 14px;\n  line-height: 1.6;\n  resize: none;\n  overflow: auto;\n  white-space: pre-wrap;\n  outline: none;\n}\n\n.mda-composer-shortcut {\n  display: grid;\n  gap: 5px;\n  max-height: 188px;\n  padding-top: 6px;\n  overflow: auto;\n  border-top: 1px solid #eef2f6;\n}\n\n.mda-composer-shortcut-item {\n  display: grid;\n  grid-template-columns: 34px minmax(0, 1fr);\n  align-items: center;\n  gap: 8px;\n  padding: 6px 8px;\n  border: 0;\n  border-radius: 12px;\n  background: #f8fafc;\n  color: #101828;\n  text-align: left;\n  cursor: pointer;\n}\n\n.mda-composer-shortcut-item.is-active,\n.mda-composer-shortcut-item:hover {\n  background: #eaf2ff;\n}\n\n.mda-composer-shortcut-thumb {\n  width: 34px;\n  height: 34px;\n  border-radius: 8px;\n  background: #e5e7eb center center / cover no-repeat;\n  color: #667085;\n  font: 12px/34px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n  text-align: center;\n}\n\n.mda-composer-shortcut-thumb.is-empty {\n  background-image: linear-gradient(135deg, #eef2ff, #e2e8f0);\n}\n\n.mda-composer-shortcut-meta {\n  display: grid;\n  gap: 2px;\n  min-width: 0;\n}\n\n.mda-composer-shortcut-meta strong {\n  color: #1d4ed8;\n  font: 12px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-composer-shortcut-meta em {\n  overflow: hidden;\n  color: #667085;\n  font-style: normal;\n  font-size: 12px;\n  line-height: 1.35;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-composer-shortcut-empty {\n  padding: 6px 2px 2px;\n  color: #98a2b3;\n  font-size: 12px;\n}\n\n.mda-composer-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  min-width: 0;\n}\n\n.mda-toolbar-left,\n.mda-toolbar-right {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n}\n\n.mda-toolbar-left {\n  flex: 1 1 auto;\n}\n\n.mda-toolbar-right {\n  flex: 0 0 auto;\n}\n\n.mda-tool-icon-btn,\n.mda-send-btn {\n  flex: 0 0 auto;\n}\n\n.mda-tool-icon-btn {\n  position: relative;\n  width: 28px;\n  height: 28px;\n  border: 0;\n  border-radius: 999px;\n  background: transparent;\n  color: #667085;\n  cursor: pointer;\n}\n\n.mda-tool-icon-btn::before,\n.mda-tool-icon-btn::after {\n  content: "";\n  position: absolute;\n  left: 8px;\n  right: 8px;\n  top: 14px;\n  height: 2px;\n  border-radius: 999px;\n  background: currentColor;\n}\n\n.mda-tool-icon-btn::after {\n  transform: rotate(90deg);\n}\n\n.mda-tool-icon-btn:hover {\n  background: #f2f4f7;\n  color: #101828;\n}\n\n.mda-tool-icon-btn:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n\n.mda-assist-chip,\n.mda-inline-text-btn,\n.mda-model-trigger {\n  height: 28px;\n  border: 0;\n  background: transparent;\n  color: #344054;\n  font: 12px/28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-assist-chip {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;\n  padding: 0 4px;\n  color: #344054;\n  cursor: pointer;\n}\n\n.mda-assist-chip.is-active {\n  color: #1d87f5;\n}\n\n.mda-assist-chip:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n\n.mda-chip-shield {\n  position: relative;\n  width: 17px;\n  height: 17px;\n  border: 1.5px solid currentColor;\n  border-radius: 50%;\n}\n\n.mda-chip-shield::before {\n  content: "";\n  position: absolute;\n  left: 5px;\n  top: 2px;\n  width: 3px;\n  height: 8px;\n  border-right: 1.5px solid currentColor;\n  border-bottom: 1.5px solid currentColor;\n  transform: rotate(38deg);\n}\n\n.mda-inline-text-btn {\n  max-width: 90px;\n  padding: 0;\n  cursor: pointer;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  line-height: 31px;\n}\n\n.mda-inline-text-btn:hover {\n  color: #101828;\n}\n\n.mda-build-version {\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 10px;\n  line-height: 31px;\n  color: #98a2b3;\n  white-space: nowrap;\n  user-select: text;\n}\n\n.mda-model-menu {\n  position: relative;\n  flex: 0 0 auto;\n}\n\n.mda-model-trigger {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  max-width: 160px;\n  min-width: 0;\n  padding: 0 2px;\n  color: #101828;\n  cursor: pointer;\n}\n\n.mda-model-trigger.is-active {\n  color: #1d4ed8;\n}\n\n.mda-model-trigger:disabled {\n  opacity: 0.55;\n  cursor: not-allowed;\n}\n\n.mda-model-trigger strong,\n.mda-model-trigger em {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-model-trigger strong {\n  font-size: 12px;\n  font-weight: 650;\n}\n\n.mda-model-trigger em {\n  color: #667085;\n  font-style: normal;\n  font-weight: 650;\n}\n\n.mda-model-trigger i {\n  width: 9px;\n  height: 9px;\n  border-right: 2px solid #667085;\n  border-bottom: 2px solid #667085;\n  transform: rotate(45deg) translateY(-2px);\n}\n\n.mda-model-dropdown {\n  position: absolute;\n  right: -8px;\n  bottom: calc(100% + 10px);\n  z-index: 40;\n  display: grid;\n  gap: 4px;\n  width: 220px;\n  padding: 10px;\n  border: 1px solid #e4e7ec;\n  border-radius: 18px;\n  background: rgba(255, 255, 255, 0.98);\n  box-shadow: 0 16px 40px rgba(16, 24, 40, 0.16);\n  backdrop-filter: blur(12px);\n}\n\n.mda-model-option {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  min-width: 0;\n  min-height: 34px;\n  padding: 0 10px;\n  border: 0;\n  border-radius: 12px;\n  background: transparent;\n  color: #101828;\n  cursor: pointer;\n  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n  text-align: left;\n}\n\n.mda-model-option:hover,\n.mda-model-option.is-selected {\n  background: #f5f7fb;\n}\n\n.mda-model-option.is-selected::after {\n  content: "";\n  flex: 0 0 auto;\n  width: 6px;\n  height: 10px;\n  margin-left: 4px;\n  border-right: 2px solid #111827;\n  border-bottom: 2px solid #111827;\n  transform: rotate(45deg);\n}\n\n.mda-model-option span,\n.mda-model-option em {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-model-option span {\n  font-size: 12px;\n  font-weight: 650;\n}\n\n.mda-model-option em {\n  color: #667085;\n  font-style: normal;\n}\n\n.mda-model-divider {\n  height: 1px;\n  margin: 4px 2px;\n  background: #eceff3;\n}\n\n.mda-send-btn {\n  position: relative;\n  display: grid;\n  place-items: center;\n  width: 34px;\n  height: 34px;\n  padding: 0;\n  border: 0;\n  border-radius: 999px;\n  background: #161b22;\n  color: #ffffff;\n  cursor: pointer;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-send-arrow {\n  position: relative;\n  width: 16px;\n  height: 16px;\n}\n\n.mda-send-arrow::before {\n  content: "";\n  position: absolute;\n  left: 7px;\n  top: 3px;\n  width: 2px;\n  height: 12px;\n  border-radius: 999px;\n  background: #ffffff;\n}\n\n.mda-send-arrow::after {\n  content: "";\n  position: absolute;\n  left: 3px;\n  top: 2px;\n  width: 8px;\n  height: 8px;\n  border-top: 2px solid #ffffff;\n  border-left: 2px solid #ffffff;\n  transform: rotate(45deg);\n}\n\n.mda-send-btn:not(:disabled):hover {\n  background: #1f2937;\n}\n\n.mda-send-btn.is-stopping {\n  border-color: #101828;\n  background: #101828;\n  color: #ffffff;\n  opacity: 0.72;\n}\n\n.mda-send-btn.is-stopping:not(:disabled):hover {\n  background: #101828;\n  opacity: 0.86;\n}\n\n.mda-stop-icon {\n  display: block;\n  width: 13px;\n  height: 13px;\n  border-radius: 3px;\n  background: currentColor;\n}\n\n.mda-send-btn:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n\n@media (max-width: 460px) {\n  .mda-composer-toolbar {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .mda-toolbar-left,\n  .mda-toolbar-right {\n    width: 100%;\n    justify-content: space-between;\n  }\n\n  .mda-model-trigger {\n    max-width: 140px;\n  }\n\n  .mda-model-dropdown {\n    right: 0;\n    width: min(220px, calc(100vw - 40px));\n  }\n}\n\n.mda-floating-note {\n  border-color: #d0d5dd;\n  border-radius: 12px;\n  box-shadow: 0 18px 44px rgba(16, 24, 40, 0.22);\n}\n\n.mda-floating-textarea {\n  border-color: #d0d5dd;\n  border-radius: 9px;\n}\n\n.mda-floating-textarea:focus {\n  border-color: #101828;\n  box-shadow: 0 0 0 3px rgba(16, 24, 40, 0.1);\n}\n\n.mda-settings-trigger {\n  flex: 0 0 auto;\n  font-size: 16px;\n}\n\n.mda-memory-shell {\n  position: absolute;\n  z-index: 50;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  min-width: 0;\n  background: #f7f8fa;\n  color: #1f2328;\n}\n\n.mda-memory-head {\n  min-height: 56px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 8px 10px 8px 14px;\n  border-bottom: 1px solid #d8dee6;\n  background: #ffffff;\n}\n\n.mda-memory-head > div {\n  min-width: 0;\n  display: grid;\n  gap: 1px;\n}\n\n.mda-memory-head strong {\n  font-size: 14px;\n}\n\n.mda-memory-head span {\n  overflow: hidden;\n  color: #6b7280;\n  font-size: 12px;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-memory-close {\n  font-size: 21px;\n}\n\n.mda-memory-tabs {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  border-bottom: 1px solid #d8dee6;\n  background: #ffffff;\n}\n\n.mda-memory-tabs button {\n  min-width: 0;\n  height: 38px;\n  padding: 0 8px;\n  border: 0;\n  border-bottom: 2px solid transparent;\n  background: transparent;\n  color: #667085;\n  cursor: pointer;\n  font-size: 12px;\n}\n\n.mda-memory-tabs button:hover {\n  color: #111827;\n  background: #f8fafc;\n}\n\n.mda-memory-tabs button.is-active {\n  border-bottom-color: #2563eb;\n  color: #111827;\n  font-weight: 700;\n}\n\n.mda-memory-body {\n  flex: 1 1 auto;\n  min-height: 0;\n  padding: 14px;\n  overflow: auto;\n}\n\n.mda-memory-feedback {\n  margin-bottom: 12px;\n  padding: 8px 10px;\n  border: 1px solid #abefc6;\n  border-radius: 6px;\n  background: #ecfdf3;\n  color: #067647;\n  font-size: 12px;\n}\n\n.mda-memory-feedback.is-error {\n  border-color: #fecdca;\n  background: #fef3f2;\n  color: #b42318;\n}\n\n.mda-memory-state,\n.mda-memory-empty {\n  display: grid;\n  place-items: center;\n  gap: 10px;\n  min-height: 180px;\n  padding: 24px;\n  color: #667085;\n  text-align: center;\n}\n\n.mda-memory-state.is-error {\n  color: #b42318;\n}\n\n.mda-memory-state button {\n  height: 30px;\n  padding: 0 12px;\n  border: 1px solid #d0d5dd;\n  border-radius: 6px;\n  background: #ffffff;\n  cursor: pointer;\n}\n\n.mda-memory-form {\n  display: grid;\n  gap: 12px;\n  margin-top: 14px;\n}\n\n.mda-memory-field {\n  min-width: 0;\n  display: grid;\n  gap: 6px;\n}\n\n.mda-memory-field > span {\n  color: #344054;\n  font-size: 12px;\n  font-weight: 650;\n}\n\n.mda-memory-field small {\n  color: #98a2b3;\n  font-size: 11px;\n  font-weight: 400;\n}\n\n.mda-memory-field input,\n.mda-memory-field select,\n.mda-memory-field textarea {\n  width: 100%;\n  min-width: 0;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  background: #ffffff;\n  color: #1f2937;\n  outline: none;\n  font: inherit;\n}\n\n.mda-memory-field input,\n.mda-memory-field select {\n  height: 34px;\n  padding: 0 9px;\n}\n\n.mda-memory-field textarea {\n  min-height: 66px;\n  padding: 8px 9px;\n  resize: vertical;\n  line-height: 1.5;\n}\n\n.mda-memory-field textarea.is-code {\n  font: 11px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-memory-field input:focus,\n.mda-memory-field select:focus,\n.mda-memory-field textarea:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);\n}\n\n.mda-memory-row {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 10px;\n}\n\n.mda-memory-advanced {\n  border-top: 1px solid #e4e7ec;\n  padding-top: 10px;\n}\n\n.mda-memory-advanced summary {\n  cursor: pointer;\n  color: #344054;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-memory-advanced[open] {\n  display: grid;\n  gap: 12px;\n}\n\n.mda-memory-advanced[open] summary {\n  margin-bottom: 2px;\n}\n\n.mda-memory-actions {\n  position: sticky;\n  bottom: -14px;\n  display: flex;\n  align-items: center;\n  justify-content: flex-end;\n  gap: 8px;\n  padding: 12px 0 14px;\n  background: #f7f8fa;\n}\n\n.mda-memory-actions button {\n  height: 34px;\n  padding: 0 13px;\n  border: 1px solid #d0d5dd;\n  border-radius: 6px;\n  background: #ffffff;\n  color: #344054;\n  cursor: pointer;\n  font-weight: 650;\n}\n\n.mda-memory-actions button.is-primary {\n  border-color: #2563eb;\n  background: #2563eb;\n  color: #ffffff;\n}\n\n.mda-memory-actions button.is-danger {\n  border-color: #fda29b;\n  color: #b42318;\n}\n\n.mda-memory-actions button:disabled {\n  cursor: not-allowed;\n  opacity: 0.55;\n}\n\n.mda-memory-section-title {\n  margin-top: 4px;\n  color: #344054;\n  font-size: 12px;\n  font-weight: 750;\n}\n\n.mda-memory-tool,\n.mda-memory-provider {\n  display: grid;\n  gap: 6px;\n  padding: 10px 11px;\n  border: 1px solid #d8dee6;\n  border-radius: 6px;\n  background: #ffffff;\n}\n\n.mda-memory-tool > div,\n.mda-memory-provider > div {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 10px;\n}\n\n.mda-memory-tool strong,\n.mda-memory-provider strong {\n  color: #111827;\n  font-size: 13px;\n}\n\n.mda-memory-tool small,\n.mda-memory-provider small {\n  color: #667085;\n  font-size: 11px;\n}\n\n.mda-memory-tool p,\n.mda-memory-provider p {\n  margin: 0;\n  color: #475467;\n  font-size: 12px;\n  line-height: 1.45;\n}\n\n.mda-memory-project-note {\n  margin-bottom: 10px;\n  color: #667085;\n  font-size: 12px;\n}\n\n.mda-memory-project-doc {\n  min-height: 240px;\n  margin: 0;\n  padding: 12px;\n  overflow: auto;\n  border: 1px solid #d8dee6;\n  border-radius: 6px;\n  background: #ffffff;\n  color: #344054;\n  font: 11px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n}\n\n.mda-chat-body {\n  height: calc(100vh - 52px);\n}\n\n.mda-settings-page,\n.mda-settings-page .mda-memory-shell {\n  position: fixed;\n  inset: 0;\n  width: 100%;\n  height: 100vh;\n  background: #ffffff;\n  color: #1f2328;\n  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-memory-shell.is-page {\n  position: fixed;\n  z-index: 1;\n  background: #ffffff;\n}\n\n.mda-settings-layout {\n  display: flex;\n  min-width: 0;\n  min-height: 0;\n  height: 100%;\n}\n\n.mda-memory-shell:not(.is-page) .mda-settings-layout {\n  display: flex;\n  flex-direction: column;\n}\n\n.mda-settings-sidebar {\n  flex: 0 0 270px;\n  display: flex;\n  flex-direction: column;\n  min-width: 0;\n  height: 100%;\n  padding: 16px 12px;\n  border-right: 1px solid #eceff3;\n  background: linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(255, 255, 255, 0.98));\n}\n\n.mda-settings-back {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  align-self: flex-start;\n  height: 36px;\n  padding: 0 8px;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: #667085;\n  cursor: pointer;\n  text-align: left;\n  font: 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-settings-back:hover {\n  background: #e6ebf2;\n  color: #101828;\n}\n\n.mda-settings-search {\n  position: relative;\n  display: block;\n  width: 100%;\n  min-width: 0;\n  box-sizing: border-box;\n  margin: 10px 0 18px;\n}\n\n.mda-settings-search .xicon {\n  position: absolute;\n  left: 11px;\n  top: 50%;\n  color: #98a2b3;\n  transform: translateY(-50%);\n}\n\n.mda-settings-search input {\n  width: 100%;\n  max-width: 100%;\n  box-sizing: border-box;\n  height: 34px;\n  padding: 0 12px 0 32px;\n  border: 1px solid #d8dee6;\n  border-radius: 10px;\n  background: #ffffff;\n  color: #667085;\n  outline: none;\n  font: 13px/34px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-settings-group-label {\n  margin: 14px 10px 8px;\n  color: #98a2b3;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-settings-nav {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  height: 34px;\n  padding: 0 10px;\n  border: 0;\n  border-radius: 12px;\n  background: transparent;\n  color: #344054;\n  cursor: pointer;\n  text-align: left;\n  font: 13px/34px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-settings-nav:hover,\n.mda-settings-nav.is-active {\n  background: #eef2f6;\n  color: #101828;\n}\n\n.mda-settings-nav.is-active {\n  font-weight: 700;\n}\n\n.mda-settings-nav .xicon,\n.mda-settings-back .xicon {\n  flex: 0 0 auto;\n}\n\n.mda-settings-main {\n  flex: 1 1 auto;\n  display: flex;\n  flex-direction: column;\n  min-width: 0;\n  min-height: 0;\n  background: #ffffff;\n}\n\n.mda-settings-main-head {\n  flex: 0 0 auto;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 14px;\n  min-height: 92px;\n  padding: 22px 28px;\n  border-bottom: 1px solid #f0f2f5;\n}\n\n.mda-settings-main-head div {\n  display: grid;\n  gap: 2px;\n  min-width: 0;\n}\n\n.mda-settings-main-head span {\n  color: #667085;\n  font-size: 12px;\n}\n\n.mda-settings-main-head strong {\n  color: #101828;\n  font-size: 24px;\n  line-height: 1.2;\n}\n\n.mda-settings-main-head em {\n  overflow: hidden;\n  color: #98a2b3;\n  font-style: normal;\n  font-size: 13px;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-settings-primary {\n  flex: 0 0 auto;\n  height: 34px;\n  padding: 0 14px;\n  border: 1px solid #101828;\n  border-radius: 10px;\n  background: #101828;\n  color: #ffffff;\n  cursor: pointer;\n  font: 13px/32px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n  font-weight: 700;\n}\n\n.mda-settings-primary:hover {\n  background: #1d2939;\n}\n\n.mda-memory-shell.is-page .mda-memory-body {\n  width: min(860px, calc(100vw - 340px));\n  padding: 28px;\n}\n\n.mda-memory-shell.is-page .mda-memory-form {\n  gap: 16px;\n  margin-top: 18px;\n}\n\n.mda-memory-shell.is-page .mda-memory-field input,\n.mda-memory-shell.is-page .mda-memory-field select {\n  height: 38px;\n}\n\n.mda-memory-shell.is-page .mda-memory-tool,\n.mda-memory-shell.is-page .mda-memory-provider {\n  border-radius: 10px;\n}\n\n.mda-settings-assets {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));\n  gap: 14px;\n}\n\n.mda-settings-asset {\n  display: grid;\n  grid-template-columns: 84px minmax(0, 1fr);\n  gap: 12px;\n  align-items: center;\n  min-width: 0;\n  padding: 12px;\n  border: 1px solid #e4e7ec;\n  border-radius: 12px;\n  background: #ffffff;\n}\n\n.mda-settings-asset-thumb {\n  width: 84px;\n  height: 84px;\n  border-radius: 8px;\n  background: #f2f4f7 center center / contain no-repeat;\n  color: #667085;\n  display: grid;\n  place-items: center;\n  font: 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-settings-asset-thumb.is-empty {\n  background-image: linear-gradient(135deg, #eef2ff, #e2e8f0);\n}\n\n.mda-settings-asset-main {\n  display: grid;\n  gap: 5px;\n  min-width: 0;\n}\n\n.mda-settings-asset-main strong {\n  color: #101828;\n  font-size: 13px;\n}\n\n.mda-settings-asset-main span,\n.mda-settings-asset-main code {\n  min-width: 0;\n  overflow: hidden;\n  color: #667085;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-settings-asset-main code {\n  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n@media (max-width: 720px) {\n  .mda-settings-sidebar {\n    flex-basis: 210px;\n  }\n\n  .mda-memory-shell.is-page .mda-memory-body {\n    width: auto;\n    padding: 18px;\n  }\n}\n\n/* 本地服务未启动提示条 */\n.mda-service-down {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin: 8px 12px 0;\n  padding: 10px 12px;\n  border: 1px solid #f0c36d;\n  background: #fff8e6;\n  border-radius: 8px;\n  color: #7a5b00;\n}\n.mda-service-down-icon {\n  font-size: 16px;\n  line-height: 1;\n}\n.mda-service-down-main {\n  flex: 1 1 auto;\n  min-width: 0;\n}\n.mda-service-down-title {\n  font-size: 13px;\n  font-weight: 600;\n}\n.mda-service-down-hint {\n  font-size: 12px;\n  margin-top: 2px;\n  color: #8a6d1f;\n}\n.mda-service-down-hint code {\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  background: rgba(122, 91, 0, 0.1);\n  padding: 1px 5px;\n  border-radius: 4px;\n}\n.mda-service-down-retry {\n  flex: 0 0 auto;\n  padding: 5px 12px;\n  border: 1px solid #e0a93b;\n  background: #fff;\n  color: #7a5b00;\n  border-radius: 6px;\n  font-size: 12px;\n  cursor: pointer;\n}\n.mda-service-down-retry:disabled {\n  opacity: 0.6;\n  cursor: default;\n}\n\n/* 新版本更新提示条 */\n.mda-update-bar {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin: 8px 12px 0;\n  padding: 10px 12px;\n  border: 1px solid #9ecbff;\n  background: #eef6ff;\n  border-radius: 8px;\n  color: #0b4a86;\n}\n.mda-update-icon { font-size: 15px; line-height: 1; }\n.mda-update-main { flex: 1 1 auto; min-width: 0; }\n.mda-update-title { font-size: 13px; font-weight: 600; }\n.mda-update-hint { font-size: 12px; margin-top: 2px; color: #2b6cb0; }\n.mda-update-btn {\n  flex: 0 0 auto;\n  padding: 5px 14px;\n  border: none;\n  background: #1a73e8;\n  color: #fff;\n  border-radius: 6px;\n  font-size: 12px;\n  cursor: pointer;\n}\n.mda-update-btn:hover { background: #1666d0; }\n.mda-update-spinner {\n  flex: 0 0 auto;\n  width: 14px;\n  height: 14px;\n  border: 2px solid #9ecbff;\n  border-top-color: #1a73e8;\n  border-radius: 50%;\n  animation: mda-update-spin 0.8s linear infinite;\n}\n@keyframes mda-update-spin { to { transform: rotate(360deg); } }\n\n/* MCP 状态面板 */\n.mda-mcp-overlay {\n  position: absolute; inset: 0; z-index: 40;\n  background: rgba(15, 23, 42, 0.32);\n  display: flex; align-items: stretch; justify-content: stretch;\n}\n.mda-mcp-panel {\n  display: flex; flex-direction: column; width: 100%; height: 100%;\n  background: #fff;\n}\n.mda-mcp-head {\n  display: flex; align-items: center; justify-content: space-between;\n  padding: 10px 12px; border-bottom: 1px solid #eef0f3;\n}\n.mda-mcp-title { font-size: 14px; font-weight: 600; }\n.mda-mcp-head-actions { display: flex; gap: 6px; }\n.mda-mcp-btn {\n  padding: 4px 12px; border: 1px solid #d7dbe0; background: #fff;\n  border-radius: 6px; font-size: 12px; cursor: pointer;\n}\n.mda-mcp-btn:disabled { opacity: 0.6; cursor: default; }\n.mda-mcp-body { flex: 1 1 auto; overflow-y: auto; padding: 12px; }\n.mda-mcp-error { color: #d03050; font-size: 12px; margin-bottom: 8px; }\n.mda-mcp-section-title { font-size: 12px; font-weight: 600; color: #667085; margin: 12px 0 6px; }\n.mda-mcp-config {\n  display: grid;\n  gap: 6px;\n  padding: 8px;\n  border: 1px solid #eef0f3;\n  border-radius: 8px;\n  background: #f8fafc;\n}\n.mda-mcp-config div {\n  display: grid;\n  gap: 3px;\n}\n.mda-mcp-config strong {\n  color: #667085;\n  font-size: 11px;\n}\n.mda-mcp-config code {\n  color: #344054;\n  font: 11px/1.45 ui-monospace, Menlo, monospace;\n  word-break: break-all;\n}\n.mda-mcp-empty { font-size: 12px; color: #98a2b3; }\n.mda-mcp-empty code { background: #f2f4f7; padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, Menlo, monospace; }\n.mda-mcp-servers { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }\n.mda-mcp-server { border: 1px solid #eef0f3; border-radius: 8px; padding: 8px 10px; }\n.mda-mcp-server-head { display: flex; align-items: center; gap: 6px; }\n.mda-mcp-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }\n.mda-mcp-dot.is-ready { background: #12b76a; }\n.mda-mcp-dot.is-failed { background: #f04438; }\n.mda-mcp-server-name { font-size: 13px; font-weight: 600; }\n.mda-mcp-server-status { font-size: 11px; color: #667085; margin-left: auto; }\n.mda-mcp-mini-btn {\n  flex: 0 0 auto;\n  padding: 2px 8px;\n  border: 1px solid #d7dbe0;\n  border-radius: 6px;\n  background: #fff;\n  color: #344054;\n  cursor: pointer;\n  font-size: 11px;\n}\n.mda-mcp-mini-btn:disabled {\n  opacity: 0.6;\n  cursor: default;\n}\n.mda-mcp-server-error { font-size: 11px; color: #d03050; margin-top: 4px; word-break: break-all; }\n.mda-mcp-tools { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }\n.mda-mcp-tool { font-size: 11px; font-family: ui-monospace, Menlo, monospace; color: #344054; }\n.mda-mcp-logs {\n  border: 1px solid #eef0f3; border-radius: 8px; padding: 8px;\n  background: #0b1020; max-height: 240px; overflow-y: auto;\n}\n.mda-mcp-log { display: flex; gap: 8px; font-size: 11px; font-family: ui-monospace, Menlo, monospace; line-height: 1.6; }\n.mda-mcp-log-time { color: #64748b; flex: 0 0 auto; }\n.mda-mcp-log-line { color: #cbd5e1; word-break: break-all; }\n\n/* 左下角菜单（绑定项目 / MCP 设置 / 设置） */\n.mda-menu-wrap { position: relative; display: inline-flex; }\n.mda-menu-backdrop { position: fixed; inset: 0; z-index: 49; }\n.mda-menu {\n  position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 50;\n  min-width: 132px; padding: 4px;\n  background: #fff; border: 1px solid #e4e7ec; border-radius: 8px;\n  box-shadow: 0 6px 20px rgba(16, 24, 40, 0.14);\n}\n.mda-menu-item {\n  display: block; width: 100%; text-align: left;\n  padding: 7px 10px; border: none; background: transparent;\n  border-radius: 6px; font-size: 13px; color: #344054; cursor: pointer;\n}\n.mda-menu-item:hover { background: #f2f4f7; }\n';
  (function bootstrapMagnusSidePanel() {
    const APP_KEY = "__MAGNUS_DEV_ASSISTANT__";
    const ROOT_ID = "magnus-side-panel-root";
    const sidePanelConfig = window.__MAGNUS_SIDE_PANEL__ || {};
    const oldApp = window[APP_KEY];
    if (oldApp && typeof oldApp.destroy === "function") {
      oldApp.destroy();
    }
    const bootstrap = createMagnusBootstrap();
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

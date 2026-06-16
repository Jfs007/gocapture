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
  const isPlainObject = (val) => toTypeString(val) === "[object Object]";
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
      return str.replace(camelizeRE, (c) => c.slice(1).toUpperCase());
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
  function getCurrentScope() {
    return activeEffectScope;
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
  function batch(sub, isComputed = false) {
    sub.flags |= 8;
    if (isComputed) {
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
  // @__NO_SIDE_EFFECTS__
  function shallowRef(value) {
    return createRef(value, true);
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
    } else if (isPlainObject(value)) {
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
  const NULL_DYNAMIC_COMPONENT = /* @__PURE__ */ Symbol.for("v-ndc");
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
      render,
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
        const c = computed({
          get,
          set
        });
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          get: () => c.value,
          set: (v) => c.value = v
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
    if (render && instance.render === NOOP) {
      instance.render = render;
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
  function createAppAPI(render, hydrate) {
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
              render(vnode, rootContainer, namespace);
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
            render(null, app._container);
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
      render,
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
          render.call(
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
        const render2 = Component;
        if (false) ;
        result = normalizeVNode(
          render2.length > 1 ? render2(
            false ? /* @__PURE__ */ shallowReadonly(props) : props,
            false ? {
              get attrs() {
                markAttrsAccessed();
                return /* @__PURE__ */ shallowReadonly(attrs);
              },
              slots,
              emit: emit2
            } : { attrs, slots, emit: emit2 }
          ) : render2(
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
        unmount(n1, parentComponent, parentSuspense, true);
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
          unmount(c1[i], parentComponent, parentSuspense, true);
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
            unmount(prevChild, parentComponent, parentSuspense, true);
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
            unmount(prevChild, parentComponent, parentSuspense, true);
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
    const unmount = (vnode, parentComponent, parentSuspense, doRemove = false, optimized = false) => {
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
        unmount(subTree, instance, parentSuspense, doRemove);
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
        unmount(children[i], parentComponent, parentSuspense, doRemove, optimized);
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
    const render = (vnode, container, namespace) => {
      let instance;
      if (vnode == null) {
        if (container._vnode) {
          unmount(container._vnode, null, null, true);
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
      um: unmount,
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
      render,
      hydrate,
      createApp: createAppAPI(render)
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
    let i, j, u, v, c;
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
          c = u + v >> 1;
          if (arr[result[c]] < arrI) {
            u = c + 1;
          } else {
            v = c;
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
      let { class: klass, style } = props;
      if (klass && !isString(klass)) {
        props.class = normalizeClass(klass);
      }
      if (isObject(style)) {
        if (/* @__PURE__ */ isProxy(style) && !isArray(style)) {
          style = extend({}, style);
        }
        props.style = normalizeStyle(style);
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
    const c = /* @__PURE__ */ computed$1(getterOrOptions, debugOptions, isInSSRComponentSetup);
    return c;
  };
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
  const CSS_VAR_TEXT = /* @__PURE__ */ Symbol("");
  const displayRE = /(?:^|;)\s*display\s*:/;
  function patchStyle(el, prev, next) {
    const style = el.style;
    const isCssString = isString(next);
    let hasControlledDisplay = false;
    if (next && !isCssString) {
      if (prev) {
        if (!isString(prev)) {
          for (const key in prev) {
            if (next[key] == null) {
              setStyle(style, key, "");
            }
          }
        } else {
          for (const prevStyle of prev.split(";")) {
            const key = prevStyle.slice(0, prevStyle.indexOf(":")).trim();
            if (next[key] == null) {
              setStyle(style, key, "");
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
            setStyle(style, key, value);
          }
        } else {
          setStyle(style, key, "");
        }
      }
    } else {
      if (isCssString) {
        if (prev !== next) {
          const cssVarText = style[CSS_VAR_TEXT];
          if (cssVarText) {
            next += ";" + cssVarText;
          }
          style.cssText = next;
          hasControlledDisplay = displayRE.test(next);
        }
      } else if (prev) {
        el.removeAttribute("style");
      }
    }
    if (vShowOriginalDisplay in el) {
      el[vShowOriginalDisplay] = hasControlledDisplay ? style.display : "";
      if (el[vShowHidden]) {
        style.display = "none";
      }
    }
  }
  const importantRE = /\s*!important$/;
  function setStyle(style, name, val) {
    if (isArray(val)) {
      val.forEach((v) => setStyle(style, name, v));
    } else {
      if (val == null) val = "";
      if (name.startsWith("--")) {
        style.setProperty(name, val);
      } else {
        const prefixed = autoPrefix(style, name);
        if (importantRE.test(val)) {
          style.setProperty(
            hyphenate(prefixed),
            val.replace(importantRE, ""),
            "important"
          );
        } else {
          style[prefixed] = val;
        }
      }
    }
  }
  const prefixes = ["Webkit", "Moz", "ms"];
  const prefixCache = {};
  function autoPrefix(style, rawName) {
    const cached = prefixCache[rawName];
    if (cached) {
      return cached;
    }
    let name = camelize(rawName);
    if (name !== "filter" && name in style) {
      return prefixCache[rawName] = name;
    }
    name = capitalize(name);
    for (let i = 0; i < prefixes.length; i++) {
      const prefixed = prefixes[i] + name;
      if (prefixed in style) {
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
    const { mount } = app;
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
      const proxy = mount(container, false, resolveRootNamespace(container));
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
  const SOURCE_SERVER_URL = "http://127.0.0.1:17321";
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
          headers: {
            "Content-Type": "application/json"
          },
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
      stack: raw.stack || [],
      stackText: raw.stackText || "",
      limited: !!raw.limited
    };
  }
  const CTX_VALUE_KEY = Symbol("magnus-inspector-ctx-value");
  const CTX_API_KEY = Symbol("magnus-inspector-ctx-api");
  function useCtx(ctxValue, ctxApi) {
    const value = /* @__PURE__ */ shallowRef(ctxValue || {});
    const api = ctxApi || {};
    const setup = () => {
      provide(CTX_VALUE_KEY, value);
      provide(CTX_API_KEY, api);
    };
    return __spreadProps(__spreadValues({
      value
    }, api), {
      setup
    });
  }
  function useForm(key) {
    const ctxValue = inject(CTX_VALUE_KEY);
    if (!ctxValue) throw new Error("Magnus inspector context value is not provided");
    if (!key) return ctxValue;
    return ctxValue.value[key];
  }
  function useApi() {
    const api = inject(CTX_API_KEY);
    if (!api) throw new Error("Magnus inspector context api is not provided");
    return api;
  }
  function round(value) {
    return Math.round(value);
  }
  function compactText(text, limit = 240) {
    let value = String(text || "").replace(/\s+/g, " ").trim();
    if (value.length > limit) value = `${value.slice(0, limit)}...`;
    return value;
  }
  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
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
  function normalizeRequestInfo(raw, baseUrl) {
    var _a;
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
      requestKeys: flattenKeys(((_a = data.request) == null ? void 0 : _a.body) || {}, "", [], 0, 28),
      responseKeys: flattenKeys(data.result || {}, "", [], 0, 36),
      responseValues: flattenPrimitiveValues(data.result || {}, [], 0, 80),
      capturedAt: Date.now()
    };
  }
  function getClassName(element) {
    if (!element) return "";
    const value = element.getAttribute ? element.getAttribute("class") : element.className;
    return compactText(typeof value === "string" ? value : "", 320);
  }
  function getElementText(element) {
    return compactText(element.innerText || element.textContent || "", 320);
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
  function getStyleInfo(element) {
    const style = window.getComputedStyle(element);
    return {
      display: style.display,
      position: style.position,
      color: style.color,
      backgroundColor: style.backgroundColor,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      margin: style.margin,
      padding: style.padding,
      width: style.width,
      height: style.height
    };
  }
  function getAncestorInfo(element) {
    const result = [];
    let node = element.parentElement;
    while (node && node !== document.body && result.length < 4) {
      result.push({
        tag: node.tagName.toLowerCase(),
        className: getClassName(node),
        text: compactText(node.innerText || node.textContent || "", 120)
      });
      node = node.parentElement;
    }
    return result;
  }
  function getElementInfo(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      tag: element.tagName.toLowerCase(),
      className: getClassName(element),
      text: getElementText(element),
      computedStyle: getStyleInfo(element),
      ancestors: getAncestorInfo(element),
      box: {
        x: round(rect.left + window.scrollX),
        y: round(rect.top + window.scrollY),
        width: round(rect.width),
        height: round(rect.height)
      },
      viewportBox: {
        left: round(rect.left),
        top: round(rect.top),
        width: round(rect.width),
        height: round(rect.height)
      }
    };
  }
  function useChatMessages({
    project,
    selectedItems,
    selectionConfirmed,
    evidenceMessages,
    candidateLoading,
    includeApiEvidence,
    candidateHits,
    needsMoreEvidence,
    filesConfirmed,
    promptText,
    sourceServiceStatus,
    sourceServiceMessage,
    modelAssistLoading,
    modelAssistError,
    modelAssistLogs,
    modelAssistResult,
    selectionChatSummary,
    searchLogLines
  }) {
    const sourceServiceText = computed(() => {
      if (sourceServiceStatus.value === "loading") return sourceServiceMessage.value || "正在连接本地源码服务...";
      if (sourceServiceStatus.value === "connected") return "已连接本地源码服务，可读取真实源码路径";
      if (sourceServiceStatus.value === "fallback") return "本地源码服务不可用，已退回浏览器目录选择";
      return "本地源码服务用于选择源码路径和扫描文件";
    });
    const chatMessages = computed(() => {
      var _a;
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
        text: `${project.value.name} · ${project.value.fileCount} 个文件 · ${project.value.stackText || "未识别技术栈"}`
      });
      if (!selectedItems.value.length) {
        messages.push({
          id: "need-selection",
          role: "system",
          title: "等待页面选区",
          text: "移动鼠标高亮页面区域，按空格键添加选区，并在选区浮层填写改动点。"
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
      if (candidateLoading.value) {
        messages.push({
          id: "searching",
          role: "system",
          text: includeApiEvidence.value ? "正在基于选区和接口端点追踪候选文件。" : "正在基于选区文案、className 和页面路径检索候选文件。"
        });
      } else if (candidateHits.value.length) {
        messages.push({
          id: "search-log",
          role: "system",
          title: "检索日志",
          text: `找到 ${candidateHits.value.length} 个候选文件。`,
          logs: searchLogLines()
        });
      }
      if (modelAssistLoading == null ? void 0 : modelAssistLoading.value) {
        messages.push({
          id: "model-locating",
          role: "agent",
          title: "模型定位",
          text: "正在让模型阅读本地预检索结果和候选文件内容，进一步判断应修改的源码文件。",
          logs: (modelAssistLogs == null ? void 0 : modelAssistLogs.value) || [],
          logTitle: "查看模型操作日志"
        });
      } else if (modelAssistResult == null ? void 0 : modelAssistResult.value) {
        const result = modelAssistResult.value;
        const targets = result.modelItems || result.targetFiles || [];
        const targetLogs = targets.slice(0, 5).flatMap((item, index) => {
          return [
            `模型返回 ${index + 1}: ${item.path || item.file}${item.confidence ? ` · ${item.confidence}%` : ""}${item.exists === false ? " · 文件不存在" : ""}`,
            item.codeSnippet ? `code片段: ${item.codeSnippet}` : "",
            item.prompt ? `提示词: ${item.prompt}` : item.reason || "-"
          ].filter(Boolean);
        });
        messages.push({
          id: "model-result",
          role: "agent",
          title: `模型定位 · ${((_a = result.adapter) == null ? void 0 : _a.name) || "模型"}`,
          text: targets.length ? "模型已定位到修改点，并已生成最终提示词。" : "模型未定位到可用修改点。",
          logs: [
            ...result.logs || [],
            ...targetLogs,
            !targetLogs.length && result.rawText ? `模型原始返回:
${result.rawText}` : ""
          ].filter(Boolean),
          logTitle: "查看模型操作日志"
        });
      } else if (modelAssistError == null ? void 0 : modelAssistError.value) {
        messages.push({
          id: "model-error",
          role: "agent",
          title: "模型定位失败",
          text: modelAssistError.value,
          logs: (modelAssistLogs == null ? void 0 : modelAssistLogs.value) || [],
          logTitle: "查看模型操作日志"
        });
      }
      if (!candidateLoading.value && needsMoreEvidence.value) {
        messages.push({
          id: "need-more-evidence",
          role: "system",
          title: "线索不足，需要补充页面证据",
          text: [
            "当前选区命中了多个候选文件，但没有任何文件存在唯一精确命中文案。",
            "这通常说明页面里有复制粘贴的相似组件，或者当前选区过小，只能定位到通用组件块。",
            "请继续选择更外层、更独特的页面区域，或在输入框补充业务位置/交互目标后重新检索。"
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
          text: `已命中 ${candidateHits.value[0].file}，将作为修改文件。`
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
    return {
      id: item.id || `model-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: item.name || (provider === "deepseek" ? "DeepSeek" : type === "api" ? "API 模型" : "Exec 模型"),
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
  function useModelAdapters({ project, candidateHits, selectedCandidatePaths, searchPayload, routeResolverTrace, setToast }) {
    const modelConfigs = /* @__PURE__ */ ref(loadJson(MODEL_STORAGE_KEY, []).map(normalizeModel));
    const selectedModelId = /* @__PURE__ */ ref(window.localStorage.getItem(MODEL_SELECTED_KEY) || "");
    const useModelAssist = /* @__PURE__ */ ref(!!selectedModelId.value);
    const modelEditorOpen = /* @__PURE__ */ ref(false);
    const modelForm = /* @__PURE__ */ ref(defaultModelForm());
    const modelAssistLoading = /* @__PURE__ */ ref(false);
    const modelAssistError = /* @__PURE__ */ ref("");
    const modelAssistLogs = /* @__PURE__ */ ref([]);
    const modelAssistResult = /* @__PURE__ */ ref(null);
    const selectedModel = computed(() => {
      return modelConfigs.value.find((item) => item.id === selectedModelId.value) || null;
    });
    const canUseModelAssist = computed(() => {
      return !!selectedModel.value && !!project.value && project.value.source === "source-server";
    });
    function persistModels() {
      saveJson(MODEL_STORAGE_KEY, modelConfigs.value);
      try {
        if (selectedModelId.value) window.localStorage.setItem(MODEL_SELECTED_KEY, selectedModelId.value);
        else window.localStorage.removeItem(MODEL_SELECTED_KEY);
      } catch (error) {
      }
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
      setToast("模型已保存");
    }
    function removeSelectedModel() {
      var _a;
      if (!selectedModelId.value) return;
      modelConfigs.value = modelConfigs.value.filter((item) => item.id !== selectedModelId.value);
      selectedModelId.value = ((_a = modelConfigs.value[0]) == null ? void 0 : _a.id) || "";
      persistModels();
      if (!selectedModelId.value) useModelAssist.value = false;
      setToast("模型已移除");
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
      if (selectedModelId.value) setToast("模型已启用");
    }
    function disableModelAssist() {
      selectedModelId.value = "";
      useModelAssist.value = false;
      persistModels();
      setToast("模型已停用");
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
    }
    function mergeModelTargets(result) {
      const targets = ((result == null ? void 0 : result.modelItems) || (result == null ? void 0 : result.targetFiles) || []).filter((item) => item.exists);
      if (!targets.length) return;
      const oldHits = candidateHits.value.slice();
      const byFile = new Map(oldHits.map((hit) => [hit.file, hit]));
      const promoted = targets.map((target, index) => {
        var _a, _b;
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
          reasons: [
            `模型定位：${target.prompt || target.reason || ((_a = result.parsed) == null ? void 0 : _a.summary) || result.rawText || "-"}`,
            target.codeSnippet ? `模型代码片段：${target.codeSnippet}` : "",
            ...(old == null ? void 0 : old.reasons) || []
          ].filter(Boolean).slice(0, 10),
          modelPrompt: target.prompt || target.reason || "",
          modelCodeSnippet: target.codeSnippet || "",
          modelConfidence: target.confidence,
          modelAdapter: ((_b = result.adapter) == null ? void 0 : _b.name) || ""
        });
      });
      const promotedFiles = new Set(promoted.map((hit) => hit.file));
      candidateHits.value = [
        ...promoted,
        ...oldHits.filter((hit) => !promotedFiles.has(hit.file))
      ].sort((a, b) => b.score - a.score);
      selectedCandidatePaths.value = [promoted[0].file];
    }
    function runModelAssist() {
      return __async(this, null, function* () {
        var _a, _b, _c;
        if (!useModelAssist.value || !canUseModelAssist.value) return null;
        modelAssistLoading.value = true;
        modelAssistError.value = "";
        modelAssistLogs.value = ["模型定位请求已发起"];
        modelAssistResult.value = null;
        try {
          const data = yield sourceServerJson("/api/model/locate", {
            method: "POST",
            body: {
              adapter: selectedModel.value,
              searchPayload: searchPayload(),
              pagePath: ((_a = routeResolverTrace.value) == null ? void 0 : _a.pagePath) || "",
              routeResolver: routeResolverTrace.value,
              candidateHits: candidateHits.value.slice(0, 12),
              selectedCandidateHits: candidateHits.value.filter((hit) => selectedCandidatePaths.value.includes(hit.file)).slice(0, 8)
            },
            timeoutMs: Number(selectedModel.value.timeoutMs || 12e4) + 5e3,
            timeoutMessage: "模型定位超时"
          });
          modelAssistResult.value = data.result || null;
          modelAssistLogs.value = ((_b = modelAssistResult.value) == null ? void 0 : _b.logs) || [];
          mergeModelTargets(modelAssistResult.value);
          setToast("模型定位已完成");
          return modelAssistResult.value;
        } catch (error) {
          modelAssistError.value = error.message || String(error);
          modelAssistLogs.value = ((_c = error.payload) == null ? void 0 : _c.logs) || modelAssistLogs.value;
          setToast("模型定位失败");
          return null;
        } finally {
          modelAssistLoading.value = false;
        }
      });
    }
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
      runModelAssist
    };
  }
  function usePageRequests() {
    const recentRequests = /* @__PURE__ */ ref([]);
    function rememberRequest(info) {
      if (!info.url) return;
      recentRequests.value = [
        info,
        ...recentRequests.value.filter((item) => !(item.url === info.url && item.method === info.method))
      ].slice(0, 40);
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
  const MIN_PANEL_WIDTH = 320;
  const MAX_PANEL_WIDTH = 760;
  const COLLAPSED_PANEL_WIDTH = 54;
  function usePanelLayout({ active }) {
    const collapsed = /* @__PURE__ */ ref(false);
    const resizing = /* @__PURE__ */ ref(false);
    const panelWidth = /* @__PURE__ */ ref(440);
    let resizeState = null;
    let pageStyleSnapshot = null;
    let lastAppliedPanelWidth = 0;
    let resizeDispatchFrame = 0;
    const effectivePanelWidth = computed(() => collapsed.value ? COLLAPSED_PANEL_WIDTH : clampPanelWidth(panelWidth.value));
    const panelStyle = computed(() => ({
      width: `${effectivePanelWidth.value}px`,
      maxWidth: "calc(100vw - 18px)"
    }));
    function clampPanelWidth(value) {
      const viewportWidth = window.innerWidth || MAX_PANEL_WIDTH;
      const viewportMax = Math.max(220, Math.min(MAX_PANEL_WIDTH, viewportWidth - 18));
      const minWidth = Math.min(MIN_PANEL_WIDTH, viewportMax);
      return Math.max(minWidth, Math.min(Math.round(Number(value) || 440), viewportMax));
    }
    function capturePageStyleSnapshot() {
      if (pageStyleSnapshot || !document.body) return;
      pageStyleSnapshot = {
        bodyWidth: document.body.style.width,
        bodyMaxWidth: document.body.style.maxWidth,
        bodyMinWidth: document.body.style.minWidth,
        bodyBoxSizing: document.body.style.boxSizing,
        bodyTransition: document.body.style.transition,
        bodyUserSelect: document.body.style.userSelect,
        htmlOverflowX: document.documentElement.style.overflowX
      };
    }
    function applyPageInset() {
      if (!document.body) return;
      capturePageStyleSnapshot();
      const currentWidth = effectivePanelWidth.value;
      const width = `calc(100% - ${effectivePanelWidth.value}px)`;
      document.body.style.boxSizing = "border-box";
      document.body.style.width = width;
      document.body.style.maxWidth = width;
      document.body.style.minWidth = "0";
      document.body.style.transition = resizing.value ? "none" : "width 120ms ease, max-width 120ms ease";
      document.documentElement.style.overflowX = "hidden";
      if (lastAppliedPanelWidth === currentWidth) return;
      lastAppliedPanelWidth = currentWidth;
      if (resizeDispatchFrame) cancelAnimationFrame(resizeDispatchFrame);
      resizeDispatchFrame = window.requestAnimationFrame(() => {
        resizeDispatchFrame = 0;
        window.dispatchEvent(new Event("resize"));
      });
    }
    function restorePageInset() {
      if (!pageStyleSnapshot || !document.body) return;
      document.body.style.width = pageStyleSnapshot.bodyWidth;
      document.body.style.maxWidth = pageStyleSnapshot.bodyMaxWidth;
      document.body.style.minWidth = pageStyleSnapshot.bodyMinWidth;
      document.body.style.boxSizing = pageStyleSnapshot.bodyBoxSizing;
      document.body.style.transition = pageStyleSnapshot.bodyTransition;
      document.body.style.userSelect = pageStyleSnapshot.bodyUserSelect;
      document.documentElement.style.overflowX = pageStyleSnapshot.htmlOverflowX;
      pageStyleSnapshot = null;
      lastAppliedPanelWidth = 0;
    }
    function startPanelResize(event) {
      if (collapsed.value) return;
      resizeState = {
        startX: event.clientX,
        startWidth: panelWidth.value
      };
      resizing.value = true;
      document.documentElement.style.cursor = "col-resize";
      if (document.body) document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onPanelResizeMove, true);
      window.addEventListener("pointerup", stopPanelResize, true);
      window.addEventListener("pointercancel", stopPanelResize, true);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch (error) {
      }
    }
    function onPanelResizeMove(event) {
      if (!resizeState) return;
      event.preventDefault();
      event.stopPropagation();
      const nextWidth = resizeState.startWidth + resizeState.startX - event.clientX;
      panelWidth.value = clampPanelWidth(nextWidth);
    }
    function stopPanelResize() {
      if (!resizeState) return;
      resizeState = null;
      resizing.value = false;
      window.removeEventListener("pointermove", onPanelResizeMove, true);
      window.removeEventListener("pointerup", stopPanelResize, true);
      window.removeEventListener("pointercancel", stopPanelResize, true);
      document.documentElement.style.cursor = active.value ? "crosshair" : "";
      if (document.body && pageStyleSnapshot) document.body.style.userSelect = pageStyleSnapshot.bodyUserSelect;
    }
    function syncPanelWidth() {
      const clampedWidth = clampPanelWidth(panelWidth.value);
      if (panelWidth.value !== clampedWidth) panelWidth.value = clampedWidth;
    }
    function cleanupPanelLayout() {
      stopPanelResize();
      if (resizeDispatchFrame) cancelAnimationFrame(resizeDispatchFrame);
      resizeDispatchFrame = 0;
      restorePageInset();
    }
    return {
      collapsed,
      resizing,
      panelWidth,
      effectivePanelWidth,
      panelStyle,
      clampPanelWidth,
      applyPageInset,
      restorePageInset,
      startPanelResize,
      stopPanelResize,
      syncPanelWidth,
      cleanupPanelLayout
    };
  }
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
      "route-resolver": "页面路由"
    };
    return labels[hit == null ? void 0 : hit.stage] || "候选命中";
  }
  function candidateStageExplanation(hit) {
    const reasons = hit.reasons || [];
    const uniqueLine = hit.uniqueSnippet && hit.uniqueMatchCount === 1 ? `可靠证据: 文件内唯一精确命中(${hit.uniqueMatchLabel || "文案"}) "${hit.uniqueMatchText || "-"}"` : "可靠证据: 暂无唯一源码片段，当前只作为候选参与排序";
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
      return [
        `定位过程: 模型阅读本地预检索结果、候选文件内容和选区证据后推荐该文件`,
        hit.modelAdapter ? `模型: ${hit.modelAdapter}` : "",
        hit.modelConfidence ? `置信度: ${hit.modelConfidence}%` : "",
        hit.modelCodeSnippet ? `模型代码片段: ${hit.modelCodeSnippet}` : "",
        hit.modelPrompt ? `模型提示词: ${hit.modelPrompt}` : "",
        uniqueLine,
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
      ...candidateStageExplanation(hit)
    ].filter(Boolean);
    if (hit.uniqueSnippet && hit.uniqueMatchCount === 1) {
      lines.push(`源码片段:
${hit.uniqueSnippet}`);
    }
    return lines;
  }
  function candidateDetailTitle(hit) {
    return (hit == null ? void 0 : hit.uniqueSnippet) && hit.uniqueMatchCount === 1 ? "查看命中片段和日志" : "查看检索日志";
  }
  function candidateLogText(hit) {
    return candidateLogLines(hit).join("\n");
  }
  function useSearchPrompt({
    selectedItems,
    selectedCandidatePaths,
    selectedCandidateHits,
    candidateHits,
    routeResolverTrace,
    evidenceMessages,
    customEvidence,
    searchKeywords,
    includeApiEvidence,
    searchApiRequests,
    pageUrlPath,
    project,
    promptText,
    denoiseTextByApi,
    selectionPayloads,
    setToast
  }) {
    function selectionChatSummary() {
      var _a;
      const changedCount = selectedItems.value.filter((item) => hasChangeNote(item)).length;
      const latest = selectedItems.value[selectedItems.value.length - 1];
      const latestText = (latest == null ? void 0 : latest.changeNote) || ((_a = latest == null ? void 0 : latest.info) == null ? void 0 : _a.text) || "";
      return [
        `${selectedItems.value.length} 个选区，${changedCount} 个已填写改动点。`,
        latestText ? `最近改动：${compactText(latestText, 80)}` : ""
      ].filter(Boolean).join("\n");
    }
    function pageLevelText() {
      var _a, _b;
      const text = ((_a = document.body) == null ? void 0 : _a.innerText) || ((_b = document.body) == null ? void 0 : _b.textContent) || "";
      return denoiseTextByApi(text, 260);
    }
    function candidateFilePromptLines(options = {}) {
      const hits = options.includeAll ? candidateHits.value.slice(0, 8) : selectedCandidateHits.value.length ? selectedCandidateHits.value : candidateHits.value.slice(0, 6);
      const selected = new Set(selectedCandidatePaths.value);
      return hits.map((hit) => {
        const reasons = (hit.reasons || []).slice(0, 3).join("；");
        const meta = [
          candidateStageLabel(hit),
          `score=${hit.score}`,
          hit.from ? `from=${hit.from}` : "",
          reasons ? `reason=${reasons}` : ""
        ].filter(Boolean).join(", ");
        return `- ${selected.has(hit.file) ? "[已选] " : ""}${hit.file}${meta ? ` (${meta})` : ""}`;
      }).join("\n");
    }
    function reliableSnippetHits() {
      return selectedCandidateHits.value.filter((hit) => hit.uniqueSnippet && hit.uniqueMatchCount === 1);
    }
    function reliableSnippetPromptLines() {
      return reliableSnippetHits().map((hit) => {
        return [
          `文件: ${hit.file}`,
          `唯一命中来源: ${hit.uniqueMatchLabel || "文案"}`,
          `唯一命中文案: ${hit.uniqueMatchText || "-"}`,
          `源码片段:
${hit.uniqueSnippet}`
        ].join("\n");
      }).join("\n\n");
    }
    function modelSuggestionPromptLines() {
      return selectedCandidateHits.value.filter((hit) => hit.stage === "model-agent" && (hit.modelPrompt || hit.modelCodeSnippet)).map((hit) => {
        return [
          `文件: ${hit.file}`,
          hit.modelCodeSnippet ? `code片段: ${hit.modelCodeSnippet}` : "",
          hit.modelPrompt ? `提示词: ${hit.modelPrompt}` : ""
        ].filter(Boolean).join("\n");
      }).join("\n\n");
    }
    function modelFinalPromptLines() {
      return selectedCandidateHits.value.filter((hit) => hit.stage === "model-agent" && hit.modelPrompt).map((hit) => {
        return [
          `文件: ${hit.file}`,
          hit.modelCodeSnippet ? `位置: ${hit.modelCodeSnippet}` : "",
          `修改提示词: ${hit.modelPrompt}`
        ].filter(Boolean).join("\n");
      }).join("\n\n");
    }
    function manualEvidencePrompt() {
      return evidenceMessages.value.length ? evidenceMessages.value.join("\n") : "";
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
      return selectionPayloads().filter((item) => {
        var _a, _b;
        return item.changeNote || ((_a = item.element) == null ? void 0 : _a.text) || ((_b = item.element) == null ? void 0 : _b.className);
      }).map((item) => {
        const info = item.element;
        const denoisedText = denoiseTextByApi(info.text);
        const ancestors = ancestorPromptLine(info);
        return [
          `选区 ${item.index}: ${item.changeNote || "按页面上下文修改"}`,
          `  当前节点: ${selectionNodeLine(info)}`,
          `  节点文案: ${denoisedText || "-"}`,
          ancestors ? `  父级线索: ${ancestors}` : ""
        ].filter(Boolean).join("\n");
      }).join("\n");
    }
    function combinedSelectionText() {
      if (searchKeywords.value.trim()) return searchKeywords.value.trim();
      const terms = [];
      for (const message of evidenceMessages.value) {
        terms.push(...extractSearchTerms(message));
      }
      terms.push(...extractSearchTerms(customEvidence.value));
      for (const item of selectedItems.value) {
        terms.push(...extractSearchTerms(item.changeNote));
        terms.push(...extractSearchTerms(denoiseTextByApi(item.info.text)));
        terms.push(...extractSearchTerms(item.info.className));
        for (const ancestor of item.info.ancestors || []) {
          terms.push(...extractSearchTerms(denoiseTextByApi(ancestor.text)));
          terms.push(...extractSearchTerms(ancestor.className));
        }
      }
      return Array.from(new Set(terms)).slice(0, 28).join(" ");
    }
    function searchPayload() {
      const selections = selectionPayloads().map((item) => {
        var _a, _b;
        return __spreadProps(__spreadValues({}, item), {
          element: __spreadProps(__spreadValues({}, item.element), {
            text: denoiseTextByApi((_a = item.element) == null ? void 0 : _a.text),
            ancestors: (((_b = item.element) == null ? void 0 : _b.ancestors) || []).map((ancestor) => __spreadProps(__spreadValues({}, ancestor), {
              text: denoiseTextByApi(ancestor.text)
            }))
          })
        });
      });
      const apiRequests = searchApiRequests.value.map((item) => ({
        url: item.url,
        pathname: item.pathname,
        method: item.method,
        requestKeys: item.requestKeys
      }));
      const query = combinedSelectionText();
      return {
        query,
        url: window.location.href,
        className: selectedItems.value.map((item) => item.info.className).join(" "),
        text: query,
        manualEvidence: evidenceMessages.value.join("\n"),
        selections,
        apiRequests,
        includeApi: includeApiEvidence.value,
        mode: "ui-first",
        apiPaths: apiRequests.map((item) => item.pathname || item.url),
        apiKeys: apiRequests.flatMap((item) => item.requestKeys || []),
        limit: 8
      };
    }
    function searchLogLines() {
      const routeLines = routeResolverLogLines();
      const lines = [
        `1. 收集页面证据: pagePath=${pageUrlPath.value}；选区数=${selectedItems.value.length}；className=${selectedItems.value.map((item) => item.info.className).filter(Boolean).join(" ") || "-"}`,
        ...routeLines,
        `3. 组合检索词: ${combinedSelectionText() || "-"}`,
        `4. 用户补充证据: ${evidenceMessages.value.length ? evidenceMessages.value.join("；") : "-"}`,
        "5. 源码检索: 再按文案/className/url path/补充证据搜索开发源码文件，跳过 node_modules/dist/build 等非源码目录",
        "6. 链路推断: 对补充证据命中的文件继续沿 import 链路向下追踪，并对组件候选做引用反查"
      ];
      if (includeApiEvidence.value) {
        const endpoints = searchApiRequests.value.map((item) => item.pathname || item.url).filter(Boolean).slice(0, 5);
        lines.push(`7. 接口线索: ${endpoints.length ? endpoints.join("；") : "未捕获到接口端点"}`);
      }
      for (const [index, hit] of candidateHits.value.slice(0, 8).entries()) {
        lines.push(...candidateLogLines(hit, index));
      }
      return lines;
    }
    function routeResolverLogLines() {
      var _a, _b;
      const trace = routeResolverTrace == null ? void 0 : routeResolverTrace.value;
      if (!trace) {
        return [
          `2. 页面路由适配: 未执行或本地服务未返回结果；projectKind=${((_a = project.value) == null ? void 0 : _a.kind) || "unknown"}；pagePath=${pageUrlPath.value}`
        ];
      }
      const adapters = trace.adapters && trace.adapters.length ? trace.adapters.join(", ") : "-";
      const status = trace.matched ? `命中 ${trace.hits.length} 个文件` : "未命中";
      const lines = [
        `2. 页面路由适配: ${status}；projectKind=${trace.projectKind || ((_b = project.value) == null ? void 0 : _b.kind) || "unknown"}；pagePath=${trace.pagePath || pageUrlPath.value}；adapters=${adapters}`
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
    function generatePrompt() {
      var _a;
      const files = candidateFilePromptLines();
      const command = modificationCommand();
      const reliableSnippets = reliableSnippetPromptLines();
      const modelSuggestions = modelSuggestionPromptLines();
      const modelFinalPrompt = modelFinalPromptLines();
      const manualEvidence = manualEvidencePrompt();
      if (modelFinalPrompt) {
        promptText.value = [
          `当前 page: ${window.location.href}`,
          `当前命中文件:
${selectedCandidateHits.value.map((hit) => `- ${hit.file}`).join("\n")}`,
          `修改命令:
${modelFinalPrompt}`
        ].filter(Boolean).join("\n");
        setToast("模型已生成最终提示词");
        return;
      }
      if (candidateHits.value.length > 1) {
        const relatedFiles = candidateFilePromptLines({ includeAll: true });
        promptText.value = [
          `当前 page: ${window.location.href}`,
          `url path: ${pageUrlPath.value}`,
          `技术栈: ${((_a = project.value) == null ? void 0 : _a.stackText) || "未知"}`,
          `页面级线索: ${pageLevelText() || "-"}`,
          manualEvidence ? `用户补充证据:
${manualEvidence}` : "",
          "以下文件可能与当前页面/组件相关，请结合 url path、页面文案、className、接口端点和文件命中原因，判断当前页面最准确的源码文件；若候选里只有组件文件，请继续向页面入口或调用方推断。",
          relatedFiles || files || "-",
          modelSuggestions ? `模型推断修改点:
${modelSuggestions}` : "",
          reliableSnippets ? `唯一源码片段:
${reliableSnippets}` : "",
          `修改命令:
${command}`
        ].filter(Boolean).join("\n");
        setToast("提示词已生成");
        return;
      }
      promptText.value = [
        `当前 page: ${window.location.href}`,
        `当前命中文件:
${files || "-"}`,
        manualEvidence ? `用户补充证据:
${manualEvidence}` : "",
        modelSuggestions ? `模型推断修改点:
${modelSuggestions}` : "",
        reliableSnippets ? `唯一源码片段:
${reliableSnippets}` : "",
        `修改命令:
${command}`
      ].filter(Boolean).join("\n");
      setToast("提示词已生成");
    }
    return {
      selectionChatSummary,
      selectionNodeLine,
      ancestorPromptLine,
      combinedSelectionText,
      searchPayload,
      searchLogLines,
      generatePrompt
    };
  }
  function hasChangeNote(item) {
    return !!(item && item.changeNote && item.changeNote.trim());
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
      var _a, _b;
      const rawFiles = Array.from(fileList || []);
      const firstPath = normalizePath(((_a = rawFiles[0]) == null ? void 0 : _a.webkitRelativePath) || ((_b = rawFiles[0]) == null ? void 0 : _b.name) || "");
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
      pairs.filter(Boolean).forEach(([path, text]) => {
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
  function useSourceProject({ projectStorageKey, resetProjectContext, setToast }) {
    const fileInputRef = /* @__PURE__ */ ref(null);
    const project = /* @__PURE__ */ shallowRef(null);
    const sourceServiceStatus = /* @__PURE__ */ ref("idle");
    const sourceServiceError = /* @__PURE__ */ ref("");
    const sourceServiceMessage = /* @__PURE__ */ ref("");
    function rememberProjectPath(projectValue) {
      if (!projectValue || projectValue.source !== "source-server" || !projectValue.path) return;
      try {
        window.localStorage.setItem(projectStorageKey.value, JSON.stringify({
          path: projectValue.path,
          name: projectValue.name || "",
          savedAt: Date.now()
        }));
      } catch (error) {
      }
    }
    function savedProjectPath() {
      try {
        const raw = window.localStorage.getItem(projectStorageKey.value);
        if (!raw) return "";
        const data = JSON.parse(raw);
        return data && typeof data.path === "string" ? data.path : "";
      } catch (error) {
        return "";
      }
    }
    function resetAfterProjectChange() {
      if (typeof resetProjectContext === "function") resetProjectContext();
    }
    function restoreSavedProject() {
      return __async(this, null, function* () {
        const path = savedProjectPath();
        if (!path || project.value || sourceServiceStatus.value === "loading") return false;
        sourceServiceStatus.value = "loading";
        sourceServiceError.value = "";
        sourceServiceMessage.value = "正在恢复当前域名的本地源码路径...";
        try {
          yield sourceServerJson("/health", {
            timeoutMs: 3e3,
            timeoutMessage: "本地源码服务未响应，请确认已运行 npm run source:server"
          });
          const data = yield sourceServerJson("/api/source/scan", {
            method: "POST",
            body: { path },
            timeoutMs: 2e4,
            timeoutMessage: "恢复源码路径超时，请重新选择项目源码"
          });
          project.value = normalizeSourceServerProject(data.project || {});
          sourceServiceStatus.value = "connected";
          sourceServiceMessage.value = "";
          resetAfterProjectChange();
          setToast(`已恢复 ${project.value.name}`);
          return true;
        } catch (error) {
          sourceServiceStatus.value = "idle";
          sourceServiceMessage.value = "";
          sourceServiceError.value = `恢复已保存源码路径失败：${error.message || error}`;
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
        project.value = normalizeSourceServerProject(data.project || {});
        rememberProjectPath(project.value);
        resetAfterProjectChange();
        sourceServiceStatus.value = "connected";
        sourceServiceMessage.value = "";
        setToast(`已关联 ${project.value.name}`);
      });
    }
    function chooseProject() {
      return __async(this, null, function* () {
        setToast("正在选择项目...");
        try {
          yield chooseProjectFromSourceServer();
          return;
        } catch (error) {
          sourceServiceStatus.value = "fallback";
          sourceServiceMessage.value = "";
          sourceServiceError.value = `${error.message || error}。请先运行 npm run source:server；当前将使用浏览器目录选择兜底，无法拿到真实路径。`;
        }
        if (window.showDirectoryPicker && window.isSecureContext) {
          try {
            const handle = yield window.showDirectoryPicker({ mode: "read" });
            project.value = yield scanDirectoryHandle(handle);
            resetAfterProjectChange();
            sourceServiceError.value = "";
            setToast(`已关联 ${project.value.name}`);
            return;
          } catch (error) {
            if (error && error.name === "AbortError") {
              setToast("已取消选择");
              return;
            }
            setToast("目录选择器不可用，改用文件夹输入");
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
        project.value = yield buildProjectFromFileList(files);
        resetAfterProjectChange();
        sourceServiceError.value = "";
        setToast(`已关联 ${project.value.name}`);
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
  function useToast() {
    const toastText = /* @__PURE__ */ ref("");
    const toastTimer = /* @__PURE__ */ ref(0);
    function setToast(message) {
      toastText.value = message || "";
      if (toastTimer.value) clearTimeout(toastTimer.value);
      if (message) {
        toastTimer.value = window.setTimeout(() => {
          toastText.value = "";
        }, 1800);
      }
    }
    function cleanupToast() {
      if (toastTimer.value) clearTimeout(toastTimer.value);
      toastTimer.value = 0;
    }
    return {
      toastText,
      setToast,
      cleanupToast
    };
  }
  const _hoisted_1$3 = {
    class: "mda-chat-thread",
    "aria-label": "页面改造对话"
  };
  const _hoisted_2$2 = { class: "mda-message-avatar" };
  const _hoisted_3$2 = { class: "mda-message-bubble" };
  const _hoisted_4$2 = {
    key: 0,
    class: "mda-message-title"
  };
  const _hoisted_5$2 = {
    key: 1,
    class: "mda-message-text"
  };
  const _hoisted_6$2 = {
    key: 2,
    class: "mda-message-pre"
  };
  const _hoisted_7$1 = {
    key: 3,
    class: "mda-log-flow"
  };
  const _hoisted_8$1 = ["onClick"];
  const _hoisted_9$1 = {
    key: 4,
    class: "mda-message-actions"
  };
  const _hoisted_10$1 = ["disabled"];
  const _hoisted_11$1 = {
    key: 5,
    class: "mda-message-actions"
  };
  const _hoisted_12$1 = {
    key: 0,
    class: "mda-warning"
  };
  const _hoisted_13$1 = {
    key: 1,
    class: "mda-warning"
  };
  const _sfc_main$3 = {
    __name: "ChatThread",
    setup(__props) {
      const messages = useForm("chatMessages");
      const sourceServiceStatus = useForm("sourceServiceStatus");
      const sourceServiceError = useForm("sourceServiceError");
      const candidateError = useForm("candidateError");
      const api = useApi();
      function avatarText(role) {
        if (role === "user") return "你";
        if (role === "agent") return "模型";
        return "系统";
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
        return openBlock(), createElementBlock("section", _hoisted_1$3, [
          (openBlock(true), createElementBlock(
            Fragment,
            null,
            renderList(unref(messages), (message) => {
              return openBlock(), createElementBlock(
                "article",
                {
                  key: message.id,
                  class: normalizeClass(["mda-chat-message", `is-${message.role}`])
                },
                [
                  createBaseVNode(
                    "div",
                    _hoisted_2$2,
                    toDisplayString(avatarText(message.role)),
                    1
                    /* TEXT */
                  ),
                  createBaseVNode("div", _hoisted_3$2, [
                    message.title ? (openBlock(), createElementBlock(
                      "div",
                      _hoisted_4$2,
                      toDisplayString(message.title),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true),
                    message.text ? (openBlock(), createElementBlock(
                      "div",
                      _hoisted_5$2,
                      toDisplayString(message.text),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true),
                    message.pre ? (openBlock(), createElementBlock(
                      "pre",
                      _hoisted_6$2,
                      toDisplayString(message.pre),
                      1
                      /* TEXT */
                    )) : createCommentVNode("v-if", true),
                    message.logs && message.logs.length ? (openBlock(), createElementBlock("details", _hoisted_7$1, [
                      createBaseVNode(
                        "summary",
                        null,
                        toDisplayString(message.logTitle || "查看检索日志"),
                        1
                        /* TEXT */
                      ),
                      createBaseVNode("ol", null, [
                        (openBlock(true), createElementBlock(
                          Fragment,
                          null,
                          renderList(message.logs, (log, logIndex) => {
                            return openBlock(), createElementBlock(
                              "li",
                              {
                                key: logIndex,
                                class: normalizeClass({ "is-candidate-log": isCandidateLog(log) })
                              },
                              [
                                isCandidateLog(log) ? (openBlock(), createElementBlock(
                                  Fragment,
                                  { key: 0 },
                                  [
                                    createBaseVNode(
                                      "span",
                                      null,
                                      toDisplayString(candidatePrefix(log)),
                                      1
                                      /* TEXT */
                                    ),
                                    createBaseVNode("button", {
                                      class: "mda-log-file-link",
                                      type: "button",
                                      onClick: ($event) => unref(api).openSourceFile(candidateFile(log))
                                    }, toDisplayString(candidateFile(log)), 9, _hoisted_8$1)
                                  ],
                                  64
                                  /* STABLE_FRAGMENT */
                                )) : (openBlock(), createElementBlock(
                                  Fragment,
                                  { key: 1 },
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
                      ])
                    ])) : createCommentVNode("v-if", true),
                    message.action === "choose-project" ? (openBlock(), createElementBlock("div", _hoisted_9$1, [
                      createBaseVNode("button", {
                        class: "mda-btn mda-btn-primary",
                        type: "button",
                        disabled: unref(sourceServiceStatus) === "loading",
                        onClick: _cache[0] || (_cache[0] = (...args) => unref(api).chooseProject && unref(api).chooseProject(...args))
                      }, toDisplayString(unref(sourceServiceStatus) === "loading" ? "选择中" : "选择源码"), 9, _hoisted_10$1)
                    ])) : createCommentVNode("v-if", true),
                    message.action === "copy-prompt" ? (openBlock(), createElementBlock("div", _hoisted_11$1, [
                      createBaseVNode("button", {
                        class: "mda-btn",
                        type: "button",
                        onClick: _cache[1] || (_cache[1] = (...args) => unref(api).copyPrompt && unref(api).copyPrompt(...args))
                      }, "复制提示词")
                    ])) : createCommentVNode("v-if", true)
                  ])
                ],
                2
                /* CLASS */
              );
            }),
            128
            /* KEYED_FRAGMENT */
          )),
          unref(sourceServiceError) ? (openBlock(), createElementBlock(
            "div",
            _hoisted_12$1,
            toDisplayString(unref(sourceServiceError)),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true),
          unref(candidateError) ? (openBlock(), createElementBlock(
            "div",
            _hoisted_13$1,
            toDisplayString(unref(candidateError)),
            1
            /* TEXT */
          )) : createCommentVNode("v-if", true)
        ]);
      };
    }
  };
  const _hoisted_1$2 = { class: "mda-composer-wrap" };
  const _hoisted_2$1 = {
    key: 0,
    class: "mda-composer-options"
  };
  const _hoisted_3$1 = { class: "mda-collapsible-head" };
  const _hoisted_4$1 = {
    key: 0,
    class: "mda-collapsed-summary"
  };
  const _hoisted_5$1 = {
    key: 1,
    class: "mda-choice-list"
  };
  const _hoisted_6$1 = { class: "mda-choice-check" };
  const _hoisted_7 = ["checked", "onChange"];
  const _hoisted_8 = ["onClick"];
  const _hoisted_9 = { class: "mda-choice-meta" };
  const _hoisted_10 = ["onClick"];
  const _hoisted_11 = {
    key: 0,
    class: "mda-candidate-log"
  };
  const _hoisted_12 = {
    key: 1,
    class: "mda-composer-options"
  };
  const _hoisted_13 = {
    key: 2,
    class: "mda-selection-tags-panel"
  };
  const _hoisted_14 = { class: "mda-collapsible-head" };
  const _hoisted_15 = { class: "mda-option-title" };
  const _hoisted_16 = {
    key: 0,
    class: "mda-collapsed-summary"
  };
  const _hoisted_17 = { class: "mda-selection-tags" };
  const _hoisted_18 = ["onClick"];
  const _hoisted_19 = { key: 0 };
  const _hoisted_20 = {
    key: 0,
    class: "mda-selection-detail"
  };
  const _hoisted_21 = { class: "mda-selection-detail-head" };
  const _hoisted_22 = { class: "mda-selection-detail-title" };
  const _hoisted_23 = { class: "mda-selection-detail-grid" };
  const _hoisted_24 = ["value", "data-selection-uid"];
  const _hoisted_25 = {
    key: 3,
    class: "mda-model-editor"
  };
  const _hoisted_26 = { class: "mda-model-editor-head" };
  const _hoisted_27 = { class: "mda-model-grid" };
  const _hoisted_28 = {
    key: 0,
    class: "is-wide"
  };
  const _hoisted_29 = ["value"];
  const _hoisted_30 = ["value"];
  const _hoisted_31 = ["value"];
  const _hoisted_32 = {
    key: 1,
    class: "is-wide"
  };
  const _hoisted_33 = {
    key: 2,
    class: "is-wide"
  };
  const _hoisted_34 = { key: 3 };
  const _hoisted_35 = { key: 4 };
  const _hoisted_36 = { key: 5 };
  const _hoisted_37 = { class: "is-wide" };
  const _hoisted_38 = { class: "mda-model-actions" };
  const _hoisted_39 = ["disabled"];
  const _hoisted_40 = { class: "mda-composer-prebar" };
  const _hoisted_41 = ["disabled"];
  const _hoisted_42 = { class: "mda-composer" };
  const _hoisted_43 = ["value", "readonly", "placeholder"];
  const _hoisted_44 = { class: "mda-composer-toolbar" };
  const _hoisted_45 = { class: "mda-toolbar-left" };
  const _hoisted_46 = ["disabled"];
  const _hoisted_47 = { class: "mda-toolbar-right" };
  const _hoisted_48 = ["disabled"];
  const _hoisted_49 = { key: 0 };
  const _hoisted_50 = {
    key: 0,
    class: "mda-model-dropdown"
  };
  const _hoisted_51 = ["onClick"];
  const _hoisted_52 = {
    key: 0,
    class: "mda-model-divider"
  };
  const _hoisted_53 = ["disabled"];
  const _hoisted_54 = { key: 0 };
  const _hoisted_55 = {
    key: 1,
    class: "mda-send-arrow"
  };
  const _hoisted_56 = {
    key: 4,
    class: "mda-route-inline"
  };
  const _hoisted_57 = {
    key: 1,
    class: "mda-route-empty"
  };
  const _hoisted_58 = { class: "mda-toast" };
  const _sfc_main$2 = {
    __name: "ComposerPanel",
    setup(__props, { expose: __expose }) {
      const evidenceInput = /* @__PURE__ */ ref(null);
      const modelMenuRef = /* @__PURE__ */ ref(null);
      const modelMenuOpen = /* @__PURE__ */ ref(false);
      const candidatePanelCollapsed = /* @__PURE__ */ ref(false);
      const selectionPanelCollapsed = /* @__PURE__ */ ref(false);
      const api = useApi();
      const showCandidatePicker = useForm("showCandidatePicker");
      const needsMoreEvidence = useForm("needsMoreEvidence");
      const candidateHits = useForm("candidateHits");
      const selectedCandidatePaths = useForm("selectedCandidatePaths");
      const expandedCandidatePath = useForm("expandedCandidatePath");
      const includeApiEvidence = useForm("includeApiEvidence");
      const candidateLoading = useForm("candidateLoading");
      const promptText = useForm("promptText");
      const selectedItems = useForm("selectedItems");
      const editingUid = useForm("editingUid");
      const project = useForm("project");
      const modelConfigs = useForm("modelConfigs");
      const selectedModelId = useForm("selectedModelId");
      const selectedModel = useForm("selectedModel");
      const modelEditorOpen = useForm("modelEditorOpen");
      const modelForm = useForm("modelForm");
      const modelAssistLoading = useForm("modelAssistLoading");
      const routeResolverTrace = useForm("routeResolverTrace");
      const sourceServiceStatus = useForm("sourceServiceStatus");
      const composerInputValue = useForm("composerInputValue");
      const composerEditable = useForm("composerEditable");
      const composerPlaceholder = useForm("composerPlaceholder");
      const composerCanSend = useForm("composerCanSend");
      const toastText = useForm("toastText");
      const routeHit = computed(() => {
        const trace = routeResolverTrace.value;
        if (!trace || !trace.matched || !Array.isArray(trace.hits) || !trace.hits.length) return null;
        return trace.hits[0];
      });
      const routeFilePath = computed(() => {
        var _a;
        return ((_a = routeHit.value) == null ? void 0 : _a.file) || "";
      });
      const editingSelection = computed(() => {
        return selectedItems.value.find((item) => item.uid === editingUid.value) || null;
      });
      const selectionCollapsedSummary = computed(() => {
        const changedCount = selectedItems.value.filter((item) => hasChangeNote2(item)).length;
        const active = editingSelection.value ? selectedNodeTitle(editingSelection.value) : selectionTagLabel(selectedItems.value[0], 0);
        return `${active}；${changedCount}/${selectedItems.value.length} 个有改动`;
      });
      const activeModelLabel = computed(() => {
        var _a;
        return ((_a = selectedModel.value) == null ? void 0 : _a.name) || "不启用";
      });
      const activeModelMeta = computed(() => {
        if (!selectedModel.value) return "";
        if (modelAssistLoading.value) return "定位中";
        if (selectedModel.value.provider === "deepseek") return "DeepSeek API";
        return selectedModel.value.type === "api" ? "API" : "Exec";
      });
      watch(modelAssistLoading, (value) => {
        if (!value) return;
        candidatePanelCollapsed.value = true;
        selectionPanelCollapsed.value = true;
        modelMenuOpen.value = false;
      });
      function handleGlobalPointerDown(event) {
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        if (modelMenuRef.value && (path.includes(modelMenuRef.value) || modelMenuRef.value.contains(event.target))) return;
        modelMenuOpen.value = false;
      }
      onMounted(() => {
        window.addEventListener("pointerdown", handleGlobalPointerDown, true);
      });
      onBeforeUnmount(() => {
        window.removeEventListener("pointerdown", handleGlobalPointerDown, true);
      });
      __expose({
        focusEvidenceInput() {
          if (evidenceInput.value && typeof evidenceInput.value.focus === "function") {
            evidenceInput.value.focus();
          }
        }
      });
      function isCandidateSelected(hit) {
        return !!hit && selectedCandidatePaths.value.includes(hit.file);
      }
      function toggleApiEvidence() {
        api.setIncludeApiEvidence(!includeApiEvidence.value);
        api.onSearchOptionChange();
      }
      function onModelEditorSelect(event) {
        const id = event.target.value || "";
        if (!id) {
          api.setSelectedModel("");
          api.openModelEditor();
          return;
        }
        const model = modelConfigs.value.find((item) => item.id === id);
        api.setSelectedModel(id);
        api.openModelEditor(model);
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
      function toggleModelMenu() {
        modelMenuOpen.value = !modelMenuOpen.value;
      }
      function closeModelMenu() {
        modelMenuOpen.value = false;
      }
      function modelOptionMeta(model) {
        if (!model) return "";
        if (model.provider === "deepseek") return "DeepSeek API";
        return model.type === "api" ? "API" : "Exec";
      }
      function selectDisabledModel() {
        api.disableModelAssist();
        closeModelMenu();
      }
      function selectSavedModel(model) {
        if (!model) return;
        api.selectModelAndEnable(model.id);
        closeModelMenu();
      }
      function editSelectedModel() {
        closeModelMenu();
        api.openModelEditor(selectedModel.value);
      }
      function createDeepSeekModel() {
        closeModelMenu();
        api.openProviderModelEditor("deepseek");
      }
      function createCustomApiModel() {
        closeModelMenu();
        api.openModelEditor({
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
        closeModelMenu();
        api.openModelEditor();
      }
      function copyRouteFilePath() {
        if (!routeFilePath.value) return;
        api.copyTextWithToast(routeFilePath.value);
      }
      function hasChangeNote2(item) {
        return !!(item && item.changeNote && item.changeNote.trim());
      }
      function shortText(text, limit = 90) {
        const value = String(text || "").replace(/\s+/g, " ").trim();
        return value.length > limit ? `${value.slice(0, limit)}...` : value;
      }
      function selectedNodeTitle(item) {
        if (!item || !item.info) return "选区";
        const index = selectedItems.value.findIndex((selection) => selection.uid === item.uid) + 1;
        return `选区 ${index} · <${item.info.tag || "-"}>`;
      }
      function selectionTagLabel(item, index) {
        const info = item.info || {};
        const className = String(info.className || "").split(/\s+/).filter(Boolean)[0];
        return `选区 ${index + 1} · ${info.tag || "-"}${className ? `.${className}` : ""}`;
      }
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock("section", _hoisted_1$2, [
          unref(showCandidatePicker) ? (openBlock(), createElementBlock("div", _hoisted_2$1, [
            createBaseVNode("div", _hoisted_3$1, [
              _cache[22] || (_cache[22] = createBaseVNode(
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
                  onClick: _cache[0] || (_cache[0] = ($event) => candidatePanelCollapsed.value = !candidatePanelCollapsed.value)
                },
                toDisplayString(candidatePanelCollapsed.value ? "展开" : "收起"),
                1
                /* TEXT */
              )
            ]),
            candidatePanelCollapsed.value ? (openBlock(), createElementBlock(
              "div",
              _hoisted_4$1,
              " 已选 " + toDisplayString(unref(selectedCandidatePaths).length || 0) + " / " + toDisplayString(unref(candidateHits).length) + " 个文件 ",
              1
              /* TEXT */
            )) : (openBlock(), createElementBlock("div", _hoisted_5$1, [
              (openBlock(true), createElementBlock(
                Fragment,
                null,
                renderList(unref(candidateHits), (hit) => {
                  return openBlock(), createElementBlock(
                    "article",
                    {
                      key: hit.file,
                      class: normalizeClass(["mda-choice-card", { "is-selected": isCandidateSelected(hit) }])
                    },
                    [
                      createBaseVNode("div", _hoisted_6$1, [
                        createBaseVNode("input", {
                          type: "checkbox",
                          checked: isCandidateSelected(hit),
                          onChange: ($event) => unref(api).toggleCandidateFile(hit)
                        }, null, 40, _hoisted_7),
                        createBaseVNode("button", {
                          class: "mda-file-link",
                          type: "button",
                          onClick: withModifiers(($event) => unref(api).openSourceFile(hit.file), ["stop"])
                        }, toDisplayString(hit.file), 9, _hoisted_8)
                      ]),
                      createBaseVNode(
                        "div",
                        _hoisted_9,
                        toDisplayString(unref(candidateStageLabel)(hit)) + " · " + toDisplayString(hit.score),
                        1
                        /* TEXT */
                      ),
                      createBaseVNode("button", {
                        class: "mda-link-btn",
                        type: "button",
                        onClick: ($event) => unref(api).toggleCandidateDetail(hit)
                      }, toDisplayString(unref(expandedCandidatePath) === hit.file ? "收起" : unref(candidateDetailTitle)(hit)), 9, _hoisted_10),
                      unref(expandedCandidatePath) === hit.file ? (openBlock(), createElementBlock(
                        "pre",
                        _hoisted_11,
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
          unref(needsMoreEvidence) ? (openBlock(), createElementBlock("div", _hoisted_12, [..._cache[23] || (_cache[23] = [
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
              "这些候选文件缺少唯一命中文案，可能是重复复制粘贴的组件。请继续在页面上选择更外层/更独特的区域，或在输入框补充页面位置、业务模块、交互目标。",
              -1
              /* CACHED */
            )
          ])])) : createCommentVNode("v-if", true),
          unref(selectedItems).length ? (openBlock(), createElementBlock("div", _hoisted_13, [
            createBaseVNode("div", _hoisted_14, [
              createBaseVNode(
                "div",
                _hoisted_15,
                "选区 " + toDisplayString(unref(selectedItems).length),
                1
                /* TEXT */
              ),
              createBaseVNode(
                "button",
                {
                  class: "mda-collapse-btn",
                  type: "button",
                  onClick: _cache[1] || (_cache[1] = ($event) => selectionPanelCollapsed.value = !selectionPanelCollapsed.value)
                },
                toDisplayString(selectionPanelCollapsed.value ? "展开" : "收起"),
                1
                /* TEXT */
              )
            ]),
            selectionPanelCollapsed.value ? (openBlock(), createElementBlock(
              "div",
              _hoisted_16,
              toDisplayString(selectionCollapsedSummary.value),
              1
              /* TEXT */
            )) : (openBlock(), createElementBlock(
              Fragment,
              { key: 1 },
              [
                createBaseVNode("div", _hoisted_17, [
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(unref(selectedItems), (item, index) => {
                      return openBlock(), createElementBlock("button", {
                        key: item.uid,
                        class: normalizeClass(["mda-selection-tag", { "is-active": item.uid === unref(editingUid), "has-note": hasChangeNote2(item) }]),
                        type: "button",
                        onClick: ($event) => unref(api).openSelectionEditor(item)
                      }, [
                        createBaseVNode(
                          "span",
                          null,
                          toDisplayString(selectionTagLabel(item, index)),
                          1
                          /* TEXT */
                        ),
                        hasChangeNote2(item) ? (openBlock(), createElementBlock("em", _hoisted_19, "有改动")) : createCommentVNode("v-if", true)
                      ], 10, _hoisted_18);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                editingSelection.value ? (openBlock(), createElementBlock("div", _hoisted_20, [
                  createBaseVNode("div", _hoisted_21, [
                    createBaseVNode(
                      "div",
                      _hoisted_22,
                      toDisplayString(selectedNodeTitle(editingSelection.value)),
                      1
                      /* TEXT */
                    ),
                    createBaseVNode("button", {
                      class: "mda-mini-btn",
                      type: "button",
                      onClick: _cache[2] || (_cache[2] = ($event) => unref(api).removeSelection(editingSelection.value.uid))
                    }, "移除")
                  ]),
                  createBaseVNode("div", _hoisted_23, [
                    _cache[24] || (_cache[24] = createBaseVNode(
                      "span",
                      null,
                      "class",
                      -1
                      /* CACHED */
                    )),
                    createBaseVNode(
                      "strong",
                      null,
                      toDisplayString(editingSelection.value.info.className || "-"),
                      1
                      /* TEXT */
                    ),
                    _cache[25] || (_cache[25] = createBaseVNode(
                      "span",
                      null,
                      "文案",
                      -1
                      /* CACHED */
                    )),
                    createBaseVNode(
                      "strong",
                      null,
                      toDisplayString(shortText(editingSelection.value.info.text) || "-"),
                      1
                      /* TEXT */
                    )
                  ]),
                  createBaseVNode("textarea", {
                    value: editingSelection.value.changeNote,
                    "data-selection-uid": editingSelection.value.uid,
                    class: "mda-selection-note",
                    rows: "3",
                    placeholder: "输入这个选区的改动点",
                    onInput: _cache[3] || (_cache[3] = ($event) => unref(api).updateSelectionNote(editingSelection.value.uid, $event.target.value))
                  }, null, 40, _hoisted_24)
                ])) : createCommentVNode("v-if", true)
              ],
              64
              /* STABLE_FRAGMENT */
            ))
          ])) : createCommentVNode("v-if", true),
          unref(modelEditorOpen) ? (openBlock(), createElementBlock("div", _hoisted_25, [
            createBaseVNode("div", _hoisted_26, [
              _cache[26] || (_cache[26] = createBaseVNode(
                "strong",
                null,
                "模型适配器",
                -1
                /* CACHED */
              )),
              createBaseVNode("button", {
                class: "mda-mini-btn",
                type: "button",
                onClick: _cache[4] || (_cache[4] = (...args) => unref(api).closeModelEditor && unref(api).closeModelEditor(...args))
              }, "关闭")
            ]),
            createBaseVNode("div", _hoisted_27, [
              unref(modelConfigs).length ? (openBlock(), createElementBlock("label", _hoisted_28, [
                _cache[28] || (_cache[28] = createBaseVNode(
                  "span",
                  null,
                  "当前模型",
                  -1
                  /* CACHED */
                )),
                createBaseVNode("select", {
                  value: unref(selectedModelId),
                  class: "mda-model-input",
                  onChange: onModelEditorSelect
                }, [
                  _cache[27] || (_cache[27] = createBaseVNode(
                    "option",
                    { value: "" },
                    "新增模型",
                    -1
                    /* CACHED */
                  )),
                  (openBlock(true), createElementBlock(
                    Fragment,
                    null,
                    renderList(unref(modelConfigs), (model) => {
                      return openBlock(), createElementBlock("option", {
                        key: model.id,
                        value: model.id
                      }, toDisplayString(model.name) + " · " + toDisplayString(model.type), 9, _hoisted_30);
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ], 40, _hoisted_29)
              ])) : createCommentVNode("v-if", true),
              createBaseVNode("label", null, [
                _cache[30] || (_cache[30] = createBaseVNode(
                  "span",
                  null,
                  "供应商",
                  -1
                  /* CACHED */
                )),
                createBaseVNode("select", {
                  value: unref(modelForm).provider || "custom",
                  class: "mda-model-input",
                  onChange: onModelProviderChange
                }, [..._cache[29] || (_cache[29] = [
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
                ])], 40, _hoisted_31)
              ]),
              createBaseVNode("label", null, [
                _cache[31] || (_cache[31] = createBaseVNode(
                  "span",
                  null,
                  "名称",
                  -1
                  /* CACHED */
                )),
                withDirectives(createBaseVNode(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => unref(modelForm).name = $event),
                    class: "mda-model-input",
                    placeholder: "Codex / Claude / OpenAI"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelText, unref(modelForm).name]
                ])
              ]),
              createBaseVNode("label", null, [
                _cache[33] || (_cache[33] = createBaseVNode(
                  "span",
                  null,
                  "类型",
                  -1
                  /* CACHED */
                )),
                withDirectives(createBaseVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => unref(modelForm).type = $event),
                    class: "mda-model-input"
                  },
                  [..._cache[32] || (_cache[32] = [
                    createBaseVNode(
                      "option",
                      { value: "exec" },
                      "exec",
                      -1
                      /* CACHED */
                    ),
                    createBaseVNode(
                      "option",
                      { value: "api" },
                      "api",
                      -1
                      /* CACHED */
                    )
                  ])],
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelSelect, unref(modelForm).type]
                ])
              ]),
              unref(modelForm).type === "exec" ? (openBlock(), createElementBlock("label", _hoisted_32, [
                _cache[34] || (_cache[34] = createBaseVNode(
                  "span",
                  null,
                  "命令",
                  -1
                  /* CACHED */
                )),
                withDirectives(createBaseVNode(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => unref(modelForm).command = $event),
                    class: "mda-model-input",
                    placeholder: "codex exec"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelText, unref(modelForm).command]
                ])
              ])) : createCommentVNode("v-if", true),
              unref(modelForm).type === "api" ? (openBlock(), createElementBlock("label", _hoisted_33, [
                _cache[35] || (_cache[35] = createBaseVNode(
                  "span",
                  null,
                  "Endpoint",
                  -1
                  /* CACHED */
                )),
                withDirectives(createBaseVNode(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => unref(modelForm).endpoint = $event),
                    class: "mda-model-input",
                    placeholder: "https://api.openai.com/v1/chat/completions"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelText, unref(modelForm).endpoint]
                ])
              ])) : createCommentVNode("v-if", true),
              unref(modelForm).type === "api" && unref(modelForm).provider === "deepseek" ? (openBlock(), createElementBlock("label", _hoisted_34, [
                _cache[37] || (_cache[37] = createBaseVNode(
                  "span",
                  null,
                  "Model",
                  -1
                  /* CACHED */
                )),
                withDirectives(createBaseVNode(
                  "select",
                  {
                    "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => unref(modelForm).model = $event),
                    class: "mda-model-input"
                  },
                  [..._cache[36] || (_cache[36] = [
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
                  [vModelSelect, unref(modelForm).model]
                ])
              ])) : unref(modelForm).type === "api" ? (openBlock(), createElementBlock("label", _hoisted_35, [
                _cache[38] || (_cache[38] = createBaseVNode(
                  "span",
                  null,
                  "Model",
                  -1
                  /* CACHED */
                )),
                withDirectives(createBaseVNode(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[10] || (_cache[10] = ($event) => unref(modelForm).model = $event),
                    class: "mda-model-input",
                    placeholder: "gpt-4.1"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelText, unref(modelForm).model]
                ])
              ])) : createCommentVNode("v-if", true),
              unref(modelForm).type === "api" ? (openBlock(), createElementBlock("label", _hoisted_36, [
                _cache[39] || (_cache[39] = createBaseVNode(
                  "span",
                  null,
                  "API Key",
                  -1
                  /* CACHED */
                )),
                withDirectives(createBaseVNode(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[11] || (_cache[11] = ($event) => unref(modelForm).apiKey = $event),
                    class: "mda-model-input",
                    type: "password",
                    placeholder: "sk-..."
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelText, unref(modelForm).apiKey]
                ])
              ])) : createCommentVNode("v-if", true),
              createBaseVNode("label", _hoisted_37, [
                _cache[40] || (_cache[40] = createBaseVNode(
                  "span",
                  null,
                  "代理地址",
                  -1
                  /* CACHED */
                )),
                withDirectives(createBaseVNode(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[12] || (_cache[12] = ($event) => unref(modelForm).proxyUrl = $event),
                    class: "mda-model-input",
                    placeholder: "http://127.0.0.1:7890，可留空"
                  },
                  null,
                  512
                  /* NEED_PATCH */
                ), [
                  [vModelText, unref(modelForm).proxyUrl]
                ])
              ]),
              createBaseVNode("label", null, [
                _cache[41] || (_cache[41] = createBaseVNode(
                  "span",
                  null,
                  "超时 ms",
                  -1
                  /* CACHED */
                )),
                withDirectives(createBaseVNode(
                  "input",
                  {
                    "onUpdate:modelValue": _cache[13] || (_cache[13] = ($event) => unref(modelForm).timeoutMs = $event),
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
                    unref(modelForm).timeoutMs,
                    void 0,
                    { number: true }
                  ]
                ])
              ])
            ]),
            createBaseVNode("div", _hoisted_38, [
              unref(selectedModel) ? (openBlock(), createElementBlock("button", {
                key: 0,
                class: "mda-mini-btn",
                type: "button",
                disabled: unref(candidateLoading) || unref(modelAssistLoading),
                onClick: _cache[14] || (_cache[14] = (...args) => unref(api).removeSelectedModel && unref(api).removeSelectedModel(...args))
              }, "删除模型", 8, _hoisted_39)) : createCommentVNode("v-if", true),
              createBaseVNode("button", {
                class: "mda-btn mda-btn-primary",
                type: "button",
                onClick: _cache[15] || (_cache[15] = (...args) => unref(api).saveModelForm && unref(api).saveModelForm(...args))
              }, "保存模型")
            ])
          ])) : createCommentVNode("v-if", true),
          createBaseVNode("div", _hoisted_40, [
            createBaseVNode("button", {
              class: normalizeClass(["mda-assist-chip", { "is-active": unref(includeApiEvidence) }]),
              type: "button",
              disabled: unref(candidateLoading) || !!unref(promptText),
              onClick: toggleApiEvidence
            }, [..._cache[42] || (_cache[42] = [
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
            ])], 10, _hoisted_41)
          ]),
          createBaseVNode("div", _hoisted_42, [
            createBaseVNode("input", {
              ref_key: "evidenceInput",
              ref: evidenceInput,
              value: unref(composerInputValue),
              class: "mda-composer-input",
              readonly: !unref(composerEditable),
              placeholder: unref(composerPlaceholder),
              onInput: _cache[16] || (_cache[16] = (...args) => unref(api).onComposerInput && unref(api).onComposerInput(...args)),
              onKeydown: _cache[17] || (_cache[17] = withKeys(withModifiers((...args) => unref(api).sendComposer && unref(api).sendComposer(...args), ["prevent"]), ["enter"]))
            }, null, 40, _hoisted_43),
            createBaseVNode("div", _hoisted_44, [
              createBaseVNode("div", _hoisted_45, [
                unref(project) ? (openBlock(), createElementBlock("button", {
                  key: 0,
                  class: "mda-tool-icon-btn",
                  type: "button",
                  title: "重新选择项目",
                  disabled: unref(sourceServiceStatus) === "loading",
                  onClick: _cache[18] || (_cache[18] = (...args) => unref(api).chooseProject && unref(api).chooseProject(...args))
                }, null, 8, _hoisted_46)) : createCommentVNode("v-if", true),
                unref(selectedItems).length ? (openBlock(), createElementBlock("button", {
                  key: 1,
                  class: "mda-inline-text-btn",
                  type: "button",
                  onClick: _cache[19] || (_cache[19] = (...args) => unref(api).clearSelections && unref(api).clearSelections(...args))
                }, "清空选区")) : createCommentVNode("v-if", true)
              ]),
              createBaseVNode("div", _hoisted_47, [
                createBaseVNode(
                  "div",
                  {
                    ref_key: "modelMenuRef",
                    ref: modelMenuRef,
                    class: "mda-model-menu"
                  },
                  [
                    createBaseVNode("button", {
                      class: normalizeClass(["mda-model-trigger", { "is-active": !!unref(selectedModelId) }]),
                      type: "button",
                      disabled: unref(candidateLoading) || unref(modelAssistLoading),
                      onClick: toggleModelMenu
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
                        _hoisted_49,
                        toDisplayString(activeModelMeta.value),
                        1
                        /* TEXT */
                      )) : createCommentVNode("v-if", true),
                      _cache[43] || (_cache[43] = createBaseVNode(
                        "i",
                        null,
                        null,
                        -1
                        /* CACHED */
                      ))
                    ], 10, _hoisted_48),
                    modelMenuOpen.value ? (openBlock(), createElementBlock("div", _hoisted_50, [
                      createBaseVNode(
                        "button",
                        {
                          class: normalizeClass(["mda-model-option", { "is-selected": !unref(selectedModelId) }]),
                          type: "button",
                          onClick: selectDisabledModel
                        },
                        [..._cache[44] || (_cache[44] = [
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
                        renderList(unref(modelConfigs), (model) => {
                          return openBlock(), createElementBlock("button", {
                            key: model.id,
                            class: normalizeClass(["mda-model-option", { "is-selected": unref(selectedModelId) === model.id }]),
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
                          ], 10, _hoisted_51);
                        }),
                        128
                        /* KEYED_FRAGMENT */
                      )),
                      unref(modelConfigs).length ? (openBlock(), createElementBlock("div", _hoisted_52)) : createCommentVNode("v-if", true),
                      unref(selectedModel) ? (openBlock(), createElementBlock("button", {
                        key: 1,
                        class: "mda-model-option",
                        type: "button",
                        onClick: editSelectedModel
                      }, [..._cache[45] || (_cache[45] = [
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
                      }, [..._cache[46] || (_cache[46] = [
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
                      }, [..._cache[47] || (_cache[47] = [
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
                      }, [..._cache[48] || (_cache[48] = [
                        createBaseVNode(
                          "span",
                          null,
                          "新增 Exec 模型",
                          -1
                          /* CACHED */
                        )
                      ])])
                    ])) : createCommentVNode("v-if", true)
                  ],
                  512
                  /* NEED_PATCH */
                ),
                createBaseVNode("button", {
                  class: "mda-send-btn",
                  type: "button",
                  disabled: !unref(composerCanSend),
                  onClick: _cache[20] || (_cache[20] = (...args) => unref(api).sendComposer && unref(api).sendComposer(...args))
                }, [
                  unref(candidateLoading) ? (openBlock(), createElementBlock(
                    "span",
                    _hoisted_54,
                    toDisplayString(unref(modelAssistLoading) ? "模型" : "检索"),
                    1
                    /* TEXT */
                  )) : (openBlock(), createElementBlock("span", _hoisted_55))
                ], 8, _hoisted_53)
              ])
            ])
          ]),
          unref(routeResolverTrace) ? (openBlock(), createElementBlock("div", _hoisted_56, [
            _cache[49] || (_cache[49] = createBaseVNode(
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
                onClick: _cache[21] || (_cache[21] = ($event) => unref(api).openSourceFile(routeFilePath.value))
              },
              toDisplayString(routeFilePath.value),
              1
              /* TEXT */
            )) : (openBlock(), createElementBlock("span", _hoisted_57, "暂无命中")),
            routeFilePath.value ? (openBlock(), createElementBlock("button", {
              key: 2,
              class: "mda-copy-icon",
              type: "button",
              title: "复制页面源码地址",
              "aria-label": "复制页面源码地址",
              onClick: copyRouteFilePath
            })) : createCommentVNode("v-if", true)
          ])) : createCommentVNode("v-if", true),
          createBaseVNode(
            "div",
            _hoisted_58,
            toDisplayString(unref(toastText)),
            1
            /* TEXT */
          )
        ]);
      };
    }
  };
  const _hoisted_1$1 = ["onClick"];
  const _sfc_main$1 = {
    __name: "SelectionLayer",
    setup(__props) {
      const api = useApi();
      const selectedItems = useForm("selectedItems");
      const layoutTick = useForm("layoutTick");
      const changedItems = computed(() => selectedItems.value.filter((item) => hasChangeNote2(item)));
      function hasChangeNote2(item) {
        return !!(item && item.changeNote && item.changeNote.trim());
      }
      function itemRect(item) {
        var _a;
        layoutTick.value;
        return (item == null ? void 0 : item.element) && document.documentElement.contains(item.element) ? item.element.getBoundingClientRect() : (_a = item == null ? void 0 : item.info) == null ? void 0 : _a.viewportBox;
      }
      function round2(value) {
        return Math.round(value);
      }
      function selectionBadgeStyle(item, index) {
        const rect = itemRect(item);
        const width = 62;
        const fallbackTop = 44 + index * 10;
        const fallbackLeft = 10 + index * 10;
        const left = rect ? Math.max(8, Math.min(rect.left + 8, window.innerWidth - width - 8)) : fallbackLeft;
        const top = rect ? Math.max(42, Math.min(rect.top - 28, window.innerHeight - 28)) : fallbackTop;
        return {
          left: `${round2(left)}px`,
          top: `${round2(top)}px`
        };
      }
      return (_ctx, _cache) => {
        return openBlock(true), createElementBlock(
          Fragment,
          null,
          renderList(changedItems.value, (item, index) => {
            return openBlock(), createElementBlock("div", {
              key: `${item.uid}-badge`,
              class: "mda-change-badge",
              style: normalizeStyle(selectionBadgeStyle(item, index)),
              title: "查看这个选区的改动",
              onClick: withModifiers(($event) => unref(api).openSelectionEditor(item), ["stop"])
            }, " 有改动 ", 12, _hoisted_1$1);
          }),
          128
          /* KEYED_FRAGMENT */
        );
      };
    }
  };
  const _hoisted_1 = { class: "mda-root" };
  const _hoisted_2 = { class: "mda-head" };
  const _hoisted_3 = { class: "mda-head-main" };
  const _hoisted_4 = { class: "mda-subtitle" };
  const _hoisted_5 = { class: "mda-actions" };
  const _hoisted_6 = { class: "mda-body mda-chat-body" };
  const PROJECT_STORAGE_PREFIX = "magnus:source-project:";
  const _sfc_main = {
    __name: "App",
    props: {
      api: {
        type: Object,
        required: true
      }
    },
    setup(__props) {
      const props = __props;
      const active = /* @__PURE__ */ ref(true);
      const panelRef = /* @__PURE__ */ ref(null);
      const composerPanelRef = /* @__PURE__ */ ref(null);
      const hoveredElement = /* @__PURE__ */ shallowRef(null);
      const selectedElement = /* @__PURE__ */ shallowRef(null);
      const displayInfo = /* @__PURE__ */ shallowRef(null);
      const selectedItems = /* @__PURE__ */ ref([]);
      const editingUid = /* @__PURE__ */ ref("");
      const candidateHits = /* @__PURE__ */ ref([]);
      const routeResolverTrace = /* @__PURE__ */ ref(null);
      const candidateLoading = /* @__PURE__ */ ref(false);
      const candidateError = /* @__PURE__ */ ref("");
      const searchKeywords = /* @__PURE__ */ ref("");
      const customEvidence = /* @__PURE__ */ ref("");
      const evidenceMessages = /* @__PURE__ */ ref([]);
      const includeApiEvidence = /* @__PURE__ */ ref(false);
      const selectedCandidatePaths = /* @__PURE__ */ ref([]);
      const expandedCandidatePath = /* @__PURE__ */ ref("");
      const selectionConfirmed = /* @__PURE__ */ ref(false);
      const filesConfirmed = /* @__PURE__ */ ref(false);
      const promptText = /* @__PURE__ */ ref("");
      const layoutTick = /* @__PURE__ */ ref(0);
      const currentPageHref = /* @__PURE__ */ ref(readCurrentHref());
      let selectionUid = 0;
      let routeResolveSeq = 0;
      let routeResolveTimer = 0;
      let cleanupLocationWatcher = null;
      const {
        collapsed,
        resizing,
        effectivePanelWidth,
        panelStyle,
        applyPageInset,
        startPanelResize,
        syncPanelWidth,
        cleanupPanelLayout
      } = usePanelLayout({ active });
      const {
        toastText,
        setToast,
        cleanupToast
      } = useToast();
      const {
        recentRequests,
        rememberRequest,
        denoiseTextByApi
      } = usePageRequests();
      const overlay = /* @__PURE__ */ reactive({
        visible: false,
        selected: false,
        left: "0px",
        top: "0px",
        width: "0px",
        height: "0px",
        badgeLeft: "0px",
        badgeTop: "0px",
        badgeText: ""
      });
      const pageHost = computed(() => {
        try {
          return new URL(currentPageHref.value).host || currentPageHref.value;
        } catch (error) {
          return "-";
        }
      });
      const pageUrlPath = computed(() => {
        try {
          const url = new URL(currentPageHref.value);
          return hashRoutePath(url.hash) || url.pathname || "/";
        } catch (error) {
          return "/";
        }
      });
      const projectStorageKey = computed(() => `${PROJECT_STORAGE_PREFIX}${pageHost.value}`);
      const {
        fileInputRef,
        project,
        sourceServiceStatus,
        sourceServiceError,
        sourceServiceMessage,
        chooseProject,
        onFileInputChange,
        restoreSavedProject
      } = useSourceProject({
        projectStorageKey,
        resetProjectContext,
        setToast
      });
      const searchApiRequests = computed(() => includeApiEvidence.value ? recentRequests.value.slice(0, 5) : []);
      const selectedCandidateHits = computed(() => {
        const selected = new Set(selectedCandidatePaths.value);
        return candidateHits.value.filter((hit) => selected.has(hit.file));
      });
      const canConfirmSelection = computed(() => selectedItems.value.length > 0 && selectedItems.value.some((item) => hasChangeNote2(item)));
      const routeResolverMatched = computed(() => {
        var _a;
        return !!((_a = routeResolverTrace.value) == null ? void 0 : _a.matched);
      });
      const hasReliableCandidateEvidence = computed(() => {
        return routeResolverMatched.value || candidateHits.value.some((hit) => {
          return hit.stage === "model-agent" || hit.uniqueSnippet && hit.uniqueMatchCount === 1;
        });
      });
      const needsMoreEvidence = computed(() => candidateHits.value.length > 1 && !filesConfirmed.value && !hasReliableCandidateEvidence.value);
      const showCandidatePicker = computed(() => candidateHits.value.length > 1 && !filesConfirmed.value && !needsMoreEvidence.value);
      const composerEditable = computed(() => needsMoreEvidence.value);
      const composerPlaceholder = computed(() => composerEditable.value ? "补充页面证据，例如：这是上传素材模块的视频剪辑区域，需要修改..." : "");
      const composerText = computed(() => {
        if (!project.value) return "请选择项目源码";
        if (candidateLoading.value) return "正在检索候选文件";
        if (promptText.value) return "最终提示词已生成";
        if (needsMoreEvidence.value) return customEvidence.value;
        if (showCandidatePicker.value) return "确认文件";
        return "选区已确认";
      });
      const composerInputValue = computed(() => composerEditable.value ? customEvidence.value : composerText.value);
      const composerCanSend = computed(() => {
        if (candidateLoading.value) return false;
        if (!project.value) return false;
        if (promptText.value) return false;
        if (needsMoreEvidence.value) return customEvidence.value.trim().length > 0;
        if (showCandidatePicker.value) return selectedCandidateHits.value.length > 0;
        return canConfirmSelection.value;
      });
      function hasUsableModelResult(result) {
        return ((result == null ? void 0 : result.modelItems) || (result == null ? void 0 : result.targetFiles) || []).some((item) => {
          return item && item.exists !== false && (item.path || item.file);
        });
      }
      const {
        selectionChatSummary,
        selectionNodeLine,
        ancestorPromptLine,
        searchPayload,
        searchLogLines,
        generatePrompt
      } = useSearchPrompt({
        selectedItems,
        selectedCandidatePaths,
        selectedCandidateHits,
        candidateHits,
        routeResolverTrace,
        evidenceMessages,
        customEvidence,
        searchKeywords,
        includeApiEvidence,
        searchApiRequests,
        pageUrlPath,
        project,
        promptText,
        denoiseTextByApi,
        selectionPayloads,
        setToast
      });
      const {
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
        runModelAssist
      } = useModelAdapters({
        project,
        candidateHits,
        selectedCandidatePaths,
        searchPayload,
        routeResolverTrace,
        setToast
      });
      const { chatMessages } = useChatMessages({
        project,
        selectedItems,
        selectionConfirmed,
        evidenceMessages,
        candidateLoading,
        includeApiEvidence,
        candidateHits,
        needsMoreEvidence,
        filesConfirmed,
        promptText,
        sourceServiceStatus,
        sourceServiceMessage,
        modelAssistLoading,
        modelAssistError,
        modelAssistLogs,
        modelAssistResult,
        selectionChatSummary,
        searchLogLines
      });
      const ctx = useCtx({
        selectedItems,
        editingUid,
        layoutTick,
        chatMessages,
        sourceServiceStatus,
        sourceServiceError,
        candidateError,
        showCandidatePicker,
        needsMoreEvidence,
        candidateHits,
        routeResolverTrace,
        selectedCandidatePaths,
        expandedCandidatePath,
        includeApiEvidence,
        candidateLoading,
        promptText,
        project,
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
        composerInputValue,
        composerEditable,
        composerPlaceholder,
        composerCanSend,
        toastText
      }, {
        loading: candidateLoading,
        back: () => __async(this, null, function* () {
        }),
        validate: () => __async(this, null, function* () {
          return { valid: true };
        }),
        buildParams: () => searchPayload(),
        empty: () => clearSelections(),
        previewSelection,
        restoreSelectionPreview,
        openSelectionEditor,
        removeSelection,
        updateSelectionNote: onSelectionNoteInput,
        chooseProject,
        copyPrompt: () => copyTextWithToast(promptText.value),
        copyTextWithToast,
        openSourceFile,
        setIncludeApiEvidence: (value) => {
          includeApiEvidence.value = !!value;
        },
        onSearchOptionChange,
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
        clearSelections,
        onComposerInput,
        sendComposer,
        toggleCandidateFile,
        toggleCandidateDetail
      });
      ctx.setup();
      const overlayStyle = computed(() => ({
        display: overlay.visible ? "block" : "none",
        left: overlay.left,
        top: overlay.top,
        width: overlay.width,
        height: overlay.height
      }));
      const badgeStyle = computed(() => ({
        display: overlay.visible ? "block" : "none",
        left: overlay.badgeLeft,
        top: overlay.badgeTop
      }));
      function selectionPayloads() {
        return selectedItems.value.map((item, index) => ({
          index: index + 1,
          changeNote: item.changeNote.trim(),
          element: item.info
        }));
      }
      function dispatchSelected() {
        try {
          window.dispatchEvent(new CustomEvent("magnus:element-selected", { detail: selectionPayloads() }));
        } catch (error) {
        }
      }
      function updateInfo(element) {
        const info = getElementInfo(element);
        if (!info) return;
        displayInfo.value = info;
      }
      function classBadgeText(element) {
        const classes = [];
        if (element.classList && element.classList.length) {
          for (let i = 0; i < element.classList.length && i < 2; i++) {
            classes.push(`.${element.classList[i]}`);
          }
        }
        return classes.join("");
      }
      function makeBadgeText(element) {
        if (!element) return "";
        const rect = element.getBoundingClientRect();
        const classText = classBadgeText(element);
        return `${element.tagName.toLowerCase()}${classText}  ${round(rect.width)}x${round(rect.height)}`;
      }
      function hideOverlay() {
        overlay.visible = false;
        overlay.badgeText = "";
      }
      function updateOverlay(element, isSelected) {
        if (!element || !document.documentElement.contains(element)) {
          hideOverlay();
          return;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 && rect.height <= 0) {
          hideOverlay();
          return;
        }
        const badgeTop = rect.top > 28 ? rect.top - 26 : rect.bottom + 4;
        const badgeLeft = Math.max(8, Math.min(rect.left, window.innerWidth - 260));
        overlay.visible = true;
        overlay.selected = !!isSelected;
        overlay.left = `${round(rect.left)}px`;
        overlay.top = `${round(rect.top)}px`;
        overlay.width = `${Math.max(1, round(rect.width))}px`;
        overlay.height = `${Math.max(1, round(rect.height))}px`;
        overlay.badgeLeft = `${round(badgeLeft)}px`;
        overlay.badgeTop = `${round(Math.max(8, badgeTop))}px`;
        overlay.badgeText = makeBadgeText(element);
      }
      function getEventPath(event) {
        if (event.composedPath) return event.composedPath();
        const path = [];
        let node = event.target;
        while (node) {
          path.push(node);
          node = node.parentNode;
        }
        path.push(window);
        return path;
      }
      function isFromAssistantUi(event) {
        const path = getEventPath(event);
        return path.includes(props.api.host) || path.includes(props.api.shadowRoot) || path.includes(panelRef.value);
      }
      function stopAssistantEvent(event) {
        if (isFromAssistantUi(event)) event.stopPropagation();
      }
      function hasPathClass(event, className) {
        return getEventPath(event).some((node) => {
          return node && node.classList && node.classList.contains(className);
        });
      }
      function closeSelectionEditor() {
        editingUid.value = "";
      }
      function openSelectionEditor(item) {
        if (!item) return;
        editingUid.value = item.uid;
        selectedElement.value = item.element;
        displayInfo.value = item.info;
        hideOverlay();
        nextTick(() => {
          const editor = props.api.shadowRoot.querySelector(`[data-selection-uid="${item.uid}"]`);
          if (editor && typeof editor.focus === "function") editor.focus();
        });
      }
      function hasChangeNote2(item) {
        return !!(item && item.changeNote && item.changeNote.trim());
      }
      function invalidatePrompt() {
        promptText.value = "";
      }
      function invalidateSelectionConfirm() {
        selectionConfirmed.value = false;
        filesConfirmed.value = false;
        candidateHits.value = [];
        candidateError.value = "";
        selectedCandidatePaths.value = [];
        expandedCandidatePath.value = "";
        invalidatePrompt();
      }
      function invalidateCandidateConfirm() {
        filesConfirmed.value = false;
        invalidatePrompt();
      }
      function clearCandidateState() {
        candidateHits.value = [];
        candidateError.value = "";
        selectedCandidatePaths.value = [];
        expandedCandidatePath.value = "";
        filesConfirmed.value = false;
        resetModelAssist();
        invalidatePrompt();
      }
      function resetProjectContext() {
        selectionConfirmed.value = false;
        customEvidence.value = "";
        evidenceMessages.value = [];
        clearCandidateState();
      }
      function readCurrentHref() {
        try {
          return window.location.href || "";
        } catch (error) {
          return "";
        }
      }
      function hashRoutePath(hash) {
        const value = String(hash || "").replace(/^#/, "");
        if (!value) return "";
        const route = value.startsWith("!/") ? value.slice(1) : value;
        if (!route.startsWith("/")) return "";
        return route.split("?")[0] || "/";
      }
      function syncCurrentUrl() {
        const nextHref = readCurrentHref();
        if (nextHref && nextHref !== currentPageHref.value) {
          currentPageHref.value = nextHref;
        }
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
          var _a;
          if (!project.value || project.value.source !== "source-server") {
            routeResolverTrace.value = null;
            return;
          }
          const seq = ++routeResolveSeq;
          try {
            const data = yield sourceServerJson("/api/route/resolve", {
              method: "POST",
              body: {
                url: currentPageHref.value,
                pagePath: pageUrlPath.value
              },
              timeoutMs: 5e3,
              timeoutMessage: "页面路由解析超过 5 秒"
            });
            if (seq !== routeResolveSeq) return;
            routeResolverTrace.value = data.routeResolver || null;
          } catch (error) {
            if (seq !== routeResolveSeq) return;
            routeResolverTrace.value = {
              projectKind: ((_a = project.value) == null ? void 0 : _a.kind) || "unknown",
              pagePath: pageUrlPath.value,
              adapters: [],
              matched: false,
              hits: [],
              errors: [error.message || String(error)]
            };
          }
        });
      }
      function installLocationWatcher() {
        const rawPushState = window.history.pushState;
        const rawReplaceState = window.history.replaceState;
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
      function onSelectionNoteInput(uid2, value) {
        const item = selectedItems.value.find((selection) => selection.uid === uid2);
        if (item) item.changeNote = value;
        invalidateSelectionConfirm();
      }
      function onSearchOptionChange() {
        clearCandidateState();
      }
      function onComposerInput(event) {
        if (!composerEditable.value) return;
        customEvidence.value = event.target.value;
      }
      function openSourceFile(file) {
        return __async(this, null, function* () {
          if (!file) return;
          try {
            yield sourceServerJson("/api/source/open", {
              method: "POST",
              body: { file },
              timeoutMs: 5e3,
              timeoutMessage: "打开源码文件超时，请确认本地源码服务可用"
            });
            setToast(`已打开 ${file}`);
          } catch (error) {
            setToast(error.message || "打开源码文件失败");
          }
        });
      }
      function runEvidenceSearch() {
        return __async(this, null, function* () {
          filesConfirmed.value = false;
          invalidatePrompt();
          const hits = yield searchCandidateFiles();
          if (hits.length === 1) {
            selectedCandidatePaths.value = [hits[0].file];
            filesConfirmed.value = true;
            generatePrompt();
            return;
          }
          if (needsMoreEvidence.value) {
            nextTick(() => {
              var _a, _b;
              (_b = (_a = composerPanelRef.value) == null ? void 0 : _a.focusEvidenceInput) == null ? void 0 : _b.call(_a);
            });
          }
        });
      }
      function addEvidenceText(text) {
        return __async(this, null, function* () {
          const value = compactText(text, 220);
          if (!value) return;
          evidenceMessages.value.push(`补充证据：${value}`);
          customEvidence.value = "";
          setToast("已追加页面证据");
          yield runEvidenceSearch();
        });
      }
      function evidenceFromElement(element) {
        const info = getElementInfo(element);
        if (!info) return "";
        const text = denoiseTextByApi(info.text, 160);
        const ancestors = ancestorPromptLine(info);
        return [
          "页面节点证据",
          selectionNodeLine(info),
          text ? `文案=${text}` : "",
          ancestors ? `父级=${ancestors}` : ""
        ].filter(Boolean).join("；");
      }
      function confirmSelectionContext() {
        if (!canConfirmSelection.value) return;
        selectionConfirmed.value = true;
        filesConfirmed.value = false;
        invalidatePrompt();
        setToast("选区已确认");
      }
      function toggleCandidateFile(hit) {
        if (!hit) return;
        const selected = new Set(selectedCandidatePaths.value);
        if (selected.has(hit.file)) selected.delete(hit.file);
        else selected.add(hit.file);
        selectedCandidatePaths.value = Array.from(selected);
        invalidateCandidateConfirm();
      }
      function toggleCandidateDetail(hit) {
        if (!hit) return;
        expandedCandidatePath.value = expandedCandidatePath.value === hit.file ? "" : hit.file;
      }
      function confirmCandidateFiles() {
        if (!selectedCandidateHits.value.length) return;
        filesConfirmed.value = true;
        setToast("候选文件已确认");
        generatePrompt();
      }
      function onPointerDown(event) {
        if (!editingUid.value) return;
        if (isFromAssistantUi(event)) return;
        if (hasPathClass(event, "mda-floating-note")) return;
        closeSelectionEditor();
      }
      function onPageMessage(event) {
        const message = event.data || {};
        if (message.type !== "WEB_REQUEST_RESPONSE") return;
        rememberRequest(normalizeRequestInfo(message.data || {}, window.location.href));
      }
      function elementFromPoint(event) {
        const element = document.elementFromPoint(event.clientX, event.clientY);
        if (!element || element === props.api.host || element.id === "magnus-dev-assistant-root") return null;
        if (element.nodeType !== 1) return null;
        return element;
      }
      function setActive(value) {
        active.value = !!value;
        document.documentElement.style.cursor = active.value ? "crosshair" : "";
        if (!active.value) {
          hoveredElement.value = null;
          hideOverlay();
        }
      }
      function toggleActive() {
        setActive(!active.value);
      }
      function isEditableTarget(target) {
        if (!target || target === window || target === document) return false;
        const element = target.nodeType === 1 ? target : target.parentElement;
        if (!element) return false;
        const tag = element.tagName ? element.tagName.toLowerCase() : "";
        return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable;
      }
      function onMouseMove(event) {
        if (!active.value || isFromAssistantUi(event)) return;
        const element = elementFromPoint(event);
        if (!element || element === hoveredElement.value) return;
        hoveredElement.value = element;
        updateOverlay(element, false);
        updateInfo(element);
      }
      function addSelection(element) {
        const info = getElementInfo(element);
        if (!info) return;
        const item = {
          uid: `selection-${Date.now()}-${selectionUid++}`,
          element: markRaw(element),
          info,
          changeNote: ""
        };
        selectedItems.value.push(item);
        selectedElement.value = element;
        displayInfo.value = info;
        window.__MAGNUS_LAST_ELEMENT__ = element;
        window.__MAGNUS_LAST_ELEMENT_INFO__ = info;
        window.__MAGNUS_SELECTIONS__ = selectionPayloads();
        dispatchSelected();
        hoveredElement.value = null;
        hideOverlay();
        editingUid.value = item.uid;
        invalidateSelectionConfirm();
        setToast(`已添加选区 ${selectedItems.value.length}`);
        nextTick(() => {
          const editor = props.api.shadowRoot.querySelector(`[data-selection-uid="${item.uid}"]`);
          if (editor && typeof editor.focus === "function") editor.focus();
        });
      }
      function onKeyDown(event) {
        return __async(this, null, function* () {
          const isConfirmKey = (event.code === "Space" || event.key === " ") && !event.metaKey && !event.ctrlKey && !event.altKey;
          if (isConfirmKey && active.value && hoveredElement.value && !isFromAssistantUi(event) && !isEditableTarget(event.target)) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (needsMoreEvidence.value) {
              yield addEvidenceText(evidenceFromElement(hoveredElement.value));
              return;
            }
            addSelection(hoveredElement.value);
          }
        });
      }
      function previewSelection(item) {
        if (!item || !item.element) return;
        selectedElement.value = item.element;
        displayInfo.value = item.info;
        updateOverlay(item.element, true);
      }
      function restoreSelectionPreview() {
        hideOverlay();
      }
      function onScrollOrResize() {
        layoutTick.value++;
        syncPanelWidth();
        applyPageInset();
        if (active.value && hoveredElement.value) {
          updateOverlay(hoveredElement.value, false);
          return;
        }
        selectedElement.value = null;
        if (!active.value) displayInfo.value = null;
        hideOverlay();
      }
      function removeSelection(uid2) {
        const index = selectedItems.value.findIndex((item) => item.uid === uid2);
        if (index === -1) return;
        selectedItems.value.splice(index, 1);
        if (editingUid.value === uid2) closeSelectionEditor();
        invalidateSelectionConfirm();
        window.__MAGNUS_SELECTIONS__ = selectionPayloads();
        dispatchSelected();
        setToast("已移除选区");
        onScrollOrResize();
      }
      function clearSelections() {
        selectedItems.value = [];
        selectedElement.value = null;
        hoveredElement.value = null;
        displayInfo.value = null;
        editingUid.value = "";
        selectionConfirmed.value = false;
        customEvidence.value = "";
        evidenceMessages.value = [];
        clearCandidateState();
        window.__MAGNUS_LAST_ELEMENT__ = null;
        window.__MAGNUS_LAST_ELEMENT_INFO__ = null;
        window.__MAGNUS_SELECTIONS__ = [];
        hideOverlay();
        setActive(true);
        setToast("");
      }
      function searchCandidateFiles() {
        return __async(this, null, function* () {
          candidateLoading.value = true;
          candidateError.value = "";
          resetModelAssist();
          filesConfirmed.value = false;
          try {
            const data = yield sourceServerJson("/api/search", {
              method: "POST",
              body: searchPayload(),
              timeoutMs: includeApiEvidence.value ? 3e4 : 12e3,
              timeoutMessage: includeApiEvidence.value ? "接口调用链追踪超过 30 秒，请减少捕获接口或补充关键词后重试" : "源码检索超过 12 秒，请补充关键词后重试"
            });
            candidateHits.value = Array.isArray(data.hits) ? data.hits : [];
            routeResolverTrace.value = data.routeResolver || null;
            if (!candidateHits.value.length) {
              selectedCandidatePaths.value = [];
              candidateError.value = "未找到候选文件。可以先触发页面接口，或补充选区改动点后重试。";
            } else {
              selectedCandidatePaths.value = [candidateHits.value[0].file];
              expandedCandidatePath.value = "";
              setToast(`找到 ${candidateHits.value.length} 个候选文件`);
            }
            if (candidateHits.value.length && useModelAssist.value && canUseModelAssist.value) {
              const modelResult = yield runModelAssist();
              if (hasUsableModelResult(modelResult)) {
                filesConfirmed.value = true;
                generatePrompt();
              }
            }
            return candidateHits.value;
          } catch (error) {
            selectedCandidatePaths.value = [];
            candidateError.value = `${error.message || error}。`;
            return [];
          } finally {
            candidateLoading.value = false;
          }
        });
      }
      function sendComposer() {
        return __async(this, null, function* () {
          if (!project.value) return;
          if (needsMoreEvidence.value) {
            const evidence = customEvidence.value.trim();
            if (!evidence) return;
            evidenceMessages.value.push(`补充证据：${evidence}`);
            customEvidence.value = "";
            yield runEvidenceSearch();
            return;
          }
          if (showCandidatePicker.value) {
            confirmCandidateFiles();
            return;
          }
          if (!canConfirmSelection.value) return;
          confirmSelectionContext();
          const hits = yield searchCandidateFiles();
          if (hits.length === 1) {
            selectedCandidatePaths.value = [hits[0].file];
            filesConfirmed.value = true;
            generatePrompt();
          }
        });
      }
      function copyText(text) {
        if (!text) return Promise.resolve(false);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
        }
        return new Promise((resolve) => {
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
          textarea.parentNode.removeChild(textarea);
          resolve(ok);
        });
      }
      function copyTextWithToast(text) {
        copyText(text).then((ok) => {
          setToast(ok ? "已复制" : "复制失败");
        });
      }
      function destroy() {
        props.api.destroy();
      }
      function registerApi() {
        props.api.start = () => setActive(true);
        props.api.stop = () => setActive(false);
        props.api.toggle = toggleActive;
        props.api.clear = clearSelections;
        props.api.getSelected = () => ({
          element: selectedElement.value,
          selections: selectionPayloads()
        });
      }
      function cleanup() {
        setActive(false);
        if (routeResolveTimer) {
          window.clearTimeout(routeResolveTimer);
          routeResolveTimer = 0;
        }
        if (cleanupLocationWatcher) {
          cleanupLocationWatcher();
          cleanupLocationWatcher = null;
        }
        cleanupToast();
        props.api.shadowRoot.removeEventListener("focusin", stopAssistantEvent);
        props.api.shadowRoot.removeEventListener("keydown", stopAssistantEvent);
        props.api.shadowRoot.removeEventListener("mousedown", stopAssistantEvent);
        props.api.shadowRoot.removeEventListener("pointerdown", stopAssistantEvent);
        props.api.shadowRoot.removeEventListener("click", stopAssistantEvent);
        window.removeEventListener("pointerdown", onPointerDown, true);
        window.removeEventListener("message", onPageMessage, true);
        window.removeEventListener("mousemove", onMouseMove, true);
        window.removeEventListener("keydown", onKeyDown, true);
        window.removeEventListener("scroll", onScrollOrResize, true);
        window.removeEventListener("resize", onScrollOrResize, true);
        cleanupPanelLayout();
      }
      watch(effectivePanelWidth, () => {
        applyPageInset();
        onScrollOrResize();
      });
      watch([project, currentPageHref], () => {
        routeResolverTrace.value = null;
        scheduleRouteResolve();
      });
      onMounted(() => {
        registerApi();
        setActive(true);
        syncPanelWidth();
        applyPageInset();
        cleanupLocationWatcher = installLocationWatcher();
        restoreSavedProject();
        scheduleRouteResolve();
        props.api.shadowRoot.addEventListener("focusin", stopAssistantEvent);
        props.api.shadowRoot.addEventListener("keydown", stopAssistantEvent);
        props.api.shadowRoot.addEventListener("mousedown", stopAssistantEvent);
        props.api.shadowRoot.addEventListener("pointerdown", stopAssistantEvent);
        props.api.shadowRoot.addEventListener("click", stopAssistantEvent);
        window.addEventListener("pointerdown", onPointerDown, true);
        window.addEventListener("message", onPageMessage, true);
        window.addEventListener("mousemove", onMouseMove, true);
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("scroll", onScrollOrResize, true);
        window.addEventListener("resize", onScrollOrResize, true);
      });
      onBeforeUnmount(cleanup);
      return (_ctx, _cache) => {
        return openBlock(), createElementBlock("div", _hoisted_1, [
          createBaseVNode(
            "div",
            {
              class: normalizeClass(["mda-overlay", { "is-selected": overlay.selected }]),
              style: normalizeStyle(overlayStyle.value)
            },
            null,
            6
            /* CLASS, STYLE */
          ),
          createBaseVNode(
            "div",
            {
              class: "mda-badge",
              style: normalizeStyle(badgeStyle.value)
            },
            toDisplayString(overlay.badgeText),
            5
            /* TEXT, STYLE */
          ),
          _cache[4] || (_cache[4] = createBaseVNode(
            "div",
            { class: "mda-hotkey-tip" },
            "空格键确认选区",
            -1
            /* CACHED */
          )),
          createVNode(_sfc_main$1),
          createBaseVNode(
            "section",
            {
              ref_key: "panelRef",
              ref: panelRef,
              class: normalizeClass(["mda-panel", { "is-collapsed": unref(collapsed), "is-resizing": unref(resizing) }]),
              style: normalizeStyle(unref(panelStyle)),
              "aria-label": "Magnus"
            },
            [
              !unref(collapsed) ? (openBlock(), createElementBlock(
                "div",
                {
                  key: 0,
                  class: "mda-resizer",
                  title: "拖动调整助手宽度",
                  onPointerdown: _cache[0] || (_cache[0] = withModifiers((...args) => unref(startPanelResize) && unref(startPanelResize)(...args), ["stop", "prevent"]))
                },
                null,
                32
                /* NEED_HYDRATION */
              )) : createCommentVNode("v-if", true),
              createBaseVNode("header", _hoisted_2, [
                createBaseVNode("div", _hoisted_3, [
                  _cache[3] || (_cache[3] = createBaseVNode(
                    "div",
                    { class: "mda-title" },
                    "Magnus",
                    -1
                    /* CACHED */
                  )),
                  createBaseVNode(
                    "div",
                    _hoisted_4,
                    toDisplayString(pageHost.value),
                    1
                    /* TEXT */
                  )
                ]),
                createBaseVNode("div", _hoisted_5, [
                  createBaseVNode(
                    "button",
                    {
                      class: "mda-icon",
                      type: "button",
                      title: "收起/展开",
                      onClick: _cache[1] || (_cache[1] = withModifiers(($event) => collapsed.value = !unref(collapsed), ["stop"]))
                    },
                    toDisplayString(unref(collapsed) ? "<" : ">"),
                    1
                    /* TEXT */
                  ),
                  createBaseVNode("button", {
                    class: "mda-icon",
                    type: "button",
                    title: "关闭",
                    onClick: withModifiers(destroy, ["stop"])
                  }, "x")
                ])
              ]),
              createBaseVNode("div", _hoisted_6, [
                createBaseVNode(
                  "input",
                  {
                    ref_key: "fileInputRef",
                    ref: fileInputRef,
                    class: "mda-file-input",
                    type: "file",
                    webkitdirectory: "",
                    multiple: "",
                    onChange: _cache[2] || (_cache[2] = (...args) => unref(onFileInputChange) && unref(onFileInputChange)(...args))
                  },
                  null,
                  544
                  /* NEED_HYDRATION, NEED_PATCH */
                ),
                createVNode(_sfc_main$3),
                createVNode(
                  _sfc_main$2,
                  {
                    ref_key: "composerPanelRef",
                    ref: composerPanelRef
                  },
                  null,
                  512
                  /* NEED_PATCH */
                )
              ])
            ],
            6
            /* CLASS, STYLE */
          )
        ]);
      };
    }
  };
  const styles = ':host {\n  all: initial;\n  color-scheme: light;\n}\n\n.mda-root,\n.mda-root * {\n  box-sizing: border-box;\n}\n\n.mda-root {\n  position: fixed;\n  inset: 0;\n  pointer-events: none;\n  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-panel {\n  position: fixed;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  width: 420px;\n  max-width: min(420px, calc(100vw - 20px));\n  height: 100vh;\n  background: #f7f8fa;\n  color: #1f2328;\n  border-left: 1px solid #d8dee6;\n  box-shadow: -14px 0 34px rgba(17, 24, 39, 0.18);\n  pointer-events: auto;\n  overflow: hidden;\n  transition: width 180ms ease, box-shadow 180ms ease;\n  animation: mda-slide-in 180ms ease both;\n}\n\n.mda-resizer {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: -4px;\n  z-index: 2;\n  width: 9px;\n  cursor: col-resize;\n  pointer-events: auto;\n}\n\n.mda-resizer::after {\n  content: "";\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 4px;\n  width: 1px;\n  background: transparent;\n}\n\n.mda-resizer:hover::after {\n  background: #98a2b3;\n}\n\n.mda-panel.is-resizing {\n  transition: box-shadow 180ms ease;\n}\n\n.mda-hotkey-tip {\n  position: fixed;\n  top: 10px;\n  left: 10px;\n  z-index: 2147483647;\n  height: 28px;\n  padding: 0 10px;\n  border-radius: 6px;\n  background: #05070a;\n  color: #ffffff;\n  font: 12px/28px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.26);\n  pointer-events: none;\n}\n\n.mda-floating-note {\n  position: fixed;\n  z-index: 2147483647;\n  display: grid;\n  gap: 6px;\n  padding: 8px;\n  border: 1px solid rgba(37, 99, 235, 0.55);\n  border-radius: 8px;\n  background: #ffffff;\n  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.2);\n  pointer-events: auto;\n  cursor: auto;\n}\n\n.mda-selection-highlight {\n  position: fixed;\n  z-index: 2147483643;\n  border: 2px solid rgba(37, 99, 235, 0.88);\n  border-radius: 4px;\n  background: rgba(37, 99, 235, 0.08);\n  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85), 0 0 0 4px rgba(37, 99, 235, 0.12);\n  pointer-events: none;\n}\n\n.mda-selection-highlight.has-note {\n  border-color: rgba(22, 163, 74, 0.9);\n  background: rgba(22, 163, 74, 0.08);\n  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.85), 0 0 0 4px rgba(22, 163, 74, 0.13);\n}\n\n.mda-selection-highlight.is-editing {\n  border-color: #111827;\n  background: rgba(17, 24, 39, 0.08);\n  box-shadow: 0 0 0 1px #ffffff, 0 0 0 5px rgba(17, 24, 39, 0.16);\n}\n\n.mda-change-badge {\n  position: fixed;\n  z-index: 2147483645;\n  height: 22px;\n  padding: 0 8px;\n  border-radius: 999px;\n  background: #16a34a;\n  color: #ffffff;\n  font: 12px/22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n  box-shadow: 0 8px 20px rgba(22, 163, 74, 0.28);\n  cursor: pointer;\n  pointer-events: auto;\n  white-space: nowrap;\n}\n\n.mda-change-badge:hover {\n  background: #15803d;\n}\n\n.mda-floating-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  color: #111827;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-floating-textarea {\n  width: 100%;\n  min-height: 72px;\n  resize: vertical;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  padding: 7px 8px;\n  background: #ffffff;\n  color: #111827;\n  outline: none;\n  font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-floating-textarea:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);\n}\n\n.mda-head {\n  height: 56px;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 0 10px 0 14px;\n  background: #ffffff;\n  border-bottom: 1px solid #d8dee6;\n  cursor: default;\n  user-select: none;\n}\n\n.mda-head-main {\n  min-width: 0;\n}\n\n.mda-title {\n  font-weight: 700;\n  font-size: 14px;\n  color: #15191f;\n}\n\n.mda-subtitle {\n  margin-top: 1px;\n  max-width: 280px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: #6b7280;\n  font-size: 12px;\n}\n\n.mda-actions {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.mda-icon {\n  width: 28px;\n  height: 28px;\n  border: 1px solid transparent;\n  border-radius: 6px;\n  background: transparent;\n  color: #4b5563;\n  cursor: pointer;\n  font-size: 17px;\n  line-height: 26px;\n}\n\n.mda-icon:hover {\n  background: #eef2f6;\n  border-color: #d8dee6;\n  color: #111827;\n}\n\n.mda-body {\n  display: grid;\n  align-content: start;\n  gap: 10px;\n  height: calc(100vh - 56px);\n  padding: 12px;\n  overflow: auto;\n}\n\n.mda-chat-body {\n  display: flex;\n  flex-direction: column;\n  gap: 0;\n  padding: 0;\n  overflow: hidden;\n}\n\n.mda-chat-thread {\n  flex: 1 1 auto;\n  display: grid;\n  align-content: start;\n  gap: 10px;\n  min-height: 0;\n  padding: 12px;\n  overflow: auto;\n}\n\n.mda-chat-message {\n  display: grid;\n  grid-template-columns: 42px minmax(0, 1fr);\n  gap: 10px;\n  align-items: start;\n}\n\n.mda-chat-message.is-user {\n  grid-template-columns: minmax(0, 1fr) 32px;\n}\n\n.mda-chat-message.is-user .mda-message-avatar {\n  grid-column: 2;\n  grid-row: 1;\n  background: #2563eb;\n}\n\n.mda-chat-message.is-user .mda-message-bubble {\n  grid-column: 1;\n  justify-self: end;\n  max-width: 86%;\n  background: #e8f0ff;\n  border-color: #b8cdfb;\n}\n\n.mda-chat-message.is-agent .mda-message-avatar {\n  background: #0f766e;\n  font-size: 11px;\n}\n\n.mda-chat-message.is-agent .mda-message-bubble {\n  background: #f0fdfa;\n  border-color: #99f6e4;\n}\n\n.mda-message-avatar {\n  width: 34px;\n  height: 24px;\n  border-radius: 6px;\n  background: #111827;\n  color: #ffffff;\n  text-align: center;\n  font-size: 12px;\n  font-weight: 700;\n  line-height: 24px;\n}\n\n.mda-message-bubble {\n  display: grid;\n  gap: 7px;\n  min-width: 0;\n  padding: 10px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #ffffff;\n}\n\n.mda-message-title {\n  color: #111827;\n  font-size: 13px;\n  font-weight: 750;\n}\n\n.mda-message-text {\n  color: #4b5563;\n  font-size: 12px;\n  white-space: pre-wrap;\n}\n\n.mda-message-pre {\n  max-height: 280px;\n  margin: 0;\n  padding: 9px;\n  overflow: auto;\n  border-radius: 6px;\n  background: #0f172a;\n  color: #e5edf7;\n  font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  white-space: pre-wrap;\n}\n\n.mda-message-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n\n.mda-composer-wrap {\n  flex: 0 0 auto;\n  display: grid;\n  gap: 8px;\n  padding: 10px;\n  border-top: 1px solid #d8dee6;\n  background: #ffffff;\n}\n\n.mda-composer-options {\n  display: grid;\n  gap: 8px;\n  padding: 9px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #f8fafc;\n}\n\n.mda-composer-options.is-compact {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0;\n  border: 0;\n  background: transparent;\n}\n\n.mda-model-select {\n  max-width: 154px;\n  height: 26px;\n  min-width: 0;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  background: #ffffff;\n  color: #344054;\n  font: 12px/24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-model-editor {\n  display: grid;\n  gap: 8px;\n  padding: 9px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #f8fafc;\n}\n\n.mda-model-editor-head,\n.mda-model-actions {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.mda-model-editor-head strong {\n  color: #111827;\n  font-size: 12px;\n}\n\n.mda-model-grid {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);\n  gap: 8px;\n}\n\n.mda-model-grid label {\n  display: grid;\n  gap: 4px;\n  min-width: 0;\n  color: #667085;\n  font-size: 11px;\n}\n\n.mda-model-grid label.is-wide {\n  grid-column: 1 / -1;\n}\n\n.mda-model-input {\n  width: 100%;\n  height: 30px;\n  min-width: 0;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  padding: 0 8px;\n  background: #ffffff;\n  color: #111827;\n  outline: none;\n  font: 12px/28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-model-input:focus,\n.mda-model-select:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);\n}\n\n.mda-option-title {\n  color: #111827;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-option-desc {\n  color: #667085;\n  font-size: 12px;\n  line-height: 1.55;\n}\n\n.mda-choice-list {\n  display: grid;\n  gap: 7px;\n  max-height: 300px;\n  overflow: auto;\n}\n\n.mda-choice-card {\n  display: grid;\n  gap: 5px;\n  padding: 8px;\n  border: 1px solid #dbe3ee;\n  border-radius: 7px;\n  background: #ffffff;\n}\n\n.mda-choice-card.is-selected {\n  border-color: #2563eb;\n  background: #eff6ff;\n}\n\n.mda-choice-check {\n  display: grid;\n  grid-template-columns: 16px minmax(0, 1fr);\n  gap: 7px;\n  align-items: center;\n  min-width: 0;\n  color: #111827;\n  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-choice-check input {\n  width: 14px;\n  height: 14px;\n  margin: 0;\n}\n\n.mda-choice-check span,\n.mda-file-link {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-file-link {\n  width: 100%;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: #2563eb;\n  cursor: pointer;\n  text-align: left;\n  font: inherit;\n}\n\n.mda-file-link:hover {\n  color: #1d4ed8;\n  text-decoration: underline;\n}\n\n.mda-choice-meta {\n  color: #64748b;\n  font-size: 12px;\n}\n\n.mda-selection-tags-panel {\n  display: grid;\n  gap: 8px;\n}\n\n.mda-selection-tags {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.mda-selection-tag {\n  display: inline-flex;\n  align-items: center;\n  max-width: 100%;\n  height: 26px;\n  min-width: 0;\n  gap: 6px;\n  padding: 0 8px;\n  border: 1px solid #e4e7ec;\n  border-radius: 999px;\n  background: #ffffff;\n  color: #344054;\n  cursor: pointer;\n  font: 12px/24px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-selection-tag:hover,\n.mda-selection-tag.is-active {\n  border-color: #98a2b3;\n  background: #f2f4f7;\n  color: #101828;\n}\n\n.mda-selection-tag span {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-selection-tag em {\n  flex: 0 0 auto;\n  height: 16px;\n  padding: 0 5px;\n  border-radius: 999px;\n  background: #dcfce7;\n  color: #166534;\n  font: 10px/16px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n  font-style: normal;\n}\n\n.mda-selection-detail {\n  display: grid;\n  gap: 8px;\n  padding: 9px;\n  border: 1px solid #e4e7ec;\n  border-radius: 12px;\n  background: #f9fafb;\n}\n\n.mda-selection-detail-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.mda-selection-detail-title {\n  min-width: 0;\n  overflow: hidden;\n  color: #101828;\n  font-size: 12px;\n  font-weight: 680;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-selection-detail-grid {\n  display: grid;\n  grid-template-columns: 42px minmax(0, 1fr);\n  gap: 5px 8px;\n  color: #667085;\n  font-size: 11px;\n}\n\n.mda-selection-detail-grid strong {\n  min-width: 0;\n  overflow: hidden;\n  color: #344054;\n  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-selection-note {\n  width: 100%;\n  min-height: 68px;\n  resize: vertical;\n  border: 1px solid #d0d5dd;\n  border-radius: 10px;\n  padding: 8px 9px;\n  background: #ffffff;\n  color: #101828;\n  outline: none;\n  font: 12px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-selection-note:focus {\n  border-color: #101828;\n  box-shadow: 0 0 0 3px rgba(16, 24, 40, 0.1);\n}\n\n.mda-route-inline {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  padding: 0 2px;\n}\n\n.mda-route-label {\n  color: #667085;\n  font-size: 12px;\n  font-weight: 650;\n  white-space: nowrap;\n}\n\n.mda-route-file {\n  flex: 1 1 auto;\n  min-width: 0;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: #2563eb;\n  cursor: pointer;\n  overflow: hidden;\n  text-align: left;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-route-file:hover {\n  color: #1d4ed8;\n  text-decoration: underline;\n}\n\n.mda-route-empty {\n  flex: 1 1 auto;\n  min-width: 0;\n  color: #98a2b3;\n  font-size: 12px;\n}\n\n.mda-copy-icon {\n  position: relative;\n  flex: 0 0 auto;\n  width: 20px;\n  height: 20px;\n  border: 0;\n  border-radius: 5px;\n  background: transparent;\n  cursor: pointer;\n}\n\n.mda-copy-icon::before,\n.mda-copy-icon::after {\n  content: "";\n  position: absolute;\n  width: 9px;\n  height: 10px;\n  border: 1.5px solid #667085;\n  border-radius: 2px;\n}\n\n.mda-copy-icon::before {\n  top: 4px;\n  left: 7px;\n  background: #ffffff;\n}\n\n.mda-copy-icon::after {\n  top: 7px;\n  left: 4px;\n  background: #ffffff;\n}\n\n.mda-copy-icon:hover {\n  background: #f2f4f7;\n}\n\n.mda-copy-icon:hover::before,\n.mda-copy-icon:hover::after {\n  border-color: #101828;\n}\n\n.mda-composer {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 8px;\n  align-items: center;\n}\n\n.mda-composer-input {\n  width: 100%;\n  height: 38px;\n  min-width: 0;\n  border: 1px solid #cfd7e2;\n  border-radius: 8px;\n  padding: 0 10px;\n  background: #ffffff;\n  color: #111827;\n  outline: none;\n  font: 13px/38px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-send-btn {\n  height: 38px;\n  padding: 0 13px;\n  border: 1px solid #2563eb;\n  border-radius: 8px;\n  background: #2563eb;\n  color: #ffffff;\n  cursor: pointer;\n  font-family: inherit;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-send-btn:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n\n.mda-agent-body {\n  gap: 12px;\n}\n\n.mda-agent-thread {\n  display: grid;\n  gap: 10px;\n}\n\n.mda-agent-message {\n  display: grid;\n  grid-template-columns: 42px minmax(0, 1fr);\n  gap: 10px;\n  align-items: start;\n  padding: 10px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #ffffff;\n}\n\n.mda-agent-avatar {\n  width: 34px;\n  height: 24px;\n  border-radius: 6px;\n  background: #111827;\n  color: #ffffff;\n  text-align: center;\n  font-size: 12px;\n  font-weight: 700;\n  line-height: 24px;\n}\n\n.mda-agent-content {\n  display: grid;\n  gap: 7px;\n  min-width: 0;\n}\n\n.mda-agent-title {\n  color: #111827;\n  font-size: 13px;\n  font-weight: 750;\n}\n\n.mda-agent-text {\n  color: #4b5563;\n  font-size: 12px;\n}\n\n.mda-agent-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n\n.mda-section {\n  display: grid;\n  gap: 10px;\n  padding: 12px;\n  border: 1px solid #d8dee6;\n  border-radius: 8px;\n  background: #ffffff;\n}\n\n.mda-section-head {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.mda-section-title {\n  font-size: 13px;\n  font-weight: 700;\n  color: #111827;\n}\n\n.mda-section-desc {\n  margin-top: 2px;\n  color: #6b7280;\n  font-size: 12px;\n}\n\n.mda-toolbar,\n.mda-copy-grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 8px;\n}\n\n.mda-btn {\n  min-width: 0;\n  height: 32px;\n  padding: 0 10px;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  background: #ffffff;\n  color: #263241;\n  cursor: pointer;\n  font-family: inherit;\n  font-size: 12px;\n  font-weight: 650;\n  line-height: 30px;\n  white-space: nowrap;\n}\n\n.mda-btn:hover {\n  background: #f1f5f9;\n}\n\n.mda-btn:disabled {\n  opacity: 0.48;\n  cursor: not-allowed;\n}\n\n.mda-btn-primary {\n  background: #2563eb;\n  border-color: #2563eb;\n  color: #ffffff;\n}\n\n.mda-btn-primary:hover {\n  background: #1d4ed8;\n}\n\n.mda-dot {\n  flex: 0 0 auto;\n  width: 8px;\n  height: 8px;\n  margin-top: 5px;\n  border-radius: 99px;\n  background: #9ca3af;\n}\n\n.mda-dot.is-active {\n  background: #16a34a;\n  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.14);\n}\n\n.mda-file-input {\n  display: none;\n}\n\n.mda-empty {\n  min-height: 48px;\n  padding: 10px;\n  border: 1px dashed #cfd7e2;\n  border-radius: 6px;\n  color: #6b7280;\n  background: #f8fafc;\n  font-size: 12px;\n}\n\n.mda-project {\n  display: grid;\n  gap: 6px;\n}\n\n.mda-project-name {\n  font-weight: 700;\n  color: #111827;\n}\n\n.mda-project-meta {\n  color: #5b6573;\n  font-size: 12px;\n}\n\n.mda-project-path {\n  padding: 7px 8px;\n  border-radius: 6px;\n  background: #f1f5f9;\n  color: #334155;\n  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  word-break: break-all;\n}\n\n.mda-warning {\n  padding: 8px 10px;\n  border: 1px solid #f4c27a;\n  border-radius: 6px;\n  background: #fff7ed;\n  color: #9a3412;\n  font-size: 12px;\n}\n\n.mda-request-summary {\n  color: #5b6573;\n  font-size: 12px;\n}\n\n.mda-search-input {\n  width: 100%;\n  min-height: 58px;\n  resize: vertical;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  padding: 7px 8px;\n  background: #ffffff;\n  color: #111827;\n  outline: none;\n  font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-search-input:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);\n}\n\n.mda-check-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: #4b5563;\n  font-size: 12px;\n}\n\n.mda-check-row input {\n  width: 14px;\n  height: 14px;\n  margin: 0;\n}\n\n.mda-candidate-list {\n  display: grid;\n  gap: 8px;\n}\n\n.mda-candidate-card {\n  display: grid;\n  gap: 8px;\n  padding: 10px;\n  border: 1px solid #dbe3ee;\n  border-radius: 8px;\n  background: #fbfdff;\n}\n\n.mda-candidate-card.is-selected {\n  border-color: #2563eb;\n  background: #eff6ff;\n}\n\n.mda-candidate-head {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 8px;\n  align-items: center;\n}\n\n.mda-candidate-check {\n  display: grid;\n  grid-template-columns: 16px minmax(0, 1fr);\n  gap: 7px;\n  align-items: center;\n  min-width: 0;\n}\n\n.mda-candidate-check input {\n  width: 14px;\n  height: 14px;\n  margin: 0;\n}\n\n.mda-candidate-head strong {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: #111827;\n  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-candidate-head span {\n  height: 22px;\n  min-width: 34px;\n  padding: 0 8px;\n  border-radius: 999px;\n  background: #dbeafe;\n  color: #1d4ed8;\n  text-align: center;\n  font: 12px/22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-candidate-reasons {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.mda-candidate-stage {\n  color: #64748b;\n  font-size: 12px;\n}\n\n.mda-candidate-reasons span {\n  max-width: 100%;\n  padding: 3px 6px;\n  border-radius: 999px;\n  background: #eef2f6;\n  color: #394454;\n  font-size: 11px;\n  line-height: 1.35;\n}\n\n.mda-candidate-snippet,\n.mda-candidate-log {\n  max-height: 150px;\n  margin: 0;\n  padding: 8px;\n  overflow: auto;\n  border-radius: 6px;\n  background: #0f172a;\n  color: #e5edf7;\n  font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  white-space: pre-wrap;\n}\n\n.mda-log-flow {\n  display: grid;\n  gap: 8px;\n  color: #475467;\n  font-size: 12px;\n}\n\n.mda-log-flow summary {\n  width: max-content;\n  cursor: pointer;\n  color: #344054;\n  font-weight: 650;\n  list-style-position: inside;\n}\n\n.mda-log-flow ol {\n  display: grid;\n  gap: 5px;\n  margin: 0;\n  padding: 8px 8px 8px 24px;\n  border: 1px solid #e4e7ec;\n  border-radius: 10px;\n  background: #f9fafb;\n}\n\n.mda-log-flow li {\n  padding-left: 2px;\n  word-break: break-word;\n}\n\n.mda-log-flow li.is-candidate-log {\n  display: flex;\n  gap: 4px;\n  align-items: baseline;\n  min-width: 0;\n  margin-left: -4px;\n  padding: 5px 6px;\n  border: 1px solid #bfdbfe;\n  border-radius: 7px;\n  background: #eff6ff;\n  color: #1e3a8a;\n  font-weight: 650;\n}\n\n.mda-log-file-link {\n  min-width: 0;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: #2563eb;\n  cursor: pointer;\n  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  text-align: left;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-log-file-link:hover {\n  color: #1d4ed8;\n  text-decoration: underline;\n}\n\n.mda-link-btn {\n  justify-self: start;\n  height: 24px;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  color: #2563eb;\n  cursor: pointer;\n  font: 12px/24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-link-btn:hover {\n  color: #1d4ed8;\n  text-decoration: underline;\n}\n\n.mda-tags {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.mda-tag {\n  max-width: 180px;\n  height: 24px;\n  padding: 0 8px;\n  border-radius: 999px;\n  background: #eef2f6;\n  color: #394454;\n  font: 12px/24px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-info {\n  border: 1px solid #e2e8f0;\n  border-radius: 6px;\n  overflow: hidden;\n}\n\n.mda-row {\n  display: grid;\n  grid-template-columns: 64px minmax(0, 1fr);\n  gap: 10px;\n  padding: 8px 10px;\n  border-bottom: 1px solid #e2e8f0;\n}\n\n.mda-row:last-child {\n  border-bottom: 0;\n}\n\n.mda-row span {\n  color: #6b7280;\n  font-size: 12px;\n}\n\n.mda-row strong {\n  min-width: 0;\n  color: #1f2937;\n  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-selection-list {\n  display: grid;\n  gap: 8px;\n}\n\n.mda-selection-card {\n  display: grid;\n  gap: 8px;\n  padding: 10px;\n  border: 1px solid #dbe3ee;\n  border-radius: 8px;\n  background: #fbfdff;\n}\n\n.mda-selection-card:hover {\n  border-color: #9db8f8;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);\n}\n\n.mda-selection-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.mda-selection-title {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 12px;\n  font-weight: 700;\n  color: #111827;\n}\n\n.mda-inline-badge {\n  height: 18px;\n  padding: 0 6px;\n  border-radius: 999px;\n  background: #dcfce7;\n  color: #166534;\n  font: 11px/18px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-mini-btn {\n  height: 24px;\n  padding: 0 8px;\n  border: 1px solid #cfd7e2;\n  border-radius: 5px;\n  background: #ffffff;\n  color: #4b5563;\n  cursor: pointer;\n  font-family: inherit;\n  font-size: 12px;\n  line-height: 22px;\n}\n\n.mda-mini-btn:hover {\n  background: #f1f5f9;\n  color: #111827;\n}\n\n.mda-selection-meta {\n  display: grid;\n  grid-template-columns: 54px minmax(0, 1fr);\n  gap: 8px;\n  color: #5b6573;\n  font-size: 12px;\n}\n\n.mda-selection-meta span {\n  font-weight: 700;\n}\n\n.mda-selection-meta strong {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  color: #1f2937;\n  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n}\n\n.mda-selection-text {\n  max-height: 44px;\n  overflow: auto;\n  color: #4b5563;\n  font-size: 12px;\n}\n\n.mda-note {\n  min-height: 74px;\n  resize: vertical;\n}\n\n.mda-textarea,\n.mda-prompt {\n  width: 100%;\n  min-width: 0;\n  resize: vertical;\n  border: 1px solid #cfd7e2;\n  border-radius: 6px;\n  padding: 9px 10px;\n  background: #ffffff;\n  color: #111827;\n  outline: none;\n  font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-textarea:focus,\n.mda-prompt:focus {\n  border-color: #2563eb;\n  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);\n}\n\n.mda-prompt {\n  min-height: 230px;\n  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  font-size: 12px;\n}\n\n.mda-toast {\n  min-height: 18px;\n  color: #047857;\n  font-size: 12px;\n  overflow: hidden;\n}\n\n/* Codex-like chat surface overrides. */\n.mda-panel {\n  width: 440px;\n  max-width: min(440px, calc(100vw - 18px));\n  background: #ffffff;\n  border-left-color: #e5e7eb;\n  box-shadow: -12px 0 28px rgba(15, 23, 42, 0.14);\n}\n\n.mda-head {\n  height: 52px;\n  padding: 0 12px 0 16px;\n  border-bottom-color: #eceff3;\n  background: #ffffff;\n}\n\n.mda-title {\n  font-size: 13px;\n  font-weight: 680;\n}\n\n.mda-subtitle {\n  max-width: 306px;\n  color: #667085;\n}\n\n.mda-chat-body {\n  background: #ffffff;\n}\n\n.mda-chat-thread {\n  gap: 14px;\n  padding: 16px 14px 18px;\n  background: #ffffff;\n}\n\n.mda-chat-message,\n.mda-chat-message.is-user {\n  display: flex;\n  gap: 9px;\n  align-items: flex-start;\n}\n\n.mda-chat-message.is-user {\n  justify-content: flex-end;\n}\n\n.mda-message-avatar {\n  flex: 0 0 auto;\n  width: auto;\n  min-width: 34px;\n  height: 22px;\n  padding: 0 7px;\n  border-radius: 999px;\n  background: #f2f4f7;\n  color: #344054;\n  font-size: 11px;\n  font-weight: 650;\n  line-height: 22px;\n}\n\n.mda-chat-message.is-user .mda-message-avatar {\n  display: none;\n}\n\n.mda-message-bubble {\n  gap: 6px;\n  max-width: 100%;\n  padding: 0;\n  border: 0;\n  border-radius: 0;\n  background: transparent;\n}\n\n.mda-chat-message.is-agent .mda-message-bubble {\n  display: grid;\n  gap: 8px;\n  padding: 10px 11px;\n  border: 1px solid #99f6e4;\n  border-radius: 12px;\n  background: #f0fdfa;\n}\n\n.mda-chat-message.is-user .mda-message-bubble {\n  max-width: 86%;\n  padding: 9px 11px;\n  border: 1px solid #e5e7eb;\n  border-radius: 14px;\n  background: #f6f7f9;\n}\n\n.mda-message-title {\n  color: #101828;\n  font-size: 13px;\n  font-weight: 680;\n}\n\n.mda-message-text {\n  color: #344054;\n  font-size: 12px;\n  line-height: 1.55;\n}\n\n.mda-message-pre {\n  max-height: 320px;\n  border: 1px solid #e4e7ec;\n  border-radius: 10px;\n  background: #101828;\n  color: #f2f4f7;\n}\n\n.mda-composer-wrap {\n  gap: 10px;\n  padding: 12px;\n  border-top-color: #eceff3;\n  background: #ffffff;\n}\n\n.mda-composer-options {\n  gap: 8px;\n  padding: 10px;\n  border-color: #e4e7ec;\n  border-radius: 12px;\n  background: #f9fafb;\n}\n\n.mda-collapsible-head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  min-width: 0;\n}\n\n.mda-collapse-btn {\n  flex: 0 0 auto;\n  height: 24px;\n  padding: 0 8px;\n  border: 1px solid #d0d5dd;\n  border-radius: 7px;\n  background: #ffffff;\n  color: #344054;\n  cursor: pointer;\n  font: 12px/22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-collapse-btn:hover {\n  background: #f2f4f7;\n  color: #101828;\n}\n\n.mda-collapsed-summary {\n  min-width: 0;\n  overflow: hidden;\n  color: #667085;\n  font-size: 12px;\n  line-height: 1.45;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-composer-options.is-compact {\n  padding: 0 2px;\n}\n\n.mda-choice-list {\n  gap: 8px;\n  max-height: 260px;\n}\n\n.mda-choice-card {\n  gap: 6px;\n  padding: 9px;\n  border-color: #e4e7ec;\n  border-radius: 10px;\n  background: #ffffff;\n}\n\n.mda-choice-card.is-selected {\n  border-color: #98a2b3;\n  background: #f2f4f7;\n}\n\n.mda-choice-check {\n  color: #101828;\n}\n\n.mda-choice-meta {\n  color: #667085;\n}\n\n.mda-composer {\n  gap: 9px;\n  align-items: end;\n  padding: 9px;\n  border: 1px solid #d0d5dd;\n  border-radius: 16px;\n  background: #ffffff;\n  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);\n}\n\n.mda-composer-input {\n  height: 34px;\n  border: 0;\n  border-radius: 0;\n  padding: 0 2px;\n  background: transparent;\n  color: #101828;\n  font-size: 13px;\n  line-height: 34px;\n}\n\n.mda-composer-input:not([readonly]) {\n  cursor: text;\n}\n\n.mda-send-btn {\n  width: 58px;\n  height: 34px;\n  padding: 0;\n  border-color: #101828;\n  border-radius: 11px;\n  background: #101828;\n  font-weight: 650;\n}\n\n.mda-send-btn:not(:disabled):hover {\n  background: #1d2939;\n}\n\n.mda-btn-primary {\n  border-color: #101828;\n  background: #101828;\n}\n\n.mda-btn-primary:hover {\n  background: #1d2939;\n}\n\n.mda-link-btn {\n  color: #344054;\n}\n\n.mda-link-btn:hover {\n  color: #101828;\n}\n\n.mda-model-editor {\n  border-color: #e4e7ec;\n  border-radius: 14px;\n  background: #ffffff;\n  box-shadow: 0 12px 32px rgba(16, 24, 40, 0.1);\n}\n\n.mda-model-actions {\n  justify-content: flex-end;\n}\n\n.mda-model-actions .mda-mini-btn {\n  margin-right: auto;\n}\n\n.mda-composer-prebar {\n  display: flex;\n  align-items: center;\n  justify-content: flex-start;\n  min-height: 28px;\n  padding: 0 6px;\n}\n\n.mda-composer {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  gap: 6px;\n  align-items: stretch;\n  padding: 10px 12px;\n  border: 1px solid #d9dee7;\n  border-radius: 20px;\n  background: #ffffff;\n  box-shadow: 0 2px 10px rgba(16, 24, 40, 0.08);\n}\n\n.mda-composer-input {\n  height: 36px;\n  min-height: 36px;\n  border: 0;\n  border-radius: 0;\n  padding: 0 2px;\n  background: transparent;\n  color: #101828;\n  font-size: 14px;\n  line-height: 36px;\n}\n\n.mda-composer-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  min-width: 0;\n}\n\n.mda-toolbar-left,\n.mda-toolbar-right {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-width: 0;\n}\n\n.mda-toolbar-left {\n  flex: 1 1 auto;\n}\n\n.mda-toolbar-right {\n  flex: 0 0 auto;\n}\n\n.mda-tool-icon-btn,\n.mda-send-btn {\n  flex: 0 0 auto;\n}\n\n.mda-tool-icon-btn {\n  position: relative;\n  width: 28px;\n  height: 28px;\n  border: 0;\n  border-radius: 999px;\n  background: transparent;\n  color: #667085;\n  cursor: pointer;\n}\n\n.mda-tool-icon-btn::before,\n.mda-tool-icon-btn::after {\n  content: "";\n  position: absolute;\n  left: 8px;\n  right: 8px;\n  top: 14px;\n  height: 2px;\n  border-radius: 999px;\n  background: currentColor;\n}\n\n.mda-tool-icon-btn::after {\n  transform: rotate(90deg);\n}\n\n.mda-tool-icon-btn:hover {\n  background: #f2f4f7;\n  color: #101828;\n}\n\n.mda-tool-icon-btn:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n\n.mda-assist-chip,\n.mda-inline-text-btn,\n.mda-model-trigger {\n  height: 28px;\n  border: 0;\n  background: transparent;\n  color: #344054;\n  font: 12px/28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n}\n\n.mda-assist-chip {\n  display: inline-flex;\n  align-items: center;\n  gap: 7px;\n  padding: 0 4px;\n  color: #344054;\n  cursor: pointer;\n}\n\n.mda-assist-chip.is-active {\n  color: #1d87f5;\n}\n\n.mda-assist-chip:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n\n.mda-chip-shield {\n  position: relative;\n  width: 18px;\n  height: 18px;\n  border: 1.5px solid currentColor;\n  border-radius: 7px 7px 8px 8px;\n}\n\n.mda-chip-shield::before {\n  content: "";\n  position: absolute;\n  left: 5px;\n  top: 4px;\n  width: 5px;\n  height: 8px;\n  border-right: 1.5px solid currentColor;\n  border-bottom: 1.5px solid currentColor;\n  transform: rotate(38deg);\n}\n\n.mda-inline-text-btn {\n  max-width: 90px;\n  padding: 0;\n  cursor: pointer;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-inline-text-btn:hover {\n  color: #101828;\n}\n\n.mda-model-menu {\n  position: relative;\n  flex: 0 0 auto;\n}\n\n.mda-model-trigger {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  max-width: 160px;\n  min-width: 0;\n  padding: 0 2px;\n  color: #101828;\n  cursor: pointer;\n}\n\n.mda-model-trigger.is-active {\n  color: #1d4ed8;\n}\n\n.mda-model-trigger:disabled {\n  opacity: 0.55;\n  cursor: not-allowed;\n}\n\n.mda-model-trigger strong,\n.mda-model-trigger em {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-model-trigger strong {\n  font-size: 12px;\n  font-weight: 650;\n}\n\n.mda-model-trigger em {\n  color: #667085;\n  font-style: normal;\n  font-weight: 650;\n}\n\n.mda-model-trigger i {\n  width: 9px;\n  height: 9px;\n  border-right: 2px solid #667085;\n  border-bottom: 2px solid #667085;\n  transform: rotate(45deg) translateY(-2px);\n}\n\n.mda-model-dropdown {\n  position: absolute;\n  right: -8px;\n  bottom: calc(100% + 10px);\n  z-index: 40;\n  display: grid;\n  gap: 4px;\n  width: 220px;\n  padding: 10px;\n  border: 1px solid #e4e7ec;\n  border-radius: 18px;\n  background: rgba(255, 255, 255, 0.98);\n  box-shadow: 0 16px 40px rgba(16, 24, 40, 0.16);\n  backdrop-filter: blur(12px);\n}\n\n.mda-model-option {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  min-width: 0;\n  min-height: 34px;\n  padding: 0 10px;\n  border: 0;\n  border-radius: 12px;\n  background: transparent;\n  color: #101828;\n  cursor: pointer;\n  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;\n  text-align: left;\n}\n\n.mda-model-option:hover,\n.mda-model-option.is-selected {\n  background: #f5f7fb;\n}\n\n.mda-model-option.is-selected::after {\n  content: "";\n  flex: 0 0 auto;\n  width: 6px;\n  height: 10px;\n  margin-left: 4px;\n  border-right: 2px solid #111827;\n  border-bottom: 2px solid #111827;\n  transform: rotate(45deg);\n}\n\n.mda-model-option span,\n.mda-model-option em {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.mda-model-option span {\n  font-size: 12px;\n  font-weight: 650;\n}\n\n.mda-model-option em {\n  color: #667085;\n  font-style: normal;\n}\n\n.mda-model-divider {\n  height: 1px;\n  margin: 4px 2px;\n  background: #eceff3;\n}\n\n.mda-send-btn {\n  position: relative;\n  display: grid;\n  place-items: center;\n  width: 34px;\n  height: 34px;\n  padding: 0;\n  border: 0;\n  border-radius: 999px;\n  background: #161b22;\n  color: #ffffff;\n  cursor: pointer;\n  font-size: 12px;\n  font-weight: 700;\n}\n\n.mda-send-arrow {\n  position: relative;\n  width: 16px;\n  height: 16px;\n}\n\n.mda-send-arrow::before {\n  content: "";\n  position: absolute;\n  left: 7px;\n  top: 3px;\n  width: 2px;\n  height: 12px;\n  border-radius: 999px;\n  background: #ffffff;\n}\n\n.mda-send-arrow::after {\n  content: "";\n  position: absolute;\n  left: 3px;\n  top: 2px;\n  width: 8px;\n  height: 8px;\n  border-top: 2px solid #ffffff;\n  border-left: 2px solid #ffffff;\n  transform: rotate(45deg);\n}\n\n.mda-send-btn:not(:disabled):hover {\n  background: #1f2937;\n}\n\n.mda-send-btn:disabled {\n  opacity: 0.45;\n  cursor: not-allowed;\n}\n\n@media (max-width: 460px) {\n  .mda-composer-toolbar {\n    align-items: stretch;\n    flex-direction: column;\n  }\n\n  .mda-toolbar-left,\n  .mda-toolbar-right {\n    width: 100%;\n    justify-content: space-between;\n  }\n\n  .mda-model-trigger {\n    max-width: 140px;\n  }\n\n  .mda-model-dropdown {\n    right: 0;\n    width: min(220px, calc(100vw - 40px));\n  }\n}\n\n.mda-floating-note {\n  border-color: #d0d5dd;\n  border-radius: 12px;\n  box-shadow: 0 18px 44px rgba(16, 24, 40, 0.22);\n}\n\n.mda-floating-textarea {\n  border-color: #d0d5dd;\n  border-radius: 9px;\n}\n\n.mda-floating-textarea:focus {\n  border-color: #101828;\n  box-shadow: 0 0 0 3px rgba(16, 24, 40, 0.1);\n}\n\n.mda-overlay {\n  position: fixed;\n  z-index: 2147483644;\n  box-sizing: border-box;\n  border: 2px solid #2563eb;\n  background: rgba(37, 99, 235, 0.12);\n  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8), 0 0 0 99999px rgba(15, 23, 42, 0.05);\n  pointer-events: none;\n}\n\n.mda-overlay.is-selected {\n  border-color: #16a34a;\n  background: rgba(22, 163, 74, 0.14);\n}\n\n.mda-badge {\n  position: fixed;\n  z-index: 2147483646;\n  max-width: calc(100vw - 16px);\n  height: 22px;\n  padding: 0 8px;\n  border-radius: 5px;\n  background: #111827;\n  color: #ffffff;\n  font: 12px/22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);\n  pointer-events: none;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.mda-panel.is-collapsed {\n  width: 54px;\n  box-shadow: -8px 0 18px rgba(17, 24, 39, 0.14);\n}\n\n.mda-panel.is-collapsed .mda-body,\n.mda-panel.is-collapsed .mda-head-main {\n  display: none;\n}\n\n.mda-panel.is-collapsed .mda-head {\n  height: 100%;\n  padding: 8px 0;\n  justify-content: flex-start;\n}\n\n.mda-panel.is-collapsed .mda-actions {\n  width: 100%;\n  flex-direction: column;\n}\n\n@keyframes mda-slide-in {\n  from {\n    transform: translateX(100%);\n  }\n\n  to {\n    transform: translateX(0);\n  }\n}\n';
  (function bootstrapDevAssistant() {
    const APP_KEY = "__MAGNUS_DEV_ASSISTANT__";
    const LEGACY_APP_KEY = "__MAGNUS_ELEMENT_INSPECTOR__";
    const HOST_ID = "magnus-dev-assistant-root";
    const oldApp = window[APP_KEY];
    const legacyApp = window[LEGACY_APP_KEY];
    if (oldApp && typeof oldApp.destroy === "function") {
      oldApp.destroy();
    }
    if (legacyApp && legacyApp !== oldApp && typeof legacyApp.destroy === "function") {
      legacyApp.destroy();
      window[LEGACY_APP_KEY] = null;
    }
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "pointer-events:none",
      "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif"
    ].join(";");
    const shadowRoot = host.attachShadow({ mode: "open" });
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    const mountEl = document.createElement("div");
    shadowRoot.appendChild(styleEl);
    shadowRoot.appendChild(mountEl);
    (document.documentElement || document.body).appendChild(host);
    const api = {
      host,
      shadowRoot,
      app: null,
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
        if (host.parentNode) host.parentNode.removeChild(host);
        if (window[APP_KEY] === api) {
          window[APP_KEY] = null;
        }
      }
    };
    const app = createApp(_sfc_main, { api });
    api.app = app;
    window[APP_KEY] = api;
    app.mount(mountEl);
  })();
})();

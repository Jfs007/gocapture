'use strict';

class AgentRegistry {
  constructor(adapters = []) {
    this.adapters = new Map();
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter) {
    const id = String(adapter?.id || adapter?.manifest?.id || '').trim();
    if (!id) throw new Error('注册 Agent 时缺少 adapter id');
    if (this.adapters.has(id)) throw new Error(`Agent 已注册：${id}`);
    this.adapters.set(id, adapter);
    return adapter;
  }

  require(id) {
    const key = String(id || '').trim();
    const adapter = this.adapters.get(key);
    if (!adapter) throw new Error(`不支持的 Agent 连接：${key || '-'}`);
    return adapter;
  }

  values() {
    return [...this.adapters.values()];
  }

  close() {
    for (const adapter of this.adapters.values()) adapter.close?.();
  }
}

module.exports = {
  AgentRegistry,
};

'use strict';

const EMPTY_THREAD_GROUPS = Object.freeze({
  project: [],
  recent: [],
  projectlessStateAvailable: false,
});

class AgentAdapter {
  constructor(manifest) {
    this.manifest = normalizeManifest(manifest);
  }

  get id() {
    return this.manifest.id;
  }

  get capabilities() {
    return this.manifest.capabilities;
  }

  configureProject() {}

  supports(capability) {
    return !!this.capabilities[capability];
  }

  requireCapability(capability, action) {
    if (!this.supports(capability)) {
      throw new Error(`${this.manifest.name} 不支持${action || capability}`);
    }
  }

  publicStatus(status = {}) {
    return {
      id: this.manifest.id,
      name: this.manifest.name,
      category: 'connection',
      capabilities: { ...this.capabilities },
      modelProtocols: [...this.manifest.modelProtocols],
      modelBackends: [...this.manifest.modelBackends],
      supportsThreadBinding: this.supports('threadBinding'),
      requiresThreadBinding: this.supports('requiresThreadBinding'),
      supportsRuntimeConfig: this.supports('modelBackendConfiguration'),
      supportsProxy: this.supports('proxy'),
      ...status,
    };
  }

  async listBindableThreads() {
    this.requireCapability('threadBinding', '绑定已有任务');
    return { ...EMPTY_THREAD_GROUPS };
  }

  async readThread() {
    this.requireCapability('threadBinding', '读取已有任务');
  }

  async respondToInteraction() {
    this.requireCapability('humanInTheLoop', '处理用户交互');
  }
}

function normalizeManifest(raw) {
  const id = String(raw?.id || '').trim();
  const name = String(raw?.name || '').trim();
  if (!id || !name) throw new Error('AgentAdapter manifest 必须包含 id 和 name');
  const capabilities = {
    proxy: false,
    threadBinding: false,
    requiresThreadBinding: false,
    modelBackendConfiguration: false,
    humanInTheLoop: false,
    ...(raw?.capabilities || {}),
  };
  if (capabilities.requiresThreadBinding) capabilities.threadBinding = true;
  return Object.freeze({
    id,
    name,
    capabilities: Object.freeze(capabilities),
    modelProtocols: Object.freeze(uniqueStrings(raw?.modelProtocols)),
    modelBackends: Object.freeze(uniqueStrings(raw?.modelBackends)),
  });
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean))];
}

module.exports = {
  AgentAdapter,
  EMPTY_THREAD_GROUPS,
  normalizeManifest,
};

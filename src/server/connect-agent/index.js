'use strict';

const { CodexAppServerClient } = require('./providers/codex/app-server-client');
const { ClaudeCodeClient } = require('./providers/claude/claude-client');
const { buildConnectAgentTaskPrompt } = require('./task-prompt');

function createConnectAgentService() {
  const providers = new Map([
    ['codex', new CodexAppServerClient()],
    ['claude', new ClaudeCodeClient()],
  ]);

  function requireProvider(providerId) {
    const provider = providers.get(String(providerId || ''));
    if (!provider) throw new Error(`不支持的 Agent 连接：${providerId || '-'}`);
    return provider;
  }

  return {
    async list({ refresh = false } = {}) {
      if (refresh) {
        await Promise.all([...providers.values()].map(provider => provider.inspect()));
      }
      return [...providers.values()].map(provider => provider.status());
    },
    async inspect(providerId) {
      return requireProvider(providerId).inspect();
    },
    async connect(providerId, options = {}) {
      return requireProvider(providerId).connect(options);
    },
    disconnect(providerId) {
      return requireProvider(providerId).disconnect();
    },
    async runTask(providerId, input) {
      const provider = requireProvider(providerId);
      return provider.runTask({
        taskId: input.taskId,
        cwd: input.project.path,
        prompt: buildConnectAgentTaskPrompt(input),
        onEvent: input.onEvent,
        signal: input.signal,
      });
    },
    close() {
      for (const provider of providers.values()) provider.close();
    },
  };
}

module.exports = {
  createConnectAgentService,
};

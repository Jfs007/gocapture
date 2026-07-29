'use strict';

const { AgentRegistry } = require('../core/agent-registry');
const { ClaudeAgentSdkClient } = require('./claude/agent-sdk-client');
const { CodexAppServerClient } = require('./codex/app-server-client');

function createDefaultAgentRegistry() {
  return new AgentRegistry([
    new CodexAppServerClient(),
    new ClaudeAgentSdkClient(),
  ]);
}

module.exports = {
  createDefaultAgentRegistry,
};

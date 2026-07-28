'use strict';

const { AgentRegistry } = require('../core/agent-registry');
const { ClaudeCodeClient } = require('./claude/claude-client');
const { CodexAppServerClient } = require('./codex/app-server-client');

function createDefaultAgentRegistry() {
  return new AgentRegistry([
    new CodexAppServerClient(),
    new ClaudeCodeClient(),
  ]);
}

module.exports = {
  createDefaultAgentRegistry,
};

'use strict';

const { runModelTask } = require('../model/model-adapters');

async function runAgentLlmTask(adapter, prompt, project, options = {}) {
  return runModelTask(adapter, prompt, project.path, {
    signal: options.signal,
    stage: options.stage,
    rawPrompt: true,
    systemPrompt: options.systemPrompt || '你是 Magnus Agent Host 中的 LLM，只能按当前工具协议返回结果。',
    temperature: options.temperature,
    onLog: options.onLog,
  });
}

module.exports = {
  runAgentLlmTask,
};

'use strict';

const { enhanceLocatedPrompt } = require('../../experience/prompt-enhancer');
const { runAgentLlmTask } = require('../llm-adapter');
const { createToolProvider } = require('./provider');
const { buildTool } = require('./tool');

const EXPERIENCE_TOOLS = [
  buildTool({
    name: 'enhance_with_experience',
    title: 'Enhance With Experience',
    description: 'Use project Experience, task memory, and located source files to produce an executable change plan.',
    category: 'experience',
    access: 'model',
    isReadOnly: () => true,
    isConcurrencySafe: () => false,
    inputSchema: {
      type: 'object',
      properties: {
        adapter: { type: 'object' },
        body: { type: 'object' },
        modelItems: { type: 'array', items: { type: 'object' } },
      },
      required: ['adapter', 'body', 'modelItems'],
    },
    async call({ project, input, textCache = new Map() }) {
    if (!input?.adapter) throw new Error('enhance_with_experience requires adapter.');
    if (!Array.isArray(input?.modelItems)) throw new Error('enhance_with_experience requires modelItems.');
    const registry = require('./registry'); // 调用时懒加载：agent-host 内部 registry 与被注册工具的自然回引（非跨层环）
    return enhanceLocatedPrompt({
      project,
      body: input.body || {},
      modelItems: input.modelItems,
      textCache,
      log: () => {},
      toolRuntime: { listTools: registry.listAgentTools, executeTool: registry.executeAgentTool },
      invoke: async (stage, prompt) => {
        const result = await runAgentLlmTask(input.adapter, prompt, project, {
          signal: input.signal,
          stage,
          systemPrompt: '你是 Magnus 项目经验发现与需求增强 agent。严格按用户提示的 JSON 协议返回，不执行代码修改。',
        });
        return result.rawText;
      },
    });
    },
  }),
];

const experienceToolProvider = createToolProvider({
  id: 'builtin.experience',
  title: 'Experience Tools',
  source: 'builtin',
  description: 'Project Experience based prompt enhancement and reusable implementation guidance tools.',
  tools: EXPERIENCE_TOOLS,
});

module.exports = {
  experienceToolProvider,
};

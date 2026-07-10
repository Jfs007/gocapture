'use strict';

// 把加载到的 Skills 暴露成一个 ToolProvider（builtin.skills），走同一扩展点。
// 每个 skill = 一个工具 `skill__<name>`：描述里放 skill 的用途（模型可见/可决策），
// 调用它返回该 skill 的指令正文 + 允许使用的工具集，模型据此展开执行（渐进披露）。

const { createToolProvider } = require('../tools/provider');
const { buildTool } = require('../tools/tool');

function buildSkillsProvider(skills) {
  return createToolProvider({
    id: 'builtin.skills',
    title: 'Skills',
    source: 'skill',
    description: '项目/用户定义的 Skills（SKILL.md）。调用 skill__<name> 加载其指令后再展开执行。',
    tools: (skills || []).map(skill => buildTool({
      name: `skill__${skill.name}`,
      title: skill.name,
      description: skill.description || `Skill: ${skill.name}`,
      category: 'skill',
      access: 'read',
      inputSchema: { type: 'object', properties: {} },
      isReadOnly: () => true,
      isConcurrencySafe: () => true,
      call: async () => ({
        skill: skill.name,
        source: skill.source,
        allowedTools: skill.allowedTools,
        instructions: skill.body,
      }),
    })),
  });
}

module.exports = {
  buildSkillsProvider,
};

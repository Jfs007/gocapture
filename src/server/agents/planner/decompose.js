'use strict';

// 规划前置节点：一次 toolless 的结构化调用，把需求拆成若干相对独立的子改动，并简述各已定位文件的作用（角色卡）。
// 这是 planner「拆解→组合」里的“拆解”阶段——用结构(独立节点+schema)承载，而不是塞进主 prompt 的散文。
// 失败/无结构化输出时返回 null，planner 照常无拆解规划，绝不因此中断。
const { runAgentTask } = require('../../agent-host/llm-adapter');
const { loadLangChainRuntime } = require('../../agent-host/langchain/runtime');

const DECOMPOSE_PREVIEW_CHARS = 600;

function decompositionSchema() {
  const { z } = loadLangChainRuntime();
  return z.object({
    subtasks: z.array(z.object({
      summary: z.string().describe('一个相对独立的子改动，一句话。'),
      likelyFile: z.string().describe('这个子改动大概落在哪个已定位/已知文件；不确定留空。'),
      needsNewImpl: z.boolean().describe('是否需要新建实现（而非改现有文件）。'),
    })).describe('把需求拆成的若干相对独立子改动（不预设需求形态：新增/修改/删除/重构皆可）。'),
    fileRoles: z.array(z.object({
      file: z.string().describe('已定位文件路径。'),
      whatItDoes: z.string().describe('该文件在选区/需求里的作用。'),
      howToExtend: z.string().describe('若要在此实施改动，大致怎么改。'),
    })).describe('对已定位文件作用的简述（角色卡），供组合阶段直接用，免得重新调查。'),
  }).meta({
    title: 'gocapture_plan_decomposition',
    description: '把需求拆成子改动，并简述已定位文件的作用。只拆解，不写具体计划。',
  });
}

function normalizeDecomposition(parsed) {
  const text = value => (value == null ? '' : String(value).trim());
  const subtasks = (Array.isArray(parsed.subtasks) ? parsed.subtasks : [])
    .map(item => ({
      summary: text(item?.summary),
      likelyFile: text(item?.likelyFile),
      needsNewImpl: Boolean(item?.needsNewImpl),
    }))
    .filter(item => item.summary);
  const fileRoles = (Array.isArray(parsed.fileRoles) ? parsed.fileRoles : [])
    .map(item => ({
      file: text(item?.file),
      whatItDoes: text(item?.whatItDoes),
      howToExtend: text(item?.howToExtend),
    }))
    .filter(item => item.file && (item.whatItDoes || item.howToExtend));
  if (!subtasks.length) return null;
  return { subtasks, fileRoles };
}

async function decomposePlan(project, options = {}) {
  const { input, adapter, langchainModel, log = () => {}, signal } = options;
  const runtime = loadLangChainRuntime();
  if (!runtime.available) return null;
  // 输入只给需求 + 已定位文件的“作用线索”(role + 片段预览)，不给全量源码 —— 拆解要廉价、toolless。
  const brief = {
    requirement: input?.requirement || '',
    locatedFiles: (input?.locatedSources || []).map(source => ({
      file: source.file,
      role: source.role,
      preview: String(source.sourceContent?.content || source.codeSnippet || '').slice(0, DECOMPOSE_PREVIEW_CHARS),
    })),
    referenceFiles: (input?.referenceExamples || []).map(source => source.file),
  };
  try {
    const result = await runAgentTask(project, {
      adapter,
      langchainModel,
      signal,
      stage: 'planning-decompose',
      systemPrompt: [
        '你是规划前置的「需求拆解器」。',
        '基于需求与已定位文件，把需求拆成若干相对独立的子改动，并简述每个已定位文件的作用。',
        '不预设需求形态（新增/修改/删除/重构皆可）。只拆解，不写具体计划，不调用工具。',
      ].join('\n'),
      objective: ['把以下需求拆解成子改动，并给出已定位文件的作用：', JSON.stringify(brief, null, 2)].join('\n\n'),
      responseFormat: decompositionSchema(),
      maxTurns: 1,
    }, { tools: [] });
    const decomposition = result.structuredResponse ? normalizeDecomposition(result.structuredResponse) : null;
    return decomposition;
  } catch (error) {
    log(`Planning Agent 拆解阶段失败（忽略，继续无拆解规划）：${error.message}`);
    return null;
  }
}

module.exports = {
  decomposePlan,
  normalizeDecomposition,
  decompositionSchema,
};

'use strict';

// Locator 的系统提示词 + 目标（objective）构建：职责=定位选区 DOM 的渲染/驱动源码，
// 改动诉求不在本阶段。项目结构从 .magnus/Structure.md 读取，缺失时回退文件路径清单。
const fs = require('fs');
const path = require('path');

const MAX_STRUCTURE_CHARS = 24000;
const MAX_FALLBACK_PATHS = 500;

const LOCATOR_SYSTEM_PROMPT = [
  '你是 DOM Source Locator。',
  '你的唯一职责：定位「当前选区 DOM 由哪些真实源码渲染/驱动」，输出渲染器与其定义/数据来源文件。',
  '只做定位：忽略用户想对该 DOM 做的任何改动，不规划、不实现、不设想新建文件。',
  '你负责理解和推理；本地工具只负责返回真实项目事实。根据每轮工具观察决定下一步，不使用固定流水线，不按本地分数直接选文件。',
  '必须通过 finish_dom_location 结束调查。',
].join('\n');

function readProjectStructure(project) {
  const structurePath = path.join(project.path, '.magnus', 'Structure.md');
  try {
    const text = fs.readFileSync(structurePath, 'utf8').trim();
    if (text) return text.slice(0, MAX_STRUCTURE_CHARS);
  } catch (error) {
  }
  return (project.files || [])
    .slice(0, MAX_FALLBACK_PATHS)
    .map(file => file.path)
    .join('\n');
}

function buildDomLocatorObjective(input = {}) {
  const hasKnowledgeTool = Boolean(input.hasKnowledgeTool);
  const hasSeed = Boolean(input.anchorSeed && input.anchorSeed.candidates.length);
  const rule1 = hasKnowledgeTool && !hasSeed
    ? '1. 当前没有可用锚点候选，先调用 consult_project_knowledge 获取定向线索，再结合用户需求、DOM 结构、页面事实与项目结构选择后续工具调用。'
    : hasKnowledgeTool
      ? '1. 当前已有带真实命中片段的锚点候选，直接从候选验证开始。consult_project_knowledge 是可选工具，只有现有证据无法提出有效验证方向且确实缺少项目知识时才调用，不得把它当固定第一步。'
    : '1. 先理解用户需求、DOM 结构、页面事实和项目结构，再选择当前最可能有效的工具调用。';
  const rule2 = hasKnowledgeTool
    ? '2. 工具结果只是事实，不是结论。命中次数、路径邻近、文件后缀或单个文案都不能直接证明渲染归属；consult_project_knowledge 返回的框架/anchor/Experience 线索同样只是先验，必须用检索或读取工具实测确认后方可写入结论。'
    : '2. 工具结果只是事实，不是结论。命中次数、路径邻近、文件后缀或单个文案都不能直接证明渲染归属。';
  const existingCandidateRule = hasSeed
    ? '8. 选择下一步工具前，先检查锚点交集候选中是否已有文件命中 missingFacts。若存在，必须优先读取这些已有候选；不得跳过它们重新发起全局搜索。只有已有候选和其局部关系都不能验证缺失事实时，才扩大搜索范围。'
    : '8. 选择下一步工具前，先检查当前工具观察中是否已有文件命中 missingFacts。若存在，必须优先读取这些已有候选；不得跳过它们重新发起全局搜索。只有已有候选和其局部关系都不能验证缺失事实时，才扩大搜索范围。';
  return [
    '你的唯一任务：定位「当前选区 DOM 由哪些真实源码渲染/驱动」。调查范围与结束位置由「选区 DOM」本身决定，而不是用户想对它做的改动。',
    '',
    '调查方式：',
    rule1,
    rule2,
    '3. 完成判据只有一条：选区 DOM（其可见文字、结构、业务 class、链接）由哪个文件渲染、由哪个定义/数据源驱动，且已被真实源码证据证实。只做定位，忽略用户想对它做的任何改动；禁止为「如何实现某改动」去调查、规划或设想新建文件，也不得据此扩大任务范围。',
    '4. 每次继续调查前，先明确唯一的 missingFact 并判断其结果是否可能改变目标文件、代码范围或最终结论；不会改变就停止调查。只查完成判据必需的事实、用范围最小的方式验证，不得默认追求完整的 DOM 来源、文件关系、内部实现或调用链。',
    '5. 如果完成判据已经满足，且剩余未知信息不会影响当前任务，必须立即提交 resolved。',
    '6. 每次读取候选后，必须先在推理中形成候选审查：coverage=complete|partial|mismatch|unknown；candidateRole=target|container|inner|peer|source|unknown；并列出 explainedFacts、missingFacts 和 nextDirection。角色与覆盖关系只能由你根据真实证据判断，本地分数不负责该判断。',
    '7. partial 不等于候选错误。若候选只解释内部事实，下一步验证承载缺失外层事实的候选或关系；若只解释外层事实，下一步验证承载缺失内部事实的候选或关系；若只是相似结构但关键事实不一致，才按 peer 处理；若只提供内容或配置，验证其消费者。',
    existingCandidateRule,
    '9. 如果遇到间接关系且完成判据依赖该关系，使用工具读取实际源码证据；不要凭框架惯例补全。',
    '10. 如果现有 DOM 无法提出有价值的下一步验证，提交 need-more-context 并申请扩区。',
    '11. 不编造文件、符号、代码、关系或行号。',
    '12. 调查结束必须调用 finish_dom_location；不要用普通文本结束。',
    '',
    '（本阶段只定位选区 DOM 的渲染/驱动源码，不规划、不实现任何改动。）',
    '',
    hasSeed
      ? [
        '锚点交集候选（确定性预计算：用选区静态文字锚点在源码里按稀有度加权求交集，排在越前越可能是该 DOM 的真实渲染源）：',
        '直接 read_file 从最前的候选开始核验。候选经真实源码证据验证并满足当前完成判据后，立即提交 resolved；只有完成判据尚未满足时才继续调查。候选仍是线索、非结论，需实测确认。',
        JSON.stringify(input.anchorSeed, null, 2),
        '',
      ].join('\n')
      : '',
    // DOM 选区通常不在路由文件内：有锚点候选时路由仅作一行背景，不作为调查对象；无候选时才作为起点。
    hasSeed
      ? `页面路由（仅背景）: ${input.routeFacts?.pagePath || input.routeFacts?.bestPageFile || '-'}`
      : `页面与路由事实（无锚点候选时的起点）:\n${JSON.stringify(input.routeFacts || {}, null, 2)}`,
    '',
    `当前 DOM 选区:\n${JSON.stringify(input.domSelections || [], null, 2)}`,
    '',
    hasSeed ? '' : `真实项目结构:\n${input.projectStructure || ''}`,
  ].join('\n');
}

module.exports = {
  LOCATOR_SYSTEM_PROMPT,
  readProjectStructure,
  buildDomLocatorObjective,
};

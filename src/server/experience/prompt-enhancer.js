const { readProjectText } = require('../core/fs-utils');
const { ensureProjectContext } = require('./project-context');
const { runRecon } = require('./recon');
const {
  compactTaskSession,
  getOrCreateTaskSession,
  updateTaskSession,
} = require('./task-session');

function parseJson(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (error) {
    }
  }
  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    try {
      return JSON.parse(text.slice(objectStart, objectEnd + 1));
    } catch (error) {
    }
  }
  return null;
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return '{}';
  }
}

function roughTask(body, modelItems) {
  const payload = body.searchPayload || {};
  return {
    pageUrl: payload.url || body.url || '',
    pagePath: body.pagePath || body.routeResolver?.pagePath || '',
    userRequirement: payload.userPrompt || '',
    targets: (modelItems || []).slice(0, 4).map(item => ({
      file: item.file,
      locateLevel: item.locateLevel,
      codeSnippet: item.codeSnippet || item.rawCodeSnippet || '',
      alignment: item.scopeAlignment || 'approximate',   // 该 codeSnippet 与选区 DOM 的对齐置信度
      directionGuess: item.directionGuess || '',
      coarsePrompt: item.prompt || '',
      confidence: item.confidence || 0,
    })),
    // 优先用「原始选区 DOM 快照」（扩区前抓取，含 tag/文案/class/父级列 data-col-key/邻域）——
    // 这是判断「用户到底选了哪个节点」的第一依据；没有时才退回指令文本。
    selections: (Array.isArray(body.originSelections) && body.originSelections.length
      ? body.originSelections
      : (payload.selectionInstructions || [])).slice(0, 8),
  };
}

function targetFileContext(project, modelItems, textCache) {
  return (modelItems || []).slice(0, 4).map(item => {
    const file = (project.files || []).find(entry => entry.path === item.file);
    const text = file ? readProjectText(project, file, textCache) : '';
    return {
      path: item.file,
      mode: file ? 'full' : 'missing',
      content: String(text || ''),
      fullFileOmitted: false,
      rawChars: String(text || '').length,
    };
  });
}

function fallbackEnhancedPrompt(task) {
  const targets = task.targets.map(item => [
    `文件: ${item.file}`,
    item.codeSnippet ? `粗定位源码:\n${item.codeSnippet}` : '',
    item.directionGuess ? `初步方向: ${item.directionGuess}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
  return [
    `任务: ${task.userRequirement || '按页面选区完成修改'}`,
    task.pageUrl ? `页面: ${task.pageUrl}` : '',
    targets,
    '实施要求:',
    '- 上面的粗定位源码来自页面选区定位，是本次修改的优先检查位置。',
    '- 先在目标文件中验证该源码片段是否对应页面选区；若匹配，围绕该片段完成修改。',
    '- 如果验证发现该片段不匹配，再沿相邻渲染块、直接引用链或同一列/同一区域重新定位。',
    '- 严格复用项目已有组件、请求、状态和错误处理方式。',
    '- 缺少接口字段、返回结构或调用时机时，先确认真实代码，不要臆造。',
  ].filter(Boolean).join('\n\n');
}

function roughSourceAnchors(value) {
  const stop = new Set([
    'const', 'return', 'render', 'style', 'class', 'value', 'false', 'true',
    'size', 'type', 'text', 'primary', 'font', 'color', 'div', 'row', 'item',
    'status', 'action', 'click',
  ]);
  return Array.from(new Set(String(value || '').match(/\b[A-Za-z_$][\w$]{3,}\b/g) || []))
    .filter(item => !stop.has(item.toLowerCase()))
    .slice(0, 16);
}

function enhancedPromptMatchesRoughSource(task, enhancedPrompt) {
  const prompt = String(enhancedPrompt || '');
  const targets = (task.targets || [])
    .map(item => ({
      file: item.file,
      anchors: roughSourceAnchors(item.codeSnippet || item.rawCodeSnippet || ''),
    }))
    .filter(item => item.anchors.length >= 3);
  if (!targets.length) return true;
  return targets.some(item => {
    const matched = item.anchors.filter(anchor => prompt.includes(anchor));
    return matched.length >= Math.min(2, item.anchors.length);
  });
}

// 精简喂给变更规划的 discovery：避免「又多又重」。
//  - 目标文件已在 targetFiles 完整提供 → 从 discovery 里剔除，去重复；
//  - 某条检索命中文件数过多（通用词/框架组件，如 n-button 命中 80+ 文件）→ 判为噪音，略去其匹配；
//  - 跨请求按 path 去重，封顶文件数与单片段长度。
//  仅用于变更规划输入；Experience 沉淀仍用全量 discovery。
// 变更规划阶段：把「定位到的源码 + 用户需求 + 项目经验」增强成一份结构化「修改计划」JSON。
// 在 runChangePlanWithTools 的 tool-capable 循环里产出：模型可先按需调用工具取真实依据，再给最终计划。
function buildChangePlanPrompt(input) {
  return [
    '你负责把 Magnus 粗定位到的源码块 + 用户在页面上的选区，翻译成一份可直接落地的「结构化修改计划」。只返回 JSON 对象。',
    '',
    '核心：用户只会给「选中某个 DOM + 一句话意图」这种毛坯输入（如选中一个价格、说“删除”）。',
    '你的首要工作是「读懂选区、把它对应到源码里的具体节点」，再把需求用源码语义讲清楚——这一步用户不会替你做，正是你的价值。',
    '',
    '第一步 · 理解选区并对应到源码节点（写入 selectionUnderstanding）：',
    '- roughTask.selections 是用户真正选中的原始 DOM，保留了结构：tag / 可见文案 / style 样式(颜色/字号等) / 判别性属性 / container 所在容器(如列的 data-col-key 值) / 邻域兄弟。',
    '- 可见文案常是运行时值（如页面 ¥3.5 对应源码 `¥${expressCost}`），**不要按字面找**；要用「所在容器 + 在兄弟中的第几个 + 样式(颜色/字号) + 语义」这些结构特征，把选区对应到 roughTask.targets[].codeSnippet 这个源码块里的**具体那个节点**。',
    '- selectionUnderstanding 用一句话讲清：选的是什么、对应源码哪个节点（引用真实符号/变量，如「cost 列第二行灰色价格 → 渲染 expressCost 的那个 h(\'div\',{color:#999})」）。',
    '',
    '第二步 · 用源码语义表达需求：不要回显「删除 ¥3.5」这种页面话；按第一步的对应关系，用源码术语说清改动',
    '（如「删除 cost 列 render 中渲染 expressCost 的那个 h(\'div\') 节点，保留 itemCost 那行与 action 查看按钮」）。',
    '',
    '第三步 · 产出计划：',
    '- roughTask.targets[].codeSnippet 是「粗定位源码块」（选区大致所在的那一列/那一块，**不一定是精确节点**），作用是把你限定在正确区块内；精确到哪个节点由你在第一步对齐得出。若块里根本没有选区对应的节点、或对不齐 → 写 openQuestions，绝不改成相邻/兄弟节点。',
    '- targetFiles.content（完整文件）用于确认真实符号、判断连带影响。',
    '- recon.reuse 是侦察到的「项目公共件 + 一段真实用法片段」（首选依据）：产计划直接照片段里的 import 路径与用法写，别重造、别用框架原语。',
    '- 片段通常已足够；除非确有必要，不要 read_file 去读公共件的整文件——知道「怎么用」用片段即可。',
    '- 局部优先：先看选区/目标文件当前怎么实现这类东西，以它为准；recon 只填补当前代码没有先例的空白。不要用框架默认顶替（裸表格组件、裸 axios、裸全局变量、当前时间常量等）——recon.reuse 里已有项目自有做法就必须用它。',
    '- 不得臆造接口字段、响应结构、函数名、导入路径、状态变量或组件 API；recon 没给证据、目标文件也没有先例时，写 openQuestions，不要编。',
    '- 连带影响(affected) 基于真实代码判断（类型定义、调用方、props/emits、样式、i18n、测试）；缺证据放 openQuestions。',
    '- 只规划与本次需求直接相关的改动，不顺带重构。',
    '',
    '字段说明：',
    '- changePlan.selectionUnderstanding：第一步的结论（选区 → 源码节点的对应，引用真实符号）。',
    '- changePlan.summary：一句源码语义的话说明本次改动。',
    '- changePlan.targets[]：{file, anchor, line, whatToChange(源码语义级：改哪个节点/符号), why}。',
    '- changePlan.affected[]：{file, reason}，连带影响的文件与原因。',
    '- changePlan.reusePatterns[]：应复用的项目做法/组件/hook/API（引用 recon 命中的真实文件作证据）。',
    '- changePlan.risks[] / verification[] / openQuestions[]：风险 / 如何验证 / 需用户确认的点。',
    '',
    '返回格式：',
    '{"changePlan":{"selectionUnderstanding":"","summary":"","targets":[{"file":"","anchor":"","line":0,"whatToChange":"","why":""}],"affected":[{"file":"","reason":""}],"reusePatterns":[],"risks":[],"verification":[],"openQuestions":[]},"confirmedFacts":[],"assumptions":[]}',
    '',
    `输入上下文:\n${safeJson(input)}`,
  ].join('\n');
}

// 规范化模型返回的 changePlan（防缺字段/类型错）。
function normalizeChangePlan(raw) {
  const plan = raw && typeof raw === 'object' ? raw : {};
  const planText = value => {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }
    if (Array.isArray(value)) return value.map(planText).filter(Boolean).join('；');
    if (typeof value === 'object') {
      const preferred = [
        'text',
        'title',
        'description',
        'reason',
        'question',
        'content',
        'message',
        'risk',
        'verification',
        'expected',
        'action',
        'value',
        'label',
      ];
      for (const key of preferred) {
        const text = planText(value[key]);
        if (text) return text;
      }
      return Object.entries(value)
        .map(([key, item]) => {
          const text = planText(item);
          return text ? `${key}: ${text}` : '';
        })
        .filter(Boolean)
        .join('；');
    }
    return '';
  };
  const strList = value => (Array.isArray(value) ? value : []).map(item => planText(item)).filter(Boolean).slice(0, 20);
  return {
    selectionUnderstanding: planText(plan.selectionUnderstanding),
    summary: planText(plan.summary),
    targets: (Array.isArray(plan.targets) ? plan.targets : []).slice(0, 20).map(item => ({
      file: planText(item?.file),
      anchor: planText(item?.anchor),
      line: Math.max(0, Number(item?.line || 0)),
      whatToChange: planText(item?.whatToChange),
      why: planText(item?.why),
    })).filter(item => item.file || item.whatToChange),
    affected: (Array.isArray(plan.affected) ? plan.affected : []).slice(0, 20).map(item => ({
      file: planText(item?.file),
      reason: planText(item?.reason),
    })).filter(item => item.file),
    reusePatterns: strList(plan.reusePatterns),
    risks: strList(plan.risks),
    verification: strList(plan.verification),
    openQuestions: strList(plan.openQuestions),
  };
}

// 把结构化 changePlan 派生成一段可复制文本（保证旧的「复制提示词」UX 不断）。
function changePlanToText(changePlan, task) {
  if (!changePlan || !changePlan.summary && !changePlan.targets.length && !changePlan.selectionUnderstanding) return '';
  const lines = [];
  lines.push(`# 修改计划：${changePlan.summary || task?.userRequirement || ''}`.trim());
  if (changePlan.selectionUnderstanding) {
    lines.push('', '## 选区理解', `- ${changePlan.selectionUnderstanding}`);
  }
  if (changePlan.targets.length) {
    lines.push('', '## 改动点');
    for (const target of changePlan.targets) {
      const loc = target.line ? `${target.file}:${target.line}` : target.file;
      lines.push(`- ${loc}${target.anchor ? `（锚点：${target.anchor}）` : ''}`);
      if (target.whatToChange) lines.push(`  改什么：${target.whatToChange}`);
      if (target.why) lines.push(`  为什么：${target.why}`);
    }
  }
  const section = (title, items) => {
    if (!items.length) return;
    lines.push('', `## ${title}`);
    for (const item of items) lines.push(`- ${typeof item === 'string' ? item : `${item.file}：${item.reason}`}`);
  };
  section('连带影响', changePlan.affected);
  section('可复用模式', changePlan.reusePatterns);
  section('风险', changePlan.risks);
  section('验证', changePlan.verification);
  section('待确认', changePlan.openQuestions);
  return lines.join('\n').trim();
}

// 变更计划护栏：计划必须引用定位源码的核心锚点，否则可能改判到同文件其它相似块 → 回退。
function changePlanMatchesRoughSource(task, changePlan) {
  return enhancedPromptMatchesRoughSource(task, safeJson(changePlan));
}

async function invokeChangePlanModel(project, { agentAdapter, langchainModel, signal, stage, prompt, log }) {
  const { runAgentLlmTask } = require('../agent-host/llm-adapter');
  log(`经验增强模型阶段：${stage}；提示词 ${prompt.length} 字符`);
  log(`经验增强提示词(${stage}):\n${prompt}`);
  const result = await runAgentLlmTask(agentAdapter, prompt, project, {
    langchainModel,
    signal,
    stage,
    systemPrompt: '你是 Magnus 项目经验发现与需求增强 agent。严格按用户提示返回 JSON，不执行代码修改。',
    onLog: message => log(message),
  });
  log(`经验增强模型返回(${stage}):\n${result.rawText || '-'}`);
  return { raw: result.rawText, parsed: parseJson(result.rawText) };
}

function truncate(value, max) {
  const text = String(value == null ? '' : value);
  return text.length > max ? `${text.slice(0, max)}…（已截断）` : text;
}

function compactToolResult(result) {
  if (typeof result === 'string') return result;
  if (Array.isArray(result?.content)) {
    return result.content.map(item => {
      if (typeof item === 'string') return item;
      if (item?.type === 'text') return item.text || '';
      return JSON.stringify(item);
    }).filter(Boolean).join('\n\n');
  }
  return JSON.stringify(result);
}

function allowedChangePlanFiles(input) {
  return Array.from(new Set([
    ...(input?.targetFiles || []).map(item => item?.path),
    ...(input?.recon?.reuse || []).map(item => item?.usage?.path),
  ].filter(Boolean).map(item => String(item).replace(/^\/+/, ''))));
}

function selectScopedChangePlanTools(tools) {
  const { filterToolsByConfigAction } = require('../agent-host/capabilities');
  const scopedBuiltinNames = new Set(['read_file', 'find_imports']);
  const blockedBuiltinNames = new Set([
    'search_text',
    'find_symbol',
    'find_endpoint',
    'find_files',
    'find_importers',
    'find_related_examples',
  ]);
  const allowed = (tools || []).filter(tool => {
    if ((tool.source || 'unknown') !== 'builtin') return true;
    if (blockedBuiltinNames.has(tool.name)) return false;
    return scopedBuiltinNames.has(tool.name);
  });
  return filterToolsByConfigAction(allowed, {
    configAction: ['builtin', 'skill'],
    readOnlyOnly: true,
    allowedToolNames: allowed.map(tool => tool.name),
    blockedProviders: ['builtin.experience'],
    blockedCategories: ['experience'],
  });
}

function normalizeToolFile(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function requestedReadFiles(input) {
  return (Array.isArray(input?.files) ? input.files : []).map(normalizeToolFile).filter(Boolean);
}

function validateChangePlanToolCall(name, input, allowedFiles) {
  const allowed = new Set((allowedFiles || []).map(normalizeToolFile));
  if (!allowed.size) return;
  if (name === 'read_file') {
    const files = requestedReadFiles(input);
    if (!files.length) {
      throw new Error(`change-plan read_file must specify files within allowed files: ${Array.from(allowed).join(', ')}`);
    }
    const denied = files.filter(file => !allowed.has(file));
    if (denied.length) {
      throw new Error(`change-plan read_file denied outside allowed files: ${denied.join(', ')}`);
    }
  }
  if (name === 'find_imports') {
    const target = normalizeToolFile(input?.target);
    if (!target || !allowed.has(target)) {
      throw new Error(`change-plan find_imports target must be one of allowed files: ${Array.from(allowed).join(', ')}`);
    }
  }
}

// change-plan 走 Agent Host / LangChain：模型可在产计划前调用当前场景允许的工具，取完再给最终计划。
async function runChangePlanWithTools({ project, agentAdapter, langchainModel, signal, input, log, textCache, maxTurns = 4, toolRuntime = null }) {
  const basePrompt = buildChangePlanPrompt(input);
  let tools = [];
  let executeTool = null;
  const scopedFiles = allowedChangePlanFiles(input);
  // 工具运行时由调用方注入（agent-host 的 { listTools, executeTool }），experience 不再反向 require agent-host——
  // 这样打断了 registry → experience-tools → prompt-enhancer 的跨层循环依赖。无注入则退回无工具模式。
  if (toolRuntime && typeof toolRuntime.listTools === 'function' && typeof toolRuntime.executeTool === 'function') {
    tools = selectScopedChangePlanTools(toolRuntime.listTools()); // 排除经验发现类/全局搜索类工具，防职责重叠
    executeTool = toolRuntime.executeTool;
  } else {
    log('未注入工具运行时，change-plan 退回无工具模式');
  }
  const observations = [];
  if (!tools.length || typeof executeTool !== 'function') {
    const single = await invokeChangePlanModel(project, { agentAdapter, langchainModel, signal, stage: 'change-plan', prompt: basePrompt, log });
    return { ...single, observations };
  }
  if (!agentAdapter && !langchainModel) {
    log('未注入 Agent 模型适配器，change-plan 退回单次模型规划（无工具循环）');
    const single = await invokeChangePlanModel(project, { agentAdapter, langchainModel, signal, stage: 'change-plan', prompt: basePrompt, log });
    return { ...single, observations };
  }
  log(`change-plan 可用工具 ${tools.length} 个：${tools.map(tool => tool.name).join('、')}`);
  log(`change-plan 工具范围：${scopedFiles.join('、') || '无目标文件'}；本地全局检索工具=关闭；skill=Agent Host registry；MCP=LangChain runtime 加载`);

  const allowedToolNames = tools.map(tool => tool.name);
  const guardedExecuteTool = async (toolProject, call, context) => {
    const name = String(call.tool || call.name || '');
    const toolInput = call.input || call.arguments || {};
    validateChangePlanToolCall(name, toolInput, scopedFiles);
    return executeTool(toolProject, { tool: name, input: toolInput }, {
      ...context,
      textCache,
      allowedTools: allowedToolNames,
      readOnlyOnly: true,
    });
  };
  const { runAgentTask } = require('../agent-host/llm-adapter');
  try {
    const agentResult = await runAgentTask(project, {
      adapter: agentAdapter,
      langchainModel,
      configAction: ['builtin', 'skill', 'mcp'],
      maxTurns,
      objective: [
        basePrompt,
        scopedFiles.length
          ? `工具读取边界：只能调用 read_file({"files":[...]}) 读取这些文件：${scopedFiles.join('、')}。不要请求目录，不要请求范围外文件；缺证据时写 openQuestions。`
          : '工具读取边界：当前没有可读目标文件；缺证据时写 openQuestions。',
        maxTurns ? `最多进行 ${maxTurns} 轮工具观察；证据足够后必须输出最终 changePlan JSON。` : '',
      ].filter(Boolean).join('\n\n'),
      stage: 'change-plan',
      systemPrompt: [
        '你是 Magnus 项目经验发现与需求增强 agent。',
        '需要真实依据时调用工具；证据足够时输出最终 changePlan JSON。',
        '不要执行代码修改，不要编造项目事实。',
      ].join('\n'),
      onEvent: event => {
        if (event.type === 'llm.input') {
          const inputText = event.prompt || JSON.stringify(event.messages || [], null, 2);
          log(`经验增强模型阶段：change-plan；输入 ${String(inputText || '').length} 字符；tools=${event.toolCount ?? '-'}`);
          log(`经验增强输入(change-plan):\n${inputText || ''}`);
        } else if (event.type === 'llm.output') {
          log(`经验增强模型返回(change-plan):\n${event.rawText || '-'}`);
        } else if (event.type === 'tool.start') {
          log(`change-plan 工具调用：${event.toolCall?.tool || '-'}；input=${truncate(JSON.stringify(event.toolCall?.input || {}), 500)}`);
        } else if (event.type === 'tool.result') {
          observations.push(event.observation);
          log(`change-plan 工具调用：${event.observation?.tool || '-'} ✓；结果 ${compactToolResult(event.observation?.result).length} 字符`);
        } else if (event.type === 'tool.error') {
          observations.push(event.observation);
          log(`change-plan 工具调用：${event.observation?.tool || '-'} ✗ ${event.observation?.error || '-'}`);
        }
      },
    }, {
      tools,
      executeTool: guardedExecuteTool,
      textCache,
    });
    const raw = agentResult.rawText || '';
    return { raw, parsed: parseJson(raw), observations };
  } catch (error) {
    if (!/recursion limit/i.test(error.message || '')) throw error;
    log(`change-plan 工具循环达到上限，退回无工具最终规划：${error.message || error}`);
    const prompt = [
      basePrompt,
      '工具循环未能收敛。现在不要再调用工具，必须只基于已给出的目标文件和 recon 片段输出最终 changePlan JSON；缺证据写 openQuestions。',
    ].join('\n\n');
    const fallback = await invokeChangePlanModel(project, { agentAdapter, langchainModel, signal, stage: 'change-plan-fallback', prompt, log });
    return { ...fallback, observations };
  }
}

async function enhanceLocatedPrompt(options) {
  const {
    project,
    body,
    modelItems,
    textCache = new Map(),
    log = () => {},
    toolRuntime = null,
  } = options;
  const task = roughTask(body, modelItems);
  const fallback = fallbackEnhancedPrompt(task);
  if (!modelItems?.length || (!options.agentAdapter && !options.langchainModel)) {
    return { enhancedPrompt: fallback, usedExperienceIds: [], mode: 'fallback' };
  }
  const taskSession = getOrCreateTaskSession(project, task);
  const activeTask = compactTaskSession(taskSession.session);
  log(`任务上下文：${taskSession.mode === 'append' ? '复用' : '新建'}；key=${activeTask.pageKey}；需求 ${activeTask.requirements.length} 条`);

  const projectContext = ensureProjectContext(project, {});
  log(`项目上下文：${projectContext.rebuilt ? '已重建' : '已复用'} Project.md`);
  if (!projectContext.writable) log(`项目 .magnus 目录不可写，本次仅在内存中使用：${projectContext.error || '-'}`);

  // 实现侦察：LLM 只从「需求 + Structure.md」挑出需求明确提到的公共件 + 检索词；本地按变体搜「谁用了它」并抽用法片段。
  const recon = await runRecon(project, {
    requirement: task.userRequirement || activeTask.taskBrief || '',
    agentAdapter: options.agentAdapter,
    langchainModel: options.langchainModel,
    textCache,
    log,
  });

  const enhancementInput = {
    project: {
      name: project.name,
      kind: project.kind,
      stack: project.stack || [],
      overview: projectContext.markdown,
    },
    roughTask: task,
    activeTask,
    targetFiles: targetFileContext(project, modelItems, textCache),
    // recon.reuse = 侦察到的「项目公共件 + 一段真实用法片段」（首选依据、片段级，不喂整文件）。
    recon: {
      reuse: recon.reuse,
    },
  };
  // 变更规划阶段：tool-capable 循环——模型可按需 read_file 把侦察到的先例读全再照抄，产出计划。
  const enhanced = await runChangePlanWithTools({
    project,
    agentAdapter: options.agentAdapter,
    langchainModel: options.langchainModel,
    signal: options.signal,
    input: enhancementInput,
    log,
    textCache,
    toolRuntime,
  });
  let changePlan = normalizeChangePlan(enhanced.parsed?.changePlan);
  const hasPlan = !!(changePlan.summary || changePlan.targets.length);
  if (hasPlan && !changePlanMatchesRoughSource(task, changePlan)) {
    log('变更规划被回退：计划未引用粗定位源码核心锚点，可能改判到同文件其它相似代码');
    changePlan = normalizeChangePlan(null);
  }
  const enhancedPrompt = changePlanToText(changePlan, task) || fallback;

  const updatedSession = updateTaskSession(project, task, {
    targetFiles: task.targets.map(item => item.file).filter(Boolean),
    confirmedFacts: enhanced.parsed?.confirmedFacts || [],
    assumptions: enhanced.parsed?.assumptions || [],
    enhancedPrompt,
  });
  if (updatedSession) {
    log(`任务上下文已更新：需求 ${updatedSession.requirements.length} 条`);
  }

  return {
    changePlan,
    enhancedPrompt,
    confirmedFacts: enhanced.parsed?.confirmedFacts || [],
    assumptions: enhanced.parsed?.assumptions || [],
    recon: { candidates: recon.candidates, reuse: recon.reuse },
    mode: 'recon',
  };
}

module.exports = {
  enhanceLocatedPrompt,
  fallbackEnhancedPrompt,
  normalizeChangePlan,
  changePlanToText,
  changePlanMatchesRoughSource,
  roughTask,
  buildChangePlanPrompt,
  runChangePlanWithTools,
  parseJson,
};

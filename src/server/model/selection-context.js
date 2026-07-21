'use strict';

const { enhanceLocatedPrompt, fallbackEnhancedPrompt } = require('../experience/prompt-enhancer');
const { normalizeAdapter } = require('./api-client');

const MAX_MODEL_FILES = 6;

function appendLog(logs, text) {
  logs.push(String(text || ''));
  if (typeof logs.onAppend === 'function') logs.onAppend(String(text || ''));
}

function modelItemsFromSelectionContext(project, body) {
  const bindings = Array.isArray(body.selectionBindings) ? body.selectionBindings : [];
  const files = new Set((project.files || []).map(entry => entry.path));
  const targets = [];
  const seen = new Set();
  for (const binding of bindings) {
    for (const target of binding?.targets || []) {
      const file = String(target?.file || '').trim();
      if (!file || seen.has(file)) continue;
      seen.add(file);
      targets.push({
        file,
        exists: files.has(file),
        fileOnly: false,
        confidence: 100,
        localScore: 1200,
        localPreciseEvidence: true,
        localReasons: ['复用选区已确认源码上下文'],
        locateLevel: target.locateLevel || 'direction',
        codeSnippet: target.codeSnippet || '',
        rawCodeSnippet: target.codeSnippet || '',
        scopeAlignment: target.scopeAlignment || '',
        snippetVerified: true,
        snippetSource: 'selection-context-binding',
        directionGuess: target.directionGuess || '',
        prompt: [
          `页面: ${body.searchPayload?.url || body.url || ''}`,
          `文件: ${file}`,
          target.codeSnippet ? `已绑定源码片段:\n${target.codeSnippet}` : '',
          target.directionGuess ? `已绑定方向: ${target.directionGuess}` : '',
          binding.designRequirement ? `原始设计需求: ${binding.designRequirement}` : '',
          body.searchPayload?.userPrompt ? `本轮新需求: ${body.searchPayload.userPrompt}` : '',
        ].filter(Boolean).join('\n'),
        reason: '该文件来自此前 @选区 源码定位结果，本轮复用该上下文生成修改计划。',
      });
    }
  }
  return targets.slice(0, MAX_MODEL_FILES);
}

function changePlanToolRuntime() {
  const registry = require('../agent-host/tools/registry');
  return { listTools: registry.listAgentTools, executeTool: registry.executeAgentTool };
}

async function runSelectionContextEnhancement(project, body, textCache = new Map(), options = {}) {
  if (!project) throw new Error('No project selected.');
  const logs = [];
  if (typeof options.onLog === 'function') logs.onAppend = options.onLog;
  try {
    const adapter = normalizeAdapter(body.adapter);
    appendLog(logs, `选区上下文增强开始：${adapter.name}（api）`);
    appendLog(logs, '本轮复用已绑定的选区源码上下文，跳过 DOM Agent、本地源码检索和源码定位。');
    const modelItems = modelItemsFromSelectionContext(project, body);
    body.originSelections = (Array.isArray(body.selectionBindings) ? body.selectionBindings : [])
      .flatMap(binding => (Array.isArray(binding?.originSelections) ? binding.originSelections : []));
    appendLog(logs, `复用目标文件：${modelItems.length} 个；原始选区快照 ${body.originSelections.length} 个`);
    const containerAnchors = body.originSelections
      .flatMap(sel => (Array.isArray(sel?.container) ? sel.container : []))
      .map(entry => String(entry).split('=').pop())
      .filter(Boolean);
    if (containerAnchors.length) {
      const { regionByContainerAnchors } = require('../search/agent-search');
      for (const item of modelItems) {
        if (item.scopeAlignment !== 'unlocated' || item.codeSnippet) continue;
        const region = regionByContainerAnchors(project, item.file, containerAnchors, textCache);
        if (region) {
          item.codeSnippet = region.snippet;
          item.rawCodeSnippet = region.snippet;
          item.scopeAlignment = 'approximate';
          appendLog(logs, `选区无自身锚点，已按容器(${containerAnchors.join(',')})定位到区块 ${item.file}:${region.startLine}-${region.endLine}`);
        }
      }
    }
    for (const item of modelItems) appendLog(logs, `复用文件：${item.file}${item.exists ? '' : '（文件不存在）'}`);
    const validItems = modelItems.filter(item => item.exists);
    let experience = {
      enhancedPrompt: fallbackEnhancedPrompt({
        pageUrl: body.searchPayload?.url || body.url || '',
        pagePath: body.pagePath || body.routeResolver?.pagePath || '',
        userRequirement: body.searchPayload?.userPrompt || '',
        targets: validItems,
      }),
      mode: 'fallback',
      usedExperienceIds: [],
    };
    if (validItems.length) {
      experience = await enhanceLocatedPrompt({
        project,
        body,
        modelItems: validItems,
        textCache,
        log: message => appendLog(logs, message),
        toolRuntime: changePlanToolRuntime(),
        agentAdapter: adapter,
      });
      appendLog(logs, `选区上下文提示词增强完成：mode=${experience.mode}；Experience ${(experience.usedExperienceIds || []).length} 个`);
    }
    const enhancedModelItems = validItems.map(item => ({
      ...item,
      enhancedPrompt: experience.enhancedPrompt,
      changePlan: experience.changePlan || null,
      experienceMode: experience.mode,
      usedExperienceIds: experience.usedExperienceIds || [],
    }));
    return {
      adapter: { id: adapter.id, name: adapter.name, type: adapter.type },
      rawText: '',
      parsed: null,
      parsedBatches: [],
      modelItems: enhancedModelItems,
      changePlan: experience.changePlan || null,
      targetFiles: enhancedModelItems,
      experience,
      logs,
    };
  } catch (error) {
    appendLog(logs, `选区上下文增强失败：${error.message || error}`);
    error.modelLogs = logs;
    throw error;
  }
}

module.exports = {
  runSelectionContextEnhancement,
};

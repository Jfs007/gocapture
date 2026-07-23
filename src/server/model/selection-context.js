'use strict';

const { runPlanningAgent } = require('../planning/planning-agent');
const { normalizeModelConfig } = require('./providers/registry');

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
        sourceRole: String(target.role || 'related'),
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
        sourceInvestigation: binding.investigation || null,
        prompt: [
          `页面: ${body.searchPayload?.url || body.url || ''}`,
          `文件: ${file}`,
          target.codeSnippet ? `已绑定源码片段:\n${target.codeSnippet}` : '',
          target.directionGuess ? `已绑定方向: ${target.directionGuess}` : '',
          target.role ? `DOM Agent 裁决角色: ${target.role}` : '',
          binding.designRequirement ? `原始设计需求: ${binding.designRequirement}` : '',
          body.searchPayload?.userPrompt ? `本轮新需求: ${body.searchPayload.userPrompt}` : '',
        ].filter(Boolean).join('\n'),
        reason: '该文件来自此前 @选区 源码定位结果，本轮复用该上下文生成修改计划。',
      });
    }
  }
  return targets.slice(0, MAX_MODEL_FILES);
}

async function runSelectionContextEnhancement(project, body, textCache = new Map(), options = {}) {
  if (!project) throw new Error('No project selected.');
  const logs = [];
  if (typeof options.onLog === 'function') logs.onAppend = options.onLog;
  try {
    const adapter = normalizeModelConfig(body.adapter);
    appendLog(logs, `选区上下文增强开始：${adapter.name}（api）`);
    appendLog(logs, '本轮复用已绑定的选区源码上下文，跳过 DOM Agent、本地源码检索和源码定位。');
    const modelItems = modelItemsFromSelectionContext(project, body);
    const investigations = (Array.isArray(body.selectionBindings) ? body.selectionBindings : [])
      .map(binding => binding?.investigation)
      .filter(Boolean);
    body.originSelections = (Array.isArray(body.selectionBindings) ? body.selectionBindings : [])
      .flatMap(binding => (Array.isArray(binding?.originSelections) ? binding.originSelections : []));
    appendLog(logs, `复用目标文件：${modelItems.length} 个；原始选区快照 ${body.originSelections.length} 个；DOM 调查结论 ${investigations.length} 份`);
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
    let planning = {
      enhancedPrompt: '',
      mode: 'no-source',
      changePlan: null,
      planning: null,
    };
    if (validItems.length) {
      planning = await runPlanningAgent(project, {
        adapter,
        body,
        modelItems: validItems,
        textCache,
        log: message => appendLog(logs, message),
        signal: options.signal,
      });
      appendLog(logs, `Planning Agent 完成：mode=${planning.mode}；status=${planning.planning?.status || '-'}`);
    }
    const enhancedModelItems = validItems.map(item => ({
      ...item,
      enhancedPrompt: planning.enhancedPrompt,
      changePlan: planning.changePlan || null,
      experienceMode: planning.mode,
      usedExperienceIds: [],
    }));
    return {
      adapter: { id: adapter.id, name: adapter.name, type: adapter.type },
      rawText: '',
      parsed: null,
      parsedBatches: [],
      modelItems: enhancedModelItems,
      changePlan: planning.changePlan || null,
      planning: planning.planning || null,
      targetFiles: enhancedModelItems,
      experience: {
        mode: planning.mode,
        changePlan: planning.changePlan || null,
        enhancedPrompt: planning.enhancedPrompt,
        planning: planning.planning || null,
      },
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

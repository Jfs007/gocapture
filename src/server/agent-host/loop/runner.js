'use strict';

const { runAgentLlmTask } = require('../llm-adapter');
const { listAgentResources } = require('../resources/registry');
const { listExperiences } = require('../experiences/registry');
const {
  executeAgentTool,
  listAgentTools,
} = require('../tools/registry');
const {
  createAgentSystemPrompt,
  createAgentTurnPrompt,
  parseAgentResponse,
} = require('./protocol');

function filterTools(tools, allowedTools) {
  if (!Array.isArray(allowedTools) || allowedTools.length === 0) return tools;
  const allowed = new Set(allowedTools.map(String));
  return tools.filter(tool => allowed.has(tool.name));
}

function emit(onEvent, event) {
  if (typeof onEvent === 'function') onEvent(event);
}

async function executeToolCalls({ project, toolCalls, textCache, onEvent, allowedTools, readOnlyOnly }) {
  const observations = [];
  for (const toolCall of toolCalls) {
    emit(onEvent, { type: 'tool.start', toolCall });
    try {
      const output = await executeAgentTool(project, toolCall, { textCache, allowedTools, readOnlyOnly });
      const observation = {
        id: toolCall.id,
        tool: output.tool,
        providerId: output.providerId,
        ok: true,
        result: output.result,
      };
      observations.push(observation);
      emit(onEvent, { type: 'tool.result', observation });
    } catch (error) {
      const observation = {
        id: toolCall.id,
        tool: toolCall.tool,
        ok: false,
        error: error.message || String(error),
      };
      observations.push(observation);
      emit(onEvent, { type: 'tool.error', observation });
    }
  }
  return observations;
}

async function runAgentLoop(project, options) {
  if (!project?.path) throw new Error('No project selected.');
  if (!options?.adapter) throw new Error('Agent loop requires adapter.');
  const maxTurns = Math.max(1, Math.min(12, Number(options.maxTurns) || 6));
  const textCache = new Map();
  const allTools = filterTools(listAgentTools(), options.allowedTools);
  const resources = listAgentResources(project);
  const experiences = listExperiences(project);
  const history = Array.isArray(options.history) ? options.history.slice() : [];
  const observations = Array.isArray(options.observations) ? options.observations.slice() : [];
  const turns = [];

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const prompt = createAgentTurnPrompt({
      objective: options.objective,
      tools: allTools,
      resources,
      experiences,
      history,
      observations,
    });
    emit(options.onEvent, { type: 'llm.input', turn, prompt });
    const llmResult = await runAgentLlmTask(options.adapter, prompt, project, {
      signal: options.signal,
      stage: options.stage || 'agent-loop',
      systemPrompt: options.systemPrompt || createAgentSystemPrompt(),
      temperature: options.temperature,
      onLog: log => emit(options.onEvent, { type: 'llm.log', turn, log }),
    });
    const rawText = llmResult.rawText || '';
    emit(options.onEvent, { type: 'llm.output', turn, rawText });
    const decision = parseAgentResponse(rawText);
    turns.push({ turn, decision });

    if (decision.final) {
      return {
        status: 'resolved',
        final: decision.final,
        turns,
        observations,
      };
    }

    if (!decision.toolCalls.length) {
      return {
        status: 'stalled',
        reason: 'LLM returned neither final nor toolCalls.',
        turns,
        observations,
      };
    }

    const nextObservations = await executeToolCalls({
      project,
      toolCalls: decision.toolCalls,
      textCache,
      onEvent: options.onEvent,
      allowedTools: allTools.map(tool => tool.name),
      readOnlyOnly: options.readOnlyOnly,
    });
    observations.push(...nextObservations);
  }

  return {
    status: 'max-turns',
    turns,
    observations,
  };
}

module.exports = {
  runAgentLoop,
};

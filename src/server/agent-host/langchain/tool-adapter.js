'use strict';

function tryRequire(moduleName) {
  try {
    return require(moduleName);
  } catch (error) {
    return null;
  }
}

function loadLangChainRuntime() {
  const langchain = tryRequire('langchain');
  const coreTools = tryRequire('@langchain/core/tools');
  const zod = tryRequire('zod');
  const createAgent = langchain?.createAgent;
  const createMiddleware = langchain?.createMiddleware;
  const contextEditingMiddleware = langchain?.contextEditingMiddleware;
  const ClearToolUsesEdit = langchain?.ClearToolUsesEdit;
  const tool = coreTools?.tool || langchain?.tool;
  const z = zod?.z || zod;
  return {
    available: typeof createAgent === 'function' && typeof tool === 'function' && !!z,
    createAgent,
    createMiddleware,
    contextEditingMiddleware,
    ClearToolUsesEdit,
    tool,
    z,
    missing: [
      !langchain ? 'langchain' : '',
      !coreTools && !langchain?.tool ? '@langchain/core/tools' : '',
      !z ? 'zod' : '',
    ].filter(Boolean),
  };
}

function zodFromJsonSchema(schema, z) {
  if (!z) return null;
  const type = schema?.type || 'object';
  if (type === 'string') return z.string();
  if (type === 'number' || type === 'integer') return z.number();
  if (type === 'boolean') return z.boolean();
  if (type === 'array') return z.array(zodFromJsonSchema(schema.items || {}, z) || z.any());
  if (type === 'object') {
    const shape = {};
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    for (const [key, childSchema] of Object.entries(schema.properties || {})) {
      const child = zodFromJsonSchema(childSchema, z) || z.any();
      shape[key] = required.has(key) ? child : child.optional();
    }
    const objectSchema = z.object(shape);
    return schema?.additionalProperties === true
      ? objectSchema.passthrough()
      : objectSchema.strict();
  }
  return z.any();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stableValue(value[key])])
  );
}

function compactValue(value, options = {}, depth = 0) {
  const arrayLimit = Number(options.arrayLimit || 8);
  const stringLimit = Number(options.stringLimit || 1800);
  if (typeof value === 'string') {
    return value.length > stringLimit
      ? `${value.slice(0, stringLimit)}\n...（工具证据已裁剪 ${value.length - stringLimit} 字符）`
      : value;
  }
  if (Array.isArray(value)) {
    const items = value.slice(0, arrayLimit).map(item => compactValue(item, options, depth + 1));
    if (value.length > arrayLimit) {
      items.push({ omittedItems: value.length - arrayLimit, note: '请缩小 roots/files/terms 后继续检索' });
    }
    return items;
  }
  if (!value || typeof value !== 'object') return value;
  if (depth > 8) return '[嵌套证据已裁剪]';
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, compactValue(child, options, depth + 1)])
  );
}

function compactToolResultForModel(result, maxChars = 18000) {
  const serialized = JSON.stringify(result);
  if (!serialized || serialized.length <= maxChars) return result;
  const compact = compactValue(result);
  if (JSON.stringify(compact).length <= maxChars) {
    return compact && typeof compact === 'object' && !Array.isArray(compact)
      ? { ...compact, modelObservationTruncated: true }
      : { result: compact, modelObservationTruncated: true };
  }
  const tighter = compactValue(result, { arrayLimit: 4, stringLimit: 800 });
  if (JSON.stringify(tighter).length <= maxChars) {
    return tighter && typeof tighter === 'object' && !Array.isArray(tighter)
      ? { ...tighter, modelObservationTruncated: true }
      : { result: tighter, modelObservationTruncated: true };
  }
  return {
    modelObservationTruncated: true,
    note: '工具结果过大。请缩小 roots/files/terms 后继续检索。',
    preview: JSON.stringify(tighter).slice(0, maxChars - 200),
  };
}

function createLangChainTools({ tools, project, executeTool, textCache, allowedTools, readOnlyOnly, onEvent, toolGuard }) {
  const runtime = loadLangChainRuntime();
  if (!runtime.available) return { available: false, missing: runtime.missing, tools: [] };
  const completedCalls = new Map();
  const langchainTools = (tools || []).map(descriptor => runtime.tool(
    async input => {
      const toolCall = { tool: descriptor.name, input: input && typeof input === 'object' ? input : {} };
      if (typeof onEvent === 'function') onEvent({ type: 'tool.start', toolCall });
      // 执行层硬拦：收尾阶段等场景下，非放行工具直接返回引导，不真正执行（模型广告层拦不住弱模型）。
      if (typeof toolGuard === 'function') {
        const blocked = toolGuard(descriptor.name, toolCall.input);
        if (blocked) {
          const observation = { tool: descriptor.name, providerId: 'magnus-tool-guard', ok: true, result: blocked };
          if (typeof onEvent === 'function') onEvent({ type: 'tool.result', observation });
          return JSON.stringify(blocked);
        }
      }
      const callKey = JSON.stringify(stableValue(toolCall));
      if (completedCalls.has(callKey)) {
        const duplicateResult = {
          operation: descriptor.name,
          duplicate: true,
          note: '完全相同的工具调用已执行过，结果未变化。请缩小查询范围、改用 around/terms 下钻，或结束调查。',
        };
        const observation = {
          tool: descriptor.name,
          providerId: 'magnus-call-cache',
          ok: true,
          result: duplicateResult,
        };
        if (typeof onEvent === 'function') onEvent({ type: 'tool.result', observation });
        return JSON.stringify(duplicateResult);
      }
      try {
        const output = await executeTool(project, toolCall, {
          textCache,
          allowedTools,
          readOnlyOnly,
        });
        const observation = {
          tool: output.tool,
          providerId: output.providerId,
          ok: true,
          result: output.result,
        };
        completedCalls.set(callKey, output.result);
        if (typeof onEvent === 'function') onEvent({ type: 'tool.result', observation });
        return JSON.stringify(compactToolResultForModel(output.result));
      } catch (error) {
        const observation = {
          tool: descriptor.name,
          ok: false,
          error: error.message || String(error),
        };
        if (typeof onEvent === 'function') onEvent({ type: 'tool.error', observation });
        return JSON.stringify(observation);
      }
    },
    {
      name: descriptor.name,
      description: descriptor.description || descriptor.title || descriptor.name,
      schema: zodFromJsonSchema(descriptor.inputSchema || { type: 'object', properties: {} }, runtime.z),
    }
  ));
  return { available: true, missing: [], tools: langchainTools };
}

module.exports = {
  compactToolResultForModel,
  createLangChainTools,
  loadLangChainRuntime,
  zodFromJsonSchema,
};

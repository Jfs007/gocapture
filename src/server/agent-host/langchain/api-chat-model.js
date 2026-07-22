'use strict';

const { BaseChatModel } = require('@langchain/core/language_models/chat_models');
const { AIMessage } = require('@langchain/core/messages');
const { runChatCompletion } = require('../../model/api-client');

function messageRole(message) {
  const type = typeof message?._getType === 'function' ? message._getType() : message?.getType?.();
  if (type === 'human') return 'user';
  if (type === 'ai') return 'assistant';
  if (type === 'system') return 'system';
  if (type === 'tool') return 'tool';
  return message?.role || 'user';
}

function stringifyContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part;
      if (part?.type === 'text') return part.text || '';
      return JSON.stringify(part);
    }).filter(Boolean).join('\n');
  }
  if (content == null) return '';
  return JSON.stringify(content);
}

function toApiMessages(messages) {
  return (messages || []).map(message => {
    const role = messageRole(message);
    const item = {
      role: role === 'tool' ? 'tool' : role,
      content: stringifyContent(message.content),
    };
    if (role === 'tool' && message.tool_call_id) item.tool_call_id = message.tool_call_id;
    if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
      item.tool_calls = message.tool_calls.map(call => ({
        id: call.id,
        type: 'function',
        function: {
          name: call.name,
          arguments: JSON.stringify(call.args || {}),
        },
      }));
    }
    return item;
  });
}

function toolToApiFunction(tool) {
  let parameters = { type: 'object', properties: {}, additionalProperties: true };
  const schema = tool?.schema;
  try {
    if (schema && typeof schema.toJSONSchema === 'function') {
      parameters = schema.toJSONSchema();
    } else if (schema && typeof schema === 'object' && schema.type) {
      parameters = schema;
    }
  } catch (error) {
    parameters = { type: 'object', properties: {}, additionalProperties: true };
  }
  if (parameters && typeof parameters === 'object') delete parameters.$schema;
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || tool.name,
      parameters,
    },
  };
}

class ApiChatModel extends BaseChatModel {
  constructor(fields = {}) {
    super(fields);
    this.adapter = fields.adapter;
    this.project = fields.project;
    this.stage = fields.stage || 'agent';
    this.temperature = fields.temperature;
    this.signal = fields.signal;
    this.onLog = fields.onLog;
    this.onEvent = fields.onEvent;
    this.boundTools = Array.isArray(fields.boundTools) ? fields.boundTools : [];
  }

  _llmType() {
    return 'magnus-api-chat-model';
  }

  bindTools(tools) {
    return new ApiChatModel({
      adapter: this.adapter,
      project: this.project,
      stage: this.stage,
      temperature: this.temperature,
      signal: this.signal,
      onLog: this.onLog,
      onEvent: this.onEvent,
      boundTools: tools || [],
    });
  }

  async _generate(messages) {
    if (!this.adapter) throw new Error('ApiChatModel requires adapter.');
    const apiMessages = toApiMessages(messages);
    const apiTools = this.boundTools.map(toolToApiFunction).filter(tool => tool.function.name);
    if (typeof this.onEvent === 'function') {
      this.onEvent({
        type: 'llm.input',
        runtime: 'langchain',
        stage: this.stage,
        messages: apiMessages,
        toolCount: apiTools.length,
        toolNames: apiTools.map(tool => tool.function.name),
      });
    }
    const result = await runChatCompletion(this.adapter, {
      messages: apiMessages,
      tools: apiTools,
    }, {
      signal: this.signal,
      stage: this.stage,
      temperature: this.temperature,
      onLog: this.onLog,
    });
    const rawText = String(result?.rawText || '').trim();
    if (typeof this.onEvent === 'function') {
      this.onEvent({
        type: 'llm.output',
        runtime: 'langchain',
        stage: this.stage,
        rawText,
        toolCalls: result.toolCalls || [],
      });
    }
    const toolCalls = Array.isArray(result.toolCalls) ? result.toolCalls : [];
    const message = toolCalls.length
      ? new AIMessage({ content: rawText || '', tool_calls: toolCalls })
      : new AIMessage(rawText);
    return {
      generations: [{
        text: rawText,
        message,
      }],
    };
  }
}

module.exports = {
  ApiChatModel,
  toApiMessages,
  toolToApiFunction,
};

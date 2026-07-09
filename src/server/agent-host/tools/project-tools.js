'use strict';

const { executeDiscoveryRequest } = require('../../experience/discovery-executor');
const { createToolProvider } = require('./provider');
const { buildTool } = require('./tool');

const PROJECT_TOOLS = [
  buildTool({
    name: 'read_file',
    title: 'Read File',
    description: 'Read one or more project source files, optionally focused around literal terms.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            files: { type: 'array', items: { type: 'string' } },
          },
          required: ['files'],
        },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['scope'],
    },
    call: ({ project, input, textCache }) => executeDiscoveryRequest(project, {
      ...input,
      operation: 'read_file',
    }, textCache),
  }),
  buildTool({
    name: 'search_text',
    title: 'Search Text',
    description: 'Search project source files for literal text.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            roots: { type: 'array', items: { type: 'string' } },
          },
          required: ['roots'],
        },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['scope', 'terms'],
    },
    call: ({ project, input, textCache }) => executeDiscoveryRequest(project, {
      ...input,
      operation: 'search_text',
    }, textCache),
  }),
  buildTool({
    name: 'find_files',
    title: 'Find Files',
    description: 'Find files by path fragments inside a project scope.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            roots: { type: 'array', items: { type: 'string' } },
          },
        },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
      },
    },
    call: ({ project, input, textCache }) => executeDiscoveryRequest(project, {
      ...input,
      operation: 'find_files',
    }, textCache),
  }),
  buildTool({
    name: 'find_symbol',
    title: 'Find Symbol',
    description: 'Search for source symbols using word-boundary matching.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            roots: { type: 'array', items: { type: 'string' } },
          },
          required: ['roots'],
        },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['scope', 'terms'],
    },
    call: ({ project, input, textCache }) => executeDiscoveryRequest(project, {
      ...input,
      operation: 'find_symbol',
    }, textCache),
  }),
  buildTool({
    name: 'find_endpoint',
    title: 'Find Endpoint',
    description: 'Search for endpoint strings or API path fragments.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            roots: { type: 'array', items: { type: 'string' } },
          },
          required: ['roots'],
        },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['scope', 'terms'],
    },
    call: ({ project, input, textCache }) => executeDiscoveryRequest(project, {
      ...input,
      operation: 'find_endpoint',
    }, textCache),
  }),
  buildTool({
    name: 'find_imports',
    title: 'Find Imports',
    description: 'Read imports used by a target source file.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        scope: {
          type: 'object',
          properties: {
            roots: { type: 'array', items: { type: 'string' } },
          },
        },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['target'],
    },
    call: ({ project, input, textCache }) => executeDiscoveryRequest(project, {
      ...input,
      operation: 'find_imports',
    }, textCache),
  }),
  buildTool({
    name: 'find_importers',
    title: 'Find Importers',
    description: 'Find files that import, require, re-export, or dynamically import a target source file.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        scope: {
          type: 'object',
          properties: {
            roots: { type: 'array', items: { type: 'string' } },
          },
        },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['target'],
    },
    call: ({ project, input, textCache }) => executeDiscoveryRequest(project, {
      ...input,
      operation: 'find_importers',
    }, textCache),
  }),
  buildTool({
    name: 'find_related_examples',
    title: 'Find Related Examples',
    description: 'Find representative project examples that match one or more implementation terms.',
    category: 'project',
    access: 'read',
    isReadOnly: () => true,
    isConcurrencySafe: () => true,
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'object',
          properties: {
            roots: { type: 'array', items: { type: 'string' } },
          },
          required: ['roots'],
        },
        terms: { type: 'array', items: { type: 'string' } },
        maxResults: { type: 'number' },
        maxLinesPerResult: { type: 'number' },
      },
      required: ['scope', 'terms'],
    },
    call: ({ project, input, textCache }) => executeDiscoveryRequest(project, {
      ...input,
      operation: 'find_related_examples',
    }, textCache),
  }),
];

const projectToolProvider = createToolProvider({
  id: 'builtin.project-crud',
  title: 'Project CRUD Tools',
  source: 'builtin',
  description: 'Default project source reading, searching, symbol lookup, endpoint lookup, and import tracing tools.',
  tools: PROJECT_TOOLS,
});

module.exports = {
  projectToolProvider,
};

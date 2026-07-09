# Magnus Agent Host

`agent-host/` is the boundary for agent capabilities exposed to the UI and to future model-driven loops.

## Structure

```text
agent-host
├─ llm-adapter.js
├─ loop
│  ├─ protocol.js
│  └─ runner.js
├─ tools
│  ├─ tool.js
│  ├─ provider.js
│  ├─ mcp-provider.js
│  ├─ registry.js
│  ├─ project-tools.js
│  └─ experience-tools.js
├─ resources
│  ├─ provider.js
│  ├─ project-resources.js
│  └─ registry.js
├─ experiences
│  └─ registry.js
├─ http-routes.js
└─ index.js
```

## Responsibilities

- `llm-adapter.js`: one host-level wrapper around model execution.
- `loop/protocol.js`: shared JSON protocol between the LLM and local executor.
- `loop/runner.js`: generic agent loop: prompt model, parse tool calls, execute tools, append observations, resolve final answer.
- `tools/tool.js`: the minimal Tool object protocol. A tool declares schema, read/write semantics, concurrency, validation, permission hook, and `call()`.
- `tools/provider.js`: the ToolProvider protocol. Providers own a group of tools and are the only extension unit registered into the host.
- `tools/mcp-provider.js`: factory for wrapping MCP server tools as normal Magnus ToolProviders.
- `tools/registry.js`: provider registry and execution router. It must not know about project/experience/MCP internals.
- `tools/project-tools.js`: builtin project CRUD/read/search provider. This is Magnus' default local source capability.
- `tools/experience-tools.js`: builtin Experience provider. Experience enhancement is a tool, not a special route.
- `resources/provider.js`: ResourceProvider protocol.
- `resources/project-resources.js`: builtin project resources: `Project.md`, project file inventory, and task memory.
- `resources/registry.js`: provider registry for readable context. It must not embed prompt-specific data.
- `experiences/`: registry facade for project experiences.
- `http-routes.js`: HTTP exposure for host registries. `server.js` must only delegate to this module.
- `index.js`: programmatic host facade.

## Extension Model

```js
registerAgentToolProvider(createToolProvider({
  id: 'mcp.github',
  source: 'mcp',
  tools: [
    buildTool({
      name: 'mcp__github__search_code',
      inputSchema: { type: 'object', properties: {} },
      isReadOnly: () => true,
      isConcurrencySafe: () => true,
      call: async context => ({ ... })
    })
  ]
}))
```

MCP tools use the same extension point:

```js
registerAgentToolProvider(createMcpToolProvider({
  serverName: 'github',
  tools: [{ name: 'search_code', inputSchema: { type: 'object', properties: {} } }],
  executeTool: async ({ toolName, input }) => ({ toolName, input })
}))
```

Default capabilities are mounted by `tools/registry.js`:

- `builtin.project-crud`: `read_file`, `search_text`, `find_files`, `find_symbol`, `find_endpoint`, `find_imports`, `find_importers`, `find_related_examples`.
- `builtin.experience`: `enhance_with_experience`.
- `builtin.project-resources`: `magnus://project/context`, `magnus://project/files`, `magnus://task/memory`.

Future MCP, installed packages, or project-defined capabilities should only add a new ToolProvider. They should not add ad-hoc route branches or special cases in the agent loop.

## Boundaries

- Do not import UI, browser bridge, or DOM search internals into the registries.
- Do not store Experience under `skills/` or expose `Skill` fields.
- New executable capabilities should be added as Tool providers, not as ad-hoc server routes.
- New readable context should be added as Resources, not embedded into prompts directly.
- Project-specific reusable knowledge is Experience, not Tool and not Resource.

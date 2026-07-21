# Magnus Agent Host

`agent-host/` is the boundary for agent capabilities exposed to the UI and to future model-driven loops.

## Structure

```text
agent-host
├─ llm-adapter.js
├─ langchain
│  ├─ api-chat-model.js
│  ├─ mcp-runtime.js
│  ├─ runtime.js
│  └─ tool-adapter.js
├─ capabilities.js
├─ tools
│  ├─ tool.js
│  ├─ provider.js
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

- `llm-adapter.js`: host-level entry for LangChain LLM and tool-capable agent runs.
- `langchain/api-chat-model.js`: adapts Magnus API model configs into a LangChain chat model.
- `langchain/tool-adapter.js`: wraps Magnus tools as LangChain tools.
- `langchain/mcp-runtime.js`: loads configured MCP servers through `@langchain/mcp-adapters` and returns native LangChain tools for the current agent run.
- `langchain/runtime.js`: creates the LangChain agent runtime from prompt + model + Magnus tools + MCP tools.
- `capabilities.js`: normalizes `configAction` and filters which capability families are exposed to a run.
- `tools/tool.js`: the minimal Tool object protocol. A tool declares schema, read/write semantics, concurrency, validation, permission hook, and `call()`.
- `tools/provider.js`: the ToolProvider protocol. Providers own a group of tools and are the only extension unit registered into the host.
- `tools/registry.js`: provider registry and execution router. It must not know about project/experience internals. MCP bypasses this registry and is loaded by LangChain at runtime.
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
  id: 'project.custom',
  source: 'project',
  tools: [
    buildTool({
      name: 'project_search_code',
      inputSchema: { type: 'object', properties: {} },
      isReadOnly: () => true,
      isConcurrencySafe: () => true,
      call: async context => ({ ... })
    })
  ]
}))
```

MCP tools are not Magnus ToolProviders. Add servers in `~/.magnus/mcp.json` or `<project>/.mcp.json`; each LangChain agent run loads them as native tools such as `mcp__github__search_code`.

Agent runs decide exposed capability families with `configAction`, for example `['builtin', 'skill', 'mcp']`. This keeps future capability types pluggable without adding one-off boolean switches.

Default capabilities are mounted by `tools/registry.js`:

- `builtin.project-crud`: `read_file`, `search_text`, `find_files`, `find_symbol`, `find_endpoint`, `find_imports`, `find_importers`, `find_related_examples`, `trace_file_evidence_flow`, `read_closed_blocks`.
- `builtin.experience`: `enhance_with_experience`.
- `builtin.project-resources`: `magnus://project/context`, `magnus://project/files`, `magnus://task/memory`.

Future built-in, installed-package, or project-defined local capabilities should add a ToolProvider. MCP servers should be added through MCP config and consumed by LangChain at runtime.

## Boundaries

- Do not import UI, browser bridge, or DOM search internals into the registries.
- Do not store Experience under `skills/` or expose `Skill` fields.
- New executable capabilities should be added as Tool providers, not as ad-hoc server routes.
- New readable context should be added as Resources, not embedded into prompts directly.
- Project-specific reusable knowledge is Experience, not Tool and not Resource.

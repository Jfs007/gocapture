# Magnus Agent Host

`agent-host/` is the boundary for agent capabilities exposed to the UI and to future model-driven loops.

## Structure

```text
agent-host
├─ llm-adapter.js
├─ langchain
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
├─ http-routes.js
└─ index.js

model/providers
├─ model-adapter.js
├─ deepseek-adapter.js
└─ registry.js
```

## Responsibilities

- `llm-adapter.js`: host-level entry for LangChain LLM and tool-capable agent runs.
- `langchain/tool-adapter.js`: wraps Magnus tools as LangChain tools.
- `langchain/mcp-runtime.js`: loads configured MCP servers through `@langchain/mcp-adapters` and returns native LangChain tools for the current agent run.
- `langchain/runtime.js`: creates the LangChain agent runtime from prompt + an official provider model + Magnus tools + MCP tools.
- `model/providers/model-adapter.js`: normalizes Magnus model configuration and shared transport options. It does not implement chat, tool calling, or response parsing.
- `model/providers/deepseek-adapter.js`: creates the official `@langchain/deepseek` `ChatDeepSeek` model.
- `model/providers/registry.js`: resolves a Magnus model configuration to its provider adapter and official LangChain model.
- `capabilities.js`: normalizes `configAction` and filters which capability families are exposed to a run.
- `tools/tool.js`: the minimal Tool object protocol. A tool declares schema, read/write semantics, concurrency, validation, permission hook, and `call()`.
- `tools/provider.js`: the ToolProvider protocol. Providers own a group of tools and are the only extension unit registered into the host.
- `tools/registry.js`: provider registry and execution router. It must not know about project/experience internals. MCP bypasses this registry and is loaded by LangChain at runtime.
- `tools/project-tools.js`: builtin project CRUD/read/search provider. This is Magnus' default local source capability.
- `tools/experience-tools.js`: builtin Experience provider. Experience enhancement is a tool, not a special route.
- `resources/provider.js`: ResourceProvider protocol.
- `resources/project-resources.js`: builtin project resources: `Project.md`, project file inventory, and task memory.
- `resources/registry.js`: provider registry for readable context. It must not embed prompt-specific data.
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
- `builtin.experience`: `recon_inspect`, `experience_load`, `recon_search`, `recon_record`.
- `builtin.project-resources`: `magnus://project/context`, `magnus://project/files`, `magnus://task/memory`.

The post-location planning flow is one LangChain agent. Recon and Experience are ordinary tools selected by that agent; they must not start another model loop or become a fixed preprocessing stage.

Future built-in, installed-package, or project-defined local capabilities should add a ToolProvider. MCP servers should be added through MCP config and consumed by LangChain at runtime.

## Boundaries

- Do not import UI, browser bridge, or DOM search internals into the registries.
- Do not store Experience under `skills/` or expose `Skill` fields.
- New executable capabilities should be added as Tool providers, not as ad-hoc server routes.
- New readable context should be added as Resources, not embedded into prompts directly.
- Project-specific reusable knowledge is Experience, not Tool and not Resource.

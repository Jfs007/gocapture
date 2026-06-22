# Source Locate Rules

Magnus source locating must stay evidence-driven. Do not add framework-specific,
component-library-specific, or scene-specific patches to make one case pass.

## General Rules

- Do not classify selections by hardcoded UI component names such as message,
  modal, dialog, toast, table, menu, drawer, or notification to change locating
  behavior.
- Do not infer source ownership from a UI type. A selected node may come from a
  route page, a shared component, a utility module, a request interceptor, a
  configuration file, generated render code, or runtime data.
- Route hits are anchors, not final proof. A route entry file should not
  override stronger local evidence from text, class, style, attributes, import
  usage, API usage, or literal-definition links.
- When a route hit and non-route candidates conflict, compare evidence strength
  instead of hard filtering by route scope. Route scope can narrow search, but it
  must not hide candidates that directly match the selected UI evidence.
- Local retrieval should only provide candidate files and evidence. Model
  locating can produce a coarse direction, but the final modifying agent must
  re-read and verify source before editing.
- If a case appears special, first express the solution as a generic evidence
  rule. If it cannot be expressed generically, do not implement it in the
  locator.

## Candidate Filtering

- Prefer candidates with direct evidence from the current selection or expanded
  selection.
- Keep route entry files only as routing context unless they also have local
  evidence or are part of a verified import chain.
- Shared or utility files may be valid when they contain direct evidence or are
  connected by a verified reference chain.
- Avoid adding allow-lists or deny-lists based on filenames, UI libraries, or
  component names unless they are broad project hygiene rules such as excluding
  `node_modules`, build output, or minified bundles.

# GoCapture Side Panel Demo

This demo runs a local browser shell with a right-side iframe that simulates Chrome Side Panel loading GoCapture UI.

```bash
npm run demo:side
```

- Browser shell: `http://127.0.0.1:5197/`
- Side panel iframe UI: `http://127.0.0.1:5197/gocapture-ui.html`

The dev server injects a small SSE reload client into HTML files. Editing files under `demo/side` refreshes open demo pages automatically.

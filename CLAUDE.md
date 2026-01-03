# Critique - Claude Code Guidelines

## Meta

When discovering reusable patterns (tooling, commands, architecture) that would help future projects, update `docs/INTERNAL_APP_TEMPLATE.md`.

## Running Servers

```bash
npm start  # runs both API (3001) + Vite (5173) concurrently
```

Kill before restarting:
```bash
pkill -f "node server.js"; pkill -f "vite"
```

## Testing

Use Chrome MCP to verify UI changes:

1. `mcp__chrome-devtools__navigate_page` to load the app
2. `mcp__chrome-devtools__take_snapshot` to inspect DOM structure
3. `mcp__chrome-devtools__take_screenshot` for visual verification

Test URL-based loading: `http://localhost:5173?file=example.md`

Test API directly:
```bash
curl http://localhost:3001/api/files          # list files
curl http://localhost:3001/api/files/example.md  # get content
```

## File Structure

- `server.js` — Express API serving markdown from `./docs/`
- `src/App.jsx` — Session state, URL param handling
- `src/components/Editor.jsx` — BlockNote wrapper
- `src/components/ImportZone.jsx` — Drag-drop file upload

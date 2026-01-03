# Internal Single-Page App + Server Template

Reusable patterns for React + Vite + Express internal tools.

---

## Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | React 19 + Vite | Fast dev, HMR |
| Styling | Tailwind | Utility-first CSS |
| Server | Express 5 | API + static serving |
| Build | vite-plugin-singlefile | Single HTML output (optional) |

---

## Project Init

```bash
npm create vite@latest my-app -- --template react
cd my-app
npm install
npm install -D tailwindcss postcss autoprefixer concurrently
npx tailwindcss init -p
npm install express
```

---

## File Structure

```
my-app/
├── server.js           # Express API + static server
├── vite.config.js      # Dev proxy config
├── package.json
├── docs/               # Data directory (markdown, JSON, etc.)
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   └── components/
└── dist/               # Production build output
```

---

## Vite Config (Dev Proxy)

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

---

## Express Server Template

```js
// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'docs');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// API routes
app.get('/api/files', (req, res) => {
  const files = fs.readdirSync(DATA_DIR);
  res.json(files);
});

app.get('/api/files/:filename', (req, res) => {
  const filePath = path.join(DATA_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
});

// Serve static frontend (production)
app.use(express.static(path.join(__dirname, 'dist')));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
```

> **Express 5.x Note**: Wildcard routes use `{*splat}` syntax, not `*`.

---

## Package.json Scripts

```json
{
  "scripts": {
    "start": "concurrently \"npm:serve\" \"npm:dev\"",
    "dev": "vite",
    "build": "vite build",
    "serve": "node server.js",
    "preview": "vite preview"
  }
}
```

---

## URL Parameter Pattern

Deep-link to specific content via query params:

```jsx
// App.jsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');
  if (file) {
    fetch(`/api/files/${encodeURIComponent(file)}`)
      .then(res => res.ok ? res.text() : Promise.reject('Not found'))
      .then(setContent)
      .catch(setError);
  }
}, []);
```

Usage: `http://localhost:5173?file=example.md`

---

## Development Workflow

```bash
# Start both servers
npm start

# Kill before restart
pkill -f "node server.js"; pkill -f "vite"

# Test API directly
curl http://localhost:3001/api/files
curl http://localhost:3001/api/files/example.md
```

---

## Production Build

```bash
npm run build      # outputs to dist/
npm run serve      # serves dist/ + API on port 3001
```

---

## Testing with Chrome MCP

```bash
# Navigate
mcp__chrome-devtools__navigate_page url="http://localhost:5173?file=test.md"

# Inspect DOM
mcp__chrome-devtools__take_snapshot

# Visual check
mcp__chrome-devtools__take_screenshot

# Interact
mcp__chrome-devtools__click uid="..."
mcp__chrome-devtools__fill uid="..." value="..."
```

---

## Styling (Dark Theme Boilerplate)

```css
/* index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #111111;
  --accent: #c4a35a;
  --text-primary: #e8e4dd;
  --text-secondary: #6b6560;
  --border: #2a2725;
}

body {
  margin: 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Your-Font', system-ui, sans-serif;
}
```

---

## CLAUDE.md Template

Include at project root for Claude Code context:

```markdown
# Project Name

## Running

\`\`\`bash
npm start  # API (3001) + Vite (5173)
\`\`\`

Kill: `pkill -f "node server.js"; pkill -f "vite"`

## Testing

- Chrome MCP: navigate, snapshot, screenshot
- API: `curl http://localhost:3001/api/...`

## Structure

- `server.js` — Express API
- `src/App.jsx` — Main component
- `docs/` — Data files
```

---

## Checklist

- [ ] Vite proxy configured for `/api`
- [ ] Express serves `dist/` in production
- [ ] `npm start` runs both servers
- [ ] URL params for deep linking
- [ ] CLAUDE.md at root
- [ ] Data directory created (`docs/` or similar)

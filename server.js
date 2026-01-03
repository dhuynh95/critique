import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Configurable markdown directory (default: ./docs)
const DOCS_DIR = process.env.DOCS_DIR || path.join(__dirname, 'docs');

// Ensure docs directory exists
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

// Parse text/plain body
app.use(express.text({ type: 'text/plain' }))

// API: List all markdown files (sorted by mtime, most recent first)
app.get('/api/files', (req, res) => {
  fs.readdir(DOCS_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Cannot read docs directory' });
    const mdFiles = files.filter(f => f.endsWith('.md'));
    const withStats = mdFiles.map(name => {
      const stat = fs.statSync(path.join(DOCS_DIR, name));
      return { name, mtime: stat.mtimeMs };
    });
    withStats.sort((a, b) => b.mtime - a.mtime);
    res.json(withStats);
  });
});

// API: Get markdown file content
app.get('/api/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.endsWith('.md')) {
    return res.status(400).json({ error: 'Only .md files allowed' });
  }
  const filePath = path.join(DOCS_DIR, filename);

  fs.readFile(filePath, 'utf-8', (err, content) => {
    if (err) return res.status(404).json({ error: 'File not found' });
    res.type('text/plain').send(content);
  });
});

// API: Write markdown file
app.put('/api/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.endsWith('.md')) {
    return res.status(400).json({ error: 'Only .md files allowed' });
  }
  const filePath = path.join(DOCS_DIR, filename);
  fs.writeFile(filePath, req.body, 'utf-8', (err) => {
    if (err) return res.status(500).json({ error: 'Failed to write file' });
    res.json({ ok: true });
  });
});

// API: Get annotations for a file
app.get('/api/files/:filename/annotations', (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.endsWith('.md')) {
    return res.status(400).json({ error: 'Only .md files allowed' });
  }
  const annotationsPath = path.join(DOCS_DIR, `${filename}.comments.json`);
  fs.readFile(annotationsPath, 'utf-8', (err, content) => {
    if (err) return res.json({ comments: [], suggestModeOriginal: null });
    try {
      res.json(JSON.parse(content));
    } catch {
      res.json({ comments: [], suggestModeOriginal: null });
    }
  });
});

// API: Save annotations for a file
app.use(express.json());
app.put('/api/files/:filename/annotations', (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.endsWith('.md')) {
    return res.status(400).json({ error: 'Only .md files allowed' });
  }
  const annotationsPath = path.join(DOCS_DIR, `${filename}.comments.json`);
  fs.writeFile(annotationsPath, JSON.stringify(req.body, null, 2), 'utf-8', (err) => {
    if (err) return res.status(500).json({ error: 'Failed to write annotations' });
    res.json({ ok: true });
  });
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'dist')));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Critique server: http://localhost:${PORT}`);
  console.log(`Docs directory: ${DOCS_DIR}`);
  console.log(`Usage: http://localhost:${PORT}?file=example.md`);
});

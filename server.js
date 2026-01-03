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

// API: List all markdown files
app.get('/api/files', (req, res) => {
  fs.readdir(DOCS_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Cannot read docs directory' });
    const mdFiles = files.filter(f => f.endsWith('.md'));
    res.json(mdFiles);
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

import React, { useState, useRef, useEffect } from 'react';
import { FileUp } from 'lucide-react';

export default function ImportZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [recentFiles, setRecentFiles] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch('/api/files')
      .then(res => res.json())
      .then(files => setRecentFiles(files.slice(0, 5)))
      .catch(() => {});
  }, []);

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.md')) return;

    const content = await file.text();
    const filename = file.name;

    // Check if file exists on server
    const res = await fetch(`/api/files/${encodeURIComponent(filename)}`);
    if (res.ok) {
      const overwrite = window.confirm(`"${filename}" already exists. Overwrite?`);
      if (!overwrite) return;
    }

    // Save to server then redirect
    await fetch(`/api/files/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: content,
    });

    window.location.href = `?file=${encodeURIComponent(filename)}`;
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleChange = (e) => {
    handleFile(e.target.files[0]);
  };

  const formatDate = (mtime) => {
    const date = new Date(mtime);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="import-zone-container">
      <div className="import-zone-grid" />

      {recentFiles.length > 0 && (
        <div className="recent-files">
          <span className="recent-files-title">Recent</span>
          <div className="recent-files-list">
            {recentFiles.map(f => (
              <a key={f.name} href={`?file=${encodeURIComponent(f.name)}`} className="recent-files-row">
                <span className="recent-files-name">{f.name}</span>
                <span className="recent-files-date">{formatDate(f.mtime)}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div
        className={`import-zone ${isDragOver ? 'import-zone--active' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".md"
          onChange={handleChange}
          className="hidden"
        />

        <div className="import-zone-content">
          <div className={`import-zone-icon ${isDragOver ? 'import-zone-icon--active' : ''}`}>
            <FileUp size={32} strokeWidth={1.5} />
          </div>

          <div className="import-zone-text">
            <span className="import-zone-title">
              {isDragOver ? 'Release to import' : 'Drop markdown here'}
            </span>
            <span className="import-zone-subtitle">
              or click to browse
            </span>
          </div>
        </div>

        <div className={`import-zone-glow ${isDragOver ? 'import-zone-glow--active' : ''}`} />
      </div>
    </div>
  );
}

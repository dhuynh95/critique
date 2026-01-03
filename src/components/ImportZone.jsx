import React, { useState, useRef } from 'react';
import { FileUp } from 'lucide-react';

export default function ImportZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);

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

  return (
    <div className="import-zone-container">
      <div className="import-zone-grid" />

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

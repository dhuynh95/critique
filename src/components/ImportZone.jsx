import React, { useState, useRef } from 'react';
import { FileUp } from 'lucide-react';

export default function ImportZone({ onImport }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.name.endsWith('.md')) return;
    const reader = new FileReader();
    reader.onload = (e) => onImport(e.target.result);
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
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
    const file = e.target.files[0];
    handleFile(file);
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

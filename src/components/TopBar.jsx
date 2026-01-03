import React, { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';

export default function TopBar({
  filename,
  mode,
  onModeChange,
  onCopyDiff,
  onAcceptAll,
  onRejectAll,
  hasSuggestions,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopyDiff();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="topbar">
      <span className="topbar-filename">{filename}</span>

      <div className="topbar-actions">
        <div className="topbar-toggle">
          <button
            className={`topbar-toggle-btn ${mode === 'edit' ? 'active' : ''}`}
            onClick={() => onModeChange('edit')}
          >
            Edit
          </button>
          <button
            className={`topbar-toggle-btn ${mode === 'suggest' ? 'active' : ''}`}
            onClick={() => onModeChange('suggest')}
          >
            Suggest
          </button>
        </div>

        {hasSuggestions && (
          <>
            <button className="topbar-btn topbar-btn-accept" onClick={onAcceptAll} title="Accept all">
              <Check size={16} />
            </button>
            <button className="topbar-btn topbar-btn-reject" onClick={onRejectAll} title="Reject all">
              <X size={16} />
            </button>
          </>
        )}

        <button className="topbar-btn" onClick={handleCopy} title="Copy diff (⌘⇧D)">
          <Copy size={16} />
          {copied && <span className="topbar-copied">Copied!</span>}
        </button>
      </div>
    </div>
  );
}

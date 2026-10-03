import React from "react";
import { 
  Compass, 
  Upload, 
  FileText, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  FileDown
} from "lucide-react";

export default function Navbar({
  documents = [],
  activeDocId,
  onSelectDoc,
  onOpenUpload,
  onOpenExport,
  notesCount = 0,
  serverStatus = "checking",
  isViewerOpen = false,
  onToggleViewer
}) {
  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="brand-icon-box">
          <Compass size={22} color="#ffffff" />
        </div>
        <div>
          <span className="brand-title">RAG Navigator</span>
          <span className="brand-badge" style={{ marginLeft: 8 }}>v1.0</span>
        </div>
      </div>

      <div className="nav-center">
        {documents.length > 0 ? (
          <div className="doc-selector-wrap">
            <FileText size={16} color="var(--accent-sky)" />
            <select
              className="doc-select"
              value={activeDocId || ""}
              onChange={(e) => onSelectDoc(e.target.value)}
              title="Select Active Document"
            >
              {documents.map((doc) => (
                <option key={doc.doc_id} value={doc.doc_id}>
                  {doc.filename} ({doc.page_count} pages)
                </option>
              ))}
            </select>
          </div>
        ) : (
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            No documents loaded yet
          </span>
        )}

        <div className={`status-pill ${serverStatus === "offline" ? "offline" : ""}`}>
          <span className="status-dot"></span>
          {serverStatus === "healthy" ? "Vector RAG Online" : serverStatus}
        </div>
      </div>

      <div className="nav-actions">
        {activeDocId && (
          <button
            className="btn btn-secondary"
            onClick={onToggleViewer}
            title={isViewerOpen ? "Close Document Viewer" : "Open Document Viewer"}
            style={{ 
              borderColor: isViewerOpen ? "var(--accent-sky)" : "var(--border-subtle)",
              background: isViewerOpen ? "rgba(56, 189, 248, 0.12)" : "var(--bg-tertiary)"
            }}
          >
            <FileText size={16} color={isViewerOpen ? "var(--accent-sky)" : "var(--text-secondary)"} />
            <span>{isViewerOpen ? "Hide PDF" : "View PDF"}</span>
          </button>
        )}

        <button
          className="btn btn-secondary btn-export-notes"
          onClick={onOpenExport}
          title="Export Generated Study Notes to PDF or Markdown Document"
          disabled={notesCount === 0}
          style={{ 
            opacity: notesCount === 0 ? 0.6 : 1,
            cursor: notesCount === 0 ? "not-allowed" : "pointer" 
          }}
        >
          <FileDown size={16} color="var(--accent-sky)" />
          <span>Export Notes</span>
          {notesCount > 0 && (
            <span className="nav-notes-badge">{notesCount}</span>
          )}
        </button>

        <button
          className="btn btn-primary"
          onClick={onOpenUpload}
        >
          <Upload size={16} />
          <span>Upload PDF</span>
        </button>
      </div>
    </header>
  );
}


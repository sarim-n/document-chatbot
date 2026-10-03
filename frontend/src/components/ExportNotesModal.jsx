import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Download, 
  X, 
  Check, 
  FileCode, 
  Compass, 
  Sparkles,
  BookOpen,
  CheckSquare,
  Square,
  AlertCircle,
  FolderOpen,
  ExternalLink,
  CheckCircle2,
  HardDrive
} from "lucide-react";
import { exportNotesDocument, openExportFile, openExportFolder } from "../api";

export default function ExportNotesModal({
  isOpen,
  onClose,
  messages = [],
  activeDoc = null,
  initialSelectedNote = null // If user clicked "Export this note"
}) {
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("pdf"); // "pdf" | "markdown"
  const [includeCitations, setIncludeCitations] = useState(true);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportedResult, setExportedResult] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Extract all assistant notes paired with their corresponding user question
  const notesList = React.useMemo(() => {
    const list = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === "assistant" && messages[i].content) {
        // Find preceding user question if available
        let question = "Research Query";
        for (let j = i - 1; j >= 0; j--) {
          if (messages[j].role === "user") {
            question = messages[j].content;
            break;
          }
        }
        list.push({
          index: list.length,
          msgIndex: i,
          question: question,
          answer: messages[i].content,
          citations: messages[i].citations || [],
          timestamp: messages[i].timestamp || Date.now() / 1000
        });
      }
    }
    return list;
  }, [messages]);

  // Reset state when modal opens or activeDoc changes
  useEffect(() => {
    if (isOpen) {
      setExportError(null);
      setExportedResult(null);
      setActionNotice(null);
      const docBase = activeDoc?.filename ? activeDoc.filename.replace(/\.pdf$/i, "") : "Document";
      setTitle(`${docBase} - Study & Research Notes`);

      if (initialSelectedNote !== null && initialSelectedNote !== undefined) {
        // Find matching note in list
        const match = notesList.findIndex(n => n.msgIndex === initialSelectedNote);
        if (match !== -1) {
          setSelectedIndices(new Set([match]));
        } else {
          setSelectedIndices(new Set(notesList.map((_, idx) => idx)));
        }
      } else {
        // Default select all
        setSelectedIndices(new Set(notesList.map((_, idx) => idx)));
      }
    }
  }, [isOpen, activeDoc, initialSelectedNote, notesList]);

  if (!isOpen) return null;

  const handleToggleIndex = (idx) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === notesList.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(notesList.map((_, idx) => idx)));
    }
  };

  const handleExport = async () => {
    if (selectedIndices.size === 0) {
      setExportError("Please select at least one note to export.");
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setActionNotice(null);

    const chosenNotes = notesList
      .filter((_, idx) => selectedIndices.has(idx))
      .map(n => ({
        question: n.question,
        answer: n.answer,
        citations: n.citations,
        timestamp: n.timestamp
      }));

    try {
      const result = await exportNotesDocument({
        title: title.trim() || `${activeDoc?.filename || 'Document'} - Notes`,
        docName: activeDoc?.filename || "Document",
        notes: chosenNotes,
        format: format,
        includeCitations: includeCitations
      });

      setExportedResult(result);
    } catch (err) {
      setExportError(err.message || "Failed to generate document");
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenFileOnSystem = async () => {
    if (!exportedResult) return;
    try {
      setActionNotice("Opening document in default system app...");
      await openExportFile(exportedResult.filename);
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      setExportError("Could not open file directly: " + err.message);
    }
  };

  const handleOpenFolderOnSystem = async () => {
    if (!exportedResult) return;
    try {
      setActionNotice("Opening containing folder in Windows Explorer...");
      await openExportFolder(exportedResult.filename);
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      setExportError("Could not open folder: " + err.message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content export-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620 }}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge" style={{ background: "rgba(56, 189, 248, 0.15)", color: "var(--accent-sky)" }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="modal-title">Export Notes to Document</h3>
              <p className="modal-subtitle">
                Compile your generated Q&A answers, insights, and citations into a standalone document.
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {exportedResult ? (
            /* SUCCESS & DIRECT ACCESS VIEW */
            <div className="export-success-container">
              <div className="success-header-badge">
                <CheckCircle2 size={36} color="var(--accent-emerald)" />
                <h4>Document Ready!</h4>
                <p>Your notes were compiled and saved to disk. Choose how you'd like to access them:</p>
              </div>

              <div className="export-file-meta-box">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {exportedResult.format === "md" ? (
                    <FileCode size={28} color="var(--accent-indigo)" />
                  ) : (
                    <FileText size={28} color="var(--accent-sky)" />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "#ffffff", fontSize: "0.95rem", wordBreak: "break-all" }}>
                      {exportedResult.filename}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      Saved at: <code style={{ color: "var(--accent-sky)", background: "rgba(255,255,255,0.05)", padding: "1px 4px", borderRadius: 3 }}>{exportedResult.file_path}</code>
                    </div>
                  </div>
                </div>
              </div>

              {actionNotice && (
                <div className="action-notice-pill">
                  <span>{actionNotice}</span>
                </div>
              )}

              <div className="export-actions-grid">
                <button
                  type="button"
                  className="btn btn-primary export-action-btn"
                  onClick={handleOpenFileOnSystem}
                  title="Open this file directly in your computer's default app (e.g. Acrobat Reader, Chrome, or VSCode)"
                >
                  <ExternalLink size={16} />
                  <span>Open Document on Computer</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary export-action-btn"
                  onClick={handleOpenFolderOnSystem}
                  title="Open the folder containing this file in Windows File Explorer"
                >
                  <FolderOpen size={16} color="var(--accent-sky)" />
                  <span>Show in Folder</span>
                </button>

                <a
                  href={`http://localhost:8000${exportedResult.view_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary export-action-btn"
                  style={{ textDecoration: "none" }}
                  title="Open document in a browser tab"
                >
                  <ExternalLink size={16} color="var(--accent-emerald)" />
                  <span>Open in Browser Tab</span>
                </a>

                <a
                  href={`http://localhost:8000${exportedResult.download_url}`}
                  download={exportedResult.filename}
                  className="btn btn-secondary export-action-btn"
                  style={{ textDecoration: "none" }}
                  title="Download copy to your browser Downloads folder"
                >
                  <Download size={16} />
                  <span>Download Copy</span>
                </a>
              </div>
            </div>
          ) : (
            /* CONFIGURATION & GENERATION VIEW */
            <>
              {/* Document Title Input */}
              <div className="form-group">
                <label className="form-label">Document Title</label>
                <input
                  type="text"
                  className="text-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. OOP Unit 1 & 2 - Comprehensive Notes"
                />
              </div>

              {/* Format Selection */}
              <div className="form-group">
                <label className="form-label">Export Format</label>
                <div className="export-format-grid">
                  <button
                    type="button"
                    className={`export-format-card ${format === "pdf" ? "active" : ""}`}
                    onClick={() => setFormat("pdf")}
                  >
                    <div className="format-card-top">
                      <FileText size={20} color="var(--accent-sky)" />
                      <span className="format-badge">Recommended</span>
                    </div>
                    <div className="format-name">PDF Document (.pdf)</div>
                    <div className="format-desc">
                      Publication document with typography, question callout boxes, and verified citations.
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`export-format-card ${format === "markdown" ? "active" : ""}`}
                    onClick={() => setFormat("markdown")}
                  >
                    <div className="format-card-top">
                      <FileCode size={20} color="var(--accent-indigo)" />
                      <span className="format-badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent-indigo)" }}>Markdown</span>
                    </div>
                    <div className="format-name">Markdown (.md)</div>
                    <div className="format-desc">
                      Universal text document with headers and markdown tables. Compatible with Notion and Obsidian.
                    </div>
                  </button>
                </div>
              </div>

              {/* Citations toggle */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={includeCitations}
                    onChange={(e) => setIncludeCitations(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--accent-indigo)", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.88rem", color: "var(--text-primary)" }}>
                    Include verified source citations, page references, and similarity scores
                  </span>
                </label>
              </div>

              {/* Notes Selection */}
              <div className="form-group" style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Select Notes to Include ({selectedIndices.size} of {notesList.length})
                  </label>
                  {notesList.length > 0 && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={handleSelectAll}
                      style={{ fontSize: "0.78rem", color: "var(--accent-sky)", background: "transparent", border: "none", cursor: "pointer" }}
                    >
                      {selectedIndices.size === notesList.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>

                {notesList.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", background: "var(--bg-glass)", borderRadius: 8, border: "1px dashed var(--border-subtle)" }}>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      No assistant notes generated in this conversation yet. Ask a question first to create notes!
                    </p>
                  </div>
                ) : (
                  <div className="export-notes-list">
                    {notesList.map((item) => {
                      const isChecked = selectedIndices.has(item.index);
                      return (
                        <div
                          key={item.index}
                          className={`export-note-item ${isChecked ? "selected" : ""}`}
                          onClick={() => handleToggleIndex(item.index)}
                        >
                          <div className="note-checkbox">
                            {isChecked ? (
                              <CheckSquare size={17} color="var(--accent-sky)" />
                            ) : (
                              <Square size={17} color="var(--text-muted)" />
                            )}
                          </div>
                          <div className="note-item-info">
                            <div className="note-item-query">
                              {item.question}
                            </div>
                            <div className="note-item-preview">
                              {item.answer.replace(/[*#`_]/g, "").slice(0, 95)}...
                            </div>
                            {item.citations.length > 0 && (
                              <div className="note-item-citations">
                                <Compass size={11} />
                                <span>{item.citations.length} verified citation{item.citations.length > 1 ? "s" : ""}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {exportError && (
            <div className="error-banner" style={{ marginTop: 12 }}>
              <AlertCircle size={16} />
              <span>{exportError}</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {exportedResult ? (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              style={{ width: "100%" }}
            >
              Done & Close
            </button>
          ) : (
            <>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose}
                disabled={isExporting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExport}
                disabled={isExporting || notesList.length === 0 || selectedIndices.size === 0}
                style={{ minWidth: 160 }}
              >
                {isExporting ? (
                  <>
                    <div className="spinner-sm" />
                    <span>Compiling {format.toUpperCase()}...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Download Document</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

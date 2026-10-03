import React, { useState, useRef } from "react";
import { 
  Upload, 
  X, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  Layers, 
  BookOpen, 
  Cpu, 
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { uploadDocument } from "../api";

export default function FileUploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // "idle" | "uploading" | "success" | "error"
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [uploadedResult, setUploadedResult] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const selectFile = (selected) => {
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Only PDF documents (.pdf) are currently supported.");
      setStatus("error");
      return;
    }
    setFile(selected);
    setErrorMsg("");
    setStatus("idle");
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setProgressMsg("Extracting page text and TOC structure...");

    try {
      setTimeout(() => {
        setProgressMsg("Computing Sentence Transformer embeddings & indexing ChromaDB...");
      }, 1200);

      const result = await uploadDocument(file);
      setUploadedResult(result);
      setStatus("success");
      onUploadSuccess(result);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "Failed to process document");
    }
  };

  const handleClose = () => {
    setFile(null);
    setStatus("idle");
    setErrorMsg("");
    setUploadedResult(null);
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card upload-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-title-icon-box">
              <Upload size={18} color="#fff" />
            </div>
            <div>
              <h3 className="modal-title-text">Upload & Index Document</h3>
              <p className="modal-subtitle">Add a PDF for semantic search and citation navigation</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={handleClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {status !== "success" ? (
            <>
              {/* Dropzone or Selected File Card */}
              {!file ? (
                <div
                  className={`upload-dropzone ${isDragging ? "dragover" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept=".pdf"
                    onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
                  />
                  <div className="upload-dropzone-icon">
                    <FileText size={28} />
                  </div>
                  <div className="dropzone-text-group">
                    <p className="dropzone-main-title">
                      Drop your PDF document here
                    </p>
                    <p className="dropzone-sub-title">
                      or <span className="browse-link">browse files</span> from your computer
                    </p>
                  </div>
                  <div className="dropzone-format-badge">
                    <span>Supported format: PDF documents (.pdf)</span>
                  </div>
                </div>
              ) : (
                <div className="selected-file-card">
                  <div className="file-card-info">
                    <div className="file-type-badge">
                      <FileText size={22} color="var(--accent-sky)" />
                    </div>
                    <div className="file-details">
                      <span className="file-name" title={file.name}>
                        {file.name}
                      </span>
                      <span className="file-meta">
                        {formatFileSize(file.size)} • PDF Document
                      </span>
                    </div>
                  </div>
                  <div className="file-card-actions">
                    <button
                      type="button"
                      className="btn-file-action"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={status === "uploading"}
                      title="Change document"
                    >
                      <RefreshCw size={13} />
                      <span>Change</span>
                    </button>
                    <button
                      type="button"
                      className="btn-file-action text-rose"
                      onClick={() => setFile(null)}
                      disabled={status === "uploading"}
                      title="Remove file"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept=".pdf"
                    onChange={(e) => e.target.files?.[0] && selectFile(e.target.files[0])}
                  />
                </div>
              )}

              {/* Processing Pipeline Features Preview */}
              <div className="upload-features-grid">
                <div className="feature-pill">
                  <BookOpen size={13} color="var(--accent-sky)" />
                  <span>PyPDF Text & TOC</span>
                </div>
                <div className="feature-pill">
                  <Cpu size={13} color="var(--accent-indigo)" />
                  <span>Dense Embeddings</span>
                </div>
                <div className="feature-pill">
                  <Layers size={13} color="var(--accent-emerald)" />
                  <span>ChromaDB Vector Store</span>
                </div>
              </div>

              {/* Upload Status Banner */}
              {status === "uploading" && (
                <div className="upload-progress-box">
                  <div className="upload-progress-header">
                    <div className="progress-label">
                      <Loader2 size={16} className="animate-spin" color="var(--accent-sky)" />
                      <span>Indexing Pipeline Active</span>
                    </div>
                    <span className="progress-pulse-badge">Processing</span>
                  </div>
                  <div className="upload-progress-bar-bg">
                    <div className="upload-progress-bar-fill"></div>
                  </div>
                  <p className="progress-step-text">{progressMsg}</p>
                </div>
              )}

              {/* Error Banner */}
              {status === "error" && (
                <div className="upload-error-banner">
                  <AlertTriangle size={18} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Modal Actions Footer */}
              <div className="modal-footer">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleClose} 
                  disabled={status === "uploading"}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleUpload}
                  disabled={!file || status === "uploading"}
                >
                  {status === "uploading" ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Indexing Document...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      <span>Upload & Index Document</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Success Dashboard View */
            <div className="upload-success-view">
              <div className="success-badge-icon">
                <CheckCircle2 size={32} color="var(--accent-emerald)" />
              </div>
              
              <h3 className="success-title">Document Successfully Indexed!</h3>
              <p className="success-subtitle">
                <strong>{uploadedResult?.filename}</strong> is fully indexed into ChromaDB with <strong>{uploadedResult?.chunk_count} semantic chunks</strong>.
              </p>

              <div className="upload-stats-grid">
                <div className="upload-stat-card">
                  <div className="stat-icon-wrapper sky">
                    <FileText size={18} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{uploadedResult?.page_count}</span>
                    <span className="stat-label">Total Pages</span>
                  </div>
                </div>

                <div className="upload-stat-card">
                  <div className="stat-icon-wrapper indigo">
                    <Layers size={18} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{uploadedResult?.chunk_count}</span>
                    <span className="stat-label">Vector Chunks</span>
                  </div>
                </div>

                <div className="upload-stat-card">
                  <div className="stat-icon-wrapper emerald">
                    <BookOpen size={18} />
                  </div>
                  <div className="stat-content">
                    <span className="stat-value">{uploadedResult?.outline?.length || 0}</span>
                    <span className="stat-label">Outline Sections</span>
                  </div>
                </div>
              </div>

              <button className="btn btn-primary full-width-btn" onClick={handleClose}>
                <span>Start Asking Questions</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

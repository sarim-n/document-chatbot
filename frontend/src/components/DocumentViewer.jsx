import React, { useState, useEffect, useRef } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Eye, 
  Sparkles, 
  Search, 
  ExternalLink,
  HelpCircle,
  Bookmark,
  CheckCircle,
  X
} from "lucide-react";
import { getDocumentPage, getDocumentPdfUrl } from "../api";

function findBestSnippetMatch(fullText, snippet) {
  if (!fullText || !snippet) return null;
  const lowerFull = fullText.toLowerCase();
  const lowerSnippet = snippet.trim().toLowerCase();

  // 1. Try exact substring matches from longer to shorter
  for (let len = Math.min(100, lowerSnippet.length); len >= 25; len -= 10) {
    const sub = lowerSnippet.slice(0, len);
    const idx = lowerFull.indexOf(sub);
    if (idx !== -1) {
      return { start: idx, end: idx + len };
    }
  }

  // 2. Try phrase matching with whitespace normalization
  const words = snippet
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  for (let count = Math.min(words.length, 8); count >= 3; count--) {
    const pattern = words
      .slice(0, count)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s\\W]+');
    try {
      const rx = new RegExp(pattern, 'i');
      const match = rx.exec(fullText);
      if (match) {
        return { start: match.index, end: match.index + match[0].length };
      }
    } catch (e) {
      // Ignore regex syntax errors
    }
  }

  // 3. Try middle of snippet (skips initial chunk overlap)
  if (lowerSnippet.length > 50) {
    const midSub = lowerSnippet.slice(25, 80);
    const midIdx = lowerFull.indexOf(midSub);
    if (midIdx !== -1) {
      return { start: midIdx, end: midIdx + midSub.length };
    }
  }

  return null;
}

export default function DocumentViewer({
  doc,
  activePage = 1,
  onChangePage,
  highlightText = null,
  onAskAboutPage,
  onCloseViewer
}) {
  const [viewMode, setViewMode] = useState("pdf"); // "pdf" | "text"
  const [pageData, setPageData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [activeHighlight, setActiveHighlight] = useState(highlightText);
  const highlightRef = useRef(null);

  // Sync activeHighlight with prop
  useEffect(() => {
    setActiveHighlight(highlightText);
  }, [highlightText]);

  useEffect(() => {
    if (!doc?.doc_id) {
      setPageData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getDocumentPage(doc.doc_id, activePage)
      .then((data) => {
        if (isMounted) {
          setPageData(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(err);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [doc?.doc_id, activePage]);

  // Smoothly scroll highlighted snippet into view
  useEffect(() => {
    if (activeHighlight) {
      const timer = setTimeout(() => {
        if (highlightRef.current) {
          highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeHighlight, pageData]);

  if (!doc) {
    return (
      <div className="document-pane" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "var(--text-muted)", maxWidth: 360, padding: 20 }}>
          <FileText size={48} strokeWidth={1.5} style={{ marginBottom: 12, color: "rgba(255,255,255,0.15)" }} />
          <h3 style={{ fontSize: "1rem", color: "var(--text-secondary)", marginBottom: 6 }}>
            No Document Selected
          </h3>
          <p style={{ fontSize: "0.82rem" }}>
            Upload a PDF document or select one from the dropdown to inspect pages, sections, and source citations.
          </p>
        </div>
      </div>
    );
  }

  const totalPages = doc.page_count || 1;

  // Render text with highlighted snippets or search terms
  const renderContent = () => {
    if (!pageData?.text) {
      return (
        <div style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: 30 }}>
          {isLoading ? "Loading page content..." : "This page appears to contain no extractable text."}
        </div>
      );
    }

    const text = pageData.text;
    const activeSearch = localSearch.trim();

    // 1. Check for citation snippet match
    if (activeHighlight) {
      const match = findBestSnippetMatch(text, activeHighlight);
      if (match) {
        const before = text.slice(0, match.start);
        const matched = text.slice(match.start, match.end);
        const after = text.slice(match.end);

        return (
          <div className="doc-page-paper">
            <span>{before}</span>
            <mark ref={highlightRef} className="highlight-chunk">
              {matched}
            </mark>
            <span>{after}</span>
          </div>
        );
      }
    }

    // 2. Local search match
    if (activeSearch && text.toLowerCase().includes(activeSearch.toLowerCase())) {
      const parts = text.split(new RegExp(`(${activeSearch})`, 'gi'));
      return (
        <div className="doc-page-paper">
          {parts.map((part, i) =>
            part.toLowerCase() === activeSearch.toLowerCase() ? (
              <mark key={i} style={{ background: "rgba(6, 182, 212, 0.35)", color: "#fff", borderRadius: 2, padding: "1px 3px" }}>
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </div>
      );
    }

    // 3. Normal text
    return <div className="doc-page-paper">{text}</div>;
  };

  return (
    <div className="document-pane">
      {/* Header Bar */}
      <div className="doc-viewer-header">
        <div className="doc-info-block">
          <FileText size={18} color="var(--accent-sky)" />
          <span className="doc-title-text" title={doc.filename}>
            {doc.filename}
          </span>
        </div>

        <div className="doc-viewer-controls">
          {/* Pagination */}
          <div className="page-pagination">
            <button
              className="page-nav-btn"
              disabled={activePage <= 1}
              onClick={() => {
                setActiveHighlight(null);
                onChangePage(Math.max(1, activePage - 1));
              }}
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="page-indicator-text">
              Page {activePage} / {totalPages}
            </span>
            <button
              className="page-nav-btn"
              disabled={activePage >= totalPages}
              onClick={() => {
                setActiveHighlight(null);
                onChangePage(Math.min(totalPages, activePage + 1));
              }}
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === "pdf" ? "active" : ""}`}
              onClick={() => setViewMode("pdf")}
              title="View with yellow marker annotations on the PDF itself"
            >
              <Eye size={13} />
              <span>{activeHighlight ? "Highlighted PDF" : "Original PDF"}</span>
            </button>
            <button
              className={`view-mode-btn ${viewMode === "text" ? "active" : ""}`}
              onClick={() => setViewMode("text")}
              title="View clean text with section banner and citation cards"
            >
              <FileText size={13} />
              <span>Text View</span>
            </button>
          </div>

          {onCloseViewer && (
            <button
              className="btn btn-ghost btn-icon"
              onClick={onCloseViewer}
              title="Close PDF Viewer"
              style={{ marginLeft: 4 }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {/* Active Citation Notification Banner (shown on both views) */}
      {activeHighlight && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          background: "rgba(245, 158, 11, 0.14)",
          borderBottom: "1px solid rgba(245, 158, 11, 0.35)",
          color: "#fff",
          zIndex: 10
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
            <Sparkles size={16} color="var(--accent-amber)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--accent-amber)" }}>
              Highlighted Citation (Page {activePage}):
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              "{activeHighlight.slice(0, 80)}..."
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {viewMode === "text" ? (
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                onClick={() => setViewMode("pdf")}
              >
                <Eye size={12} />
                <span>See in PDF</span>
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.72rem", padding: "3px 8px" }}
                onClick={() => setViewMode("text")}
              >
                <FileText size={12} />
                <span>See in Text</span>
              </button>
            )}
            <button
              onClick={() => setActiveHighlight(null)}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}
              title="Dismiss highlight"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {viewMode === "text" ? (
        <div className="doc-text-container">
          {/* Section banner */}
          <div className="section-banner">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bookmark size={15} color="var(--accent-indigo)" />
              <span className="section-title-label">
                {pageData?.section_title || "General Section"}
              </span>
            </div>

            <button
              className="btn btn-secondary"
              style={{ fontSize: "0.74rem", padding: "4px 8px" }}
              onClick={() => onAskAboutPage(activePage)}
            >
              <Sparkles size={12} color="var(--accent-sky)" />
              <span>Ask about Page {activePage}</span>
            </button>
          </div>

          {/* Quick search on page */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-tertiary)", padding: "4px 10px", borderRadius: 6, flex: 1, maxWidth: 300 }}>
              <Search size={13} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Find text on this page..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-primary)",
                  fontSize: "0.8rem",
                  width: "100%"
                }}
              />
            </div>
          </div>

          {renderContent()}
        </div>
      ) : (
        <iframe
          key={`pdf-${doc.doc_id}-${activePage}-${activeHighlight ? 'hl' : 'plain'}`}
          src={getDocumentPdfUrl(doc.doc_id, activePage, activeHighlight)}
          className="pdf-iframe-container"
          title="Document PDF Preview"
        />
      )}
    </div>
  );
}

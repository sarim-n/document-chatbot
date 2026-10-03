import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Filter, X } from "lucide-react";

export default function ChatInput({
  onSendMessage,
  isLoading,
  scopedPage,
  onClearScope,
  activeDoc
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!text.trim() || isLoading) return;
    onSendMessage(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-input-container">
      {scopedPage && (
        <div className="scope-banner">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={13} />
            <span>
              Searching restricted to <strong>Page {scopedPage}</strong> of {activeDoc?.filename || "document"}
            </span>
          </div>
          <button
            onClick={onClearScope}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--accent-sky)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 2,
              fontSize: "0.72rem"
            }}
          >
            Clear <X size={12} />
          </button>
        </div>
      )}

      <div className="chat-input-box">
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          rows={1}
          placeholder={
            scopedPage
              ? `Ask a question specifically about Page ${scopedPage}...`
              : activeDoc
              ? `Ask anything about "${activeDoc.filename}"...`
              : "Upload or select a document to start asking questions..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          className="chat-send-btn"
          disabled={!text.trim() || isLoading}
          onClick={handleSubmit}
          title="Send message (Enter)"
        >
          <Send size={16} />
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: "0.72rem", color: "var(--text-muted)" }}>
        <span>Press <kbd style={{ background: "rgba(255,255,255,0.08)", padding: "1px 4px", borderRadius: 3 }}>Enter</kbd> to send, <kbd style={{ background: "rgba(255,255,255,0.08)", padding: "1px 4px", borderRadius: 3 }}>Shift + Enter</kbd> for newline</span>
        <span>RAG citations link directly to document pages</span>
      </div>
    </div>
  );
}

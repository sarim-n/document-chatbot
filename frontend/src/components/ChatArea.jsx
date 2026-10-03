import React, { useRef, useEffect } from "react";
import { 
  Bot, 
  User, 
  Compass, 
  Sparkles, 
  FileText, 
  ArrowRight, 
  CheckCircle, 
  CornerDownRight,
  ExternalLink,
  FileDown
} from "lucide-react";

export default function ChatArea({
  messages = [],
  isLoading = false,
  activeDoc = null,
  onNavigateToCitation,
  onSendSuggestedPrompt,
  onExportSingleNote
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Clean Markdown formatter for assistant responses
  const formatMarkdown = (content) => {
    if (!content) return null;

    const lines = content.split("\n");
    const elements = [];
    let currentList = [];

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} style={{ paddingLeft: 20, margin: "6px 0" }}>
            {currentList.map((item, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("### ")) {
        flushList();
        elements.push(
          <h3 key={index} style={{ fontSize: "1.05rem", fontWeight: 700, margin: "10px 0 6px 0", color: "var(--accent-sky)" }}>
            {renderInlineMarkdown(trimmed.slice(4))}
          </h3>
        );
      } else if (trimmed.startsWith("## ")) {
        flushList();
        elements.push(
          <h2 key={index} style={{ fontSize: "1.15rem", fontWeight: 700, margin: "12px 0 8px 0", color: "var(--text-primary)" }}>
            {renderInlineMarkdown(trimmed.slice(3))}
          </h2>
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        currentList.push(trimmed.slice(2));
      } else if (/^\d+\.\s/.test(trimmed)) {
        currentList.push(trimmed.replace(/^\d+\.\s/, ""));
      } else if (trimmed === "---") {
        flushList();
        elements.push(<hr key={index} style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "12px 0" }} />);
      } else if (trimmed) {
        flushList();
        elements.push(
          <p key={index} style={{ marginBottom: 8 }}>
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      } else {
        flushList();
      }
    });

    flushList();
    return elements;
  };

  const renderInlineMarkdown = (text) => {
    // Bold **text**
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: "#fff", fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i} style={{ color: "var(--accent-sky)" }}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={i} style={{ background: "rgba(255,255,255,0.08)", padding: "2px 5px", borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: "0.82em" }}>
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="messages-container">
      {messages.length === 0 ? (
        <div className="empty-chat-welcome">
          <div className="welcome-icon">
            <Compass size={28} />
          </div>
          <h2 className="welcome-title">Ask & Navigate Documents</h2>
          <p className="welcome-desc">
            {activeDoc
              ? `Currently exploring "${activeDoc.filename}". Ask questions to receive verified answers grounded in the text with instant navigation links to relevant pages.`
              : "Upload a PDF or select a document to start asking questions with citation-powered navigation."}
          </p>

          {activeDoc && (
            <div className="quick-prompts">
              <button
                className="quick-prompt-btn"
                onClick={() => onSendSuggestedPrompt(`What is the main topic and executive summary of ${activeDoc.filename}?`)}
              >
                <span>Provide a high-level summary of the document</span>
                <ArrowRight size={14} color="var(--accent-sky)" />
              </button>
              <button
                className="quick-prompt-btn"
                onClick={() => onSendSuggestedPrompt("What are the key methodologies, findings, or main points discussed?")}
              >
                <span>What are the key methodologies and findings?</span>
                <ArrowRight size={14} color="var(--accent-sky)" />
              </button>
              <button
                className="quick-prompt-btn"
                onClick={() => onSendSuggestedPrompt("What conclusions or recommendations are mentioned in this document?")}
              >
                <span>What conclusions or recommendations are given?</span>
                <ArrowRight size={14} color="var(--accent-sky)" />
              </button>
            </div>
          )}
        </div>
      ) : (
        messages.map((msg, index) => {
          const isUser = msg.role === "user";

          return (
            <div key={index} className={`message-bubble-wrap ${isUser ? "user" : "assistant"}`}>
              <div className={`message-avatar ${isUser ? "user" : "assistant"}`}>
                {isUser ? <User size={18} /> : <Bot size={18} />}
              </div>

              <div className="message-content-box" style={{ maxWidth: isUser ? "100%" : "90%" }}>
                <div className={`message-bubble ${isUser ? "user" : "assistant"}`}>
                  {isUser ? msg.content : formatMarkdown(msg.content)}
                </div>

                {/* Citations and Navigation Links */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className="citations-container">
                    <div className="citations-label">
                      <Compass size={13} />
                      <span>Document Citations & Navigation</span>
                    </div>

                    <div className="citation-chips">
                      {msg.citations.map((c, cIdx) => (
                        <button
                          key={cIdx}
                          className="citation-pill"
                          onClick={() => onNavigateToCitation(c.page_number, c.snippet, c.doc_id)}
                          title={`Click to jump to Page ${c.page_number}: "${c.snippet.slice(0, 100)}..."`}
                        >
                          <FileText size={12} color="var(--accent-sky)" />
                          <span className="citation-page-badge">Page {c.page_number}</span>
                          <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.section_title || "Excerpt"}
                          </span>
                          <span className="citation-score-badge">
                            {Math.round(c.similarity_score * 100)}% match
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up Question Suggestions */}
                {!isUser && msg.suggested_followups && msg.suggested_followups.length > 0 && (
                  <div className="followups-wrap">
                    <span className="followups-label">Suggested follow-ups:</span>
                    <div className="followup-chips">
                      {msg.suggested_followups.map((fText, fIdx) => (
                        <button
                          key={fIdx}
                          className="followup-chip"
                          onClick={() => onSendSuggestedPrompt(fText)}
                        >
                          <CornerDownRight size={11} style={{ marginRight: 4 }} />
                          {fText}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-Message Note Export Action */}
                {!isUser && msg.content && (
                  <div className="message-action-bar">
                    <button
                      className="btn-note-export-chip"
                      onClick={() => onExportSingleNote && onExportSingleNote(index)}
                      title="Export this generated note into a PDF or Markdown document"
                    >
                      <FileDown size={12} color="var(--accent-sky)" />
                      <span>Export Note as Document</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {isLoading && (
        <div className="message-bubble-wrap assistant">
          <div className="message-avatar assistant">
            <Bot size={18} />
          </div>
          <div className="message-bubble assistant">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="typing-dots">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Retrieving chunks & synthesizing answer...
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

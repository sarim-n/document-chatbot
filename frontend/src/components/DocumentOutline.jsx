import React, { useState } from "react";
import { Bookmark, ChevronRight, ChevronDown, Filter, Search } from "lucide-react";

export default function DocumentOutline({
  outline = [],
  activePage = 1,
  onSelectPage,
  onScopeSection,
  scopedPage = null
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOutline = outline.filter((item) =>
    item.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="outline-sidebar">
      <div className="outline-header">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Bookmark size={15} color="var(--accent-sky)" />
          <span>Table of Contents</span>
        </div>
        <span style={{ fontSize: "0.72rem", color: "var(--accent-indigo)" }}>
          {outline.length} sections
        </span>
      </div>

      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-tertiary)", padding: "4px 8px", borderRadius: 6 }}>
          <Search size={13} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Filter sections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "0.78rem",
              width: "100%",
            }}
          />
        </div>
      </div>

      <div className="outline-list">
        {filteredOutline.length > 0 ? (
          filteredOutline.map((item, idx) => {
            const isCurrentPage = activePage === item.page;
            const isScoped = scopedPage === item.page;

            return (
              <div
                key={idx}
                className={`outline-item ${isCurrentPage ? "active" : ""}`}
                style={{ paddingLeft: `${8 + (item.level - 1) * 12}px` }}
                onClick={() => onSelectPage(item.page)}
                title={`Jump to Page ${item.page}: ${item.title}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                  <ChevronRight size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.title}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <span className="outline-page-tag">p.{item.page}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onScopeSection(isScoped ? null : item.page);
                    }}
                    title={isScoped ? "Clear section filter" : "Scope Q&A to this section"}
                    style={{
                      background: isScoped ? "var(--accent-indigo)" : "transparent",
                      border: "none",
                      borderRadius: 4,
                      padding: 2,
                      cursor: "pointer",
                      display: "flex",
                      color: isScoped ? "#fff" : "var(--text-muted)"
                    }}
                  >
                    <Filter size={12} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: "16px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem" }}>
            {searchTerm ? "No matching sections found" : "No outline detected for this document"}
          </div>
        )}
      </div>
    </div>
  );
}

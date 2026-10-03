import io
import re
import html
from datetime import datetime
from typing import List
import pymupdf

def markdown_to_simple_html(text: str) -> str:
    """Converts common Markdown patterns (bold, italics, code, lists, headers) to clean HTML."""
    if not text:
        return ""
    
    # Pre-clean
    lines = text.strip().split("\n")
    html_lines = []
    in_ul = False
    in_ol = False

    for line in lines:
        s = line.strip()
        if not s:
            if in_ul:
                html_lines.append("</ul>")
                in_ul = False
            if in_ol:
                html_lines.append("</ol>")
                in_ol = False
            continue

        # Check headers
        if s.startswith("### "):
            if in_ul: html_lines.append("</ul>"); in_ul = False
            if in_ol: html_lines.append("</ol>"); in_ol = False
            h_text = html.escape(s[4:])
            html_lines.append(f"<h3 style='color: #0369a1; margin: 12px 0 6px 0; font-size: 13pt;'>{h_text}</h3>")
            continue
        elif s.startswith("## "):
            if in_ul: html_lines.append("</ul>"); in_ul = False
            if in_ol: html_lines.append("</ol>"); in_ol = False
            h_text = html.escape(s[3:])
            html_lines.append(f"<h2 style='color: #0f172a; margin: 16px 0 8px 0; font-size: 15pt;'>{h_text}</h2>")
            continue
        elif s.startswith("# "):
            if in_ul: html_lines.append("</ul>"); in_ul = False
            if in_ol: html_lines.append("</ol>"); in_ol = False
            h_text = html.escape(s[2:])
            html_lines.append(f"<h1 style='color: #0f172a; margin: 18px 0 8px 0; font-size: 18pt;'>{h_text}</h1>")
            continue

        # Check list item
        if s.startswith("- ") or s.startswith("* "):
            if in_ol: html_lines.append("</ol>"); in_ol = False
            if not in_ul:
                html_lines.append("<ul style='margin: 6px 0; padding-left: 20px;'>")
                in_ul = True
            item_text = format_inline_markdown(s[2:])
            html_lines.append(f"<li style='margin-bottom: 4px;'>{item_text}</li>")
            continue

        # Numbered list
        ol_match = re.match(r"^(\d+)\.\s+(.*)$", s)
        if ol_match:
            if in_ul: html_lines.append("</ul>"); in_ul = False
            if not in_ol:
                html_lines.append("<ol style='margin: 6px 0; padding-left: 20px;'>")
                in_ol = True
            item_text = format_inline_markdown(ol_match.group(2))
            html_lines.append(f"<li style='margin-bottom: 4px;'>{item_text}</li>")
            continue

        # Normal line / paragraph
        if in_ul: html_lines.append("</ul>"); in_ul = False
        if in_ol: html_lines.append("</ol>"); in_ol = False

        if s == "---":
            html_lines.append("<hr style='border: none; border-top: 1px solid #e2e8f0; margin: 14px 0;'/>")
        else:
            p_text = format_inline_markdown(s)
            html_lines.append(f"<p style='margin: 6px 0 8px 0; line-height: 1.5;'>{p_text}</p>")

    if in_ul: html_lines.append("</ul>")
    if in_ol: html_lines.append("</ol>")

    return "\n".join(html_lines)


def format_inline_markdown(text: str) -> str:
    """Escapes HTML and formats **bold**, *italic*, and `code`."""
    # First escape basic html entities
    safe = html.escape(text)
    # Bold **text**
    safe = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", safe)
    # Italic *text*
    safe = re.sub(r"\*(.+?)\*", r"<i>\1</i>", safe)
    # Inline code `code`
    safe = re.sub(r"`(.+?)`", r"<code style='background: #f1f5f9; padding: 2px 5px; border-radius: 3px; font-family: monospace;'>\1</code>", safe)
    return safe


def generate_notes_pdf(title: str, doc_name: str, notes: list, include_citations: bool = True) -> bytes:
    """Renders a PDF study notes document using PyMuPDF Story and DocumentWriter."""
    date_str = datetime.now().strftime("%B %d, %Y - %I:%M %p")
    
    html_parts = []
    
    # Style definitions
    html_parts.append("""
    <style>
    body {
        font-family: sans-serif;
        font-size: 10pt;
        line-height: 1.5;
        color: #1e293b;
    }
    .header-card {
        background-color: #0f172a;
        color: #ffffff;
        padding: 20px 24px;
        border-radius: 6px;
        margin-bottom: 20px;
    }
    .doc-badge {
        background-color: #0284c7;
        color: #ffffff;
        font-size: 8pt;
        font-weight: bold;
        padding: 3px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        display: inline-block;
        margin-bottom: 8px;
    }
    .header-title {
        font-size: 20pt;
        font-weight: bold;
        color: #ffffff;
        margin: 4px 0 8px 0;
    }
    .meta-row {
        font-size: 8.5pt;
        color: #94a3b8;
        margin-top: 6px;
    }
    .note-card {
        margin-bottom: 24px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 14px 18px;
        background-color: #ffffff;
    }
    .note-header {
        font-size: 13pt;
        font-weight: bold;
        color: #0f172a;
        margin-bottom: 8px;
    }
    .query-box {
        background-color: #eff6ff;
        border-left: 4px solid #2563eb;
        padding: 10px 14px;
        border-radius: 4px;
        margin: 10px 0 14px 0;
    }
    .query-label {
        font-size: 8pt;
        font-weight: bold;
        color: #2563eb;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 3px;
    }
    .query-text {
        font-size: 10.5pt;
        font-weight: 600;
        color: #1e293b;
    }
    .answer-box {
        font-size: 10pt;
        color: #334155;
        line-height: 1.55;
    }
    .citations-section {
        background-color: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 5px;
        padding: 10px 14px;
        margin-top: 14px;
    }
    .citations-header {
        font-size: 8.5pt;
        font-weight: bold;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
    }
    .citation-item {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 6px 10px;
        margin-bottom: 6px;
        font-size: 8.5pt;
    }
    .citation-badge {
        background-color: #0284c7;
        color: #ffffff;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 3px;
        margin-right: 6px;
    }
    .citation-score {
        background-color: #dcfce7;
        color: #166534;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 3px;
        margin-left: 6px;
    }
    .citation-snippet {
        color: #64748b;
        font-style: italic;
        margin-top: 4px;
        font-size: 8pt;
        line-height: 1.35;
    }
    .doc-footer {
        font-size: 8pt;
        color: #94a3b8;
        text-align: center;
        border-top: 1px solid #e2e8f0;
        padding-top: 12px;
        margin-top: 30px;
    }
    </style>
    """)

    # Main Header Card
    html_parts.append(f"""
    <div class="header-card">
        <div class="doc-badge">RAG Navigator Study Notes</div>
        <div class="header-title">{html.escape(title or 'Study & Research Notes')}</div>
        <div class="meta-row">
            <b>Source Document:</b> {html.escape(doc_name or 'Document')} &bull; 
            <b>Generated:</b> {date_str} &bull; 
            <b>Topics:</b> {len(notes)}
        </div>
    </div>
    """)

    # Render each note
    for idx, note in enumerate(notes, start=1):
        q = getattr(note, "question", None) or (note.get("question") if isinstance(note, dict) else f"Topic {idx}")
        a = getattr(note, "answer", None) or (note.get("answer") if isinstance(note, dict) else "")
        cits = getattr(note, "citations", None) or (note.get("citations") if isinstance(note, dict) else [])

        ans_html = markdown_to_simple_html(a)

        note_html = f"""
        <div class="note-card">
            <div class="note-header">Note {idx} &bull; {html.escape(q[:80] + ('...' if len(q) > 80 else ''))}</div>
            <div class="query-box">
                <div class="query-label">Research Inquiry</div>
                <div class="query-text">{html.escape(q)}</div>
            </div>
            <div class="answer-box">
                {ans_html}
            </div>
        """

        if include_citations and cits and len(cits) > 0:
            note_html += """
            <div class="citations-section">
                <div class="citations-header">Verified Document Citations & Navigation References</div>
            """
            for c in cits:
                p_num = getattr(c, "page_number", None) or (c.get("page_number") if isinstance(c, dict) else 1)
                sec = getattr(c, "section_title", None) or (c.get("section_title") if isinstance(c, dict) else "Document Excerpt")
                score = getattr(c, "similarity_score", None) or (c.get("similarity_score") if isinstance(c, dict) else 0.8)
                snip = getattr(c, "snippet", None) or (c.get("snippet") if isinstance(c, dict) else "")
                snip_clean = html.escape(snip[:160] + ("..." if len(snip) > 160 else ""))

                pct = round(score * 100) if score <= 1.0 else round(score)
                note_html += f"""
                <div class="citation-item">
                    <span class="citation-badge">Page {p_num}</span>
                    <b>{html.escape(str(sec))}</b>
                    <span class="citation-score">{pct}% match</span>
                    {f'<div class="citation-snippet">&ldquo;{snip_clean}&rdquo;</div>' if snip_clean else ''}
                </div>
                """
            note_html += "</div>"

        note_html += "</div>"
        html_parts.append(note_html)

    # Footer
    html_parts.append("""
    <div class="doc-footer">
        Generated by <b>RAG Navigator</b> &bull; Document Question Answering with Interactive Navigation & Source Citations
    </div>
    """)

    full_html = "\n".join(html_parts)

    # Compile with PyMuPDF Story into BytesIO
    buf = io.BytesIO()
    writer = pymupdf.DocumentWriter(buf)
    mediabox = pymupdf.paper_rect('a4')
    margin = 36 # 0.5 inch margins
    content_rect = pymupdf.Rect(margin, margin, mediabox.width - margin, mediabox.height - margin)

    story = pymupdf.Story(html=full_html)
    story.write(writer, lambda n, f: (mediabox, content_rect, None))
    writer.close()

    return buf.getvalue()


def generate_notes_markdown(title: str, doc_name: str, notes: list, include_citations: bool = True) -> str:
    """Generates a structured GitHub-flavored Markdown notes document."""
    date_str = datetime.now().strftime("%B %d, %Y at %I:%M %p")
    md = []
    md.append(f"# {title or 'Document Study & Research Notes'}\n")
    md.append(f"> **Source Document:** `{doc_name or 'Document'}`  \n")
    md.append(f"> **Generated On:** {date_str}  \n")
    md.append(f"> **Generated By:** RAG Navigator Intelligent AI Engine\n")
    md.append("---\n")

    for idx, note in enumerate(notes, start=1):
        q = getattr(note, "question", None) or (note.get("question") if isinstance(note, dict) else f"Topic {idx}")
        a = getattr(note, "answer", None) or (note.get("answer") if isinstance(note, dict) else "")
        cits = getattr(note, "citations", None) or (note.get("citations") if isinstance(note, dict) else [])

        md.append(f"## {idx}. {q}\n")
        md.append(f"**Research Query:** *\"{q}\"*\n")
        md.append(f"\n{a.strip()}\n")

        if include_citations and cits and len(cits) > 0:
            md.append("\n### Verified Citations & References\n")
            md.append("| Page | Section | Relevance | Snippet Quote |")
            md.append("| :--- | :--- | :--- | :--- |")
            for c in cits:
                p_num = getattr(c, "page_number", None) or (c.get("page_number") if isinstance(c, dict) else 1)
                sec = getattr(c, "section_title", None) or (c.get("section_title") if isinstance(c, dict) else "Excerpt")
                score = getattr(c, "similarity_score", None) or (c.get("similarity_score") if isinstance(c, dict) else 0.8)
                snip = getattr(c, "snippet", None) or (c.get("snippet") if isinstance(c, dict) else "")
                snip_safe = snip.replace("|", "/").replace("\n", " ").strip()
                if len(snip_safe) > 100:
                    snip_safe = snip_safe[:100] + "..."
                pct = round(score * 100) if score <= 1.0 else round(score)
                md.append(f"| **Page {p_num}** | {sec} | {pct}% | *\"{snip_safe}\"* |")
            md.append("\n")

        md.append("---\n")

    md.append("\n*Generated by RAG Navigator — Intelligent Document Q&A & Navigation System*\n")
    return "\n".join(md)

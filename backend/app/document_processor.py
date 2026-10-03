import re
import uuid
from typing import List, Tuple, Dict, Any
from pathlib import Path
import pypdf
from app.models import DocumentOutlineItem, DocumentChunk, DocumentMetadata
from app.config import CHUNK_SIZE, CHUNK_OVERLAP

def clean_text(text: str) -> str:
    """Normalize whitespace and fix hyphenated line breaks."""
    if not text:
        return ""
    # Fix hyphenated words broken across lines: "informa-\ntion" -> "information"
    text = re.sub(r'(\w+)-\n(\w+)', r'\1\2', text)
    # Replace non-breaking spaces and irregular whitespace
    text = text.replace('\xa0', ' ').replace('\r\n', '\n').replace('\r', '\n')
    # Collapse multiple blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Clean excessive inline spaces
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def detect_headings_in_text(page_text: str, default_title: str) -> str:
    """Heuristically find a prominent heading or section title on a page."""
    lines = [line.strip() for line in page_text.split('\n') if line.strip()]
    if not lines:
        return default_title

    heading_patterns = [
        r'^(chapter\s+\d+[:\.\-]?\s*.+)$',
        r'^(section\s+\d+[:\.\-]?\s*.+)$',
        r'^(\d+(\.\d+)*\s+[A-Z][\w\s\-]+)$',
        r'^([A-Z0-9\s\-:]{3,60})$', # Short uppercase header
    ]

    for line in lines[:6]: # Check the first few lines
        for pattern in heading_patterns:
            if re.match(pattern, line, re.IGNORECASE) and len(line) <= 80:
                # Return cleaned heading
                return line.strip()

    return default_title

def extract_pdf_outline(reader: pypdf.PdfReader) -> List[DocumentOutlineItem]:
    """Extract bookmarks/table of contents from PDF if available."""
    outline_items: List[DocumentOutlineItem] = []
    
    def process_node(node, level=1):
        if isinstance(node, list):
            for child in node:
                process_node(child, level + 1)
        elif hasattr(node, 'title') and hasattr(node, 'page'):
            try:
                page_num = reader.get_destination_page_number(node) + 1
                outline_items.append(DocumentOutlineItem(
                    title=str(node.title).strip(),
                    page=page_num,
                    level=min(level, 3)
                ))
            except Exception:
                pass

    try:
        if reader.outline:
            for item in reader.outline:
                process_node(item, level=1)
    except Exception:
        pass

    return outline_items

def process_pdf_document(file_path: Path, filename: str) -> Tuple[DocumentMetadata, List[DocumentChunk], Dict[int, str]]:
    """
    Parses a PDF file:
    1. Extracts text page-by-page.
    2. Detects or derives outline / sections.
    3. Splits text into semantically cohesive chunks with metadata.
    4. Returns metadata, chunks list, and page-to-text mapping.
    """
    doc_id = str(uuid.uuid4())
    reader = pypdf.PdfReader(str(file_path))
    total_pages = len(reader.pages)
    
    outline = extract_pdf_outline(reader)
    page_texts: Dict[int, str] = {}
    chunks: List[DocumentChunk] = []
    
    current_section = "Introduction"
    # Map page number to outline title if available
    outline_page_map = {item.page: item.title for item in outline}
    
    global_chunk_idx = 0
    
    for page_idx in range(total_pages):
        page_num = page_idx + 1 # 1-indexed
        raw_text = reader.pages[page_idx].extract_text() or ""
        cleaned = clean_text(raw_text)
        page_texts[page_num] = cleaned
        
        # Check if page has an outline entry
        if page_num in outline_page_map:
            current_section = outline_page_map[page_num]
        else:
            # Fallback heuristic heading detection
            current_section = detect_headings_in_text(cleaned, current_section)
            
        if not cleaned:
            continue
            
        # Split page into chunks
        page_chunks = split_into_chunks(cleaned, CHUNK_SIZE, CHUNK_OVERLAP)
        for chunk_text in page_chunks:
            chunk_id = f"{doc_id}_p{page_num}_c{global_chunk_idx}"
            chunks.append(DocumentChunk(
                chunk_id=chunk_id,
                doc_id=doc_id,
                filename=filename,
                page_number=page_num,
                section_title=current_section,
                chunk_index=global_chunk_idx,
                text=chunk_text
            ))
            global_chunk_idx += 1

    # If outline was empty, build a synthetic outline from detected sections
    if not outline:
        seen_sections = set()
        for chk in chunks:
            if chk.section_title and chk.section_title not in seen_sections:
                seen_sections.add(chk.section_title)
                outline.append(DocumentOutlineItem(
                    title=chk.section_title,
                    page=chk.page_number,
                    level=1
                ))

    file_size = file_path.stat().st_size
    doc_meta = DocumentMetadata(
        doc_id=doc_id,
        filename=filename,
        page_count=total_pages,
        chunk_count=len(chunks),
        file_size=file_size,
        outline=outline
    )

    return doc_meta, chunks, page_texts

def split_into_chunks(text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
    """
    Splits text by sentence/paragraph boundaries with overlap.
    """
    if len(text) <= chunk_size:
        return [text]
        
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
            
        if len(current_chunk) + len(para) + 2 <= chunk_size:
            current_chunk = f"{current_chunk}\n\n{para}" if current_chunk else para
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            # If paragraph itself is longer than chunk_size, split by sentences
            if len(para) > chunk_size:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                sub_chunk = ""
                for sent in sentences:
                    if len(sub_chunk) + len(sent) + 1 <= chunk_size:
                        sub_chunk = f"{sub_chunk} {sent}" if sub_chunk else sent
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk.strip())
                        sub_chunk = sent
                if sub_chunk:
                    current_chunk = sub_chunk
                else:
                    current_chunk = ""
            else:
                # Add overlap from previous chunk
                overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else ""
                current_chunk = f"{overlap_text} {para}".strip()
                
    if current_chunk:
        chunks.append(current_chunk.strip())
        
    return chunks

import os
import json
import shutil
import subprocess
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from app.config import (
    UPLOADS_DIR,
    EXPORTS_DIR,
    get_groq_api_key,
    get_gemini_api_key,
    EMBEDDING_MODEL_NAME,
    DEFAULT_GROQ_MODEL,
    DEFAULT_GEMINI_MODEL
)
from app.models import (
    DocumentMetadata,
    ChatRequest,
    ChatResponse,
    PageContentResponse,
    ExportNotesRequest,
    OpenExportRequest
)
from app.notes_exporter import generate_notes_pdf, generate_notes_markdown
from app.document_processor import process_pdf_document
from app.vector_store import VectorStoreManager
from app.rag_engine import RAGEngine

app = FastAPI(
    title="RAG Navigator AI Backend",
    description="Document Question Answering with Interactive Navigation & Source Citations",
    version="1.0.0"
)

# Enable CORS for React frontend (Vite default is 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines
rag_engine = RAGEngine()

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "embedding_model": EMBEDDING_MODEL_NAME,
        "has_groq_key": bool(get_groq_api_key()),
        "has_gemini_key": bool(get_gemini_api_key()),
        "default_groq_model": DEFAULT_GROQ_MODEL,
        "default_gemini_model": DEFAULT_GEMINI_MODEL
    }

@app.post("/api/upload", response_model=DocumentMetadata)
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are currently supported.")

    # Save to temp location first
    temp_path = UPLOADS_DIR / f"temp_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Process PDF: outline, pages, chunks
        doc_meta, chunks, page_texts = process_pdf_document(temp_path, file.filename)
        
        # Rename file to persistent doc_id name
        final_pdf_path = UPLOADS_DIR / f"{doc_meta.doc_id}.pdf"
        shutil.move(temp_path, final_pdf_path)
        
        # Save metadata and page_texts to JSON
        meta_path = UPLOADS_DIR / f"{doc_meta.doc_id}_meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump({
                "meta": doc_meta.dict(),
                "pages": page_texts
            }, f, ensure_ascii=False, indent=2)

        # Store chunks in vector database
        rag_engine.vector_store.add_chunks(chunks)

        return doc_meta

    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to process document: {str(e)}")

@app.get("/api/documents", response_model=List[DocumentMetadata])
def list_documents():
    docs = []
    for meta_file in UPLOADS_DIR.glob("*_meta.json"):
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "meta" in data:
                    docs.append(DocumentMetadata(**data["meta"]))
        except Exception:
            continue
    # Sort newest first
    docs.sort(key=lambda d: d.upload_time, reverse=True)
    return docs

@app.get("/api/documents/{doc_id}", response_model=DocumentMetadata)
def get_document(doc_id: str):
    meta_path = UPLOADS_DIR / f"{doc_id}_meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Document not found")
    with open(meta_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return DocumentMetadata(**data["meta"])

@app.get("/api/documents/{doc_id}/page/{page_number}", response_model=PageContentResponse)
def get_document_page(doc_id: str, page_number: int):
    meta_path = UPLOADS_DIR / f"{doc_id}_meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Document not found")
        
    with open(meta_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    meta = DocumentMetadata(**data["meta"])
    pages = data.get("pages", {})
    page_key = str(page_number)
    
    if page_key not in pages:
        raise HTTPException(status_code=404, detail=f"Page {page_number} not found. Total pages: {meta.page_count}")
        
    # Find matching section from outline
    matching_section = None
    for item in meta.outline:
        if item.page <= page_number:
            matching_section = item.title

    return PageContentResponse(
        doc_id=doc_id,
        filename=meta.filename,
        page_number=page_number,
        total_pages=meta.page_count,
        text=pages[page_key],
        section_title=matching_section
    )

@app.get("/api/documents/{doc_id}/pdf")
def get_document_pdf(
    doc_id: str,
    page: Optional[int] = Query(None),
    highlight: Optional[str] = Query(None)
):
    pdf_path = UPLOADS_DIR / f"{doc_id}.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found")

    if not highlight or not highlight.strip():
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            headers={"Content-Disposition": "inline"}
        )

    # Highlight requested text inside the PDF itself
    try:
        import pymupdf
        doc = pymupdf.open(str(pdf_path))
        target_pages = [page - 1] if (page and 1 <= page <= len(doc)) else range(len(doc))

        clean_hl = highlight.strip()
        search_terms = []
        if clean_hl:
            # Full phrase (up to 60 chars)
            search_terms.append(clean_hl[:60])
            words = [w for w in clean_hl.split() if len(w) > 2]
            if len(words) >= 4:
                search_terms.append(" ".join(words[:4]))
                search_terms.append(" ".join(words[1:5]))
            elif len(words) >= 2:
                search_terms.append(" ".join(words[:2]))

        highlight_count = 0
        for p_idx in target_pages:
            p = doc[p_idx]
            for term in search_terms:
                if len(term) < 3:
                    continue
                rects = p.search_for(term)
                if rects:
                    for r in rects[:15]:
                        annot = p.add_highlight_annot(r)
                        annot.set_colors(stroke=[1.0, 0.82, 0.1]) # Bright Golden Yellow Marker
                        annot.update()
                        highlight_count += 1
                    break # Matched most specific term on this page

        pdf_bytes = doc.tobytes(deflate=True)
        doc.close()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline",
                "X-Highlights-Applied": str(highlight_count)
            }
        )
    except Exception as e:
        print(f"Error highlighting PDF in-memory: {e}")
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            headers={"Content-Disposition": "inline"}
        )

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    pdf_path = UPLOADS_DIR / f"{doc_id}.pdf"
    meta_path = UPLOADS_DIR / f"{doc_id}_meta.json"
    
    if pdf_path.exists():
        pdf_path.unlink()
    if meta_path.exists():
        meta_path.unlink()
        
    rag_engine.vector_store.delete_document(doc_id)
    return {"message": "Document deleted successfully", "doc_id": doc_id}

@app.post("/api/chat", response_model=ChatResponse)
def chat_with_rag(request: ChatRequest):
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    response = rag_engine.process_chat(
        query=request.query,
        doc_id=request.doc_id,
        history=request.history,
        groq_api_key=request.groq_api_key,
        gemini_api_key=request.gemini_api_key,
        provider=request.provider or "auto",
        scope_page=request.scope_page
    )
    return response

@app.post("/api/export/notes")
def export_notes(request: ExportNotesRequest):
    if not request.notes:
        raise HTTPException(status_code=400, detail="No notes provided for export")

    fmt = (request.format or "pdf").lower()
    raw_title = request.title or "document_study_notes"
    safe_filename = "".join(c for c in raw_title if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    if not safe_filename:
        safe_filename = "document_study_notes"

    ext = "md" if fmt in ("markdown", "md") else "pdf"
    target_filename = f"{safe_filename}.{ext}"
    target_path = EXPORTS_DIR / target_filename

    if fmt in ("markdown", "md"):
        md_content = generate_notes_markdown(
            title=request.title or "Document Study & Research Notes",
            doc_name=request.doc_name or "Document",
            notes=request.notes,
            include_citations=request.include_citations if request.include_citations is not None else True
        )
        target_path.write_text(md_content, encoding="utf-8")
    else:
        pdf_bytes = generate_notes_pdf(
            title=request.title or "Document Study & Research Notes",
            doc_name=request.doc_name or "Document",
            notes=request.notes,
            include_citations=request.include_citations if request.include_citations is not None else True
        )
        target_path.write_bytes(pdf_bytes)

    return {
        "status": "success",
        "filename": target_filename,
        "file_path": str(target_path.resolve()),
        "download_url": f"/api/export/download/{target_filename}",
        "view_url": f"/api/export/view/{target_filename}",
        "format": ext,
        "file_size": target_path.stat().st_size
    }

@app.get("/api/export/download/{filename}")
def download_export(filename: str):
    file_path = EXPORTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Exported document not found")
    media_type = "text/markdown; charset=utf-8" if filename.endswith(".md") else "application/pdf"
    return FileResponse(
        file_path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.get("/api/export/view/{filename}")
def view_export(filename: str):
    file_path = EXPORTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Exported document not found")
    media_type = "text/markdown; charset=utf-8" if filename.endswith(".md") else "application/pdf"
    return FileResponse(
        file_path,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )

@app.post("/api/export/open-file")
def open_export_file(req: OpenExportRequest):
    file_path = EXPORTS_DIR / req.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    try:
        if hasattr(os, "startfile"):
            os.startfile(str(file_path.resolve()))
        else:
            subprocess.Popen(["xdg-open", str(file_path.resolve())])
        return {"status": "opened", "file_path": str(file_path.resolve())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open file: {str(e)}")

@app.post("/api/export/open-folder")
def open_export_folder(req: OpenExportRequest):
    file_path = EXPORTS_DIR / req.filename
    target = file_path.resolve() if file_path.exists() else EXPORTS_DIR.resolve()
    try:
        if os.name == "nt":
            subprocess.Popen(["explorer.exe", f"/select,{str(target)}"])
        else:
            subprocess.Popen(["xdg-open", str(EXPORTS_DIR.resolve())])
        return {"status": "opened", "folder_path": str(EXPORTS_DIR.resolve())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open folder: {str(e)}")



from typing import List, Optional
from pydantic import BaseModel, Field
import time

class DocumentOutlineItem(BaseModel):
    title: str
    page: int
    level: int = 1

class DocumentMetadata(BaseModel):
    doc_id: str
    filename: str
    upload_time: float = Field(default_factory=time.time)
    page_count: int
    chunk_count: int
    file_size: int
    outline: List[DocumentOutlineItem] = []

class DocumentChunk(BaseModel):
    chunk_id: str
    doc_id: str
    filename: str
    page_number: int
    section_title: str
    chunk_index: int
    text: str

class Citation(BaseModel):
    citation_id: str
    doc_id: str
    filename: str
    page_number: int
    section_title: str
    snippet: str
    similarity_score: float
    chunk_index: int

class ChatMessage(BaseModel):
    role: str # "user" | "assistant" | "system"
    content: str
    citations: Optional[List[Citation]] = None
    timestamp: float = Field(default_factory=time.time)

class ChatRequest(BaseModel):
    query: str
    doc_id: Optional[str] = None
    history: List[ChatMessage] = []
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    provider: Optional[str] = "auto" # "groq" | "gemini" | "auto"
    scope_page: Optional[int] = None # Optional filter to specific page

class NavTarget(BaseModel):
    doc_id: str
    filename: str
    page_number: int
    section_title: str
    highlight_text: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    citations: List[Citation] = []
    suggested_followups: List[str] = []
    nav_target: Optional[NavTarget] = None
    provider_used: str

class PageContentResponse(BaseModel):
    doc_id: str
    filename: str
    page_number: int
    total_pages: int
    text: str
    section_title: Optional[str] = None
    chunks: List[dict] = []

class NoteItem(BaseModel):
    question: Optional[str] = "Research Query"
    answer: str
    citations: Optional[List[Citation]] = []
    timestamp: Optional[float] = None

class ExportNotesRequest(BaseModel):
    title: Optional[str] = "Document Study & Research Notes"
    doc_name: Optional[str] = "Document"
    notes: List[NoteItem]
    format: Optional[str] = "pdf" # "pdf" | "markdown"
    include_citations: Optional[bool] = True

class OpenExportRequest(BaseModel):
    filename: str



import os
import re
from typing import List, Optional, Dict, Any
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from app.config import CHROMA_DIR, EMBEDDING_MODEL_NAME, TOP_K_RETRIEVAL
from app.models import DocumentChunk, Citation

class VectorStoreManager:
    _instance = None

    def __init__(self):
        self.chroma_client = chromadb.PersistentClient(
            path=str(CHROMA_DIR),
            settings=Settings(anonymized_telemetry=False)
        )
        self.collection = self.chroma_client.get_or_create_collection(
            name="rag_documents",
            metadata={"hnsw:space": "cosine"}
        )
        self._embedder = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @property
    def embedder(self) -> SentenceTransformer:
        if self._embedder is None:
            print(f"Loading embedding model: {EMBEDDING_MODEL_NAME}...")
            self._embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)
        return self._embedder

    def add_chunks(self, chunks: List[DocumentChunk]):
        if not chunks:
            return

        texts = [chunk.text for chunk in chunks]
        embeddings = self.embedder.encode(texts, show_progress_bar=False, normalize_embeddings=True).tolist()
        
        ids = [chunk.chunk_id for chunk in chunks]
        metadatas = [
            {
                "doc_id": chunk.doc_id,
                "filename": chunk.filename,
                "page_number": chunk.page_number,
                "section_title": chunk.section_title or "General",
                "chunk_index": chunk.chunk_index
            }
            for chunk in chunks
        ]

        # Chroma has a batch limit, chunk if large
        batch_size = 200
        for i in range(0, len(chunks), batch_size):
            end_idx = i + batch_size
            self.collection.upsert(
                ids=ids[i:end_idx],
                embeddings=embeddings[i:end_idx],
                documents=texts[i:end_idx],
                metadatas=metadatas[i:end_idx]
            )

    def search(
        self,
        query: str,
        doc_id: Optional[str] = None,
        scope_page: Optional[int] = None,
        top_k: int = TOP_K_RETRIEVAL
    ) -> List[Citation]:
        if not query.strip():
            return []

        query_embedding = self.embedder.encode([query], show_progress_bar=False, normalize_embeddings=True).tolist()
        
        where_filter = None
        if doc_id and scope_page:
            where_filter = {
                "$and": [
                    {"doc_id": {"$eq": doc_id}},
                    {"page_number": {"$eq": scope_page}}
                ]
            }
        elif doc_id:
            where_filter = {"doc_id": {"$eq": doc_id}}
        elif scope_page:
            where_filter = {"page_number": {"$eq": scope_page}}

        # Retrieve a broader candidate pool to allow hybrid keyword and heading re-ranking
        fetch_k = min(top_k * 3, 30)
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=fetch_k,
            where=where_filter,
            include=["documents", "metadatas", "distances"]
        )

        citations: List[Citation] = []
        if not results or not results.get("ids") or not results["ids"][0]:
            return citations

        ids = results["ids"][0]
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = results["distances"][0] if "distances" in results else [0.0] * len(ids)

        # Normalize query tokens for heading/unit matching (e.g. 'unit 1' -> 'unit1')
        clean_q = re.sub(r'[\s\-_]+', '', query.lower())
        
        STOP_WORDS = {
            "what", "how", "why", "where", "when", "which", "who", "whom",
            "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
            "do", "does", "did", "can", "could", "should", "would", "may", "might",
            "the", "a", "an", "this", "that", "these", "those", "from", "with",
            "for", "about", "into", "through", "during", "before", "after",
            "above", "below", "to", "from", "up", "down", "in", "out", "on", "off",
            "over", "under", "again", "further", "then", "once", "tell", "give", "explain", "describe", "show", "please"
        }
        q_words = [w.lower() for w in re.findall(r'\b\w+\b', query) if len(w) > 2 and w.lower() not in STOP_WORDS]

        scored_candidates = []
        for i in range(len(ids)):
            meta = metas[i]
            dist = distances[i]
            # Base cosine similarity
            similarity = max(0.0, min(1.0, 1.0 - float(dist)))
            
            section = meta.get("section_title", "General")
            clean_section = re.sub(r'[\s\-_]+', '', section.lower())
            chunk_doc = docs[i].lower()
            clean_doc = re.sub(r'[\s\-_]+', '', chunk_doc)

            boost = 0.0
            # 1. Exact or normalized section match (e.g. 'unit 1' matches 'UNIT -1')
            if clean_q and len(clean_q) >= 4 and (clean_q in clean_section or clean_section in clean_q):
                boost += 0.25
            # 2. Check if query non-stopword terms appear in section title
            elif q_words and any(w in section.lower() for w in q_words):
                boost += 0.10

            # 3. Check normalized occurrence in text
            if clean_q and len(clean_q) >= 5 and clean_q in clean_doc:
                boost += 0.15

            final_score = min(1.0, similarity + boost)

            # Minimum relevance threshold cutoff (0.28)
            RELEVANCE_THRESHOLD = 0.28
            if final_score >= RELEVANCE_THRESHOLD:
                citation = Citation(
                    citation_id=ids[i],
                    doc_id=meta.get("doc_id", ""),
                    filename=meta.get("filename", "Unknown Document"),
                    page_number=int(meta.get("page_number", 1)),
                    section_title=section,
                    snippet=docs[i],
                    similarity_score=round(final_score, 3),
                    chunk_index=int(meta.get("chunk_index", 0))
                )
                scored_candidates.append(citation)

        # Re-sort strictly by highest relevance score first
        scored_candidates.sort(key=lambda c: c.similarity_score, reverse=True)
        return scored_candidates[:top_k]

    def delete_document(self, doc_id: str):
        self.collection.delete(where={"doc_id": {"$eq": doc_id}})

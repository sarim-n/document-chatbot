import sys
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.document_processor import process_pdf_document
from app.vector_store import VectorStoreManager
from app.rag_engine import RAGEngine

def main():
    sample_pdf = backend_dir / "data" / "sample_rag_architecture.pdf"
    if not sample_pdf.exists():
        print(f"Error: {sample_pdf} does not exist.")
        return

    print("1. Processing sample PDF...")
    doc_meta, chunks, page_texts = process_pdf_document(sample_pdf, "sample_rag_architecture.pdf")
    print(f"   -> Extracted {doc_meta.page_count} pages, {len(chunks)} chunks.")

    print("\n2. Storing chunks in Vector Store...")
    store = VectorStoreManager.get_instance()
    store.add_chunks(chunks)

    engine = RAGEngine()

    print("\n3. TEST A: Relevant Query ('What is the role of sentence transformers in RAG?')")
    resp_rel = engine.process_chat("What is the role of sentence transformers in RAG?", doc_id=doc_meta.doc_id)
    print("   Citations count:", len(resp_rel.citations))
    if resp_rel.nav_target:
        print(f"   Nav Target: Page {resp_rel.nav_target.page_number} ({resp_rel.nav_target.section_title})")
    assert resp_rel.nav_target is not None and resp_rel.nav_target.page_number == 2, "Relevant query should target Page 2"

    print("\n4. TEST B: Irrelevant Query ('Who won the 2022 FIFA World Cup?')")
    resp_irrel = engine.process_chat("Who won the 2022 FIFA World Cup?", doc_id=doc_meta.doc_id)
    print("   Citations count:", len(resp_irrel.citations))
    print("   Nav Target:", resp_irrel.nav_target)
    print("   Answer:", resp_irrel.answer[:150])
    assert resp_irrel.nav_target is None, "Irrelevant query should have nav_target = None"
    assert "could not be found in the uploaded document" in resp_irrel.answer, "Irrelevant query should return fallback message"

    print("\n5. TEST C: Page Navigation Command ('move to page 4')")
    resp_nav = engine.process_chat("move to page 4", doc_id=doc_meta.doc_id)
    print("   Nav Target:", resp_nav.nav_target)
    print("   Answer:", resp_nav.answer.encode("ascii", "ignore").decode("ascii"))
    assert resp_nav.nav_target is not None and resp_nav.nav_target.page_number == 4, "Page command should navigate to page 4"

    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()

"""
Generates a valid, beautifully structured PDF with text streams and bookmark outlines.
Pure Python, no external libraries required to produce standard PDF 1.4.
"""
from pathlib import Path

def create_sample_pdf(output_path: Path):
    pages_content = [
        (
            "Chapter 1: Introduction to Retrieval-Augmented Generation",
            [
                "1.1 Executive Overview",
                "Retrieval-Augmented Generation (RAG) is a state-of-the-art AI architectural pattern that",
                "combines the parametric memory of Large Language Models (LLMs) with non-parametric",
                "vector databases. By dynamically retrieving external knowledge relevant to a user's prompt,",
                "RAG mitigates hallucinations and enables real-time access to private enterprise documents.",
                "",
                "1.2 Motivation and Business Value",
                "Standard LLMs suffer from knowledge cutoff dates and frequently hallucinate domain-specific",
                "facts. RAG solves this by providing grounding context alongside user queries, ensuring",
                "that answers are factual, auditable, and backed by verifiable citations.",
                "",
                "1.3 Key Architectural Pillars",
                "A robust RAG system consists of three primary modules: the Document Ingestion Pipeline,",
                "the Semantic Vector Store, and the Grounded Synthesis Engine.",
            ]
        ),
        (
            "Chapter 2: Chunking Strategies and Dense Embeddings",
            [
                "2.1 Document Preprocessing and Normalization",
                "Raw documents such as PDFs often contain complex layouts, headers, footers, and hyphenated",
                "line breaks. Normalizing whitespace and segmenting documents into logical sections",
                "is vital before chunking.",
                "",
                "2.2 Semantic Chunking vs Sliding Window",
                "Fixed sliding window chunking uses a defined character or token size (e.g. 500-800 characters)",
                "with an overlap (e.g. 100 characters) to preserve contextual boundaries across split points.",
                "Semantic chunking respects paragraph and section headings to maintain coherent ideas.",
                "",
                "2.3 Sentence Transformers and Dense Vectors",
                "Sentence Transformers map variable-length textual chunks into dense vector representations",
                "(typically 384 or 768 dimensions). The all-MiniLM-L6-v2 model offers a superior balance of",
                "computational efficiency, low latency, and high retrieval accuracy on semantic similarity benchmarks.",
            ]
        ),
        (
            "Chapter 3: Vector Databases and Indexing Mechanisms",
            [
                "3.1 Role of Vector Databases",
                "Vector databases provide specialized storage and approximate nearest neighbor (ANN) search.",
                "Popular options include ChromaDB, FAISS, and Qdrant. ChromaDB provides embedded persistence",
                "with native metadata filtering.",
                "",
                "3.2 Hierarchical Navigable Small World (HNSW)",
                "HNSW graph indexing allows sub-linear search latency across millions of high-dimensional",
                "vectors by organizing nodes into multi-layer proximity graphs.",
                "",
                "3.3 Cosine Similarity vs Euclidean Distance",
                "Normalized embeddings utilize cosine similarity, computed as the dot product between the",
                "query vector and chunk vector. A score of 1.0 indicates identical directional semantics,",
                "while scores above 0.70 indicate strong topical alignment.",
            ]
        ),
        (
            "Chapter 4: Interactive Document Navigation & Citations",
            [
                "4.1 The Need for Grounded Navigation",
                "Providing an answer without source verification degrades user trust. Modern AI assistants",
                "must provide deep navigation links that instantly transport users to the exact document,",
                "chapter, section, and page containing the supporting evidence.",
                "",
                "4.2 Dynamic Chunk Highlighting",
                "When a user clicks a citation badge (e.g. Page 4, Section 4.1), the document viewer should",
                "auto-scroll to the target page and highlight the matching chunk with an accent glow.",
                "This visual feedback loop cuts verification time by over 80%.",
                "",
                "4.3 Outline and Chapter Browsing",
                "Extracting the document's Table of Contents allows users to browse hierarchical chapters",
                "and scope their questions to specific sections of interest.",
            ]
        ),
        (
            "Chapter 5: Evaluation and Future Directions",
            [
                "5.1 RAG Triad Metrics",
                "Modern RAG evaluation frameworks measure three core axes: Context Relevance (how well the",
                "retrieved chunks match the prompt), Groundedness (faithfulness of the answer to context),",
                "and Answer Relevance (how directly the synthesis satisfies the user's question).",
                "",
                "5.2 Conversational Memory and Contextual Query Rewriting",
                "Multi-turn dialogues require tracking conversation state. Follow-up queries like 'explain its",
                "second limitation' are contextualized with conversation history before vector lookup.",
                "",
                "5.3 Conclusion",
                "RAG with interactive navigation represents the gold standard for reliable, auditable,",
                "and user-centric AI document intelligence.",
            ]
        )
    ]

    objects = []
    
    def add_object(content_bytes: bytes) -> int:
        objects.append(content_bytes)
        return len(objects)

    # 1: Catalog placeholder
    # 2: Outlines placeholder
    # 3: Pages placeholder
    # 4: Font placeholder

    page_obj_ids = []
    content_obj_ids = []

    # Create content streams for each page
    for title, lines in pages_content:
        stream_lines = []
        # Header
        stream_lines.append("BT /F1 16 Tf 50 740 Td (" + title + ") Tj ET")
        # Line rule
        stream_lines.append("50 725 m 550 725 l S")
        # Body text
        y = 700
        for line in lines:
            if not line:
                y -= 12
                continue
            stream_lines.append(f"BT /F2 11 Tf 50 {y} Td (" + line.replace("(", "\\(").replace(")", "\\)") + ") Tj ET")
            y -= 16

        # Footer
        page_idx = len(page_obj_ids) + 1
        stream_lines.append(f"BT /F2 9 Tf 270 30 Td (Page {page_idx} of 5 - RAG Architecture Guide) Tj ET")

        stream_data = "\n".join(stream_lines).encode("latin1")
        stream_obj = (
            f"<< /Length {len(stream_data)} >>\nstream\n".encode("ascii")
            + stream_data
            + b"\nendstream"
        )
        content_id = len(objects) + 1
        objects.append(stream_obj)
        content_obj_ids.append(content_id)

    # Fonts
    f1_id = len(objects) + 1
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    f2_id = len(objects) + 1
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    # Pages object placeholder index: will come after all Page objects
    pages_obj_index = len(objects) + len(content_obj_ids) + 1

    # Create Page objects
    for i, content_id in enumerate(content_obj_ids):
        page_id = len(objects) + 1
        page_obj = f"""<< 
/Type /Page 
/Parent {pages_obj_index} 0 R 
/MediaBox [0 0 612 792] 
/Contents {content_id} 0 R 
/Resources << 
  /Font << /F1 {f1_id} 0 R /F2 {f2_id} 0 R >> 
>> 
>>""".encode("ascii")
        objects.append(page_obj)
        page_obj_ids.append(page_id)

    # Now add Pages object
    kids_str = " ".join([f"{pid} 0 R" for pid in page_obj_ids])
    pages_obj = f"""<< 
/Type /Pages 
/Kids [{kids_str}] 
/Count {len(page_obj_ids)} 
>>""".encode("ascii")
    objects.append(pages_obj) # id is pages_obj_index

    # Outlines (Table of Contents bookmarks)
    outline_item_ids = []
    outlines_obj_id = len(objects) + 1
    
    for i, (title, _) in enumerate(pages_content):
        outline_item_id = outlines_obj_id + 1 + i
        outline_item_ids.append(outline_item_id)

    outline_items_bytes = []
    for i, (title, _) in enumerate(pages_content):
        pid = page_obj_ids[i]
        prev_str = f"/Prev {outline_item_ids[i-1]} 0 R" if i > 0 else ""
        next_str = f"/Next {outline_item_ids[i+1]} 0 R" if i < len(pages_content) - 1 else ""
        item_bytes = f"""<< 
/Title ({title}) 
/Parent {outlines_obj_id} 0 R 
/Dest [{pid} 0 R /Fit] 
{prev_str} 
{next_str} 
>>""".encode("latin1")
        outline_items_bytes.append(item_bytes)

    outlines_obj = f"""<< 
/Type /Outlines 
/First {outline_item_ids[0]} 0 R 
/Last {outline_item_ids[-1]} 0 R 
/Count {len(pages_content)} 
>>""".encode("ascii")
    objects.append(outlines_obj)

    for item_b in outline_items_bytes:
        objects.append(item_b)

    # Catalog
    catalog_id = len(objects) + 1
    catalog_obj = f"""<< 
/Type /Catalog 
/Pages {pages_obj_index} 0 R 
/Outlines {outlines_obj_id} 0 R 
>>""".encode("ascii")
    objects.append(catalog_obj)

    # Write PDF file
    with open(output_path, "wb") as f:
        f.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = []
        for i, obj in enumerate(objects):
            offsets.append(f.tell())
            f.write(f"{i + 1} 0 obj\n".encode("ascii"))
            f.write(obj)
            f.write(b"\nendobj\n")

        xref_pos = f.tell()
        f.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        f.write(b"0000000000 65535 f \n")
        for offset in offsets:
            f.write(f"{offset:010d} 00000 n \n".encode("ascii"))

        f.write(f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n".encode("ascii"))
        f.write(f"startxref\n{xref_pos}\n%%EOF\n".encode("ascii"))

    print(f"Generated sample document: {output_path}")

if __name__ == "__main__":
    out = Path(__file__).resolve().parent / "backend" / "data" / "sample_rag_architecture.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)
    create_sample_pdf(out)

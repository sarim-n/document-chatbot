import os
import json
import re
from typing import List, Optional, Tuple
from app.config import (
    get_groq_api_key,
    get_gemini_api_key,
    DEFAULT_GROQ_MODEL,
    DEFAULT_GEMINI_MODEL
)
from app.models import ChatMessage, Citation, ChatResponse, NavTarget
from app.vector_store import VectorStoreManager

try:
    from groq import Groq
except ImportError:
    Groq = None

try:
    import google.generativeai as genai
except ImportError:
    genai = None

SYSTEM_PROMPT = """You are an expert AI Research & Document Navigation Assistant.
Your goal is to answer user questions accurately based SOLELY on the provided retrieved document context excerpts.

Crucial Instructions:
1. Always base your response directly on the provided context excerpts. Do not use external pre-trained knowledge to answer questions unrelated to the document.
2. In your answer, actively cite the document navigation points inline using format like **[Doc: filename, Page X, Section: Y]** or **[Page X]**.
3. If the provided context excerpts do not contain the answer or are unrelated to the user's question, state strictly:
   "The requested information could not be found in the uploaded document(s). Please ask a question related to the content of the uploaded document."
4. Format your answer with clean Markdown: use bullet points, bold key terms, and concise paragraphs.
5. Provide a clear, professional, and friendly response.
"""

def build_context_prompt(citations: List[Citation]) -> str:
    if not citations:
        return "No relevant excerpts found in the documents."
    
    parts = []
    for idx, c in enumerate(citations, 1):
        parts.append(
            f"--- SOURCE EXCERPT {idx} ---\n"
            f"Document: {c.filename}\n"
            f"Page: {c.page_number}\n"
            f"Section: {c.section_title}\n"
            f"Relevance Score: {c.similarity_score}\n"
            f"Excerpt Content:\n{c.snippet}\n"
        )
    return "\n".join(parts)

def generate_offline_fallback_answer(query: str, citations: List[Citation]) -> str:
    """Provides an extractive synthesized answer when no LLM API key is configured."""
    if not citations:
        return "The requested information could not be found in the uploaded document(s). Please ask a question related to the content of the uploaded document."

    best_match = citations[0]
    bullets = []
    for c in citations[:3]:
        snippet_preview = c.snippet.strip().replace('\n', ' ')
        if len(snippet_preview) > 220:
            snippet_preview = snippet_preview[:220] + "..."
        bullets.append(f"- **From Page {c.page_number} ({c.section_title})**: \"{snippet_preview}\"")

    bullets_text = "\n".join(bullets)

    answer = (
        f"### Retrieved Document Findings for: *\"{query}\"*\n\n"
        f"Based on the most relevant passages in **{best_match.filename}**:\n\n"
        f"{bullets_text}\n\n"
        f"📍 **Primary Reference**: Navigated to **Page {best_match.page_number}** (*{best_match.section_title}*).\n\n"
        f"---\n"
        f"ℹ️ *Note: This is an extractive preview. To enable full generative AI synthesis, "
        f"click the **Settings ⚙️** icon in the header and input a free **Groq** or **Google Gemini** API key!*"
    )
    return answer

def _clean_section_name(section: str) -> str:
    """Normalizes raw section title into a readable topic name. Returns empty string if it looks like body text."""
    import re
    # Reject if it looks like a sentence / body text snippet (contains colon mid-text or many words)
    stripped = section.strip()
    if ':' in stripped and len(stripped.split()) > 4:
        return ""  # Skip — it's a content snippet not a heading
    if len(stripped.split()) > 8:
        return ""  # Too wordy to be a section heading
    # Remove unit prefix noise like 'UNIT -3' -> 'Unit 3'
    s = re.sub(r'UNIT\s*[-–]\s*(\d+)', lambda m: f'Unit {m.group(1)}', stripped, flags=re.IGNORECASE)
    # Remove leading digits like '1.2 Constructors' -> 'Constructors'
    s = re.sub(r'^\d+[\.\d]*\s*', '', s.strip())
    # Cap at 50 chars
    return s.strip()[:50] if s.strip() else ""


def generate_followup_suggestions(query: str, citations: List[Citation], answer: str = "") -> List[str]:
    """Generates 3 specific, document-grounded follow-up questions based on retrieved context and actual LLM answer."""
    import re

    if not citations:
        return ["Can you summarize the main topics covered?", "What are the key concepts in this document?"]

    # Gather unique clean section names and pages
    raw_sections = list(dict.fromkeys([
        c.section_title for c in citations
        if c.section_title and c.section_title.lower() not in ("general", "document", "", "none")
    ]))
    sections = [_clean_section_name(s) for s in raw_sections]
    sections = [s for s in sections if s]  # filter empties

    pages = list(dict.fromkeys([c.page_number for c in citations]))
    filename = citations[0].filename if citations else "the document"
    # Strip extension for readable display
    doc_label = re.sub(r'\.pdf$', '', filename, flags=re.IGNORECASE)

    suggestions = []

    # --- Strategy 1: Drill into a specific bold term extracted from the LLM answer ---
    if answer:
        bold_terms = re.findall(r'\*\*([^*]{3,35})\*\*', answer)
        # Filter out generic noise, filenames, page references, and offline-mode boilerplate
        skip_words = {
            'note', 'tip', 'important', 'key', 'example', 'syntax', 'output',
            'definition', 'result', 'page', 'section', 'document', 'reference',
            'primary reference', 'retrieved document findings', 'most relevant passages',
            'document excerpt', 'source excerpt', 'best match'
        }
        clean_terms = [
            t.strip() for t in bold_terms
            if (
                t.strip().lower() not in skip_words
                and len(t.strip()) > 3
                and not re.search(r'\.pdf$', t.strip(), re.IGNORECASE)  # not a filename
                and not re.match(r'^page\s*\d+', t.strip(), re.IGNORECASE)  # not "Page 12"
                and not re.match(r'^from\s+', t.strip(), re.IGNORECASE)  # not "From ..."
            )
        ]
        if clean_terms:
            term = clean_terms[0]
            suggestions.append(f"Can you give a practical code example of {term}?")


    # --- Strategy 2: Ask about the primary section's sub-topics ---
    if sections and len(suggestions) < 3:
        primary = sections[0]
        # If it's clearly a unit header, ask what other things that unit covers
        if re.match(r'^Unit \d+', primary, re.IGNORECASE):
            suggestions.append(f"What are all the topics covered in {primary} of {doc_label}?")
        else:
            suggestions.append(f"What are the key details about {primary} explained in {doc_label}?")

    # --- Strategy 3: Cross-reference between sections or pages ---
    if len(suggestions) < 3:
        if len(sections) >= 2 and sections[0] != sections[1]:
            suggestions.append(f"How does {sections[0]} differ from {sections[1]}?")
        elif len(pages) >= 2:
            suggestions.append(f"What additional concepts are introduced on page {pages[1]}?")
        else:
            # Derive from query intent
            q_lower = query.lower()
            if any(w in q_lower for w in ("what", "explain", "define", "describe")):
                suggestions.append(f"What are common use cases and limitations of this in C++?")
            elif any(w in q_lower for w in ("how", "implement", "write", "create")):
                suggestions.append(f"Are there alternative implementations or approaches discussed in {doc_label}?")
            elif any(w in q_lower for w in ("difference", "compare", "vs", "versus")):
                suggestions.append(f"Which approach is recommended in {doc_label} and why?")
            else:
                suggestions.append(f"What examples or exercises are given for this topic in {doc_label}?")

    return suggestions[:3]



class RAGEngine:
    def __init__(self):
        self.vector_store = VectorStoreManager.get_instance()

    def process_chat(
        self,
        query: str,
        doc_id: Optional[str] = None,
        history: List[ChatMessage] = None,
        groq_api_key: Optional[str] = None,
        gemini_api_key: Optional[str] = None,
        provider: str = "auto",
        scope_page: Optional[int] = None
    ) -> ChatResponse:
        history = history or []
        
        # 0. Check for direct page navigation commands (e.g., "move to page 5", "go to page 12", "page 3", "open page 4")
        nav_command_match = re.search(
            r'^\s*(?:move\s+to|go\s+to|jump\s+to|open|take\s+me\s+to|navigate\s+to|show)?\s*page\s+(\d+)\s*$',
            query,
            re.IGNORECASE
        )
        if not nav_command_match:
            nav_command_match = re.search(
                r'\b(?:move\s+to|go\s+to|jump\s+to|open|navigate\s+to)\s+page\s+(\d+)\b',
                query,
                re.IGNORECASE
            )

        if nav_command_match:
            target_page = int(nav_command_match.group(1))
            return ChatResponse(
                answer=f"📍 **Navigated to Page {target_page}** of the document.",
                citations=[],
                suggested_followups=[
                    f"What is discussed on page {target_page}?",
                    f"Summarize page {target_page}"
                ],
                nav_target=NavTarget(
                    doc_id=doc_id or "",
                    filename="",
                    page_number=target_page,
                    section_title=f"Page {target_page}",
                    highlight_text=None
                ),
                provider_used="navigation_command"
            )

        # 0b. Check for "open pdf" / "show pdf" / "open document" commands
        open_pdf_match = re.search(
            r'^\s*(?:open|show|view|display)\s*(?:the\s*)?(?:pdf|document|viewer)\s*$',
            query,
            re.IGNORECASE
        )
        if open_pdf_match:
            return ChatResponse(
                answer="📍 **Opened Document PDF Viewer**.",
                citations=[],
                suggested_followups=[
                    "What are the main topics in this document?",
                    "Summarize page 1"
                ],
                nav_target=NavTarget(
                    doc_id=doc_id or "",
                    filename="",
                    page_number=1,
                    section_title="Document Viewer",
                    highlight_text=None
                ),
                provider_used="navigation_command"
            )

        # 1. Retrieve context
        # If there's recent history, combine last question and current query for contextual search
        search_query = query
        if history:
            last_user_msgs = [m.content for m in history if m.role == "user"]
            if last_user_msgs and len(query.split()) < 4:
                # E.g. "what about that?", "and limitations?" -> contextualize
                search_query = f"{last_user_msgs[-1]} {query}"

        citations = self.vector_store.search(
            query=search_query,
            doc_id=doc_id,
            scope_page=scope_page,
            top_k=4
        )

        if not citations:
            return ChatResponse(
                answer="The requested information could not be found in the uploaded document(s). Please ask a question related to the content of the uploaded document.",
                citations=[],
                suggested_followups=[
                    "What are the main topics covered in this document?",
                    "Can you summarize the uploaded document?"
                ],
                nav_target=None,
                provider_used="relevance_filter"
            )

        nav_target = None
        if citations:
            top_c = citations[0]
            # Use top citation as primary navigation target
            nav_target = NavTarget(
                doc_id=top_c.doc_id,
                filename=top_c.filename,
                page_number=top_c.page_number,
                section_title=top_c.section_title,
                highlight_text=top_c.snippet[:120]
            )

        # 2. Check API keys and select provider
        effective_groq_key = (groq_api_key or get_groq_api_key() or "").strip().strip('"').strip("'")
        effective_gemini_key = (gemini_api_key or get_gemini_api_key() or "").strip().strip('"').strip("'")
        
        chosen_provider = "offline"
        if provider == "groq" and effective_groq_key:
            chosen_provider = "groq"
        elif provider == "gemini" and effective_gemini_key:
            chosen_provider = "gemini"
        elif provider == "auto":
            if effective_groq_key:
                chosen_provider = "groq"
            elif effective_gemini_key:
                chosen_provider = "gemini"

        answer = ""
        provider_used = chosen_provider

        # 3. Call LLM
        if chosen_provider == "groq" and Groq and effective_groq_key:
            try:
                answer = self._call_groq(query, citations, history, effective_groq_key)
            except Exception as e:
                print(f"Error calling Groq API: {e}")
                # Fallback to gemini or offline
                if effective_gemini_key and genai:
                    try:
                        answer = self._call_gemini(query, citations, history, effective_gemini_key)
                        provider_used = "gemini"
                    except Exception as e_gem:
                        print(f"Error calling Gemini fallback: {e_gem}")
                        answer = generate_offline_fallback_answer(query, citations)
                        provider_used = "offline (fallback)"
                else:
                    answer = f"Error with Groq API ({str(e)}).\n\n" + generate_offline_fallback_answer(query, citations)
                    provider_used = "offline (fallback)"

        elif chosen_provider == "gemini" and genai and effective_gemini_key:
            try:
                answer = self._call_gemini(query, citations, history, effective_gemini_key)
            except Exception as e:
                print(f"Error calling Gemini API: {e}")
                answer = f"Error with Gemini API ({str(e)}).\n\n" + generate_offline_fallback_answer(query, citations)
                provider_used = "offline (fallback)"

        else:
            answer = generate_offline_fallback_answer(query, citations)
            provider_used = "extractive (no API key configured)"

        # 4. Generate document-grounded follow-up prompts using actual answer
        followups = generate_followup_suggestions(query, citations, answer)

        return ChatResponse(
            answer=answer,
            citations=citations,
            suggested_followups=followups,
            nav_target=nav_target,
            provider_used=provider_used
        )


    def _call_groq(self, query: str, citations: List[Citation], history: List[ChatMessage], api_key: str) -> str:
        client = Groq(api_key=api_key)
        context_str = build_context_prompt(citations)
        
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in history[-4:]:
            role = "user" if msg.role == "user" else "assistant"
            messages.append({"role": role, "content": msg.content})

        user_content = (
            f"RETRIEVED DOCUMENT CONTEXT:\n{context_str}\n\n"
            f"USER QUESTION: {query}\n\n"
            f"Please synthesize a clear, well-structured answer citing the specific pages and sections."
        )
        messages.append({"role": "user", "content": user_content})

        candidate_models = [
            DEFAULT_GROQ_MODEL,
            "openai/gpt-oss-120b",
            "qwen/qwen3.8-27b",
            "openai/gpt-oss-20b",
            "llama-3.3-70b-versatile"
        ]
        
        last_err = None
        for model_name in candidate_models:
            try:
                completion = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=1024,
                )
                return completion.choices[0].message.content or "No response generated."
            except Exception as e:
                last_err = e
                print(f"Groq model {model_name} failed: {e}. Trying next candidate...")
                continue
                
        raise last_err or Exception("All Groq model candidates failed.")

    def _call_gemini(self, query: str, citations: List[Citation], history: List[ChatMessage], api_key: str) -> str:
        genai.configure(api_key=api_key)
        context_str = build_context_prompt(citations)
        
        history_text = ""
        for msg in history[-4:]:
            role = "User" if msg.role == "user" else "Assistant"
            history_text += f"{role}: {msg.content}\n"

        prompt = (
            f"{SYSTEM_PROMPT}\n\n"
            f"CONVERSATION HISTORY:\n{history_text}\n"
            f"DOCUMENT CONTEXT:\n{context_str}\n\n"
            f"USER QUESTION: {query}\n\n"
            f"Answer:"
        )

        candidate_models = [
            DEFAULT_GEMINI_MODEL,
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-1.5-flash",
            "gemini-pro"
        ]

        last_err = None
        for model_name in candidate_models:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                return response.text or "No response generated."
            except Exception as e:
                last_err = e
                print(f"Gemini model {model_name} failed: {e}. Trying next candidate...")
                continue

        raise last_err or Exception("All Gemini model candidates failed.")

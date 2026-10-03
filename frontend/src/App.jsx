import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import DocumentOutline from "./components/DocumentOutline";
import ChatArea from "./components/ChatArea";
import ChatInput from "./components/ChatInput";
import DocumentViewer from "./components/DocumentViewer";
import FileUploadModal from "./components/FileUploadModal";
import SettingsModal from "./components/SettingsModal";
import ExportNotesModal from "./components/ExportNotesModal";
import { checkHealth, listDocuments, getDocument, sendChatMessage } from "./api";

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeDoc, setActiveDoc] = useState(null);
  const [activePage, setActivePage] = useState(1);
  const [highlightText, setHighlightText] = useState(null);
  const [scopedPage, setScopedPage] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false); // PDF closed by default

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState("connecting");

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportSingleNoteIndex, setExportSingleNoteIndex] = useState(null);

  // Settings
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem("groq_api_key") || "");
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");
  const [provider, setProvider] = useState(() => localStorage.getItem("rag_provider") || "auto");

  // Check health and load documents on mount
  useEffect(() => {
    checkHealth()
      .then((data) => {
        if (data.status === "healthy") {
          setServerStatus("healthy");
        } else {
          setServerStatus("offline");
        }
      })
      .catch(() => setServerStatus("offline"));

    loadDocumentsList();
  }, []);

  // Update activeDoc when activeDocId or documents change
  useEffect(() => {
    if (!activeDocId && documents.length > 0) {
      setActiveDocId(documents[0].doc_id);
      setActiveDoc(documents[0]);
      setActivePage(1);
    } else if (activeDocId) {
      const match = documents.find((d) => d.doc_id === activeDocId);
      if (match) {
        setActiveDoc(match);
      } else {
        // Fetch single doc if not in memory
        getDocument(activeDocId)
          .then((d) => setActiveDoc(d))
          .catch(console.error);
      }
    } else {
      setActiveDoc(null);
    }
  }, [activeDocId, documents]);

  const loadDocumentsList = async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !activeDocId) {
        setActiveDocId(docs[0].doc_id);
        setActiveDoc(docs[0]);
      }
    } catch (err) {
      console.warn("Could not load documents list:", err.message);
    }
  };

  const handleSelectDoc = (docId) => {
    setActiveDocId(docId);
    setActivePage(1);
    setHighlightText(null);
    setScopedPage(null);
  };

  const handleUploadSuccess = (newDoc) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.doc_id);
    setActiveDoc(newDoc);
    setActivePage(1);
    setHighlightText(null);
    setScopedPage(null);

    // Add a greeting/introductory message in chat
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `**${newDoc.filename}** has been processed and indexed into ChromaDB with **${newDoc.chunk_count} semantic chunks** across **${newDoc.page_count} pages**.\n\nYou can ask any questions about its content, click citations to jump to specific pages, or explore the outline on the left.`,
        suggested_followups: [
          `Summarize ${newDoc.filename}`,
          "What are the main topics covered?",
          "Explain the key findings"
        ],
        timestamp: Date.now() / 1000
      }
    ]);
  };

  // Navigating when citation is clicked -> OPENS PDF VIEWER automatically
  const handleNavigateToCitation = (pageNumber, snippet, targetDocId) => {
    setIsViewerOpen(true);
    const page = Number(pageNumber);
    if (targetDocId && targetDocId !== activeDocId) {
      setActiveDocId(targetDocId);
      const targetDoc = documents.find((d) => d.doc_id === targetDocId);
      if (targetDoc) {
        setActiveDoc(targetDoc);
      }
    }
    setActivePage(page);
    setHighlightText(snippet || "");
  };

  const handleSendMessage = async (queryText) => {
    if (!queryText.trim() || isLoading) return;

    const userMsg = {
      role: "user",
      content: queryText.trim(),
      timestamp: Date.now() / 1000
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        query: queryText.trim(),
        docId: activeDocId,
        history: messages,
        groqApiKey: groqKey,
        geminiApiKey: geminiKey,
        provider: provider,
        scopePage: scopedPage
      });

      const assistantMsg = {
        role: "assistant",
        content: response.answer,
        citations: response.citations || [],
        suggested_followups: response.suggested_followups || [],
        timestamp: Date.now() / 1000
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Update target page and highlights; open PDF viewer ONLY if prompt explicitly commanded page movement or PDF open
      if (response.nav_target) {
        if (response.provider_used === "navigation_command") {
          setIsViewerOpen(true);
        }
        if (response.nav_target.doc_id && response.nav_target.doc_id !== activeDocId) {
          setActiveDocId(response.nav_target.doc_id);
        }
        if (response.nav_target.page_number) {
          setActivePage(response.nav_target.page_number);
        }
        setHighlightText(response.nav_target.highlight_text || null);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Error communicating with RAG service**: ${err.message}\n\nPlease verify that the FastAPI backend server is running on \`http://localhost:8000\`.`,
          timestamp: Date.now() / 1000
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAskAboutPage = (pageNum) => {
    setScopedPage(pageNum);
  };

  const assistantNotesCount = messages.filter(m => m.role === "assistant" && m.content).length;

  return (
    <div className="app-container">
      <Navbar
        documents={documents}
        activeDocId={activeDocId}
        onSelectDoc={handleSelectDoc}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => {
          setExportSingleNoteIndex(null);
          setIsExportOpen(true);
        }}
        notesCount={assistantNotesCount}
        serverStatus={serverStatus}
        hasApiKey={Boolean(groqKey || geminiKey)}
        isViewerOpen={isViewerOpen}
        onToggleViewer={() => setIsViewerOpen((prev) => !prev)}
      />

      <div className="main-layout">
        {/* Left: Outline Sidebar */}
        <DocumentOutline
          outline={activeDoc?.outline || []}
          activePage={activePage}
          onSelectPage={(pageNum) => {
            setIsViewerOpen(true);
            setActivePage(pageNum);
            setHighlightText(null);
          }}
          onScopeSection={(pageNum) => setScopedPage(pageNum)}
          scopedPage={scopedPage}
        />

        {/* Center: Chat Interface */}
        <section className={`chat-pane ${isViewerOpen ? "split" : "full"}`}>
          <ChatArea
            messages={messages}
            isLoading={isLoading}
            activeDoc={activeDoc}
            onNavigateToCitation={handleNavigateToCitation}
            onSendSuggestedPrompt={handleSendMessage}
            onExportSingleNote={(msgIdx) => {
              setExportSingleNoteIndex(msgIdx);
              setIsExportOpen(true);
            }}
          />
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            scopedPage={scopedPage}
            onClearScope={() => setScopedPage(null)}
            activeDoc={activeDoc}
          />
        </section>

        {/* Right: Document & Citation Navigator (Only shown when viewer is open) */}
        {isViewerOpen && (
          <DocumentViewer
            doc={activeDoc}
            activePage={activePage}
            onChangePage={(p) => {
              setActivePage(p);
              setHighlightText(null);
            }}
            highlightText={highlightText}
            onAskAboutPage={handleAskAboutPage}
            onCloseViewer={() => setIsViewerOpen(false)}
          />
        )}
      </div>

      {/* Modals */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        groqKey={groqKey}
        setGroqKey={setGroqKey}
        geminiKey={geminiKey}
        setGeminiKey={setGeminiKey}
        provider={provider}
        setProvider={setProvider}
      />

      <ExportNotesModal
        isOpen={isExportOpen}
        onClose={() => {
          setIsExportOpen(false);
          setExportSingleNoteIndex(null);
        }}
        messages={messages}
        activeDoc={activeDoc}
        initialSelectedNote={exportSingleNoteIndex}
      />
    </div>
  );
}

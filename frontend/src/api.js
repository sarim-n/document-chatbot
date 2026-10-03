const API_BASE = "http://localhost:8000/api";

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("Health check failed");
    return await res.json();
  } catch (err) {
    return { status: "offline", error: err.message };
  }
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(errorData.detail || "Upload failed");
  }
  return await res.json();
}

export async function listDocuments() {
  const res = await fetch(`${API_BASE}/documents`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return await res.json();
}

export async function getDocument(docId) {
  const res = await fetch(`${API_BASE}/documents/${docId}`);
  if (!res.ok) throw new Error("Failed to fetch document details");
  return await res.json();
}

export async function getDocumentPage(docId, pageNumber) {
  const res = await fetch(`${API_BASE}/documents/${docId}/page/${pageNumber}`);
  if (!res.ok) throw new Error(`Failed to fetch page ${pageNumber}`);
  return await res.json();
}

export function getDocumentPdfUrl(docId, pageNumber = 1, highlight = "") {
  let url = `${API_BASE}/documents/${docId}/pdf?page=${pageNumber}`;
  if (highlight && highlight.trim()) {
    const clean = highlight.replace(/[^\w\s]/g, " ").trim().slice(0, 60);
    url += `&highlight=${encodeURIComponent(clean)}`;
  }
  url += `#page=${pageNumber}`;
  return url;
}

export async function deleteDocument(docId) {
  const res = await fetch(`${API_BASE}/documents/${docId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete document");
  return await res.json();
}

export async function sendChatMessage({
  query,
  docId = null,
  history = [],
  groqApiKey = null,
  geminiApiKey = null,
  provider = "auto",
  scopePage = null,
}) {
  const payload = {
    query,
    doc_id: docId,
    history: history.map((h) => ({
      role: h.role,
      content: h.content,
      citations: h.citations || null,
      timestamp: h.timestamp || Date.now() / 1000,
    })),
    groq_api_key: groqApiKey || null,
    gemini_api_key: geminiApiKey || null,
    provider: provider || "auto",
    scope_page: scopePage || null,
  };

  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Chat request failed" }));
    throw new Error(errorData.detail || "Chat request failed");
  }

  return await res.json();
}

export async function exportNotesDocument({
  title = "Document Study Notes",
  docName = "Document",
  notes = [],
  format = "pdf",
  includeCitations = true
}) {
  const payload = {
    title,
    doc_name: docName,
    notes,
    format,
    include_citations: includeCitations
  };

  // Step 1: Generate & save the document on the backend
  const res = await fetch(`${API_BASE}/export/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Export failed" }));
    throw new Error(errorData.detail || "Export failed");
  }

  const data = await res.json();

  // Step 2: Fetch the actual file bytes from the download endpoint via same-origin fetch
  const fileRes = await fetch(`${API_BASE}/export/download/${encodeURIComponent(data.filename)}`);
  if (!fileRes.ok) throw new Error("Failed to fetch generated file");

  const mimeType = format === "markdown" || format === "md"
    ? "text/markdown;charset=utf-8"
    : "application/pdf";

  const blob = await fileRes.blob();
  const blobWithType = new Blob([blob], { type: mimeType });
  const objectUrl = URL.createObjectURL(blobWithType);

  // Step 3: Trigger real browser download with blob URL
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = data.filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Clean up after download starts
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    a.remove();
  }, 3000);

  return data;
}


export async function openExportFile(filename) {
  const res = await fetch(`${API_BASE}/export/open-file`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to open file" }));
    throw new Error(err.detail || "Failed to open file");
  }
  return await res.json();
}

export async function openExportFolder(filename) {
  const res = await fetch(`${API_BASE}/export/open-folder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to open folder" }));
    throw new Error(err.detail || "Failed to open folder");
  }
  return await res.json();
}



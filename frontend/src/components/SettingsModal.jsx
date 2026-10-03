import React, { useState } from "react";
import { Settings, X, Key, Zap, Sparkles, ExternalLink, Check } from "lucide-react";

export default function SettingsModal({
  isOpen,
  onClose,
  groqKey,
  setGroqKey,
  geminiKey,
  setGeminiKey,
  provider,
  setProvider
}) {
  const [tempGroq, setTempGroq] = useState(groqKey || "");
  const [tempGemini, setTempGemini] = useState(geminiKey || "");
  const [tempProvider, setTempProvider] = useState(provider || "auto");
  const [savedBanner, setSavedBanner] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setGroqKey(tempGroq.trim());
    setGeminiKey(tempGemini.trim());
    setProvider(tempProvider);

    localStorage.setItem("groq_api_key", tempGroq.trim());
    localStorage.setItem("gemini_api_key", tempGemini.trim());
    localStorage.setItem("rag_provider", tempProvider);

    setSavedBanner(true);
    setTimeout(() => {
      setSavedBanner(false);
      onClose();
    }, 700);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Settings size={20} color="var(--accent-indigo)" />
            <span>AI Model & API Configuration</span>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Configure your preferred LLM provider for generative answers. If no keys are provided, the system defaults to an offline extractive RAG preview mode.
          </p>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Zap size={15} color="var(--accent-amber)" />
                <span>Groq API Key (Fast Llama-3.3 70B)</span>
              </label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "0.75rem", color: "var(--accent-sky)", display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}
              >
                Get Free Key <ExternalLink size={11} />
              </a>
            </div>
            <input
              type="password"
              className="form-input"
              placeholder="gsk_..."
              value={tempGroq}
              onChange={(e) => setTempGroq(e.target.value)}
            />
          </div>

          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={15} color="var(--accent-sky)" />
                <span>Google Gemini API Key (Gemini 1.5 Flash)</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "0.75rem", color: "var(--accent-sky)", display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}
              >
                Get Free Key <ExternalLink size={11} />
              </a>
            </div>
            <input
              type="password"
              className="form-input"
              placeholder="AIzaSy..."
              value={tempGemini}
              onChange={(e) => setTempGemini(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Preferred Generation Provider</label>
            <select
              className="form-input"
              value={tempProvider}
              onChange={(e) => setTempProvider(e.target.value)}
              style={{ cursor: "pointer" }}
            >
              <option value="auto">Auto (Prioritize Groq, then Gemini)</option>
              <option value="groq">Groq (Llama-3.3 70B Versatile)</option>
              <option value="gemini">Google Gemini (Gemini 1.5 Flash)</option>
            </select>
          </div>

          {savedBanner && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, background: "rgba(16, 185, 129, 0.15)", borderRadius: 8, color: "var(--accent-emerald)", fontSize: "0.85rem" }}>
              <Check size={16} />
              <span>Settings saved successfully!</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

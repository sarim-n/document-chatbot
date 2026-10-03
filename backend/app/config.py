import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
CHROMA_DIR = DATA_DIR / "chroma_db"
EXPORTS_DIR = DATA_DIR / "exports"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


# API Keys from environment (stripped of whitespace and quotes)
def get_groq_api_key() -> str:
    load_dotenv(override=True)
    val = os.getenv("GROQ_API_KEY", "")
    return val.strip().strip('"').strip("'")

def get_gemini_api_key() -> str:
    load_dotenv(override=True)
    val = os.getenv("GEMINI_API_KEY", "")
    return val.strip().strip('"').strip("'")

GROQ_API_KEY = get_groq_api_key()
GEMINI_API_KEY = get_gemini_api_key()

# Embedding Model
EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "all-MiniLM-L6-v2")

# Default Models (configured to models available on Groq & Gemini accounts)
DEFAULT_GROQ_MODEL = os.getenv("DEFAULT_GROQ_MODEL", "openai/gpt-oss-120b")
DEFAULT_GEMINI_MODEL = os.getenv("DEFAULT_GEMINI_MODEL", "gemini-2.5-flash")

# RAG Hyperparameters
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "600"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
TOP_K_RETRIEVAL = int(os.getenv("TOP_K_RETRIEVAL", "8"))

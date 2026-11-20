import os

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
CHAT_MODEL = os.getenv("CHAT_MODEL", "qwen2.5:7b")
EMBED_MODEL = os.getenv("EMBED_MODEL", "bge-m3")
CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
COLLECTION = "kandela_materi"
MATERIALS_DIR = os.getenv("MATERIALS_DIR", "./materials")
TOP_K = int(os.getenv("TOP_K", "3"))
# Jarak cosine di atas ini dianggap tidak relevan (0 = identik, 2 = berlawanan).
MAX_DISTANCE = float(os.getenv("MAX_DISTANCE", "0.65"))

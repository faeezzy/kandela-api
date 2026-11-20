"""RAG inti: retrieve dari Chroma, lalu minta model lokal (Ollama) menjelaskan.

Prinsip: skor dan hasil trade dihitung oleh kode, bukan LLM. LLM hanya menjelaskan
dan wajib berpegang pada materi yang diambil.
"""
import chromadb
import ollama

from . import config

_client = ollama.Client(host=config.OLLAMA_HOST)
_db = chromadb.PersistentClient(path=config.CHROMA_PATH)


def collection():
    return _db.get_or_create_collection(
        config.COLLECTION, metadata={"hnsw:space": "cosine"}
    )


def embed(texts: list[str]) -> list[list[float]]:
    return _client.embed(model=config.EMBED_MODEL, input=texts)["embeddings"]


def retrieve(question: str, k: int = config.TOP_K) -> list[dict]:
    col = collection()
    if col.count() == 0:
        return []
    res = col.query(query_embeddings=embed([question]), n_results=k)
    hits = []
    for doc, meta, dist in zip(
        res["documents"][0], res["metadatas"][0], res["distances"][0]
    ):
        if dist <= config.MAX_DISTANCE:
            hits.append({"text": doc, "distance": round(dist, 3), **meta})
    return hits


SYSTEM = (
    "Kamu Sumbu, mentor trading edukatif untuk mahasiswa Indonesia. "
    "Jawab dengan bahasa Indonesia santai, maksimal 5 kalimat. "
    "Gunakan HANYA materi yang diberikan. Jika materi tidak memuat jawabannya, "
    "katakan terus terang bahwa materinya belum ada. "
    "Sebut sumber dengan format (Judul, hal. N). "
    "Jangan menyarankan membeli atau menjual aset nyata."
)


def build_messages(question: str, hits: list[dict], context: str | None) -> list[dict]:
    materi = "\n\n".join(
        f"[{h['title']}, hal. {h['page']}]\n{h['text']}" for h in hits
    ) or "(tidak ada materi yang relevan)"
    user = f"Materi:\n{materi}\n"
    if context:
        user += f"\nKonteks latihan pengguna:\n{context}\n"
    user += f"\nPertanyaan: {question}"
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}]


def answer(question: str, context: str | None = None, use_retrieval: bool = True) -> dict:
    hits = retrieve(question) if use_retrieval else []
    msgs = build_messages(question, hits, context)
    out = _client.chat(
        model=config.CHAT_MODEL, messages=msgs, options={"temperature": 0.2}
    )
    return {
        "answer": out["message"]["content"].strip(),
        "sources": [
            {"title": h["title"], "page": h["page"], "distance": h["distance"]}
            for h in hits
        ],
        "retrieval": use_retrieval,
    }

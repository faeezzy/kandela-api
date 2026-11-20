import pathlib

from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import config, rag

app = FastAPI(title="Kandela API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatIn(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    context: str | None = Field(default=None, max_length=800)
    use_retrieval: bool = True


@app.get("/health")
def health():
    return {
        "ok": True,
        "chat_model": config.CHAT_MODEL,
        "embed_model": config.EMBED_MODEL,
        "chunks": rag.collection().count(),
    }


@app.post("/chat")
def chat(body: ChatIn):
    try:
        return rag.answer(body.question, body.context, body.use_retrieval)
    except Exception as e:  # Ollama mati / model belum di-pull
        raise HTTPException(
            status_code=503,
            detail=f"Model belum bisa dipakai: {e}. Pastikan Ollama jalan dan model sudah di-pull.",
        )


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/app/")


_static = pathlib.Path(__file__).resolve().parent.parent / "static"
if _static.exists():
    app.mount("/app", StaticFiles(directory=_static, html=True), name="app")

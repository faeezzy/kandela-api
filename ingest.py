"""Baca materials/*.md, pecah per paragraf, embed, simpan ke Chroma.

Format tiap file: front matter sederhana
---
title: Judul
page: 4
---
isi materi...

Jalankan ulang kapan saja; koleksi dibangun ulang dari nol.
"""
import pathlib
import re

from app import config, rag


def parse(path: pathlib.Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
    if not m:
        raise ValueError(f"{path.name}: front matter (title, page) tidak ditemukan")
    meta = dict(
        line.split(":", 1) for line in m.group(1).strip().splitlines() if ":" in line
    )
    return {k.strip(): v.strip() for k, v in meta.items()}, m.group(2).strip()


def chunks(body: str, max_chars: int = 700) -> list[str]:
    out, buf = [], ""
    for para in re.split(r"\n\s*\n", body):
        para = para.strip()
        if not para:
            continue
        if buf and len(buf) + len(para) > max_chars:
            out.append(buf)
            buf = para
        else:
            buf = f"{buf}\n\n{para}".strip()
    if buf:
        out.append(buf)
    return out


def main():
    files = sorted(pathlib.Path(config.MATERIALS_DIR).glob("*.md"))
    if not files:
        raise SystemExit(f"Tidak ada .md di {config.MATERIALS_DIR}")
    try:
        rag._db.delete_collection(config.COLLECTION)
    except Exception:
        pass  # belum ada, tidak masalah
    col = rag.collection()
    ids, docs, metas = [], [], []
    for f in files:
        meta, body = parse(f)
        for i, c in enumerate(chunks(body)):
            ids.append(f"{f.stem}-{i}")
            docs.append(c)
            metas.append({"title": meta["title"], "page": int(meta["page"]), "file": f.name})
    col.add(ids=ids, documents=docs, metadatas=metas, embeddings=rag.embed(docs))
    print(f"Selesai: {len(docs)} potongan dari {len(files)} file.")


if __name__ == "__main__":
    main()

"""Evaluasi retrieval versi VEKTOR (Chroma + Ollama), memakai EVAL_SET yang SAMA
dengan versi kata kunci (vercel/eval/dataset.js), supaya hasilnya bisa dibandingkan
dalam satu tabel di README.

Butuh materi sudah di-ingest: `python ingest.py` (Ollama + model embedding jalan).
Jalankan: python eval.py
"""
import json
import re
from pathlib import Path

from app import config, rag

DATASET_JS = Path(__file__).parent / "vercel" / "eval" / "dataset.js"


def load_dataset():
    """Ambil EVAL_SET dan OOD_SET dari file JS tanpa menjalankan JS (parsing sederhana)."""
    src = DATASET_JS.read_text(encoding="utf-8")

    def block(name):
        m = re.search(name + r"\s*=\s*\[(.*?)\n\];", src, re.S)
        return m.group(1) if m else ""

    pairs = re.findall(r'\["((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\]', block("EVAL_SET"))
    eval_set = [(q.encode().decode("unicode_escape"), t.encode().decode("unicode_escape")) for q, t in pairs]
    ood = [m.encode().decode("unicode_escape") for m in re.findall(r'"((?:[^"\\]|\\.)*)"', block("OOD_SET"))]
    return eval_set, ood


def main():
    eval_set, ood_set = load_dataset()
    k = max(3, config.TOP_K)
    hit1 = hit3 = 0
    rr_sum = 0.0
    for q, want in eval_set:
        titles = [h["title"] for h in rag.retrieve(q, k)]
        rank = titles.index(want) + 1 if want in titles else 0
        if rank == 1:
            hit1 += 1
        if 1 <= rank <= 3:
            hit3 += 1
        if rank >= 1:
            rr_sum += 1 / rank
        mark = "OK1" if rank == 1 else ("OK3" if rank else "MISS")
        print(f"{mark:4}| {q}\n     -> {titles}")

    n = len(eval_set)
    ood_ok = sum(1 for q in ood_set if not rag.retrieve(q, k))
    from datetime import date
    print(f"\nMetode: vektor (Chroma {config.EMBED_MODEL})  |  tanggal: {date.today()}")
    print(f"Hit@1: {hit1}/{n} ({hit1 / n:.0%})  Hit@3: {hit3}/{n} ({hit3 / n:.0%})  MRR: {rr_sum / n:.3f}")
    print(f"Di luar materi terjawab benar: {ood_ok}/{len(ood_set)}")


if __name__ == "__main__":
    main()

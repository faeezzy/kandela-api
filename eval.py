"""Evaluasi retrieval: apakah potongan yang benar muncul di top-k?

Ini bagian yang bikin RAG kamu bisa dipertanggungjawabkan di portofolio.
Tambah pertanyaan sendiri di EVAL_SET (pakai materi kuliahmu nanti).
Jalankan: python eval.py
"""
from app import config, rag

# (pertanyaan, judul materi yang seharusnya muncul)
EVAL_SET = [
    ("Berapa batas risiko per transaksi yang disarankan?", "Manajemen risiko"),
    ("Kenapa ukuran posisi dihitung dari stop loss?", "Manajemen risiko"),
    ("Apa arti RSI di atas 70?", "RSI dan MACD"),
    ("Histogram MACD positif artinya apa?", "RSI dan MACD"),
    ("Apa bedanya support dan resistance?", "Support dan resistance"),
    ("Candle hijau itu maksudnya apa?", "Dasar candlestick"),
    ("Kalau berita positif tapi chart turun, gimana?", "Membaca sentimen berita"),
    ("Kenapa untung satu transaksi tidak cukup untuk menilai keputusan?", "Disiplin dan evaluasi"),
]


def main():
    k = config.TOP_K
    hit1 = hitk = 0
    for q, want in EVAL_SET:
        titles = [h["title"] for h in rag.retrieve(q, k)]
        ok1 = bool(titles) and titles[0] == want
        okk = want in titles
        hit1 += ok1
        hitk += okk
        print(f"{'OK ' if okk else 'GAGAL'} | {q} -> {titles}")
    n = len(EVAL_SET)
    print(f"\nHit@1: {hit1}/{n} ({hit1 / n:.0%})  Hit@{k}: {hitk}/{n} ({hitk / n:.0%})")


if __name__ == "__main__":
    main()

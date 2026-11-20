# Kandela API (RAG dengan model open source)

Backend mentor "Sumbu": FastAPI + Chroma + Ollama. Semua jalan lokal, tanpa API berbayar.

Alur: pertanyaan -> embed (bge-m3) -> cari di Chroma -> model lokal (qwen2.5:7b) menjelaskan dengan sumber.
Skor dan hasil trade tetap dihitung kode, LLM hanya menjelaskan.

## Jalankan

1. Pasang Ollama: https://ollama.com/download
2. Tarik model (sekali saja, total beberapa GB):
   ```
   ollama pull qwen2.5:7b
   ollama pull bge-m3
   ```
   Laptop RAM 8 GB? Pakai `qwen2.5:3b` dan jalankan dengan `CHAT_MODEL=qwen2.5:3b`.
3. Siapkan Python 3.10+:
   ```
   python -m venv .venv
   source .venv/bin/activate        # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
4. Masukkan materi ke database vektor:
   ```
   python ingest.py
   ```
5. Nyalakan server:
   ```
   uvicorn app.main:app --reload
   ```
6. Coba di http://localhost:8000/docs, atau:
   ```
   curl -X POST localhost:8000/chat -H "Content-Type: application/json" \
     -d '{"question":"Kenapa risiko dibatasi 2 persen?"}'
   ```

## Evaluasi

`python eval.py` mengukur apakah materi yang benar muncul di top-k. Tambah pertanyaanmu sendiri di `EVAL_SET`.
Bandingkan juga jawaban `use_retrieval: true` vs `false` di `/chat` untuk melihat efek RAG.

## Mengganti materi

Taruh file `.md` di `materials/` dengan front matter `title` dan `page`, lalu `python ingest.py` lagi.
Materi di folder ini hanya contoh buatan sendiri. Ganti dengan materi kuliahmu.

## Konfigurasi (env var)

`CHAT_MODEL`, `EMBED_MODEL`, `OLLAMA_HOST`, `TOP_K`, `MAX_DISTANCE`, `CHROMA_PATH`.

## Masalah umum

- **`Microsoft Visual C++ 14.0 or greater is required` saat pip install**: itu karena `chromadb` versi lama butuh kompilasi `chroma-hnswlib`. `requirements.txt` ini sudah memakai `chromadb==1.5.9` yang tidak butuh kompilasi. Kalau kamu masih punya `requirements.txt` lama, ganti baris chromadb-nya, lalu `pip install -r requirements.txt` lagi.
- **503 "Model belum bisa dipakai"**: Ollama belum jalan atau model belum di-pull (`ollama list` untuk cek).
- **`/health` menunjukkan `chunks: 0`**: jalankan `python ingest.py` dulu.

## Frontend lokal

Server ini juga menyajikan halaman Kandela di http://127.0.0.1:8000/ (otomatis ke `/app/`).
Halaman mendeteksi backend lewat `/health`; kalau ada, chat Mentor memakai `/chat` (model lokal + sumber).
Butuh internet hanya untuk memuat GSAP, Lenis, dan font dari CDN.
Progres disimpan di localStorage browser (mode tamu), bukan di database.

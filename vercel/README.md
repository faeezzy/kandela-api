# Kandela di Vercel (full-stack)

Simulator belajar trading edukatif. **Data simulasi, bukan saran investasi.**
Skor dan hasil trade dihitung oleh kode secara deterministik; LLM (model open source via Groq) hanya menjelaskan.

## Isi folder

```
public/
  index.html     halaman utama (HTML + CSS)
  app.js         semua logika UI (dipisah agar CSP ketat bisa dipakai)
  privasi.html   kebijakan privasi + jalur hapus akun
api/
  _engine.js     mesin skenario + indikator + penilaian (deterministik, tanpa DOM)
  _retrieve.js   retrieval kata kunci (dipakai bersama chat & eval)
  _token.js      token skenario terenkripsi AES-256-GCM
  _ratelimit.js  rate limit Upstash (dilewati bila env tidak ada)
  _supabase.js   klien service-role + verifikasi JWT
  _http.js _log.js  helper HTTP & log terstruktur
  chat.js        POST /api/chat     RAG + Groq, rate limit, anti-injection
  scenario.js    GET  /api/scenario buat skenario (hanya 64 candle + token)
  submit.js      POST /api/submit   nilai keputusan, kirim 20 candle masa depan
  progress.js    GET/POST /api/progress   progres + impor progres tamu
  leaderboard.js GET  /api/leaderboard
  account.js     DELETE /api/account      hapus akun + semua data
  config.js      GET  /api/config   konfigurasi publik (anon key Supabase)
  health.js      GET  /api/health   cek per komponen
  _kb.json       materi (hasil konversi dari ../materials)
db/
  schema.sql     skema Postgres + RLS + fungsi submit (satu transaksi)
  rls_test.sql   bukti RLS: pengguna A tak bisa baca data B
eval/            evaluasi retrieval kata kunci (Hit@1/Hit@3/MRR)
tests/           unit test (node --test): mesin skor, chat, token, submit
scripts/check-env.js  gagal bila env wajib kosong
```

## Keputusan arsitektur

- **Anti-curang:** klien tidak pernah menerima candle masa depan atau seed sebelum keputusan dikirim.
  `/api/scenario` hanya mengirim 64 candle pertama + token terenkripsi. Seed ada di dalam token (AES-256-GCM),
  tidak bisa dibaca klien. `/api/submit` membuka token, menilai di server, baru mengirim 20 candle terakhir.
- **Token sekali pakai:** tabel `used_tokens` + `scenario_id UNIQUE` mencegah submit ganda (tanpa DB: cegah di memori instance).
- **Rumus skor:** 40% disiplin + 30% risk-reward + 30% teknikal/sentimen. Untung-rugi tidak masuk skor.
  Tes `tests/engine.test.js` mengunci rumus ini dan paritasnya dengan versi klien lama.

## Jalankan lokal

```
cd vercel
npm install
npm test            # unit test (tanpa env)
npm run eval        # evaluasi retrieval kata kunci
npm run check-env   # cek env wajib
vercel dev          # jalankan lokal (butuh `npm i -g vercel` + login)
```

Tanpa `vercel dev`, serving statis `public/` saja akan menampilkan halaman tetapi `/api/*` mati
(halaman memberi pesan "server belum tersambung" dan tidak crash).

## Variabel lingkungan

Set di Vercel: **Settings > Environment Variables**, atau `vercel env add`.

| Env | Wajib | Guna | Cara dapat |
|---|---|---|---|
| `GROQ_API_KEY` | ya | model chat | https://console.groq.com (gratis) |
| `GROQ_MODEL` | tidak | ganti model | default `llama-3.1-8b-instant` |
| `SCENARIO_SECRET` | ya | enkripsi token skenario (32 byte) | `openssl rand -hex 32` |
| `SUPABASE_URL` | ya | database + auth | Supabase > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | tulis data (server saja, **rahasia**) | Supabase > API > `service_role` |
| `SUPABASE_ANON_KEY` | ya | login Google di klien (publik, dibatasi RLS) | Supabase > API > `anon` |
| `UPSTASH_REDIS_REST_URL` | tidak | rate limit | https://upstash.com (gratis) |
| `UPSTASH_REDIS_REST_TOKEN` | tidak | rate limit | Upstash |

`SUPABASE_SERVICE_ROLE_KEY` tidak pernah dikirim ke klien. Tanpa Upstash, rate limit dilewati (hanya peringatan di log).

## Setup Supabase (database + login Google)

1. Buat proyek di https://supabase.com.
2. **SQL Editor** → tempel isi `db/schema.sql` → Run. (Aman dijalankan ulang.)
   - Uji RLS opsional: jalankan `db/rls_test.sql` (semua di-rollback, tidak meninggalkan data).
3. **Authentication > Providers > Google** → aktifkan. Salin *Callback URL* yang ditampilkan Supabase
   (bentuknya `https://<ref>.supabase.co/auth/v1/callback`).
4. **Google Cloud Console** (https://console.cloud.google.com):
   - APIs & Services > Credentials > *Create OAuth client ID* > Web application.
   - **Authorized redirect URIs:** tempel Callback URL dari Supabase (langkah 3).
   - Salin *Client ID* dan *Client secret* → tempel kembali ke Supabase (langkah 3).
5. **Authentication > URL Configuration** di Supabase → tambahkan ke *Redirect URLs*:
   - `https://<domain-vercel-kamu>` dan (untuk dev) `http://localhost:3000`.

## Deploy

```
npm i -g vercel
vercel            # preview
vercel --prod     # produksi
```

Pastikan `npm run check-env` lolos dulu. `vercel.json` sudah memasang header keamanan dasar
(Content-Security-Policy yang hanya mengizinkan CDN yang dipakai + Supabase, X-Content-Type-Options, Referrer-Policy)
dan cache aset statis.

## CI

`.github/workflows/ci.yml`: tiap push/PR menjalankan pemeriksaan sintaks semua file JS, `npm test`, dan `npm run eval`.
Deploy preview tetap lewat integrasi Vercel–GitHub.

## Melihat log & pemantauan

- `vercel logs <url>` menampilkan log terstruktur (JSON satu baris): `chat_ok`, `chat_429`, `auth_401`,
  `submit_ok`, `health_fail`, dll. Log tidak pernah memuat isi pertanyaan, email, atau token (hanya panjang + hash singkat).
- `/api/health` mengembalikan 200 bila semua komponen ok, 503 bila ada yang gagal, dengan rincian per komponen.
- Aturan peringatan sederhana: pasang uptime check gratis (mis. UptimeRobot) ke `GET /api/health`,
  beri tahu bila bukan 200. Itu menangkap key Groq salah, Supabase mati, atau materi kosong.

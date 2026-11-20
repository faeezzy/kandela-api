// EVAL_SET untuk evaluasi retrieval. Judul harus sama persis dengan judul di api/_kb.json.
// GANTI/ TAMBAH dengan pertanyaan dari materi kuliahmu nanti; makin banyak makin bisa dipertanggungjawabkan.
// Dipakai oleh eval/eval.js (kata kunci) dan ../../eval.py (vektor) supaya bisa dibandingkan dalam satu tabel.
"use strict";

const EVAL_SET = [
  // Dasar candlestick
  ["Apa itu candlestick?", "Dasar candlestick"],
  ["Candle hijau itu maksudnya apa?", "Dasar candlestick"],
  ["Apa arti sumbu atau wick pada lilin?", "Dasar candlestick"],
  ["Harga buka dan tutup ditunjukkan di mana pada candle?", "Dasar candlestick"],
  ["Badan merah pada candle berarti apa?", "Dasar candlestick"],
  // Support dan resistance
  ["Apa bedanya support dan resistance?", "Support dan resistance"],
  ["Di mana pembeli cenderung muncul?", "Support dan resistance"],
  ["Kenapa area yang sering diuji makin berarti?", "Support dan resistance"],
  ["Apakah resistance bisa tembus?", "Support dan resistance"],
  ["Area tempat penjual muncul disebut apa?", "Support dan resistance"],
  // RSI dan MACD
  ["Apa arti RSI di atas 70?", "RSI dan MACD"],
  ["RSI di bawah 30 menandakan apa?", "RSI dan MACD"],
  ["Histogram MACD positif artinya apa?", "RSI dan MACD"],
  ["Apa yang diukur RSI?", "RSI dan MACD"],
  ["Kenapa RSI jenuh bisa bertahan lama di tren kuat?", "RSI dan MACD"],
  // Manajemen risiko
  ["Berapa batas risiko per transaksi yang disarankan?", "Manajemen risiko"],
  ["Kenapa ukuran posisi dihitung dari stop loss?", "Manajemen risiko"],
  ["Apa itu rasio risk reward?", "Manajemen risiko"],
  ["Kenapa risk reward di bawah 1 banding 1 berbahaya?", "Manajemen risiko"],
  ["Kapan menentukan batas risiko?", "Manajemen risiko"],
  // Membaca sentimen berita
  ["Kalau berita positif tapi chart turun, gimana?", "Membaca sentimen berita"],
  ["Apakah sentimen berita bisa jadi pemicu tunggal?", "Membaca sentimen berita"],
  ["Kenapa sentimen sering sudah tercermin di harga?", "Membaca sentimen berita"],
  ["Kapan harus waspada membaca sentimen?", "Membaca sentimen berita"],
  ["Kondisi ideal antara sentimen dan teknikal yang seperti apa?", "Membaca sentimen berita"],
  // Disiplin dan evaluasi
  ["Kenapa untung satu transaksi tidak cukup untuk menilai keputusan?", "Disiplin dan evaluasi"],
  ["Keputusan trading dinilai dari apa?", "Disiplin dan evaluasi"],
  ["Apa yang membangun hasil jangka panjang?", "Disiplin dan evaluasi"],
  ["Kenapa proses lebih penting dari hasil satu trade?", "Disiplin dan evaluasi"],
  ["Apa peran keberuntungan dalam satu transaksi?", "Disiplin dan evaluasi"],
];

// Pertanyaan di luar materi: seharusnya dijawab "materinya belum ada" (retrieve mengembalikan kosong).
const OOD_SET = [
  "Bagaimana cara membuat bot trading otomatis?",
  "Apa prediksi harga Bitcoin tahun depan?",
  "Jelaskan pola Elliott Wave secara lengkap.",
  "Bagaimana strategi scalping satu menit?",
  "Apa itu pajak keuntungan kripto di Indonesia?",
];

module.exports = { EVAL_SET, OOD_SET };

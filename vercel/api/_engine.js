// Mesin skenario + penilaian Kandela. Port murni dari versi klien (public/index.html lama).
// Tanpa DOM, tanpa dependency. Semua angka dihitung KODE secara deterministik; LLM hanya menjelaskan.
"use strict";

const N = 84; // total candle
const DEC = 64; // keputusan diambil di candle ke-64 (indeks 63)
const LVL = 120; // XP per level

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// PRNG mulberry32-style
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HL = {
  pos: [
    "Volume transaksi naik di tengah arus masuk dana",
    "Minat beli institusi dilaporkan menguat",
    "Aktivitas jaringan meningkat, pengguna aktif bertambah",
    "Kemitraan baru diumumkan, pasar menyambut baik",
  ],
  neg: [
    "Aturan baru diumumkan, pelaku pasar waspada",
    "Penarikan dana besar terpantau, tekanan jual meningkat",
    "Likuiditas menipis, volatilitas diperkirakan naik",
    "Laporan keamanan memicu kekhawatiran investor",
  ],
  neu: [
    "Pelaku pasar menunggu data ekonomi pekan ini",
    "Volume mendatar, pasar cenderung konsolidasi",
    "Analis berbeda pendapat soal arah jangka pendek",
  ],
};

function genScenario(seed) {
  const r = rng((seed * 2654435761) >>> 0);
  const base = 20000 + Math.floor(r() * 40000);
  const dV = (r() - 0.42) * 0.5;
  const follow = r() < 0.55;
  const sg = Math.sign(dV) || 1;
  const dF = (follow ? sg : -sg) * (0.12 + r() * 0.35);
  const vol = 0.8 + r() * 0.9;
  let price = base;
  const c = [];
  for (let i = 0; i < N; i++) {
    const d = i < DEC ? dV : dF;
    const o = price;
    const ret = d / 100 + ((r() + r() + r() - 1.5) / 1.5) * vol / 100;
    const cl = o * (1 + ret);
    c.push({
      o,
      c: cl,
      h: Math.max(o, cl) * (1 + r() * vol / 160),
      l: Math.min(o, cl) * (1 - r() * vol / 160),
      v: (0.6 + r() * 0.8) * (1 + Math.abs(ret) * 60),
    });
    price = cl;
  }
  // Sentimen dibangkitkan sekali dan hanya diekspos sebagai angka di titik keputusan.
  const fs = Math.sign(dF);
  const informative = r() < 0.6;
  const ss = informative ? fs : -fs;
  const s = Math.round(clamp(50 + ss * (8 + r() * 30), 5, 95));
  const pick = (a) => a[Math.floor(r() * a.length)];
  let hls;
  if (s >= 58) hls = [{ t: pick(HL.pos), v: 0.6 }, { t: pick(HL.neu), v: 0.0 }];
  else if (s <= 42) hls = [{ t: pick(HL.neg), v: -0.5 }, { t: pick(HL.neu), v: 0.0 }];
  else {
    hls = [{ t: pick(HL.neu), v: 0.0 }, { t: r() < 0.5 ? pick(HL.pos) : pick(HL.neg), v: 0 }];
    hls[1].v = HL.pos.indexOf(hls[1].t) > -1 ? 0.4 : -0.3;
  }
  return { seed, candles: c, sentiment: s, headlines: hls };
}

function ema(a, n) {
  const k = 2 / (n + 1);
  const o = [];
  let e = a[0];
  for (let i = 0; i < a.length; i++) {
    e = i === 0 ? a[0] : a[i] * k + e * (1 - k);
    o.push(e);
  }
  return o;
}
function smaAll(a, n) {
  return a.map((_, i) => {
    if (i < n - 1) return null;
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += a[j];
    return s / n;
  });
}
function rsiAll(cl, n) {
  let g = 0, l = 0, i, d;
  for (i = 1; i <= n; i++) {
    d = cl[i] - cl[i - 1];
    if (d >= 0) g += d;
    else l -= d;
  }
  g /= n;
  l /= n;
  const out = [];
  for (i = 0; i < n; i++) out.push(null);
  out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  for (i = n + 1; i < cl.length; i++) {
    d = cl[i] - cl[i - 1];
    g = (g * (n - 1) + Math.max(d, 0)) / n;
    l = (l * (n - 1) + Math.max(-d, 0)) / n;
    out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
  }
  return out;
}

// Semua indikator dihitung HANYA dari candle sampai titik keputusan.
function analyze(sc) {
  const vis = sc.candles.slice(0, DEC).map((x) => x.c);
  const ma = smaAll(vis, 20);
  const e12 = ema(vis, 12), e26 = ema(vis, 26);
  const macd = e12.map((v, i) => v - e26[i]);
  const sig = ema(macd, 9);
  const hist = macd.map((v, i) => v - sig[i]);
  const rs = rsiAll(vis, 14);
  const i = DEC - 1;
  const a = {
    rsi: rs[i],
    hist: hist[i],
    above: vis[i] > ma[i],
    rising: ma[i] > ma[i - 5],
    histPos: hist[i] > 0,
    rsiBull: rs[i] > 50,
    sent: sc.sentiment,
  };
  a.T = (a.above ? 1 : -1) + (a.rising ? 1 : -1) + (a.histPos ? 1 : -1) + (a.rsiBull ? 1 : -1) +
    (a.sent >= 55 ? 1 : a.sent <= 45 ? -1 : 0);
  return a;
}

// dec = { dir: 'beli'|'tahan'|'jual', sl, tp, risk } (persen)
function evaluate(sc, an, dec) {
  const entry = sc.candles[DEC - 1].c;
  const ds = dec.dir === "beli" ? 1 : dec.dir === "jual" ? -1 : 0;
  const disc = dec.risk <= 2 ? 100 : clamp(100 - (dec.risk - 2) * 35, 0, 100);
  const rr = dec.tp / dec.sl;
  const rrS = clamp(rr * 50, 0, 100);
  const tech = ds === 0
    ? (Math.abs(an.T) <= 1 ? 85 : Math.abs(an.T) === 2 ? 60 : 35)
    : clamp(60 + ds * an.T * 8, 10, 100);
  const total = ds === 0 ? (0.4 * disc + 0.3 * tech) / 0.7 : 0.4 * disc + 0.3 * rrS + 0.3 * tech;
  let R = 0, exit = N - 1, status = "tahan", slP = null, tpP = null;
  if (ds !== 0) {
    slP = entry * (1 - ds * dec.sl / 100);
    tpP = entry * (1 + ds * dec.tp / 100);
    status = "akhir";
    exit = N - 1;
    for (let k = DEC; k < N; k++) {
      const c = sc.candles[k];
      const hSL = ds > 0 ? c.l <= slP : c.h >= slP;
      const hTP = ds > 0 ? c.h >= tpP : c.l <= tpP;
      if (hSL) { R = -1; exit = k; status = "sl"; break; }
      if (hTP) { R = rr; exit = k; status = "tp"; break; }
    }
    if (status === "akhir") R = ds * ((sc.candles[N - 1].c - entry) / entry * 100) / dec.sl;
  }
  return {
    entry, slP, tpP,
    disc: Math.round(disc), rrS: Math.round(rrS), tech: Math.round(tech), total: Math.round(total),
    R: Math.round(R * 100) / 100, exit, status, rr, ds,
  };
}

const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");

// Penjelasan berbasis aturan. cites berisi id materi (m1..m6) yang dipetakan klien ke judul/halaman.
function explain(an, dec, ev) {
  const T = an.T;
  const tone = T >= 2 ? "condong naik" : T <= -2 ? "condong turun" : "campur";
  const out = [];
  out.push("Sinyal teknikal dan sentimen " + tone + " (skor " + (T > 0 ? "+" : "") + T + " dari rentang -5 sampai +5).");
  if (dec.dir === "tahan") {
    out.push(Math.abs(T) <= 1
      ? "Memilih tahan saat sinyal campur itu masuk akal."
      : "Sinyalnya cukup jelas, jadi menahan berarti melewatkan peluang yang sebenarnya memenuhi kriteria.");
  } else {
    const al = ev.ds * T;
    out.push(al >= 2 ? "Arahmu sejalan dengan sinyal."
      : al <= -1 ? "Arahmu melawan sinyal, jadi alasannya perlu lebih kuat."
      : "Arahmu ada di area sinyal campur, keyakinannya belum kuat.");
    out.push("Risiko " + f1(dec.risk) + "% " + (dec.risk <= 2 ? "masih dalam" : "melewati") + " batas 2%. Risk-reward 1:" + f1(ev.rr) + " " +
      (ev.rr >= 2 ? "sudah sehat." : ev.rr >= 1 ? "cukup, tapi masih bisa dinaikkan." : "terlalu tipis."));
    out.push(ev.status === "tp" ? "Target kena (+" + f1(ev.R) + "R)."
      : ev.status === "sl" ? "Stop loss kena (-1R)."
      : "Posisi ditutup di akhir periode (" + (ev.R >= 0 ? "+" : "") + f1(ev.R) + "R).");
  }
  out.push("Ingat: skor menilai prosesmu, bukan untung-ruginya.");
  const ids = ["m6"];
  if (dec.risk > 2 || (dec.dir !== "tahan" && ev.rr < 1)) ids.unshift("m4");
  if (dec.dir !== "tahan") ids.push("m3");
  if (Math.abs(an.sent - 50) >= 10) ids.push("m5");
  return { text: out.join(" "), cites: ids.slice(0, 3) };
}

// XP dan level: aturan sama dengan versi klien lama.
const xpGain = (ev) => Math.round(ev.total * 0.6) + (ev.disc === 100 ? 10 : 0);
const levelOf = (xp) => 1 + Math.floor(xp / LVL);

// Analisis yang aman dikirim ke klien (tanpa data masa depan).
const publicAnalysis = (an) => ({
  rsi: an.rsi, hist: an.hist, above: an.above, rising: an.rising,
  histPos: an.histPos, rsiBull: an.rsiBull, sent: an.sent, T: an.T,
});

module.exports = {
  N, DEC, LVL, rng, genScenario, ema, smaAll, rsiAll, analyze, evaluate, explain, xpGain, levelOf, publicAnalysis,
};

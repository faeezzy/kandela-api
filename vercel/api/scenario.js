// GET /api/scenario: buat skenario baru di server. Klien hanya menerima 64 candle pertama + token terenkripsi.
"use strict";
const engine = require("./_engine");
const token = require("./_token");
const { noStore } = require("./_http");
const { log } = require("./_log");

module.exports = async function scenario(req, res) {
  noStore(res);
  if (req.method !== "GET") return res.status(405).json({ detail: "Gunakan GET" });
  try {
    const { token: tk, payload } = token.issue();
    const sc = engine.genScenario(payload.s);
    const an = engine.analyze(sc);
    return res.status(200).json({
      token: tk,
      expiresAt: payload.e,
      candles: sc.candles.slice(0, engine.DEC), // indeks 0..63 saja
      sentiment: sc.sentiment,
      headlines: sc.headlines,
      analysis: engine.publicAnalysis(an),
      n: engine.N,
      dec: engine.DEC,
    });
  } catch (e) {
    log("error", "scenario_error", { error: e.message });
    return res.status(500).json({ detail: "Skenario belum bisa dibuat. Coba lagi." });
  }
};

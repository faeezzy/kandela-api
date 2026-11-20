// POST /api/submit { token, dir, sl, tp, risk }
// Server membuka token, menilai keputusan, lalu baru mengirim candle masa depan.
// Jika login: attempts + progress ditulis dalam satu transaksi (fungsi SQL kandela_submit).
"use strict";
const engine = require("./_engine");
const tokenLib = require("./_token");
const { readJson, noStore } = require("./_http");
const { getAdmin, getUser } = require("./_supabase");
const { log, shortHash } = require("./_log");

const DIRS = new Set(["beli", "tahan", "jual"]);
const RANGES = { sl: [0.5, 5], tp: [0.5, 10], risk: [0.5, 5] };

// Cadangan bila database belum ada: hanya mencegah pemakaian ganda di instance yang sama.
// TODO: tanpa Supabase, token bisa dipakai ulang di instance function lain. Isi env Supabase untuk produksi.
const usedLocal = new Set();

function validate(b) {
  const errs = [];
  if (typeof b.token !== "string" || !b.token) errs.push("token wajib diisi");
  if (!DIRS.has(b.dir)) errs.push("dir harus beli, tahan, atau jual");
  for (const [k, [lo, hi]] of Object.entries(RANGES)) {
    const v = b[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) errs.push(`${k} harus angka ${lo}-${hi}`);
  }
  return errs;
}

function create(deps = {}) {
  const getDb = deps.getAdmin || getAdmin;
  const verify = deps.getUser || getUser;

  return async function submit(req, res) {
    noStore(res);
    if (req.method !== "POST") return res.status(405).json({ detail: "Gunakan POST" });
    const parsed = readJson(req);
    if (!parsed.ok) return res.status(parsed.status === 413 ? 413 : 422).json({ detail: parsed.detail });
    const b = parsed.body;
    const errs = validate(b);
    if (errs.length) return res.status(422).json({ detail: "Input tidak valid: " + errs.join("; ") });

    const db = getDb();
    const auth = await verify(req, db);
    if (auth.error) {
      log("warn", "auth_401", { path: "/api/submit" });
      return res.status(auth.error.status).json({ detail: auth.error.detail });
    }
    const user = auth.user;

    let p;
    try {
      p = tokenLib.open(b.token);
    } catch (e) {
      if (e.code === "expired") return res.status(410).json({ detail: e.message });
      if (e.code === "invalid") return res.status(400).json({ detail: "Token skenario tidak valid. Ambil skenario baru." });
      log("error", "submit_error", { error: e.message });
      return res.status(500).json({ detail: "Server belum siap menilai." });
    }

    const dec = { dir: b.dir, sl: b.sl, tp: b.tp, risk: b.risk };
    const sc = engine.genScenario(p.s);
    const an = engine.analyze(sc);
    const ev = engine.evaluate(sc, an, dec);
    const gain = engine.xpGain(ev);

    let progress = null;
    if (db) {
      const { data, error } = await db.rpc("kandela_submit", {
        p_user: user ? user.id : null,
        p_scenario: p.id,
        p_dir: dec.dir,
        p_sl: dec.sl,
        p_tp: dec.tp,
        p_risk: dec.risk,
        p_total: ev.total,
        p_disc: ev.disc,
        p_rr: ev.rrS,
        p_tech: ev.tech,
        p_r: ev.R,
        p_xp: gain,
      });
      if (error) {
        if (error.code === "23505") return res.status(409).json({ detail: "Skenario ini sudah dinilai. Ambil skenario baru." });
        log("error", "submit_db_error", { code: error.code, error: error.message });
        return res.status(503).json({ detail: "Database sedang bermasalah, keputusan belum tersimpan." });
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (user && row) progress = { xp: row.xp, streak: row.streak, last_day: row.last_day, level: engine.levelOf(row.xp) };
    } else {
      if (usedLocal.has(p.id)) return res.status(409).json({ detail: "Skenario ini sudah dinilai. Ambil skenario baru." });
      usedLocal.add(p.id);
      if (usedLocal.size > 5000) usedLocal.clear();
    }

    log("info", "submit_ok", { user: user ? shortHash(user.id) : "tamu", dir: dec.dir, total: ev.total, status: ev.status });
    return res.status(200).json({
      total: ev.total, disc: ev.disc, rrS: ev.rrS, tech: ev.tech, R: ev.R,
      status: ev.status, exit: ev.exit, entry: ev.entry, slP: ev.slP, tpP: ev.tpP, rr: ev.rr, ds: ev.ds,
      futureCandles: sc.candles.slice(engine.DEC), // candle 65-84
      explanation: engine.explain(an, dec, ev),
      xpGain: gain,
      progress,
      saved: Boolean(db && user),
    });
  };
}

module.exports = create();
module.exports.create = create;
module.exports.validate = validate;

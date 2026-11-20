// GET /api/leaderboard: 20 teratas (>= 3 latihan). Hanya nama tampilan, level, rata-rata skor.
"use strict";
const { getAdmin } = require("./_supabase");
const { log } = require("./_log");

module.exports = async function leaderboard(req, res) {
  if (req.method !== "GET") return res.status(405).json({ detail: "Gunakan GET" });
  const db = getAdmin();
  if (!db) return res.status(503).json({ detail: "Database belum dikonfigurasi.", rows: [] });
  const { data, error } = await db.from("leaderboard").select("display_name, level, avg_score");
  if (error) {
    log("error", "leaderboard_error", { error: error.message, code: error.code });
    return res.status(503).json({ detail: "Papan skor belum bisa dimuat.", rows: [] });
  }
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  return res.status(200).json({ rows: data || [] });
};

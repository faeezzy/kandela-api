// GET  /api/progress            -> progres + 40 latihan terakhir milik pengguna yang login
// POST /api/progress {action:'import', xp, streak} -> impor progres tamu, sekali saja
"use strict";
const { requireUser, getAdmin, profileFromUser } = require("./_supabase");
const { readJson, noStore } = require("./_http");
const engine = require("./_engine");
const { log, shortHash } = require("./_log");

// Progres tamu dihitung di browser, jadi tidak bisa dipercaya penuh. Batasi supaya tidak bisa "membeli" level.
const IMPORT_MAX_XP = 3000;
const IMPORT_MAX_STREAK = 60;

async function ensureRows(db, user) {
  await db.from("profiles").upsert(profileFromUser(user), { onConflict: "id", ignoreDuplicates: true });
  await db.from("progress").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
}

async function readAll(db, user) {
  const [prof, prog, att] = await Promise.all([
    db.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
    db.from("progress").select("xp, streak, last_day, imported").eq("user_id", user.id).maybeSingle(),
    db.from("attempts")
      .select("id, dir, sl, tp, risk, total, disc, rr_score, tech, r, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);
  const err = prof.error || prog.error || att.error;
  if (err) throw err;
  const p = prog.data || { xp: 0, streak: 0, last_day: null, imported: false };
  return {
    profile: prof.data,
    xp: p.xp,
    streak: p.streak,
    last_day: p.last_day,
    imported: p.imported,
    level: engine.levelOf(p.xp),
    attempts: (att.data || []).reverse().map((a) => ({
      id: a.id, dir: a.dir, sl: a.sl, tp: a.tp, risk: a.risk, total: a.total,
      disc: a.disc, rrS: a.rr_score, tech: a.tech, R: a.r, t: Date.parse(a.created_at),
    })),
  };
}

module.exports = async function progress(req, res) {
  noStore(res);
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ detail: "Gunakan GET atau POST" });
  const db = getAdmin();
  if (!db) return res.status(503).json({ detail: "Database belum dikonfigurasi." });
  const user = await requireUser(req, res, db);
  if (!user) return;

  try {
    await ensureRows(db, user);
    if (req.method === "GET") return res.status(200).json(await readAll(db, user));

    const parsed = readJson(req);
    if (!parsed.ok) return res.status(422).json({ detail: parsed.detail });
    const b = parsed.body;
    if (b.action !== "import") return res.status(422).json({ detail: "action tidak dikenal" });
    const xp = Math.max(0, Math.min(IMPORT_MAX_XP, Math.floor(Number(b.xp) || 0)));
    const streak = Math.max(0, Math.min(IMPORT_MAX_STREAK, Math.floor(Number(b.streak) || 0)));

    const { data: cur, error: e1 } = await db.from("progress").select("xp, streak, imported").eq("user_id", user.id).single();
    if (e1) throw e1;
    if (cur.imported) return res.status(409).json({ detail: "Progres tamu sudah pernah diimpor." });
    // Syarat imported=false ikut di WHERE supaya dua permintaan bersamaan tidak sama-sama lolos.
    const { data: upd, error: e2 } = await db
      .from("progress")
      .update({ xp: cur.xp + xp, streak: Math.max(cur.streak, streak), imported: true, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("imported", false)
      .select("xp");
    if (e2) throw e2;
    if (!upd || !upd.length) return res.status(409).json({ detail: "Progres tamu sudah pernah diimpor." });
    log("info", "progress_import", { user: shortHash(user.id), xp });
    return res.status(200).json(await readAll(db, user));
  } catch (e) {
    log("error", "progress_error", { error: e.message, code: e.code });
    return res.status(503).json({ detail: "Progres belum bisa dimuat. Coba lagi." });
  }
};

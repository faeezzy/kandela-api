// Klien Supabase sisi server (service role). SERVICE_ROLE_KEY tidak pernah dikirim ke klien.
"use strict";
const { bearer } = require("./_http");
const { log } = require("./_log");

let admin; // undefined = belum dicoba, null = env tidak ada

function getAdmin() {
  if (admin !== undefined) return admin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    admin = null;
    return admin;
  }
  const { createClient } = require("@supabase/supabase-js");
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

// Verifikasi JWT pengguna dari header Authorization.
// Kembalikan { user } jika valid, { user:null } jika tidak ada header, { error:{status,detail} } jika gagal.
async function getUser(req, db = getAdmin()) {
  const jwt = bearer(req);
  if (!jwt) return { user: null };
  if (!db) return { error: { status: 503, detail: "Login belum aktif: Supabase belum dikonfigurasi." } };
  try {
    const { data, error } = await db.auth.getUser(jwt);
    if (error || !data?.user) return { error: { status: 401, detail: "Sesi login tidak valid atau kedaluwarsa. Silakan masuk lagi." } };
    return { user: data.user };
  } catch (e) {
    log("error", "auth_verify_error", { error: e.message });
    return { error: { status: 503, detail: "Layanan login sedang bermasalah." } };
  }
}

// Wajib login: kirim 401 bila tidak ada token. Kembalikan user, atau null bila respons sudah dikirim.
async function requireUser(req, res, db = getAdmin()) {
  const r = await getUser(req, db);
  if (r.error) {
    log("warn", r.error.status === 401 ? "auth_401" : "auth_unavailable", { path: req.url });
    res.status(r.error.status).json({ detail: r.error.detail });
    return null;
  }
  if (!r.user) {
    log("warn", "auth_401", { path: req.url, reason: "tanpa token" });
    res.status(401).json({ detail: "Perlu masuk dengan Google untuk fitur ini." });
    return null;
  }
  return r.user;
}

// Hanya data yang diberikan Google yang dipakai: nama tampilan dan foto.
function profileFromUser(user) {
  const m = user.user_metadata || {};
  return {
    id: user.id,
    display_name: String(m.full_name || m.name || "Pemain").slice(0, 60),
    avatar_url: typeof m.avatar_url === "string" ? m.avatar_url : typeof m.picture === "string" ? m.picture : null,
  };
}

module.exports = { getAdmin, getUser, requireUser, profileFromUser, _reset: () => { admin = undefined; } };

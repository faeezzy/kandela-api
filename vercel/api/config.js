// GET /api/config: konfigurasi publik untuk klien. Anon key Supabase memang publik (dibatasi RLS).
// SERVICE_ROLE_KEY TIDAK PERNAH dikirim dari sini.
"use strict";

module.exports = function config(req, res) {
  const url = process.env.SUPABASE_URL || "";
  const anon = process.env.SUPABASE_ANON_KEY || "";
  res.setHeader("Cache-Control", "public, s-maxage=300");
  res.status(200).json({
    api: true,
    auth: Boolean(url && anon),
    supabaseUrl: url && anon ? url : null,
    supabaseAnonKey: url && anon ? anon : null,
  });
};

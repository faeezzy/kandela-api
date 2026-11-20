// DELETE /api/account: hapus attempts, progress, profiles, lalu user auth milik pengguna yang login.
"use strict";
const { requireUser, getAdmin } = require("./_supabase");
const { noStore } = require("./_http");
const { log, shortHash } = require("./_log");

module.exports = async function account(req, res) {
  noStore(res);
  if (req.method !== "DELETE") return res.status(405).json({ detail: "Gunakan DELETE" });
  const db = getAdmin();
  if (!db) return res.status(503).json({ detail: "Database belum dikonfigurasi." });
  const user = await requireUser(req, res, db);
  if (!user) return;
  try {
    // Hapus eksplisit (FK juga ON DELETE CASCADE sebagai jaring pengaman).
    for (const [table, col] of [["attempts", "user_id"], ["progress", "user_id"], ["profiles", "id"]]) {
      const { error } = await db.from(table).delete().eq(col, user.id);
      if (error) throw error;
    }
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;
    log("info", "account_deleted", { user: shortHash(user.id) });
    return res.status(200).json({ ok: true });
  } catch (e) {
    log("error", "account_delete_error", { error: e.message });
    return res.status(503).json({ detail: "Akun belum bisa dihapus. Coba lagi atau hubungi kontak di halaman privasi." });
  }
};

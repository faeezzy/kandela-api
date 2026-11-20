// Log terstruktur: satu baris JSON per kejadian, terbaca di `vercel logs`.
// JANGAN pernah memasukkan isi pertanyaan lengkap, email, atau token. Pakai len + hash singkat.
"use strict";
const crypto = require("crypto");

const FORBIDDEN = new Set(["question", "email", "token", "authorization", "key", "apiKey", "context", "password"]);

function shortHash(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 10);
}

// Hapus nilai yang mirip rahasia dari pesan error (mis. "Bearer gsk_...").
function scrub(v) {
  if (typeof v !== "string") return v;
  return v
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [disamarkan]")
    .replace(/\b(gsk|sk|pk|sb|eyJ)[A-Za-z0-9._-]{10,}/g, "[disamarkan]")
    .slice(0, 300);
}

function log(level, event, data = {}) {
  const row = { ts: new Date().toISOString(), level, event };
  for (const [k, v] of Object.entries(data)) {
    if (FORBIDDEN.has(k)) continue;
    row[k] = scrub(v);
  }
  const line = JSON.stringify(row);
  if (process.env.KANDELA_SILENT_LOG === "1") return row;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  return row;
}

module.exports = { log, shortHash, scrub };

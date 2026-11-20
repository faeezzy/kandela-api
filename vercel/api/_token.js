// Token skenario: { seed, kedaluwarsa, id unik } dienkripsi AES-256-GCM dengan SCENARIO_SECRET.
// Klien hanya melihat string acak; seed tidak bisa dibaca atau diubah tanpa kunci.
"use strict";
const crypto = require("crypto");
const { log } = require("./_log");

const TTL_MS = 15 * 60 * 1000;
let devKey = null;

// SCENARIO_SECRET = 32 byte, ditulis sebagai hex (64 karakter) atau base64.
function parseSecret(s) {
  if (!s) return null;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, "hex");
  const b = Buffer.from(s, "base64");
  return b.length === 32 ? b : null;
}

function getKey() {
  const raw = process.env.SCENARIO_SECRET;
  const k = parseSecret(raw);
  if (k) return k;
  if (raw) throw new Error("SCENARIO_SECRET harus 32 byte (hex 64 karakter atau base64)");
  if (process.env.VERCEL_ENV === "production") throw new Error("SCENARIO_SECRET belum diset");
  if (!devKey) {
    devKey = crypto.randomBytes(32);
    log("warn", "scenario_secret_ephemeral", { reason: "SCENARIO_SECRET kosong, pakai kunci sementara (dev)" });
  }
  return devKey;
}

const b64u = (b) => b.toString("base64url");

function seal(payload, key = getKey()) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final()]);
  return b64u(Buffer.concat([iv, c.getAuthTag(), ct]));
}

// Kembalikan payload, atau lempar Error dengan .code = 'invalid' | 'expired'.
function open(token, key = getKey(), now = Date.now()) {
  const fail = (code, msg) => Object.assign(new Error(msg), { code });
  if (typeof token !== "string" || token.length < 40 || token.length > 512) throw fail("invalid", "Token tidak valid");
  let buf;
  try {
    buf = Buffer.from(token, "base64url");
  } catch {
    throw fail("invalid", "Token tidak valid");
  }
  if (buf.length < 29) throw fail("invalid", "Token tidak valid");
  let p;
  try {
    const d = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    p = JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8"));
  } catch {
    throw fail("invalid", "Token tidak valid");
  }
  if (!p || typeof p.s !== "number" || typeof p.e !== "number" || typeof p.id !== "string") throw fail("invalid", "Token tidak valid");
  if (p.e < now) throw fail("expired", "Skenario sudah kedaluwarsa (15 menit). Ambil skenario baru.");
  return p;
}

function issue(now = Date.now()) {
  const seed = crypto.randomInt(1, 2 ** 21);
  const payload = { s: seed, e: now + TTL_MS, id: crypto.randomUUID() };
  return { token: seal(payload), payload };
}

module.exports = { TTL_MS, parseSecret, getKey, seal, open, issue };

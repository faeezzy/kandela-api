// Helper HTTP kecil untuk semua endpoint.
"use strict";

const MAX_BODY = 4096; // 4 KB

function clientIp(req) {
  const xf = req.headers?.["x-forwarded-for"];
  const first = (Array.isArray(xf) ? xf[0] : xf || "").split(",")[0].trim();
  return first || req.headers?.["x-real-ip"] || req.socket?.remoteAddress || "unknown";
}

// Kembalikan { ok, body } atau { ok:false, status, detail }.
function readJson(req, max = MAX_BODY) {
  const len = Number(req.headers?.["content-length"] || 0);
  if (len > max) return { ok: false, status: 413, detail: "Body terlalu besar (maks 4 KB)." };
  let body = req.body;
  if (typeof body === "string") {
    if (body.length > max) return { ok: false, status: 413, detail: "Body terlalu besar (maks 4 KB)." };
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, status: 400, detail: "Body harus JSON." };
    }
  }
  if (body == null) body = {};
  if (typeof body !== "object" || Array.isArray(body)) return { ok: false, status: 400, detail: "Body harus objek JSON." };
  if (JSON.stringify(body).length > max) return { ok: false, status: 413, detail: "Body terlalu besar (maks 4 KB)." };
  return { ok: true, body };
}

function bearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

function noStore(res) {
  if (typeof res.setHeader === "function") res.setHeader("Cache-Control", "no-store");
}

module.exports = { MAX_BODY, clientIp, readJson, bearer, noStore };

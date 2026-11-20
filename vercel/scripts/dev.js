// Dev server lokal tanpa Vercel CLI (tanpa symlink, aman di Windows).
// Menyajikan public/ sebagai statis dan menjalankan api/<nama>.js sebagai handler.
// Jalankan: npm run dev   lalu buka http://localhost:3000
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 3000);

// Muat .env.local (sederhana: KEY=VALUE per baris) tanpa dependency.
(function loadEnv() {
  const f = path.join(ROOT, ".env.local");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
})();

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".png": "image/png" };

// Adapter res agar handler gaya Vercel (res.status().json()) jalan di http biasa.
function adapt(res) {
  res.status = function (code) { this.statusCode = code; return this; };
  res.json = function (obj) {
    if (!this.headersSent) this.setHeader("Content-Type", "application/json; charset=utf-8");
    this.end(JSON.stringify(obj));
    return this;
  };
  return res;
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      req.headers["content-length"] = String(Buffer.byteLength(raw));
      if (!raw) return resolve(undefined);
      const ct = req.headers["content-type"] || "";
      if (ct.includes("application/json")) {
        try { return resolve(JSON.parse(raw)); } catch { return resolve(raw); }
      }
      resolve(raw);
    });
  });
}

async function serveApi(name, req, res) {
  const file = path.join(ROOT, "api", name + ".js");
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end(JSON.stringify({ detail: "Endpoint tidak ada: /api/" + name })); }
  let handler;
  try {
    // Dimuat sekali lalu di-cache, sama seperti instance function di Vercel.
    // (Status di memori seperti token sekali-pakai tetap konsisten antar-request.
    //  Edit kode? restart `npm run dev`.)
    handler = require(file);
  } catch (e) {
    res.statusCode = 500; return res.end(JSON.stringify({ detail: "Gagal memuat handler: " + e.message }));
  }
  req.body = await readBody(req);
  try {
    await handler(req, adapt(res));
  } catch (e) {
    console.error("[dev] error di /api/" + name, e);
    if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ detail: "Error server: " + e.message })); }
  }
}

function serveStatic(urlPath, res) {
  let rel = decodeURIComponent(urlPath.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end("forbidden"); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end("Tidak ditemukan: " + rel); }
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(data);
  });
}

http.createServer((req, res) => {
  const url = req.url || "/";
  if (url.startsWith("/api/")) {
    const name = url.slice(5).split(/[/?]/)[0];
    return serveApi(name, req, res);
  }
  serveStatic(url, res);
}).listen(PORT, () => {
  const envHint = process.env.GROQ_API_KEY ? "" : "  (GROQ_API_KEY belum ada: chat Sumbu nonaktif)";
  console.log(`Kandela dev di http://localhost:${PORT}${envHint}`);
  console.log("Skenario & latihan jalan tanpa env. Ctrl+C untuk berhenti.");
});

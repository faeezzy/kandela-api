// GET /api/health: cek per komponen. 200 bila semua wajib ok, 503 bila ada yang gagal.
"use strict";
const { kb } = require("./_retrieve");
const { getAdmin } = require("./_supabase");
const { parseSecret } = require("./_token");
const { log } = require("./_log");

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function checkGroq(env, doFetch) {
  if (!env.GROQ_API_KEY) return { ok: false, detail: "GROQ_API_KEY belum diset" };
  try {
    // Endpoint daftar model: ringan dan tidak memakai kuota token.
    const r = await withTimeout(doFetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    }), 3000);
    return r.ok ? { ok: true, model: env.GROQ_MODEL || "llama-3.1-8b-instant" } : { ok: false, detail: `Groq menolak key (HTTP ${r.status})` };
  } catch (e) {
    return { ok: false, detail: `Groq tidak terjangkau (${e.message})` };
  }
}

async function checkSupabase(db) {
  if (!db) return { ok: false, detail: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset" };
  try {
    const { error } = await withTimeout(db.from("progress").select("user_id", { head: true, count: "exact" }).limit(1), 3000);
    return error ? { ok: false, detail: `Query gagal (${error.code || error.message})` } : { ok: true };
  } catch (e) {
    return { ok: false, detail: `Supabase tidak terjangkau (${e.message})` };
  }
}

function create(deps = {}) {
  const env = deps.env || process.env;
  const doFetch = deps.fetch || ((...a) => fetch(...a));
  const getDb = deps.getAdmin || getAdmin;
  return async function health(req, res) {
    res.setHeader("Cache-Control", "no-store");
    const [groq, supabase] = await Promise.all([checkGroq(env, doFetch), checkSupabase(getDb())]);
    const components = {
      groq,
      supabase,
      materi: kb.length > 0 ? { ok: true, chunks: kb.length } : { ok: false, detail: "materi kosong" },
      scenario_secret: parseSecret(env.SCENARIO_SECRET) ? { ok: true } : { ok: false, detail: "SCENARIO_SECRET kosong/tidak 32 byte" },
      // Opsional: tanpa Upstash, rate limit dilewati (tidak membuat status gagal).
      ratelimit: { ok: true, active: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) },
    };
    const ok = Object.values(components).every((c) => c.ok);
    if (!ok) {
      const failed = Object.entries(components).filter(([, c]) => !c.ok).map(([k]) => k);
      log("error", "health_fail", { failed: failed.join(","), detail: failed.map((k) => components[k].detail).join(" | ") });
    }
    return res.status(ok ? 200 : 503).json({ ok, components });
  };
}

module.exports = create();
module.exports.create = create;

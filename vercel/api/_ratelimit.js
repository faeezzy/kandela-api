// Rate limit per IP: 10/menit dan 60/jam (sliding window) di Upstash Redis.
// Tanpa env Upstash (dev lokal): limiter dilewati dengan peringatan, tidak crash.
"use strict";
const { log } = require("./_log");

let cached; // limiter default dibuat sekali per instance function

function upstashLimiters() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const { Ratelimit } = require("@upstash/ratelimit");
  const { Redis } = require("@upstash/redis");
  const redis = new Redis({ url, token });
  return [
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), prefix: "kandela:rl:m" }),
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 h"), prefix: "kandela:rl:h" }),
  ];
}

function defaultLimiters() {
  if (cached === undefined) {
    cached = upstashLimiters();
    if (!cached) log("warn", "ratelimit_disabled", { reason: "UPSTASH_REDIS_REST_URL/TOKEN belum diset" });
  }
  return cached;
}

// Limiter di memori dengan antarmuka yang sama ({ limit(id) -> {success, reset} }). Dipakai sebagai mock di tes.
function memoryLimiter(max, windowMs, now = () => Date.now()) {
  const hits = new Map();
  return {
    async limit(id) {
      const t = now();
      const arr = (hits.get(id) || []).filter((x) => x > t - windowMs);
      if (arr.length >= max) {
        hits.set(id, arr);
        return { success: false, reset: arr[0] + windowMs, remaining: 0 };
      }
      arr.push(t);
      hits.set(id, arr);
      return { success: true, reset: arr[0] + windowMs, remaining: max - arr.length };
    },
  };
}

// Kembalikan { ok:true } atau { ok:false, retryAfter: detik }.
async function checkLimit(limiters, id) {
  if (!limiters || !limiters.length) return { ok: true, skipped: true };
  try {
    const results = await Promise.all(limiters.map((l) => l.limit(id)));
    const blocked = results.filter((r) => !r.success);
    if (!blocked.length) return { ok: true };
    const reset = Math.max(...blocked.map((r) => r.reset || Date.now() + 60000));
    return { ok: false, retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
  } catch (e) {
    // Redis bermasalah: jangan matikan chat, tapi catat.
    log("error", "ratelimit_error", { error: e.message });
    return { ok: true, skipped: true };
  }
}

module.exports = { defaultLimiters, memoryLimiter, checkLimit };

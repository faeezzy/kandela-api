// Cek env wajib sebelum deploy. Gagal (exit 1) bila ada yang kosong.
// Jalankan: npm run check-env
"use strict";
const { parseSecret } = require("../api/_token");

const REQUIRED = [
  { name: "GROQ_API_KEY", ok: (v) => !!v, hint: "API key dari https://console.groq.com" },
  { name: "SCENARIO_SECRET", ok: (v) => !!parseSecret(v), hint: "32 byte: `openssl rand -hex 32`" },
  { name: "SUPABASE_URL", ok: (v) => /^https:\/\//.test(v || ""), hint: "Supabase > Project Settings > API" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", ok: (v) => !!v, hint: "Supabase service_role key (rahasia, server saja)" },
  { name: "SUPABASE_ANON_KEY", ok: (v) => !!v, hint: "Supabase anon public key (untuk login di klien)" },
];
const OPTIONAL = [
  { name: "GROQ_MODEL", hint: "default llama-3.1-8b-instant" },
  { name: "UPSTASH_REDIS_REST_URL", hint: "rate limit (tanpa ini, limiter dilewati)" },
  { name: "UPSTASH_REDIS_REST_TOKEN", hint: "rate limit" },
];

let bad = 0;
console.log("Env wajib:");
for (const e of REQUIRED) {
  const v = process.env[e.name];
  const ok = e.ok(v);
  if (!ok) bad++;
  console.log(`  ${ok ? "OK  " : "KOSONG"} ${e.name}${ok ? "" : "  <- " + e.hint}`);
}
console.log("Env opsional:");
for (const e of OPTIONAL) {
  console.log(`  ${process.env[e.name] ? "ada " : "-   "} ${e.name}  (${e.hint})`);
}
if (bad) {
  console.error(`\n${bad} env wajib belum diisi. Set di Vercel (Settings > Environment Variables) atau .env lokal.`);
  process.exit(1);
}
console.log("\nSemua env wajib terisi.");

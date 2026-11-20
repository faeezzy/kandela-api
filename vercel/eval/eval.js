// Evaluasi retrieval kata kunci: Hit@1, Hit@3, MRR memakai fungsi retrieve yang SAMA dengan api/chat.js.
// Jalankan: node eval/eval.js   (atau: npm run eval)
"use strict";
const { retrieve } = require("../api/_retrieve");
const { EVAL_SET, OOD_SET } = require("./dataset");

function run() {
  let hit1 = 0, hit3 = 0, rrSum = 0;
  const rows = [];
  for (const [q, want] of EVAL_SET) {
    const titles = retrieve(q, 3).map((h) => h.title);
    const rank = titles.indexOf(want) + 1; // 0 jika tidak ada
    if (rank === 1) hit1++;
    if (rank >= 1 && rank <= 3) hit3++;
    if (rank >= 1) rrSum += 1 / rank;
    rows.push({ q, want, titles, rank });
  }
  const n = EVAL_SET.length;

  // Pertanyaan di luar materi: benar jika TIDAK ada hasil (model akan bilang "materinya belum ada").
  let oodOk = 0;
  for (const q of OOD_SET) if (retrieve(q, 3).length === 0) oodOk++;

  return {
    n,
    hit1, hit3, mrr: rrSum / n,
    hit1p: hit1 / n, hit3p: hit3 / n,
    ood: oodOk, oodN: OOD_SET.length,
    rows,
  };
}

function main() {
  const r = run();
  for (const row of r.rows) {
    const mark = row.rank === 1 ? "OK1" : row.rank ? "OK3" : "MISS";
    console.log(`${mark.padEnd(4)}| ${row.q}\n     -> [${row.titles.join(" | ")}]`);
  }
  console.log(`\nMetode: kata kunci (stem+skor)  |  tanggal: ${new Date().toISOString().slice(0, 10)}`);
  console.log(`Hit@1: ${r.hit1}/${r.n} (${(r.hit1p * 100).toFixed(0)}%)  Hit@3: ${r.hit3}/${r.n} (${(r.hit3p * 100).toFixed(0)}%)  MRR: ${r.mrr.toFixed(3)}`);
  console.log(`Di luar materi terjawab benar: ${r.ood}/${r.oodN}`);
}

module.exports = { run };
if (require.main === module) main();

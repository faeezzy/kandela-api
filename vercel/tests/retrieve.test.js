// Tes retrieval dipakai bersama chat & eval.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const { retrieve } = require("../api/_retrieve");

test("pertanyaan risiko -> Manajemen risiko di top-1", () => {
  const hits = retrieve("berapa batas risiko per transaksi?", 3);
  assert.equal(hits[0].title, "Manajemen risiko");
});

test("di luar materi -> array kosong (materinya belum ada)", () => {
  assert.equal(retrieve("resep rendang padang", 3).length, 0);
});

test("maksimal k hasil", () => {
  assert.ok(retrieve("harga candle rsi macd risiko sentimen", 2).length <= 2);
});

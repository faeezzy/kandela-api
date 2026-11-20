// Tes mesin skenario + skor: deterministik, rumus, batas, dan paritas dengan versi klien lama.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const engine = require("../api/_engine");
const ref = require("./fixtures/reference.json");

test("deterministik: seed sama -> candle & sentimen sama", () => {
  for (const sc of ref.scenarios) {
    const a = engine.genScenario(sc.seed);
    assert.equal(a.sentiment, sc.sentiment, "sentimen seed " + sc.seed);
    assert.deepEqual(a.candles.map((c) => c.c), sc.closes, "closes seed " + sc.seed);
    assert.equal(a.candles.length, engine.N);
    assert.equal(engine.analyze(a).T, sc.T, "skor T seed " + sc.seed);
  }
});

test("dua pemanggilan genScenario(seed) identik", () => {
  const x = JSON.stringify(engine.genScenario(12345));
  const y = JSON.stringify(engine.genScenario(12345));
  assert.equal(x, y);
});

test("evaluate cocok dengan nilai referensi (risiko 1%/3%, tahan, SL kena, TP kena)", () => {
  assert.ok(ref.cases.length >= 5);
  for (const c of ref.cases) {
    const sc = engine.genScenario(c.seed);
    const ev = engine.evaluate(sc, engine.analyze(sc), c.dec);
    for (const k of Object.keys(c.expect)) {
      assert.equal(ev[k], c.expect[k], `${c.name}: ${k} (dapat ${ev[k]}, mau ${c.expect[k]})`);
    }
  }
});

test("disiplin: 100 jika risiko <= 2%, turun 35/1% di atas", () => {
  const sc = engine.genScenario(500), an = engine.analyze(sc);
  const d = (risk) => engine.evaluate(sc, an, { dir: "beli", sl: 2, tp: 4, risk }).disc;
  assert.equal(d(1), 100);
  assert.equal(d(2), 100);
  assert.equal(d(3), 65);
  assert.equal(d(4), 30);
  assert.equal(d(5), 0); // clamp di 0
});

test("risk-reward skor = min(100, (tp/sl)*50)", () => {
  const sc = engine.genScenario(501), an = engine.analyze(sc);
  assert.equal(engine.evaluate(sc, an, { dir: "beli", sl: 2, tp: 2, risk: 2 }).rrS, 50);
  assert.equal(engine.evaluate(sc, an, { dir: "beli", sl: 2, tp: 8, risk: 2 }).rrS, 100); // 200 -> clamp
});

test("tahan: skor = (0.4*disc + 0.3*tech)/0.7, tanpa R", () => {
  const sc = engine.genScenario(777), an = engine.analyze(sc);
  const ev = engine.evaluate(sc, an, { dir: "tahan", sl: 2, tp: 4, risk: 2 });
  const tech = Math.abs(an.T) <= 1 ? 85 : Math.abs(an.T) === 2 ? 60 : 35;
  assert.equal(ev.total, Math.round((0.4 * 100 + 0.3 * tech) / 0.7));
  assert.equal(ev.status, "tahan");
  assert.equal(ev.R, 0);
});

test("hari kebalikan: beli vs jual pada seed sama memberi hasil R yang masuk akal", () => {
  const sc = engine.genScenario(888), an = engine.analyze(sc);
  const beli = engine.evaluate(sc, an, { dir: "beli", sl: 2, tp: 4, risk: 2 });
  const jual = engine.evaluate(sc, an, { dir: "jual", sl: 2, tp: 4, risk: 2 });
  // SL selalu -1R; selain itu R terbatas rentang wajar.
  for (const ev of [beli, jual]) assert.ok(ev.R >= -1 && ev.R <= 5, "R dalam rentang");
  if (beli.status === "sl") assert.equal(beli.R, -1);
});

test("XP dan level", () => {
  assert.equal(engine.xpGain({ total: 80, disc: 100 }), Math.round(80 * 0.6) + 10);
  assert.equal(engine.xpGain({ total: 80, disc: 65 }), Math.round(80 * 0.6));
  assert.equal(engine.levelOf(0), 1);
  assert.equal(engine.levelOf(120), 2);
  assert.equal(engine.levelOf(239), 2);
  assert.equal(engine.levelOf(360), 4);
});

test("publicAnalysis tidak membocorkan data masa depan", () => {
  const sc = engine.genScenario(123);
  const pub = engine.publicAnalysis(engine.analyze(sc));
  assert.deepEqual(Object.keys(pub).sort(), ["T", "above", "hist", "histPos", "rising", "rsi", "rsiBull", "sent"].sort());
  assert.ok(!("candles" in pub) && !("ma" in pub));
});

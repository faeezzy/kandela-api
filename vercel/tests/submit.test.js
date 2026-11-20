// Tes endpoint submit: validasi rentang, token sekali pakai, hasil cocok mesin.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
process.env.KANDELA_SILENT_LOG = "1";
process.env.SCENARIO_SECRET = require("crypto").randomBytes(32).toString("hex");
const submitMod = require("../api/submit");
const tokenLib = require("../api/_token");
const engine = require("../api/_engine");
const { mockRes, mockReq } = require("./helpers");

// Tanpa DB: pakai jalur usedLocal (getAdmin -> null, getUser -> tamu).
const handler = submitMod.create({ getAdmin: () => null, getUser: async () => ({ user: null }) });
const freshToken = () => tokenLib.issue().token;

test("method salah -> 405", async () => {
  const res = mockRes();
  await handler(mockReq({ method: "GET" }), res);
  assert.equal(res.statusCode, 405);
});

test("sl/tp/risk di luar rentang -> 422", async () => {
  for (const bad of [{ sl: 0.1 }, { sl: 6 }, { tp: 20 }, { risk: 9 }, { dir: "maybe" }]) {
    const res = mockRes();
    await handler(mockReq({ method: "POST", body: { token: freshToken(), dir: "beli", sl: 2, tp: 4, risk: 2, ...bad } }), res);
    assert.equal(res.statusCode, 422, JSON.stringify(bad));
  }
});

test("token tidak valid -> 400", async () => {
  const res = mockRes();
  await handler(mockReq({ method: "POST", body: { token: "ngawur", dir: "beli", sl: 2, tp: 4, risk: 2 } }), res);
  assert.equal(res.statusCode, 400);
});

test("submit sukses mengembalikan futureCandles (20) dan skor = mesin", async () => {
  const { token, payload } = tokenLib.issue();
  const res = mockRes();
  await handler(mockReq({ method: "POST", body: { token, dir: "beli", sl: 2, tp: 4, risk: 2 } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.futureCandles.length, engine.N - engine.DEC);
  const sc = engine.genScenario(payload.s), an = engine.analyze(sc);
  const ev = engine.evaluate(sc, an, { dir: "beli", sl: 2, tp: 4, risk: 2 });
  assert.equal(res.body.total, ev.total);
  assert.equal(res.body.status, ev.status);
  assert.ok(Array.isArray(res.body.explanation.cites));
});

test("token sekali pakai: pemakaian kedua -> 409", async () => {
  const token = freshToken();
  const r1 = mockRes();
  await handler(mockReq({ method: "POST", body: { token, dir: "jual", sl: 2, tp: 4, risk: 2 } }), r1);
  assert.equal(r1.statusCode, 200);
  const r2 = mockRes();
  await handler(mockReq({ method: "POST", body: { token, dir: "jual", sl: 2, tp: 4, risk: 2 } }), r2);
  assert.equal(r2.statusCode, 409);
});

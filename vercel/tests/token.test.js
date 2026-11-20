// Tes token skenario: round-trip, tahan rusak, kedaluwarsa.
"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const t = require("../api/_token");

const KEY = crypto.randomBytes(32);

test("seal/open round-trip menjaga payload", () => {
  const p = { s: 12345, e: Date.now() + 1000, id: "abc" };
  const tok = t.seal(p, KEY);
  assert.deepEqual(t.open(tok, KEY), p);
});

test("token tidak bisa dibuka dengan kunci lain", () => {
  const tok = t.seal({ s: 1, e: Date.now() + 1000, id: "x" }, KEY);
  assert.throws(() => t.open(tok, crypto.randomBytes(32)), /valid/i);
});

test("token kedaluwarsa -> error .code expired", () => {
  const tok = t.seal({ s: 1, e: Date.now() - 1, id: "x" }, KEY);
  assert.throws(() => t.open(tok, KEY), (e) => e.code === "expired");
});

test("token acak/rusak -> error .code invalid", () => {
  assert.throws(() => t.open("bukantoken", KEY), (e) => e.code === "invalid");
});

test("parseSecret menerima hex 64 dan base64 32-byte", () => {
  assert.ok(t.parseSecret("a".repeat(64)));
  assert.ok(t.parseSecret(crypto.randomBytes(32).toString("base64")));
  assert.equal(t.parseSecret("pendek"), null);
});

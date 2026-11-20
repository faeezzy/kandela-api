// Retrieval kata kunci yang dipakai bersama oleh api/chat.js dan eval/eval.js.
"use strict";
const defaultKb = require("./_kb.json");

const STOP = new Set(
  "yang dan di ke dari untuk dengan atau itu ini apa itu adalah kenapa bagaimana gimana kalau jika tapi pada dalam akan bisa ada tidak saya aku kamu the of is a an to".split(
    " "
  )
);
const tokens = (s) =>
  (String(s).toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 1 && !STOP.has(w));
const stem = (w) => w.slice(0, 5);

// Kembalikan maksimal k materi dengan skor > 0, urut menurun. Array kosong = materinya belum ada.
function retrieve(question, k = 3, kb = defaultKb) {
  const q = new Set(tokens(question).map(stem));
  return kb
    .map((d) => {
      const title = new Set(tokens(d.title).map(stem));
      const body = new Set(tokens(d.text).map(stem));
      let s = 0;
      q.forEach((w) => {
        if (title.has(w)) s += 3;
        if (body.has(w)) s += 1;
      });
      return { d, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.d);
}

module.exports = { retrieve, tokens, stem, kb: defaultKb };

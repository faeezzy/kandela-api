// Mock req/res sederhana untuk menguji handler serverless tanpa server sungguhan.
"use strict";

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
  return res;
}

function mockReq({ method = "GET", body, headers = {} } = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = v;
  if (body !== undefined && h["content-length"] === undefined) {
    h["content-length"] = String(Buffer.byteLength(typeof body === "string" ? body : JSON.stringify(body)));
  }
  return { method, body, headers: h, url: "/", socket: { remoteAddress: "127.0.0.1" } };
}

// Limiter palsu: menolak setelah `max` panggilan dengan id apa pun.
function fakeLimiter(max) {
  let n = 0;
  return [{ async limit() { n++; return n > max ? { success: false, reset: Date.now() + 60000 } : { success: true, reset: Date.now() + 60000 }; } }];
}

module.exports = { mockRes, mockReq, fakeLimiter };

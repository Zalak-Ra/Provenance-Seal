import test from "node:test";
import assert from "node:assert/strict";
import { assessScans } from "../src/services/analytics.js";

const options = {
  scanWindowMs: 600000,
  scanDayMs: 86400000,
  suspiciousRecentScans: 3,
  suspiciousDistinctClients: 3
};

function scan(partial) {
  return {
    timestamp: partial.timestamp,
    clientHash: partial.clientHash || null,
    region: partial.region || null,
    found: true
  };
}

test("a single scan is not treated as suspicious", () => {
  const now = 1_000_000;
  const result = assessScans([scan({ timestamp: now, clientHash: "a", region: "India" })], now, options);
  assert.equal(result.level, "none");
  assert.equal(result.reasons.length, 0);
  assert.match(result.disclaimer, /do not prove/i);
});

test("repeated scans from one client are a watch signal", () => {
  const now = 1_000_000;
  const scans = [0, 1, 2].map((offset) => scan({ timestamp: now - offset, clientHash: "same", region: "India" }));
  const result = assessScans(scans, now, options);
  assert.equal(result.level, "watch");
  assert.equal(result.recentCount, 3);
  assert.equal(result.reasons.length, 1);
});

test("many clients and differing reported regions are marked suspicious", () => {
  const now = 1_000_000;
  const scans = [
    scan({ timestamp: now, clientHash: "a", region: "India" }),
    scan({ timestamp: now - 10, clientHash: "b", region: "India" }),
    scan({ timestamp: now - 20, clientHash: "c", region: "Singapore" })
  ];
  const result = assessScans(scans, now, options);
  assert.equal(result.level, "suspicious");
  assert.ok(result.reasons.length >= 2);
  assert.match(result.reasons.join(" "), /spoofed/i);
});

test("old scans fall outside the short window", () => {
  const now = 10_000_000;
  const scans = [1, 2, 3].map((index) => scan({ timestamp: now - 3_600_000, clientHash: `c${index}` }));
  const result = assessScans(scans, now, options);
  assert.equal(result.recentCount, 0);
  assert.equal(result.level, "none");
});

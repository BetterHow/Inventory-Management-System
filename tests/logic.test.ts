import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allocateFefo,
  safetyStatus,
  expiryStatus,
  periodKey,
  periodRange,
  parseTaipeiDate,
  monthlyFromTotal,
} from "../src/lib/logic.ts";

const d = (s: string) => new Date(s + "T00:00:00Z");

test("allocateFefo takes the batch that expires first", () => {
  const batches = [
    { id: 1, qty: 10, expiryDate: d("2027-06-01"), createdAt: d("2026-01-01") },
    { id: 2, qty: 5, expiryDate: d("2027-01-01"), createdAt: d("2026-02-01") },
    { id: 3, qty: 8, expiryDate: null, createdAt: d("2025-01-01") },
  ];
  const r = allocateFefo(batches, 7);
  assert.deepEqual(r.allocations, [
    { batchId: 2, qty: 5 },
    { batchId: 1, qty: 2 },
  ]);
  assert.equal(r.shortfall, 0);
});

test("allocateFefo puts the shortfall on the last batch (negative stock allowed)", () => {
  const batches = [
    { id: 1, qty: 3, expiryDate: d("2027-01-01"), createdAt: d("2026-01-01") },
    { id: 2, qty: 0, expiryDate: d("2028-01-01"), createdAt: d("2026-01-01") },
  ];
  const r = allocateFefo(batches, 5);
  assert.equal(r.shortfall, 2);
  assert.deepEqual(r.allocations, [
    { batchId: 1, qty: 3 },
    { batchId: 2, qty: 2 },
  ]);
});

test("allocateFefo with no batches returns a new-batch allocation", () => {
  const r = allocateFefo([], 4);
  assert.deepEqual(r.allocations, [{ batchId: null, qty: 4 }]);
  assert.equal(r.shortfall, 4);
});

test("safetyStatus thresholds", () => {
  assert.equal(safetyStatus(-1, 10), "NEGATIVE");
  assert.equal(safetyStatus(5, 10), "LT1");
  assert.equal(safetyStatus(15, 10), "LT2");
  assert.equal(safetyStatus(25, 10), "LT3");
  assert.equal(safetyStatus(30, 10), "OK");
  assert.equal(safetyStatus(30, null), "NONE");
});

test("expiryStatus", () => {
  const today = d("2026-11-06");
  assert.equal(expiryStatus(d("2026-11-01"), today, 90, 30), "EXPIRED");
  assert.equal(expiryStatus(d("2026-11-20"), today, 90, 30), "DANGER");
  assert.equal(expiryStatus(d("2027-01-20"), today, 90, 30), "WARN");
  assert.equal(expiryStatus(d("2027-06-01"), today, 90, 30), "OK");
});

test("periodKey uses Taiwan time and Monday weeks", () => {
  // 2026-11-01 17:00 UTC = 2026-11-02 01:00 Taipei (a Monday)
  const t = new Date("2026-11-01T17:00:00Z");
  assert.equal(periodKey(t, "day"), "2026-11-02");
  assert.equal(periodKey(t, "week"), "2026-11-02 週");
  assert.equal(periodKey(new Date("2026-11-08T03:00:00Z"), "week"), "2026-11-02 週");
  assert.equal(periodKey(t, "month"), "2026-11");
  assert.equal(periodKey(t, "quarter"), "2026 Q4");
});

test("periodRange lists every month in range", () => {
  const keys = periodRange(parseTaipeiDate("2026-08-15"), parseTaipeiDate("2026-11-06"), "month");
  assert.deepEqual(keys, ["2026-08", "2026-09", "2026-10", "2026-11"]);
});

test("monthlyFromTotal", () => {
  assert.equal(monthlyFromTotal(90, 90), 30);
  assert.equal(monthlyFromTotal(0, 0), 0);
});

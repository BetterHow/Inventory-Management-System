import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeHis, type ReportLine } from "../src/lib/hisReport.ts";

const line = (o: Partial<ReportLine>): ReportLine => ({
  itemId: 1, hisCode: "AC1", hisName: "X", priceType: "NHI", unitPrice: 10, hisQty: 1, qty: 1, amount: 10, cost: 5, hisCost: 5, ...o,
});

test("summarizeHis adds up revenue, our cost and margin per price type and per item", () => {
  const r = summarizeHis([
    line({ priceType: "NHI", unitPrice: 13.6, hisQty: 8, qty: 8, amount: 109, cost: 118, hisCost: 14.75 }),
    line({ priceType: "SELF", unitPrice: 50, hisQty: 2, qty: 2, amount: 100, cost: 29.5, hisCost: 14.75 }),
    line({ priceType: "FREE", unitPrice: 0, hisQty: 1, qty: 1, amount: 0, cost: 14.75, hisCost: 14.75 }),
  ]);
  assert.equal(r.totals.revenue, 209);
  assert.equal(r.totals.cost, 162.25);
  assert.equal(r.totals.margin, 46.75);
  assert.deepEqual(r.types.map((t) => [t.type, t.qty, t.revenue]), [["NHI", 8, 109], ["SELF", 2, 100], ["FREE", 1, 0]]);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].qty, 11);
  assert.equal(r.items[0].hisCostTotal, 162.25);
  assert.deepEqual(r.items[0].prices.map((p) => p.price), [50, 13.6, 0]);
  assert.deepEqual(r.items[0].flags, []);
});

test("summarizeHis flags missing costs and big differences from 方鼎's cost", () => {
  const r = summarizeHis([
    line({ itemId: 1, cost: 0, hisCost: 5 }), // we have no purchase cost
    line({ itemId: 2, hisCode: "MOU", cost: 9000, hisCost: 0, amount: 11550, unitPrice: 11550, priceType: "SELF" }), // 方鼎 has no cost
    line({ itemId: 3, cost: 51, hisCost: 33.3 }), // 53% higher than 方鼎
    line({ itemId: 4, cost: 20, amount: 10 }), // sold below cost
  ]);
  const flags = Object.fromEntries(r.items.map((i) => [i.itemId, i.flags]));
  assert.deepEqual(flags[1], ["NO_COST"]);
  assert.deepEqual(flags[2], ["HIS_NO_COST"]);
  assert.deepEqual(flags[3], ["COST_DIFF", "LOSS"]);
  assert.deepEqual(flags[4], ["COST_DIFF", "LOSS"]);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHisText, parseHisTable, classifyPrice, classifyRows, findPeriod } from "../src/lib/hisParse.ts";

const printed = `                    台全診所
                  藥品耗用統計表
  統計期間 : 115 年 11 月 9 日 至 115 年 11 月 9 日
藥品代號    藥品簡稱                 索引      單價     用量    合計      成本  成本合計 開藥次
115051C269  (10ML)Hi Tears 1.4%      HIT       0.00      1.0       0     13.00       13      1
A022122100  LACTAM 500 MG            LAC       0.35      9.0       3      0.30        3      1
AC45960435  SINOMIN 15ML/BOT         SIN      50.00      2.0     100     14.75       30      2
AC45960435  SINOMIN 15ML/BOT         SIN      13.60      8.0     109     14.75      118      8
AC37577IG0  [管四]ERA 0.25 MG        ERA       2.00      1.0       2      2.45        2      1
                                           合計                 214`;

test("parseHisText reads the printed report and its period", () => {
  const r = parseHisText(printed);
  assert.equal(r.error, undefined);
  assert.equal(r.from, "2026-11-09");
  assert.equal(r.to, "2026-11-09");
  assert.equal(r.rows.length, 5);
  assert.deepEqual(r.rows[1], { code: "A022122100", name: "LACTAM 500 MG", price: 0.35, qty: 9, amount: 3, hisCost: 0.3, rx: 1 });
  assert.equal(r.rows[3].price, 13.6);
  assert.equal(r.rows[4].code, "AC37577IG0");
});

test("parseHisTable finds columns by header name (CSV / Excel)", () => {
  const r = parseHisTable([
    ["藥品耗用統計表"],
    ["統計期間：115年11月1日至115年11月7日"],
    ["藥品代號", "藥品簡稱", "索引", "單價", "用量", "合計", "成本", "成本合計", "開藥次"],
    ["ac45960435", "SINOMIN", "SIN", "50.00", "2.0", "100", "14.75", "30", "2"],
    ["", "合計", "", "", "", "100", "", "", ""],
  ]);
  assert.equal(r.from, "2026-11-01");
  assert.equal(r.to, "2026-11-07");
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].code, "AC45960435");
  assert.equal(r.rows[0].hisCost, 14.75);
});

test("CSV text goes through the table reader", () => {
  const r = parseHisText("藥品代號,藥品簡稱,單價,用量,合計\nA1234567,X,10,3,30\nB1234567,Y,0,1,0\n");
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].amount, 30);
});

test("classifyPrice: 0 = 贈送, equals NHI = 健保, else 自費", () => {
  assert.equal(classifyPrice(0, 13.6), "FREE");
  assert.equal(classifyPrice(13.6, 13.6), "NHI");
  assert.equal(classifyPrice(50, 13.6), "SELF");
  assert.equal(classifyPrice(50, null), "SELF");
});

test("findPeriod with western dates", () => {
  assert.deepEqual(findPeriod("日期 2026/11/01 ~ 2026/11/30"), { from: "2026-11-01", to: "2026-11-30" });
});

test("classifyRows guesses 健保 as the lowest price when the system has no 健保價 yet", () => {
  const rows = [
    { code: "AC1", price: 50 },
    { code: "AC1", price: 13.6 },
    { code: "AC1", price: 0 },
    { code: "SELF1", price: 11550 },
    { code: "AC2", price: 26.9 },
    { code: "AC2", price: 30 },
  ];
  const info = (code: string) =>
    code === "AC1" ? { nhiPrice: null, hasNhiCode: true }
    : code === "AC2" ? { nhiPrice: 26.9, hasNhiCode: true }
    : { nhiPrice: null, hasNhiCode: false };
  const r = classifyRows(rows, info);
  assert.deepEqual(r.map((x) => [x.priceType, x.guessed]), [
    ["SELF", true], ["NHI", true], ["FREE", false], ["SELF", false], ["NHI", false], ["SELF", false],
  ]);
});

import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth";
import { buildReport, defaultParams } from "@/lib/reports";

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const report = await buildReport(defaultParams(sp));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("報表");
  ws.addRow([report.title]).font = { bold: true, size: 13 };
  const header = ws.addRow(report.headers);
  header.font = { bold: true };
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });
  for (const r of report.rows) ws.addRow(r);
  if (report.totals) ws.addRow(report.totals).font = { bold: true };
  ws.columns.forEach((col, i) => {
    col.width = i < report.numericFrom ? 18 : 12;
    if (i >= report.numericFrom) col.numFmt = "#,##0.##";
  });
  ws.views = [{ state: "frozen", ySplit: 2, xSplit: Math.min(2, report.numericFrom) }];

  const buf = await wb.xlsx.writeBuffer();
  const name = encodeURIComponent(`${report.title}.xlsx`);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${name}`,
    },
  });
}

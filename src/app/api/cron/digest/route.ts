import { NextResponse, type NextRequest } from "next/server";
import { sendDigest } from "@/lib/digest";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Called once a day by Vercel Cron (see vercel.json), which sends "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await sendDigest();
  if (r.sent) await audit("/settings", "寄出每日提醒", r.to?.join("、"), { name: "系統排程" });
  return NextResponse.json(r);
}

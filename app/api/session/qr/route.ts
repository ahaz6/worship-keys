import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Missing join URL." }, { status: 400 });
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid join URL." }, { status: 400 });
  }
  if (url.origin !== request.nextUrl.origin || url.pathname !== "/join" || (url.searchParams.get("t")?.length ?? 0) < 24) {
    return NextResponse.json({ error: "Unknown join URL." }, { status: 400 });
  }
  const dataUrl = await QRCode.toDataURL(url.toString(), {
    margin: 1,
    width: 416,
    color: { dark: "#0d0d12", light: "#f4f3fa" },
  });
  return NextResponse.json({ dataUrl }, { headers: { "cache-control": "no-store" } });
}

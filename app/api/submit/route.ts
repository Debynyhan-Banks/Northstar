import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json();
  const endpoint = process.env.APPS_SCRIPT_WEB_APP_URL;

  if (!endpoint) {
    return NextResponse.json({
      ok: true,
      submissionId: crypto.randomUUID(),
      mode: "preview",
    });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return NextResponse.json(
      { ok: false, message: "Submission service unavailable" },
      { status: 502 },
    );
  }

  const result = await response.json();
  return NextResponse.json({ ...result, mode: "connected" });
}

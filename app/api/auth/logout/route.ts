import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const response = NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set({
    name: sessionCookie.name,
    value: "",
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}

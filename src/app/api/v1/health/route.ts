/**
 * GET /api/v1/health — Public health check for Railway / load balancers.
 * No auth required. Returns minimal status.
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

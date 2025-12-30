import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  const specPath = path.join(process.cwd(), "docs", "openapi.yaml");
  const content = fs.readFileSync(specPath, "utf8");
  return new NextResponse(content, {
    headers: { "Content-Type": "application/yaml" },
  });
}

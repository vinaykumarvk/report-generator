import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "writing-styles.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ writing_styles: [] });
    }
    const fileContents = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(fileContents);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to load writing styles:", error);
    return NextResponse.json(
      { error: "Failed to load writing styles" },
      { status: 500 }
    );
  }
}



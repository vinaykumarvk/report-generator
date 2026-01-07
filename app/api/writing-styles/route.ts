import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "writing-styles.json");
    console.log("Writing styles API: Looking for file at:", filePath);
    
    if (!fs.existsSync(filePath)) {
      console.error("Writing styles file not found at:", filePath);
      return NextResponse.json({ writing_styles: [] });
    }
    
    const fileContents = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(fileContents);
    console.log("Writing styles API: Parsed data, writing_styles count:", data.writing_styles?.length || 0);
    
    // Return the writing_styles array from the parsed data
    const writingStyles = data.writing_styles || [];
    
    if (writingStyles.length === 0) {
      console.warn("Writing styles API: No writing styles found in data");
    }
    
    return NextResponse.json({ writing_styles: writingStyles });
  } catch (error) {
    console.error("Failed to load writing styles:", error);
    return NextResponse.json(
      { error: "Failed to load writing styles", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}



import { NextRequest, NextResponse } from "next/server";
import { scrapeUrl } from "@/lib/scrape";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const scraped = await scrapeUrl(url);
    return NextResponse.json(scraped);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

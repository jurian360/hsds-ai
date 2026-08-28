import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export interface ScrapedContent {
  title: string;
  text: string;
  imageUrls: string[];
}

/**
 * Fetches a URL and extracts clean, readable text (stripping nav, ads, etc.)
 * plus any image URLs found in the main content, so the AI has real product
 * facts to ground its generation on instead of inventing specs.
 */
export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WooAIProductBot/1.0; +internal-tool)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch source URL (status ${res.status})`);
  }

  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article) {
    throw new Error("Could not extract readable content from this URL.");
  }

  // Grab a handful of <img> src attributes from the original document as
  // candidate "real" product photos, in case the team wants to reuse them
  // instead of (or alongside) AI-generated images.
  const imageUrls = Array.from(dom.window.document.querySelectorAll("img"))
    .map((img) => img.getAttribute("src"))
    .filter((src): src is string => !!src)
    .map((src) => {
      try {
        return new URL(src, url).toString();
      } catch {
        return null;
      }
    })
    .filter((src): src is string => !!src)
    .slice(0, 10);

  return {
    title: article.title ?? "",
    text: article.textContent?.trim() ?? "",
    imageUrls,
  };
}

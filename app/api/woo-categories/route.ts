import { NextResponse } from "next/server";
import { fetchWooCategories } from "@/lib/woocommerce";

export async function GET() {
  try {
    const categories = await fetchWooCategories();
    return NextResponse.json({ categories });
  } catch (err) {
    // WooCommerce isn't configured yet in the demo — fail soft with an
    // empty list so the rest of the app still works.
    return NextResponse.json({
      categories: [],
      warning: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

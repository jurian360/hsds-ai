import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";

export async function GET() {
  try {
    await connectToDatabase();
    const products = await Product.find().sort({ createdAt: -1 }).limit(100);
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, sku, category, categoryId, sourceUrl, createdBy } = body;

    if (!name || !sku || !category) {
      return NextResponse.json(
        { error: "name, sku, and category are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const product = await Product.create({
      name,
      sku,
      category,
      categoryId,
      sourceUrl,
      createdBy,
      status: "draft",
      attributes: [],
      images: [],
    });

    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

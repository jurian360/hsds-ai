import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { generateProductContent } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { productId, sourceText } = await req.json();

    if (!productId || !sourceText) {
      return NextResponse.json(
        { error: "productId and sourceText are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    product.status = "generating";
    product.sourceText = sourceText;
    await product.save();

    const generated = await generateProductContent({
      name: product.name,
      sku: product.sku,
      category: product.category,
      sourceText,
    });

    product.shortDescription = generated.shortDescription;
    product.longDescription = generated.longDescription;
    product.attributes = generated.attributes;
    product.status = "in_review";
    await product.save();

    return NextResponse.json({ product, notes: generated.notes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

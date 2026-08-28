import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { generateProductImage } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { productId, prompt } = await req.json();

    if (!productId || !prompt) {
      return NextResponse.json(
        { error: "productId and prompt are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const imageUrl = await generateProductImage(prompt);

    product.images.push({
      url: imageUrl,
      prompt,
      source: "generated",
      selected: false,
    });
    await product.save();

    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

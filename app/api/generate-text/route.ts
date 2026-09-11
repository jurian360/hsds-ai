import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { generateProductContent } from "@/lib/openai";
import { buildSource, combineSourceText } from "@/lib/sources";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { productId, sourceText: overrideText } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    await connectToDatabase();
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Grounding text, in order of preference: an explicit override from the
    // caller, the attached sources, or — for drafts created before sources
    // existed — a one-off scrape of the legacy single source URL.
    let sourceText = overrideText?.trim() || combineSourceText(product.sources);

    if (!sourceText && product.sourceUrl) {
      const { source } = await buildSource({ type: "url", url: product.sourceUrl });
      product.sources.push(source);
      sourceText = combineSourceText(product.sources);
    }

    if (!sourceText) {
      return NextResponse.json(
        {
          error:
            "No source material attached. Add a link, PDF, image, or pasted text first — generation is grounded in sources only.",
        },
        { status: 400 }
      );
    }

    product.status = "generating";
    product.sourceText = sourceText;
    await product.save();

    try {
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
      product.errorMessage = undefined;
      await product.save();

      return NextResponse.json({ product, notes: generated.notes });
    } catch (genErr) {
      // Don't strand the draft in "generating" if the model call fails.
      product.status = "failed";
      product.errorMessage =
        genErr instanceof Error ? genErr.message : "Generation failed";
      await product.save();
      throw genErr;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

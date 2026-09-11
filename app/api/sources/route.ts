import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import { buildSource, combineSourceText, MAX_UPLOAD_BYTES } from "@/lib/sources";
import type { SourceType } from "@/models/Product";

// Extraction can involve a scrape plus a vision call, which is slower than the
// default serverless timeout allows for.
export const maxDuration = 120;

interface ParsedRequest {
  productId: string;
  type: SourceType;
  url?: string;
  text?: string;
  file?: { name: string; mimeType: string; buffer: ArrayBuffer };
}

const VALID_TYPES: SourceType[] = ["url", "pdf", "image", "text"];

async function parseRequest(req: NextRequest): Promise<ParsedRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const productId = String(form.get("productId") ?? "");
    const type = String(form.get("type") ?? "") as SourceType;
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new Error("No file was included in the upload.");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is ${
          MAX_UPLOAD_BYTES / 1024 / 1024
        } MB.`
      );
    }

    return {
      productId,
      type,
      file: {
        name: file.name || "upload",
        mimeType: file.type || "application/octet-stream",
        buffer: await file.arrayBuffer(),
      },
    };
  }

  const body = await req.json();
  return {
    productId: String(body.productId ?? ""),
    type: body.type as SourceType,
    url: body.url,
    text: body.text,
  };
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseRequest(req);

    if (!parsed.productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }
    if (!VALID_TYPES.includes(parsed.type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const product = await Product.findById(parsed.productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const { source, imageCandidate } = await buildSource(parsed);

    product.sources.push(source);
    product.sourceText = combineSourceText(product.sources);

    // The first link added also fills in the legacy single-URL field, so older
    // drafts and the WooCommerce publish path keep working unchanged.
    if (source.type === "url" && !product.sourceUrl && parsed.url) {
      product.sourceUrl = parsed.url.trim();
    }

    // An uploaded photo is a real product image — offer it alongside the
    // generated ones rather than making the user upload it twice.
    if (imageCandidate) {
      product.images.push({ ...imageCandidate, source: "uploaded", selected: false });
    }

    await product.save();

    return NextResponse.json({ product, source });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const index = Number(searchParams.get("index"));

    if (!productId || Number.isNaN(index)) {
      return NextResponse.json(
        { error: "productId and index are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    if (index < 0 || index >= product.sources.length) {
      return NextResponse.json({ error: "No source at that index" }, { status: 400 });
    }

    const [removed] = product.sources.splice(index, 1);
    product.sourceText = combineSourceText(product.sources);

    // Drop the matching image candidate too, unless it's already been selected
    // for publishing — in that case the user clearly still wants it.
    if (removed?.imageUrl) {
      product.images = product.images.filter(
        (img: { url: string; selected: boolean }) =>
          img.selected || img.url !== removed.imageUrl
      );
    }

    await product.save();

    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

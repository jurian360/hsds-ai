import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Product } from "@/models/Product";
import {
  checkSkuExists,
  createWooProduct,
  uploadMediaFromDataUrl,
} from "@/lib/woocommerce";

const WOOCOMMERCE_CONFIGURED =
  !!process.env.WOOCOMMERCE_SITE_URL &&
  !!process.env.WOOCOMMERCE_CONSUMER_KEY &&
  !!process.env.WOOCOMMERCE_CONSUMER_SECRET;

export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json();
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    await connectToDatabase();
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    if (!product.categoryId) {
      return NextResponse.json(
        { error: "Product is missing a WooCommerce categoryId. Select a category from the live list first." },
        { status: 400 }
      );
    }

    // --- Demo mode: no WooCommerce credentials configured yet -------------
    // Lets the rest of the pipeline (generation + review) be fully tested
    // before real store credentials are available.
    if (!WOOCOMMERCE_CONFIGURED) {
      product.status = "published";
      product.wooProductId = -1; // sentinel value indicating a simulated publish
      await product.save();
      return NextResponse.json({
        product,
        simulated: true,
        message:
          "WooCommerce credentials are not configured yet, so this was a simulated publish. Set WOOCOMMERCE_SITE_URL, WOOCOMMERCE_CONSUMER_KEY, and WOOCOMMERCE_CONSUMER_SECRET to publish for real.",
      });
    }

    // --- Real publish -------------------------------------------------------
    const skuTaken = await checkSkuExists(product.sku);
    if (skuTaken) {
      product.status = "failed";
      product.errorMessage = `SKU "${product.sku}" already exists in WooCommerce.`;
      await product.save();
      return NextResponse.json({ error: product.errorMessage }, { status: 409 });
    }

    const selectedImages = product.images.filter((img: { selected: boolean }) => img.selected);
    const imageIds: number[] = [];
    for (const img of selectedImages) {
      const uploaded = await uploadMediaFromDataUrl(
        img.url,
        `${product.sku}-${imageIds.length + 1}.png`
      );
      imageIds.push(uploaded.id);
    }

    const wooProduct = await createWooProduct({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      shortDescription: product.shortDescription ?? "",
      longDescription: product.longDescription ?? "",
      attributes: product.attributes,
      imageIds,
      status: "draft", // create as draft; team flips to publish in WP if desired
    });

    product.status = "published";
    product.wooProductId = wooProduct.id;
    await product.save();

    return NextResponse.json({ product, wooProduct });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

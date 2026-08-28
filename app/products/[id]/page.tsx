"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

interface Attribute {
  name: string;
  value: string;
}

interface ImageCandidate {
  url: string;
  prompt: string;
  source: "generated" | "scraped";
  selected: boolean;
}

interface ProductDetail {
  _id: string;
  name: string;
  sku: string;
  category: string;
  sourceUrl?: string;
  sourceText?: string;
  shortDescription?: string;
  longDescription?: string;
  attributes: Attribute[];
  images: ImageCandidate[];
  status: string;
  errorMessage?: string;
}

export default function ProductReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // which action is in flight
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");

  async function loadProduct() {
    const res = await fetch(`/api/products/${id}`);
    const data = await res.json();
    if (res.ok) setProduct(data.product);
  }

  useEffect(() => {
    loadProduct().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleGenerateText() {
    if (!product) return;
    setError(null);
    setBusy("text");
    try {
      let sourceText = product.sourceText;

      if (!sourceText) {
        if (!product.sourceUrl) {
          throw new Error("No source URL set and no source text available yet — add a source URL to ground the description.");
        }
        const scrapeRes = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: product.sourceUrl }),
        });
        const scraped = await scrapeRes.json();
        if (!scrapeRes.ok) throw new Error(scraped.error ?? "Failed to scrape source URL");
        sourceText = scraped.text;
      }

      const res = await fetch("/api/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, sourceText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      setProduct(data.product);
      if (data.notes) setNotice(data.notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerateImage() {
    if (!imagePrompt.trim()) {
      setError("Enter a prompt describing the image you want first.");
      return;
    }
    setError(null);
    setBusy("image");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, prompt: imagePrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Image generation failed");
      setProduct(data.product);
      setImagePrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function updateProduct(updates: Partial<ProductDetail>) {
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (res.ok) setProduct(data.product);
  }

  function toggleImageSelected(index: number) {
    if (!product) return;
    const images = product.images.map((img, i) =>
      i === index ? { ...img, selected: !img.selected } : img
    );
    setProduct({ ...product, images });
    updateProduct({ images });
  }

  function updateAttribute(index: number, field: "name" | "value", value: string) {
    if (!product) return;
    const attributes = product.attributes.map((a, i) =>
      i === index ? { ...a, [field]: value } : a
    );
    setProduct({ ...product, attributes });
  }

  async function handleApprove() {
    setBusy("approve");
    await updateProduct({
      status: "approved",
      shortDescription: product?.shortDescription,
      longDescription: product?.longDescription,
      attributes: product?.attributes,
    });
    setBusy(null);
  }

  async function handlePublish() {
    setError(null);
    setBusy("publish");
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Publish failed");
      setProduct(data.product);
      if (data.simulated) setNotice(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>;
  if (!product) return <p className="text-sm text-red-600 dark:text-red-400">Product not found.</p>;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
          ← All products
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-medium">{product.name}</h1>
          <StatusBadge status={product.status} />
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          SKU {product.sku} · {product.category}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {notice}
        </div>
      )}

      {/* Step 1: Generate text */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Description &amp; attributes</h2>
          <button
            onClick={handleGenerateText}
            disabled={busy === "text"}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            {busy === "text" ? "Generating…" : product.shortDescription ? "Regenerate" : "Generate from source"}
          </button>
        </div>

        {!product.sourceUrl && !product.sourceText && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            No source URL was set for this product, so generation has nothing to ground itself in. Edit the draft to add one, or paste source text directly via the API.
          </p>
        )}

        {product.shortDescription && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Short description</label>
              <textarea
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
                rows={2}
                value={product.shortDescription}
                onChange={(e) => setProduct({ ...product, shortDescription: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Long description</label>
              <textarea
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
                rows={6}
                value={product.longDescription}
                onChange={(e) => setProduct({ ...product, longDescription: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Attributes</label>
              <div className="space-y-2">
                {product.attributes.map((attr, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="w-1/3 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-400"
                      value={attr.name}
                      onChange={(e) => updateAttribute(i, "name", e.target.value)}
                    />
                    <input
                      className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-400"
                      value={attr.value}
                      onChange={(e) => updateAttribute(i, "value", e.target.value)}
                    />
                  </div>
                ))}
                {product.attributes.length === 0 && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">No attributes were found in the source text.</p>
                )}
              </div>
            </div>
            <button
              onClick={() =>
                updateProduct({
                  shortDescription: product.shortDescription,
                  longDescription: product.longDescription,
                  attributes: product.attributes,
                })
              }
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Save edits
            </button>
          </div>
        )}
      </section>

      {/* Step 2: Images */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-3 font-medium">Images</h2>
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
            placeholder="Describe the image you want, e.g. 'product on a white background, studio lighting'"
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
          />
          <button
            onClick={handleGenerateImage}
            disabled={busy === "image"}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            {busy === "image" ? "Generating…" : "Generate image"}
          </button>
        </div>

        {product.images.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No images generated yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => toggleImageSelected(i)}
                className={`overflow-hidden rounded-lg border-2 text-left ${
                  img.selected ? "border-neutral-900 dark:border-neutral-100" : "border-transparent"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.prompt} className="aspect-square w-full object-cover" />
                <p className="truncate px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {img.selected ? "Selected" : "Click to select"}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Step 3: Approve & publish */}
      <section className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <button
          onClick={handleApprove}
          disabled={busy === "approve" || !product.shortDescription}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {busy === "approve" ? "Saving…" : "Mark approved"}
        </button>
        <button
          onClick={handlePublish}
          disabled={busy === "publish" || product.status === "published"}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-500"
        >
          {busy === "publish"
            ? "Publishing…"
            : product.status === "published"
            ? "Published"
            : "Publish to WooCommerce"}
        </button>
        {product.errorMessage && (
          <span className="text-sm text-red-600 dark:text-red-400">{product.errorMessage}</span>
        )}
      </section>
    </div>
  );
}

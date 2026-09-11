"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import SourceComposer from "@/components/SourceComposer";
import SourceList from "@/components/SourceList";
import { submitSource, type SourceDraft } from "@/lib/sourceClient";

interface WooCategory {
  id: number;
  name: string;
  slug: string;
}

interface ProductListItem {
  _id: string;
  name: string;
  sku: string;
  category: string;
  status: string;
  createdAt: string;
}

export default function HomePage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<WooCategory[]>([]);
  const [categoryWarning, setCategoryWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sources are collected before the draft exists, then extracted server-side
  // once it does — so uploads can be queued up on this screen.
  const [sources, setSources] = useState<SourceDraft[]>([]);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    categoryId: undefined as number | undefined,
    createdBy: "",
  });

  function addSource(draft: SourceDraft) {
    setError(null);
    setSources((current) => [...current, draft]);
  }

  function removeSource(index: number) {
    setSources((current) => {
      const draft = current[index];
      if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  async function loadProducts() {
    const res = await fetch("/api/products");
    const data = await res.json();
    setProducts(data.products ?? []);
  }

  async function loadCategories() {
    const res = await fetch("/api/woo-categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
    if (data.warning) setCategoryWarning(data.warning);
  }

  useEffect(() => {
    Promise.all([loadProducts(), loadCategories()]).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name || !form.sku || !form.category) {
      setError("Name, SKU, and category are required.");
      return;
    }

    setSubmitting(true);
    try {
      setProgress("Creating draft…");
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sourceUrl: sources.find((s) => s.type === "url")?.url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create product");

      const productId = data.product._id;

      // Extract sources one at a time so a single bad link or unreadable file
      // doesn't lose the whole draft — the rest still get attached.
      const failed: string[] = [];
      for (const [i, draft] of sources.entries()) {
        setProgress(`Reading source ${i + 1} of ${sources.length}: ${draft.label}`);
        try {
          await submitSource(productId, draft);
        } catch (err) {
          failed.push(`${draft.label} (${err instanceof Error ? err.message : "failed"})`);
        }
      }

      for (const draft of sources) {
        if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
      }

      // The draft exists either way, so clear the form — resubmitting it would
      // just collide on SKU.
      setForm({ name: "", sku: "", category: "", categoryId: undefined, createdBy: form.createdBy });
      setSources([]);
      await loadProducts();

      if (failed.length > 0) {
        // Stay put so the message is readable; the new draft is top of the list.
        setError(
          `Draft "${data.product.name}" was created, but these sources could not be read: ` +
            `${failed.join("; ")}. Open it below to add them again.`
        );
        return;
      }

      window.location.href = `/products/${productId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-1 text-xl font-medium">New product</h1>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Enter the basics, then generate grounded copy and images on the next screen.
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Product name</label>
            <input
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Sony WH-1000XM5 headphones"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">SKU</label>
            <input
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="e.g. SONY-WH1000XM5-BLK"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Category</label>
            {categories.length > 0 ? (
              <select
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
                value={form.category}
                onChange={(e) => {
                  const selected = categories.find((c) => c.name === e.target.value);
                  setForm({ ...form, category: e.target.value, categoryId: selected?.id });
                }}
              >
                <option value="">Select a category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Headphones"
              />
            )}
            {categoryWarning && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                WooCommerce categories unavailable ({categoryWarning}). Type a category name manually for now.
              </p>
            )}
          </div>

          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Your name</label>
            <input
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400"
              value={form.createdBy}
              onChange={(e) => setForm({ ...form, createdBy: e.target.value })}
              placeholder="e.g. Alex"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Sources <span className="font-normal text-neutral-500 dark:text-neutral-400">(link, PDF, image, or pasted text)</span>
            </label>
            <SourceComposer onAdd={addSource} busy={submitting} />
            <div className="mt-3">
              <SourceList items={sources} onRemove={removeSource} />
            </div>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Everything generated is grounded in these sources — nothing is invented beyond
              them. Add as many as you like; you can add more later too.
            </p>
          </div>

          {error && <p className="text-sm text-red-600 sm:col-span-2 dark:text-red-400">{error}</p>}

          <div className="sm:col-span-2">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              >
                {submitting ? "Creating…" : "Create draft"}
              </button>
              {progress && (
                <span className="text-sm text-neutral-500 dark:text-neutral-400">{progress}</span>
              )}
            </div>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Products</h2>
        {loading ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No products yet. Create one above.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/50 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">SKU</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p._id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
                    <td className="px-4 py-2">
                      <Link href={`/products/${p._id}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-100">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-neutral-500 dark:text-neutral-400">{p.sku}</td>
                    <td className="px-4 py-2 text-neutral-500 dark:text-neutral-400">{p.category}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

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
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    categoryId: undefined as number | undefined,
    sourceUrl: "",
    createdBy: "",
  });

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
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create product");

      setForm({ name: "", sku: "", category: "", categoryId: undefined, sourceUrl: "", createdBy: form.createdBy });
      await loadProducts();
      window.location.href = `/products/${data.product._id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-1 text-xl font-medium">New product</h1>
        <p className="mb-4 text-sm text-neutral-500">
          Enter the basics, then generate grounded copy and images on the next screen.
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Product name</label>
            <input
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Sony WH-1000XM5 headphones"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700">SKU</label>
            <input
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="e.g. SONY-WH1000XM5-BLK"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Category</label>
            {categories.length > 0 ? (
              <select
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
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
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Headphones"
              />
            )}
            {categoryWarning && (
              <p className="mt-1 text-xs text-amber-600">
                WooCommerce categories unavailable ({categoryWarning}). Type a category name manually for now.
              </p>
            )}
          </div>

          <div className="sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-neutral-700">Your name</label>
            <input
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
              value={form.createdBy}
              onChange={(e) => setForm({ ...form, createdBy: e.target.value })}
              placeholder="e.g. Alex"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Source URL <span className="font-normal text-neutral-400">(manufacturer page, spec sheet, etc.)</span>
            </label>
            <input
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
              value={form.sourceUrl}
              onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })}
              placeholder="https://..."
            />
            <p className="mt-1 text-xs text-neutral-400">
              Used to ground the generated description in real facts — nothing is invented beyond this source.
            </p>
          </div>

          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create draft"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Products</h2>
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-neutral-500">No products yet. Create one above.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">SKU</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p._id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="px-4 py-2">
                      <Link href={`/products/${p._id}`} className="font-medium text-neutral-900 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{p.sku}</td>
                    <td className="px-4 py-2 text-neutral-500">{p.category}</td>
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

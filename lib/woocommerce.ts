/**
 * Minimal WooCommerce REST API client using Basic Auth over HTTPS.
 * Requires these env vars:
 *   WOOCOMMERCE_SITE_URL      e.g. https://yourshop.com
 *   WOOCOMMERCE_CONSUMER_KEY
 *   WOOCOMMERCE_CONSUMER_SECRET
 */

function getConfig() {
  const siteUrl = process.env.WOOCOMMERCE_SITE_URL;
  const key = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const secret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

  if (!siteUrl || !key || !secret) {
    throw new Error(
      "WooCommerce is not configured. Set WOOCOMMERCE_SITE_URL, WOOCOMMERCE_CONSUMER_KEY, and WOOCOMMERCE_CONSUMER_SECRET."
    );
  }

  return { siteUrl: siteUrl.replace(/\/$/, ""), key, secret };
}

function authHeader(key: string, secret: string) {
  const token = Buffer.from(`${key}:${secret}`).toString("base64");
  return `Basic ${token}`;
}

export interface WooCategory {
  id: number;
  name: string;
  slug: string;
}

export async function fetchWooCategories(): Promise<WooCategory[]> {
  const { siteUrl, key, secret } = getConfig();

  const res = await fetch(
    `${siteUrl}/wp-json/wc/v3/products/categories?per_page=100`,
    { headers: { Authorization: authHeader(key, secret) } }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch WooCommerce categories (status ${res.status})`);
  }

  return res.json();
}

export async function checkSkuExists(sku: string): Promise<boolean> {
  const { siteUrl, key, secret } = getConfig();

  const res = await fetch(
    `${siteUrl}/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}`,
    { headers: { Authorization: authHeader(key, secret) } }
  );

  if (!res.ok) {
    throw new Error(`Failed to check SKU (status ${res.status})`);
  }

  const results = await res.json();
  return Array.isArray(results) && results.length > 0;
}

/**
 * Uploads an image (from a URL or a data: URL) to the WordPress Media
 * Library and returns the resulting media ID + source URL, ready to attach
 * to a product.
 */
export async function uploadMediaFromDataUrl(
  dataUrlOrUrl: string,
  filename: string
): Promise<{ id: number; source_url: string }> {
  const { siteUrl, key, secret } = getConfig();

  let buffer: Buffer;
  let contentType = "image/png";

  if (dataUrlOrUrl.startsWith("data:")) {
    const match = dataUrlOrUrl.match(/^data:(.+);base64,(.*)$/);
    if (!match) throw new Error("Malformed data URL for image upload.");
    contentType = match[1];
    buffer = Buffer.from(match[2], "base64");
  } else {
    const imgRes = await fetch(dataUrlOrUrl);
    if (!imgRes.ok) throw new Error(`Failed to download image for upload (status ${imgRes.status})`);
    contentType = imgRes.headers.get("content-type") || "image/jpeg";
    buffer = Buffer.from(await imgRes.arrayBuffer());
  }

  const res = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader(key, secret),
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to upload media (status ${res.status}): ${errText}`);
  }

  const media = await res.json();
  return { id: media.id, source_url: media.source_url };
}

export interface CreateWooProductParams {
  name: string;
  sku: string;
  categoryId: number;
  shortDescription: string;
  longDescription: string;
  attributes: { name: string; value: string }[];
  imageIds: number[];
  status?: "draft" | "publish";
}

export async function createWooProduct(params: CreateWooProductParams) {
  const { siteUrl, key, secret } = getConfig();

  const body = {
    name: params.name,
    sku: params.sku,
    type: "simple",
    status: params.status ?? "draft",
    short_description: params.shortDescription,
    description: params.longDescription,
    categories: [{ id: params.categoryId }],
    images: params.imageIds.map((id) => ({ id })),
    attributes: params.attributes.map((attr) => ({
      name: attr.name,
      options: [attr.value],
      visible: true,
    })),
  };

  const res = await fetch(`${siteUrl}/wp-json/wc/v3/products`, {
    method: "POST",
    headers: {
      Authorization: authHeader(key, secret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to create WooCommerce product (status ${res.status}): ${errText}`);
  }

  return res.json();
}

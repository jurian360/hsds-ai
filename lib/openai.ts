import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient() {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set.");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export interface GeneratedProductContent {
  shortDescription: string;
  longDescription: string;
  attributes: { name: string; value: string }[];
  notes?: string; // any caveats the model wants to flag (e.g. missing specs)
}

/**
 * Generates product copy and attributes STRICTLY grounded in sourceText.
 * The model is instructed never to invent facts that aren't present in the
 * provided source material.
 */
export async function generateProductContent(params: {
  name: string;
  sku: string;
  category: string;
  sourceText: string;
}): Promise<GeneratedProductContent> {
  const { name, sku, category, sourceText } = params;
  const openai = getOpenAIClient();

  const systemPrompt = `You are a product content writer for a WooCommerce store.
You MUST only use facts present in the provided SOURCE TEXT. Never invent
specifications, measurements, materials, or claims that are not explicitly
stated in the source. If the source text doesn't contain enough information
for a field, leave it blank or omit that attribute rather than guessing.
Respond ONLY with valid JSON, no markdown fences, no preamble.`;

  const userPrompt = `Product name: ${name}
SKU: ${sku}
Category: ${category}

SOURCE TEXT (the only allowed source of facts):
"""
${sourceText.slice(0, 12000)}
"""

Return JSON with this exact shape:
{
  "shortDescription": "1-2 sentence summary for the product listing card",
  "longDescription": "Full product description, 2-4 paragraphs, plain text or simple HTML <p> tags",
  "attributes": [{ "name": "Attribute name", "value": "Attribute value" }],
  "notes": "Optional: mention any important spec you could NOT find in the source text"
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  return {
    shortDescription: parsed.shortDescription ?? "",
    longDescription: parsed.longDescription ?? "",
    attributes: Array.isArray(parsed.attributes) ? parsed.attributes : [],
    notes: parsed.notes,
  };
}

/**
 * Generates a single product image from a user-supplied prompt.
 * Returns a hosted URL (OpenAI's temporary URL) that the caller should
 * download/re-upload if it needs to persist beyond the URL's expiry.
 */
export async function generateProductImage(prompt: string): Promise<string> {
  const openai = getOpenAIClient();

  const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: "1024x1024",
    n: 1,
  });

  const image = result.data?.[0];
  if (!image) throw new Error("No image returned from OpenAI.");

  // gpt-image-1 returns base64 by default; surface it as a data URL so the
  // frontend can render it immediately without a second fetch.
  if (image.b64_json) {
    return `data:image/png;base64,${image.b64_json}`;
  }
  if (image.url) {
    return image.url;
  }
  throw new Error("Image response contained neither b64_json nor url.");
}

import { extractText, getDocumentProxy } from "unpdf";
import { getOpenAIClient } from "@/lib/openai";
import { scrapeUrl } from "@/lib/scrape";
import type { ISource, SourceType } from "@/models/Product";

/** Uploads bigger than this are rejected before they hit a serverless body limit. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

/** Below this many characters a PDF is almost certainly scanned, not digital text. */
const SCANNED_PDF_THRESHOLD = 200;

const TRANSCRIBE_PROMPT = `You are transcribing product reference material so it can
be used as a factual source. Write out every product-relevant detail you can actually
read or see: model names, model numbers, specifications, measurements, materials,
connectivity, power, contents of the box, certifications, and any other printed text.
Transcribe values exactly as they appear — do not convert units, round numbers, or
tidy up wording. Do NOT infer, estimate, or add anything that is not visible. If the
material is unreadable or shows no product information, say so plainly.
Respond with plain text only.`;

/**
 * Reads a PDF's embedded text layer. Scanned PDFs have no text layer, so those
 * fall back to the vision model, which reads the rendered pages instead.
 */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  let text = "";
  try {
    // pdf.js takes ownership of the array it's handed and detaches the
    // underlying buffer, so give it a copy — the original is still needed
    // for the vision fallback below.
    const pdf = await getDocumentProxy(new Uint8Array(buffer.slice(0)));
    const result = await extractText(pdf, { mergePages: true });
    text = (Array.isArray(result.text) ? result.text.join("\n\n") : result.text).trim();
  } catch {
    // A malformed or encrypted PDF still gets a shot at the vision fallback.
    text = "";
  }

  if (text.length >= SCANNED_PDF_THRESHOLD) return text;

  const transcribed = await transcribePdfWithVision(buffer);
  if (!transcribed) {
    throw new Error(
      "No readable text found in this PDF — it may be scanned, encrypted, or empty."
    );
  }
  return transcribed;
}

/** Sends the whole PDF to the model, which can read scanned pages as images. */
async function transcribePdfWithVision(buffer: ArrayBuffer): Promise<string> {
  const openai = getOpenAIClient();
  const base64 = Buffer.from(buffer).toString("base64");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    messages: [
      { role: "system", content: TRANSCRIBE_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "file",
            file: {
              filename: "source.pdf",
              file_data: `data:application/pdf;base64,${base64}`,
            },
          },
          { type: "text", text: "Transcribe the product information in this document." },
        ],
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}

/** Reads product facts off a photo, spec sheet scan, packaging shot, or screenshot. */
async function transcribeImage(dataUrl: string): Promise<string> {
  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    messages: [
      { role: "system", content: TRANSCRIBE_PROMPT },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          { type: "text", text: "Transcribe the product information in this image." },
        ],
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}

export interface BuiltSource {
  source: ISource;
  /** Set when an uploaded photo is also worth offering as a product image. */
  imageCandidate?: { url: string; prompt: string };
}

/**
 * Turns one piece of user-supplied material (a link, a PDF, an image, or pasted
 * text) into a stored source with the grounding text already extracted.
 */
export async function buildSource(input: {
  type: SourceType;
  url?: string;
  text?: string;
  file?: { name: string; mimeType: string; buffer: ArrayBuffer };
}): Promise<BuiltSource> {
  switch (input.type) {
    case "url": {
      const url = input.url?.trim();
      if (!url) throw new Error("A source URL is required.");
      const scraped = await scrapeUrl(url);
      if (!scraped.text) {
        throw new Error("That page had no readable text to extract.");
      }
      return {
        source: {
          type: "url",
          label: scraped.title ? `${scraped.title} — ${url}` : url,
          text: scraped.text,
          addedAt: new Date(),
        },
      };
    }

    case "text": {
      const text = input.text?.trim();
      if (!text) throw new Error("Paste some text to use as a source.");
      return {
        source: { type: "text", label: "Pasted text", text, addedAt: new Date() },
      };
    }

    case "pdf": {
      if (!input.file) throw new Error("No PDF file was uploaded.");
      const text = await extractPdfText(input.file.buffer);
      return {
        source: {
          type: "pdf",
          label: input.file.name,
          text,
          addedAt: new Date(),
        },
      };
    }

    case "image": {
      if (!input.file) throw new Error("No image file was uploaded.");
      const dataUrl = `data:${input.file.mimeType};base64,${Buffer.from(
        input.file.buffer
      ).toString("base64")}`;
      const text = await transcribeImage(dataUrl);
      if (!text) {
        throw new Error("Nothing readable could be extracted from that image.");
      }
      return {
        source: {
          type: "image",
          label: input.file.name,
          text,
          imageUrl: dataUrl,
          addedAt: new Date(),
        },
        imageCandidate: {
          url: dataUrl,
          prompt: `Uploaded photo: ${input.file.name}`,
        },
      };
    }

    default:
      throw new Error(`Unsupported source type: ${input.type}`);
  }
}

const TYPE_LABELS: Record<SourceType, string> = {
  url: "WEB PAGE",
  pdf: "PDF DOCUMENT",
  image: "IMAGE",
  text: "PASTED TEXT",
};

/**
 * Flattens every attached source into one labelled block of grounding text, so
 * the model can see which fact came from which source (and cite nothing else).
 */
export function combineSourceText(sources: ISource[]): string {
  return sources
    .filter((s) => s.text?.trim())
    .map(
      (s, i) =>
        `--- SOURCE ${i + 1} (${TYPE_LABELS[s.type] ?? s.type}: ${s.label}) ---\n${s.text.trim()}`
    )
    .join("\n\n");
}

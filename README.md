# WooCommerce AI Product Builder

Internal tool: enter a product name, SKU, and category, attach whatever source
material you have for grounding, generate a description + attributes + images
with AI, review, and publish straight to WooCommerce via its REST API.

## How it avoids hallucinated specs

Text generation is **grounded**: it only ever sees source material you attach,
and is told to use nothing else. You can attach as many sources as you like,
in four forms:

| Source | How it's read |
| --- | --- |
| **Link** | Fetched and cleaned with Mozilla's Readability library |
| **PDF** | Text layer extracted with `unpdf`; scanned PDFs with no text layer fall back to the vision model reading the pages |
| **Image** | Read by the vision model — a product photo, a packaging shot, a photographed spec sheet |
| **Pasted text** | Used verbatim — supplier emails, spec lists, notes |

PDFs and images are transcribed at `temperature: 0` with an instruction to
write out only what is actually readable and never to infer, convert units, or
tidy up values. The extracted text from every source is then concatenated into
one labelled block (`--- SOURCE 1 (PDF DOCUMENT: datasheet.pdf) ---`) and sent
to the writing model with an explicit instruction: use only facts present in
the sources, leave fields blank rather than invent them. The model also returns
a `notes` field flagging anything it couldn't find a value for.

Sources are stored on the product, so you can add, review, and remove them at
any point and regenerate. Uploaded images do double duty: they're also offered
as selectable product photos alongside the AI-generated ones.

Uploads are capped at 4 MB each. Photos are downscaled to 1600px in the browser
before upload, which keeps them under that cap and keeps vision costs down.

## Stack

- Next.js 15 (App Router, TypeScript, Tailwind)
- MongoDB (via Mongoose) — stores product drafts and their status through the
  generate → review → approve → publish lifecycle
- OpenAI API — `gpt-4o` for grounded text generation and for reading PDFs and
  images, `gpt-image-1` for prompted image generation
- `unpdf` — PDF text-layer extraction (serverless-friendly build of pdf.js)
- WooCommerce REST API — categories, media upload, product creation

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in .env.local with your real values
npm run dev
```

Open http://localhost:3000.

### Environment variables

See `.env.example`. Three groups:

1. **MongoDB** (`MONGODB_URI`) — required. A free MongoDB Atlas cluster works
   fine for this volume.
2. **OpenAI** (`OPENAI_API_KEY`) — required for generation.
3. **WooCommerce** (`WOOCOMMERCE_SITE_URL`, `WOOCOMMERCE_CONSUMER_KEY`,
   `WOOCOMMERCE_CONSUMER_SECRET`) — optional for now. If left unset, the
   "Publish" button runs in **simulated mode**: it marks the product as
   published in the app's own database without calling WooCommerce, so you
   can test the full generation/review flow before your store credentials
   are ready. Once you add real credentials, publishing goes live
   automatically — no code changes needed.

Generate WooCommerce keys under **WooCommerce → Settings → Advanced → REST
API** on your store, with Read/Write permissions.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add the same environment variables from `.env.example` under Project
   Settings → Environment Variables.
4. Deploy.

Vercel's serverless functions are stateless between requests, which is why
MongoDB (rather than a local file or in-memory store) holds all product
state.

## App flow

1. **Create draft** — name, SKU, category (pulled live from WooCommerce if
   configured), your name, and one or more sources. Sources queued on this
   screen are read once the draft exists; if one fails, the rest still attach
   and you're told which didn't.
2. **Add or remove sources** — the draft page has the same link / PDF / image /
   paste composer, with a word count per source.
3. **Generate description & attributes** — combines every attached source into
   one grounding block, sends it to OpenAI with grounding instructions, saves
   the result as an editable draft.
4. **Generate images** — type a prompt, generate candidate images, click to
   select which ones to use. Repeat with different prompts as needed.
5. **Review & edit** — every generated field is editable inline before
   publishing.
6. **Approve** — marks the draft as approved (useful once multiple people
   are working through a queue).
7. **Publish** — uploads selected images to the WordPress Media Library,
   creates the product via the WooCommerce REST API as a `draft` status
   product, and records the resulting WooCommerce product ID.

## Notes / next steps for production use

- **Auth**: there's no login yet — anyone with the URL can use it. Add
  NextAuth (or similar) with your team's accounts before sharing this beyond
  a local demo.
- **Duplicate SKU check**: `checkSkuExists` runs before publish and blocks
  duplicates once WooCommerce is configured.
- **Real product photos**: uploaded image sources already appear in the image
  picker. The scraper additionally collects `<img>` URLs from linked pages
  (`imageUrls` in the scrape response); surfacing those as candidates too is a
  natural next step.
- **Upload size**: the 4 MB cap exists because Vercel's serverless functions
  reject larger request bodies. If you need to attach big datasheets, upload
  to blob storage from the browser and pass the URL to the extractor instead.
- **Rate limits/cost**: at ~40 products/day across a 4-person team, OpenAI
  and WooCommerce API usage is well within normal limits; no special
  batching or throttling is needed.

# WooCommerce AI Product Builder

Internal tool: enter a product name, SKU, and category (plus a source URL for
grounding), generate a description + attributes + images with AI, review, and
publish straight to WooCommerce via its REST API.

## How it avoids hallucinated specs

Text generation is **grounded**: you provide a source URL (manufacturer page,
spec sheet, distributor listing). The app scrapes and cleans that page's text
with Mozilla's Readability library, then sends only that extracted text to
the model with an explicit instruction: use only facts present in the source,
leave fields blank rather than invent them. The model also returns a `notes`
field flagging anything it couldn't find a value for.

## Stack

- Next.js 15 (App Router, TypeScript, Tailwind)
- MongoDB (via Mongoose) — stores product drafts and their status through the
  generate → review → approve → publish lifecycle
- OpenAI API — `gpt-4o` for grounded text generation, `gpt-image-1` for
  prompted image generation
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
   configured), source URL, your name.
2. **Generate description & attributes** — scrapes the source URL, sends the
   extracted text to OpenAI with grounding instructions, saves the result as
   an editable draft.
3. **Generate images** — type a prompt, generate candidate images, click to
   select which ones to use. Repeat with different prompts as needed.
4. **Review & edit** — every generated field is editable inline before
   publishing.
5. **Approve** — marks the draft as approved (useful once multiple people
   are working through a queue).
6. **Publish** — uploads selected images to the WordPress Media Library,
   creates the product via the WooCommerce REST API as a `draft` status
   product, and records the resulting WooCommerce product ID.

## Notes / next steps for production use

- **Auth**: there's no login yet — anyone with the URL can use it. Add
  NextAuth (or similar) with your team's accounts before sharing this beyond
  a local demo.
- **Duplicate SKU check**: `checkSkuExists` runs before publish and blocks
  duplicates once WooCommerce is configured.
- **Real product photos**: the scraper also collects `<img>` URLs from the
  source page (`imageUrls` in the scrape response) in case you'd rather reuse
  real manufacturer photos than generate synthetic ones — wiring those into
  the image picker UI is a natural next step.
- **Rate limits/cost**: at ~40 products/day across a 4-person team, OpenAI
  and WooCommerce API usage is well within normal limits; no special
  batching or throttling is needed.

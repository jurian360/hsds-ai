import mongoose, { Schema, models, model } from "mongoose";

export type ProductStatus =
  | "draft" // just created, nothing generated yet
  | "generating" // AI text/image generation in progress
  | "in_review" // generated, waiting for a human to approve
  | "approved" // reviewed and approved, ready to publish
  | "published" // successfully created in WooCommerce
  | "failed"; // generation or publish failed

export interface IAttribute {
  name: string;
  value: string;
}

export interface IImageCandidate {
  url: string;
  prompt: string;
  source: "generated" | "scraped" | "uploaded";
  selected: boolean;
}

/** Where a piece of grounding material came from. */
export type SourceType = "url" | "pdf" | "image" | "text";

export interface ISource {
  type: SourceType;
  /** Human-readable origin: the URL, the filename, or "Pasted text". */
  label: string;
  /** The extracted (or pasted) text that actually grounds generation. */
  text: string;
  /** Data URL, for uploaded images only — kept so the photo can be reused. */
  imageUrl?: string;
  addedAt?: Date;
}

export interface IProduct {
  _id?: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  category: string; // WooCommerce category name
  categoryId?: number; // WooCommerce category ID, once resolved
  sourceUrl?: string;

  /** Every piece of grounding material attached to this product. */
  sources: ISource[];

  // Combined grounding text across all sources, rebuilt whenever they change.
  sourceText?: string;

  // AI-generated content
  shortDescription?: string;
  longDescription?: string;
  attributes: IAttribute[];
  images: IImageCandidate[];

  status: ProductStatus;
  createdBy?: string; // team member name/email
  wooProductId?: number; // set once published
  errorMessage?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

const AttributeSchema = new Schema<IAttribute>(
  {
    name: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false }
);

const ImageCandidateSchema = new Schema<IImageCandidate>(
  {
    url: { type: String, required: true },
    prompt: { type: String, default: "" },
    source: {
      type: String,
      enum: ["generated", "scraped", "uploaded"],
      default: "generated",
    },
    selected: { type: Boolean, default: false },
  },
  { _id: false }
);

const SourceSchema = new Schema<ISource>(
  {
    type: { type: String, enum: ["url", "pdf", "image", "text"], required: true },
    label: { type: String, required: true },
    text: { type: String, default: "" },
    imageUrl: { type: String },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true, index: true },
    category: { type: String, required: true },
    categoryId: { type: Number },
    sourceUrl: { type: String },
    sources: { type: [SourceSchema], default: [] },
    sourceText: { type: String },

    shortDescription: { type: String },
    longDescription: { type: String },
    attributes: { type: [AttributeSchema], default: [] },
    images: { type: [ImageCandidateSchema], default: [] },

    status: {
      type: String,
      enum: ["draft", "generating", "in_review", "approved", "published", "failed"],
      default: "draft",
    },
    createdBy: { type: String },
    wooProductId: { type: Number },
    errorMessage: { type: String },
  },
  { timestamps: true }
);

// Avoid recompiling the model on every hot reload in dev.
export const Product = models.Product || model<IProduct>("Product", ProductSchema);

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
  source: "generated" | "scraped";
  selected: boolean;
}

export interface IProduct {
  _id?: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  category: string; // WooCommerce category name
  categoryId?: number; // WooCommerce category ID, once resolved
  sourceUrl?: string;

  // Grounding data extracted from the source URL/search
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
    source: { type: String, enum: ["generated", "scraped"], default: "generated" },
    selected: { type: Boolean, default: false },
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

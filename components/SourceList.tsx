"use client";

import { SOURCE_TYPE_LABELS, type SourceType } from "@/lib/sourceClient";

export interface SourceListItem {
  type: SourceType;
  label: string;
  /** Extracted text, once the server has read the source. */
  text?: string;
  /** Thumbnail: a stored data URL, or a local object URL for a pending upload. */
  previewUrl?: string;
  /** True while the source is being read server-side. */
  pending?: boolean;
  error?: string;
}

function summarise(item: SourceListItem) {
  if (item.error) return item.error;
  if (item.pending) return "Reading…";
  if (item.text) {
    const words = item.text.trim().split(/\s+/).length;
    return `${words.toLocaleString()} words extracted`;
  }
  return "Queued — will be read when the draft is created";
}

export default function SourceList({
  items,
  onRemove,
  removingIndex,
}: {
  items: SourceListItem[];
  onRemove: (index: number) => void;
  removingIndex?: number | null;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        No sources yet. Everything generated is grounded in what you add here.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${item.label}-${i}`}
          className="flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950"
        >
          {item.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.previewUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded object-cover"
            />
          ) : (
            <span className="shrink-0 rounded bg-neutral-200 px-2 py-1 text-[10px] font-semibold tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {SOURCE_TYPE_LABELS[item.type].toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-neutral-900 dark:text-neutral-100">
              {item.label}
            </p>
            <p
              className={`truncate text-xs ${
                item.error
                  ? "text-red-600 dark:text-red-400"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {summarise(item)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onRemove(i)}
            disabled={removingIndex === i}
            className="shrink-0 rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            {removingIndex === i ? "Removing…" : "Remove"}
          </button>
        </li>
      ))}
    </ul>
  );
}

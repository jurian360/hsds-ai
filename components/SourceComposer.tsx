"use client";

import { useRef, useState } from "react";
import {
  MAX_UPLOAD_BYTES,
  prepareImage,
  type SourceDraft,
  type SourceType,
} from "@/lib/sourceClient";

const TABS: { type: SourceType; label: string; hint: string }[] = [
  {
    type: "url",
    label: "Link",
    hint: "Manufacturer page, spec sheet, distributor listing.",
  },
  {
    type: "pdf",
    label: "PDF",
    hint: "Datasheet or brochure. Scanned PDFs are read as images.",
  },
  {
    type: "image",
    label: "Image",
    hint: "Photo of the product, its box, or a printed spec sheet.",
  },
  {
    type: "text",
    label: "Paste text",
    hint: "Anything you already have: an email, a spec list, supplier notes.",
  },
];

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-400";

export default function SourceComposer({
  onAdd,
  busy,
}: {
  onAdd: (draft: SourceDraft) => void | Promise<void>;
  busy?: boolean;
}) {
  const [tab, setTab] = useState<SourceType>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTab = TABS.find((t) => t.type === tab)!;

  function addUrl() {
    const trimmed = url.trim();
    if (!trimmed) return;
    onAdd({ type: "url", label: trimmed, url: trimmed });
    setUrl("");
  }

  function addText() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd({ type: "text", label: "Pasted text", text: trimmed });
    setText("");
  }

  async function addFile(file: File) {
    setFileError(null);
    const isImage = tab === "image";
    const prepared = isImage ? await prepareImage(file) : file;

    if (prepared.size > MAX_UPLOAD_BYTES) {
      setFileError(
        `${file.name} is ${(prepared.size / 1024 / 1024).toFixed(1)} MB — the limit is ${
          MAX_UPLOAD_BYTES / 1024 / 1024
        } MB.`
      );
      return;
    }

    onAdd({
      type: isImage ? "image" : "pdf",
      label: file.name,
      file: prepared,
      previewUrl: isImage ? URL.createObjectURL(prepared) : undefined,
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      await addFile(file);
    }
    // Allow re-picking the same file after a removal.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800">
      <div className="flex flex-wrap gap-1 border-b border-neutral-200 p-1 dark:border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => {
              setTab(t.type);
              setFileError(null);
            }}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.type
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2 p-3">
        {tab === "url" && (
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addUrl();
                }
              }}
              placeholder="https://..."
            />
            <button
              type="button"
              onClick={addUrl}
              disabled={busy || !url.trim()}
              className="shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Add link
            </button>
          </div>
        )}

        {tab === "text" && (
          <div className="space-y-2">
            <textarea
              className={inputClass}
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste specs, supplier notes, an email from the manufacturer…"
            />
            <button
              type="button"
              onClick={addText}
              disabled={busy || !text.trim()}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Add text
            </button>
          </div>
        )}

        {(tab === "pdf" || tab === "image") && (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={tab === "pdf" ? "application/pdf,.pdf" : "image/*"}
              onChange={handleFileChange}
              disabled={busy}
              className="block w-full text-sm text-neutral-600 file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-900 hover:file:bg-neutral-50 disabled:opacity-50 dark:text-neutral-400 dark:file:border-neutral-700 dark:file:bg-neutral-950 dark:file:text-neutral-100 dark:hover:file:bg-neutral-800"
            />
            {fileError && (
              <p className="text-xs text-red-600 dark:text-red-400">{fileError}</p>
            )}
          </div>
        )}

        <p className="text-xs text-neutral-500 dark:text-neutral-400">{activeTab.hint}</p>
      </div>
    </div>
  );
}

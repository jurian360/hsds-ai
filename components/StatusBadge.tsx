const STATUS_STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  generating: "bg-amber-100 text-amber-700",
  in_review: "bg-blue-100 text-blue-700",
  approved: "bg-purple-100 text-purple-700",
  published: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  generating: "Generating…",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
  failed: "Failed",
};

export default function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600";
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

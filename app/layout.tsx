import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WooCommerce AI Product Builder",
  description: "Generate grounded product listings and publish to WooCommerce",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <header className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-4">
            <a href="/" className="text-lg font-medium tracking-tight">
              Product builder
            </a>
            <span className="text-sm text-neutral-500">Internal tool · demo</span>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

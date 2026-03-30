import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QC CS AI — GHN Feedback Portal",
  description: "Report bugs and request features for GHN CS AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="border-b border-gray-200 bg-white sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">Q</span>
              </div>
              <span className="font-semibold text-gray-900">QC CS AI</span>
            </a>
            <div className="flex items-center gap-4 text-sm">
              <a href="/" className="text-gray-600 hover:text-gray-900">Issues</a>
              <a href="/submit" className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition">
                Report
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

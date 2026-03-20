import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "リード集計レポート",
  description: "HubSpotフォーム送信のトラフィックソース別集計",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETHOSALPHA · Ethos mindshare",
  description: "Tiered project intelligence from Ethos reputation and X signal flow. Equal-weight mindshare, score-based cohorts."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="app-body">{children}</body>
    </html>
  );
}

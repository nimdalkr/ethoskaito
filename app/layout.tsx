import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETHOSALPHA · Ethos mindshare",
  description:
    "Tiered project intelligence from Ethos reputation and X signal flow. Equal-weight mindshare, score-based cohorts."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700,900&f[]=cabinet-grotesk@500,700,800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="app-body">{children}</body>
    </html>
  );
}

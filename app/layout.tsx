import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Literata } from "next/font/google";
import { themeBootstrap } from "@/lib/theme-bootstrap";
import "./globals.css";

const literata = Literata({ variable: "--font-literata", subsets: ["latin"], style: ["normal", "italic"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Loop · zero to offer", template: "%s · Loop" },
  description: "Interview prep you read like a book and practise like a workout: DSA, low-level design and system design, with problems in every chapter.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#141414" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="paper">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className={`${literata.variable} ${geist.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const metadataBase = host
    ? new URL(`${protocol}://${host}`)
    : new URL("http://localhost:3000");

  return {
    metadataBase,
    title: {
      default: "Northstar Brief",
      template: "%s | Northstar Brief",
    },
    description:
      "A guided, jargon-free website intake that turns business knowledge into a clear project brief.",
    openGraph: {
      title: "Northstar Brief",
      description: "A clearer path to your new website.",
      type: "website",
      images: [{ url: "/og.png", width: 1792, height: 938, alt: "Northstar Brief — A clearer path to your new website." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Northstar Brief",
      description: "A clearer path to your new website.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

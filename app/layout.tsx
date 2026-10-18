import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "C.F. Mechanical | Business & Website Discovery",
  description: "Business strategy discovery for C.F. Mechanical.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

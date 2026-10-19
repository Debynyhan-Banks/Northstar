import type { Metadata } from "next";
import "./globals.css";
import "./strategy.css";

export const metadata: Metadata = {
  title: "C.F. Mechanical | Growth Workspace",
  description: "C.F. Mechanical business discovery and growth workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

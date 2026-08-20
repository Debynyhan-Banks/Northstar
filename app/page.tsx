import type { Metadata } from "next";
import IntakeApp from "./IntakeApp";

export const metadata: Metadata = {
  title: "Start Your Website Brief | Northstar",
  description:
    "A guided, jargon-free website intake that turns what you know about your business into a clear project brief.",
};

export default function Home() {
  return <IntakeApp />;
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Generate New Report",
};

export default function GeneratePage() {
  redirect("/runs?tab=create");
}


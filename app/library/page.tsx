import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports Library",
};

export default function LibraryPage() {
  redirect("/runs?tab=view");
}


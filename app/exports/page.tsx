import type { Metadata } from "next";
import "../styles/exports.css";
import ExportsClient from "./exports-client";

export const metadata: Metadata = {
  title: "Download Reports",
};

export default function ExportsPage() {
  return <ExportsClient />;
}

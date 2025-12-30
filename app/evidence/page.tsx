import type { Metadata } from "next";
import "../styles/configuration.css";
import EvidenceViewerClient from "./evidence-viewer-client";

export const metadata: Metadata = {
  title: "Evidence Viewer",
};

export default function EvidencePage() {
  return <EvidenceViewerClient />;
}

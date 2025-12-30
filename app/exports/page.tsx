import type { Metadata } from "next";
import "../styles/configuration.css";
import ExportViewerClient from "./export-viewer-client";

export const metadata: Metadata = {
  title: "Export Viewer",
};

export default function ExportViewerPage() {
  return <ExportViewerClient />;
}

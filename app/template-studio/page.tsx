import type { Metadata } from "next";
import "../styles/template-studio.css";
import TemplateStudioClient from "./template-studio-client";

export const metadata: Metadata = {
  title: "Objective Studio",
};

export default function TemplateStudioPage() {
  return <TemplateStudioClient />;
}

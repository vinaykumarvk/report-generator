import type { Metadata } from "next";
import "../styles/configuration.css";
import PromptStudioClient from "./prompt-studio-client";

export const metadata: Metadata = {
  title: "Prompt Studio",
};

export default function PromptStudioPage() {
  return <PromptStudioClient />;
}

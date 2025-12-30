import type { Metadata } from "next";
import "../styles/configuration.css";
import ModelConfigsClient from "./model-configs-client";

export const metadata: Metadata = {
  title: "Model Providers & Configs",
};

export default function ModelsPage() {
  return <ModelConfigsClient />;
}

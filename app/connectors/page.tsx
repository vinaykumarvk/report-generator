import type { Metadata } from "next";
import "../styles/configuration.css";
import ConnectorsClient from "./connectors-client";

export const metadata: Metadata = {
  title: "Sources",
};

export default function ConnectorsPage() {
  return <ConnectorsClient />;
}

import type { Metadata } from "next";
import "../styles/configuration.css";
import SettingsClient from "./settings-client";

export const metadata: Metadata = {
  title: "Admin & Settings",
};

export default function SettingsPage() {
  return <SettingsClient />;
}

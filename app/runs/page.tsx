import type { Metadata } from "next";
import "../styles/runs.css";
import RunDashboardClient from "./run-dashboard-client";

export const metadata: Metadata = {
  title: "Run Dashboard",
};

export default function RunsPage() {
  return <RunDashboardClient />;
}

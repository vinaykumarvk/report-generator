import type { Metadata } from "next";
import "../styles/runs.css";
import RunDashboardClient from "./run-dashboard-client";

export const metadata: Metadata = {
  title: "Run Dashboard",
};

export default function RunsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  return <RunDashboardClient initialTab={searchParams.tab as "create" | "view" | undefined} />;
}

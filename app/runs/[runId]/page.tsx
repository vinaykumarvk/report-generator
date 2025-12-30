import type { Metadata } from "next";
import "../../styles/runs.css";
import RunDetailsClient from "./run-details-client";

export const metadata: Metadata = {
  title: "Run Details",
};

export default function RunDetailsPage({
  params,
}: {
  params: { runId: string };
}) {
  return <RunDetailsClient runId={params.runId} />;
}

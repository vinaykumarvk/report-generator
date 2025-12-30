import RunDetailsClient from "./run-details-client";

export default function RunDetailsPage({
  params,
}: {
  params: { runId: string };
}) {
  return <RunDetailsClient runId={params.runId} />;
}

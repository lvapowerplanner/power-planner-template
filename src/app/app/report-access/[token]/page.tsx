import { PublicReportClient } from "./PublicReportClient";

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicReportClient token={token} />;
}

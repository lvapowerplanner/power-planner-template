import { PublicSignOffClient } from "./PublicSignOffClient";

export default async function PublicSignOffPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicSignOffClient token={token} />;
}

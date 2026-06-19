import { headers } from "next/headers";
import LandingPage from "./LandingPage";
import PlannerPortal from "./PlannerPortal";

function normaliseHost(value: string | null) {
  return (value || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(":")[0];
}

export default async function Home() {
  const headersList = await headers();

  const host = normaliseHost(
    headersList.get("x-forwarded-host") || headersList.get("host")
  );

  const isKnownPlannerSubdomain =
    host === "demo.lvapowerplanner.com" ||
    host === "sterling.lvapowerplanner.com" ||
    host === "app.lvapowerplanner.com";

  const isLocalDevelopment =
    host === "localhost" || host === "127.0.0.1";

  if (isKnownPlannerSubdomain || isLocalDevelopment) {
    return <PlannerPortal />;
  }

  return <LandingPage />;
}

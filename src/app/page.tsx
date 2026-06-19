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

async function isPlannerWorkspace(host: string) {
  if (!host) return false;

  const isLocalDevelopment = host === "localhost" || host === "127.0.0.1";

  if (isLocalDevelopment) {
    return true;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }

  const queryUrl = new URL("/rest/v1/planner_workspaces", supabaseUrl);
  queryUrl.searchParams.set("select", "id");
  queryUrl.searchParams.set("host", `eq.${host}`);
  queryUrl.searchParams.set("active", "eq.true");
  queryUrl.searchParams.set("limit", "1");

  try {
    const response = await fetch(queryUrl.toString(), {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return false;
    }

    const rows = (await response.json()) as Array<{ id: string }>;
    return rows.length > 0;
  } catch {
    return false;
  }
}

export default async function Home() {
  const headersList = await headers();

  const host = normaliseHost(
    headersList.get("x-forwarded-host") || headersList.get("host")
  );

  const shouldShowPlannerPortal = await isPlannerWorkspace(host);

  if (shouldShowPlannerPortal) {
    return <PlannerPortal />;
  }

  return <LandingPage />;
}

import { PlannerShell } from "@/components/planner/PlannerShell";
import type { PlannerState } from "@/planner/types";

type WorkspaceBranding = {
  subdomain: string;
  company_name: string;
  logo_url?: string | null;
  contact_email?: string | null;
  report_footer?: string | null;
  font_family?: string | null;
  highlight_colour?: string | null;
};

type PowerPlannerAppProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  workspaceBranding?: WorkspaceBranding;
};

export function PowerPlannerApp({
  plannerState,
  setPlannerState,
  workspaceBranding,
}: PowerPlannerAppProps) {
  return (
    <PlannerShell
      plannerState={plannerState}
      setPlannerState={setPlannerState}
      workspaceBranding={workspaceBranding}
    />
  );
}

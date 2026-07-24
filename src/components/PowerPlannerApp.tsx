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
  dark_button_colour?: string | null;
};

type PowerPlannerAppProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  workspaceBranding?: WorkspaceBranding;
  advancedFeaturesEnabled?: boolean;
};

export function PowerPlannerApp({
  plannerState,
  setPlannerState,
  workspaceBranding,
  advancedFeaturesEnabled,
}: PowerPlannerAppProps) {
  return (
    <PlannerShell
      plannerState={plannerState}
      setPlannerState={setPlannerState}
      workspaceBranding={workspaceBranding}
      advancedFeaturesEnabled={advancedFeaturesEnabled}
    />
  );
}

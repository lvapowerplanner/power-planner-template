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
  projectName: string;
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  workspaceBranding?: WorkspaceBranding;
  advancedCalculationsEnabled?: boolean;
  systemSignOffEnabled?: boolean;
  workspaceId?: string | null;
  projectId?: string;
  canManageReportLink?: boolean;
};

export function PowerPlannerApp({
  projectName,
  plannerState,
  setPlannerState,
  workspaceBranding,
  advancedCalculationsEnabled,
  systemSignOffEnabled,
  workspaceId,
  projectId,
  canManageReportLink,
}: PowerPlannerAppProps) {
  return (
    <PlannerShell
      projectName={projectName}
      plannerState={plannerState}
      setPlannerState={setPlannerState}
      workspaceBranding={workspaceBranding}
      advancedCalculationsEnabled={advancedCalculationsEnabled}
      systemSignOffEnabled={systemSignOffEnabled}
      workspaceId={workspaceId}
      projectId={projectId}
      canManageReportLink={canManageReportLink}
    />
  );
}

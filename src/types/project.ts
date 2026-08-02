import type { PlannerState } from "@/planner/types";

export type Project = {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  name: string;
  is_private?: boolean | null;
  created_at: string;
  updated_at?: string | null;
};

export type ProjectShare = {
  project_id: string;
  shared_with: string;
  shared_by: string;
  role: "planner" | "viewer";
  created_at: string;
};

export type UserRole = "admin" | "user";
export type WorkspaceUserStatus = "invited" | "active" | "disabled" | "removed";

export type WorkspaceUser = {
  id: string;
  email: string;
  role?: UserRole;
  status?: WorkspaceUserStatus;
  advanced_features_enabled?: boolean;
};

export type ProjectData = {
  plannerState: PlannerState;
};

export const emptyPlannerState: PlannerState = {
  systemName: "",
  sources: [],
  distros: [],
  active: null,
  customEquipment: [],
  customDistros: [],
  reportHiddenSources: [],
  dismissedWarnings: [],
  advancedElectrical: {
    calculationMethod: "real-power",
    defaultPowerFactor: 1,
    nominalSinglePhaseVoltage: 230,
    nominalThreePhaseVoltage: 400,
    showUnusedOutputs: false,
  },
};

export const emptyProjectData: ProjectData = {
  plannerState: emptyPlannerState,
};

import type { PlannerState } from "@/planner/types";

export type Project = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
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
};

export const emptyProjectData: ProjectData = {
  plannerState: emptyPlannerState,
};
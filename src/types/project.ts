export type Project = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type ProjectData = {
  systemName: string;
  notes: string;
};

export const emptyProjectData: ProjectData = {
  systemName: "",
  notes: "",
};
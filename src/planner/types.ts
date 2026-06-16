export type EquipmentItem = {
  id: string;
  category: string;
  name: string;
  watts: number;
};

export type PlannerEquipmentItem = EquipmentItem;

export type PlannerOutputItem = {
  id: string;
  name: string;
  watts: number;
  quantity: number;
  notes?: string;
};

export type PlannerPhase = "L1" | "L2" | "L3" | "3Φ" | "Socapex";

export type PlannerOutput = {
  id: string;
  label: string;
  phase: PlannerPhase;
  type: string;
  rating: number;
  items: PlannerOutputItem[];
  notes?: string;
  displayName?: string;
  outputNumber?: number;
  circuitNo?: number;
  breakerPair?: string | null;
  detail?: string;
  socaCircuits?: PlannerOutput[];
};

export type DistroDefinition = {
  name: string;
  input: string;
  inputA: number;
  outputs: PlannerOutput[];
  custom?: boolean;
};

export type ProjectDistro = DistroDefinition & {
  id: string;
  instanceName: string;
  sourceId: string;
  location: string;
  notes: string;
};

export type PowerSource = {
  id: string;
  name: string;
  conn: string;
  rating: number;
  notes: string;
  phaseType?: "Single-Phase" | "Three-Phase";
  auto?: boolean;
  parentDistroId?: string;
  parentOutputId?: string;
};

export type ProjectInfo = {
  projectManager: string;
  projectNumber: string;
  projectName: string;
  eventDate: string;
  venue: string;
};

export type PlannerState = {
  /** Kept for backwards compatibility with older saved projects. Use projectInfo.projectName for new UI/report titles. */
  systemName: string;
  projectInfo?: ProjectInfo;
  sources: PowerSource[];
  distros: ProjectDistro[];
  active: string | null;
  customEquipment: EquipmentItem[];
  customDistros: DistroDefinition[];
  reportHiddenSources: string[];
};

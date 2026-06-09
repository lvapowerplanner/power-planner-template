export type PlannerEquipmentItem = {
  id: string;
  category: string;
  name: string;
  watts: number;
};

export type PlannerOutputItem = {
  id: string;
  name: string;
  watts: number;
  quantity: number;
};

export type PlannerOutput = {
  id: string;
  label: string;
  phase: "L1" | "L2" | "L3" | "3Φ" | "Socapex";
  type: string;
  rating: number;
  items: PlannerOutputItem[];
  notes?: string;
  displayName?: string;
  outputNumber?: number;
  breakerPair?: string | null;
  detail?: string;
  socaCircuits?: PlannerOutput[];
};

export type DistroDefinition = {
  name: string;
  input: string;
  inputA: number;
  outputs: PlannerOutput[];
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
};

export type PlannerState = {
  systemName: string;
  sources: PowerSource[];
  distros: ProjectDistro[];
  active: string | null;
  customEquipment: PlannerEquipmentItem[];
  customDistros: DistroDefinition[];
  reportHiddenSources: string[];
};
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

export type ConnectorStyle = "ceeform" | "powerlock" | "soca";

export type CableDataStatus = "reference" | "verified" | "superseded";

export type CableDataSnapshot = {
  cableName: string;
  ratingCode?: string;
  application: "single_phase_ac" | "three_phase_ac" | "dc";
  coreConfiguration: string;
  conductorSizeMm2: number;
  cableArrangement: string;
  installationMethod: string;
  currentCapacityA: number;
  voltageDropMvPerAmpMetre: number;
  resistanceMvPerAmpMetre?: number;
  reactanceMvPerAmpMetre?: number;
  sourceName: string;
  sourceRevision: string;
  dataStatus: CableDataStatus;
};

export type CircuitCableDesign = {
  dataSource: "library" | "custom";
  cableRatingId?: string;
  snapshot: CableDataSnapshot;
  lengthMetres: number;
  parallelRuns: number;
  deratingFactor: number;
  voltageDropLimitPercent: number;
  voltageDropCategory: "lighting" | "other" | "custom";
  notes?: string;
  designerVerified?: boolean;
  designerVerifiedAt?: string;
  designerVerifiedBy?: string;
  designerVerificationFingerprint?: string;
};

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
  connectorStyle?: ConnectorStyle;
  socaCircuits?: PlannerOutput[];
  diversityPercent?: number;
  diversityReason?: string;
  powerFactorOverride?: number;
  cableDesign?: CircuitCableDesign;
};

export type DistroDefinition = {
  name: string;
  input: string;
  inputA: number;
  outputs: PlannerOutput[];
  connectorStyle?: ConnectorStyle;
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
  connectorStyle?: ConnectorStyle;
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

export type DismissedWarning = {
  scope: string;
  issueId: string;
  message: string;
  context: string;
  dismissedAtValue?: number;
  dismissedAt: string;
};

export type AdvancedCalculationMethod =
  | "real-power"
  | "include-power-factor";

export type AdvancedElectricalSettings = {
  calculationMethod: AdvancedCalculationMethod;
  defaultPowerFactor: number;
  nominalSinglePhaseVoltage: number;
  nominalThreePhaseVoltage: number;
  showUnusedOutputs: boolean;
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
  reportHiddenDistros?: string[];
  dismissedWarnings?: DismissedWarning[];
  advancedElectrical?: AdvancedElectricalSettings;
};

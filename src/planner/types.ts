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
  suitabilityClass?: "reference" | "conditional" | "not_recommended";
  suitabilityNotes?: string;
  mechanicalDuty?: "heavy" | "medium" | "light" | "unknown";
  indoorSuitable?: boolean;
  outdoorSuitable?: boolean;
  uvResistant?: boolean;
  waterResistance?: string;
  oilResistance?: string;
  minimumFixedTemperatureC?: number;
  maximumFixedTemperatureC?: number;
  minimumFlexedTemperatureC?: number;
  maximumFlexedTemperatureC?: number;
  loadedConductors?: number;
  neutralIncluded?: boolean;
  cpcIncluded?: boolean;
  voltageDropBasis?: string;
  sourceCheckedOn?: string;
  workspaceOverrideApplied?: boolean;
  workspaceOverrideId?: string;
  workspaceOverrideUpdatedAt?: string;
  workspaceOverrideReason?: string;
  standardCurrentCapacityA?: number;
  standardVoltageDropMvPerAmpMetre?: number;
  standardSourceName?: string;
  standardSourceRevision?: string;
};

export type ProjectCableLibraryItem = {
  id: string;
  name: string;
  designation?: string;
  manufacturer?: string;
  productRange?: string;
  standardReference?: string;
  application: "single_phase_ac" | "three_phase_ac";
  coreConfiguration: string;
  conductorSizeMm2: number;
  cableArrangement: string;
  installationMethod: string;
  currentCapacityA: number;
  voltageDropMvPerAmpMetre: number;
  resistanceMvPerAmpMetre?: number;
  reactanceMvPerAmpMetre?: number;
  sourceName?: string;
  sourceRevision?: string;
  sourceNotes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CircuitCableDesign = {
  dataSource: "library" | "project-library" | "custom";
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

export type ProtectiveDeviceKind =
  | "fuse"
  | "mcb"
  | "mcb-rcd"
  | "mccb"
  | "rcd"
  | "rcbo"
  | "other";

export type ProtectiveDeviceCurve =
  | "B"
  | "C"
  | "D"
  | "manufacturer-specific";

export type RcdType = "AC" | "A" | "F" | "B" | "other";

export type ResidualCoordinationOverride = {
  residualCurrentOverridden?: boolean;
  timeDelayOverridden?: boolean;
  reason?: string;
  updatedAt?: string;
};

export type ResidualCurrentProtection = {
  rcdType: RcdType;
  settingMode: "fixed" | "adjustable";
  residualCurrentMa: number;
  availableResidualSettingsMa?: number[];
  delayMode: "instantaneous" | "fixed-delay" | "adjustable-delay";
  timeDelayMs: number;
  availableDelaySettingsMs?: number[];
  selectiveType?: boolean;
  coordinationOverride?: ResidualCoordinationOverride;
};

export type ProtectiveDevice = {
  id: string;
  deviceType: ProtectiveDeviceKind;
  ratedCurrentA: number;
  poles: number;
  curve?: ProtectiveDeviceCurve;
  breakingCapacityKa?: number;
  manufacturer?: string;
  model?: string;
  standardReference?: string;
  residualProtection?: ResidualCurrentProtection;
  characteristicSource?: string;
  notes?: string;
};

export type FaultValueSource = "design" | "declared" | "assumed";

export type FaultProtectionData = {
  prospectiveFaultCurrentKa?: number;
  prospectiveFaultCurrentSource?: FaultValueSource;
  earthFaultLoopImpedanceOhms?: number;
  earthFaultLoopImpedanceSource?: FaultValueSource;
  maximumPermittedZsOhms?: number;
  maximumZsSource?: string;
  requiredDisconnectionTimeSeconds?: number;
  notes?: string;
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
  protectiveDevice?: ProtectiveDevice;
  faultProtection?: FaultProtectionData;
};

export type DistroDefinition = {
  name: string;
  libraryReferenceId?: string;
  input: string;
  inputA: number;
  outputs: PlannerOutput[];
  incomerProtection?: ProtectiveDevice;
  connectorStyle?: ConnectorStyle;
  custom?: boolean;
};

export type ProjectDistro = DistroDefinition & {
  id: string;
  instanceName: string;
  sourceId: string;
  location: string;
  notes: string;
  inboundCableDesign?: CircuitCableDesign;
  incomerFaultProtection?: FaultProtectionData;
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
  faultProtection?: FaultProtectionData;
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
  projectCableLibrary?: ProjectCableLibraryItem[];
  excludedCableRatingIds?: string[];
};

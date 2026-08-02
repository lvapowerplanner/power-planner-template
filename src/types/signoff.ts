import type { PlannerState } from "@/planner/types";

export type SignOffStatus = "draft" | "ready_for_review" | "submitted" | "superseded" | "void";

export type SignOffSharedInformation = {
  eventName: string;
  venue: string;
  venueLocation: string;
  eventDate: string;
  plannedRemovalDate: string;
  organisation: string;
  responsiblePerson: string;
  responsibility: string;
  onBehalfOf: string;
  email: string;
  signOffDate: string;
  operatingPeriod: string;
  generalComments: string;
};

export type SignOffG2Result = {
  polarity: "" | "satisfactory" | "unsatisfactory" | "na";
  phaseSequence: "" | "clockwise" | "anticlockwise" | "na";
  measuredZsOhms: string;
  prospectiveFaultCurrentKa: string;
  rcdTestMethod: "" | "test-button" | "instrument" | "na";
  rcdOperatingTimeMs: string;
  comments: string;
  result: "not-tested" | "pass" | "review" | "fail";
};

export type SignOffInstrument = {
  id: string;
  function: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  calibrationExpiry: string;
};

export type SignOffG3Section = {
  id: string;
  subsystem: string;
  responsiblePerson: string;
  organisation: string;
  certificateReference: string;
};

export type SignOffManualCircuit = {
  id: string;
  circuitDetails: string;
  finalCircuit: boolean;
  deviceTypeAndRating: string;
  rcdMode: string;
  rcdDelayMs: string;
  residualRatingMa: string;
};

export type SignOffElectrician = {
  id: string;
  name: string;
  email: string;
  company: string;
};

export type SignOffCompletion = {
  completedAt: string;
  completedBy: string;
};

export type SignOffG1Data = {
  certificateReference: string;
  coversSubsection: "" | "yes" | "no";
  subsectionDetails: string;
  supplyPhase: "" | "single" | "three";
  maximumDemandUnit: "A" | "kVA";
  schematicAttached: "" | "yes" | "no";
  sourceSupplyKind: "" | "generator" | "installed";
  sourceLocation: string;
  earthingArrangement: string;
  sourceOvercurrentSelected: boolean;
  sourceResidualSelected: boolean;
  sourceDeviceRating: string;
  sourceDeviceType: string;
  sourceRcdRatingMa: string;
  sourceRcdDelayMs: string;
  earthElectrodesDeployed: "" | "yes" | "no";
  earthElectrodeDetails: string;
  earthingSystemsInterconnected: "" | "yes" | "no";
  interconnectionDetails: string;
  isuDeviceRating: string;
  isuDeviceType: string;
  isuOvercurrentSelected: boolean;
  isuResidualSelected: boolean;
  isuRcdRatingMa: string;
  isuRcdDelayMs: string;
  deviations: string;
  visualInspectionSatisfactory: boolean;
  polaritySatisfactory: boolean;
  earthFaultLoopSatisfactory: boolean;
  rcdButtonsSatisfactory: boolean;
  equipmentEvidenceSatisfactory: boolean;
  supplyEarthLoopImpedanceOhms: string;
  reinspectionDate: string;
  declarationConfirmed: boolean;
  signature: string;
};

export type SignOffG1Certificate = SignOffG1Data & {
  id: string;
  sourceId: string | null;
  title: string;
};

export type SignOffDocument = {
  sharedInformation: SignOffSharedInformation;
  includedCircuitIds: string[];
  /** Overrides are stored only when the user changes an automatically populated value. */
  autoFieldOverrides: Record<string, string>;
  g1: SignOffG1Data;
  g1Forms: SignOffG1Certificate[];
  g2: {
    completionCertificateReference: string;
    scheduleDate: string;
    pageNumber: string;
    pageCount: string;
    combinedInstrument: boolean;
  };
  g2Results: Record<string, SignOffG2Result>;
  manualG2Circuits: SignOffManualCircuit[];
  completion: {
    g1: Record<string, string | SignOffCompletion>;
    g2: string | SignOffCompletion;
    g3: string | SignOffCompletion;
  };
  electricians: SignOffElectrician[];
  hiddenElectricianLinkIds: string[];
  instruments: SignOffInstrument[];
  g3: {
    sections: SignOffG3Section[];
    declarationConfirmed: boolean;
    signature: string;
    distributionOther: string;
    notApplicable: boolean;
  };
};

export type ProjectSignOffRecord = {
  id: string;
  project_id: string;
  workspace_id: string | null;
  certificate_reference?: string | null;
  revision: number;
  status: SignOffStatus;
  rules_version: string;
  document_data: Partial<SignOffDocument>;
  planner_snapshot: Partial<PlannerState>;
  email_status: "not_requested" | "pending" | "sent" | "failed";
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  project_name?: string;
};

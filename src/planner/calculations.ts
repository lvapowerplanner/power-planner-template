import type {
  CircuitCableDesign,
  PlannerOutput,
  PlannerState,
  ProjectDistro,
} from "@/planner/types";

export type PhaseLoads = {
  L1: number;
  L2: number;
  L3: number;
};

export type ValidationSeverity = "ok" | "warning" | "critical";

export type ValidationIssue = {
  id: string;
  severity: Exclude<ValidationSeverity, "ok">;
  message: string;
  context: string;
  currentValue?: number;
};

export type DistroLoadSummary = {
  distro: ProjectDistro;
  watts: number;
  ownWatts: number;
  downstreamWatts: number;
  amps: number;
  phaseLoads: PhaseLoads;
  ownPhaseLoads: PhaseLoads;
  downstreamPhaseLoads: PhaseLoads;
  issues: ValidationIssue[];
  children: DistroLoadSummary[];
  fedFromOutputId?: string;
  fedFromOutputLabel?: string;
  fedFromOutputPhase?: PlannerOutput["phase"];
};

export type SourceLoadSummary = {
  sourceId: string;
  sourceName: string;
  sourceConnection: string;
  sourceRating: number;
  watts: number;
  amps: number;
  phaseLoads: PhaseLoads;
  distros: DistroLoadSummary[];
  issues: ValidationIssue[];
};

export type SystemLoadSummary = {
  totalDistros: number;
  manualPowerSources: number;
  connectedWatts: number;
  connectedAmps: number;
  sourceSummaries: SourceLoadSummary[];
  unassignedDistros: DistroLoadSummary[];
  issues: ValidationIssue[];
  warningCount: number;
  criticalCount: number;
  health: ValidationSeverity;
};

export type AdvancedCircuitCalculation = {
  connectedWatts: number;
  diversityPercent: number;
  diversifiedWatts: number;
  powerFactor: number;
  apparentVa: number;
  currentAmps: number;
};

export type AdvancedLoadMetrics = {
  connectedWatts: number;
  designWatts: number;
  apparentVa: number;
};

export type CableCalculationStatus = "pass" | "review" | "fail";

export type CableCalculationResult = {
  adjustedCapacityA: number;
  utilisationPercent: number;
  sectionVoltageDropV: number;
  sectionVoltageDropPercent: number;
  cumulativeVoltageDropV: number;
  cumulativeVoltageDropPercent: number;
  endVoltageV: number;
  status: CableCalculationStatus;
  statusReasons: string[];
};

function autoSourceId(parentDistroId: string, outputId: string): string {
  return `auto_${parentDistroId}_${outputId}`;
}

export function isThreePhaseConnection(connection: string): boolean {
  return (
    connection.includes("/ 3") ||
    connection.includes("/3") ||
    connection.toLowerCase().includes("powerlock")
  );
}

export function wattsToAmps(watts: number): number {
  return watts / 230;
}

export function clampDiversityPercent(value?: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(1, Number(value)));
}

export function clampPowerFactor(value?: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0.1, Number(value)));
}

export function calculateAdvancedCircuit({
  connectedWatts,
  phase,
  diversityPercent,
  calculationMethod,
  projectPowerFactor,
  powerFactorOverride,
  nominalSinglePhaseVoltage,
  nominalThreePhaseVoltage,
}: {
  connectedWatts: number;
  phase: PlannerOutput["phase"];
  diversityPercent?: number;
  calculationMethod: "real-power" | "include-power-factor";
  projectPowerFactor: number;
  powerFactorOverride?: number;
  nominalSinglePhaseVoltage: number;
  nominalThreePhaseVoltage: number;
}): AdvancedCircuitCalculation {
  const safeConnectedWatts = Math.max(0, Number(connectedWatts) || 0);
  const safeDiversity = clampDiversityPercent(diversityPercent);
  const diversifiedWatts = safeConnectedWatts * (safeDiversity / 100);
  const selectedPowerFactor =
    calculationMethod === "include-power-factor"
      ? clampPowerFactor(powerFactorOverride ?? projectPowerFactor)
      : 1;
  const apparentVa = diversifiedWatts / selectedPowerFactor;
  const singlePhaseVoltage = Math.max(
    1,
    Number(nominalSinglePhaseVoltage) || 230,
  );
  const threePhaseVoltage = Math.max(
    1,
    Number(nominalThreePhaseVoltage) || 400,
  );
  const currentAmps =
    phase === "3Φ"
      ? apparentVa / (Math.sqrt(3) * threePhaseVoltage)
      : apparentVa / singlePhaseVoltage;

  return {
    connectedWatts: safeConnectedWatts,
    diversityPercent: safeDiversity,
    diversifiedWatts,
    powerFactor: selectedPowerFactor,
    apparentVa,
    currentAmps,
  };
}

export function calculateCableDesign({
  cableDesign,
  designCurrentA,
  nominalVoltageV,
  upstreamVoltageDropV = 0,
}: {
  cableDesign: CircuitCableDesign | undefined;
  designCurrentA: number;
  nominalVoltageV: number;
  upstreamVoltageDropV?: number;
}): CableCalculationResult | null {
  if (!cableDesign) return null;

  const parallelRuns = Math.max(1, cableDesign.parallelRuns || 1);
  const deratingFactor = Math.min(
    1,
    Math.max(0.01, cableDesign.deratingFactor || 1),
  );
  const lengthMetres = Math.max(0, cableDesign.lengthMetres || 0);
  const nominalVoltage = Math.max(1, nominalVoltageV || 230);
  const adjustedCapacityA =
    cableDesign.snapshot.currentCapacityA * parallelRuns * deratingFactor;
  const utilisationPercent =
    adjustedCapacityA > 0 ? (designCurrentA / adjustedCapacityA) * 100 : 0;
  const sectionVoltageDropV =
    (cableDesign.snapshot.voltageDropMvPerAmpMetre *
      Math.max(0, designCurrentA) *
      lengthMetres) /
    1000 /
    parallelRuns;
  const cumulativeVoltageDropV =
    Math.max(0, upstreamVoltageDropV) + sectionVoltageDropV;
  const sectionVoltageDropPercent =
    (sectionVoltageDropV / nominalVoltage) * 100;
  const cumulativeVoltageDropPercent =
    (cumulativeVoltageDropV / nominalVoltage) * 100;
  const endVoltageV = Math.max(0, nominalVoltage - cumulativeVoltageDropV);
  const statusReasons: string[] = [];

  if (lengthMetres <= 0) {
    statusReasons.push("Cable length is incomplete.");
  }

  if (designCurrentA > adjustedCapacityA) {
    statusReasons.push("Design current exceeds adjusted cable capacity.");
  }

  if (
    cumulativeVoltageDropPercent >
    Math.max(0.1, cableDesign.voltageDropLimitPercent || 5)
  ) {
    statusReasons.push("Cumulative voltage drop exceeds the selected limit.");
  }

  if (
    !cableDesign.designerVerified ||
    cableDesign.designerVerificationFingerprint !==
      cableVerificationFingerprint(cableDesign, designCurrentA)
  ) {
    statusReasons.push("Cable data and installation assumptions require designer verification.");
  }

  if (cableDesign.snapshot.suitabilityClass === "conditional") {
    statusReasons.push(
      "Cable library suitability is conditional and requires documented design review.",
    );
  }

  if (cableDesign.snapshot.suitabilityClass === "not_recommended") {
    statusReasons.push(
      "Cable library classifies this cable as not recommended for general temporary-distribution use.",
    );
  }

  const hasFailure = statusReasons.some(
    (reason) =>
      reason.includes("exceeds adjusted") ||
      reason.includes("exceeds the selected"),
  );

  return {
    adjustedCapacityA,
    utilisationPercent,
    sectionVoltageDropV,
    sectionVoltageDropPercent,
    cumulativeVoltageDropV,
    cumulativeVoltageDropPercent,
    endVoltageV,
    status: hasFailure
      ? "fail"
      : statusReasons.length > 0
        ? "review"
        : "pass",
    statusReasons,
  };
}

export function cableVerificationFingerprint(
  cableDesign: CircuitCableDesign,
  designCurrentA: number,
) {
  return JSON.stringify({
    dataSource: cableDesign.dataSource,
    cableRatingId: cableDesign.cableRatingId ?? null,
    snapshot: cableDesign.snapshot,
    lengthMetres: cableDesign.lengthMetres,
    parallelRuns: cableDesign.parallelRuns,
    deratingFactor: cableDesign.deratingFactor,
    voltageDropLimitPercent: cableDesign.voltageDropLimitPercent,
    voltageDropCategory: cableDesign.voltageDropCategory,
    designCurrentA: Number(designCurrentA.toFixed(6)),
  });
}

function advancedSettingsFor(plannerState: PlannerState) {
  return {
    calculationMethod:
      plannerState.advancedElectrical?.calculationMethod ?? "real-power",
    projectPowerFactor:
      plannerState.advancedElectrical?.defaultPowerFactor ?? 1,
    nominalSinglePhaseVoltage:
      plannerState.advancedElectrical?.nominalSinglePhaseVoltage ?? 230,
    nominalThreePhaseVoltage:
      plannerState.advancedElectrical?.nominalThreePhaseVoltage ?? 400,
  } as const;
}

function advancedOutputCalculation(
  output: PlannerOutput,
  plannerState: PlannerState,
) {
  const settings = advancedSettingsFor(plannerState);

  return calculateAdvancedCircuit({
    connectedWatts: outputOwnWatts(output),
    phase: output.phase,
    diversityPercent: output.diversityPercent,
    calculationMethod: settings.calculationMethod,
    projectPowerFactor: settings.projectPowerFactor,
    powerFactorOverride: output.powerFactorOverride,
    nominalSinglePhaseVoltage: settings.nominalSinglePhaseVoltage,
    nominalThreePhaseVoltage: settings.nominalThreePhaseVoltage,
  });
}

function equivalentStandardWatts(
  output: PlannerOutput,
  currentAmps: number,
) {
  return output.phase === "3Φ"
    ? currentAmps * 230 * 3
    : currentAmps * 230;
}

function advancedOutputForSummary(
  output: PlannerOutput,
  plannerState: PlannerState,
): PlannerOutput {
  if (output.phase === "Socapex") {
    return {
      ...output,
      socaCircuits: (output.socaCircuits ?? []).map((socket) =>
        advancedOutputForSummary(socket, plannerState),
      ),
    };
  }

  const calculation = advancedOutputCalculation(output, plannerState);
  const equivalentWatts = equivalentStandardWatts(
    output,
    calculation.currentAmps,
  );

  return {
    ...output,
    items:
      equivalentWatts > 0
        ? [
            {
              id: `advanced_${output.id}`,
              name: "Advanced design load",
              watts: equivalentWatts,
              quantity: 1,
            },
          ]
        : [],
  };
}

export function advancedPlannerStateForLoadSummary(
  plannerState: PlannerState,
): PlannerState {
  return {
    ...plannerState,
    distros: plannerState.distros.map((distro) => ({
      ...distro,
      outputs: distro.outputs.map((output) =>
        advancedOutputForSummary(output, plannerState),
      ),
    })),
  };
}

function addAdvancedMetrics(
  first: AdvancedLoadMetrics,
  second: AdvancedLoadMetrics,
): AdvancedLoadMetrics {
  return {
    connectedWatts: first.connectedWatts + second.connectedWatts,
    designWatts: first.designWatts + second.designWatts,
    apparentVa: first.apparentVa + second.apparentVa,
  };
}

function advancedCalculationFromMetrics(
  output: PlannerOutput,
  metrics: AdvancedLoadMetrics,
  plannerState: PlannerState,
): AdvancedCircuitCalculation {
  const settings = advancedSettingsFor(plannerState);
  const powerFactor = metrics.apparentVa > 0
    ? metrics.designWatts / metrics.apparentVa
    : 1;
  const diversityPercent = metrics.connectedWatts > 0
    ? (metrics.designWatts / metrics.connectedWatts) * 100
    : 100;
  const voltage = output.phase === "3\u03a6"
    ? settings.nominalThreePhaseVoltage
    : settings.nominalSinglePhaseVoltage;
  const currentAmps = output.phase === "3\u03a6"
    ? metrics.apparentVa / (Math.sqrt(3) * voltage)
    : metrics.apparentVa / voltage;

  return {
    connectedWatts: metrics.connectedWatts,
    diversityPercent,
    diversifiedWatts: metrics.designWatts,
    powerFactor,
    apparentVa: metrics.apparentVa,
    currentAmps,
  };
}

export function advancedOutputCalculationForLink(
  output: PlannerOutput,
  parentDistro: ProjectDistro,
  plannerState: PlannerState,
  visited: Set<string> = new Set(),
): AdvancedCircuitCalculation {
  const child = childDistroFedFromOutput(
    plannerState,
    parentDistro.id,
    output.id,
  );

  if (!child || visited.has(child.id)) {
    return advancedOutputCalculation(output, plannerState);
  }

  const nextVisited = new Set(visited);
  nextVisited.add(parentDistro.id);
  return advancedCalculationFromMetrics(
    output,
    advancedDistroLoadMetrics(child, plannerState, nextVisited),
    plannerState,
  );
}

export function advancedDistroLoadMetrics(
  distro: ProjectDistro,
  plannerState: PlannerState,
  visited: Set<string> = new Set(),
): AdvancedLoadMetrics {
  if (visited.has(distro.id)) {
    return { connectedWatts: 0, designWatts: 0, apparentVa: 0 };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(distro.id);

  return distro.outputs.reduce<AdvancedLoadMetrics>((total, output) => {
    if (output.phase === "Socapex") {
      return (output.socaCircuits ?? []).reduce(
        (socaTotal, circuit) => {
          const calculation = advancedOutputCalculation(circuit, plannerState);
          return addAdvancedMetrics(socaTotal, {
            connectedWatts: calculation.connectedWatts,
            designWatts: calculation.diversifiedWatts,
            apparentVa: calculation.apparentVa,
          });
        },
        total,
      );
    }

    const calculation = advancedOutputCalculationForLink(
      output,
      distro,
      plannerState,
      nextVisited,
    );
    return addAdvancedMetrics(total, {
      connectedWatts: calculation.connectedWatts,
      designWatts: calculation.diversifiedWatts,
      apparentVa: calculation.apparentVa,
    });
  }, { connectedWatts: 0, designWatts: 0, apparentVa: 0 });
}

export function advancedSourceLoadMetrics(
  sourceId: string,
  plannerState: PlannerState,
): AdvancedLoadMetrics {
  return plannerState.distros
    .filter((distro) => distro.sourceId === sourceId)
    .reduce(
      (total, distro) =>
        addAdvancedMetrics(
          total,
          advancedDistroLoadMetrics(distro, plannerState),
        ),
      { connectedWatts: 0, designWatts: 0, apparentVa: 0 },
    );
}

export function createEmptyPhaseLoads(): PhaseLoads {
  return { L1: 0, L2: 0, L3: 0 };
}

export function addPhaseLoads(a: PhaseLoads, b: PhaseLoads): PhaseLoads {
  return {
    L1: a.L1 + b.L1,
    L2: a.L2 + b.L2,
    L3: a.L3 + b.L3,
  };
}

export function phaseLoadTotal(loads: PhaseLoads): number {
  return loads.L1 + loads.L2 + loads.L3;
}

export function outputOwnWatts(output: PlannerOutput): number {
  return output.items.reduce(
    (total, item) => total + item.watts * item.quantity,
    0,
  );
}

export function outputOwnPhaseLoads(output: PlannerOutput): PhaseLoads {
  const watts = outputOwnWatts(output);
  const amps = wattsToAmps(watts);

  if (output.phase === "L1") return { L1: amps, L2: 0, L3: 0 };
  if (output.phase === "L2") return { L1: 0, L2: amps, L3: 0 };
  if (output.phase === "L3") return { L1: 0, L2: 0, L3: amps };

  if (output.phase === "3Φ") {
    const perPhase = amps / 3;
    return { L1: perPhase, L2: perPhase, L3: perPhase };
  }

  return createEmptyPhaseLoads();
}

export function socapexOutputPhaseLoads(output: PlannerOutput): PhaseLoads {
  return (output.socaCircuits ?? []).reduce<PhaseLoads>(
    (total, socket) => addPhaseLoads(total, outputOwnPhaseLoads(socket)),
    createEmptyPhaseLoads(),
  );
}

export function socapexOutputWatts(output: PlannerOutput): number {
  return (output.socaCircuits ?? []).reduce<number>(
    (total, socket) => total + outputOwnWatts(socket),
    0,
  );
}

export function outputDisplayName(
  output: PlannerOutput,
  index: number,
): string {
  if (output.displayName) return output.displayName;
  if (output.phase === "Socapex")
    return `Soca ${output.outputNumber ?? index + 1}`;
  if (output.phase === "3Φ") return `${index + 1} - ${output.rating}/3`;
  return `${index + 1} - ${output.rating}a`;
}

export function displayDistroName(distro: {
  instanceName: string;
  name: string;
}): string {
  return distro.instanceName.trim()
    ? `${distro.instanceName} - ${distro.name}`
    : distro.name;
}

export function childDistroFedFromOutput(
  plannerState: PlannerState,
  parentDistroId: string,
  outputId: string,
): ProjectDistro | undefined {
  const sourceId = autoSourceId(parentDistroId, outputId);

  return plannerState.distros.find((distro) => distro.sourceId === sourceId);
}

export function childDistrosForDistro(
  plannerState: PlannerState,
  distro: ProjectDistro,
): ProjectDistro[] {
  return distro.outputs
    .map((output) =>
      childDistroFedFromOutput(plannerState, distro.id, output.id),
    )
    .filter((distro): distro is ProjectDistro => Boolean(distro));
}

function childSummaryForOutput(
  plannerState: PlannerState,
  parentDistro: ProjectDistro,
  output: PlannerOutput,
  outputIndex: number,
  visited: Set<string>,
): DistroLoadSummary | null {
  const child = childDistroFedFromOutput(
    plannerState,
    parentDistro.id,
    output.id,
  );

  if (!child || visited.has(child.id)) return null;

  return distroLoadSummary(child, plannerState, visited, {
    outputId: output.id,
    outputLabel: outputDisplayName(output, outputIndex),
    outputPhase: output.phase,
  });
}

function mapChildLoadsOntoParentOutput(
  output: PlannerOutput,
  childLoads: PhaseLoads,
): PhaseLoads {
  if (output.phase === "3Φ") return childLoads;

  const childTotal = phaseLoadTotal(childLoads);

  if (output.phase === "L1") return { L1: childTotal, L2: 0, L3: 0 };
  if (output.phase === "L2") return { L1: 0, L2: childTotal, L3: 0 };
  if (output.phase === "L3") return { L1: 0, L2: 0, L3: childTotal };

  return createEmptyPhaseLoads();
}

function mapSinglePhaseDistroLoadsToFeedPhase(
  feedPhase: PlannerOutput["phase"] | undefined,
  loads: PhaseLoads,
): PhaseLoads {
  if (feedPhase !== "L1" && feedPhase !== "L2" && feedPhase !== "L3") {
    return loads;
  }

  const total = phaseLoadTotal(loads);

  if (feedPhase === "L1") return { L1: total, L2: 0, L3: 0 };
  if (feedPhase === "L2") return { L1: 0, L2: total, L3: 0 };
  return { L1: 0, L2: 0, L3: total };
}

function shouldMapDistroSummaryToFeedPhase(
  distro: ProjectDistro,
  feedPhase: PlannerOutput["phase"] | undefined,
): boolean {
  return (
    !isThreePhaseConnection(distro.input) &&
    (feedPhase === "L1" || feedPhase === "L2" || feedPhase === "L3")
  );
}

export function outputPhaseLoads(
  output: PlannerOutput,
  plannerState?: PlannerState,
  parentDistro?: ProjectDistro,
  visited: Set<string> = new Set(),
): PhaseLoads {
  let loads = outputOwnPhaseLoads(output);

  if (!plannerState || !parentDistro || output.phase === "Socapex") {
    return loads;
  }

  const child = childDistroFedFromOutput(
    plannerState,
    parentDistro.id,
    output.id,
  );

  if (!child || visited.has(child.id)) {
    return loads;
  }

  const childLoads = distroPhaseLoads(child, plannerState, new Set(visited));
  return addPhaseLoads(
    loads,
    mapChildLoadsOntoParentOutput(output, childLoads),
  );
}

export function outputWatts(
  output: PlannerOutput,
  plannerState?: PlannerState,
  parentDistro?: ProjectDistro,
  visited: Set<string> = new Set(),
): number {
  const ownWatts = outputOwnWatts(output);

  if (!plannerState || !parentDistro || output.phase === "Socapex") {
    return ownWatts;
  }

  const child = childDistroFedFromOutput(
    plannerState,
    parentDistro.id,
    output.id,
  );

  if (!child || visited.has(child.id)) {
    return ownWatts;
  }

  return ownWatts + distroWatts(child, plannerState, new Set(visited));
}

export function distroOwnPhaseLoads(distro: ProjectDistro): PhaseLoads {
  const loads = distro.outputs.reduce<PhaseLoads>((total, output) => {
    if (output.phase === "Socapex") {
      return addPhaseLoads(total, socapexOutputPhaseLoads(output));
    }

    return addPhaseLoads(total, outputOwnPhaseLoads(output));
  }, createEmptyPhaseLoads());

  return isThreePhaseConnection(distro.input)
    ? loads
    : { L1: phaseLoadTotal(loads), L2: 0, L3: 0 };
}

export function distroPhaseLoads(
  distro: ProjectDistro,
  plannerState?: PlannerState,
  visited: Set<string> = new Set(),
): PhaseLoads {
  if (visited.has(distro.id)) return createEmptyPhaseLoads();

  const nextVisited = new Set(visited);
  nextVisited.add(distro.id);

  const loads = distro.outputs.reduce<PhaseLoads>((total, output) => {
    if (output.phase === "Socapex") {
      return addPhaseLoads(total, socapexOutputPhaseLoads(output));
    }

    return addPhaseLoads(
      total,
      outputPhaseLoads(output, plannerState, distro, nextVisited),
    );
  }, createEmptyPhaseLoads());

  return isThreePhaseConnection(distro.input)
    ? loads
    : { L1: phaseLoadTotal(loads), L2: 0, L3: 0 };
}

export function distroOwnWatts(distro: ProjectDistro): number {
  return distro.outputs.reduce<number>((total, output) => {
    if (output.phase === "Socapex") {
      return total + socapexOutputWatts(output);
    }

    return total + outputOwnWatts(output);
  }, 0);
}

export function distroWatts(
  distro: ProjectDistro,
  plannerState?: PlannerState,
  visited: Set<string> = new Set(),
): number {
  if (visited.has(distro.id)) return 0;

  const nextVisited = new Set(visited);
  nextVisited.add(distro.id);

  return distro.outputs.reduce<number>((total, output) => {
    if (output.phase === "Socapex") {
      return total + socapexOutputWatts(output);
    }

    return total + outputWatts(output, plannerState, distro, nextVisited);
  }, 0);
}

export function maxPhase(loads: PhaseLoads): number {
  return Math.max(loads.L1, loads.L2, loads.L3);
}

export function minPhase(loads: PhaseLoads): number {
  return Math.min(loads.L1, loads.L2, loads.L3);
}

export function phaseImbalance(loads: PhaseLoads): number {
  const max = maxPhase(loads);
  const min = minPhase(loads);

  if (max === 0) return 0;

  return ((max - min) / max) * 100;
}

export function validateOutput(
  output: PlannerOutput,
  context: string,
  plannerState?: PlannerState,
  parentDistro?: ProjectDistro,
): ValidationIssue[] {
  if (output.phase === "Socapex") return [];

  const loads = outputPhaseLoads(output, plannerState, parentDistro);
  const amps = output.phase === "3Φ" ? maxPhase(loads) : phaseLoadTotal(loads);

  if (amps > output.rating) {
    return [
      {
        id: `${output.id}-overload`,
        severity: "critical",
        context,
        message: `${context} is overloaded: ${formatAmps(amps)} / ${formatAmps(output.rating)}.`,
        currentValue: amps,
      },
    ];
  }

  const warningThreshold =
    output.phase !== "3Φ" && output.rating <= 32 ? 0.95 : 0.8;

  if (amps > output.rating * warningThreshold) {
    return [
      {
        id: `${output.id}-near-limit`,
        severity: "warning",
        context,
        message: `${context} is near capacity: ${formatAmps(amps)} / ${formatAmps(output.rating)}.`,
        currentValue: amps,
      },
    ];
  }

  return [];
}

function socapexBreakerPairIssues(
  distro: ProjectDistro,
  outputIndexById: Map<string, number>,
): ValidationIssue[] {
  const pairedSocapexOutputs = distro.outputs.filter(
    (output) =>
      output.phase === "Socapex" && Boolean(output.breakerPair?.trim()),
  );

  if (pairedSocapexOutputs.length === 0) return [];

  const outputsByBreakerPair = new Map<string, PlannerOutput[]>();

  pairedSocapexOutputs.forEach((output) => {
    const breakerPair = output.breakerPair?.trim();

    if (!breakerPair) return;

    outputsByBreakerPair.set(breakerPair, [
      ...(outputsByBreakerPair.get(breakerPair) ?? []),
      output,
    ]);
  });

  const issues: ValidationIssue[] = [];

  outputsByBreakerPair.forEach((outputs, breakerPair) => {
    if (outputs.length < 2) return;

    const socketsByCircuit = new Map<number, PlannerOutput[]>();

    outputs.forEach((output) => {
      (output.socaCircuits ?? []).forEach((socket) => {
        if (typeof socket.circuitNo !== "number") return;

        socketsByCircuit.set(socket.circuitNo, [
          ...(socketsByCircuit.get(socket.circuitNo) ?? []),
          socket,
        ]);
      });
    });

    socketsByCircuit.forEach((sockets, circuitNo) => {
      if (sockets.length < 2) return;

      const amps = wattsToAmps(
        sockets.reduce((total, socket) => total + outputOwnWatts(socket), 0),
      );
      const rating = Math.min(...sockets.map((socket) => socket.rating || 16));
      const outputNames = outputs
        .map((output) =>
          outputDisplayName(output, outputIndexById.get(output.id) ?? 0),
        )
        .join(" + ");
      const context = `${displayDistroName(distro)} / ${outputNames} / shared circuit ${circuitNo}`;

      if (amps > rating) {
        issues.push({
          id: `${distro.id}-soca-breaker-${breakerPair}-${circuitNo}-overload`,
          severity: "critical",
          context,
          message: `${context} shared breaker is overloaded: ${formatAmps(amps)} / ${formatAmps(rating)}.`,
          currentValue: amps,
        });
      } else if (amps > rating * 0.95) {
        issues.push({
          id: `${distro.id}-soca-breaker-${breakerPair}-${circuitNo}-near-limit`,
          severity: "warning",
          context,
          message: `${context} shared breaker is near capacity: ${formatAmps(amps)} / ${formatAmps(rating)}.`,
          currentValue: amps,
        });
      }
    });
  });

  return issues;
}

export function validateDistro(
  distro: ProjectDistro,
  plannerState?: PlannerState,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const outputIndexById = new Map(
    distro.outputs.map((output, outputIndex) => [output.id, outputIndex]),
  );

  distro.outputs.forEach((output, outputIndex) => {
    const outputContext = `${displayDistroName(distro)} / ${outputDisplayName(
      output,
      outputIndex,
    )}`;

    if (output.phase === "Socapex") {
      (output.socaCircuits ?? []).forEach((socket) => {
        issues.push(
          ...validateOutput(socket, `${outputContext} / ${socket.label}`),
        );
      });
      return;
    }

    issues.push(...validateOutput(output, outputContext, plannerState, distro));
  });

  issues.push(...socapexBreakerPairIssues(distro, outputIndexById));

  return issues;
}


function phaseImbalanceReference(loads: PhaseLoads) {
  const phaseEntries = (["L1", "L2", "L3"] as const).map((phase) => ({
    phase,
    amps: loads[phase],
  }));
  const highest = phaseEntries.reduce((current, candidate) =>
    candidate.amps > current.amps ? candidate : current,
  );
  const lowest = phaseEntries.reduce((current, candidate) =>
    candidate.amps < current.amps ? candidate : current,
  );
  const imbalance = phaseImbalance(loads);

  return `${highest.phase} ${Math.round(imbalance)}% imbalance versus ${lowest.phase}`;
}

export function validateSource(
  sourceId: string,
  sourceName: string,
  sourceConnection: string,
  sourceRating: number,
  loads: PhaseLoads,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const phases = isThreePhaseConnection(sourceConnection)
    ? (["L1", "L2", "L3"] as const)
    : (["L1"] as const);

  phases.forEach((phase) => {
    const amps = loads[phase];

    if (amps > sourceRating) {
      issues.push({
        id: `${sourceId}-${phase}-overload`,
        severity: "critical",
        context: sourceName,
        message: `${sourceName} ${phase} overloaded: ${formatAmps(
          amps,
        )} / ${formatAmps(sourceRating)}.`,
        currentValue: amps,
      });
    } else if (amps > sourceRating * 0.8) {
      issues.push({
        id: `${sourceId}-${phase}-near-limit`,
        severity: "warning",
        context: sourceName,
        message: `${sourceName} ${phase} above 80% capacity: ${formatAmps(
          amps,
        )} / ${formatAmps(sourceRating)}.`,
        currentValue: amps,
      });
    }
  });

  if (isThreePhaseConnection(sourceConnection)) {
    const imbalance = phaseImbalance(loads);

    if (imbalance >= 50 && maxPhase(loads) > 5) {
      issues.push({
        id: `${sourceId}-phase-imbalance-critical`,
        severity: "critical",
        context: sourceName,
        message: `Severe phase imbalance on ${sourceName}: ${phaseImbalanceReference(loads)}.`,
        currentValue: imbalance,
      });
    } else if (imbalance >= 30 && maxPhase(loads) > 5) {
      issues.push({
        id: `${sourceId}-phase-imbalance-warning`,
        severity: "warning",
        context: sourceName,
        message: `Phase imbalance on ${sourceName}: ${phaseImbalanceReference(loads)}.`,
        currentValue: imbalance,
      });
    }
  }

  return issues;
}

export function distroLoadSummary(
  distro: ProjectDistro,
  plannerState?: PlannerState,
  visited: Set<string> = new Set(),
  feedInfo?: {
    outputId: string;
    outputLabel: string;
    outputPhase?: PlannerOutput["phase"];
  },
): DistroLoadSummary {
  if (visited.has(distro.id)) {
    return {
      distro,
      watts: 0,
      ownWatts: 0,
      downstreamWatts: 0,
      amps: 0,
      phaseLoads: createEmptyPhaseLoads(),
      ownPhaseLoads: createEmptyPhaseLoads(),
      downstreamPhaseLoads: createEmptyPhaseLoads(),
      issues: [],
      children: [],
      fedFromOutputId: feedInfo?.outputId,
      fedFromOutputLabel: feedInfo?.outputLabel,
      fedFromOutputPhase: feedInfo?.outputPhase,
    };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(distro.id);

  const children = plannerState
    ? distro.outputs
        .map((output, outputIndex) =>
          childSummaryForOutput(
            plannerState,
            distro,
            output,
            outputIndex,
            nextVisited,
          ),
        )
        .filter((child): child is DistroLoadSummary => Boolean(child))
    : [];

  const localOwnPhaseLoads = distroOwnPhaseLoads(distro);
  const localPhaseLoads = distroPhaseLoads(distro, plannerState, visited);
  const shouldMapToFeedPhase = shouldMapDistroSummaryToFeedPhase(
    distro,
    feedInfo?.outputPhase,
  );
  const ownPhaseLoads = shouldMapToFeedPhase
    ? mapSinglePhaseDistroLoadsToFeedPhase(
        feedInfo?.outputPhase,
        localOwnPhaseLoads,
      )
    : localOwnPhaseLoads;
  const phaseLoads = shouldMapToFeedPhase
    ? mapSinglePhaseDistroLoadsToFeedPhase(
        feedInfo?.outputPhase,
        localPhaseLoads,
      )
    : localPhaseLoads;
  const ownWatts = distroOwnWatts(distro);
  const watts = distroWatts(distro, plannerState, visited);

  return {
    distro,
    watts,
    ownWatts,
    downstreamWatts: Math.max(0, watts - ownWatts),
    amps: phaseLoadTotal(phaseLoads),
    phaseLoads,
    ownPhaseLoads,
    downstreamPhaseLoads: {
      L1: Math.max(0, phaseLoads.L1 - ownPhaseLoads.L1),
      L2: Math.max(0, phaseLoads.L2 - ownPhaseLoads.L2),
      L3: Math.max(0, phaseLoads.L3 - ownPhaseLoads.L3),
    },
    issues: validateDistro(distro, plannerState),
    children,
    fedFromOutputId: feedInfo?.outputId,
    fedFromOutputLabel: feedInfo?.outputLabel,
    fedFromOutputPhase: feedInfo?.outputPhase,
  };
}

export function flattenDistroIssues(
  summary: DistroLoadSummary,
): ValidationIssue[] {
  return [
    ...summary.issues,
    ...summary.children.flatMap((child) => flattenDistroIssues(child)),
  ];
}

function hasManualOrAutoSource(distro: ProjectDistro): boolean {
  return Boolean(distro.sourceId);
}

function isFedByAnotherDistro(
  plannerState: PlannerState,
  distro: ProjectDistro,
): boolean {
  return plannerState.distros.some((parent) =>
    parent.outputs.some(
      (output) => autoSourceId(parent.id, output.id) === distro.sourceId,
    ),
  );
}

export function systemLoadSummary(
  plannerState: PlannerState,
): SystemLoadSummary {
  const manualSources = plannerState.sources.filter((source) => !source.auto);

  const sourceSummaries: SourceLoadSummary[] = manualSources.map((source) => {
    const distros = plannerState.distros
      .filter((distro) => distro.sourceId === source.id)
      .map((distro) => distroLoadSummary(distro, plannerState));

    const phaseLoads = distros.reduce<PhaseLoads>(
      (total, distro) => addPhaseLoads(total, distro.phaseLoads),
      createEmptyPhaseLoads(),
    );

    const watts = distros.reduce<number>(
      (total, distro) => total + distro.watts,
      0,
    );

    const sourceIssues = validateSource(
      source.id,
      source.name,
      source.conn,
      source.rating,
      phaseLoads,
    );

    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceConnection: source.conn,
      sourceRating: source.rating,
      watts,
      amps: phaseLoadTotal(phaseLoads),
      phaseLoads,
      distros,
      issues: [...sourceIssues, ...distros.flatMap(flattenDistroIssues)],
    };
  });

  const unassignedDistros = plannerState.distros
    .filter(
      (distro) =>
        !hasManualOrAutoSource(distro) &&
        !isFedByAnotherDistro(plannerState, distro),
    )
    .map((distro) => distroLoadSummary(distro, plannerState));

  const issues = [
    ...sourceSummaries.flatMap((source) => source.issues),
    ...unassignedDistros.flatMap(flattenDistroIssues),
    ...unassignedDistros.map((distro) => ({
      id: `${distro.distro.id}-unassigned`,
      severity: "warning" as const,
      context: displayDistroName(distro.distro),
      message: `${displayDistroName(
        distro.distro,
      )} has no assigned power source.`,
    })),
  ];

  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  const criticalCount = issues.filter(
    (issue) => issue.severity === "critical",
  ).length;

  return {
    totalDistros: plannerState.distros.length,
    manualPowerSources: manualSources.length,
    connectedWatts: sourceSummaries.reduce<number>(
      (total, source) => total + source.watts,
      0,
    ),
    connectedAmps: sourceSummaries.reduce<number>(
      (total, source) => total + source.amps,
      0,
    ),
    sourceSummaries,
    unassignedDistros,
    issues,
    warningCount,
    criticalCount,
    health:
      criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "ok",
  };
}

export function formatWatts(value: number): string {
  return `${Math.round(value).toLocaleString()} W`;
}

export function formatAmps(value: number): string {
  return `${value.toFixed(1)} A`;
}

export function phasePercentage(amps: number, rating: number): number {
  if (!rating) return 0;
  return Math.round((amps / rating) * 100);
}

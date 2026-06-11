
import type { PlannerOutput, PlannerState, ProjectDistro } from "@/planner/types";
function autoSourceId(parentDistroId: string, outputId: string): string {
  return `auto_${parentDistroId}_${outputId}`;
}
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
};

export type DistroLoadSummary = {
  distro: ProjectDistro;
  watts: number;
  amps: number;
  phaseLoads: PhaseLoads;
  issues: ValidationIssue[];
  children: DistroLoadSummary[];
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

export function isThreePhaseConnection(connection: string): boolean {
  return connection.includes("/ 3") || connection.includes("/3");
}

export function wattsToAmps(watts: number): number {
  return watts / 230;
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
    0
  );
}

export function outputWatts(
  output: PlannerOutput,
  plannerState?: PlannerState,
  parentDistro?: ProjectDistro,
  visited: Set<string> = new Set()
): number {
  const ownWatts = outputOwnWatts(output);

  if (!plannerState || !parentDistro) return ownWatts;

  const childDistro = childDistroFedFromOutput(
    plannerState,
    parentDistro.id,
    output.id
  );

  if (!childDistro || visited.has(childDistro.id)) return ownWatts;

  return ownWatts + distroWatts(childDistro, plannerState, new Set(visited));
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

export function outputPhaseLoads(
  output: PlannerOutput,
  plannerState?: PlannerState,
  parentDistro?: ProjectDistro,
  visited: Set<string> = new Set()
): PhaseLoads {
  let loads = outputOwnPhaseLoads(output);

  if (!plannerState || !parentDistro) return loads;

  const childDistro = childDistroFedFromOutput(
    plannerState,
    parentDistro.id,
    output.id
  );

  if (!childDistro || visited.has(childDistro.id)) return loads;

  const childLoads = distroPhaseLoads(childDistro, plannerState, new Set(visited));

  if (output.phase === "3Φ") {
    return addPhaseLoads(loads, childLoads);
  }

  const childTotal = phaseLoadTotal(childLoads);

  if (output.phase === "L1") {
    loads = addPhaseLoads(loads, { L1: childTotal, L2: 0, L3: 0 });
  }

  if (output.phase === "L2") {
    loads = addPhaseLoads(loads, { L1: 0, L2: childTotal, L3: 0 });
  }

  if (output.phase === "L3") {
    loads = addPhaseLoads(loads, { L1: 0, L2: 0, L3: childTotal });
  }

  return loads;
}

export function socapexOutputPhaseLoads(output: PlannerOutput): PhaseLoads {
  return (output.socaCircuits ?? []).reduce(
    (total, socket) => addPhaseLoads(total, outputOwnPhaseLoads(socket)),
    createEmptyPhaseLoads()
  );
}

export function distroPhaseLoads(
  distro: ProjectDistro,
  plannerState?: PlannerState,
  visited: Set<string> = new Set()
): PhaseLoads {
  if (visited.has(distro.id)) return createEmptyPhaseLoads();

  const nextVisited = new Set(visited);
  nextVisited.add(distro.id);

  return distro.outputs.reduce<PhaseLoads>((total, output) => {
    if (output.phase === "Socapex") {
      return addPhaseLoads(total, socapexOutputPhaseLoads(output));
    }

    return addPhaseLoads(
      total,
      outputPhaseLoads(output, plannerState, distro, nextVisited)
    );
  }, createEmptyPhaseLoads());
}

export function distroWatts(
  distro: ProjectDistro,
  plannerState?: PlannerState,
  visited: Set<string> = new Set()
): number {
  if (visited.has(distro.id)) return 0;

  const nextVisited = new Set(visited);
  nextVisited.add(distro.id);

  return distro.outputs.reduce<number>((total, output) => {
    const mainOutputWatts: number =
      output.phase === "Socapex"
        ? 0
        : outputWatts(output, plannerState, distro, nextVisited);

    const socapexWatts: number = (output.socaCircuits ?? []).reduce<number>(
      (socketTotal, socket) => socketTotal + outputOwnWatts(socket),
      0
    );

    return total + mainOutputWatts + socapexWatts;
  }, 0);
}

export function childDistroFedFromOutput(
  plannerState: PlannerState,
  parentDistroId: string,
  outputId: string
): ProjectDistro | undefined {
  const sourceId = autoSourceId(parentDistroId, outputId);

  return plannerState.distros.find((distro) => distro.sourceId === sourceId);
}

export function childDistrosForDistro(
  plannerState: PlannerState,
  distro: ProjectDistro
): ProjectDistro[] {
  return distro.outputs
    .map((output) => childDistroFedFromOutput(plannerState, distro.id, output.id))
    .filter((distro): distro is ProjectDistro => Boolean(distro));
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
  parentDistro?: ProjectDistro
): ValidationIssue[] {
  if (output.phase === "Socapex") return [];

  const loads = outputPhaseLoads(output, plannerState, parentDistro);
  const amps = output.phase === "3Φ" ? loads.L1 : phaseLoadTotal(loads);

  if (amps > output.rating) {
    return [
      {
        id: `${output.id}-overload`,
        severity: "critical",
        context,
        message: `${context} is overloaded: ${formatAmps(amps)} / ${formatAmps(
          output.rating
        )}.`,
      },
    ];
  }

  if (amps > output.rating * 0.8) {
    return [
      {
        id: `${output.id}-near-limit`,
        severity: "warning",
        context,
        message: `${context} is above 80% capacity: ${formatAmps(
          amps
        )} / ${formatAmps(output.rating)}.`,
      },
    ];
  }

  return [];
}

export function validateDistro(
  distro: ProjectDistro,
  plannerState?: PlannerState
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  distro.outputs.forEach((output, outputIndex) => {
    const outputContext = `${displayDistroName(distro)} / ${outputDisplayName(
      output,
      outputIndex
    )}`;

    if (output.phase === "Socapex") {
      (output.socaCircuits ?? []).forEach((socket) => {
        issues.push(
          ...validateOutput(socket, `${outputContext} / ${socket.label}`)
        );
      });
      return;
    }

    issues.push(...validateOutput(output, outputContext, plannerState, distro));
  });

  if (isThreePhaseConnection(distro.input)) {
    const loads = distroPhaseLoads(distro, plannerState);
    const imbalance = phaseImbalance(loads);

    if (imbalance >= 50 && maxPhase(loads) > 5) {
      issues.push({
        id: `${distro.id}-phase-imbalance-critical`,
        severity: "critical",
        context: displayDistroName(distro),
        message: `Severe phase imbalance on ${displayDistroName(
          distro
        )}: ${Math.round(imbalance)}%.`,
      });
    } else if (imbalance >= 30 && maxPhase(loads) > 5) {
      issues.push({
        id: `${distro.id}-phase-imbalance-warning`,
        severity: "warning",
        context: displayDistroName(distro),
        message: `Phase imbalance on ${displayDistroName(distro)}: ${Math.round(
          imbalance
        )}%.`,
      });
    }
  }

  return issues;
}

export function validateSource(
  sourceId: string,
  sourceName: string,
  sourceConnection: string,
  sourceRating: number,
  loads: PhaseLoads
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
          amps
        )} / ${formatAmps(sourceRating)}.`,
      });
    } else if (amps > sourceRating * 0.8) {
      issues.push({
        id: `${sourceId}-${phase}-near-limit`,
        severity: "warning",
        context: sourceName,
        message: `${sourceName} ${phase} above 80% capacity: ${formatAmps(
          amps
        )} / ${formatAmps(sourceRating)}.`,
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
        message: `Severe phase imbalance on ${sourceName}: ${Math.round(
          imbalance
        )}%.`,
      });
    } else if (imbalance >= 30 && maxPhase(loads) > 5) {
      issues.push({
        id: `${sourceId}-phase-imbalance-warning`,
        severity: "warning",
        context: sourceName,
        message: `Phase imbalance on ${sourceName}: ${Math.round(imbalance)}%.`,
      });
    }
  }

  return issues;
}

export function distroLoadSummary(
  distro: ProjectDistro,
  plannerState?: PlannerState,
  visited: Set<string> = new Set()
): DistroLoadSummary {
  const nextVisited = new Set(visited);
  nextVisited.add(distro.id);

  const children = plannerState
    ? childDistrosForDistro(plannerState, distro)
        .filter((child) => !visited.has(child.id))
        .map((child) => distroLoadSummary(child, plannerState, nextVisited))
    : [];

  const phaseLoads = distroPhaseLoads(distro, plannerState);

  return {
    distro,
    watts: distroWatts(distro, plannerState),
    amps: phaseLoadTotal(phaseLoads),
    phaseLoads,
    issues: validateDistro(distro, plannerState),
    children,
  };
}

export function flattenDistroIssues(summary: DistroLoadSummary): ValidationIssue[] {
  return [
    ...summary.issues,
    ...summary.children.flatMap((child) => flattenDistroIssues(child)),
  ];
}

export function systemLoadSummary(plannerState: PlannerState): SystemLoadSummary {
  const manualSources = plannerState.sources.filter((source) => !source.auto);

  const sourceSummaries: SourceLoadSummary[] = manualSources.map((source) => {
    const distros = plannerState.distros
      .filter((distro) => distro.sourceId === source.id)
      .map((distro) => distroLoadSummary(distro, plannerState));

    const phaseLoads = distros.reduce<PhaseLoads>(
      (total, distro) => addPhaseLoads(total, distro.phaseLoads),
      createEmptyPhaseLoads()
    );

    const watts = distros.reduce<number>(
      (total, distro) => total + distro.watts,
      0
    );

    const sourceIssues = validateSource(
      source.id,
      source.name,
      source.conn,
      source.rating,
      phaseLoads
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
    .filter((distro) => !distro.sourceId)
    .map((distro) => distroLoadSummary(distro, plannerState));

  const issues = [
    ...sourceSummaries.flatMap((source) => source.issues),
    ...unassignedDistros.flatMap(flattenDistroIssues),
    ...unassignedDistros.map((distro) => ({
      id: `${distro.distro.id}-unassigned`,
      severity: "warning" as const,
      context: displayDistroName(distro.distro),
      message: `${displayDistroName(
        distro.distro
      )} has no assigned power source.`,
    })),
  ];

  const warningCount = issues.filter(
    (issue) => issue.severity === "warning"
  ).length;

  const criticalCount = issues.filter(
    (issue) => issue.severity === "critical"
  ).length;

  return {
    totalDistros: plannerState.distros.length,
    manualPowerSources: manualSources.length,
    connectedWatts: sourceSummaries.reduce<number>(
      (total, source) => total + source.watts,
      0
    ),
    connectedAmps: sourceSummaries.reduce<number>(
      (total, source) => total + source.amps,
      0
    ),
    sourceSummaries,
    unassignedDistros,
    issues,
    warningCount,
    criticalCount,
    health: criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "ok",
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

export function displayDistroName(distro: { instanceName: string; name: string }): string {
  return distro.instanceName.trim()
    ? `${distro.instanceName} - ${distro.name}`
    : distro.name;
}

export function outputDisplayName(output: PlannerOutput, index: number): string {
  if (output.displayName) return output.displayName;
  if (output.phase === "Socapex") return `Soca ${output.outputNumber ?? index + 1}`;
  if (output.phase === "3Φ") return `${index + 1} - ${output.rating}/3`;
  return `${index + 1} - ${output.rating}a`;
}
import type { PlannerOutput, PlannerState, ProjectDistro } from "@/planner/types";

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

export function wattsToAmps(watts: number) {
  return watts / 230;
}

export function createEmptyPhaseLoads(): PhaseLoads {
  return {
    L1: 0,
    L2: 0,
    L3: 0,
  };
}

export function addPhaseLoads(a: PhaseLoads, b: PhaseLoads): PhaseLoads {
  return {
    L1: a.L1 + b.L1,
    L2: a.L2 + b.L2,
    L3: a.L3 + b.L3,
  };
}

export function outputWatts(output: PlannerOutput) {
  return output.items.reduce(
    (total, item) => total + item.watts * item.quantity,
    0
  );
}

export function outputPhaseLoads(output: PlannerOutput): PhaseLoads {
  const watts = outputWatts(output);
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
  return (output.socaCircuits ?? []).reduce(
    (total, socket) => addPhaseLoads(total, outputPhaseLoads(socket)),
    createEmptyPhaseLoads()
  );
}

export function distroPhaseLoads(distro: ProjectDistro): PhaseLoads {
  return distro.outputs.reduce((total, output) => {
    if (output.phase === "Socapex") {
      return addPhaseLoads(total, socapexOutputPhaseLoads(output));
    }

    return addPhaseLoads(total, outputPhaseLoads(output));
  }, createEmptyPhaseLoads());
}

export function distroWatts(distro: ProjectDistro) {
  return distro.outputs.reduce((total, output) => {
    const mainOutputWatts = outputWatts(output);

    const socapexWatts = (output.socaCircuits ?? []).reduce(
      (socketTotal, socket) => socketTotal + outputWatts(socket),
      0
    );

    return total + mainOutputWatts + socapexWatts;
  }, 0);
}

export function phaseLoadTotal(loads: PhaseLoads) {
  return loads.L1 + loads.L2 + loads.L3;
}

export function maxPhase(loads: PhaseLoads) {
  return Math.max(loads.L1, loads.L2, loads.L3);
}

export function minPhase(loads: PhaseLoads) {
  return Math.min(loads.L1, loads.L2, loads.L3);
}

export function phaseImbalance(loads: PhaseLoads) {
  const max = maxPhase(loads);
  const min = minPhase(loads);

  if (max === 0) return 0;

  return ((max - min) / max) * 100;
}

export function validateOutput(
  output: PlannerOutput,
  context: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (output.phase === "Socapex") {
    return issues;
  }

  const amps =
    output.phase === "3Φ" ? outputPhaseLoads(output).L1 : outputWatts(output) / 230;

  if (amps > output.rating) {
    issues.push({
      id: `${output.id}-overload`,
      severity: "critical",
      context,
      message: `${context} is overloaded: ${formatAmps(amps)} / ${formatAmps(output.rating)}.`,
    });
  } else if (amps > output.rating * 0.8) {
    issues.push({
      id: `${output.id}-near-limit`,
      severity: "warning",
      context,
      message: `${context} is above 80% capacity: ${formatAmps(amps)} / ${formatAmps(output.rating)}.`,
    });
  }

  return issues;
}

export function validateDistro(distro: ProjectDistro): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  distro.outputs.forEach((output, outputIndex) => {
    const outputContext = `${displayDistroName(distro)} / ${outputDisplayName(
      output,
      outputIndex
    )}`;

    if (output.phase === "Socapex") {
      (output.socaCircuits ?? []).forEach((socket) => {
        issues.push(...validateOutput(socket, `${outputContext} / ${socket.label}`));
      });
      return;
    }

    issues.push(...validateOutput(output, outputContext));
  });

  const loads = distroPhaseLoads(distro);
  const imbalance = phaseImbalance(loads);

  if (imbalance >= 50 && maxPhase(loads) > 5) {
    issues.push({
      id: `${distro.id}-phase-imbalance-critical`,
      severity: "critical",
      context: displayDistroName(distro),
      message: `Severe phase imbalance on ${displayDistroName(distro)}: ${Math.round(
        imbalance
      )}%.`,
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

  return issues;
}

export function validateSource(
  sourceId: string,
  sourceName: string,
  sourceRating: number,
  loads: PhaseLoads
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  (["L1", "L2", "L3"] as const).forEach((phase) => {
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

  return issues;
}

export function distroLoadSummary(distro: ProjectDistro): DistroLoadSummary {
  const phaseLoads = distroPhaseLoads(distro);

  return {
    distro,
    watts: distroWatts(distro),
    amps: phaseLoadTotal(phaseLoads),
    phaseLoads,
    issues: validateDistro(distro),
  };
}

export function systemLoadSummary(
  plannerState: PlannerState
): SystemLoadSummary {
  const sourceSummaries: SourceLoadSummary[] = plannerState.sources.map(
    (source) => {
      const distros = plannerState.distros
        .filter((distro) => distro.sourceId === source.id)
        .map(distroLoadSummary);

      const phaseLoads = distros.reduce(
        (total, distro) => addPhaseLoads(total, distro.phaseLoads),
        createEmptyPhaseLoads()
      );

      const watts = distros.reduce((total, distro) => total + distro.watts, 0);

      const sourceIssues = validateSource(
        source.id,
        source.name,
        source.rating,
        phaseLoads
      );

      const distroIssues = distros.flatMap((distro) => distro.issues);

      return {
        sourceId: source.id,
        sourceName: source.name,
        sourceConnection: source.conn,
        sourceRating: source.rating,
        watts,
        amps: phaseLoadTotal(phaseLoads),
        phaseLoads,
        distros,
        issues: [...sourceIssues, ...distroIssues],
      };
    }
  );

  const unassignedDistros = plannerState.distros
    .filter((distro) => !distro.sourceId)
    .map(distroLoadSummary);

  const connectedWatts = sourceSummaries.reduce(
    (total, source) => total + source.watts,
    0
  );

  const connectedAmps = sourceSummaries.reduce(
    (total, source) => total + source.amps,
    0
  );

  const issues = [
    ...sourceSummaries.flatMap((source) => source.issues),
    ...unassignedDistros.flatMap((distro) => distro.issues),
    ...unassignedDistros.map((distro) => ({
      id: `${distro.distro.id}-unassigned`,
      severity: "warning" as const,
      context: displayDistroName(distro.distro),
      message: `${displayDistroName(distro.distro)} has no assigned power source.`,
    })),
  ];

  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;

  return {
    totalDistros: plannerState.distros.length,
    manualPowerSources: plannerState.sources.length,
    connectedWatts,
    connectedAmps,
    sourceSummaries,
    unassignedDistros,
    issues,
    warningCount,
    criticalCount,
    health: criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "ok",
  };
}

export function formatWatts(value: number) {
  return `${Math.round(value).toLocaleString()} W`;
}

export function formatAmps(value: number) {
  return `${value.toFixed(1)} A`;
}

export function phasePercentage(amps: number, rating: number) {
  if (!rating) return 0;
  return Math.round((amps / rating) * 100);
}

export function displayDistroName(distro: { instanceName: string; name: string }) {
  return distro.instanceName.trim()
    ? `${distro.instanceName} - ${distro.name}`
    : distro.name;
}

export function outputDisplayName(output: PlannerOutput, index: number) {
  if (output.displayName) return output.displayName;
  if (output.phase === "Socapex") return `Soca ${output.outputNumber ?? index + 1}`;
  if (output.phase === "3Φ") return `${index + 1} - ${output.rating}/3`;
  return `${index + 1} - ${output.rating}a`;
}
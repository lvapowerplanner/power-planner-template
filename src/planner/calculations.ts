import type { PlannerOutput, PlannerState, ProjectDistro } from "@/planner/types";

export type PhaseLoads = {
  L1: number;
  L2: number;
  L3: number;
};

export type DistroLoadSummary = {
  distro: ProjectDistro;
  watts: number;
  amps: number;
  phaseLoads: PhaseLoads;
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
};

export type SystemLoadSummary = {
  totalDistros: number;
  manualPowerSources: number;
  connectedWatts: number;
  connectedAmps: number;
  sourceSummaries: SourceLoadSummary[];
  unassignedDistros: DistroLoadSummary[];
};

const EMPTY_PHASE_LOADS: PhaseLoads = {
  L1: 0,
  L2: 0,
  L3: 0,
};

export function wattsToAmps(watts: number) {
  return watts / 230;
}

export function createEmptyPhaseLoads(): PhaseLoads {
  return { ...EMPTY_PHASE_LOADS };
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

  if (output.phase === "L1") {
    return { L1: amps, L2: 0, L3: 0 };
  }

  if (output.phase === "L2") {
    return { L1: 0, L2: amps, L3: 0 };
  }

  if (output.phase === "L3") {
    return { L1: 0, L2: 0, L3: amps };
  }

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

export function distroLoadSummary(distro: ProjectDistro): DistroLoadSummary {
  const phaseLoads = distroPhaseLoads(distro);

  return {
    distro,
    watts: distroWatts(distro),
    amps: phaseLoadTotal(phaseLoads),
    phaseLoads,
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

      return {
        sourceId: source.id,
        sourceName: source.name,
        sourceConnection: source.conn,
        sourceRating: source.rating,
        watts,
        amps: phaseLoadTotal(phaseLoads),
        phaseLoads,
        distros,
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

  return {
    totalDistros: plannerState.distros.length,
    manualPowerSources: plannerState.sources.length,
    connectedWatts,
    connectedAmps,
    sourceSummaries,
    unassignedDistros,
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
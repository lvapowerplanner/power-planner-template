import type { PlannerOutput, PlannerState, PowerSource, ProjectDistro } from "@/planner/types";

export function autoSourceId(parentDistroId: string, outputId: string): string {
  return `auto_${parentDistroId}_${outputId}`;
}

export function isEligibleAutoSourceOutput(output: PlannerOutput): boolean {
  if (output.phase === "Socapex") return false;

  return output.rating >= 32;
}

export function outputSourceConnection(output: PlannerOutput): string {
  if (output.phase === "3Φ") {
    return `${output.rating}A / 3`;
  }

  return `${output.rating}A / 1`;
}

export function outputSourceName(
  distro: ProjectDistro,
  output: PlannerOutput,
  index: number
): string {
  const distroName = distro.instanceName.trim()
    ? `${distro.instanceName} - ${distro.name}`
    : distro.name;

  const outputName =
    output.displayName ??
    (output.phase === "3Φ"
      ? `Output ${index + 1} – ${output.rating}/3`
      : `Output ${index + 1} – ${output.rating}/1`);

  return `${distroName} → ${outputName}`;
}

export function effectiveDistroSupplyCap(
  plannerState: PlannerState,
  distro: ProjectDistro,
  visitedDistroIds: Set<string> = new Set(),
): { rating: number; capped: boolean; sourceName: string } {
  const ownRating = Math.max(0, Number(distro.inputA) || 0);

  if (!distro.sourceId || visitedDistroIds.has(distro.id)) {
    return { rating: ownRating, capped: false, sourceName: "" };
  }

  const nextVisited = new Set(visitedDistroIds);
  nextVisited.add(distro.id);

  const manualSource = plannerState.sources.find(
    (source) => !source.auto && source.id === distro.sourceId,
  );

  if (manualSource) {
    const rating = Math.min(ownRating, Math.max(0, manualSource.rating || 0));
    return {
      rating,
      capped: rating < ownRating,
      sourceName: manualSource.name,
    };
  }

  for (const parentDistro of plannerState.distros) {
    const parentOutput = parentDistro.outputs.find(
      (output) => autoSourceId(parentDistro.id, output.id) === distro.sourceId,
    );

    if (!parentOutput) continue;

    const parentCap = effectiveDistroSupplyCap(
      plannerState,
      parentDistro,
      nextVisited,
    ).rating;
    const rating = Math.min(
      ownRating,
      Math.max(0, parentOutput.rating || 0),
      parentCap,
    );

    return {
      rating,
      capped: rating < ownRating,
      sourceName: outputSourceName(
        parentDistro,
        parentOutput,
        parentDistro.outputs.indexOf(parentOutput),
      ),
    };
  }

  return { rating: ownRating, capped: false, sourceName: "" };
}

export function autoSourcesForDistro(
  distro: ProjectDistro,
  plannerState?: PlannerState,
): PowerSource[] {
  const upstreamCap = plannerState
    ? effectiveDistroSupplyCap(plannerState, distro).rating
    : undefined;

  return distro.outputs
    .map((output, index) => ({ output, index }))
    .filter(({ output }) => isEligibleAutoSourceOutput(output))
    .map(({ output, index }) => ({
      id: autoSourceId(distro.id, output.id),
      name: outputSourceName(distro, output, index),
      conn: outputSourceConnection(output),
      rating:
        upstreamCap == null
          ? output.rating
          : Math.min(output.rating, upstreamCap),
      notes: "Auto-created from distro output.",
      auto: true,
      parentDistroId: distro.id,
      parentOutputId: output.id,
      phaseType: output.phase === "3Φ" ? "Three-Phase" : "Single-Phase",
    }));
}

export function ensureAutoSources(plannerState: PlannerState): PlannerState {
  const manualSources = plannerState.sources.filter((source) => !source.auto);
  const stateWithManualSources = { ...plannerState, sources: manualSources };
  const autoSources = plannerState.distros.flatMap((distro) =>
    autoSourcesForDistro(distro, stateWithManualSources),
  );

  return {
    ...plannerState,
    sources: [...manualSources, ...autoSources],
  };
}

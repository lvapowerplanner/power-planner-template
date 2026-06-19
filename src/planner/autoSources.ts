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

export function autoSourcesForDistro(distro: ProjectDistro): PowerSource[] {
  return distro.outputs
    .map((output, index) => ({ output, index }))
    .filter(({ output }) => isEligibleAutoSourceOutput(output))
    .map(({ output, index }) => ({
      id: autoSourceId(distro.id, output.id),
      name: outputSourceName(distro, output, index),
      conn: outputSourceConnection(output),
      rating: output.rating,
      notes: "Auto-created from distro output.",
      auto: true,
      parentDistroId: distro.id,
      parentOutputId: output.id,
      phaseType: output.phase === "3Φ" ? "Three-Phase" : "Single-Phase",
    }));
}

export function ensureAutoSources(plannerState: PlannerState): PlannerState {
  const manualSources = plannerState.sources.filter((source) => !source.auto);
  const autoSources = plannerState.distros.flatMap(autoSourcesForDistro);

  return {
    ...plannerState,
    sources: [...manualSources, ...autoSources],
  };
}
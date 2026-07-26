import type {
  CableDataSnapshot,
  ProjectCableLibraryItem,
} from "@/planner/types";

export type GlobalCableLibraryRecord = {
  cable_rating_id: string;
  cable_type_id?: string;
  library_code?: string;
  cable_type_name?: string;
  manufacturer?: string | null;
  product_range?: string | null;
  designation?: string;
  standard_reference?: string | null;
  rating_code: string;
  display_name: string;
  application: "single_phase_ac" | "three_phase_ac" | "dc";
  core_configuration: string;
  conductor_size_mm2: number;
  cable_arrangement: string;
  installation_method: string;
  current_capacity_a: number;
  voltage_drop_mv_per_a_m: number;
  resistance_mv_per_a_m?: number | null;
  reactance_mv_per_a_m?: number | null;
  source_name: string;
  source_revision: string;
  source_notes?: string | null;
  data_status: "reference" | "verified" | "superseded";
};

export function snapshotFromGlobalCable(
  record: GlobalCableLibraryRecord,
): CableDataSnapshot {
  return {
    cableName: record.display_name,
    ratingCode: record.rating_code,
    application: record.application,
    coreConfiguration: record.core_configuration,
    conductorSizeMm2: Number(record.conductor_size_mm2),
    cableArrangement: record.cable_arrangement,
    installationMethod: record.installation_method,
    currentCapacityA: Number(record.current_capacity_a),
    voltageDropMvPerAmpMetre: Number(record.voltage_drop_mv_per_a_m),
    resistanceMvPerAmpMetre:
      record.resistance_mv_per_a_m == null
        ? undefined
        : Number(record.resistance_mv_per_a_m),
    reactanceMvPerAmpMetre:
      record.reactance_mv_per_a_m == null
        ? undefined
        : Number(record.reactance_mv_per_a_m),
    sourceName: record.source_name,
    sourceRevision: record.source_revision,
    dataStatus: record.data_status,
  };
}

export function snapshotFromProjectCable(
  item: ProjectCableLibraryItem,
): CableDataSnapshot {
  return {
    cableName: item.name,
    ratingCode: `PROJECT-${item.id}`,
    application: item.application,
    coreConfiguration: item.coreConfiguration,
    conductorSizeMm2: item.conductorSizeMm2,
    cableArrangement: item.cableArrangement,
    installationMethod: item.installationMethod,
    currentCapacityA: item.currentCapacityA,
    voltageDropMvPerAmpMetre: item.voltageDropMvPerAmpMetre,
    resistanceMvPerAmpMetre: item.resistanceMvPerAmpMetre,
    reactanceMvPerAmpMetre: item.reactanceMvPerAmpMetre,
    sourceName: item.sourceName?.trim() || "Project cable library",
    sourceRevision: item.sourceRevision?.trim() || "Project custom data",
    dataStatus: "reference",
  };
}

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
  source_url?: string | null;
  source_revision: string;
  source_notes?: string | null;
  data_status: "reference" | "verified" | "superseded";
  suitability_class?: "reference" | "conditional" | "not_recommended";
  suitability_notes?: string | null;
  mechanical_duty?: "heavy" | "medium" | "light" | "unknown";
  indoor_suitable?: boolean | null;
  outdoor_suitable?: boolean | null;
  uv_resistant?: boolean | null;
  water_resistance?: string | null;
  oil_resistance?: string | null;
  minimum_fixed_temperature_c?: number | null;
  maximum_fixed_temperature_c?: number | null;
  minimum_flexed_temperature_c?: number | null;
  maximum_flexed_temperature_c?: number | null;
  loaded_conductors?: number | null;
  neutral_included?: boolean | null;
  cpc_included?: boolean | null;
  voltage_drop_basis?: string | null;
  source_checked_on?: string | null;
  workspace_override_applied?: boolean;
  workspace_override_id?: string;
  workspace_override_updated_at?: string;
  workspace_override_reason?: string;
  standard_current_capacity_a?: number;
  standard_voltage_drop_mv_per_a_m?: number;
  standard_source_name?: string;
  standard_source_url?: string;
  standard_source_revision?: string;
};

export type WorkspaceCableOverride = {
  id: string;
  workspace_id: string;
  cable_rating_id: string;
  stock_name?: string | null;
  current_capacity_a?: number | null;
  voltage_drop_mv_per_a_m?: number | null;
  installation_method?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  source_revision?: string | null;
  override_reason?: string | null;
  active: boolean;
  updated_at: string;
};

export function applyWorkspaceCableOverrides(
  records: GlobalCableLibraryRecord[],
  overrides: WorkspaceCableOverride[],
): GlobalCableLibraryRecord[] {
  const byRatingId = new Map(
    overrides
      .filter((override) => override.active)
      .map((override) => [override.cable_rating_id, override]),
  );

  return records.map((record) => {
    const override = byRatingId.get(record.cable_rating_id);
    if (!override) return record;

    return {
      ...record,
      display_name: override.stock_name?.trim() || record.display_name,
      current_capacity_a:
        override.current_capacity_a == null
          ? record.current_capacity_a
          : Number(override.current_capacity_a),
      voltage_drop_mv_per_a_m:
        override.voltage_drop_mv_per_a_m == null
          ? record.voltage_drop_mv_per_a_m
          : Number(override.voltage_drop_mv_per_a_m),
      installation_method:
        override.installation_method?.trim() || record.installation_method,
      source_name: override.source_name?.trim() || record.source_name,
      source_url: override.source_url?.trim() || record.source_url,
      source_revision:
        override.source_revision?.trim() || record.source_revision,
      workspace_override_applied: true,
      workspace_override_id: override.id,
      workspace_override_updated_at: override.updated_at,
      workspace_override_reason: override.override_reason ?? undefined,
      standard_current_capacity_a: Number(record.current_capacity_a),
      standard_voltage_drop_mv_per_a_m: Number(
        record.voltage_drop_mv_per_a_m,
      ),
      standard_source_name: record.source_name,
      standard_source_url: record.source_url ?? undefined,
      standard_source_revision: record.source_revision,
    };
  });
}

export function snapshotFromGlobalCable(
  record: GlobalCableLibraryRecord,
): CableDataSnapshot {
  const conductorSize = `${Number(record.conductor_size_mm2)} mm²`;
  const cableName = record.display_name
    .toLowerCase()
    .includes(conductorSize.toLowerCase())
    ? record.display_name
    : `${record.display_name} · ${conductorSize}`;

  return {
    cableName,
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
    suitabilityClass: record.suitability_class,
    suitabilityNotes: record.suitability_notes ?? undefined,
    mechanicalDuty: record.mechanical_duty,
    indoorSuitable: record.indoor_suitable ?? undefined,
    outdoorSuitable: record.outdoor_suitable ?? undefined,
    uvResistant: record.uv_resistant ?? undefined,
    waterResistance: record.water_resistance ?? undefined,
    oilResistance: record.oil_resistance ?? undefined,
    minimumFixedTemperatureC:
      record.minimum_fixed_temperature_c == null
        ? undefined
        : Number(record.minimum_fixed_temperature_c),
    maximumFixedTemperatureC:
      record.maximum_fixed_temperature_c == null
        ? undefined
        : Number(record.maximum_fixed_temperature_c),
    minimumFlexedTemperatureC:
      record.minimum_flexed_temperature_c == null
        ? undefined
        : Number(record.minimum_flexed_temperature_c),
    maximumFlexedTemperatureC:
      record.maximum_flexed_temperature_c == null
        ? undefined
        : Number(record.maximum_flexed_temperature_c),
    loadedConductors:
      record.loaded_conductors == null
        ? undefined
        : Number(record.loaded_conductors),
    neutralIncluded: record.neutral_included ?? undefined,
    cpcIncluded: record.cpc_included ?? undefined,
    voltageDropBasis: record.voltage_drop_basis ?? undefined,
    sourceCheckedOn: record.source_checked_on ?? undefined,
    workspaceOverrideApplied: record.workspace_override_applied,
    workspaceOverrideId: record.workspace_override_id,
    workspaceOverrideUpdatedAt: record.workspace_override_updated_at,
    workspaceOverrideReason: record.workspace_override_reason,
    standardCurrentCapacityA: record.standard_current_capacity_a,
    standardVoltageDropMvPerAmpMetre:
      record.standard_voltage_drop_mv_per_a_m,
    standardSourceName: record.standard_source_name,
    standardSourceRevision: record.standard_source_revision,
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

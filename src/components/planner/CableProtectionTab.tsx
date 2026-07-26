import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  applyWorkspaceCableOverrides,
  snapshotFromGlobalCable,
  snapshotFromProjectCable,
} from "@/planner/cableLibrary";
import type {
  GlobalCableLibraryRecord,
  WorkspaceCableOverride,
} from "@/planner/cableLibrary";
import {
  calculateAdvancedCircuit,
  calculateCableDesign,
  cableVerificationFingerprint,
  displayDistroName,
  outputDisplayName,
  outputWatts,
} from "@/planner/calculations";
import type { CableCalculationResult } from "@/planner/calculations";
import type {
  CableDataSnapshot,
  CircuitCableDesign,
  PlannerOutput,
  PlannerState,
  ProjectDistro,
} from "@/planner/types";

type CableProtectionTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  workspaceId?: string | null;
};

type CableCircuitRow = {
  key: string;
  distro: ProjectDistro;
  output: PlannerOutput;
  parentOutput?: PlannerOutput;
  label: string;
  connectedWatts: number;
};

function settingsFor(plannerState: PlannerState) {
  return {
    calculationMethod:
      plannerState.advancedElectrical?.calculationMethod ?? "real-power",
    defaultPowerFactor:
      plannerState.advancedElectrical?.defaultPowerFactor ?? 1,
    nominalSinglePhaseVoltage:
      plannerState.advancedElectrical?.nominalSinglePhaseVoltage ?? 230,
    nominalThreePhaseVoltage:
      plannerState.advancedElectrical?.nominalThreePhaseVoltage ?? 400,
  } as const;
}

function rowsForState(plannerState: PlannerState): CableCircuitRow[] {
  return plannerState.distros.flatMap((distro) =>
    distro.outputs.flatMap<CableCircuitRow>((output, outputIndex) => {
      if (output.phase === "Socapex") {
        return (output.socaCircuits ?? []).map((socket) => ({
          key: `${distro.id}:${output.id}:${socket.id}`,
          distro,
          output: socket,
          parentOutput: output,
          label: `${outputDisplayName(output, outputIndex)} / ${socket.label}`,
          connectedWatts: outputWatts(socket),
        }));
      }

      return [
        {
          key: `${distro.id}:${output.id}`,
          distro,
          output,
          label: outputDisplayName(output, outputIndex),
          connectedWatts: outputWatts(output, plannerState, distro),
        },
      ];
    }),
  );
}

function applicationForOutput(output: PlannerOutput) {
  return output.phase === "3Φ" ? "three_phase_ac" : "single_phase_ac";
}

function defaultCableDesign(
  snapshot: CableDataSnapshot,
  dataSource: "library" | "project-library" | "custom",
  cableRatingId?: string,
): CircuitCableDesign {
  return {
    dataSource,
    cableRatingId,
    snapshot,
    lengthMetres: 0,
    parallelRuns: 1,
    deratingFactor: 1,
    voltageDropLimitPercent: 5,
    voltageDropCategory: "other",
    notes: "",
    designerVerified: false,
  };
}

function customSnapshot(output: PlannerOutput): CableDataSnapshot {
  return {
    cableName: "Custom cable",
    application: applicationForOutput(output),
    coreConfiguration: "User supplied",
    conductorSizeMm2: 1,
    cableArrangement: "User supplied",
    installationMethod: "User supplied",
    currentCapacityA: Math.max(1, output.rating),
    voltageDropMvPerAmpMetre: 1,
    sourceName: "User supplied",
    sourceRevision: "Project custom data",
    dataStatus: "reference",
  };
}

function formatNumber(value: number, decimals = 2) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "-";
}

export function CableProtectionTab({
  plannerState,
  setPlannerState,
  workspaceId,
}: CableProtectionTabProps) {
  const [library, setLibrary] = useState<GlobalCableLibraryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedDistroId, setSelectedDistroId] = useState("all");
  const [floatingScrollbar, setFloatingScrollbar] = useState({
    visible: false,
    left: 0,
    width: 0,
    contentWidth: 2200,
  });
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const floatingScrollRef = useRef<HTMLDivElement | null>(null);
  const settings = settingsFor(plannerState);
  const allRows = useMemo(() => rowsForState(plannerState), [plannerState]);
  const visibleRows = allRows.filter(
    (row) =>
      row.connectedWatts > 0 &&
      (selectedDistroId === "all" || row.distro.id === selectedDistroId),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      setLoading(true);
      setLoadError("");

      const [libraryResult, overrideResult] = await Promise.all([
        supabase
          .from("planner_cable_library")
          .select("*")
          .order("application")
          .order("conductor_size_mm2"),
        workspaceId
          ? supabase
              .from("planner_workspace_cable_overrides")
              .select("*")
              .eq("workspace_id", workspaceId)
              .eq("active", true)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      if (libraryResult.error) {
        setLibrary([]);
        setLoadError(libraryResult.error.message);
      } else if (overrideResult.error) {
        setLibrary([]);
        setLoadError(overrideResult.error.message);
      } else {
        setLibrary(
          applyWorkspaceCableOverrides(
            (libraryResult.data ?? []) as GlobalCableLibraryRecord[],
            (overrideResult.data ?? []) as WorkspaceCableOverride[],
          ),
        );
      }

      setLoading(false);
    }

    loadLibrary();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    function updateFloatingScrollbar() {
      const tableScroll = tableScrollRef.current;
      if (!tableScroll) return;

      const bounds = tableScroll.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const visible =
        bounds.top < viewportHeight &&
        bounds.bottom > viewportHeight &&
        tableScroll.scrollWidth > tableScroll.clientWidth;

      setFloatingScrollbar({
        visible,
        left: Math.max(0, bounds.left),
        width: Math.max(0, Math.min(bounds.right, window.innerWidth) - Math.max(0, bounds.left)),
        contentWidth: tableScroll.scrollWidth,
      });
    }

    updateFloatingScrollbar();
    window.addEventListener("scroll", updateFloatingScrollbar, {
      passive: true,
    });
    window.addEventListener("resize", updateFloatingScrollbar);
    const observer = new ResizeObserver(updateFloatingScrollbar);
    if (tableScrollRef.current) observer.observe(tableScrollRef.current);

    return () => {
      window.removeEventListener("scroll", updateFloatingScrollbar);
      window.removeEventListener("resize", updateFloatingScrollbar);
      observer.disconnect();
    };
  }, [visibleRows.length]);

  function syncHorizontalScroll(
    source: HTMLDivElement,
    target: HTMLDivElement | null,
  ) {
    if (target && target.scrollLeft !== source.scrollLeft) {
      target.scrollLeft = source.scrollLeft;
    }
  }

  function replaceOutput(row: CableCircuitRow, updated: PlannerOutput) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) => {
        if (distro.id !== row.distro.id) return distro;

        return {
          ...distro,
          outputs: distro.outputs.map((output) => {
            if (!row.parentOutput) {
              return output.id === updated.id ? updated : output;
            }

            if (output.id !== row.parentOutput.id) return output;

            return {
              ...output,
              socaCircuits: (output.socaCircuits ?? []).map((socket) =>
                socket.id === updated.id ? updated : socket,
              ),
            };
          }),
        };
      }),
    });
  }

  function updateDesign(
    row: CableCircuitRow,
    updater: (current: CircuitCableDesign | undefined) =>
      | CircuitCableDesign
      | undefined,
  ) {
    replaceOutput(row, {
      ...row.output,
      cableDesign: updater(row.output.cableDesign),
    });
  }

  function selectCable(row: CableCircuitRow, selection: string) {
    if (selection === "") {
      updateDesign(row, () => undefined);
      return;
    }

    if (selection === "custom") {
      updateDesign(row, (current) => {
        const next = defaultCableDesign(
          customSnapshot(row.output),
          "custom",
        );
        return current
          ? {
              ...next,
              lengthMetres: current.lengthMetres,
              parallelRuns: current.parallelRuns,
              deratingFactor: current.deratingFactor,
              voltageDropLimitPercent: current.voltageDropLimitPercent,
              voltageDropCategory: current.voltageDropCategory,
              notes: current.notes,
            }
          : next;
      });
      return;
    }

    const projectRecord = (plannerState.projectCableLibrary ?? []).find(
      (candidate) => candidate.id === selection,
    );
    if (projectRecord) {
      updateDesign(row, (current) => {
        const next = defaultCableDesign(
          snapshotFromProjectCable(projectRecord),
          "project-library",
          projectRecord.id,
        );
        return current
          ? {
              ...next,
              lengthMetres: current.lengthMetres,
              parallelRuns: current.parallelRuns,
              deratingFactor: current.deratingFactor,
              voltageDropLimitPercent: current.voltageDropLimitPercent,
              voltageDropCategory: current.voltageDropCategory,
              notes: current.notes,
            }
          : next;
      });
      return;
    }

    const record = library.find(
      (candidate) => candidate.cable_rating_id === selection,
    );
    if (!record) return;

    updateDesign(row, (current) => {
      const next = defaultCableDesign(
        snapshotFromGlobalCable(record),
        "library",
        record.cable_rating_id,
      );
      return current
        ? {
            ...next,
            lengthMetres: current.lengthMetres,
            parallelRuns: current.parallelRuns,
            deratingFactor: current.deratingFactor,
            voltageDropLimitPercent: current.voltageDropLimitPercent,
            voltageDropCategory: current.voltageDropCategory,
            notes: current.notes,
          }
        : next;
    });
  }

  function designCurrent(row: CableCircuitRow) {
    return calculateAdvancedCircuit({
      connectedWatts: row.connectedWatts,
      phase: row.output.phase,
      diversityPercent: row.output.diversityPercent,
      calculationMethod: settings.calculationMethod,
      projectPowerFactor: settings.defaultPowerFactor,
      powerFactorOverride: row.output.powerFactorOverride,
      nominalSinglePhaseVoltage: settings.nominalSinglePhaseVoltage,
      nominalThreePhaseVoltage: settings.nominalThreePhaseVoltage,
    }).currentAmps;
  }

  function upstreamRow(row: CableCircuitRow) {
    const source = plannerState.sources.find(
      (candidate) => candidate.id === row.distro.sourceId,
    );
    if (!source?.parentDistroId || !source.parentOutputId) return undefined;

    return allRows.find(
      (candidate) =>
        candidate.distro.id === source.parentDistroId &&
        candidate.output.id === source.parentOutputId &&
        !candidate.parentOutput,
    );
  }

  function nominalVoltage(row: CableCircuitRow) {
    return row.output.phase === "3Φ"
      ? settings.nominalThreePhaseVoltage
      : settings.nominalSinglePhaseVoltage;
  }

  function resultForRow(
    row: CableCircuitRow,
    visited = new Set<string>(),
  ): CableCalculationResult | null {
    if (visited.has(row.key)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(row.key);
    const parent = upstreamRow(row);
    const parentResult = parent
      ? resultForRow(parent, nextVisited)
      : null;

    return calculateCableDesign({
      cableDesign: row.output.cableDesign,
      designCurrentA: designCurrent(row),
      nominalVoltageV: nominalVoltage(row),
      upstreamVoltageDropV: parentResult?.cumulativeVoltageDropV ?? 0,
    });
  }

  function updateCableField(
    row: CableCircuitRow,
    patch: Partial<CircuitCableDesign>,
  ) {
    const resetsVerification = Object.keys(patch).some(
      (field) => field !== "notes",
    );

    updateDesign(row, (current) =>
      current
        ? {
            ...current,
            ...patch,
            ...(resetsVerification
              ? {
                  designerVerified: false,
                  designerVerifiedAt: undefined,
                  designerVerifiedBy: undefined,
                  designerVerificationFingerprint: undefined,
                }
              : {}),
          }
        : current,
    );
  }

  function updateSnapshot(
    row: CableCircuitRow,
    patch: Partial<CableDataSnapshot>,
  ) {
    updateDesign(row, (current) =>
      current
        ? {
            ...current,
            snapshot: { ...current.snapshot, ...patch },
            designerVerified: false,
            designerVerifiedAt: undefined,
            designerVerifiedBy: undefined,
            designerVerificationFingerprint: undefined,
          }
        : current,
    );
  }

  async function setDesignerVerification(
    row: CableCircuitRow,
    verified: boolean,
  ) {
    if (!verified) {
      updateDesign(row, (current) =>
        current
          ? {
              ...current,
              designerVerified: false,
              designerVerifiedAt: undefined,
              designerVerifiedBy: undefined,
              designerVerificationFingerprint: undefined,
            }
          : current,
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    updateDesign(row, (current) => {
      if (!current) return current;

      return {
        ...current,
        designerVerified: true,
        designerVerifiedAt: new Date().toISOString(),
        designerVerifiedBy:
          user?.email ?? user?.id ?? "Authenticated designer",
        designerVerificationFingerprint: cableVerificationFingerprint(
          current,
          designCurrent(row),
        ),
      };
    });
  }

  return (
    <section style={styles.page}>
      <div style={styles.intro}>
        <div>
          <h3 style={styles.title}>Cable & Protection</h3>
          <p style={styles.muted}>
            Cable sizing and voltage-drop design. Protective-device assessment
            will be added in the next release.
          </p>
        </div>
        <label style={styles.filter}>
          Distro
          <select
            style={styles.input}
            value={selectedDistroId}
            onChange={(event) => setSelectedDistroId(event.target.value)}
          >
            <option value="all">All distros</option>
            {plannerState.distros.map((distro) => (
              <option key={distro.id} value={distro.id}>
                {displayDistroName(distro)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <div style={styles.notice}>Loading global cable library…</div>}
      {loadError && (
        <div style={styles.errorNotice}>
          Could not load the global cable library: {loadError}
        </div>
      )}

      <div
        ref={tableScrollRef}
        style={styles.tableWrap}
        onScroll={(event) =>
          syncHorizontalScroll(
            event.currentTarget,
            floatingScrollRef.current,
          )
        }
      >
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Circuit</th>
              <th style={styles.th}>Phase</th>
              <th style={styles.numberTh}>Design current</th>
              <th style={styles.th}>Cable</th>
              <th style={styles.th}>Custom data</th>
              <th style={styles.th}>Length</th>
              <th style={styles.th}>Parallel runs</th>
              <th style={styles.th}>Derating</th>
              <th style={styles.numberTh}>Adjusted capacity</th>
              <th style={styles.numberTh}>Utilisation</th>
              <th style={styles.numberTh}>Section drop</th>
              <th style={styles.numberTh}>Cumulative drop</th>
              <th style={styles.numberTh}>End voltage</th>
              <th style={styles.th}>Limit</th>
              <th style={styles.th}>Designer check</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const design = row.output.cableDesign;
              const result = resultForRow(row);
              const verificationValid = Boolean(
                design?.designerVerified &&
                  design.designerVerificationFingerprint ===
                    cableVerificationFingerprint(
                      design,
                      designCurrent(row),
                    ),
              );
              const compatibleLibrary = library.filter(
                (record) =>
                  record.application === applicationForOutput(row.output) &&
                  (!(plannerState.excludedCableRatingIds ?? []).includes(
                    record.cable_rating_id,
                  ) || design?.cableRatingId === record.cable_rating_id),
              );
              const compatibleProjectLibrary = (
                plannerState.projectCableLibrary ?? []
              ).filter(
                (record) =>
                  record.application === applicationForOutput(row.output) &&
                  (!(plannerState.excludedCableRatingIds ?? []).includes(
                    record.id,
                  ) || design?.cableRatingId === record.id),
              );
              const selectedRecordAvailable = Boolean(
                !design?.cableRatingId ||
                  compatibleLibrary.some(
                    (record) =>
                      record.cable_rating_id === design.cableRatingId,
                  ) ||
                  compatibleProjectLibrary.some(
                    (record) => record.id === design.cableRatingId,
                  ),
              );

              return (
                <tr key={row.key}>
                  <td style={styles.circuitTd}>
                    <strong>{displayDistroName(row.distro)}</strong>
                    <span>{row.label}</span>
                  </td>
                  <td style={styles.td}>{row.output.phase}</td>
                  <td style={styles.numberTd}>
                    {formatNumber(designCurrent(row))} A
                  </td>
                  <td style={styles.td}>
                    <select
                      style={styles.cableSelect}
                      value={
                        design?.dataSource === "custom"
                          ? "custom"
                          : design?.cableRatingId ?? ""
                      }
                      onChange={(event) =>
                        selectCable(row, event.target.value)
                      }
                    >
                      <option value="">Select cable</option>
                      {!selectedRecordAvailable && design?.cableRatingId && (
                        <option value={design.cableRatingId}>
                          {design.snapshot.cableName} (saved snapshot)
                        </option>
                      )}
                      {compatibleLibrary.length > 0 && (
                        <optgroup label="Standard library">
                          {compatibleLibrary.map((record) => (
                            <option
                              key={record.cable_rating_id}
                              value={record.cable_rating_id}
                            >
                              {record.display_name}
                              {record.suitability_class === "conditional"
                                ? " — Conditional"
                                : record.suitability_class === "not_recommended"
                                  ? " — Not recommended"
                                  : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {compatibleProjectLibrary.length > 0 && (
                        <optgroup label="Project cable library">
                          {compatibleProjectLibrary.map((record) => (
                            <option key={record.id} value={record.id}>
                              {record.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="custom">Custom cable data</option>
                    </select>
                    {design && (
                      <>
                        <small style={styles.sourceText}>
                          {design.dataSource === "project-library"
                            ? "Project custom · "
                            : design.snapshot.workspaceOverrideApplied
                              ? "Workspace override · "
                              : "Standard library · "}
                          {design.snapshot.sourceName} ·{" "}
                          {design.snapshot.sourceRevision}
                        </small>
                        {design.snapshot.suitabilityClass === "conditional" && (
                          <small
                            style={styles.conditionalNotice}
                            title={design.snapshot.suitabilityNotes}
                          >
                            Conditional suitability — review restrictions
                          </small>
                        )}
                        {design.snapshot.suitabilityClass ===
                          "not_recommended" && (
                          <small
                            style={styles.notRecommendedNotice}
                            title={design.snapshot.suitabilityNotes}
                          >
                            Not recommended for general temporary distribution
                          </small>
                        )}
                      </>
                    )}
                  </td>
                  <td style={styles.td}>
                    {design?.dataSource === "custom" ? (
                      <div style={styles.customGrid}>
                        <input
                          style={styles.smallInput}
                          value={design.snapshot.cableName}
                          placeholder="Cable name"
                          onChange={(event) =>
                            updateSnapshot(row, {
                              cableName: event.target.value,
                            })
                          }
                        />
                        <label>
                          Capacity A
                          <input
                            style={styles.smallInput}
                            type="number"
                            min="0.1"
                            value={design.snapshot.currentCapacityA}
                            onChange={(event) =>
                              updateSnapshot(row, {
                                currentCapacityA: Math.max(
                                  0.1,
                                  Number(event.target.value) || 0.1,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          mV/A/m
                          <input
                            style={styles.smallInput}
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={
                              design.snapshot.voltageDropMvPerAmpMetre
                            }
                            onChange={(event) =>
                              updateSnapshot(row, {
                                voltageDropMvPerAmpMetre: Math.max(
                                  0.001,
                                  Number(event.target.value) || 0.001,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                    ) : design ? (
                      <span style={styles.readOnlyData}>
                        {design.snapshot.conductorSizeMm2} mm² ·{" "}
                        {design.snapshot.currentCapacityA} A ·{" "}
                        {design.snapshot.voltageDropMvPerAmpMetre} mV/A/m
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={styles.td}>
                    <div style={styles.inputWithUnit}>
                      <input
                        style={styles.numberInput}
                        type="number"
                        min="0"
                        step="1"
                        disabled={!design}
                        value={design?.lengthMetres ?? ""}
                        onChange={(event) =>
                          updateCableField(row, {
                            lengthMetres: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          })
                        }
                      />
                      <span>m</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <input
                      style={styles.numberInput}
                      type="number"
                      min="1"
                      step="1"
                      disabled={!design}
                      value={design?.parallelRuns ?? ""}
                      onChange={(event) =>
                        updateCableField(row, {
                          parallelRuns: Math.max(
                            1,
                            Math.round(Number(event.target.value) || 1),
                          ),
                        })
                      }
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      style={styles.numberInput}
                      type="number"
                      min="0.01"
                      max="1"
                      step="0.01"
                      disabled={!design}
                      value={design?.deratingFactor ?? ""}
                      onChange={(event) =>
                        updateCableField(row, {
                          deratingFactor: Math.min(
                            1,
                            Math.max(
                              0.01,
                              Number(event.target.value) || 0.01,
                            ),
                          ),
                        })
                      }
                    />
                  </td>
                  <td style={styles.numberTd}>
                    {result
                      ? `${formatNumber(result.adjustedCapacityA)} A`
                      : "-"}
                  </td>
                  <td style={styles.numberTd}>
                    {result
                      ? `${formatNumber(result.utilisationPercent, 1)}%`
                      : "-"}
                  </td>
                  <td style={styles.numberTd}>
                    {result
                      ? `${formatNumber(result.sectionVoltageDropV)} V / ${formatNumber(result.sectionVoltageDropPercent)}%`
                      : "-"}
                  </td>
                  <td style={styles.numberTd}>
                    {result
                      ? `${formatNumber(result.cumulativeVoltageDropV)} V / ${formatNumber(result.cumulativeVoltageDropPercent)}%`
                      : "-"}
                  </td>
                  <td style={styles.numberTd}>
                    {result ? `${formatNumber(result.endVoltageV)} V` : "-"}
                  </td>
                  <td style={styles.td}>
                    <select
                      style={styles.limitSelect}
                      disabled={!design}
                      value={design?.voltageDropCategory ?? "other"}
                      onChange={(event) => {
                        const category = event.target.value as
                          | "lighting"
                          | "other"
                          | "custom";
                        updateCableField(row, {
                          voltageDropCategory: category,
                          voltageDropLimitPercent:
                            category === "lighting"
                              ? 3
                              : category === "other"
                                ? 5
                                : design?.voltageDropLimitPercent ?? 5,
                        });
                      }}
                    >
                      <option value="lighting">Lighting 3%</option>
                      <option value="other">Other 5%</option>
                      <option value="custom">Custom</option>
                    </select>
                    {design?.voltageDropCategory === "custom" && (
                      <div style={styles.inputWithUnit}>
                        <input
                          style={styles.numberInput}
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={design.voltageDropLimitPercent}
                          onChange={(event) =>
                            updateCableField(row, {
                              voltageDropLimitPercent: Math.max(
                                0.1,
                                Number(event.target.value) || 0.1,
                              ),
                            })
                          }
                        />
                        <span>%</span>
                      </div>
                    )}
                  </td>
                  <td style={styles.td}>
                    {design ? (
                      <button
                        type="button"
                        title={
                          verificationValid &&
                          design.designerVerifiedAt
                            ? `Cable data and installation assumptions checked by ${design.designerVerifiedBy} on ${new Date(
                                design.designerVerifiedAt,
                              ).toLocaleString()}. Click to remove verification.`
                            : "Confirm that you have checked this cable data and its installation assumptions."
                        }
                        style={{
                          ...styles.verificationButton,
                          ...(verificationValid ? styles.verifiedText : {}),
                        }}
                        onClick={() =>
                          setDesignerVerification(row, !verificationValid)
                        }
                      >
                        {verificationValid ? "Verified" : "Verify"}
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={styles.td}>
                    <span
                      title={result?.statusReasons.join(" ") ?? ""}
                      style={{
                        ...styles.status,
                        ...(result?.status === "pass"
                          ? styles.pass
                          : result?.status === "fail"
                            ? styles.fail
                            : styles.review),
                      }}
                    >
                      {result
                        ? result.status[0].toUpperCase() +
                          result.status.slice(1)
                        : "Incomplete"}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <input
                      style={styles.notesInput}
                      disabled={!design}
                      value={design?.notes ?? ""}
                      placeholder="Optional"
                      onChange={(event) =>
                        updateCableField(row, { notes: event.target.value })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {floatingScrollbar.visible && (
        <div
          ref={floatingScrollRef}
          style={{
            ...styles.floatingScrollbar,
            left: floatingScrollbar.left,
            width: floatingScrollbar.width,
          }}
          onScroll={(event) =>
            syncHorizontalScroll(event.currentTarget, tableScrollRef.current)
          }
        >
          <div
            style={{
              width: floatingScrollbar.contentWidth,
              height: "1px",
            }}
          />
        </div>
      )}

      {visibleRows.length === 0 && (
        <div style={styles.notice}>
          No populated circuits are available for cable calculation.
        </div>
      )}

      <p style={styles.disclaimer}>
        Library and custom values are design inputs. Cable selection, correction
        factors and installation conditions must be verified by a competent
        designer.
      </p>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "grid", gap: "14px" },
  intro: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "14px",
  },
  title: { margin: 0 },
  muted: { margin: "4px 0 0", color: "#667085" },
  filter: {
    display: "grid",
    gap: "4px",
    color: "#526071",
    fontSize: "12px",
  },
  input: {
    minHeight: "38px",
    padding: "7px 9px",
    border: "1px solid #CBD5E1",
    borderRadius: "9px",
    background: "#FFFFFF",
  },
  notice: {
    padding: "12px",
    border: "1px solid #DCE5EC",
    borderRadius: "11px",
    background: "#F8FAFC",
    color: "#526071",
  },
  errorNotice: {
    padding: "12px",
    border: "1px solid #FECACA",
    borderRadius: "11px",
    background: "#FFF1F1",
    color: "#B42318",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
  },
  table: {
    width: "100%",
    minWidth: "2200px",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  th: {
    padding: "9px",
    borderBottom: "1px solid #DCE5EC",
    background: "#F8FAFC",
    color: "#526071",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  numberTh: {
    padding: "9px",
    borderBottom: "1px solid #DCE5EC",
    background: "#F8FAFC",
    color: "#526071",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "9px",
    borderBottom: "1px solid #EEF2F6",
    verticalAlign: "top",
  },
  numberTd: {
    padding: "9px",
    borderBottom: "1px solid #EEF2F6",
    textAlign: "left",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  circuitTd: {
    width: "190px",
    padding: "9px",
    borderBottom: "1px solid #EEF2F6",
    verticalAlign: "top",
  },
  cableSelect: {
    width: "260px",
    minHeight: "35px",
    padding: "6px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
  },
  sourceText: {
    display: "block",
    maxWidth: "260px",
    marginTop: "4px",
    color: "#667085",
  },
  conditionalNotice: {
    display: "block",
    maxWidth: "260px",
    marginTop: "5px",
    color: "#8A5A00",
    fontWeight: 700,
  },
  notRecommendedNotice: {
    display: "block",
    maxWidth: "260px",
    marginTop: "5px",
    color: "#B42318",
    fontWeight: 700,
  },
  customGrid: {
    display: "grid",
    gridTemplateColumns: "160px 90px 90px",
    gap: "6px",
  },
  smallInput: {
    width: "100%",
    minHeight: "33px",
    padding: "5px 6px",
    border: "1px solid #CBD5E1",
    borderRadius: "7px",
  },
  readOnlyData: { display: "block", width: "220px", color: "#526071" },
  numberInput: {
    width: "76px",
    minHeight: "33px",
    padding: "5px 6px",
    border: "1px solid #CBD5E1",
    borderRadius: "7px",
  },
  inputWithUnit: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  limitSelect: {
    width: "120px",
    minHeight: "33px",
    padding: "5px",
    border: "1px solid #CBD5E1",
    borderRadius: "7px",
  },
  status: {
    display: "inline-block",
    padding: "5px 8px",
    borderRadius: "999px",
    fontWeight: 700,
  },
  verificationButton: {
    padding: "4px 7px",
    border: "1px solid #CBD5E1",
    borderRadius: "999px",
    background: "#F8FAFC",
    color: "#667085",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  verifiedText: {
    borderColor: "#A7F3D0",
    background: "#ECFDF5",
    color: "#047857",
  },
  pass: { background: "#ECFDF5", color: "#047857" },
  review: { background: "#FFF8E5", color: "#8A5A00" },
  fail: { background: "#FFF1F1", color: "#B42318" },
  notesInput: {
    width: "180px",
    minHeight: "33px",
    padding: "5px 7px",
    border: "1px solid #CBD5E1",
    borderRadius: "7px",
  },
  disclaimer: { margin: 0, color: "#667085", fontSize: "12px" },
  floatingScrollbar: {
    position: "fixed",
    bottom: 0,
    zIndex: 50,
    overflowX: "auto",
    overflowY: "hidden",
    height: "18px",
    border: "1px solid #CBD5E1",
    background: "#F8FAFC",
    boxShadow: "0 -2px 8px rgba(17, 24, 39, 0.12)",
  },
};

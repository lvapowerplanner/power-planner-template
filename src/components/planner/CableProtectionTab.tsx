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
  advancedDistroLoadMetrics,
  displayDistroName,
  isThreePhaseConnection,
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
  selectedDistroId: string;
  setSelectedDistroId: (value: string) => void;
  showUnusedOutputs: boolean;
  setShowUnusedOutputs: (value: boolean) => void;
  collapsedDistroIds: string[];
  setCollapsedDistroIds: React.Dispatch<React.SetStateAction<string[]>>;
};

type CableCircuitRow = {
  key: string;
  distro: ProjectDistro;
  output: PlannerOutput;
  parentOutput?: PlannerOutput;
  label: string;
  connectedWatts: number;
  designCurrentOverride?: number;
  rowKind: "inbound" | "output";
  feedsDistro?: boolean;
  linkedDistroId?: string;
  linkedDistroName?: string;
  autoInbound?: boolean;
  configuredAtDistroId?: string;
  configuredAtDistroName?: string;
  configuredAtOutputLabel?: string;
  configuredAtRowKey?: string;
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
  return plannerState.distros.flatMap((distro) => {
    const source = plannerState.sources.find(
      (candidate) => candidate.id === distro.sourceId,
    );
    const inboundRows: CableCircuitRow[] =
      source && !source.auto
        ? (() => {
            const threePhase =
              source.phaseType === "Three-Phase" ||
              isThreePhaseConnection(source.conn) ||
              isThreePhaseConnection(distro.input);
            const metrics = advancedDistroLoadMetrics(distro, plannerState);
            const voltage = threePhase
              ? plannerState.advancedElectrical?.nominalThreePhaseVoltage ?? 400
              : plannerState.advancedElectrical?.nominalSinglePhaseVoltage ?? 230;
            const current = threePhase
              ? metrics.apparentVa / (Math.sqrt(3) * voltage)
              : metrics.apparentVa / voltage;

            return [
              {
                key: `${distro.id}:inbound`,
                distro,
                output: {
                  id: `inbound-${distro.id}`,
                  label: "Inbound supply",
                  phase: threePhase ? "3Φ" : "L1",
                  type: source.conn || distro.input,
                  rating: Math.max(1, distro.inputA || source.rating),
                  connectorStyle:
                    source.connectorStyle ?? distro.connectorStyle,
                  items: [],
                },
                label: `${source.name} → ${displayDistroName(distro)}`,
                connectedWatts: metrics.connectedWatts,
                designCurrentOverride: current,
                rowKind: "inbound" as const,
              },
            ];
          })()
        : source?.auto && source.parentDistroId && source.parentOutputId
          ? (() => {
              const parentDistro = plannerState.distros.find(
                (candidate) => candidate.id === source.parentDistroId,
              );
              const parentOutputIndex = parentDistro?.outputs.findIndex(
                (candidate) => candidate.id === source.parentOutputId,
              );
              const parentOutput =
                parentOutputIndex != null && parentOutputIndex >= 0
                  ? parentDistro?.outputs[parentOutputIndex]
                  : undefined;

              if (!parentDistro || !parentOutput) return [];

              const outputLabel = outputDisplayName(
                parentOutput,
                parentOutputIndex ?? 0,
              );

              return [
                {
                  key: `${distro.id}:auto-inbound`,
                  distro,
                  output: parentOutput,
                  label: `${source.name} → ${displayDistroName(distro)}`,
                  connectedWatts: outputWatts(
                    parentOutput,
                    plannerState,
                    parentDistro,
                  ),
                  rowKind: "inbound" as const,
                  autoInbound: true,
                  configuredAtDistroId: parentDistro.id,
                  configuredAtDistroName: displayDistroName(parentDistro),
                  configuredAtOutputLabel: outputLabel,
                  configuredAtRowKey: `${parentDistro.id}:${parentOutput.id}`,
                },
              ];
            })()
          : [];

    const outputRows = distro.outputs.flatMap<CableCircuitRow>(
      (output, outputIndex) => {
      const linkedSource = plannerState.sources.find(
        (candidate) =>
          candidate.auto &&
          candidate.parentDistroId === distro.id &&
          candidate.parentOutputId === output.id,
      );
      const linkedDistro = linkedSource
        ? plannerState.distros.find(
            (child) => child.sourceId === linkedSource.id,
          )
        : undefined;
      const feedsDistro = Boolean(linkedDistro);

      if (output.phase === "Socapex") {
        return (output.socaCircuits ?? []).map((socket) => ({
          key: `${distro.id}:${output.id}:${socket.id}`,
          distro,
          output: socket,
          parentOutput: output,
          label: `${outputDisplayName(output, outputIndex)} / ${socket.label}`,
          connectedWatts: outputWatts(socket),
          rowKind: "output" as const,
        }));
      }

      return [
        {
          key: `${distro.id}:${output.id}`,
          distro,
          output,
          label: outputDisplayName(output, outputIndex),
          connectedWatts: outputWatts(output, plannerState, distro),
          rowKind: "output",
          feedsDistro,
          linkedDistroId: linkedDistro?.id,
          linkedDistroName: linkedDistro
            ? displayDistroName(linkedDistro)
            : undefined,
        },
      ];
    });

    return [...inboundRows, ...outputRows];
  });
}

function cableDesignForRow(row: CableCircuitRow) {
  return row.rowKind === "inbound" && !row.autoInbound
    ? row.distro.inboundCableDesign
    : row.output.cableDesign;
}

function applicationForOutput(output: PlannerOutput) {
  return output.phase === "3Φ" ? "three_phase_ac" : "single_phase_ac";
}

const POWERLOCK_OUTPUT_RATINGS = new Set([200, 300, 400]);
const POWERLOCK_CONDUCTOR_SIZES = new Set([95, 120, 240]);

function isPowerlockOutput(output: PlannerOutput) {
  return (
    output.phase === "3Φ" &&
    POWERLOCK_OUTPUT_RATINGS.has(Number(output.rating))
  );
}

function isPowerlockCable({
  application,
  conductorSizeMm2,
  coreConfiguration,
  cableArrangement,
}: {
  application: string;
  conductorSizeMm2: number;
  coreConfiguration: string;
  cableArrangement: string;
}) {
  const description = `${coreConfiguration} ${cableArrangement}`.toLowerCase();
  return (
    application === "three_phase_ac" &&
    POWERLOCK_CONDUCTOR_SIZES.has(Number(conductorSizeMm2)) &&
    (description.includes("single-core") ||
      description.includes("single core") ||
      /(^|\s)1\s*x\s*/.test(description) ||
      /(^|\s)1c(\s|$)/.test(description))
  );
}

function globalCableCompatible(
  record: GlobalCableLibraryRecord,
  output: PlannerOutput,
) {
  const powerlockCable = isPowerlockCable({
    application: record.application,
    conductorSizeMm2: record.conductor_size_mm2,
    coreConfiguration: record.core_configuration,
    cableArrangement: record.cable_arrangement,
  });

  return isPowerlockOutput(output)
    ? powerlockCable
    : record.application === applicationForOutput(output) && !powerlockCable;
}

function projectCableCompatible(
  record: NonNullable<PlannerState["projectCableLibrary"]>[number],
  output: PlannerOutput,
) {
  const powerlockCable = isPowerlockCable({
    application: record.application,
    conductorSizeMm2: record.conductorSizeMm2,
    coreConfiguration: record.coreConfiguration,
    cableArrangement: record.cableArrangement,
  });

  return isPowerlockOutput(output)
    ? powerlockCable
    : record.application === applicationForOutput(output) && !powerlockCable;
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

function standardCableName(record: GlobalCableLibraryRecord) {
  const size = `${record.conductor_size_mm2} mm²`;
  return record.display_name.toLowerCase().includes(size.toLowerCase())
    ? record.display_name
    : `${record.display_name} · ${size}`;
}

function circuitInformation(row: CableCircuitRow) {
  if (row.rowKind === "inbound") {
    return row.autoInbound
      ? `Autosource inbound cable feeding ${displayDistroName(row.distro)}. Configured on ${row.configuredAtDistroName}, ${row.configuredAtOutputLabel}.`
      : `Manual-source inbound cable feeding ${displayDistroName(row.distro)}.`;
  }

  const details = row.output.items.map((item) =>
    `${item.quantity} × ${item.name}${item.notes?.trim() ? ` — ${item.notes.trim()}` : ""}`,
  );
  if (row.linkedDistroName) {
    details.unshift(`Distro link feeding ${row.linkedDistroName}.`);
  }
  if (row.output.notes?.trim()) details.push(`Output notes: ${row.output.notes.trim()}`);
  if (row.parentOutput?.notes?.trim()) details.push(`Socapex notes: ${row.parentOutput.notes.trim()}`);
  return details.length ? details.join("\n") : "No connected-load or output notes.";
}

export function CableProtectionTab({
  plannerState,
  setPlannerState,
  workspaceId,
  selectedDistroId,
  setSelectedDistroId,
  showUnusedOutputs,
  setShowUnusedOutputs,
  collapsedDistroIds,
  setCollapsedDistroIds,
}: CableProtectionTabProps) {
  const [library, setLibrary] = useState<GlobalCableLibraryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [highlightedRowKey, setHighlightedRowKey] = useState<string | null>(
    null,
  );
  const [floatingScrollbar, setFloatingScrollbar] = useState({
    visible: false,
    left: 0,
    width: 0,
    contentWidth: 2200,
  });
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const floatingScrollRef = useRef<HTMLDivElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const settings = settingsFor(plannerState);
  const allRows = useMemo(() => rowsForState(plannerState), [plannerState]);
  const visibleRows = allRows.filter(
    (row) =>
      (showUnusedOutputs ||
        row.connectedWatts > 0 ||
        row.rowKind === "inbound" ||
        row.feedsDistro) &&
      (selectedDistroId === "all" || row.distro.id === selectedDistroId) &&
      !collapsedDistroIds.includes(row.distro.id),
  );
  const visibleDistros = plannerState.distros.filter(
    (distro) => selectedDistroId === "all" || distro.id === selectedDistroId,
  );
  const standardSourceReferences = Array.from(
    new Map(
      allRows
        .map((row) =>
          cableDesignForRow(row),
        )
        .filter(
          (design): design is CircuitCableDesign =>
            Boolean(design && design.dataSource === "library"),
        )
        .map((design) => [
          `${design.snapshot.sourceName}:${design.snapshot.sourceRevision}`,
          `${design.snapshot.sourceName} · ${design.snapshot.sourceRevision}`,
        ]),
    ).values(),
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

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

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
    if (row.autoInbound) return;

    if (row.rowKind === "inbound") {
      setPlannerState({
        ...plannerState,
        distros: plannerState.distros.map((distro) =>
          distro.id === row.distro.id
            ? {
                ...distro,
                inboundCableDesign: updater(distro.inboundCableDesign),
              }
            : distro,
        ),
      });
      return;
    }

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
    if (row.designCurrentOverride != null) {
      return row.designCurrentOverride;
    }

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
    if (row.rowKind === "inbound") return undefined;

    const source = plannerState.sources.find(
      (candidate) => candidate.id === row.distro.sourceId,
    );
    if (!source) return undefined;

    if (!source.auto) {
      return allRows.find(
        (candidate) =>
          candidate.distro.id === row.distro.id &&
          candidate.rowKind === "inbound",
      );
    }

    if (!source.parentDistroId || !source.parentOutputId) return undefined;

    return allRows.find(
      (candidate) =>
        candidate.distro.id === source.parentDistroId &&
        candidate.output.id === source.parentOutputId &&
        !candidate.parentOutput &&
        candidate.rowKind === "output",
    );
  }

  function configuredOutputRow(row: CableCircuitRow) {
    if (!row.autoInbound) return undefined;

    return allRows.find(
      (candidate) =>
        candidate.rowKind === "output" &&
        candidate.distro.id === row.configuredAtDistroId &&
        candidate.output.id === row.output.id &&
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
    const configuredRow = configuredOutputRow(row);
    if (configuredRow) return resultForRow(configuredRow, nextVisited);
    const parent = upstreamRow(row);
    const parentResult = parent
      ? resultForRow(parent, nextVisited)
      : null;

    return calculateCableDesign({
      cableDesign: cableDesignForRow(row),
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
    if (row.autoInbound) return;

    const design = cableDesignForRow(row);
    if (verified && (!design || design.lengthMetres <= 0)) return;

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

  function rowElementId(rowKey: string) {
    return `cable-row-${rowKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }

  function navigateToRow(targetDistroId: string, targetRowKey: string) {
    setSelectedDistroId("all");
    setCollapsedDistroIds((current) =>
      current.filter((id) => id !== targetDistroId),
    );
    window.setTimeout(() => {
      const targetRow = document.getElementById(rowElementId(targetRowKey));
      targetRow?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedRowKey(targetRowKey);
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedRowKey((current) =>
          current === targetRowKey ? null : current,
        );
        highlightTimeoutRef.current = null;
      }, 2000);
    }, 0);
  }

  function openConfiguredOutput(row: CableCircuitRow) {
    if (!row.configuredAtDistroId || !row.configuredAtRowKey) return;
    navigateToRow(row.configuredAtDistroId, row.configuredAtRowKey);
  }

  function openLinkedDistro(row: CableCircuitRow) {
    if (!row.linkedDistroId) return;
    navigateToRow(row.linkedDistroId, `${row.linkedDistroId}:auto-inbound`);
  }

  return (
    <section style={styles.page}>
      <style>{`
        @keyframes cable-row-focus-pulse {
          0%, 100% { background-color: #fff7cc; }
          50% { background-color: #facc15; }
        }
        .cable-row-focus > td {
          animation: cable-row-focus-pulse 1s ease-in-out infinite;
        }
      `}</style>
      <div style={styles.intro}>
        <div>
          <h3 style={styles.title}>Cable Design</h3>
          <p style={styles.muted}>
            Cable sizing and voltage-drop design. Protective-device
            coordination is assessed in the Protection subtab.
          </p>
        </div>
      </div>

      <div style={styles.toolbar}>
        <label style={styles.compactField}>
          <span style={styles.toolbarLabel}>View</span>
          <select style={styles.input} value={selectedDistroId} onChange={(event) => setSelectedDistroId(event.target.value)}>
            <option value="all">All distros</option>
            {plannerState.distros.map((distro) => <option key={distro.id} value={distro.id}>{displayDistroName(distro)}</option>)}
          </select>
        </label>
        <label style={styles.checkboxLabel}>
          <input type="checkbox" checked={showUnusedOutputs} onChange={(event) => setShowUnusedOutputs(event.target.checked)} />
          Show unused outputs
        </label>
        <button style={styles.textButton} onClick={() => setCollapsedDistroIds([])}>Expand all</button>
        <button style={styles.textButton} onClick={() => setCollapsedDistroIds(visibleDistros.map((distro) => distro.id))}>Collapse all</button>
      </div>

      {loading && <div style={styles.notice}>Loading global cable library…</div>}
      {loadError && (
        <div style={styles.errorNotice}>
          Could not load the global cable library: {loadError}
        </div>
      )}

      {visibleDistros.map((distro) => {
        const collapsed = collapsedDistroIds.includes(distro.id);
        const distroRows = visibleRows.filter((row) => row.distro.id === distro.id);
        return (
          <article
            key={distro.id}
            id={`cable-distro-${distro.id}`}
            style={styles.distroCard}
          >
            <button
              style={styles.distroHeader}
              onClick={() =>
                setCollapsedDistroIds((current) =>
                  collapsed
                    ? current.filter((id) => id !== distro.id)
                    : [...current, distro.id],
                )
              }
            >
              <strong>{displayDistroName(distro)}</strong>
              <span>{collapsed ? "Expand" : "Collapse"}</span>
            </button>
            {!collapsed && (
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
            {distroRows.map((row) => {
              const design = cableDesignForRow(row);
              const result = resultForRow(row);
              const verificationValid = Boolean(
                design?.designerVerified &&
                  design.lengthMetres > 0 &&
                  design.designerVerificationFingerprint ===
                    cableVerificationFingerprint(
                      design,
                      designCurrent(row),
                    ),
              );
              const canVerify = Boolean(
                design && design.lengthMetres > 0,
              );
              const compatibleLibrary = library.filter(
                (record) =>
                  globalCableCompatible(record, row.output) &&
                  (!(plannerState.excludedCableRatingIds ?? []).includes(
                    record.cable_rating_id,
                  ) || design?.cableRatingId === record.cable_rating_id),
              );
              const compatibleProjectLibrary = (
                plannerState.projectCableLibrary ?? []
              ).filter(
                (record) =>
                  projectCableCompatible(record, row.output) &&
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
                <tr
                  key={row.key}
                  id={rowElementId(row.key)}
                  className={
                    highlightedRowKey === row.key ? "cable-row-focus" : undefined
                  }
                  style={
                    row.rowKind === "inbound"
                      ? styles.inboundRow
                      : row.feedsDistro
                        ? styles.distroLinkRow
                        : undefined
                  }
                >
                  <td style={styles.circuitTd}>
                    {row.rowKind === "inbound" && (
                      <span style={styles.inboundBadge}>Inbound supply</span>
                    )}
                    {row.feedsDistro && (
                      <span style={styles.distroLinkBadge}>Distro link</span>
                    )}
                    <strong>{row.label}</strong>
                    <span style={styles.infoIcon} title={circuitInformation(row)} aria-label="Circuit information">i</span>
                    {row.feedsDistro && row.linkedDistroId && (
                      <div style={styles.configuredElsewhere}>
                        <button
                          type="button"
                          style={styles.openConfiguredButton}
                          onClick={() => openLinkedDistro(row)}
                        >
                          Open Distro
                        </button>
                      </div>
                    )}
                    {row.autoInbound && (
                      <div style={styles.configuredElsewhere}>
                        <span>
                          Configured on {row.configuredAtDistroName} · {row.configuredAtOutputLabel}
                        </span>
                        <button
                          type="button"
                          style={styles.openConfiguredButton}
                          onClick={() => openConfiguredOutput(row)}
                        >
                          Open output
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={styles.td}>{row.output.phase}</td>
                  <td style={styles.numberTd}>
                    {formatNumber(designCurrent(row))} A
                  </td>
                  <td style={styles.td}>
                    {row.autoInbound ? (
                      <span style={styles.presetValue}>
                        {design?.snapshot.cableName ?? "Not configured"}
                      </span>
                    ) : (
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
                                {standardCableName(record)}
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
                    )}
                    {design && design.dataSource !== "library" && (
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
                    {row.autoInbound ? (
                      <span style={styles.presetValue}>
                        {design
                          ? `${design.snapshot.conductorSizeMm2} mm² · ${design.snapshot.currentCapacityA} A · ${design.snapshot.voltageDropMvPerAmpMetre} mV/A/m`
                          : "-"}
                      </span>
                    ) : design?.dataSource === "custom" ? (
                      <div style={styles.customGrid}>
                        <input
                          style={styles.smallInput}
                          disabled={row.autoInbound}
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
                            disabled={row.autoInbound}
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
                            disabled={row.autoInbound}
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
                    {row.autoInbound ? (
                      <span style={styles.presetValue}>
                        {design ? `${design.lengthMetres} m` : "-"}
                      </span>
                    ) : (
                    <div style={styles.inputWithUnit}>
                      <input
                        style={styles.numberInput}
                        type="number"
                        min="0"
                        step="1"
                        disabled={!design || row.autoInbound}
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
                    )}
                  </td>
                  <td style={styles.td}>
                    {row.autoInbound ? (
                      <span style={styles.presetValue}>
                        {design?.parallelRuns ?? "-"}
                      </span>
                    ) : (
                    <input
                      style={styles.numberInput}
                      type="number"
                      min="1"
                      step="1"
                      disabled={!design || row.autoInbound}
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
                    )}
                  </td>
                  <td style={styles.td}>
                    {row.autoInbound ? (
                      <span style={styles.presetValue}>
                        {design?.deratingFactor ?? "-"}
                      </span>
                    ) : (
                    <input
                      style={styles.numberInput}
                      type="number"
                      min="0.01"
                      max="1"
                      step="0.01"
                      disabled={!design || row.autoInbound}
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
                    )}
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
                    {row.autoInbound ? (
                      <span style={styles.presetValue}>
                        {design
                          ? `${design.voltageDropCategory === "lighting" ? "Lighting" : design.voltageDropCategory === "other" ? "Other" : "Custom"} ${design.voltageDropLimitPercent}%`
                          : "-"}
                      </span>
                    ) : (
                    <>
                    <select
                      style={styles.limitSelect}
                      disabled={!design || row.autoInbound}
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
                          disabled={row.autoInbound}
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
                    </>
                    )}
                  </td>
                  <td style={styles.td}>
                    {row.autoInbound ? (
                      <span style={styles.presetValue}>
                        {design
                          ? verificationValid
                            ? "Verified"
                            : "Not verified"
                          : "-"}
                      </span>
                    ) : design ? (
                      <button
                        type="button"
                        title={
                          !canVerify
                            ? "Enter a cable length greater than 0 m before verifying this cable."
                            : verificationValid &&
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
                        disabled={!canVerify}
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
                    {row.autoInbound ? (
                      <span style={styles.presetValue}>
                        {design?.notes?.trim() || "-"}
                      </span>
                    ) : (
                    <input
                      style={styles.notesInput}
                      disabled={!design || row.autoInbound}
                      value={design?.notes ?? ""}
                      placeholder="Optional"
                      onChange={(event) =>
                        updateCableField(row, { notes: event.target.value })
                      }
                    />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
            )}
          </article>
        );
      })}

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
          {visibleDistros.length > 0 &&
          visibleDistros.every((distro) =>
            collapsedDistroIds.includes(distro.id),
          )
            ? "All selected distro sections are collapsed. Expand a distro to view its circuits."
            : "No circuits are available for cable calculation with the current view options."}
        </div>
      )}

      {standardSourceReferences.length > 0 && (
        <div style={styles.sourceFooter}>
          <strong>Standard-library source data</strong>
          {standardSourceReferences.map((reference) => (
            <span key={reference}>{reference}</span>
          ))}
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
  toolbar: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px" },
  compactField: { display: "flex", alignItems: "center", gap: "8px" },
  toolbarLabel: { fontSize: "12px", color: "#526071", fontWeight: 600 },
  checkboxLabel: { display: "flex", alignItems: "center", gap: "7px", fontSize: "14px" },
  textButton: { padding: "7px 9px", border: 0, background: "transparent", color: "#334155", textDecoration: "underline", cursor: "pointer" },
  distroSections: { display: "grid", gap: "8px" },
  distroSectionButton: { width: "100%", display: "flex", justifyContent: "space-between", padding: "12px 14px", border: "1px solid #DCE5EC", borderRadius: "11px", background: "#F8FAFC", color: "#111827", cursor: "pointer", textAlign: "left" },
  distroCard: { border: "1px solid #DCE5EC", borderRadius: "16px", overflow: "hidden", background: "#FFFFFF" },
  distroHeader: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", border: 0, borderBottom: "1px solid #E5E7EB", background: "#F8FAFC", color: "#111827", textAlign: "left", cursor: "pointer" },
  infoIcon: { display: "inline-grid", placeItems: "center", width: "17px", height: "17px", marginLeft: "7px", border: "1px solid #94A3B8", borderRadius: "50%", color: "#526071", fontSize: "11px", fontWeight: 700, cursor: "help" },
  sourceFooter: { display: "grid", gap: "4px", padding: "12px 14px", border: "1px solid #DCE5EC", borderRadius: "11px", background: "#F8FAFC", color: "#637083", fontSize: "12px" },
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
  inboundRow: {
    background: "#EFF6FF",
    borderTop: "2px solid #60A5FA",
    borderBottom: "2px solid #BFDBFE",
  },
  inboundBadge: {
    display: "block",
    width: "fit-content",
    marginBottom: "5px",
    padding: "3px 7px",
    borderRadius: "999px",
    background: "#DBEAFE",
    color: "#1D4ED8",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  configuredElsewhere: {
    display: "grid",
    gap: "6px",
    marginTop: "7px",
    color: "#526071",
    fontSize: "11px",
    fontWeight: 500,
  },
  openConfiguredButton: {
    width: "fit-content",
    padding: "4px 7px",
    border: "1px solid #93C5FD",
    borderRadius: "7px",
    background: "#FFFFFF",
    color: "#1D4ED8",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  presetValue: {
    display: "block",
    maxWidth: "260px",
    color: "#7C8798",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  distroLinkRow: {
    background: "#F0FDFA",
    borderTop: "2px solid #2DD4BF",
    borderBottom: "2px solid #99F6E4",
  },
  distroLinkBadge: {
    display: "block",
    width: "fit-content",
    marginBottom: "5px",
    padding: "3px 7px",
    borderRadius: "999px",
    background: "#CCFBF1",
    color: "#0F766E",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
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

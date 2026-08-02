import { useEffect, useMemo, useState } from "react";
import { SystemOverviewTab } from "@/components/planner/SystemOverviewTab";
import { CableProtectionTab } from "@/components/planner/CableProtectionTab";
import { CableLibraryTab } from "@/components/planner/CableLibraryTab";
import { ProtectionTab } from "@/components/planner/ProtectionTab";
import { useCompanyDistroLibrary } from "@/planner/companyStock";
import {
  buildAdvancedExportHtml,
  type AdvancedExportSection,
} from "@/planner/advancedPdfExport";
import {
  calculateAdvancedCircuit,
  advancedOutputCalculationForLink,
  childDistroFedFromOutput,
  displayDistroName,
  outputDisplayName,
  outputWatts,
  socapexOutputWatts,
} from "@/planner/calculations";
import type {
  AdvancedElectricalSettings,
  PlannerOutput,
  PlannerState,
  ProjectDistro,
} from "@/planner/types";

type AdvancedCalculationsTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  openDistroEditor: (distroId: string) => void;
  workspaceId?: string | null;
  overviewExpandedSourceIds: string[];
  setOverviewExpandedSourceIds: (sourceIds: string[]) => void;
};

type CircuitRow = {
  key: string;
  distro: ProjectDistro;
  output: PlannerOutput;
  parentOutput?: PlannerOutput;
  outputIndex: number;
  label: string;
  connectedWatts: number;
  equipment: string;
  linkedDistro?: ProjectDistro;
};

const defaultSettings: AdvancedElectricalSettings = {
  calculationMethod: "real-power",
  defaultPowerFactor: 1,
  nominalSinglePhaseVoltage: 230,
  nominalThreePhaseVoltage: 400,
  showUnusedOutputs: false,
};

function settingsFor(state: PlannerState): AdvancedElectricalSettings {
  return {
    ...defaultSettings,
    ...state.advancedElectrical,
  };
}

function itemDescription(output: PlannerOutput) {
  return output.items
    .map((item) => `${item.quantity} × ${item.name}`)
    .join(", ");
}

function circuitRowsForDistro(
  distro: ProjectDistro,
  plannerState: PlannerState,
): CircuitRow[] {
  return distro.outputs.flatMap<CircuitRow>((output, outputIndex) => {
    if (output.phase === "Socapex") {
      return (output.socaCircuits ?? []).map((socket, socketIndex) => ({
        key: `${distro.id}:${output.id}:${socket.id}`,
        distro,
        output: socket,
        parentOutput: output,
        outputIndex: socketIndex,
        label: `${outputDisplayName(output, outputIndex)} / ${socket.label}`,
        connectedWatts: outputWatts(socket),
        equipment: itemDescription(socket) || "Unused",
        linkedDistro: undefined,
      }));
    }

    const child = childDistroFedFromOutput(plannerState, distro.id, output.id);
    const equipmentParts = [
      itemDescription(output),
      child ? `Feeds ${displayDistroName(child)}` : "",
    ].filter(Boolean);

    return [
      {
        key: `${distro.id}:${output.id}`,
        distro,
        output,
        parentOutput: undefined,
        outputIndex,
        label: outputDisplayName(output, outputIndex),
        connectedWatts: outputWatts(output, plannerState, distro),
        equipment: equipmentParts.join(", ") || "Unused",
        linkedDistro: child,
      },
    ];
  });
}

function formatKw(watts: number) {
  return watts >= 1000
    ? `${(watts / 1000).toFixed(2)} kW`
    : `${Math.round(watts)} W`;
}

function formatKva(va: number) {
  return va >= 1000 ? `${(va / 1000).toFixed(2)} kVA` : `${Math.round(va)} VA`;
}

function formatAmps(amps: number) {
  return `${amps.toFixed(2)} A`;
}

function numericInputValue(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? String(value) : String(fallback);
}

function supplyLabelForDistro(
  distro: ProjectDistro,
  plannerState: PlannerState,
) {
  if (!distro.sourceId) return "Unassigned supply";

  const source = plannerState.sources.find(
    (candidate) => candidate.id === distro.sourceId,
  );

  if (!source) return "Supply unavailable";

  return source.conn?.trim()
    ? `${source.name} — ${source.conn}`
    : source.name;
}

function normalisedModelName(value: string) {
  return value
    .replace(/^custom:\s*/i, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function referencedModelName(distro: ProjectDistro) {
  const instanceName = distro.instanceName.trim();
  const storedName = distro.name.trim();

  if (instanceName) {
    const prefixPattern = new RegExp(
      `^${instanceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s*[-–—]\s*`,
      "i",
    );
    return normalisedModelName(storedName.replace(prefixPattern, ""));
  }

  return normalisedModelName(storedName);
}

function outputHasAssignments(output: PlannerOutput) {
  return (
    output.items.length > 0 ||
    Boolean(
      output.notes?.trim() ||
        output.cableDesign ||
        output.diversityPercent != null ||
        output.powerFactorOverride != null,
    ) ||
    (output.socaCircuits ?? []).some(
      (circuit) =>
        circuit.items.length > 0 ||
        Boolean(
          circuit.notes?.trim() ||
            circuit.cableDesign ||
            circuit.diversityPercent != null ||
            circuit.powerFactorOverride != null,
        ),
    )
  );
}

function matchingOutput(
  modelOutput: PlannerOutput,
  modelIndex: number,
  existingOutputs: PlannerOutput[],
  usedIds: Set<string>,
) {
  const available = existingOutputs.filter((output) => !usedIds.has(output.id));
  return (
    available.find((output) => output.id === modelOutput.id) ??
    available.find(
      (output) =>
        modelOutput.outputNumber != null &&
        output.outputNumber === modelOutput.outputNumber &&
        output.phase === modelOutput.phase,
    ) ??
    available.find(
      (output) =>
        output.label === modelOutput.label &&
        output.phase === modelOutput.phase &&
        output.rating === modelOutput.rating,
    ) ??
    (existingOutputs[modelIndex] &&
    !usedIds.has(existingOutputs[modelIndex].id) &&
    existingOutputs[modelIndex].phase === modelOutput.phase &&
    existingOutputs[modelIndex].rating === modelOutput.rating
      ? existingOutputs[modelIndex]
      : undefined)
  );
}

function mergeCircuitModel(
  modelCircuit: PlannerOutput,
  existingCircuit: PlannerOutput | undefined,
) {
  if (!existingCircuit) return { ...modelCircuit, items: [], notes: modelCircuit.notes ?? "" };
  return {
    ...modelCircuit,
    id: existingCircuit.id,
    items: existingCircuit.items,
    notes: existingCircuit.notes ?? "",
    diversityPercent: existingCircuit.diversityPercent,
    diversityReason: existingCircuit.diversityReason,
    powerFactorOverride: existingCircuit.powerFactorOverride,
    cableDesign: existingCircuit.cableDesign,
    faultProtection: existingCircuit.faultProtection,
  };
}

function mergeOutputModel(
  modelOutput: PlannerOutput,
  existingOutput: PlannerOutput | undefined,
) {
  if (!existingOutput) {
    return {
      ...modelOutput,
      items: [],
      notes: modelOutput.notes ?? "",
      socaCircuits: modelOutput.socaCircuits?.map((circuit) => ({
        ...circuit,
        items: [],
        notes: circuit.notes ?? "",
      })),
    };
  }

  const existingCircuits = existingOutput.socaCircuits ?? [];
  return {
    ...modelOutput,
    id: existingOutput.id,
    items: existingOutput.items,
    notes: existingOutput.notes ?? "",
    diversityPercent: existingOutput.diversityPercent,
    diversityReason: existingOutput.diversityReason,
    powerFactorOverride: existingOutput.powerFactorOverride,
    cableDesign: existingOutput.cableDesign,
    faultProtection: existingOutput.faultProtection,
    socaCircuits: modelOutput.socaCircuits?.map((circuit, index) =>
      mergeCircuitModel(
        circuit,
        existingCircuits.find((current) => current.id === circuit.id) ??
          existingCircuits.find(
            (current) =>
              current.circuitNo != null &&
              current.circuitNo === circuit.circuitNo,
          ) ??
          existingCircuits[index],
      ),
    ),
  };
}

export function AdvancedCalculationsTab({
  plannerState,
  setPlannerState,
  openDistroEditor,
  workspaceId,
  overviewExpandedSourceIds,
  setOverviewExpandedSourceIds,
}: AdvancedCalculationsTabProps) {
  const { distroLibrary, loadingDistros } = useCompanyDistroLibrary();
  const settings = settingsFor(plannerState);
  const [selectedDistroId, setSelectedDistroId] = useState("all");
  const [collapsedDistroIds, setCollapsedDistroIds] = useState<string[]>(() =>
    plannerState.distros.map((distro) => distro.id),
  );
  const [activeSubTab, setActiveSubTab] = useState<
    "overview" | "load-demand" | "cables" | "protection" | "cable-library"
  >("overview");
  const [hoveredSubTab, setHoveredSubTab] = useState<string | null>(null);
  const [refreshDistroId, setRefreshDistroId] = useState(
    plannerState.distros[0]?.id ?? "",
  );
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportSections, setExportSections] = useState<
    Record<AdvancedExportSection, boolean>
  >({ "load-demand": true, cables: true, protection: true });
  const [exportDistroIds, setExportDistroIds] = useState<string[]>([]);
  const [exportError, setExportError] = useState("");

  const visibleDistros = useMemo(
    () =>
      selectedDistroId === "all"
        ? plannerState.distros
        : plannerState.distros.filter(
            (distro) => distro.id === selectedDistroId,
          ),
    [plannerState.distros, selectedDistroId],
  );

  useEffect(() => {
    if (
      plannerState.distros.length > 0 &&
      !plannerState.distros.some((distro) => distro.id === refreshDistroId)
    ) {
      setRefreshDistroId(plannerState.distros[0].id);
    }
  }, [plannerState.distros, refreshDistroId]);

  function updateSettings(patch: Partial<AdvancedElectricalSettings>) {
    setPlannerState({
      ...plannerState,
      advancedElectrical: {
        ...settings,
        ...patch,
      },
    });
  }

  function openExportModal() {
    setExportSections({ "load-demand": true, cables: true, protection: true });
    setExportDistroIds(plannerState.distros.map((distro) => distro.id));
    setExportError("");
    setExportModalOpen(true);
  }

  function toggleExportDistro(distroId: string) {
    setExportDistroIds((current) =>
      current.includes(distroId)
        ? current.filter((id) => id !== distroId)
        : [...current, distroId],
    );
  }

  function exportAdvancedPdf() {
    const selectedSections = (
      Object.keys(exportSections) as AdvancedExportSection[]
    ).filter((section) => exportSections[section]);
    if (selectedSections.length === 0) {
      setExportError("Select at least one calculation section.");
      return;
    }
    if (exportDistroIds.length === 0) {
      setExportError("Select at least one distro.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setExportError("Allow pop-ups in this browser to export the PDF.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(
      buildAdvancedExportHtml(
        plannerState,
        selectedSections,
        exportDistroIds,
      ),
    );
    printWindow.document.close();
    setExportModalOpen(false);
  }

  function replaceOutput(updatedOutput: PlannerOutput, row: CircuitRow) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) => {
        if (distro.id !== row.distro.id) return distro;

        return {
          ...distro,
          outputs: distro.outputs.map((output) => {
            if (!row.parentOutput) {
              return output.id === updatedOutput.id ? updatedOutput : output;
            }

            if (output.id !== row.parentOutput.id) return output;

            return {
              ...output,
              socaCircuits: (output.socaCircuits ?? []).map((socket) =>
                socket.id === updatedOutput.id ? updatedOutput : socket,
              ),
            };
          }),
        };
      }),
    });
  }

  function updateCircuit(
    row: CircuitRow,
    patch: Partial<
      Pick<
        PlannerOutput,
        "diversityPercent" | "diversityReason" | "powerFactorOverride"
      >
    >,
  ) {
    replaceOutput({ ...row.output, ...patch }, row);
  }

  function toggleDistro(distroId: string) {
    setCollapsedDistroIds((current) =>
      current.includes(distroId)
        ? current.filter((id) => id !== distroId)
        : [...current, distroId],
    );
  }

  function selectSubTab(
    subTab: "overview" | "load-demand" | "cables" | "protection" | "cable-library",
    button: HTMLButtonElement,
  ) {
    setActiveSubTab(subTab);
    button.blur();
  }

  function subTabStyle(subTab: string) {
    return {
      ...styles.subTab,
      ...(activeSubTab === subTab
        ? styles.activeSubTab
        : hoveredSubTab === subTab
          ? styles.hoveredSubTab
          : styles.inactiveSubTab),
    };
  }

  function resetAllDiversity() {
    if (
      !confirm(
        "Reset diversity to 100% and remove diversity reasons from every circuit?",
      )
    ) {
      return;
    }

    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) => ({
        ...distro,
        outputs: distro.outputs.map((output) => ({
          ...output,
          diversityPercent: 100,
          diversityReason: "",
          socaCircuits: output.socaCircuits?.map((socket) => ({
            ...socket,
            diversityPercent: 100,
            diversityReason: "",
          })),
        })),
      })),
    });
  }

  function refreshDistroModel() {
    const distro = plannerState.distros.find(
      (candidate) => candidate.id === refreshDistroId,
    );
    if (!distro) return;

    const modelName = referencedModelName(distro);

    const referencedModel =
      distroLibrary.find(
        (definition) =>
          definition.libraryReferenceId &&
          definition.libraryReferenceId === distro.libraryReferenceId,
      ) ??
      plannerState.customDistros.find(
        (definition) =>
          definition.libraryReferenceId &&
          definition.libraryReferenceId === distro.libraryReferenceId,
      ) ??
      distroLibrary.find(
        (definition) => normalisedModelName(definition.name) === modelName,
      ) ??
      plannerState.customDistros.find(
        (definition) => normalisedModelName(definition.name) === modelName,
      );

    if (!referencedModel) {
      alert(
        "The referenced distro model could not be found in the current workspace or project library.",
      );
      return;
    }

    const usedOutputIds = new Set<string>();
    const outputMatches = referencedModel.outputs.map((modelOutput, index) => {
      const match = matchingOutput(
        modelOutput,
        index,
        distro.outputs,
        usedOutputIds,
      );
      if (match) usedOutputIds.add(match.id);
      return { modelOutput, match };
    });
    const assignedRemovedOutputs = distro.outputs.filter(
      (output) => !usedOutputIds.has(output.id) && outputHasAssignments(output),
    );

    if (assignedRemovedOutputs.length > 0) {
      alert(
        `The model cannot be refreshed because ${assignedRemovedOutputs.length} removed or unmatched output${assignedRemovedOutputs.length === 1 ? " still contains" : "s still contain"} equipment assignments. Move those assignments before refreshing.`,
      );
      return;
    }

    if (
      !confirm(
        `Refresh ${displayDistroName(distro)} from ${referencedModel.name}? Output assignments and project calculation settings will be retained. Model structure and built-in protection will be updated.`,
      )
    ) {
      return;
    }

    const refreshedDistro: ProjectDistro = {
      ...distro,
      ...referencedModel,
      id: distro.id,
      libraryReferenceId:
        referencedModel.libraryReferenceId ?? distro.libraryReferenceId,
      instanceName: distro.instanceName,
      sourceId: distro.sourceId,
      location: distro.location,
      notes: distro.notes,
      inboundCableDesign: distro.inboundCableDesign,
      incomerFaultProtection: distro.incomerFaultProtection,
      outputs: outputMatches.map(({ modelOutput, match }) =>
        mergeOutputModel(modelOutput, match),
      ),
    };

    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((candidate) =>
        candidate.id === distro.id ? refreshedDistro : candidate,
      ),
    });
  }

  const powerFactorEnabled =
    settings.calculationMethod === "include-power-factor";

  return (
    <section style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Advanced Calculations</h2>
          <p style={styles.subtitle}>
            Equipment assignments are read from the Distro Editor. Only
            calculation assumptions can be changed here.
          </p>
        </div>
        <div style={styles.headerActions}>
          {activeSubTab === "load-demand" && (
            <button style={styles.secondaryButton} onClick={resetAllDiversity}>
              Reset all diversity
            </button>
          )}
          <button style={styles.primaryButton} onClick={openExportModal}>
            Export Advanced PDF
          </button>
        </div>
      </div>

      <div style={styles.subTabs}>
        <button
          style={subTabStyle("overview")}
          onMouseEnter={() => setHoveredSubTab("overview")}
          onMouseLeave={() => setHoveredSubTab(null)}
          onClick={(event) => selectSubTab("overview", event.currentTarget)}
        >
          Advanced Overview
        </button>
        <button
          style={subTabStyle("load-demand")}
          onMouseEnter={() => setHoveredSubTab("load-demand")}
          onMouseLeave={() => setHoveredSubTab(null)}
          onClick={(event) => selectSubTab("load-demand", event.currentTarget)}
        >
          Load &amp; Demand
        </button>
        <button
          style={subTabStyle("cables")}
          onMouseEnter={() => setHoveredSubTab("cables")}
          onMouseLeave={() => setHoveredSubTab(null)}
          onClick={(event) => selectSubTab("cables", event.currentTarget)}
        >
          Cable Design
        </button>
        <button
          style={subTabStyle("protection")}
          onMouseEnter={() => setHoveredSubTab("protection")}
          onMouseLeave={() => setHoveredSubTab(null)}
          onClick={(event) => selectSubTab("protection", event.currentTarget)}
        >
          Protection
        </button>
        <button
          style={subTabStyle("cable-library")}
          onMouseEnter={() => setHoveredSubTab("cable-library")}
          onMouseLeave={() => setHoveredSubTab(null)}
          onClick={(event) => selectSubTab("cable-library", event.currentTarget)}
        >
          Cable Library
        </button>
      </div>

      <div style={styles.modelRefreshBar}>
        <div>
          <strong>Refresh distro model</strong>
          <small style={styles.modelRefreshHelp}>
            Pull updated outputs and built-in protection from the referenced library item while retaining project assignments and calculation settings.
          </small>
        </div>
        <select
          style={styles.modelRefreshSelect}
          value={refreshDistroId}
          onChange={(event) => setRefreshDistroId(event.target.value)}
          disabled={plannerState.distros.length === 0 || loadingDistros}
        >
          {plannerState.distros.length === 0 && <option value="">No distros</option>}
          {plannerState.distros.map((distro) => (
            <option key={distro.id} value={distro.id}>
              {displayDistroName(distro)}
            </option>
          ))}
        </select>
        <button
          style={styles.secondaryButton}
          onClick={refreshDistroModel}
          disabled={!refreshDistroId || loadingDistros}
        >
          {loadingDistros ? "Loading library…" : "Refresh model"}
        </button>
      </div>

      {activeSubTab === "overview" ? (
        <>
          <div style={styles.settingsCard}>
            <label style={styles.field}>
              <span style={styles.label}>Calculation method</span>
              <select
                style={styles.input}
                value={settings.calculationMethod}
                onChange={(event) =>
                  updateSettings({
                    calculationMethod: event.target.value as
                      | "real-power"
                      | "include-power-factor",
                  })
                }
              >
                <option value="real-power">Real power only</option>
                <option value="include-power-factor">Include power factor</option>
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Project average power factor</span>
              <input style={styles.input} type="number" min="0.1" max="1" step="0.01" disabled={!powerFactorEnabled} value={numericInputValue(settings.defaultPowerFactor, 1)} onChange={(event) => updateSettings({ defaultPowerFactor: Math.min(1, Math.max(0.1, Number(event.target.value) || 0.1)) })} />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Single-phase voltage</span>
              <div style={styles.inputWithUnit}><input style={styles.input} type="number" min="1" step="1" value={numericInputValue(settings.nominalSinglePhaseVoltage, 230)} onChange={(event) => updateSettings({ nominalSinglePhaseVoltage: Math.max(1, Number(event.target.value) || 230) })} /><span>V</span></div>
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Three-phase voltage</span>
              <div style={styles.inputWithUnit}><input style={styles.input} type="number" min="1" step="1" value={numericInputValue(settings.nominalThreePhaseVoltage, 400)} onChange={(event) => updateSettings({ nominalThreePhaseVoltage: Math.max(1, Number(event.target.value) || 400) })} /><span>V</span></div>
            </label>
          </div>
          <SystemOverviewTab
            plannerState={plannerState}
            setPlannerState={setPlannerState}
            openDistroEditor={openDistroEditor}
            calculationView="advanced"
            showProjectInformation={false}
            showHeader={false}
            expandedSourceIds={overviewExpandedSourceIds}
            setExpandedSourceIds={setOverviewExpandedSourceIds}
          />
        </>
      ) : activeSubTab === "cables" ? (
        <CableProtectionTab
          plannerState={plannerState}
          setPlannerState={setPlannerState}
          workspaceId={workspaceId}
          selectedDistroId={selectedDistroId}
          setSelectedDistroId={setSelectedDistroId}
          showUnusedOutputs={settings.showUnusedOutputs}
          setShowUnusedOutputs={(showUnusedOutputs) =>
            updateSettings({ showUnusedOutputs })
          }
          collapsedDistroIds={collapsedDistroIds}
          setCollapsedDistroIds={setCollapsedDistroIds}
        />
      ) : activeSubTab === "cable-library" ? (
        <CableLibraryTab
          plannerState={plannerState}
          setPlannerState={setPlannerState}
          workspaceId={workspaceId}
        />
      ) : activeSubTab === "protection" ? (
        <ProtectionTab
          plannerState={plannerState}
          setPlannerState={setPlannerState}
          selectedDistroId={selectedDistroId}
          setSelectedDistroId={setSelectedDistroId}
          showUnusedOutputs={settings.showUnusedOutputs}
          setShowUnusedOutputs={(showUnusedOutputs) =>
            updateSettings({ showUnusedOutputs })
          }
          collapsedDistroIds={collapsedDistroIds}
          setCollapsedDistroIds={setCollapsedDistroIds}
        />
      ) : (
        <>
      <div style={styles.settingsCard}>
        <label style={styles.field}>
          <span style={styles.label}>Calculation method</span>
          <select
            style={styles.input}
            value={settings.calculationMethod}
            onChange={(event) =>
              updateSettings({
                calculationMethod: event.target.value as
                  | "real-power"
                  | "include-power-factor",
              })
            }
          >
            <option value="real-power">Real power only</option>
            <option value="include-power-factor">
              Include power factor
            </option>
          </select>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Project average power factor</span>
          <input
            style={styles.input}
            type="number"
            min="0.1"
            max="1"
            step="0.01"
            disabled={!powerFactorEnabled}
            value={numericInputValue(settings.defaultPowerFactor, 1)}
            onChange={(event) =>
              updateSettings({
                defaultPowerFactor: Math.min(
                  1,
                  Math.max(0.1, Number(event.target.value) || 0.1),
                ),
              })
            }
          />
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Single-phase voltage</span>
          <div style={styles.inputWithUnit}>
            <input
              style={styles.input}
              type="number"
              min="1"
              step="1"
              value={numericInputValue(
                settings.nominalSinglePhaseVoltage,
                230,
              )}
              onChange={(event) =>
                updateSettings({
                  nominalSinglePhaseVoltage: Math.max(
                    1,
                    Number(event.target.value) || 230,
                  ),
                })
              }
            />
            <span>V</span>
          </div>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Three-phase voltage</span>
          <div style={styles.inputWithUnit}>
            <input
              style={styles.input}
              type="number"
              min="1"
              step="1"
              value={numericInputValue(
                settings.nominalThreePhaseVoltage,
                400,
              )}
              onChange={(event) =>
                updateSettings({
                  nominalThreePhaseVoltage: Math.max(
                    1,
                    Number(event.target.value) || 400,
                  ),
                })
              }
            />
            <span>V</span>
          </div>
        </label>
      </div>

      <div style={styles.toolbar}>
        <label style={styles.compactField}>
          <span style={styles.label}>View</span>
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

        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settings.showUnusedOutputs}
            onChange={(event) =>
              updateSettings({ showUnusedOutputs: event.target.checked })
            }
          />
          Show unused outputs
        </label>

        <button
          style={styles.textButton}
          onClick={() => setCollapsedDistroIds([])}
        >
          Expand all
        </button>
        <button
          style={styles.textButton}
          onClick={() =>
            setCollapsedDistroIds(visibleDistros.map((distro) => distro.id))
          }
        >
          Collapse all
        </button>
      </div>

      {visibleDistros.length === 0 ? (
        <div style={styles.emptyState}>
          Add a distro in Distro Overview to create an advanced calculation
          schedule.
        </div>
      ) : (
        visibleDistros.map((distro) => {
          const allRows = circuitRowsForDistro(distro, plannerState);
          const rows = settings.showUnusedOutputs
            ? allRows
            : allRows.filter((row) => row.connectedWatts > 0);
          const collapsed = collapsedDistroIds.includes(distro.id);
          const calculations = rows.map((row) =>
            row.linkedDistro
              ? advancedOutputCalculationForLink(
                  row.output,
                  row.distro,
                  plannerState,
                )
              : calculateAdvancedCircuit({
              connectedWatts: row.connectedWatts,
              phase: row.output.phase,
              diversityPercent: row.output.diversityPercent,
              calculationMethod: settings.calculationMethod,
              projectPowerFactor: settings.defaultPowerFactor,
              powerFactorOverride: row.output.powerFactorOverride,
              nominalSinglePhaseVoltage:
                settings.nominalSinglePhaseVoltage,
              nominalThreePhaseVoltage: settings.nominalThreePhaseVoltage,
                }),
          );
          const connectedTotal = calculations.reduce(
            (total, calculation) => total + calculation.connectedWatts,
            0,
          );
          const designTotal = calculations.reduce(
            (total, calculation) => total + calculation.diversifiedWatts,
            0,
          );
          const apparentTotal = calculations.reduce(
            (total, calculation) => total + calculation.apparentVa,
            0,
          );
          const phaseTotals = rows.reduce(
            (totals, row, index) => {
              const amps = calculations[index].currentAmps;
              if (row.output.phase === "L1") totals.L1 += amps;
              if (row.output.phase === "L2") totals.L2 += amps;
              if (row.output.phase === "L3") totals.L3 += amps;
              if (row.output.phase === "3Φ") {
                totals.L1 += amps;
                totals.L2 += amps;
                totals.L3 += amps;
              }
              return totals;
            },
            { L1: 0, L2: 0, L3: 0 },
          );

          return (
            <article key={distro.id} style={styles.distroCard}>
              <button
                style={styles.distroHeader}
                onClick={() => toggleDistro(distro.id)}
              >
                <span>
                  <strong>{displayDistroName(distro)}</strong>
                  <small style={styles.feedText}>
                    {`Fed from: ${supplyLabelForDistro(distro, plannerState)}`}
                  </small>
                </span>
                <span>{collapsed ? "Expand" : "Collapse"}</span>
              </button>

              {!collapsed && (
                <>
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Output</th>
                          <th style={styles.th}>Phase</th>
                          <th style={styles.th}>Connected equipment</th>
                          <th style={styles.numberTh}>Connected load</th>
                          <th style={styles.th}>Diversity</th>
                          <th style={styles.numberTh}>Design load</th>
                          <th style={styles.th}>Power factor</th>
                          <th style={styles.numberTh}>Apparent load</th>
                          <th style={styles.numberTh}>Current</th>
                          <th style={styles.th}>Reason / notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => {
                          const calculation = calculations[index];
                          const diversityApplied =
                            !row.linkedDistro && calculation.diversityPercent < 100;
                          const missingReason =
                            diversityApplied &&
                            !row.output.diversityReason?.trim();
                          const hasPfOverride =
                            typeof row.output.powerFactorOverride === "number";

                          return (
                            <tr key={row.key} style={row.linkedDistro ? styles.linkedRow : undefined}>
                              <td style={styles.td}>
                                <strong>{row.label}</strong>
                              </td>
                              <td style={styles.td}>{row.output.phase}</td>
                              <td style={styles.equipmentTd}>
                                {row.equipment}
                              </td>
                              <td style={styles.numberTd}>
                                {formatKw(calculation.connectedWatts)}
                              </td>
                              <td style={styles.td}>
                                <div style={styles.percentInput}>
                                  <input
                                    style={{
                                      ...styles.tableInput,
                                      ...(diversityApplied
                                        ? styles.amberInput
                                        : {}),
                                    }}
                                    type="number"
                                    min="1"
                                    max="100"
                                    step="1"
                                    disabled={Boolean(row.linkedDistro)}
                                    value={numericInputValue(
                                      row.linkedDistro
                                        ? Number(calculation.diversityPercent.toFixed(2))
                                        : row.output.diversityPercent,
                                      100,
                                    )}
                                    onChange={(event) =>
                                      updateCircuit(row, {
                                        diversityPercent: Math.min(
                                          100,
                                          Math.max(
                                            1,
                                            Number(event.target.value) || 1,
                                          ),
                                        ),
                                      })
                                    }
                                  />
                                  <span>%</span>
                                </div>
                              </td>
                              <td style={styles.numberTd}>
                                {formatKw(calculation.diversifiedWatts)}
                              </td>
                              <td style={styles.td}>
                                <div style={styles.pfCell}>
                                  <input
                                    style={styles.tableInput}
                                    type="number"
                                    min="0.1"
                                    max="1"
                                    step="0.01"
                                    disabled={!powerFactorEnabled || Boolean(row.linkedDistro)}
                                    placeholder={settings.defaultPowerFactor.toFixed(
                                      2,
                                    )}
                                    value={
                                      row.linkedDistro
                                        ? Number(calculation.powerFactor.toFixed(3))
                                        : hasPfOverride
                                        ? row.output.powerFactorOverride
                                        : ""
                                    }
                                    onChange={(event) =>
                                      updateCircuit(row, {
                                        powerFactorOverride:
                                          event.target.value === ""
                                            ? undefined
                                            : Math.min(
                                                1,
                                                Math.max(
                                                  0.1,
                                                  Number(
                                                    event.target.value,
                                                  ) || 0.1,
                                                ),
                                              ),
                                      })
                                    }
                                  />
                                  <small style={styles.inheritanceText}>
                                    {row.linkedDistro
                                      ? "From downstream distro"
                                      : !powerFactorEnabled
                                      ? "Ignored"
                                      : hasPfOverride
                                        ? "Override"
                                        : "Project value"}
                                  </small>
                                </div>
                              </td>
                              <td style={styles.numberTd}>
                                {formatKva(calculation.apparentVa)}
                              </td>
                              <td style={styles.numberTd}>
                                {formatAmps(calculation.currentAmps)}
                              </td>
                              <td style={styles.td}>
                                {row.linkedDistro ? (
                                  <span style={styles.linkedValue}>Controlled by {displayDistroName(row.linkedDistro)}</span>
                                ) : <input
                                  style={{
                                    ...styles.notesInput,
                                    ...(missingReason
                                      ? styles.missingReasonInput
                                      : {}),
                                  }}
                                  value={row.output.diversityReason ?? ""}
                                  placeholder={
                                    diversityApplied
                                      ? "Optional diversity reason"
                                      : "Optional"
                                  }
                                  onChange={(event) =>
                                    updateCircuit(row, {
                                      diversityReason: event.target.value,
                                    })
                                  }
                                />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {rows.length === 0 ? (
                    <p style={styles.noRows}>
                      This distro has no used outputs. Enable “Show unused
                      outputs” to display its full schedule.
                    </p>
                  ) : (
                    <div style={styles.summaryGrid}>
                      <div style={styles.summaryItem}>
                        <span>Connected</span>
                        <strong>{formatKw(connectedTotal)}</strong>
                      </div>
                      <div style={styles.summaryItem}>
                        <span>Design load</span>
                        <strong>{formatKw(designTotal)}</strong>
                      </div>
                      <div style={styles.summaryItem}>
                        <span>Apparent load</span>
                        <strong>{formatKva(apparentTotal)}</strong>
                      </div>
                      <div style={styles.summaryItem}>
                        <span>L1</span>
                        <strong>{formatAmps(phaseTotals.L1)}</strong>
                      </div>
                      <div style={styles.summaryItem}>
                        <span>L2</span>
                        <strong>{formatAmps(phaseTotals.L2)}</strong>
                      </div>
                      <div style={styles.summaryItem}>
                        <span>L3</span>
                        <strong>{formatAmps(phaseTotals.L3)}</strong>
                      </div>
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })
      )}

      <p style={styles.disclaimer}>
        These figures are design calculations. They do not replace inspection,
        testing, or verification by a competent person.
      </p>
        </>
      )}

      {exportModalOpen && (
        <div style={styles.modalBackdrop} role="presentation">
          <div
            style={styles.exportModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="advanced-export-title"
          >
            <div style={styles.modalHeader}>
              <div>
                <h3 id="advanced-export-title" style={styles.modalTitle}>
                  Export Advanced PDF
                </h3>
                <p style={styles.modalDescription}>
                  Choose the calculation sections and distros to include.
                </p>
              </div>
              <button
                style={styles.closeButton}
                onClick={() => setExportModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <section style={styles.exportGroup}>
              <div style={styles.exportGroupHeader}>
                <strong>Calculation sections</strong>
                <div style={styles.selectionActions}>
                  <button
                    style={styles.textButton}
                    onClick={() =>
                      setExportSections({
                        "load-demand": true,
                        cables: true,
                        protection: true,
                      })
                    }
                  >
                    Select all
                  </button>
                  <button
                    style={styles.textButton}
                    onClick={() =>
                      setExportSections({
                        "load-demand": false,
                        cables: false,
                        protection: false,
                      })
                    }
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div style={styles.exportChoices}>
                {([
                  ["load-demand", "Load & Demand"],
                  ["cables", "Cable Design"],
                  ["protection", "Protection"],
                ] as Array<[AdvancedExportSection, string]>).map(
                  ([section, label]) => (
                    <label key={section} style={styles.exportChoice}>
                      <input
                        type="checkbox"
                        checked={exportSections[section]}
                        onChange={(event) =>
                          setExportSections((current) => ({
                            ...current,
                            [section]: event.target.checked,
                          }))
                        }
                      />
                      {label}
                    </label>
                  ),
                )}
              </div>
            </section>

            <section style={styles.exportGroup}>
              <div style={styles.exportGroupHeader}>
                <strong>Distros</strong>
                <div style={styles.selectionActions}>
                  <button
                    style={styles.textButton}
                    onClick={() =>
                      setExportDistroIds(
                        plannerState.distros.map((distro) => distro.id),
                      )
                    }
                  >
                    Select all
                  </button>
                  <button
                    style={styles.textButton}
                    onClick={() => setExportDistroIds([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div style={styles.distroChoices}>
                {plannerState.distros.length === 0 ? (
                  <p style={styles.subtitle}>No distros have been added.</p>
                ) : (
                  plannerState.distros.map((distro) => (
                    <label key={distro.id} style={styles.exportChoice}>
                      <input
                        type="checkbox"
                        checked={exportDistroIds.includes(distro.id)}
                        onChange={() => toggleExportDistro(distro.id)}
                      />
                      <span>
                        <strong>{displayDistroName(distro)}</strong> · {distro.input}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </section>

            {exportError && <div style={styles.exportError}>{exportError}</div>}

            <div style={styles.modalFooter}>
              <button
                style={styles.secondaryButton}
                onClick={() => setExportModalOpen(false)}
              >
                Cancel
              </button>
              <button style={styles.primaryButton} onClick={exportAdvancedPdf}>
                Export Selected PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "grid", gap: "16px" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
  },
  title: { margin: 0, fontSize: "26px" },
  subtitle: { margin: "6px 0 0", color: "#637083" },
  subTabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    padding: "5px",
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    background: "#F8FAFC",
  },
  subTab: {
    padding: "10px 13px",
    border: "1px solid transparent",
    borderRadius: "10px",
    background: "transparent",
    color: "#526071",
    cursor: "pointer",
    boxShadow: "none",
    outline: "none",
  },
  activeSubTab: {
    borderColor: "var(--lva-workspace-highlight-border, #242424)",
    background: "var(--lva-workspace-highlight, #ececec)",
    color: "#111827",
  },
  inactiveSubTab: { borderColor: "transparent", background: "#F8FAFC", color: "#526071", boxShadow: "none" },
  hoveredSubTab: { borderColor: "#CBD5E1", background: "#EEF2F6", color: "#111827", boxShadow: "none" },
  settingsCard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
    padding: "16px",
    border: "1px solid #DCE5EC",
    borderRadius: "16px",
    background: "#F8FAFC",
  },
  field: { display: "grid", gap: "6px" },
  compactField: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  label: { fontSize: "12px", color: "#526071", fontWeight: 600 },
  input: {
    width: "100%",
    minHeight: "40px",
    padding: "8px 10px",
    border: "1px solid #CBD5E1",
    borderRadius: "9px",
    background: "#FFFFFF",
    color: "#111827",
  },
  inputWithUnit: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: "7px",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "14px",
  },
  secondaryButton: {
    padding: "10px 13px",
    border: "1px solid #CBD5E1",
    borderRadius: "10px",
    background: "#FFFFFF",
    cursor: "pointer",
  },
  primaryButton: {
    padding: "10px 13px",
    border: "1px solid var(--lva-workspace-dark-button, #000000)",
    borderRadius: "10px",
    background: "var(--lva-workspace-dark-button, #000000)",
    color: "#FFFFFF",
    cursor: "pointer",
    fontWeight: 500,
  },
  modelRefreshBar: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 1fr) minmax(220px, 320px) auto",
    alignItems: "center",
    gap: "12px",
    padding: "12px 14px",
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    background: "#F8FAFC",
  },
  modelRefreshHelp: {
    display: "block",
    marginTop: "3px",
    color: "#637083",
    fontWeight: 400,
    lineHeight: 1.35,
  },
  modelRefreshSelect: {
    width: "100%",
    minHeight: "40px",
    padding: "7px 9px",
    border: "1px solid #CBD5E1",
    borderRadius: "9px",
    background: "#FFFFFF",
  },
  textButton: {
    padding: "7px 9px",
    border: 0,
    background: "transparent",
    color: "#334155",
    textDecoration: "underline",
    cursor: "pointer",
  },
  distroCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "16px",
    overflow: "hidden",
    background: "#FFFFFF",
  },
  distroHeader: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    border: 0,
    borderBottom: "1px solid #E5E7EB",
    background: "#F8FAFC",
    color: "#111827",
    textAlign: "left",
    cursor: "pointer",
  },
  feedText: {
    display: "block",
    marginTop: "3px",
    color: "#637083",
    fontWeight: 400,
  },
  tableWrap: { overflowX: "auto" },
  table: {
    width: "100%",
    minWidth: "1280px",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    padding: "10px",
    borderBottom: "1px solid #DCE5EC",
    background: "#FFFFFF",
    color: "#526071",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  numberTh: {
    padding: "10px",
    borderBottom: "1px solid #DCE5EC",
    color: "#526071",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "10px",
    borderBottom: "1px solid #EEF2F6",
    verticalAlign: "top",
  },
  equipmentTd: {
    width: "260px",
    padding: "10px",
    borderBottom: "1px solid #EEF2F6",
    verticalAlign: "top",
  },
  linkedRow: { background: "#f1f5f9", color: "#526071" },
  linkedValue: { display: "block", color: "#637083", fontSize: "12px", lineHeight: 1.35 },
  numberTd: {
    padding: "10px",
    borderBottom: "1px solid #EEF2F6",
    textAlign: "left",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },
  tableInput: {
    width: "78px",
    minHeight: "34px",
    padding: "6px 7px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
  },
  notesInput: {
    width: "220px",
    minHeight: "34px",
    padding: "6px 8px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
  },
  percentInput: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  pfCell: { display: "grid", gap: "3px" },
  inheritanceText: { color: "#637083" },
  amberInput: { background: "#FFF7E6", borderColor: "#E9A23B" },
  missingReasonInput: { borderColor: "#E9A23B", background: "#FFF7E6" },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: "1px",
    background: "#DCE5EC",
    borderTop: "1px solid #DCE5EC",
  },
  summaryItem: {
    display: "grid",
    gap: "3px",
    padding: "12px",
    background: "#F8FAFC",
  },
  noRows: { padding: "16px", margin: 0, color: "#637083" },
  emptyState: {
    padding: "28px",
    border: "1px dashed #CBD5E1",
    borderRadius: "14px",
    color: "#637083",
    textAlign: "center",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "rgba(15, 23, 42, 0.55)",
  },
  exportModal: {
    width: "min(720px, 100%)",
    maxHeight: "calc(100vh - 48px)",
    overflow: "auto",
    padding: "20px",
    borderRadius: "18px",
    background: "#FFFFFF",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "16px",
  },
  modalTitle: { margin: 0 },
  modalDescription: { margin: "6px 0 0", color: "#637083" },
  closeButton: {
    width: "34px",
    height: "34px",
    padding: 0,
    border: "1px solid #DCE5EC",
    borderRadius: "9px",
    background: "#FFFFFF",
    color: "#344054",
    cursor: "pointer",
    fontSize: "22px",
    lineHeight: 1,
  },
  exportGroup: {
    padding: "14px",
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    background: "#F8FAFC",
    marginTop: "12px",
  },
  exportGroupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "10px",
  },
  selectionActions: { display: "flex", alignItems: "center", gap: "4px" },
  exportChoices: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  distroChoices: {
    display: "grid",
    gap: "7px",
    maxHeight: "280px",
    overflowY: "auto",
  },
  exportChoice: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 10px",
    border: "1px solid #DCE5EC",
    borderRadius: "9px",
    background: "#FFFFFF",
    color: "#344054",
    fontSize: "13px",
  },
  exportError: {
    marginTop: "12px",
    padding: "10px",
    border: "1px solid #FECACA",
    borderRadius: "9px",
    background: "#FFF1F1",
    color: "#B42318",
    fontSize: "13px",
  },
  modalFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "18px",
    paddingTop: "16px",
    borderTop: "1px solid #EEF2F6",
  },
  disclaimer: { margin: 0, color: "#637083", fontSize: "12px" },
};

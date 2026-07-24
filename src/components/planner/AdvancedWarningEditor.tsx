import { useState } from "react";
import {
  calculateAdvancedCircuit,
  childDistrosForDistro,
  displayDistroName,
  outputDisplayName,
  outputOwnWatts,
} from "@/planner/calculations";
import type { ValidationIssue } from "@/planner/calculations";
import type {
  PlannerOutput,
  PlannerState,
  ProjectDistro,
} from "@/planner/types";

type AdvancedWarningEditorProps = {
  issue: ValidationIssue;
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
};

type CircuitReference = {
  distro: ProjectDistro;
  output: PlannerOutput;
  parentOutput?: PlannerOutput;
  label: string;
};

function circuitReferencesForDistro(distro: ProjectDistro) {
  return distro.outputs.flatMap<CircuitReference>((output, outputIndex) => {
    if (output.phase !== "Socapex") {
      return [
        {
          distro,
          output,
          label: outputDisplayName(output, outputIndex),
        },
      ];
    }

    return (output.socaCircuits ?? []).map((socket) => ({
      distro,
      output: socket,
      parentOutput: output,
      label: `${outputDisplayName(output, outputIndex)} / ${socket.label}`,
    }));
  });
}

function allCircuitReferences(plannerState: PlannerState) {
  return plannerState.distros.flatMap(circuitReferencesForDistro);
}

function descendantDistros(
  roots: ProjectDistro[],
  plannerState: PlannerState,
) {
  const collected: ProjectDistro[] = [];
  const visited = new Set<string>();

  function visit(distro: ProjectDistro) {
    if (visited.has(distro.id)) return;
    visited.add(distro.id);
    collected.push(distro);
    childDistrosForDistro(plannerState, distro).forEach(visit);
  }

  roots.forEach(visit);
  return collected;
}

function issuePhase(issue: ValidationIssue) {
  return (["L1", "L2", "L3"] as const).find((phase) =>
    issue.id.includes(`-${phase}-`),
  );
}

function circuitsForIssue(
  issue: ValidationIssue,
  plannerState: PlannerState,
) {
  const allCircuits = allCircuitReferences(plannerState);
  const directCircuit = allCircuits.find((circuit) =>
    issue.id.startsWith(`${circuit.output.id}-`),
  );

  if (directCircuit) return [directCircuit];

  const source = plannerState.sources
    .filter((candidate) => !candidate.auto)
    .sort((a, b) => b.id.length - a.id.length)
    .find((candidate) => issue.id.startsWith(`${candidate.id}-`));

  if (!source) return [];

  const rootDistros = plannerState.distros.filter(
    (distro) => distro.sourceId === source.id,
  );
  const distroIds = new Set(
    descendantDistros(rootDistros, plannerState).map((distro) => distro.id),
  );
  const phase = issuePhase(issue);

  return allCircuits.filter((circuit) => {
    if (!distroIds.has(circuit.distro.id)) return false;
    if (!phase) return outputOwnWatts(circuit.output) > 0;

    return (
      circuit.output.phase === phase ||
      circuit.output.phase === "3Φ"
    );
  });
}

export function advancedWarningHasEditableCircuits(
  issue: ValidationIssue,
  plannerState: PlannerState,
) {
  return circuitsForIssue(issue, plannerState).some(
    (circuit) => outputOwnWatts(circuit.output) > 0,
  );
}

function equipmentDescription(output: PlannerOutput) {
  return (
    output.items
      .map((item) => `${item.quantity} × ${item.name}`)
      .join(", ") || "No directly assigned equipment"
  );
}

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

function calculationFor(
  circuit: CircuitReference,
  plannerState: PlannerState,
) {
  const settings = settingsFor(plannerState);

  return calculateAdvancedCircuit({
    connectedWatts: outputOwnWatts(circuit.output),
    phase: circuit.output.phase,
    diversityPercent: circuit.output.diversityPercent,
    calculationMethod: settings.calculationMethod,
    projectPowerFactor: settings.defaultPowerFactor,
    powerFactorOverride: circuit.output.powerFactorOverride,
    nominalSinglePhaseVoltage: settings.nominalSinglePhaseVoltage,
    nominalThreePhaseVoltage: settings.nominalThreePhaseVoltage,
  });
}

function updateCircuit(
  circuit: CircuitReference,
  patch: Partial<
    Pick<
      PlannerOutput,
      "diversityPercent" | "diversityReason" | "powerFactorOverride"
    >
  >,
  plannerState: PlannerState,
  setPlannerState: (state: PlannerState) => void,
) {
  setPlannerState({
    ...plannerState,
    distros: plannerState.distros.map((distro) => {
      if (distro.id !== circuit.distro.id) return distro;

      return {
        ...distro,
        outputs: distro.outputs.map((output) => {
          if (!circuit.parentOutput) {
            return output.id === circuit.output.id
              ? { ...output, ...patch }
              : output;
          }

          if (output.id !== circuit.parentOutput.id) return output;

          return {
            ...output,
            socaCircuits: (output.socaCircuits ?? []).map((socket) =>
              socket.id === circuit.output.id
                ? { ...socket, ...patch }
                : socket,
            ),
          };
        }),
      };
    }),
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

function CircuitEditor({
  circuit,
  plannerState,
  setPlannerState,
}: {
  circuit: CircuitReference;
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
}) {
  const settings = settingsFor(plannerState);
  const [draftDiversity, setDraftDiversity] = useState(
    String(circuit.output.diversityPercent ?? 100),
  );
  const [draftPowerFactor, setDraftPowerFactor] = useState(
    circuit.output.powerFactorOverride === undefined
      ? ""
      : String(circuit.output.powerFactorOverride),
  );
  const [draftReason, setDraftReason] = useState(
    circuit.output.diversityReason ?? "",
  );
  const parsedDiversity = Math.min(
    100,
    Math.max(1, Number(draftDiversity) || 1),
  );
  const parsedPowerFactor =
    draftPowerFactor === ""
      ? undefined
      : Math.min(1, Math.max(0.1, Number(draftPowerFactor) || 0.1));
  const calculation = calculateAdvancedCircuit({
    connectedWatts: outputOwnWatts(circuit.output),
    phase: circuit.output.phase,
    diversityPercent: parsedDiversity,
    calculationMethod: settings.calculationMethod,
    projectPowerFactor: settings.defaultPowerFactor,
    powerFactorOverride: parsedPowerFactor,
    nominalSinglePhaseVoltage: settings.nominalSinglePhaseVoltage,
    nominalThreePhaseVoltage: settings.nominalThreePhaseVoltage,
  });
  const diversityApplied = parsedDiversity < 100;
  const missingReason = diversityApplied && !draftReason.trim();
  const overloaded = calculation.currentAmps > circuit.output.rating;

  function saveChanges() {
    updateCircuit(
      circuit,
      {
        diversityPercent: parsedDiversity,
        powerFactorOverride: parsedPowerFactor,
        diversityReason: draftReason,
      },
      plannerState,
      setPlannerState,
    );
  }

  return (
    <div style={styles.circuitCard}>
      <div style={styles.circuitHeader}>
        <div>
          <strong>
            {displayDistroName(circuit.distro)} / {circuit.label}
          </strong>
          <span style={styles.equipment}>
            {equipmentDescription(circuit.output)}
          </span>
        </div>
        <span
          style={{
            ...styles.resultBadge,
            ...(overloaded ? styles.failedBadge : styles.passedBadge),
          }}
        >
          {overloaded ? "Overloaded" : "Within rating"}
        </span>
      </div>

      <div style={styles.readOnlyGrid}>
        <span>
          Connected <strong>{formatKw(calculation.connectedWatts)}</strong>
        </span>
        <span>
          Rating <strong>{circuit.output.rating} A</strong>
        </span>
        <span>
          Design <strong>{formatKw(calculation.diversifiedWatts)}</strong>
        </span>
        <span>
          Apparent <strong>{formatKva(calculation.apparentVa)}</strong>
        </span>
        <span>
          Current <strong>{calculation.currentAmps.toFixed(2)} A</strong>
        </span>
      </div>

      <div style={styles.editGrid}>
        <label style={styles.field}>
          <span>Diversity</span>
          <div style={styles.inputWithUnit}>
            <input
              style={{
                ...styles.input,
                ...(diversityApplied ? styles.amberInput : {}),
              }}
              type="number"
              min="1"
              max="100"
              step="1"
              value={draftDiversity}
              onChange={(event) => setDraftDiversity(event.target.value)}
            />
            <span>%</span>
          </div>
        </label>

        <label style={styles.field}>
          <span>Power factor override</span>
          <input
            style={styles.input}
            type="number"
            min="0.1"
            max="1"
            step="0.01"
            disabled={settings.calculationMethod !== "include-power-factor"}
            placeholder={`Project ${settings.defaultPowerFactor.toFixed(2)}`}
            value={draftPowerFactor}
            onChange={(event) => setDraftPowerFactor(event.target.value)}
          />
        </label>

        <label style={{ ...styles.field, ...styles.reasonField }}>
          <span>Reason / calculation notes</span>
          <input
            style={{
              ...styles.input,
              ...(missingReason ? styles.missingReasonInput : {}),
            }}
            value={draftReason}
            placeholder={
              diversityApplied ? "Optional diversity reason" : "Optional"
            }
            onChange={(event) => setDraftReason(event.target.value)}
          />
        </label>
      </div>

      <div style={styles.saveRow}>
        <span style={styles.draftText}>
          Values above are a preview until saved.
        </span>
        <button
          style={styles.saveButton}
          onClick={saveChanges}
        >
          Save changes
        </button>
      </div>
    </div>
  );
}

export function AdvancedWarningEditor({
  issue,
  plannerState,
  setPlannerState,
}: AdvancedWarningEditorProps) {
  const circuits = circuitsForIssue(issue, plannerState)
    .filter((circuit) => outputOwnWatts(circuit.output) > 0)
    .sort(
      (first, second) =>
        calculationFor(second, plannerState).currentAmps -
        calculationFor(first, plannerState).currentAmps,
    );

  if (circuits.length === 0) return null;

  return (
    <div style={styles.editor}>
      {circuits.length > 1 && (
        <span style={styles.contributorText}>
          {circuits.length} contributing circuits, ordered by calculated
          current.
        </span>
      )}
      <div style={styles.circuitList}>
        {circuits.map((circuit) => (
          <CircuitEditor
            key={`${circuit.distro.id}:${circuit.parentOutput?.id ?? ""}:${circuit.output.id}`}
            circuit={circuit}
            plannerState={plannerState}
            setPlannerState={setPlannerState}
          />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  editor: {
    gridColumn: "1 / -1",
    display: "grid",
    gap: "9px",
    marginTop: "8px",
  },
  contributorText: { color: "#667085", fontSize: "12px" },
  circuitList: { display: "grid", gap: "10px" },
  circuitCard: {
    display: "grid",
    gap: "11px",
    padding: "12px",
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    background: "#FFFFFF",
    color: "#111827",
  },
  circuitHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "flex-start",
  },
  equipment: {
    display: "block",
    marginTop: "3px",
    color: "#637083",
    fontSize: "12px",
  },
  resultBadge: {
    padding: "5px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  failedBadge: {
    border: "1px solid #FECACA",
    background: "#FFF1F1",
    color: "#B42318",
  },
  passedBadge: {
    border: "1px solid #A7F3D0",
    background: "#ECFDF5",
    color: "#047857",
  },
  readOnlyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "8px",
    color: "#526071",
    fontSize: "12px",
  },
  editGrid: {
    display: "grid",
    gridTemplateColumns: "150px 190px minmax(240px, 1fr)",
    gap: "10px",
    alignItems: "start",
  },
  field: {
    display: "grid",
    gap: "5px",
    color: "#526071",
    fontSize: "11px",
    fontWeight: 600,
  },
  reasonField: { minWidth: 0 },
  inputWithUnit: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: "5px",
  },
  input: {
    width: "100%",
    minHeight: "35px",
    padding: "6px 8px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    background: "#FFFFFF",
    color: "#111827",
  },
  amberInput: { borderColor: "#E9A23B", background: "#FFF7E6" },
  missingReasonInput: { borderColor: "#E9A23B", background: "#FFF7E6" },
  saveRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
  },
  draftText: { color: "#667085", fontSize: "11px" },
  saveButton: {
    padding: "8px 11px",
    border: "1px solid var(--lva-workspace-dark-button, #172033)",
    borderRadius: "9px",
    background: "var(--lva-workspace-dark-button, #172033)",
    color: "#FFFFFF",
    cursor: "pointer",
    fontWeight: 600,
  },
};

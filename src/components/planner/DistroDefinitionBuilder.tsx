import { useEffect, useState } from "react";
import type { DistroDefinition, PlannerOutput } from "@/planner/types";

type DistroDefinitionBuilderProps = {
  initialDefinition?: DistroDefinition;
  saveLabel?: string;
  saving?: boolean;
  onSave: (definition: DistroDefinition) => void | Promise<void>;
  onCancel?: () => void;
};

export const DISTRO_INPUT_TYPES = [
  "13A",
  "16A / 1",
  "32A / 1",
  "32A / 3",
  "63A / 3",
  "125A / 3",
  "200A / 3",
  "300A / 3",
  "400A / 3",
];

export function sourceRating(connection: string) {
  const match = connection.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function isSinglePhaseInput(connection: string) {
  return !connection.includes("/ 3");
}

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function copyOutputWithNewIds(output: PlannerOutput): PlannerOutput {
  return {
    ...output,
    id: createId("custom_output"),
    items: [],
    socaCircuits: output.socaCircuits?.map((circuit) => ({
      ...circuit,
      id: createId("custom_soca_socket"),
      items: [],
    })),
  };
}

export function cloneDistroDefinition(
  definition: DistroDefinition,
  name = definition.name,
): DistroDefinition {
  return {
    ...definition,
    name,
    outputs: definition.outputs.map(copyOutputWithNewIds),
  };
}

function createSinglePhaseOutput(
  number: number,
  phase: "L1" | "L2" | "L3",
  rating: number,
): PlannerOutput {
  return {
    id: createId("custom_output"),
    label: String(number),
    phase,
    type: `${rating}A / 1`,
    rating,
    items: [],
    notes: "",
  };
}

function createThreePhaseOutput(number: number, rating: number): PlannerOutput {
  return {
    id: createId("custom_output"),
    label: `${number} ${rating}/3`,
    displayName: `Output ${number} – ${rating}/3`,
    phase: "3Φ",
    type: `${rating}A / 3`,
    rating,
    items: [],
    notes: "",
  };
}

function createSocapexOutput(
  number: number,
  breakerPair: string | null = null,
): PlannerOutput {
  const circuits: PlannerOutput[] = [];

  ([
    ["L1", [1, 4]],
    ["L2", [2, 5]],
    ["L3", [3, 6]],
  ] as const).forEach(([phase, circuitNumbers]) => {
    circuitNumbers.forEach((circuitNumber) => {
      circuits.push({
        id: createId("custom_soca_socket"),
        label: `${number} - ${circuitNumber}`,
        phase,
        circuitNo: circuitNumber,
        type: "16A / 1",
        rating: 16,
        items: [],
        notes: "",
      });
    });
  });

  return {
    id: createId("custom_soca"),
    outputNumber: number,
    label: `Socapex ${number}`,
    phase: "Socapex",
    type: "Socapex",
    rating: 32,
    items: [],
    notes: "",
    breakerPair,
    socaCircuits: circuits,
    detail: "2 × 16A sockets per phase · L1 1 & 4 · L2 2 & 5 · L3 3 & 6",
  };
}

function outputLabel(output: PlannerOutput) {
  if (output.phase === "Socapex") return output.label;
  if (output.phase === "3Φ") return output.displayName ?? output.label;
  return `${output.label} - ${output.rating}A`;
}

export function DistroDefinitionBuilder({
  initialDefinition,
  saveLabel = "Save Distro",
  saving = false,
  onSave,
  onCancel,
}: DistroDefinitionBuilderProps) {
  const [name, setName] = useState(initialDefinition?.name ?? "");
  const [input, setInput] = useState(initialDefinition?.input ?? "32A / 3");
  const [singlePhaseRating, setSinglePhaseRating] = useState("16");
  const [singlePhasePhase, setSinglePhasePhase] =
    useState<"L1" | "L2" | "L3">("L1");
  const [threePhaseRating, setThreePhaseRating] = useState("32");
  const [outputs, setOutputs] = useState<PlannerOutput[]>(
    initialDefinition?.outputs ?? [],
  );
  const singlePhaseInput = isSinglePhaseInput(input);

  useEffect(() => {
    setName(initialDefinition?.name ?? "");
    setInput(initialDefinition?.input ?? "32A / 3");
    setOutputs(initialDefinition?.outputs ?? []);
  }, [initialDefinition]);

  function addSinglePhaseOutput() {
    const rating = Number(singlePhaseRating);
    setOutputs((current) => [
      ...current,
      createSinglePhaseOutput(current.length + 1, singlePhasePhase, rating),
    ]);
  }

  function addThreePhaseOutput() {
    const rating = Number(threePhaseRating);
    setOutputs((current) => [
      ...current,
      createThreePhaseOutput(current.length + 1, rating),
    ]);
  }

  function addSocapexOutput() {
    setOutputs((current) => [
      ...current,
      createSocapexOutput(
        current.filter((output) => output.phase === "Socapex").length + 1,
      ),
    ]);
  }

  function addTwinSocapexOutput() {
    setOutputs((current) => {
      const firstNumber =
        current.filter((output) => output.phase === "Socapex").length + 1;
      const breakerPair = `custom_pair_${createId("soca")}`;

      return [
        ...current,
        createSocapexOutput(firstNumber, breakerPair),
        createSocapexOutput(firstNumber + 1, breakerPair),
      ];
    });
  }

  function moveOutput(outputId: string, direction: -1 | 1) {
    setOutputs((current) => {
      const currentIndex = current.findIndex((output) => output.id === outputId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  async function save() {
    const cleanName = name.trim();
    if (!cleanName) {
      alert("Please enter a distro name.");
      return;
    }
    if (outputs.length === 0) {
      alert("Please add at least one output.");
      return;
    }
    if (
      singlePhaseInput &&
      outputs.some(
        (output) => output.phase === "3Φ" || output.phase === "Socapex",
      )
    ) {
      alert(
        "A single-phase distro cannot contain three-phase or Socapex outputs. Please remove those outputs before saving.",
      );
      return;
    }

    const normalisedOutputs = singlePhaseInput
      ? outputs.map((output) => ({ ...output, phase: "L1" as const }))
      : outputs;

    await onSave({
      ...initialDefinition,
      name: cleanName,
      input,
      inputA: sourceRating(input),
      outputs: normalisedOutputs,
      custom: initialDefinition?.custom,
    });
  }

  return (
    <div style={styles.builder}>
      <div style={styles.setupGrid}>
        <label style={styles.label}>
          Distro Name
          <input style={styles.input} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label style={styles.label}>
          Input Type
          <select style={styles.input} value={input} onChange={(event) => setInput(event.target.value)}>
            {DISTRO_INPUT_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label style={styles.label}>
          Amps Per Phase
          <input style={styles.input} value={sourceRating(input)} readOnly />
        </label>
      </div>

      <section style={styles.panel}>
        <h3 style={styles.heading}>Add Outputs</h3>
        <div
          style={
            singlePhaseInput
              ? { ...styles.controlsGrid, gridTemplateColumns: "minmax(0, 1fr)" }
              : styles.controlsGrid
          }
        >
          <div style={styles.controlCard}>
            <h4 style={styles.heading}>Single-Phase Output</h4>
            <div style={styles.inlineFields}>
              <label style={styles.label}>Phase
                <select style={styles.input} value={singlePhaseInput ? "L1" : singlePhasePhase} disabled={singlePhaseInput} onChange={(event) => setSinglePhasePhase(event.target.value as "L1" | "L2" | "L3")}>
                  {singlePhaseInput ? <option value="L1">Single phase</option> : <><option>L1</option><option>L2</option><option>L3</option></>}
                </select>
              </label>
              <label style={styles.label}>Rating
                <select style={styles.input} value={singlePhaseRating} onChange={(event) => setSinglePhaseRating(event.target.value)}>
                  <option value="13">13A</option><option value="16">16A</option><option value="32">32A</option><option value="63">63A</option>
                </select>
              </label>
            </div>
            <button style={styles.secondaryButton} onClick={addSinglePhaseOutput}>Add Single-Phase</button>
          </div>
          {!singlePhaseInput && (
            <>
              <div style={styles.controlCard}>
                <h4 style={styles.heading}>Three-Phase Output</h4>
                <label style={styles.label}>Rating
                  <select style={styles.input} value={threePhaseRating} onChange={(event) => setThreePhaseRating(event.target.value)}>
                    <option value="32">32/3</option><option value="63">63/3</option><option value="125">125/3</option><option value="400">Powerlock</option>
                  </select>
                </label>
                <button style={styles.secondaryButton} onClick={addThreePhaseOutput}>Add Three-Phase</button>
              </div>
              <div style={styles.controlCard}>
                <h4 style={styles.heading}>Socapex Outputs</h4>
                <p style={styles.muted}>Single adds one six-circuit output. Twin adds two Socapex outputs whose matching circuits share breakers.</p>
                <div style={styles.socapexActions}>
                  <button style={styles.secondaryButton} onClick={addSocapexOutput}>Add Single Socapex Output</button>
                  <button style={styles.secondaryButton} onClick={addTwinSocapexOutput}>Add Twin Socapex Output</button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section>
        <h3 style={styles.heading}>Distro Layout</h3>
        {outputs.length === 0 ? <p style={styles.muted}>No outputs added yet.</p> : (
          <div style={styles.outputList}>
            {outputs.map((output, index) => (
              <div key={output.id} style={styles.outputRow}>
                <div><strong>{index + 1}. {outputLabel(output)}</strong><p style={styles.mutedSmall}>{output.phase} · {output.type} · {output.rating}A{output.breakerPair ? " · Twin shared breakers" : ""}</p></div>
                <div style={styles.actions}>
                  <button style={styles.iconButton} onClick={() => moveOutput(output.id, -1)} disabled={index === 0} aria-label="Move output up">↑</button>
                  <button style={styles.iconButton} onClick={() => moveOutput(output.id, 1)} disabled={index === outputs.length - 1} aria-label="Move output down">↓</button>
                  <button style={styles.dangerButton} onClick={() => setOutputs((current) => current.filter((item) => item.id !== output.id))}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div style={styles.saveActions}>
        {onCancel && (
          <button style={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button style={styles.primaryButton} onClick={save} disabled={saving}>{saving ? "Saving…" : saveLabel}</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  builder: { display: "grid", gap: "20px" },
  setupGrid: { display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 220px 140px", gap: "12px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", color: "#637083", fontWeight: 400 },
  input: { width: "100%", minHeight: "44px", padding: "0 12px", borderRadius: "10px", border: "1px solid #d9e0ea", background: "white", boxSizing: "border-box", font: "inherit", fontWeight: 400 },
  panel: { padding: "16px", border: "1px solid #d9e0ea", borderRadius: "14px", background: "#f8fafc" },
  heading: { margin: "0 0 12px" },
  controlsGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  controlCard: { padding: "14px", border: "1px solid #d9e0ea", borderRadius: "12px", background: "white" },
  inlineFields: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  muted: { color: "#637083", margin: "6px 0 12px" },
  mutedSmall: { color: "#637083", margin: "4px 0 0", fontSize: "13px" },
  socapexActions: { display: "grid", gap: "8px" },
  outputList: { display: "grid", gap: "8px" },
  outputRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px", border: "1px solid #d9e0ea", borderRadius: "12px", background: "#f8fafc" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  saveActions: { display: "flex", justifyContent: "flex-end", gap: "8px" },
  primaryButton: { minHeight: "44px", padding: "0 16px", borderRadius: "10px", border: "1px solid var(--lva-workspace-dark-button, #172033)", background: "var(--lva-workspace-dark-button, #172033)", color: "white", cursor: "pointer", font: "inherit", fontWeight: 600 },
  secondaryButton: { minHeight: "40px", marginTop: "12px", padding: "0 14px", borderRadius: "10px", border: "1px solid #d9e0ea", background: "white", color: "#172033", cursor: "pointer", font: "inherit", fontWeight: 500 },
  cancelButton: { minHeight: "44px", marginTop: 0, padding: "0 16px", borderRadius: "10px", border: "1px solid #d9e0ea", background: "white", color: "#172033", cursor: "pointer", font: "inherit", fontWeight: 500 },
  iconButton: { width: "38px", height: "38px", borderRadius: "9px", border: "1px solid #d9e0ea", background: "white", cursor: "pointer" },
  dangerButton: { minHeight: "38px", padding: "0 12px", borderRadius: "9px", border: "1px solid #c53030", background: "#fff5f5", color: "#c53030", cursor: "pointer", font: "inherit", fontWeight: 500 },
};

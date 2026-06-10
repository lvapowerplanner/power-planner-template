import { useState } from "react";
import type {
  DistroDefinition,
  PlannerOutput,
  PlannerState,
} from "@/planner/types";

type CustomDistrosTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
};

const inputTypes = [
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

function sourceRating(connection: string) {
  const match = connection.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function createOutputId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createSinglePhaseOutput(
  number: number,
  phase: "L1" | "L2" | "L3",
  rating: number
): PlannerOutput {
  return {
    id: createOutputId("custom_output"),
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
    id: createOutputId("custom_output"),
    label: `${number} ${rating}/3`,
    displayName: `Output ${number} – ${rating}/3`,
    phase: "3Φ",
    type: `${rating}A / 3`,
    rating,
    items: [],
    notes: "",
  };
}

function createSocapexOutput(number: number): PlannerOutput {
  const circuits: PlannerOutput[] = [];

  (
    [
      ["L1", [1, 4]],
      ["L2", [2, 5]],
      ["L3", [3, 6]],
    ] as const
  ).forEach(([phase, circuitNumbers]) => {
    circuitNumbers.forEach((circuitNumber) => {
      circuits.push({
        id: createOutputId("custom_soca_socket"),
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
    id: createOutputId("custom_soca"),
    outputNumber: number,
    label: `Socapex ${number}`,
    phase: "Socapex",
    type: "Socapex",
    rating: 32,
    items: [],
    notes: "",
    breakerPair: null,
    socaCircuits: circuits,
    detail: "2 × 16A sockets per phase · L1 1 & 4 · L2 2 & 5 · L3 3 & 6",
  };
}

export function CustomDistrosTab({
  plannerState,
  setPlannerState,
}: CustomDistrosTabProps) {
  const [name, setName] = useState("");
  const [input, setInput] = useState("32A / 3");

  const [singlePhaseRating, setSinglePhaseRating] = useState("16");
  const [singlePhasePhase, setSinglePhasePhase] =
    useState<"L1" | "L2" | "L3">("L1");

  const [threePhaseRating, setThreePhaseRating] = useState("32");

  const [outputs, setOutputs] = useState<PlannerOutput[]>([]);

  function addSinglePhaseOutput() {
    const rating = Number(singlePhaseRating);

    if (!Number.isFinite(rating) || rating <= 0) {
      alert("Please enter a valid single-phase output rating.");
      return;
    }

    setOutputs([
      ...outputs,
      createSinglePhaseOutput(outputs.length + 1, singlePhasePhase, rating),
    ]);
  }

  function addThreePhaseOutput() {
    const rating = Number(threePhaseRating);

    if (!Number.isFinite(rating) || rating <= 0) {
      alert("Please enter a valid three-phase output rating.");
      return;
    }

    setOutputs([...outputs, createThreePhaseOutput(outputs.length + 1, rating)]);
  }

  function addSocapexOutput() {
    const socaNumber =
      outputs.filter((output) => output.phase === "Socapex").length + 1;

    setOutputs([...outputs, createSocapexOutput(socaNumber)]);
  }

  function removeOutput(outputId: string) {
    setOutputs(outputs.filter((output) => output.id !== outputId));
  }

  function moveOutput(outputId: string, direction: -1 | 1) {
    const currentIndex = outputs.findIndex((output) => output.id === outputId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= outputs.length) {
      return;
    }

    const nextOutputs = [...outputs];
    const [movedOutput] = nextOutputs.splice(currentIndex, 1);
    nextOutputs.splice(targetIndex, 0, movedOutput);

    setOutputs(nextOutputs);
  }

  function saveCustomDistro() {
    const cleanName = name.trim();

    if (!cleanName) {
      alert("Please enter a custom distro name.");
      return;
    }

    if (outputs.length === 0) {
      alert("Please add at least one output.");
      return;
    }

    const newCustomDistro: DistroDefinition = {
      name: cleanName,
      input,
      inputA: sourceRating(input),
      outputs,
      custom: true,
    };

    setPlannerState({
      ...plannerState,
      customDistros: [...plannerState.customDistros, newCustomDistro],
    });

    setName("");
    setInput("32A / 3");
    setOutputs([]);
  }

  function deleteCustomDistro(index: number) {
    if (!confirm("Delete this custom distro?")) return;

    setPlannerState({
      ...plannerState,
      customDistros: plannerState.customDistros.filter(
        (_distro, distroIndex) => distroIndex !== index
      ),
    });
  }

  return (
    <section style={styles.card}>
      <h2>Custom Distros</h2>
      <p style={styles.muted}>
        Build project-specific distro templates. Saved custom distros appear in
        the Distro Overview add list prefixed with “Custom:”.
      </p>

      <div style={styles.setupGrid}>
        <label style={styles.label}>
          Distro Name
          <input
            style={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. FOH Breakout"
          />
        </label>

        <label style={styles.label}>
          Input Type
          <select
            style={styles.input}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          >
            {inputTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Amps Per Phase
          <input
            style={styles.input}
            value={sourceRating(input)}
            readOnly
          />
        </label>
      </div>

      <section style={styles.builderPanel}>
        <h3>Add Outputs</h3>

        <div style={styles.outputControlsGrid}>
          <div style={styles.outputControlCard}>
            <h4>Single-Phase Output</h4>

            <label style={styles.label}>
              Phase
              <select
                style={styles.input}
                value={singlePhasePhase}
                onChange={(event) =>
                  setSinglePhasePhase(event.target.value as "L1" | "L2" | "L3")
                }
              >
                <option value="L1">L1</option>
                <option value="L2">L2</option>
                <option value="L3">L3</option>
              </select>
            </label>

            <label style={styles.label}>
              Rating
              <select
                style={styles.input}
                value={singlePhaseRating}
                onChange={(event) => setSinglePhaseRating(event.target.value)}
              >
                <option value="13">13A</option>
                <option value="16">16A</option>
                <option value="32">32A</option>
                <option value="63">63A</option>
              </select>
            </label>

            <button style={styles.button} onClick={addSinglePhaseOutput}>
              Add Single-Phase Output
            </button>
          </div>

          <div style={styles.outputControlCard}>
            <h4>Three-Phase Output</h4>

            <label style={styles.label}>
              Rating
              <select
                style={styles.input}
                value={threePhaseRating}
                onChange={(event) => setThreePhaseRating(event.target.value)}
              >
                <option value="32">32/3</option>
                <option value="63">63/3</option>
                <option value="125">125/3</option>
                <option value="400">Powerlock</option>
              </select>
            </label>

            <button style={styles.button} onClick={addThreePhaseOutput}>
              Add Three-Phase Output
            </button>
          </div>

          <div style={styles.outputControlCard}>
            <h4>Socapex Output</h4>
            <p style={styles.muted}>
              Adds the default 6-circuit Socapex layout with two 16A sockets per
              phase.
            </p>

            <button style={styles.button} onClick={addSocapexOutput}>
              Add Socapex Output
            </button>
          </div>
        </div>
      </section>

      <section style={styles.previewPanel}>
        <h3>Current Custom Distro Layout</h3>

        {outputs.length === 0 ? (
          <p style={styles.muted}>No outputs added yet.</p>
        ) : (
          <div style={styles.outputPreviewList}>
            {outputs.map((output, index) => (
              <div key={output.id} style={styles.outputPreviewCard}>
                <div>
                  <strong>
                    {index + 1}. {outputLabel(output)}
                  </strong>
                  <p style={styles.muted}>
                    {output.phase} · {output.type} · {output.rating}A
                  </p>
                </div>

                <div style={styles.actions}>
                  <button
                    style={styles.smallButton}
                    onClick={() => moveOutput(output.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    style={styles.smallButton}
                    onClick={() => moveOutput(output.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    style={styles.dangerButton}
                    onClick={() => removeOutput(output.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button style={styles.primaryButton} onClick={saveCustomDistro}>
          Save Custom Distro
        </button>
      </section>

      <hr style={styles.divider} />

      <h3>Saved Custom Distros</h3>

      {plannerState.customDistros.length === 0 ? (
        <p style={styles.muted}>No custom distros saved yet.</p>
      ) : (
        <div style={styles.savedList}>
          {plannerState.customDistros.map((distro, index) => (
            <div key={`${distro.name}-${index}`} style={styles.savedCard}>
              <div>
                <strong>Custom: {distro.name}</strong>
                <p style={styles.muted}>
                  Input {distro.input} · {distro.outputs.length} outputs
                </p>
              </div>

              <button
                style={styles.dangerButton}
                onClick={() => deleteCustomDistro(index)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function outputLabel(output: PlannerOutput) {
  if (output.phase === "Socapex") return output.label;
  if (output.phase === "3Φ") return output.displayName ?? output.label;
  return `${output.label} - ${output.rating}a`;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #d9e0ea",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
  },
  muted: {
    color: "#637083",
  },
  setupGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 220px 140px",
    gap: "12px",
    marginTop: "16px",
  },
  label: {
    display: "block",
    color: "#637083",
    fontWeight: 700,
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
  },
  builderPanel: {
    marginTop: "22px",
    padding: "16px",
    border: "1px solid #d9e0ea",
    borderRadius: "16px",
    background: "#f8fafc",
  },
  outputControlsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },
  outputControlCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "white",
  },
  button: {
    marginTop: "12px",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #172033",
    background: "#172033",
    color: "white",
    cursor: "pointer",
  },
  primaryButton: {
    marginTop: "16px",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #172033",
    background: "#172033",
    color: "white",
    cursor: "pointer",
  },
  smallButton: {
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
  },
  dangerButton: {
    padding: "8px 10px",
    borderRadius: "10px",
    border: "1px solid #c53030",
    background: "#fff5f5",
    color: "#c53030",
    cursor: "pointer",
  },
  previewPanel: {
    marginTop: "22px",
  },
  outputPreviewList: {
    display: "grid",
    gap: "10px",
  },
  outputPreviewCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  actions: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  divider: {
    border: 0,
    borderTop: "1px solid #d9e0ea",
    margin: "22px 0",
  },
  savedList: {
    display: "grid",
    gap: "10px",
  },
  savedCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
};
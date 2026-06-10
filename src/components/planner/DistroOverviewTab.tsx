import { useState } from "react";
import { distroLibrary } from "@/planner/distroLibrary";
import type {
  DistroDefinition,
  PlannerState,
  ProjectDistro,
} from "@/planner/types";

type DistroOverviewTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  openDistroEditor: (distroId: string) => void;
};

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneDistro(definition: DistroDefinition): DistroDefinition {
  return JSON.parse(JSON.stringify(definition)) as DistroDefinition;
}

function displayDistroName(distro: ProjectDistro) {
  return distro.instanceName.trim()
    ? `${distro.instanceName} - ${distro.name}`
    : distro.name;
}

export function DistroOverviewTab({
  plannerState,
  setPlannerState,
  openDistroEditor,
}: DistroOverviewTabProps) {
  const sortedDistroLibrary = [...distroLibrary].sort(
    (a, b) => a.inputA - b.inputA || a.name.localeCompare(b.name)
  );

  const [selectedDistroIndex, setSelectedDistroIndex] = useState("0");

  function addDistro() {
    const definition = cloneDistro(
      sortedDistroLibrary[Number(selectedDistroIndex)]
    );

    const newDistro: ProjectDistro = {
      ...definition,
      id: createId("distro"),
      instanceName: "",
      sourceId: "",
      location: "",
      notes: "",
    };

    setPlannerState({
      ...plannerState,
      distros: [...plannerState.distros, newDistro],
      active: newDistro.id,
    });
  }

  function deleteDistro(distroId: string) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.filter((distro) => distro.id !== distroId),
      active:
        plannerState.active === distroId
          ? plannerState.distros.find((distro) => distro.id !== distroId)?.id ??
            null
          : plannerState.active,
    });
  }

  function updateDistroName(distroId: string, value: string) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) =>
        distro.id === distroId ? { ...distro, instanceName: value } : distro
      ),
    });
  }

  function updateDistroLocation(distroId: string, value: string) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) =>
        distro.id === distroId ? { ...distro, location: value } : distro
      ),
    });
  }

  function updateDistroSource(distroId: string, value: string) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) =>
        distro.id === distroId ? { ...distro, sourceId: value } : distro
      ),
    });
  }

  return (
    <section style={styles.card}>
      <h2>Distro Overview</h2>
      <p style={styles.muted}>
        Add distros from the library and assign them to power sources.
      </p>

      <div style={styles.addPanel}>
        <label style={styles.label}>
          Distro Type
          <select
            style={styles.input}
            value={selectedDistroIndex}
            onChange={(event) => setSelectedDistroIndex(event.target.value)}
          >
            {sortedDistroLibrary.map((distro, index) => (
              <option key={`${distro.name}-${index}`} value={index}>
                {distro.name} — {distro.input}
              </option>
            ))}
          </select>
        </label>

        <button style={styles.button} onClick={addDistro}>
          Add Distro
        </button>
      </div>

      <hr style={styles.divider} />

      {plannerState.distros.length === 0 ? (
        <p style={styles.muted}>No distros added yet.</p>
      ) : (
        <div style={styles.list}>
          {plannerState.distros.map((distro) => (
            <div key={distro.id} style={styles.distroCard}>
              <div style={styles.headerRow}>
                <div>
                  <strong>{displayDistroName(distro)}</strong>
                  <p style={styles.muted}>
                    {distro.name} · Input {distro.input} ·{" "}
                    {distro.outputs.length} outputs
                  </p>
                </div>

                <div style={styles.row}>
                  <button
                    style={styles.secondaryButton}
                    onClick={() => openDistroEditor(distro.id)}
                  >
                    Open
                  </button>
                  <button
                    style={styles.dangerButton}
                    onClick={() => deleteDistro(distro.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Name
                  <input
                    style={styles.input}
                    value={distro.instanceName}
                    onChange={(event) =>
                      updateDistroName(distro.id, event.target.value)
                    }
                    placeholder="Optional name"
                  />
                </label>

                <label style={styles.label}>
                  Location
                  <input
                    style={styles.input}
                    value={distro.location}
                    onChange={(event) =>
                      updateDistroLocation(distro.id, event.target.value)
                    }
                    placeholder="e.g. Stage Left"
                  />
                </label>

                <label style={styles.label}>
                  Source
                  <select
                    style={styles.input}
                    value={distro.sourceId}
                    onChange={(event) =>
                      updateDistroSource(distro.id, event.target.value)
                    }
                  >
                    <option value="">No source selected</option>
                    {plannerState.sources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.name} — {source.conn}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
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
  addPanel: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "12px",
    alignItems: "end",
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
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #172033",
    background: "#172033",
    color: "white",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
  },
  dangerButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #c53030",
    background: "#fff5f5",
    color: "#c53030",
    cursor: "pointer",
  },
  divider: {
    border: 0,
    borderTop: "1px solid #d9e0ea",
    margin: "22px 0",
  },
  list: {
    display: "grid",
    gap: "12px",
  },
  distroCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "14px",
  },
  row: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "12px",
  },
};
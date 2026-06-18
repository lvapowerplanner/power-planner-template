import { useState } from "react";
import { autoSourcesForDistro } from "@/planner/autoSources";
import { useCompanyDistroLibrary } from "@/planner/companyStock";
import type {
  DistroDefinition,
  PlannerState,
  PowerSource,
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

function normaliseConnection(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function allDistroDefinitions(
  plannerState: PlannerState,
  companyDistroLibrary: DistroDefinition[]
): DistroDefinition[] {
  return [
    ...companyDistroLibrary,
    ...plannerState.customDistros.map((distro) => ({
      ...distro,
      name: `Custom: ${distro.name}`,
      custom: true,
    })),
  ].sort((a, b) => a.inputA - b.inputA || a.name.localeCompare(b.name));
}

function sourceIsUsedByOtherDistro(
  plannerState: PlannerState,
  sourceId: string,
  currentDistroId: string
) {
  return plannerState.distros.some(
    (distro) => distro.id !== currentDistroId && distro.sourceId === sourceId
  );
}

function sourceBelongsToDistroOwnOutput(source: PowerSource, distroId: string) {
  return source.auto && source.parentDistroId === distroId;
}

export function DistroOverviewTab({
  plannerState,
  setPlannerState,
  openDistroEditor,
}: DistroOverviewTabProps) {
  const { distroLibrary, loadingDistros } = useCompanyDistroLibrary();
  const distroDefinitions = allDistroDefinitions(plannerState, distroLibrary);
  const [selectedDistroIndex, setSelectedDistroIndex] = useState("0");

  const allAvailableSources = [
    ...plannerState.sources.filter((source) => !source.auto),
    ...plannerState.distros.flatMap((distro) => autoSourcesForDistro(distro)),
  ];

  function addDistro() {
    const selectedDefinition = distroDefinitions[Number(selectedDistroIndex)];

    if (!selectedDefinition) return;

    const definition = cloneDistro(selectedDefinition);
    const cleanName = definition.name.replace(/^Custom:\s*/, "");

    const newDistro: ProjectDistro = {
      ...definition,
      name: cleanName,
      id: createId("distro"),
      instanceName: "",
      sourceId: "",
      location: "",
      notes: "",
      outputs: definition.outputs.map((output) => ({
        ...output,
        items: [],
        notes: output.notes ?? "",
        socaCircuits: output.socaCircuits?.map((socket) => ({
          ...socket,
          items: [],
          notes: socket.notes ?? "",
        })),
      })),
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
        Add distros from the company Supabase library or project custom distros.
      </p>

      <div style={styles.addPanel}>
        <label style={styles.label}>
          Distro Type
          <select
            style={styles.input}
            value={selectedDistroIndex}
            onChange={(event) => setSelectedDistroIndex(event.target.value)}
            disabled={loadingDistros || distroDefinitions.length === 0}
          >
            {distroDefinitions.map((distro, index) => (
              <option key={`${distro.name}-${index}`} value={index}>
                {distro.name} — {distro.input}
              </option>
            ))}
          </select>
        </label>

        <button
          style={styles.button}
          onClick={addDistro}
          disabled={loadingDistros || distroDefinitions.length === 0}
        >
          Add Distro
        </button>
      </div>

      {loadingDistros ? (
        <p style={styles.muted}>Loading company distro library…</p>
      ) : distroDefinitions.length === 0 ? (
        <p style={styles.muted}>
          No company distros found. Add rows to the Supabase distro table.
        </p>
      ) : null}

      <hr style={styles.divider} />

      {plannerState.distros.length === 0 ? (
        <p style={styles.muted}>No distros added yet.</p>
      ) : (
        <div style={styles.list}>
          {plannerState.distros.map((distro) => {
            const availableSources = allAvailableSources.filter((source) => {
              const compatible =
                normaliseConnection(source.conn) ===
                normaliseConnection(distro.input);

              if (!compatible) return false;

              if (sourceBelongsToDistroOwnOutput(source, distro.id)) {
                return false;
              }

              if (
                source.id !== distro.sourceId &&
                sourceIsUsedByOtherDistro(plannerState, source.id, distro.id)
              ) {
                return false;
              }

              return true;
            });

            return (
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
                      {availableSources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.auto ? "Auto: " : ""}
                          {source.name} — {source.conn}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
  },
  muted: {
    color: "#667085",
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
    color: "#667085",
    fontWeight: 700,
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
  },
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #000000",
    background: "#000000",
    color: "#ffffff",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
  },
  dangerButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #E5484D",
    background: "#FFF1F1",
    color: "#E5484D",
    cursor: "pointer",
  },
  divider: {
    border: 0,
    borderTop: "1px solid #DCE5EC",
    margin: "22px 0",
  },
  list: {
    display: "grid",
    gap: "12px",
  },
  distroCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    padding: "14px",
    background: "#F5F7FA",
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
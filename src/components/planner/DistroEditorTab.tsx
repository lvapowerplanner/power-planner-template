import type { PlannerOutput, PlannerState, ProjectDistro } from "@/planner/types";

type DistroEditorTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  goToDistroOverview: () => void;
};

function displayDistroName(distro: ProjectDistro) {
  return distro.instanceName.trim()
    ? `${distro.instanceName} - ${distro.name}`
    : distro.name;
}

function outputTitle(output: PlannerOutput, index: number) {
  if (output.displayName) return output.displayName;

  if (output.phase === "Socapex") {
    return `Soca ${output.outputNumber ?? index + 1}`;
  }

  if (output.phase === "3Φ") {
    return `${index + 1} - ${output.rating}/3`;
  }

  return `${index + 1} - ${output.rating}a`;
}

function socapexSocketTitle(socket: PlannerOutput) {
  return socket.label;
}

export function DistroEditorTab({
  plannerState,
  setPlannerState,
  goToDistroOverview,
}: DistroEditorTabProps) {
  const activeDistro =
    plannerState.distros.find((distro) => distro.id === plannerState.active) ??
    plannerState.distros[0];

  function updateDistro(updatedDistro: ProjectDistro) {
    setPlannerState({
      ...plannerState,
      active: updatedDistro.id,
      distros: plannerState.distros.map((distro) =>
        distro.id === updatedDistro.id ? updatedDistro : distro
      ),
    });
  }

  function updateOutputNotes(outputId: string, notes: string) {
    if (!activeDistro) return;

    updateDistro({
      ...activeDistro,
      outputs: activeDistro.outputs.map((output) =>
        output.id === outputId ? { ...output, notes } : output
      ),
    });
  }

  function updateSocapexSocketNotes(
    socapexOutputId: string,
    socketId: string,
    notes: string
  ) {
    if (!activeDistro) return;

    updateDistro({
      ...activeDistro,
      outputs: activeDistro.outputs.map((output) => {
        if (output.id !== socapexOutputId) return output;

        return {
          ...output,
          socaCircuits: output.socaCircuits?.map((socket) =>
            socket.id === socketId ? { ...socket, notes } : socket
          ),
        };
      }),
    });
  }

  if (!activeDistro) {
    return (
      <section style={styles.card}>
        <h2>Distro Editor</h2>
        <p style={styles.muted}>No distro selected.</p>
        <button style={styles.button} onClick={goToDistroOverview}>
          Go to Distro Overview
        </button>
      </section>
    );
  }

  const availableSources = plannerState.sources.filter(
    (source) =>
      source.conn.replace(/\s+/g, "") === activeDistro.input.replace(/\s+/g, "")
  );

  const singlePhaseOutputs = activeDistro.outputs.filter(
    (output) => output.phase !== "3Φ" && output.phase !== "Socapex"
  );

  const socapexOutputs = activeDistro.outputs.filter(
    (output) => output.phase === "Socapex"
  );

  const threePhaseOutputs = activeDistro.outputs.filter(
    (output) => output.phase === "3Φ"
  );

  return (
    <section style={styles.card}>
      <div style={styles.headerRow}>
        <div>
          <h2>Distro Editor</h2>
          <p style={styles.muted}>{displayDistroName(activeDistro)}</p>
        </div>

        <button style={styles.secondaryButton} onClick={goToDistroOverview}>
          Back to Distro Overview
        </button>
      </div>

      <hr style={styles.divider} />

      <div style={styles.controlsGrid}>
        <label style={styles.label}>
          Distro Name
          <input
            style={styles.input}
            value={activeDistro.instanceName}
            onChange={(event) =>
              updateDistro({
                ...activeDistro,
                instanceName: event.target.value,
              })
            }
            placeholder="Optional name"
          />
        </label>

        <label style={styles.label}>
          Location
          <input
            style={styles.input}
            value={activeDistro.location}
            onChange={(event) =>
              updateDistro({
                ...activeDistro,
                location: event.target.value,
              })
            }
            placeholder="e.g. Stage Left"
          />
        </label>

        <label style={styles.label}>
          Source
          <select
            style={styles.input}
            value={activeDistro.sourceId}
            onChange={(event) =>
              updateDistro({
                ...activeDistro,
                sourceId: event.target.value,
              })
            }
          >
            <option value="">No source selected</option>
            {availableSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name} — {source.conn}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={styles.label}>
        Distro Notes
        <textarea
          style={styles.textarea}
          value={activeDistro.notes}
          onChange={(event) =>
            updateDistro({
              ...activeDistro,
              notes: event.target.value,
            })
          }
          placeholder="Notes for this distro"
        />
      </label>

      {singlePhaseOutputs.length > 0 && (
        <section style={styles.sectionBlock}>
          <h3 style={styles.sectionTitle}>Single Phase Outputs</h3>

          <div style={styles.phaseGrid}>
            {(["L1", "L2", "L3"] as const).map((phase) => {
              const phaseOutputs = singlePhaseOutputs.filter(
                (output) => output.phase === phase
              );

              if (phaseOutputs.length === 0) return null;

              return (
                <div key={phase} style={styles.phaseColumn}>
                  <h4 style={styles.phaseTitle}>{phase}</h4>

                  <div style={styles.outputList}>
                    {phaseOutputs.map((output) => {
                      const outputIndex = activeDistro.outputs.findIndex(
                        (item) => item.id === output.id
                      );

                      return (
                        <div key={output.id} style={styles.outputCard}>
                          <div style={styles.outputHeader}>
                            <strong>{outputTitle(output, outputIndex)}</strong>
                            <span style={styles.pill}>{output.type}</span>
                          </div>

                          <p style={styles.muted}>
                            Rating {output.rating}A · Assigned items{" "}
                            {output.items.length}
                          </p>

                          <label style={styles.smallLabel}>
                            Output Notes
                            <textarea
                              style={styles.smallTextarea}
                              value={output.notes ?? ""}
                              onChange={(event) =>
                                updateOutputNotes(
                                  output.id,
                                  event.target.value
                                )
                              }
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {socapexOutputs.length > 0 && (
        <section style={styles.sectionBlock}>
          <h3 style={styles.sectionTitle}>Socapex Outputs</h3>

          <div style={styles.socapexList}>
            {socapexOutputs.map((output) => {
              const outputIndex = activeDistro.outputs.findIndex(
                (item) => item.id === output.id
              );

              return (
                <div key={output.id} style={styles.socapexCard}>
                  <div style={styles.outputHeader}>
                    <strong>{outputTitle(output, outputIndex)}</strong>
                    <span style={styles.pill}>Socapex</span>
                  </div>

                  {output.detail && (
                    <p style={styles.muted}>{output.detail}</p>
                  )}

                  <label style={styles.smallLabel}>
                    Socapex Output Notes
                    <textarea
                      style={styles.smallTextarea}
                      value={output.notes ?? ""}
                      onChange={(event) =>
                        updateOutputNotes(output.id, event.target.value)
                      }
                    />
                  </label>

                  <div style={styles.socapexSocketGrid}>
                    {(["L1", "L2", "L3"] as const).map((phase) => {
                      const sockets = (output.socaCircuits ?? [])
                        .filter((socket) => socket.phase === phase)
                        .sort(
                          (a, b) => (a.circuitNo ?? 0) - (b.circuitNo ?? 0)
                        );

                      return (
                        <div key={phase} style={styles.socapexPhaseColumn}>
                          <h4 style={styles.phaseTitle}>{phase}</h4>

                          <div style={styles.outputList}>
                            {sockets.map((socket) => (
                              <div key={socket.id} style={styles.socketCard}>
                                <div style={styles.outputHeader}>
                                  <strong>{socapexSocketTitle(socket)}</strong>
                                  <span style={styles.pill}>{socket.type}</span>
                                </div>

                                <p style={styles.muted}>
                                  Rating {socket.rating}A · Assigned items{" "}
                                  {socket.items.length}
                                </p>

                                <label style={styles.smallLabel}>
                                  Socket Notes
                                  <textarea
                                    style={styles.smallTextarea}
                                    value={socket.notes ?? ""}
                                    onChange={(event) =>
                                      updateSocapexSocketNotes(
                                        output.id,
                                        socket.id,
                                        event.target.value
                                      )
                                    }
                                  />
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {threePhaseOutputs.length > 0 && (
        <section style={styles.sectionBlock}>
          <h3 style={styles.sectionTitle}>Three Phase Outputs</h3>

          <div style={styles.threePhaseList}>
            {threePhaseOutputs.map((output) => {
              const outputIndex = activeDistro.outputs.findIndex(
                (item) => item.id === output.id
              );

              return (
                <div key={output.id} style={styles.threePhaseCard}>
                  <div style={styles.outputHeader}>
                    <strong>{outputTitle(output, outputIndex)}</strong>
                    <span style={styles.pill}>{output.type}</span>
                  </div>

                  <p style={styles.muted}>
                    Rating {output.rating}A per phase · Assigned items{" "}
                    {output.items.length}
                  </p>

                  <div style={styles.threePhaseGrid}>
                    <div style={styles.phaseMini}>L1: 0A</div>
                    <div style={styles.phaseMini}>L2: 0A</div>
                    <div style={styles.phaseMini}>L3: 0A</div>
                  </div>

                  <label style={styles.smallLabel}>
                    Output Notes
                    <textarea
                      style={styles.smallTextarea}
                      value={output.notes ?? ""}
                      onChange={(event) =>
                        updateOutputNotes(output.id, event.target.value)
                      }
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </section>
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
  },
  controlsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "12px",
  },
  label: {
    display: "block",
    marginTop: "12px",
    marginBottom: "12px",
    color: "#637083",
    fontWeight: 700,
  },
  smallLabel: {
    display: "block",
    marginTop: "10px",
    color: "#637083",
    fontWeight: 700,
    fontSize: "12px",
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
  },
  textarea: {
    width: "100%",
    minHeight: "80px",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
  },
  smallTextarea: {
    width: "100%",
    minHeight: "48px",
    padding: "8px",
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
  divider: {
    border: 0,
    borderTop: "1px solid #d9e0ea",
    margin: "22px 0",
  },
  sectionBlock: {
    marginTop: "30px",
    paddingTop: "18px",
    borderTop: "1px solid #d9e0ea",
  },
  sectionTitle: {
    marginBottom: "14px",
  },
  phaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },
  phaseColumn: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "12px",
    background: "#f8fafc",
  },
  phaseTitle: {
    marginTop: 0,
    marginBottom: "10px",
  },
  outputList: {
    display: "grid",
    gap: "10px",
  },
  outputCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "12px",
    background: "white",
  },
  outputHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    alignItems: "center",
  },
  pill: {
    borderRadius: "999px",
    background: "#eef4ff",
    padding: "4px 8px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#344054",
  },
  socapexList: {
    display: "grid",
    gap: "14px",
  },
  socapexCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
  },
  socapexSocketGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "12px",
  },
  socapexPhaseColumn: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "10px",
    background: "white",
  },
  socketCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "10px",
    background: "#ffffff",
  },
  threePhaseList: {
    display: "grid",
    gap: "12px",
  },
  threePhaseCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
  },
  threePhaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginTop: "10px",
  },
  phaseMini: {
    border: "1px solid #d9e0ea",
    borderRadius: "10px",
    padding: "8px",
    background: "white",
    fontSize: "12px",
  },
};
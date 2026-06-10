import { equipmentLibrary } from "@/planner/equipmentLibrary";
import type {
  EquipmentItem,
  PlannerOutput,
  PlannerOutputItem,
  PlannerState,
  ProjectDistro,
} from "@/planner/types";

type DistroEditorTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  goToDistroOverview: () => void;
};

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

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

function outputWatts(output: PlannerOutput) {
  return output.items.reduce(
    (total, item) => total + item.watts * item.quantity,
    0
  );
}

function outputAmps(output: PlannerOutput) {
  return outputWatts(output) / 230;
}

function threePhaseAmps(output: PlannerOutput) {
  return outputAmps(output) / 3;
}

function formatWatts(value: number) {
  return `${Math.round(value).toLocaleString()} W`;
}

function formatAmps(value: number) {
  return `${value.toFixed(1)} A`;
}

function createOutputItem(equipment: EquipmentItem): PlannerOutputItem {
  return {
    id: createId("item"),
    name: equipment.name,
    watts: equipment.watts,
    quantity: 1,
  };
}

export function DistroEditorTab({
  plannerState,
  setPlannerState,
  goToDistroOverview,
}: DistroEditorTabProps) {
  const activeDistro =
    plannerState.distros.find((distro) => distro.id === plannerState.active) ??
    plannerState.distros[0];

  const equipmentOptions = [
    ...equipmentLibrary,
    ...plannerState.customEquipment,
  ].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  function updateDistro(updatedDistro: ProjectDistro) {
    setPlannerState({
      ...plannerState,
      active: updatedDistro.id,
      distros: plannerState.distros.map((distro) =>
        distro.id === updatedDistro.id ? updatedDistro : distro
      ),
    });
  }

  function updateOutput(
    outputId: string,
    updateFunction: (output: PlannerOutput) => PlannerOutput
  ) {
    if (!activeDistro) return;

    updateDistro({
      ...activeDistro,
      outputs: activeDistro.outputs.map((output) =>
        output.id === outputId ? updateFunction(output) : output
      ),
    });
  }

  function updateSocapexSocket(
    socapexOutputId: string,
    socketId: string,
    updateFunction: (socket: PlannerOutput) => PlannerOutput
  ) {
    if (!activeDistro) return;

    updateDistro({
      ...activeDistro,
      outputs: activeDistro.outputs.map((output) => {
        if (output.id !== socapexOutputId) return output;

        return {
          ...output,
          socaCircuits: output.socaCircuits?.map((socket) =>
            socket.id === socketId ? updateFunction(socket) : socket
          ),
        };
      }),
    });
  }

  function updateOutputNotes(outputId: string, notes: string) {
    updateOutput(outputId, (output) => ({ ...output, notes }));
  }

  function updateSocapexSocketNotes(
    socapexOutputId: string,
    socketId: string,
    notes: string
  ) {
    updateSocapexSocket(socapexOutputId, socketId, (socket) => ({
      ...socket,
      notes,
    }));
  }

  function addEquipmentToOutput(outputId: string, equipmentId: string) {
    const equipment = equipmentOptions.find((item) => item.id === equipmentId);
    if (!equipment) return;

    updateOutput(outputId, (output) => ({
      ...output,
      items: [...output.items, createOutputItem(equipment)],
    }));
  }

  function addEquipmentToSocapexSocket(
    socapexOutputId: string,
    socketId: string,
    equipmentId: string
  ) {
    const equipment = equipmentOptions.find((item) => item.id === equipmentId);
    if (!equipment) return;

    updateSocapexSocket(socapexOutputId, socketId, (socket) => ({
      ...socket,
      items: [...socket.items, createOutputItem(equipment)],
    }));
  }

  function updateOutputItemQuantity(
    outputId: string,
    itemId: string,
    quantity: number
  ) {
    const safeQuantity = Math.max(1, quantity || 1);

    updateOutput(outputId, (output) => ({
      ...output,
      items: output.items.map((item) =>
        item.id === itemId ? { ...item, quantity: safeQuantity } : item
      ),
    }));
  }

  function updateSocapexSocketItemQuantity(
    socapexOutputId: string,
    socketId: string,
    itemId: string,
    quantity: number
  ) {
    const safeQuantity = Math.max(1, quantity || 1);

    updateSocapexSocket(socapexOutputId, socketId, (socket) => ({
      ...socket,
      items: socket.items.map((item) =>
        item.id === itemId ? { ...item, quantity: safeQuantity } : item
      ),
    }));
  }

  function removeOutputItem(outputId: string, itemId: string) {
    updateOutput(outputId, (output) => ({
      ...output,
      items: output.items.filter((item) => item.id !== itemId),
    }));
  }

  function removeSocapexSocketItem(
    socapexOutputId: string,
    socketId: string,
    itemId: string
  ) {
    updateSocapexSocket(socapexOutputId, socketId, (socket) => ({
      ...socket,
      items: socket.items.filter((item) => item.id !== itemId),
    }));
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

  const totalWatts =
    activeDistro.outputs.reduce((total, output) => {
      const mainOutputWatts = outputWatts(output);
      const socaWatts = (output.socaCircuits ?? []).reduce(
        (socketTotal, socket) => socketTotal + outputWatts(socket),
        0
      );

      return total + mainOutputWatts + socaWatts;
    }, 0);

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

      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span>Total Load</span>
          <strong>{formatWatts(totalWatts)}</strong>
        </div>

        <div style={styles.summaryCard}>
          <span>Input</span>
          <strong>{activeDistro.input}</strong>
        </div>

        <div style={styles.summaryCard}>
          <span>Outputs</span>
          <strong>{activeDistro.outputs.length}</strong>
        </div>
      </div>

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
                        <OutputCard
                          key={output.id}
                          output={output}
                          title={outputTitle(output, outputIndex)}
                          equipmentOptions={equipmentOptions}
                          addEquipment={(equipmentId) =>
                            addEquipmentToOutput(output.id, equipmentId)
                          }
                          updateQuantity={(itemId, quantity) =>
                            updateOutputItemQuantity(
                              output.id,
                              itemId,
                              quantity
                            )
                          }
                          removeItem={(itemId) =>
                            removeOutputItem(output.id, itemId)
                          }
                          updateNotes={(notes) =>
                            updateOutputNotes(output.id, notes)
                          }
                        />
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

                  {output.detail && <p style={styles.muted}>{output.detail}</p>}

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
                              <OutputCard
                                key={socket.id}
                                output={socket}
                                title={socapexSocketTitle(socket)}
                                equipmentOptions={equipmentOptions}
                                addEquipment={(equipmentId) =>
                                  addEquipmentToSocapexSocket(
                                    output.id,
                                    socket.id,
                                    equipmentId
                                  )
                                }
                                updateQuantity={(itemId, quantity) =>
                                  updateSocapexSocketItemQuantity(
                                    output.id,
                                    socket.id,
                                    itemId,
                                    quantity
                                  )
                                }
                                removeItem={(itemId) =>
                                  removeSocapexSocketItem(
                                    output.id,
                                    socket.id,
                                    itemId
                                  )
                                }
                                updateNotes={(notes) =>
                                  updateSocapexSocketNotes(
                                    output.id,
                                    socket.id,
                                    notes
                                  )
                                }
                              />
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
                <OutputCard
                  key={output.id}
                  output={output}
                  title={outputTitle(output, outputIndex)}
                  equipmentOptions={equipmentOptions}
                  threePhase
                  addEquipment={(equipmentId) =>
                    addEquipmentToOutput(output.id, equipmentId)
                  }
                  updateQuantity={(itemId, quantity) =>
                    updateOutputItemQuantity(output.id, itemId, quantity)
                  }
                  removeItem={(itemId) => removeOutputItem(output.id, itemId)}
                  updateNotes={(notes) => updateOutputNotes(output.id, notes)}
                />
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}

type OutputCardProps = {
  output: PlannerOutput;
  title: string;
  equipmentOptions: EquipmentItem[];
  threePhase?: boolean;
  addEquipment: (equipmentId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  updateNotes: (notes: string) => void;
};

function OutputCard({
  output,
  title,
  equipmentOptions,
  threePhase = false,
  addEquipment,
  updateQuantity,
  removeItem,
  updateNotes,
}: OutputCardProps) {
  const watts = outputWatts(output);
  const amps = outputAmps(output);
  const phaseAmps = threePhaseAmps(output);

  return (
    <div style={styles.outputCard}>
      <div style={styles.outputHeader}>
        <strong>{title}</strong>
        <span style={styles.pill}>{output.type}</span>
      </div>

      <p style={styles.muted}>
        Load {formatWatts(watts)} ·{" "}
        {threePhase
          ? `${formatAmps(phaseAmps)} per phase`
          : `${formatAmps(amps)}`}{" "}
        / {output.rating}A
      </p>

      {threePhase && (
        <div style={styles.threePhaseGrid}>
          <div style={styles.phaseMini}>L1: {formatAmps(phaseAmps)}</div>
          <div style={styles.phaseMini}>L2: {formatAmps(phaseAmps)}</div>
          <div style={styles.phaseMini}>L3: {formatAmps(phaseAmps)}</div>
        </div>
      )}

      <div style={styles.addEquipmentRow}>
        <select
          style={styles.input}
          defaultValue=""
          onChange={(event) => {
            if (!event.target.value) return;
            addEquipment(event.target.value);
            event.target.value = "";
          }}
        >
          <option value="">Add equipment...</option>
          {equipmentOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.category} — {item.name} ({item.watts}W)
            </option>
          ))}
        </select>
      </div>

      {output.items.length > 0 && (
        <div style={styles.assignedList}>
          {output.items.map((item) => (
            <div key={item.id} style={styles.assignedItem}>
              <div>
                <strong>{item.name}</strong>
                <p style={styles.muted}>
                  {item.watts}W each · Total{" "}
                  {formatWatts(item.watts * item.quantity)}
                </p>
              </div>

              <label style={styles.qtyLabel}>
                Qty
                <input
                  style={styles.qtyInput}
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(event) =>
                    updateQuantity(item.id, Number(event.target.value))
                  }
                />
              </label>

              <button
                style={styles.dangerButton}
                onClick={() => removeItem(item.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <label style={styles.smallLabel}>
        Output Notes
        <textarea
          style={styles.smallTextarea}
          value={output.notes ?? ""}
          onChange={(event) => updateNotes(event.target.value)}
        />
      </label>
    </div>
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
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "18px",
  },
  summaryCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
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
  qtyLabel: {
    display: "grid",
    gap: "4px",
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
  qtyInput: {
    width: "64px",
    padding: "8px",
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
    padding: "8px 10px",
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
  addEquipmentRow: {
    marginTop: "10px",
  },
  assignedList: {
    display: "grid",
    gap: "8px",
    marginTop: "10px",
  },
  assignedItem: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: "10px",
    alignItems: "center",
    border: "1px solid #d9e0ea",
    borderRadius: "10px",
    padding: "10px",
    background: "#eef4ff",
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
  threePhaseList: {
    display: "grid",
    gap: "12px",
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
import { useState } from "react";
import { autoSourcesForDistro } from "@/planner/autoSources";
import type { PlannerState, PowerSource } from "@/planner/types";

type PowerSourcesTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
};

const sourceTypes = [
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

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function PowerSourcesTab({
  plannerState,
  setPlannerState,
}: PowerSourcesTabProps) {
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("125A / 3");
  const [sourceNotes, setSourceNotes] = useState("");

  const manualSources = plannerState.sources.filter((source) => !source.auto);

  const autoSources = plannerState.distros.flatMap((distro) =>
    autoSourcesForDistro(distro)
  );

  function addPowerSource() {
    const newSource: PowerSource = {
      id: createId("source"),
      name: sourceName.trim() || "Power Source",
      conn: sourceType,
      rating: sourceRating(sourceType),
      notes: sourceNotes.trim(),
      auto: false,
      phaseType: sourceType.includes("/ 3") ? "Three-Phase" : "Single-Phase",
    };

    setPlannerState({
      ...plannerState,
      sources: [...manualSources, newSource, ...autoSources],
    });

    setSourceName("");
    setSourceNotes("");
  }

  function deletePowerSource(sourceId: string) {
    setPlannerState({
      ...plannerState,
      sources: manualSources.filter((source) => source.id !== sourceId),
      distros: plannerState.distros.map((distro) =>
        distro.sourceId === sourceId ? { ...distro, sourceId: "" } : distro
      ),
    });
  }

  return (
    <section style={styles.card}>
      <h2>Power Sources</h2>
      <p style={styles.muted}>
        Manual sources are venue supplies or generators. Auto sources are created
        from distro outputs rated 32A or above.
      </p>

      <div style={styles.formGrid}>
        <label style={styles.label}>
          Source Name
          <input
            style={styles.input}
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
            placeholder="e.g. Generator 1 / Venue 125A"
          />
        </label>

        <label style={styles.label}>
          Type
          <select
            style={styles.input}
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value)}
          >
            {sourceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Rating
          <input
            style={styles.input}
            value={`${sourceRating(sourceType)}A`}
            readOnly
          />
        </label>
      </div>

      <label style={styles.label}>
        Notes
        <textarea
          style={styles.textarea}
          value={sourceNotes}
          onChange={(event) => setSourceNotes(event.target.value)}
          placeholder="Generator location, venue DB details, cable route, restrictions..."
        />
      </label>

      <button style={styles.button} onClick={addPowerSource}>
        Add Manual Power Source
      </button>

      <hr style={styles.divider} />

      <h3>Manual Power Sources</h3>

      <div style={styles.list}>
        {manualSources.length === 0 ? (
          <p style={styles.muted}>No manual power sources added yet.</p>
        ) : (
          manualSources.map((source) => (
            <div key={source.id} style={styles.sourceCard}>
              <div>
                <strong>{source.name}</strong>
                <p style={styles.muted}>
                  {source.conn} · {source.rating}A
                </p>
                {source.notes && <p style={styles.notes}>{source.notes}</p>}
              </div>

              <button
                style={styles.dangerButton}
                onClick={() => deletePowerSource(source.id)}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      <hr style={styles.divider} />

      <h3>Auto-Created Power Sources</h3>

      <div style={styles.list}>
        {autoSources.length === 0 ? (
          <p style={styles.muted}>
            No auto-created sources yet. Add a distro with 32A+ outputs.
          </p>
        ) : (
          autoSources.map((source) => (
            <div key={source.id} style={styles.autoSourceCard}>
              <div>
                <strong>{source.name}</strong>
                <p style={styles.muted}>
                  {source.conn} · {source.rating}A · Auto-created
                </p>
                {source.notes && <p style={styles.notes}>{source.notes}</p>}
              </div>
            </div>
          ))
        )}
      </div>
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
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 180px 120px",
    gap: "12px",
    marginTop: "16px",
  },
  label: {
    display: "block",
    marginBottom: "14px",
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
  textarea: {
    width: "100%",
    minHeight: "80px",
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
  dangerButton: {
    padding: "10px 14px",
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
    gap: "10px",
  },
  sourceCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    background: "#f8fafc",
  },
  autoSourceCard: {
    border: "1px dashed #93c5fd",
    borderRadius: "14px",
    padding: "14px",
    background: "#eff6ff",
  },
  notes: {
    margin: "6px 0 0",
    color: "#344054",
  },
};
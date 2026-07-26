import { useState } from "react";
import { DistroDefinitionBuilder } from "@/components/planner/DistroDefinitionBuilder";
import type { DistroDefinition, PlannerState } from "@/planner/types";

type CustomDistrosTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
};

export function CustomDistrosTab({
  plannerState,
  setPlannerState,
}: CustomDistrosTabProps) {
  const [builderKey, setBuilderKey] = useState(0);

  function saveCustomDistro(definition: DistroDefinition) {
    setPlannerState({
      ...plannerState,
      customDistros: [
        ...plannerState.customDistros,
        { ...definition, custom: true },
      ],
    });
    setBuilderKey((value) => value + 1);
  }

  function deleteCustomDistro(index: number) {
    if (!confirm("Delete this custom distro?")) return;

    setPlannerState({
      ...plannerState,
      customDistros: plannerState.customDistros.filter(
        (_distro, distroIndex) => distroIndex !== index,
      ),
    });
  }

  return (
    <section data-lva-surface style={styles.card}>
      <h2>Custom Distros</h2>
      <p style={styles.muted}>
        Build project-specific distro templates. These distros are saved only
        within this project and appear in the Distro Overview add list prefixed
        with “Custom:”.
      </p>

      <div style={styles.builderPanel}>
        <DistroDefinitionBuilder
          key={builderKey}
          saveLabel="Save Custom Distro"
          onSave={saveCustomDistro}
        />
      </div>

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
                <p style={styles.mutedSmall}>
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

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
  },
  muted: { color: "#667085" },
  mutedSmall: { color: "#667085", margin: "4px 0 0", fontSize: "13px" },
  builderPanel: {
    marginTop: "18px",
    padding: "16px",
    border: "1px solid #DCE5EC",
    borderRadius: "16px",
    background: "#F5F7FA",
  },
  divider: { border: 0, borderTop: "1px solid #DCE5EC", margin: "22px 0" },
  savedList: { display: "grid", gap: "10px" },
  savedCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    padding: "14px",
    background: "#F5F7FA",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  dangerButton: {
    minHeight: "40px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid #E5484D",
    background: "#FFF1F1",
    color: "#E5484D",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 500,
  },
};

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  function saveCustomDistro(definition: DistroDefinition) {
    const savedDefinition = { ...definition, custom: true };

    setPlannerState({
      ...plannerState,
      customDistros:
        editingIndex == null
          ? [...plannerState.customDistros, savedDefinition]
          : plannerState.customDistros.map((distro, index) =>
              index === editingIndex ? savedDefinition : distro,
            ),
    });
    setEditingIndex(null);
    setBuilderKey((value) => value + 1);
  }

  function editCustomDistro(index: number) {
    setEditingIndex(index);
    setBuilderKey((value) => value + 1);
    window.setTimeout(() => {
      document
        .getElementById("custom-distro-builder")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function cancelEdit() {
    setEditingIndex(null);
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

    if (editingIndex === index) {
      cancelEdit();
    } else if (editingIndex != null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  }

  return (
    <section data-lva-surface style={styles.card}>
      <h2>Custom Distros</h2>
      <p style={styles.muted}>
        Build project-specific distro templates. These distros are saved only
        within this project and appear in the Distro Overview add list prefixed
        with “Custom:”.
      </p>

      <div id="custom-distro-builder" style={styles.builderPanel}>
        <div style={styles.builderHeading}>
          <h3 style={styles.builderTitle}>
            {editingIndex == null
              ? "Build a custom distro"
              : `Editing: ${plannerState.customDistros[editingIndex]?.name ?? "Custom distro"}`}
          </h3>
          {editingIndex != null && (
            <span style={styles.editingBadge}>Editing saved distro</span>
          )}
        </div>
        <DistroDefinitionBuilder
          key={builderKey}
          initialDefinition={
            editingIndex == null
              ? undefined
              : plannerState.customDistros[editingIndex]
          }
          saveLabel={
            editingIndex == null
              ? "Save Custom Distro"
              : "Update Custom Distro"
          }
          onSave={saveCustomDistro}
          onCancel={editingIndex == null ? undefined : cancelEdit}
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
              <div style={styles.actions}>
                <button
                  style={styles.editButton}
                  onClick={() => editCustomDistro(index)}
                >
                  Edit
                </button>
                <button
                  style={styles.dangerButton}
                  onClick={() => deleteCustomDistro(index)}
                >
                  Delete
                </button>
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
  builderHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "14px",
  },
  builderTitle: { margin: 0 },
  editingBadge: {
    padding: "5px 9px",
    borderRadius: "999px",
    background: "#DBEAFE",
    color: "#1D4ED8",
    fontSize: "12px",
    fontWeight: 600,
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
  actions: { display: "flex", alignItems: "center", gap: "8px" },
  editButton: {
    minHeight: "40px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid #CBD5E1",
    background: "#FFFFFF",
    color: "#334155",
    cursor: "pointer",
    font: "inherit",
    fontWeight: 500,
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

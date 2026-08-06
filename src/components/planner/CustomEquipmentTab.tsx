import { useState } from "react";
import type { EquipmentItem, PlannerState } from "@/planner/types";

type CustomEquipmentTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
};

const categories = [
  "Audio - Control",
  "Audio - Amps",
  "Audio - Other",
  "Lighting - Control",
  "Lighting - LED Generics",
  "Lighting - LED Pars",
  "Lighting - LED Battens",
  "Lighting - Moving Heads",
  "Lighting - Effects / Eye Candy",
  "Lighting - Haze / Other",
  "Vision - Control",
  "Vision - LED",
  "Vision - Proj",
  "Vision - Displays",
  "Rigging - Motors",
  "Expo Power Supplies",
];

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function CustomEquipmentTab({
  plannerState,
  setPlannerState,
}: CustomEquipmentTabProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [watts, setWatts] = useState("");
  const [deletePrompt, setDeletePrompt] = useState<EquipmentItem | null>(null);

  function addCustomEquipment() {
    const cleanName = name.trim();
    const parsedWatts = Number(watts);

    if (!cleanName) {
      alert("Please enter an equipment name.");
      return;
    }

    if (!Number.isFinite(parsedWatts) || parsedWatts <= 0) {
      alert("Please enter a valid wattage.");
      return;
    }

    const newItem: EquipmentItem = {
      id: createId("custom_equipment"),
      category,
      name: cleanName,
      watts: parsedWatts,
    };

    setPlannerState({
      ...plannerState,
      customEquipment: [...plannerState.customEquipment, newItem],
    });

    setName("");
    setWatts("");
  }

  function confirmDeleteCustomEquipment() {
    if (!deletePrompt) return;

    setPlannerState({
      ...plannerState,
      customEquipment: plannerState.customEquipment.filter(
        (item) => item.id !== deletePrompt.id
      ),
    });
    setDeletePrompt(null);
  }

  function updateCustomEquipment(id: string, updatedItem: EquipmentItem) {
    setPlannerState({
      ...plannerState,
      customEquipment: plannerState.customEquipment.map((item) =>
        item.id === id ? updatedItem : item
      ),
    });
  }

  return (
    <section data-lva-surface style={styles.card}>
      <h2>Custom Equipment</h2>
      <p style={styles.muted}>
        Create project-specific equipment. These items will appear in the Distro
        Editor equipment sidebar and can be dragged onto outputs.
      </p>

      <div style={styles.formGrid}>
        <label style={styles.label}>
          Equipment Name
          <input
            style={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Custom LED Wall PSU"
          />
        </label>

        <label style={styles.label}>
          Category
          <select
            style={styles.input}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Watts
          <input
            style={styles.input}
            type="number"
            min="1"
            value={watts}
            onChange={(event) => setWatts(event.target.value)}
            placeholder="Watts"
          />
        </label>
      </div>

      <button style={styles.button} onClick={addCustomEquipment}>
        Add Custom Equipment
      </button>

      <hr style={styles.divider} />

      <h3>Project Custom Equipment</h3>

      {plannerState.customEquipment.length === 0 ? (
        <p style={styles.muted}>No custom equipment added yet.</p>
      ) : (
        <div style={styles.list}>
          {plannerState.customEquipment.map((item) => (
            <div key={item.id} style={styles.itemCard}>
              <label style={styles.label}>
                Name
                <input
                  style={styles.input}
                  value={item.name}
                  onChange={(event) =>
                    updateCustomEquipment(item.id, {
                      ...item,
                      name: event.target.value,
                    })
                  }
                />
              </label>

              <label style={styles.label}>
                Category
                <select
                  style={styles.input}
                  value={item.category}
                  onChange={(event) =>
                    updateCustomEquipment(item.id, {
                      ...item,
                      category: event.target.value,
                    })
                  }
                >
                  {categories.map((categoryOption) => (
                    <option key={categoryOption} value={categoryOption}>
                      {categoryOption}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                Watts
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  value={item.watts}
                  onChange={(event) =>
                    updateCustomEquipment(item.id, {
                      ...item,
                      watts: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                />
              </label>

              <button
                style={styles.dangerButton}
                onClick={() => setDeletePrompt(item)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {deletePrompt && (
        <div
          style={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeletePrompt(null);
          }}
        >
          <section
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-equipment-title"
          >
            <h3 id="delete-equipment-title" style={styles.modalTitle}>
              Delete custom equipment?
            </h3>
            <p style={styles.modalText}>
              <strong>{deletePrompt.name}</strong> will be permanently removed
              from this project. This cannot be undone.
            </p>
            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.modalDangerButton}
                onClick={confirmDeleteCustomEquipment}
              >
                Delete Equipment
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setDeletePrompt(null)}
              >
                Cancel
              </button>
            </div>
          </section>
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
  muted: {
    color: "#667085",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 260px 140px",
    gap: "12px",
    alignItems: "end",
    marginTop: "16px",
  },
  label: {
    display: "block",
    color: "#667085",
    fontWeight: 400,
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
  },
  button: {
    marginTop: "12px",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #000000",
    background: "var(--lva-workspace-highlight, #ececec)",
    color: "#000000",
    cursor: "pointer",
    fontWeight: 500,
  },
  dangerButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #E5484D",
    background: "#FFF1F1",
    color: "#E5484D",
    cursor: "pointer",
    alignSelf: "end",
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
  itemCard: {
    display: "grid",
    gridTemplateColumns: "1fr 260px 140px auto",
    gap: "12px",
    alignItems: "end",
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    padding: "14px",
    background: "#F5F7FA",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: "20px",
    background: "rgba(15, 23, 42, 0.55)",
  },
  modal: {
    width: "min(520px, 100%)",
    display: "grid",
    gap: "14px",
    padding: "22px",
    borderRadius: "14px",
    background: "white",
    boxShadow: "0 20px 55px rgba(0, 0, 0, 0.25)",
  },
  modalTitle: { margin: 0 },
  modalText: { margin: 0, color: "#475467", lineHeight: 1.5 },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
  },
  modalDangerButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #C53030",
    background: "#C53030",
    color: "white",
    cursor: "pointer",
    fontWeight: 500,
  },
  secondaryButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#172033",
    cursor: "pointer",
    fontWeight: 500,
  },
};

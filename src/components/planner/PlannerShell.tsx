import { useState } from "react";
import type { PlannerState } from "@/types/project";

type PlannerShellProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
};

type PlannerTab =
  | "System Overview"
  | "Power Sources"
  | "Distro Overview"
  | "Distro Editor"
  | "Custom Equipment"
  | "Custom Distros"
  | "Report";

const tabs: PlannerTab[] = [
  "System Overview",
  "Power Sources",
  "Distro Overview",
  "Distro Editor",
  "Custom Equipment",
  "Custom Distros",
  "Report",
];

export function PlannerShell({
  plannerState,
  setPlannerState,
}: PlannerShellProps) {
  const [activeTab, setActiveTab] = useState<PlannerTab>("System Overview");

  function updateSystemName(value: string) {
    setPlannerState({
      ...plannerState,
      systemName: value,
    });
  }

  return (
    <section style={styles.shell}>
      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.activeTab : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "System Overview" && (
        <section style={styles.card}>
          <h2>System Overview</h2>

          <label style={styles.label}>
            System Name
            <input
              style={styles.input}
              value={plannerState.systemName}
              onChange={(event) => updateSystemName(event.target.value)}
            />
          </label>

          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <span>Total Sources</span>
              <strong>{plannerState.sources.length}</strong>
            </div>

            <div style={styles.summaryCard}>
              <span>Total Distros</span>
              <strong>{plannerState.distros.length}</strong>
            </div>

            <div style={styles.summaryCard}>
              <span>Custom Equipment</span>
              <strong>{plannerState.customEquipment.length}</strong>
            </div>

            <div style={styles.summaryCard}>
              <span>Custom Distros</span>
              <strong>{plannerState.customDistros.length}</strong>
            </div>
          </div>
        </section>
      )}

      {activeTab === "Power Sources" && (
        <section style={styles.card}>
          <h2>Power Sources</h2>
          <p style={styles.muted}>Power source management will go here.</p>
        </section>
      )}

      {activeTab === "Distro Overview" && (
        <section style={styles.card}>
          <h2>Distro Overview</h2>
          <p style={styles.muted}>Distro overview will go here.</p>
        </section>
      )}

      {activeTab === "Distro Editor" && (
        <section style={styles.card}>
          <h2>Distro Editor</h2>
          <p style={styles.muted}>Distro editor will go here.</p>
        </section>
      )}

      {activeTab === "Custom Equipment" && (
        <section style={styles.card}>
          <h2>Custom Equipment</h2>
          <p style={styles.muted}>Custom equipment tools will go here.</p>
        </section>
      )}

      {activeTab === "Custom Distros" && (
        <section style={styles.card}>
          <h2>Custom Distros</h2>
          <p style={styles.muted}>Custom distro builder will go here.</p>
        </section>
      )}

      {activeTab === "Report" && (
        <section style={styles.card}>
          <h2>Report</h2>
          <p style={styles.muted}>Report export will go here.</p>
        </section>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    marginTop: "20px",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "16px",
    padding: "8px",
    background: "#e9eef5",
    border: "1px solid #d7dee8",
    borderRadius: "16px",
  },
  tab: {
    padding: "10px 13px",
    borderRadius: "11px",
    border: 0,
    background: "white",
    color: "#172033",
    fontWeight: 700,
    cursor: "pointer",
  },
  activeTab: {
    background: "#111827",
    color: "white",
  },
  card: {
    border: "1px solid #d9e0ea",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
  },
  muted: {
    color: "#637083",
  },
  label: {
    display: "block",
    marginBottom: "18px",
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
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
  },
  summaryCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "14px",
    background: "#f8fafc",
  },
};
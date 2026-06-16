import { useEffect, useState } from "react";
import { CustomDistrosTab } from "@/components/planner/CustomDistrosTab";
import { CustomEquipmentTab } from "@/components/planner/CustomEquipmentTab";
import { DistroEditorTab } from "@/components/planner/DistroEditorTab";
import { DistroOverviewTab } from "@/components/planner/DistroOverviewTab";
import { PowerSourcesTab } from "@/components/planner/PowerSourcesTab";
import { ReportTab } from "@/components/planner/ReportTab";
import { SystemOverviewTab } from "@/components/planner/SystemOverviewTab";
import { ensureAutoSources } from "@/planner/autoSources";
import type { PlannerState } from "@/planner/types";

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

  useEffect(() => {
    const updatedState = ensureAutoSources(plannerState);

    if (JSON.stringify(updatedState.sources) !== JSON.stringify(plannerState.sources)) {
      setPlannerState(updatedState);
    }
  }, [plannerState, setPlannerState]);

  function openDistroEditor(distroId: string) {
    setPlannerState({
      ...plannerState,
      active: distroId,
    });

    setActiveTab("Distro Editor");
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
        <SystemOverviewTab
          plannerState={plannerState}
          setPlannerState={setPlannerState}
          openDistroEditor={openDistroEditor}
        />
      )}

      {activeTab === "Power Sources" && (
        <PowerSourcesTab
          plannerState={plannerState}
          setPlannerState={setPlannerState}
        />
      )}

      {activeTab === "Distro Overview" && (
        <DistroOverviewTab
          plannerState={plannerState}
          setPlannerState={setPlannerState}
          openDistroEditor={openDistroEditor}
        />
      )}

      {activeTab === "Distro Editor" && (
        <DistroEditorTab
          plannerState={plannerState}
          setPlannerState={setPlannerState}
          goToDistroOverview={() => setActiveTab("Distro Overview")}
        />
      )}

      {activeTab === "Custom Equipment" && (
        <CustomEquipmentTab
          plannerState={plannerState}
          setPlannerState={setPlannerState}
        />
      )}

      {activeTab === "Custom Distros" && (
        <CustomDistrosTab
          plannerState={plannerState}
          setPlannerState={setPlannerState}
        />
      )}

      {activeTab === "Report" && (
        <ReportTab
          plannerState={plannerState}
          setPlannerState={setPlannerState}
          openDistroEditor={openDistroEditor}
        />
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
};
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
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

function safeFileName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "power-planner-project";
}

function isPlannerState(value: unknown): value is PlannerState {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<PlannerState>;

  return (
    Array.isArray(candidate.sources) &&
    Array.isArray(candidate.distros) &&
    Array.isArray(candidate.customEquipment) &&
    Array.isArray(candidate.customDistros) &&
    (typeof candidate.systemName === "string" || candidate.systemName === undefined)
  );
}

function normaliseImportedPlannerState(value: PlannerState): PlannerState {
  return ensureAutoSources({
    systemName:
      value.projectInfo?.projectName ?? value.systemName ?? "Power Report",
    projectInfo: value.projectInfo,
    sources: value.sources ?? [],
    distros: value.distros ?? [],
    active: value.active ?? null,
    customEquipment: value.customEquipment ?? [],
    customDistros: value.customDistros ?? [],
    reportHiddenSources: value.reportHiddenSources ?? [],
    reportHiddenDistros: value.reportHiddenDistros ?? [],
  });
}

export function PlannerShell({
  plannerState,
  setPlannerState,
}: PlannerShellProps) {
  const [activeTab, setActiveTab] = useState<PlannerTab>("System Overview");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  function exportPlannerJson() {
    const exportState = normaliseImportedPlannerState(plannerState);
    const json = JSON.stringify(exportState, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    const exportName =
      exportState.projectInfo?.projectName ||
      exportState.systemName ||
      "power-planner-project";

    link.download = `${safeFileName(exportName)}-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function requestImportPlannerJson() {
    fileInputRef.current?.click();
  }

  async function importPlannerJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;

      if (!isPlannerState(parsed)) {
        alert("This does not look like a valid Event Power Planner export.");
        return;
      }

      const confirmed = confirm(
        "Importing this file will replace the current planner data for this project. Continue?"
      );

      if (!confirmed) return;

      const importedState = normaliseImportedPlannerState(parsed);
      setPlannerState(importedState);
      setActiveTab("System Overview");
    } catch {
      alert("Could not import this file. Please check it is a valid JSON export.");
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }

        [data-power-planner-ui] button,
        [data-power-planner-ui] input,
        [data-power-planner-ui] select,
        [data-power-planner-ui] textarea {
          transition:
            background-color 140ms ease,
            border-color 140ms ease,
            box-shadow 140ms ease,
            filter 140ms ease,
            transform 140ms ease;
        }

        @media (hover: hover) {
          [data-power-planner-ui] button:hover:not(:disabled) {
            transform: translateY(-1px);
            filter: brightness(0.985);
            box-shadow:
              inset 0 0 0 999px rgba(11, 227, 255, 0.055),
              0 1px 4px rgba(17, 24, 39, 0.06);
          }

          [data-power-planner-ui] input:hover,
          [data-power-planner-ui] select:hover,
          [data-power-planner-ui] textarea:hover {
            box-shadow: 0 0 0 1px rgba(11, 227, 255, 0.28);
          }
        }

        [data-power-planner-ui] button:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: inset 0 0 0 999px rgba(17, 24, 39, 0.035);
        }

        [data-power-planner-ui] button:disabled {
          cursor: not-allowed;
          opacity: 0.58;
        }
      `}</style>
      <section data-power-planner-ui style={styles.shell}>
        <div style={styles.utilityBar}>
          <div>
            <h2 style={styles.utilityTitle}>Power Planner</h2>
            <p style={styles.utilityText}>
              Export a backup before major edits, or import a planner JSON file to restore or share a system.
            </p>
          </div>

          <div style={styles.utilityActions}>
            <button style={styles.secondaryButton} onClick={requestImportPlannerJson}>
              Import JSON
            </button>
            <button style={styles.primaryButton} onClick={exportPlannerJson}>
              Export JSON
            </button>
          </div>

          <input
            ref={fileInputRef}
            style={{ display: "none" }}
            type="file"
            accept="application/json,.json"
            onChange={importPlannerJson}
          />
        </div>

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
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    marginTop: "20px",
    fontFamily: "'Outfit', Arial, sans-serif",
    color: "#111827",
  },
  utilityBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "center",
    marginBottom: "16px",
    padding: "16px",
    background: "#FFFFFF",
    border: "1px solid #DCE5EC",
    borderRadius: "20px",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
  },
  utilityTitle: {
    margin: 0,
    fontSize: "20px",
    letterSpacing: "-0.02em",
  },
  utilityText: {
    margin: "4px 0 0",
    color: "#000000",
    fontSize: "13px",
  },
  utilityActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  primaryButton: {
    padding: "11px 14px",
    borderRadius: "13px",
    border: "1px solid #4e4e4e",
    background: "#ececec",
    color: "#000000",
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "11px 14px",
    borderRadius: "13px",
    border: "1px solid #DCE5EC",
    background: "#FFFFFF",
    color: "#111827",
    fontWeight: 800,
    cursor: "pointer",
  },
  tabs: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
    marginBottom: "20px",
    padding: "6px",
    background: "#FFFFFF",
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
  },
  tab: {
    position: "relative",
    padding: "12px 14px",
    borderRadius: "13px",
    border: "1px solid transparent",
    background: "transparent",
    color: "#111827",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.01em",
  },
  activeTab: {
    background: "#ececec",
    border: "1px solid #242424",
    boxShadow: "inset 0 -2px 0 #383838",
  },
};

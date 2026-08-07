import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AdvancedCalculationsTab } from "@/components/planner/AdvancedCalculationsTab";
import { CustomDistrosTab } from "@/components/planner/CustomDistrosTab";
import { CustomEquipmentTab } from "@/components/planner/CustomEquipmentTab";
import { DistroEditorTab } from "@/components/planner/DistroEditorTab";
import { DistroOverviewTab } from "@/components/planner/DistroOverviewTab";
import { PowerSourcesTab } from "@/components/planner/PowerSourcesTab";
import { ReportTab } from "@/components/planner/ReportTab";
import { SystemOverviewTab } from "@/components/planner/SystemOverviewTab";
import { SystemSignOffTab } from "@/components/planner/SystemSignOffTab";
import { ensureAutoSources } from "@/planner/autoSources";
import type { PlannerState } from "@/planner/types";

type WorkspaceBranding = {
  subdomain: string;
  company_name: string;
  logo_url?: string | null;
  contact_email?: string | null;
  report_footer?: string | null;
  font_family?: string | null;
  highlight_colour?: string | null;
  dark_button_colour?: string | null;
};

type PlannerShellProps = {
  projectName: string;
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  workspaceBranding?: WorkspaceBranding;
  advancedCalculationsEnabled?: boolean;
  systemSignOffEnabled?: boolean;
  workspaceId?: string | null;
  projectId?: string;
  canManageReportLink?: boolean;
};

type PlannerTab =
  | "System Overview"
  | "Power Sources"
  | "Distro Overview"
  | "Distro Editor"
  | "Advanced Calculations"
  | "Custom Equipment"
  | "Custom Distros"
  | "Report"
  | "System Sign-Off";


const defaultWorkspaceFont = "'Outfit', Arial, sans-serif";
const defaultPlannerHighlight = "#ececec";
const defaultPlannerHighlightBorder = "#242424";
const defaultWorkspaceDarkButton = "#000000";

function workspaceFontFamily(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.font_family?.trim() || defaultWorkspaceFont;
}

function workspaceHighlightColour(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.highlight_colour?.trim() || defaultPlannerHighlight;
}

function workspaceDarkButtonColour(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.dark_button_colour?.trim() || defaultWorkspaceDarkButton;
}

function plannerThemeStyle(workspaceBranding?: WorkspaceBranding): React.CSSProperties {
  const highlight = workspaceHighlightColour(workspaceBranding);

  return {
    fontFamily: workspaceFontFamily(workspaceBranding),
    "--lva-workspace-highlight": highlight,
    "--lva-workspace-dark-button": workspaceDarkButtonColour(workspaceBranding),
    "--lva-workspace-highlight-border": workspaceBranding?.highlight_colour?.trim()
      ? highlight
      : defaultPlannerHighlightBorder,
    "--lva-ui-hover": workspaceBranding?.highlight_colour?.trim()
      ? `${highlight}14`
      : "rgba(158, 158, 158, 0.07)",
    "--lva-ui-border-hover": workspaceBranding?.highlight_colour?.trim()
      ? highlight
      : "#5c5c5c",
  } as React.CSSProperties;
}

const standardTabs: PlannerTab[] = [
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
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "");

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
    dismissedWarnings: value.dismissedWarnings ?? [],
    advancedElectrical: {
      calculationMethod:
        value.advancedElectrical?.calculationMethod ?? "real-power",
      defaultPowerFactor:
        value.advancedElectrical?.defaultPowerFactor ?? 1,
      nominalSinglePhaseVoltage:
        value.advancedElectrical?.nominalSinglePhaseVoltage ?? 230,
      nominalThreePhaseVoltage:
        value.advancedElectrical?.nominalThreePhaseVoltage ?? 400,
      showUnusedOutputs:
        value.advancedElectrical?.showUnusedOutputs ?? false,
    },
    projectCableLibrary: value.projectCableLibrary ?? [],
    excludedCableRatingIds: value.excludedCableRatingIds ?? [],
  });
}

export function PlannerShell({
  projectName,
  plannerState,
  setPlannerState,
  workspaceBranding,
  advancedCalculationsEnabled = false,
  systemSignOffEnabled = false,
  workspaceId,
  projectId,
  canManageReportLink = false,
}: PlannerShellProps) {
  const [activeTab, setActiveTab] = useState<PlannerTab>("System Overview");
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [systemOverviewExpandedSourceIds, setSystemOverviewExpandedSourceIds] =
    useState<string[]>(() =>
      plannerState.sources
        .filter((source) => !source.auto)
        .map((source) => source.id),
    );
  const [advancedOverviewExpandedSourceIds, setAdvancedOverviewExpandedSourceIds] =
    useState<string[]>(() =>
      plannerState.sources
        .filter((source) => !source.auto)
        .map((source) => source.id),
    );
  const knownManualSourceIdsRef = useRef(
    new Set(
      plannerState.sources
        .filter((source) => !source.auto)
        .map((source) => source.id),
    ),
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tabs: PlannerTab[] = [
    ...standardTabs.slice(0, 4),
    ...(advancedCalculationsEnabled
      ? (["Advanced Calculations"] as PlannerTab[])
      : []),
    ...standardTabs.slice(4),
    ...(systemSignOffEnabled ? (["System Sign-Off"] as PlannerTab[]) : []),
  ];

  useEffect(() => {
    const updatedState = ensureAutoSources(plannerState);

    if (JSON.stringify(updatedState.sources) !== JSON.stringify(plannerState.sources)) {
      setPlannerState(updatedState);
    }
  }, [plannerState, setPlannerState]);

  useEffect(() => {
    const currentIds = plannerState.sources
      .filter((source) => !source.auto)
      .map((source) => source.id);
    const currentIdSet = new Set(currentIds);
    const newIds = currentIds.filter(
      (sourceId) => !knownManualSourceIdsRef.current.has(sourceId),
    );
    const retainAndExpandNew = (sourceIds: string[]) => [
      ...sourceIds.filter((sourceId) => currentIdSet.has(sourceId)),
      ...newIds.filter((sourceId) => !sourceIds.includes(sourceId)),
    ];

    if (newIds.length > 0 || knownManualSourceIdsRef.current.size !== currentIds.length) {
      setSystemOverviewExpandedSourceIds(retainAndExpandNew);
      setAdvancedOverviewExpandedSourceIds(retainAndExpandNew);
    }
    knownManualSourceIdsRef.current = currentIdSet;
  }, [plannerState.sources]);

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
    link.download = `${safeFileName(projectName)} - ${stamp}.lvapower`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function requestImportPlannerJson() {
    setShowImportWarning(true);
  }

  function chooseProjectImportFile() {
    setShowImportWarning(false);
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
      {showImportWarning && (
        <div style={styles.dialogBackdrop} role="presentation">
          <section
            style={styles.dialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="import-project-warning-title"
            aria-describedby="import-project-warning-message"
          >
            <div style={styles.dialogIcon} aria-hidden="true">
              !
            </div>
            <div>
              <h2 id="import-project-warning-title" style={styles.dialogTitle}>
                Import project
              </h2>
              <p id="import-project-warning-message" style={styles.dialogMessage}>
                Importing a project file will overwrite all current project settings and planner data.
              </p>
            </div>
            <div style={styles.dialogActions}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setShowImportWarning(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={chooseProjectImportFile}
              >
                Choose Project File
              </button>
            </div>
          </section>
        </div>
      )}
      <section data-power-planner-ui style={{ ...styles.shell, ...plannerThemeStyle(workspaceBranding) }}>
        <input
          ref={fileInputRef}
          style={{ display: "none" }}
          type="file"
          accept=".lvapower,.json,application/json"
          onChange={importPlannerJson}
        />

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
          <div style={styles.tabActions}>
            <button style={styles.secondaryButton} onClick={requestImportPlannerJson}>
              Import Project
            </button>
            <button style={styles.primaryButton} onClick={exportPlannerJson}>
              Export Project
            </button>
          </div>
        </div>

        {activeTab === "System Overview" && (
          <SystemOverviewTab
            plannerState={plannerState}
            setPlannerState={setPlannerState}
            openDistroEditor={openDistroEditor}
            expandedSourceIds={systemOverviewExpandedSourceIds}
            setExpandedSourceIds={setSystemOverviewExpandedSourceIds}
          />
        )}

        {activeTab === "Power Sources" && (
          <PowerSourcesTab
            plannerState={plannerState}
            setPlannerState={setPlannerState}
            openDistroEditor={openDistroEditor}
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

        {activeTab === "Advanced Calculations" &&
          advancedCalculationsEnabled && (
            <AdvancedCalculationsTab
              plannerState={plannerState}
              setPlannerState={setPlannerState}
              openDistroEditor={openDistroEditor}
              workspaceId={workspaceId}
              overviewExpandedSourceIds={advancedOverviewExpandedSourceIds}
              setOverviewExpandedSourceIds={
                setAdvancedOverviewExpandedSourceIds
              }
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
            workspaceBranding={workspaceBranding}
            projectId={projectId}
            canManageReportLink={canManageReportLink}
          />
        )}

        {activeTab === "System Sign-Off" && systemSignOffEnabled && (
          <SystemSignOffTab
            plannerState={plannerState}
            projectId={projectId}
            canManageAccessLink={canManageReportLink}
            workspaceLogoUrl={workspaceBranding?.logo_url}
          />
        )}
      </section>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  dialogBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000000,
    display: "grid",
    placeItems: "center",
    padding: "20px",
    background: "rgba(15, 23, 42, 0.55)",
  },
  dialog: {
    width: "min(560px, 100%)",
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: "14px",
    padding: "22px",
    borderRadius: "14px",
    border: "1px solid #d9e0ea",
    background: "white",
    boxShadow: "0 20px 55px rgba(0, 0, 0, 0.25)",
    color: "#172033",
  },
  dialogIcon: {
    width: "34px",
    height: "34px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "#fff4d6",
    color: "#8a5b00",
    fontWeight: 700,
  },
  dialogTitle: {
    margin: 0,
    fontSize: "20px",
  },
  dialogMessage: {
    margin: "8px 0 0",
    color: "#475467",
    lineHeight: 1.5,
  },
  dialogActions: {
    gridColumn: "1 / -1",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  shell: {
    marginTop: "20px",
    color: "#111827",
  },
  tabActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    alignItems: "center",
    marginLeft: "auto",
  },
  primaryButton: {
    padding: "11px 14px",
    borderRadius: "13px",
    border: "1px solid #4e4e4e",
    background: "#ececec",
    color: "#000000",
    fontWeight: 500,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "11px 14px",
    borderRadius: "13px",
    border: "1px solid #DCE5EC",
    background: "#FFFFFF",
    color: "#111827",
    fontWeight: 500,
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
    fontWeight: 400,
    cursor: "pointer",
    letterSpacing: "0.01em",
  },
  activeTab: {
    background: "var(--lva-workspace-highlight, #ececec)",
    border: "1px solid var(--lva-workspace-highlight-border, #242424)",
    boxShadow: "inset 0 -2px 0 var(--lva-workspace-highlight-border, #383838)",
  },
};

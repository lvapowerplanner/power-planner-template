import { useEffect, useState } from "react";
import { PowerPlannerApp } from "@/components/PowerPlannerApp";
import type { Project, ProjectData } from "@/types/project";

type ProjectWorkspaceProps = {
  activeProject: Project;
  projectData: ProjectData;
  setProjectData: (data: ProjectData) => void;
  saveProject: () => void;
  backToProjects: () => void;
  saveStatus: string;
  renameProject: (projectId: string, nextName: string) => Promise<boolean>;
};

export function ProjectWorkspace({
  activeProject,
  projectData,
  setProjectData,
  saveProject,
  backToProjects,
  saveStatus,
  renameProject,
}: ProjectWorkspaceProps) {
  const [projectName, setProjectName] = useState(activeProject.name);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    setProjectName(activeProject.name);
  }, [activeProject.name]);

  async function saveProjectName() {
    if (projectName.trim() === activeProject.name.trim()) return;

    setRenaming(true);
    const saved = await renameProject(activeProject.id, projectName);
    setRenaming(false);

    if (!saved) {
      setProjectName(activeProject.name);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.wideCard}>
        <div style={styles.headerRow}>
          <div style={styles.projectTitleBlock}>
            <label style={styles.projectNameLabel}>
              Project Name
              <input
                style={styles.projectNameInput}
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                onBlur={saveProjectName}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }

                  if (event.key === "Escape") {
                    setProjectName(activeProject.name);
                    event.currentTarget.blur();
                  }
                }}
              />
            </label>
            <p style={styles.muted}>Power Planner</p>
            <p style={styles.saveStatus}>
              {renaming ? "Renaming project..." : saveStatus}
            </p>
          </div>

          <div style={styles.row}>
            <button style={styles.secondaryButton} onClick={backToProjects}>
              Back to Projects
            </button>
            <button style={styles.button} onClick={saveProject}>
              Save Now
            </button>
          </div>
        </div>

        <hr style={styles.divider} />

        <PowerPlannerApp
          plannerState={projectData.plannerState}
          setPlannerState={(plannerState) =>
            setProjectData({
              ...projectData,
              plannerState,
            })
          }
        />
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "40px",
    fontFamily: "Arial, sans-serif",
    background: "#f5f7fb",
  },
  wideCard: {
    maxWidth: "100%",
    margin: "0 auto",
    background: "white",
    padding: "24px",
    borderRadius: "14px",
    border: "1px solid #d9e0ea",
  },
  muted: {
    color: "#000000",
    margin: "4px 0 0",
  },
  saveStatus: {
    color: "#637083",
    fontSize: "13px",
    marginTop: "4px",
  },
  row: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
  },
  projectTitleBlock: {
    minWidth: 0,
    flex: 1,
  },
  projectNameLabel: {
    display: "block",
    color: "#637083",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.01em",
    maxWidth: "520px",
  },
  projectNameInput: {
    display: "block",
    width: "100%",
    marginTop: "6px",
    padding: "8px 0",
    border: "0",
    borderBottom: "1px solid #d9e0ea",
    background: "transparent",
    color: "#111827",
    font: "inherit",
    fontSize: "30px",
    fontWeight: 600,
    letterSpacing: "-0.03em",
  },
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #172033",
    background: "#172033",
    color: "white",
    cursor: "pointer",
    fontWeight: 500,
  },
  secondaryButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
    fontWeight: 500,
  },
  divider: {
    border: 0,
    borderTop: "1px solid #d9e0ea",
    margin: "20px 0",
  },
};

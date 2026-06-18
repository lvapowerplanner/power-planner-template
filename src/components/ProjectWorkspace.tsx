import { PowerPlannerApp } from "@/components/PowerPlannerApp";
import type { Project, ProjectData } from "@/types/project";

type ProjectWorkspaceProps = {
  activeProject: Project;
  projectData: ProjectData;
  setProjectData: (data: ProjectData) => void;
  saveProject: () => void;
  backToProjects: () => void;
  saveStatus: string;
};

export function ProjectWorkspace({
  activeProject,
  projectData,
  setProjectData,
  saveProject,
  backToProjects,
  saveStatus,
}: ProjectWorkspaceProps) {
  return (
    <main style={styles.page}>
      <section style={styles.wideCard}>
        <div style={styles.headerRow}>
          <div>
            <h1>{activeProject.name}</h1>
            <p style={styles.muted}>Power Planner</p>
            <p style={styles.saveStatus}>{saveStatus}</p>
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
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #172033",
    background: "#172033",
    color: "white",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
  },
  divider: {
    border: 0,
    borderTop: "1px solid #d9e0ea",
    margin: "20px 0",
  },
};
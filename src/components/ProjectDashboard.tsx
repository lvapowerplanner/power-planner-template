import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Project } from "@/types/project";

type ProjectDashboardProps = {
  user: User;
  projects: Project[];
  newProjectName: string;
  setNewProjectName: (value: string) => void;
  createProject: () => void;
  openProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  renameProject: (projectId: string, nextName: string) => Promise<boolean>;
  signOut: () => void;
};

export function ProjectDashboard({
  user,
  projects,
  newProjectName,
  setNewProjectName,
  createProject,
  openProject,
  deleteProject,
  renameProject,
  signOut,
}: ProjectDashboardProps) {
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");

  function startRenameProject(project: Project) {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  }

  function cancelRenameProject() {
    setEditingProjectId(null);
    setEditingProjectName("");
  }

  async function saveProjectName(projectId: string) {
    const saved = await renameProject(projectId, editingProjectName);

    if (saved) {
      cancelRenameProject();
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.wideCard}>
        <div style={styles.headerRow}>
          <div>
            <h1>Event Power Planner</h1>
            <p style={styles.muted}>Signed in as {user.email}</p>
          </div>

          <button style={styles.button} onClick={signOut}>
            Sign Out
          </button>
        </div>

        <hr style={styles.divider} />

        <h2>Projects</h2>

        <div style={styles.createProjectRow}>
          <input
            style={styles.input}
            placeholder="New project name"
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
          />
          <button style={styles.button} onClick={createProject}>
            Create Project
          </button>
        </div>

        <div style={styles.projectList}>
          {projects.length === 0 ? (
            <p style={styles.muted}>No projects yet.</p>
          ) : (
            projects.map((project) => {
              const isEditing = editingProjectId === project.id;

              return (
                <div key={project.id} style={styles.projectCard}>
                  <div style={styles.projectDetails}>
                    {isEditing ? (
                      <label style={styles.renameLabel}>
                        Project Name
                        <input
                          style={styles.input}
                          value={editingProjectName}
                          onChange={(event) =>
                            setEditingProjectName(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              saveProjectName(project.id);
                            }

                            if (event.key === "Escape") {
                              cancelRenameProject();
                            }
                          }}
                          autoFocus
                        />
                      </label>
                    ) : (
                      <>
                        <strong>{project.name}</strong>
                        <p style={styles.muted}>
                          Created {new Date(project.created_at).toLocaleString()}
                        </p>
                      </>
                    )}
                  </div>

                  <div style={styles.row}>
                    {isEditing ? (
                      <>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => saveProjectName(project.id)}
                        >
                          Save Name
                        </button>
                        <button
                          style={styles.secondaryButton}
                          onClick={cancelRenameProject}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => openProject(project)}
                        >
                          Open
                        </button>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => startRenameProject(project)}
                        >
                          Rename
                        </button>
                        <button
                          style={styles.dangerButton}
                          onClick={() => deleteProject(project.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
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
    maxWidth: "900px",
    margin: "0 auto",
    background: "white",
    padding: "24px",
    borderRadius: "14px",
    border: "1px solid #d9e0ea",
  },
  muted: {
    color: "#000000",
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
  },
  row: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "center",
  },
  createProjectRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px",
    marginBottom: "20px",
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
    margin: "20px 0",
  },
  projectList: {
    display: "grid",
    gap: "10px",
  },
  projectCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  projectDetails: {
    minWidth: 0,
    flex: 1,
  },
  renameLabel: {
    display: "block",
    color: "#637083",
    fontWeight: 400,
  },
};

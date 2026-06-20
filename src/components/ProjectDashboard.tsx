import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Project } from "@/types/project";

type WorkspaceBranding = {
  subdomain: string;
  company_name: string;
  logo_url?: string | null;
  contact_email?: string | null;
  report_footer?: string | null;
  font_family?: string | null;
  highlight_colour?: string | null;
};

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
  workspaceBranding?: WorkspaceBranding;
};


const defaultWorkspaceFont = "Arial, sans-serif";
const defaultWorkspaceHighlight = "#172033";

function workspaceFontFamily(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.font_family?.trim() || defaultWorkspaceFont;
}

function workspaceHighlightColour(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.highlight_colour?.trim() || defaultWorkspaceHighlight;
}

function workspaceThemeStyle(workspaceBranding?: WorkspaceBranding): React.CSSProperties {
  return {
    fontFamily: workspaceFontFamily(workspaceBranding),
    "--lva-workspace-highlight": workspaceHighlightColour(workspaceBranding),
    "--lva-ui-hover": workspaceBranding?.highlight_colour?.trim()
      ? `${workspaceHighlightColour(workspaceBranding)}14`
      : "rgba(158, 158, 158, 0.07)",
    "--lva-ui-border-hover": workspaceHighlightColour(workspaceBranding),
  } as React.CSSProperties;
}

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
  workspaceBranding,
}: ProjectDashboardProps) {
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const companyName = workspaceBranding?.company_name?.trim() || "Event Power Planner";
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
    <main style={{ ...styles.page, ...workspaceThemeStyle(workspaceBranding) }}>
      <section style={styles.wideCard}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.brandRow}>
              {workspaceBranding?.logo_url && (
                <img
                  src={workspaceBranding.logo_url}
                  alt={`${companyName} logo`}
                  style={styles.logo}
                />
              )}
              <div>
                <h1 style={styles.pageTitle}>{companyName} Workspace</h1>
                <p style={styles.poweredBy}>Powered by LVA Power Planner</p>
                <p style={styles.muted}>Signed in as {user.email}</p>
              </div>
            </div>
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
  brandRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  logo: {
    maxWidth: "120px",
    maxHeight: "52px",
    objectFit: "contain",
  },
  pageTitle: {
    margin: 0,
  },
  poweredBy: {
    margin: "3px 0 0",
    color: "#637083",
    fontSize: "13px",
    fontWeight: 400,
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
    border: "1px solid var(--lva-workspace-highlight, #172033)",
    background: "var(--lva-workspace-highlight, #172033)",
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

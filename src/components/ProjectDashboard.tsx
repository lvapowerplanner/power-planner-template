import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Project, ProjectShare, WorkspaceUser } from "@/types/project";

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

type ProjectDashboardProps = {
  user: User;
  projects: Project[];
  newProjectName: string;
  setNewProjectName: (value: string) => void;
  projectSharingEnabled?: boolean;
  projectShares: ProjectShare[];
  workspaceUsers: WorkspaceUser[];
  createProject: () => void;
  openProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  renameProject: (projectId: string, nextName: string) => Promise<boolean>;
  updateProjectShares: (projectId: string, sharedWithUserIds: string[]) => Promise<boolean>;
  signOut: () => void;
  workspaceBranding?: WorkspaceBranding;
};

const defaultWorkspaceFont = "Arial, sans-serif";
const defaultWorkspaceHighlight = "#172033";
const defaultWorkspaceDarkButton = "#172033";

function workspaceFontFamily(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.font_family?.trim() || defaultWorkspaceFont;
}

function workspaceHighlightColour(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.highlight_colour?.trim() || defaultWorkspaceHighlight;
}

function workspaceDarkButtonColour(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.dark_button_colour?.trim() || defaultWorkspaceDarkButton;
}

function workspaceThemeStyle(workspaceBranding?: WorkspaceBranding): React.CSSProperties {
  return {
    fontFamily: workspaceFontFamily(workspaceBranding),
    "--lva-workspace-highlight": workspaceHighlightColour(workspaceBranding),
    "--lva-workspace-dark-button": workspaceDarkButtonColour(workspaceBranding),
    "--lva-ui-hover": workspaceBranding?.highlight_colour?.trim()
      ? `${workspaceHighlightColour(workspaceBranding)}14`
      : "rgba(158, 158, 158, 0.07)",
    "--lva-ui-border-hover": workspaceHighlightColour(workspaceBranding),
  } as React.CSSProperties;
}

function isOwnedByCurrentUser(project: Project, user: User) {
  return project.user_id === user.id;
}

function projectDate(project: Project) {
  return project.updated_at || project.created_at;
}

function userLabel(user: WorkspaceUser) {
  return user.email || user.id;
}

export function ProjectDashboard({
  user,
  projects,
  newProjectName,
  setNewProjectName,
  projectSharingEnabled = false,
  projectShares,
  workspaceUsers,
  createProject,
  openProject,
  deleteProject,
  renameProject,
  updateProjectShares,
  signOut,
  workspaceBranding,
}: ProjectDashboardProps) {
  const [settingsProjectId, setSettingsProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [selectedShareUsers, setSelectedShareUsers] = useState<string[]>([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const companyName = workspaceBranding?.company_name?.trim() || "Event Power Planner";

  const sharesByProject = useMemo(() => {
    return projectShares.reduce<Record<string, ProjectShare[]>>((map, share) => {
      map[share.project_id] = [...(map[share.project_id] ?? []), share];
      return map;
    }, {});
  }, [projectShares]);

  const shareableUsers = useMemo(
    () => workspaceUsers.filter((workspaceUser) => workspaceUser.id !== user.id),
    [workspaceUsers, user.id],
  );

  const { privateProjects, sharedByMeProjects, sharedWithMeProjects } = useMemo(() => {
    return {
      privateProjects: projects.filter(
        (project) =>
          isOwnedByCurrentUser(project, user) &&
          (sharesByProject[project.id] ?? []).length === 0 &&
          project.is_private !== false,
      ),
      sharedByMeProjects: projects.filter(
        (project) =>
          isOwnedByCurrentUser(project, user) &&
          ((sharesByProject[project.id] ?? []).length > 0 || project.is_private === false),
      ),
      sharedWithMeProjects: projects.filter(
        (project) => !isOwnedByCurrentUser(project, user),
      ),
    };
  }, [projects, sharesByProject, user]);

  function projectVisibilityLabel(project: Project) {
    if (!isOwnedByCurrentUser(project, user)) return "Shared with me";

    const shareCount = (sharesByProject[project.id] ?? []).length;

    if (shareCount > 0) return `Shared with ${shareCount}`;
    return "Private";
  }

  function openSettings(project: Project) {
    if (settingsProjectId === project.id) {
      closeSettings();
      return;
    }

    setSettingsProjectId(project.id);
    setEditingProjectName(project.name);
    setSelectedShareUsers(
      (sharesByProject[project.id] ?? []).map((share) => share.shared_with),
    );
  }

  function closeSettings() {
    setSettingsProjectId(null);
    setEditingProjectName("");
    setSelectedShareUsers([]);
    setSettingsSaving(false);
  }

  function toggleShareUser(userId: string) {
    setSelectedShareUsers((currentUsers) =>
      currentUsers.includes(userId)
        ? currentUsers.filter((currentUserId) => currentUserId !== userId)
        : [...currentUsers, userId],
    );
  }

  async function saveProjectName(projectId: string) {
    setSettingsSaving(true);
    const saved = await renameProject(projectId, editingProjectName);
    setSettingsSaving(false);
    return saved;
  }

  async function saveProjectSharing(projectId: string, shareUserIds = selectedShareUsers) {
    setSettingsSaving(true);
    const saved = await updateProjectShares(projectId, shareUserIds);
    setSettingsSaving(false);
    return saved;
  }

  async function saveAllSettings(project: Project) {
    const renamed = project.name.trim() === editingProjectName.trim()
      ? true
      : await saveProjectName(project.id);

    if (!renamed) return;

    if (projectSharingEnabled) {
      const shared = await saveProjectSharing(project.id);
      if (!shared) return;
    }

    closeSettings();
  }

  async function makeProjectPrivate(projectId: string) {
    setSelectedShareUsers([]);
    const saved = await saveProjectSharing(projectId, []);

    if (saved) {
      closeSettings();
    }
  }

  function confirmDeleteProject(project: Project) {
    const confirmed = confirm(
      `Delete “${project.name}”? This cannot be undone.`,
    );

    if (!confirmed) return;

    deleteProject(project.id);
  }

  function renderSettingsPanel(project: Project) {
    if (settingsProjectId !== project.id) return null;

    const shareCount = selectedShareUsers.length;

    return (
      <section style={styles.settingsPanel}>
        <div style={styles.settingsHeader}>
          <div>
            <strong>Project Settings</strong>
            <p style={styles.muted}>Rename, share or delete “{project.name}”.</p>
          </div>
          <button style={styles.iconButton} onClick={closeSettings} aria-label="Close project settings">
            ×
          </button>
        </div>

        <div style={styles.settingsGrid}>
          <section style={styles.settingsSection}>
            <h4 style={styles.settingsSectionTitle}>Project name</h4>
            <label style={styles.renameLabel}>
              Name
              <input
                style={styles.input}
                value={editingProjectName}
                onChange={(event) => setEditingProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    saveAllSettings(project);
                  }

                  if (event.key === "Escape") {
                    closeSettings();
                  }
                }}
              />
            </label>
          </section>

          <section style={styles.settingsSection}>
            <div style={styles.sectionHeaderRow}>
              <div>
                <h4 style={styles.settingsSectionTitle}>Sharing</h4>
                <p style={styles.mutedSmall}>
                  {projectSharingEnabled
                    ? "Projects are private by default. Select specific users to share this project."
                    : "Sharing is disabled on the app workspace."}
                </p>
              </div>
              {projectSharingEnabled && (
                <span style={styles.countBadge}>{shareCount} selected</span>
              )}
            </div>

            {projectSharingEnabled ? (
              shareableUsers.length === 0 ? (
                <p style={styles.emptyText}>No other users were found in this workspace.</p>
              ) : (
                <div style={styles.userShareList}>
                  {shareableUsers.map((workspaceUser) => (
                    <label key={workspaceUser.id} style={styles.userShareRow}>
                      <input
                        type="checkbox"
                        checked={selectedShareUsers.includes(workspaceUser.id)}
                        onChange={() => toggleShareUser(workspaceUser.id)}
                      />
                      <span>{userLabel(workspaceUser)}</span>
                    </label>
                  ))}
                </div>
              )
            ) : (
              <p style={styles.emptyText}>This project is only visible to your account.</p>
            )}
          </section>
        </div>

        <div style={styles.settingsActions}>
          <button
            style={styles.button}
            onClick={() => saveAllSettings(project)}
            disabled={settingsSaving}
          >
            {settingsSaving ? "Saving…" : "Save Settings"}
          </button>

          {projectSharingEnabled && (
            <button
              style={styles.secondaryButton}
              onClick={() => makeProjectPrivate(project.id)}
              disabled={settingsSaving || shareCount === 0}
            >
              Make Private
            </button>
          )}

          <button style={styles.secondaryButton} onClick={closeSettings} disabled={settingsSaving}>
            Cancel
          </button>

          <button
            style={styles.dangerButton}
            onClick={() => confirmDeleteProject(project)}
            disabled={settingsSaving}
          >
            Delete Project
          </button>
        </div>
      </section>
    );
  }

  function renderProjectList(title: string, description: string, items: Project[]) {
    return (
      <section style={styles.projectGroup}>
        <div style={styles.groupHeader}>
          <div>
            <h3 style={styles.groupTitle}>{title}</h3>
            <p style={styles.muted}>{description}</p>
          </div>
          <span style={styles.countBadge}>{items.length}</span>
        </div>

        {items.length === 0 ? (
          <p style={styles.emptyText}>No projects in this section.</p>
        ) : (
          <div style={styles.projectList}>
            {items.map((project) => {
              const isOwner = isOwnedByCurrentUser(project, user);
              const shareCount = (sharesByProject[project.id] ?? []).length;

              return (
                <div key={project.id} style={styles.projectCardShell}>
                  <div style={styles.projectCard}>
                    <div style={styles.projectDetails}>
                      <div style={styles.projectTitleRow}>
                        <strong>{project.name}</strong>
                        <span style={styles.visibilityBadge}>
                          {projectVisibilityLabel(project)}
                        </span>
                      </div>
                      <p style={styles.muted}>
                        {project.updated_at ? "Updated" : "Created"} {new Date(projectDate(project)).toLocaleString()}
                        {!isOwner ? " · Shared project" : shareCount > 0 ? ` · ${shareCount} user${shareCount === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>

                    <div style={styles.row}>
                      <button
                        style={styles.secondaryButton}
                        onClick={() => openProject(project)}
                      >
                        Open
                      </button>

                      {isOwner && (
                        <button
                          style={styles.settingsButton}
                          onClick={() => openSettings(project)}
                          aria-label={`Open project actions for ${project.name}`}
                          title="Project actions"
                        >
                          ⋮
                        </button>
                      )}
                    </div>
                  </div>

                  {isOwner && renderSettingsPanel(project)}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
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

        <section style={styles.createPanel}>
          <div>
            <h2 style={styles.createTitle}>Create Project</h2>
            <p style={styles.muted}>
              {projectSharingEnabled
                ? "Projects are private by default. Use the project actions menu to share a project with selected workspace users."
                : "Projects on the app workspace are individual and only visible to you."}
            </p>
          </div>

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
        </section>

        <hr style={styles.divider} />

        {projects.length === 0 ? (
          <p style={styles.muted}>No projects yet.</p>
        ) : (
          <div style={styles.groups}>
            {projectSharingEnabled ? (
              <>
                {renderProjectList(
                  "Private Projects",
                  "Projects only visible to you. Use the project actions menu to share with selected users.",
                  privateProjects,
                )}
                {renderProjectList(
                  "Shared By Me",
                  "Projects you have shared with selected workspace users.",
                  sharedByMeProjects,
                )}
                {renderProjectList(
                  "Shared With Me",
                  "Projects other users have shared with you.",
                  sharedWithMeProjects,
                )}
              </>
            ) : (
              renderProjectList(
                "My Projects",
                "Individual projects on the app workspace.",
                [...privateProjects, ...sharedByMeProjects],
              )
            )}
          </div>
        )}
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
    maxWidth: "1060px",
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
    color: "#637083",
    margin: "4px 0 0",
  },
  mutedSmall: {
    color: "#637083",
    margin: "4px 0 0",
    fontSize: "13px",
  },
  emptyText: {
    color: "#637083",
    margin: 0,
    padding: "14px",
    border: "1px dashed #d9e0ea",
    borderRadius: "12px",
    background: "#fbfcfe",
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
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
  createPanel: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "16px",
    background: "#fbfcfe",
  },
  createTitle: {
    margin: 0,
  },
  createProjectRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px",
    alignItems: "end",
    marginTop: "12px",
  },
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--lva-workspace-dark-button, #172033)",
    background: "var(--lva-workspace-dark-button, #172033)",
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
  settingsButton: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
    fontSize: "24px",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
    fontSize: "20px",
    lineHeight: 1,
  },
  dangerButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #c53030",
    background: "#fff5f5",
    color: "#c53030",
    cursor: "pointer",
    fontWeight: 500,
    marginLeft: "auto",
  },
  divider: {
    border: 0,
    borderTop: "1px solid #d9e0ea",
    margin: "20px 0",
  },
  groups: {
    display: "grid",
    gap: "18px",
  },
  projectGroup: {
    display: "grid",
    gap: "10px",
  },
  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  groupTitle: {
    margin: 0,
  },
  countBadge: {
    border: "1px solid #d9e0ea",
    borderRadius: "999px",
    padding: "4px 10px",
    color: "#172033",
    background: "#f5f7fb",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  projectList: {
    display: "grid",
    gap: "10px",
  },
  projectCardShell: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    background: "white",
    overflow: "hidden",
  },
  projectCard: {
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
  projectTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  visibilityBadge: {
    border: "1px solid #d9e0ea",
    borderRadius: "999px",
    padding: "2px 8px",
    color: "#172033",
    background: "#f5f7fb",
    fontSize: "12px",
    fontWeight: 600,
  },
  renameLabel: {
    display: "block",
    color: "#637083",
    fontWeight: 400,
  },
  settingsPanel: {
    borderTop: "1px solid #d9e0ea",
    padding: "16px",
    background: "#fbfcfe",
    display: "grid",
    gap: "14px",
  },
  settingsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 0.8fr) minmax(280px, 1.2fr)",
    gap: "14px",
  },
  settingsSection: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "14px",
    background: "white",
  },
  settingsSectionTitle: {
    margin: 0,
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "flex-start",
    marginBottom: "10px",
  },
  userShareList: {
    display: "grid",
    gap: "8px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  userShareRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    padding: "10px",
    border: "1px solid #d9e0ea",
    borderRadius: "10px",
    background: "white",
    color: "#172033",
  },
  settingsActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
};

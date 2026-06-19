"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { LoginForm } from "@/components/LoginForm";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { supabase } from "@/lib/supabaseClient";
import {
  emptyProjectData,
  type Project,
  type ProjectData,
} from "@/types/project";

export default function PlannerPortal() {
  const [user, setUser] = useState<User | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectData, setProjectData] =
    useState<ProjectData>(emptyProjectData);

  const [saveStatus, setSaveStatus] = useState("Not saved yet");
  const [accessMessage, setAccessMessage] = useState("");

  function currentSubdomain() {
    if (typeof window === "undefined") return "";

    const host = window.location.hostname
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split(":")[0];

    if (host === "localhost" || host === "127.0.0.1") {
      return "demo";
    }

    const explicitWorkspaces: Record<string, string> = {
      "demo.lvapowerplanner.com": "demo",
      "sterling.lvapowerplanner.com": "sterling",
    };

    if (explicitWorkspaces[host]) {
      return explicitWorkspaces[host];
    }

    if (host.endsWith(".lvapowerplanner.com")) {
      return host.replace(".lvapowerplanner.com", "");
    }

    return host.split(".")[0] ?? "";
  }

  function clearSessionState(message = "") {
    setUser(null);
    setProjects([]);
    setActiveProject(null);
    setProjectData(emptyProjectData);
    setSaveStatus("Not saved yet");
    setAccessMessage(message);
  }

  async function checkWorkspaceAccess(currentUser: User) {
    const currentWorkspace = currentSubdomain();

    if (!currentWorkspace) {
      await supabase.auth.signOut();
      clearSessionState("This workspace could not be identified.");
      return false;
    }

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("allowed_subdomain")
      .eq("id", currentUser.id)
      .single();

    if (error || !profile) {
      await supabase.auth.signOut();
      clearSessionState("This account is not assigned to a workspace.");
      return false;
    }

    const allowedWorkspace = String(profile.allowed_subdomain ?? "")
      .trim()
      .toLowerCase();

    if (allowedWorkspace !== currentWorkspace) {
      await supabase.auth.signOut();
      clearSessionState(
        `This account is not authorised for this workspace. Current workspace: ${currentWorkspace}. Allowed workspace: ${allowedWorkspace || "none"}.`
      );
      return false;
    }

    setAccessMessage("");
    return true;
  }

  async function approveAndLoadUser(currentUser: User) {
    const allowed = await checkWorkspaceAccess(currentUser);

    if (!allowed) return;

    setUser(currentUser);
    await loadProjects(currentUser);
  }

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created. Please check your email.");
  }

  async function signIn() {
    setAccessMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (data.user) {
      await approveAndLoadUser(data.user);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    clearSessionState();
  }

  async function loadProjects(currentUser: User) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setProjects(data ?? []);
  }

  async function createProject() {
    if (!user) return;

    if (!newProjectName.trim()) {
      alert("Please enter a project name.");
      return;
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert([
        {
          name: newProjectName.trim(),
          user_id: user.id,
        },
      ])
      .select()
      .single();

    if (projectError) {
      alert(projectError.message);
      return;
    }

    const { error: dataError } = await supabase.from("project_data").insert([
      {
        project_id: project.id,
        data: emptyProjectData,
      },
    ]);

    if (dataError) {
      alert(dataError.message);
      return;
    }

    setNewProjectName("");
    await loadProjects(user);
  }

  async function renameProject(projectId: string, nextName: string) {
    const cleanName = nextName.trim();

    if (!cleanName) {
      alert("Please enter a project name.");
      return false;
    }

    const { error } = await supabase
      .from("projects")
      .update({ name: cleanName })
      .eq("id", projectId);

    if (error) {
      alert(error.message);
      return false;
    }

    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === projectId ? { ...project, name: cleanName } : project
      )
    );

    setActiveProject((currentProject) =>
      currentProject?.id === projectId
        ? { ...currentProject, name: cleanName }
        : currentProject
    );

    return true;
  }

  async function deleteProject(projectId: string) {
    if (!confirm("Delete this project?")) return;

    await supabase.from("project_data").delete().eq("project_id", projectId);

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      alert(error.message);
      return;
    }

    if (activeProject?.id === projectId) {
      setActiveProject(null);
      setProjectData(emptyProjectData);
      setSaveStatus("Not saved yet");
    }

    if (user) {
      await loadProjects(user);
    }
  }

  async function openProject(project: Project) {
    setActiveProject(project);
    setSaveStatus("Loading project...");

    const { data, error } = await supabase
      .from("project_data")
      .select("*")
      .eq("project_id", project.id)
      .maybeSingle();

    if (error) {
      alert(error.message);
      setSaveStatus("Load failed");
      return;
    }

    if (!data) {
      const { error: createDataError } = await supabase
        .from("project_data")
        .insert([
          {
            project_id: project.id,
            data: emptyProjectData,
          },
        ]);

      if (createDataError) {
        alert(createDataError.message);
        setSaveStatus("Load failed");
        return;
      }

      setProjectData(emptyProjectData);
      setSaveStatus("Loaded");
      return;
    }

    const savedData = data.data as ProjectData;

    setProjectData(savedData?.plannerState ? savedData : emptyProjectData);
    setSaveStatus("Loaded");
  }

  async function saveProject() {
    if (!activeProject) return;

    setSaveStatus("Saving...");

    const { error } = await supabase
      .from("project_data")
      .update({
        data: projectData,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", activeProject.id);

    if (error) {
      alert(error.message);
      setSaveStatus("Save failed");
      return;
    }

    setSaveStatus(`Saved ${new Date().toLocaleTimeString()}`);
  }

  useEffect(() => {
    if (!activeProject) return;

    setSaveStatus("Unsaved changes");

    const timeout = setTimeout(() => {
      saveProject();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [projectData]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        approveAndLoadUser(data.user);
      } else {
        clearSessionState();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          approveAndLoadUser(session.user);
        } else {
          clearSessionState();
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!user) {
    return (
      <>
        {accessMessage && (
          <div style={styles.accessMessage}>{accessMessage}</div>
        )}
        <LoginForm
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          signIn={signIn}
        />
      </>
    );
  }

  if (activeProject) {
    return (
      <ProjectWorkspace
        activeProject={activeProject}
        projectData={projectData}
        setProjectData={setProjectData}
        saveProject={saveProject}
        backToProjects={() => setActiveProject(null)}
        saveStatus={saveStatus}
        renameProject={renameProject}
      />
    );
  }

  return (
    <ProjectDashboard
      user={user}
      projects={projects}
      newProjectName={newProjectName}
      setNewProjectName={setNewProjectName}
      createProject={createProject}
      openProject={openProject}
      deleteProject={deleteProject}
      renameProject={renameProject}
      signOut={signOut}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  accessMessage: {
    maxWidth: "520px",
    margin: "20px auto -20px",
    padding: "12px 14px",
    border: "1px solid #E5484D",
    borderRadius: "12px",
    background: "#FFF1F1",
    color: "#B42318",
    fontFamily: "'Outfit', Arial, sans-serif",
    fontWeight: 500,
    textAlign: "center",
  },
};

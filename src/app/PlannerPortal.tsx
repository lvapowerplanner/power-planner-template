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

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account created. Please check your email.");
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProjects([]);
    setActiveProject(null);
    setProjectData(emptyProjectData);
    setSaveStatus("Not saved yet");
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
      setUser(data.user);

      if (data.user) {
        loadProjects(data.user);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          loadProjects(session.user);
        } else {
          setProjects([]);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!user) {
    return (
      <LoginForm
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        signIn={signIn}
      />
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
      signOut={signOut}
    />
  );
}
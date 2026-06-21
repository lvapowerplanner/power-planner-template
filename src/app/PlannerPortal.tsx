"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
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

type MfaMode = "none" | "checking" | "enroll" | "challenge";

type MfaEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
  otpAuthUri: string;
};

const defaultWorkspaceFont = "'Outfit', Arial, sans-serif";

function workspaceFontFamily(workspaceBranding?: WorkspaceBranding) {
  return workspaceBranding?.font_family?.trim() || defaultWorkspaceFont;
}

function qrCodeDataUrl(qrCode: string) {
  const cleanQrCode = qrCode.trim();

  if (cleanQrCode.startsWith("data:")) {
    return cleanQrCode;
  }

  if (cleanQrCode.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanQrCode)}`;
  }

  return cleanQrCode;
}

function cleanMfaLabel(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 ._&@:+-]/g, "")
    .slice(0, 70);
}

function mfaFriendlyName(userEmail?: string | null) {
  const cleanEmail = cleanMfaLabel(userEmail ?? "");

  return cleanEmail ? `LVA: ${cleanEmail}` : "LVA Power Planner";
}

function mfaOtpAuthUri(secret: string, userEmail?: string | null) {
  const cleanSecret = secret.replace(/\s+/g, "").trim();
  const cleanEmail = cleanMfaLabel(userEmail ?? "");
  const accountName = cleanEmail || "account";
  const params = new URLSearchParams({
    secret: cleanSecret,
    issuer: "LVA",
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });

  return `otpauth://totp/${encodeURIComponent(`LVA:${accountName}`)}?${params.toString()}`;
}

const defaultWorkspaceBranding: WorkspaceBranding = {
  subdomain: "",
  company_name: "LVA Power Planner",
  logo_url: "",
  contact_email: "",
  report_footer: "",
  font_family: "",
  highlight_colour: "",
  dark_button_colour: "",
};

export default function PlannerPortal() {
  const [user, setUser] = useState<User | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState("");

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectData, setProjectData] = useState<ProjectData>(emptyProjectData);

  const [saveStatus, setSaveStatus] = useState("Not saved yet");
  const [accessMessage, setAccessMessage] = useState("");
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [workspaceBranding, setWorkspaceBranding] = useState<WorkspaceBranding>(
    defaultWorkspaceBranding,
  );
  const [mfaMode, setMfaMode] = useState<MfaMode>("none");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaEnrollment, setMfaEnrollment] = useState<MfaEnrollment | null>(
    null,
  );
  const [mfaMessage, setMfaMessage] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);

  function currentSubdomain() {
    if (typeof window === "undefined") return "";

    const host = window.location.hostname.toLowerCase();

    if (host === "localhost" || host === "127.0.0.1") {
      return "demo";
    }

    return host.split(".")[0] ?? "";
  }

  function currentHost() {
    if (typeof window === "undefined") return "";

    return window.location.hostname.toLowerCase();
  }

  async function mfaRequiredForCurrentWorkspace() {
    const host = currentHost();

    if (!host) return false;

    if (host === "localhost" || host === "127.0.0.1") {
      return true;
    }

    const { data, error } = await supabase
      .from("planner_workspaces")
      .select("require_mfa")
      .eq("host", host)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      console.error("Could not load workspace MFA setting:", error);

      // Safe fallback while the require_mfa column is being rolled out.
      return currentSubdomain() === "demo";
    }

    return Boolean(data?.require_mfa);
  }

  async function loadWorkspaceBranding() {
    const subdomain = currentSubdomain();

    if (!subdomain) {
      setWorkspaceBranding(defaultWorkspaceBranding);
      return;
    }

    const { data, error } = await supabase
      .from("workspace_settings")
      .select("*")
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (error || !data) {
      setWorkspaceBranding({
        ...defaultWorkspaceBranding,
        subdomain,
      });
      return;
    }

    setWorkspaceBranding({
      subdomain: String(data.subdomain ?? subdomain),
      company_name: String(data.company_name ?? "LVA Power Planner"),
      logo_url: data.logo_url ? String(data.logo_url) : "",
      contact_email: data.contact_email ? String(data.contact_email) : "",
      report_footer: data.report_footer ? String(data.report_footer) : "",
      font_family:
        data.font_family || data.font
          ? String(data.font_family ?? data.font)
          : "",
      highlight_colour:
        data.highlight_colour ||
        data.highlight_color ||
        data.accent_colour ||
        data.accent_color
          ? String(
              data.highlight_colour ??
                data.highlight_color ??
                data.accent_colour ??
                data.accent_color,
            )
          : "",
      dark_button_colour:
        data.dark_button_colour ||
        data.dark_button_color ||
        data.button_colour ||
        data.button_color
          ? String(
              data.dark_button_colour ??
                data.dark_button_color ??
                data.button_colour ??
                data.button_color,
            )
          : "",
    });
  }

  function isGlobalAdmin(currentUser: User) {
    return (
      currentUser.email?.trim().toLowerCase() === "admin@lvapowerplanner.com"
    );
  }

  function clearSessionState(message = "") {
    setUser(null);
    setProjects([]);
    setActiveProject(null);
    setProjectData(emptyProjectData);
    setSaveStatus("Not saved yet");
    setIsPasswordRecovery(false);
    setNewPassword("");
    setConfirmPassword("");
    setMfaMode("none");
    setMfaCode("");
    setMfaFactorId("");
    setMfaEnrollment(null);
    setMfaMessage("");
    setMfaLoading(false);
    setAccessMessage(message);
  }

  async function checkWorkspaceAccess(currentUser: User) {
    if (isGlobalAdmin(currentUser)) {
      setAccessMessage("");
      return true;
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

    const currentWorkspace = currentSubdomain();
    const allowedWorkspace = String(profile.allowed_subdomain ?? "")
      .trim()
      .toLowerCase();

    const hasWorkspaceAccess =
      allowedWorkspace === currentWorkspace ||
      allowedWorkspace === "*" ||
      allowedWorkspace === "all";

    if (!hasWorkspaceAccess) {
      await supabase.auth.signOut();
      clearSessionState("This account is not authorised for this workspace.");
      return false;
    }

    setAccessMessage("");
    return true;
  }

  async function clearUnverifiedTotpFactors() {
    const { data: factors, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      return { error };
    }

    const unverifiedTotpFactors = (factors.totp ?? []).filter(
      (factor) => factor.status !== "verified",
    );

    const cleanupErrors: string[] = [];

    for (const factor of unverifiedTotpFactors) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });

      if (unenrollError) {
        cleanupErrors.push(unenrollError.message);
      }
    }

    return {
      error: null,
      cleanupErrors,
    };
  }

  async function abandonPendingMfaEnrollment() {
    const pendingFactorId =
      mfaMode === "enroll" ? mfaEnrollment?.factorId || mfaFactorId : "";

    if (pendingFactorId) {
      await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    }

    await clearUnverifiedTotpFactors();
  }

  async function beginMfaEnrollment() {
    setMfaLoading(true);
    setMfaMessage("");
    setMfaCode("");

    await abandonPendingMfaEnrollment();

    const cleanup = await clearUnverifiedTotpFactors();

    if (cleanup.error) {
      setMfaLoading(false);
      setMfaMessage(cleanup.error.message);
      return false;
    }

    const enrollWithFreshName = () =>
      supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: mfaFriendlyName(user?.email),
      });

    let enrollmentResult = await enrollWithFreshName();

    if (enrollmentResult.error) {
      await clearUnverifiedTotpFactors();
      enrollmentResult = await enrollWithFreshName();
    }

    setMfaLoading(false);

    if (enrollmentResult.error) {
      const message = enrollmentResult.error.message.toLowerCase();

      if (message.includes("already exists")) {
        const { data: factors, error: factorsError } =
          await supabase.auth.mfa.listFactors();

        if (factorsError) {
          setMfaMessage(factorsError.message);
          return false;
        }

        const verifiedTotpFactor = (factors.totp ?? []).find(
          (factor) => factor.status === "verified",
        );

        if (verifiedTotpFactor) {
          setMfaFactorId(verifiedTotpFactor.id);
          setMfaEnrollment(null);
          setMfaMode("challenge");
          setMfaCode("");
          setMfaMessage("Enter the 6-digit code from your authenticator app.");
          return false;
        }
      }

      setMfaMessage(enrollmentResult.error.message);
      return false;
    }

    const enrolledFactor = enrollmentResult.data;

    if (!enrolledFactor?.id || !enrolledFactor.totp?.qr_code || !enrolledFactor.totp?.secret) {
      setMfaMessage("Could not prepare 2FA setup. Please sign out and try again.");
      return false;
    }

    setMfaEnrollment({
      factorId: enrolledFactor.id,
      qrCode: enrolledFactor.totp.qr_code,
      secret: enrolledFactor.totp.secret,
      otpAuthUri: mfaOtpAuthUri(enrolledFactor.totp.secret, user?.email),
    });
    setMfaFactorId(enrolledFactor.id);
    setMfaMode("enroll");
    setMfaMessage(
      cleanup.cleanupErrors?.length
        ? "A previous incomplete setup was found. Scan this new QR code to continue."
        : "",
    );
    return true;
  }

  async function prepareMandatoryMfa(currentUser: User) {
    const mfaRequired = await mfaRequiredForCurrentWorkspace();

    if (!mfaRequired) {
      setMfaMode("none");
      setMfaLoading(false);
      return true;
    }

    setUser(currentUser);
    setMfaMode("checking");
    setMfaLoading(true);
    setMfaMessage("Checking two-factor authentication status…");

    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError) {
      setMfaLoading(false);
      setMfaMode("challenge");
      setMfaMessage(aalError.message);
      return false;
    }

    if (aal.currentLevel === "aal2") {
      setMfaMode("none");
      setMfaCode("");
      setMfaFactorId("");
      setMfaEnrollment(null);
      setMfaMessage("");
      setMfaLoading(false);
      return true;
    }

    const { data: factors, error: factorsError } =
      await supabase.auth.mfa.listFactors();

    if (factorsError) {
      setMfaLoading(false);
      setMfaMode("challenge");
      setMfaMessage(factorsError.message);
      return false;
    }

    const verifiedTotpFactors = (factors.totp ?? []).filter(
      (factor) => factor.status === "verified",
    );

    setMfaLoading(false);

    if (verifiedTotpFactors.length > 0) {
      setMfaFactorId(verifiedTotpFactors[0].id);
      setMfaEnrollment(null);
      setMfaMode("challenge");
      setMfaCode("");
      setMfaMessage("Enter the 6-digit code from your authenticator app.");
      return false;
    }

    await beginMfaEnrollment();
    return false;
  }

  async function approveAndLoadUser(currentUser: User) {
    const allowed = await checkWorkspaceAccess(currentUser);

    if (!allowed) return;

    const mfaApproved = await prepareMandatoryMfa(currentUser);

    if (!mfaApproved) return;

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

  async function requestPasswordReset() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      alert("Please enter your email address first.");
      return;
    }

    const redirectTo =
      typeof window === "undefined" ? undefined : window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password reset email sent. Please check your inbox.");
  }

  async function completePasswordReset() {
    const cleanPassword = newPassword.trim();

    if (cleanPassword.length < 8) {
      alert("Please enter a password with at least 8 characters.");
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      alert("The passwords do not match.");
      return;
    }

    const { data, error } = await supabase.auth.updateUser({
      password: cleanPassword,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setIsPasswordRecovery(false);
    setNewPassword("");
    setConfirmPassword("");
    setAccessMessage("");

    const currentUser = data.user ?? user;

    if (currentUser) {
      await approveAndLoadUser(currentUser);
    }

    alert("Password updated successfully.");
  }

  async function verifyMfaCode() {
    const cleanCode = mfaCode.trim().replace(/\s+/g, "");

    if (!cleanCode) {
      setMfaMessage("Please enter the 6-digit authenticator code.");
      return;
    }

    const factorId =
      mfaMode === "enroll" ? mfaEnrollment?.factorId : mfaFactorId;

    if (!factorId) {
      setMfaMessage("No MFA factor was found. Please sign in again.");
      return;
    }

    setMfaLoading(true);
    setMfaMessage("");

    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      setMfaLoading(false);
      setMfaMessage(challengeError.message);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: cleanCode,
    });

    setMfaLoading(false);

    if (verifyError) {
      setMfaMessage(verifyError.message);
      return;
    }

    setMfaCode("");
    setMfaMode("none");
    setMfaEnrollment(null);
    setMfaFactorId("");
    setMfaMessage("");

    const { data } = await supabase.auth.getUser();
    const currentUser = data.user ?? user;

    if (currentUser) {
      await approveAndLoadUser(currentUser);
    }
  }

  async function signOut() {
    if (mfaMode === "enroll") {
      await abandonPendingMfaEnrollment();
    }

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
        project.id === projectId ? { ...project, name: cleanName } : project,
      ),
    );

    setActiveProject((currentProject) =>
      currentProject?.id === projectId
        ? { ...currentProject, name: cleanName }
        : currentProject,
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
    loadWorkspaceBranding();

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        approveAndLoadUser(data.user);
      } else {
        clearSessionState();
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setUser(session?.user ?? null);
          setIsPasswordRecovery(true);
          setAccessMessage("");
          return;
        }

        if (session?.user) {
          approveAndLoadUser(session.user);
        } else {
          clearSessionState();
        }
      },
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
          requestPasswordReset={requestPasswordReset}
          workspaceBranding={workspaceBranding}
        />
      </>
    );
  }

  if (mfaMode !== "none") {
    return (
      <MfaGate
        mode={mfaMode}
        code={mfaCode}
        setCode={setMfaCode}
        enrollment={mfaEnrollment}
        message={mfaMessage}
        loading={mfaLoading}
        verifyCode={verifyMfaCode}
        restartEnrollment={beginMfaEnrollment}
        signOut={signOut}
        workspaceBranding={workspaceBranding}
      />
    );
  }

  if (isPasswordRecovery) {
    return (
      <main
        style={{
          ...styles.passwordPage,
          fontFamily: workspaceFontFamily(workspaceBranding),
        }}
      >
        <section style={styles.passwordCard}>
          <h1>Set New Password</h1>
          <p style={styles.passwordText}>
            Enter a new password for your{" "}
            {workspaceBranding.company_name || "LVA Power Planner"} account.
          </p>

          <label style={styles.passwordLabel}>
            New Password
            <input
              style={styles.passwordInput}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>

          <label style={styles.passwordLabel}>
            Confirm New Password
            <input
              style={styles.passwordInput}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>

          <button style={styles.passwordButton} onClick={completePasswordReset}>
            Update Password
          </button>
        </section>
      </main>
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
        workspaceBranding={workspaceBranding}
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
      workspaceBranding={workspaceBranding}
    />
  );
}

function MfaQrImage({ enrollment }: { enrollment: MfaEnrollment }) {
  const [qrSource, setQrSource] = useState("");
  const [qrError, setQrError] = useState("");

  useEffect(() => {
    let active = true;
    setQrSource("");
    setQrError("");

    async function buildQrCode() {
      try {
        const dataUrl = await QRCode.toDataURL(enrollment.otpAuthUri, {
          width: 220,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        if (active) {
          setQrSource(dataUrl);
        }
      } catch {
        if (active) {
          setQrError(
            "Could not generate the QR code. Use the manual setup key below.",
          );
        }
      }
    }

    buildQrCode();

    return () => {
      active = false;
    };
  }, [enrollment.otpAuthUri]);

  if (qrError) {
    return <p style={styles.mfaSmallText}>{qrError}</p>;
  }

  if (!qrSource) {
    return <p style={styles.mfaSmallText}>Preparing QR code…</p>;
  }

  return (
    <img
      src={qrSource}
      alt="Authenticator app QR code"
      style={styles.qrCode}
    />
  );
}

function MfaGate({
  mode,
  code,
  setCode,
  enrollment,
  message,
  loading,
  verifyCode,
  restartEnrollment,
  signOut,
  workspaceBranding,
}: {
  mode: MfaMode;
  code: string;
  setCode: (value: string) => void;
  enrollment: MfaEnrollment | null;
  message: string;
  loading: boolean;
  verifyCode: () => void;
  restartEnrollment: () => void;
  signOut: () => void;
  workspaceBranding: WorkspaceBranding;
}) {
  const companyName = workspaceBranding.company_name || "LVA Power Planner";
  const isChecking = mode === "checking";
  const isEnrollment = mode === "enroll";

  return (
    <main
      style={{
        ...styles.mfaPage,
        fontFamily: workspaceFontFamily(workspaceBranding),
      }}
    >
      <section style={styles.mfaCard}>
        {workspaceBranding.logo_url && (
          <img
            src={workspaceBranding.logo_url}
            alt={`${companyName} logo`}
            style={styles.mfaLogo}
          />
        )}

        <h1 style={styles.mfaTitle}>
          {isChecking
            ? "Checking 2FA"
            : isEnrollment
              ? "Set Up 2FA"
              : "Two-Factor Authentication"}
        </h1>
        <p style={styles.mfaText}>
          {isChecking
            ? "Two-factor authentication is required for this workspace. Please wait while we check your account status."
            : isEnrollment
              ? "Two-factor authentication is required for this workspace. Scan the QR code using Google Authenticator, Microsoft Authenticator or another TOTP app, then enter the 6-digit code."
              : "Two-factor authentication is required for this workspace. Enter the 6-digit code from your authenticator app to continue."}
        </p>

        {!isChecking && isEnrollment && enrollment?.qrCode && (
          <div style={styles.qrPanel}>
            <MfaQrImage enrollment={enrollment} />
            <p style={styles.mfaSmallText}>Manual setup key:</p>
            <code style={styles.secretCode}>{enrollment.secret}</code>
          </div>
        )}

        {!isChecking && isEnrollment && !enrollment && (
          <div style={styles.qrPanel}>
            <p style={styles.mfaText}>Preparing authenticator setup…</p>
            <button
              style={styles.mfaSecondaryButton}
              onClick={restartEnrollment}
              disabled={loading}
            >
              Retry Setup
            </button>
          </div>
        )}

        {!isChecking && (
          <label style={styles.mfaLabel}>
            Authenticator Code
            <input
              style={styles.mfaInput}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") verifyCode();
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
            />
          </label>
        )}

        {message && <p style={styles.mfaMessage}>{message}</p>}

        {!isChecking && (
          <div style={styles.mfaActions}>
            <button
              style={styles.mfaButton}
              onClick={verifyCode}
              disabled={loading}
            >
              {loading
                ? "Checking…"
                : isEnrollment
                  ? "Enable 2FA"
                  : "Verify Code"}
            </button>
            <button
              style={styles.mfaLinkButton}
              onClick={signOut}
              disabled={loading}
            >
              Sign Out
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  mfaPage: {
    minHeight: "100vh",
    padding: "40px",
    color: "#000000",
    background: "#f5f7fb",
  },
  mfaCard: {
    maxWidth: "480px",
    margin: "0 auto",
    background: "white",
    padding: "24px",
    borderRadius: "14px",
    border: "1px solid #d9e0ea",
  },
  mfaLogo: {
    maxWidth: "150px",
    maxHeight: "70px",
    objectFit: "contain",
    marginBottom: "16px",
  },
  mfaTitle: {
    marginTop: 0,
  },
  mfaText: {
    color: "#000000",
    lineHeight: 1.5,
  },
  mfaSmallText: {
    margin: "12px 0 6px",
    color: "#637083",
    fontSize: "13px",
  },
  qrPanel: {
    margin: "18px 0",
    padding: "16px",
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    background: "#F5F7FA",
    textAlign: "center",
  },
  qrCode: {
    width: "220px",
    maxWidth: "100%",
    height: "auto",
    background: "white",
    padding: "10px",
    borderRadius: "10px",
  },
  secretCode: {
    display: "block",
    padding: "10px",
    borderRadius: "10px",
    background: "white",
    color: "#111827",
    wordBreak: "break-all",
    fontSize: "13px",
  },
  mfaLabel: {
    display: "block",
    marginTop: "12px",
    marginBottom: "12px",
  },
  mfaInput: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    fontSize: "18px",
    letterSpacing: "0.08em",
  },
  mfaMessage: {
    color: "#B42318",
    background: "#FFF1F1",
    border: "1px solid #FECACA",
    borderRadius: "10px",
    padding: "10px",
    fontSize: "14px",
  },
  mfaActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: "16px",
  },
  mfaButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--lva-workspace-dark-button, #172033)",
    background: "var(--lva-workspace-dark-button, #172033)",
    color: "white",
    cursor: "pointer",
    fontWeight: 500,
  },
  mfaSecondaryButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
    fontWeight: 500,
  },
  mfaLinkButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
    fontWeight: 500,
  },
  passwordPage: {
    minHeight: "100vh",
    padding: "40px",
    fontFamily: "'Outfit', Arial, sans-serif",
    color: "#000000",
    background: "#f5f7fb",
  },
  passwordCard: {
    maxWidth: "420px",
    margin: "0 auto",
    background: "white",
    padding: "24px",
    borderRadius: "14px",
    border: "1px solid #d9e0ea",
  },
  passwordText: {
    color: "#000000",
  },
  passwordLabel: {
    display: "block",
    marginTop: "12px",
    marginBottom: "12px",
  },
  passwordInput: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
  },
  passwordButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #172033",
    background: "#172033",
    color: "white",
    cursor: "pointer",
  },
  accessMessage: {
    position: "fixed",
    top: "96px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "calc(100% - 40px)",
    maxWidth: "620px",
    padding: "14px 18px",
    border: "1px solid #E5484D",
    borderRadius: "14px",
    background: "#FFF1F1",
    color: "#B42318",
    fontFamily: "'Outfit', Arial, sans-serif",
    fontSize: "14px",
    lineHeight: 1.45,
    fontWeight: 400,
    textAlign: "center",
    zIndex: 999999,
    boxShadow: "0 8px 24px rgba(17, 24, 39, 0.14)",
    pointerEvents: "none",
  },
};

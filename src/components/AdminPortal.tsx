import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { appConfirm } from "@/lib/appDialogs";
import { AdminCableDataTab } from "@/components/AdminCableDataTab";
import {
  cloneDistroDefinition,
  DistroDefinitionBuilder,
} from "@/components/planner/DistroDefinitionBuilder";
import type { DistroDefinition, PlannerOutput } from "@/planner/types";
import type {
  WorkspaceUser,
  UserRole,
  WorkspaceUserStatus,
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

type AdminPortalProps = {
  workspaceId: string | null;
  subdomain: string;
  workspaceUsers: WorkspaceUser[];
  licenseCount: number;
  reloadWorkspaceUsers: () => Promise<void>;
  backToProjects: () => void;
  workspaceBranding?: WorkspaceBranding;
  advancedFeaturesEnabled?: boolean;
};

type AdminTab = "users" | "equipment" | "distros" | "cables" | "activity";

type StockEquipmentRow = {
  id: string | number;
  name: string;
  category: string;
  watts?: number | null;
  power_watts?: number | null;
};

type StockDistroRow = {
  id: string | number;
  name: string;
  definition?: unknown;
  input_connector?: string | null;
  rating_amps?: number | null;
  output_connectors?: unknown;
};

type EditableEquipmentRow = StockEquipmentRow & {
  editName: string;
  editCategory: string;
  editWatts: string;
};

type EditableDistroRow = StockDistroRow & {
  definitionValue: DistroDefinition | null;
};

type WorkspaceAuditRow = {
  id: string;
  actor_email?: string | null;
  target_email?: string | null;
  action: string;
  role?: string | null;
  created_at: string;
};

const equipmentCategories = [
  "Audio - Control",
  "Audio - Amps",
  "Audio - Other",
  "Lighting - Control",
  "Lighting - LED Generics",
  "Lighting - LED Pars",
  "Lighting - LED Battens",
  "Lighting - Moving Heads",
  "Lighting - Effects / Eye Candy",
  "Lighting - Haze / Other",
  "Vision - Control",
  "Vision - LED",
  "Vision - Proj",
  "Vision - Displays",
  "Rigging - Motors",
  "Expo Power Supplies",
];

function companyPrefix() {
  const prefix = process.env.NEXT_PUBLIC_COMPANY_TABLE_PREFIX || "template";

  if (!/^[a-z0-9_]+$/i.test(prefix)) {
    return "template";
  }

  return prefix.toLowerCase();
}

function tableName(baseName: "stock_equipment" | "stock_distros") {
  return `${companyPrefix()}_${baseName}`;
}

function userLabel(user: WorkspaceUser) {
  return user.email || user.id;
}

function normaliseRole(role?: string | null): UserRole {
  return role === "admin" ? "admin" : "user";
}

function userStatusLabel(status?: WorkspaceUserStatus | null) {
  if (status === "disabled") return "Disabled";
  if (status === "invited") return "Invited";
  if (status === "removed") return "Removed";
  return "Active";
}

function auditActionLabel(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAuditDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function equipmentWatts(row: StockEquipmentRow) {
  return Number(row.watts ?? row.power_watts ?? 0);
}

function mapEquipmentRows(rows: StockEquipmentRow[]): EditableEquipmentRow[] {
  return rows.map((row) => ({
    ...row,
    editName: String(row.name ?? ""),
    editCategory: String(row.category ?? ""),
    editWatts: String(equipmentWatts(row) || ""),
  }));
}

function normaliseDistroDefinition(row: StockDistroRow): DistroDefinition | null {
  let value = row.definition;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const definition = value as Record<string, unknown>;
  if (!Array.isArray(definition.outputs)) return null;

  const outputs = definition.outputs.filter(
    (output): output is PlannerOutput =>
      Boolean(output) &&
      typeof output === "object" &&
      typeof (output as PlannerOutput).id === "string" &&
      typeof (output as PlannerOutput).phase === "string",
  );

  if (outputs.length !== definition.outputs.length) return null;

  return {
    ...(definition as unknown as DistroDefinition),
    name: String(definition.name ?? row.name ?? ""),
    input: String(definition.input ?? row.input_connector ?? "32A / 3"),
    inputA: Number(definition.inputA ?? row.rating_amps ?? 0),
    outputs,
  };
}

function mapDistroRows(rows: StockDistroRow[]): EditableDistroRow[] {
  return rows.map((row) => ({
    ...row,
    definitionValue: normaliseDistroDefinition(row),
  }));
}

function workspaceThemeStyle(
  workspaceBranding?: WorkspaceBranding,
): React.CSSProperties {
  const highlight = workspaceBranding?.highlight_colour?.trim() || "#172033";
  const darkButton = workspaceBranding?.dark_button_colour?.trim() || "#172033";

  return {
    fontFamily:
      workspaceBranding?.font_family?.trim() || "'Outfit', Arial, sans-serif",
    "--lva-workspace-highlight": highlight,
    "--lva-workspace-dark-button": darkButton,
    "--lva-ui-hover": `${highlight}14`,
    "--lva-ui-border-hover": highlight,
  } as React.CSSProperties;
}

export function AdminPortal({
  workspaceId,
  subdomain,
  workspaceUsers,
  licenseCount,
  reloadWorkspaceUsers,
  backToProjects,
  workspaceBranding,
  advancedFeaturesEnabled = false,
}: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("user");
  const [userSaving, setUserSaving] = useState(false);
  const [equipmentRows, setEquipmentRows] = useState<EditableEquipmentRow[]>(
    [],
  );
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentCategory, setEquipmentCategory] = useState(
    equipmentCategories[0],
  );
  const [equipmentWattsValue, setEquipmentWattsValue] = useState("");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState("");
  const [distroRows, setDistroRows] = useState<EditableDistroRow[]>([]);
  const [distroSearch, setDistroSearch] = useState("");
  const [addingDistro, setAddingDistro] = useState(false);
  const [editingDistroId, setEditingDistroId] = useState<
    string | number | null
  >(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [auditRows, setAuditRows] = useState<WorkspaceAuditRow[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [savingStockId, setSavingStockId] = useState<string | number | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState("");
  const [managedWorkspaceUsers, setManagedWorkspaceUsers] =
    useState<WorkspaceUser[]>(workspaceUsers);
  const [editingUser, setEditingUser] = useState<WorkspaceUser | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole>("user");
  const [editingStatus, setEditingStatus] =
    useState<WorkspaceUserStatus>("active");

  const companyName =
    workspaceBranding?.company_name?.trim() || "LVA Power Planner";
  const seatsUsed = managedWorkspaceUsers.length;
  const safeLicenseCount = Math.max(Number(licenseCount) || 5, 1);
  const seatsRemaining = Math.max(safeLicenseCount - seatsUsed, 0);
  const canInvite = seatsRemaining > 0;
  const licencePercent = Math.min(
    100,
    Math.round((seatsUsed / safeLicenseCount) * 100),
  );

  const sortedUsers = useMemo(
    () =>
      [...managedWorkspaceUsers].sort((a, b) =>
        userLabel(a).localeCompare(userLabel(b)),
      ),
    [managedWorkspaceUsers],
  );

  const filteredEquipmentRows = useMemo(() => {
    const search = equipmentSearch.trim().toLowerCase();

    return equipmentRows.filter((row) => {
      const matchesSearch = search
        ? `${row.editName} ${row.editCategory}`.toLowerCase().includes(search)
        : true;
      const matchesCategory = equipmentCategoryFilter
        ? row.editCategory === equipmentCategoryFilter
        : true;

      return matchesSearch && matchesCategory;
    });
  }, [equipmentRows, equipmentSearch, equipmentCategoryFilter]);

  const filteredDistroRows = useMemo(() => {
    const search = distroSearch.trim().toLowerCase();

    return distroRows.filter((row) =>
      search ? row.name.toLowerCase().includes(search) : true,
    );
  }, [distroRows, distroSearch]);

  async function loadAudit() {
    if (!workspaceId) return;

    setLoadingAudit(true);

    const { data, error } = await supabase
      .from("workspace_user_audit")
      .select("id, actor_email, target_email, action, role, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      console.error("Could not load workspace activity:", error);
      setAuditRows([]);
    } else {
      setAuditRows((data ?? []) as WorkspaceAuditRow[]);
    }

    setLoadingAudit(false);
  }

  async function loadAdminWorkspaceUsers() {
    if (!workspaceId) {
      setManagedWorkspaceUsers([]);
      return;
    }

    const [usersResult, signOffResult] = await Promise.all([
      supabase.rpc("workspace_admin_users", {
        target_workspace_id: workspaceId,
      }),
      supabase.rpc("workspace_user_signoff_access", {
        target_workspace_id: workspaceId,
      }),
    ]);

    if (usersResult.error) {
      console.error("Could not load admin workspace users:", usersResult.error);
      showToast(`Could not load workspace users: ${usersResult.error.message}`);
      return;
    }

    if (signOffResult.error) {
      console.error("Could not load Sign-Off permissions:", signOffResult.error);
      showToast(`Could not load Sign-Off permissions: ${signOffResult.error.message}`);
    }

    const signOffByUserId = new Map(
      ((signOffResult.data ?? []) as Array<{
        id: string;
        system_signoff_enabled: boolean;
      }>).map((entry) => [entry.id, entry.system_signoff_enabled]),
    );

    setManagedWorkspaceUsers(
      ((usersResult.data ?? []) as WorkspaceUser[]).map((workspaceUser) => ({
        ...workspaceUser,
        system_signoff_enabled:
          signOffByUserId.get(workspaceUser.id) ?? true,
      })),
    );
  }

  async function loadStock() {
    setLoadingStock(true);

    const [equipmentResult, distroResult] = await Promise.all([
      supabase
        .from(tableName("stock_equipment"))
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from(tableName("stock_distros"))
        .select("*")
        .order("name", { ascending: true }),
    ]);

    if (equipmentResult.error) {
      console.error("Could not load stock equipment:", equipmentResult.error);
      setEquipmentRows([]);
    } else {
      setEquipmentRows(
        mapEquipmentRows((equipmentResult.data ?? []) as StockEquipmentRow[]),
      );
    }

    if (distroResult.error) {
      console.error("Could not load stock distros:", distroResult.error);
      setDistroRows([]);
    } else {
      setDistroRows(
        mapDistroRows((distroResult.data ?? []) as StockDistroRow[]),
      );
    }

    setLoadingStock(false);
  }

  useEffect(() => {
    loadStock();
    loadAudit();
    loadAdminWorkspaceUsers();
  }, [workspaceId]);

  async function runWorkspaceAdminAction(
    action: string,
    body: Record<string, unknown>,
  ) {
    if (!workspaceId) {
      alert("This workspace could not be resolved.");
      return false;
    }

    const functionBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!functionBaseUrl) {
      alert("Supabase URL is not configured for this deployment.");
      return false;
    }

    setUserSaving(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session?.access_token) {
        alert("Your session could not be verified. Please sign out and sign back in.");
        return false;
      }

      const response = await fetch(
        `${functionBaseUrl}/functions/v1/invite-workspace-user`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            workspace_id: workspaceId,
            subdomain,
            redirect_to: typeof window === "undefined" ? undefined : window.location.origin,
            ...body,
          }),
        },
      );

      const rawText = await response.text();
      let data: unknown = null;

      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { error: rawText };
        }
      }

      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: unknown }).error)
            : `Admin action failed with status ${response.status}.`;

        alert(message);
        return false;
      }

      if (data && typeof data === "object" && "error" in data) {
        alert(
          String((data as { error?: unknown }).error ?? "Admin action failed."),
        );
        return false;
      }

      await reloadWorkspaceUsers();
      await loadAdminWorkspaceUsers();
      await loadAudit();
      return true;
    } catch (error) {
      console.error("Workspace admin action failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Admin action failed. Please try again.",
      );
      return false;
    } finally {
      setUserSaving(false);
    }
  }

  function showToast(message: string) {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 3500);
  }

  function openEditUser(user: WorkspaceUser) {
    setEditingUser(user);
    setEditingRole(normaliseRole(user.role));
    setEditingStatus(user.status ?? "active");
  }

  function closeEditUser() {
    setEditingUser(null);
    setEditingRole("user");
    setEditingStatus("active");
  }

  async function saveEditedUser() {
    if (!editingUser) return;

    const roleChanged = normaliseRole(editingUser.role) !== editingRole;
    const currentStatus = editingUser.status ?? "active";
    const statusChanged = currentStatus !== editingStatus;

    if (!roleChanged && !statusChanged) {
      closeEditUser();
      return;
    }

    if (roleChanged) {
      const saved = await runWorkspaceAdminAction("change_role", {
        user_id: editingUser.id,
        role: editingRole,
      });

      if (!saved) return;
    }

    if (statusChanged) {
      const action =
        editingStatus === "disabled" ? "disable_user" : "enable_user";
      const saved = await runWorkspaceAdminAction(action, {
        user_id: editingUser.id,
      });

      if (!saved) return;
    }

    showToast("User updated.");
    closeEditUser();
  }

  async function resendInvitation(user: WorkspaceUser) {
    if (!(await appConfirm(`Resend invitation to ${userLabel(user)}?`))) return;

    const saved = await runWorkspaceAdminAction("resend_invitation", {
      user_id: user.id,
    });

    if (saved) showToast("Invitation resent.");
  }

  async function resetUserMfa(user: WorkspaceUser) {
    if (
      !(await appConfirm(
        `Reset MFA for ${userLabel(user)}? They will need to set up MFA again at next sign-in.`,
      ))
    )
      return;

    const saved = await runWorkspaceAdminAction("reset_mfa", {
      user_id: user.id,
    });

    if (saved) showToast("MFA reset requested.");
  }

  async function inviteUser() {
    const cleanEmail = inviteEmail.trim().toLowerCase();

    if (!cleanEmail) {
      alert("Please enter an email address.");
      return;
    }

    if (!canInvite) {
      alert(
        "This workspace has reached its licence limit. Licence increases should be requested through LVA Power Planner.",
      );
      return;
    }

    const saved = await runWorkspaceAdminAction("invite_user", {
      email: cleanEmail,
      role: inviteRole,
    });

    if (!saved) return;

    setInviteEmail("");
    setInviteRole("user");
    showToast("Invitation sent.");
  }

  async function updateUserRole(userId: string, role: UserRole) {
    await runWorkspaceAdminAction("change_role", {
      user_id: userId,
      role,
    });
  }

  async function toggleAdvancedAccess(workspaceUser: WorkspaceUser) {
    if (!workspaceId) return;
    setUserSaving(true);
    const { error } = await supabase.rpc(
      "set_workspace_user_advanced_features",
      {
        target_workspace_id: workspaceId,
        target_user_id: workspaceUser.id,
        enabled: workspaceUser.advanced_features_enabled === false,
      },
    );
    setUserSaving(false);
    if (error) {
      showToast(error.message);
      return;
    }
    await reloadWorkspaceUsers();
    await loadAdminWorkspaceUsers();
    showToast(
      workspaceUser.advanced_features_enabled === false
        ? "Advanced Calculations enabled."
        : "Advanced Calculations disabled.",
    );
  }

  async function toggleSystemSignOffAccess(workspaceUser: WorkspaceUser) {
    if (!workspaceId) return;
    setUserSaving(true);
    const { error } = await supabase.rpc(
      "set_workspace_user_signoff_features",
      {
        target_workspace_id: workspaceId,
        target_user_id: workspaceUser.id,
        enabled: workspaceUser.system_signoff_enabled === false,
      },
    );
    setUserSaving(false);

    if (error) {
      showToast(error.message);
      return;
    }

    await reloadWorkspaceUsers();
    await loadAdminWorkspaceUsers();
    showToast(
      workspaceUser.system_signoff_enabled === false
        ? "System Sign-Off enabled."
        : "System Sign-Off disabled.",
    );
  }

  async function toggleUserDisabled(user: WorkspaceUser) {
    const disabled = user.status === "disabled";
    const action = disabled ? "enable_user" : "disable_user";
    const promptLabel = disabled ? "Re-enable" : "Disable";

    if (!(await appConfirm(`${promptLabel} ${userLabel(user)}?`))) {
      return;
    }

    await runWorkspaceAdminAction(action, {
      user_id: user.id,
    });
  }

  async function removeWorkspaceAccess(user: WorkspaceUser) {
    if (
      !(await appConfirm(
        `Remove workspace access for ${userLabel(user)}? This does not delete their Supabase Auth account.`,
      ))
    ) {
      return;
    }

    await runWorkspaceAdminAction("remove_user", {
      user_id: user.id,
    });
  }

  function patchEquipmentLocal(
    rowId: string | number,
    patch: Partial<EditableEquipmentRow>,
  ) {
    setEquipmentRows((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  }

  async function addEquipment() {
    const cleanName = equipmentName.trim();
    const watts = Number(equipmentWattsValue);

    if (!cleanName || !Number.isFinite(watts) || watts <= 0) {
      alert("Please enter an equipment name and valid wattage.");
      return;
    }

    const { error } = await supabase.from(tableName("stock_equipment")).insert({
      name: cleanName,
      category: equipmentCategory,
      watts,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setEquipmentName("");
    setEquipmentWattsValue("");
    await loadStock();
  }

  async function saveEquipment(row: EditableEquipmentRow) {
    const cleanName = row.editName.trim();
    const cleanCategory = row.editCategory.trim();
    const watts = Number(row.editWatts);

    if (!cleanName || !cleanCategory || !Number.isFinite(watts) || watts <= 0) {
      alert("Please enter an equipment name, category and valid wattage.");
      return;
    }

    setSavingStockId(row.id);

    const { error } = await supabase
      .from(tableName("stock_equipment"))
      .update({ name: cleanName, category: cleanCategory, watts })
      .eq("id", row.id);

    setSavingStockId(null);

    if (error) {
      alert(error.message);
      await loadStock();
      return;
    }

    await loadStock();
  }

  async function duplicateEquipment(row: EditableEquipmentRow) {
    const watts = Number(row.editWatts) || equipmentWatts(row);

    const { error } = await supabase.from(tableName("stock_equipment")).insert({
      name: `${row.editName || row.name} Copy`,
      category: row.editCategory || row.category,
      watts,
    });

    if (error) {
      alert(error.message);
      return;
    }

    showToast("Equipment duplicated.");
    await loadStock();
  }

  async function deleteEquipment(row: StockEquipmentRow) {
    if (!(await appConfirm(`Archive ${row.name}? This removes it from the live library.`)))
      return;

    const { error } = await supabase
      .from(tableName("stock_equipment"))
      .delete()
      .eq("id", row.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadStock();
  }

  async function addDistro(definition: DistroDefinition) {
    const { error } = await supabase.from(tableName("stock_distros")).insert({
      name: definition.name,
      definition,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setAddingDistro(false);
    showToast("Distro added to the workspace library.");
    await loadStock();
  }

  async function saveDistro(
    row: EditableDistroRow,
    definition: DistroDefinition,
  ) {
    setSavingStockId(row.id);

    const { error } = await supabase
      .from(tableName("stock_distros"))
      .update({ name: definition.name, definition })
      .eq("id", row.id);

    setSavingStockId(null);

    if (error) {
      alert(error.message);
      await loadStock();
      return;
    }

    setEditingDistroId(null);
    showToast("Distro updated.");
    await loadStock();
  }

  async function duplicateDistro(row: EditableDistroRow) {
    if (!row.definitionValue) {
      alert("This distro definition cannot be duplicated until it is rebuilt.");
      return;
    }

    const nextName = `${row.name} Copy`;
    const copiedDefinition = cloneDistroDefinition(
      row.definitionValue,
      nextName,
    );

    const { error } = await supabase.from(tableName("stock_distros")).insert({
      name: nextName,
      definition: copiedDefinition,
    });

    if (error) {
      alert(error.message);
      return;
    }

    showToast("Distro duplicated.");
    await loadStock();
  }

  async function deleteDistro(row: StockDistroRow) {
    if (!(await appConfirm(`Archive ${row.name}? This removes it from the live library.`)))
      return;

    const { error } = await supabase
      .from(tableName("stock_distros"))
      .delete()
      .eq("id", row.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadStock();
  }

  return (
    <main
      data-admin-portal-ui
      style={{ ...styles.page, ...workspaceThemeStyle(workspaceBranding) }}
    >
      <style>{`
        [data-admin-portal-ui] input,
        [data-admin-portal-ui] select,
        [data-admin-portal-ui] button {
          box-sizing: border-box !important;
          font-family: inherit !important;
          font-size: 14px !important;
        }

        [data-admin-portal-ui] input:not([type=checkbox]),
        [data-admin-portal-ui] select,
        [data-admin-portal-ui] button {
          height: 44px !important;
          min-height: 44px !important;
          max-height: 44px !important;
        }

        [data-admin-portal-ui] input:not([type=checkbox]),
        [data-admin-portal-ui] select {
          display: block !important;
          width: 100% !important;
          margin: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          line-height: 42px !important;
        }

        [data-admin-portal-ui] select {
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          line-height: 42px !important;
        }

        [data-admin-portal-ui] textarea {
          box-sizing: border-box !important;
          display: block !important;
          width: 100% !important;
          margin: 0 !important;
          font-family: inherit;
        }
      `}</style>
      {toastMessage && <div style={styles.toast}>{toastMessage}</div>}
      <section style={styles.card}>
        <div style={styles.headerRow}>
          <div style={styles.brandRow}>
            {workspaceBranding?.logo_url && (
              <img
                src={workspaceBranding.logo_url}
                alt={`${companyName} logo`}
                style={styles.logo}
              />
            )}
            <div>
              <h1 style={styles.title}>{companyName} Admin Portal</h1>
              <p style={styles.muted}>
                Manage users, company equipment and distro templates for this
                workspace.
              </p>
            </div>
          </div>

          <button style={styles.secondaryButton} onClick={backToProjects}>
            Back to Projects
          </button>
        </div>

        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === "users" ? styles.activeTab : {}),
            }}
            onClick={() => setActiveTab("users")}
          >
            Users
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === "equipment" ? styles.activeTab : {}),
            }}
            onClick={() => setActiveTab("equipment")}
          >
            Equipment Library
          </button>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === "distros" ? styles.activeTab : {}),
            }}
            onClick={() => setActiveTab("distros")}
          >
            Distro Library
          </button>
          {advancedFeaturesEnabled && (
            <button
              style={{
                ...styles.tab,
                ...(activeTab === "cables" ? styles.activeTab : {}),
              }}
              onClick={() => setActiveTab("cables")}
            >
              Cable Data
            </button>
          )}
          <button
            style={{
              ...styles.tab,
              ...(activeTab === "activity" ? styles.activeTab : {}),
            }}
            onClick={() => setActiveTab("activity")}
          >
            Activity
          </button>
        </div>

        {activeTab === "users" && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Users</h2>
                <p style={styles.muted}>
                  Invite users and control whether they have user or admin
                  access.
                </p>
              </div>
              <div style={styles.licencePanel}>
                <div style={styles.licenceHeader}>
                  <span>Professional</span>
                  <strong>
                    {seatsUsed} / {safeLicenseCount}
                  </strong>
                </div>
                <div style={styles.licenceTrack}>
                  <span
                    style={{
                      ...styles.licenceFill,
                      width: `${licencePercent}%`,
                    }}
                  />
                </div>
                <span style={styles.mutedSmall}>
                  {seatsRemaining} licence{seatsRemaining === 1 ? "" : "s"}{" "}
                  remaining
                </span>
              </div>
            </div>

            <div style={styles.formCard}>
              <h3 style={styles.cardTitle}>Invite User</h3>
              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Email
                  <input
                    style={styles.input}
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="user@company.com"
                  />
                </label>
                <label style={styles.label}>
                  User Type
                  <select
                    style={styles.select}
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value as UserRole)
                    }
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                <button
                  style={styles.button}
                  onClick={inviteUser}
                  disabled={!canInvite || userSaving}
                >
                  {userSaving ? "Inviting…" : "Invite User"}
                </button>
              </div>
              {!canInvite && (
                <p style={styles.warningText}>
                  Licence limit reached. Licence increases are controlled by LVA
                  Power Planner and should be requested separately.
                </p>
              )}
            </div>

            <div style={styles.list}>
              {sortedUsers.map((workspaceUser) => (
                <div key={workspaceUser.id} style={styles.userCard}>
                  <div style={styles.userIdentity}>
                    <div style={styles.avatarCircle}>
                      {userLabel(workspaceUser).slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{userLabel(workspaceUser)}</strong>
                      <p style={styles.mutedSmall}>
                        <span
                          style={{
                            ...styles.statusDot,
                            ...(workspaceUser.status === "disabled"
                              ? styles.statusDisabled
                              : workspaceUser.status === "invited"
                                ? styles.statusInvited
                                : styles.statusActive),
                          }}
                        />
                        {userStatusLabel(workspaceUser.status)}
                        {" · "}
                        {normaliseRole(workspaceUser.role) === "admin"
                          ? "Admin"
                          : "User"}
                        {advancedFeaturesEnabled && (
                          <>
                            {" · "}
                            {workspaceUser.advanced_features_enabled === false
                              ? "Calculations off"
                              : "Calculations on"}
                            {" · "}
                            {workspaceUser.system_signoff_enabled === false
                              ? "Sign-Off off"
                              : "Sign-Off on"}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <div style={styles.userActions}>
                    {advancedFeaturesEnabled && (
                      <button
                        style={styles.secondaryButton}
                        onClick={() => toggleAdvancedAccess(workspaceUser)}
                        disabled={userSaving}
                      >
                        {workspaceUser.advanced_features_enabled === false
                          ? "Enable Calculations"
                          : "Disable Calculations"}
                      </button>
                    )}
                    {advancedFeaturesEnabled && (
                      <button
                        style={styles.secondaryButton}
                        onClick={() =>
                          toggleSystemSignOffAccess(workspaceUser)
                        }
                        disabled={userSaving}
                      >
                        {workspaceUser.system_signoff_enabled === false
                          ? "Enable Sign-Off"
                          : "Disable Sign-Off"}
                      </button>
                    )}
                    <button
                      style={styles.secondaryButton}
                      onClick={() => openEditUser(workspaceUser)}
                      disabled={userSaving}
                    >
                      Edit
                    </button>
                    {workspaceUser.status === "invited" && (
                      <button
                        style={styles.secondaryButton}
                        onClick={() => resendInvitation(workspaceUser)}
                        disabled={userSaving}
                      >
                        Resend
                      </button>
                    )}
                    <button
                      style={styles.secondaryButton}
                      onClick={() => resetUserMfa(workspaceUser)}
                      disabled={userSaving}
                    >
                      Reset MFA
                    </button>
                    <button
                      style={styles.secondaryButton}
                      onClick={() => toggleUserDisabled(workspaceUser)}
                      disabled={userSaving}
                    >
                      {workspaceUser.status === "disabled"
                        ? "Enable"
                        : "Disable"}
                    </button>
                    <button
                      style={styles.dangerButton}
                      onClick={() => removeWorkspaceAccess(workspaceUser)}
                      disabled={userSaving}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "equipment" && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Equipment Library</h2>
                <p style={styles.muted}>
                  Edit the company equipment library available in the Distro
                  Editor.
                </p>
              </div>
              <button style={styles.secondaryButton} onClick={loadStock}>
                Refresh
              </button>
            </div>

            <div style={styles.formCard}>
              <h3 style={styles.cardTitle}>Add Equipment</h3>
              <div style={styles.equipmentFormGrid}>
                <label style={styles.label}>
                  Name
                  <input
                    style={styles.input}
                    value={equipmentName}
                    onChange={(event) => setEquipmentName(event.target.value)}
                  />
                </label>
                <label style={styles.label}>
                  Category
                  <select
                    style={styles.select}
                    value={equipmentCategory}
                    onChange={(event) =>
                      setEquipmentCategory(event.target.value)
                    }
                  >
                    {equipmentCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={styles.label}>
                  Watts
                  <input
                    style={styles.input}
                    type="number"
                    min="1"
                    value={equipmentWattsValue}
                    onChange={(event) =>
                      setEquipmentWattsValue(event.target.value)
                    }
                  />
                </label>
                <button style={styles.button} onClick={addEquipment}>
                  Add Equipment
                </button>
              </div>
            </div>

            <div style={styles.filterRow}>
              <input
                className="admin-filter-control"
                style={styles.input}
                value={equipmentSearch}
                onChange={(event) => setEquipmentSearch(event.target.value)}
                placeholder="Search equipment…"
              />
              <select
                className="admin-filter-control"
                style={styles.select}
                value={equipmentCategoryFilter}
                onChange={(event) =>
                  setEquipmentCategoryFilter(event.target.value)
                }
              >
                <option value="">All categories</option>
                {equipmentCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {loadingStock ? (
              <p style={styles.muted}>Loading stock…</p>
            ) : (
              <div style={styles.list}>
                {filteredEquipmentRows.map((row) => (
                  <div key={row.id} style={styles.equipmentRowCard}>
                    <input
                      style={styles.inlineInput}
                      value={row.editName}
                      onChange={(event) =>
                        patchEquipmentLocal(row.id, {
                          editName: event.target.value,
                        })
                      }
                      onBlur={() => saveEquipment(row)}
                      placeholder="Name"
                    />
                    <input
                      style={styles.inlineInput}
                      value={row.editCategory}
                      onChange={(event) =>
                        patchEquipmentLocal(row.id, {
                          editCategory: event.target.value,
                        })
                      }
                      onBlur={() => saveEquipment(row)}
                      placeholder="Category"
                    />
                    <input
                      style={styles.inlineInput}
                      type="number"
                      min="1"
                      value={row.editWatts}
                      onChange={(event) =>
                        patchEquipmentLocal(row.id, {
                          editWatts: event.target.value,
                        })
                      }
                      onBlur={() => saveEquipment(row)}
                      placeholder="Watts"
                    />
                    <button
                      style={styles.secondaryButton}
                      onClick={() => saveEquipment(row)}
                      disabled={savingStockId === row.id}
                    >
                      {savingStockId === row.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      style={styles.secondaryButton}
                      onClick={() => duplicateEquipment(row)}
                    >
                      Duplicate
                    </button>
                    <button
                      style={styles.dangerButton}
                      onClick={() => deleteEquipment(row)}
                    >
                      Archive
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "distros" && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Distro Library</h2>
                <p style={styles.muted}>
                  Edit the company distro templates available when users add a
                  distro.
                </p>
              </div>
              <div style={styles.rowActions}>
                <button
                  style={styles.button}
                  onClick={() => {
                    setAddingDistro((open) => !open);
                    setEditingDistroId(null);
                  }}
                >
                  {addingDistro ? "Close Builder" : "Add Distro"}
                </button>
                <button style={styles.secondaryButton} onClick={loadStock}>
                  Refresh
                </button>
              </div>
            </div>

            {addingDistro && (
              <div style={styles.formCard}>
                <h3 style={styles.cardTitle}>Add Workspace Distro</h3>
                <p style={styles.mutedSmall}>
                  This template will be available to every project in this
                  workspace.
                </p>
                <div style={styles.builderSpacing}>
                  <DistroDefinitionBuilder
                    saveLabel="Add to Workspace Library"
                    onSave={addDistro}
                    onCancel={() => setAddingDistro(false)}
                  />
                </div>
              </div>
            )}

            <div style={styles.filterRow}>
              <input
                className="admin-filter-control"
                style={styles.input}
                value={distroSearch}
                onChange={(event) => setDistroSearch(event.target.value)}
                placeholder="Search distros…"
              />
            </div>

            {loadingStock ? (
              <p style={styles.muted}>Loading stock…</p>
            ) : (
              <div style={styles.list}>
                {filteredDistroRows.map((row) => (
                  <div key={row.id} style={styles.distroRowCard}>
                    <div style={styles.distroRowHeader}>
                      <div>
                        <strong>{row.name}</strong>
                        {row.definitionValue ? (
                          <p style={styles.mutedSmall}>
                            Input {row.definitionValue.input} ·{" "}
                            {row.definitionValue.outputs.length} outputs
                          </p>
                        ) : (
                          <p style={styles.invalidDefinition}>
                            This legacy definition cannot be opened in the
                            visual builder.
                          </p>
                        )}
                      </div>
                      <div style={styles.rowActions}>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => {
                            setEditingDistroId((current) =>
                              current === row.id ? null : row.id,
                            );
                            setAddingDistro(false);
                          }}
                          disabled={!row.definitionValue}
                        >
                          {editingDistroId === row.id ? "Close" : "Edit"}
                        </button>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => duplicateDistro(row)}
                          disabled={!row.definitionValue}
                        >
                          Duplicate
                        </button>
                        <button
                          style={styles.dangerButton}
                          onClick={() => deleteDistro(row)}
                        >
                          Archive
                        </button>
                      </div>
                    </div>
                    {editingDistroId === row.id && row.definitionValue && (
                      <div style={styles.expandedBuilder}>
                        <DistroDefinitionBuilder
                          initialDefinition={row.definitionValue}
                          saveLabel="Save Workspace Distro"
                          saving={savingStockId === row.id}
                          onSave={(definition) => saveDistro(row, definition)}
                          onCancel={() => setEditingDistroId(null)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {advancedFeaturesEnabled && activeTab === "cables" && (
          <section style={styles.section}>
            <AdminCableDataTab workspaceId={workspaceId} />
          </section>
        )}

        {activeTab === "activity" && (
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Recent Activity</h2>
                <p style={styles.muted}>
                  Workspace administration changes are logged here for review.
                </p>
              </div>
              <button style={styles.secondaryButton} onClick={loadAudit}>
                Refresh
              </button>
            </div>

            {loadingAudit ? (
              <p style={styles.muted}>Loading activity…</p>
            ) : auditRows.length === 0 ? (
              <div style={styles.emptyState}>
                No activity has been logged yet.
              </div>
            ) : (
              <div style={styles.activityList}>
                {auditRows.map((row) => (
                  <div key={row.id} style={styles.activityCard}>
                    <div style={styles.activityDot} />
                    <div>
                      <strong>{auditActionLabel(row.action)}</strong>
                      <p style={styles.mutedSmall}>
                        {row.actor_email || "Workspace admin"}
                        {row.target_email ? ` → ${row.target_email}` : ""}
                        {row.role ? ` · ${row.role}` : ""}
                      </p>
                    </div>
                    <span style={styles.activityDate}>
                      {formatAuditDate(row.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </section>

      {editingUser && (
        <div style={styles.modalOverlay}>
          <section style={styles.modalCard} role="dialog" aria-modal="true">
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Edit User</h2>
                <p style={styles.muted}>{userLabel(editingUser)}</p>
              </div>
              <button style={styles.secondaryButton} onClick={closeEditUser}>
                Close
              </button>
            </div>

            <div style={styles.modalGrid}>
              <label style={styles.label}>
                Role
                <select
                  style={styles.select}
                  value={editingRole}
                  onChange={(event) =>
                    setEditingRole(event.target.value as UserRole)
                  }
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <label style={styles.label}>
                Status
                <select
                  style={styles.select}
                  value={editingStatus}
                  onChange={(event) =>
                    setEditingStatus(event.target.value as WorkspaceUserStatus)
                  }
                >
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.button}
                onClick={saveEditedUser}
                disabled={userSaving}
              >
                {userSaving ? "Saving…" : "Save User"}
              </button>
              <button
                style={styles.secondaryButton}
                onClick={() => resetUserMfa(editingUser)}
                disabled={userSaving}
              >
                Reset MFA
              </button>
              {editingUser.status === "invited" && (
                <button
                  style={styles.secondaryButton}
                  onClick={() => resendInvitation(editingUser)}
                  disabled={userSaving}
                >
                  Resend Invitation
                </button>
              )}
              <button
                style={styles.dangerButton}
                onClick={() => removeWorkspaceAccess(editingUser)}
                disabled={userSaving}
              >
                Remove Access
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "40px",
    background: "#f5f7fb",
  },
  card: {
    maxWidth: "1240px",
    margin: "0 auto",
    background: "white",
    padding: "24px",
    borderRadius: "16px",
    border: "1px solid #d9e0ea",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
  },
  brandRow: {
    display: "flex",
    gap: "14px",
    alignItems: "center",
  },
  logo: {
    maxWidth: "110px",
    maxHeight: "52px",
    objectFit: "contain",
  },
  title: { margin: 0, letterSpacing: "-0.03em" },
  sectionTitle: { margin: 0, letterSpacing: "-0.03em" },
  cardTitle: { margin: "0 0 12px", fontSize: "16px" },
  muted: { color: "#637083", margin: "6px 0 0" },
  mutedSmall: { color: "#637083", fontSize: "13px", margin: "4px 0 0" },
  tabs: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    marginTop: "22px",
    borderBottom: "1px solid #d9e0ea",
    paddingBottom: "10px",
  },
  tab: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    cursor: "pointer",
    fontWeight: 700,
  },
  activeTab: {
    background: "var(--lva-workspace-dark-button)",
    color: "white",
    borderColor: "var(--lva-workspace-dark-button)",
  },
  section: { display: "grid", gap: "18px", marginTop: "22px" },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  licencePanel: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "12px 14px",
    background: "#f8fafc",
    display: "grid",
    gap: "4px",
    minWidth: "180px",
  },
  formCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "14px",
    padding: "16px",
    background: "#fbfcfe",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 1fr) minmax(160px, 220px) auto",
    gap: "12px",
    alignItems: "end",
  },
  equipmentFormGrid: {
    display: "grid",
    gridTemplateColumns:
      "minmax(220px, 1fr) minmax(220px, 320px) minmax(120px, 180px) auto",
    gap: "12px",
    alignItems: "end",
  },
  distroFormGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 320px) 1fr auto",
    gap: "12px",
    alignItems: "end",
  },
  filterRow: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 1fr) minmax(220px, 320px)",
    gap: "12px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    color: "#637083",
    fontWeight: 600,
  },
  input: {
    width: "100%",
    height: "44px",
    minHeight: "44px",
    padding: "0 12px",
    marginTop: 0,
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "#FFFFFF",
    boxSizing: "border-box",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: "42px",
    verticalAlign: "middle",
  },
  select: {
    width: "100%",
    height: "44px",
    minHeight: "44px",
    padding: "0 38px 0 12px",
    marginTop: 0,
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    backgroundColor: "#FFFFFF",
    backgroundImage:
      "linear-gradient(45deg, transparent 50%, #637083 50%), linear-gradient(135deg, #637083 50%, transparent 50%)",
    backgroundPosition: "calc(100% - 18px) 19px, calc(100% - 13px) 19px",
    backgroundSize: "5px 5px, 5px 5px",
    backgroundRepeat: "no-repeat",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: "42px",
    verticalAlign: "middle",
  },
  textarea: {
    width: "100%",
    minHeight: "120px",
    padding: "10px 12px",
    marginTop: 0,
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    fontFamily: "monospace",
    fontSize: "14px",
    lineHeight: 1.45,
    background: "white",
    boxSizing: "border-box",
  },
  distroEditTextarea: {
    width: "100%",
    minHeight: "220px",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    fontFamily: "monospace",
    fontSize: "12px",
    lineHeight: 1.45,
    background: "white",
    boxSizing: "border-box",
  },
  button: {
    height: "44px",
    minHeight: "44px",
    padding: "0 16px",
    borderRadius: "10px",
    border: "1px solid var(--lva-workspace-dark-button)",
    background: "var(--lva-workspace-dark-button)",
    color: "white",
    cursor: "pointer",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: "20px",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  },
  secondaryButton: {
    height: "44px",
    minHeight: "44px",
    padding: "0 16px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "white",
    color: "#172033",
    cursor: "pointer",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: "20px",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  },
  dangerButton: {
    height: "44px",
    minHeight: "44px",
    padding: "0 16px",
    borderRadius: "10px",
    border: "1px solid #c53030",
    background: "#fff5f5",
    color: "#c53030",
    cursor: "pointer",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: "20px",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  },
  warningText: {
    color: "#92400e",
    background: "#fffbeb",
    border: "1px solid #f59e0b",
    borderRadius: "10px",
    padding: "10px",
    margin: "12px 0 0",
  },
  list: { display: "grid", gap: "10px" },
  userCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "12px",
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
  },
  userActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  },
  smallSelect: {
    height: "44px",
    minHeight: "44px",
    padding: "0 34px 0 12px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    backgroundColor: "#FFFFFF",
    backgroundImage:
      "linear-gradient(45deg, transparent 50%, #637083 50%), linear-gradient(135deg, #637083 50%, transparent 50%)",
    backgroundPosition: "calc(100% - 17px) 19px, calc(100% - 12px) 19px",
    backgroundSize: "5px 5px, 5px 5px",
    backgroundRepeat: "no-repeat",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: "42px",
  },
  equipmentRowCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "12px",
    display: "grid",
    gridTemplateColumns:
      "minmax(200px, 1fr) minmax(200px, 1fr) minmax(100px, 140px) auto auto auto",
    gap: "10px",
    alignItems: "center",
  },
  distroRowCard: {
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "12px",
    display: "grid",
    gap: "10px",
  },
  distroRowHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) auto",
    gap: "10px",
    alignItems: "center",
  },
  builderSpacing: { marginTop: "18px" },
  expandedBuilder: {
    marginTop: "4px",
    padding: "16px",
    borderTop: "1px solid #d9e0ea",
    background: "#fbfcfe",
  },
  invalidDefinition: {
    color: "#92400e",
    margin: "4px 0 0",
    fontSize: "13px",
  },
  rowActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  licenceHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    fontSize: "13px",
    color: "#637083",
  },
  licenceTrack: {
    height: "8px",
    borderRadius: "999px",
    background: "#e5eaf1",
    overflow: "hidden",
  },
  licenceFill: {
    display: "block",
    height: "100%",
    borderRadius: "999px",
    background: "var(--lva-workspace-dark-button)",
  },
  userIdentity: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  avatarCircle: {
    width: "38px",
    height: "38px",
    borderRadius: "999px",
    background: "#eef2f7",
    border: "1px solid #d9e0ea",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    color: "#172033",
  },
  statusDot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    marginRight: "6px",
  },
  statusActive: { background: "#16a34a" },
  statusInvited: { background: "#f59e0b" },
  statusDisabled: { background: "#94a3b8" },
  emptyState: {
    border: "1px dashed #cbd5e1",
    borderRadius: "14px",
    padding: "24px",
    color: "#637083",
    background: "#fbfcfe",
    textAlign: "center",
  },
  activityList: { display: "grid", gap: "10px" },
  activityCard: {
    display: "grid",
    gridTemplateColumns: "12px minmax(0, 1fr) auto",
    gap: "12px",
    alignItems: "center",
    border: "1px solid #d9e0ea",
    borderRadius: "12px",
    padding: "12px",
    background: "white",
  },
  activityDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: "var(--lva-workspace-dark-button)",
  },
  activityDate: {
    color: "#637083",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },

  toast: {
    position: "fixed",
    top: "18px",
    right: "18px",
    zIndex: 60,
    background: "#172033",
    color: "white",
    borderRadius: "12px",
    padding: "12px 16px",
    boxShadow: "0 18px 40px rgba(17, 24, 39, 0.18)",
    fontWeight: 800,
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    zIndex: 50,
  },
  modalCard: {
    width: "min(640px, 100%)",
    background: "white",
    border: "1px solid #d9e0ea",
    borderRadius: "18px",
    padding: "22px",
    boxShadow: "0 24px 70px rgba(17, 24, 39, 0.2)",
    display: "grid",
    gap: "18px",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
  },
  modalGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  modalActions: {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  inlineInput: {
    width: "100%",
    height: "44px",
    minHeight: "44px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid #d9e0ea",
    background: "#FFFFFF",
    boxSizing: "border-box",
    fontFamily: "inherit",
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: "20px",
  },
};

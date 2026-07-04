// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UserRole = "admin" | "user";
type AdminAction =
  | "invite_user"
  | "change_role"
  | "disable_user"
  | "enable_user"
  | "remove_user"
  | "resend_invitation"
  | "reset_mfa";

type AdminPayload = {
  action?: AdminAction;
  email?: string;
  role?: UserRole;
  user_id?: string;
  workspace_id?: string;
  subdomain?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanEmail(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function cleanRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : "user";
}

function cleanSubdomain(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(".")[0]
    .replace(/[^a-z0-9-]/g, "");
}

function workspaceSubdomainFromHost(host: unknown) {
  return cleanSubdomain(host);
}

function isWorkspaceMatch(allowedSubdomain: unknown, targetSubdomain: string) {
  const allowed = String(allowedSubdomain ?? "")
    .trim()
    .toLowerCase();
  return allowed === targetSubdomain || allowed === "*" || allowed === "all";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function findAuthUserByEmail(adminClient: any, email: string) {
  const perPage = 1000;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const users = data?.users ?? [];
    const match = users.find((user: any) => cleanEmail(user.email) === email);

    if (match) return match;
    if (users.length < perPage) return null;
  }

  return null;
}

async function writeAudit(
  adminClient: any,
  entry: {
    workspace_id: string;
    actor_user_id: string;
    actor_email: string;
    target_user_id?: string | null;
    target_email?: string | null;
    action: string;
    role?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await adminClient.from("workspace_user_audit").insert({
    workspace_id: entry.workspace_id,
    actor_user_id: entry.actor_user_id,
    actor_email: entry.actor_email,
    target_user_id: entry.target_user_id ?? null,
    target_email: entry.target_email ?? null,
    action: entry.action,
    role: entry.role ?? null,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    console.error("Could not write workspace audit log:", error.message);
  }
}

async function resendInviteEmail(
  adminClient: any,
  email: string,
  redirectTo: string,
  data: Record<string, unknown>,
) {
  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data,
  });

  if (error) throw error;
}

async function resetMfaFactors(adminClient: any, userId: string) {
  const mfaAdmin = adminClient.auth?.admin?.mfa;

  if (!mfaAdmin?.listFactors || !mfaAdmin?.deleteFactor) {
    return { removed: 0, supported: false };
  }

  const { data, error } = await mfaAdmin.listFactors({ userId });

  if (error) throw error;

  const factors = [...(data?.totp ?? []), ...(data?.phone ?? [])];

  let removed = 0;

  for (const factor of factors) {
    const factorId = factor.id;

    if (!factorId) continue;

    const { error: deleteError } = await mfaAdmin.deleteFactor({
      userId,
      id: factorId,
    });

    if (deleteError) throw deleteError;
    removed += 1;
  }

  return { removed, supported: true };
}

Deno.serve(async (req) => {
  try {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(
      { error: "Supabase Edge Function secrets are not configured." },
      500,
    );
  }

  const authorization = req.headers.get("Authorization") ?? "";

  if (!authorization) {
    return jsonResponse({ error: "Missing authorization header." }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();

  if (authError || !authData.user) {
    return jsonResponse(
      { error: "You must be signed in to manage users." },
      401,
    );
  }

  let payload: AdminPayload;

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const action = payload.action ?? "invite_user";
  const workspaceId = String(payload.workspace_id ?? "").trim();
  let subdomain = cleanSubdomain(payload.subdomain);

  if (!workspaceId || !isUuid(workspaceId)) {
    return jsonResponse({ error: "Workspace ID is required." }, 400);
  }

  const { data: workspace, error: workspaceError } = await adminClient
    .from("planner_workspaces")
    .select("id, host, active")
    .eq("id", workspaceId)
    .eq("active", true)
    .maybeSingle();

  if (workspaceError)
    return jsonResponse({ error: workspaceError.message }, 500);
  if (!workspace)
    return jsonResponse(
      { error: "Workspace was not found or is inactive." },
      404,
    );

  const workspaceSubdomain = workspaceSubdomainFromHost(
    (workspace as any).host,
  );
  subdomain = subdomain || workspaceSubdomain;

  if (!subdomain || subdomain !== workspaceSubdomain) {
    return jsonResponse({ error: "Workspace/subdomain mismatch." }, 400);
  }

  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from("user_profiles")
    .select("id, email, allowed_subdomain, role, status")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (callerProfileError) {
    return jsonResponse({ error: callerProfileError.message }, 500);
  }

  const callerEmail = cleanEmail(authData.user.email);
  const isGlobalAdmin = callerEmail === "admin@lvapowerplanner.com";
  const callerStatus = String((callerProfile as any)?.status ?? "active");
  const callerIsWorkspaceAdmin =
    (callerProfile as any)?.role === "admin" &&
    callerStatus !== "disabled" &&
    callerStatus !== "removed" &&
    isWorkspaceMatch((callerProfile as any)?.allowed_subdomain, subdomain);

  if (!isGlobalAdmin && !callerIsWorkspaceAdmin) {
    return jsonResponse(
      { error: "Only workspace administrators can manage users." },
      403,
    );
  }

  const { data: settings, error: settingsError } = await adminClient
    .from("workspace_settings")
    .select("license_count")
    .eq("subdomain", subdomain)
    .maybeSingle();

  if (settingsError) return jsonResponse({ error: settingsError.message }, 500);

  const licenseCount = Math.max(
    Number((settings as any)?.license_count ?? 5),
    1,
  );

  const countSeats = async () => {
    const { count, error } = await adminClient
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("allowed_subdomain", subdomain)
      .neq("status", "removed");

    if (error) throw error;
    return count ?? 0;
  };

  if (action === "invite_user") {
    const email = cleanEmail(payload.email);
    const role = cleanRole(payload.role);

    if (!email || !email.includes("@")) {
      return jsonResponse(
        { error: "Please provide a valid email address." },
        400,
      );
    }

    const { data: existingProfile, error: existingProfileError } =
      await adminClient
        .from("user_profiles")
        .select("id, email, allowed_subdomain, status")
        .eq("email", email)
        .maybeSingle();

    if (existingProfileError) {
      return jsonResponse({ error: existingProfileError.message }, 500);
    }

    const existingIsInWorkspace =
      existingProfile &&
      String((existingProfile as any).allowed_subdomain ?? "") === subdomain &&
      String((existingProfile as any).status ?? "active") !== "removed";

    if (!existingIsInWorkspace) {
      const usedSeats = await countSeats();

      if (usedSeats >= licenseCount) {
        return jsonResponse(
          {
            error: `This workspace has reached its licence limit (${usedSeats}/${licenseCount} users). Licence increases should be requested through LVA Power Planner.`,
          },
          409,
        );
      }
    }

    const siteUrl =
      Deno.env.get("SITE_URL") || `https://${(workspace as any).host}`;
    let targetUser = existingProfile
      ? { id: (existingProfile as any).id }
      : null;
    let invited = false;

    if (!targetUser) {
      const existingAuthUser = await findAuthUserByEmail(adminClient, email);

      if (existingAuthUser) {
        targetUser = { id: existingAuthUser.id };
      }
    }

    if (!targetUser) {
      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo: siteUrl,
          data: {
            workspace_id: workspaceId,
            allowed_subdomain: subdomain,
            role,
          },
        });

      if (inviteError || !inviteData.user) {
        return jsonResponse(
          {
            error:
              inviteError?.message ?? "Supabase could not invite this user.",
          },
          400,
        );
      }

      targetUser = { id: inviteData.user.id };
      invited = true;
    }

    const { error: profileError } = await adminClient
      .from("user_profiles")
      .upsert(
        {
          id: targetUser.id,
          email,
          allowed_subdomain: subdomain,
          role,
          status: invited ? "invited" : "active",
          invited_by: authData.user.id,
          invited_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (profileError) return jsonResponse({ error: profileError.message }, 500);

    await writeAudit(adminClient, {
      workspace_id: workspaceId,
      actor_user_id: authData.user.id,
      actor_email: callerEmail,
      target_user_id: targetUser.id,
      target_email: email,
      action: invited ? "invite_user" : "add_existing_user",
      role,
      metadata: { subdomain },
    });

    return jsonResponse({
      ok: true,
      invited,
      user: { id: targetUser.id, email, role },
    });
  }

  const targetUserId = String(payload.user_id ?? "").trim();

  if (!targetUserId || !isUuid(targetUserId)) {
    return jsonResponse({ error: "A valid user ID is required." }, 400);
  }

  if (
    targetUserId === authData.user.id &&
    ["disable_user", "remove_user"].includes(action)
  ) {
    return jsonResponse(
      { error: "You cannot disable or remove your own admin account." },
      400,
    );
  }

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from("user_profiles")
    .select("id, email, allowed_subdomain, role, status")
    .eq("id", targetUserId)
    .maybeSingle();

  if (targetProfileError)
    return jsonResponse({ error: targetProfileError.message }, 500);
  if (!targetProfile)
    return jsonResponse({ error: "User profile was not found." }, 404);

  if (!isWorkspaceMatch((targetProfile as any).allowed_subdomain, subdomain)) {
    return jsonResponse(
      { error: "This user does not belong to this workspace." },
      403,
    );
  }

  const targetEmail = cleanEmail((targetProfile as any).email);

  if (action === "resend_invitation") {
    const siteUrl =
      Deno.env.get("SITE_URL") || `https://${(workspace as any).host}`;

    if (!targetEmail || !targetEmail.includes("@")) {
      return jsonResponse(
        { error: "This user profile does not have a valid email address." },
        400,
      );
    }

    try {
      await resendInviteEmail(adminClient, targetEmail, siteUrl, {
        workspace_id: workspaceId,
        allowed_subdomain: subdomain,
        role: (targetProfile as any).role ?? "user",
      });
    } catch (error) {
      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : "Supabase could not resend the invitation.",
        },
        400,
      );
    }

    const { error } = await adminClient
      .from("user_profiles")
      .update({
        status: "invited",
        invited_by: authData.user.id,
        invited_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (error) return jsonResponse({ error: error.message }, 500);

    await writeAudit(adminClient, {
      workspace_id: workspaceId,
      actor_user_id: authData.user.id,
      actor_email: callerEmail,
      target_user_id: targetUserId,
      target_email: targetEmail,
      action: "resend_invitation",
      role: (targetProfile as any).role,
      metadata: { subdomain },
    });

    return jsonResponse({ ok: true });
  }

  if (action === "reset_mfa") {
    let result = { removed: 0, supported: false };

    try {
      result = await resetMfaFactors(adminClient, targetUserId);
    } catch (error) {
      return jsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : "Supabase could not reset MFA for this user.",
        },
        400,
      );
    }

    await writeAudit(adminClient, {
      workspace_id: workspaceId,
      actor_user_id: authData.user.id,
      actor_email: callerEmail,
      target_user_id: targetUserId,
      target_email: targetEmail,
      action: "reset_mfa",
      role: (targetProfile as any).role,
      metadata: {
        subdomain,
        removed_factors: result.removed,
        supported: result.supported,
      },
    });

    return jsonResponse({
      ok: true,
      removed_factors: result.removed,
      supported: result.supported,
    });
  }

  if (action === "change_role") {
    const role = cleanRole(payload.role);

    const { error } = await adminClient
      .from("user_profiles")
      .update({ role })
      .eq("id", targetUserId);

    if (error) return jsonResponse({ error: error.message }, 500);

    await writeAudit(adminClient, {
      workspace_id: workspaceId,
      actor_user_id: authData.user.id,
      actor_email: callerEmail,
      target_user_id: targetUserId,
      target_email: targetEmail,
      action: "change_role",
      role,
      metadata: { subdomain },
    });

    return jsonResponse({ ok: true });
  }

  if (action === "disable_user" || action === "enable_user") {
    const nextStatus = action === "disable_user" ? "disabled" : "active";

    const { error } = await adminClient
      .from("user_profiles")
      .update({
        status: nextStatus,
        disabled_by: action === "disable_user" ? authData.user.id : null,
        disabled_at:
          action === "disable_user" ? new Date().toISOString() : null,
      })
      .eq("id", targetUserId);

    if (error) return jsonResponse({ error: error.message }, 500);

    await writeAudit(adminClient, {
      workspace_id: workspaceId,
      actor_user_id: authData.user.id,
      actor_email: callerEmail,
      target_user_id: targetUserId,
      target_email: targetEmail,
      action,
      role: (targetProfile as any).role,
      metadata: { subdomain },
    });

    return jsonResponse({ ok: true });
  }

  if (action === "remove_user") {
    const { error } = await adminClient
      .from("user_profiles")
      .update({
        status: "removed",
        removed_by: authData.user.id,
        removed_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (error) return jsonResponse({ error: error.message }, 500);

    await writeAudit(adminClient, {
      workspace_id: workspaceId,
      actor_user_id: authData.user.id,
      actor_email: callerEmail,
      target_user_id: targetUserId,
      target_email: targetEmail,
      action: "remove_user",
      role: (targetProfile as any).role,
      metadata: { subdomain },
    });

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Unsupported admin action." }, 400);
  } catch (error) {
    console.error("Unhandled workspace admin function error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error while running admin action.",
      },
      500,
    );
  }
});

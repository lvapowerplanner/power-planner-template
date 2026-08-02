"use client";

import { useCallback, useEffect, useState } from "react";
import { SystemSignOffTab } from "@/components/planner/SystemSignOffTab";
import { supabase } from "@/lib/supabaseClient";
import { ensureAutoSources } from "@/planner/autoSources";
import type { PlannerState } from "@/planner/types";
import type { ProjectSignOffRecord } from "@/types/signoff";
import { emptyPlannerState } from "@/types/project";

type Payload = {
  signoff: ProjectSignOffRecord;
  project_name?: string;
  planner_state?: Partial<PlannerState>;
  expires_at?: string;
  electrician_name?: string;
  electrician_email?: string;
  electrician_company?: string;
  logo_url?: string;
};

export function PublicSignOffClient({ token }: { token: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase.rpc("get_public_project_signoff", { access_token: token });
    if (loadError || !data) {
      setPayload(null);
      setError(loadError?.message ?? "This sign-off link is invalid, expired, submitted or has been replaced.");
    } else {
      setPayload(data as Payload);
      setError("");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <main style={styles.state}>Loading editable sign-off…</main>;
  if (!payload || error) return <main style={styles.state}><section style={styles.error}><h1>Sign-off unavailable</h1><p>{error}</p></section></main>;

  const plannerState = ensureAutoSources({
    ...emptyPlannerState,
    ...payload.planner_state,
    sources: payload.planner_state?.sources ?? [],
    distros: payload.planner_state?.distros ?? [],
    customEquipment: payload.planner_state?.customEquipment ?? [],
    customDistros: payload.planner_state?.customDistros ?? [],
    reportHiddenSources: payload.planner_state?.reportHiddenSources ?? [],
  });

  return <main style={styles.page}>
    <section style={styles.banner}>
      <div style={styles.bannerIdentity}><strong>External electrician sign-off</strong><span style={styles.projectName}>{payload.project_name ?? "Power Planner Project"}</span><small>Access expires: {payload.expires_at ? new Date(payload.expires_at).toLocaleString() : "Not available"}</small></div>
      <div style={styles.electricianDetails}><strong>{payload.electrician_name ?? "Assigned electrician"}</strong><span>{payload.electrician_email ?? "Email not provided"}</span><small>{payload.electrician_company ?? "Company not provided"}</small></div>
    </section>
    <SystemSignOffTab plannerState={plannerState} externalToken={token} initialRecord={payload.signoff} projectName={payload.project_name} workspaceLogoUrl={payload.logo_url} electricianDetails={{name:payload.electrician_name,email:payload.electrician_email,company:payload.electrician_company}} />
  </main>;
}

const styles: Record<string, React.CSSProperties> = {
  page:{minHeight:"100vh",padding:"24px",background:"#f5f7fa",color:"#111827"},state:{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",background:"#f5f7fa"},error:{width:"min(520px,100%)",padding:"22px",border:"1px solid #fecaca",borderRadius:"14px",background:"white",color:"#b42318"},banner:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:"24px",marginBottom:"16px",padding:"16px 18px",border:"1px solid #dce5ec",borderRadius:"14px",background:"white",flexWrap:"wrap"},bannerIdentity:{display:"grid",gap:"5px"},projectName:{fontSize:"15px",color:"#344054"},electricianDetails:{display:"grid",gap:"4px",minWidth:"220px",paddingLeft:"18px",borderLeft:"1px solid #e4e7ec",textAlign:"right"}
};

"use client";

import { useCallback, useEffect, useState } from "react";
import { ReportTab } from "@/components/planner/ReportTab";
import { supabase } from "@/lib/supabaseClient";
import { ensureAutoSources } from "@/planner/autoSources";
import type { PlannerState } from "@/planner/types";
import { emptyPlannerState } from "@/types/project";

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

type PublicReportPayload = {
  project_name?: string;
  project_updated_at?: string | null;
  planner_state?: Partial<PlannerState>;
  workspace_branding?: WorkspaceBranding;
};

function normalisePlannerState(value?: Partial<PlannerState>): PlannerState {
  return ensureAutoSources({
    ...emptyPlannerState,
    ...value,
    sources: value?.sources ?? [],
    distros: value?.distros ?? [],
    customEquipment: value?.customEquipment ?? [],
    customDistros: value?.customDistros ?? [],
    reportHiddenSources: value?.reportHiddenSources ?? [],
    reportHiddenDistros: value?.reportHiddenDistros ?? [],
    dismissedWarnings: value?.dismissedWarnings ?? [],
    advancedElectrical: {
      calculationMethod:
        value?.advancedElectrical?.calculationMethod ?? "real-power",
      defaultPowerFactor:
        value?.advancedElectrical?.defaultPowerFactor ?? 1,
      nominalSinglePhaseVoltage:
        value?.advancedElectrical?.nominalSinglePhaseVoltage ?? 230,
      nominalThreePhaseVoltage:
        value?.advancedElectrical?.nominalThreePhaseVoltage ?? 400,
      showUnusedOutputs:
        value?.advancedElectrical?.showUnusedOutputs ?? false,
    },
  });
}

export function PublicReportClient({ token }: { token: string }) {
  const [payload, setPayload] = useState<PublicReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase.rpc(
      "get_public_project_report",
      { access_token: token },
    );

    if (loadError || !data) {
      setPayload(null);
      setError(
        loadError?.message ??
          "This report link is invalid, expired or has been replaced.",
      );
      setLoading(false);
      return;
    }

    setPayload(data as PublicReportPayload);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  if (loading) {
    return <main style={styles.statePage}>Loading live report…</main>;
  }

  if (error || !payload) {
    return (
      <main style={styles.statePage}>
        <section style={styles.errorCard}>
          <h1>Report unavailable</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  const plannerState = normalisePlannerState(payload.planner_state);
  const updatedAt = payload.project_updated_at
    ? new Date(payload.project_updated_at).toLocaleString()
    : "Not available";

  return (
    <main style={styles.page}>
      <section style={styles.liveBanner} className="no-print">
        <div style={styles.liveDetails}>
          <strong style={styles.liveStatus}>Live view-only report</strong>
          <span style={styles.projectName}>
            {payload.project_name ?? "Power Planner Project"}
          </span>
          <small style={styles.updatedText}>
            Latest saved update: {updatedAt}
          </small>
        </div>
        <button style={styles.refreshButton} onClick={loadReport}>
          Refresh Report
        </button>
      </section>
      <ReportTab
        plannerState={plannerState}
        setPlannerState={() => undefined}
        openDistroEditor={() => undefined}
        workspaceBranding={payload.workspace_branding}
        viewOnly
      />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    background: "#F5F7FA",
  },
  statePage: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background: "#F5F7FA",
    color: "#344054",
  },
  errorCard: {
    width: "min(520px, 100%)",
    padding: "24px",
    border: "1px solid #FECACA",
    borderRadius: "16px",
    background: "white",
    color: "#B42318",
  },
  liveBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    maxWidth: "100%",
    margin: "0 auto 14px",
    padding: "12px 16px",
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    background: "white",
    color: "#344054",
  },
  liveDetails: {
    display: "grid",
    gap: "5px",
    minWidth: 0,
  },
  liveStatus: {
    color: "#0A8F5D",
    fontSize: "13px",
    fontWeight: 600,
  },
  projectName: {
    color: "#111827",
    fontSize: "17px",
    fontWeight: 600,
  },
  updatedText: {
    color: "#667085",
    fontSize: "12px",
  },
  refreshButton: {
    padding: "9px 12px",
    border: "1px solid #CBD5E1",
    borderRadius: "9px",
    background: "white",
    color: "#344054",
    cursor: "pointer",
    fontWeight: 500,
  },
};

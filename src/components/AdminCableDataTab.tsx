import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  GlobalCableLibraryRecord,
  WorkspaceCableOverride,
} from "@/planner/cableLibrary";

type AdminCableDataTabProps = {
  workspaceId: string | null;
};

type CableOverrideDraft = {
  ratingId: string;
  stockName: string;
  capacity: string;
  voltageDrop: string;
  installationMethod: string;
  sourceName: string;
  sourceUrl: string;
  sourceRevision: string;
  reason: string;
};

function emptyDraft(ratingId: string): CableOverrideDraft {
  return {
    ratingId,
    stockName: "",
    capacity: "",
    voltageDrop: "",
    installationMethod: "",
    sourceName: "",
    sourceUrl: "",
    sourceRevision: "",
    reason: "",
  };
}

function draftFromOverride(
  ratingId: string,
  override?: WorkspaceCableOverride,
): CableOverrideDraft {
  if (!override) return emptyDraft(ratingId);
  return {
    ratingId,
    stockName: override.stock_name ?? "",
    capacity:
      override.current_capacity_a == null
        ? ""
        : String(override.current_capacity_a),
    voltageDrop:
      override.voltage_drop_mv_per_a_m == null
        ? ""
        : String(override.voltage_drop_mv_per_a_m),
    installationMethod: override.installation_method ?? "",
    sourceName: override.source_name ?? "",
    sourceUrl: override.source_url ?? "",
    sourceRevision: override.source_revision ?? "",
    reason: override.override_reason ?? "",
  };
}

function applicationLabel(application: string) {
  return application === "three_phase_ac" ? "Three phase" : "Single phase";
}

export function AdminCableDataTab({ workspaceId }: AdminCableDataTabProps) {
  const [library, setLibrary] = useState<GlobalCableLibraryRecord[]>([]);
  const [overrides, setOverrides] = useState<WorkspaceCableOverride[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CableOverrideDraft>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadData() {
    if (!workspaceId) {
      setLibrary([]);
      setOverrides([]);
      setDrafts({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    const [libraryResult, overrideResult] = await Promise.all([
      supabase
        .from("planner_cable_library")
        .select("*")
        .order("application")
        .order("conductor_size_mm2"),
      supabase
        .from("planner_workspace_cable_overrides")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("active", true),
    ]);

    if (libraryResult.error) {
      setErrorMessage(libraryResult.error.message);
      setLibrary([]);
    } else if (overrideResult.error) {
      setErrorMessage(overrideResult.error.message);
      setLibrary([]);
    } else {
      const nextLibrary = (libraryResult.data ?? []) as GlobalCableLibraryRecord[];
      const nextOverrides = (overrideResult.data ?? []) as WorkspaceCableOverride[];
      const byRating = new Map(
        nextOverrides.map((override) => [override.cable_rating_id, override]),
      );
      setLibrary(nextLibrary);
      setOverrides(nextOverrides);
      setDrafts(
        Object.fromEntries(
          nextLibrary.map((record) => [
            record.cable_rating_id,
            draftFromOverride(
              record.cable_rating_id,
              byRating.get(record.cable_rating_id),
            ),
          ]),
        ),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const overrideIds = useMemo(
    () => new Set(overrides.map((override) => override.cable_rating_id)),
    [overrides],
  );
  const visibleLibrary = useMemo(() => {
    const term = search.trim().toLowerCase();
    return library.filter((record) =>
      term
        ? `${record.display_name} ${record.application} ${record.core_configuration}`
            .toLowerCase()
            .includes(term)
        : true,
    );
  }, [library, search]);
  const references = useMemo(() => {
    const unique = new Map<string, { name: string; revision: string }>();
    library.forEach((record) => {
      const url = record.source_url?.trim();
      if (url && !unique.has(url)) {
        unique.set(url, {
          name: record.source_name,
          revision: record.source_revision,
        });
      }
    });
    return Array.from(unique.entries());
  }, [library]);

  function patchDraft(ratingId: string, patch: Partial<CableOverrideDraft>) {
    setDrafts((current) => ({
      ...current,
      [ratingId]: {
        ...(current[ratingId] ?? emptyDraft(ratingId)),
        ...patch,
      },
    }));
  }

  function hasAnyValue(draft: CableOverrideDraft) {
    return [
      draft.stockName,
      draft.capacity,
      draft.voltageDrop,
      draft.installationMethod,
      draft.sourceName,
      draft.sourceUrl,
      draft.sourceRevision,
      draft.reason,
    ].some((value) => value.trim());
  }

  async function saveOverride(record: GlobalCableLibraryRecord) {
    if (!workspaceId) return;
    const draft = drafts[record.cable_rating_id] ?? emptyDraft(record.cable_rating_id);
    setMessage("");
    setErrorMessage("");

    if (!hasAnyValue(draft)) {
      await resetOverride(record.cable_rating_id, false);
      return;
    }

    const capacity = draft.capacity.trim() ? Number(draft.capacity) : null;
    const voltageDrop = draft.voltageDrop.trim()
      ? Number(draft.voltageDrop)
      : null;
    if ((capacity != null && capacity <= 0) || (voltageDrop != null && voltageDrop <= 0)) {
      setErrorMessage("Override capacity and voltage drop must be greater than zero.");
      return;
    }
    if (
      (capacity != null || voltageDrop != null) &&
      (!draft.sourceName.trim() ||
        !draft.sourceRevision.trim() ||
        !draft.reason.trim())
    ) {
      setErrorMessage(
        "Electrical-value overrides require a source name, source revision and override reason.",
      );
      return;
    }

    setSavingId(record.cable_rating_id);
    const { error } = await supabase
      .from("planner_workspace_cable_overrides")
      .upsert(
        {
          workspace_id: workspaceId,
          cable_rating_id: record.cable_rating_id,
          stock_name: draft.stockName.trim() || null,
          current_capacity_a: capacity,
          voltage_drop_mv_per_a_m: voltageDrop,
          installation_method: draft.installationMethod.trim() || null,
          source_name: draft.sourceName.trim() || null,
          source_url: draft.sourceUrl.trim() || null,
          source_revision: draft.sourceRevision.trim() || null,
          override_reason: draft.reason.trim() || null,
          active: true,
        },
        { onConflict: "workspace_id,cable_rating_id" },
      );

    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage(`${record.display_name} saved for this workspace.`);
      await loadData();
    }
    setSavingId(null);
  }

  async function resetOverride(ratingId: string, confirmReset = true) {
    if (!workspaceId) return;
    if (
      confirmReset &&
      !confirm("Reset this cable to the standard library values?")
    ) {
      return;
    }

    setSavingId(ratingId);
    const { error } = await supabase
      .from("planner_workspace_cable_overrides")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("cable_rating_id", ratingId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setMessage("Standard cable values restored.");
      await loadData();
    }
    setSavingId(null);
  }

  if (!workspaceId) {
    return <div style={styles.notice}>Cable overrides require a company workspace.</div>;
  }

  return (
    <section style={styles.page}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Cable Data</h2>
          <p style={styles.muted}>
            Align canonical cable values with documented company stock. Blank
            override fields retain the standard value.
          </p>
        </div>
        <button type="button" style={styles.secondaryButton} onClick={loadData}>
          Refresh
        </button>
      </div>

      <input
        style={styles.search}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search cable data…"
      />

      {message && <div style={styles.success}>{message}</div>}
      {errorMessage && <div style={styles.error}>{errorMessage}</div>}
      {loading ? (
        <div style={styles.notice}>Loading cable data…</div>
      ) : (
        <div style={styles.list}>
          {visibleLibrary.map((record) => {
            const draft = drafts[record.cable_rating_id] ?? emptyDraft(record.cable_rating_id);
            const overridden = overrideIds.has(record.cable_rating_id);
            return (
              <section key={record.cable_rating_id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <strong>{record.display_name}</strong>
                    <span style={styles.cardMeta}>
                      {applicationLabel(record.application)} · {record.conductor_size_mm2} mm²
                    </span>
                  </div>
                  <span style={overridden ? styles.overrideBadge : styles.standardBadge}>
                    {overridden ? "Workspace override" : "Standard values"}
                  </span>
                </div>

                <div style={styles.standardRow}>
                  <span>Standard capacity: <strong>{record.current_capacity_a} A</strong></span>
                  <span>Standard voltage drop: <strong>{record.voltage_drop_mv_per_a_m} mV/A/m</strong></span>
                  <span>{record.installation_method}</span>
                </div>

                <div style={styles.formGrid}>
                  <label style={styles.label}>Company stock name
                    <input style={styles.input} value={draft.stockName} placeholder={record.display_name} onChange={(event) => patchDraft(record.cable_rating_id, { stockName: event.target.value })} />
                  </label>
                  <label style={styles.label}>Capacity override (A)
                    <input style={styles.input} type="number" min="0.01" step="0.1" value={draft.capacity} placeholder={String(record.current_capacity_a)} onChange={(event) => patchDraft(record.cable_rating_id, { capacity: event.target.value })} />
                  </label>
                  <label style={styles.label}>Voltage-drop override (mV/A/m)
                    <input style={styles.input} type="number" min="0.001" step="0.001" value={draft.voltageDrop} placeholder={String(record.voltage_drop_mv_per_a_m)} onChange={(event) => patchDraft(record.cable_rating_id, { voltageDrop: event.target.value })} />
                  </label>
                  <label style={styles.label}>Installation method override
                    <input style={styles.input} value={draft.installationMethod} placeholder={record.installation_method} onChange={(event) => patchDraft(record.cable_rating_id, { installationMethod: event.target.value })} />
                  </label>
                  <label style={styles.label}>Source name
                    <input style={styles.input} value={draft.sourceName} onChange={(event) => patchDraft(record.cable_rating_id, { sourceName: event.target.value })} />
                  </label>
                  <label style={styles.label}>Source revision
                    <input style={styles.input} value={draft.sourceRevision} onChange={(event) => patchDraft(record.cable_rating_id, { sourceRevision: event.target.value })} />
                  </label>
                  <label style={styles.label}>Source URL
                    <input style={styles.input} type="url" value={draft.sourceUrl} onChange={(event) => patchDraft(record.cable_rating_id, { sourceUrl: event.target.value })} />
                  </label>
                  <label style={styles.label}>Override reason
                    <input style={styles.input} value={draft.reason} onChange={(event) => patchDraft(record.cable_rating_id, { reason: event.target.value })} />
                  </label>
                </div>

                <div style={styles.actions}>
                  {overridden && (
                    <button type="button" style={styles.secondaryButton} disabled={savingId === record.cable_rating_id} onClick={() => resetOverride(record.cable_rating_id)}>
                      Reset to standard
                    </button>
                  )}
                  <button type="button" style={styles.primaryButton} disabled={savingId === record.cable_rating_id} onClick={() => saveOverride(record)}>
                    {savingId === record.cable_rating_id ? "Saving…" : "Save cable data"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {references.length > 0 && (
        <section style={styles.references}>
          <strong>Standard reference material</strong>
          <ul style={styles.referenceList}>
            {references.map(([url, source]) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" style={styles.link}>
                  {source.name}
                </a>{" "}— {source.revision}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "grid", gap: "16px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" },
  title: { margin: 0 },
  muted: { margin: "5px 0 0", color: "#667085" },
  search: { width: "min(420px, 100%)", minHeight: "42px", padding: "8px 11px", border: "1px solid #D0D5DD", borderRadius: "9px", fontWeight: 400 },
  list: { display: "grid", gap: "12px" },
  card: { display: "grid", gap: "13px", padding: "16px", border: "1px solid #E4E7EC", borderRadius: "14px", background: "#FFFFFF" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" },
  cardMeta: { display: "block", marginTop: "4px", color: "#667085", fontSize: "12px" },
  standardBadge: { padding: "5px 8px", borderRadius: "999px", background: "#F2F4F7", color: "#475467", fontSize: "11px", fontWeight: 700 },
  overrideBadge: { padding: "5px 8px", borderRadius: "999px", background: "#EAF2FF", color: "#2457A6", fontSize: "11px", fontWeight: 700 },
  standardRow: { display: "flex", gap: "16px", flexWrap: "wrap", padding: "10px 12px", borderRadius: "9px", background: "#F8FAFC", color: "#526071", fontSize: "12px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" },
  label: { display: "grid", gap: "5px", color: "#344054", fontSize: "12px", fontWeight: 600 },
  input: { width: "100%", minHeight: "40px", padding: "7px 9px", border: "1px solid #D0D5DD", borderRadius: "8px", fontWeight: 400 },
  actions: { display: "flex", justifyContent: "flex-end", gap: "8px" },
  primaryButton: { minHeight: "40px", padding: "8px 12px", border: "1px solid #111827", borderRadius: "9px", background: "#111827", color: "#FFFFFF", fontWeight: 600, cursor: "pointer" },
  secondaryButton: { minHeight: "40px", padding: "8px 12px", border: "1px solid #D0D5DD", borderRadius: "9px", background: "#FFFFFF", color: "#344054", fontWeight: 500, cursor: "pointer" },
  success: { padding: "10px 12px", border: "1px solid #ABEFC6", borderRadius: "9px", background: "#ECFDF3", color: "#067647" },
  error: { padding: "10px 12px", border: "1px solid #FECDCA", borderRadius: "9px", background: "#FEF3F2", color: "#B42318" },
  notice: { padding: "14px", border: "1px solid #E4E7EC", borderRadius: "10px", background: "#F8FAFC", color: "#667085" },
  references: { paddingTop: "14px", borderTop: "1px solid #E4E7EC", color: "#344054", fontSize: "12px" },
  referenceList: { display: "grid", gap: "5px", margin: "7px 0 0", paddingLeft: "20px", color: "#667085" },
  link: { color: "#2457A6", fontWeight: 600, textDecoration: "none" },
};

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { appConfirm } from "@/lib/appDialogs";
import { applyWorkspaceCableOverrides } from "@/planner/cableLibrary";
import type {
  GlobalCableLibraryRecord,
  WorkspaceCableOverride,
} from "@/planner/cableLibrary";
import type {
  PlannerOutput,
  PlannerState,
  ProjectCableLibraryItem,
} from "@/planner/types";

type CableLibraryTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  workspaceId?: string | null;
};

type SourceFilter = "all" | "standard" | "project";
type ApplicationFilter = "all" | "single_phase_ac" | "three_phase_ac";
type VisibilityFilter = "all" | "included" | "excluded";

const emptyProjectCable = (): ProjectCableLibraryItem => ({
  id: "",
  name: "",
  designation: "",
  manufacturer: "",
  productRange: "",
  standardReference: "",
  application: "single_phase_ac",
  coreConfiguration: "3 core including CPC",
  conductorSizeMm2: 2.5,
  cableArrangement: "Multicore cable",
  installationMethod: "User supplied",
  currentCapacityA: 16,
  voltageDropMvPerAmpMetre: 18,
  sourceName: "",
  sourceRevision: "",
  sourceNotes: "",
  createdAt: "",
  updatedAt: "",
});

function outputCableIds(outputs: PlannerOutput[]): string[] {
  return outputs.flatMap((output) => [
    ...(output.cableDesign?.cableRatingId
      ? [output.cableDesign.cableRatingId]
      : []),
    ...outputCableIds(output.socaCircuits ?? []),
  ]);
}

function applicationLabel(application: string) {
  return application === "three_phase_ac" ? "Three phase" : "Single phase";
}

function suitabilityLabel(value: string) {
  if (value === "not_recommended") return "Not recommended";
  if (value === "conditional") return "Conditional";
  if (value === "project_custom") return "Project custom";
  return "Reference";
}

function conditionSummary(record: GlobalCableLibraryRecord) {
  const parts = [
    record.mechanical_duty && record.mechanical_duty !== "unknown"
      ? `${record.mechanical_duty} duty`
      : "",
    record.outdoor_suitable === true ? "outdoor" : "",
    record.uv_resistant === true ? "UV resistant" : "",
    record.minimum_flexed_temperature_c != null &&
    record.maximum_flexed_temperature_c != null
      ? `flexed ${record.minimum_flexed_temperature_c} to ${record.maximum_flexed_temperature_c} °C`
      : "",
  ].filter(Boolean);
  return parts.join(" · ") || "See source data";
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `project-cable-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CableLibraryTab({
  plannerState,
  setPlannerState,
  workspaceId,
}: CableLibraryTabProps) {
  const [globalLibrary, setGlobalLibrary] = useState<GlobalCableLibraryRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [applicationFilter, setApplicationFilter] =
    useState<ApplicationFilter>("all");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ProjectCableLibraryItem>(
    emptyProjectCable(),
  );
  const [formError, setFormError] = useState("");

  const projectLibrary = plannerState.projectCableLibrary ?? [];
  const excludedIds = plannerState.excludedCableRatingIds ?? [];
  const usedCableIds = useMemo(
    () =>
      new Set(
        plannerState.distros.flatMap((distro) =>
          outputCableIds(distro.outputs),
        ),
      ),
    [plannerState.distros],
  );
  const sourceReferences = useMemo(() => {
    const unique = new Map<
      string,
      { name: string; url: string; revision: string }
    >();

    globalLibrary.forEach((record) => {
      const references = [
        {
          name: record.standard_source_name ?? record.source_name,
          url: record.standard_source_url ?? record.source_url,
          revision:
            record.standard_source_revision ?? record.source_revision,
        },
        record.workspace_override_applied
          ? {
              name: record.source_name,
              url: record.source_url,
              revision: record.source_revision,
            }
          : null,
      ];

      references.forEach((reference) => {
        const url = reference?.url?.trim();
        if (!reference || !url || unique.has(url)) return;
        unique.set(url, {
          name: reference.name,
          url,
          revision: reference.revision,
        });
      });
    });

    return Array.from(unique.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [globalLibrary]);

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      setLoading(true);
      setLoadError("");
      const [libraryResult, overrideResult] = await Promise.all([
        supabase
          .from("planner_cable_library")
          .select("*")
          .order("application")
          .order("conductor_size_mm2"),
        workspaceId
          ? supabase
              .from("planner_workspace_cable_overrides")
              .select("*")
              .eq("workspace_id", workspaceId)
              .eq("active", true)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;
      if (libraryResult.error) {
        setGlobalLibrary([]);
        setLoadError(libraryResult.error.message);
      } else if (overrideResult.error) {
        setGlobalLibrary([]);
        setLoadError(overrideResult.error.message);
      } else {
        setGlobalLibrary(
          applyWorkspaceCableOverrides(
            (libraryResult.data ?? []) as GlobalCableLibraryRecord[],
            (overrideResult.data ?? []) as WorkspaceCableOverride[],
          ),
        );
      }
      setLoading(false);
    }

    loadLibrary();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const standardRows = globalLibrary.map((record) => ({
      id: record.cable_rating_id,
      source: "standard" as const,
      name: record.display_name.toLowerCase().includes(
        `${Number(record.conductor_size_mm2)} mm²`.toLowerCase(),
      )
        ? record.display_name
        : `${record.display_name} · ${Number(record.conductor_size_mm2)} mm²`,
      designation: record.designation ?? record.cable_type_name ?? "-",
      manufacturer: record.manufacturer ?? "-",
      application: record.application,
      conductorSizeMm2: Number(record.conductor_size_mm2),
      currentCapacityA: Number(record.current_capacity_a),
      voltageDropMvPerAmpMetre: Number(record.voltage_drop_mv_per_a_m),
      reference: record.standard_reference ?? record.source_name,
      status: record.data_status,
      suitability: record.suitability_class ?? "reference",
      conditions: conditionSummary(record),
      workspaceOverrideApplied: Boolean(record.workspace_override_applied),
    }));
    const projectRows = projectLibrary.map((record) => ({
      id: record.id,
      source: "project" as const,
      name: record.name,
      designation: record.designation || "-",
      manufacturer: record.manufacturer || "-",
      application: record.application,
      conductorSizeMm2: record.conductorSizeMm2,
      currentCapacityA: record.currentCapacityA,
      voltageDropMvPerAmpMetre: record.voltageDropMvPerAmpMetre,
      reference: record.standardReference || record.sourceName || "User supplied",
      status: "project custom",
      suitability: "project_custom",
      conditions: record.installationMethod || "User supplied",
      workspaceOverrideApplied: false,
    }));

    return [...standardRows, ...projectRows].filter((row) => {
      const included = !excludedIds.includes(row.id);
      return (
        (sourceFilter === "all" || row.source === sourceFilter) &&
        (applicationFilter === "all" ||
          row.application === applicationFilter) &&
        (visibilityFilter === "all" ||
          (visibilityFilter === "included" ? included : !included)) &&
        (!term ||
          [
            row.name,
            row.designation,
            row.manufacturer,
            row.reference,
            row.suitability,
            row.conditions,
          ]
            .join(" ")
            .toLowerCase()
            .includes(term))
      );
    });
  }, [
    applicationFilter,
    excludedIds,
    globalLibrary,
    projectLibrary,
    search,
    sourceFilter,
    visibilityFilter,
  ]);

  function setExcluded(id: string, excluded: boolean) {
    const next = excluded
      ? Array.from(new Set([...excludedIds, id]))
      : excludedIds.filter((candidate) => candidate !== id);
    setPlannerState({ ...plannerState, excludedCableRatingIds: next });
  }

  function includeAll() {
    setPlannerState({ ...plannerState, excludedCableRatingIds: [] });
  }

  function startAdding() {
    setDraft(emptyProjectCable());
    setFormError("");
    setEditorOpen(true);
  }

  function startEditing(id: string) {
    const item = projectLibrary.find((candidate) => candidate.id === id);
    if (!item) return;
    setDraft({ ...item });
    setFormError("");
    setEditorOpen(true);
  }

  function saveProjectCable() {
    if (!draft.name.trim()) {
      setFormError("Cable name is required.");
      return;
    }
    if (
      draft.conductorSizeMm2 <= 0 ||
      draft.currentCapacityA <= 0 ||
      draft.voltageDropMvPerAmpMetre <= 0
    ) {
      setFormError("Size, capacity and voltage-drop values must be greater than zero.");
      return;
    }

    const now = new Date().toISOString();
    const id = draft.id || newId();
    const saved: ProjectCableLibraryItem = {
      ...draft,
      id,
      name: draft.name.trim(),
      createdAt: draft.createdAt || now,
      updatedAt: now,
    };
    const exists = projectLibrary.some((item) => item.id === id);
    setPlannerState({
      ...plannerState,
      projectCableLibrary: exists
        ? projectLibrary.map((item) => (item.id === id ? saved : item))
        : [...projectLibrary, saved],
    });
    setEditorOpen(false);
    setFormError("");
  }

  async function removeProjectCable(id: string) {
    const used = usedCableIds.has(id);
    const message = used
      ? "This cable is used by an existing circuit. Removing it will hide it from new selections, but the circuit's saved snapshot will remain. Remove it?"
      : "Remove this project cable from the library?";
    if (!(await appConfirm(message))) return;

    setPlannerState({
      ...plannerState,
      projectCableLibrary: projectLibrary.filter((item) => item.id !== id),
      excludedCableRatingIds: excludedIds.filter(
        (candidate) => candidate !== id,
      ),
    });
    if (draft.id === id) setEditorOpen(false);
  }

  function updateDraft(patch: Partial<ProjectCableLibraryItem>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <section style={styles.page}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Cable Library</h3>
          <p style={styles.muted}>
            Control which standard ratings appear in this project and create
            reusable project-only cable records.
          </p>
        </div>
        <div style={styles.headerActions}>
          {excludedIds.length > 0 && (
            <button type="button" style={styles.secondaryButton} onClick={includeAll}>
              Include all
            </button>
          )}
          <button
            type="button"
            style={editorOpen ? styles.secondaryButton : styles.primaryButton}
            onClick={() => {
              if (editorOpen) {
                setEditorOpen(false);
                setFormError("");
              } else {
                startAdding();
              }
            }}
          >
            {editorOpen ? "Close project cable" : "Add project cable"}
          </button>
        </div>
      </div>

      {editorOpen && (
        <section style={styles.editor}>
          <div style={styles.editorHeader}>
            <div>
              <strong>{draft.id ? "Edit project cable" : "Add project cable"}</strong>
              <p style={styles.editorHelp}>
                Existing circuits retain their saved snapshots when this record changes.
              </p>
            </div>
          </div>
          <div style={styles.formGrid}>
            <label style={styles.field}>Cable name *
              <input style={styles.input} value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
            </label>
            <label style={styles.field}>Application
              <select style={styles.input} value={draft.application} onChange={(event) => updateDraft({ application: event.target.value as ProjectCableLibraryItem["application"] })}>
                <option value="single_phase_ac">Single phase AC</option>
                <option value="three_phase_ac">Three phase AC</option>
              </select>
            </label>
            <label style={styles.field}>Designation
              <input style={styles.input} value={draft.designation ?? ""} onChange={(event) => updateDraft({ designation: event.target.value })} />
            </label>
            <label style={styles.field}>Manufacturer
              <input style={styles.input} value={draft.manufacturer ?? ""} onChange={(event) => updateDraft({ manufacturer: event.target.value })} />
            </label>
            <label style={styles.field}>Product range
              <input style={styles.input} value={draft.productRange ?? ""} onChange={(event) => updateDraft({ productRange: event.target.value })} />
            </label>
            <label style={styles.field}>Standard reference
              <input style={styles.input} value={draft.standardReference ?? ""} onChange={(event) => updateDraft({ standardReference: event.target.value })} />
            </label>
            <label style={styles.field}>Core configuration
              <input style={styles.input} value={draft.coreConfiguration} onChange={(event) => updateDraft({ coreConfiguration: event.target.value })} />
            </label>
            <label style={styles.field}>Conductor size (mm²) *
              <input style={styles.input} type="number" min="0.001" step="0.1" value={draft.conductorSizeMm2} onChange={(event) => updateDraft({ conductorSizeMm2: Number(event.target.value) })} />
            </label>
            <label style={styles.field}>Current capacity (A) *
              <input style={styles.input} type="number" min="0.01" step="0.1" value={draft.currentCapacityA} onChange={(event) => updateDraft({ currentCapacityA: Number(event.target.value) })} />
            </label>
            <label style={styles.field}>Voltage drop (mV/A/m) *
              <input style={styles.input} type="number" min="0.001" step="0.001" value={draft.voltageDropMvPerAmpMetre} onChange={(event) => updateDraft({ voltageDropMvPerAmpMetre: Number(event.target.value) })} />
            </label>
            <label style={styles.field}>Cable arrangement
              <input style={styles.input} value={draft.cableArrangement} onChange={(event) => updateDraft({ cableArrangement: event.target.value })} />
            </label>
            <label style={styles.field}>Installation/reference method
              <input style={styles.input} value={draft.installationMethod} onChange={(event) => updateDraft({ installationMethod: event.target.value })} />
            </label>
            <label style={styles.field}>Source name
              <input style={styles.input} value={draft.sourceName ?? ""} onChange={(event) => updateDraft({ sourceName: event.target.value })} />
            </label>
            <label style={styles.field}>Source revision
              <input style={styles.input} value={draft.sourceRevision ?? ""} onChange={(event) => updateDraft({ sourceRevision: event.target.value })} />
            </label>
            <label style={{ ...styles.field, ...styles.fullWidth }}>Source notes
              <textarea style={styles.textarea} value={draft.sourceNotes ?? ""} onChange={(event) => updateDraft({ sourceNotes: event.target.value })} />
            </label>
          </div>
          {formError && <div style={styles.error}>{formError}</div>}
          <div style={styles.editorActions}>
            <button type="button" style={styles.secondaryButton} onClick={() => setEditorOpen(false)}>Cancel</button>
            <button type="button" style={styles.primaryButton} onClick={saveProjectCable}>Save project cable</button>
          </div>
        </section>
      )}

      <div style={styles.filters}>
        <label style={styles.field}>Search
          <input style={styles.input} value={search} placeholder="Cable, manufacturer or reference" onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label style={styles.field}>Source
          <select style={styles.input} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}>
            <option value="all">All sources</option>
            <option value="standard">Standard library</option>
            <option value="project">Project custom</option>
          </select>
        </label>
        <label style={styles.field}>Application
          <select style={styles.input} value={applicationFilter} onChange={(event) => setApplicationFilter(event.target.value as ApplicationFilter)}>
            <option value="all">All applications</option>
            <option value="single_phase_ac">Single phase</option>
            <option value="three_phase_ac">Three phase</option>
          </select>
        </label>
        <label style={styles.field}>Availability
          <select style={styles.input} value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}>
            <option value="all">Included and excluded</option>
            <option value="included">Included</option>
            <option value="excluded">Excluded</option>
          </select>
        </label>
      </div>

      {loading && <div style={styles.notice}>Loading standard cable library…</div>}
      {loadError && <div style={styles.error}>Could not load the standard cable library: {loadError}</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Included</th>
              <th style={styles.th}>Cable</th>
              <th style={styles.th}>Source</th>
              <th style={styles.th}>Application</th>
              <th style={styles.th}>Size</th>
              <th style={styles.th}>Capacity</th>
              <th style={styles.th}>Voltage drop</th>
              <th style={styles.th}>Suitability</th>
              <th style={styles.th}>Conditions</th>
              <th style={styles.th}>Data status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const included = !excludedIds.includes(row.id);
              return (
                <tr key={`${row.source}:${row.id}`}>
                  <td style={styles.td}>
                    <button type="button" style={{ ...styles.toggle, ...(included ? styles.toggleOn : {}) }} onClick={() => setExcluded(row.id, included)} aria-pressed={included}>
                      {included ? "Included" : "Excluded"}
                    </button>
                  </td>
                  <td style={styles.nameTd}><strong>{row.name}</strong><span style={styles.subText}>{row.designation}</span></td>
                  <td style={styles.td}>
                    {row.source === "project"
                      ? "Project custom"
                      : row.workspaceOverrideApplied
                        ? "Workspace override"
                        : "Standard library"}
                  </td>
                  <td style={styles.td}>{applicationLabel(row.application)}</td>
                  <td style={styles.td}>{row.conductorSizeMm2} mm²</td>
                  <td style={styles.td}>{row.currentCapacityA} A</td>
                  <td style={styles.td}>{row.voltageDropMvPerAmpMetre} mV/A/m</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.suitabilityStatus,
                        ...(row.suitability === "conditional"
                          ? styles.conditionalStatus
                          : row.suitability === "not_recommended"
                            ? styles.notRecommendedStatus
                            : row.suitability === "project_custom"
                              ? styles.customStatus
                              : styles.referenceStatus),
                      }}
                    >
                      {suitabilityLabel(row.suitability)}
                    </span>
                  </td>
                  <td style={styles.conditionsTd}>{row.conditions}</td>
                  <td style={styles.td}><span style={row.source === "project" ? styles.customStatus : styles.referenceStatus}>{row.status}</span></td>
                  <td style={styles.td}>
                    {row.source === "project" ? (
                      <div style={styles.rowActions}>
                        <button type="button" style={styles.textButton} onClick={() => startEditing(row.id)}>Edit</button>
                        <button type="button" style={styles.dangerButton} onClick={() => removeProjectCable(row.id)}>Remove</button>
                      </div>
                    ) : "Read only"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && !loading && <div style={styles.notice}>No cable records match the current filters.</div>}
      {sourceReferences.length > 0 && (
        <section style={styles.referenceMaterial}>
          <strong style={styles.referenceTitle}>Reference material</strong>
          <p style={styles.referenceIntro}>
            Manufacturer and technical sources used by the standard cable
            records currently loaded in this library.
          </p>
          <ul style={styles.referenceList}>
            {sourceReferences.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.referenceLink}
                >
                  {source.name}
                </a>
                {source.revision && (
                  <span style={styles.referenceRevision}>
                    {" "}— {source.revision}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p style={styles.disclaimer}>
        Standard-library records are shared and read-only. Inclusion settings
        and project custom cables are saved only with this project, and all
        records are included by default. Inclusion does not approve a cable for
        an installation. Capacity, voltage-drop data, installation conditions
        and suitability must be checked by a competent designer.
      </p>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: "grid", gap: "16px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" },
  title: { margin: 0 },
  muted: { margin: "5px 0 0", color: "#637083" },
  headerActions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  primaryButton: { border: "1px solid #111827", borderRadius: "9px", padding: "9px 13px", background: "#111827", color: "#FFFFFF", fontWeight: 600, cursor: "pointer" },
  secondaryButton: { border: "1px solid #CBD5E1", borderRadius: "9px", padding: "9px 13px", background: "#FFFFFF", color: "#334155", fontWeight: 500, cursor: "pointer" },
  notice: { padding: "12px 14px", border: "1px solid #DCE5EC", borderRadius: "10px", background: "#F8FAFC", color: "#526071" },
  error: { padding: "10px 12px", border: "1px solid #F3B5B5", borderRadius: "9px", background: "#FFF1F1", color: "#9B1C1C" },
  editor: { display: "grid", gap: "14px", padding: "18px", border: "1px solid #CBD5E1", borderRadius: "14px", background: "#FFFFFF" },
  editorHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" },
  editorHelp: { margin: "4px 0 0", color: "#637083", fontSize: "13px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  field: { display: "grid", gap: "5px", color: "#344054", fontSize: "12px", fontWeight: 600 },
  fullWidth: { gridColumn: "1 / -1" },
  input: { width: "100%", minHeight: "38px", padding: "7px 9px", border: "1px solid #CBD5E1", borderRadius: "8px", background: "#FFFFFF", color: "#111827", textAlign: "left", fontWeight: 400 },
  textarea: { width: "100%", minHeight: "76px", padding: "8px 9px", border: "1px solid #CBD5E1", borderRadius: "8px", resize: "vertical", fontWeight: 400 },
  editorActions: { display: "flex", justifyContent: "flex-end", gap: "8px" },
  filters: { display: "grid", gridTemplateColumns: "minmax(240px, 2fr) repeat(3, minmax(150px, 1fr))", gap: "10px", alignItems: "end" },
  tableWrap: { overflowX: "auto", border: "1px solid #DCE5EC", borderRadius: "14px" },
  table: { width: "100%", minWidth: "1650px", borderCollapse: "collapse", fontSize: "12px" },
  th: { padding: "10px", borderBottom: "1px solid #DCE5EC", background: "#F8FAFC", color: "#526071", textAlign: "left", whiteSpace: "nowrap" },
  td: { padding: "10px", borderBottom: "1px solid #EEF2F6", textAlign: "left", verticalAlign: "top" },
  nameTd: { width: "270px", padding: "10px", borderBottom: "1px solid #EEF2F6", textAlign: "left", verticalAlign: "top" },
  subText: { display: "block", marginTop: "3px", color: "#637083" },
  conditionsTd: { width: "190px", padding: "10px", borderBottom: "1px solid #EEF2F6", textAlign: "left", verticalAlign: "top", color: "#526071" },
  toggle: { minWidth: "76px", border: "1px solid #CBD5E1", borderRadius: "999px", padding: "6px 9px", background: "#F1F5F9", color: "#526071", cursor: "pointer", fontSize: "11px", fontWeight: 600 },
  toggleOn: { borderColor: "#86C69A", background: "#EAF7EE", color: "#176B34" },
  referenceStatus: { display: "inline-block", padding: "4px 7px", borderRadius: "999px", background: "#EEF2F6", color: "#526071", fontWeight: 800, textTransform: "capitalize" },
  customStatus: { display: "inline-block", padding: "4px 7px", borderRadius: "999px", background: "#EAF2FF", color: "#2457A6", fontWeight: 800, textTransform: "capitalize" },
  suitabilityStatus: { display: "inline-block", padding: "4px 7px", borderRadius: "999px", fontWeight: 700, whiteSpace: "nowrap" },
  conditionalStatus: { background: "#FFF8E5", color: "#8A5A00" },
  notRecommendedStatus: { background: "#FFF1F1", color: "#B42318" },
  rowActions: { display: "flex", gap: "8px" },
  textButton: { border: 0, padding: 0, background: "transparent", color: "#2457A6", cursor: "pointer", fontWeight: 600 },
  dangerButton: { border: 0, padding: 0, background: "transparent", color: "#B42318", cursor: "pointer", fontWeight: 600 },
  referenceMaterial: { paddingTop: "14px", borderTop: "1px solid #E5E7EB" },
  referenceTitle: { color: "#344054", fontSize: "13px" },
  referenceIntro: { margin: "4px 0 8px", color: "#637083", fontSize: "12px" },
  referenceList: { display: "grid", gap: "5px", margin: 0, paddingLeft: "20px", color: "#526071", fontSize: "12px" },
  referenceLink: { color: "#2457A6", fontWeight: 600, textDecoration: "none" },
  referenceRevision: { color: "#637083" },
  disclaimer: { margin: 0, color: "#637083", fontSize: "12px" },
};

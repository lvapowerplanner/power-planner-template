import { useState } from "react";
import { autoSourcesForDistro } from "@/planner/autoSources";
import { WarningPanel, activeIssuesForScope } from "@/components/planner/WarningPanel";
import {
  distroLoadSummary,
  formatAmps,
  phasePercentage,
} from "@/planner/calculations";
import type { DistroLoadSummary } from "@/planner/calculations";
import { useCompanyDistroLibrary } from "@/planner/companyStock";
import type {
  DistroDefinition,
  PlannerState,
  PowerSource,
  ProjectDistro,
} from "@/planner/types";

type DistroOverviewTabProps = {
  plannerState: PlannerState;
  setPlannerState: (state: PlannerState) => void;
  openDistroEditor: (distroId: string) => void;
};

type DistroDraft = {
  id: string;
  definitionIndex: string;
  name: string;
  location: string;
  sourceId: string;
};

function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneDistro(definition: DistroDefinition): DistroDefinition {
  return JSON.parse(JSON.stringify(definition)) as DistroDefinition;
}

function displayDistroName(distro: ProjectDistro) {
  return distro.instanceName.trim()
    ? `${distro.instanceName} - ${distro.name}`
    : distro.name;
}

function connectorRatingFromText(value: string): number {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normaliseConnection(value: string) {
  const cleaned = value.replace(/\s+/g, "").toLowerCase();
  const rating = connectorRatingFromText(cleaned);

  const isThreePhase =
    cleaned.includes("/3") ||
    cleaned.includes("3phase") ||
    cleaned.includes("threephase") ||
    cleaned.includes("powerlock");

  const isSinglePhase =
    cleaned.includes("/1") ||
    cleaned.includes("1phase") ||
    cleaned.includes("singlephase");

  if (isThreePhase) {
    return {
      rating,
      phase: "3" as const,
      highCurrentThreePhase: rating >= 200,
    };
  }

  if (isSinglePhase) {
    return {
      rating,
      phase: "1" as const,
      highCurrentThreePhase: false,
    };
  }

  return {
    rating,
    phase: cleaned,
    highCurrentThreePhase: false,
  };
}

function connectionsAreCompatible(
  sourceConnection: string,
  distroInput: string,
) {
  const source = normaliseConnection(sourceConnection);
  const distro = normaliseConnection(distroInput);

  if (
    source.phase === "3" &&
    distro.phase === "3" &&
    source.highCurrentThreePhase &&
    distro.highCurrentThreePhase
  ) {
    return source.rating <= distro.rating;
  }

  return source.phase === distro.phase && source.rating === distro.rating;
}

function allDistroDefinitions(
  plannerState: PlannerState,
  companyDistroLibrary: DistroDefinition[],
): DistroDefinition[] {
  return [
    ...companyDistroLibrary,
    ...plannerState.customDistros.map((distro) => ({
      ...distro,
      name: `Custom: ${distro.name}`,
      custom: true,
    })),
  ].sort((a, b) => a.inputA - b.inputA || a.name.localeCompare(b.name));
}

function sourceIsUsedByOtherDistro(
  plannerState: PlannerState,
  sourceId: string,
  currentDistroId: string,
) {
  return plannerState.distros.some(
    (distro) => distro.id !== currentDistroId && distro.sourceId === sourceId,
  );
}

function sourceBelongsToDistroOwnOutput(source: PowerSource, distroId: string) {
  return source.auto && source.parentDistroId === distroId;
}

function distroPhaseStyle(distro: ProjectDistro): React.CSSProperties {
  return normaliseConnection(distro.input).phase === "3"
    ? styles.threePhaseCard
    : styles.singlePhaseCard;
}

export function DistroOverviewTab({
  plannerState,
  setPlannerState,
  openDistroEditor,
}: DistroOverviewTabProps) {
  const { distroLibrary, loadingDistros } = useCompanyDistroLibrary();
  const distroDefinitions = allDistroDefinitions(plannerState, distroLibrary);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [distroDrafts, setDistroDrafts] = useState<DistroDraft[]>([]);
  const [draggedDraftId, setDraggedDraftId] = useState<string | null>(null);
  const [draggedDistroId, setDraggedDistroId] = useState<string | null>(null);
  const [pendingDeleteDistroId, setPendingDeleteDistroId] = useState<
    string | null
  >(null);
  const [expandedDistroIds, setExpandedDistroIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [distroView, setDistroView] = useState<"all" | "single" | "three">(
    "all",
  );

  const allAvailableSources = [
    ...plannerState.sources.filter((source) => !source.auto),
    ...plannerState.distros.flatMap((distro) => autoSourcesForDistro(distro)),
  ];

  const distroSummaries = plannerState.distros.map((distro) =>
    distroLoadSummary(distro, plannerState),
  );

  const allIssues = distroSummaries.flatMap((summary) => summary.issues);

  function openAddModal() {
    setDistroDrafts([
      {
        id: createId("distro_draft"),
        definitionIndex: "0",
        name: "",
        location: "",
        sourceId: "",
      },
    ]);
    setAddModalOpen(true);
  }

  function addDistroDraft() {
    setDistroDrafts((drafts) => [
      ...drafts,
      {
        id: createId("distro_draft"),
        definitionIndex: "0",
        name: "",
        location: "",
        sourceId: "",
      },
    ]);
  }

  function updateDistroDraft(
    draftId: string,
    field: "definitionIndex" | "name" | "location" | "sourceId",
    value: string,
  ) {
    setDistroDrafts((drafts) =>
      drafts.map((draft) => {
        if (draft.id !== draftId) return draft;
        return field === "definitionIndex"
          ? { ...draft, definitionIndex: value, sourceId: "" }
          : { ...draft, [field]: value };
      }),
    );
  }

  function removeDistroDraft(draftId: string) {
    setDistroDrafts((drafts) =>
      drafts.length === 1
        ? drafts
        : drafts.filter((draft) => draft.id !== draftId),
    );
  }

  function moveDistroDraft(targetDraftId: string) {
    if (!draggedDraftId || draggedDraftId === targetDraftId) return;
    setDistroDrafts((drafts) => {
      const fromIndex = drafts.findIndex((draft) => draft.id === draggedDraftId);
      const targetIndex = drafts.findIndex((draft) => draft.id === targetDraftId);
      if (fromIndex < 0 || targetIndex < 0) return drafts;
      const nextDrafts = [...drafts];
      const [movedDraft] = nextDrafts.splice(fromIndex, 1);
      nextDrafts.splice(targetIndex, 0, movedDraft);
      return nextDrafts;
    });
    setDraggedDraftId(null);
  }

  function addDistros() {
    const newDistros = distroDrafts.flatMap((draft) => {
      const selectedDefinition = distroDefinitions[Number(draft.definitionIndex)];
      if (!selectedDefinition) return [];
      const definition = cloneDistro(selectedDefinition);
      const cleanName = definition.name.replace(/^Custom:\s*/, "");
      const newDistro: ProjectDistro = {
        ...definition,
        name: cleanName,
        id: createId("distro"),
        instanceName: draft.name.trim(),
        sourceId: draft.sourceId,
        location: draft.location.trim(),
        notes: "",
        outputs: definition.outputs.map((output) => ({
          ...output,
          items: [],
          notes: output.notes ?? "",
          socaCircuits: output.socaCircuits?.map((socket) => ({
            ...socket,
            items: [],
            notes: socket.notes ?? "",
          })),
        })),
      };
      return [newDistro];
    });
    if (newDistros.length === 0) return;
    setPlannerState({
      ...plannerState,
      distros: [...plannerState.distros, ...newDistros],
      active: newDistros[newDistros.length - 1].id,
    });
    setAddModalOpen(false);
    setDistroDrafts([]);
  }

  function deleteDistro(distroId: string) {
    const targetDistro = plannerState.distros.find(
      (distro) => distro.id === distroId,
    );
    if (!targetDistro) return;

    const removedAutoSourceIds = new Set(
      autoSourcesForDistro(targetDistro).map((source) => source.id),
    );
    const remainingDistros = plannerState.distros
      .filter((distro) => distro.id !== distroId)
      .map((distro) =>
        removedAutoSourceIds.has(distro.sourceId)
          ? { ...distro, sourceId: "" }
          : distro,
      );

    setPlannerState({
      ...plannerState,
      distros: remainingDistros,
      active:
        plannerState.active === distroId
          ? (remainingDistros[0]?.id ?? null)
          : plannerState.active,
    });
    setPendingDeleteDistroId(null);
  }

  function moveDistro(distroId: string, direction: -1 | 1) {
    const currentIndex = plannerState.distros.findIndex(
      (distro) => distro.id === distroId,
    );
    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= plannerState.distros.length
    ) {
      return;
    }

    const nextDistros = [...plannerState.distros];
    const [movedDistro] = nextDistros.splice(currentIndex, 1);
    nextDistros.splice(targetIndex, 0, movedDistro);

    setPlannerState({
      ...plannerState,
      distros: nextDistros,
    });
  }

  function dropDistro(targetDistroId: string) {
    if (!draggedDistroId || draggedDistroId === targetDistroId) return;
    const fromIndex = plannerState.distros.findIndex(
      (distro) => distro.id === draggedDistroId,
    );
    const targetIndex = plannerState.distros.findIndex(
      (distro) => distro.id === targetDistroId,
    );
    if (fromIndex < 0 || targetIndex < 0) return;
    const nextDistros = [...plannerState.distros];
    const [movedDistro] = nextDistros.splice(fromIndex, 1);
    nextDistros.splice(targetIndex, 0, movedDistro);
    setPlannerState({ ...plannerState, distros: nextDistros });
    setDraggedDistroId(null);
  }

  const visibleDistros = plannerState.distros.filter((distro) => {
    const phase = normaliseConnection(distro.input).phase;
    if (distroView === "single") return phase !== "3";
    if (distroView === "three") return phase === "3";
    return true;
  });
  const allVisibleDistrosCollapsed = visibleDistros.every(
    (distro) => !expandedDistroIds.has(distro.id),
  );

  function toggleDistro(distroId: string) {
    setExpandedDistroIds((current) => {
      const next = new Set(current);
      if (next.has(distroId)) next.delete(distroId);
      else next.add(distroId);
      return next;
    });
  }

  function updateDistroName(distroId: string, value: string) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) =>
        distro.id === distroId ? { ...distro, instanceName: value } : distro,
      ),
    });
  }

  function updateDistroLocation(distroId: string, value: string) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) =>
        distro.id === distroId ? { ...distro, location: value } : distro,
      ),
    });
  }

  function updateDistroSource(distroId: string, value: string) {
    setPlannerState({
      ...plannerState,
      distros: plannerState.distros.map((distro) =>
        distro.id === distroId ? { ...distro, sourceId: value } : distro,
      ),
    });
  }

  return (
    <section data-lva-surface style={styles.card}>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Distro Overview</h2>
          <p style={styles.pageDescription}>
            Add distros from the company library or custom distros built in
            this project.
          </p>
        </div>
        <button
          style={styles.button}
          onClick={openAddModal}
          disabled={loadingDistros || distroDefinitions.length === 0}
        >
          Add Distro
        </button>
      </div>

      {loadingDistros ? (
        <p style={styles.muted}>Loading company distro library…</p>
      ) : distroDefinitions.length === 0 ? (
        <p style={styles.muted}>
          No company distros found. Add rows to the Supabase distro table.
        </p>
      ) : null}

      <WarningPanel
        scope="planner-warnings"
        title="Distro Warnings"
        issues={allIssues}
        plannerState={plannerState}
        setPlannerState={setPlannerState}
      />

      <hr style={styles.divider} />

      <div style={styles.toolbar}>
        <label style={styles.compactField}>
          <span style={styles.toolbarLabel}>View</span>
          <select
            style={styles.filterInput}
            value={distroView}
            onChange={(event) =>
              setDistroView(event.target.value as "all" | "single" | "three")
            }
          >
            <option value="all">View All</option>
            <option value="single">Single Phase</option>
            <option value="three">Three Phase</option>
          </select>
        </label>
        <button
          style={styles.textButton}
          onClick={() =>
            setExpandedDistroIds(
              new Set(visibleDistros.map((distro) => distro.id)),
            )
          }
        >
          Expand all
        </button>
        <button
          style={styles.textButton}
          onClick={() => setExpandedDistroIds(new Set())}
        >
          Collapse all
        </button>
      </div>

      {visibleDistros.length === 0 ? (
        <p style={styles.muted}>
          {plannerState.distros.length === 0
            ? "No distros added yet."
            : "No distros match the selected view."}
        </p>
      ) : (
        <div style={styles.list}>
          {visibleDistros.map((distro) => {
            const distroIndex = plannerState.distros.findIndex(
              (item) => item.id === distro.id,
            );
            const distroSummary = distroSummaries.find(
              (summary) => summary.distro.id === distro.id,
            );
            const activeDistroIssues = activeIssuesForScope(
              "planner-warnings",
              distroSummary?.issues ?? [],
              plannerState.dismissedWarnings ?? [],
            );
            const availableSources = allAvailableSources.filter((source) => {
              const compatible = connectionsAreCompatible(
                source.conn,
                distro.input,
              );

              if (!compatible) return false;

              if (sourceBelongsToDistroOwnOutput(source, distro.id)) {
                return false;
              }

              if (
                source.id !== distro.sourceId &&
                sourceIsUsedByOtherDistro(plannerState, source.id, distro.id)
              ) {
                return false;
              }

              return true;
            });
            const collapsed = !expandedDistroIds.has(distro.id);
            const assignedSource = allAvailableSources.find(
              (source) => source.id === distro.sourceId,
            );

            if (collapsed) {
              return (
                <div
                  key={distro.id}
                  data-distro-card
                  style={{
                    ...styles.distroCard,
                    ...styles.collapsedDistroCard,
                    ...(draggedDistroId === distro.id
                      ? styles.draggingDistroCard
                      : {}),
                    ...distroPhaseStyle(distro),
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropDistro(distro.id)}
                >
                  <div style={styles.collapsedIdentity}>
                    {allVisibleDistrosCollapsed && (
                      <button
                        style={styles.dragHandle}
                        draggable
                        onDragStart={(event) => {
                          const card = event.currentTarget.closest(
                            "[data-distro-card]",
                          );
                          if (card instanceof HTMLElement) {
                            const bounds = card.getBoundingClientRect();
                            event.dataTransfer.setDragImage(
                              card,
                              Math.min(40, bounds.width / 2),
                              Math.min(28, bounds.height / 2),
                            );
                          }
                          event.dataTransfer.effectAllowed = "move";
                          setDraggedDistroId(distro.id);
                        }}
                        onDragEnd={() => setDraggedDistroId(null)}
                        aria-label={`Move ${displayDistroName(distro)}`}
                        title="Drag to reorder"
                      >
                        ⋮⋮
                      </button>
                    )}
                    <strong>{distro.instanceName.trim() || distro.name}</strong>
                    <span style={styles.typeBadge}>{distro.name}</span>
                    <span style={styles.outputCount}>
                      {distro.outputs.length} outputs
                    </span>
                    <span style={styles.sourceLabel}>
                      Source: {assignedSource
                        ? `${assignedSource.name} — ${assignedSource.conn}`
                        : "No source selected"}
                    </span>
                  </div>
                  <div style={styles.row}>
                    {allVisibleDistrosCollapsed && (
                      <>
                        <button
                          style={styles.arrowButton}
                          onClick={() => moveDistro(distro.id, -1)}
                          disabled={distroIndex === 0}
                          aria-label={`Move ${displayDistroName(distro)} up`}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          style={styles.arrowButton}
                          onClick={() => moveDistro(distro.id, 1)}
                          disabled={distroIndex === plannerState.distros.length - 1}
                          aria-label={`Move ${displayDistroName(distro)} down`}
                          title="Move down"
                        >
                          ↓
                        </button>
                      </>
                    )}
                    <button
                      style={styles.expandButton}
                      onClick={() => toggleDistro(distro.id)}
                    >
                      Expand ▾
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={distro.id}
                style={{
                  ...styles.distroCard,
                  ...(activeDistroIssues.some((issue) => issue.severity === "critical")
                    ? styles.cardCritical
                    : activeDistroIssues.length > 0
                      ? styles.cardWarning
                      : {}),
                  ...distroPhaseStyle(distro),
                }}
              >
                <div style={styles.headerRow}>
                  <div>
                    <strong>{displayDistroName(distro)}</strong>
                    <p style={styles.muted}>
                      {distro.name} · Input {distro.input} ·{" "}
                      {distro.outputs.length} outputs
                    </p>
                  </div>

                  <div style={styles.row}>
                    <button
                      style={styles.secondaryButton}
                      onClick={() => openDistroEditor(distro.id)}
                    >
                      Open
                    </button>
                    <button
                      style={styles.dangerButton}
                      onClick={() => setPendingDeleteDistroId(distro.id)}
                    >
                      Remove
                    </button>
                    <button
                      style={styles.expandButton}
                      onClick={() => toggleDistro(distro.id)}
                    >
                      Collapse ▴
                    </button>
                  </div>
                </div>

                {distroSummary && (
                  <DistroPhaseSummary summary={distroSummary} />
                )}

                <div style={styles.formGrid}>
                  <label style={styles.label}>
                    Name
                    <input
                      style={styles.input}
                      value={distro.instanceName}
                      onChange={(event) =>
                        updateDistroName(distro.id, event.target.value)
                      }
                      placeholder="Optional name"
                    />
                  </label>

                  <label style={styles.label}>
                    Location
                    <input
                      style={styles.input}
                      value={distro.location}
                      onChange={(event) =>
                        updateDistroLocation(distro.id, event.target.value)
                      }
                      placeholder="e.g. Stage Left"
                    />
                  </label>

                  <label style={styles.label}>
                    Source
                    <select
                      style={styles.input}
                      value={distro.sourceId}
                      onChange={(event) =>
                        updateDistroSource(distro.id, event.target.value)
                      }
                    >
                      <option value="">No source selected</option>
                      {availableSources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.auto ? "Auto: " : ""}
                          {source.name} — {source.conn}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendingDeleteDistroId && (
        <div style={styles.modalBackdrop} role="presentation">
          <div
            style={styles.confirmModal}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-distro-title"
            aria-describedby="delete-distro-description"
          >
            <h3 id="delete-distro-title" style={styles.modalTitle}>
              Delete distro?
            </h3>
            <p id="delete-distro-description" style={styles.confirmDescription}>
              <strong>
                {plannerState.distros.find(
                  (distro) => distro.id === pendingDeleteDistroId,
                )
                  ? displayDistroName(
                      plannerState.distros.find(
                        (distro) => distro.id === pendingDeleteDistroId,
                      )!,
                    )
                  : "This distro"}
              </strong>{" "}
              and all of its output assignments will be removed. Any downstream
              distros supplied from its outputs will be unassigned.
            </p>
            <div style={styles.modalFooter}>
              <button
                style={styles.secondaryButton}
                onClick={() => setPendingDeleteDistroId(null)}
              >
                Cancel
              </button>
              <button
                style={styles.confirmDeleteButton}
                onClick={() => deleteDistro(pendingDeleteDistroId)}
              >
                Delete and Unassign
              </button>
            </div>
          </div>
        </div>
      )}

      {addModalOpen && (
        <div style={styles.modalBackdrop} role="presentation">
          <div
            style={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-distros-title"
          >
            <div style={styles.modalHeader}>
              <div>
                <h3 id="add-distros-title" style={styles.modalTitle}>
                  Add Distros
                </h3>
                <p style={styles.modalDescription}>
                  Add and arrange multiple distros before placing them into the project.
                </p>
              </div>
              <button
                style={styles.closeButton}
                onClick={() => setAddModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.handleColumn} aria-label="Move" />
                    <th style={styles.tableHeader}>Distro</th>
                    <th style={styles.tableHeader}>Name</th>
                    <th style={styles.tableHeader}>Location</th>
                    <th style={styles.tableHeader}>Source</th>
                    <th style={styles.removeColumn} aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {distroDrafts.map((draft) => {
                    const definition =
                      distroDefinitions[Number(draft.definitionIndex)];
                    const availableDraftSources = definition
                      ? allAvailableSources.filter((source) => {
                          if (!connectionsAreCompatible(source.conn, definition.input)) {
                            return false;
                          }
                          if (sourceIsUsedByOtherDistro(plannerState, source.id, "")) {
                            return false;
                          }
                          return !distroDrafts.some(
                            (otherDraft) =>
                              otherDraft.id !== draft.id &&
                              otherDraft.sourceId === source.id,
                          );
                        })
                      : [];

                    return (
                      <tr
                        key={draft.id}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => moveDistroDraft(draft.id)}
                      >
                        <td style={styles.tableCell}>
                          <button
                            style={styles.dragHandle}
                            draggable
                            onDragStart={() => setDraggedDraftId(draft.id)}
                            onDragEnd={() => setDraggedDraftId(null)}
                            aria-label={`Move ${draft.name || "distro"}`}
                            title="Drag to reorder"
                          >
                            ⋮⋮
                          </button>
                        </td>
                        <td style={styles.tableCell}>
                          <select
                            style={styles.tableInput}
                            value={draft.definitionIndex}
                            onChange={(event) =>
                              updateDistroDraft(
                                draft.id,
                                "definitionIndex",
                                event.target.value,
                              )
                            }
                          >
                            {distroDefinitions.map((distro, index) => (
                              <option key={`${distro.name}-${index}`} value={index}>
                                {distro.name} — {distro.input}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={styles.tableCell}>
                          <input
                            style={styles.tableInput}
                            value={draft.name}
                            onChange={(event) =>
                              updateDistroDraft(draft.id, "name", event.target.value)
                            }
                            placeholder="Optional name"
                          />
                        </td>
                        <td style={styles.tableCell}>
                          <input
                            style={styles.tableInput}
                            value={draft.location}
                            onChange={(event) =>
                              updateDistroDraft(
                                draft.id,
                                "location",
                                event.target.value,
                              )
                            }
                            placeholder="e.g. Stage Left"
                          />
                        </td>
                        <td style={styles.tableCell}>
                          <select
                            style={styles.tableInput}
                            value={draft.sourceId}
                            onChange={(event) =>
                              updateDistroDraft(
                                draft.id,
                                "sourceId",
                                event.target.value,
                              )
                            }
                          >
                            <option value="">No source selected</option>
                            {availableDraftSources.map((source) => (
                              <option key={source.id} value={source.id}>
                                {source.auto ? "Auto: " : ""}
                                {source.name} — {source.conn}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={styles.tableCell}>
                          <button
                            style={styles.removeRowButton}
                            onClick={() => removeDistroDraft(draft.id)}
                            disabled={distroDrafts.length === 1}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button style={styles.addRowButton} onClick={addDistroDraft}>
              + Add Distro
            </button>
            <div style={styles.modalFooter}>
              <button
                style={styles.secondaryButton}
                onClick={() => setAddModalOpen(false)}
              >
                Cancel
              </button>
              <button style={styles.button} onClick={addDistros}>
                Add {distroDrafts.length} Distro
                {distroDrafts.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DistroPhaseSummary({ summary }: { summary: DistroLoadSummary }) {
  const singlePhase = normaliseConnection(summary.distro.input).phase !== "3";

  return (
    <section style={styles.phaseSummaryBox}>
      <div style={styles.phaseSummaryHeader}>
        <strong>{singlePhase ? "Single-Phase Load" : "Phase Balance"}</strong>
      </div>
      <div
        style={
          singlePhase
            ? { ...styles.phaseGrid, gridTemplateColumns: "minmax(0, 1fr)" }
            : styles.phaseGrid
        }
      >
        {singlePhase ? (
          <PhaseCard phase="Line" amps={summary.phaseLoads.L1} rating={summary.distro.inputA} />
        ) : (
          <>
            <PhaseCard phase="L1" amps={summary.phaseLoads.L1} rating={summary.distro.inputA} />
            <PhaseCard phase="L2" amps={summary.phaseLoads.L2} rating={summary.distro.inputA} />
            <PhaseCard phase="L3" amps={summary.phaseLoads.L3} rating={summary.distro.inputA} />
          </>
        )}
      </div>
    </section>
  );
}

function PhaseCard({
  phase,
  amps,
  rating,
}: {
  phase: string;
  amps: number;
  rating: number;
}) {
  const percentage = phasePercentage(amps, rating);

  return (
    <div style={styles.phaseCard}>
      <div style={styles.phaseHeader}>
        <strong>{phase}</strong>
        <span>{percentage}%</span>
      </div>
      <p style={styles.phaseText}>
        {formatAmps(amps)} / {formatAmps(rating)}
      </p>
      <div style={styles.meter}>
        <div
          style={{
            ...styles.meterFill,
            width: `${Math.min(percentage, 100)}%`,
            background:
              percentage >= 100
                ? "#E5484D"
                : percentage >= 95
                  ? "#B7791F"
                  : "#0A8F5D",
          }}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #DCE5EC",
    borderRadius: "18px",
    padding: "18px",
    background: "white",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.04)",
  },
  muted: {
    color: "#667085",
  },
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "18px",
  },
  pageTitle: { margin: 0 },
  pageDescription: {
    margin: "7px 0 0",
    color: "#667085",
    maxWidth: "720px",
  },
  addPanel: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "12px",
    alignItems: "end",
    marginTop: "16px",
  },
  label: {
    display: "block",
    color: "#667085",
    fontWeight: 400,
  },
  input: {
    width: "100%",
    padding: "10px",
    marginTop: "6px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
  },
  button: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid var(--lva-workspace-dark-button, #000000)",
    background: "var(--lva-workspace-dark-button, #000000)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 500,
  },
  secondaryButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 500,
  },
  arrowButton: {
    width: "34px",
    height: "34px",
    padding: 0,
    borderRadius: "10px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 400,
    lineHeight: 1,
  },
  dangerButton: {
    padding: "9px 12px",
    borderRadius: "10px",
    border: "1px solid #E5484D",
    background: "#FFF1F1",
    color: "#E5484D",
    cursor: "pointer",
  },
  divider: {
    border: 0,
    borderTop: "1px solid #DCE5EC",
    margin: "22px 0",
  },
  list: {
    display: "grid",
    gap: "12px",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "18px",
  },
  compactField: { display: "flex", alignItems: "center", gap: "8px" },
  toolbarLabel: { fontSize: "12px", color: "#526071", fontWeight: 600 },
  filterInput: {
    minHeight: "38px",
    padding: "7px 9px",
    border: "1px solid #CBD5E1",
    borderRadius: "9px",
    background: "#FFFFFF",
  },
  textButton: {
    padding: "7px 9px",
    border: 0,
    background: "transparent",
    color: "#334155",
    textDecoration: "underline",
    cursor: "pointer",
  },
  distroCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "14px",
    padding: "14px",
    background: "#F5F7FA",
  },
  collapsedDistroCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    minHeight: "62px",
    padding: "12px 16px",
  },
  draggingDistroCard: {
    outline: "2px dashed #2563EB",
    outlineOffset: "3px",
    opacity: 0.72,
    boxShadow: "0 8px 24px rgba(37, 99, 235, 0.18)",
  },
  collapsedIdentity: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  typeBadge: {
    padding: "4px 8px",
    borderRadius: "999px",
    background: "white",
    border: "1px solid #DCE5EC",
    color: "#667085",
    fontSize: "12px",
    whiteSpace: "nowrap",
  },
  outputCount: { color: "#475467", fontSize: "14px", whiteSpace: "nowrap" },
  sourceLabel: {
    color: "#667085",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  dragHandle: {
    width: "32px",
    height: "32px",
    padding: 0,
    borderRadius: "8px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#667085",
    cursor: "grab",
    fontSize: "16px",
    lineHeight: 1,
  },
  expandButton: {
    padding: "6px 9px",
    border: 0,
    background: "transparent",
    color: "#667085",
    cursor: "pointer",
    fontWeight: 500,
  },
  singlePhaseCard: {
    borderLeft: "6px solid #007D8F",
  },
  threePhaseCard: {
    borderLeft: "6px solid #dc2626",
  },
  cardWarning: {
    borderColor: "#F2C94C",
    background: "#FFF8E5",
  },
  cardCritical: {
    borderColor: "#E5484D",
    background: "#FDECEC",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "14px",
  },
  row: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "12px",
  },
  phaseSummaryBox: {
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
    padding: "12px",
    background: "white",
    marginBottom: "14px",
  },
  phaseSummaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "10px",
    color: "#111827",
  },
  phaseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  phaseCard: {
    border: "1px solid #DCE5EC",
    borderRadius: "10px",
    padding: "10px",
    background: "#F8FAFC",
  },
  phaseHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
  },
  phaseText: {
    margin: "5px 0 8px",
    color: "#667085",
    fontSize: "13px",
  },
  meter: {
    height: "8px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "#E5E7EB",
  },
  meterFill: {
    height: "100%",
    borderRadius: "999px",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "rgba(15, 23, 42, 0.55)",
  },
  modal: {
    width: "min(1280px, 100%)",
    maxHeight: "calc(100vh - 48px)",
    overflow: "auto",
    padding: "20px",
    borderRadius: "18px",
    background: "white",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
  },
  confirmModal: {
    width: "min(500px, 100%)",
    padding: "20px",
    borderRadius: "18px",
    background: "white",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
  },
  confirmDescription: {
    margin: "12px 0 0",
    color: "#475467",
    lineHeight: 1.55,
  },
  confirmDeleteButton: {
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid #D92D20",
    background: "#D92D20",
    color: "white",
    cursor: "pointer",
    fontWeight: 500,
  },
  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "16px",
  },
  modalTitle: { margin: 0 },
  modalDescription: { margin: "6px 0 0", color: "#667085" },
  closeButton: {
    width: "34px",
    height: "34px",
    padding: 0,
    borderRadius: "9px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#344054",
    cursor: "pointer",
    fontSize: "22px",
    lineHeight: 1,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #DCE5EC",
    borderRadius: "12px",
  },
  table: { width: "100%", minWidth: "1050px", borderCollapse: "collapse" },
  tableHeader: {
    padding: "10px",
    borderBottom: "1px solid #DCE5EC",
    background: "#F8FAFC",
    color: "#475467",
    fontSize: "12px",
    fontWeight: 500,
    textAlign: "left",
  },
  handleColumn: {
    width: "48px",
    borderBottom: "1px solid #DCE5EC",
    background: "#F8FAFC",
  },
  removeColumn: {
    width: "90px",
    borderBottom: "1px solid #DCE5EC",
    background: "#F8FAFC",
  },
  tableCell: {
    padding: "8px",
    borderBottom: "1px solid #EEF2F6",
    verticalAlign: "middle",
  },
  tableInput: {
    width: "100%",
    minHeight: "38px",
    padding: "8px 9px",
    borderRadius: "8px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    fontWeight: 400,
  },
  removeRowButton: {
    padding: "7px 9px",
    borderRadius: "8px",
    border: "1px solid #FECACA",
    background: "#FFF7F7",
    color: "#B42318",
    cursor: "pointer",
    fontWeight: 400,
  },
  addRowButton: {
    marginTop: "12px",
    padding: "9px 12px",
    borderRadius: "9px",
    border: "1px solid #DCE5EC",
    background: "white",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 500,
  },
  modalFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "18px",
    paddingTop: "16px",
    borderTop: "1px solid #EEF2F6",
  },
};
